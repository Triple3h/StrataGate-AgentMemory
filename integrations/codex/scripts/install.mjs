#!/usr/bin/env node
/**
 * Idempotent installer for the StrataGate Codex plugin.
 *
 * Registers the StrataGate MCP server and the UserPromptSubmit/Stop hooks in
 * ~/.codex/config.toml using ABSOLUTE paths that resolve to the shared WorkBuddy
 * engine in this repository (integrations/workbuddy/dist).
 *
 * Behavior:
 *  - Keeps an existing [mcp_servers.stratagate] entry if present, migrating its
 *    command/args to the verified shared engine; otherwise writes it.
 *  - Adds a [hooks] section with UserPromptSubmit + Stop only if they are not
 *    already present. Existing hooks for other tools are preserved.
 *  - Never rewrites unrelated config. Backs up config.toml before writing.
 *
 * The plugin's own .mcp.json / hooks.json (using ${PLUGIN_ROOT}) are the portable
 * declaration for marketplaces; this installer is what makes it work on the
 * local machine by resolving the repo paths explicitly.
 */

import { homedir } from 'node:os'
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyEngineArtifacts } from '../../workbuddy/scripts/engine-artifact.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const ENGINE_DIR = join(REPO_ROOT, 'integrations', 'workbuddy', 'dist')
const SERVER = join(ENGINE_DIR, 'server.cjs')
const HOOK = join(ENGINE_DIR, 'hook.cjs')
const WORKBUDDY_PACKAGE = join(REPO_ROOT, 'integrations', 'workbuddy', 'package.json')
const CORE_PACKAGE = join(REPO_ROOT, 'packages', 'core', 'package.json')
const CONFIG_PATH = process.env.CODEX_CONFIG_PATH ?? join(homedir(), '.codex', 'config.toml')
const DATA_DIR = process.env.STRATAGATE_DATA_DIR ?? join(homedir(), '.stratagate', 'agent-memory')
const USER_ID = process.env.STRATAGATE_USER_ID ?? process.env.USER ?? process.env.USERNAME ?? 'default'

function log(msg) {
  process.stdout.write(`[stratagate-codex] ${msg}\n`)
}

function ensureEngine() {
  if (!existsSync(WORKBUDDY_PACKAGE)) throw new Error(`Shared engine package metadata not found at ${WORKBUDDY_PACKAGE}`)
  const packageJson = JSON.parse(readFileSync(WORKBUDDY_PACKAGE, 'utf8'))
  const corePackage = JSON.parse(readFileSync(CORE_PACKAGE, 'utf8'))
  const manifest = verifyEngineArtifacts(ENGINE_DIR, {
    expectedVersion: packageJson.version,
    expectedCoreVersion: corePackage.version,
    files: ['server.cjs', 'hook.cjs', 'runtime.cjs', 'gateway-client.cjs', 'outbox.cjs'],
  })
  log(`verified shared engine ${manifest.version} (core ${manifest.coreVersion ?? 'unknown'})`)
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
      `STRATAGATE_NAMESPACE_PREFIX = "shared"`,
      `STRATAGATE_USER_ID = ${tomlString(USER_ID)}`,
      `STRATAGATE_AGENT_ID = "codex"`,
      '',
    ]
    if (insertAt === -1) {
      lines.push(...block)
    } else {
      lines.splice(insertAt, 0, ...block)
    }
    changes.push('added [mcp_servers.stratagate]')
  } else {
    const start = lines.findIndex((l) => l.trim() === mcpHeader)
    let end = lines.findIndex((l, i) => i > start && /^\s*\[(?!mcp_servers\.stratagate\.env\])/.test(l))
    if (end === -1) end = lines.length
    const section = lines.slice(start, end)
    let changed = false
    const commandLine = `command = ${tomlString(process.execPath)}`
    const argsLine = `args = [${tomlString(SERVER)}]`
    const commandIndex = section.findIndex((line) => /^\s*command\s*=/.test(line))
    if (commandIndex === -1) {
      section.push(commandLine)
      changed = true
    } else if (section[commandIndex].trim() !== commandLine) {
      section[commandIndex] = commandLine
      changed = true
    }
    const argsIndex = section.findIndex((line) => /^\s*args\s*=/.test(line))
    if (argsIndex === -1) {
      section.push(argsLine)
      changed = true
    } else if (section[argsIndex].trim() !== argsLine) {
      section[argsIndex] = argsLine
      changed = true
    }
    for (let i = section.length - 1; i >= 0; i -= 1) {
      if (section[i].trim().startsWith('STRATAGATE_PROJECT_DIR')
        || section[i].trim().startsWith('STRATAGATE_DISABLE_WORKBUDDY_MODEL')) {
        section.splice(i, 1)
        changed = true
      }
    }
    const envHeader = '[mcp_servers.stratagate.env]'
    if (!section.some((line) => line.trim() === envHeader)) {
      section.push(envHeader)
      changed = true
    }
    for (const line of [
      'STRATAGATE_NAMESPACE_PREFIX = "shared"',
      `STRATAGATE_USER_ID = ${tomlString(USER_ID)}`,
      'STRATAGATE_AGENT_ID = "codex"',
    ]) {
      const key = line.split('=')[0].trim()
      if (!section.some((item) => item.trim().startsWith(`${key} `) || item.trim().startsWith(`${key}=`))) {
        section.push(line)
        changed = true
      }
    }
    lines.splice(start, end - start, ...section)
    changes.push(changed ? '[mcp_servers.stratagate] updated for shared project namespace' : '[mcp_servers.stratagate] already configured')
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
      'SubagentStart = [',
      `  { hooks = [ { type = "command", command = ${tomlString(hookCmd)}, timeout = 10 } ] },`,
      ']',
      'SubagentStop = [',
      `  { hooks = [ { type = "command", command = ${tomlString(hookCmd)}, timeout = 30 } ] },`,
      ']',
      'PreCompact = [',
      `  { hooks = [ { type = "command", command = ${tomlString(hookCmd)}, timeout = 30 } ] },`,
      ']',
      'Interrupt = [',
      `  { hooks = [ { type = "command", command = ${tomlString(hookCmd)}, timeout = 30 } ] },`,
      ']',
      '',
    ]
    lines.push(...block)
    changes.push('added [hooks] with prompt, stop, subagent, compaction, and interrupt events')
  } else {
    const joined = lines.join('\n')
    if (joined.includes('stratagate') && joined.includes(HOOK)
      && ['UserPromptSubmit', 'Stop', 'SubagentStart', 'SubagentStop', 'PreCompact', 'Interrupt']
        .every((event) => joined.includes(`${event} =`))) {
      changes.push('[hooks] already contains stratagate hooks (left untouched)')
    } else {
      // Migrate existing StrataGate hook commands to the verified shared path.
      const idx = lines.findIndex((l) => l.trim() === '[hooks]')
      let migrated = false
      for (let i = idx + 1; i < lines.length; i += 1) {
        if (/^\s*\[/.test(lines[i]) && !/^\s*\[hooks\./.test(lines[i])) break
        if (/command\s*=/.test(lines[i]) && (lines[i].includes('workbuddy/dist/hook.cjs') || lines[i].includes('${PLUGIN_ROOT}'))) {
          lines[i] = lines[i].replace(/command\s*=\s*"[^"]*"/u, `command = ${tomlString(hookCmd)}`)
          migrated = true
        }
      }
      if (migrated) changes.push('[hooks] migrated existing StrataGate hook path to verified shared engine')
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
      for (const [event, timeout] of [['SubagentStart', 10], ['SubagentStop', 30], ['PreCompact', 30], ['Interrupt', 30]]) {
        const eventLine = lines.findIndex((l, i) => i > idx && l.trim().startsWith(`${event} =`))
        if (eventLine !== -1) continue
        lines.push(`${event} = [`)
        lines.push(`  { hooks = [ { type = "command", command = ${tomlString(hookCmd)}, timeout = ${timeout} } ] },`)
        lines.push(']')
        changes.push(`added ${event} to existing [hooks]`)
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
