import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { readdir } from 'node:fs/promises'
import { codexConfig, codexEnv } from './config.js'
import { readCodexTranscript } from './transcript.js'
import { codexReceipt } from './transcript.js'
import { atomicJson, DeliveryJournal } from '../../../packages/adapter-sdk/src/delivery.js'
import { GatewayClient, type GatewayTurnRequest } from '../../../packages/adapter-sdk/src/gateway-client.js'

export function journal(env = process.env) { return new DeliveryJournal(join(resolve(codexEnv(env).STRATAGATE_DATA_DIR || join(homedir(), '.stratagate', 'agent-memory')), 'adapters', 'codex', 'deliveries')) }
export async function capture(path: string, options: { completeActive?: boolean; agentId?: string; dryRun?: boolean; env?: NodeJS.ProcessEnv } = {}) {
  const env = codexEnv(options.env)
  const transcript = await readCodexTranscript(path, { completeActive: options.completeActive ?? false })
  const config = codexConfig(transcript.projectDir, { ...env, STRATAGATE_SESSION_ID: transcript.sessionId })
  const agent = options.agentId || 'primary'
  const requests: GatewayTurnRequest[] = transcript.turns.map(({ id, turn }) => ({
    ...turn, userId: config.userId, agentId: agent === 'primary' ? 'codex' : `codex:${agent}`,
    sourceAdapter: 'codex', projectId: config.projectId!, projectName: config.projectName!, projectDir: config.projectDir,
    namespace: config.namespace, memoryScope: config.memoryScope, conversationId: transcript.sessionId,
    threadId: `${transcript.sessionId}:agent:${agent}`, receiptId: codexReceipt(transcript.sessionId, 'native', id),
  }))
  if (options.dryRun) return { sessionId: transcript.sessionId, projectDir: config.projectDir, turns: requests.length, requests }
  const queue = journal(env)
  for (const request of requests) await queue.enqueue(request)
  const state = join(config.dataDir, 'adapters', 'codex', 'sessions', createHash('sha256').update(`${transcript.sessionId}:${agent}`).digest('hex') + '.json')
  // This offset means captured durably, not acknowledged by Gateway.
  await atomicJson(state, { sessionId: transcript.sessionId, agent, transcriptPath: resolve(path), projectDir: config.projectDir, capturedOffset: transcript.consumedBytes, capturedTurns: requests.length, capturedAt: new Date().toISOString() })
  const delivery = await queue.flush(GatewayClient.fromEnv(env))
  return { sessionId: transcript.sessionId, projectDir: config.projectDir, turns: requests.length, delivery }
}

export async function transcriptFiles(root: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) result.push(...await transcriptFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) result.push(path)
  }
  return result.sort()
}
