import { open, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { nowUtc8 } from '@diqier/stratagate'
import { resolveConfig } from './config.js'
import { WorkBuddyRuntime } from './runtime.js'
import { GatewayClient } from './gateway-client.js'
import { foldLatestTurn, parseJsonLines } from './transcript.js'

interface HookInput {
  session_id?: string
  transcript_path?: string
  agent_transcript_path?: string
  cwd?: string
  conversation_id?: string
  user_id?: string
  project_id?: string
  source_adapter?: string
  hook_event_name?: string
  agent_type?: string
  agent_id?: string
  prompt?: string
  stop_hook_active?: boolean
  last_assistant_message?: string
}

interface Delta {
  entries: Record<string, unknown>[]
  startOffset: number
  endOffset: number
}

const MAX_DELTA_BYTES = 4 * 1024 * 1024

function transcriptPath(input: HookInput): string | undefined {
  return input.agent_transcript_path?.trim() || input.transcript_path?.trim()
}

function pathKey(path: string): string {
  return createHash('sha256').update(path).digest('hex').slice(0, 16)
}

function stateKey(input: HookInput): string {
  const agent = input.agent_id?.trim() || input.agent_type?.trim() || 'primary'
  const path = transcriptPath(input) || 'no-transcript'
  return `${agent}:${pathKey(path)}`
}

function hostProvenance(input: HookInput, config: ReturnType<typeof resolveConfig>, sessionId: string) {
  const agentId = input.agent_id?.trim() || input.agent_type?.trim() || config.agentId
  const conversationId = input.conversation_id?.trim() || sessionId
  return {
    userId: input.user_id?.trim() || config.userId,
    agentId,
    conversationId,
    ...(input.project_id?.trim() ? { projectId: input.project_id.trim() } : {}),
    ...(input.source_adapter?.trim() ? { sourceAdapter: input.source_adapter.trim() } : {}),
  }
}

function turnReceipt(
  sessionId: string,
  agentId: string,
  path: string,
  turn: { user: string; assistant: string; createdAt?: string; assistantToolCalls?: unknown[] },
): string {
  const fingerprint = JSON.stringify({
    sessionId,
    agentId,
    path,
    user: turn.user,
    assistant: turn.assistant,
    createdAt: turn.createdAt ?? null,
    assistantToolCalls: turn.assistantToolCalls ?? [],
  })
  return `codex:${createHash('sha256').update(fingerprint).digest('hex')}`
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

async function transcriptDelta(path: string, requestedOffset: number): Promise<Delta> {
  const info = await stat(path)
  let startOffset = requestedOffset >= 0 && requestedOffset <= info.size ? requestedOffset : 0
  if (info.size - startOffset > MAX_DELTA_BYTES) startOffset = Math.max(0, info.size - MAX_DELTA_BYTES)
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(Math.max(0, info.size - startOffset))
    if (buffer.length > 0) await handle.read(buffer, 0, buffer.length, startOffset)
    let payload = buffer
    if (startOffset > requestedOffset) {
      const newline = buffer.indexOf(0x0a)
      if (newline >= 0) {
        startOffset += newline + 1
        payload = buffer.subarray(newline + 1)
      }
    }
    const parsed = parseJsonLines(payload)
    return { entries: parsed.entries, startOffset, endOffset: startOffset + parsed.consumedBytes }
  } finally {
    await handle.close()
  }
}

function success(additionalContext?: string): unknown {
  return additionalContext ? {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  } : { continue: true, suppressOutput: true }
}

async function userPrompt(input: HookInput): Promise<unknown> {
  const sessionId = input.session_id?.trim()
  const prompt = input.prompt?.trim()
  if (!sessionId || !prompt) return success()
  const identityKey = stateKey(input)
  const config = resolveConfig(process.env, input.cwd)
  const runtime = new WorkBuddyRuntime(config)
  await runtime.state.writePending(sessionId, {
    prompt,
    transcriptPath: transcriptPath(input) ?? '',
    projectDir: config.projectDir,
    receivedAt: nowUtc8(),
  }, identityKey)
  let recalled: { context?: string }
  if (process.env.STRATAGATE_DISABLE_GATEWAY !== '1') {
    try {
      const gateway = GatewayClient.fromEnv()
      recalled = await gateway.context({
        q: prompt,
        userId: input.user_id?.trim() || config.userId,
        agentId: input.agent_id?.trim() || input.agent_type?.trim() || config.agentId,
        sourceAdapter: input.source_adapter?.trim() || 'workbuddy',
        ...(input.project_id?.trim() || config.projectId ? { projectId: input.project_id?.trim() || config.projectId } : {}),
        projectDir: config.projectDir,
        namespace: config.namespace,
        conversationId: input.conversation_id?.trim() || sessionId,
      }) as { context?: string }
    } catch (error) {
      if (!GatewayClient.fromEnv().options.fallback) throw error
      recalled = await runtime.initialContext(sessionId, prompt)
    }
  } else recalled = await runtime.initialContext(sessionId, prompt)
  return success(recalled.context || undefined)
}

async function stop(input: HookInput): Promise<unknown> {
  const sessionId = input.session_id?.trim()
  const path = transcriptPath(input)
  if (!sessionId || !path) return success()
  const identityKey = stateKey(input)
  const config = resolveConfig(process.env, input.cwd)
  const runtime = new WorkBuddyRuntime(config)
  const cursor = await runtime.state.readCursor(sessionId, identityKey)
  const requestedOffset = cursor?.transcriptPath === path ? cursor.offset : 0
  const delta = await transcriptDelta(path, requestedOffset)
  if (delta.endOffset <= requestedOffset) return success()
  const pending = await runtime.state.readPending(sessionId, identityKey)
  const turn = foldLatestTurn(delta.entries, pending?.prompt, input.last_assistant_message)
  if (!turn) return success()

  const agentId = input.agent_id?.trim() || input.agent_type?.trim() || config.agentId
  const receiptId = turnReceipt(sessionId, agentId, path, turn)
  const provenance = hostProvenance(input, config, sessionId)
  if (process.env.STRATAGATE_DISABLE_GATEWAY !== '1') {
    const gateway = GatewayClient.fromEnv()
    try {
      const request = {
        ...turn,
        threadId: `${sessionId}:agent:${identityKey}`,
        ...provenance,
        ...(input.project_id?.trim() || config.projectId ? { projectId: input.project_id?.trim() || config.projectId } : {}),
        projectDir: config.projectDir,
        namespace: config.namespace,
        memoryScope: config.memoryScope,
        receiptId,
      }
      if (gateway.options.fallback) await gateway.ingest(request)
      else await gateway.ingestWithOutbox(request)
    } catch (error) {
      if (!gateway.options.fallback) throw error
      await runtime.appendTurn({ ...turn, threadId: `${sessionId}:agent:${identityKey}`, ...provenance, receiptId })
    }
  } else await runtime.appendTurn({ ...turn, threadId: `${sessionId}:agent:${identityKey}`, ...provenance, receiptId })
  await runtime.state.writeCursor(sessionId, {
    transcriptPath: path,
    offset: delta.endOffset,
    updatedAt: nowUtc8(),
  }, identityKey)
  return success()
}

async function main(): Promise<void> {
  let output: unknown = success()
  try {
    if (process.env.STRATAGATE_DISABLE_HOST_ADAPTER === '1') {
      process.stdout.write(`${JSON.stringify(output)}\n`)
      return
    }
    const input = JSON.parse(await readStdin()) as HookInput
    if (input.hook_event_name === 'UserPromptSubmit') output = await userPrompt(input)
    if (input.hook_event_name === 'Stop' || input.hook_event_name === 'SubagentStop'
      || input.hook_event_name === 'PreCompact' || input.hook_event_name === 'Interrupt') output = await stop(input)
  } catch (error) {
    process.stderr.write(`[stratagate-workbuddy] hook failed open: ${error instanceof Error ? error.message : String(error)}\n`)
  }
  process.stdout.write(`${JSON.stringify(output)}\n`)
}

void main()
