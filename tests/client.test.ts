import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

describe('StrataGate Web client contract', () => {
  it('registers its settings section through the DSH module loader', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    let definition: any
    runInNewContext(source, {
      URLSearchParams,
      window: { __ModuleLoader__: { load: (value: unknown) => { definition = value } } },
    })
    expect(definition.id).toBe('stratagate-dsh')
    const plugin = definition.factory((name: string) => {
      if (name !== 'react') throw new Error(`unexpected client dependency: ${name}`)
      return { createElement: (...args: unknown[]) => args, Fragment: 'fragment', useState: () => [], useEffect: () => {}, useCallback: (fn: unknown) => fn }
    })
    expect(plugin.inject).toEqual(['slots', 'conversationEvents'])

    let registration: any
    const slots = {
      inject: (_name: string, callback: () => void) => callback(),
      register: (metadata: unknown, render: unknown) => { registration = { metadata, render } },
    }
    plugin.apply({ get: (name: string) => name === 'slots' ? slots : undefined })
    expect(registration.metadata).toMatchObject({ name: 'settings.section', id: 'stratagate-memory' })
    expect(registration.metadata.label()).toBe('StrataGate-AgentMemory')
    expect(typeof registration.render).toBe('function')
  })

  it('adds a short-term memory compression inspector to the sidebar footer', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    let definition: any
    runInNewContext(source, {
      URLSearchParams,
      window: { __ModuleLoader__: { load: (value: unknown) => { definition = value } } },
    })
    const plugin = definition.factory((name: string) => {
      if (name !== 'react') throw new Error(`unexpected client dependency: ${name}`)
      return { createElement: (...args: unknown[]) => args, Fragment: 'fragment', useState: () => [], useEffect: () => {}, useCallback: (fn: unknown) => fn, useRef: () => ({ current: null }) }
    })
    const registrations: any[] = []
    const slots = {
      inject: (_name: string, callback: () => void) => callback(),
      register: (metadata: unknown, render: unknown) => { registrations.push({ metadata, render }) },
    }
    plugin.apply({ get: (name: string) => name === 'slots' ? slots : undefined })
    const inspector = registrations.find(({ metadata }) => metadata.id === 'stratagate-compression')
    expect(inspector.metadata).toMatchObject({ name: 'sidebar.footer.action', order: 40 })
    expect(typeof inspector.render).toBe('function')
    expect(source).toContain('短期记忆正在怎样变轻')
    expect(source).toContain('压缩不会删除证据；L5 原文始终保存在本地')
    expect(source).toContain("api('sources', { namespace, blockId: selectedBlock.id })")
  })

  it('publishes adopted memory citations into the closing answer turn tail', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    let definition: any
    runInNewContext(source, {
      URLSearchParams,
      window: { __ModuleLoader__: { load: (value: unknown) => { definition = value } } },
    })
    const plugin = definition.factory((name: string) => {
      if (name !== 'react') throw new Error(`unexpected client dependency: ${name}`)
      return {
        createElement: (...args: unknown[]) => args,
        Fragment: 'fragment',
        useState: () => [],
        useEffect: () => {},
        useCallback: (fn: unknown) => fn,
      }
    })
    let conversationDefinition: any
    const registrations: any[] = []
    const slots = {
      inject: (_name: string, callback: () => void) => callback(),
      register: (metadata: unknown, render: unknown) => { registrations.push({ metadata, render }) },
    }
    plugin.apply({
      get: (name: string) => name === 'slots'
        ? slots
        : name === 'conversationEvents'
          ? { register: (value: unknown) => { conversationDefinition = value } }
          : undefined,
    })

    expect(conversationDefinition.kind).toBe('stratagate-memory-citations')
    const startEvent = { type: 'turn/start', seq: 0, data: { turn: 7 } }
    const recordUseCall = {
      type: 'tool/call',
      seq: 3,
      data: { turn: 7, step: 2, callId: 'record-use-1', name: 'memory_record_use', arguments: '{}' },
    }
    const recordUseResult = {
      type: 'tool/result',
      seq: 4,
      data: {
        turn: 7,
        step: 2,
        message: {
          source: { kind: 'tool', callId: 'record-use-1' },
          content: [{
            type: 'tool_result',
            isError: false,
            content: [{
              type: 'text',
              text: JSON.stringify({
                recorded: true,
                namespace: 'dsh:project:test',
                batchId: 'batch_1',
                retrievedCount: 5,
                retrievedMemories: [
                  { kind: 'event', id: 'event-1', title: 'Use pnpm', evidenceRef: 'event:event-1', batchId: 'batch_1', detailKind: 'eventId' },
                  { kind: 'event', id: 'event-2', title: 'pnpm compatibility', evidenceRef: 'event:event-2', batchId: 'batch_1', detailKind: 'eventId' },
                  { kind: 'graph', id: 'node-1', title: 'pnpm', evidenceRef: 'graph-node:node-1:expanded', batchId: 'batch_1', detailKind: 'nodeId', expanded: true },
                  { kind: 'block', id: 'block-1', title: 'Package manager', evidenceRef: 'block:block-1:level:4', batchId: 'batch_1', detailKind: 'blockId', level: 4, expanded: true },
                  { kind: 'block', id: 'block-2', title: 'Tooling notes', evidenceRef: 'block:block-2:level:2', batchId: 'batch_1', detailKind: 'blockId', level: 2 },
                ],
                citations: [
                  { kind: 'event', id: 'event-1', title: 'Use pnpm', evidenceRef: 'event:event-1', batchId: 'batch_1', detailKind: 'eventId' },
                  { kind: 'graph', id: 'node-1', title: 'pnpm', evidenceRef: 'graph-node:node-1:expanded', batchId: 'batch_1', detailKind: 'nodeId', expanded: true },
                  { kind: 'block', id: 'block-1', title: 'Package manager', evidenceRef: 'block:block-1:level:4', batchId: 'batch_1', detailKind: 'blockId', level: 4, expanded: true },
                ],
              }),
            }],
          }],
        },
      },
    }
    const started = conversationDefinition.start({}, { event: startEvent })
    const tracked = conversationDefinition.update({ state: started }, { event: recordUseCall })
    const updated = conversationDefinition.update({ state: tracked }, { event: recordUseResult })
    const location = conversationDefinition.buildLocationData({ state: updated }, 'turn')
    expect(location.key).toBe(conversationDefinition.kind)
    const tail = registrations.find(({ metadata }) => metadata.name === 'conversation.chat.turnTail')
    const locationData = new Map([[location.key, location.value]])
    const matched = tail.metadata.select({ turn: { data: { get: (key: string) => locationData.get(key) } }, seq: 8 })
    expect(matched.citations.map((citation: any) => citation.kind)).toEqual(['event', 'graph', 'block'])
    expect(matched.citations[2]).toMatchObject({ id: 'block-1', level: 4, expanded: true, namespace: 'dsh:project:test' })
    expect(matched.retrievedCount).toBe(5)
    expect(matched.retrievalGroups).toHaveLength(1)
    expect(matched.retrievalGroups[0].memories).toHaveLength(5)
    expect(tail.metadata.select({ turn: { data: { get: (key: string) => locationData.get(key) } }, seq: 2 })).toBeNull()
    const legacyUpdated = conversationDefinition.update({ state: started }, {
      event: {
        type: 'stratagate/memory-citations',
        seq: 5,
        data: {
          turn: 7,
          namespace: 'dsh:project:legacy',
          citations: [{ kind: 'event', id: 'legacy-event', evidenceRef: 'event:legacy-event', detailKind: 'eventId' }],
        },
      },
    })
    expect(legacyUpdated.entries).toEqual([expect.objectContaining({ namespace: 'dsh:project:legacy' })])
    expect(source).toContain("event.data.name === 'memory_record_use'")
    expect(source).toContain("api('sources', { namespace: citation.namespace, [citation.detailKind]: citation.id })")
    expect(source).toContain('展开到 L')
    expect(source).toContain("'本回答参考了 ' + citations.length + ' 条记忆'")
    expect(source).toContain("'已进行 ' + retrievalGroups.length + ' 次检索，共返回 ' + retrievedCount + ' 条记忆，未采用'")
    expect(source).toContain('sg-answer-retrieval-toggle')
    expect(source).toContain("'aria-expanded': showRetrieved")
    expect(source).toContain("'检索过程'")
    expect(source).toContain('retrievalGroupLabel(groupIndex)')
    expect(source).toContain("memoryIndex + 1 + '.'")
    expect(source).toContain("open(memory, false)")
    expect(source).toContain("'检索候选 · 未采用'")
    expect(source).toContain("function CitationGraph({ citation, detail, primary, adopted = true })")
    expect(source).toContain("title: '关联信息'")
    expect(source).toContain("adopted ? '来源对话 ·未作为加入本次上下文' : '来源对话 · 未用于本次回答'")
    expect(source).toContain("title: '详细情况'")
    expect(source).toContain("title: 'L0–L5 记忆层级'")
    expect(source).toContain("'本次采用'")
    expect(source).toContain("citationPreview(content)")
    expect(source).toContain("title: selected ? undefined : content")
    expect(source).not.toContain("facts.slice(0, 12)")
    expect(source).not.toContain("sourceMessages.slice(0, 12)")
  })

  it('shows a quiet answer-tail note when retrieved memories were not adopted', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    let definition: any
    runInNewContext(source, {
      URLSearchParams,
      window: { __ModuleLoader__: { load: (value: unknown) => { definition = value } } },
    })
    const plugin = definition.factory((name: string) => {
      if (name !== 'react') throw new Error(`unexpected client dependency: ${name}`)
      return {
        createElement: (...args: unknown[]) => args,
        Fragment: 'fragment',
        useState: (initial: unknown) => [initial, () => {}],
        useEffect: () => {},
        useCallback: (fn: unknown) => fn,
      }
    })
    let conversationDefinition: any
    const registrations: any[] = []
    const slots = {
      inject: (_name: string, callback: () => void) => callback(),
      register: (metadata: unknown, render: unknown) => { registrations.push({ metadata, render }) },
    }
    plugin.apply({
      get: (name: string) => name === 'slots'
        ? slots
        : name === 'conversationEvents'
          ? { register: (value: unknown) => { conversationDefinition = value } }
          : undefined,
    })

    const started = conversationDefinition.start({}, { event: { type: 'turn/start', seq: 0, data: { turn: 8 } } })
    const searchEarlier = conversationDefinition.update({ state: started }, {
      event: { type: 'tool/call', seq: 1, data: { turn: 8, callId: 'search-earlier', name: 'memory_search_events' } },
    })
    const searchedEarlier = conversationDefinition.update({ state: searchEarlier }, {
      event: {
        type: 'tool/result',
        seq: 2,
        data: {
          turn: 8,
          message: {
            source: { kind: 'tool', callId: 'search-earlier' },
            content: [{ type: 'tool_result', isError: false, content: [{ type: 'text', text: JSON.stringify({ batchId: 'batch_1' }) }] }],
          },
        },
      },
    })
    const searchLater = conversationDefinition.update({ state: searchedEarlier }, {
      event: { type: 'tool/call', seq: 3, data: { turn: 8, callId: 'search-later', name: 'memory_search_raw' } },
    })
    const searchedLater = conversationDefinition.update({ state: searchLater }, {
      event: {
        type: 'tool/result',
        seq: 4,
        data: {
          turn: 8,
          message: {
            source: { kind: 'tool', callId: 'search-later' },
            content: [{ type: 'tool_result', isError: false, content: [{ type: 'text', text: JSON.stringify({ batchId: 'batch_2' }) }] }],
          },
        },
      },
    })
    const trackedLater = conversationDefinition.update({ state: searchedLater }, {
      event: { type: 'tool/call', seq: 5, data: { turn: 8, callId: 'record-use-later', name: 'memory_record_use' } },
    })
    const completedLater = conversationDefinition.update({ state: trackedLater }, {
      event: {
        type: 'tool/result',
        seq: 6,
        data: {
          turn: 8,
          message: {
            source: { kind: 'tool', callId: 'record-use-later' },
            content: [{
              type: 'tool_result',
              isError: false,
              content: [{ type: 'text', text: JSON.stringify({
                recorded: true,
                namespace: 'dsh:project:test',
                batchId: 'batch_2',
                retrievalSequence: 1,
                retrievedCount: 2,
                retrievedMemories: [
                  { kind: 'event', id: 'event-1', title: '编辑器选择', evidenceRef: 'event:event-1', batchId: 'batch_2', detailKind: 'eventId' },
                  { kind: 'block', id: 'block-1', title: '开发环境讨论', evidenceRef: 'block:block-1:level:3', batchId: 'batch_2', detailKind: 'blockId', level: 3 },
                ],
                citations: [],
              }) }],
            }],
          },
        },
      },
    })
    const trackedEarlier = conversationDefinition.update({ state: completedLater }, {
      event: { type: 'tool/call', seq: 7, data: { turn: 8, callId: 'record-use-earlier', name: 'memory_record_use' } },
    })
    const completed = conversationDefinition.update({ state: trackedEarlier }, {
      event: {
        type: 'tool/result',
        seq: 8,
        data: {
          turn: 8,
          message: {
            source: { kind: 'tool', callId: 'record-use-earlier' },
            content: [{
              type: 'tool_result',
              isError: false,
              content: [{ type: 'text', text: JSON.stringify({
                recorded: true,
                namespace: 'dsh:project:test',
                batchId: 'batch_1',
                retrievalSequence: 99,
                retrievedCount: 1,
                retrievedMemories: [
                  { kind: 'event', id: 'event-0', title: '更早的检索结果', evidenceRef: 'event:event-0', batchId: 'batch_1', detailKind: 'eventId' },
                ],
                citations: [],
              }) }],
            }],
          },
        },
      },
    })
    const location = conversationDefinition.buildLocationData({ state: completed }, 'turn')
    const tail = registrations.find(({ metadata }) => metadata.name === 'conversation.chat.turnTail')
    const matched = tail.metadata.select({ turn: { data: { get: () => location.value } }, seq: 10 })
    expect(matched).toMatchObject({ citations: [], retrievedCount: 3 })
    expect(matched.retrievalGroups).toHaveLength(2)
    expect(matched.retrievalGroups.map((group: any) => group.batchId)).toEqual(['batch_1', 'batch_2'])
    expect(matched.retrievalGroups[0].memories.map((memory: any) => memory.title)).toEqual(['更早的检索结果'])
    expect(matched.retrievalGroups[1].memories.map((memory: any) => memory.title)).toEqual(['编辑器选择', '开发环境讨论'])
    const rendered = tail.render({ matched })
    expect(JSON.stringify(rendered)).toContain('已进行 2 次检索，共返回 3 条记忆，未采用')
    expect(JSON.stringify(rendered)).not.toContain('stratagate-answer-citations')

    let stateCall = 0
    const expandedPlugin = definition.factory((name: string) => {
      if (name !== 'react') throw new Error(`unexpected client dependency: ${name}`)
      return {
        createElement: (...args: unknown[]) => args,
        Fragment: 'fragment',
        useState: (initial: unknown) => [stateCall++ === 0 ? true : initial, () => {}],
        useEffect: () => {},
        useCallback: (fn: unknown) => fn,
      }
    })
    const expandedRegistrations: any[] = []
    expandedPlugin.apply({
      get: (name: string) => name === 'slots'
        ? { inject: (_name: string, callback: () => void) => callback(), register: (metadata: unknown, render: unknown) => { expandedRegistrations.push({ metadata, render }) } }
        : name === 'conversationEvents'
          ? { register: () => {} }
          : undefined,
    })
    const expandedTail = expandedRegistrations.find(({ metadata }) => metadata.name === 'conversation.chat.turnTail')
    const expanded = expandedTail.render({ matched })
    expect(JSON.stringify(expanded)).toContain('检索过程')
    expect(JSON.stringify(expanded)).toContain('第一次检索')
    expect(JSON.stringify(expanded)).toContain('第二次检索')
    expect(JSON.stringify(expanded)).toContain('更早的检索结果')
    expect(JSON.stringify(expanded)).toContain('编辑器选择')
    expect(JSON.stringify(expanded)).toContain('开发环境讨论')
    expect(JSON.stringify(expanded)).toContain('未采用')
  })

  it('shows the unified project brand, mascot, usage count, and GitHub Star link', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain('StrataGate-AgentMemory')
    expect(source).toContain('__STRATAGATE_MASCOT_DATA_URL__')
    expect(source).toContain('StrataGate 已在当前工作区中帮助使用记忆 ')
    expect(source).toContain('为 StrataGate 点 🌟🌟')
    expect(source).toContain("https://github.com/diqierjia/StrataGate-AgentMemory")
    expect(source).toContain("rel: 'noopener noreferrer'")
  })

  it('uses the user-defined DSH Workspace title and keeps the compact header collision-free', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain('function MemoryPage({ useWorkspaces, useSessions })')
    expect(source).toContain('const workspaceItems = useWorkspaces((state) => state.items)')
    expect(source).toContain('const sessionById = useSessions((state) => state.byId || {})')
    expect(source).toContain("String(session?.title || '').trim()")
    expect(source).toContain("workspace.sessionIds")
    expect(source).toContain("String(workspace.title || '').trim()")
    expect(source).toContain("value.split(':project:').pop()")
    expect(source).toContain('display:grid;grid-template-columns:minmax(0,1fr)')
    expect(source).not.toContain("title: '重新加载', onClick: refresh")
  })

  it('uses the memory-first three-part information architecture', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain("const [section, setSection] = React.useState('short')")
    expect(source).toContain("[['short', '短期记忆'], ['long', '长期记忆'], ['more', '更多']]")
    expect(source).toContain('块衰减总览')
    expect(source).toContain('开放块 · 未封存')
    expect(source).toContain('距最新封存块')
    expect(source).toContain('分层内容预览')
    expect(source).toContain('展开到这一层')
    expect(source).toContain("api('blocks/expand'")
    expect(source).toContain('用户展开')
    expect(source).toContain('Agent 展开')
    expect(source).toContain('曾展开')
    expect(source).toContain('当前对话：')
    expect(source).toContain('Block 分布滑轨')
    expect(source).toContain('L0 层最浅最简略，L5 层最深最详细，离当前对话越远，Block 会逐渐简略。')
    expect(source).toContain('document.body.appendChild(popover)')
    expect(source).toContain('setOpenMenuLevel')
    expect(source).toContain('完整内容')
    expect(source).toContain("React.useState('graph')")
    expect(source).toContain('知识图谱')
    expect(source).toContain('事件时间线')
    expect(source).toContain("{ '今天': [], '本周': [], '更早': [] }")
    expect(source).toContain('发生时间未知')
    expect(source).toContain('正在升级长期记忆')
    expect(source).toContain('搜索记忆、人物、项目、概念')
    expect(source).not.toContain("['overview', '概览']")
    expect(source).not.toContain('sg-stats')
    expect(source).not.toContain('封存时为 L5')
  })

  it('places external AI memory import before memory structure in More', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain("['import', '⇄', '导入别的 AI 记忆'")
    expect(source.indexOf("['import', '⇄', '导入别的 AI 记忆'")).toBeLessThan(source.indexOf("['structure', '◇', '记忆结构'"))
    expect(source).toContain("function ImportPage({ namespace, onBack, refresh })")
    expect(source).toContain("api('import', { namespace }")
    expect(source).toContain('复制以下提示词到其他 AI 对话中')
    expect(source).toContain('粘贴结果，先分析再导入')
    expect(source).toContain('分析并预览')
    expect(source).toContain('低置信度结果请人工选择处理方式')
    expect(source).toContain('已完成 ')
    expect(source).toContain('正在判断第 ')
    expect(source).toContain('关闭，后台继续')
    expect(source).toContain("operation: 'status', namespace, jobId: job.jobId")
    expect(source).toContain('连接暂时中断，正在自动重试')
    expect(source).toContain('撤销本次导入')
  })

  it('inherits the resolved light, dark, or system appearance from DSH theme tokens', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain('color-scheme:inherit')
    expect(source).toContain('--sg-page:var(--dsw-alias-bg-layer-2')
    expect(source).toContain('--sg-text:var(--dsw-alias-label-primary')
    expect(source).toContain('--sg-accent:var(--dsw-alias-state-business-primary')
    expect(source).not.toContain('@media (prefers-color-scheme:dark)')
    expect(source).not.toContain('--dsh-color-background')
  })

  it('keeps long-term memory summary-first and moves complex exploration to full screen', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain('sg-summary-layout')
    expect(source).toContain('sg-node-bubble')
    expect(source).toContain("eventCount + ' 条相关事件'")
    expect(source).toContain('查看详情 →')
    expect(source).toContain("'筛选 ▾'")
    expect(source).toContain("'⛶ 全屏查看'")
    expect(source).toContain('sg-event-popover')
    expect(source).toContain('onMouseEnter: cancelHide')
    expect(source).toContain('event.narrative')
    expect(source).not.toContain("'Block · ' + event.sourceBlockId.slice")
  })

  it('keeps the full-screen explorer anchored to the viewport', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain('.sg-long-explorer.fullscreen{position:fixed;inset:12px')
    expect(source).toContain('@keyframes sg-view-in{from{opacity:0}to{opacity:1}}')
    expect(source).not.toContain('@keyframes sg-view-in{from{opacity:0;transform:')
  })

  it('provides synchronized knowledge graph zoom controls', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain("className: 'sg-graph-zoom'")
    expect(source).toContain("type: 'range', min: '25', max: '240'")
    expect(source).toContain("graph.on('zoom', updateZoom)")
    expect(source).toContain("renderedPosition: { x: container.clientWidth / 2, y: container.clientHeight / 2 }")
    expect(source).toContain('wheelSensitivity: .22')
  })

  it('makes graph and memory list truncation explicit and pageable', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain('nodeLimit = 100')
    expect(source).toContain('.slice(0, nodeLimit)')
    expect(source).not.toContain('.slice(0, 40)')
    expect(source).toContain("'再显示 100 个'")
    expect(source).toContain("function Pagination({ page, loading, error, onOffset })")
    expect(source).toContain("'上一页'")
    expect(source).toContain("'下一页'")
    expect(source).toContain("kind: 'blocks'")
    expect(source).toContain("kind: 'events'")
    expect(source).toContain("kind: 'audit'")
    expect(source).toContain("kind: 'events', initialItems: events, initialPage: eventPage, fallbackLimit: 40")
    expect(source).toContain("kind: 'blocks', initialItems: blocks, initialPage: blockPage, fallbackLimit: 40")
  })

  it('sizes graph nodes by stable long-term importance without conflating selection', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain('function graphNodeImportance(nodes, edges, project)')
    expect(source).toContain('const GRAPH_NODE_RADIUS = { peripheral: 30, normal: 38, important: 46, core: 54 }')
    expect(source).toContain('new Set(node.sourceEventIds || []).size')
    expect(source).toContain("event.status !== 'forgotten' && event.status !== 'archived'")
    expect(source).toContain("edges.filter((edge) => edge.status === 'active')")
    expect(source).toContain('node.supportingEvents || []')
    expect(source).toContain('workspaceAffinity')
    expect(source).toContain('React.useMemo(() => graphNodeImportance(nodes, edges, project), [nodes, edges, project])')
    expect(source).toContain('nodes: visibleNodes, edges, clusters, importance: nodeImportance')
    expect(source).toContain('size: visualImportance.radius * 2')
    expect(source).not.toContain('r: selected ? 47 : 42')
  })

  it('renders server-side Leiden communities with Cytoscape.js and fCoSE', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    const buildSource = readFileSync(new URL('../scripts/build-client.mjs', import.meta.url), 'utf8')
    expect(buildSource).toContain("import cytoscape from 'cytoscape'")
    expect(buildSource).toContain("import fcose from 'cytoscape-fcose'")
    expect(buildSource).toContain('cytoscape.use(fcose)')
    expect(source).toContain('const cytoscape = globalThis.__StrataGateGraphLibraries?.cytoscape')
    expect(source).toContain("name: 'fcose'")
    expect(source).toContain("node.sg-community")
    expect(source).toContain("edge.sg-memory-edge.cross-community")
    expect(source).toContain("graph.clusters || []")
    expect(source).toContain('Leiden 主题群组')
    expect(source).toContain('全部语义标签')
    expect(source).toContain("node.tags || []")
    expect(source).not.toContain('function graphClusters(')
    expect(source).not.toContain('function graphClusterLayout(')
  })

  it('makes a well-supported workspace project larger than a sparsely mentioned tool', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    const start = source.indexOf('const GRAPH_NODE_RADIUS')
    const end = source.indexOf('function GraphCanvas', start)
    const context: any = {}
    runInNewContext(source.slice(start, end) + '\nthis.graphNodeImportance = graphNodeImportance', context)
    const event = (id: string, updatedAt: string) => ({ id, status: 'active', updatedAt })
    const node = (id: string, name: string, eventCount: number, updatedAt: string) => ({
      id, name, aliases: [], updatedAt, sourceEventIds: Array.from({ length: eventCount }, (_, index) => `${id}-event-${index}`),
      supportingEvents: Array.from({ length: eventCount }, (_, index) => event(`${id}-event-${index}`, updatedAt)),
    })
    const nodes = [
      node('project', 'StrataGate-AgentMemory', 8, '2026-08-25T00:00:00Z'),
      node('memory', 'Memory Service', 5, '2026-08-20T00:00:00Z'),
      node('agent', 'Agent', 3, '2026-07-01T00:00:00Z'),
      node('json', 'parseJsonResponse', 1, '2025-08-25T00:00:00Z'),
    ]
    const edges = [
      { id: 'edge-1', fromNodeId: 'project', toNodeId: 'memory', status: 'active', updatedAt: '2026-08-25T00:00:00Z' },
      { id: 'edge-2', fromNodeId: 'project', toNodeId: 'agent', status: 'active', updatedAt: '2026-08-24T00:00:00Z' },
      { id: 'edge-3', fromNodeId: 'memory', toNodeId: 'agent', status: 'active', updatedAt: '2026-08-20T00:00:00Z' },
    ]
    const importance = context.graphNodeImportance(nodes, edges, 'StrataGate-AgentMemory')
    expect(importance.get('project').radius).toBe(54)
    expect(importance.get('json').radius).toBe(30)
    expect(importance.get('project').radius).toBeGreaterThan(importance.get('json').radius)
    expect([...importance.values()].every(({ radius }: { radius: number }) => radius >= 30 && radius <= 54)).toBe(true)
  })

  it('keeps failures reassuring and exposes related Block settings under More', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain('lastErrorFull')
    expect(source).toContain('原始内容已经保存，不会丢失。')
    expect(source).toContain('原始记忆已保存，不会丢失。')
    expect(source).toContain('技术错误详情')
    expect(source).toContain("['raw', '{}', '原始数据'")
    expect(source).toContain("['audit', '↗', '使用记录'")
    expect(source).toContain("['settings', '⚙', '高级设置'")
    expect(source).not.toContain("['responses', '模型响应']")
    expect(source).toContain("type: 'number'")
    expect(source).toContain("step: '1'")
    expect(source).toContain("step: '0.05'")
    expect(source).toContain('每个 Block 的对话轮数')
    expect(source).toContain('尚未封存的内容按新阈值继续处理。')
    expect(source).toContain('为保持按对话轮数计算的遗忘速度，建议 λ 调整为')
    expect(source).toContain('采用建议值')
    expect(source).toContain('默认 0.3；数字越小，记忆遗忘越慢，消耗 token 越多，不建议大于 0.4。')
    expect(source).toContain("method: 'PATCH'")
    expect(source).toContain('当前工作区')
    expect(source).toContain("['support', '?', '反馈与支持'")
    expect(source).toContain('在 GitHub 提交 Issue')
    expect(source).toContain('附加诊断日志')
    expect(source).toContain('附加记忆数据（可能包含对话内容）')
    expect(source).toContain('默认诊断不包含原始聊天、L5、Event 或 Graph 内容。')
    expect(source).toContain('发现问题？ ')
    expect(source).toContain("'提交反馈'")
  })

  it('shows a red processing banner with a loading icon while memory work is active', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain('sg-processing-alert')
    expect(source).toContain('sg-processing-icon')
    expect(source).toContain('正在触发记忆整理')
    expect(source).toContain("role: 'status'")
    expect(source).toContain('processingJobs')
    expect(source).toContain("'/api/stratagate/dashboard'")
    expect(source).toContain("'If-None-Match'")
    expect(source).toContain("document.addEventListener('visibilitychange'")
    expect(source).toContain('pollFast ? 2500 : 30000')
    expect(source).not.toContain('window.setInterval')
    expect(source).toContain("status === 'waiting'")
  })
})
