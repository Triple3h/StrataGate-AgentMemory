import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parse as parseToml } from 'smol-toml'
import { capture, journal, transcriptFiles } from './capture.js'
import { codexConfig, codexEnv } from './config.js'
import { GatewayClient } from '../../../packages/adapter-sdk/src/gateway-client.js'
import { connectionPath } from '../../../packages/adapter-sdk/src/connection.js'
import { atomicJson } from '../../../packages/adapter-sdk/src/delivery.js'
import { repairSources } from './repair.js'

const args = process.argv.slice(2)
const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
async function main() {
  const command = args[0] ?? 'doctor'
  const env = codexEnv()
  const config = codexConfig(undefined, env)
  const client = GatewayClient.fromEnv(env)
  if (command === 'doctor') {
    const configPath = env.CODEX_CONFIG_PATH || join(homedir(), '.codex', 'config.toml')
    let installed: Record<string, unknown> = {}
    try {
      const document = parseToml(await readFile(configPath, 'utf8')) as any
      const hooks = document.hooks ?? {}
      installed = { mcp: document.mcp_servers?.stratagate?.args?.some((p: string) => p.includes('codex/dist/server.cjs')) ?? false,
        hooks: Object.fromEntries(['UserPromptSubmit', 'Stop', 'SubagentStop', 'PreCompact', 'Interrupt'].map(event => [event, hooks[event]?.some((g: any) => g.hooks?.some((h: any) => h.command?.includes('codex/dist/hook.cjs'))) ?? false])) }
    } catch { installed = { error: 'Cannot read Codex installation' } }
    let gateway: unknown
    try { await client.status(); gateway = { authenticated: true } } catch (error) { gateway = { authenticated: false, status: (error as { status?: number }).status ?? 0 } }
    const deliveries = await journal(env).entries()
    const hooks: Record<string, unknown> = {}
    for (const event of ['UserPromptSubmit', 'Stop', 'SubagentStop', 'PreCompact', 'Interrupt']) {
      try { hooks[event] = JSON.parse(await readFile(join(config.dataDir, 'adapters/codex/hooks', event + '.json'), 'utf8')) } catch { hooks[event] = null }
    }
    const result = { adapter: 'codex', configPath, connectionConfig: connectionPath(env), tokenConfigured: Boolean(env.STRATAGATE_GATEWAY_TOKEN),
      identity: { userId: config.userId, sourceAdapter: config.sourceAdapter, projectDir: config.projectDir, namespace: config.namespace }, installed, gateway, hooks,
      delivery: { captured: deliveries.length, pending: deliveries.filter(e => !e.value.deliveredAt).length, lastDeliveredAt: deliveries.map(e => e.value.deliveredAt ?? '').sort().at(-1) || null } }
    console.log(JSON.stringify(result, null, 2)); return
  }
  if (command === 'replay') { console.log(JSON.stringify(await journal(env).flush(client, 10_000))); return }
  if (command === 'backfill' || command === 'repair-sources') {
    const project = option('--project')
    const path = option('--transcript')
    if (!project && !path) throw new Error('Specify --project <directory> or --transcript <file>')
    const files = path ? [resolve(path)] : await transcriptFiles(join(homedir(), '.codex', 'sessions'))
    const selected: string[] = []
    const reports: unknown[] = []
    for (const file of files) {
      const preview = await capture(file, { dryRun: true, env })
      if (project && resolve(preview.projectDir) !== resolve(project)) continue
      selected.push(file)
      if (command === 'backfill') {
        const result = args.includes('--apply') ? await capture(file, { env }) : preview
        const { requests, ...summary } = result as typeof preview
        reports.push({ file, ...summary })
      }
    }
    if (command === 'repair-sources') reports.push(await repairSources(selected, client, env, args.includes('--apply')))
    const report = { command, applied: args.includes('--apply'), transcripts: selected.length, results: reports }
    if (option('--report')) {
      const path = resolve(option('--report')!)
      await atomicJson(path, report)
      console.log(JSON.stringify({ command, applied: report.applied, transcripts: selected.length, report: path }))
    } else console.log(JSON.stringify(report, null, 2))
    return
  }
  throw new Error('Usage: cli.cjs doctor | replay | backfill | repair-sources [--project DIR | --transcript FILE] [--apply] [--report FILE]')
}
void main().catch(error => { console.error(`[stratagate-codex] ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1 })
