import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileOutbox } from '@diqier/stratagate'
import { resolveConfig } from '../src/config.js'
import { createGatewayHandler } from '../src/gateway-api.js'
import { GatewayClient, replayGatewayOutbox } from '../src/gateway-client.js'

const servers: import('node:http').Server[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
})

async function gateway() {
  const dir = await mkdtemp(join(tmpdir(), 'stratagate-gateway-'))
  const config = resolveConfig({
    STRATAGATE_DATA_DIR: dir,
    STRATAGATE_PROJECT_DIR: dir,
    STRATAGATE_DISABLE_WORKBUDDY_MODEL: '1',
  }, dir)
  const { handler } = createGatewayHandler(config)
  const server = createServer((req, res) => { void handler(req, res) })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('server did not bind a TCP port')
  return `http://127.0.0.1:${address.port}`
}

describe('Memory Gateway API', () => {
  it('ingests idempotently and exposes read-only dashboard data', async () => {
    const base = await gateway()
    const health = await fetch(`${base}/health`)
    expect(health.status).toBe(200)
    const body = {
      user_id: 'gateway-test', agent_id: 'codex', source_adapter: 'codex', project_id: 'fixture', project_name: '可读项目',
      conversation_id: 'thread-1', thread_id: 'thread-1', receipt_id: 'codex:session:turn:1',
      user: 'Remember the fixture.', assistant: 'Saved.', toolCalls: [],
    }
    const first = await fetch(`${base}/v1/ingest/turn`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const second = await fetch(`${base}/v1/ingest/turn`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    expect(first.status).toBe(202)
    expect((await first.json()).accepted).toBe(true)
    expect((await second.json()).duplicate).toBe(true)
    const dashboard = await (await fetch(`${base}/v1/dashboard`)).json()
    expect(dashboard.namespaces).toHaveLength(1)
    expect(dashboard.namespaces[0].turns).toBe(1)
    expect(dashboard.namespaces[0].sourceAdapters).toContain('codex')
    expect(dashboard.namespaces[0].label).toBe('项目 可读项目')
    const namespace = dashboard.namespaces[0].namespace
    const consoleSnapshot = await fetch(`${base}/v1/console/snapshot?namespace=${encodeURIComponent(namespace)}`)
    expect(consoleSnapshot.status).toBe(200)
    expect((await consoleSnapshot.json()).currentTurn).toBe(1)
    const consolePage = await fetch(`${base}/`)
    const html = await consolePage.text()
    expect(consolePage.status).toBe(200)
    expect(html).toContain('对话来源')
    expect(html).toContain('使用审计')
    expect(html).toContain('/v1/console/snapshot')
    expect(html).toContain('agent-filter')
    expect(html).toContain('source-filter')
    expect(html).toContain('source-badge')
  })

  it('supports the adapter client over the HTTP contract', async () => {
    const base = await gateway()
    const client = new GatewayClient({ baseUrl: base, timeoutMs: 2_000, fallback: false })
    const result = await client.ingest({
      user: 'Remember the client fixture.',
      assistant: 'Saved.',
      userId: 'client-user',
      agentId: 'codex',
      sourceAdapter: 'codex',
      projectId: 'client-project',
      projectDir: process.cwd(),
      conversationId: 'client-thread',
      threadId: 'client-thread',
      receiptId: 'client:receipt:1',
    })
    expect(result.accepted).toBe(true)
    const context = await client.context({ q: 'client fixture', userId: 'client-user', projectId: 'client-project', projectDir: process.cwd(), conversationId: 'client-thread' })
    expect(context).toHaveProperty('context')
    const raw = await client.memory('raw', { q: 'client fixture', userId: 'client-user', projectId: 'client-project', projectDir: process.cwd(), conversationId: 'client-thread' }) as { namespace?: string }
    expect(raw.namespace).toContain('client-project')
  })

  it('keeps Gateway-only clients fail-closed for writes when the service is unavailable', async () => {
    const client = new GatewayClient({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 25, fallback: false })
    await expect(client.ingest({ user: 'unavailable', assistant: 'not written' })).rejects.toThrow()
  })

  it('queues unavailable writes and replays them after Gateway recovery', async () => {
    const outboxDir = await mkdtemp(join(tmpdir(), 'stratagate-outbox-'))
    vi.stubEnv('STRATAGATE_OUTBOX_DIR', outboxDir)
    const client = new GatewayClient({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 25, fallback: false })
    const queued = await client.ingestWithOutbox({ user: 'queued', assistant: 'until recovery', receiptId: 'queued-receipt' })
    expect(queued.queued).toBe(true)
    expect((await new FileOutbox(outboxDir).status()).pending).toBe(1)
    const base = await gateway()
    const result = await replayGatewayOutbox(new GatewayClient({ baseUrl: base, timeoutMs: 2_000 }), new FileOutbox(outboxDir))
    expect(result.sent).toBe(1)
    expect((await new FileOutbox(outboxDir).status()).pending).toBe(0)
  })

  it('enforces bearer authentication and namespace boundaries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stratagate-gateway-auth-'))
    const config = resolveConfig({ STRATAGATE_DATA_DIR: dir, STRATAGATE_PROJECT_DIR: dir, STRATAGATE_DISABLE_WORKBUDDY_MODEL: '1' }, dir)
    const { handler } = createGatewayHandler(config, 'secret-token')
    const server = createServer((req, res) => { void handler(req, res) })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve)); servers.push(server)
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('server did not bind')
    const base = `http://127.0.0.1:${address.port}`
    const consolePage = await fetch(`${base}/console`)
    expect(consolePage.status).toBe(200)
    expect(await consolePage.text()).toContain('使用 Token 登录')
    expect((await fetch(`${base}/health`)).status).toBe(401)
    expect((await fetch(`${base}/health`, { headers: { authorization: 'Bearer secret-token' } })).status).toBe(200)
    const forbidden = await fetch(`${base}/v1/context?namespace=shared%3Auser%3Aother%3Ascope%3Aproject%3Aforeign&q=test`, { headers: { authorization: 'Bearer secret-token' } })
    expect(forbidden.status).toBe(403)
  })

  it('rejects oversized bodies and rate-limited requests', async () => {
    vi.stubEnv('STRATAGATE_GATEWAY_MAX_BODY_BYTES', '16384')
    const base = await gateway()
    const headers = { 'content-type': 'application/json' }
    const huge = await fetch(`${base}/v1/ingest/turn`, { method: 'POST', headers, body: JSON.stringify({ user: 'x'.repeat(20_000), assistant: 'b' }) })
    expect(huge.status).toBe(413)
    vi.unstubAllEnvs()
    vi.stubEnv('STRATAGATE_GATEWAY_RATE_LIMIT_PER_MINUTE', '1')
    const limited = await gateway()
    expect((await fetch(`${limited}/health`)).status).toBe(200)
    expect((await fetch(`${limited}/health`)).status).toBe(429)
  })
})
