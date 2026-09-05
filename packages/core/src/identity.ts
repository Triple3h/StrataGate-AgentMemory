import { createHash } from 'node:crypto'
import { basename, resolve } from 'node:path'

export type MemoryNamespaceScope = 'project' | 'session' | 'global'

export interface MemoryIdentity {
  userId: string
  /** Adapter identity for provenance/state isolation; never partitions shared memory. */
  agentId?: string
  /** Stable project identifier persisted independently from the namespace string. */
  projectId?: string
  /** Human-readable workspace folder name; never used for namespace routing. */
  projectName?: string
  /** Conversation/session identifier for per-turn provenance. */
  conversationId?: string
  /** Host adapter that produced the source (dsh, workbuddy, codex, zcode). */
  sourceAdapter?: string
  memoryScope?: MemoryNamespaceScope
  projectDir?: string
  sessionId?: string
  namespacePrefix?: string
  globalNamespace?: string
}

/** Return a safe, human-readable label for a workspace directory. */
export function projectNameFromDir(cwd: string): string {
  const canonical = resolve(cwd).replace(/[\\/]+$/u, '')
  return basename(canonical) || '当前工作区'
}

function part(value: string, fallback: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/gu, '_').replace(/^\.+|\.+$/gu, '')
  return normalized || fallback
}

export function projectKey(cwd: string): string {
  const canonical = resolve(cwd).replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase()
  return createHash('sha256').update(canonical).digest('hex').slice(0, 20)
}

/**
 * Resolve the namespace shared by every host adapter. Agent identity is
 * intentionally not part of the namespace: different agents can collaborate
 * in one user's project while raw turns remain isolated by threadId.
 */
export function memoryNamespace(identity: MemoryIdentity): string {
  const userId = part(identity.userId, 'default')
  const prefix = part(identity.namespacePrefix ?? 'shared', 'shared')
  const scope = identity.memoryScope ?? 'project'
  if (scope === 'global') {
    return `${prefix}:user:${userId}:scope:global:${part(identity.globalNamespace ?? 'global', 'global')}`
  }
  if (scope === 'session') {
    return `${prefix}:user:${userId}:scope:session:${part(identity.sessionId ?? 'session', 'session')}`
  }
  return `${prefix}:user:${userId}:scope:project:${projectKey(identity.projectDir ?? process.cwd())}`
}

export function effectiveConfidence(
  baseConfidence: number,
  lastVerifiedAt: string | undefined,
  now = new Date(),
  halfLifeDays = 30,
): number {
  const base = Math.max(0, Math.min(1, Number.isFinite(baseConfidence) ? baseConfidence : 0))
  if (!lastVerifiedAt || !Number.isFinite(Date.parse(lastVerifiedAt)) || halfLifeDays <= 0) return base
  const elapsedDays = Math.max(0, (now.getTime() - Date.parse(lastVerifiedAt)) / 86_400_000)
  return base * Math.exp(-Math.LN2 * elapsedDays / halfLifeDays)
}
