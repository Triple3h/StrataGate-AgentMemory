import { createRequire } from 'node:module'
import type { Context } from '@deepseek-ai/cordis'
import {
  deterministicBlockLayers,
  EXTERNAL_MEMORY_EXPORT_PROMPT_ZH_CN,
  getDecayedBlockLevel,
  KNOWLEDGE_GRAPH_PROJECTOR_VERSION,
  type ElementCard,
  type EventCard,
  type MemoryBlock,
  type RawMessage,
  type StrataGateSnapshot,
  type UsageReceipt,
} from '@diqier/stratagate'
import type { StrataGateRuntime } from './runtime.js'
import { clusterKnowledgeGraph } from './graph-clustering.js'

const STRATAGATE_DSH_VERSION = '0.2.32'
const LEGACY_THREAD_ID = '__legacy__'
const nodeRequire = createRequire(import.meta.url)

function installedPackageVersion(names: readonly string[]): string {
  for (const name of names) {
    try {
      const value = nodeRequire(`${name}/package.json`) as { version?: unknown }
      if (typeof value.version === 'string' && value.version.trim()) return value.version
    } catch {}
  }
  return 'unknown'
}

interface DisplayBlock {
  id: string
  source: MemoryBlock
  threadId: string
  messages: RawMessage[]
  virtual: boolean
  turnRange: [number, number]
}

interface RecoveredSnapshotView {
  blocks: DisplayBlock[]
  openMessages: Array<{ message: RawMessage; threadId: string }>
  receiptThreads: Map<string, string>
  receiptActivity: Map<string, string>
}

export interface WebResponse {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body: string): void
}

export interface WebRequest {
  method?: string
  url?: string
  /** Parsed JSON body supplied by the host web server (or a JSON string). */
  body?: unknown
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | string>
}

export interface WebServerLike {
  register(route: {
    readonly kind: 'prefix'
    readonly path: string
    readonly handler: (req: WebRequest, res: WebResponse) => Promise<void>
  }): () => void
}

function sendJson(res: WebResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(redactValue(body)))
}

function numeric(value: string | null, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.floor(parsed))) : fallback
}

function redact(text: string): string {
  return text
    .replace(/\b(?:sk|gh[opasu]|github_pat)_[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_TOKEN]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]{12,}={0,2}\b/gi, '$1[REDACTED]')
    .replace(/\b(api[_-]?key|token|password|secret)\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]')
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redact(value)
  if (Array.isArray(value)) return value.map(redactValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item)]))
  }
  return value
}

function redactedMessage(message: RawMessage, blockId: string | null): RawMessage & { blockId: string | null } {
  const { toolCalls, ...base } = message
  const common = { ...base, content: redact(message.content), blockId }
  return toolCalls
    ? { ...common, toolCalls: redactValue(toolCalls) as NonNullable<RawMessage['toolCalls']> }
    : common
}

function sourceMessages(snapshot: StrataGateSnapshot, ids?: ReadonlySet<string>): Array<RawMessage & { blockId: string | null }> {
  const output: Array<RawMessage & { blockId: string | null }> = []
  for (const block of snapshot.blocks) {
    for (const message of block.l5Raw) {
      if (!ids || ids.has(message.id)) {
        output.push(redactedMessage(message, block.id))
      }
    }
  }
  for (const message of snapshot.openTail) {
    if (!ids || ids.has(message.id)) {
      output.push(redactedMessage(message, null))
    }
  }
  return output
}

function blockLayers(block: MemoryBlock): Array<{ level: number; content: string }> {
  return [
    { level: 0, content: `${block.l0Title}\n标签：${block.l0Tags.join('、') || '无'}` },
    { level: 1, content: block.l1Summary || block.l0Title },
    { level: 2, content: block.l2Keypoints.map((point) => `• ${point}`).join('\n') || block.l1Summary || block.l0Title },
    { level: 3, content: block.l3Condensed || block.l2Keypoints.join('\n') || block.l1Summary },
    { level: 4, content: block.l4Readable || block.l3Condensed },
    { level: 5, content: block.l5Raw.map((message) => `${message.role}: ${message.content}`).join('\n\n') },
  ]
}

function eventSummary(event: EventCard): unknown {
  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    narrative: event.narrative,
    tags: event.tags,
    sourceBlockId: event.sourceBlockId,
    sourceMessageIds: event.sourceMessageIds,
    temporal: event.temporal,
    scope: event.scope,
    criticality: event.criticality,
    confidence: event.confidence,
    status: event.status,
    supersededBy: event.supersededBy,
    weight: event.weight,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  }
}

function elementSummary(element: ElementCard): unknown {
  return {
    id: element.id,
    name: element.name,
    type: element.type,
    aliases: element.aliases,
    currentState: element.currentState,
    facts: element.facts,
    sourceEventIds: element.sourceEventIds,
    sourceMessageIds: element.sourceMessageIds,
    weight: element.weight,
    createdAt: element.createdAt,
    updatedAt: element.updatedAt,
  }
}

function matchesQuery(value: unknown, query: string): boolean {
  if (!query) return true
  return JSON.stringify(value).toLocaleLowerCase().includes(query.toLocaleLowerCase())
}

async function requiredSnapshot(runtime: StrataGateRuntime, namespace: string): Promise<StrataGateSnapshot> {
  const snapshot = await runtime.adminSnapshot(namespace)
  if (!snapshot) throw new AdminHttpError(404, `Unknown StrataGate namespace: ${namespace}`)
  return snapshot
}

class AdminHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

async function overview(runtime: StrataGateRuntime): Promise<unknown> {
  const namespaces = await runtime.adminNamespaces()
  const rows = []
  for (const namespace of namespaces) {
    const snapshot = await runtime.adminSnapshot(namespace)
    if (!snapshot) continue
    const failedJobs = snapshot.extractionJobs.filter(({ status }) => status === 'failed').length
      + snapshot.graphProjectionJobs.filter(({ status }) => status === 'failed').length
    const processingJobs = snapshot.extractionJobs.filter(({ status }) => status === 'running').length
      + snapshot.graphProjectionJobs.filter(({ status }) => status === 'pending' || status === 'running').length
    const failedJobDetails = [
      ...snapshot.extractionJobs
        .filter(({ status }) => status === 'failed')
        .map((job) => ({
          id: job.blockId,
          kind: 'event-extraction',
          attempts: job.attempts,
          lastError: job.lastError?.slice(0, 500) ?? null,
          lastErrorFull: job.lastError,
          updatedAt: job.updatedAt,
        })),
      ...snapshot.graphProjectionJobs
        .filter(({ status }) => status === 'failed')
        .map((job) => ({
          id: job.id,
          kind: 'graph-projection',
          attempts: job.attempts,
          lastError: job.lastError?.slice(0, 500) ?? null,
          lastErrorFull: job.lastError,
          updatedAt: job.updatedAt,
        })),
    ]
    const timestamps = [
      ...snapshot.blocks.map(({ createdAt }) => createdAt),
      ...snapshot.events.map(({ updatedAt }) => updatedAt),
      ...snapshot.elements.map(({ updatedAt }) => updatedAt),
      ...snapshot.graphNodes.map(({ updatedAt }) => updatedAt),
      ...snapshot.usageReceipts.map(({ createdAt }) => createdAt),
    ].sort()
    rows.push({
      namespace,
      workspaceName: runtime.adminWorkspaceName(namespace) ?? '当前工作区',
      schemaVersion: snapshot.schemaVersion,
      currentTurn: snapshot.currentTurn,
      blockTurnSize: snapshot.blockTurnSize,
      blockDecayLambda: snapshot.blockDecayLambda,
      blocks: snapshot.blocks.length,
      openTailMessages: snapshot.openTail.length,
      events: snapshot.events.length,
      activeEvents: snapshot.events.filter(({ status }) => status === 'active').length,
      elements: snapshot.elements.length,
      graphNodes: snapshot.graphNodes.length,
      graphEdges: snapshot.graphEdges.length,
      graphMigration: (() => {
        const projected = new Set(snapshot.graphProjectionJobs
          .filter(({ status, projectorVersion }) => status === 'completed' && projectorVersion === KNOWLEDGE_GRAPH_PROJECTOR_VERSION)
          .flatMap(({ sourceEventIds }) => sourceEventIds)).size
        const failed = snapshot.graphProjectionJobs.filter(({ status }) => status === 'failed').length
        const running = snapshot.graphProjectionJobs.filter(({ status }) => status === 'running').length
        const total = snapshot.events.filter(({ status }) => status !== 'forgotten' && status !== 'archived').length
        return { projected, total, failed, running, complete: projected >= total }
      })(),
      usageReceipts: snapshot.usageReceipts.length,
      memoryUseCount: snapshot.usageReceipts.filter((receipt) =>
        receipt.eventIds.length > 0 || receipt.elementIds.length > 0).length,
      failedJobs,
      processingJobs,
      failedJobDetails,
      successfulModelResponses: snapshot.successfulModelResponses ?? [],
      lastActivityAt: timestamps.at(-1) ?? null,
    })
  }
  return {
    readonly: true,
    settingsWritable: true,
    pluginVersion: STRATAGATE_DSH_VERSION,
    harnessVersion: installedPackageVersion(['@deepseek-ai/dsh', '@deepseek-ai/dsh-session']),
    namespaces: rows,
  }
}

async function updateSettings(runtime: StrataGateRuntime, url: URL): Promise<unknown> {
  const raw = url.searchParams.get('blockDecayLambda')?.trim() ?? ''
  const value = Number(raw)
  if (!raw || !Number.isFinite(value) || value < 0) {
    throw new AdminHttpError(400, 'blockDecayLambda must be a non-negative finite number')
  }
  return { blockDecayLambda: await runtime.adminSetBlockDecayLambda(value) }
}

async function importExternalMemory(runtime: StrataGateRuntime, req: WebRequest): Promise<unknown> {
  let suppliedBody = req.body
  if (suppliedBody === undefined && typeof req[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req as AsyncIterable<Uint8Array | string>) {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += value.length
      if (size > 4 * 1024 * 1024) throw new AdminHttpError(413, '导入数据不能超过 4 MB')
      chunks.push(value)
    }
    suppliedBody = Buffer.concat(chunks).toString('utf8')
  }
  let body: Record<string, unknown>
  if (typeof suppliedBody === 'string') {
    try { body = JSON.parse(suppliedBody) as Record<string, unknown> } catch { throw new AdminHttpError(400, '导入数据必须是合法 JSON') }
  } else if (suppliedBody && typeof suppliedBody === 'object' && !Array.isArray(suppliedBody)) {
    body = suppliedBody as Record<string, unknown>
  } else {
    throw new AdminHttpError(400, '导入请求缺少 JSON body')
  }
  const namespace = typeof body.namespace === 'string' ? body.namespace.trim() : ''
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!namespace) throw new AdminHttpError(400, 'namespace is required')
  if (!text) throw new AdminHttpError(400, 'text is required')
  return runtime.adminImportExternalMemory(namespace, text)
}

function externalMemoryPrompt(): unknown {
  return { prompt: EXTERNAL_MEMORY_EXPORT_PROMPT_ZH_CN, schemaVersion: 'stratagate.external-memory.v2' }
}

function receiptThreadId(id: string): string | null {
  const match = /^dsh:(.+):turn:\d+$/.exec(id)
  return match?.[1]?.trim() || null
}

function timestampKey(value: string): string {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? String(parsed) : value
}

function recoverSnapshotView(snapshot: StrataGateSnapshot): RecoveredSnapshotView {
  const receiptThreads = new Map<string, string>()
  const receiptActivity = new Map<string, string>()
  const receiptCandidates = new Map<string, Set<string>>()
  for (const receipt of snapshot.ingestionReceipts) {
    const threadId = receiptThreadId(receipt.id)
    if (!threadId) continue
    receiptThreads.set(receipt.id, threadId)
    const currentActivity = receiptActivity.get(threadId)
    if (!currentActivity || receipt.createdAt > currentActivity) receiptActivity.set(threadId, receipt.createdAt)
    const key = timestampKey(receipt.createdAt)
    const candidates = receiptCandidates.get(key) ?? new Set<string>()
    candidates.add(threadId)
    receiptCandidates.set(key, candidates)
  }
  const exactThreadAt = new Map([...receiptCandidates]
    .filter(([, ids]) => ids.size === 1)
    .map(([createdAt, ids]) => [createdAt, [...ids][0]!] as const))

  const recoverMessages = (messages: readonly RawMessage[]): Array<{ message: RawMessage; threadId: string }> => {
    let precedingThreadId: string | null = null
    return messages.map((message) => {
      const explicit = message.threadId?.trim()
      const exact = exactThreadAt.get(timestampKey(message.createdAt))
      const recovered = explicit || exact || (message.role === 'assistant' ? precedingThreadId : null)
      const threadId = recovered || LEGACY_THREAD_ID
      if (message.role === 'user' || explicit || exact) precedingThreadId = threadId
      return { message, threadId }
    })
  }

  const blocks: DisplayBlock[] = []
  for (const source of snapshot.blocks) {
    const recovered = recoverMessages(source.l5Raw)
    const groups = new Map<string, RawMessage[]>()
    for (const item of recovered) {
      const messages = groups.get(item.threadId) ?? []
      messages.push(item.message)
      groups.set(item.threadId, messages)
    }
    const entries = [...groups]
    for (const [threadId, messages] of entries) {
      const virtual = !source.threadId && (entries.length > 1 || threadId !== LEGACY_THREAD_ID)
      blocks.push({
        id: entries.length > 1 ? `virtual:${source.id}:${encodeURIComponent(threadId)}` : source.id,
        source,
        threadId,
        messages,
        virtual,
        turnRange: [0, 0],
      })
    }
  }

  const turnCounters = new Map<string, number>()
  for (const block of blocks) {
    if (block.source.threadId) {
      block.turnRange = [block.source.startTurn, block.source.endTurn]
      turnCounters.set(block.threadId, Math.max(turnCounters.get(block.threadId) ?? 0, block.source.endTurn))
      continue
    }
    const turns = Math.max(1, block.messages.filter(({ role }) => role === 'user').length)
    const start = (turnCounters.get(block.threadId) ?? 0) + 1
    block.turnRange = [start, start + turns - 1]
    turnCounters.set(block.threadId, start + turns - 1)
  }

  return {
    blocks,
    openMessages: recoverMessages(snapshot.openTail),
    receiptThreads,
    receiptActivity,
  }
}

function virtualBlockLayers(block: DisplayBlock): Array<{ level: number; content: string }> {
  if (!block.virtual || block.messages.length === block.source.l5Raw.length) return blockLayers(block.source)
  const deterministic = deterministicBlockLayers(block.messages)
  const natural = block.messages.filter(({ role }) => role === 'user' || role === 'assistant')
  const firstUser = natural.find(({ role, content }) => role === 'user' && content.trim())
  const title = firstUser?.content.replace(/\s+/g, ' ').trim().slice(0, 80) || '旧会话片段'
  const summary = natural.map(({ content }) => content.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ').slice(0, 500)
  const keypoints = natural.filter(({ role }) => role === 'user').map(({ content }) => content.replace(/\s+/g, ' ').trim().slice(0, 160))
  return [
    { level: 0, content: title },
    { level: 1, content: summary || title },
    { level: 2, content: keypoints.map((point) => `• ${point}`).join('\n') || summary || title },
    { level: 3, content: deterministic.l3Condensed },
    { level: 4, content: deterministic.l4Readable },
    { level: 5, content: block.messages.map((message) => `${message.role}: ${message.content}`).join('\n\n') },
  ]
}

function conversationRows(snapshot: StrataGateSnapshot, view = recoverSnapshotView(snapshot)): Array<{ id: string; label: string; blocks: number; lastActivityAt: string | null }> {
  const ids = new Set([
    ...view.blocks.map((block) => block.threadId),
    ...view.openMessages.map(({ threadId }) => threadId),
    ...view.receiptThreads.values(),
  ])
  return [...ids].map((id) => {
    const blocks = view.blocks.filter((block) => block.threadId === id)
    const messages = [
      ...blocks.flatMap((block) => block.messages),
      ...view.openMessages.filter((message) => message.threadId === id).map(({ message }) => message),
    ]
    const firstUser = messages.find(({ role, content }) => role === 'user' && content.trim())
    const title = firstUser?.content.replace(/\s+/g, ' ').trim().slice(0, 28)
    const timestamps = [
      ...blocks.map(({ source }) => source.createdAt),
      ...messages.map(({ createdAt }) => createdAt),
      ...(view.receiptActivity.get(id) ? [view.receiptActivity.get(id)!] : []),
    ].sort()
    return {
      id,
      label: id === LEGACY_THREAD_ID ? '历史对话' : title || `对话 ${id.slice(0, 8)}`,
      blocks: blocks.length,
      lastActivityAt: timestamps.at(-1) ?? null,
    }
  }).sort((left, right) => String(right.lastActivityAt).localeCompare(String(left.lastActivityAt)))
}

async function memories(runtime: StrataGateRuntime, url: URL): Promise<unknown> {
  const namespace = url.searchParams.get('namespace')?.trim() ?? ''
  if (!namespace) throw new AdminHttpError(400, 'namespace is required')
  const snapshot = await requiredSnapshot(runtime, namespace)
  const kind = url.searchParams.get('kind') ?? 'events'
  const query = url.searchParams.get('q')?.trim() ?? ''
  const offset = numeric(url.searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
  const limit = numeric(url.searchParams.get('limit'), 100, 1, 200)
  let values: unknown[]
  if (kind === 'events') values = [...snapshot.events].sort((left, right) => {
    const time = (event: EventCard): string => event.temporal.happenedStart ?? event.temporal.happenedEnd
      ?? event.temporal.mentionedAt ?? event.createdAt
    return time(right).localeCompare(time(left))
  }).map((event) => ({
    ...(eventSummary(event) as object),
    relatedNodes: snapshot.graphNodes
      .filter(({ id, sourceEventIds }) => sourceEventIds.includes(event.id)
        || (event.temporal.participantNodeIds ?? []).includes(id))
      .map(({ id, name, type }) => ({ id, name, type })),
    relatedElements: snapshot.elements
      .filter(({ sourceEventIds }) => sourceEventIds.includes(event.id))
      .map(({ id, name }) => ({ id, name })),
  }))
  else if (kind === 'graph') {
    const eventMap = new Map(snapshot.events.map((event) => [event.id, event]))
    return {
      namespace,
      kind,
      projectorVersion: KNOWLEDGE_GRAPH_PROJECTOR_VERSION,
      nodes: snapshot.graphNodes.map((node) => ({
        ...node,
        supportingEvents: node.sourceEventIds.flatMap((id) => eventMap.get(id) ?? []).map(eventSummary),
      })),
      edges: snapshot.graphEdges,
      clusters: clusterKnowledgeGraph(snapshot.graphNodes, snapshot.graphEdges),
      migration: (() => {
        const projected = new Set(snapshot.graphProjectionJobs
          .filter(({ status, projectorVersion }) => status === 'completed' && projectorVersion === KNOWLEDGE_GRAPH_PROJECTOR_VERSION)
          .flatMap(({ sourceEventIds }) => sourceEventIds)).size
        return {
          projected,
          total: snapshot.events.filter(({ status }) => status !== 'forgotten' && status !== 'archived').length,
          pending: snapshot.graphProjectionJobs.filter(({ status }) => status === 'pending').length,
          running: snapshot.graphProjectionJobs.filter(({ status }) => status === 'running').length,
          failed: snapshot.graphProjectionJobs.filter(({ status }) => status === 'failed').length,
          complete: projected >= snapshot.events.filter(({ status }) => status !== 'forgotten' && status !== 'archived').length,
        }
      })(),
    }
  }
  else if (kind === 'elements') values = snapshot.elements.map(elementSummary)
  else if (kind === 'blocks') {
    const recovered = recoverSnapshotView(snapshot)
    const conversations = conversationRows(snapshot, recovered)
    const requestedThreadId = url.searchParams.get('threadId')?.trim() ?? ''
    const activeThreadId = requestedThreadId || conversations[0]?.id || null
    const scopedBlocks = activeThreadId
      ? recovered.blocks.filter((block) => block.threadId === activeThreadId)
      : []
    values = scopedBlocks.map((block) => {
      const source = block.source
      const extraction = snapshot.extractionJobs.find(({ blockId }) => blockId === source.id)
      const blockMessageIds = new Set(block.messages.map(({ id }) => id))
      const relatedEvents = snapshot.events.filter((event) => event.sourceBlockId === source.id
        && (!block.virtual || event.sourceMessageIds.some((id) => blockMessageIds.has(id))))
      const eventIds = new Set(relatedEvents.map(({ id }) => id))
      const projections = snapshot.graphProjectionJobs
        .filter(({ sourceEventIds }) => sourceEventIds.some((id) => eventIds.has(id)))
      const relatedNodes = snapshot.graphNodes
        .filter(({ sourceEventIds }) => sourceEventIds.some((id) => eventIds.has(id)))
        .map(({ id, name, type }) => ({ id, name, type }))
      const failedProjection = projections.find(({ status }) => status === 'failed')
      const pendingProjection = projections.some(({ status }) => status === 'pending' || status === 'running')
      const needsExtraction = source.shouldExtract === true
      const status = extraction?.status === 'failed' || failedProjection
        ? 'failed'
        : extraction?.status === 'succeeded' || extraction?.status === 'skipped'
          ? pendingProjection ? 'processing' : 'organized'
          : needsExtraction ? 'waiting' : 'organized'
      const blockPosition = scopedBlocks.findIndex(({ id }) => id === block.id) + 1
      const latestBlockPosition = scopedBlocks.length
      const currentLevel = getDecayedBlockLevel(
        source.pointerAnchorLevel,
        source.threadId ? source.pointerAnchorBlockPosition : Math.min(source.pointerAnchorBlockPosition, blockPosition),
        latestBlockPosition,
        snapshot.blockDecayLambda,
      )
      return {
        id: block.id,
        sourceBlockId: source.id,
        threadId: block.threadId,
        sequence: source.sequence,
        turnRange: block.turnRange,
        title: block.virtual && block.messages.length !== source.l5Raw.length
          ? block.messages.find(({ role }) => role === 'user')?.content.replace(/\s+/g, ' ').trim().slice(0, 80) || '旧会话片段'
          : source.l0Title,
        tags: source.l0Tags,
        summary: source.l1Summary,
        keypoints: source.l2Keypoints,
        currentLevel,
        distanceFromLatest: Math.max(0, latestBlockPosition - blockPosition),
        expansionSource: source.lastLiftedAt ? source.lastLiftedBy ?? 'legacy' : null,
        lastLiftedAt: source.lastLiftedAt,
        sourceMessages: block.messages.length,
        createdAt: source.createdAt,
        virtual: block.virtual,
        status,
        eventExtraction: extraction ? {
          status: extraction.status,
          attempts: extraction.attempts,
          updatedAt: extraction.updatedAt,
          lastError: extraction.lastError,
        } : null,
        graphProjection: projections.length ? {
          status: failedProjection ? 'failed' : pendingProjection ? 'processing' : 'completed',
          jobs: projections.length,
          lastError: failedProjection?.lastError ?? null,
        } : null,
        relatedEvents: relatedEvents.map(eventSummary),
        relatedNodes,
      }
    })
    const filtered = values.filter((value) => matchesQuery(value, query))
    const latestSealedTurn = scopedBlocks.reduce((latest, block) => Math.max(latest, block.turnRange[1]), 0)
    const openMessages = activeThreadId
      ? recovered.openMessages.filter((message) => message.threadId === activeThreadId).map(({ message }) => message)
      : []
    const openTurns = openMessages.filter(({ role }) => role === 'user').length
    return {
      namespace,
      kind,
      total: filtered.length,
      offset,
      limit,
      items: filtered.slice(offset, offset + limit),
      openBlock: {
        turnRange: openTurns > 0 ? [latestSealedTurn + 1, latestSealedTurn + openTurns] : null,
        messages: openMessages.length,
        status: 'open',
      },
      conversations,
      activeThreadId,
    }
  }
  else throw new AdminHttpError(400, `Unsupported memory kind: ${kind}`)
  const filtered = values.filter((value) => matchesQuery(value, query))
  return { namespace, kind, total: filtered.length, offset, limit, items: filtered.slice(offset, offset + limit) }
}

async function sources(runtime: StrataGateRuntime, url: URL): Promise<unknown> {
  const namespace = url.searchParams.get('namespace')?.trim() ?? ''
  if (!namespace) throw new AdminHttpError(400, 'namespace is required')
  const snapshot = await requiredSnapshot(runtime, namespace)
  const eventId = url.searchParams.get('eventId')
  const nodeId = url.searchParams.get('nodeId')
  const elementId = url.searchParams.get('elementId')
  const blockId = url.searchParams.get('blockId')
  let events: EventCard[] = []
  let elements: ElementCard[] = []
  let ids = new Set<string>()
  if (eventId) {
    const event = snapshot.events.find(({ id }) => id === eventId)
    if (!event) throw new AdminHttpError(404, `Unknown event: ${eventId}`)
    events = [event]
    ids = new Set(event.sourceMessageIds)
  } else if (nodeId) {
    const node = snapshot.graphNodes.find(({ id }) => id === nodeId)
    if (!node) throw new AdminHttpError(404, `Unknown graph node: ${nodeId}`)
    events = snapshot.events.filter(({ id }) => node.sourceEventIds.includes(id))
    ids = new Set(events.flatMap(({ sourceMessageIds }) => sourceMessageIds))
    return {
      namespace,
      node,
      edges: snapshot.graphEdges.filter(({ fromNodeId, toNodeId }) => fromNodeId === node.id || toNodeId === node.id),
      events: events.map(eventSummary),
      messages: sourceMessages(snapshot, ids),
    }
  } else if (elementId) {
    const element = snapshot.elements.find(({ id }) => id === elementId)
    if (!element) throw new AdminHttpError(404, `Unknown element: ${elementId}`)
    elements = [element]
    events = snapshot.events.filter(({ id }) => element.sourceEventIds.includes(id))
    ids = new Set(events.flatMap(({ sourceMessageIds }) => sourceMessageIds))
  } else if (blockId) {
    const displayBlock = recoverSnapshotView(snapshot).blocks.find(({ id }) => id === blockId)
    const block = displayBlock?.source ?? snapshot.blocks.find(({ id }) => id === blockId)
    if (!block) throw new AdminHttpError(404, `Unknown block: ${blockId}`)
    const messages = displayBlock?.messages ?? block.l5Raw
    ids = new Set(messages.map(({ id }) => id))
    events = snapshot.events.filter((event) => event.sourceBlockId === block.id
      && (!displayBlock?.virtual || event.sourceMessageIds.some((id) => ids.has(id))))
    const eventIds = new Set(events.map(({ id }) => id))
    elements = snapshot.elements.filter(({ sourceEventIds }) => sourceEventIds.some((id) => eventIds.has(id)))
    return {
      namespace,
      events: events.map(eventSummary),
      elements: elements.map(elementSummary),
      messages: sourceMessages(snapshot, ids),
      layers: displayBlock ? virtualBlockLayers(displayBlock) : blockLayers(block),
      virtual: displayBlock?.virtual ?? false,
    }
  } else {
    throw new AdminHttpError(400, 'eventId, nodeId, elementId, or blockId is required')
  }
  return {
    namespace,
    events: events.map(eventSummary),
    elements: elements.map(elementSummary),
    blocks: events.map((event) => snapshot.blocks.find(({ id }) => id === event.sourceBlockId))
      .filter((block): block is MemoryBlock => Boolean(block))
      .map((block) => ({ id: block.id, title: block.l0Title, createdAt: block.createdAt })),
    messages: sourceMessages(snapshot, ids),
  }
}

async function expandBlock(runtime: StrataGateRuntime, url: URL): Promise<unknown> {
  const namespace = url.searchParams.get('namespace')?.trim() ?? ''
  const blockId = url.searchParams.get('blockId')?.trim() ?? ''
  const target = url.searchParams.get('level')?.trim() ?? ''
  if (!namespace) throw new AdminHttpError(400, 'namespace is required')
  if (!blockId) throw new AdminHttpError(400, 'blockId is required')
  if (blockId.startsWith('virtual:')) throw new AdminHttpError(409, 'Recovered legacy fragments are read-only display data')
  if (!/^L?[0-5]$/i.test(target)) throw new AdminHttpError(400, 'level must be L0 through L5')
  return runtime.adminExpandBlock(namespace, blockId, target)
}

function receiptSources(snapshot: StrataGateSnapshot, receipt: UsageReceipt): unknown {
  const events = snapshot.events.filter(({ id }) => receipt.eventIds.includes(id))
  const elements = snapshot.elements.filter(({ id }) => receipt.elementIds.includes(id))
  const eventIds = new Set([...receipt.eventIds, ...elements.flatMap(({ sourceEventIds }) => sourceEventIds)])
  const supportingEvents = snapshot.events.filter(({ id }) => eventIds.has(id))
  const messageIds = new Set(supportingEvents.flatMap(({ sourceMessageIds }) => sourceMessageIds))
  return {
    ...receipt,
    events: events.map(eventSummary),
    elements: elements.map(elementSummary),
    sourceMessages: sourceMessages(snapshot, messageIds),
  }
}

async function audit(runtime: StrataGateRuntime, url: URL): Promise<unknown> {
  const namespace = url.searchParams.get('namespace')?.trim() ?? ''
  if (!namespace) throw new AdminHttpError(400, 'namespace is required')
  const snapshot = await requiredSnapshot(runtime, namespace)
  const offset = numeric(url.searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
  const limit = numeric(url.searchParams.get('limit'), 50, 1, 100)
  const receipts = [...snapshot.usageReceipts].reverse()
  return {
    namespace,
    total: receipts.length,
    offset,
    limit,
    items: receipts.slice(offset, offset + limit).map((receipt) => receiptSources(snapshot, receipt)),
  }
}

export async function handleAdminRequest(runtime: StrataGateRuntime, req: WebRequest, res: WebResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.replace(/\/$/, '')
    if (path === '/api/stratagate/settings') {
      if (req.method !== 'PATCH') throw new AdminHttpError(405, 'StrataGate settings require PATCH')
      sendJson(res, 200, await updateSettings(runtime, url))
    } else if (path === '/api/stratagate/blocks/expand') {
      if (req.method !== 'PATCH') throw new AdminHttpError(405, 'StrataGate Block expansion requires PATCH')
      sendJson(res, 200, await expandBlock(runtime, url))
    } else if (path === '/api/stratagate/import') {
      if (req.method === 'GET') sendJson(res, 200, externalMemoryPrompt())
      else if (req.method === 'POST') sendJson(res, 200, await importExternalMemory(runtime, req))
      else throw new AdminHttpError(405, 'External memory import requires GET or POST')
    } else if (req.method !== 'GET') throw new AdminHttpError(405, 'StrataGate memory data is read-only')
    else if (path === '/api/stratagate/overview') sendJson(res, 200, await overview(runtime))
    else if (path === '/api/stratagate/memories') sendJson(res, 200, await memories(runtime, url))
    else if (path === '/api/stratagate/sources') sendJson(res, 200, await sources(runtime, url))
    else if (path === '/api/stratagate/audit') sendJson(res, 200, await audit(runtime, url))
    else throw new AdminHttpError(404, 'Unknown StrataGate admin route')
  } catch (error) {
    const status = error instanceof AdminHttpError ? error.status : 500
    const message = error instanceof Error ? error.message : String(error)
    sendJson(res, status, { error: message })
  }
}

export function registerAdminRoutes(ctx: Context, runtime: StrataGateRuntime): (() => void) | undefined {
  const webServer = ctx.get('webServer') as WebServerLike | undefined
  if (!webServer) return undefined
  return webServer.register({
    kind: 'prefix',
    path: '/api/stratagate',
    handler: (req, res) => handleAdminRequest(runtime, req, res),
  })
}
