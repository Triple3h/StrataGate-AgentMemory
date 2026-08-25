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
  threadId?: string;
  toolCalls?: ToolTrace[];
}

export type BlockLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type BlockLiftSource = 'user' | 'agent';

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
  threadId?: string;
  sequence: number;
  startTurn: number;
  endTurn: number;
  createdAt: string;
  shouldExtract: boolean;
  pointerCurrentLevel: BlockLevel;
  pointerAnchorLevel: BlockLevel;
  pointerAnchorBlockPosition: number;
  lastLiftedAt: string | null;
  lastLiftedBy: BlockLiftSource | null;
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
  /** Stable references into the projected knowledge graph. */
  participantNodeIds?: string[];
  eventType?: string;
  threadId?: string;
  sameEventId?: string;
  beforeEventIds?: string[];
  afterEventIds?: string[];
  supersedesEventIds?: string[];
  conflictsWithEventIds?: string[];
  relatedEventIds?: string[];
}

/** Stable taxonomy used by extraction, filtering, projection, and statistics. */
export type StandardEventType =
  | 'decision'
  | 'release'
  | 'task_completed'
  | 'plan'
  | 'change'
  | 'cancellation'
  | 'incident'
  | 'meeting'
  | 'collaboration'
  | 'migration'
  | 'other';

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

export type MemoryElementType = 'person' | 'project' | 'organization' | 'tool' | 'place';
export type ElementFactMode = 'state' | 'set' | 'relation';
export type ElementFactStatus = 'active' | 'superseded' | 'disputed';
export type ElementProjectionOperation = 'set_state' | 'add_set_item' | 'set_relation';

export interface ElementFact {
  id: string;
  key: string;
  mode: ElementFactMode;
  value: string | string[];
  validFrom?: string;
  validTo?: string;
  sourceEventIds: string[];
  confidence?: number;
  status: ElementFactStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ElementCard {
  id: string;
  name: string;
  type: MemoryElementType;
  aliases: string[];
  currentState: string;
  facts: ElementFact[];
  sourceEventIds: string[];
  sourceMessageIds: string[];
  weight: MemoryWeight;
  createdAt: string;
  updatedAt: string;
}

export interface ElementProjectionChange {
  element: {
    name: string;
    type: MemoryElementType;
    aliases?: string[];
  };
  operation: ElementProjectionOperation;
  key: string;
  mode: ElementFactMode;
  value: string | string[];
  validFrom?: string;
  validTo?: string;
  sourceEventIds: string[];
  confidence?: number;
}

export interface ElementProjectionResult {
  reason: string;
  changes: ElementProjectionChange[];
}

export interface ElementProjectionContext {
  jobId: string;
  events: EventCard[];
  existingElements: ElementCard[];
}

export type ElementProjector = (context: ElementProjectionContext) => Promise<ElementProjectionResult>;

export type GraphNodeType = 'person' | 'project' | 'organization' | 'tool' | 'place';
export type GraphRecordStatus = 'active' | 'superseded' | 'disputed' | 'archived';

export interface GraphFact {
  id: string;
  key: string;
  value: string | string[];
  status: GraphRecordStatus;
  validFrom?: string;
  validTo?: string;
  confidence: number;
  sourceEventIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: GraphNodeType;
  aliases: string[];
  /** Optional semantic roles used for discovery and dynamic graph presentation. */
  tags?: string[];
  currentState: string;
  facts: GraphFact[];
  status: GraphRecordStatus;
  confidence: number;
  sourceEventIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: string;
  status: GraphRecordStatus;
  validFrom?: string;
  validTo?: string;
  confidence: number;
  sourceEventIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GraphNodeProjection {
  ref: string;
  name: string;
  type: GraphNodeType;
  aliases?: string[];
  /** Semantic roles are additive metadata and never replace the stable node type. */
  tags?: string[];
  state?: string;
  facts?: Array<{ key: string; value: string | string[]; sourceEventIds: string[] }>;
  status?: GraphRecordStatus;
  validFrom?: string;
  validTo?: string;
  confidence?: number;
  sourceEventIds: string[];
}

export interface GraphEdgeProjection {
  fromRef: string;
  toRef: string;
  relation: string;
  status?: GraphRecordStatus;
  validFrom?: string;
  validTo?: string;
  confidence?: number;
  sourceEventIds: string[];
}

export interface GraphProjectionResult {
  reason: string;
  nodes: GraphNodeProjection[];
  edges: GraphEdgeProjection[];
}

export interface GraphProjectionContext {
  jobId: string;
  projectorVersion: number;
  events: EventCard[];
  existingNodes: GraphNode[];
  existingEdges: GraphEdge[];
}

export type GraphProjector = (context: GraphProjectionContext) => Promise<GraphProjectionResult>;

export interface SearchOptions {
  limit?: number;
  temporalIntent?: boolean | 'first' | 'latest';
  participants?: string[];
  eventType?: string;
  happenedFrom?: string;
  happenedTo?: string;
}

export interface EventSearchResult {
  event: EventCard;
  score: number;
}

export interface ElementSearchOptions {
  limit?: number;
  name?: string;
  type?: MemoryElementType;
}

export interface ElementSearchResult {
  id: string;
  elementId: string;
  name: string;
  type: MemoryElementType;
  fact: ElementFact;
  score: number;
}

export interface GraphNodeSearchResult {
  node: GraphNode;
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
  projectedElements: ElementCard[];
}
