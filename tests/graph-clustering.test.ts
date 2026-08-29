import { describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode } from '@diqier/stratagate'
import { clusterKnowledgeGraph } from '../src/graph-clustering.js'

const timestamp = '2026-08-25T00:00:00.000Z'

function node(id: string, name: string, tags: string[] | undefined, eventIds: string[], type: GraphNode['type'] = 'tool'): GraphNode {
  return {
    id, name, type, aliases: [], ...(tags ? { tags } : {}), currentState: '', facts: [], status: 'active',
    confidence: 0.9, sourceEventIds: eventIds, createdAt: timestamp, updatedAt: timestamp,
  }
}

function edge(id: string, fromNodeId: string, toNodeId: string, confidence = 0.9): GraphEdge {
  return {
    id, fromNodeId, toNodeId, relation: '相关', status: 'active', confidence, sourceEventIds: [`evt_${id}`],
    createdAt: timestamp, updatedAt: timestamp,
  }
}

describe('dynamic Knowledge Graph clustering', () => {
  it('uses Leiden to separate structural communities and Tags to name them', () => {
    const nodes = [
      node('memory', 'Memory', ['memory-plugin', 'dsh-plugin'], ['evt_memory']),
      node('dsh', 'DSH', ['dsh-plugin'], ['evt_memory']),
      node('store', 'Memory Store', ['memory-plugin'], ['evt_memory']),
      node('locomo', 'LoCoMo', ['benchmark', 'evaluation'], ['evt_benchmark'], 'project'),
      node('benchmark', 'Benchmark', ['benchmark'], ['evt_benchmark'], 'project'),
      node('evaluator', 'Evaluator', ['evaluation'], ['evt_benchmark']),
    ]
    const edges = [
      edge('memory-dsh', 'memory', 'dsh'),
      edge('memory-store', 'memory', 'store'),
      edge('locomo-benchmark', 'locomo', 'benchmark'),
      edge('locomo-evaluator', 'locomo', 'evaluator'),
      edge('weak-bridge', 'store', 'evaluator', 0.05),
    ]

    const first = clusterKnowledgeGraph(nodes, edges)
    const second = clusterKnowledgeGraph(nodes, edges)
    const memberships = first.map((cluster) => cluster.nodeIds)

    expect(second).toEqual(first)
    expect(memberships.some((ids) => ids.includes('memory') && ids.includes('dsh') && ids.includes('store'))).toBe(true)
    expect(memberships.some((ids) => ids.includes('locomo') && ids.includes('benchmark') && ids.includes('evaluator'))).toBe(true)
    expect(memberships.some((ids) => ids.includes('memory') && ids.includes('locomo'))).toBe(false)
    expect(first.map(({ label }) => label).join(' ')).toContain('dsh-plugin')
    expect(first.map(({ label }) => label).join(' ')).toContain('benchmark')
  })

  it('does not join disconnected nodes only because their Tags match and tolerates missing Tags', () => {
    const nodes = [
      node('left-a', 'Left A', ['shared-tag'], ['evt_left']),
      node('left-b', 'Left B', undefined, ['evt_left']),
      node('right-a', 'Right A', ['shared-tag'], ['evt_right']),
      node('right-b', 'Right B', undefined, ['evt_right']),
      node('legacy', 'Legacy', undefined, []),
    ]
    const clusters = clusterKnowledgeGraph(nodes, [
      edge('left', 'left-a', 'left-b'),
      edge('right', 'right-a', 'right-b'),
    ])

    expect(clusters.some(({ nodeIds }) => nodeIds.includes('left-a') && nodeIds.includes('right-a'))).toBe(false)
    expect(clusters.some(({ nodeIds, label }) => nodeIds.includes('legacy') && label === '未连接节点')).toBe(true)
  })
})
