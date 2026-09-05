import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { FileOutbox } from '@diqier/stratagate'

export interface DshGatewayIdentity {
  userId?: string
  agentId?: string
  sourceAdapter: string
  projectId: string
  projectName?: string
  projectDir: string
  namespace: string
  memoryScope: 'project' | 'session' | 'global'
  conversationId: string
}

interface ClientOptions {
  baseUrl: string
  socketPath?: string
  token?: string
  timeoutMs: number
}

export class DshGatewayClientError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

function transient(status: number): boolean { return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500 }

function options(env: NodeJS.ProcessEnv = process.env): ClientOptions {
  const timeout = Number(env.STRATAGATE_GATEWAY_TIMEOUT_MS ?? 500)
  return {
    baseUrl: env.STRATAGATE_GATEWAY_URL?.trim() || 'http://127.0.0.1:43731',
    ...(env.STRATAGATE_GATEWAY_SOCKET?.trim() ? { socketPath: env.STRATAGATE_GATEWAY_SOCKET.trim() } : {}),
    ...(env.STRATAGATE_GATEWAY_TOKEN?.trim() ? { token: env.STRATAGATE_GATEWAY_TOKEN.trim() } : {}),
    timeoutMs: Number.isSafeInteger(timeout) && timeout > 0 ? Math.min(timeout, 30_000) : 500,
  }
}

function query(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export class DshGatewayClient {
  private readonly config: ClientOptions

  constructor(config = options()) { this.config = config }

  /** Gateway is the primary DSH path; local SQLite is only a compatibility fallback. */
  get enabled(): boolean {
    // Vitest exercises the in-process engine directly; production hosts default to Gateway.
    return process.env.STRATAGATE_DISABLE_GATEWAY !== '1' && process.env.VITEST !== 'true'
  }
  get fallback(): boolean { return process.env.STRATAGATE_GATEWAY_FALLBACK === '1' }

  async ingest(identity: DshGatewayIdentity, body: Record<string, unknown>): Promise<unknown> {
    return this.call('/v1/ingest/turn', { method: 'POST', body: { ...identity, ...body } })
  }

  async ingestWithOutbox(identity: DshGatewayIdentity, body: Record<string, unknown>): Promise<unknown> {
    try { return await this.ingest(identity, body) }
    catch (error) {
      const status = error instanceof Error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
      if (!transient(status)) throw error
      const request = { ...identity, ...body }
      const item = await new FileOutbox().enqueue({ method: 'POST', path: '/v1/ingest/turn', body: request, ...(typeof body.receiptId === 'string' ? { receiptId: body.receiptId } : {}) }, error)
      return { accepted: false, queued: true, receiptId: body.receiptId ?? null, outboxId: item.id }
    }
  }

  async context(identity: DshGatewayIdentity, q: string): Promise<unknown> {
    return this.call(`/v1/context${query({ ...identity, q })}`)
  }

  async memory(kind: string, identity: DshGatewayIdentity, values: Record<string, string | undefined> = {}): Promise<unknown> {
    const route = kind.split('/').map((part) => encodeURIComponent(part)).join('/')
    return this.call(`/v1/memory/${route}${query({ ...identity, ...values })}`)
  }

  async assess(identity: DshGatewayIdentity, batchId: string, input: unknown): Promise<unknown> {
    return this.call('/v1/memory/assess', { method: 'POST', body: { ...identity, batchId, ...(input as object) } })
  }

  async recordUse(identity: DshGatewayIdentity, assessmentId: string): Promise<unknown> {
    return this.call('/v1/memory/record-use', { method: 'POST', body: { ...identity, assessmentId } })
  }

  async expandBlock(identity: DshGatewayIdentity, batchId: string, blockId: string, target?: string | number): Promise<unknown> {
    return this.call(`/v1/memory/blocks/expand${query({ ...identity, batchId, blockId, target: target === undefined ? undefined : String(target) })}`, { method: 'PATCH' })
  }

  private async call(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
    const url = new URL(path, this.config.baseUrl)
    const headers: Record<string, string> = { accept: 'application/json' }
    if (this.config.token) headers.authorization = `Bearer ${this.config.token}`
    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const request = (done: (value: { status: number; body: string }) => void, fail: (reason?: unknown) => void): void => {
        const transport = this.config.socketPath ? httpRequest({
          socketPath: this.config.socketPath,
          path: `${url.pathname}${url.search}`,
          method: init.method ?? 'GET',
          headers: { ...headers, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }) },
        }, onResponse(done)) : (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
          method: init.method ?? 'GET',
          headers: { ...headers, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }) },
        }, onResponse(done))
        transport.setTimeout(this.config.timeoutMs, () => transport.destroy(new Error('Memory Gateway request timed out')))
        transport.once('error', fail)
        if (init.body !== undefined) transport.write(JSON.stringify(init.body))
        transport.end()
      }
      const onResponse = (done: (value: { status: number; body: string }) => void) => (res: import('node:http').IncomingMessage): void => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        res.on('end', () => done({ status: res.statusCode ?? 500, body: Buffer.concat(chunks).toString('utf8') }))
      }
      request(resolve, reject)
    })
    let parsed: unknown
    try { parsed = response.body ? JSON.parse(response.body) : null } catch { parsed = response.body }
    if (response.status < 200 || response.status >= 300) {
      const message = parsed && typeof parsed === 'object' && 'error' in parsed ? String((parsed as { error: unknown }).error) : `Gateway HTTP ${response.status}`
      throw new DshGatewayClientError(response.status, message)
    }
    return parsed
  }
}
