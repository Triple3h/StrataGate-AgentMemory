/**
 * ZCode transcript parser for StrataGate.
 *
 * ZCode's hook protocol differs from Codex/WorkBuddy:
 *  - Stop stdin gives `session_id`, `cwd`, and a `transcript_path` that points
 *    to a TEMP file holding only the LAST assistant message (not the full
 *    conversation). `responseText` / `responsePreview` also carry that text.
 *  - The authoritative, complete conversation lives in
 *    `~/.zcode/cli/rollout/model-io-<sessionId>.jsonl`. Each line is:
 *        { sessionId, turnId, type: "model_io",
 *          request: { body: { input: [{ role, content }] } },
 *          response: { text, toolCalls: [{ id, name, input }], finishReason } }
 *
 * We use the rollout file as the incremental transcript (keyed by turnId) and
 * fall back to stdin fields only when no rollout can be read.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const INJECTED_BLOCK_RE = /<stratagate_memory\b[^>]*>[\s\S]*?<\/stratagate_memory>/gi
const SYSTEM_REMINDER_RE = /<system-reminder>[\s\S]*?<\/system-reminder>/gi

export interface ZcodeTurn {
  user: string
  assistant: string
  assistantToolCalls?: Array<{ name: string; arguments?: unknown; result?: string }>
  turnId?: string
  createdAt?: string
}

export interface RolloutReadResult {
  available: boolean
  turns: ZcodeTurn[]
  lastTurnId: string | null
}

type Row = Record<string, unknown>

export function cleanZcodeText(value: unknown): string {
  return String(value ?? '')
    .replace(INJECTED_BLOCK_RE, '')
    .replace(SYSTEM_REMINDER_RE, '')
    .trim()
}

function asString(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((block): block is Row => Boolean(block) && typeof block === 'object')
      .map((block) => {
        // OpenAI Responses API text blocks use type: "input_text" / "output_text";
        // Anthropic-style use "text". Accept all of them.
        if ((block.type === 'text' || block.type === 'input_text' || block.type === 'output_text')
            && typeof block.text === 'string') {
          return block.text
        }
        return ''
      })
      .join('\n')
  }
  return ''
}

function extractUserFromMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return ''
  const list = messages as Array<Row>
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i]
    if (message?.role !== 'user') continue
    const cleaned = cleanZcodeText(asString(message.content))
    if (cleaned) return cleaned
  }
  return ''
}

function toolTraces(calls: unknown, toolResults: Map<string, string>): NonNullable<ZcodeTurn['assistantToolCalls']> {
  if (!Array.isArray(calls)) return []
  const traces: NonNullable<ZcodeTurn['assistantToolCalls']> = []
  for (const call of calls as Array<Row>) {
    if (!call || typeof call.name !== 'string') continue
    const trace: NonNullable<ZcodeTurn['assistantToolCalls']>[number] = { name: call.name }
    if (call.input && typeof call.input === 'object') trace.arguments = call.input
    const id = typeof call.id === 'string' && call.id ? call.id : null
    if (id) {
      const result = toolResults.get(id)
      if (result) trace.result = result
    }
    traces.push(trace)
  }
  return traces
}

/**
 * Parse one rollout line into a turn candidate (without receiptId/threadId).
 * Returns null when the line carries no usable user text.
 */
export function turnFromRolloutLine(line: string, toolResults: Map<string, string> | null = null): ZcodeTurn | null {
  let entry: Row
  try {
    entry = JSON.parse(line) as Row
  } catch {
    return null
  }
  const request = (entry?.request ?? {}) as Row
  const body = (request.body ?? {}) as Row
  const response = (entry?.response ?? {}) as Row
  const user = extractUserFromMessages(body.input ?? request.messages)
  if (!user) return null

  const assistant = cleanZcodeText(response.text ?? response.content ?? (entry as Row).assistant_text ?? '')
  const toolCalls = toolTraces(response.toolCalls, toolResults ?? new Map())

  return {
    user,
    assistant,
    ...(toolCalls.length > 0 ? { assistantToolCalls: toolCalls } : {}),
    ...(typeof entry.turnId === 'string' && entry.turnId ? { turnId: entry.turnId } : {}),
    ...(typeof entry.completedAt === 'string' ? { createdAt: entry.completedAt } : {}),
  }
}

/**
 * Collect every tool result (function_call_output) in the rollout keyed by
 * call_id. ZCode writes the assistant tool call in one line's `response`
 * and the tool result in a LATER line's `request.body.input`, so results are
 * correlated across the whole file (not just the unseen tail). Outputs may be
 * truncated by the host; we keep the raw text so resultSummary can summarize.
 */
function collectToolResults(lines: string[]): Map<string, string> {
  const byCallId = new Map<string, string>()
  for (const line of lines) {
    let entry: Row
    try {
      entry = JSON.parse(line) as Row
    } catch {
      continue
    }
    const body = (entry?.request as Row | undefined)?.body as Row | undefined ?? {}
    const input = body.input ?? (entry?.request as Row | undefined)?.messages
    if (!Array.isArray(input)) continue
    for (const block of input as Array<Row>) {
      if (block && typeof block === 'object' && block.type === 'function_call_output') {
        const id = block.call_id
        if (typeof id === 'string' && id) byCallId.set(id, typeof block.output === 'string' ? block.output : '')
      }
    }
  }
  return byCallId
}

/**
 * Read all unseen turns from a ZCode rollout file after `lastTurnId`.
 *
 * `completeActive: false` (PostToolUse incremental capture) keeps the newest
 * turn out of the result — it is still being written — and reports the cursor
 * of the last COMPLETE turn instead, so Stop can fold its final text later.
 */
export function readUnseenRolloutTurns(
  rolloutPath: string | null,
  lastTurnId: string | null = null,
  options: { completeActive?: boolean } = {},
): RolloutReadResult {
  if (!rolloutPath) return { available: false, turns: [], lastTurnId }
  let raw: string
  try {
    raw = readFileSync(rolloutPath, 'utf8')
  } catch {
    return { available: false, turns: [], lastTurnId }
  }
  const completeActive = options.completeActive ?? true
  const lines = raw.split('\n').filter((line) => line.trim())
  if (lines.length === 0) return { available: true, turns: [], lastTurnId }

  // Correlate tool results across the whole file before folding turns.
  const toolResults = collectToolResults(lines)

  let startIndex = 0
  if (lastTurnId) {
    const found = lines.findIndex((line) => {
      try {
        return (JSON.parse(line) as Row).turnId === lastTurnId
      } catch {
        return false
      }
    })
    if (found >= 0) startIndex = found + 1
  }

  const byTurn = new Map<string, { user: string; assistant: string; assistantToolCalls: NonNullable<ZcodeTurn['assistantToolCalls']>; createdAt?: string }>()
  const order: string[] = []
  let latestTurnId = lastTurnId
  let lastLineTurnId: string | null = null
  for (let i = startIndex; i < lines.length; i += 1) {
    let entry: Row
    try {
      entry = JSON.parse(lines[i]!) as Row
    } catch {
      continue
    }
    const turnId = typeof entry.turnId === 'string' && entry.turnId ? entry.turnId : null
    if (turnId) latestTurnId = turnId

    // Fold all rollout lines sharing one turnId into a single turn: keep the
    // user text, collect every tool call, and let later lines overwrite the
    // assistant text so we end with the final answer.
    let bucket = turnId ? byTurn.get(turnId) : undefined
    if (!bucket && turnId) {
      bucket = { user: '', assistant: '', assistantToolCalls: [] }
      byTurn.set(turnId, bucket)
      order.push(turnId)
    }
    if (!bucket) continue
    const request = (entry.request ?? {}) as Row
    const body = (request.body ?? {}) as Row
    const user = extractUserFromMessages(body.input ?? request.messages)
    if (user) bucket.user = user
    const response = (entry.response ?? {}) as Row
    const assistant = cleanZcodeText(response.text ?? response.content ?? '')
    if (assistant) bucket.assistant = assistant
    for (const trace of toolTraces(response.toolCalls, toolResults)) bucket.assistantToolCalls.push(trace)
    if (typeof entry.completedAt === 'string' && !bucket.createdAt) bucket.createdAt = entry.completedAt
    lastLineTurnId = turnId
  }

  const turns: ZcodeTurn[] = []
  for (const turnId of order) {
    const bucket = byTurn.get(turnId)!
    if (!bucket.user) continue
    turns.push({
      user: bucket.user,
      assistant: bucket.assistant,
      ...(bucket.assistantToolCalls.length > 0 ? { assistantToolCalls: bucket.assistantToolCalls } : {}),
      ...(bucket.createdAt ? { createdAt: bucket.createdAt } : {}),
      turnId,
    })
  }

  // If no explicit turnId was present anywhere, fall back to the previous
  // per-line behavior so single-line rollouts still work.
  if (turns.length === 0 && !lastLineTurnId) {
    for (let i = startIndex; i < lines.length; i += 1) {
      const turn = turnFromRolloutLine(lines[i]!, toolResults)
      if (!turn) continue
      const { turnId: _t, createdAt: _c, ...rest } = turn
      turns.push(rest)
    }
    if (!completeActive) {
      if (turns.length > 0) turns.pop() // the last unkeyed turn is still active
      return { available: true, turns, lastTurnId }
    }
  }

  if (!completeActive) {
    // Incremental capture: the active turn (the one the last rollout line
    // belongs to) is still being written — keep it out AND keep the cursor on
    // the last delivered turn so Stop can fold its final text later.
    if (lastLineTurnId) {
      const activeIndex = turns.findIndex((turn) => turn.turnId === lastLineTurnId)
      if (activeIndex >= 0) turns.splice(activeIndex, 1)
    }
    const last = turns[turns.length - 1]
    return { available: true, turns, lastTurnId: last?.turnId ?? lastTurnId }
  }

  return { available: true, turns, lastTurnId: latestTurnId }
}

/**
 * Build turns from a hook-event payload. Prefers the rollout file; falls back
 * to stdin fields (compat with hosts that do not expose a rollout).
 */
export function buildZcodeTurns(
  input: Row = {},
  state: { lastTurnId?: string | null } = {},
  options: { completeActive?: boolean; rolloutPath?: string | null } = {},
): RolloutReadResult {
  const sessionId = String(input.session_id ?? input.sessionId ?? input.conversation_id ?? '')
  const rolloutPath = options.rolloutPath !== undefined
    ? options.rolloutPath
    : join(process.env.HOME || process.env.USERPROFILE || '', '.zcode', 'cli', 'rollout', `model-io-${sessionId}.jsonl`)
  const rollout = readUnseenRolloutTurns(rolloutPath, state.lastTurnId ?? null, options)
  if (rollout.available) return rollout

  const assistant = cleanZcodeText(
    input.responseText
    ?? input.responsePreview
    ?? input.last_assistant_message
    ?? input.assistantMessage
    ?? input.text_content
    ?? '',
  )
  const user = cleanZcodeText(
    input.prompt
    ?? input.user_prompt
    ?? input.last_user_message
    ?? '',
  )
  const turns: ZcodeTurn[] = user && assistant ? [{ user, assistant }] : []
  return { available: false, turns, lastTurnId: null }
}
