import { connectionEnv } from '../../../packages/adapter-sdk/src/connection.js'
import { resolveConfig } from '../../../packages/adapter-sdk/src/config.js'

export function codexEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const effective = connectionEnv(env)
  return { ...effective, ...(effective.CODEX_THREAD_ID && !effective.STRATAGATE_SESSION_ID ? { STRATAGATE_SESSION_ID: effective.CODEX_THREAD_ID } : {}),
    STRATAGATE_SOURCE_ADAPTER: 'codex', STRATAGATE_AGENT_ID: 'codex', STRATAGATE_DISABLE_WORKBUDDY_MODEL: '1' }
}
export function codexConfig(cwd?: string, env: NodeJS.ProcessEnv = process.env) {
  return resolveConfig(codexEnv(env), cwd)
}
