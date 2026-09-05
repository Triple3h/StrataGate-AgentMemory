import { timingSafeEqual } from 'node:crypto'
import { memoryNamespace, type MemoryIdentity } from './identity.js'
import type { MemoryScope, RawMessage } from './types.js'

/** Fields that define the durable owner of a namespace. Agent/session provenance
 * is deliberately excluded: those values may vary while a project is shared. */
export interface NamespaceIdentityFields {
  userId: string
  projectId: string | null
  memoryScope: MemoryIdentity['memoryScope']
  namespacePrefix: string
}

export interface IdentityConflict {
  field: keyof NamespaceIdentityFields
  expected: string | null
  actual: string | null
}

export function namespaceIdentityFields(identity: MemoryIdentity): NamespaceIdentityFields {
  return {
    userId: identity.userId.trim() || 'default',
    projectId: identity.projectId?.trim() || null,
    memoryScope: identity.memoryScope ?? 'project',
    namespacePrefix: identity.namespacePrefix?.trim() || 'shared',
  }
}

export function identityConflicts(
  stored: MemoryIdentity | undefined,
  requested: MemoryIdentity,
): IdentityConflict[] {
  if (!stored) return []
  const left = namespaceIdentityFields(stored)
  const right = namespaceIdentityFields(requested)
  return (Object.keys(left) as Array<keyof NamespaceIdentityFields>)
    .filter((field) => left[field] !== right[field])
    .map((field) => ({ field, expected: left[field] ?? null, actual: right[field] ?? null }))
}

/** Check the human-readable routing key before opening a durable namespace. */
export function namespaceMatchesIdentity(namespace: string, identity: MemoryIdentity): boolean {
  const expected = memoryNamespace(identity)
  if (namespace === expected) return true
  const fields = namespaceIdentityFields(identity)
  const prefix = `${fields.namespacePrefix}:user:${fields.userId}:scope:${fields.memoryScope}:`
  // Explicit legacy/custom namespaces cannot be reconstructed from identity;
  // retain compatibility and rely on the persisted identity comparison.
  if (!namespace.includes(':user:')) return true
  if (!namespace.startsWith(prefix)) return false
  const suffix = namespace.slice(prefix.length)
  if (fields.memoryScope === 'project') return !fields.projectId || suffix === fields.projectId
  if (fields.memoryScope === 'session') return !identity.sessionId || suffix === identity.sessionId
  return !identity.globalNamespace || suffix === identity.globalNamespace
}

/** Return true only when a memory item is visible to the requesting context. */
export function canAccessMemoryScope(
  scope: MemoryScope,
  context: { requestedScope?: MemoryScope | readonly MemoryScope[] | undefined; threadId?: string | undefined; sourceThreadId?: string | undefined },
): boolean {
  const requested = context.requestedScope
  if (requested !== undefined) {
    const allowed = Array.isArray(requested) ? requested : [requested]
    if (!allowed.includes(scope)) return false
  }
  if (scope !== 'session') return true
  if (!context.threadId) return false
  return context.sourceThreadId === context.threadId
}

export function canAccessRawMessage(
  message: Pick<RawMessage, 'threadId'>,
  context: { threadId?: string | undefined; requestedScope?: 'session' | 'namespace' | undefined },
): boolean {
  if (context.requestedScope !== 'session' || !context.threadId) return true
  return message.threadId === context.threadId
}

/** Redaction is intentionally one-way and only applies at an outbound boundary. */
export function redactSensitiveText(text: string): string {
  return text
    .replace(/\b(?:sk|gh[opasu]|github_pat)_[A-Za-z0-9_-]{12,}\b/gu, '[REDACTED_TOKEN]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\/-]{12,}={0,2}\b/giu, '$1[REDACTED]')
    .replace(/\b(api[_-]?key|token|password|secret)\s*[:=]\s*([^\s,;]+)/giu, '$1=[REDACTED]')
}

export function redactSensitiveValue(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveText(value)
  if (Array.isArray(value)) return value.map(redactSensitiveValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactSensitiveValue(item)]))
  }
  return value
}

export function constantTimeTokenEqual(expected: string, supplied: string): boolean {
  const left = Buffer.from(expected)
  const right = Buffer.from(supplied)
  return left.length === right.length && timingSafeEqual(left, right)
}
