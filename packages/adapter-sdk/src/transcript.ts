import type { ToolTrace, TurnInput } from '@diqier/stratagate'

type JsonObject = Record<string, unknown>

const INJECTED_MEMORY_RE = /<stratagate_memory\b[^>]*>[\s\S]*?<\/stratagate_memory>/giu

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function blocks(value: unknown): unknown[] {
  return Array.isArray(value) ? value : typeof value === 'string' ? [{ type: 'text', text: value }] : []
}

function blockText(value: unknown): string {
  const item = object(value)
  if (typeof item.text === 'string') return item.text
  if (typeof item.content === 'string') return item.content
  if (Array.isArray(item.content)) return item.content.map(blockText).filter(Boolean).join('\n')
  return ''
}

function normalized(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

function cleanInjectedMemory(value: string): string {
  return value.replace(INJECTED_MEMORY_RE, '').trim()
}

function isStrataGateTool(name: string): boolean {
  const lowered = name.toLowerCase()
  return lowered.includes('stratagate') || lowered.startsWith('mcp__stratagate') || lowered.startsWith('memory_')
}

function humanText(entry: JsonObject): string {
  if (entry.type !== 'user') return ''
  const message = object(entry.message)
  const content = blocks(message.content)
  if (content.some((block) => object(block).type === 'tool_result')) return ''
  return content
    .filter((block) => object(block).type === 'text')
    .map(blockText)
    .map(cleanInjectedMemory)
    .filter(Boolean)
    .join('\n')
    .trim()
}

function timestamp(entry: JsonObject): string | undefined {
  return typeof entry.timestamp === 'string' && Number.isFinite(Date.parse(entry.timestamp)) ? entry.timestamp : undefined
}

export function parseJsonLines(buffer: Buffer): { entries: JsonObject[]; consumedBytes: number } {
  const entries: JsonObject[] = []
  let start = 0
  let consumedBytes = 0
  while (start < buffer.length) {
    const newline = buffer.indexOf(0x0a, start)
    const end = newline === -1 ? buffer.length : newline
    const line = buffer.subarray(start, end).toString('utf8').trim()
    if (line) {
      try {
        const parsed = JSON.parse(line)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) entries.push(parsed as JsonObject)
      } catch {
        if (newline === -1) break
      }
    }
    consumedBytes = newline === -1 ? buffer.length : newline + 1
    start = newline === -1 ? buffer.length : newline + 1
  }
  return { entries, consumedBytes }
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function codexTextBlocks(value: unknown): Array<{ type: 'text'; text: string }> {
  const values = Array.isArray(value) ? value : [value]
  const text = values.map((item) => typeof item === 'string' ? item : blockText(item)).filter(Boolean).join('\n').trim()
  return text ? [{ type: 'text', text: cleanInjectedMemory(text) }] : []
}

function codexBase(entry: JsonObject): JsonObject {
  const payload = object(entry.payload)
  const metadata = object(payload.internal_chat_message_metadata_passthrough)
  const turnId = nonEmptyString(entry.turn_id)
    ?? nonEmptyString(payload.turn_id)
    ?? nonEmptyString(metadata.turn_id)
  const createdAt = typeof entry.timestamp === 'string' && Number.isFinite(Date.parse(entry.timestamp))
    ? entry.timestamp
    : undefined
  return {
    ...(createdAt ? { timestamp: createdAt } : {}),
    ...(turnId ? { turnId } : {}),
  }
}

function parsedToolArguments(value: unknown): JsonObject | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonObject
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as JsonObject
      : { value: parsed }
  } catch {
    return { raw: value }
  }
}

function hasKeys(value: JsonObject | undefined): value is JsonObject {
  return Boolean(value && Object.keys(value).length > 0)
}

function codexToolEntries(
  base: JsonObject,
  name: string,
  id: string,
  argumentsValue?: JsonObject,
  result?: unknown,
): JsonObject[] {
  const toolUse = {
    type: 'tool_use',
    id,
    name,
    ...(hasKeys(argumentsValue) ? { input: argumentsValue } : {}),
  }
  const output: JsonObject[] = [{
    ...base,
    type: 'assistant',
    message: { content: [toolUse] },
  }]
  if (result !== undefined) {
    output.push({
      ...base,
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: id, content: result }] },
    })
  }
  return output
}

function codexToolName(item: JsonObject): string {
  const server = nonEmptyString(item.server)
  const tool = nonEmptyString(item.tool)
  if (server && tool) return `${server}/${tool}`
  return tool ?? server ?? nonEmptyString(item.name) ?? String(item.type ?? 'tool')
}

function codexCommandResult(item: JsonObject): unknown {
  if ('result' in item) return item.result
  const result: JsonObject = {}
  for (const key of ['stdout', 'stderr', 'aggregated_output', 'formatted_output', 'exit_code', 'status']) {
    if (item[key] !== undefined && item[key] !== '') result[key] = item[key]
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function codexEventEntries(entry: JsonObject): JsonObject[] {
  const payload = object(entry.payload)
  if (payload.type !== 'item_completed') return []
  const item = object(payload.item)
  const itemType = nonEmptyString(item.type)?.toLowerCase()
  const base = codexBase(entry)
  if (itemType === 'usermessage') {
    const content = codexTextBlocks(item.content)
    return content.length > 0 ? [{ ...base, type: 'user', message: { content } }] : []
  }
  if (itemType === 'agentmessage') {
    const content = codexTextBlocks(item.content)
    return content.length > 0 ? [{ ...base, type: 'assistant', message: { content } }] : []
  }
  if (itemType === 'mcptoolcall' || itemType === 'dynamictoolcall' || itemType === 'functioncall' || itemType === 'commandexecution') {
    const name = codexToolName(item)
    if (isStrataGateTool(name)) return []
    const id = nonEmptyString(item.id) ?? `anonymous:${name}`
    const argumentsValue = itemType === 'commandexecution'
      ? {
          ...(item.command !== undefined ? { command: item.command } : {}),
          ...(nonEmptyString(item.cwd) ? { cwd: item.cwd } : {}),
        }
      : parsedToolArguments(item.arguments ?? item.input)
    return codexToolEntries(base, name, id, argumentsValue, codexCommandResult(item))
  }
  return []
}

function codexResponseEntries(entry: JsonObject): JsonObject[] {
  const payload = object(entry.payload)
  const type = nonEmptyString(payload.type)?.toLowerCase()
  const base = codexBase(entry)
  if (type === 'message') {
    const role = nonEmptyString(payload.role)
    if (role !== 'user' && role !== 'assistant') return []
    const content = codexTextBlocks(payload.content)
    return content.length > 0 ? [{ ...base, type: role, message: { content } }] : []
  }
  if (type === 'custom_tool_call' || type === 'function_call' || type === 'tool_call' || type === 'dynamic_tool_call') {
    const name = nonEmptyString(payload.name) ?? type
    if (isStrataGateTool(name)) return []
    const id = nonEmptyString(payload.call_id) ?? nonEmptyString(payload.id) ?? `anonymous:${name}`
    return codexToolEntries(base, name, id, parsedToolArguments(payload.arguments ?? payload.input))
  }
  if (type === 'custom_tool_call_output' || type === 'function_call_output' || type === 'tool_call_output' || type === 'dynamic_tool_call_output') {
    const id = nonEmptyString(payload.call_id) ?? nonEmptyString(payload.id) ?? 'anonymous:tool'
    return isStrataGateTool(id) ? [] : [{
      ...base,
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: id, content: payload.output ?? payload.result }] },
    }]
  }
  return []
}

export function normalizeCodexEntries(entries: readonly JsonObject[]): JsonObject[] {
  const merged: JsonObject[] = []
  const seen = new Map<string, { event: number; response: number }>()
  for (const source of entries) {
    for (const candidate of [...codexEventEntries(source), ...codexResponseEntries(source)]) {
      const message = object(candidate.message)
      const content = blocks(message.content)
      const key = `${candidate.type}:${JSON.stringify(content)}`
      const counts = seen.get(key) ?? { event: 0, response: 0 }
      const origin = object(source.payload).type === 'item_completed' ? 'event' : 'response'
      counts[origin] += 1
      seen.set(key, counts)
      // Collapse mirrored representations, not repeated messages in one stream.
      if (counts[origin] <= counts[origin === 'event' ? 'response' : 'event']) continue
      merged.push(candidate)
    }
  }
  if (merged.length > 0) return merged
  return [...entries]
}

export function foldLatestTurn(
  entries: readonly JsonObject[],
  prompt: string | undefined,
  fallbackAssistant?: string,
): TurnInput | null {
  entries = normalizeCodexEntries(entries)
  let start = -1
  const wanted = normalized(prompt ?? '')
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const candidate = humanText(entries[index] ?? {})
    if (!candidate) continue
    if (!wanted || normalized(candidate) === wanted) {
      start = index
      break
    }
    if (start === -1) start = index
  }
  if (start < 0 && !wanted) return null

  const selected = entries.slice(Math.max(0, start))
  const user = prompt?.trim() || humanText(selected[0] ?? {})
  if (!user) return null

  const toolById = new Map<string, ToolTrace>()
  const assistantParts: string[] = []
  let createdAt: string | undefined
  for (const entry of selected) {
    createdAt ??= timestamp(entry)
    const message = object(entry.message)
    if (entry.type === 'assistant') {
      for (const block of blocks(message.content)) {
        const item = object(block)
        if (item.type === 'text') {
          const value = blockText(item).trim()
          if (value && !value.includes('<stratagate_memory')) assistantParts.push(value)
        }
        if (item.type === 'tool_use' && typeof item.name === 'string' && !isStrataGateTool(item.name)) {
          const id = typeof item.id === 'string' ? item.id : `anonymous:${toolById.size}`
          toolById.set(id, {
            name: item.name,
            ...(object(item.input) && Object.keys(object(item.input)).length > 0 ? { arguments: object(item.input) } : {}),
          })
        }
      }
    }
    if (entry.type === 'user') {
      for (const block of blocks(message.content)) {
        const item = object(block)
        if (item.type !== 'tool_result') continue
        const id = typeof item.tool_use_id === 'string' ? item.tool_use_id : ''
        const trace = toolById.get(id)
        if (trace) trace.result = item.content
      }
    }
  }

  const assistant = assistantParts.join('\n\n').trim() || fallbackAssistant?.trim() || ''
  if (!assistant) return null
  const toolCalls = [...toolById.values()]
  return {
    user,
    assistant,
    ...(createdAt ? { createdAt } : {}),
    ...(toolCalls.length > 0 ? { assistantToolCalls: toolCalls } : {}),
  }
}
