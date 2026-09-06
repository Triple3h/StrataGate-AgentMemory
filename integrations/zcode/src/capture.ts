import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { zcodeConfig, zcodeEnv } from './config.js'
import { buildZcodeTurns } from './transcript.js'
import { atomicJson, DeliveryJournal } from '../../../packages/adapter-sdk/src/delivery.js'
import { GatewayClient, type GatewayTurnRequest } from '../../../packages/adapter-sdk/src/gateway-client.js'

type Row = Record<string, unknown>

export function journal(env: NodeJS.ProcessEnv = process.env) {
  return new DeliveryJournal(join(resolve(zcodeEnv(env).STRATAGATE_DATA_DIR || join(homedir(), '.stratagate', 'agent-memory')), 'adapters', 'zcode', 'deliveries'))
}

export function defaultRolloutPath(sessionId: string): string {
  return join(process.env.HOME || process.env.USERPROFILE || '', '.zcode', 'cli', 'rollout', `model-io-${sessionId}.jsonl`)
}

function safeKey(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readJson(path: string): Promise<{ lastTurnId?: string | null } | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${safeKey(`${Date.now()}-${Math.random()}`).slice(0, 12)}.tmp`
  await writeFile(temporary, `${JSON.stringify(value)}\n`, 'utf8')
  await rename(temporary, path)
}

export interface ZcodeCaptureInput {
  sessionId: string
  cwd?: string
  /** Subagent override; mirrors the legacy `agent_id`/`agent_type` stdin fields. */
  agentId?: string
  transcriptPath?: string
  rolloutPath?: string
  /** Raw hook stdin for the no-rollout fallback path (Stop events). */
  stdin?: Row
  completeActive?: boolean
}

export interface CaptureResult {
  sessionId: string
  projectDir: string
  turns: number
  requests?: GatewayTurnRequest[]
  delivery?: { sent: number; pending: number; status?: number }
}

/**
 * Fold unseen rollout turns and queue them for the Gateway. The cursor file
 * keeps the legacy path and `{ lastTurnId }` shape so upgrades resume without
 * recapturing old sessions; receipts keep the legacy `zcode:...:turn:` format
 * so the Gateway's idempotency boundary still deduplicates them.
 */
export async function capture(input: ZcodeCaptureInput, options: { dryRun?: boolean; env?: NodeJS.ProcessEnv } = {}): Promise<CaptureResult> {
  const env = zcodeEnv(options.env)
  const config = zcodeConfig(input.cwd, { ...env, ...(input.sessionId ? { STRATAGATE_SESSION_ID: input.sessionId } : {}) })
  const agent = input.agentId?.trim() || 'zcode'
  // threadId keeps the legacy derivation (it groups messages in the store);
  // the cursor key is stable per session+agent — the legacy key included the
  // per-event temp transcript_path, so the cursor never actually advanced.
  const transcriptKey = input.transcriptPath?.trim() || `${input.sessionId}:${agent}`
  const statePath = join(config.dataDir, 'state', 'zcode', `${safeKey(`${input.sessionId}:${agent}`)}.json`)
  const state = await readJson(statePath)
  const rolloutPath = input.rolloutPath ?? defaultRolloutPath(input.sessionId)
  const result = buildZcodeTurns(
    input.stdin ?? { session_id: input.sessionId },
    { lastTurnId: state?.lastTurnId ?? null },
    { completeActive: input.completeActive ?? true, rolloutPath },
  )
  const requests: GatewayTurnRequest[] = []
  for (const turn of result.turns) {
    if (!turn.user) continue
    const toolCalls = Array.isArray(turn.assistantToolCalls) ? turn.assistantToolCalls : []
    requests.push({
      user: turn.user,
      assistant: turn.assistant || '',
      ...(toolCalls.length > 0 ? { assistantToolCalls: toolCalls } : {}),
      ...(turn.createdAt ? { createdAt: turn.createdAt } : {}),
      threadId: `${input.sessionId}:agent:${safeKey(`${agent}:${transcriptKey}`).slice(0, 16)}`,
      userId: config.userId,
      agentId: agent,
      projectId: config.projectId!,
      projectName: config.projectName!,
      projectDir: config.projectDir,
      namespace: config.namespace,
      memoryScope: config.memoryScope,
      conversationId: input.sessionId,
      sourceAdapter: 'zcode',
      receiptId: `zcode:${input.sessionId}:${agent}:turn:${turn.turnId || result.lastTurnId || safeKey(`${turn.user}:${turn.assistant}`)}`,
    })
  }
  if (options.dryRun) return { sessionId: input.sessionId, projectDir: config.projectDir, turns: requests.length, requests }
  const queue = journal(env)
  for (const request of requests) await queue.enqueue(request)
  if (result.lastTurnId && result.lastTurnId !== (state?.lastTurnId ?? null)) {
    await writeJson(statePath, { lastTurnId: result.lastTurnId })
  }
  const delivery = await queue.flush(GatewayClient.fromEnv(env))
  return { sessionId: input.sessionId, projectDir: config.projectDir, turns: requests.length, delivery }
}
