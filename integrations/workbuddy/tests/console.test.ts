import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { MEMORY_CONSOLE_HTML } from '../src/gateway-ui.js'

function consoleHarness(url: string, storedProject = '') {
  const script = MEMORY_CONSOLE_HTML.match(/<script>([\s\S]*?)<\/script>/)![1]!
  const local = new Map([['stratagate_console_project', storedProject]])
  let current = new URL(url, 'http://localhost')
  const root = { innerHTML: '' }
  const listeners: Record<string, () => void> = {}
  const context = createContext({
    URL, URLSearchParams, AbortController, Intl, console,
    location: { get href() { return current.href }, get origin() { return current.origin } },
    history: {
      replaceState: (_: unknown, __: unknown, value: string) => { current = new URL(value, current) },
      pushState: (_: unknown, __: unknown, value: string) => { current = new URL(value, current) },
    },
    localStorage: { getItem: (key: string) => local.get(key) || '', setItem: (key: string, value: string) => local.set(key, value) },
    document: { getElementById: (id: string) => id === 'app' ? root : null, addEventListener() {} },
    window: { addEventListener: (name: string, listener: () => void) => { listeners[name] = listener } },
    fetch: () => new Promise(() => {}),
  })
  runInContext(script, context)
  return { run: (source: string) => runInContext(source, context), local, listeners, url: () => current }
}

describe('Console navigation and project scope', () => {
  it('restores a deep link before loading data and keeps filters in the URL', () => {
    const h = consoleHarness('/sessions?project=shared%3Atwo&source=codex&agent=child&q=hello&session=turn-1', 'shared:one')
    expect(h.run('state.namespace')).toBe('shared:two')
    expect(h.run('state.sourceFilter')).toBe('codex')
    expect(h.run('state.session')).toBe('turn-1')
    expect(h.run('routeUrl()')).toBe('/sessions?project=shared%3Atwo&q=hello&agent=child&source=codex&session=turn-1')
    expect(h.run('routeUrl("overview", {query:"",session:""})')).toBe('/dashboard?project=shared%3Atwo')
  })

  it('uses a remembered project only when the URL has no explicit scope', () => {
    const h = consoleHarness('/sessions', 'shared:saved')
    expect(h.run('state.namespace')).toBe('shared:saved')
    h.run('history.pushState({}, "", "/sessions?project=shared:other&source=zcode")')
    h.listeners.popstate!()
    expect(h.run('state.namespace')).toBe('shared:other')
    expect(h.run('state.sourceFilter')).toBe('zcode')
  })

  it('groups threads belonging to one conversation and escapes source text', () => {
    const h = consoleHarness('/sessions')
    h.run(`state.snapshot={openTail:[
      {id:'a',conversationId:'same',threadId:'thread-a',role:'user',content:'<img src=x onerror=alert(1)>',createdAt:'2026-09-05T00:00:00Z'},
      {id:'b',conversationId:'same',threadId:'thread-b',role:'assistant',content:'answer',createdAt:'2026-09-05T00:01:00Z'}
    ],blocks:[]}`)
    expect(h.run('sessions().length')).toBe(1)
    expect(h.run('sessions()[0].messages.length')).toBe(2)
    expect(h.run('sessionTable(sessions())')).toContain('&lt;img')
    expect(h.run('sessionTable(sessions())')).not.toContain('<img')
  })

  it('does not silently substitute another project for a stale shared link', async () => {
    const h = consoleHarness('/sessions?project=missing')
    h.run('api=async()=>({namespaces:[{namespace:"other"}]})')
    await h.run('loadData()')
    expect(h.run('state.namespace')).toBe('missing')
    expect(h.run('state.snapshot')).toBeNull()
    expect(h.run('state.error')).toContain('项目不存在')
  })

  it('discards a slow project response after navigation to another project', async () => {
    const h = consoleHarness('/sessions?project=one')
    h.run(`state.dashboard={namespaces:[{namespace:'one'},{namespace:'two'}]};
      let resolveFirst; api=(path)=>path.includes('namespace=one')?new Promise(resolve=>{resolveFirst=resolve}):Promise.resolve({openTail:[],marker:'two'});`)
    const first = h.run('loadData(false)')
    h.run('state.namespace="two";history.pushState({},"","/sessions?project=two")')
    await h.run('loadData(false)')
    h.run('resolveFirst({openTail:[],marker:"one"})')
    await first
    expect(h.run('state.snapshot.marker')).toBe('two')
    expect(h.run('snapshotNamespace')).toBe('two')
  })
})
