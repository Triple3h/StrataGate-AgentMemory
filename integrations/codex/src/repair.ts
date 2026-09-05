import { createHash } from 'node:crypto'
import { capture } from './capture.js'
import type { GatewayClient } from '../../../packages/adapter-sdk/src/gateway-client.js'
import type { StrataGateSnapshot } from '@diqier/stratagate'
import { redactSensitiveText } from '@diqier/stratagate'

export async function repairSources(files: string[], client: GatewayClient, env: NodeJS.ProcessEnv, apply = false) {
  const snapshots = new Map<string, StrataGateSnapshot>()
  const changes = new Map<string, Array<{ id: string; contentHash: string }>>()
  for (const file of files) {
    const parsed = await capture(file, { dryRun: true, completeActive: true, env })
    if (!('requests' in parsed)) continue
    for (const request of parsed.requests ?? []) {
      const namespace = request.namespace!
      if (!snapshots.has(namespace)) {
        try { snapshots.set(namespace, await client.snapshot(namespace) as StrataGateSnapshot) }
        catch (error) { if ((error as { status?: number }).status === 404) continue; throw error }
      }
      const snapshot = snapshots.get(namespace)!
      const messages = [...snapshot.openTail, ...snapshot.blocks.flatMap(b => b.l5Raw)]
      for (const message of messages) {
        const conversation = (message.conversationId ?? message.threadId ?? '').split(':agent:')[0]
        if (conversation !== request.conversationId || !['workbuddy', 'gateway'].includes(message.sourceAdapter ?? '') || message.agentId !== 'workbuddy') continue
        const expected = message.role === 'user' ? request.user : request.assistant
        if (!message.content.trim() || !redactSensitiveText(expected).includes(message.content.trim())) continue
        const updates = changes.get(namespace) ?? []
        if (!updates.some(u => u.id === message.id)) updates.push({ id: message.id, contentHash: createHash('sha256').update(message.content).digest('hex') })
        changes.set(namespace, updates)
      }
    }
  }
  const results: unknown[] = []
  for (const [namespace, updates] of changes) results.push(await client.repairCodex({ namespace, updates, apply }))
  return results
}
