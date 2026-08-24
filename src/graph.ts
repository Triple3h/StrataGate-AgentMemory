import { normalizeSearchText } from './search.js';
import type {
  EventCard,
  GraphEdge,
  GraphFact,
  GraphNode,
  GraphNodeProjection,
  GraphProjectionResult,
  GraphRecordStatus,
} from './types.js';

const NODE_TYPES = new Set(['person', 'project', 'organization', 'tool', 'place']);
const STATUSES = new Set<GraphRecordStatus>(['active', 'superseded', 'disputed', 'archived']);

function text(value: unknown, limit = 240): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : '';
}

function strings(value: unknown, limit = 32): string[] {
  return Array.isArray(value) ? [...new Set(value.map((item) => text(item)).filter(Boolean))].slice(0, limit) : [];
}

function confidence(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.8;
}

function chronology(events: readonly EventCard[], ids: readonly string[], fallback: string): string {
  return ids.flatMap((id) => events.find((event) => event.id === id) ?? [])
    .map((event) => event.temporal.happenedStart ?? event.temporal.happenedEnd ?? event.temporal.mentionedAt ?? event.createdAt)
    .sort().at(-1) ?? fallback;
}

function sameEntity(node: GraphNode, proposal: GraphNodeProjection): boolean {
  if (node.type !== proposal.type) return false;
  const key = (value: string): string => normalizeSearchText(value).replace(/[\s_-]+/g, '');
  const names = new Set([proposal.name, ...(proposal.aliases ?? [])].map(key));
  return [node.name, ...node.aliases].some((name) => names.has(key(name)));
}

export interface ApplyGraphProjectionOptions {
  nodes: GraphNode[];
  edges: GraphEdge[];
  events: EventCard[];
  result: GraphProjectionResult;
  allowedEventIds: ReadonlySet<string>;
  now: string;
  idFactory: (prefix: 'node' | 'edge' | 'gfact') => string;
}

/** Applies a replaceable graph projection without ever treating legacy Elements as evidence. */
export function applyGraphProjection(options: ApplyGraphProjectionOptions): { nodeIds: string[]; edgeIds: string[] } {
  const refs = new Map<string, GraphNode>();
  const touchedNodes = new Set<string>();
  const touchedEdges = new Set<string>();
  const validSources = (value: unknown): string[] => {
    const requested = strings(value, 64);
    return requested.length > 0 && requested.every((id) => options.allowedEventIds.has(id)) ? requested : [];
  };

  for (const proposal of Array.isArray(options.result.nodes) ? options.result.nodes : []) {
    const ref = text(proposal.ref, 120);
    const name = text(proposal.name, 160);
    const sources = validSources(proposal.sourceEventIds);
    if (!ref || !name || !NODE_TYPES.has(proposal.type) || sources.length === 0) continue;
    const aliases = strings(proposal.aliases, 20).filter((alias) => normalizeSearchText(alias) !== normalizeSearchText(name));
    let node = options.nodes.find((candidate) => sameEntity(candidate, { ...proposal, name, aliases }));
    if (!node) {
      node = {
        id: options.idFactory('node'), name, type: proposal.type, aliases: [], currentState: '', facts: [],
        status: 'active', confidence: confidence(proposal.confidence), sourceEventIds: [],
        createdAt: options.now, updatedAt: options.now,
      };
      options.nodes.push(node);
    }
    node.aliases = [...new Set([...node.aliases, ...aliases])];
    node.status = STATUSES.has(proposal.status ?? 'active') ? proposal.status ?? 'active' : 'active';
    node.confidence = confidence(proposal.confidence);
    node.sourceEventIds = [...new Set([...node.sourceEventIds, ...sources])];
    const validFrom = text(proposal.validFrom, 80) || chronology(options.events, sources, options.now);
    const validTo = text(proposal.validTo, 80) || undefined;
    const facts = [
      ...(text(proposal.state, 1_200) ? [{ key: 'state', value: text(proposal.state, 1_200) }] : []),
      ...(Array.isArray(proposal.facts) ? proposal.facts : []),
    ];
    for (const rawFact of facts) {
      const key = text(rawFact.key, 160);
      const value = Array.isArray(rawFact.value) ? strings(rawFact.value, 40) : text(rawFact.value, 1_200);
      if (!key || (Array.isArray(value) ? value.length === 0 : !value)) continue;
      const factSources = 'sourceEventIds' in rawFact ? validSources(rawFact.sourceEventIds) : sources;
      if (factSources.length === 0) continue;
      for (const old of node.facts.filter((fact) => fact.status === 'active' && fact.key === key)) {
        old.status = 'superseded';
        if (!old.validTo) old.validTo = validFrom;
        old.updatedAt = options.now;
      }
      const fact: GraphFact = {
        id: options.idFactory('gfact'), key, value, status: node.status,
        validFrom, ...(validTo ? { validTo } : {}), confidence: node.confidence,
        sourceEventIds: factSources, createdAt: options.now, updatedAt: options.now,
      };
      node.facts.push(fact);
    }
    node.currentState = node.facts.filter((fact) => fact.status === 'active')
      .map((fact) => `${fact.key}: ${Array.isArray(fact.value) ? fact.value.join('、') : fact.value}`).join('\n');
    node.updatedAt = options.now;
    refs.set(ref, node);
    touchedNodes.add(node.id);
  }

  for (const proposal of Array.isArray(options.result.edges) ? options.result.edges : []) {
    const from = refs.get(text(proposal.fromRef, 120));
    const to = refs.get(text(proposal.toRef, 120));
    const relation = text(proposal.relation, 100);
    const sources = validSources(proposal.sourceEventIds);
    if (!from || !to || from.id === to.id || !relation || sources.length === 0) continue;
    const status = STATUSES.has(proposal.status ?? 'active') ? proposal.status ?? 'active' : 'active';
    const validFrom = text(proposal.validFrom, 80) || chronology(options.events, sources, options.now);
    const validTo = text(proposal.validTo, 80) || undefined;
    for (const old of options.edges.filter((edge) => edge.status === 'active'
      && edge.fromNodeId === from.id && edge.relation === relation && edge.toNodeId !== to.id)) {
      old.status = 'superseded';
      if (!old.validTo) old.validTo = validFrom;
      old.updatedAt = options.now;
    }
    let edge = options.edges.find((candidate) => candidate.fromNodeId === from.id
      && candidate.toNodeId === to.id && candidate.relation === relation && candidate.status === status);
    if (!edge) {
      edge = {
        id: options.idFactory('edge'), fromNodeId: from.id, toNodeId: to.id, relation, status,
        validFrom, ...(validTo ? { validTo } : {}), confidence: confidence(proposal.confidence),
        sourceEventIds: sources, createdAt: options.now, updatedAt: options.now,
      };
      options.edges.push(edge);
    } else {
      edge.sourceEventIds = [...new Set([...edge.sourceEventIds, ...sources])];
      edge.confidence = confidence(proposal.confidence);
      edge.updatedAt = options.now;
    }
    touchedEdges.add(edge.id);
  }

  for (const event of options.events.filter((candidate) => options.allowedEventIds.has(candidate.id))) {
    const participantNodeIds = options.nodes.filter((node) => node.sourceEventIds.includes(event.id)).map(({ id }) => id);
    event.temporal.participantNodeIds = [...new Set([...(event.temporal.participantNodeIds ?? []), ...participantNodeIds])];
  }
  return { nodeIds: [...touchedNodes], edgeIds: [...touchedEdges] };
}
