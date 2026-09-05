import { describe, expect, it } from 'vitest'
import {
  canAccessMemoryScope,
  canAccessRawMessage,
  constantTimeTokenEqual,
  identityConflicts,
  namespaceMatchesIdentity,
  redactSensitiveText,
} from '../src/security.js'

describe('security boundaries', () => {
  it('detects immutable namespace identity conflicts but ignores agent rotation', () => {
    const stored = { userId: 'alice', projectId: 'p1', memoryScope: 'project' as const, namespacePrefix: 'shared', agentId: 'codex' }
    expect(identityConflicts(stored, { ...stored, agentId: 'zcode' })).toEqual([])
    expect(identityConflicts(stored, { ...stored, userId: 'bob' })).toEqual([
      { field: 'userId', expected: 'alice', actual: 'bob' },
    ])
    expect(namespaceMatchesIdentity('shared:user:alice:scope:project:p1', stored)).toBe(true)
    expect(namespaceMatchesIdentity('shared:user:bob:scope:project:p1', stored)).toBe(false)
  })

  it('keeps session-scoped data in its source conversation', () => {
    expect(canAccessMemoryScope('session', { threadId: 'a', sourceThreadId: 'a' })).toBe(true)
    expect(canAccessMemoryScope('session', { threadId: 'a', sourceThreadId: 'b' })).toBe(false)
    expect(canAccessMemoryScope('session', { threadId: 'a' })).toBe(false)
    expect(canAccessMemoryScope('project', { threadId: 'a', sourceThreadId: 'b' })).toBe(true)
    expect(canAccessRawMessage({ threadId: 'b' }, { threadId: 'a', requestedScope: 'session' })).toBe(false)
    expect(canAccessRawMessage({}, { threadId: 'a', requestedScope: 'session' })).toBe(false)
  })

  it('redacts outbound credentials irreversibly and compares admin tokens safely', () => {
    expect(redactSensitiveText('api_key=secret-value Bearer abcdefghijklmnop')).toContain('[REDACTED]')
    expect(redactSensitiveText('sk_abcdefghijklmnop')).toBe('[REDACTED_TOKEN]')
    expect(constantTimeTokenEqual('abc', 'abc')).toBe(true)
    expect(constantTimeTokenEqual('abc', 'abd')).toBe(false)
  })
})
