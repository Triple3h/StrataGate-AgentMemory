import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildZcodeTurns, cleanZcodeText, readUnseenRolloutTurns } from '../src/transcript.js'

const dirs: string[] = []
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }) })

interface LineOptions {
  user?: string
  text?: string
  toolCalls?: Array<{ id: string; name: string; input?: unknown }>
  toolOutput?: { callId: string; output: string }
  completedAt?: string
  turnId?: string | null
}

function rolloutLine(turnId: string | null, options: LineOptions = {}): string {
  const input: unknown[] = []
  if (options.user) input.push({ role: 'user', content: options.user })
  if (options.toolOutput) input.push({ type: 'function_call_output', call_id: options.toolOutput.callId, output: options.toolOutput.output })
  return JSON.stringify({
    sessionId: 'session-1',
    ...(turnId ? { turnId } : {}),
    type: 'model_io',
    request: { body: { input } },
    response: { text: options.text ?? '', toolCalls: options.toolCalls ?? [] },
    ...(options.completedAt ? { completedAt: options.completedAt } : {}),
  })
}

async function rolloutFile(lines: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'zcode-transcript-'))
  dirs.push(dir)
  const path = join(dir, 'model-io-session-1.jsonl')
  await writeFile(path, lines.join('\n') + '\n')
  return path
}

describe('ZCode rollout parser', () => {
  it('folds same-turn lines, correlates tool results across the file, and keeps the final answer', async () => {
    const path = await rolloutFile([
      rolloutLine('t1', { user: 'first question', toolCalls: [{ id: 'c1', name: 'Bash', input: { command: 'pwd' } }] }),
      rolloutLine('t1', { toolOutput: { callId: 'c1', output: '/project' }, text: 'intermediate' }),
      rolloutLine('t1', { text: 'final answer one' }),
    ])
    const result = readUnseenRolloutTurns(path, null)
    expect(result).toMatchObject({ available: true, lastTurnId: 't1' })
    expect(result.turns).toHaveLength(1)
    expect(result.turns[0]).toMatchObject({
      user: 'first question',
      assistant: 'final answer one',
      turnId: 't1',
    })
    expect(result.turns[0]?.assistantToolCalls).toEqual([{ name: 'Bash', arguments: { command: 'pwd' }, result: '/project' }])
  })

  it('resumes from the cursor and cleans injected context from user text', async () => {
    const path = await rolloutFile([
      rolloutLine('t1', { user: '<stratagate_memory batch_id="b">evidence</stratagate_memory>clean question<system-reminder>x</system-reminder>' }),
      rolloutLine('t1', { text: 'answer one' }),
      rolloutLine('t2', { user: 'second question' }),
      rolloutLine('t2', { text: 'answer two' }),
    ])
    const first = readUnseenRolloutTurns(path, null)
    expect(first.turns.map((turn) => turn.turnId)).toEqual(['t1', 't2'])
    expect(first.turns[0]?.user).toBe('clean question')
    expect(cleanZcodeText('a<system-reminder>b</system-reminder>c')).toBe('ac')

    const resumed = readUnseenRolloutTurns(path, 't1')
    expect(resumed.turns.map((turn) => turn.turnId)).toEqual(['t2'])
    expect(resumed.turns[0]?.user).toBe('second question')
  })

  it('keeps the active turn out of incremental capture and advances the cursor only over delivered turns', async () => {
    const path = await rolloutFile([
      rolloutLine('t1', { user: 'first question' }),
      rolloutLine('t1', { text: 'answer one' }),
      rolloutLine('t2', { user: 'second question', text: 'working…' }),
    ])
    const incremental = readUnseenRolloutTurns(path, null, { completeActive: false })
    expect(incremental.turns.map((turn) => turn.turnId)).toEqual(['t1'])
    expect(incremental.lastTurnId).toBe('t1')

    await writeFile(path, [
      rolloutLine('t1', { user: 'first question' }),
      rolloutLine('t1', { text: 'answer one' }),
      rolloutLine('t2', { user: 'second question', text: 'working…' }),
      rolloutLine('t2', { text: 'answer two' }),
    ].join('\n') + '\n')
    const stopped = readUnseenRolloutTurns(path, incremental.lastTurnId, { completeActive: true })
    expect(stopped.turns).toHaveLength(1)
    expect(stopped.turns[0]).toMatchObject({ user: 'second question', assistant: 'answer two', turnId: 't2' })
  })

  it('does not advance the cursor past a lone active turn', async () => {
    const path = await rolloutFile([
      rolloutLine('t1', { user: 'only turn', text: 'partial' }),
    ])
    const incremental = readUnseenRolloutTurns(path, null, { completeActive: false })
    expect(incremental.turns).toHaveLength(0)
    expect(incremental.lastTurnId).toBeNull()
  })

  it('falls back to per-line turns when the rollout has no turnIds and drops the active line incrementally', async () => {
    const path = await rolloutFile([
      rolloutLine(null, { user: 'unkeyed one', text: 'a' }),
      rolloutLine(null, { user: 'unkeyed two', text: 'b' }),
    ])
    const complete = readUnseenRolloutTurns(path, null, { completeActive: true })
    expect(complete.turns.map((turn) => turn.user)).toEqual(['unkeyed one', 'unkeyed two'])
    const incremental = readUnseenRolloutTurns(path, null, { completeActive: false })
    expect(incremental.turns.map((turn) => turn.user)).toEqual(['unkeyed one'])
    expect(incremental.lastTurnId).toBeNull()
  })

  it('falls back to stdin fields when no rollout exists', () => {
    const fallback = buildZcodeTurns(
      { session_id: 's', prompt: 'fallback question', responseText: 'fallback answer' },
      {},
      { rolloutPath: null },
    )
    expect(fallback.available).toBe(false)
    expect(fallback.turns).toEqual([{ user: 'fallback question', assistant: 'fallback answer' }])
    expect(fallback.lastTurnId).toBeNull()
  })
})
