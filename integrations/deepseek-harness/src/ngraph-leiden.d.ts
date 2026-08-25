declare module 'ngraph.leiden' {
  export interface LeidenOptions<Link = unknown, Node = unknown> {
    directed?: boolean
    quality?: 'modularity' | 'cpm'
    resolution?: number
    randomSeed?: number
    refine?: boolean
    maxCommunitySize?: number
    linkWeight?: (link: Link) => number
    nodeSize?: (node: Node) => number
  }

  export interface LeidenResult {
    getClass(nodeId: string | number): number | undefined
    getCommunities(): Map<number, Array<string | number>>
    quality(): number
    toJSON(): { membership: Record<string, number>; meta: Record<string, unknown> }
  }

  export function detectClusters<Link = unknown, Node = unknown>(
    graph: unknown,
    options?: LeidenOptions<Link, Node>,
  ): LeidenResult
}
