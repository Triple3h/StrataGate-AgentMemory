import { readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { atomicJson } from '../../adapter-sdk/src/delivery.js'
import type { ModelConfig } from '../../adapter-sdk/src/config.js'

const PROVIDER_FILE = 'model-provider.json'

export interface StoredModelProvider {
  baseUrl: string
  model: string
  apiKey?: string
  maxOutputTokens?: number
  updatedAt?: string
}

export interface ModelProviderInput {
  baseUrl: string
  model: string
  apiKey?: string
  maxOutputTokens?: number
}

export class ProviderConfigError extends Error {}

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new ProviderConfigError(`${field} is required`)
  const trimmed = value.trim()
  if (trimmed.length > maxLength) throw new ProviderConfigError(`${field} must be at most ${maxLength} characters`)
  return trimmed
}

/**
 * Parses a PUT/test body into a validated provider input. The API key stays
 * optional so the console can submit "keep the current key" by omitting it.
 */
export function parseProviderInput(body: Record<string, unknown>): ModelProviderInput {
  const baseUrl = requireText(body.baseUrl, 'baseUrl', 500)
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new ProviderConfigError('baseUrl must be a valid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new ProviderConfigError('baseUrl must use http or https')
  const model = requireText(body.model, 'model', 200)
  const rawKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  if (rawKey.length > 4_096) throw new ProviderConfigError('apiKey must be at most 4096 characters')
  let maxOutputTokens: number | undefined
  if (body.maxOutputTokens !== undefined && body.maxOutputTokens !== null && body.maxOutputTokens !== '') {
    const value = Number(body.maxOutputTokens)
    if (!Number.isSafeInteger(value) || value < 256 || value > 16_384) throw new ProviderConfigError('maxOutputTokens must be an integer between 256 and 16384')
    maxOutputTokens = value
  }
  return {
    baseUrl: baseUrl.replace(/\/+$/u, ''),
    model,
    ...(rawKey ? { apiKey: rawKey } : {}),
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
  }
}

export function toModelConfig(provider: StoredModelProvider): ModelConfig {
  return {
    baseUrl: provider.baseUrl,
    model: provider.model,
    ...(provider.apiKey ? { apiKey: provider.apiKey } : {}),
    maxOutputTokens: provider.maxOutputTokens ?? 10_000,
  }
}

/** Never returns a usable key; the console only needs a recognisable tail. */
export function maskApiKey(apiKey: string | undefined): string {
  if (!apiKey) return ''
  return `••••${apiKey.slice(-4)}`
}

export function providerFilePath(dataDir: string): string {
  return resolve(dataDir, PROVIDER_FILE)
}

export function loadStoredModelProvider(dataDir: string): StoredModelProvider | null {
  let raw: string
  try {
    raw = readFileSync(providerFilePath(dataDir), 'utf8')
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed.baseUrl !== 'string' || typeof parsed.model !== 'string') return null
    return {
      baseUrl: parsed.baseUrl,
      model: parsed.model,
      ...(typeof parsed.apiKey === 'string' && parsed.apiKey ? { apiKey: parsed.apiKey } : {}),
      ...(typeof parsed.maxOutputTokens === 'number' ? { maxOutputTokens: parsed.maxOutputTokens } : {}),
      ...(typeof parsed.updatedAt === 'string' ? { updatedAt: parsed.updatedAt } : {}),
    }
  } catch {
    return null
  }
}

export async function saveModelProvider(dataDir: string, provider: StoredModelProvider): Promise<void> {
  await atomicJson(providerFilePath(dataDir), provider)
}

export function clearStoredModelProvider(dataDir: string): void {
  rmSync(providerFilePath(dataDir), { force: true })
}
