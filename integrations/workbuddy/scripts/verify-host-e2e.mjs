#!/usr/bin/env node
/**
 * Cross-process host-protocol smoke for the Codex/WorkBuddy hook contract.
 *
 * This exercises the real built hook and MCP server with host-shaped payloads.
 * It is deliberately not described as GPT Desktop E2E: desktop hook trust and
 * the live event payload still require a manual run in the actual host.
 */

import { DatabaseSync } from 'node:sqlite'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { delimiter } from 'node:path'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyEngineArtifacts } from './engine-artifact.mjs'

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const repoRoot = resolve(packageRoot, '..', '..')
const hook = join(packageRoot, 'dist', 'hook.cjs')
const server = join(packageRoot, 'dist', 'server.cjs')
const runtimeArtifact = join(packageRoot, 'dist', 'runtime.cjs')
const zcodeHook = join(repoRoot, 'integrations', 'zcode', 'scripts', 'zcode-hook.mjs')
const nodeExecutable = [
  process.execPath,
  ...(process.env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => join(directory, 'node')),
].find((candidate) => existsSync(candidate))
if (!nodeExecutable) throw new Error(`Unable to locate a runnable Node.js executable (process.execPath=${process.execPath})`)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function runNode(script, input, cwd, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(nodeExecutable, [script], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`node ${script} exited with ${code}\n${stdout}\n${stderr}`))
        return
      }
      const line = stdout.trim().split(/\r?\n/u).at(-1)
      try {
        resolvePromise({ value: line ? JSON.parse(line) : null, stderr })
      } catch (error) {
        rejectPromise(new Error(`node ${script} returned invalid JSON\n${stdout}\n${stderr}\n${error}`))
      }
    })
    child.stdin.end(`${typeof input === 'string' ? input : JSON.stringify(input)}\n`)
  })
}

async function writeTranscript(path, entries) {
  await writeFile(path, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8')
}

function hookInput(event, sessionId, transcriptPath, agentId, cwd, prompt) {
  return {
    hook_event_name: event,
    session_id: sessionId,
    agent_id: agentId,
    agent_transcript_path: transcriptPath,
    cwd,
    ...(prompt ? { prompt } : {}),
  }
}

function codexTranscript(user, assistant, toolId, toolCommand, toolOutput, createdAt) {
  const later = (seconds) => new Date(Date.parse(createdAt) + seconds * 1_000).toISOString()
  return [
    {
      timestamp: createdAt,
      payload: { type: 'item_completed', item: { type: 'userMessage', content: user } },
    },
    {
      timestamp: later(1),
      payload: { type: 'item_completed', item: { type: 'commandExecution', id: toolId, command: toolCommand, aggregated_output: toolOutput } },
    },
    {
      timestamp: later(2),
      payload: { type: 'item_completed', item: { type: 'agentMessage', content: assistant } },
    },
  ]
}

function sqliteSnapshot(database) {
  const db = new DatabaseSync(database)
  try {
    const namespace = db.prepare('SELECT namespace FROM memory_spaces LIMIT 1').get()?.namespace
    const messages = db.prepare(`
      SELECT role, content, thread_id AS threadId, user_id AS userId, agent_id AS agentId,
             conversation_id AS conversationId, source_adapter AS sourceAdapter, tool_calls_json AS toolCalls
      FROM messages ORDER BY rowid
    `).all()
    const receipts = db.prepare('SELECT receipt_id AS id FROM ingestion_receipts ORDER BY receipt_id').all()
    return { namespace, messages, receipts }
  } finally {
    db.close()
  }
}

async function mcpScenario(env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(nodeExecutable, [server], {
      cwd: env.STRATAGATE_PROJECT_DIR,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let nextId = 1
    const pending = new Map()
    let settled = false

    const finish = (error, value) => {
      if (settled) return
      settled = true
      child.kill()
      if (error) rejectPromise(error)
      else resolvePromise(value)
    }
    const timer = setTimeout(() => finish(new Error(`MCP scenario timed out\n${stderr}`)), 15_000)
    const request = (method, params) => new Promise((resolveRequest, rejectRequest) => {
      const id = nextId++
      pending.set(id, { resolve: resolveRequest, reject: rejectRequest })
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })

    child.on('error', (error) => finish(error))
    child.on('exit', (code) => {
      if (!settled) finish(new Error(`MCP server exited with ${code}\n${stderr}`))
    })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      let newline
      while ((newline = stdout.indexOf('\n')) >= 0) {
        const line = stdout.slice(0, newline).trim()
        stdout = stdout.slice(newline + 1)
        if (!line) continue
        let message
        try { message = JSON.parse(line) } catch { continue }
        if (message.id === undefined) continue
        const waiter = pending.get(message.id)
        if (!waiter) continue
        pending.delete(message.id)
        if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
        else waiter.resolve(message.result)
      }
    })

    void (async () => {
      try {
        const initialized = await request('initialize', {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'stratagate-host-e2e', version: '1.0.0' },
        })
        assert(initialized?.serverInfo?.name === 'stratagate-workbuddy', 'MCP initialize returned the wrong server')
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)

        const searchResult = await request('tools/call', {
          name: 'memory_search_raw',
          arguments: { query: 'deployment', session_id: 'agent-a-session', scope: 'namespace', limit: 8 },
        })
        const batch = JSON.parse(searchResult.content?.[0]?.text ?? '{}')
        assert(batch.batchId?.startsWith('batch_'), 'MCP search did not return a persisted batch')
        assert(batch.evidenceRefs.length > 0, 'MCP search returned no evidence for the host smoke')

        const assessmentResult = await request('tools/call', {
          name: 'memory_assess',
          arguments: {
            batch_id: batch.batchId,
            verdict: 'sufficient',
            evidence_refs: [batch.evidenceRefs[0]],
            fit: 'The raw transcript directly contains the deployment evidence.',
            missing: '',
            next_strategy: 'answer',
          },
        })
        const assessment = JSON.parse(assessmentResult.content?.[0]?.text ?? '{}')
        assert(assessment.verdict === 'sufficient', 'MCP assessment was not accepted')

        const firstUse = await request('tools/call', {
          name: 'memory_record_use',
          arguments: { assessment_id: assessment.id },
        })
        const secondUse = await request('tools/call', {
          name: 'memory_record_use',
          arguments: { assessment_id: assessment.id },
        })
        const first = JSON.parse(firstUse.content?.[0]?.text ?? '{}')
        const second = JSON.parse(secondUse.content?.[0]?.text ?? '{}')
        assert(first.recorded === true && second.recorded === true, 'MCP usage receipt was not idempotent')
        clearTimeout(timer)
        finish(null, { batch, assessment })
      } catch (error) {
        clearTimeout(timer)
        finish(error)
      }
    })()
  })
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'stratagate-host-e2e-'))
  try {
    const workbuddyPackage = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
    const corePackage = JSON.parse(readFileSync(join(packageRoot, '..', '..', 'packages', 'core', 'package.json'), 'utf8'))
    const manifest = verifyEngineArtifacts(join(packageRoot, 'dist'), {
      expectedVersion: workbuddyPackage.version,
      expectedCoreVersion: corePackage.version,
    })
    assert(manifest.coreVersion, 'Shared engine manifest is missing coreVersion')
    const dataDir = join(root, 'data')
    const projectDir = join(root, 'project')
    const database = join(dataDir, 'memory.db')
    const transcriptA = join(root, 'agent-a.jsonl')
    const transcriptB = join(root, 'agent-b.jsonl')
    const transcriptC = join(root, 'agent-c.jsonl')
    const env = {
      STRATAGATE_DATA_DIR: dataDir,
      STRATAGATE_DATABASE: database,
      STRATAGATE_PROJECT_DIR: projectDir,
      STRATAGATE_BLOCK_TURN_SIZE: '1',
      STRATAGATE_DISABLE_WORKBUDDY_MODEL: '1',
      STRATAGATE_GATEWAY_FALLBACK: '1',
      STRATAGATE_DISABLE_GATEWAY: '1',
      STRATAGATE_USER_ID: 'host-e2e-user',
    }
    await mkdir(projectDir, { recursive: true })

    await writeTranscript(transcriptA, codexTranscript(
      'Record the deployment target as Singapore.',
      'The deployment target is Singapore.',
      'tool-a', 'printf alpha', 'alpha', '2026-09-05T01:00:00.000Z',
    ))
    await writeTranscript(transcriptB, codexTranscript(
      'Record the deployment target as Singapore.',
      'I recorded Singapore as the deployment target.',
      'tool-b', 'printf beta', 'beta', '2026-09-05T01:10:00.000Z',
    ))
    await writeTranscript(transcriptC, codexTranscript(
      'Record the deployment target as Singapore.',
      'Deployment target recorded as Singapore.',
      'tool-c', 'printf gamma', 'gamma', '2026-09-05T01:20:00.000Z',
    ))

    await Promise.all([
      runNode(hook, hookInput('UserPromptSubmit', 'agent-a-session', transcriptA, 'agent-a', projectDir, 'Record the deployment target as Singapore.'), projectDir, env),
      runNode(hook, hookInput('UserPromptSubmit', 'agent-b-session', transcriptB, 'agent-b', projectDir, 'Record the deployment target as Singapore.'), projectDir, env),
    ])
    await Promise.all([
      runNode(hook, hookInput('Stop', 'agent-a-session', transcriptA, 'agent-a', projectDir), projectDir, env),
      runNode(hook, hookInput('Stop', 'agent-b-session', transcriptB, 'agent-b', projectDir), projectDir, env),
    ])

    await runNode(hook, hookInput('UserPromptSubmit', 'agent-c-session', transcriptC, 'agent-c', projectDir, 'Record the deployment target as Singapore.'), projectDir, env)
    await Promise.all([
      runNode(hook, hookInput('Stop', 'agent-c-session', transcriptC, 'agent-c', projectDir), projectDir, env),
      runNode(hook, hookInput('Stop', 'agent-c-session', transcriptC, 'agent-c', projectDir), projectDir, env),
    ])

    // Lifecycle hooks are safe replays: no new transcript bytes means no new turn.
    await Promise.all([
      runNode(hook, hookInput('PreCompact', 'agent-a-session', transcriptA, 'agent-a', projectDir), projectDir, env),
      runNode(hook, hookInput('Interrupt', 'agent-b-session', transcriptB, 'agent-b', projectDir), projectDir, env),
      runNode(hook, hookInput('SubagentStart', 'subagent-session', transcriptC, 'subagent-1', projectDir), projectDir, env),
      runNode(hook, hookInput('SubagentStop', 'agent-c-session', transcriptC, 'agent-c', projectDir), projectDir, env),
    ])

    const malformed = await runNode(hook, '{not-json', projectDir, env)
    assert(malformed.value?.continue === true, 'Malformed hook input did not fail open')
    assert(malformed.stderr.includes('failed open'), 'Malformed hook input was not observable on stderr')

    const snapshot = sqliteSnapshot(database)
    assert(snapshot.namespace?.includes('host-e2e-user'), 'Agents did not share the expected user namespace')
    assert(snapshot.messages.length === 6, `Expected three turns (six messages), got ${snapshot.messages.length}`)
    assert(snapshot.receipts.length === 3, `Expected three ingestion receipts, got ${snapshot.receipts.length}`)
    assert(new Set(snapshot.messages.map(({ agentId }) => agentId)).size === 3, 'Agent provenance was merged')
    assert(new Set(snapshot.messages.map(({ conversationId }) => conversationId)).size === 3, 'Conversation provenance was merged')
    assert(snapshot.messages.some(({ toolCalls }) => toolCalls !== null), 'Codex tool trace was not retained')
    assert(snapshot.messages.every(({ userId }) => userId === 'host-e2e-user'), 'User provenance was not retained')

    const { WorkBuddyRuntime } = await import(runtimeArtifact)
    const recovery = new WorkBuddyRuntime({
      dataDir,
      database,
      projectDir,
      namespace: snapshot.namespace,
      userId: 'host-e2e-user',
      agentId: 'recovery-check',
      memoryScope: 'project',
      blockTurnSize: 1,
      retrievalLimit: 8,
      maxContextChars: 12_000,
      workerIntervalMs: 1_000,
    })
    await recovery.processPending()
    const recoveredStatus = await recovery.status()
    assert(recoveredStatus.counts.blocks === 3, `Restart recovery did not seal all turns: ${JSON.stringify(recoveredStatus)}`)

    const mcp = await mcpScenario(env)
    const afterMcp = sqliteSnapshot(database)
    assert(afterMcp.receipts.length === 3, 'MCP usage replay changed ingestion receipts')

    const zcodeHome = join(root, 'zcode-home')
    const zcodeRollout = join(zcodeHome, '.zcode', 'cli', 'rollout', 'model-io-z-session.jsonl')
    await mkdir(join(zcodeHome, '.zcode', 'cli', 'rollout'), { recursive: true })
    const zcodeEnv = { ...env, HOME: zcodeHome, ZCODE_PROJECT_DIR: projectDir }
    const zcodeContext = await runNode(zcodeHook, {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'z-session',
      cwd: projectDir,
      prompt: 'What deployment target did we record?',
    }, projectDir, zcodeEnv)
    assert(zcodeContext.value?.hookSpecificOutput?.additionalContext?.includes('batch_id="batch_'), 'ZCode did not persist an assessable retrieval batch')
    await writeFile(zcodeRollout, `${JSON.stringify({
      sessionId: 'z-session',
      turnId: 'z-turn-1',
      completedAt: '2026-09-05T01:30:02.000Z',
      request: { body: { input: [{ role: 'user', content: 'Record the ZCode deployment note.' }] } },
      response: { text: 'The ZCode deployment note is recorded.' },
    })}\n`, 'utf8')
    await runNode(zcodeHook, {
      hook_event_name: 'Stop',
      session_id: 'z-session',
      agent_id: 'zcode-agent',
      cwd: projectDir,
      transcript_path: zcodeRollout,
    }, projectDir, zcodeEnv)
    const zcodeSnapshot = sqliteSnapshot(database)
    assert(zcodeSnapshot.messages.length === 8, `ZCode did not append one turn: got ${zcodeSnapshot.messages.length} messages`)
    assert(zcodeSnapshot.receipts.length === 4, 'ZCode receipt was not persisted')
    assert(zcodeSnapshot.messages.slice(-2).every(({ agentId, conversationId, sourceAdapter }) =>
      agentId === 'zcode-agent' && conversationId === 'z-session' && sourceAdapter === 'zcode'), 'ZCode provenance was not retained')

    await recovery.processPending()
    const restarted = await new WorkBuddyRuntime({
      dataDir,
      database,
      projectDir,
      namespace: snapshot.namespace,
      userId: 'host-e2e-user',
      agentId: 'restarted-check',
      memoryScope: 'project',
      blockTurnSize: 1,
      retrievalLimit: 8,
      maxContextChars: 12_000,
      workerIntervalMs: 1_000,
    }).status()
    assert(restarted.counts.blocks === 4, 'A second restart changed recovered blocks')
    console.log(JSON.stringify({
      hostProtocolSmoke: 'passed',
      namespace: snapshot.namespace,
      turns: afterMcp.receipts.length + 1,
      agents: [...new Set(snapshot.messages.map(({ agentId }) => agentId))],
      mcpBatch: mcp.batch.batchId,
      mcpAssessment: mcp.assessment.id,
      recoveredBlocks: restarted.counts.blocks,
    }))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
