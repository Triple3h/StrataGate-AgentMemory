import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Server } from 'node:http'
import { createHash } from 'node:crypto'
import { capture, journal } from '../src/capture.js'
import { handleHook } from '../src/hook.js'
import { zcodeConfig } from '../src/config.js'
import { GatewayClient } from '../../../packages/adapter-sdk/src/gateway-client.js'
import { createGatewayHandler } from '../../../packages/gateway/src/gateway-api.js'
import { resolveConfig } from '../../../packages/adapter-sdk/src/config.js'
// @ts-expect-error Installer lib is a Node ESM script.
import { installZcode, verifyManifest } from '../scripts/lib.mjs'

const dirs: string[] = []
const servers: Server[] = []
afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()))
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

type Row = Record<string, unknown>

function rolloutLine(turnId: string, options: { user?: string; text?: string; toolCalls?: unknown[]; toolOutput?: { callId: string; output: string } } = {}): string {
  const input: unknown[] = []
  if (options.user) input.push({ role: 'user', content: options.user })
  if (options.toolOutput) input.push({ type: 'function_call_output', call_id: options.toolOutput.callId, output: options.toolOutput.output })
  return JSON.stringify({ sessionId: 's1', turnId, type: 'model_io', request: { body: { input } }, response: { text: options.text ?? '', toolCalls: options.toolCalls ?? [] } })
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'zcode-adapter-test-'))
  dirs.push(dir)
  const env: NodeJS.ProcessEnv = {
    STRATAGATE_DATA_DIR: join(dir, 'data'),
    STRATAGATE_DATABASE: join(dir, 'data', 'memory.db'),
    STRATAGATE_USER_ID: 'test',
    STRATAGATE_CONNECTION_CONFIG: join(dir, 'connection.json'),
  }
  const { handler } = createGatewayHandler(resolveConfig(env, dir), 'token')
  const server = createServer((req, res) => { void handler(req, res) })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  await writeFile(env.STRATAGATE_CONNECTION_CONFIG!, JSON.stringify({ STRATAGATE_GATEWAY_URL: url, STRATAGATE_GATEWAY_TOKEN: 'token', STRATAGATE_DATA_DIR: join(dir, 'data') }))
  return { dir, env, url }
}

describe('ZCode adapter', () => {
  it('shares connection and namespace with the other adapters while enforcing ZCode provenance', async () => {
    const { dir, env } = await setup()
    const config = zcodeConfig(dir, { ...env, STRATAGATE_AGENT_ID: 'workbuddy' })
    expect(config.agentId).toBe('zcode')
    expect(config.sourceAdapter).toBe('zcode')
    expect(config.workBuddyModel).toBeUndefined()
    expect(GatewayClient.fromEnv(env).options.token).toBe('token')
    expect(config.namespace).toBe(resolveConfig({ ...env, STRATAGATE_SOURCE_ADAPTER: 'zcode' }, dir).namespace)
  })

  it('captures completed turns on PostToolUse and folds the active turn on Stop', async () => {
    const { dir, env } = await setup()
    const path = join(dir, 'model-io-s1.jsonl')
    const partial = [
      rolloutLine('t1', { user: 'first question', toolCalls: [{ id: 'c1', name: 'Bash', input: { command: 'pwd' } }] }),
      rolloutLine('t1', { toolOutput: { callId: 'c1', output: '/project' }, text: 'final answer one' }),
      rolloutLine('t2', { user: 'second question', text: 'working…' }),
    ]
    await writeFile(path, partial.join('\n') + '\n')
    expect(await handleHook({ hook_event_name: 'PostToolUse', session_id: 's1', cwd: dir, rollout_path: path }, env)).toEqual({})

    await writeFile(path, [...partial, rolloutLine('t2', { text: 'final answer two' })].join('\n') + '\n')
    expect(await handleHook({ hook_event_name: 'Stop', session_id: 's1', cwd: dir, rollout_path: path }, env)).toEqual({})

    const snapshot = await GatewayClient.fromEnv(env).snapshot(zcodeConfig(dir, env).namespace) as Row
    expect(snapshot.currentTurn).toBe(2)
    const openTail = snapshot.openTail as Array<Row>
    expect(new Set(openTail.map((m) => m.sourceAdapter))).toEqual(new Set(['zcode']))
    expect(openTail.some((m) => m.role === 'user' && String(m.content).includes('second question'))).toBe(true)
    expect(openTail.some((m) => m.role === 'assistant' && String(m.content).includes('final answer two'))).toBe(true)
    expect(openTail.some((m) => m.role === 'assistant' && String(m.content).includes('final answer one'))).toBe(true)
  })

  it('never delivers the same turn twice across repeated hooks', async () => {
    const { dir, env } = await setup()
    const path = join(dir, 'model-io-idem.jsonl')
    await writeFile(path, rolloutLine('t1', { user: 'q', text: 'a' }) + '\n')
    expect(await capture({ sessionId: 'idem', cwd: dir, rolloutPath: path }, { env })).toMatchObject({ turns: 1 })
    expect(await capture({ sessionId: 'idem', cwd: dir, rolloutPath: path }, { env })).toMatchObject({ turns: 0, delivery: { sent: 0, pending: 0 } })
    const snapshot = await GatewayClient.fromEnv(env).snapshot(zcodeConfig(dir, env).namespace) as Row
    expect(snapshot.currentTurn).toBe(1)
  })

  it('durably queues on gateway failure and replays after recovery', async () => {
    const { dir, env } = await setup()
    const path = join(dir, 'model-io-off.jsonl')
    await writeFile(path, rolloutLine('t1', { user: 'offline question', text: 'offline answer' }) + '\n')
    const result = await capture({ sessionId: 'off', cwd: dir, rolloutPath: path }, { env: { ...env, STRATAGATE_GATEWAY_URL: 'http://127.0.0.1:1' } })
    expect(result).toMatchObject({ turns: 1, delivery: { sent: 0, pending: 1 } })
    const queued = await journal(env).entries()
    expect(queued).toHaveLength(1)
    expect((await stat(queued[0]!.path)).mode & 0o777).toBe(0o600)
    const cursor = JSON.parse(await readFile(join(dir, 'data', 'state', 'zcode', `${createHash('sha256').update('off:zcode').digest('hex')}.json`), 'utf8'))
    expect(cursor.lastTurnId).toBe('t1')
    expect(await journal(env).flush(GatewayClient.fromEnv(env))).toMatchObject({ sent: 1, pending: 0 })
    expect(await journal(env).flush(GatewayClient.fromEnv(env))).toMatchObject({ sent: 0, pending: 0 })
  })

  it('recalls through the gateway on UserPromptSubmit and stays strict', async () => {
    const { dir, env } = await setup()
    const empty = await handleHook({ hook_event_name: 'UserPromptSubmit', session_id: 's2', cwd: dir, prompt: 'unrelated gibberish query xyz' }, env)
    expect(empty).toEqual({})
    const config = zcodeConfig(dir, env)
    await GatewayClient.fromEnv(env).ingest({
      user: 'prefer mangoes in summer harvest', assistant: 'noted', namespace: config.namespace, userId: 'test',
      agentId: 'zcode', sourceAdapter: 'zcode', projectDir: dir, projectId: config.projectId!, conversationId: 's2', receiptId: 'seed-1',
    })
    const seeded = await handleHook({ hook_event_name: 'UserPromptSubmit', session_id: 's2', cwd: dir, prompt: 'prefer mangoes in summer harvest' }, env) as Row
    if (Object.keys(seeded).length > 0) {
      expect((seeded.hookSpecificOutput as Row).hookEventName).toBe('UserPromptSubmit')
      expect(typeof (seeded.hookSpecificOutput as Row).additionalContext).toBe('string')
    }
  })

  it('flushes the journal on SessionStart and recaps after compaction', async () => {
    const { dir, env } = await setup()
    const path = join(dir, 'model-io-ss.jsonl')
    await writeFile(path, rolloutLine('t1', { user: 'queued question', text: 'queued answer' }) + '\n')
    await capture({ sessionId: 'ss', cwd: dir, rolloutPath: path }, { env: { ...env, STRATAGATE_GATEWAY_URL: 'http://127.0.0.1:1' } })
    expect((await journal(env).entries()).every((entry) => !entry.value.deliveredAt)).toBe(true)

    expect(await handleHook({ hook_event_name: 'SessionStart', session_id: 'ss', cwd: dir, reason: 'startup' }, env)).toEqual({})
    expect((await journal(env).entries()).every((entry) => entry.value.deliveredAt)).toBe(true)

    const compacted = await handleHook({ hook_event_name: 'SessionStart', session_id: 'ss', cwd: dir, reason: 'compact' }, env) as Row
    expect(String((compacted.hookSpecificOutput as Row)?.additionalContext)).toContain('StrataGate')
  })

  it('repairs legacy workbuddy provenance into zcode', async () => {
    const { dir, env } = await setup()
    const client = GatewayClient.fromEnv(env)
    const config = zcodeConfig(dir, env)
    const turn = {
      user: 'legacy question', assistant: 'legacy answer', createdAt: '2026-09-05T10:00:00.000Z',
      projectDir: dir, namespace: config.namespace, userId: 'test', conversationId: 'legacy',
      threadId: 'legacy:agent:zcode:0000000000000000', agentId: 'workbuddy', sourceAdapter: 'gateway', receiptId: 'old-receipt',
    }
    await client.ingest(turn)
    const before = await client.snapshot(config.namespace) as Row
    const updates = (before.openTail as Array<Row>).map((m) => ({ id: m.id, contentHash: createHash('sha256').update(String(m.content)).digest('hex') }))
    expect(await client.repairAdapter({ namespace: config.namespace, updates, apply: false, targetAgent: 'zcode' })).toMatchObject({ messages: 2, applied: false })
    await client.repairAdapter({ namespace: config.namespace, updates, apply: true, targetAgent: 'zcode' })
    const after = await client.snapshot(config.namespace) as Row
    expect((after.openTail as Array<Row>).every((m) => m.sourceAdapter === 'zcode' && m.agentId === 'zcode')).toBe(true)
    await expect(client.repairAdapter({ namespace: config.namespace, updates: [{ id: updates[0]!.id, contentHash: 'wrong' }], apply: true, targetAgent: 'zcode' })).rejects.toMatchObject({ status: 409 })
    await expect(client.repairAdapter({ namespace: config.namespace, updates, apply: true, targetAgent: 'claude' })).rejects.toMatchObject({ status: 400 })
  })
})

describe('ZCode installer', () => {
  const legacyConfig = {
    mcp: {
      servers: {
        stratagate: {
          enabled: true, type: 'stdio', command: 'node', args: ['/old/workbuddy/dist/server.cjs'],
          env: { STRATAGATE_DATA_DIR: '/tmp/legacy-data', STRATAGATE_MODEL_BASE_URL: 'http://127.0.0.1:4000/v1', STRATAGATE_MODEL: 'glm-test', STRATAGATE_AGENT_ID: 'zcode' },
        },
      },
    },
    hooks: {
      enabled: true,
      events: {
        UserPromptSubmit: [{ matcher: '.*', hooks: [{ type: 'command', command: 'node "/old/zcode/scripts/zcode-hook.mjs"', timeout: 20 }] }],
        Stop: [{ matcher: '.*', hooks: [{ type: 'command', command: 'node "/old/zcode/scripts/zcode-hook.mjs"', timeout: 30 }] }],
        SubagentStart: [{ matcher: '.*', hooks: [{ type: 'command', command: 'node "/old/zcode/scripts/zcode-hook.mjs"', timeout: 10 }] }],
        PreCompact: [{ matcher: '.*', hooks: [{ type: 'command', command: 'node "/old/zcode/scripts/zcode-hook.mjs"', timeout: 30 }] }],
      },
    },
    unrelated: { keep: true },
  }

  function fakeDist(dir: string): string {
    const distDir = join(dir, 'dist')
    mkdirSync(distDir)
    const hashes: Record<string, string> = {}
    for (const name of ['hook.cjs', 'server.cjs', 'cli.cjs', 'star-widget-client.global.js']) {
      const content = `artifact ${name}`
      writeFileSync(join(distDir, name), content)
      hashes[name] = createHash('sha256').update(content).digest('hex')
    }
    writeFileSync(join(distDir, 'manifest.json'), JSON.stringify({ name: 'stratagate-zcode', version: '0.1.0', files: hashes }))
    return distDir
  }

  it('migrates a legacy install, removes unsupported events, and is idempotent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zcode-install-'))
    try {
      const distDir = fakeDist(dir)
      const configPath = join(dir, 'config.json')
      writeFileSync(configPath, JSON.stringify(legacyConfig))
      const connectionPath = join(dir, 'connection.json')
      const { config, changes } = installZcode({ configPath, connectionPath, distDir, execPath: '/usr/local/node', previousEnv: legacyConfig.mcp.servers.stratagate.env, processEnv: {} })

      const server = config.mcp.servers.stratagate
      expect(server.args[0]).toBe(join(distDir, 'server.cjs'))
      expect(server.env).toEqual({ STRATAGATE_CONNECTION_CONFIG: connectionPath, STRATAGATE_DATA_DIR: '/tmp/legacy-data' })
      for (const event of ['UserPromptSubmit', 'Stop', 'SessionStart', 'PostToolUse']) {
        const command = config.hooks.events[event][0].hooks[0].command
        expect(command).toContain(join(distDir, 'hook.cjs'))
        expect(command).toContain('--connection-config')
        expect(config.hooks.events[event][0].matcher).toBe('.*')
      }
      for (const event of ['SubagentStart', 'SubagentStop', 'PreCompact', 'Interrupt']) {
        expect(config.hooks.events[event]).toBeUndefined()
      }
      expect(config.unrelated.keep).toBe(true)
      expect(changes.length).toBeGreaterThan(0)

      const connection = JSON.parse(readFileSync(connectionPath, 'utf8'))
      expect(connection.STRATAGATE_MODEL).toBe('glm-test')
      expect(connection.STRATAGATE_MODEL_BASE_URL).toBe('http://127.0.0.1:4000/v1')
      expect(connection.STRATAGATE_AGENT_ID).toBeUndefined()
      expect(connection.STRATAGATE_GATEWAY_URL).toBe('http://127.0.0.1:43731')
      expect(connection.STRATAGATE_NAMESPACE_PREFIX).toBe('shared')

      writeFileSync(configPath, JSON.stringify(config))
      const second = installZcode({ configPath, connectionPath, distDir, execPath: '/usr/local/node', previousEnv: legacyConfig.mcp.servers.stratagate.env, processEnv: {} })
      expect(JSON.stringify(second.config)).toBe(JSON.stringify(config))
      expect(second.changes.join('\n')).toContain('already present')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects tampered artifacts and wrong manifest names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zcode-verify-'))
    try {
      const distDir = fakeDist(dir)
      expect(verifyManifest({ distDir, expectedVersion: '0.1.0' }).name).toBe('stratagate-zcode')
      const manifest = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'))
      manifest.files['hook.cjs'] = '0'.repeat(64)
      writeFileSync(join(distDir, 'manifest.json'), JSON.stringify(manifest))
      expect(() => verifyManifest({ distDir })).toThrow('Artifact hash mismatch')
      manifest.name = 'stratagate-codex'
      writeFileSync(join(distDir, 'manifest.json'), JSON.stringify(manifest))
      expect(() => verifyManifest({ distDir })).toThrow('Wrong ZCode artifact manifest')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
