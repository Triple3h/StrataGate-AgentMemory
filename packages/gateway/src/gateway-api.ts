import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { constantTimeTokenEqual, FileOutbox, memoryNamespace, outboxDirectory, projectKey, projectNameFromDir, redactSensitiveText, redactSensitiveValue, type StrataGateSnapshot } from '@diqier/stratagate'
import { atomicJson } from '../../adapter-sdk/src/delivery.js'
import { SqliteStorage } from '@diqier/stratagate/sqlite'
import { resolveConfig, type WorkBuddyConfig } from '../../adapter-sdk/src/config.js'
import { MemoryRuntime as WorkBuddyRuntime } from './runtime.js'
import { testModelConfig } from './model.js'
import { MEMORY_CONSOLE_HTML } from './gateway-ui.js'
import { isConsolePath } from './console-routes.js'
import {
  ProviderConfigError,
  clearStoredModelProvider,
  loadStoredModelProvider,
  maskApiKey,
  parseProviderInput,
  providerFilePath,
  saveModelProvider,
  toModelConfig,
  type StoredModelProvider,
} from './provider-config.js'

const DEFAULT_PORT = 43_731

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

export interface GatewayLimits {
  maxBodyBytes: number
  maxConcurrentRequests: number
  maxQueueLength: number
  requestTimeoutMs: number
  rateLimitPerMinute: number
}

export function gatewayLimits(env: NodeJS.ProcessEnv = process.env): GatewayLimits {
  return {
    maxBodyBytes: boundedInteger(env.STRATAGATE_GATEWAY_MAX_BODY_BYTES, 4 * 1024 * 1024, 16 * 1024, 16 * 1024 * 1024),
    maxConcurrentRequests: boundedInteger(env.STRATAGATE_GATEWAY_MAX_CONCURRENT_REQUESTS, 64, 1, 512),
    maxQueueLength: boundedInteger(env.STRATAGATE_GATEWAY_MAX_QUEUE_LENGTH, 256, 1, 10_000),
    requestTimeoutMs: boundedInteger(env.STRATAGATE_GATEWAY_REQUEST_TIMEOUT_MS, 30_000, 100, 300_000),
    rateLimitPerMinute: boundedInteger(env.STRATAGATE_GATEWAY_RATE_LIMIT_PER_MINUTE, 600, 0, 100_000),
  }
}

export interface GatewayTurnInput {
  user: string
  assistant: string
  userId?: string | undefined
  agentId?: string | undefined
  sourceAdapter?: string | undefined
  projectId?: string | undefined
  projectName?: string | undefined
  projectDir?: string | undefined
  namespace?: string | undefined
  memoryScope?: 'project' | 'session' | 'global' | undefined
  conversationId?: string | undefined
  threadId?: string | undefined
  receiptId?: string | undefined
  createdAt?: string | undefined
  userToolCalls?: unknown[] | undefined
  assistantToolCalls?: unknown[] | undefined
}

interface GatewayIdentity {
  config: WorkBuddyConfig
  namespace: string
  sessionId: string
}

export class GatewayHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

function text(value: unknown, field: string, required = false, max = 200): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new GatewayHttpError(400, `${field} is required`)
    return undefined
  }
  if (typeof value !== 'string') throw new GatewayHttpError(400, `${field} must be a string`)
  const result = value.trim()
  if (required && !result) throw new GatewayHttpError(400, `${field} must not be empty`)
  if (result.length > max) throw new GatewayHttpError(400, `${field} is too long`)
  return result || undefined
}

function queryText(url: URL, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = text(url.searchParams.get(name), name)
    if (value) return value
  }
  return undefined
}

function defined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>
}

function configFor(base: WorkBuddyConfig, input: Partial<GatewayTurnInput>): GatewayIdentity {
  const explicitNamespace = text(input.namespace, 'namespace', false, 300)
  const namespaceUserId = explicitNamespace?.match(/:user:([^:]+):scope:/u)?.[1]
  if (explicitNamespace && namespaceUserId && namespaceUserId !== base.userId && process.env.STRATAGATE_GATEWAY_ALLOW_MULTIUSER !== '1') {
    throw new GatewayHttpError(403, 'namespace belongs to a different user')
  }
  const userId = text(input.userId, 'userId') ?? namespaceUserId ?? base.userId
  const agentId = text(input.agentId, 'agentId') ?? base.agentId
  const projectDir = resolve(text(input.projectDir, 'projectDir') ?? base.projectDir)
  const namespaceProjectId = explicitNamespace?.match(/:scope:project:(.+)$/u)?.[1]
  const projectId = text(input.projectId, 'projectId') ?? namespaceProjectId ?? base.projectId ?? projectKey(projectDir)
  const projectName = text(input.projectName, 'projectName', false, 200) ?? base.projectName ?? projectNameFromDir(projectDir)
  const memoryScope = input.memoryScope ?? base.memoryScope
  if (!['project', 'session', 'global'].includes(memoryScope)) throw new GatewayHttpError(400, 'memoryScope must be project, session, or global')
  const conversationId = text(input.conversationId, 'conversationId') ?? text(input.threadId, 'threadId')
  const namespacePrefix = base.namespacePrefix ?? 'shared'
  const namespace = explicitNamespace ?? (memoryScope === 'project'
    ? `${namespacePrefix}:user:${userId}:scope:project:${projectId}`
    : memoryNamespace({
      userId,
      memoryScope,
      projectDir,
      ...(conversationId ? { sessionId: conversationId } : {}),
      namespacePrefix,
    }))
  if (explicitNamespace) {
    const expected = memoryScope === 'project'
      ? `${namespacePrefix}:user:${userId}:scope:project:${projectId}`
      : memoryNamespace({ userId, memoryScope, projectDir, ...(conversationId ? { sessionId: conversationId } : {}), namespacePrefix })
    if (explicitNamespace !== expected && explicitNamespace !== base.namespace) {
      throw new GatewayHttpError(403, 'namespace does not match the supplied identity')
    }
  }
  return {
    namespace,
    sessionId: conversationId ?? 'gateway-session',
    config: {
      ...base,
      projectDir,
      projectId,
      projectName,
      userId,
      agentId,
      namespace,
      memoryScope,
      namespacePrefix,
    },
  }
}

function numberParam(url: URL, name: string, fallback: number, max: number): number {
  const raw = url.searchParams.get(name)
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new GatewayHttpError(400, `${name} must be an integer between 1 and ${max}`)
  return value
}

async function readJson(req: IncomingMessage, maxBodyBytes: number): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += value.length
    if (size > maxBodyBytes) throw new GatewayHttpError(413, `请求体不能超过 ${Math.round(maxBodyBytes / 1024 / 1024)} MB`)
    chunks.push(value)
  }
  if (chunks.length === 0) throw new GatewayHttpError(400, '请求缺少 JSON body')
  let parsed: unknown
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new GatewayHttpError(400, '请求体必须是合法 JSON') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new GatewayHttpError(400, '请求体必须是 JSON object')
  return parsed as Record<string, unknown>
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(redactSensitiveValue(body))
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(payload)
}

function html(res: ServerResponse): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(MEMORY_CONSOLE_HTML)
}

function auth(req: IncomingMessage, token: string | undefined): void {
  if (!token) return
  const authorization = String(req.headers.authorization ?? '')
  const supplied = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : String(req.headers['x-stratagate-gateway-token'] ?? '').trim()
  if (!supplied || !constantTimeTokenEqual(token, supplied)) throw new GatewayHttpError(401, 'Memory Gateway authorization required')
}

export class MemoryGateway {
  private readonly runtimes = new Map<string, WorkBuddyRuntime>()
  private readonly processing = new Map<string, Promise<unknown>>()
  private readonly ingestLocks = new Map<string, Promise<unknown>>()
  // Adapter worker ticks are throttled per namespace so a fleet of MCP server
  // processes polling every few seconds cannot keep the gateway aggregating.
  private readonly sweeps = new Map<string, number>()
  private static readonly SWEEP_INTERVAL_MS = 60_000
  private readonly limits = gatewayLimits()
  private activeRequests = 0
  private totalRequests = 0
  private totalErrors = 0
  private totalRejected = 0
  private readonly rateWindows = new Map<string, { startedAt: number; count: number }>()
  private readonly envModel: WorkBuddyConfig['model']

  constructor(readonly baseConfig: WorkBuddyConfig = resolveConfig(), readonly token = process.env.STRATAGATE_GATEWAY_TOKEN?.trim()) {
    this.envModel = baseConfig.model ? { ...baseConfig.model } : undefined
    // A runtime override saved through /v1/settings/model-provider wins over
    // the boot environment so provider changes survive container recreation.
    const stored = loadStoredModelProvider(baseConfig.dataDir)
    if (stored) this.applyModelProvider(toModelConfig(stored))
  }

  private runtimeFor(identity: GatewayIdentity): WorkBuddyRuntime {
    const current = this.runtimes.get(identity.namespace)
    if (current) return current
    const runtime = new WorkBuddyRuntime(identity.config)
    this.runtimes.set(identity.namespace, runtime)
    return runtime
  }

  private schedule(runtime: WorkBuddyRuntime, namespace: string): void {
    if (this.processing.has(namespace)) return
    const task = runtime.processPending().catch(() => undefined).finally(() => this.processing.delete(namespace))
    this.processing.set(namespace, task)
  }

  /**
   * Cheap worker heartbeat: sweeps the caller's namespace for stranded
   * derivation work (e.g. after a gateway restart) without the full
   * /v1/status dashboard aggregation. At most one sweep per namespace per
   * SWEEP_INTERVAL_MS; runs already in flight are never stacked.
   */
  async workerTick(url: URL): Promise<unknown> {
    const identity = configFor(this.baseConfig, defined({
      userId: queryText(url, 'userId'), agentId: queryText(url, 'agentId'), sourceAdapter: queryText(url, 'sourceAdapter'),
      projectId: queryText(url, 'projectId'), projectDir: queryText(url, 'projectDir'), namespace: queryText(url, 'namespace'),
      memoryScope: queryText(url, 'memoryScope') as GatewayTurnInput['memoryScope'], conversationId: queryText(url, 'conversationId', 'threadId', 'sessionId'),
    }))
    const namespace = identity.namespace
    if (this.processing.has(namespace)) return { namespace, scheduled: false, reason: 'already-processing' }
    const now = Date.now()
    if (now < (this.sweeps.get(namespace) ?? 0)) return { namespace, scheduled: false, reason: 'throttled' }
    this.sweeps.set(namespace, now + MemoryGateway.SWEEP_INTERVAL_MS)
    this.schedule(this.runtimeFor(identity), namespace)
    return { namespace, scheduled: true, reason: 'sweep' }
  }

  async modelProviderView(): Promise<unknown> {
    const stored = loadStoredModelProvider(this.baseConfig.dataDir)
    const current = this.baseConfig.model
    return {
      mode: this.baseConfig.workBuddyModel || current ? 'full' : 'layered-raw',
      source: stored ? 'runtime' : current ? 'env' : 'none',
      baseUrl: current?.baseUrl ?? null,
      model: current?.model ?? null,
      apiKeySet: Boolean(current?.apiKey),
      apiKeyMasked: maskApiKey(current?.apiKey),
      maxOutputTokens: current?.maxOutputTokens ?? null,
      updatedAt: stored?.updatedAt ?? null,
      configFile: providerFilePath(this.baseConfig.dataDir),
      envProvider: this.envModel ? { baseUrl: this.envModel.baseUrl, model: this.envModel.model } : null,
    }
  }

  async updateModelProvider(body: Record<string, unknown>): Promise<unknown> {
    const input = this.parseProviderBody(body)
    const stored = loadStoredModelProvider(this.baseConfig.dataDir)
    // An omitted/blank apiKey means "keep the current one" — the console never
    // round-trips the secret back to the browser.
    const apiKey = input.apiKey ?? stored?.apiKey ?? this.baseConfig.model?.apiKey
    const provider: StoredModelProvider = {
      baseUrl: input.baseUrl,
      model: input.model,
      ...(apiKey ? { apiKey } : {}),
      ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
      updatedAt: new Date().toISOString(),
    }
    await saveModelProvider(this.baseConfig.dataDir, provider)
    this.applyModelProvider(toModelConfig(provider))
    return this.modelProviderView()
  }

  async clearModelProvider(): Promise<unknown> {
    clearStoredModelProvider(this.baseConfig.dataDir)
    this.applyModelProvider(this.envModel ? { ...this.envModel } : undefined)
    return this.modelProviderView()
  }

  async testModelProvider(body: Record<string, unknown>): Promise<unknown> {
    const input = this.parseProviderBody(body)
    const apiKey = input.apiKey ?? this.baseConfig.model?.apiKey
    return testModelConfig({
      baseUrl: input.baseUrl,
      model: input.model,
      ...(apiKey ? { apiKey } : {}),
      maxOutputTokens: input.maxOutputTokens ?? this.baseConfig.model?.maxOutputTokens ?? 10_000,
    })
  }

  private parseProviderBody(body: Record<string, unknown>) {
    try {
      return parseProviderInput(body)
    } catch (error) {
      if (error instanceof ProviderConfigError) throw new GatewayHttpError(400, error.message)
      throw error
    }
  }

  private applyModelProvider(model: WorkBuddyConfig['model']): void {
    this.baseConfig.model = model
    for (const runtime of this.runtimes.values()) runtime.setModelProvider(model)
  }

  async ingest(input: GatewayTurnInput): Promise<unknown> {
    const user = text(input.user, 'user', true, 100_000)!
    const assistant = text(input.assistant, 'assistant', true, 100_000)!
    const identity = configFor(this.baseConfig, input)
    const previous = this.ingestLocks.get(identity.namespace) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>((resolve) => { release = resolve })
    const chain = previous.then(() => current)
    this.ingestLocks.set(identity.namespace, chain)
    await previous
    try {
      const runtime = this.runtimeFor(identity)
      const before = input.receiptId ? await runtime.snapshot() : null
      // Adopt a native Codex receipt for an exactly matching legacy turn. This
      // makes migration/backfill overlap idempotent without rewriting raw text.
      if (before && input.receiptId?.startsWith('codex:v2:') && input.sourceAdapter === 'codex' && input.createdAt) {
        const messages = [...before.openTail, ...before.blocks.flatMap(block => block.l5Raw)]
        const same = messages.filter(message => (message.agentId === 'workbuddy' || /:agent:[^:]+:[0-9a-f]{16}$/.test(message.threadId ?? ''))
          && (message.conversationId ?? message.threadId ?? '').split(':agent:')[0] === input.conversationId
          && Date.parse(message.createdAt) === Date.parse(input.createdAt!))
        const matched = same.some(message => message.role === 'user' && message.content.trim() === user)
          && same.some(message => message.role === 'assistant' && message.content.trim() === assistant)
        if (matched) {
          const storage = new SqliteStorage({ filename: this.baseConfig.database })
          try {
            const loaded = await storage.load(identity.namespace)
            if (loaded && !loaded.snapshot.ingestionReceipts.some(receipt => receipt.id === input.receiptId)) {
              loaded.snapshot.ingestionReceipts.push({ id: input.receiptId, createdAt: new Date().toISOString() })
              await storage.save(identity.namespace, loaded.snapshot, loaded.revision)
            }
          } finally { await storage.close?.() }
          return { accepted: false, duplicate: true, receiptId: input.receiptId, namespace: identity.namespace }
        }
      }
      const turn = defined({
      user,
      assistant,
      ...(input.createdAt ? { createdAt: text(input.createdAt, 'createdAt', false, 80) } : {}),
      ...(input.threadId ? { threadId: text(input.threadId, 'threadId') } : {}),
      ...(input.userId ? { userId: identity.config.userId } : {}),
      ...(input.agentId ? { agentId: identity.config.agentId } : {}),
      ...(input.projectId ? { projectId: identity.config.projectId } : {}),
      ...(input.conversationId ? { conversationId: text(input.conversationId, 'conversationId') } : {}),
      sourceAdapter: text(input.sourceAdapter, 'sourceAdapter') ?? 'gateway',
      ...(input.receiptId ? { receiptId: text(input.receiptId, 'receiptId', true, 300) } : {}),
      ...(Array.isArray(input.userToolCalls) ? { userToolCalls: input.userToolCalls as never } : {}),
      ...(Array.isArray(input.assistantToolCalls) ? { assistantToolCalls: input.assistantToolCalls as never } : {}),
      })
      const result = await runtime.appendTurn(turn as Parameters<WorkBuddyRuntime['appendTurn']>[0]) as Record<string, unknown>
      this.schedule(runtime, identity.namespace)
      const duplicate = Boolean(before && input.receiptId && before.ingestionReceipts.some(({ id }) => id === input.receiptId))
      return { accepted: !duplicate, duplicate, receiptId: input.receiptId ?? null, namespace: identity.namespace, processing: 'queued', result }
    } finally {
      release()
      if (this.ingestLocks.get(identity.namespace) === chain) this.ingestLocks.delete(identity.namespace)
    }
  }

  async context(url: URL): Promise<unknown> {
    const identity = configFor(this.baseConfig, defined({
      userId: queryText(url, 'userId'), agentId: queryText(url, 'agentId'), sourceAdapter: queryText(url, 'sourceAdapter'),
      projectId: queryText(url, 'projectId'), projectDir: queryText(url, 'projectDir'), namespace: queryText(url, 'namespace'),
      memoryScope: queryText(url, 'memoryScope') as GatewayTurnInput['memoryScope'], conversationId: queryText(url, 'conversationId', 'threadId', 'sessionId'),
    }))
    const query = queryText(url, 'q', 'query', 'prompt')
    if (!query) throw new GatewayHttpError(400, 'query is required')
    return this.runtimeFor(identity).initialContext(query ? identity.sessionId : 'gateway-session', query)
  }

  async memory(url: URL, kind: string): Promise<unknown> {
    const identity = configFor(this.baseConfig, defined({
      userId: queryText(url, 'userId'), agentId: queryText(url, 'agentId'), sourceAdapter: queryText(url, 'sourceAdapter'), projectId: queryText(url, 'projectId'), projectDir: queryText(url, 'projectDir'),
      namespace: queryText(url, 'namespace'), memoryScope: queryText(url, 'memoryScope') as GatewayTurnInput['memoryScope'], conversationId: queryText(url, 'conversationId', 'threadId', 'sessionId'),
    }))
    const runtime = this.runtimeFor(identity)
    const session = identity.sessionId
    const query = queryText(url, 'q', 'query') ?? ''
    const limit = numberParam(url, 'limit', 8, 100)
    if (kind === 'events') return runtime.searchEvents(query, session, { limit })
    if (kind === 'elements') return runtime.searchElements(query, session, { limit })
    if (kind === 'graph') return runtime.searchGraph(query, session, limit)
    if (kind === 'raw') return runtime.searchRaw(query, session, limit, url.searchParams.get('scope') === 'session' ? 'session' : 'namespace')
    if (kind === 'blocks') return runtime.getBlocks(session, url.searchParams.get('scope') === 'namespace' ? 'namespace' : 'session')
    if (kind === 'search') return runtime.recall(query, session)
    throw new GatewayHttpError(404, `Unknown memory kind: ${kind}`)
  }

  async expandBlock(url: URL): Promise<unknown> {
    const identity = configFor(this.baseConfig, {
      userId: queryText(url, 'userId'), agentId: queryText(url, 'agentId'), sourceAdapter: queryText(url, 'sourceAdapter'), projectId: queryText(url, 'projectId'), projectDir: queryText(url, 'projectDir'),
      namespace: queryText(url, 'namespace'), memoryScope: queryText(url, 'memoryScope') as GatewayTurnInput['memoryScope'], conversationId: queryText(url, 'conversationId', 'threadId', 'sessionId'),
    })
    const blockId = queryText(url, 'blockId', 'block_id')
    if (!blockId) throw new GatewayHttpError(400, 'blockId is required')
    const batchId = queryText(url, 'batchId', 'batch_id')
    if (!batchId) throw new GatewayHttpError(400, 'batchId is required')
    const target = queryText(url, 'level', 'target') ?? 'next'
    const runtime = this.runtimeFor(identity)
    return runtime.expandBlock(batchId, blockId, target)
  }

  async expand(url: URL, kind: 'event' | 'element' | 'graph'): Promise<unknown> {
    const identity = configFor(this.baseConfig, {
      userId: queryText(url, 'userId'), agentId: queryText(url, 'agentId'), sourceAdapter: queryText(url, 'sourceAdapter'), projectId: queryText(url, 'projectId'), projectDir: queryText(url, 'projectDir'),
      namespace: queryText(url, 'namespace'), memoryScope: queryText(url, 'memoryScope') as GatewayTurnInput['memoryScope'], conversationId: queryText(url, 'conversationId', 'threadId', 'sessionId'),
    })
    const batchId = queryText(url, 'batchId', 'batch_id')
    const id = queryText(url, 'id', 'eventId', 'event_id', 'elementId', 'element_id', 'nodeId', 'node_id')
    if (!batchId || !id) throw new GatewayHttpError(400, 'batchId and id are required')
    const runtime = this.runtimeFor(identity)
    if (kind === 'event') return runtime.expandEvent(batchId, id)
    if (kind === 'element') return runtime.expandElement(batchId, id, queryText(url, 'at'))
    return runtime.expandGraphNode(batchId, id)
  }

  async memoryMutation(url: URL, kind: 'assess' | 'record-use', body: Record<string, unknown>): Promise<unknown> {
    const identity = configFor(this.baseConfig, body as Partial<GatewayTurnInput>)
    const runtime = this.runtimeFor(identity)
    if (kind === 'assess') {
      const batchId = text(body.batchId ?? body.batch_id, 'batchId', true, 200)!
      return runtime.assess(batchId, body as never)
    }
    const assessmentId = text(body.assessmentId ?? body.assessment_id, 'assessmentId', true, 300)!
    return runtime.recordUse(assessmentId)
  }

  async dashboard(): Promise<unknown> {
    await mkdir(resolve(this.baseConfig.dataDir), { recursive: true })
    const storage = new SqliteStorage({ filename: this.baseConfig.database })
    try {
      const namespaces = storage.listNamespaces()
      const rows = []
      for (const namespace of namespaces) {
        const loaded = await storage.load(namespace)
        if (!loaded) continue
        const snapshot = loaded.snapshot
        const messages = [...snapshot.openTail, ...snapshot.blocks.flatMap((block) => block.l5Raw)]
        const projectName = snapshot.identity?.projectName
          ?? (snapshot.identity?.projectId === this.baseConfig.projectId ? projectNameFromDir(this.baseConfig.projectDir) : undefined)
        rows.push({
          namespace,
          label: projectName ? `项目 ${projectName}` : snapshot.identity?.projectId ? `项目 ${snapshot.identity.projectId}` : namespace,
          projectName: projectName ?? null,
          userId: snapshot.identity?.userId ?? 'default',
          agents: [...new Set(messages.map((m) => m.agentId).filter(Boolean))],
          sourceAdapters: [...new Set(messages.map((m) => m.sourceAdapter).filter(Boolean))],
          turns: snapshot.currentTurn,
          openTailMessages: snapshot.openTail.length,
          blocks: snapshot.blocks.length,
          events: snapshot.events.length,
          elements: snapshot.elements.length,
          graphNodes: snapshot.graphNodes.length,
          graphEdges: snapshot.graphEdges.length,
          usageReceipts: snapshot.usageReceipts.length,
          processingJobs: snapshot.summaryJobs.filter((j) => j.status === 'pending' || j.status === 'running').length
            + snapshot.extractionJobs.filter((j) => j.status === 'running').length,
          revision: loaded.revision,
          lastActivityAt: [...snapshot.blocks.map((b) => b.createdAt), ...snapshot.openTail.map((m) => m.createdAt)].sort().at(-1) ?? null,
        })
      }
      return { status: 'ok', database: this.baseConfig.database, generatedAt: new Date().toISOString(), outbox: await new FileOutbox(outboxDirectory(this.baseConfig.dataDir)).status(), namespaces: rows }
    } finally {
      await storage.close?.()
    }
  }

  async allJobs(): Promise<unknown> {
    const storage = new SqliteStorage({ filename: this.baseConfig.database })
    try {
      return { status: 'ok', generatedAt: new Date().toISOString(), jobs: storage.listAllProcessingJobs() }
    } finally {
      await storage.close?.()
    }
  }

  async allReceipts(): Promise<unknown> {
    const storage = new SqliteStorage({ filename: this.baseConfig.database })
    try {
      return { status: 'ok', generatedAt: new Date().toISOString(), receipts: storage.listAllUsageReceipts() }
    } finally {
      await storage.close?.()
    }
  }

  async snapshot(url: URL): Promise<StrataGateSnapshot> {
    const namespace = queryText(url, 'namespace')
    if (!namespace) throw new GatewayHttpError(400, 'namespace is required')
    const identity = configFor(this.baseConfig, {
      namespace,
      userId: queryText(url, 'userId'),
      projectId: queryText(url, 'projectId'),
      projectDir: queryText(url, 'projectDir'),
      memoryScope: queryText(url, 'memoryScope') as GatewayTurnInput['memoryScope'],
      conversationId: queryText(url, 'conversationId', 'threadId', 'sessionId'),
    })
    if (identity.namespace !== namespace) throw new GatewayHttpError(403, 'namespace does not match the supplied identity')
    const storage = new SqliteStorage({ filename: this.baseConfig.database, readonly: true })
    try {
      const loaded = await storage.load(namespace)
      if (!loaded) throw new GatewayHttpError(404, `Unknown namespace: ${namespace}`)
      return loaded.snapshot
    } finally {
      await storage.close?.()
    }
  }

  metrics(): Record<string, unknown> {
    return {
      service: 'stratagate-memory-gateway',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      requests: { total: this.totalRequests, errors: this.totalErrors, rejected: this.totalRejected, active: this.activeRequests },
      queue: { processing: this.processing.size, ingestLocks: this.ingestLocks.size, limit: this.limits.maxQueueLength },
      limits: this.limits,
      namespaces: this.runtimes.size,
    }
  }

  private readonly startedAt = Date.now()

  private clientKey(req: IncomingMessage): string {
    return `${req.socket.remoteAddress ?? 'local'}:${String(req.headers.authorization ?? '').slice(0, 16)}`
  }

  private enforceLimits(req: IncomingMessage): void {
    if (this.activeRequests >= this.limits.maxConcurrentRequests) {
      this.totalRejected += 1
      throw new GatewayHttpError(429, 'Gateway 并发请求已达上限')
    }
    if (this.limits.rateLimitPerMinute <= 0) return
    const now = Date.now()
    const key = this.clientKey(req)
    const window = this.rateWindows.get(key)
    if (!window || now - window.startedAt >= 60_000) {
      this.rateWindows.set(key, { startedAt: now, count: 1 })
      return
    }
    window.count += 1
    if (window.count > this.limits.rateLimitPerMinute) {
      this.totalRejected += 1
      throw new GatewayHttpError(429, 'Gateway 请求频率已达上限')
    }
  }

  /**
   * Read-only console projection. The browser console needs to move between
   * namespaces and inspect provenance without pretending to be an agent
   * session. Keep this endpoint behind the same Gateway auth boundary and
   * return the persisted snapshot; the JSON responder still redacts secrets.
   */
  async consoleSnapshot(url: URL): Promise<StrataGateSnapshot> {
    const namespace = queryText(url, 'namespace')
    if (!namespace) throw new GatewayHttpError(400, 'namespace is required')
    await mkdir(resolve(this.baseConfig.dataDir), { recursive: true })
    const storage = new SqliteStorage({ filename: this.baseConfig.database, readonly: true })
    try {
      const loaded = await storage.load(namespace)
      if (!loaded) throw new GatewayHttpError(404, `Unknown namespace: ${namespace}`)
      return loaded.snapshot
    } finally {
      await storage.close?.()
    }
  }

  async repairProvenance(body: Record<string, unknown>): Promise<unknown> {
    const identity = configFor(this.baseConfig, { namespace: text(body.namespace, 'namespace', true, 300) })
    const targetAgent = typeof body.targetAgent === 'string' && body.targetAgent ? body.targetAgent : 'codex'
    if (!['codex', 'zcode'].includes(targetAgent)) throw new GatewayHttpError(400, `Unsupported targetAgent: ${targetAgent}`)
    if (!Array.isArray(body.updates) || body.updates.length > 10_000) throw new GatewayHttpError(400, 'updates must be an array of at most 10000 items')
    const storage = new SqliteStorage({ filename: this.baseConfig.database })
    try {
      const loaded = await storage.load(identity.namespace)
      if (!loaded) throw new GatewayHttpError(404, 'Unknown namespace')
      const messages = [...loaded.snapshot.openTail, ...loaded.snapshot.blocks.flatMap(b => b.l5Raw)]
      const changes = []
      for (const update of body.updates as Array<Record<string, unknown>>) {
        const message = messages.find(m => m.id === update.id)
        if (!message) throw new GatewayHttpError(409, 'Source message is missing')
        const hash = createHash('sha256').update(redactSensitiveText(message.content)).digest('hex')
        if (hash !== update.contentHash) throw new GatewayHttpError(409, 'Source message changed; regenerate the report')
        if (message.sourceAdapter === targetAgent && message.agentId === targetAgent) continue
        if (message.agentId !== 'workbuddy' || !['workbuddy', 'gateway'].includes(message.sourceAdapter ?? '')) throw new GatewayHttpError(409, 'Source provenance changed; regenerate the report')
        changes.push({ id: message.id, agentId: message.agentId, sourceAdapter: message.sourceAdapter, contentHash: hash })
        message.agentId = targetAgent
        message.sourceAdapter = targetAgent
      }
      if (body.apply === true && changes.length) {
        await atomicJson(resolve(this.baseConfig.dataDir, 'audit', `adapter-provenance-${targetAgent}-${Date.now()}-${loaded.revision}.json`), {
          namespace: identity.namespace, revision: loaded.revision, targetAgent, changes, createdAt: new Date().toISOString(),
        })
        await storage.save(identity.namespace, loaded.snapshot, loaded.revision)
      }
      return { namespace: identity.namespace, applied: body.apply === true, messages: changes.length, changes }
    } finally { await storage.close?.() }
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = String(req.headers['x-request-id'] ?? `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).slice(0, 128)
    const startedAt = Date.now()
    const urlForAudit = new URL(req.url ?? '/', 'http://localhost')
    res.once('finish', () => {
      process.stderr.write(`${JSON.stringify({
        schema_version: 1,
        emitted_at: new Date().toISOString(),
        operation: 'gateway_request',
        request_id: requestId,
        method: req.method ?? 'GET',
        path: urlForAudit.pathname,
        status: res.statusCode,
        duration_ms: Date.now() - startedAt,
        remote: req.socket?.remoteAddress ?? 'local',
      })}\n`)
    })
    this.totalRequests += 1
    try { this.enforceLimits(req) } catch (error) { this.totalErrors += 1; json(res, error instanceof GatewayHttpError ? error.status : 429, { error: error instanceof Error ? error.message : String(error) }); return }
    this.activeRequests += 1
    try {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-StrataGate-Gateway-Token')
      if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (req.method === 'GET' && isConsolePath(url.pathname)) return html(res)
      auth(req, this.token)
      if (req.method === 'POST' && (url.pathname === '/v1/admin/codex-provenance' || url.pathname === '/v1/admin/adapter-provenance')) return json(res, 200, await this.repairProvenance(await readJson(req, this.limits.maxBodyBytes)))
      if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, service: 'stratagate-memory-gateway', ...this.metrics() })
      if (req.method === 'GET' && url.pathname === '/ready') {
        try {
          const storage = new SqliteStorage({ filename: this.baseConfig.database })
          await storage.close?.()
          return json(res, 200, { ok: true, ready: true, ...this.metrics() })
        } catch (error) {
          return json(res, 503, { ok: false, ready: false, error: error instanceof Error ? error.message : String(error), ...this.metrics() })
        }
      }
      if (req.method === 'GET' && (url.pathname === '/metrics' || url.pathname === '/v1/metrics')) return json(res, 200, this.metrics())
      if (req.method === 'GET' && url.pathname === '/v1/dashboard') return json(res, 200, await this.dashboard())
      if (req.method === 'GET' && url.pathname === '/v1/status') return json(res, 200, await this.dashboard())
      if (req.method === 'GET' && url.pathname === '/v1/context') return json(res, 200, await this.context(url))
      if (req.method === 'GET' && url.pathname === '/v1/worker/tick') return json(res, 200, await this.workerTick(url))
      if (req.method === 'GET' && url.pathname === '/v1/console/snapshot') return json(res, 200, await this.consoleSnapshot(url))
      if (req.method === 'GET' && url.pathname === '/v1/console/jobs') return json(res, 200, await this.allJobs())
      if (req.method === 'GET' && url.pathname === '/v1/console/receipts') return json(res, 200, await this.allReceipts())
      if (req.method === 'GET' && url.pathname === '/v1/memory/snapshot') return json(res, 200, await this.snapshot(url))
      if (req.method === 'PATCH' && url.pathname === '/v1/memory/blocks/expand') return json(res, 200, await this.expandBlock(url))
      if (req.method === 'GET' && url.pathname === '/v1/memory/events/expand') return json(res, 200, await this.expand(url, 'event'))
      if (req.method === 'GET' && url.pathname === '/v1/memory/elements/expand') return json(res, 200, await this.expand(url, 'element'))
      if (req.method === 'GET' && url.pathname === '/v1/memory/graph/expand') return json(res, 200, await this.expand(url, 'graph'))
      if (req.method === 'POST' && url.pathname === '/v1/memory/assess') return json(res, 200, await this.memoryMutation(url, 'assess', await readJson(req, this.limits.maxBodyBytes)))
      if (req.method === 'POST' && url.pathname === '/v1/memory/record-use') return json(res, 200, await this.memoryMutation(url, 'record-use', await readJson(req, this.limits.maxBodyBytes)))
      if (req.method === 'GET' && url.pathname.startsWith('/v1/memory/')) return json(res, 200, await this.memory(url, url.pathname.slice('/v1/memory/'.length)))
      if (req.method === 'GET' && url.pathname === '/v1/settings/model-provider') return json(res, 200, await this.modelProviderView())
      if (req.method === 'PUT' && url.pathname === '/v1/settings/model-provider') return json(res, 200, await this.updateModelProvider(await readJson(req, this.limits.maxBodyBytes)))
      if (req.method === 'DELETE' && url.pathname === '/v1/settings/model-provider') return json(res, 200, await this.clearModelProvider())
      if (req.method === 'POST' && url.pathname === '/v1/settings/model-provider/test') return json(res, 200, await this.testModelProvider(await readJson(req, this.limits.maxBodyBytes)))
      if (req.method === 'POST' && url.pathname === '/v1/ingest/turn') {
        if (this.processing.size + this.ingestLocks.size >= this.limits.maxQueueLength) throw new GatewayHttpError(429, 'Gateway 后台队列已满')
        return json(res, 202, await this.ingest(normalizeTurnBody(await readJson(req, this.limits.maxBodyBytes))))
      }
      throw new GatewayHttpError(404, 'Unknown Memory Gateway route')
    } catch (error) {
      this.totalErrors += 1
      const status = error instanceof GatewayHttpError ? error.status : 500
      json(res, status, { error: error instanceof Error ? error.message : String(error) })
    } finally {
      this.activeRequests = Math.max(0, this.activeRequests - 1)
    }
  }
}

function normalizeTurnBody(body: Record<string, unknown>): GatewayTurnInput {
  const value = (camel: string, snake: string): unknown => body[camel] ?? body[snake]
  return {
    user: value('user', 'user_message') as string,
    assistant: value('assistant', 'assistant_message') as string,
    userId: value('userId', 'user_id') as string | undefined,
    agentId: value('agentId', 'agent_id') as string | undefined,
    sourceAdapter: value('sourceAdapter', 'source_adapter') as string | undefined,
    projectId: value('projectId', 'project_id') as string | undefined,
    projectName: value('projectName', 'project_name') as string | undefined,
    projectDir: value('projectDir', 'project_dir') as string | undefined,
    namespace: value('namespace', 'namespace') as string | undefined,
    memoryScope: value('memoryScope', 'memory_scope') as GatewayTurnInput['memoryScope'],
    conversationId: value('conversationId', 'conversation_id') as string | undefined,
    threadId: value('threadId', 'thread_id') as string | undefined,
    receiptId: value('receiptId', 'receipt_id') as string | undefined,
    createdAt: value('createdAt', 'created_at') as string | undefined,
    userToolCalls: value('userToolCalls', 'user_tool_calls') as unknown[] | undefined,
    assistantToolCalls: (value('assistantToolCalls', 'assistant_tool_calls') ?? body.toolCalls) as unknown[] | undefined,
  }
}

export function createGatewayHandler(config = resolveConfig(), token = process.env.STRATAGATE_GATEWAY_TOKEN?.trim()) {
  const gateway = new MemoryGateway(config, token)
  return { gateway, handler: (req: IncomingMessage, res: ServerResponse) => gateway.handle(req, res) }
}

export function gatewayPort(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.STRATAGATE_GATEWAY_PORT ?? DEFAULT_PORT)
  return Number.isSafeInteger(value) && value > 0 && value < 65_536 ? value : DEFAULT_PORT
}

export function gatewayFingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}
