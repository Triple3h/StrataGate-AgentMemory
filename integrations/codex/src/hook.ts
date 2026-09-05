import { join } from 'node:path'
import { codexConfig, codexEnv } from './config.js'
import { capture, journal } from './capture.js'
import { atomicJson } from '../../../packages/adapter-sdk/src/delivery.js'
import { GatewayClient } from '../../../packages/adapter-sdk/src/gateway-client.js'

export interface CodexHookInput {
  hook_event_name?: string
  session_id?: string
  transcript_path?: string
  agent_transcript_path?: string
  agent_id?: string
  cwd?: string
  prompt?: string
}
export async function handleHook(input: CodexHookInput, env = process.env): Promise<unknown> {
  const effective: NodeJS.ProcessEnv = { ...codexEnv(env), ...(input.session_id ? { STRATAGATE_SESSION_ID: input.session_id } : {}) }
  const config = codexConfig(input.cwd, effective)
  const output = { continue: true, suppressOutput: true }
  if (effective.STRATAGATE_DISABLE_HOST_ADAPTER === '1') return output
  const event = input.hook_event_name ?? 'unknown'
  await atomicJson(join(config.dataDir, 'adapters', 'codex', 'hooks', `${event.replace(/[^a-zA-Z]/g, '') || 'unknown'}.json`), {
    event, sessionId: input.session_id, transcriptPath: input.agent_transcript_path ?? input.transcript_path,
    projectDir: config.projectDir, triggeredAt: new Date().toISOString(),
  })
  const client = GatewayClient.fromEnv(effective)
  if (event === 'UserPromptSubmit' && input.prompt && input.session_id) {
    await journal(effective).flush(client)
    const recalled = await client.context({ q: input.prompt, userId: config.userId, agentId: 'codex', sourceAdapter: 'codex',
      projectDir: config.projectDir, projectId: config.projectId, namespace: config.namespace, memoryScope: config.memoryScope, conversationId: input.session_id })
    return typeof recalled.context === 'string' && recalled.context ? { ...output, hookSpecificOutput: { hookEventName: event, additionalContext: recalled.context } } : output
  }
  const path = input.agent_transcript_path ?? input.transcript_path
  if (path && ['Stop', 'SubagentStop', 'PreCompact', 'Interrupt'].includes(event)) {
    const result = await capture(path, { completeActive: event === 'Stop' || event === 'SubagentStop', ...(input.agent_id ? { agentId: input.agent_id } : {}), env: effective })
    if ('delivery' in result && result.delivery?.status !== undefined) process.stderr.write(`[stratagate-codex] delivery pending; Gateway status ${result.delivery.status}\n`)
  }
  return output
}
async function main() {
  try {
    const configIndex = process.argv.indexOf('--connection-config')
    if (configIndex >= 0 && process.argv[configIndex + 1]) process.env.STRATAGATE_CONNECTION_CONFIG = process.argv[configIndex + 1]!
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
    process.stdout.write(JSON.stringify(await handleHook(JSON.parse(Buffer.concat(chunks).toString('utf8')))) + '\n')
  } catch (error) {
    process.stderr.write(`[stratagate-codex] hook failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.stdout.write('{"continue":true,"suppressOutput":true}\n')
  }
}
if (process.argv[1]?.endsWith('hook.cjs')) void main()
