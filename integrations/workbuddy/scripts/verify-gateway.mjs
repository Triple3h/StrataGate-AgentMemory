#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { GatewayClient, replayGatewayOutbox } from '../dist/gateway-client.cjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const gateway = join(root, 'dist', 'gateway.cjs')
const data = await mkdtemp(join(tmpdir(), 'stratagate-gateway-gate-'))
const port = 43_800 + Math.floor(Math.random() * 500)
const token = 'gateway-gate-token'
const childEnv = { ...process.env, STRATAGATE_DATA_DIR: data, STRATAGATE_DATABASE: join(data, 'memory.db'), STRATAGATE_PROJECT_DIR: data, STRATAGATE_GATEWAY_PORT: String(port), STRATAGATE_GATEWAY_TOKEN: token, STRATAGATE_DISABLE_WORKBUDDY_MODEL: '1', STRATAGATE_OUTBOX_DIR: join(data, 'outbox') }
let child
let stderr = ''
const start = () => {
  child = spawn(process.execPath, [gateway], { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
}
const stop = () => new Promise((resolvePromise) => { if (!child || child.exitCode !== null) return resolvePromise(); child.once('exit', resolvePromise); child.kill('SIGTERM') })
const base = `http://127.0.0.1:${port}`
const headers = { authorization: `Bearer ${token}` }
const wait = async () => {
  for (let i = 0; i < 50; i += 1) {
    try { const response = await fetch(`${base}/ready`, { headers }); if (response.status === 200) return; } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Gateway did not become ready\n${stderr}`)
}
const assert = (condition, message) => { if (!condition) throw new Error(message) }
try {
  start()
  await wait()
  assert((await fetch(`${base}/health`)).status === 401, 'health must require the configured token')
  const ready = await fetch(`${base}/ready`, { headers }); assert(ready.status === 200, 'ready endpoint failed')
  const ingested = await fetch(`${base}/v1/ingest/turn`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'gate-user', agentId: 'codex', sourceAdapter: 'codex', projectId: 'gate-project', conversationId: 'gate-session', threadId: 'gate-session', receiptId: 'gate-receipt-1', user: 'gateway gate fixture', assistant: 'persisted' }) })
  assert(ingested.status === 202 && (await ingested.json()).accepted === true, 'gateway ingest failed')
  const duplicate = await fetch(`${base}/v1/ingest/turn`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'gate-user', agentId: 'codex', sourceAdapter: 'codex', projectId: 'gate-project', conversationId: 'gate-session', threadId: 'gate-session', receiptId: 'gate-receipt-1', user: 'gateway gate fixture', assistant: 'persisted' }) })
  assert((await duplicate.json()).duplicate === true, 'receipt replay was not idempotent')
  const metrics = await fetch(`${base}/metrics`, { headers }); assert(metrics.status === 200 && (await metrics.json()).requests.total >= 3, 'metrics endpoint failed')
  await stop()
  const client = new GatewayClient({ baseUrl: base, token, timeoutMs: 100, fallback: false })
  const queued = await client.ingestWithOutbox({ user: 'outbox recovery fixture', assistant: 'replayed after restart', userId: 'gate-user', agentId: 'codex', sourceAdapter: 'codex', projectId: 'gate-project', conversationId: 'recovery', receiptId: 'gate-recovery-receipt' })
  assert(queued.queued === true, 'stopped Gateway did not queue the Outbox write')
  start()
  await wait()
  const replay = await replayGatewayOutbox(client)
  assert(replay.sent === 1, `Outbox replay did not send exactly one item: ${JSON.stringify(replay)}`)
  console.log(JSON.stringify({ gatewaySmoke: 'passed', stopRecoveryOutbox: 'passed', port, dataDir: data }))
} finally {
  await stop()
  await rm(data, { recursive: true, force: true })
}
