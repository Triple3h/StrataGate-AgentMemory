import { describe, expect, it } from 'vitest'
import { effectiveConfidence, memoryNamespace, projectKey, projectNameFromDir } from '../src/identity.js'

describe('shared memory identity', () => {
  it('uses the same project namespace regardless of adapter', () => {
    const base = { userId: 'alice', namespacePrefix: 'shared', memoryScope: 'project' as const, projectDir: '/tmp/demo' }
    expect(memoryNamespace(base)).toBe(memoryNamespace({ ...base }))
    expect(memoryNamespace(base)).toContain(`user:alice:scope:project:${projectKey('/tmp/demo')}`)
  })

  it('derives a readable workspace name without changing the routing key', () => {
    expect(projectNameFromDir('/tmp/Example Workspace/')).toBe('Example Workspace')
    expect(projectKey('/tmp/Example Workspace/')).toBe(projectKey('/tmp/Example Workspace'))
  })

  it('isolates sessions and users while sharing agents', () => {
    const common = { namespacePrefix: 'shared', projectDir: '/tmp/demo' }
    expect(memoryNamespace({ ...common, userId: 'alice', memoryScope: 'session', sessionId: 's1' }))
      .not.toBe(memoryNamespace({ ...common, userId: 'alice', memoryScope: 'session', sessionId: 's2' }))
    expect(memoryNamespace({ ...common, userId: 'alice' })).not.toBe(memoryNamespace({ ...common, userId: 'bob' }))
  })

  it('decays effective confidence by natural time without changing base confidence', () => {
    const verified = '2026-01-01T00:00:00.000Z'
    expect(effectiveConfidence(0.8, verified, new Date('2026-01-31T00:00:00.000Z'), 30)).toBeCloseTo(0.4, 3)
    expect(effectiveConfidence(0.8, verified, new Date('2026-01-01T00:00:00.000Z'), 30)).toBe(0.8)
  })
})
