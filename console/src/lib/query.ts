import { useRoute, useRouter, type LocationQuery } from 'vue-router'

export function paramValue(query: LocationQuery, key: string): string {
  const value = query[key]
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.find((item): item is string => typeof item === 'string' && item !== '') ?? ''
  return ''
}

export function projectOnlyQuery(query: LocationQuery): Record<string, string> {
  const project = paramValue(query, 'project')
  return project ? { project } : {}
}

/**
 * URL query is the source of truth for filters (project, q, agent, source,
 * session, tab). Setting a value to `undefined` removes it, mirroring how the
 * legacy console cleared filters on navigation.
 */
export function useQueryNav() {
  const router = useRouter()
  const route = useRoute()

  function pushQuery(updates: Record<string, string | undefined>, replace = false): void {
    const merged: Record<string, string> = {}
    const source = { ...route.query, ...updates }
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' && value) merged[key] = value
      else if (Array.isArray(value)) {
        const first = value.find((item): item is string => typeof item === 'string' && item !== '')
        if (first) merged[key] = first
      }
    }
    void router[replace ? 'replace' : 'push']({ query: merged })
  }

  return { pushQuery }
}
