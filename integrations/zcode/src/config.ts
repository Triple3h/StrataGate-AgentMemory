import { connectionEnv } from '../../../packages/adapter-sdk/src/connection.js'
import { resolveConfig } from '../../../packages/adapter-sdk/src/config.js'

export function zcodeEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const effective = connectionEnv(env)
  return { ...effective, STRATAGATE_SOURCE_ADAPTER: 'zcode', STRATAGATE_AGENT_ID: 'zcode', STRATAGATE_DISABLE_WORKBUDDY_MODEL: '1' }
}
export function zcodeConfig(cwd?: string, env: NodeJS.ProcessEnv = process.env) {
  return resolveConfig(zcodeEnv(env), cwd)
}
