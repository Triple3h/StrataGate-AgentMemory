#!/usr/bin/env node
/**
 * StrataGate ZCode hook — the ZCode-native adapter.
 *
 * Registers two hook events:
 *  - UserPromptSubmit: recall saved memory and inject it as additionalContext.
 *  - Stop: read the ZCode rollout, fold unseen turns, and append them to the
 *    shared StrataGate SQLite store (L5 source), with a turnId cursor to make
 *    ingestion idempotent.
 *
 * Uses the shared @diqier/stratagate core directly (same database as the
 * workbuddy/codex adapters), so memories are shared across clients.
 *
 * ZCode output contract (strict schema):
 *  - valid output starts with `{`; extra top-level keys fail validation.
 *  - UserPromptSubmit may return { hookSpecificOutput: { hookEventName, additionalContext } }.
 *  - Stop returns {} on success (no model context to inject).
 */
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { StrataGate, memoryNamespace, projectKey, nowUtc8 } from '@diqier/stratagate'
import { WorkBuddyRuntime } from '../../workbuddy/dist/runtime.cjs'
import { GatewayClient } from '../../workbuddy/dist/gateway-client.cjs'
import { buildZcodeTurns } from '../lib/zcode-turns.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
function resolveConfig(env = process.env, cwd) {
  const dataDir = resolve(
    env.STRATAGATE_DATA_DIR || join(homedir(), '.stratagate', 'agent-memory'),
  )
  const database = resolve(
    env.STRATAGATE_DATABASE || join(dataDir, 'memory.db'),
  )
  const projectDir = resolve(cwd || env.STRATAGATE_PROJECT_DIR || env.ZCODE_PROJECT_DIR || process.cwd())
  const userId = env.STRATAGATE_USER_ID || env.USER || env.USERNAME || 'default'
  const agentId = env.STRATAGATE_AGENT_ID || env.ZCODE_AGENT_ID || 'zcode'
  const memoryScope = env.STRATAGATE_MEMORY_SCOPE || 'project'
  if (!['project', 'session', 'global'].includes(memoryScope)) throw new TypeError(`Invalid STRATAGATE_MEMORY_SCOPE: ${memoryScope}`)
  const namespace = env.STRATAGATE_NAMESPACE || memoryNamespace({
    userId,
    agentId,
    namespacePrefix: env.STRATAGATE_NAMESPACE_PREFIX || 'shared',
    memoryScope,
    projectDir,
    sessionId: env.STRATAGATE_SESSION_ID,
    globalNamespace: env.STRATAGATE_GLOBAL_NAMESPACE,
  })
  return {
    dataDir,
    database,
    projectDir,
    namespace,
    userId,
    agentId,
    memoryScope,
    blockTurnSize: int(env.STRATAGATE_BLOCK_TURN_SIZE, 4),
    retrievalLimit: int(env.STRATAGATE_RETRIEVAL_LIMIT, 8),
    maxContextChars: int(env.STRATAGATE_MAX_CONTEXT_CHARS, 12000),
  }
}

function int(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${cryptoRandom()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value)}\n`, 'utf8')
  await rename(temporary, path)
}

function cryptoRandom() {
  return createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 12)
}

class ZCodeHook {
  constructor(config) {
    this.config = config
  }

  gatewayRuntime() {
    return new WorkBuddyRuntime({
      dataDir: this.config.dataDir,
      database: this.config.database,
      projectDir: this.config.projectDir,
      namespace: this.config.namespace,
      userId: this.config.userId,
      agentId: this.config.agentId,
      memoryScope: this.config.memoryScope,
      blockTurnSize: this.config.blockTurnSize,
      retrievalLimit: this.config.retrievalLimit,
      maxContextChars: this.config.maxContextChars,
      workerIntervalMs: 60_000,
    })
  }

  async withMemory(operation) {
    await mkdir(dirname(this.config.database), { recursive: true })
    const memory = await StrataGate.open({
      database: this.config.database,
      namespace: this.config.namespace,
      identity: {
        userId: this.config.userId,
        agentId: this.config.agentId,
        projectId: projectKey(this.config.projectDir),
        memoryScope: this.config.memoryScope,
        namespacePrefix: 'shared',
        sourceAdapter: 'zcode',
      },
      blockTurnSize: this.config.blockTurnSize,
    })
    try {
      return await operation(memory)
    } finally {
      await memory.close()
    }
  }

  async onUserPrompt(sessionId, prompt) {
    if (!sessionId || !prompt) return {}
    let context
    if (process.env.STRATAGATE_DISABLE_GATEWAY !== '1') {
      try {
        const result = await GatewayClient.fromEnv().context({
          q: prompt,
          userId: this.config.userId,
          agentId: this.config.agentId,
          sourceAdapter: 'zcode',
          projectId: projectKey(this.config.projectDir),
          projectDir: this.config.projectDir,
          namespace: this.config.namespace,
          conversationId: sessionId,
        })
        context = result?.context
      } catch (error) {
        if (!GatewayClient.fromEnv().options.fallback) throw error
        context = (await this.gatewayRuntime().initialContext(sessionId, prompt)).context
      }
    } else context = (await this.gatewayRuntime().initialContext(sessionId, prompt)).context
    if (!context) return {}
    return {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: context,
      },
    }
  }

  async onStop(sessionId, input) {
    if (!sessionId) return {}
    const agentId = input.agent_id || input.agent_type || this.config.agentId
    const transcriptKey = input.agent_transcript_path || input.transcript_path || input.rollout_path || `${sessionId}:${agentId}`
    const statePath = join(this.config.dataDir, 'state', 'zcode', `${safeKey(`${sessionId}:${transcriptKey}`)}.json`)
    const state = (await readJson(statePath)) || { lastTurnId: null }
    const result = buildZcodeTurns(input, state)
    if (result.turns.length === 0) return {}

    // Rollout turns come back as { user, assistant, assistantToolCalls } (one per
    // user turn). The stdin fallback returns { role, content } entries.
    let appended = 0
    for (const turn of result.turns) {
      if (turn.user === undefined) continue // stdin fallback entries without user text
      const toolCalls = Array.isArray(turn.assistantToolCalls)
        ? turn.assistantToolCalls
        : []
      const request = {
        user: turn.user,
        assistant: turn.assistant || '',
        ...(toolCalls.length > 0 ? { assistantToolCalls: toolCalls } : {}),
        threadId: `${sessionId}:agent:${safeKey(`${agentId}:${transcriptKey}`).slice(0, 16)}`,
        userId: this.config.userId,
        agentId,
        projectId: projectKey(this.config.projectDir),
        conversationId: sessionId,
        sourceAdapter: 'zcode',
        receiptId: `zcode:${sessionId}:${agentId}:turn:${turn.turnId || result.lastTurnId || safeKey(`${turn.user}:${turn.assistant}`)}`,
      }
      if (process.env.STRATAGATE_DISABLE_GATEWAY !== '1') {
        const gateway = GatewayClient.fromEnv()
        try {
          const gatewayRequest = { ...request, projectDir: this.config.projectDir, namespace: this.config.namespace, memoryScope: this.config.memoryScope }
          if (gateway.options.fallback) await gateway.ingest(gatewayRequest)
          else await gateway.ingestWithOutbox(gatewayRequest)
        } catch (error) {
          if (!gateway.options.fallback) throw error
          await this.withMemory((memory) => memory.appendTurn(request, { deferProcessing: true }))
        }
      } else await this.withMemory((memory) => memory.appendTurn(request, { deferProcessing: true }))
      appended += 1
    }

    if (result.lastTurnId) {
      await writeJson(statePath, { lastTurnId: result.lastTurnId })
    }
    return {}
  }
}

function safeKey(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  let output = {}
  try {
    const raw = await readStdin()
    const input = raw.trim() ? JSON.parse(raw) : {}
    const config = resolveConfig(process.env, input.cwd)
    const hook = new ZCodeHook(config)
    const event = input.hook_event_name || input.hookEventName || ''
    const sessionId = (input.session_id || input.sessionId || '').trim()
    if (event === 'UserPromptSubmit') {
      output = await hook.onUserPrompt(sessionId, (input.prompt || '').trim())
    } else if (event === 'Stop' || event === 'SubagentStop' || event === 'PreCompact' || event === 'Interrupt') {
      output = await hook.onStop(sessionId, input)
    }
  } catch (error) {
    process.stderr.write(`[stratagate-zcode] hook failed open: ${error instanceof Error ? error.message : String(error)}\n`)
    output = {}
  }
  process.stdout.write(`${JSON.stringify(output)}\n`)
}

void main()
