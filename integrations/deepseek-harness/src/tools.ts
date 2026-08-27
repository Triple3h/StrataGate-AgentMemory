import type { Context } from '@deepseek-ai/cordis'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { StrataGateRuntime } from './runtime.js'
import type {} from '@deepseek-ai/dsh-tools'

const jsonOutput = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown): ContentBlock[] => [{
    type: 'text',
    text: JSON.stringify(value, null, 2),
  }],
}

function sessionOf(exec: ToolRunContext): Session {
  if (!exec.agent) throw new Error('StrataGate tools require an active DSH agent session')
  return exec.agent.session
}

export function registerMemoryTools(ctx: Context, runtime: StrataGateRuntime): void {
  ctx.tools.register(defineTool({
    name: 'memory_search_events',
    description: 'Search durable StrataGate event memories. Returns a batchId, evidenceRefs, and ranked event cards. Pass that batchId to memory_assess before relying on its evidence.',
    parameters: {
      query: { type: 'string', required: true, description: 'What historical decision, event, preference, or outcome to find.' },
      limit: { type: 'integer', description: 'Maximum results, 1-20.' },
      temporalIntent: { type: 'string', enum: ['first', 'latest'] as const },
      eventType: { type: 'string' },
      participants: { type: 'array', items: { type: 'string' } },
    },
    output: jsonOutput,
    execute: async (args, exec) => runtime.searchEvents(sessionOf(exec), args.query, {
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
      ...(args.temporalIntent ? { temporalIntent: args.temporalIntent } : {}),
      ...(args.eventType ? { eventType: args.eventType } : {}),
      ...(args.participants ? { participants: args.participants } : {}),
    }) as never,
  }))

  ctx.tools.register(defineTool({
    name: 'memory_search_graph',
    description: 'Search the current Event-backed Knowledge Graph for people, projects, organizations, tools, places, facts, and relations. Returns an independently assessable retrieval batch.',
    parameters: {
      query: { type: 'string', required: true },
      limit: { type: 'integer', description: 'Maximum results, 1-20.' },
    },
    output: jsonOutput,
    execute: async (args, exec) => runtime.searchGraph(sessionOf(exec), args.query, args.limit ?? 8) as never,
  }))

  ctx.tools.register(defineTool({
    name: 'memory_expand_graph_node',
    description: 'Expand one Knowledge Graph node with its current facts, directed edges, and supporting Event evidence.',
    parameters: { id: { type: 'string', required: true } },
    output: jsonOutput,
    execute: async (args, exec) => runtime.expandGraphNode(sessionOf(exec), args.id) as never,
  }))

  ctx.tools.register(defineTool({
    name: 'memory_search_elements',
    description: 'Deprecated compatibility search for legacy Element-card data. Prefer memory_search_graph.',
    parameters: {
      query: { type: 'string', required: true },
      limit: { type: 'integer' },
      name: { type: 'string' },
      elementType: { type: 'string', enum: ['person', 'project', 'organization', 'tool', 'place'] as const },
    },
    output: jsonOutput,
    execute: async (args, exec) => runtime.searchElements(sessionOf(exec), args.query, {
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
      ...(args.name ? { name: args.name } : {}),
      ...(args.elementType ? { type: args.elementType } : {}),
    }) as never,
  }))

  ctx.tools.register(defineTool({
    name: 'memory_search_raw',
    description: 'Search verbatim archived messages when summarized memories are insufficient. Returns raw evidence refs and a batchId for assessment.',
    parameters: {
      query: { type: 'string', required: true },
      limit: { type: 'integer' },
    },
    output: jsonOutput,
    execute: async (args, exec) => runtime.searchRaw(sessionOf(exec), args.query, args.limit) as never,
  }))

  ctx.tools.register(defineTool({
    name: 'memory_get_blocks',
    description: 'List decayed conversation-block summaries and their current detail levels. Returns block evidence refs and a batchId for assessment.',
    parameters: {},
    output: jsonOutput,
    execute: async (_args, exec) => runtime.blocks(sessionOf(exec)) as never,
  }))

  ctx.tools.register(defineTool({
    name: 'memory_expand_block',
    description: 'Expand one memory block to a more detailed layer. The result is a new evidence batch and must be assessed.',
    parameters: {
      id: { type: 'string', required: true },
      target: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
    },
    output: jsonOutput,
    execute: async (args, exec) => runtime.expandBlock(sessionOf(exec), args.id, args.target) as never,
  }))

  ctx.tools.register(defineTool({
    name: 'memory_expand_event',
    description: 'Retrieve one complete Event card by id. The result is a new evidence batch and must be assessed.',
    parameters: {
      id: { type: 'string', required: true },
    },
    output: jsonOutput,
    execute: async (args, exec) => runtime.expandEvent(sessionOf(exec), args.id) as never,
  }))

  ctx.tools.register(defineTool({
    name: 'memory_expand_element',
    description: 'Expand an Element card, optionally as it was at an ISO date. The result is a new evidence batch and must be assessed.',
    parameters: {
      id: { type: 'string', required: true },
      at: { type: 'string' },
    },
    output: jsonOutput,
    execute: async (args, exec) => runtime.expandElement(sessionOf(exec), args.id, args.at) as never,
  }))

  ctx.tools.register(defineTool({
    name: 'memory_assess',
    description: 'Apply StrataGate Evidence Gate to a retrieval batch. Pass batch_id from the retrieval result; omitting it remains compatible with sequential flows and selects the latest batch. The response reports every input ref that was not adopted and why.',
    parameters: {
      batch_id: { type: 'string', description: 'The batchId returned by the retrieval to assess. Omit only in a strictly sequential flow.' },
      verdict: { type: 'string', enum: ['sufficient', 'partial', 'wrong'] as const, required: true },
      evidence_refs: { type: 'array', items: { type: 'string' }, required: true },
      fit: { type: 'string', required: true },
      missing: { type: 'string', required: true },
      next_strategy: {
        type: 'string',
        enum: ['answer', 'search_events', 'expand_event', 'search_graph', 'expand_graph_node', 'search_elements', 'expand_element', 'search_raw_memory', 'expand_block'] as const,
        required: true,
      },
    },
    output: jsonOutput,
    execute: async (args, exec) => runtime.assess(sessionOf(exec), args, args.batch_id) as never,
  }))

  ctx.tools.register(defineTool({
    name: 'memory_record_use',
    description: 'Close one StrataGate retrieval batch. Pass its batch_id and exactly the evidenceRefs from that batch actually used in the answer, or [] when none were used. Non-empty refs require that batch\'s sufficient assessment. Omitting batch_id selects the latest batch for sequential compatibility.',
    parameters: {
      batch_id: { type: 'string', description: 'The batchId to close. Omit only in a strictly sequential flow.' },
      evidence_refs: { type: 'array', items: { type: 'string' }, required: true },
    },
    output: jsonOutput,
    execute: async (args, exec) => runtime.recordUse(
      sessionOf(exec),
      String(exec.callId),
      args.evidence_refs,
      args.batch_id,
    ) as never,
  }))
}
