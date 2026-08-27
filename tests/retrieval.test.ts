import { describe, expect, it } from 'vitest';
import { normalizeRetrievalAssessment } from '../src/index.js';

describe('evidence gate', () => {
  it('accepts sufficient only with fresh evidence and the answer strategy', () => {
    expect(normalizeRetrievalAssessment({
      verdict: 'sufficient',
      evidence_refs: ['old'],
      fit: 'looks relevant',
      missing: '',
      next_strategy: 'answer',
    }, new Set(['fresh']))).toMatchObject({
      verdict: 'partial',
      evidenceRefs: [],
      rejectedEvidenceRefs: [{ ref: 'old', reason: 'not_in_batch' }],
    });

    expect(normalizeRetrievalAssessment({
      verdict: 'sufficient',
      evidence_refs: ['fresh'],
      fit: 'direct evidence',
      missing: '',
      next_strategy: 'answer',
    }, new Set(['fresh']))).toMatchObject({
      verdict: 'sufficient',
      evidenceRefs: ['fresh'],
      rejectedEvidenceRefs: [],
      nextStrategy: 'answer',
    });
  });

  it('reports every evidence ref that was not adopted', () => {
    expect(normalizeRetrievalAssessment({
      verdict: 'sufficient',
      evidence_refs: ['fresh', 'fresh', 'old', ''],
      fit: 'one direct source',
      missing: '',
      next_strategy: 'answer',
    }, new Set(['fresh']))).toMatchObject({
      verdict: 'sufficient',
      evidenceRefs: ['fresh'],
      rejectedEvidenceRefs: [
        { inputIndex: 1, ref: 'fresh', reason: 'duplicate' },
        { inputIndex: 2, ref: 'old', reason: 'not_in_batch' },
        { inputIndex: 3, ref: '', reason: 'invalid_ref' },
      ],
    });
  });
});
