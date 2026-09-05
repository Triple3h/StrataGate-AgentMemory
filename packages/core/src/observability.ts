import { randomUUID } from 'node:crypto';

/** Version of the line-oriented observation contract. */
export const OBSERVABILITY_SCHEMA_VERSION = 1;

export type ObservationOperation =
  | 'append_turn'
  | 'resume_pending'
  | 'retrieval'
  | 'assessment'
  | 'record_use'
  | 'mcp'
  | 'derivation'
  | 'storage_conflict'
  | 'error';

export type ObservationOutcome = 'ok' | 'empty' | 'duplicate' | 'rejected' | 'error';

/**
 * A deliberately flat, JSON-friendly record. Empty strings mean that an ID is
 * not applicable to the operation; keeping the keys present makes JSONL and
 * SQL aggregation predictable across adapters.
 */
export interface ObservabilityEvent {
  schema_version: number;
  emitted_at: string;
  operation: ObservationOperation;
  outcome: ObservationOutcome;
  duration_ms: number;
  request_id: string;
  batch_id: string;
  assessment_id: string;
  receipt_id: string;
  namespace: string;
  user_id: string;
  agent_id: string;
  conversation_id: string;
  source_adapter: string;
  storage_revision: number;
  attributes: Record<string, string | number | boolean>;
}

export type ObservabilitySink = (event: ObservabilityEvent) => void;

export interface ObservationContext {
  requestId?: string | undefined;
  batchId?: string | undefined;
  assessmentId?: string | undefined;
  receiptId?: string | undefined;
  namespace?: string | undefined;
  userId?: string | undefined;
  agentId?: string | undefined;
  conversationId?: string | undefined;
  sourceAdapter?: string | undefined;
  storageRevision?: number | undefined;
}

export interface ObservationMetrics {
  total: number;
  byOperation: Record<string, number>;
  byOutcome: Record<string, number>;
  latencyMs: { count: number; p50: number; p95: number; max: number };
  retrieval: { requests: number; empty: number; p95Ms: number };
  mcp: { requests: number; p95Ms: number };
  derivation: { requests: number; failures: number; p95Ms: number };
  evidenceGate: { assessments: number; sufficient: number; rejected: number; rejectionRate: number };
  usage: { attempts: number; duplicates: number; rejected: number };
  failOpen: { errors: number; rate: number };
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 512) : '';
}

function finiteNonNegative(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function createObservation(
  operation: ObservationOperation,
  outcome: ObservationOutcome,
  context: ObservationContext = {},
  durationMs = 0,
  attributes: Record<string, string | number | boolean> = {},
  emittedAt = new Date().toISOString(),
): ObservabilityEvent {
  return {
    schema_version: OBSERVABILITY_SCHEMA_VERSION,
    emitted_at: emittedAt,
    operation,
    outcome,
    duration_ms: finiteNonNegative(durationMs),
    request_id: clean(context.requestId) || `req_${randomUUID()}`,
    batch_id: clean(context.batchId),
    assessment_id: clean(context.assessmentId),
    receipt_id: clean(context.receiptId),
    namespace: clean(context.namespace),
    user_id: clean(context.userId),
    agent_id: clean(context.agentId),
    conversation_id: clean(context.conversationId),
    source_adapter: clean(context.sourceAdapter),
    storage_revision: typeof context.storageRevision === 'number' && Number.isSafeInteger(context.storageRevision)
      ? Math.max(0, context.storageRevision)
      : 0,
    attributes: { ...attributes },
  };
}

export function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[rank] ?? 0;
}

/** In-process collector used by hosts and benchmark harnesses. */
export class ObservabilityCollector {
  private readonly records: ObservabilityEvent[] = [];

  readonly sink: ObservabilitySink = (event) => this.record(event);

  record(event: ObservabilityEvent): void {
    this.records.push(structuredClone(event));
  }

  events(): readonly ObservabilityEvent[] {
    return this.records.map((event) => structuredClone(event));
  }

  clear(): void {
    this.records.length = 0;
  }

  metrics(): ObservationMetrics {
    const byOperation: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const durations: number[] = [];
    for (const event of this.records) {
      byOperation[event.operation] = (byOperation[event.operation] ?? 0) + 1;
      byOutcome[event.outcome] = (byOutcome[event.outcome] ?? 0) + 1;
      durations.push(event.duration_ms);
    }
    const retrieval = this.records.filter((event) => event.operation === 'retrieval');
    const assessments = this.records.filter((event) => event.operation === 'assessment');
    const usage = this.records.filter((event) => event.operation === 'record_use');
    const mcp = this.records.filter((event) => event.operation === 'mcp');
    const derivation = this.records.filter((event) => event.operation === 'derivation');
    const errors = this.records.filter((event) => event.outcome === 'error' || event.operation === 'error').length;
    const rejectedAssessments = assessments.filter((event) => event.outcome === 'rejected'
      || Number(event.attributes.rejected_evidence_count ?? 0) > 0).length;
    return {
      total: this.records.length,
      byOperation,
      byOutcome,
      latencyMs: {
        count: durations.length,
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
        max: durations.length ? Math.max(...durations) : 0,
      },
      retrieval: {
        requests: retrieval.length,
        empty: retrieval.filter((event) => event.outcome === 'empty').length,
        p95Ms: percentile(retrieval.map((event) => event.duration_ms), 95),
      },
      mcp: { requests: mcp.length, p95Ms: percentile(mcp.map((event) => event.duration_ms), 95) },
      derivation: {
        requests: derivation.length,
        failures: derivation.filter((event) => event.outcome === 'error').length,
        p95Ms: percentile(derivation.map((event) => event.duration_ms), 95),
      },
      evidenceGate: {
        assessments: assessments.length,
        sufficient: assessments.filter((event) => event.attributes.verdict === 'sufficient').length,
        rejected: rejectedAssessments,
        rejectionRate: assessments.length ? rejectedAssessments / assessments.length : 0,
      },
      usage: {
        attempts: usage.length,
        duplicates: usage.filter((event) => event.outcome === 'duplicate').length,
        rejected: usage.filter((event) => event.outcome === 'rejected').length,
      },
      failOpen: { errors, rate: this.records.length ? errors / this.records.length : 0 },
    };
  }

  toJSONL(): string {
    return this.records.map((event) => JSON.stringify(event)).join('\n') + (this.records.length ? '\n' : '');
  }
}

export function observe(
  sink: ObservabilitySink | undefined,
  operation: ObservationOperation,
  outcome: ObservationOutcome,
  context: ObservationContext,
  startedAt: number,
  attributes: Record<string, string | number | boolean> = {},
): ObservabilityEvent | undefined {
  if (!sink) return undefined;
  const event = createObservation(operation, outcome, context, Math.max(0, Date.now() - startedAt), attributes);
  try {
    sink(event);
  } catch {
    // Observability must never block the host or memory write path.
  }
  return event;
}
