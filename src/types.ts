export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolTrace {
  name: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
}

export interface RawMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  toolCalls?: ToolTrace[];
}

export type BlockLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface BlockLayers {
  l0Title: string;
  l0Tags: string[];
  l1Summary: string;
  l2Keypoints: string[];
  l3Condensed: string;
  l4Readable: string;
  l5Raw: RawMessage[];
}

export interface MemoryBlock extends BlockLayers {
  id: string;
  sequence: number;
  startTurn: number;
  endTurn: number;
  createdAt: string;
  shouldExtract: boolean;
  pointerCurrentLevel: BlockLevel;
  pointerAnchorLevel: BlockLevel;
  pointerAnchorTurn: number;
  lastLiftedAt: string | null;
}

export interface BlockSummary {
  l0Title: string;
  l0Tags: string[];
  l1Summary: string;
  l2Keypoints: string[];
  shouldExtract: boolean;
}

export type BlockSummarizer = (messages: readonly RawMessage[]) => Promise<BlockSummary>;

export type MemoryScope = 'user' | 'project' | 'session';
export type MemoryCriticality = 'routine' | 'preference' | 'identity' | 'safety';
export type MemoryStatus = 'active' | 'superseded' | 'forgotten' | 'archived';

export interface EventTemporal {
  mentionedAt?: string;
  happenedStart?: string;
  happenedEnd?: string;
  originalText?: string;
  precision?: 'instant' | 'day' | 'month' | 'year' | 'range' | 'unknown';
  basis?: 'explicit' | 'relative' | 'inferred' | 'unknown';
  status?: 'occurred' | 'planned' | 'cancelled' | 'ongoing' | 'unknown';
  participants?: string[];
  eventType?: string;
  threadId?: string;
  sameEventId?: string;
  beforeEventIds?: string[];
  afterEventIds?: string[];
  supersedesEventIds?: string[];
  conflictsWithEventIds?: string[];
}

export interface MemoryWeight {
  mentionCount: number;
  lastAdoptedTurn: number;
  lastRetrievedAt: string | null;
  pinned: boolean;
  floorWeight: number;
  forcedCap: number | null;
}

export interface EventCardInput {
  id?: string;
  title: string;
  summary: string;
  narrative?: string;
  tags?: string[];
  quotes?: string[];
  sourceMessageIds: string[];
  sourceBlockId: string;
  temporal?: EventTemporal;
  scope?: MemoryScope;
  criticality?: MemoryCriticality;
  confidence?: number;
}

export interface EventCard extends Omit<EventCardInput, 'id'> {
  id: string;
  narrative: string;
  tags: string[];
  quotes: string[];
  temporal: EventTemporal;
  scope: MemoryScope;
  criticality: MemoryCriticality;
  confidence: number;
  status: MemoryStatus;
  supersededBy: string | null;
  weight: MemoryWeight;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionContext {
  previous: MemoryBlock | null;
  target: MemoryBlock;
  next: MemoryBlock;
  timeline: Array<Pick<EventCard, 'id' | 'title' | 'temporal'>>;
}

export interface ExtractionResult {
  shouldExtract: boolean;
  reason: string;
  events: EventCardInput[];
}

export type EventExtractor = (context: ExtractionContext) => Promise<ExtractionResult>;

export interface SearchOptions {
  limit?: number;
  temporalIntent?: boolean;
  participants?: string[];
  eventType?: string;
}

export interface EventSearchResult {
  event: EventCard;
  score: number;
}

export interface RawSearchHit {
  blockId: string;
  turnRange: [number, number];
  message: RawMessage;
  nearby: RawMessage[];
}

export interface AppendTurnResult {
  sealedBlock: MemoryBlock | null;
  extractedEvents: EventCard[];
}
