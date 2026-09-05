#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { existsSync, readFileSync, copyFileSync, mkdirSync, writeFileSync, renameSync, chmodSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { parse } from 'smol-toml'
import { updateCodexConfig } from './config-editor.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
const configPath = process.env.CODEX_CONFIG_PATH || join(homedir(), '.codex', 'config.toml')
const connectionPath = option('--connection-config') || process.env.STRATAGATE_CONNECTION_CONFIG || join(homedir(), '.stratagate', 'connection.json')
function save(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, value, { mode: 0o600 })
  renameSync(temp, path)
  chmodSync(path, 0o600)
}
try {
  const manifest = JSON.parse(readFileSync(join(root, 'dist/manifest.json'), 'utf8'))
  if (manifest.name !== 'stratagate-codex') throw new Error('Wrong Codex artifact manifest')
  for (const name of ['hook.cjs', 'server.cjs', 'cli.cjs', 'capture.cjs', 'star-widget-client.global.js']) {
    const hash = createHash('sha256').update(readFileSync(join(root, 'dist', name))).digest('hex')
    if (hash !== manifest.files[name]) throw new Error(`Codex artifact hash mismatch: ${name}`)
  }
  const original = readFileSync(configPath, 'utf8')
  const oldEnv = parse(original).mcp_servers?.stratagate?.env ?? {}
  const connection = existsSync(connectionPath) ? JSON.parse(readFileSync(connectionPath, 'utf8')) : {}
  const supplied = option('--connection-env') ? parseEnv(readFileSync(resolve(option('--connection-env')), 'utf8')) : {}
  for (const [key, value] of Object.entries({ ...oldEnv, ...connection, ...supplied, ...process.env })) {
    if (!key.startsWith('STRATAGATE_') || typeof value !== 'string') continue
    if (/(?:AGENT_ID|SOURCE_ADAPTER|PROJECT_DIR|PROJECT_ID|SESSION_ID|CONNECTION_CONFIG|DISABLE_WORKBUDDY_MODEL)$/.test(key)) continue
    connection[key] = value
  }
  connection.STRATAGATE_GATEWAY_URL ||= 'http://127.0.0.1:43731'
  connection.STRATAGATE_USER_ID ||= process.env.USER || 'default'
  connection.STRATAGATE_NAMESPACE_PREFIX ||= 'shared'
  connection.STRATAGATE_GATEWAY_TIMEOUT_MS ||= '5000'
  const result = updateCodexConfig(original, { node: process.execPath, root, connection: connectionPath })
  if (existsSync(connectionPath)) copyFileSync(connectionPath, `${connectionPath}.backup`)
  save(connectionPath, JSON.stringify(connection, null, 2) + '\n')
  if (result !== original) {
    copyFileSync(configPath, `${configPath}.stratagate-backup-${Date.now()}`)
    save(configPath, result)
  }
  console.log(JSON.stringify({ installed: true, adapter: 'codex', configPath, connectionPath, tokenConfigured: Boolean(connection.STRATAGATE_GATEWAY_TOKEN) }))
  console.log('Restart Codex and trust changed hook commands when prompted; doctor reports actual execution separately.')
} catch (error) {
  console.error(`[stratagate-codex] ${error.message}`)
  process.exitCode = 1
}
