#!/usr/bin/env node
/**
 * Release gate for the claims in OPTIMIZATION_PLAN.zh-CN.md. Automated checks
 * run in CI; the two explicit evidence files are supplied by the deployment
 * operator after GPT Desktop E2E and backup/restore rehearsal.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const checks = [
  ['check', ['run', 'check']],
  ['test', ['test']],
  ['build', ['run', 'build']],
  ['workbuddy package', ['run', 'verify:workbuddy']],
  ['host protocol', ['run', 'verify:host']],
  ['frozen benchmark', ['run', 'evaluate']],
]
for (const [name, args] of checks) {
  const result = spawnSync('npm', args, { cwd: root, stdio: 'inherit', env: process.env })
  if (result.status !== 0) throw new Error(`Production gate failed: ${name}`)
}
const requiredEvidence = [
  process.env.STRATAGATE_GPT_DESKTOP_E2E_EVIDENCE,
  process.env.STRATAGATE_DR_EVIDENCE,
].filter(Boolean).map((path) => resolve(path))
if (requiredEvidence.length !== 2 || requiredEvidence.some((path) => !existsSync(path))) {
  process.stderr.write('Production gate is not eligible: provide STRATAGATE_GPT_DESKTOP_E2E_EVIDENCE and STRATAGATE_DR_EVIDENCE after the real desktop and recovery rehearsals.\n')
  process.exitCode = 2
  process.exit()
}
process.stdout.write('Production gate passed: automated checks and operator evidence are present.\n')
