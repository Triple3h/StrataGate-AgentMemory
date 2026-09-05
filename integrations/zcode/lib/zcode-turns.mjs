#!/usr/bin/env node
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
 *
 * This file is pure and dependency-free so it can be unit tested.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const INJECTED_BLOCK_RE = /<stratagate_memory\b[^>]*>[\s\S]*?<\/stratagate_memory>/gi
const SYSTEM_REMINDER_RE = /<system-reminder>[\s\S]*?<\/system-reminder>/gi

export function cleanZcodeText(value) {
  return String(value || '')
    .replace(INJECTED_BLOCK_RE, '')
    .replace(SYSTEM_REMINDER_RE, '')
    .trim()
}

function asString(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((block) => block && typeof block === 'object')
      .map((block) => {
        // OpenAI Responses API text blocks use type: "input_text" / "output_text";
        // Anthropic-style use "text". Accept all of them.
        if ((block.type === 'text' || block.type === 'input_text' || block.type === 'output_text')
            && typeof block.text === 'string') {
          return block.text
        }
        if (block.type === 'tool_result') return ''
        if (block.type === 'tool_use') return ''
        return ''
      })
      .join('\n')
  }
  return ''
}

function extractUserFromMessages(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role !== 'user') continue
    const cleaned = cleanZcodeText(asString(message.content))
    if (cleaned) return cleaned
  }
  return ''
}

/**
 * Parse one rollout line into a TurnInput candidate (without receiptId/threadId).
 * Returns null when the line carries no usable user text.
 */
export function turnFromRolloutLine(line, toolResults = null) {
  let entry
  try {
    entry = JSON.parse(line)
  } catch {
    return null
  }
  const request = entry?.request || {}
  const body = request.body || {}
  const messages = body.input || request.messages || []
  const response = entry?.response || {}
  const user = extractUserFromMessages(messages)
  if (!user) return null

  const assistant = cleanZcodeText(
    response.text ?? response.content ?? entry.assistant_text ?? '',
  )
  const toolCalls = Array.isArray(response.toolCalls)
    ? response.toolCalls
        .filter((call) => call && typeof call.name === 'string')
        .map((call) => {
          const trace = {
            name: call.name,
            ...(call.input && typeof call.input === 'object' ? { arguments: call.input } : {}),
          }
          const id = typeof call.id === 'string' && call.id ? call.id : null
          if (toolResults && id && toolResults.has(id)) {
            const result = toolResults.get(id)
            if (result !== '') trace.result = result
          }
          return trace
        })
    : []

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
function collectToolResults(lines) {
  const byCallId = new Map()
  for (const line of lines) {
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    const body = entry?.request?.body || {}
    const input = body.input || entry?.request?.messages || []
    if (!Array.isArray(input)) continue
    for (const block of input) {
      if (block && typeof block === 'object' && block.type === 'function_call_output') {
        const id = block.call_id
        if (typeof id === 'string' && id) byCallId.set(id, block.output ?? '')
      }
    }
  }
  return byCallId
}

/**
 * Read all unseen turns from a ZCode rollout file after `lastTurnId`.
 * Returns { turns, lastTurnId, available }.
 */
export function readUnseenRolloutTurns(rolloutPath, lastTurnId = null) {
  if (!rolloutPath) return { available: false, turns: [], lastTurnId }
  let raw
  try {
    raw = readFileSync(rolloutPath, 'utf8')
  } catch {
    return { available: false, turns: [], lastTurnId }
  }
  const lines = raw.split('\n').filter((line) => line.trim())
  if (lines.length === 0) return { available: true, turns: [], lastTurnId }

  // Correlate tool results across the whole file before folding turns.
  const toolResults = collectToolResults(lines)

  let startIndex = 0
  if (lastTurnId) {
    const found = lines.findIndex((line) => {
      try {
        return JSON.parse(line).turnId === lastTurnId
      } catch {
        return false
      }
    })
    if (found >= 0) startIndex = found + 1
  }

  const turns = []
  const byTurn = new Map()
  let latestTurnId = lastTurnId
  let lastLineTurnId = null
  for (let i = startIndex; i < lines.length; i += 1) {
    let entry
    try {
      entry = JSON.parse(lines[i])
    } catch {
      continue
    }
    const turnId = typeof entry.turnId === 'string' && entry.turnId ? entry.turnId : null
    if (turnId) latestTurnId = turnId

    // Fold all rollout lines sharing one turnId into a single turn: keep the
    // user text, collect every tool call, and let later lines overwrite the
    // assistant text so we end with the final answer.
    let bucket = turnId ? byTurn.get(turnId) : null
    if (!bucket) {
      bucket = { user: '', assistant: '', assistantToolCalls: [], createdAt: undefined }
      if (turnId) byTurn.set(turnId, bucket)
    }
    const request = entry?.request || {}
    const body = request.body || {}
    const messages = body.input || request.messages || []
    const user = extractUserFromMessages(messages)
    if (user) bucket.user = user
    const response = entry?.response || {}
    const assistant = cleanZcodeText(response.text ?? response.content ?? '')
    if (assistant) bucket.assistant = assistant
    if (Array.isArray(response.toolCalls)) {
      for (const call of response.toolCalls) {
        if (call && typeof call.name === 'string') {
          const trace = {
            name: call.name,
            ...(call.input && typeof call.input === 'object' ? { arguments: call.input } : {}),
          }
          const id = typeof call.id === 'string' && call.id ? call.id : null
          if (id && toolResults.has(id)) {
            const result = toolResults.get(id)
            if (result !== '') trace.result = result
          }
          bucket.assistantToolCalls.push(trace)
        }
      }
    }
    if (typeof entry.completedAt === 'string' && !bucket.createdAt) {
      bucket.createdAt = entry.completedAt
    }
    lastLineTurnId = turnId
  }

  for (const [turnId, bucket] of byTurn) {
    if (!bucket.user) continue
    const { createdAt, ...rest } = bucket
    turns.push({
      ...rest,
      ...(createdAt ? { createdAt } : {}),
      ...(turnId ? { turnId } : {}),
    })
  }

  // If no explicit turnId was present anywhere, fall back to the previous
  // per-line behavior so single-line rollouts still work.
  if (turns.length === 0 && !lastLineTurnId) {
    for (let i = startIndex; i < lines.length; i += 1) {
      const turn = turnFromRolloutLine(lines[i], toolResults)
      if (!turn) continue
      const { turnId: _t, createdAt: _c, ...rest } = turn
      turns.push(rest)
    }
  }

  return { available: true, turns, lastTurnId: latestTurnId }
}

/**
 * Build turns from a Stop-event payload. Prefers the rollout file; falls back
 * to stdin fields (compat with hosts that do not expose a rollout).
 */
export function buildZcodeTurns(input = {}, state = {}) {
  const sessionId = input.session_id || input.sessionId || input.conversation_id || ''
  const rolloutPath = join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.zcode', 'cli', 'rollout', `model-io-${sessionId}.jsonl`,
  )
  const rollout = readUnseenRolloutTurns(rolloutPath, state.lastTurnId || null)
  if (rollout.available) return rollout

  const assistant = cleanZcodeText(
    input.responseText ||
    input.responsePreview ||
    input.last_assistant_message ||
    input.assistantMessage ||
    input.text_content ||
    '',
  )
  const user = cleanZcodeText(
    input.prompt ||
    input.user_prompt ||
    input.last_user_message ||
    state.pendingPrompt?.prompt ||
    '',
  )
  const turns = user && assistant
    ? [{ user, assistant }]
    : []
  return { available: false, turns, lastTurnId: null }
}
