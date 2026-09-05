import { reactive } from 'vue'
import { ApiError, api, tokenStore } from '../api/client.js'

export type AuthState = boolean | null

export const session = reactive({
  authenticated: null as AuthState,
  loggingIn: false,
  error: '',
})

/**
 * Boot gate: a stored token is trusted optimistically — the first API call
 * flips `authenticated` back to false on a 401 and the login panel replaces
 * the shell, matching the legacy console behavior.
 */
export function bootstrapSession(): boolean {
  if (!tokenStore.get()) {
    session.authenticated = false
    return false
  }
  session.authenticated = true
  return true
}

export function markUnauthorized(): void {
  session.authenticated = false
}

export async function login(rawToken: string): Promise<boolean> {
  const token = String(rawToken ?? '').trim()
  if (!token || session.loggingIn) return false
  session.loggingIn = true
  session.error = ''
  const previous = tokenStore.get()
  tokenStore.set(token)
  try {
    await api('/health')
    session.authenticated = true
    return true
  } catch (error) {
    tokenStore.set(previous)
    session.authenticated = false
    session.error = error instanceof ApiError
      ? error.status === 401 ? 'Token 无效（HTTP 401）' : error.message
      : 'Token 校验失败，请检查 Gateway 连接。'
    return false
  } finally {
    session.loggingIn = false
  }
}
