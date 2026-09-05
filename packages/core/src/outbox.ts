import { createHash } from 'node:crypto'
import { mkdir, open, readFile, readdir, rename, unlink, writeFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { redactSensitiveText } from './security.js'

export interface OutboxRequest {
  method: 'POST' | 'PUT' | 'PATCH'
  path: string
  body: unknown
  receiptId?: string
}

export interface OutboxItem extends OutboxRequest {
  id: string
  createdAt: string
  attempts: number
  nextRetryAt: string
  lastError?: string
}

export interface OutboxStatus {
  directory: string
  pending: number
  due: number
  deadLetter: number
  oldestCreatedAt: string | null
}

const MAX_ATTEMPTS = 20
const MAX_ERROR_LENGTH = 1_000

function now(): string { return new Date().toISOString() }

function safe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safe)
  if (typeof value === 'string') return redactSensitiveText(value)
  if (!value || typeof value !== 'object') return value
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (/(token|authorization|password|secret|api[-_]?key|credential)/iu.test(key)) result[key] = '[REDACTED]'
    else result[key] = safe(item)
  }
  return result
}

function idFor(request: OutboxRequest): string {
  const identity = request.receiptId || JSON.stringify({ path: request.path, body: request.body })
  return createHash('sha256').update(identity).digest('hex')
}

export function outboxDirectory(dataDir = process.env.STRATAGATE_DATA_DIR): string {
  const explicit = process.env.STRATAGATE_OUTBOX_DIR?.trim()
  return resolve(explicit || join(dataDir?.trim() || join(homedir(), '.stratagate', 'agent-memory'), 'outbox'))
}

export class FileOutbox {
  readonly directory: string
  readonly maxAttempts: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number

  constructor(directory = outboxDirectory(), options: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number } = {}) {
    this.directory = resolve(directory)
    this.maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS
    this.baseDelayMs = options.baseDelayMs ?? 1_000
    this.maxDelayMs = options.maxDelayMs ?? 300_000
  }

  private file(id: string): string { return join(this.directory, `${id}.json`) }

  async enqueue(request: OutboxRequest, error?: unknown): Promise<OutboxItem> {
    await mkdir(this.directory, { recursive: true })
    const id = idFor(request)
    const target = this.file(id)
    try { return JSON.parse(await readFile(target, 'utf8')) as OutboxItem } catch { /* new item */ }
    const item: OutboxItem = {
      ...(safe(request) as OutboxRequest),
      id,
      createdAt: now(),
      attempts: 0,
      nextRetryAt: now(),
      ...(error ? { lastError: redactSensitiveText(String(error)).slice(0, MAX_ERROR_LENGTH) } : {}),
    }
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporary, `${JSON.stringify(item)}\n`, { mode: 0o600 })
    await rename(temporary, target)
    return item
  }

  async list(): Promise<OutboxItem[]> {
    let names: string[]
    try { names = await readdir(this.directory) } catch { return [] }
    const items: OutboxItem[] = []
    for (const name of names.filter((value) => value.endsWith('.json'))) {
      try { items.push(JSON.parse(await readFile(join(this.directory, name), 'utf8')) as OutboxItem) } catch { /* ignore partial/corrupt files */ }
    }
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async status(at = new Date()): Promise<OutboxStatus> {
    const items = await this.list()
    const due = items.filter((item) => item.attempts < this.maxAttempts && Date.parse(item.nextRetryAt) <= at.getTime()).length
    return {
      directory: this.directory,
      pending: items.filter((item) => item.attempts < this.maxAttempts).length,
      due,
      deadLetter: items.filter((item) => item.attempts >= this.maxAttempts).length,
      oldestCreatedAt: items[0]?.createdAt ?? null,
    }
  }

  private async save(item: OutboxItem): Promise<void> {
    const target = this.file(item.id)
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporary, `${JSON.stringify(item)}\n`, { mode: 0o600 })
    await rename(temporary, target)
  }

  private async lock(id: string): Promise<(() => Promise<void>) | null> {
    const path = `${this.file(id)}.lock`
    try {
      const handle = await open(path, 'wx', 0o600)
      await handle.close()
      return async () => { await unlink(path).catch(() => undefined) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      try {
        const info = await stat(path)
        if (Date.now() - info.mtimeMs > 10 * 60_000) {
          await unlink(path)
          return this.lock(id)
        }
      } catch { /* another replay may have released it */ }
      return null
    }
  }

  async replay(sender: (item: OutboxItem) => Promise<unknown>, at = new Date()): Promise<{ sent: number; failed: number; skipped: number }> {
    let sent = 0; let failed = 0; let skipped = 0
    for (const original of await this.list()) {
      if (original.attempts >= this.maxAttempts || Date.parse(original.nextRetryAt) > at.getTime()) { skipped += 1; continue }
      const unlock = await this.lock(original.id)
      if (!unlock) { skipped += 1; continue }
      const item = { ...original, attempts: original.attempts + 1, nextRetryAt: new Date(at.getTime() + this.delay(original.attempts + 1)).toISOString() }
      try {
        await this.save(item)
        await sender(item)
        await unlink(this.file(item.id)).catch(() => undefined)
        sent += 1
      } catch (error) {
        failed += 1
        await this.save({ ...item, lastError: redactSensitiveText(String(error)).slice(0, MAX_ERROR_LENGTH) })
      } finally {
        await unlock()
      }
    }
    return { sent, failed, skipped }
  }

  private delay(attempt: number): number { return Math.min(this.maxDelayMs, this.baseDelayMs * (2 ** Math.max(0, attempt - 1))) }
}
