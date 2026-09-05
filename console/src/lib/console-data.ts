import type { ConsoleSnapshot, DetailRow, L5Message, MemoryElement, MemoryEvent, NamespaceRow, SessionRow } from '../api/types.js'
import { compact, timeValue } from './format.js'

export function snapshotMessages(snapshot?: ConsoleSnapshot | null): L5Message[] {
  if (!snapshot) return []
  const raw = [...(snapshot.openTail ?? []), ...(snapshot.blocks ?? []).flatMap((block) => block.l5Raw ?? [])]
  return [...raw].sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt))
}

export function sourceMessagesFor(snapshot: ConsoleSnapshot | null | undefined, refs: string[]): L5Message[] {
  const wanted = new Set(refs)
  return snapshotMessages(snapshot).filter((message) => wanted.has(message.id))
}

export function groupSessions(rows: L5Message[]): SessionRow[] {
  const groups = new Map<string, SessionRow>()
  for (const message of rows) {
    const id = message.conversationId || message.threadId || '__legacy__'
    const row = groups.get(id) ?? { id, messages: [], last: '', title: '' }
    row.messages.push(message)
    row.last = message.createdAt
    if (!row.title && message.role === 'user') row.title = compact(message.content).slice(0, 120)
    groups.set(id, row)
  }
  return [...groups.values()].sort((a, b) => timeValue(b.last) - timeValue(a.last))
}

export function projectLabel(row: NamespaceRow): string {
  const name = row.projectName || row.label?.replace(/^项目\s*/, '') || row.namespace
  const legacy = !row.namespace.startsWith('shared:')
  return name + ' · ' + (legacy ? '历史 ' + row.namespace.split(':')[0] : '共享') + ' · ' + (row.sourceAdapters?.join(', ') || '未标注来源') + ' · ' + row.namespace.slice(-6)
}

export function withCompactFlags(rows: L5Message[]): Array<{ message: L5Message; compact: boolean }> {
  let previousRole: string | null = null
  return rows.map((message) => {
    const item = { message, compact: previousRole === message.role }
    previousRole = message.role
    return item
  })
}

export function detailSourceRefs(row: DetailRow, snapshot?: ConsoleSnapshot | null): string[] {
  const direct = (row as MemoryEvent).sourceMessageIds
  if (direct?.length) return direct
  const eventRefs = (row as MemoryEvent).sourceEventIds ?? []
  return eventRefs.flatMap((eventId) => snapshot?.events?.find((event) => event.id === eventId)?.sourceMessageIds ?? [])
}

export function rowTitle(row: DetailRow): string {
  return row.title || (row as MemoryElement).name || row.id
}

export function rowSummary(row: DetailRow): string {
  const value = (row as MemoryEvent).summary || (row as MemoryEvent).narrative || (row as MemoryElement).currentState || '暂无摘要'
  return compact(value).slice(0, 240)
}

export function rowType(row: DetailRow, kind: string): string {
  return row.type || (row as MemoryEvent).temporal?.eventType || kind
}

export function rowStatus(row: DetailRow): string {
  return row.status || (row as MemoryEvent).temporal?.status || ''
}
