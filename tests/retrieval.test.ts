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
    }, new Set(['fresh'])).verdict).toBe('partial');

    expect(normalizeRetrievalAssessment({
      verdict: 'sufficient',
      evidence_refs: ['fresh'],
      fit: 'direct evidence',
      missing: '',
      next_strategy: 'answer',
    }, new Set(['fresh']))).toMatchObject({
      verdict: 'sufficient',
      evidenceRefs: ['fresh'],
      nextStrategy: 'answer',
    });
  });
});
