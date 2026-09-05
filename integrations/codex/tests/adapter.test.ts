import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Server } from 'node:http'
import { createHash } from 'node:crypto'
import { parse as parseToml } from 'smol-toml'
import { parseCodexTranscript, codexReceipt } from '../src/transcript.js'
import { capture, journal } from '../src/capture.js'
import { codexConfig } from '../src/config.js'
import { handleHook } from '../src/hook.js'
import { GatewayClient } from '../../../packages/adapter-sdk/src/gateway-client.js'
import { createGatewayHandler } from '../../../packages/gateway/src/gateway-api.js'
import { resolveConfig } from '../../../packages/adapter-sdk/src/config.js'
// @ts-expect-error Installer is a Node ESM script.
import { updateCodexConfig } from '../scripts/config-editor.mjs'

const dirs: string[] = []
const servers: Server[] = []
afterEach(async () => { for (const server of servers.splice(0)) await new Promise<void>(r => server.close(() => r())); for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }) })
const buffer = (rows: unknown[]) => Buffer.from(rows.map(r => JSON.stringify(r)).join('\n') + '\n')
const event = (type: string, turn: string, extra = {}) => ({ type: 'event_msg', payload: { type, turn_id: turn, ...extra } })
function rows(cwd: string, session = 'session-1') {
  return [
    { type: 'session_meta', payload: { id: session, cwd } },
    event('task_started', 'one'),
    { type: 'response_item', payload: { type: 'message', role: 'user', content: 'injected environment' } },
    event('item_completed', 'one', { item: { type: 'UserMessage', content: 'continue' } }),
    { type: 'response_item', payload: { type: 'custom_tool_call', name: 'Bash', call_id: 'call', input: 'pwd', internal_chat_message_metadata_passthrough: { turn_id: 'upstream-generation' } } },
    { type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'call', output: '/project' } },
    event('item_completed', 'one', { item: { type: 'AgentMessage', content: 'done' } }),
    event('task_complete', 'one'),
    event('task_started', 'two'),
    event('item_completed', 'two', { item: { type: 'UserMessage', content: 'continue' } }),
    event('item_completed', 'two', { item: { type: 'AgentMessage', content: 'done' } }),
    event('task_complete', 'two'),
    event('task_started', 'three'),
    event('item_completed', 'three', { item: { type: 'UserMessage', content: 'unfinished' } }),
    event('item_completed', 'three', { item: { type: 'AgentMessage', content: 'working' } }),
  ]
}
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'codex-adapter-test-')); dirs.push(dir)
  const env = { STRATAGATE_DATA_DIR: dir, STRATAGATE_DATABASE: join(dir, 'memory.db'), STRATAGATE_USER_ID: 'test', STRATAGATE_DISABLE_WORKBUDDY_MODEL: '1', STRATAGATE_CONNECTION_CONFIG: join(dir, 'connection.json') }
  const { handler } = createGatewayHandler(resolveConfig(env, dir), 'token')
  const server = createServer((req, res) => { void handler(req, res) }); servers.push(server)
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  await writeFile(env.STRATAGATE_CONNECTION_CONFIG, JSON.stringify({ STRATAGATE_GATEWAY_URL: url, STRATAGATE_GATEWAY_TOKEN: 'token' }))
  const path = join(dir, 'rollout.jsonl'); await writeFile(path, buffer(rows(dir)))
  return { dir, env, path, url }
}

describe('Codex capture', () => {
  it('keeps repeated turns, excludes injected context, merges tool sources, and leaves active work pending', () => {
    const result = parseCodexTranscript(buffer(rows('/project')))
    expect(result.turns.map(t => t.turn.user)).toEqual(['continue', 'continue'])
    expect(result.turns[0]?.turn.assistantToolCalls).toEqual([{ name: 'Bash', arguments: { raw: 'pwd' }, result: '/project' }])
    expect(parseCodexTranscript(buffer(rows('/project')), { completeActive: true }).turns).toHaveLength(3)
  })
  it('does not consume truncated JSON and separates child receipts', () => {
    const input = buffer(rows('/project'))
    const result = parseCodexTranscript(Buffer.concat([input, Buffer.from('{"payload":')]))
    expect(result.consumedBytes).toBe(input.length)
    expect(codexReceipt('s', 'primary', 't')).not.toBe(codexReceipt('s', 'child', 't'))
  })
  it('preserves repeated user steering within a native turn', () => {
    const input = rows('/project')
    input.splice(4, 0, event('item_completed', 'one', { item: { type: 'UserMessage', content: 'continue' } }) as typeof input[0])
    expect(parseCodexTranscript(buffer(input)).turns[0]?.turn.user).toBe('continue\n\ncontinue')
  })
  it('shares connection and namespace between hook and MCP while enforcing Codex provenance', async () => {
    const { dir, env } = await setup()
    const config = codexConfig(dir, { ...env, STRATAGATE_AGENT_ID: 'workbuddy' })
    expect(config.agentId).toBe('codex')
    expect(config.sourceAdapter).toBe('codex')
    expect(config.workBuddyModel).toBeUndefined()
    expect(GatewayClient.fromEnv(env).options.token).toBe('token')
    expect(config.namespace).toBe(resolveConfig({ ...env, STRATAGATE_SOURCE_ADAPTER: 'zcode' }, dir).namespace)
  })
  it('captures every complete turn once across hooks, backfill, new sessions and child agents', async () => {
    const { dir, env, path } = await setup()
    await capture(path, { env })
    await capture(path, { env })
    await handleHook({ hook_event_name: 'PreCompact', session_id: 'session-1', transcript_path: path, cwd: dir }, env)
    const child = join(dir, 'child.jsonl'); await writeFile(child, buffer(rows(dir, 'child-session')))
    await capture(child, { env, agentId: 'child' })
    await capture(child, { env })
    const next = join(dir, 'next.jsonl'); await writeFile(next, buffer(rows(dir, 'session-2')))
    await capture(next, { env })
    const snapshot = await GatewayClient.fromEnv(env).snapshot(codexConfig(dir, env).namespace) as any
    expect(snapshot.currentTurn).toBe(6)
    expect(new Set(snapshot.openTail.map((m: any) => m.sourceAdapter))).toEqual(new Set(['codex']))
    expect(new Set(snapshot.openTail.map((m: any) => m.agentId))).toEqual(new Set(['codex', 'codex:child']))
  })
  it('durably captures on 401 and replays after authentication is repaired', async () => {
    const { env, path } = await setup()
    const failed = await capture(path, { env: { ...env, STRATAGATE_GATEWAY_TOKEN: 'wrong' } })
    expect(failed).toMatchObject({ delivery: { pending: 2, status: 401 } })
    const queued = await journal(env).entries()
    expect(queued).toHaveLength(2)
    expect((await stat(queued[0]!.path)).mode & 0o777).toBe(0o600)
    const replay = await journal(env).flush(GatewayClient.fromEnv(env))
    expect(replay).toMatchObject({ sent: 2, pending: 0 })
    expect((await journal(env).flush(GatewayClient.fromEnv(env))).sent).toBe(0)
  })
  it('keeps source text intact during offline capture', async () => {
    const { env, path, dir } = await setup()
    const input = rows(dir)
    input[3] = event('item_completed', 'one', { item: { type: 'UserMessage', content: 'password=exact-source-value' } }) as typeof input[3]
    await writeFile(path, buffer(input))
    await capture(path, { env: { ...env, STRATAGATE_GATEWAY_URL: 'http://127.0.0.1:1' } })
    const queued = await journal(env).entries()
    expect(queued.some(e => e.value.request.user === 'password=exact-source-value')).toBe(true)
  })
  it('repairs only verified legacy provenance and keeps native receipt adoption idempotent', async () => {
    const { env, dir } = await setup()
    const client = GatewayClient.fromEnv(env)
    const config = codexConfig(dir, env)
    const turn = { user: 'legacy question', assistant: 'legacy answer', createdAt: '2026-09-05T10:00:00.000Z',
      projectDir: dir, namespace: config.namespace, userId: 'test', conversationId: 'legacy', threadId: 'legacy:agent:primary:0000000000000000', agentId: 'workbuddy', sourceAdapter: 'gateway', receiptId: 'old-receipt' }
    await client.ingest(turn)
    const before = await client.snapshot(config.namespace) as any
    const updates = before.openTail.map((m: any) => ({ id: m.id, contentHash: createHash('sha256').update(m.content).digest('hex') }))
    expect(await client.repairCodex({ namespace: config.namespace, updates, apply: false })).toMatchObject({ messages: 2, applied: false })
    expect((await client.snapshot(config.namespace) as any).openTail[0].sourceAdapter).toBe('gateway')
    await client.repairCodex({ namespace: config.namespace, updates, apply: true })
    const migrated = await client.ingest({ ...turn, agentId: 'codex', sourceAdapter: 'codex', receiptId: codexReceipt('legacy', 'native', 'one') })
    expect(migrated.duplicate).toBe(true)
    const after = await client.snapshot(config.namespace) as any
    expect(after.currentTurn).toBe(1)
    expect(after.openTail.every((m: any) => m.sourceAdapter === 'codex')).toBe(true)
    expect(after.ingestionReceipts).toHaveLength(2)
    await expect(client.repairCodex({ namespace: config.namespace, updates: [{ id: updates[0].id, contentHash: 'wrong' }], apply: true })).rejects.toMatchObject({ status: 409 })
  })
})

describe('Codex installer', () => {
  it('preserves unrelated TOML and trust records and is idempotent', () => {
    const original = '# user comment\nmodel = "example"\n\n[hooks]\nStop = [{hooks = [{type="command",command="other-hook"}]}]\n[hooks.state."existing"]\ntrusted_hash = "keep"\n\n[mcp_servers.stratagate]\ncommand = "old"\n[mcp_servers.stratagate.env]\nSTRATAGATE_AGENT_ID = "codex"\n\n[other]\nvalue = 4\n'
    const options = { node: '/node with spaces', root: '/project/integrations/codex', connection: '/config/connection.json' }
    const updated = updateCodexConfig(original, options)
    const parsed = parseToml(updated) as any
    expect(updated).toContain('# user comment')
    expect(parsed.hooks.state.existing.trusted_hash).toBe('keep')
    expect(parsed.hooks.Stop).toHaveLength(2)
    expect(parsed.hooks.Interrupt).toHaveLength(1)
    expect(parsed.other.value).toBe(4)
    expect(parsed.mcp_servers.stratagate.env).toEqual({ STRATAGATE_CONNECTION_CONFIG: options.connection })
    expect(updateCodexConfig(updated, options)).toBe(updated)
  })
})
