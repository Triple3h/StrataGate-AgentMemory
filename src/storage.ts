import { BLOCK_DECAY_LAMBDA } from './blocks.js';
import { normalizeStandardEventType } from './events.js';
import type { ElementCard, EventCard, GraphEdge, GraphNode, MemoryBlock, RawMessage } from './types.js';

export const STRATAGATE_STORAGE_SCHEMA_VERSION = 8;
export const KNOWLEDGE_GRAPH_PROJECTOR_VERSION = 1;

export type ExtractionJobStatus = 'running' | 'succeeded' | 'skipped' | 'failed';

export interface ExtractionJob {
  blockId: string;
  status: ExtractionJobStatus;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
}

export type SuccessfulModelResponseKind = 'summarizer' | 'extractor' | 'projector' | 'graphProjector';

export interface SuccessfulModelResponse {
  id: string;
  kind: SuccessfulModelResponseKind;
  response: string;
  createdAt: string;
}

export type ElementProjectionJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ElementProjectionJob {
  id: string;
  sourceEventIds: string[];
  status: ElementProjectionJobStatus;
  attempts: number;
  elementIds: string[];
  reason: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type GraphProjectionJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface GraphProjectionJob {
  id: string;
  sourceEventIds: string[];
  projectorVersion: number;
  status: GraphProjectionJobStatus;
  attempts: number;
  priority: number;
  nodeIds: string[];
  edgeIds: string[];
  reason: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsageReceipt {
  id: string;
  eventIds: string[];
  elementIds: string[];
  audit?: UsageAudit;
  createdAt: string;
}

export interface UsageAudit {
  sessionId?: string;
  turn?: number;
  batchId?: string;
  evidenceRefs?: string[];
  verdict?: 'sufficient' | 'partial' | 'wrong';
  fit?: string;
  missing?: string;
  nextStrategy?: string;
}

export interface IngestionReceipt {
  id: string;
  createdAt: string;
}

export interface StrataGateSnapshot {
  schemaVersion: typeof STRATAGATE_STORAGE_SCHEMA_VERSION;
  currentTurn: number;
  blockTurnSize: number;
  blockDecayLambda: number;
  openTail: RawMessage[];
  blocks: MemoryBlock[];
  events: EventCard[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  graphProjectionJobs: GraphProjectionJob[];
  elements: ElementCard[];
  extractionJobs: ExtractionJob[];
  elementProjectionJobs: ElementProjectionJob[];
  usageReceipts: UsageReceipt[];
  ingestionReceipts: IngestionReceipt[];
  successfulModelResponses?: SuccessfulModelResponse[];
}

export interface LoadedStrataGateState {
  snapshot: StrataGateSnapshot;
  revision: number;
}

export interface StorageAdapter {
  load(namespace: string): Promise<LoadedStrataGateState | null>;
  save(namespace: string, snapshot: StrataGateSnapshot, expectedRevision: number): Promise<number>;
  close?(): Promise<void>;
}

export class StorageConflictError extends Error {
  constructor(
    readonly namespace: string,
    readonly expectedRevision: number,
    readonly actualRevision: number | null,
  ) {
    super(`Storage revision conflict for ${namespace}: expected ${expectedRevision}, found ${actualRevision ?? 'missing'}`);
    this.name = 'StorageConflictError';
  }
}

export function cloneSnapshot(snapshot: StrataGateSnapshot): StrataGateSnapshot {
  return structuredClone(snapshot);
}

type LegacyMemoryBlock = Omit<MemoryBlock, 'pointerAnchorBlockPosition' | 'lastLiftedBy'> & { pointerAnchorTurn: number };
type LegacySnapshotBase = Omit<StrataGateSnapshot, 'schemaVersion' | 'blockDecayLambda' | 'blocks'> & {
  blocks: LegacyMemoryBlock[];
};

interface LegacySnapshotV1 extends Omit<LegacySnapshotBase, 'elements' | 'elementProjectionJobs' | 'usageReceipts' | 'ingestionReceipts'> {
  schemaVersion: 1;
  usageReceipts: Array<Omit<UsageReceipt, 'elementIds'>>;
}

interface LegacySnapshotV2 extends Omit<LegacySnapshotBase, 'ingestionReceipts'> {
  schemaVersion: 2;
}

interface LegacySnapshotV3 extends Omit<LegacySnapshotBase, 'usageReceipts'> {
  schemaVersion: 3;
  usageReceipts: Array<Omit<UsageReceipt, 'audit'>>;
}

interface LegacySnapshotV4 extends LegacySnapshotBase {
  schemaVersion: 4;
}

interface LegacySnapshotV5 extends LegacySnapshotBase {
  schemaVersion: 5;
}

interface LegacySnapshotV6 extends Omit<StrataGateSnapshot, 'schemaVersion' | 'blocks'> {
  schemaVersion: 6;
  blocks: Array<Omit<MemoryBlock, 'lastLiftedBy'>>;
}

interface LegacySnapshotV7 extends Omit<StrataGateSnapshot, 'schemaVersion' | 'graphNodes' | 'graphEdges' | 'graphProjectionJobs'> {
  schemaVersion: 7;
}

function emptyGraph(): { graphNodes: GraphNode[]; graphEdges: GraphEdge[]; graphProjectionJobs: GraphProjectionJob[] } {
  return { graphNodes: [], graphEdges: [], graphProjectionJobs: [] };
}

function migrateLegacyBlocks(blocks: readonly LegacyMemoryBlock[]): MemoryBlock[] {
  return blocks.map((block) => {
    const { pointerAnchorTurn, ...current } = block;
    const position = blocks.filter((candidate) =>
      candidate.threadId === block.threadId && candidate.endTurn <= pointerAnchorTurn).length;
    return { ...current, pointerAnchorBlockPosition: Math.max(1, position), lastLiftedBy: null };
  });
}

export function normalizeSnapshot(value: unknown): StrataGateSnapshot {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid StrataGate snapshot: expected an object');
  const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
  let snapshot: StrataGateSnapshot;
  if (schemaVersion === 1) {
    const legacy = value as LegacySnapshotV1;
    snapshot = {
      ...structuredClone(legacy),
      schemaVersion: STRATAGATE_STORAGE_SCHEMA_VERSION,
      blockDecayLambda: BLOCK_DECAY_LAMBDA,
      blocks: migrateLegacyBlocks(legacy.blocks),
      elements: [],
      elementProjectionJobs: [],
      usageReceipts: Array.isArray(legacy.usageReceipts)
        ? legacy.usageReceipts.map((receipt) => ({ ...receipt, elementIds: [] }))
        : [],
      ingestionReceipts: [],
      ...emptyGraph(),
    };
  } else if (schemaVersion === 2) {
    const legacy = value as LegacySnapshotV2;
    snapshot = {
      ...structuredClone(legacy),
      schemaVersion: STRATAGATE_STORAGE_SCHEMA_VERSION,
      blockDecayLambda: BLOCK_DECAY_LAMBDA,
      blocks: migrateLegacyBlocks(legacy.blocks),
      ingestionReceipts: [],
      ...emptyGraph(),
    };
  } else if (schemaVersion === 3) {
    const legacy = value as LegacySnapshotV3;
    snapshot = {
      ...structuredClone(legacy),
      schemaVersion: STRATAGATE_STORAGE_SCHEMA_VERSION,
      blockDecayLambda: BLOCK_DECAY_LAMBDA,
      blocks: migrateLegacyBlocks(legacy.blocks),
      ...emptyGraph(),
    };
  } else if (schemaVersion === 4) {
    const legacy = value as LegacySnapshotV4;
    snapshot = {
      ...structuredClone(legacy),
      schemaVersion: STRATAGATE_STORAGE_SCHEMA_VERSION,
      blockDecayLambda: BLOCK_DECAY_LAMBDA,
      blocks: migrateLegacyBlocks(legacy.blocks),
      ...emptyGraph(),
    };
  } else if (schemaVersion === 5) {
    const legacy = value as LegacySnapshotV5;
    snapshot = {
      ...structuredClone(legacy),
      schemaVersion: STRATAGATE_STORAGE_SCHEMA_VERSION,
      blockDecayLambda: BLOCK_DECAY_LAMBDA,
      blocks: migrateLegacyBlocks(legacy.blocks),
      ...emptyGraph(),
    };
  } else if (schemaVersion === 6) {
    const legacy = value as LegacySnapshotV6;
    snapshot = {
      ...structuredClone(legacy),
      schemaVersion: STRATAGATE_STORAGE_SCHEMA_VERSION,
      blocks: legacy.blocks.map((block) => ({ ...structuredClone(block), lastLiftedBy: null })),
      ...emptyGraph(),
    };
  } else if (schemaVersion === 7) {
    const legacy = value as LegacySnapshotV7;
    snapshot = { ...structuredClone(legacy), schemaVersion: STRATAGATE_STORAGE_SCHEMA_VERSION, ...emptyGraph() };
  } else if (schemaVersion === STRATAGATE_STORAGE_SCHEMA_VERSION) {
    snapshot = structuredClone(value) as StrataGateSnapshot;
  } else {
    throw new TypeError(`Unsupported StrataGate snapshot schema: ${String(schemaVersion)}`);
  }
  if (!Number.isSafeInteger(snapshot.currentTurn) || (snapshot.currentTurn ?? -1) < 0) {
    throw new TypeError('Invalid StrataGate snapshot: currentTurn must be a non-negative integer');
  }
  if (!Number.isSafeInteger(snapshot.blockTurnSize) || (snapshot.blockTurnSize ?? 0) < 1) {
    throw new TypeError('Invalid StrataGate snapshot: blockTurnSize must be a positive integer');
  }
  if (!Number.isFinite(snapshot.blockDecayLambda) || snapshot.blockDecayLambda < 0) {
    throw new TypeError('Invalid StrataGate snapshot: blockDecayLambda must be a non-negative finite number');
  }
  for (const key of ['openTail', 'blocks', 'events', 'graphNodes', 'graphEdges', 'graphProjectionJobs', 'elements', 'extractionJobs', 'elementProjectionJobs', 'usageReceipts', 'ingestionReceipts'] as const) {
    if (!Array.isArray(snapshot[key])) throw new TypeError(`Invalid StrataGate snapshot: ${key} must be an array`);
  }
  if (!Array.isArray(snapshot.successfulModelResponses)) snapshot.successfulModelResponses = [];
  for (const event of snapshot.events) {
    event.temporal = { ...event.temporal, eventType: normalizeStandardEventType(event.temporal.eventType) };
  }
  for (const block of snapshot.blocks) {
    if (!Number.isSafeInteger(block.pointerAnchorBlockPosition) || block.pointerAnchorBlockPosition < 1) {
      throw new TypeError('Invalid StrataGate snapshot: pointerAnchorBlockPosition must be a positive integer');
    }
    if (block.lastLiftedBy !== null && block.lastLiftedBy !== 'user' && block.lastLiftedBy !== 'agent') {
      throw new TypeError('Invalid StrataGate snapshot: lastLiftedBy must be user, agent, or null');
    }
  }
  if (snapshot.successfulModelResponses.length > 5) {
    snapshot.successfulModelResponses = snapshot.successfulModelResponses.slice(-5);
  }
  return snapshot;
}

export function assertValidSnapshot(value: unknown): asserts value is StrataGateSnapshot {
  normalizeSnapshot(value);
}
