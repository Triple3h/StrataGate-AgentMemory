import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { StrataGateSnapshot } from '@diqier/stratagate'
import { redactSensitiveText } from '@diqier/stratagate'
import { journal } from './capture.js'
import { zcodeConfig, zcodeEnv } from './config.js'
import { readUnseenRolloutTurns } from './transcript.js'
import { GatewayClient } from '../../../packages/adapter-sdk/src/gateway-client.js'
import { connectionPath } from '../../../packages/adapter-sdk/src/connection.js'
import { atomicJson } from '../../../packages/adapter-sdk/src/delivery.js'

type Row = Record<string, unknown>

const VALID_EVENTS = ['UserPromptSubmit', 'Stop', 'SessionStart', 'PostToolUse']
const LEGACY_EVENTS = ['SubagentStart', 'SubagentStop', 'PreCompact', 'Interrupt']

async function readJson(path: string): Promise<Row | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Row
  } catch {
    return null
  }
}

async function installedReport(configPath: string): Promise<Record<string, unknown>> {
  const document = await readJson(configPath)
  if (!document) return { error: 'Cannot read ZCode installation' }
  const server = ((document.mcp as Row | undefined)?.servers as Row | undefined)?.stratagate as Row | undefined
  const events = ((document.hooks as Row | undefined)?.events ?? {}) as Row
  const hookEntry = (event: string): boolean => ((events[event] ?? []) as Array<Row>).some((group) => ((group?.hooks ?? []) as Array<Row>)
    .some((hook) => typeof hook?.command === 'string' && (hook.command.includes('zcode/dist/hook.cjs') || hook.command.includes('zcode-hook.mjs'))))
  return {
    mcp: Array.isArray(server?.args) && (server!.args as string[]).some((p) => p.includes('zcode/dist/server.cjs')),
    hooks: Object.fromEntries([...VALID_EVENTS, ...LEGACY_EVENTS].map((event) => [event, hookEntry(event)])),
  }
}

export async function repairZcodeSources(options: {
  namespace: string
  rolloutDir: string
  client: GatewayClient
  env: NodeJS.ProcessEnv
  apply?: boolean
}): Promise<unknown> {
  const sessions = new Map<string, string[]>()
  for (const entry of await readdir(options.rolloutDir)) {
    const match = /^model-io-(.+)\.jsonl$/.exec(entry)
    if (!match) continue
    const read = readUnseenRolloutTurns(join(options.rolloutDir, entry), null, { completeActive: true })
    const texts: string[] = []
    for (const turn of read.turns) {
      if (turn.user) texts.push(turn.user)
      if (turn.assistant) texts.push(turn.assistant)
    }
    if (texts.length > 0) sessions.set(match[1]!, texts)
  }
  const snapshot = await options.client.snapshot(options.namespace) as StrataGateSnapshot
  const messages = [...snapshot.openTail, ...snapshot.blocks.flatMap((block) => block.l5Raw)]
  const updates: Array<{ id: string; contentHash: string }> = []
  for (const message of messages) {
    if (message.agentId !== 'workbuddy' || !['workbuddy', 'gateway'].includes(message.sourceAdapter ?? '')) continue
    const conversation = (message.conversationId ?? message.threadId ?? '').split(':agent:')[0]!
    const texts = sessions.get(conversation)
    if (!texts) continue
    const content = message.content.trim()
    if (!content) continue
    if (!texts.some((expected) => redactSensitiveText(expected).includes(content))) continue
    updates.push({ id: message.id, contentHash: createHash('sha256').update(message.content).digest('hex') })
  }
  return options.client.repairAdapter({ namespace: options.namespace, updates, apply: options.apply === true, targetAgent: 'zcode' })
}

const args = process.argv.slice(2)
const option = (name: string): string | undefined => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

async function main(): Promise<void> {
  const command = args[0] ?? 'doctor'
  const env = zcodeEnv()
  const config = zcodeConfig(undefined, env)
  const client = GatewayClient.fromEnv(env)
  if (command === 'doctor') {
    const configPath = env.ZCODE_CONFIG_PATH || join(homedir(), '.zcode', 'cli', 'config.json')
    const installed = await installedReport(configPath)
    let gateway: unknown
    try { await client.status(); gateway = { authenticated: true } } catch (error) { gateway = { authenticated: false, status: (error as { status?: number }).status ?? 0 } }
    const deliveries = await journal(env).entries()
    const hooks: Record<string, unknown> = {}
    for (const event of VALID_EVENTS) {
      hooks[event] = await readJson(join(config.dataDir, 'adapters/zcode/hooks', `${event}.json`))
    }
    const result = {
      adapter: 'zcode',
      configPath,
      connectionConfig: connectionPath(env),
      tokenConfigured: Boolean(env.STRATAGATE_GATEWAY_TOKEN),
      identity: { userId: config.userId, sourceAdapter: config.sourceAdapter, agentId: config.agentId, projectDir: config.projectDir, namespace: config.namespace },
      installed,
      gateway,
      hooks,
      delivery: {
        captured: deliveries.length,
        pending: deliveries.filter((entry) => !entry.value.deliveredAt).length,
        lastDeliveredAt: deliveries.map((entry) => entry.value.deliveredAt ?? '').sort().at(-1) || null,
      },
    }
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (command === 'replay') {
    console.log(JSON.stringify(await journal(env).flush(client, 10_000)))
    return
  }
  if (command === 'repair-sources') {
    const project = option('--project')
    const namespaceOverride = option('--namespace')
    if (!project && !namespaceOverride) throw new Error('Specify --project <directory> or --namespace <shared:user:...>')
    const rolloutDir = option('--rollout-dir') ?? join(homedir(), '.zcode', 'cli', 'rollout')
    const result = await repairZcodeSources({
      namespace: namespaceOverride ?? zcodeConfig(project!, env).namespace,
      rolloutDir,
      client,
      env,
      apply: args.includes('--apply'),
    })
    const report = { command, applied: args.includes('--apply'), result }
    if (option('--report')) {
      const path = resolve(option('--report')!)
      await atomicJson(path, report)
      console.log(JSON.stringify({ command, applied: report.applied, report: path }))
    } else console.log(JSON.stringify(report, null, 2))
    return
  }
  throw new Error('Usage: cli.cjs doctor | replay | repair-sources [--project DIR | --namespace NS] [--apply] [--report FILE]')
}

void main().catch((error) => {
  console.error(`[stratagate-zcode] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
