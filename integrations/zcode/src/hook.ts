import { join } from 'node:path'
import { zcodeConfig, zcodeEnv } from './config.js'
import { capture, journal } from './capture.js'
import { atomicJson } from '../../../packages/adapter-sdk/src/delivery.js'
import { GatewayClient } from '../../../packages/adapter-sdk/src/gateway-client.js'
import type { BatchResult } from '../../../packages/adapter-sdk/src/contracts.js'

type Row = Record<string, unknown>

export interface ZcodeHookInput {
  hook_event_name?: string
  session_id?: string
  cwd?: string
  prompt?: string
  transcript_path?: string
  agent_transcript_path?: string
  rollout_path?: string
  agent_id?: string
  agent_type?: string
  reason?: string
  tool_name?: string
  [key: string]: unknown
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const RECAP_BASE = '[StrataGate] 会话上下文刚被压缩或清空。跨会话记忆仍然可用：需要项目历史时优先用 memory_search_events / memory_search_elements / memory_search_raw 检索，不要假设没有历史记录。'

/** Best-effort post-compaction recap: recent event titles when the Gateway answers, pointer text otherwise. */
async function recap(client: GatewayClient, config: ReturnType<typeof zcodeConfig>, sessionId: string): Promise<string> {
  try {
    const batch = await client.memory('events', {
      q: '',
      limit: '5',
      userId: config.userId,
      agentId: 'zcode',
      sourceAdapter: 'zcode',
      projectId: config.projectId,
      projectName: config.projectName,
      projectDir: config.projectDir,
      namespace: config.namespace,
      memoryScope: config.memoryScope,
      ...(sessionId ? { conversationId: sessionId } : {}),
    }) as BatchResult
    const titles = (batch?.results ?? [])
      .map((item) => (typeof item?.title === 'string' ? item.title.trim() : ''))
      .filter(Boolean)
      .slice(0, 5)
    if (titles.length === 0) return RECAP_BASE
    return `${RECAP_BASE}\n近期记忆摘要：\n${titles.map((title) => `- ${title}`).join('\n')}`
  } catch {
    return RECAP_BASE
  }
}

export async function handleHook(input: ZcodeHookInput, env: NodeJS.ProcessEnv = process.env): Promise<unknown> {
  const effective: NodeJS.ProcessEnv = { ...zcodeEnv(env), ...(input.session_id ? { STRATAGATE_SESSION_ID: input.session_id } : {}) }
  if (effective.STRATAGATE_DISABLE_HOST_ADAPTER === '1') return {}
  const event = input.hook_event_name ?? 'unknown'
  const sessionId = (input.session_id ?? '').trim()
  const config = zcodeConfig(input.cwd, effective)
  const client = GatewayClient.fromEnv(effective)
  void atomicJson(join(config.dataDir, 'adapters', 'zcode', 'hooks', `${event.replace(/[^a-zA-Z]/g, '') || 'unknown'}.json`), {
    event,
    sessionId,
    reason: input.reason,
    tool: input.tool_name,
    projectDir: config.projectDir,
    triggeredAt: new Date().toISOString(),
  }).catch(() => undefined)

  const gatewayDisabled = effective.STRATAGATE_DISABLE_GATEWAY === '1'

  if (event === 'UserPromptSubmit' && sessionId && input.prompt?.trim()) {
    if (gatewayDisabled) return {}
    void journal(effective).flush(client).catch(() => undefined)
    try {
      const recalled = await client.context({
        q: input.prompt.trim(),
        userId: config.userId,
        agentId: 'zcode',
        sourceAdapter: 'zcode',
        projectId: config.projectId,
        projectName: config.projectName,
        projectDir: config.projectDir,
        namespace: config.namespace,
        memoryScope: config.memoryScope,
        conversationId: sessionId,
      }) as { context?: unknown }
      if (typeof recalled?.context === 'string' && recalled.context) {
        return { hookSpecificOutput: { hookEventName: event, additionalContext: recalled.context } }
      }
    } catch (error) {
      process.stderr.write(`[stratagate-zcode] recall skipped: ${message(error)}\n`)
    }
    return {}
  }

  if (event === 'SessionStart') {
    const delivery = await journal(effective).flush(client).catch((error) => ({ sent: 0, pending: 0, status: 0, error: message(error) }))
    if (delivery.pending > 0) process.stderr.write(`[stratagate-zcode] ${delivery.pending} capture(s) pending delivery\n`)
    const reason = (input.reason ?? '').toLowerCase()
    if (!gatewayDisabled && (reason === 'compact' || reason === 'clear')) {
      const context = await recap(client, config, sessionId)
      if (context) return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }
    }
    return {}
  }

  if ((event === 'Stop' || event === 'PostToolUse') && sessionId && !gatewayDisabled) {
    try {
      const transcriptPath = input.agent_transcript_path || input.transcript_path || input.rollout_path
      const agent = input.agent_id || input.agent_type
      const result = await capture({
        sessionId,
        ...(input.cwd ? { cwd: input.cwd } : {}),
        ...(agent ? { agentId: agent } : {}),
        ...(transcriptPath ? { transcriptPath } : {}),
        ...(input.rollout_path ? { rolloutPath: input.rollout_path } : {}),
        ...(event === 'Stop' ? { stdin: input as Row } : {}),
        completeActive: event === 'Stop',
      }, { env: effective })
      if (result.delivery && result.delivery.pending > 0) {
        process.stderr.write(`[stratagate-zcode] delivery pending; Gateway status ${result.delivery.status ?? 'unreachable'}\n`)
      }
    } catch (error) {
      process.stderr.write(`[stratagate-zcode] capture failed: ${message(error)}\n`)
    }
  }
  return {}
}

function parseArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  try {
    const connectionConfig = parseArg('--connection-config')
    if (connectionConfig) process.env.STRATAGATE_CONNECTION_CONFIG = connectionConfig
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    const raw = Buffer.concat(chunks).toString('utf8')
    const input = (raw.trim() ? JSON.parse(raw) : {}) as ZcodeHookInput
    process.stdout.write(`${JSON.stringify(await handleHook(input))}\n`)
  } catch (error) {
    process.stderr.write(`[stratagate-zcode] hook failed open: ${message(error)}\n`)
    process.stdout.write('{}\n')
  }
}

if (process.argv[1]?.endsWith('hook.cjs')) void main()
