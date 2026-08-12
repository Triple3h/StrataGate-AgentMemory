import type { EventCard, MemoryBlock, RawMessage } from './types.js';

export const STRATAGATE_STORAGE_SCHEMA_VERSION = 1;

export type ExtractionJobStatus = 'running' | 'succeeded' | 'skipped' | 'failed';

export interface ExtractionJob {
  blockId: string;
  status: ExtractionJobStatus;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
}

export interface UsageReceipt {
  id: string;
  eventIds: string[];
  createdAt: string;
}

export interface StrataGateSnapshot {
  schemaVersion: typeof STRATAGATE_STORAGE_SCHEMA_VERSION;
  currentTurn: number;
  blockTurnSize: number;
  openTail: RawMessage[];
  blocks: MemoryBlock[];
  events: EventCard[];
  extractionJobs: ExtractionJob[];
  usageReceipts: UsageReceipt[];
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

export function assertValidSnapshot(value: unknown): asserts value is StrataGateSnapshot {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid StrataGate snapshot: expected an object');
  const snapshot = value as Partial<StrataGateSnapshot>;
  if (snapshot.schemaVersion !== STRATAGATE_STORAGE_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported StrataGate snapshot schema: ${String(snapshot.schemaVersion)}`);
  }
  if (!Number.isSafeInteger(snapshot.currentTurn) || (snapshot.currentTurn ?? -1) < 0) {
    throw new TypeError('Invalid StrataGate snapshot: currentTurn must be a non-negative integer');
  }
  if (!Number.isSafeInteger(snapshot.blockTurnSize) || (snapshot.blockTurnSize ?? 0) < 1) {
    throw new TypeError('Invalid StrataGate snapshot: blockTurnSize must be a positive integer');
  }
  for (const key of ['openTail', 'blocks', 'events', 'extractionJobs', 'usageReceipts'] as const) {
    if (!Array.isArray(snapshot[key])) throw new TypeError(`Invalid StrataGate snapshot: ${key} must be an array`);
  }
}
