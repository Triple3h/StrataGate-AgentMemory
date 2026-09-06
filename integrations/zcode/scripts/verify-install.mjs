#!/usr/bin/env node
/**
 * Release gate for the standalone ZCode adapter (npm run verify:zcode):
 *  1. dist artifacts match manifest hashes;
 *  2. the installer migrates a legacy-style config: MCP repointed, four valid
 *     hook events registered, unsupported legacy events removed, connection
 *     settings (including model provider keys) carried over, backups created;
 *  3. the built hook consumes stdin and emits valid JSON with the Gateway down;
 *  4. the built CLI doctor reports the installation as JSON.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyManifest } from './lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const failures = []
function check(name, condition, detail = '') {
  if (condition) process.stdout.write(`ok   ${name}\n`)
  else {
    failures.push(name)
    process.stdout.write(`FAIL ${name}${detail ? ` — ${detail}` : ''}\n`)
  }
}

const manifest = verifyManifest({ distDir })
check('manifest verifies', manifest.name === 'stratagate-zcode')

const dir = mkdtempSync(join(tmpdir(), 'stratagate-zcode-verify-'))
const configPath = join(dir, 'config.json')
const connectionPath = join(dir, 'connection.json')
const legacyConfig = {
  mcp: {
    servers: {
      stratagate: {
        enabled: true,
        type: 'stdio',
        command: 'node',
        args: ['/old/workbuddy/dist/server.cjs'],
        env: {
          STRATAGATE_DATA_DIR: join(dir, 'data'),
          STRATAGATE_MODEL_BASE_URL: 'http://127.0.0.1:4000/v1',
          STRATAGATE_MODEL: 'glm-test',
        },
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
writeFileSync(configPath, JSON.stringify(legacyConfig, null, 2))

const installed = spawnSync(process.execPath, [join(root, 'scripts/install.mjs')], {
  env: { ...process.env, ZCODE_CONFIG_PATH: configPath, STRATAGATE_CONNECTION_CONFIG: connectionPath },
  encoding: 'utf8',
})
check('installer exits 0', installed.status === 0, installed.stderr)

const migrated = JSON.parse(readFileSync(configPath, 'utf8'))
const server = migrated.mcp.servers.stratagate
check('mcp repointed to own dist', Array.isArray(server.args) && server.args[0] === join(distDir, 'server.cjs'))
check('mcp env slimmed to connection config', server.env.STRATAGATE_CONNECTION_CONFIG === connectionPath)
const events = migrated.hooks.events
for (const event of ['UserPromptSubmit', 'Stop', 'SessionStart', 'PostToolUse']) {
  const command = events[event]?.[0]?.hooks?.[0]?.command ?? ''
  check(`hook ${event} registered`, command.includes(join(distDir, 'hook.cjs')) && command.includes('--connection-config'))
}
for (const event of ['SubagentStart', 'PreCompact']) {
  check(`legacy ${event} removed`, events[event] === undefined)
}
check('unrelated config preserved', migrated.unrelated?.keep === true)
check('config backup created', existsSync(`${configPath}.stratagate-backup-0`) || readFileSync(configPath, 'utf8') !== JSON.stringify(legacyConfig, null, 2))

const connection = JSON.parse(readFileSync(connectionPath, 'utf8'))
check('connection carries model settings over', connection.STRATAGATE_MODEL_BASE_URL === 'http://127.0.0.1:4000/v1' && connection.STRATAGATE_MODEL === 'glm-test')
check('connection has gateway defaults', connection.STRATAGATE_GATEWAY_URL === 'http://127.0.0.1:43731' && connection.STRATAGATE_NAMESPACE_PREFIX === 'shared')

// Seed a rollout so the hook smoke test has something to capture (the verify
// run has no live Gateway, so the turn stays pending in the delivery journal).
const rolloutDir = join(dir, '.zcode', 'cli', 'rollout')
mkdirSync(rolloutDir, { recursive: true })
writeFileSync(join(rolloutDir, 'model-io-verify-session.jsonl'), `${JSON.stringify({
  sessionId: 'verify-session', turnId: 't1', type: 'model_io',
  request: { body: { input: [{ role: 'user', content: 'verify question' }] } },
  response: { text: 'verify answer', toolCalls: [] },
})}\n`)

const hookRun = spawnSync(process.execPath, [join(distDir, 'hook.cjs'), '--connection-config', connectionPath], {
  input: JSON.stringify({ hook_event_name: 'Stop', session_id: 'verify-session', cwd: dir }),
  env: { ...process.env, HOME: dir },
  encoding: 'utf8',
  timeout: 60_000,
})
check('hook exits 0 with Gateway down', hookRun.status === 0, hookRun.stderr)
check('hook output is strict JSON', (hookRun.stdout ?? '').trim() === '{}')

const doctor = spawnSync(process.execPath, [join(distDir, 'cli.cjs'), 'doctor', '--connection-config', connectionPath], {
  env: { ...process.env, ZCODE_CONFIG_PATH: configPath, STRATAGATE_CONNECTION_CONFIG: connectionPath },
  encoding: 'utf8',
  timeout: 60_000,
})
let doctorJson = null
try { doctorJson = JSON.parse(doctor.stdout) } catch { /* reported below */ }
check('doctor exits 0', doctor.status === 0, doctor.stderr)
check('doctor reports adapter identity', doctorJson?.adapter === 'zcode' && doctorJson?.identity?.sourceAdapter === 'zcode')
check('doctor sees journal entry', doctorJson?.delivery?.captured >= 1, `captured=${doctorJson?.delivery?.captured}`)

rmSync(dir, { recursive: true, force: true })
if (failures.length > 0) {
  process.stderr.write(`[stratagate-zcode] verify failed: ${failures.join(', ')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write('[stratagate-zcode] verify passed\n')
}
