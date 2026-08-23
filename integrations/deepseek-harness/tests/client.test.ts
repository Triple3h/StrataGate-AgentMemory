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
    expect(plugin.inject).toEqual(['slots'])

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
    expect(source).toContain('function MemoryPage({ useWorkspaces })')
    expect(source).toContain('const workspaceItems = useWorkspaces((state) => state.items)')
    expect(source).toContain("String(workspace.title || '').trim()")
    expect(source).toContain("value.split(':project:').pop()")
    expect(source).toContain('display:grid;grid-template-columns:minmax(0,1fr)')
    expect(source).not.toContain("title: '重新加载', onClick: refresh")
  })

  it('uses the memory-first three-part information architecture', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain("const [section, setSection] = React.useState('long')")
    expect(source).toContain("[['long', '长期记忆'], ['recent', '最近记忆'], ['more', '更多']]")
    expect(source).toContain('AI 已形成的长期记忆')
    expect(source).toContain('AI 最近完整记下、正在整理的内容')
    expect(source).toContain('搜索记忆、人物、项目、概念')
    expect(source).not.toContain("['overview', '概览']")
    expect(source).not.toContain('sg-stats')
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

  it('keeps failures reassuring and makes only lambda editable under More', () => {
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
    expect(source).toContain("step: '0.05'")
    expect(source).toContain('默认 0.3；数字越小，记忆遗忘越慢，消耗 token 越多，不建议大于 0.4。')
    expect(source).toContain("method: 'PATCH'")
    expect(source).toContain('当前工作区')
  })

  it('shows a red processing banner with a loading icon while memory work is active', () => {
    const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(source).toContain('sg-processing-alert')
    expect(source).toContain('sg-processing-icon')
    expect(source).toContain('正在触发记忆整理')
    expect(source).toContain("role: 'status'")
    expect(source).toContain('processingJobs')
    expect(source).toContain('Promise.allSettled')
    expect(source).toContain('window.setInterval')
    expect(source).toContain("status === 'waiting'")
  })
})
