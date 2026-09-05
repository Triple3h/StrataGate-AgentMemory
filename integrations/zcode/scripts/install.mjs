#!/usr/bin/env node
/**
 * Idempotent installer for the StrataGate ZCode plugin.
 *
 * Registers (or preserves) the StrataGate MCP server and the UserPromptSubmit/Stop
 * hooks in ~/.zcode/cli/config.json using ABSOLUTE paths that resolve to the shared
 * WorkBuddy engine in this repository (integrations/workbuddy/dist).
 *
 * It never removes or rewrites unrelated config; it only ensures the stratagate
 * entries exist and point at this repo's verified shared engine. Existing stale
 * StrataGate paths are migrated in place.
 */

import { homedir } from 'node:os'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyEngineArtifacts } from '../../workbuddy/scripts/engine-artifact.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const ENGINE_DIR = join(REPO_ROOT, 'integrations', 'workbuddy', 'dist')
const SERVER = join(ENGINE_DIR, 'server.cjs')
const WORKBUDDY_PACKAGE = join(REPO_ROOT, 'integrations', 'workbuddy', 'package.json')
const CORE_PACKAGE = join(REPO_ROOT, 'packages', 'core', 'package.json')
const ZCODE_HOOK = join(REPO_ROOT, 'integrations', 'zcode', 'scripts', 'zcode-hook.mjs')
const CONFIG_PATH = process.env.ZCODE_CONFIG_PATH ?? join(homedir(), '.zcode', 'cli', 'config.json')
const DATA_DIR = process.env.STRATAGATE_DATA_DIR ?? join(homedir(), '.stratagate', 'agent-memory')
const USER_ID = process.env.STRATAGATE_USER_ID ?? process.env.USER ?? process.env.USERNAME ?? 'default'

function log(msg) {
  process.stdout.write(`[stratagate-zcode] ${msg}\n`)
}

function ensureEngine() {
  if (!existsSync(ZCODE_HOOK) || !existsSync(WORKBUDDY_PACKAGE)) {
    throw new Error(`Engine files not found (server at ${SERVER}, hook at ${ZCODE_HOOK}). Run "npm run build:workbuddy" in the repo root first.`)
  }
  const packageJson = JSON.parse(readFileSync(WORKBUDDY_PACKAGE, 'utf8'))
  const corePackage = JSON.parse(readFileSync(CORE_PACKAGE, 'utf8'))
  const manifest = verifyEngineArtifacts(ENGINE_DIR, {
    expectedVersion: packageJson.version,
    expectedCoreVersion: corePackage.version,
    files: ['server.cjs', 'hook.cjs', 'runtime.cjs', 'gateway-client.cjs', 'outbox.cjs'],
  })
  log(`verified shared engine ${manifest.version} (core ${manifest.coreVersion ?? 'unknown'})`)
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
        STRATAGATE_NAMESPACE_PREFIX: 'shared',
        STRATAGATE_USER_ID: USER_ID,
        STRATAGATE_AGENT_ID: 'zcode',
      },
      timeoutMs: 120000,
    }
    changes.push('added mcp.servers.stratagate')
  } else {
    if (mcp.command !== process.execPath || !Array.isArray(mcp.args) || mcp.args[0] !== SERVER) {
      mcp.command = process.execPath
      mcp.args = [SERVER]
      changes.push('mcp.servers.stratagate migrated to the verified shared engine path')
    }
    mcp.env ??= {}
    if (Object.hasOwn(mcp.env, 'STRATAGATE_PROJECT_DIR')) {
      delete mcp.env.STRATAGATE_PROJECT_DIR
      changes.push('removed hard-coded STRATAGATE_PROJECT_DIR from mcp.servers.stratagate')
    }
    delete mcp.env.STRATAGATE_DISABLE_WORKBUDDY_MODEL
    mcp.env.STRATAGATE_NAMESPACE_PREFIX ??= 'shared'
    mcp.env.STRATAGATE_USER_ID ??= USER_ID
    mcp.env.STRATAGATE_AGENT_ID ??= 'zcode'
    changes.push('mcp.servers.stratagate updated for shared project namespace')
  }

  cfg.hooks ??= {}
  cfg.hooks.enabled ??= true
  cfg.hooks.events ??= {}
  const hookCmd = `${JSON.stringify(process.execPath)} "${ZCODE_HOOK}"`

  for (const [event, timeout] of [
    ['UserPromptSubmit', 20], ['Stop', 30], ['SubagentStart', 10],
    ['SubagentStop', 30], ['PreCompact', 30], ['Interrupt', 30],
  ]) {
    const list = cfg.hooks.events[event] ?? []
    const exists = list.some(
      (group) => group?.hooks?.some((h) => typeof h.command === 'string' && h.command.includes('zcode-hook.mjs')),
    )
    if (!exists) {
      // ZCode's config.json schema requires a non-empty matcher on each group.
      list.push({ matcher: '.*', hooks: [{ type: 'command', command: hookCmd, timeout }] })
      cfg.hooks.events[event] = list
      changes.push(`added hooks.events.${event}`)
    } else {
      let migrated = false
      for (const group of list) {
        for (const hook of group?.hooks ?? []) {
          if (typeof hook.command === 'string' && hook.command.includes('zcode-hook.mjs')) {
            const expected = `${JSON.stringify(process.execPath)} "${ZCODE_HOOK}"`
            if (hook.command !== expected) {
              hook.command = expected
              migrated = true
            }
          }
        }
      }
      changes.push(migrated
        ? `hooks.events.${event} migrated to the verified shared engine path`
        : `hooks.events.${event} already present (left untouched)`)
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
