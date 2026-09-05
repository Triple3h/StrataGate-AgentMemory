import type { EvidenceTarget } from './state.js'

export interface EvidenceItem {
  ref: string
  kind: 'event' | 'element' | 'raw' | 'tail' | 'block'
  id?: string
  blockId?: string
  messageId?: string
  type?: string
  title: string
  content: string
  summary?: string
  currentState?: string
  rankScore?: number
  confidence?: number
  effectiveConfidence?: number
  scoreMeaning?: string
  matchedFields?: string[]
  matchReason?: string
  turnRange?: [number, number]
  sourceTime?: string
  target: EvidenceTarget
  threadId?: string
}
export type BlockQueryScope = 'session' | 'namespace'
export type BlockEmptyReason = 'no_blocks_in_namespace' | 'blocks_exist_in_other_threads' | 'open_tail_pending'
export interface BatchResult {
  batchId: string
  evidenceRefs: string[]
  results: EvidenceItem[]
  scope?: BlockQueryScope
  namespace?: string
  threadId?: string
  blockCount?: number
  namespaceBlockCount?: number
  namespaceThreadIds?: string[]
  openTailCount?: number
  emptyReason?: BlockEmptyReason | null
}
export interface RecordUseResult {
  recorded: true
  eventIds: string[]
  elementIds: string[]
  starPrompt?: { usageRecords: number; repositoryUrl: string }
}
