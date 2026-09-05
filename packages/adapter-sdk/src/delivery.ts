import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, readdir, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { GatewayClient, type GatewayTurnRequest } from './gateway-client.js'

export async function atomicJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  const handle = await open(temporary, 'wx', 0o600)
  try { await handle.writeFile(JSON.stringify(value) + '\n'); await handle.sync() }
  finally { await handle.close() }
  await rename(temporary, path)
}

interface Delivery {
  request: GatewayTurnRequest
  capturedAt: string
  attempts: number
  lastStatus?: number
  deliveredAt?: string
}

/** Source-preserving journal. A receipt remains after delivery for local deduplication. */
export class DeliveryJournal {
  constructor(readonly directory: string) {}
  private path(receipt: string): string { return join(this.directory, createHash('sha256').update(receipt).digest('hex') + '.json') }
  async enqueue(request: GatewayTurnRequest): Promise<void> {
    if (!request.receiptId) throw new Error('A stable receipt is required')
    const path = this.path(request.receiptId)
    try { await readFile(path); return } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    await atomicJson(path, { request, capturedAt: new Date().toISOString(), attempts: 0 } satisfies Delivery)
  }
  async entries(): Promise<Array<{ path: string; value: Delivery }>> {
    let names: string[]
    try { names = await readdir(this.directory) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
    return Promise.all(names.filter(n => n.endsWith('.json')).map(async n => ({ path: join(this.directory, n), value: JSON.parse(await readFile(join(this.directory, n), 'utf8')) as Delivery })))
  }
  async flush(client: GatewayClient, limit = 100): Promise<{ sent: number; pending: number; status?: number }> {
    let sent = 0
    let status: number | undefined
    const entries = (await this.entries()).filter(e => !e.value.deliveredAt).sort((a, b) => a.value.capturedAt.localeCompare(b.value.capturedAt))
    for (const { path, value } of entries.slice(0, limit)) {
      // Concurrent hooks may send the same receipt; Gateway is the final idempotency boundary.
      try {
        const result = await client.ingest(value.request)
        if (result.accepted !== true && result.duplicate !== true) throw new Error('Gateway did not acknowledge the receipt')
        await atomicJson(path, { ...value, attempts: value.attempts + 1, deliveredAt: new Date().toISOString() })
        sent += 1
      } catch (error) {
        status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 0
        await atomicJson(path, { ...value, attempts: value.attempts + 1, lastStatus: status })
        break
      }
    }
    return { sent, pending: entries.length - sent, ...(status === undefined ? {} : { status }) }
  }
}
