import { describe, expect, it } from 'vitest'
import type { StrataGateSnapshot } from '@diqier/stratagate'
import type { StrataGateRuntime } from '../src/runtime.js'
import { handleAdminRequest, type WebResponse } from '../src/web.js'

const fullFailure = 'StrataGate model response was not valid JSON\nRaw response (full):\n' + 'x'.repeat(600)

const snapshot: StrataGateSnapshot = {
  schemaVersion: 5,
  currentTurn: 8,
  blockTurnSize: 4,
  openTail: [],
  blocks: [{
    id: 'blk_1',
    sequence: 1,
    startTurn: 1,
    endTurn: 4,
    createdAt: '2026-08-18T00:00:00.000Z',
    shouldExtract: true,
    l0Title: 'Package manager',
    l0Tags: ['pnpm'],
    l1Summary: 'Use pnpm for this project.',
    l2Keypoints: ['pnpm'],
    l3Condensed: 'Use pnpm.',
    l4Readable: 'Use pnpm.',
    l5Raw: [{
      id: 'msg_1',
      role: 'user',
      content: 'Use pnpm. api_key=super-secret-value',
      createdAt: '2026-08-18T00:00:00.000Z',
      toolCalls: [{ name: 'fetch', arguments: { authorization: 'Bearer abcdefghijklmnop' } }],
    }],
    pointerCurrentLevel: 5,
    pointerAnchorLevel: 5,
    pointerAnchorTurn: 4,
    lastLiftedAt: null,
  }],
  events: [{
    id: 'evt_1',
    title: 'Use pnpm',
    summary: 'The project uses pnpm.',
    narrative: 'The user selected pnpm.',
    tags: ['pnpm'],
    quotes: ['Use pnpm.'],
    sourceMessageIds: ['msg_1'],
    sourceBlockId: 'blk_1',
    temporal: {},
    scope: 'project',
    criticality: 'routine',
    confidence: 0.95,
    status: 'active',
    supersededBy: null,
    weight: { mentionCount: 1, lastAdoptedTurn: 8, lastRetrievedAt: null, pinned: false, floorWeight: 0, forcedCap: null },
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  }],
  elements: [{
    id: 'el_1',
    name: 'pnpm',
    type: 'tool',
    aliases: [],
    currentState: 'The project package manager.',
    facts: [],
    sourceEventIds: ['evt_1'],
    sourceMessageIds: ['msg_1'],
    weight: { mentionCount: 1, lastAdoptedTurn: 8, lastRetrievedAt: null, pinned: false, floorWeight: 0, forcedCap: null },
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  }],
  extractionJobs: [{
    blockId: 'blk_1',
    status: 'succeeded',
    attempts: 1,
    lastError: null,
    updatedAt: '2026-08-18T00:01:00.000Z',
  }, {
    blockId: 'blk_failed', status: 'failed', attempts: 2, lastError: fullFailure, updatedAt: '2026-08-18T00:02:00.000Z',
  }],
  elementProjectionJobs: [],
  usageReceipts: [{
    id: 'dsh:s1:tool:c1',
    eventIds: ['evt_1'],
    elementIds: [],
    audit: {
      sessionId: 's1',
      turn: 8,
      batchId: 'batch_4',
      evidenceRefs: ['event:evt_1'],
      verdict: 'sufficient',
      fit: 'Direct project decision.',
      missing: '',
      nextStrategy: 'answer',
    },
    createdAt: '2026-08-18T00:01:00.000Z',
  }],
  ingestionReceipts: [],
}

const runtime = {
  adminNamespaces: async () => ['dsh:project:test'],
  adminSnapshot: async (namespace: string) => namespace === 'dsh:project:test' ? snapshot : null,
} as unknown as StrataGateRuntime

const waitingRuntime = {
  adminNamespaces: async () => ['dsh:project:waiting'],
  adminSnapshot: async (namespace: string) => namespace === 'dsh:project:waiting'
    ? { ...snapshot, blocks: snapshot.blocks.map((block) => ({ ...block, shouldExtract: true })), extractionJobs: [] }
    : null,
} as unknown as StrataGateRuntime

const skippedRuntime = {
  adminNamespaces: async () => ['dsh:project:skipped'],
  adminSnapshot: async (namespace: string) => namespace === 'dsh:project:skipped'
    ? { ...snapshot, blocks: snapshot.blocks.map((block) => ({ ...block, shouldExtract: false })), extractionJobs: [] }
    : null,
} as unknown as StrataGateRuntime

async function request(url: string, method = 'GET', targetRuntime = runtime): Promise<{ status: number; body: any; headers: Record<string, string> }> {
  const headers: Record<string, string> = {}
  let text = ''
  const response: WebResponse = {
    statusCode: 0,
    setHeader: (name, value) => { headers[name] = value },
    end: (body) => { text = body },
  }
  await handleAdminRequest(targetRuntime, { method, url }, response)
  return { status: response.statusCode, body: JSON.parse(text), headers }
}

describe('StrataGate read-only admin routes', () => {
  it('does not label a block without an extraction job as actively processing', async () => {
    const result = await request('/api/stratagate/memories?namespace=dsh%3Aproject%3Awaiting&kind=blocks', 'GET', waitingRuntime)
    expect(result.body.items[0]).toMatchObject({ status: 'waiting', eventExtraction: null })
    const skipped = await request('/api/stratagate/memories?namespace=dsh%3Aproject%3Askipped&kind=blocks', 'GET', skippedRuntime)
    expect(skipped.body.items[0]).toMatchObject({ status: 'organized', eventExtraction: null })
  })

  it('summarizes namespaces and returns paginated memories', async () => {
    const overview = await request('/api/stratagate/overview')
    expect(overview.status).toBe(200)
    expect(overview.body).toMatchObject({
      readonly: true,
      namespaces: [{
        blockTurnSize: 4,
        events: 1,
      usageReceipts: 1,
      failedJobs: 1,
      processingJobs: 0,
      failedJobDetails: [{
          kind: 'event-extraction',
          attempts: 2,
          lastError: fullFailure.slice(0, 500),
          lastErrorFull: fullFailure,
        }],
      }],
    })
    expect(overview.headers['Cache-Control']).toBe('no-store')

    const memories = await request('/api/stratagate/memories?namespace=dsh%3Aproject%3Atest&kind=events&q=pnpm')
    expect(memories.body).toMatchObject({ total: 1, items: [{ id: 'evt_1', title: 'Use pnpm', relatedElements: [{ id: 'el_1', name: 'pnpm' }] }] })

    const blocks = await request('/api/stratagate/memories?namespace=dsh%3Aproject%3Atest&kind=blocks')
    expect(blocks.body).toMatchObject({ items: [{
      id: 'blk_1',
      status: 'organized',
      eventExtraction: { status: 'succeeded' },
      relatedEvents: [{ id: 'evt_1' }],
      relatedElements: [{ id: 'el_1' }],
    }] })
  })

  it('expands source evidence with server-side secret redaction', async () => {
    const result = await request('/api/stratagate/sources?namespace=dsh%3Aproject%3Atest&eventId=evt_1')
    expect(result.status).toBe(200)
    expect(result.body.messages[0].content).toBe('Use pnpm. api_key=[REDACTED]')
    expect(result.body.messages[0].toolCalls[0].arguments.authorization).toBe('Bearer [REDACTED]')
  })

  it('expands a block into its organized events and elements', async () => {
    const result = await request('/api/stratagate/sources?namespace=dsh%3Aproject%3Atest&blockId=blk_1')
    expect(result.body).toMatchObject({
      events: [{ id: 'evt_1' }],
      elements: [{ id: 'el_1' }],
      messages: [{ id: 'msg_1' }],
    })
  })

  it('links answer audit records to events and original messages', async () => {
    const result = await request('/api/stratagate/audit?namespace=dsh%3Aproject%3Atest')
    expect(result.body.items[0]).toMatchObject({
      audit: { sessionId: 's1', turn: 8, batchId: 'batch_4', evidenceRefs: ['event:evt_1'] },
      events: [{ id: 'evt_1' }],
      sourceMessages: [{ id: 'msg_1' }],
    })
  })

  it('rejects every browser write method', async () => {
    const result = await request('/api/stratagate/memories', 'POST')
    expect(result).toMatchObject({ status: 405, body: { error: expect.stringContaining('read-only') } })
  })
})
