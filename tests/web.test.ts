import { describe, expect, it } from 'vitest'
import type { StrataGateSnapshot } from '@diqier/stratagate'
import type { StrataGateRuntime } from '../src/runtime.js'
import { handleAdminRequest, type WebResponse } from '../src/web.js'

const fullFailure = 'StrataGate model response was not valid JSON\nRaw response (full):\n' + 'x'.repeat(600)

const snapshot: StrataGateSnapshot = {
  schemaVersion: 8,
  currentTurn: 8,
  blockTurnSize: 4,
  blockDecayLambda: 0.3,
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
    pointerAnchorBlockPosition: 1,
    lastLiftedAt: null,
    lastLiftedBy: null,
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
  graphNodes: [{
    id: 'node_1', name: 'pnpm', type: 'tool', aliases: [], currentState: '项目包管理器', facts: [],
    status: 'active', confidence: 0.95, sourceEventIds: ['evt_1'],
    createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
  }],
  graphEdges: [],
  graphProjectionJobs: [{
    id: 'gproj_1', sourceEventIds: ['evt_1'], projectorVersion: 1, status: 'completed', attempts: 1,
    priority: 1, nodeIds: ['node_1'], edgeIds: [], reason: 'projected', lastError: null,
    createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
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

let updatedLambda: number | null = null
let updatedTurnSize: number | null = null
let expandedBlock: { namespace: string; id: string; target: string | number } | null = null
const runtime = {
  adminNamespaces: async () => ['dsh:project:test'],
  adminSnapshot: async (namespace: string) => namespace === 'dsh:project:test' ? snapshot : null,
  adminWorkspaceName: () => 'StrataGate',
  adminSetBlockTurnSize: async (value: number) => {
    updatedTurnSize = value
    return value
  },
  adminSetBlockDecayLambda: async (value: number) => {
    updatedLambda = value
    return value
  },
  adminExpandBlock: async (namespace: string, id: string, target: string | number) => {
    expandedBlock = { namespace, id, target }
    return { id, level: Number(String(target).replace(/^L/i, '')) }
  },
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

async function request(url: string, method = 'GET', targetRuntime = runtime, body?: unknown): Promise<{ status: number; body: any; headers: Record<string, string> }> {
  const headers: Record<string, string> = {}
  let text = ''
  const response: WebResponse = {
    statusCode: 0,
    setHeader: (name, value) => { headers[name] = value },
    end: (body) => { text = body },
  }
  await handleAdminRequest(targetRuntime, { method, url, body }, response)
  return { status: response.statusCode, body: JSON.parse(text), headers }
}

describe('StrataGate admin routes', () => {
  it('accepts external memory JSON through the import route', async () => {
    let received: { namespace: string; text: string } | null = null
    const importRuntime = {
      adminImportExternalMemory: async (namespace: string, text: string) => {
        received = { namespace, text }
        return { importedCount: 2 }
      },
    } as unknown as StrataGateRuntime
    const result = await request('/api/stratagate/import', 'POST', importRuntime, {
      namespace: 'dsh:project:test',
      text: '{"schemaVersion":"stratagate.external-memory.v2","candidates":[]}',
    })
    expect(result).toMatchObject({ status: 200, body: { importedCount: 2 } })
    expect(received).toEqual({ namespace: 'dsh:project:test', text: '{"schemaVersion":"stratagate.external-memory.v2","candidates":[]}' })
  })

  it('serves the complete external memory export prompt', async () => {
    const result = await request('/api/stratagate/import')
    expect(result).toMatchObject({ status: 200, body: { schemaVersion: 'stratagate.external-memory.v2' } })
    expect(result.body.prompt).toContain('一、记忆类型')
    expect(result.body.prompt).toContain('sourceType')
    expect(result.body.prompt).toContain('如果没有符合条件的长期记忆，请输出')
  })

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
      settingsWritable: true,
      namespaces: [{
        workspaceName: 'StrataGate',
        blockTurnSize: 4,
        blockDecayLambda: 0.3,
        events: 1,
        usageReceipts: 1,
        memoryUseCount: 1,
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

    const graph = await request('/api/stratagate/memories?namespace=dsh%3Aproject%3Atest&kind=graph')
    expect(graph.body).toMatchObject({
      projectorVersion: 1,
      migration: { projected: 1, total: 1, complete: true },
      nodes: [{ id: 'node_1', name: 'pnpm', supportingEvents: [{ id: 'evt_1' }] }],
      edges: [],
      clusters: [{ label: '未连接节点', nodeIds: ['node_1'] }],
    })

    const blocks = await request('/api/stratagate/memories?namespace=dsh%3Aproject%3Atest&kind=blocks')
    expect(blocks.body).toMatchObject({
      activeThreadId: '__legacy__',
      conversations: [{ id: '__legacy__', label: '历史对话', blocks: 1 }],
      openBlock: { turnRange: null, status: 'open' },
      items: [{
        id: 'blk_1',
        currentLevel: 5,
        distanceFromLatest: 0,
        expansionSource: null,
        status: 'organized',
        eventExtraction: { status: 'succeeded' },
        relatedEvents: [{ id: 'evt_1' }],
        relatedNodes: [{ id: 'node_1' }],
      }],
    })
  })

  it('filters short-term Blocks and the open tail by the selected conversation', async () => {
    const first = {
      ...snapshot.blocks[0]!,
      threadId: 'thread-a',
      l5Raw: snapshot.blocks[0]!.l5Raw.map((message) => ({ ...message, threadId: 'thread-a' })),
    }
    const second = {
      ...snapshot.blocks[0]!,
      id: 'blk_2',
      threadId: 'thread-b',
      sequence: 2,
      l0Title: 'Second conversation',
      l5Raw: [{ ...snapshot.blocks[0]!.l5Raw[0]!, id: 'msg_2', threadId: 'thread-b', content: 'Second conversation prompt' }],
    }
    const threadedRuntime = {
      adminSnapshot: async () => ({
        ...snapshot,
        blocks: [first, second],
        openTail: [{ id: 'open_1', threadId: 'thread-b', role: 'user' as const, content: 'Continue second conversation', createdAt: '2026-08-19T00:00:00.000Z' }],
      }),
    } as unknown as StrataGateRuntime

    const firstResult = await request('/api/stratagate/memories?namespace=threaded&kind=blocks&threadId=thread-a', 'GET', threadedRuntime)
    expect(firstResult.body).toMatchObject({ activeThreadId: 'thread-a', items: [{ id: 'blk_1' }], openBlock: { turnRange: null } })
    expect(firstResult.body.items).toHaveLength(1)

    const secondResult = await request('/api/stratagate/memories?namespace=threaded&kind=blocks&threadId=thread-b', 'GET', threadedRuntime)
    expect(secondResult.body).toMatchObject({ activeThreadId: 'thread-b', items: [{ id: 'blk_2' }], openBlock: { turnRange: [5, 5] } })
    expect(secondResult.body.conversations.map(({ id }: { id: string }) => id)).toEqual(['thread-b', 'thread-a'])
  })

  it('recovers legacy conversation boundaries from ingestion receipts without rewriting mixed Blocks', async () => {
    const mixed = {
      ...snapshot.blocks[0]!,
      l5Raw: [
        { id: 'a-user', role: 'user' as const, content: 'Alpha question', createdAt: '2026-08-18T00:00:00.000Z' },
        { id: 'a-assistant', role: 'assistant' as const, content: 'Alpha answer', createdAt: '2026-08-18T00:00:00.000Z' },
        { id: 'b-user', role: 'user' as const, content: 'Beta question', createdAt: '2026-08-18T01:00:00.000Z' },
        { id: 'b-assistant', role: 'assistant' as const, content: 'Beta answer', createdAt: '2026-08-18T01:00:00.000Z' },
      ],
    }
    const recoveredRuntime = {
      adminSnapshot: async () => ({
        ...snapshot,
        blocks: [mixed],
        openTail: [],
        ingestionReceipts: [
          { id: 'dsh:session-alpha:turn:1', createdAt: '2026-08-18T00:00:00.000Z' },
          { id: 'dsh:session-beta:turn:1', createdAt: '2026-08-18T01:00:00.000Z' },
        ],
      }),
    } as unknown as StrataGateRuntime

    const alpha = await request('/api/stratagate/memories?namespace=recovered&kind=blocks&threadId=session-alpha', 'GET', recoveredRuntime)
    expect(alpha.body).toMatchObject({
      activeThreadId: 'session-alpha',
      items: [{ id: expect.stringContaining('virtual:blk_1:'), threadId: 'session-alpha', virtual: true, turnRange: [1, 1] }],
    })
    expect(alpha.body.conversations.map(({ id }: { id: string }) => id)).toEqual(['session-beta', 'session-alpha'])
    expect(alpha.body.conversations.some(({ id }: { id: string }) => id === '__legacy__')).toBe(false)

    const detail = await request(`/api/stratagate/sources?namespace=recovered&blockId=${encodeURIComponent(alpha.body.items[0].id)}`, 'GET', recoveredRuntime)
    expect(detail.body).toMatchObject({ virtual: true, messages: [{ id: 'a-user' }, { id: 'a-assistant' }] })
    expect(detail.body.layers[5].content).toContain('Alpha question')
    expect(detail.body.layers[5].content).not.toContain('Beta question')

    const emptyHostSession = await request('/api/stratagate/memories?namespace=recovered&kind=blocks&threadId=session-without-memory', 'GET', recoveredRuntime)
    expect(emptyHostSession.body).toMatchObject({ activeThreadId: 'session-without-memory', items: [], openBlock: { messages: 0 } })
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
      layers: [
        { level: 0, content: expect.stringContaining('Package manager') },
        { level: 1, content: 'Use pnpm for this project.' },
        { level: 2, content: '• pnpm' },
        { level: 3, content: 'Use pnpm.' },
        { level: 4, content: 'Use pnpm.' },
        { level: 5, content: 'user: Use pnpm. api_key=[REDACTED]' },
      ],
    })
  })

  it('actively lifts a Block to one requested layer', async () => {
    expandedBlock = null
    const result = await request('/api/stratagate/blocks/expand?namespace=dsh%3Aproject%3Atest&blockId=blk_1&level=L4', 'PATCH')
    expect(result).toMatchObject({ status: 200, body: { id: 'blk_1', level: 4 } })
    expect(expandedBlock).toEqual({ namespace: 'dsh:project:test', id: 'blk_1', target: 'L4' })

    const invalid = await request('/api/stratagate/blocks/expand?namespace=dsh%3Aproject%3Atest&blockId=blk_1&level=L9', 'PATCH')
    expect(invalid).toMatchObject({ status: 400, body: { error: expect.stringContaining('L0 through L5') } })
  })

  it('links answer audit records to events and original messages', async () => {
    const result = await request('/api/stratagate/audit?namespace=dsh%3Aproject%3Atest')
    expect(result.body.items[0]).toMatchObject({
      audit: { sessionId: 's1', turn: 8, batchId: 'batch_4', evidenceRefs: ['event:evt_1'] },
      events: [{ id: 'evt_1' }],
      sourceMessages: [{ id: 'msg_1' }],
    })
  })

  it('updates the global Block settings while memory routes remain read-only', async () => {
    updatedLambda = null
    updatedTurnSize = null
    const settings = await request('/api/stratagate/settings?blockTurnSize=3&blockDecayLambda=0.15', 'PATCH')
    expect(settings).toMatchObject({ status: 200, body: { blockTurnSize: 3, blockDecayLambda: 0.15 } })
    expect(updatedTurnSize).toBe(3)
    expect(updatedLambda).toBe(0.15)

    const invalid = await request('/api/stratagate/settings?blockDecayLambda=nope', 'PATCH')
    expect(invalid).toMatchObject({ status: 400, body: { error: expect.stringContaining('blockDecayLambda') } })
    const invalidTurnSize = await request('/api/stratagate/settings?blockTurnSize=2.5', 'PATCH')
    expect(invalidTurnSize).toMatchObject({ status: 400, body: { error: expect.stringContaining('blockTurnSize') } })

    const result = await request('/api/stratagate/memories', 'POST')
    expect(result).toMatchObject({ status: 405, body: { error: expect.stringContaining('read-only') } })
  })
})
