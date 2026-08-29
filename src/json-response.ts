export interface ModelJsonResponseErrorOptions extends ErrorOptions {
  response?: string
  responsePreview?: string
}

const RESPONSE_PREVIEW_LIMIT = 500

function truncateResponsePreview(value: string): string {
  return value.slice(0, RESPONSE_PREVIEW_LIMIT)
}

export class ModelJsonResponseError extends Error {
  readonly fullMessage: string
  readonly response: string | undefined
  readonly responsePreview: string | undefined

  constructor(message = 'StrataGate model response was not valid JSON', options?: ModelJsonResponseErrorOptions) {
    const response = options?.response ?? options?.responsePreview
    const responsePreview = response ? truncateResponsePreview(response) : undefined
    const displayMessage = responsePreview
      ? `${message}\nRaw response preview (first ${RESPONSE_PREVIEW_LIMIT} chars):\n${responsePreview}`
      : message
    super(displayMessage, options)
    this.name = 'ModelJsonResponseError'
    const causeMessage = options?.cause instanceof Error
      ? options.cause.message.split('\nRaw response preview')[0]
      : ''
    const causeDetail = causeMessage && causeMessage !== message ? `\nCause: ${causeMessage}` : ''
    this.fullMessage = response
      ? `${message}${causeDetail}\nRaw response (full):\n${response}`
      : `${displayMessage}${causeDetail}`
    this.response = response
    this.responsePreview = responsePreview
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasRequiredKeys(value: Record<string, unknown>, requiredKeys: readonly string[]): boolean {
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function balancedValueEnd(value: string, start: number): number | null {
  const opening = value[start]
  if (opening !== '{' && opening !== '[') return null

  const stack: string[] = [opening]
  let inString = false
  let escaped = false
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      continue
    }
    if (character === '{' || character === '[') {
      stack.push(character)
      continue
    }
    if (character !== '}' && character !== ']') continue

    const expected = character === '}' ? '{' : '['
    if (stack.at(-1) !== expected) return null
    stack.pop()
    if (stack.length === 0) return index
  }
  return null
}

function parse(value: string): unknown | undefined {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

/**
 * Parse the single JSON object expected from a model response.
 *
 * Besides exact JSON, this accepts one balanced object wrapped in prose or a
 * markdown fence. The scanner understands strings and escapes, so braces in a
 * JSON string do not terminate the candidate. Adjacent top-level JSON values
 * are rejected as ambiguous; values separated by explanation text recover the
 * final object, which is the usual model-response shape.
 */
export function parseJsonResponse(value: string, requiredKeys: readonly string[] = []): Record<string, unknown> {
  const trimmed = value.trim().replace(/^\uFEFF/, '')
  const direct = parse(trimmed)
  if (direct !== undefined) {
    if (isObject(direct) && hasRequiredKeys(direct, requiredKeys)) return direct
    if (isObject(direct) && requiredKeys.length > 0) {
      throw new ModelJsonResponseError(
        `StrataGate model response JSON object was missing required fields: ${requiredKeys.join(', ')}`,
        { response: value },
      )
    }
    throw new ModelJsonResponseError('StrataGate model response was not a JSON object', { response: value })
  }

  const parsedValues: Array<{ value: unknown; start: number; end: number }> = []
  for (let start = 0; start < trimmed.length; start += 1) {
    const character = trimmed[start]
    if (character !== '{' && character !== '[') continue
    const end = balancedValueEnd(trimmed, start)
    if (end === null) continue
    const candidate = parse(trimmed.slice(start, end + 1))
    if (candidate !== undefined) parsedValues.push({ value: candidate, start, end })
    start = end
  }

  if (parsedValues.length === 1) {
    const only = parsedValues[0]!
    if (isObject(only.value) && hasRequiredKeys(only.value, requiredKeys)) return only.value
    if (isObject(only.value) && requiredKeys.length > 0) {
      throw new ModelJsonResponseError(
        `StrataGate model response JSON object was missing required fields: ${requiredKeys.join(', ')}`,
        { response: value },
      )
    }
    throw new ModelJsonResponseError('StrataGate model response did not contain a JSON object', { response: value })
  }
  if (parsedValues.length > 1) {
    // A model may include a JSON example in its explanation before the actual
    // answer. Keep the exact `{} {}` case strict, but recover the final object
    // when prose, a fence, or other non-whitespace text separates candidates.
    const first = parsedValues[0]!
    const last = parsedValues.at(-1)!
    const between = parsedValues.slice(0, -1).some((candidate, index) => {
      const next = parsedValues[index + 1]!
      return trimmed.slice(candidate.end + 1, next.start).trim().length > 0
    })
    const hasNonJsonPrefix = trimmed.slice(0, first.start).trim().length > 0
    const hasNonJsonSuffix = trimmed.slice(last.end + 1).trim().length > 0
    const final = last.value
    if ((between || hasNonJsonPrefix || hasNonJsonSuffix)
      && isObject(final) && hasRequiredKeys(final, requiredKeys)) return final
    if ((between || hasNonJsonPrefix || hasNonJsonSuffix)
      && isObject(final) && requiredKeys.length > 0) {
      throw new ModelJsonResponseError(
        `StrataGate model response JSON object was missing required fields: ${requiredKeys.join(', ')}`,
        { response: value },
      )
    }
    throw new ModelJsonResponseError('StrataGate model response contained multiple JSON values', { response: value })
  }
  throw new ModelJsonResponseError(undefined, { response: value })
}
