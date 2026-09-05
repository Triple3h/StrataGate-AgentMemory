import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { WorkBuddyConfig } from './config.js'
import type { BatchResult, BlockQueryScope, RecordUseResult } from './contracts.js'
import { FileOutbox, outboxDirectory, type OutboxItem } from '@diqier/stratagate'
import { connectionEnv } from './connection.js'

export interface GatewayClientOptions {
  baseUrl?: string
  socketPath?: string
  token?: string
  timeoutMs?: number
  fallback?: boolean
}

export interface GatewayTurnRequest {
  user: string
  assistant: string
  userId?: string
  agentId?: string
  sourceAdapter?: string
  projectId?: string
  projectName?: string
  projectDir?: string
  namespace?: string
  memoryScope?: WorkBuddyConfig['memoryScope']
  conversationId?: string
  threadId?: string
  receiptId?: string
  createdAt?: string
  userToolCalls?: unknown[]
  assistantToolCalls?: unknown[]
}

export function gatewayOptions(env: NodeJS.ProcessEnv = process.env): GatewayClientOptions {
  env = connectionEnv(env)
  const baseUrl = env.STRATAGATE_GATEWAY_URL?.trim() || 'http://127.0.0.1:43731'
  const socketPath = env.STRATAGATE_GATEWAY_SOCKET?.trim() || undefined
  const timeout = Number(env.STRATAGATE_GATEWAY_TIMEOUT_MS ?? 500)
  return {
    baseUrl,
    ...(socketPath ? { socketPath } : {}),
    ...(env.STRATAGATE_GATEWAY_TOKEN?.trim() ? { token: env.STRATAGATE_GATEWAY_TOKEN.trim() } : {}),
    timeoutMs: Number.isSafeInteger(timeout) && timeout > 0 ? Math.min(timeout, 30_000) : 500,
    // Local SQLite fallback is opt-in during migration; Gateway-only is the default.
    fallback: env.STRATAGATE_GATEWAY_FALLBACK === '1',
  }
}

function query(params: Record<string, string | undefined>): string {
  const value = new URLSearchParams()
  for (const [key, item] of Object.entries(params)) if (item) value.set(key, item)
  const encoded = value.toString()
  return encoded ? `?${encoded}` : ''
}

export class GatewayClientError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

function transient(status: number): boolean { return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500 }

export class GatewayClient {
  readonly options: Required<Pick<GatewayClientOptions, 'baseUrl' | 'timeoutMs' | 'fallback'>> & GatewayClientOptions

  constructor(options: GatewayClientOptions = gatewayOptions()) {
    this.options = {
      baseUrl: options.baseUrl ?? 'http://127.0.0.1:43731',
      timeoutMs: options.timeoutMs ?? 500,
      fallback: options.fallback ?? false,
      ...options,
    }
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): GatewayClient {
    return new GatewayClient(gatewayOptions(env))
  }

  async ingest(input: GatewayTurnRequest): Promise<Record<string, unknown>> {
    return this.call('/v1/ingest/turn', { method: 'POST', body: input }) as Promise<Record<string, unknown>>
  }

  /** Deliver a turn without blocking the host when the Gateway is unavailable. */
  async ingestWithOutbox(input: GatewayTurnRequest): Promise<Record<string, unknown>> {
    try { return await this.ingest(input) }
    catch (error) {
      if (!(error instanceof GatewayClientError) || !transient(error.status)) throw error
      const item = await new FileOutbox().enqueue({ method: 'POST', path: '/v1/ingest/turn', body: input, ...(input.receiptId ? { receiptId: input.receiptId } : {}) }, error)
      return { accepted: false, queued: true, receiptId: input.receiptId ?? null, outboxId: item.id }
    }
  }

  async context(params: Record<string, string | undefined>): Promise<Record<string, unknown>> {
    return this.call(`/v1/context${query(params)}`) as Promise<Record<string, unknown>>
  }

  async memory(kind: string, params: Record<string, string | undefined>): Promise<unknown> {
    const route = kind.split('/').map((part) => encodeURIComponent(part)).join('/')
    return this.call(`/v1/memory/${route}${query(params)}`)
  }

  async memoryPost(kind: string, params: Record<string, string | undefined>, body: unknown): Promise<unknown> {
    const route = kind.split('/').map((part) => encodeURIComponent(part)).join('/')
    return this.call(`/v1/memory/${route}${query(params)}`, { method: 'POST', body })
  }

  async status(): Promise<unknown> { return this.call('/v1/status') }

  async snapshot(namespace: string): Promise<unknown> { return this.call(`/v1/console/snapshot${query({ namespace })}`) }
  async repairCodex(body: unknown): Promise<unknown> { return this.call('/v1/admin/codex-provenance', { method: 'POST', body }) }

  async expandBlock(params: Record<string, string | undefined>): Promise<unknown> {
    return this.call(`/v1/memory/blocks/expand${query(params)}`, { method: 'PATCH' })
  }

  private async call(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
    const url = new URL(path, this.options.baseUrl)
    const headers: Record<string, string> = { accept: 'application/json' }
    if (this.options.token) headers.authorization = `Bearer ${this.options.token}`
    let response: { statusCode?: number; body: string }
    const attempt = async (): Promise<{ statusCode?: number; body: string }> => {
      if (this.options.socketPath) return await new Promise((resolve, reject) => {
        const req = httpRequest({ socketPath: this.options.socketPath, path: `${url.pathname}${url.search}`, method: init.method ?? 'GET', headers: { ...headers, ...(init.body ? { 'content-type': 'application/json' } : {}) } }, (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
          res.on('end', () => resolve({ ...(res.statusCode === undefined ? {} : { statusCode: res.statusCode }), body: Buffer.concat(chunks).toString('utf8') }))
        })
        req.setTimeout(this.options.timeoutMs, () => req.destroy(new Error('Memory Gateway request timed out')))
        req.on('error', reject)
        if (init.body !== undefined) req.write(JSON.stringify(init.body))
        req.end()
      })
      else {
      const transport = url.protocol === 'https:' ? httpsRequest : httpRequest
      return await new Promise((resolve, reject) => {
        const req = transport(url, { method: init.method ?? 'GET', headers: { ...headers, ...(init.body ? { 'content-type': 'application/json' } : {}) } }, (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
          res.on('end', () => resolve({ ...(res.statusCode === undefined ? {} : { statusCode: res.statusCode }), body: Buffer.concat(chunks).toString('utf8') }))
        })
        req.setTimeout(this.options.timeoutMs, () => req.destroy(new Error('Memory Gateway request timed out')))
        req.on('error', reject)
        if (init.body !== undefined) req.write(JSON.stringify(init.body))
        req.end()
      })
      }
    }
    let lastError: unknown
    for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
      try {
        response = await attempt()
        break
      } catch (error) {
        lastError = error
        if (attemptIndex === 1) throw new GatewayClientError(0, error instanceof Error ? error.message : String(error))
      }
    }
    if (!response!) throw new GatewayClientError(0, lastError instanceof Error ? lastError.message : 'Gateway request failed')
    const status = response.statusCode ?? 500
    let parsed: unknown
    try { parsed = response.body ? JSON.parse(response.body) : null } catch { parsed = response.body }
    if (status < 200 || status >= 300) {
      const message = parsed && typeof parsed === 'object' && 'error' in parsed ? String((parsed as { error: unknown }).error) : `Gateway HTTP ${status}`
      throw new GatewayClientError(status, message)
    }
    return parsed
  }
}

export async function replayGatewayOutbox(client = GatewayClient.fromEnv(), outbox = new FileOutbox(outboxDirectory())): Promise<{ sent: number; failed: number; skipped: number }> {
  return outbox.replay(async (item: OutboxItem) => {
    if (item.path !== '/v1/ingest/turn' || item.method !== 'POST') throw new Error(`Unsupported outbox request: ${item.method} ${item.path}`)
    await client.ingest(item.body as unknown as GatewayTurnRequest)
  })
}

/** Runtime-shaped adapter used by MCP hosts after Gateway migration. */
export class GatewayRuntime {
  constructor(readonly config: WorkBuddyConfig, readonly client = GatewayClient.fromEnv()) {}

  private identity(sessionId?: string): Record<string, string | undefined> {
    return {
      userId: this.config.userId, agentId: this.config.agentId, sourceAdapter: this.config.sourceAdapter ?? this.config.agentId,
      projectId: this.config.projectId, projectName: this.config.projectName, projectDir: this.config.projectDir, namespace: this.config.namespace,
      memoryScope: this.config.memoryScope,
      conversationId: sessionId ?? process.env.STRATAGATE_SESSION_ID ?? process.env.CODEX_THREAD_ID,
    }
  }

  async initialContext(sessionId: string, queryText: string): Promise<{ batch: BatchResult | null; context: string }> {
    return this.client.context({ q: queryText, ...this.identity(sessionId) }) as Promise<{ batch: BatchResult | null; context: string }>
  }
  async recall(queryText: string, sessionId?: string): Promise<BatchResult> {
    return this.client.memory('search', { q: queryText, ...this.identity(sessionId) }) as Promise<BatchResult>
  }
  async searchEvents(queryText: string, sessionId?: string, options: { limit?: number } = {}): Promise<BatchResult> {
    return this.client.memory('events', { q: queryText, limit: options.limit?.toString(), ...this.identity(sessionId) }) as Promise<BatchResult>
  }
  async searchElements(queryText: string, sessionId?: string, options: { limit?: number; name?: string; type?: string } = {}): Promise<BatchResult> {
    return this.client.memory('elements', { q: queryText, limit: options.limit?.toString(), name: options.name, elementType: options.type, ...this.identity(sessionId) }) as Promise<BatchResult>
  }
  async searchGraph(queryText: string, sessionId?: string, limit = 8): Promise<BatchResult> {
    return this.client.memory('graph', { q: queryText, limit: String(limit), ...this.identity(sessionId) }) as Promise<BatchResult>
  }
  async searchRaw(queryText: string, sessionId?: string, limit?: number, scope: BlockQueryScope = 'namespace'): Promise<BatchResult> {
    return this.client.memory('raw', { q: queryText, limit: limit?.toString(), scope, ...this.identity(sessionId) }) as Promise<BatchResult>
  }
  async getBlocks(sessionId?: string, scope: BlockQueryScope = 'session'): Promise<BatchResult> {
    return this.client.memory('blocks', { scope, ...this.identity(sessionId) }) as Promise<BatchResult>
  }
  async expandEvent(batchId: string, eventId: string): Promise<BatchResult> {
    return this.client.memory('events/expand', { batchId, id: eventId, ...this.identity() }) as Promise<BatchResult>
  }
  async expandElement(batchId: string, elementId: string, at?: string): Promise<BatchResult> {
    return this.client.memory('elements/expand', { batchId, id: elementId, at, ...this.identity() }) as Promise<BatchResult>
  }
  async expandGraphNode(batchId: string, nodeId: string): Promise<BatchResult> {
    return this.client.memory('graph/expand', { batchId, id: nodeId, ...this.identity() }) as Promise<BatchResult>
  }
  async expandBlock(batchId: string, blockId: string, target?: string | number): Promise<BatchResult> {
    return this.client.expandBlock({ batchId, blockId, target: target === undefined ? undefined : String(target), ...this.identity() }) as Promise<BatchResult>
  }
  async assess(batchId: string, input: unknown): Promise<unknown> {
    return this.client.memoryPost('assess', {}, { ...this.identity(), batchId, ...(input as object) })
  }
  async recordUse(assessmentId: string): Promise<RecordUseResult> {
    return this.client.memoryPost('record-use', {}, { ...this.identity(), assessmentId }) as Promise<RecordUseResult>
  }
  async status(): Promise<unknown> { return this.client.status() }
  async processPending(): Promise<unknown> { return this.status() }
}
