import z from '@deepseek-ai/schemastery'
import { homedir } from 'node:os'
import type { ObservabilitySink } from '@diqier/stratagate'

export type NamespaceMode = 'project' | 'session' | 'global'

export interface Config {
  database?: string
  namespaceMode?: NamespaceMode
  namespacePrefix?: string
  globalNamespace?: string
  userId?: string
  agentId?: string
  blockTurnSize?: number
  blockDecayLambda?: number
  ingestSubagents?: boolean
  provider?: string
  model?: string
  maxOutputTokens?: number
  structuredTaskTimeoutMs?: number
  adminToken?: string
  observability?: ObservabilitySink
}

export interface ResolvedConfig {
  database: string
  namespaceMode: NamespaceMode
  namespacePrefix: string
  globalNamespace: string
  userId?: string
  agentId?: string
  blockTurnSize: number
  blockDecayLambda: number
  ingestSubagents: boolean
  provider?: string
  model?: string
  maxOutputTokens: number
  structuredTaskTimeoutMs?: number
  adminToken?: string
  observability?: ObservabilitySink
}

export const Config: z<Config> = z.object({
  database: z.string().required(),
  namespaceMode: z.union(['project', 'session', 'global'] as const).default('project'),
  namespacePrefix: z.string().default('dsh'),
  globalNamespace: z.string().default('global'),
  userId: z.string(),
  agentId: z.string().default('dsh'),
  blockTurnSize: z.natural().min(1).default(6),
  blockDecayLambda: z.number().step(0.05).min(0).default(0.3)
    .description('Block 衰减系数 λ')
    .comment('默认 0.3；数字越小，记忆遗忘越慢，消耗 token 越多，不建议大于 0.4。'),
  ingestSubagents: z.boolean().default(false),
  provider: z.string(),
  model: z.string(),
  maxOutputTokens: z.natural().min(256).default(2_048),
  structuredTaskTimeoutMs: z.natural().min(1_000).default(45_000),
  adminToken: z.string(),
})

export function resolveConfig(config: Config): ResolvedConfig {
  const database = config.database?.trim() ?? ''
  // Keep the historical public default for config compatibility; the runtime
  // maps this legacy prefix to the shared cross-agent namespace.
  const namespacePrefix = config.namespacePrefix?.trim() || 'dsh'
  const globalNamespace = config.globalNamespace?.trim() || 'global'
  const userId = config.userId?.trim() || process.env.STRATAGATE_USER_ID?.trim() || process.env.USER?.trim() || homedir().split('/').at(-1) || 'default'
  const agentId = config.agentId?.trim() || 'dsh'
  const provider = config.provider?.trim()
  const model = config.model?.trim()
  const adminToken = config.adminToken?.trim() || process.env.STRATAGATE_ADMIN_TOKEN?.trim()
  if (!database) throw new TypeError('StrataGate database path must not be empty')
  if (Boolean(provider) !== Boolean(model)) {
    throw new TypeError('StrataGate provider and model must be configured together')
  }
  const resolved: ResolvedConfig = {
    database,
    namespaceMode: config.namespaceMode ?? 'project',
    namespacePrefix,
    globalNamespace,
    blockTurnSize: Math.max(1, Math.floor(config.blockTurnSize ?? 6)),
    blockDecayLambda: Math.max(0, config.blockDecayLambda ?? 0.3),
    ingestSubagents: config.ingestSubagents ?? false,
    ...(provider && model ? { provider, model } : {}),
    maxOutputTokens: Math.max(256, Math.floor(config.maxOutputTokens ?? 2_048)),
    structuredTaskTimeoutMs: Math.max(1_000, Math.floor(config.structuredTaskTimeoutMs ?? 45_000)),
    ...(adminToken ? { adminToken } : {}),
  }
  Object.defineProperties(resolved, {
    userId: { value: userId, enumerable: false },
    agentId: { value: agentId, enumerable: false },
  })
  return resolved
}
