const TOKEN_KEY = 'stratagate_gateway_token'

/**
 * Cross-origin gateway origin; empty means same origin (Vite dev proxy or the
 * nginx sidecar in front of the gateway). The gateway already sends CORS
 * headers, so a direct cross-origin deployment also works when this is set.
 */
const BASE = import.meta.env.VITE_GATEWAY_ORIGIN ?? ''

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export const tokenStore = {
  get(): string {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? ''
    } catch {
      return ''
    }
  },
  set(value: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, value)
    } catch {
      /* storage unavailable (private mode); session only */
    }
  },
}

export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(BASE + path, {
    cache: 'no-store',
    signal,
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 401) throw new ApiError(401, '登录已失效，请重新输入 Gateway Token。')
  if (!res.ok) throw new ApiError(res.status, typeof data.error === 'string' ? data.error : '请求失败（HTTP ' + res.status + '）')
  return data as T
}

export async function apiSend<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(BASE + path, {
    method,
    cache: 'no-store',
    signal,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 401) throw new ApiError(401, '登录已失效，请重新输入 Gateway Token。')
  if (!res.ok) throw new ApiError(res.status, typeof data.error === 'string' ? data.error : '请求失败（HTTP ' + res.status + '）')
  return data as T
}
