/** Read-only projections of the gateway API payloads the console consumes. */

export interface L5Message {
  id: string
  role: string
  content: string
  createdAt: string
  sourceAdapter?: string
  agentId?: string
  conversationId?: string
  threadId?: string
  [key: string]: unknown
}

export interface MemoryBlock {
  sequence?: number
  startTurn?: number
  endTurn?: number
  createdAt?: string
  processingStatus?: string
  l0Title?: string
  l1Summary?: string
  l2Keypoints?: string[]
  l3Condensed?: string
  l4Readable?: string
  l5Raw?: L5Message[]
  [key: string]: unknown
}

export interface SessionRow {
  id: string
  messages: L5Message[]
  last: string
  title: string
}

export interface SnapshotIdentity {
  projectName?: string
  projectId?: string
  userId?: string
  [key: string]: unknown
}

export interface TemporalInfo {
  eventType?: string
  status?: string
  [key: string]: unknown
}

export interface MemoryEvent {
  id: string
  title?: string
  summary?: string
  narrative?: string
  type?: string
  status?: string
  temporal?: TemporalInfo
  sourceMessageIds?: string[]
  sourceEventIds?: string[]
  [key: string]: unknown
}

export interface MemoryElement {
  id: string
  name?: string
  title?: string
  summary?: string
  currentState?: string
  type?: string
  status?: string
  [key: string]: unknown
}

export interface GraphNodeRow {
  id: string
  name?: string
  title?: string
  currentState?: string
  type?: string
  status?: string
  sourceEventIds?: string[]
  [key: string]: unknown
}

export interface GraphEdgeRow {
  [key: string]: unknown
}

export interface JobRow {
  id?: string
  blockId?: string
  status?: string
  updatedAt?: string
  lastError?: string
  [key: string]: unknown
}

export interface UsageReceipt {
  id: string
  createdAt?: string
  eventIds?: string[]
  elementIds?: string[]
  audit?: unknown
  [key: string]: unknown
}

export interface ConsoleSnapshot {
  identity?: SnapshotIdentity
  currentTurn?: number
  openTail?: L5Message[]
  blocks?: MemoryBlock[]
  events?: MemoryEvent[]
  elements?: MemoryElement[]
  graphNodes?: GraphNodeRow[]
  graphEdges?: GraphEdgeRow[]
  usageReceipts?: UsageReceipt[]
  summaryJobs?: JobRow[]
  extractionJobs?: JobRow[]
  elementProjectionJobs?: JobRow[]
  graphProjectionJobs?: JobRow[]
  blockTurnSize?: number
  blockDecayLambda?: number
  [key: string]: unknown
}

export interface NamespaceRow {
  namespace: string
  label?: string
  projectName?: string | null
  userId?: string
  agents?: string[]
  sourceAdapters?: string[]
  turns?: number
  openTailMessages?: number
  blocks?: number
  events?: number
  elements?: number
  graphNodes?: number
  graphEdges?: number
  usageReceipts?: number
  processingJobs?: number
  revision?: number
  lastActivityAt?: string | null
  [key: string]: unknown
}

export interface Dashboard {
  status?: string
  database?: string
  generatedAt?: string
  namespaces: NamespaceRow[]
  [key: string]: unknown
}

export type DetailKind = 'events' | 'elements' | 'graph'
export type DetailRow = MemoryEvent | MemoryElement | GraphNodeRow
