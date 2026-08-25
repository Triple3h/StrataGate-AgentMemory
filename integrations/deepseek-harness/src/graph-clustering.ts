import createGraph from 'ngraph.graph'
import { detectClusters } from 'ngraph.leiden'
import type { GraphEdge, GraphNode } from '@diqier/stratagate'

const MAX_CLUSTER_SIZE = 12
const LEIDEN_RESOLUTION = 0.55

export interface KnowledgeGraphCluster {
  id: string
  label: string
  nodeIds: string[]
  tags: string[]
}

interface WeightedLink {
  weight: number
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`
}

function pairIds(key: string): [string, string] {
  const separator = key.indexOf('\u0000')
  return [key.slice(0, separator), key.slice(separator + 1)]
}

function semanticTags(node: GraphNode): string[] {
  return Array.isArray(node.tags)
    ? [...new Set(node.tags.map((tag) => tag.trim()).filter(Boolean))]
    : []
}

function stableClusterId(nodeIds: readonly string[]): string {
  let hash = 2166136261
  for (const character of [...nodeIds].sort().join('\u0000')) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `cluster_${(hash >>> 0).toString(36)}`
}

function clusterLabel(members: readonly GraphNode[], weightedDegree: ReadonlyMap<string, number>): { label: string; tags: string[] } {
  const counts = new Map<string, number>()
  for (const node of members) for (const tag of semanticTags(node)) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  const orderedTags = [...counts]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([tag]) => tag)
  const sharedTags = [...counts]
    .filter(([, count]) => members.length === 1 || count > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([tag]) => tag)
  if (sharedTags.length > 0) return { label: sharedTags.join(' / '), tags: orderedTags.slice(0, 8) }
  const names = [...members]
    .sort((left, right) => (weightedDegree.get(right.id) ?? 0) - (weightedDegree.get(left.id) ?? 0)
      || right.sourceEventIds.length - left.sourceEventIds.length || left.name.localeCompare(right.name))
    .slice(0, 2)
    .map(({ name }) => name)
  return { label: names.join(' / ') || '未命名主题', tags: orderedTags.slice(0, 8) }
}

/**
 * Produces an ephemeral Leiden partition for the current graph snapshot.
 * Tags and Node Type only strengthen pairs already connected by an Edge or
 * shared Event, so semantic similarity alone can never force a community.
 */
export function clusterKnowledgeGraph(
  rawNodes: readonly GraphNode[],
  rawEdges: readonly GraphEdge[],
): KnowledgeGraphCluster[] {
  const nodes = rawNodes.filter((node) => node.status !== 'archived')
  if (nodes.length === 0) return []
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const structuralWeights = new Map<string, number>()
  const addStructuralWeight = (left: string, right: string, weight: number): void => {
    if (left === right || !nodeMap.has(left) || !nodeMap.has(right) || weight <= 0) return
    const key = pairKey(left, right)
    structuralWeights.set(key, (structuralWeights.get(key) ?? 0) + weight)
  }

  for (const edge of rawEdges.filter((edge) => edge.status === 'active')) {
    addStructuralWeight(edge.fromNodeId, edge.toNodeId, 3 * Math.max(0.25, Number(edge.confidence) || 0.8))
  }
  const eventOwners = new Map<string, string[]>()
  for (const node of nodes) for (const eventId of new Set(node.sourceEventIds)) {
    const owners = eventOwners.get(eventId) ?? []
    owners.push(node.id)
    eventOwners.set(eventId, owners)
  }
  for (const owners of eventOwners.values()) {
    const eventWeight = 1.4 / Math.sqrt(Math.max(1, owners.length - 1))
    for (let left = 0; left < owners.length; left += 1) for (let right = left + 1; right < owners.length; right += 1) {
      addStructuralWeight(owners[left]!, owners[right]!, eventWeight)
    }
  }

  const graph = createGraph<undefined, WeightedLink>({ multigraph: false })
  for (const node of nodes) graph.addNode(node.id)
  const weightedDegree = new Map(nodes.map((node) => [node.id, 0]))
  for (const [key, structuralWeight] of structuralWeights) {
    const [leftId, rightId] = pairIds(key)
    const left = nodeMap.get(leftId)!
    const right = nodeMap.get(rightId)!
    const leftTags = new Set(semanticTags(left))
    const rightTags = new Set(semanticTags(right))
    const overlap = [...leftTags].filter((tag) => rightTags.has(tag)).length
    const union = new Set([...leftTags, ...rightTags]).size
    const tagBoost = overlap > 0 && union > 0 ? 0.85 * overlap / union : 0
    const typeBoost = left.type === right.type ? 0.15 : 0
    const weight = structuralWeight + tagBoost + typeBoost
    graph.addLink(leftId, rightId, { weight })
    weightedDegree.set(leftId, (weightedDegree.get(leftId) ?? 0) + weight)
    weightedDegree.set(rightId, (weightedDegree.get(rightId) ?? 0) + weight)
  }

  const partition = detectClusters<ReturnType<typeof graph.addLink>, ReturnType<typeof graph.addNode>>(graph, {
    quality: 'cpm',
    resolution: LEIDEN_RESOLUTION,
    randomSeed: 42,
    refine: true,
    maxCommunitySize: MAX_CLUSTER_SIZE,
    linkWeight: (link) => link.data.weight,
  })
  const connectedGroups: string[][] = []
  const isolatedIds: string[] = []
  for (const community of partition.getCommunities().values()) {
    const ids = community.map(String).sort()
    const connected = ids.filter((id) => (weightedDegree.get(id) ?? 0) > 0)
    const isolated = ids.filter((id) => (weightedDegree.get(id) ?? 0) === 0)
    if (connected.length > 0) connectedGroups.push(connected)
    isolatedIds.push(...isolated)
  }
  for (let index = 0; index < isolatedIds.length; index += MAX_CLUSTER_SIZE) {
    connectedGroups.push(isolatedIds.slice(index, index + MAX_CLUSTER_SIZE).sort())
  }

  return connectedGroups.map((nodeIds) => {
    const members = nodeIds.map((id) => nodeMap.get(id)!)
    const semantic = clusterLabel(members, weightedDegree)
    const isolated = members.every((node) => (weightedDegree.get(node.id) ?? 0) === 0)
    return {
      id: stableClusterId(nodeIds),
      label: isolated ? '未连接节点' : semantic.label,
      nodeIds,
      tags: semantic.tags,
    }
  }).sort((left, right) => right.nodeIds.length - left.nodeIds.length || left.label.localeCompare(right.label))
}
