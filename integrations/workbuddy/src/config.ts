export * from '../../../packages/adapter-sdk/src/config.js'
import { resolveConfig as sharedConfig } from '../../../packages/adapter-sdk/src/config.js'
import { connectionEnv } from '../../../packages/adapter-sdk/src/connection.js'
export function resolveConfig(env: NodeJS.ProcessEnv = process.env, cwd?: string) {
  return sharedConfig({ ...connectionEnv(env), STRATAGATE_SOURCE_ADAPTER: env.STRATAGATE_SOURCE_ADAPTER ?? 'workbuddy' }, cwd)
}
