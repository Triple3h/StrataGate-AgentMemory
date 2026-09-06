#!/usr/bin/env node
/**
 * Idempotent installer for the standalone StrataGate ZCode adapter.
 *
 * - verifies this package's own dist/manifest.json hashes (no workbuddy dependency);
 * - merges connection settings into ~/.stratagate/connection.json (shared with
 *   the Codex adapter; previous MCP env values — including model-provider
 *   settings — are carried over);
 * - points mcp.servers.stratagate at this package's dist/server.cjs;
 * - registers the four supported hook events (UserPromptSubmit, Stop,
 *   SessionStart, PostToolUse) and removes legacy zcode-hook.mjs entries,
 *   including the four events ZCode never supported (SubagentStart,
 *   SubagentStop, PreCompact, Interrupt).
 *
 * Unrelated config is never removed or rewritten.
 */
import { homedir } from 'node:os'
import { existsSync, readFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installZcode, readJson, verifyManifest, writeJsonAtomic } from './lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const configPath = process.env.ZCODE_CONFIG_PATH || join(homedir(), '.zcode', 'cli', 'config.json')
const connectionPath = process.env.STRATAGATE_CONNECTION_CONFIG || join(homedir(), '.stratagate', 'connection.json')

function log(message) {
  process.stdout.write(`[stratagate-zcode] ${message}\n`)
}

try {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const manifest = verifyManifest({ distDir, expectedVersion: packageJson.version })
  log(`verified artifacts ${manifest.name} ${manifest.version}`)

  if (!existsSync(configPath)) throw new Error(`ZCode config not found at ${configPath}`)
  const previousEnv = existsSync(configPath)
    ? readJson(configPath)?.mcp?.servers?.stratagate?.env ?? {}
    : {}

  const result = installZcode({ configPath, connectionPath, distDir, previousEnv })
  if (JSON.stringify(result.config) !== JSON.stringify(readJson(configPath))) {
    copyFileSync(configPath, `${configPath}.stratagate-backup-${Date.now()}`)
  }
  writeJsonAtomic(configPath, result.config)
  log('Done. Changes:')
  for (const change of result.changes) log(`  - ${change}`)
  log('Restart ZCode (or run /reload-plugins) for hooks to take effect.')
} catch (error) {
  process.stderr.write(`[stratagate-zcode] install failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
