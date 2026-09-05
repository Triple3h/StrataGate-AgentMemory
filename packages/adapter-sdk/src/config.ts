import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { memoryNamespace, projectKey as sharedProjectKey, projectNameFromDir, type ObservabilitySink } from '@diqier/stratagate'
import { observabilitySink } from './observability.js'
import { connectionEnv } from './connection.js'

export interface ModelConfig {
  baseUrl: string
  model: string
  apiKey?: string
  maxOutputTokens: number
}

export interface WorkBuddyModelConfig {
  command: string
  commandArgs: string[]
  model: string
  timeoutMs: number
}

export interface AdapterConfig {
  dataDir: string
  database: string
  projectDir: string
  namespace: string
  /** Namespace prefix used when the gateway resolves shared identities. */
  namespacePrefix?: string
  /** Stable project identifier persisted independently from the namespace string. */
  projectId?: string
  projectName?: string
  userId: string
  agentId: string
  sourceAdapter?: string
  memoryScope: 'project' | 'session' | 'global'
  blockTurnSize: number
  retrievalLimit: number
  maxContextChars: number
  workerIntervalMs: number
  workBuddyModel?: WorkBuddyModelConfig
  // Explicitly undefined-able: the gateway can clear a runtime provider override.
  model?: ModelConfig | undefined
  /** Optional non-blocking structured telemetry sink for host metrics. */
  observability?: ObservabilitySink
}

/** Compatibility type for existing host integrations. */
export type WorkBuddyConfig = AdapterConfig

function first(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean)
}

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

function disabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '')
}

function workBuddyCommand(env: NodeJS.ProcessEnv): Pick<WorkBuddyModelConfig, 'command' | 'commandArgs'> {
  const explicit = first(env.STRATAGATE_WORKBUDDY_CLI)
  if (explicit) {
    return ['.js', '.cjs', '.mjs'].includes(extname(explicit).toLowerCase())
      ? { command: process.execPath, commandArgs: [resolve(explicit)] }
      : { command: explicit, commandArgs: [] }
  }
  const bundledEntry = join(dirname(process.execPath), 'node_modules', '@tencent-ai', 'codebuddy-code', 'bin', 'codebuddy')
  if (existsSync(bundledEntry)) return { command: process.execPath, commandArgs: [bundledEntry] }
  return { command: process.platform === 'win32' ? 'codebuddy.cmd' : 'codebuddy', commandArgs: [] }
}

export function projectKey(cwd: string): string {
  return sharedProjectKey(resolve(cwd))
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env, cwd?: string): WorkBuddyConfig {
  env = connectionEnv(env)
  const dataDir = resolve(first(env.STRATAGATE_DATA_DIR, env.CODEBUDDY_PLUGIN_DATA, env.CLAUDE_PLUGIN_DATA)
    // Keep the shared engine's fallback identical for WorkBuddy, Codex, and
    // ZCode. Host-specific plugin variables still take precedence above.
    ?? join(homedir(), '.stratagate', 'agent-memory'))
  const projectDir = resolve(cwd ?? first(env.STRATAGATE_PROJECT_DIR, env.CODEBUDDY_PROJECT_DIR, env.CLAUDE_PROJECT_DIR)
    ?? process.cwd())
  const baseUrl = first(
    env.STRATAGATE_MODEL_BASE_URL,
    env.CODEBUDDY_PLUGIN_OPTION_MODEL_BASE_URL,
    env.CLAUDE_PLUGIN_OPTION_MODEL_BASE_URL,
  )
  const modelName = first(
    env.STRATAGATE_MODEL,
    env.CODEBUDDY_PLUGIN_OPTION_MODEL_NAME,
    env.CLAUDE_PLUGIN_OPTION_MODEL_NAME,
  )
  const apiKey = first(
    env.STRATAGATE_MODEL_API_KEY,
    env.CODEBUDDY_PLUGIN_OPTION_MODEL_API_KEY,
    env.CLAUDE_PLUGIN_OPTION_MODEL_API_KEY,
  )
  const model = baseUrl && modelName ? {
    baseUrl,
    model: modelName,
    ...(apiKey ? { apiKey } : {}),
    maxOutputTokens: integer(env.STRATAGATE_MODEL_MAX_OUTPUT_TOKENS, 10_000, 256, 16_384),
  } : undefined
  const sourceAdapter = first(env.STRATAGATE_SOURCE_ADAPTER) ?? 'gateway'
  const workBuddyModel = disabled(env.STRATAGATE_DISABLE_WORKBUDDY_MODEL) || sourceAdapter !== 'workbuddy' ? undefined : {
    ...workBuddyCommand(env),
    model: first(env.STRATAGATE_WORKBUDDY_MODEL) ?? 'lite',
    timeoutMs: integer(env.STRATAGATE_WORKBUDDY_TIMEOUT_MS, 90_000, 5_000, 300_000),
  }

  const explicitNamespace = first(env.STRATAGATE_NAMESPACE)
  const namespacePrefix = first(env.STRATAGATE_NAMESPACE_PREFIX) ?? 'shared'
  const userId = first(env.STRATAGATE_USER_ID, env.USER, env.USERNAME) ?? 'default'
  const agentId = first(env.STRATAGATE_AGENT_ID, env.CODEBUDDY_AGENT_ID, env.CLAUDE_AGENT_ID) ?? sourceAdapter
  const memoryScope = (first(env.STRATAGATE_MEMORY_SCOPE) ?? 'project') as WorkBuddyConfig['memoryScope']
  if (!['project', 'session', 'global'].includes(memoryScope)) throw new TypeError(`Invalid STRATAGATE_MEMORY_SCOPE: ${memoryScope}`)
  const sessionId = first(env.STRATAGATE_SESSION_ID, env.CODEBUDDY_SESSION_ID, env.CLAUDE_SESSION_ID)
  const globalNamespace = first(env.STRATAGATE_GLOBAL_NAMESPACE)
  const telemetry = observabilitySink(env)
  return {
    dataDir,
    database: resolve(first(env.STRATAGATE_DATABASE) ?? join(dataDir, 'memory.db')),
    projectDir,
    namespace: explicitNamespace ?? memoryNamespace({
      userId,
      namespacePrefix,
      memoryScope,
      projectDir,
      ...(sessionId ? { sessionId } : {}),
      ...(globalNamespace ? { globalNamespace } : {}),
    }),
    namespacePrefix,
    projectId: projectKey(projectDir),
    projectName: projectNameFromDir(projectDir),
    userId,
    agentId,
    sourceAdapter,
    memoryScope,
    blockTurnSize: integer(env.STRATAGATE_BLOCK_TURN_SIZE, 4, 1, 100),
    retrievalLimit: integer(env.STRATAGATE_RETRIEVAL_LIMIT, 8, 1, 20),
    maxContextChars: integer(env.STRATAGATE_MAX_CONTEXT_CHARS, 12_000, 1_000, 50_000),
    workerIntervalMs: integer(env.STRATAGATE_WORKER_INTERVAL_MS, 3_000, 1_000, 60_000),
    ...(workBuddyModel ? { workBuddyModel } : {}),
    ...(model ? { model } : {}),
    ...(telemetry ? { observability: telemetry } : {}),
  }
}
