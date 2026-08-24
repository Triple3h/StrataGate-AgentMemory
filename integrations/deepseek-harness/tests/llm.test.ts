import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type { ExtractionContext, MemoryBlock } from '@diqier/stratagate'
import { describe, expect, it, vi } from 'vitest'
import { ModelJsonResponseError, parseJsonResponse } from '../src/json-response.js'
import { DshModelBridge } from '../src/llm.js'

describe('DeepSeek Harness model JSON parsing', () => {
  it('extracts fenced JSON without being confused by braces in strings', () => {
    expect(parseJsonResponse('Result:\n```json\n{"text":"keep } and { literal","nested":{"ok":true}}\n```'))
      .toEqual({ text: 'keep } and { literal', nested: { ok: true } })
  })

  it('rejects multiple top-level JSON values instead of greedily joining them', () => {
    expect(() => parseJsonResponse('{"first":true}\n{"second":true}'))
      .toThrow('multiple JSON values')
  })

  it('uses the final object when an explanation contains an earlier JSON example', () => {
    expect(parseJsonResponse('Example: {"first":true}\nFinal answer: {"second":true}'))
      .toEqual({ second: true })
  })

  it('skips leading reasoning text and validates the requested response fields', () => {
    const response = 'We need process these events carefully. The entities are clear.\n'
      + '{"reason":"projected","changes":[]}'
    expect(parseJsonResponse(response, ['reason', 'changes']))
      .toEqual({ reason: 'projected', changes: [] })
    expect(() => parseJsonResponse('{"reason":"missing changes"}', ['reason', 'changes']))
      .toThrow('missing required fields')
  })

  it('accepts a BOM-prefixed JSON response', () => {
    expect(parseJsonResponse('\uFEFF{"ok":true}')).toEqual({ ok: true })
  })

  it('rejects truncated JSON', () => {
    expect(() => parseJsonResponse('{"incomplete":'))
      .toThrow('not valid JSON')
  })

  it('includes a bounded raw response preview in parse errors', () => {
    const response = 'not json '.repeat(80)
    let error: unknown
    try {
      parseJsonResponse(response)
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(ModelJsonResponseError)
    expect((error as ModelJsonResponseError).responsePreview).toBe(response.slice(0, 500))
    expect((error as Error).message).toContain('Raw response preview')
    expect((error as Error).message).toContain(response.slice(0, 80))
    expect((error as Error).message).not.toContain(response.slice(0, 501))
    expect((error as ModelJsonResponseError).fullMessage).toContain(response)
  })
})

function modelBridge(responses: Array<{ text?: string; tool?: unknown; toolName?: string; reasoning?: string; finish?: 'stop' | 'max-tokens' }>): {
  bridge: DshModelBridge
  session: Session
  calls: ReturnType<typeof vi.fn>
} {
  const calls = vi.fn()
  const stream = (options: { system?: string; maxTokens?: number; tools?: Array<{ name: string }>; tool_choice?: unknown }) => {
    const response = responses[calls.mock.calls.length]
    calls(options)
    return (async function* () {
      if (response?.reasoning) yield { type: 'reasoning-delta' as const, index: 0, text: response.reasoning }
      if (response?.tool !== undefined) {
        yield {
          type: 'tool-call-delta' as const,
          index: 1,
          id: 'mock-tool-call' as never,
          name: response.toolName ?? options.tools?.[0]?.name,
          argumentsDelta: JSON.stringify(response.tool),
        }
      } else if (response?.text) {
        yield { type: 'text-delta' as const, index: 0, text: response.text }
      }
      yield { type: 'finish' as const, reason: { kind: response?.finish ?? 'stop' } }
    })()
  }
  const ctx = {
    llm: { stream },
    logger: { warn: vi.fn() },
  } as unknown as Context
  const bridge = new DshModelBridge(ctx, {
    database: ':memory:',
    namespaceMode: 'session',
    namespacePrefix: 'test',
    globalNamespace: 'global',
    blockTurnSize: 1,
    blockDecayLambda: 0.3,
    ingestSubagents: false,
    maxOutputTokens: 256,
  })
  const session = {
    id: 'json-test',
    requestHeader: () => ({ config: { provider: 'test', model: 'test', reasoningEffort: 'low' as never } }),
  } as unknown as Session
  return { bridge, session, calls }
}

describe('DeepSeek Harness model JSON retries', () => {
  it('retries once with a correction instruction after invalid JSON', async () => {
    const { bridge, session, calls } = modelBridge([
      { text: 'not json' },
      { tool: { l0Title: 'fixed', l0Tags: [], l1Summary: 'ok', l2Keypoints: [], shouldExtract: false } },
    ])

    const result = await bridge.run(session, () => bridge.summarizer([]))

    expect(result.l0Title).toBe('fixed')
    expect(calls).toHaveBeenCalledTimes(2)
    expect(calls.mock.calls[1]?.[0].system).toContain('did not make one valid call to the requested tool')
  })

  it('retries a truncated response and then reports a bounded failure', async () => {
    const { bridge, session, calls } = modelBridge([
      { text: '{"l0Title":', finish: 'max-tokens' },
      { text: 'still not json' },
    ])

    let error: unknown
    try {
      await bridge.run(session, () => bridge.summarizer([]))
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(ModelJsonResponseError)
    expect((error as Error).message).toContain('did not produce a valid stratagate_summarize_block call after 2 attempts')
    expect((error as Error).message).toContain('still not json')
    expect(calls).toHaveBeenCalledTimes(2)
    expect(calls.mock.calls[1]?.[0].maxTokens).toBe(10_000)
  })

  it('uses tool-call arguments even when the provider also returns reasoning', async () => {
    const calls = vi.fn()
    const ctx = {
      llm: { stream: (options: unknown) => {
        calls(options)
        return (async function* () {
          yield { type: 'reasoning-delta' as const, index: 0, text: 'I will summarize the block.' }
          yield { type: 'tool-call-delta' as const, index: 1, id: 'mock-tool-call' as never, name: 'stratagate_summarize_block', argumentsDelta: JSON.stringify({ l0Title: 'from tool', l0Tags: [], l1Summary: 'ok', l2Keypoints: [], shouldExtract: false }) }
          yield { type: 'finish' as const, reason: { kind: 'stop' as const } }
        })()
      } },
      logger: { warn: vi.fn() },
    } as unknown as Context
    const bridge = new DshModelBridge(ctx, {
      database: ':memory:', namespaceMode: 'session', namespacePrefix: 'test', globalNamespace: 'global',
      blockTurnSize: 1, blockDecayLambda: 0.3, ingestSubagents: false, maxOutputTokens: 256,
    })
    const session = { id: 'reasoning-test', requestHeader: () => ({ config: { provider: 'test', model: 'test' } }) } as unknown as Session

    const result = await bridge.run(session, () => bridge.summarizer([]))

    expect(result.l0Title).toBe('from tool')
    expect(calls).toHaveBeenCalledTimes(1)
  })

  it('accepts JSON text when the adapter exposes tools but drops tool_choice', async () => {
    const { bridge, session, calls } = modelBridge([{
      reasoning: 'I will prepare the structured summary.',
      text: '{"l0Title":"text fallback","l0Tags":[],"l1Summary":"ok","l2Keypoints":[],"shouldExtract":false}',
    }])

    const result = await bridge.run(session, () => bridge.summarizer([]))

    expect(result.l0Title).toBe('text fallback')
    expect(calls.mock.calls[0]?.[0].reasoningEffort).toBe('off')
  })

  it('marks the target as the only source and limits neighbors to L2 context', async () => {
    const target = {
      id: 'blk_target', sequence: 2, startTurn: 3, endTurn: 4,
      l0Title: 'target', l0Tags: [], l1Summary: 'target summary', l2Keypoints: ['target point'],
      l3Condensed: 'target condensed', l4Readable: 'target readable',
      l5Raw: [{ id: 'msg_target', role: 'user', content: 'target message', createdAt: '2026-01-01T00:00:00.000Z' }],
      shouldExtract: true, pointerCurrentLevel: 5, pointerAnchorLevel: 5,
      pointerAnchorBlockPosition: 1, lastLiftedAt: null, lastLiftedBy: null, createdAt: '2026-01-01T00:00:00.000Z',
    } as MemoryBlock
    const next = {
      ...target, id: 'blk_next', sequence: 3, startTurn: 5, endTurn: 6,
      l2Keypoints: ['next point'],
      l5Raw: [{ id: 'msg_next', role: 'user', content: 'next message', createdAt: '2026-01-01T00:00:00.000Z' }],
    } as MemoryBlock
    const { bridge, session, calls } = modelBridge([{
      tool: { shouldExtract: true, reason: 'event', events: [{
        title: 'Target event', summary: 'From target', sourceMessageIds: ['msg_target'],
      }] },
    }])

    const context: ExtractionContext = { previous: null, target, next, timeline: [] }
    const result = await bridge.run(session, () => bridge.extractor(context))
    const payload = JSON.parse(String(calls.mock.calls[0]?.[0].messages?.[0]?.content?.[0]?.text)) as Record<string, any>
    expect(result.shouldExtract).toBe(true)
    expect(result.events[0]?.sourceMessageIds).toEqual(['msg_target'])
    expect(payload.allowedSourceMessageIds).toEqual(['msg_target'])
    expect(payload.target.l5Raw[0].id).toBe('msg_target')
    expect(payload.neighbors.next.l2Keypoints).toEqual(['next point'])
    expect(payload.neighbors.next.l5Raw).toBeUndefined()
  })

  it('keeps shouldExtract true when all returned source ids are invalid for the target', async () => {
    const target = {
      id: 'blk_target', sequence: 1, startTurn: 1, endTurn: 2,
      l0Title: 'target', l0Tags: [], l1Summary: '', l2Keypoints: [], l3Condensed: '', l4Readable: '',
      l5Raw: [{ id: 'msg_target', role: 'user', content: 'target message', createdAt: '2026-01-01T00:00:00.000Z' }],
      shouldExtract: true, pointerCurrentLevel: 5, pointerAnchorLevel: 5,
      pointerAnchorBlockPosition: 1, lastLiftedAt: null, lastLiftedBy: null, createdAt: '2026-01-01T00:00:00.000Z',
    } as MemoryBlock
    const { bridge, session } = modelBridge([{
      tool: { shouldExtract: true, reason: 'wrong block', events: [{
        title: 'Wrong source', summary: 'From neighbor', sourceMessageIds: ['msg_next'],
      }] },
    }])

    const result = await bridge.run(session, () => bridge.extractor({ previous: null, target, next: target, timeline: [] }))
    expect(result.shouldExtract).toBe(true)
    expect(result.events).toHaveLength(0)
  })

  it('exposes only the projector tool to the model', async () => {
    const event = {
      id: 'evt_projector', title: 'Project decision', summary: 'StrataGate uses SQLite',
      narrative: '', tags: [], quotes: [], sourceMessageIds: ['msg_projector'], sourceBlockId: 'blk_projector',
      temporal: {}, scope: 'project' as const, criticality: 'routine' as const, confidence: 0.9,
      status: 'active' as const, supersededBy: null,
      weight: { mentionCount: 1, lastAdoptedTurn: 1, lastRetrievedAt: null, pinned: false, floorWeight: 0, forcedCap: null },
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const { bridge, session, calls } = modelBridge([{
      tool: { reason: 'projected', changes: [{
        element: { name: 'StrataGate', type: 'project' }, operation: 'set_state', key: 'database', mode: 'state',
        value: 'SQLite', sourceEventIds: [event.id],
      }] },
    }])

    const result = await bridge.run(session, () => bridge.projector({
      jobId: 'proj_1', events: [event], existingElements: [],
    }))

    expect(result.changes).toHaveLength(1)
    expect(calls.mock.calls[0]?.[0].tools?.[0]?.name).toBe('stratagate_project_element_cards')
    expect(calls.mock.calls[0]?.[0].tool_choice).toEqual({
      type: 'function',
      function: { name: 'stratagate_project_element_cards' },
    })
    expect(calls.mock.calls[0]?.[0].reasoningEffort).toBe('off')
    expect(calls.mock.calls[0]?.[0].system).toContain('Call stratagate_project_element_cards exactly once')
  })
})
