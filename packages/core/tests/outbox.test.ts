import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FileOutbox } from '../src/outbox.js'

describe('FileOutbox', () => {
  it('writes idempotently with atomic files and redacts credentials', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stratagate-outbox-'))
    const outbox = new FileOutbox(directory)
    const request = { method: 'POST' as const, path: '/v1/ingest/turn', receiptId: 'receipt-1', body: { user: 'hello', token: 'do-not-save', assistant: 'Bearer abcdefghijklmnop' } }
    const first = await outbox.enqueue(request)
    const second = await outbox.enqueue(request)
    expect(first.id).toBe(second.id)
    expect((await outbox.list())).toHaveLength(1)
    const raw = await readFile(join(directory, `${first.id}.json`), 'utf8')
    expect(raw).not.toContain('do-not-save')
    expect(raw).toContain('[REDACTED]')
    expect(raw).not.toContain('abcdefghijklmnop')
  })

  it('marks attempts before send and retries with exponential backoff', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stratagate-outbox-'))
    const outbox = new FileOutbox(directory, { baseDelayMs: 100, maxDelayMs: 1_000, maxAttempts: 3 })
    await outbox.enqueue({ method: 'POST', path: '/v1/ingest/turn', receiptId: 'receipt-2', body: {} })
    let calls = 0
    const failed = await outbox.replay(async () => { calls += 1; throw new Error('gateway down') })
    expect(failed).toMatchObject({ failed: 1, sent: 0 })
    expect(calls).toBe(1)
    const item = (await outbox.list())[0]
    expect(item).toBeDefined()
    if (!item) throw new Error('outbox item missing')
    expect(item.attempts).toBe(1)
    expect(Date.parse(item.nextRetryAt)).toBeGreaterThanOrEqual(Date.now())
    const skipped = await outbox.replay(async () => undefined)
    expect(skipped.skipped).toBe(1)
    const sent = await outbox.replay(async () => undefined, new Date(Date.now() + 1_000))
    expect(sent.sent).toBe(1)
    expect((await outbox.list())).toHaveLength(0)
  })
})
