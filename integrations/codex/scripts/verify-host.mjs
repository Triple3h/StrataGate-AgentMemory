#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createServer } from 'node:http'
const root = fileURLToPath(new URL('..', import.meta.url))
const dir = await mkdtemp(join(tmpdir(), 'codex-host-smoke-'))
const accepted = new Set()
let received = 0
const gateway = createServer(async (req, res) => {
  if (req.headers.authorization !== 'Bearer smoke-token') { res.writeHead(401); res.end('{}'); return }
  const chunks = []; for await (const chunk of req) chunks.push(chunk)
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}
  let result = { status: 'ok' }
  if (req.url === '/v1/ingest/turn') {
    if (body.sourceAdapter !== 'codex') { res.writeHead(400); res.end('{}'); return }
    received += 1
    const duplicate = accepted.has(body.receiptId); accepted.add(body.receiptId)
    result = { accepted: !duplicate, duplicate }
  }
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(result))
})
await new Promise(r => gateway.listen(0, '127.0.0.1', r))
const connection = join(dir, 'connection.json')
await writeFile(connection, JSON.stringify({ STRATAGATE_DATA_DIR: dir, STRATAGATE_GATEWAY_TOKEN: 'smoke-token', STRATAGATE_GATEWAY_URL: `http://127.0.0.1:${gateway.address().port}` }))
const transcript = join(dir, 'rollout.jsonl')
await writeFile(transcript, [
  { type: 'session_meta', payload: { id: 'native-session', cwd: dir } },
  { type: 'event_msg', payload: { type: 'task_started', turn_id: 'native-turn' } },
  { type: 'event_msg', payload: { type: 'item_completed', item: { type: 'UserMessage', content: 'smoke question' } } },
  { type: 'event_msg', payload: { type: 'item_completed', item: { type: 'AgentMessage', content: 'smoke answer', phase: 'final' } } },
].map(r => JSON.stringify(r)).join('\n') + '\n')
const env = { ...process.env, STRATAGATE_CONNECTION_CONFIG: connection }
const hook = () => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [join(root, 'dist/hook.cjs'), '--connection-config', connection], { cwd: dir, env, stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''; let stderr = ''
  child.stdout.on('data', c => { stdout += c }); child.stderr.on('data', c => { stderr += c })
  child.on('error', reject)
  child.on('close', code => code === 0 && JSON.parse(stdout).continue === true ? resolve() : reject(new Error(stderr || stdout)))
  child.stdin.end(JSON.stringify({ hook_event_name: 'Stop', session_id: 'native-session', transcript_path: transcript, cwd: dir }))
})
const client = new Client({ name: 'codex-host-smoke', version: '1' })
try {
  await hook(); await hook()
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'dist/server.cjs')], cwd: dir, env }))
  const tools = await client.listTools()
  const status = await client.callTool({ name: 'memory_status', arguments: {} })
  if (accepted.size !== 1 || received !== 1 || status.isError || client.getServerVersion().name !== 'stratagate-codex' || tools.tools.length !== 12) throw new Error('Codex host protocol verification failed')
  console.log(JSON.stringify({ codexHostProtocol: 'passed', capturedTurns: accepted.size, tools: tools.tools.length, repeatedStop: 'deduplicated', desktopTrust: 'not-exercised' }))
} finally {
  await client.close()
  await new Promise(r => gateway.close(r))
  await rm(dir, { recursive: true, force: true })
}
