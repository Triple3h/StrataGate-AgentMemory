import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { foldLatestTurn, normalizeCodexEntries, parseJsonLines } from '../../../packages/adapter-sdk/src/transcript.js'
import type { TurnInput } from '@diqier/stratagate'

type Row = Record<string, any>
export interface CapturedTurn { id: string; turn: TurnInput }
export interface CodexTranscript { sessionId: string; projectDir: string; turns: CapturedTurn[]; consumedBytes: number }
const text = (value: unknown): string => typeof value === 'string' ? value : Array.isArray(value) ? value.map(v => typeof v === 'string' ? v : text(v?.text ?? v?.content)).filter(Boolean).join('\n') : ''

/** Group by native turn identity before deduplicating the two rollout representations. */
export function parseCodexTranscript(buffer: Buffer, options: { completeActive?: boolean; sessionId?: string; projectDir?: string } = {}): CodexTranscript {
  const parsed = parseJsonLines(buffer)
  const meta = parsed.entries.find(e => e.type === 'session_meta')?.payload as Row | undefined
  const sessionId = String(meta?.id ?? meta?.session_id ?? options.sessionId ?? '')
  const projectDir = String(meta?.cwd ?? options.projectDir ?? '')
  if (!sessionId || !projectDir) throw new Error('Codex transcript is missing session identity or project directory')
  const groups = new Map<string, { rows: Row[]; complete: boolean; fallback?: string }>()
  let active = ''
  let ordinal = 0
  for (const row of parsed.entries as Row[]) {
    const p = row.payload ?? {}
    // response_item metadata may contain an upstream generation ID, not the
    // native Codex turn ID. It must not split tool traces from their user turn.
    const id = row.type === 'event_msg' || row.type === 'turn_context' ? p.turn_id : undefined
    if (p.type === 'task_started') active = String(id ?? `turn-${ordinal++}`)
    if (row.type === 'turn_context' && id) active = String(id)
    if (id) active = String(id)
    if (!active && (p.type === 'message' && p.role === 'user' || p.type === 'user_message')) active = `legacy-${row.timestamp ?? ordinal++}`
    if (!active) continue
    let group = groups.get(active)
    if (!group) { group = { rows: [], complete: false }; groups.set(active, group) }
    if (p.type === 'task_complete' || p.type === 'task_completed') {
      group.complete = true
      if (typeof p.last_agent_message === 'string') group.fallback = p.last_agent_message
    }
    if (p.type === 'message' && p.role === 'assistant' && p.phase === 'final'
      || p.type === 'item_completed' && p.item?.type?.toLowerCase() === 'agentmessage' && p.item.phase === 'final') group.complete = true
    if (p.type === 'user_message') group.rows.push({ ...row, payload: { type: 'message', role: 'user', content: p.message } })
    else if (p.type === 'agent_message') group.rows.push({ ...row, payload: { type: 'message', role: 'assistant', content: p.message } })
    else if (!(p.type === 'message' && p.role === 'assistant' && p.channel === 'analysis')) group.rows.push(row)
  }
  if (options.completeActive && active && groups.has(active)) groups.get(active)!.complete = true
  const turns: CapturedTurn[] = []
  for (const [id, group] of groups) {
    if (!group.complete) continue
    const hasUserEvents = group.rows.some(row => row.payload?.type === 'item_completed' && row.payload?.item?.type?.toLowerCase() === 'usermessage')
    // Desktop response_item also contains injected AGENTS/environment messages.
    // UserMessage events identify the actual user input for this turn.
    const sources = hasUserEvents ? group.rows.filter(row => !(row.type === 'response_item' && row.payload?.type === 'message' && row.payload?.role === 'user')) : group.rows
    const normalized = normalizeCodexEntries(sources) as Row[]
    const users = normalized.filter(e => e.type === 'user' && !e.message?.content?.some?.((b: Row) => b.type === 'tool_result'))
    const user = users.map(e => text(e.message?.content)).filter(Boolean).join('\n\n')
    if (!user) continue
    const entries = [{ type: 'user', timestamp: users[0]?.timestamp, message: { content: user } }, ...normalized.filter(e => !users.includes(e))]
    const turn = foldLatestTurn(entries, user, group.fallback)
    if (turn) turns.push({ id, turn })
  }
  return { sessionId, projectDir, turns, consumedBytes: parsed.consumedBytes }
}

export function codexReceipt(sessionId: string, agent: string, turnId: string): string {
  return 'codex:v2:' + createHash('sha256').update(JSON.stringify([sessionId, agent, turnId])).digest('hex')
}
export async function readCodexTranscript(path: string, options: Parameters<typeof parseCodexTranscript>[1] = {}) {
  return parseCodexTranscript(await readFile(path), options)
}
