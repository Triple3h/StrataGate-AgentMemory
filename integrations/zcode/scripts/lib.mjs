/**
 * Config mutation logic for the StrataGate ZCode installer.
 *
 * Kept dependency-free and exported so the test suite can exercise the
 * migration without built artifacts. `install.mjs` verifies dist/manifest.json
 * hashes first, then delegates here.
 */
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const HOOK_EVENTS = [
  ['UserPromptSubmit', 20],
  ['Stop', 30],
  ['SessionStart', 15],
  ['PostToolUse', 10],
]

// ZCode's supported hook events are exactly SessionStart, UserPromptSubmit,
// PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Stop — the
// events below were declared by earlier installers and never fired.
export const LEGACY_EVENTS = ['SubagentStart', 'SubagentStop', 'PreCompact', 'Interrupt']

const IDENTITY_KEY_RE = /(?:AGENT_ID|SOURCE_ADAPTER|PROJECT_DIR|PROJECT_ID|SESSION_ID|CONNECTION_CONFIG|DISABLE_WORKBUDDY_MODEL)$/

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function save(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, value, { mode: 0o600 })
  renameSync(temp, path)
}

export function writeJsonAtomic(path, obj) {
  const temp = `${path}.tmp-${process.pid}`
  writeFileSync(temp, `${JSON.stringify(obj, null, 2)}\n`)
  renameSync(temp, path)
}

function isLegacyCommand(command) {
  return typeof command === 'string' && command.includes('zcode-hook.mjs')
}

function isCurrentCommand(command, distDir) {
  return typeof command === 'string' && command.includes(join(distDir, 'hook.cjs'))
}

/**
 * Merge connection settings: existing connection file + the previous MCP env
 * (so model-provider settings survive the migration) + the current process
 * environment. Identity keys are owned by the adapter at runtime, never stored.
 */
export function buildConnection({ existing = {}, previousEnv = {}, processEnv = process.env } = {}) {
  const connection = { ...existing }
  for (const [key, value] of Object.entries({ ...previousEnv, ...connection, ...processEnv })) {
    if (!key.startsWith('STRATAGATE_') || typeof value !== 'string') continue
    if (IDENTITY_KEY_RE.test(key)) continue
    connection[key] = value
  }
  connection.STRATAGATE_GATEWAY_URL ||= 'http://127.0.0.1:43731'
  connection.STRATAGATE_USER_ID ||= processEnv.USER || processEnv.USERNAME || 'default'
  connection.STRATAGATE_NAMESPACE_PREFIX ||= 'shared'
  connection.STRATAGATE_GATEWAY_TIMEOUT_MS ||= '5000'
  return connection
}

function updateHooks(cfg, hookCmd, distDir) {
  const changes = []
  cfg.hooks ??= {}
  cfg.hooks.enabled = true
  const events = cfg.hooks.events ??= {}
  for (const [event, timeout] of HOOK_EVENTS) {
    const list = Array.isArray(events[event]) ? events[event] : []
    const kept = list.filter((group) => !((group?.hooks ?? []).some((hook) => isLegacyCommand(hook?.command))))
    const target = kept.find((group) => (group?.hooks ?? []).some((hook) => isCurrentCommand(hook?.command, distDir)))
    if (target) {
      const hook = target.hooks.find((hook) => isCurrentCommand(hook.command, distDir))
      if (hook.command !== hookCmd) {
        hook.command = hookCmd
        changes.push(`hooks.events.${event} migrated to the standalone ZCode adapter`)
      } else {
        changes.push(`hooks.events.${event} already present (left untouched)`)
      }
      events[event] = kept
    } else {
      // ZCode's config.json hook schema requires a non-empty matcher per group.
      kept.push({ matcher: '.*', hooks: [{ type: 'command', command: hookCmd, timeout }] })
      events[event] = kept
      changes.push(`added hooks.events.${event}`)
    }
  }
  for (const event of LEGACY_EVENTS) {
    const list = Array.isArray(events[event]) ? events[event] : []
    const kept = list.filter((group) => !((group?.hooks ?? []).some((hook) => typeof hook?.command === 'string' && (isLegacyCommand(hook.command) || isCurrentCommand(hook.command, distDir)))))
    if (kept.length !== list.length) changes.push(`removed hooks.events.${event} (unsupported ZCode event, never fired)`)
    if (kept.length === 0) delete events[event]
    else events[event] = kept
  }
  return changes
}

export function installZcode({ configPath, connectionPath, distDir, execPath = process.execPath, existingConnection = null, previousEnv = {}, processEnv = process.env }) {
  const cfg = readJson(configPath)
  const changes = []

  const connection = buildConnection({ existing: existingConnection ?? (existsSync(connectionPath) ? readJson(connectionPath) : {}), previousEnv, processEnv })
  const dataDir = connection.STRATAGATE_DATA_DIR || join(homedir(), '.stratagate', 'agent-memory')
  if (existsSync(connectionPath)) copyFileSync(connectionPath, `${connectionPath}.backup`)
  save(connectionPath, `${JSON.stringify(connection, null, 2)}\n`)
  changes.push(`wrote ${connectionPath}`)

  cfg.mcp ??= { servers: {} }
  cfg.mcp.servers ??= {}
  cfg.mcp.servers.stratagate = {
    enabled: true,
    type: 'stdio',
    command: execPath,
    args: [join(distDir, 'server.cjs')],
    env: {
      STRATAGATE_CONNECTION_CONFIG: connectionPath,
      STRATAGATE_DATA_DIR: dataDir,
    },
    timeoutMs: 120000,
  }
  changes.push('mcp.servers.stratagate pointed at the standalone ZCode adapter')

  const hookCmd = `${JSON.stringify(execPath)} "${join(distDir, 'hook.cjs')}" --connection-config "${connectionPath}"`
  changes.push(...updateHooks(cfg, hookCmd, distDir))

  return { config: cfg, connection, changes }
}

export function verifyManifest({ distDir, expectedName = 'stratagate-zcode', expectedVersion = null, artifacts = ['hook.cjs', 'server.cjs', 'cli.cjs', 'star-widget-client.global.js'] }) {
  const manifest = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'))
  if (manifest.name !== expectedName) throw new Error('Wrong ZCode artifact manifest')
  if (expectedVersion && manifest.version !== expectedVersion) throw new Error(`Manifest version ${manifest.version} != package ${expectedVersion}; rebuild with npm run build`)
  for (const name of artifacts) {
    const hash = createHash('sha256').update(readFileSync(join(distDir, name))).digest('hex')
    if (hash !== manifest.files[name]) throw new Error(`Artifact hash mismatch: ${name}; rebuild with npm run build`)
  }
  return manifest
}
