#!/usr/bin/env node
/**
 * Idempotent installer for the StrataGate Codex plugin.
 *
 * Registers the StrataGate MCP server and the UserPromptSubmit/Stop hooks in
 * ~/.codex/config.toml using ABSOLUTE paths that resolve to the shared WorkBuddy
 * engine in this repository (integrations/workbuddy/dist).
 *
 * Behavior:
 *  - Keeps an existing [mcp_servers.stratagate] entry if present (points at the
 *    shared engine and already works); otherwise writes it.
 *  - Adds a [hooks] section with UserPromptSubmit + Stop only if they are not
 *    already present. Existing hooks for other tools are preserved.
 *  - Never rewrites unrelated config. Backs up config.toml before writing.
 *
 * The plugin's own .mcp.json / hooks.json (using ${PLUGIN_ROOT}) are the portable
 * declaration for marketplaces; this installer is what makes it work on the
 * local machine by resolving the repo paths explicitly.
 */

import { homedir } from 'node:os'
import { existsSync, readFileSync, writeFileSync, renameSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const ENGINE_DIR = join(REPO_ROOT, 'integrations', 'workbuddy', 'dist')
const SERVER = join(ENGINE_DIR, 'server.cjs')
const HOOK = join(ENGINE_DIR, 'hook.cjs')
const CONFIG_PATH = process.env.CODEX_CONFIG_PATH ?? join(homedir(), '.codex', 'config.toml')
const DATA_DIR = process.env.STRATAGATE_DATA_DIR ?? join(homedir(), '.stratagate', 'agent-memory')

function log(msg) {
  process.stdout.write(`[stratagate-codex] ${msg}\n`)
}

function ensureEngine() {
  if (!existsSync(SERVER) || !existsSync(HOOK)) {
    throw new Error(
      `Shared engine not found at ${ENGINE_DIR}. Run "npm run build:workbuddy" in the repo root first.`,
    )
  }
}

function tomlString(value) {
  return JSON.stringify(String(value))
}

function main() {
  ensureEngine()
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Codex config not found at ${CONFIG_PATH}`)
  }

  const original = readFileSync(CONFIG_PATH, 'utf8')
  const lines = original.split('\n')
  const changes = []

  const mcpHeader = '[mcp_servers.stratagate]'
  const hasMcp = lines.some((l) => l.trim() === mcpHeader)
  if (!hasMcp) {
    const insertAt = lines.findIndex((l) => l.trim().startsWith('[mcp_servers.'))
    const block = [
      mcpHeader,
      `type = "stdio"`,
      `command = ${tomlString(process.execPath)}`,
      `args = [${tomlString(SERVER)}]`,
      `startup_timeout_sec = 20`,
      `tool_timeout_sec = 120`,
      '',
      `[mcp_servers.stratagate.env]`,
      `STRATAGATE_DATA_DIR = ${tomlString(DATA_DIR)}`,
      `STRATAGATE_DATABASE = ${tomlString(join(DATA_DIR, 'memory.db'))}`,
      `STRATAGATE_PROJECT_DIR = ${tomlString(REPO_ROOT)}`,
      `STRATAGATE_DISABLE_WORKBUDDY_MODEL = "1"`,
      '',
    ]
    if (insertAt === -1) {
      lines.push(...block)
    } else {
      lines.splice(insertAt, 0, ...block)
    }
    changes.push('added [mcp_servers.stratagate]')
  } else {
    changes.push('[mcp_servers.stratagate] already present (left untouched)')
  }

  const hasHooksSection = lines.some((l) => l.trim() === '[hooks]')
  const hookCmd = `${process.execPath} ${HOOK}`
  if (!hasHooksSection) {
    const block = [
      '[hooks]',
      'UserPromptSubmit = [',
      `  { hooks = [ { type = "command", command = ${tomlString(hookCmd)}, timeout = 20 } ] },`,
      ']',
      'Stop = [',
      `  { hooks = [ { type = "command", command = ${tomlString(hookCmd)}, timeout = 30 } ] },`,
      ']',
      '',
    ]
    lines.push(...block)
    changes.push('added [hooks] with UserPromptSubmit + Stop')
  } else {
    const joined = lines.join('\n')
    if (joined.includes('stratagate') && joined.includes('hook.cjs')) {
      changes.push('[hooks] already contains stratagate hooks (left untouched)')
    } else {
      // Append stratagate hook lines into the existing [hooks] section.
      const idx = lines.findIndex((l) => l.trim() === '[hooks]')
      const userPromptLine = lines.findIndex(
        (l, i) => i > idx && l.trim().startsWith('UserPromptSubmit'),
      )
      if (userPromptLine === -1) {
        lines.splice(idx + 1, 0, 'UserPromptSubmit = [')
        lines.splice(idx + 2, 0, `  { hooks = [ { type = "command", command = ${tomlString(hookCmd)}, timeout = 20 } ] },`)
        lines.splice(idx + 3, 0, ']')
        changes.push('added UserPromptSubmit to existing [hooks]')
      }
      const stopLine = lines.findIndex((l, i) => i > idx && l.trim().startsWith('Stop'))
      if (stopLine === -1) {
        lines.push('Stop = [')
        lines.push(`  { hooks = [ { type = "command", command = ${tomlString(hookCmd)}, timeout = 30 } ] },`)
        lines.push(']')
        changes.push('added Stop to existing [hooks]')
      }
    }
  }

  const result = lines.join('\n')
  if (result === original) {
    log('No changes needed — config already configured.')
    return
  }

  copyFileSync(CONFIG_PATH, `${CONFIG_PATH}.stratagate-backup`)
  writeFileSync(CONFIG_PATH, result)
  log(`Backup saved to ${CONFIG_PATH}.stratagate-backup`)
  log('Done. Changes:')
  for (const c of changes) log(`  - ${c}`)
  log('Trust the hooks when Codex prompts, then restart Codex.')
}

try {
  main()
} catch (error) {
  process.stderr.write(`[stratagate-codex] install failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
