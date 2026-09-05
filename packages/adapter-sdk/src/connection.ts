import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function connectionPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.STRATAGATE_CONNECTION_CONFIG?.trim() || join(homedir(), '.stratagate', 'connection.json')
}

/** Explicit process settings override the shared hook/MCP connection file. */
export function connectionEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  // Explicit environment objects are isolated unless they opt into a config file.
  if (env !== process.env && !env.STRATAGATE_CONNECTION_CONFIG) return { ...env }
  let saved: unknown
  try { saved = JSON.parse(readFileSync(connectionPath(env), 'utf8')) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...env }
    throw new Error(`Cannot read StrataGate connection config: ${connectionPath(env)}`)
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid StrataGate connection config')
  const result: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(saved)) {
    if (!key.startsWith('STRATAGATE_') || typeof value !== 'string') throw new Error(`Invalid connection setting: ${key}`)
    result[key] = value
  }
  return { ...result, ...Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined)) }
}
