import { reactive } from 'vue'
import { ApiError, api } from '../api/client.js'
import type { ConsoleSnapshot, Dashboard, NamespaceRow } from '../api/types.js'
import { markUnauthorized } from './session.js'

const PROJECT_KEY = 'stratagate_console_project'

export const workspace = reactive({
  dashboard: null as Dashboard | null,
  namespace: '',
  snapshot: null as ConsoleSnapshot | null,
  snapshotNamespace: '',
  loading: false,
  error: '',
})

let generation = 0
let activeController: AbortController | null = null

function storedProject(): string {
  try {
    return localStorage.getItem(PROJECT_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveProject(namespace: string): void {
  try {
    localStorage.setItem(PROJECT_KEY, namespace)
  } catch {
    /* storage unavailable */
  }
}

export function selectedRow(): NamespaceRow | undefined {
  return workspace.dashboard?.namespaces.find((row) => row.namespace === workspace.namespace)
}

function byActivityDesc(a: NamespaceRow, b: NamespaceRow): number {
  return (Date.parse(b.lastActivityAt ?? '') || 0) - (Date.parse(a.lastActivityAt ?? '') || 0)
}

/**
 * Loads the namespace list and the snapshot of the resolved namespace. With
 * `refreshDashboard = false` only the snapshot is refetched — this is the
 * project-switch path. In-flight requests are aborted via a generation guard,
 * as in the legacy console.
 */
export async function loadWorkspace(refreshDashboard = true, explicit = ''): Promise<void> {
  const current = ++generation
  activeController?.abort()
  const controller = new AbortController()
  activeController = controller
  workspace.loading = true
  workspace.error = ''
  workspace.snapshot = null
  workspace.snapshotNamespace = ''
  try {
    if (refreshDashboard || !workspace.dashboard) {
      const dashboard = await api<Dashboard>('/v1/dashboard', controller.signal)
      if (current !== generation) return
      dashboard.namespaces.sort(byActivityDesc)
      workspace.dashboard = dashboard
    }
    const rows = workspace.dashboard?.namespaces ?? []
    let namespace = explicit || storedProject()
    const exists = rows.some((row) => row.namespace === namespace)
    if (!exists) {
      if (explicit && namespace) throw new Error('链接中的项目不存在或已移除，请重新选择项目。')
      namespace = rows[0]?.namespace ?? ''
    }
    workspace.namespace = namespace
    if (namespace) {
      const snapshot = await api<ConsoleSnapshot>('/v1/console/snapshot?namespace=' + encodeURIComponent(namespace), controller.signal)
      if (current !== generation) return
      workspace.snapshot = snapshot
      workspace.snapshotNamespace = namespace
      saveProject(namespace)
    }
  } catch (error) {
    if (current !== generation || (error instanceof DOMException && error.name === 'AbortError')) return
    if (error instanceof ApiError && error.status === 401) {
      markUnauthorized()
      return
    }
    workspace.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (current === generation) workspace.loading = false
  }
}
