import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { StrataGate } from '@diqier/stratagate'
import { describe, expect, it } from 'vitest'
import type { DshModelBridge } from '../src/llm.js'
import { StrataGateRuntime } from '../src/runtime.js'

const fakeModels = {
  run: async <T>(_session: Session, operation: () => Promise<T>): Promise<T> => operation(),
  summarizer: async () => ({
    l0Title: 'turns', l0Tags: [], l1Summary: 'turns', l2Keypoints: [], shouldExtract: false,
  }),
  extractor: async () => ({ shouldExtract: false, reason: 'none', events: [] }),
  projector: async () => ({ reason: 'none', changes: [] }),
} as unknown as DshModelBridge

const session = {
  id: 'session-runtime',
  header: { id: 'session-runtime', version: 0, createdAt: 0, cwd: 'C:\\work\\project' },
} as unknown as Session

function turnEvents(): SessionEvent[] {
  return [
    { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } },
    {
      type: 'user/message', seq: 1, time: 2,
      data: { id: 'u1', role: 'user', content: [{ type: 'text', text: 'remember pnpm' }], source: { kind: 'user' } },
    },
    {
      type: 'assistant/message', seq: 2, time: 3,
      data: {
        turn: 1, step: 1,
        message: {
          id: 'a1', role: 'assistant', content: [{ type: 'text', text: 'Understood.' }],
          source: { kind: 'model', provider: 'test', model: 'test' },
        },
      },
    },
    { type: 'turn/end', seq: 3, time: 4, data: { turn: 1, reason: { kind: 'completed' } } },
  ] as SessionEvent[]
}

describe('DSH runtime ingestion', () => {
  it('builds compact automatic context without reinforcing retrieved memories', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stratagate-dsh-auto-context-'))
    const database = join(directory, 'memory.db')
    const activeSession = {
      ...session,
      events: [],
      deriveMessages: () => [{
        id: 'current-user',
        role: 'user',
        content: [{ type: 'text', text: 'Continue with that plan.' }],
        source: { kind: 'user' },
      }],
    } as unknown as Session
    const runtime = new StrataGateRuntime({
      database,
      namespaceMode: 'project',
      namespacePrefix: 'dsh',
      globalNamespace: 'global',
      blockTurnSize: 2,
      ingestSubagents: false,
      maxOutputTokens: 2048,
    }, fakeModels)
    try {
      const memory = await (runtime as unknown as { space: (session: Session) => Promise<StrataGate> })
        .space(activeSession)
      await memory.appendTurn({ user: 'Initial setup.', assistant: 'Ready.', threadId: String(activeSession.id) })
      await memory.appendTurn({ user: 'Seal this block.', assistant: 'Sealed.', threadId: String(activeSession.id) })
      const block = memory.listBlocks()[0]
      expect(block).toBeDefined()

      const relevant = await memory.addEvent({
        title: 'Use pnpm',
        summary: 'The project package manager is pnpm.',
        narrative: 'PRIVATE NARRATIVE',
        quotes: ['PRIVATE QUOTE'],
        sourceMessageIds: [block!.l5Raw[0]!.id],
        sourceBlockId: block!.id,
        temporal: {
          happenedStart: '2026-08-20T10:00:00+08:00',
          happenedEnd: '2026-08-20T11:00:00+08:00',
          status: 'ongoing',
        },
      })
      const projection = await memory.claimNextElementProjection()
      expect(projection).not.toBeNull()
      await memory.completeElementProjection(projection!.jobId, {
        reason: 'project tool',
        changes: [{
          element: { name: 'StrataGate', type: 'project' },
          operation: 'set_state',
          key: 'packageManager',
          mode: 'state',
          value: 'pnpm',
          validFrom: '2026-08-20T10:00:00+08:00',
          sourceEventIds: [relevant.id],
        }],
      })
      const irrelevant = await memory.addEvent({
        title: 'Unrelated archive note',
        summary: 'A completely unrelated zebra record.',
        sourceMessageIds: [block!.l5Raw[0]!.id],
        sourceBlockId: block!.id,
      })
      const pinned = await memory.addEvent({
        title: 'Pinned background',
        summary: 'This pinned fact has no lexical overlap.',
        sourceMessageIds: [block!.l5Raw[0]!.id],
        sourceBlockId: block!.id,
      })
      await memory.pinEvent(pinned.id)
      const safety = await memory.addEvent({
        title: 'Safety background',
        summary: 'This safety fact has no lexical overlap.',
        sourceMessageIds: [block!.l5Raw[0]!.id],
        sourceBlockId: block!.id,
        criticality: 'safety',
      })
      await memory.appendTurn({
        user: 'We chose pnpm earlier.',
        assistant: 'I will keep that in mind.',
        threadId: String(activeSession.id),
      })

      const before = new Map(memory.listEvents().map((event) => [
        event.id,
        [event.weight.mentionCount, event.weight.lastAdoptedTurn],
      ]))
      const context = await runtime.buildAutoContext(activeSession)

      expect(context).toContain('[Current conversation]\nuser: We chose pnpm earlier.')
      expect(context).toContain('[Decayed memory blocks]')
      expect(context).toContain(`block ${block!.id} | turns 1-2 | L`)
      expect(context).toContain('[Activated long-term memory]')
      expect(context).toContain('Historical memory context.')
      expect(context).toContain(relevant.id)
      expect(context).toContain('"temporal":{"status":"ongoing"}')
      expect(context).toContain('"elementId":')
      expect(context).toContain('"key":"packageManager"')
      expect(context).toContain(pinned.id)
      expect(context).toContain(safety.id)
      expect(context).not.toContain(irrelevant.id)
      expect(context).not.toContain('PRIVATE NARRATIVE')
      expect(context).not.toContain('PRIVATE QUOTE')
      expect(context).not.toContain('sourceMessageIds')
      expect(context).not.toContain('sourceEventIds')
      expect(context).not.toContain('mentionCount')
      expect((context.match(/^\- \{"id":"evt_/gm) ?? [])).toHaveLength(3)
      expect((context.match(/^\- \{"elementId":/gm) ?? [])).toHaveLength(1)
      for (const event of memory.listEvents()) {
        expect([event.weight.mentionCount, event.weight.lastAdoptedTurn]).toEqual(before.get(event.id))
      }
    } finally {
      await runtime.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('keeps short-term blocks session-local while activating project long-term memory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stratagate-dsh-session-scope-'))
    const database = join(directory, 'memory.db')
    const sessionA = {
      ...session,
      id: 'session-a',
      header: { ...session.header, id: 'session-a' },
      events: [],
      deriveMessages: () => [],
    } as unknown as Session
    const sessionB = {
      ...session,
      id: 'session-b',
      header: { ...session.header, id: 'session-b' },
      events: [],
      deriveMessages: () => [{
        id: 'session-b-user',
        role: 'user',
        content: [{ type: 'text', text: 'Which package manager does this project use?' }],
        source: { kind: 'user' },
      }],
    } as unknown as Session
    const runtime = new StrataGateRuntime({
      database,
      namespaceMode: 'project',
      namespacePrefix: 'dsh',
      globalNamespace: 'global',
      blockTurnSize: 2,
      ingestSubagents: false,
      maxOutputTokens: 2048,
    }, fakeModels)
    try {
      expect(runtime.namespaceFor(sessionA)).toBe(runtime.namespaceFor(sessionB))
      const memory = await (runtime as unknown as { space: (active: Session) => Promise<StrataGate> }).space(sessionA)
      await memory.appendTurn({ user: 'A-only setup.', assistant: 'A reply.', threadId: 'session-a' })
      await memory.appendTurn({ user: 'A-only sealed turn.', assistant: 'A sealed reply.', threadId: 'session-a' })
      const blockA = memory.listBlocks()[0]!
      const event = await memory.addEvent({
        title: 'Project package manager',
        summary: 'The project package manager is pnpm.',
        sourceMessageIds: [blockA.l5Raw[0]!.id],
        sourceBlockId: blockA.id,
      })
      await memory.appendTurn({ user: 'A-only open tail.', assistant: 'A tail reply.', threadId: 'session-a' })
      await memory.appendTurn({ user: 'B-only open tail.', assistant: 'B tail reply.', threadId: 'session-b' })

      const context = await runtime.buildAutoContext(sessionB)
      expect(context).toContain('[Current conversation]\nuser: B-only open tail.')
      expect(context).toContain('[Decayed memory blocks]\n(no sealed blocks)')
      expect(context).not.toContain(blockA.id)
      expect(context).not.toContain('A-only')
      expect(context).toContain(event.id)

      const blockBatch = await runtime.blocks(sessionB) as { results: unknown[] }
      expect(blockBatch.results).toEqual([])
      await runtime.recordUse(sessionB, 'session-local-blocks', [])
    } finally {
      await runtime.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('does not cache a rejected namespace opening after pending-work recovery fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stratagate-dsh-recovery-'))
    const database = join(directory, 'memory.db')
    let attempts = 0
    const models = {
      ...fakeModels,
      run: async <T>(_session: Session, operation: () => Promise<T>): Promise<T> => {
        if (attempts++ === 0) throw new Error('temporary recovery failure')
        return operation()
      },
    } as unknown as DshModelBridge
    const runtime = new StrataGateRuntime({
      database,
      namespaceMode: 'project',
      namespacePrefix: 'dsh',
      globalNamespace: 'global',
      blockTurnSize: 4,
      ingestSubagents: false,
      maxOutputTokens: 2048,
    }, models)
    try {
      const space = (runtime as unknown as { space: (session: Session) => Promise<StrataGate> }).space
      await expect(space.call(runtime, session)).rejects.toThrow('temporary recovery failure')
      await expect(space.call(runtime, session)).resolves.toBeInstanceOf(StrataGate)
    } finally {
      await runtime.close().catch(() => {})
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('applies the configured block cadence to existing namespaces before the admin UI reads them', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stratagate-dsh-cadence-'))
    const database = join(directory, 'memory.db')
    const namespace = 'dsh:project:cadence'
    const seed = await StrataGate.open({ database, namespace, blockTurnSize: 4 })
    await seed.close()
    const runtime = new StrataGateRuntime({
      database,
      namespaceMode: 'project',
      namespacePrefix: 'dsh',
      globalNamespace: 'global',
      blockTurnSize: 6,
      ingestSubagents: false,
      maxOutputTokens: 2048,
    }, fakeModels)
    try {
      await runtime.syncConfiguredBlockTurnSize()
      expect((await runtime.adminSnapshot(namespace))?.blockTurnSize).toBe(6)
    } finally {
      await runtime.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('persists a folded DSH turn once even if the event bracket is delivered twice', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stratagate-dsh-runtime-'))
    const database = join(directory, 'memory.db')
    const runtime = new StrataGateRuntime({
      database,
      namespaceMode: 'project',
      namespacePrefix: 'dsh',
      globalNamespace: 'global',
      blockTurnSize: 4,
      ingestSubagents: false,
      maxOutputTokens: 2048,
    }, fakeModels)
    const namespace = runtime.namespaceFor(session)
    try {
      for (const event of turnEvents()) runtime.acceptEvent(session, event)
      for (const event of turnEvents()) runtime.acceptEvent(session, event)
      await runtime.close()

      const memory = await StrataGate.open({ database, namespace })
      expect(memory.turn).toBe(1)
      expect(memory.listOpenTail().map(({ content }) => content)).toEqual(['remember pnpm', 'Understood.'])
      expect(memory.hasIngestionReceipt('dsh:session-runtime:turn:1')).toBe(true)
      await memory.close()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('persists the retrieval assessment as an answer-to-source usage audit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stratagate-dsh-audit-'))
    const database = join(directory, 'memory.db')
    const runtime = new StrataGateRuntime({
      database,
      namespaceMode: 'project',
      namespacePrefix: 'dsh',
      globalNamespace: 'global',
      blockTurnSize: 1,
      ingestSubagents: false,
      maxOutputTokens: 2048,
    }, fakeModels)
    const activeSession = {
      ...session,
      events: [{ type: 'turn/start', seq: 0, time: 1, data: { turn: 9 } }],
    } as unknown as Session
    const namespace = runtime.namespaceFor(activeSession)
    try {
      const seed = await StrataGate.open({
        database,
        namespace,
        blockTurnSize: 1,
        summarizer: async () => ({
          l0Title: 'package manager', l0Tags: ['pnpm'], l1Summary: 'Use pnpm.', l2Keypoints: ['pnpm'], shouldExtract: true,
        }),
        extractor: async ({ target }) => ({
          shouldExtract: true,
          reason: 'durable project decision',
          events: [{
            title: 'Use pnpm',
            summary: 'The project uses pnpm.',
            sourceMessageIds: [target.l5Raw[0]?.id ?? 'missing'],
            sourceBlockId: target.id,
          }],
        }),
      })
      await seed.appendTurn({ user: 'Use pnpm.', assistant: 'Okay.' })
      await seed.appendTurn({ user: 'Continue.', assistant: 'Okay.' })
      const sourceBlock = seed.listBlocks()[0]!
      await seed.addEvent({
        title: 'pnpm alternative note',
        summary: 'A second pnpm memory that should not be reinforced unless selected.',
        sourceMessageIds: [sourceBlock.l5Raw[0]!.id],
        sourceBlockId: sourceBlock.id,
      })
      await seed.close()

      const batch = await runtime.searchEvents(activeSession, 'pnpm') as { batchId: string; evidenceRefs: string[] }
      expect(batch.evidenceRefs).toHaveLength(2)
      await runtime.assess(activeSession, {
        verdict: 'sufficient',
        evidence_refs: batch.evidenceRefs,
        fit: 'The event records the package-manager decision.',
        missing: '',
        next_strategy: 'answer',
      })
      expect(runtime.needsRecordUse(activeSession)).toBe(true)
      const selectedRefs = [batch.evidenceRefs[0]!]
      await runtime.recordUse(activeSession, 'call-audit-1', selectedRefs)
      expect(runtime.needsRecordUse(activeSession)).toBe(false)

      const audit = (await runtime.adminSnapshot(namespace))?.usageReceipts[0]
      expect(audit).toMatchObject({
        id: 'dsh:session-runtime:tool:call-audit-1',
        audit: {
          sessionId: 'session-runtime',
          turn: 9,
          batchId: batch.batchId,
          evidenceRefs: selectedRefs,
          verdict: 'sufficient',
          nextStrategy: 'answer',
        },
      })

      const afterSelected = await runtime.adminSnapshot(namespace)
      const selectedEventId = selectedRefs[0]!.slice('event:'.length)
      expect(afterSelected?.events.find(({ id }) => id === selectedEventId)?.weight.mentionCount).toBe(2)
      expect(afterSelected?.events.find(({ id }) => id !== selectedEventId)?.weight.mentionCount).toBe(1)
      const mentionCounts = new Map(afterSelected?.events.map((event) => [event.id, event.weight.mentionCount]))
      await runtime.searchEvents(activeSession, 'pnpm')
      expect(runtime.needsRecordUse(activeSession)).toBe(true)
      await runtime.recordUse(activeSession, 'call-audit-zero', [])
      expect(runtime.needsRecordUse(activeSession)).toBe(false)
      const afterZero = await runtime.adminSnapshot(namespace)
      for (const event of afterZero?.events ?? []) {
        expect(event.weight.mentionCount).toBe(mentionCounts.get(event.id))
      }
      expect(afterZero?.usageReceipts).toContainEqual(expect.objectContaining({
        id: 'dsh:session-runtime:tool:call-audit-zero',
        eventIds: [],
        elementIds: [],
      }))
    } finally {
      await runtime.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
