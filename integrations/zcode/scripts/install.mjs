#!/usr/bin/env node
/**
 * Idempotent installer for the StrataGate ZCode plugin.
 *
 * Registers (or preserves) the StrataGate MCP server and the UserPromptSubmit/Stop
 * hooks in ~/.zcode/cli/config.json using ABSOLUTE paths that resolve to the shared
 * WorkBuddy engine in this repository (integrations/workbuddy/dist).
 *
 * It never removes or rewrites unrelated config; it only ensures the stratagate
 * entries exist and point at this repo's engine. If an entry already exists with
 * a different path it is left untouched and reported.
 */

import { homedir } from 'node:os'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const ENGINE_DIR = join(REPO_ROOT, 'integrations', 'workbuddy', 'dist')
const SERVER = join(ENGINE_DIR, 'server.cjs')
const ZCODE_HOOK = join(REPO_ROOT, 'integrations', 'zcode', 'scripts', 'zcode-hook.mjs')
const CONFIG_PATH = process.env.ZCODE_CONFIG_PATH ?? join(homedir(), '.zcode', 'cli', 'config.json')
const DATA_DIR = process.env.STRATAGATE_DATA_DIR ?? join(homedir(), '.stratagate', 'agent-memory')

function log(msg) {
  process.stdout.write(`[stratagate-zcode] ${msg}\n`)
}

function ensureEngine() {
  if (!existsSync(SERVER) || !existsSync(ZCODE_HOOK)) {
    throw new Error(
      `Engine files not found (server at ${SERVER}, hook at ${ZCODE_HOOK}). Run "npm run build:workbuddy" in the repo root first.`,
    )
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJsonAtomic(path, obj) {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`)
  renameSync(tmp, path)
}

function main() {
  ensureEngine()
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`ZCode config not found at ${CONFIG_PATH}`)
  }
  const cfg = readJson(CONFIG_PATH)
  cfg.mcp ??= { servers: {} }
  cfg.mcp.servers ??= {}

  const changes = []
  const mcp = cfg.mcp.servers.stratagate
  if (!mcp) {
    cfg.mcp.servers.stratagate = {
      enabled: true,
      type: 'stdio',
      command: process.execPath,
      args: [SERVER],
      env: {
        STRATAGATE_DATA_DIR: DATA_DIR,
        STRATAGATE_DATABASE: join(DATA_DIR, 'memory.db'),
        STRATAGATE_PROJECT_DIR: '${ZCODE_PROJECT_DIR}',
        STRATAGATE_DISABLE_WORKBUDDY_MODEL: '1',
      },
      timeoutMs: 120000,
    }
    changes.push('added mcp.servers.stratagate')
  } else {
    changes.push('mcp.servers.stratagate already present (left untouched)')
  }

  cfg.hooks ??= {}
  cfg.hooks.enabled ??= true
  cfg.hooks.events ??= {}
  const hookCmd = `${JSON.stringify(process.execPath)} "${ZCODE_HOOK}"`

  for (const [event, timeout] of [['UserPromptSubmit', 20], ['Stop', 30]]) {
    const list = cfg.hooks.events[event] ?? []
    const exists = list.some(
      (group) => group?.hooks?.some((h) => typeof h.command === 'string' && h.command.includes(ZCODE_HOOK)),
    )
    if (!exists) {
      // ZCode's config.json schema requires a non-empty matcher on each group.
      list.push({ matcher: '.*', hooks: [{ type: 'command', command: hookCmd, timeout }] })
      cfg.hooks.events[event] = list
      changes.push(`added hooks.events.${event}`)
    } else {
      changes.push(`hooks.events.${event} already present (left untouched)`)
    }
  }

  writeJsonAtomic(CONFIG_PATH, cfg)
  log('Done. Changes:')
  for (const c of changes) log(`  - ${c}`)
  log('Restart ZCode (or run /reload-plugins) for hooks to take effect.')
}

try {
  main()
} catch (error) {
  process.stderr.write(`[stratagate-zcode] install failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
