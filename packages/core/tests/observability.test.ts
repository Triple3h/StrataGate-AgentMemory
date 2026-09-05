import { describe, expect, it } from 'vitest';
import {
  ObservabilityCollector,
  createObservation,
  percentile,
} from '../src/observability.js';

describe('observability contract', () => {
  it('emits every required correlation field with stable defaults', () => {
    const event = createObservation('retrieval', 'ok', {
      requestId: 'req-1',
      batchId: 'batch-1',
      namespace: 'shared:user:u:scope:project:p',
      userId: 'u',
      agentId: 'agent-a',
      conversationId: 'conv-a',
      sourceAdapter: 'workbuddy',
      storageRevision: 4,
    }, 12, { kind: 'events', result_count: 2 });
    expect(event).toMatchObject({
      schema_version: 1,
      request_id: 'req-1',
      batch_id: 'batch-1',
      assessment_id: '',
      receipt_id: '',
      storage_revision: 4,
    });
    expect(Object.keys(event)).toEqual(expect.arrayContaining([
      'request_id', 'batch_id', 'assessment_id', 'receipt_id', 'namespace',
      'user_id', 'agent_id', 'conversation_id', 'source_adapter',
      'schema_version', 'storage_revision',
    ]));
  });

  it('aggregates P95, gate rejection, duplicate use, and fail-open rates', () => {
    const collector = new ObservabilityCollector();
    collector.record(createObservation('retrieval', 'ok', {}, 10));
    collector.record(createObservation('retrieval', 'empty', {}, 30));
    collector.record(createObservation('assessment', 'rejected', {}, 4, { verdict: 'partial', rejected_evidence_count: 1 }));
    collector.record(createObservation('assessment', 'ok', {}, 4, { verdict: 'sufficient', rejected_evidence_count: 0 }));
    collector.record(createObservation('record_use', 'duplicate', {}, 2));
    collector.record(createObservation('error', 'error', {}, 1));
    const metrics = collector.metrics();
    expect(metrics.retrieval).toMatchObject({ requests: 2, empty: 1, p95Ms: 30 });
    expect(metrics.evidenceGate).toMatchObject({ assessments: 2, sufficient: 1, rejected: 1, rejectionRate: 0.5 });
    expect(metrics.usage).toMatchObject({ attempts: 1, duplicates: 1 });
    expect(metrics.failOpen.errors).toBe(1);
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);
    expect(collector.toJSONL().split('\n').filter(Boolean)).toHaveLength(6);
  });
});
