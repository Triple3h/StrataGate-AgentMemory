// StrataGate AgentMemory UI for DSH.
window.__ModuleLoader__.load({
  id: 'stratagate-dsh',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const h = React.createElement
    const STAR_REPOSITORY_URL = 'https://github.com/diqierjia/StrataGate-AgentMemory'
    const MASCOT_DATA_URL = '__STRATAGATE_MASCOT_DATA_URL__'

    const css = `
      .sg-memory {
        color-scheme:inherit;
        --sg-page:var(--dsw-alias-bg-layer-2,#fff);
        --sg-surface:var(--dsw-specific-input-major,var(--sg-page));
        --sg-soft:var(--dsw-alias-interactive-bg-hover-solid,#f1f3f5);
        --sg-text:var(--dsw-alias-label-primary,#0f1115);
        --sg-muted:var(--dsw-alias-label-secondary,#61666b);
        --sg-border:var(--dsw-alias-border-l2,rgba(0,0,0,.1));
        --sg-accent:var(--dsw-alias-state-business-primary,#4176e6);
        --sg-accent-soft:var(--dsw-alias-state-business-tertiary,#e4edfd);
        --sg-good:var(--dsw-alias-state-success-primary,#22c55e);
        --sg-good-soft:var(--dsw-alias-state-success-tertiary,#e6faed);
        --sg-warn:var(--dsw-alias-state-warn-label,#dd8629);
        --sg-warn-soft:var(--dsw-alias-state-warn-tertiary,#fef5e7);
        --sg-danger:var(--dsw-alias-state-error-primary,#ec1313);
        --sg-danger-soft:var(--dsw-alias-interactive-bg-hover-danger,rgba(236,19,19,.05));
        box-sizing:border-box;width:100%;max-width:680px;min-width:0;margin:0 auto;padding:16px 18px 32px;
        background:var(--sg-page);color:var(--sg-text);font:14px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;
        letter-spacing:0;overflow-wrap:anywhere;
      }
      .sg-memory *{box-sizing:border-box;letter-spacing:0}.sg-memory button,.sg-memory input,.sg-memory select{font:inherit;color:inherit}
      .sg-header{display:grid;grid-template-columns:minmax(0,1fr);gap:4px;margin-bottom:11px}.sg-brand{display:flex;align-items:center;gap:9px;min-width:0;color:var(--sg-text);text-decoration:none}.sg-logo{width:34px;height:34px;display:block;object-fit:cover;flex:0 0 auto;border-radius:9px}.sg-brand-name{min-width:0;font-size:15px;font-weight:720;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-header-usage{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;width:100%;flex-wrap:wrap;color:var(--sg-muted);font-size:12px;line-height:1.4;text-align:right}.sg-header-star{white-space:nowrap;color:var(--sg-accent);text-decoration:none;font-weight:650}
      .sg-icon-button,.sg-back,.sg-quiet-button{border:0;background:transparent;cursor:pointer}.sg-icon-button{width:32px;height:32px;border-radius:6px;font-size:20px}.sg-icon-button:hover,.sg-back:hover,.sg-quiet-button:hover{background:var(--sg-soft)}
      .sg-project{display:flex;align-items:center;gap:7px;min-width:0;margin:0 0 9px;color:var(--sg-muted);font-size:12px}.sg-project-label{flex:0 0 auto}.sg-project-select{min-width:0;max-width:100%;padding:3px 22px 3px 5px;border:0;border-radius:5px;background:transparent;color:var(--sg-text);font-weight:620;cursor:pointer;text-overflow:ellipsis}
      .sg-tabs{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--sg-border);margin-bottom:20px}.sg-tab{position:relative;min-width:0;padding:10px 4px;border:0;background:transparent;color:var(--sg-muted);cursor:pointer;white-space:nowrap}.sg-tab.active{color:var(--sg-accent);font-weight:700}.sg-tab.active:after{content:"";position:absolute;left:18%;right:18%;bottom:-1px;height:2px;border-radius:2px;background:var(--sg-accent)}
      .sg-alert{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:11px 12px;margin:0 0 18px;border:1px solid color-mix(in srgb,var(--sg-warn) 28%,var(--sg-border));border-radius:8px;background:var(--sg-warn-soft);text-align:left;cursor:pointer}.sg-alert-mark{color:var(--sg-warn);font-size:17px}.sg-alert-title{font-weight:700}.sg-alert-copy{color:var(--sg-muted);font-size:12px}.sg-chevron{color:var(--sg-muted);font-size:18px}.sg-processing-alert{display:flex;align-items:center;gap:9px;width:100%;padding:11px 12px;margin:0 0 18px;border:1px solid color-mix(in srgb,var(--sg-danger) 34%,var(--sg-border));border-radius:8px;background:var(--sg-danger-soft);color:var(--sg-danger)}.sg-processing-icon{display:inline-grid;place-items:center;width:20px;height:20px;flex:0 0 auto;font-size:19px;font-weight:700;line-height:1;animation:sg-spin 1s linear infinite}.sg-processing-title{display:block;font-weight:720}.sg-processing-copy{display:block;margin-top:2px;color:var(--sg-muted);font-size:12px}@keyframes sg-spin{to{transform:rotate(360deg)}}
      .sg-intro{margin-bottom:15px}.sg-intro h2,.sg-detail-title{margin:0;font-size:18px;line-height:1.35;font-weight:740}.sg-intro p,.sg-detail-subtitle{margin:5px 0 0;color:var(--sg-muted);font-size:13px}.sg-search{position:relative;margin-bottom:5px}.sg-search-mark{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--sg-muted);font-size:16px;pointer-events:none}.sg-search input{width:100%;height:39px;padding:0 11px 0 35px;border:1px solid var(--sg-border);border-radius:7px;background:var(--sg-surface);outline:0}.sg-search input:focus{border-color:var(--sg-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--sg-accent) 14%,transparent)}
      .sg-feed{border-top:1px solid var(--sg-border)}.sg-entry{position:relative;width:100%;min-width:0;padding:17px 2px;border:0;border-bottom:1px solid var(--sg-border);background:transparent;text-align:left}.sg-entry-button{cursor:pointer}.sg-entry-button:hover .sg-entry-title{color:var(--sg-accent)}.sg-entry-title{padding-right:22px;font-size:15px;line-height:1.45;font-weight:720}.sg-entry-summary{margin-top:5px;color:var(--sg-text);white-space:pre-wrap}.sg-entry-chevron{position:absolute;right:2px;top:18px;color:var(--sg-muted);font-size:18px}.sg-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px;color:var(--sg-muted);font-size:12px}.sg-meta-sep:before{content:"·";margin-right:7px}.sg-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.sg-tag{max-width:100%;padding:3px 8px;border:1px solid var(--sg-border);border-radius:999px;background:var(--sg-soft);color:var(--sg-text);font-size:12px;line-height:1.45;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}.sg-tag-button{cursor:pointer}.sg-tag-button:hover{border-color:var(--sg-accent);color:var(--sg-accent)}
      .sg-status{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:5px;font-size:12px;font-weight:650}.sg-status:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}.sg-status.organized{color:var(--sg-good);background:var(--sg-good-soft)}.sg-status.processing{color:var(--sg-accent);background:var(--sg-accent-soft)}.sg-status.waiting{color:var(--sg-muted);background:var(--sg-soft)}.sg-status.failed{color:var(--sg-warn);background:var(--sg-warn-soft)}
      .sg-backbar{display:flex;align-items:center;min-height:35px;margin:-4px 0 13px}.sg-back{display:inline-flex;align-items:center;gap:6px;margin-left:-7px;padding:6px 7px;border-radius:6px;font-weight:650}.sg-detail-header{padding-bottom:16px;border-bottom:1px solid var(--sg-border)}.sg-detail-section{padding:18px 0;border-bottom:1px solid var(--sg-border)}.sg-detail-section:last-child{border-bottom:0}.sg-section-title{margin:0 0 11px;font-size:14px;font-weight:730}.sg-prose{margin:0;white-space:pre-wrap}.sg-facts{margin:0;padding-left:20px}.sg-facts li+li{margin-top:7px}.sg-related-list{display:flex;flex-direction:column}.sg-related{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border:0;border-bottom:1px solid var(--sg-border);background:transparent;text-align:left;cursor:pointer}.sg-related:last-child{border-bottom:0}.sg-related-name{color:var(--sg-accent)}.sg-related-time{flex:0 0 auto;color:var(--sg-muted);font-size:12px}
      .sg-source-label{display:flex;align-items:center;gap:8px}.sg-source-icon{color:var(--sg-muted)}.sg-tech{margin-top:13px}.sg-tech summary{color:var(--sg-muted);font-size:12px;cursor:pointer}.sg-tech-body{margin-top:10px;padding:11px;border-radius:7px;background:var(--sg-soft);font-size:12px}.sg-tech-row{display:grid;grid-template-columns:88px minmax(0,1fr);gap:9px;padding:3px 0}.sg-code{font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.sg-raw-message{padding-top:10px;margin-top:10px;border-top:1px solid var(--sg-border)}
      .sg-result-count{margin:0 0 9px;color:var(--sg-muted);font-size:12px}.sg-result-event{padding:8px 0;border-bottom:1px solid var(--sg-border)}.sg-result-event:last-child{border-bottom:0}.sg-pipeline{display:flex;flex-direction:column}.sg-stage{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:9px 0;border-bottom:1px solid var(--sg-border)}.sg-stage:last-child{border-bottom:0}.sg-stage-value{font-size:12px}.sg-stage-value.done{color:var(--sg-good)}.sg-stage-value.failed{color:var(--sg-danger)}.sg-stage-value.waiting{color:var(--sg-muted)}.sg-lambda-control{display:flex;align-items:center;justify-content:flex-end;gap:7px}.sg-number-input{width:82px;padding:4px 5px;border:1px solid var(--sg-border);border-radius:6px;background:var(--sg-surface);text-align:right}.sg-setting-note{margin:7px 0 11px;color:var(--sg-muted);font-size:12px}.sg-safe-note{padding:11px 12px;margin-bottom:12px;border-radius:7px;background:var(--sg-good-soft);color:var(--sg-good);font-weight:650}.sg-error-note{margin:8px 0 0;color:var(--sg-muted);font-size:12px}
      .sg-menu{border-top:1px solid var(--sg-border)}.sg-menu-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;width:100%;padding:14px 2px;border:0;border-bottom:1px solid var(--sg-border);background:transparent;text-align:left;cursor:pointer}.sg-menu-row:hover .sg-menu-title{color:var(--sg-accent)}.sg-menu-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:6px;background:var(--sg-soft);color:var(--sg-muted)}.sg-menu-title{font-weight:680}.sg-menu-subtitle{color:var(--sg-muted);font-size:12px}.sg-counts{display:flex;gap:22px;padding:5px 0 18px;border-bottom:1px solid var(--sg-border)}.sg-count-value{font-size:22px;font-weight:740}.sg-count-label{color:var(--sg-muted);font-size:12px}.sg-structured-group{padding-top:17px}.sg-raw-group{padding:12px 0;border-bottom:1px solid var(--sg-border)}.sg-raw-group summary{cursor:pointer;font-weight:680}.sg-raw-json{max-height:360px;padding:11px;margin:10px 0 0;overflow:auto;border-radius:7px;background:var(--sg-soft)}
      .sg-audit{padding:14px 0;border-bottom:1px solid var(--sg-border)}.sg-audit summary{cursor:pointer}.sg-audit-body{margin-top:10px}.sg-audit-evidence{margin-top:9px}.sg-star{padding:14px 0;margin-top:14px;border-top:1px solid var(--sg-border)}.sg-star-actions{display:flex;gap:10px;align-items:center;margin-top:8px}.sg-link{color:var(--sg-accent);text-decoration:none}.sg-quiet-button{padding:5px 7px;border-radius:5px;color:var(--sg-muted);font-size:12px}
      .sg-loading{padding:32px 0}.sg-skeleton{height:12px;margin:10px 0;border-radius:4px;background:var(--sg-soft)}.sg-skeleton:nth-child(2){width:72%}.sg-empty{padding:34px 14px;text-align:center;color:var(--sg-muted)}.sg-empty strong{display:block;margin-bottom:5px;color:var(--sg-text)}.sg-error{padding:13px;margin-bottom:16px;border:1px solid color-mix(in srgb,var(--sg-danger) 28%,var(--sg-border));border-radius:8px;background:var(--sg-danger-soft)}.sg-error-title{font-weight:700;color:var(--sg-danger)}.sg-error details{margin-top:7px;font-size:12px}
      .sg-muted{color:var(--sg-muted);font-size:12px}
      @media (max-width:560px){.sg-memory{padding:12px 12px 26px}.sg-brand-name{font-size:14px}.sg-tabs{margin-left:-2px;margin-right:-2px}.sg-tab{padding-left:0;padding-right:0}.sg-alert{grid-template-columns:auto minmax(0,1fr)}.sg-alert>.sg-chevron{display:none}.sg-tech-row{grid-template-columns:1fr;gap:1px}.sg-counts{gap:16px}.sg-entry-title{font-size:14px}}
    `

    function api(path, params, options) {
      const query = new URLSearchParams(params || {})
      return fetch('/api/stratagate/' + path + (query.size ? '?' + query : ''), options)
        .then((res) => res.json().catch(() => ({})).then((data) => {
          if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status)
          return data
        }))
    }

    function projectName(item, workspaceTitles = {}) {
      const value = String(item?.namespace || item || '')
      if (value.includes(':project:')) {
        const key = value.split(':project:').pop()
        if (key && workspaceTitles[key]) return workspaceTitles[key]
        if (item?.workspaceName && item.workspaceName !== '当前工作区') return item.workspaceName
        return '工作区名称读取中…'
      }
      if (item?.workspaceName) return item.workspaceName
      if (value.includes(':global:')) return value.split(':global:').pop() || '全局记忆'
      if (value.includes(':session:')) return '当前对话'
      return value || '当前工作区'
    }

    function workspaceProjectKey(path) {
      const canonical = String(path || '').replaceAll('\\', '/').toLowerCase()
      if (!canonical || !globalThis.crypto?.subtle) return Promise.resolve('')
      return globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)).then((digest) =>
        Array.from(new Uint8Array(digest).slice(0, 10), (byte) => byte.toString(16).padStart(2, '0')).join(''))
    }

    function formatTime(value) {
      if (!value) return '时间未知'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      const seconds = Math.round((Date.now() - date.getTime()) / 1000)
      if (seconds >= 0 && seconds < 60) return '刚刚'
      if (seconds >= 60 && seconds < 3600) return Math.floor(seconds / 60) + ' 分钟前'
      const timeZone = 'Asia/Shanghai'
      const dayKey = (input) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(input)
      const clock = (input) => new Intl.DateTimeFormat('zh-CN', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(input)
      const now = new Date()
      if (dayKey(date) === dayKey(now)) return '今天 ' + clock(date)
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      if (dayKey(date) === dayKey(yesterday)) return '昨天 ' + clock(date)
      return new Intl.DateTimeFormat('zh-CN', { timeZone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
    }

    function statusText(status) {
      if (status === 'organized') return '已整理'
      if (status === 'failed') return '整理失败'
      if (status === 'waiting') return '等待整理'
      return '整理中'
    }

    function Loading() {
      return h('div', { className: 'sg-loading', role: 'status' }, h('div', { className: 'sg-skeleton' }), h('div', { className: 'sg-skeleton' }), h('div', { className: 'sg-skeleton' }))
    }

    function Empty({ title, copy }) {
      return h('div', { className: 'sg-empty' }, h('strong', null, title), h('span', null, copy))
    }

    function BackBar({ label, onBack }) {
      return h('div', { className: 'sg-backbar' }, h('button', { className: 'sg-back', onClick: onBack, title: '返回' }, h('span', { 'aria-hidden': 'true' }, '←'), label))
    }

    function FailureAlert({ count, onOpen }) {
      if (!count) return null
      return h('button', { className: 'sg-alert', onClick: onOpen },
        h('span', { className: 'sg-alert-mark', 'aria-hidden': 'true' }, '⚠'),
        h('span', null, h('span', { className: 'sg-alert-title' }, count + ' 条最近记忆尚未整理完成'), h('br'), h('span', { className: 'sg-alert-copy' }, '原始内容已经保存，不会丢失。')),
        h('span', { className: 'sg-chevron', 'aria-hidden': 'true' }, '›'))
    }

    function ProcessingAlert({ visible }) {
      if (!visible) return null
      return h('div', { className: 'sg-processing-alert', role: 'status', 'aria-live': 'polite' },
        h('span', { className: 'sg-processing-icon', 'aria-hidden': 'true' }, '↻'),
        h('span', null,
          h('span', { className: 'sg-processing-title' }, '正在触发记忆整理'),
          h('span', { className: 'sg-processing-copy' }, 'Block、Event 和 Element 正在生成，请稍候。')))
    }

    function SearchBox({ value, onChange }) {
      return h('div', { className: 'sg-search' }, h('span', { className: 'sg-search-mark', 'aria-hidden': 'true' }, '⌕'), h('input', { value, onChange: (event) => onChange(event.target.value), placeholder: '搜索记忆、人物、项目、概念…', 'aria-label': '搜索长期记忆' }))
    }

    function ElementTags({ elements, onOpen }) {
      if (!Array.isArray(elements) || !elements.length) return null
      return h('div', { className: 'sg-tags', 'aria-label': '相关事物' }, elements.map((element) => h('button', { key: element.id, className: 'sg-tag sg-tag-button', onClick: (event) => { event.stopPropagation(); onOpen(element.id) } }, element.name)))
    }

    function LongTermPage({ events, elements, project, query, setQuery, openEvent, openElement }) {
      const normalized = query.trim().toLocaleLowerCase()
      const visible = [...events]
        .filter((event) => event.status !== 'forgotten' && event.status !== 'archived')
        .filter((event) => !normalized || JSON.stringify([event.title, event.summary, event.tags, event.relatedElements, project]).toLocaleLowerCase().includes(normalized))
        .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
      const elementMap = new Map(elements.map((element) => [element.id, element]))
      return h(React.Fragment, null,
        h('div', { className: 'sg-intro' }, h('h2', null, 'AI 已形成的长期记忆'), h('p', null, '围绕当前工作区整理出的经历与相关事物')),
        h(SearchBox, { value: query, onChange: setQuery }),
        visible.length ? h('div', { className: 'sg-feed' }, visible.map((event) => h('article', { key: event.id, className: 'sg-entry' },
          h('button', { className: 'sg-entry sg-entry-button', style: { padding: 0, borderBottom: 0 }, onClick: () => openEvent(event) },
            h('div', { className: 'sg-entry-title' }, event.title || '未命名记忆'),
            event.summary ? h('div', { className: 'sg-entry-summary' }, event.summary) : null,
            h('span', { className: 'sg-entry-chevron', 'aria-hidden': 'true' }, '›')),
          h('div', { className: 'sg-meta' }, h('span', null, formatTime(event.updatedAt || event.createdAt)), h('span', { className: 'sg-meta-sep' }, project)),
          h(ElementTags, { elements: (event.relatedElements || []).map((item) => elementMap.get(item.id) || item), onOpen: openElement }))))
          : h(Empty, { title: normalized ? '没有找到匹配的长期记忆' : '还没有形成长期记忆', copy: normalized ? '换一个关键词试试。' : '近期内容完成整理后会出现在这里。' }))
    }

    function RecentPage({ blocks, project, openBlock }) {
      const visible = [...blocks].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      return h(React.Fragment, null,
        h('div', { className: 'sg-intro' }, h('h2', null, '最近记忆'), h('p', null, 'AI 最近完整记下、正在整理的内容')),
        visible.length ? h('div', { className: 'sg-feed' }, visible.map((block) => h('button', { key: block.id, className: 'sg-entry sg-entry-button', onClick: () => openBlock(block) },
          h('div', { className: 'sg-entry-title' }, block.title || '近期记忆'),
          block.summary ? h('div', { className: 'sg-entry-summary' }, block.summary) : null,
          h('div', { className: 'sg-meta' }, h('span', null, formatTime(block.createdAt)), h('span', { className: 'sg-meta-sep' }, project), h('span', { className: 'sg-status ' + block.status }, statusText(block.status))),
          block.status === 'organized' ? h('div', { className: 'sg-meta' }, '形成 ' + (block.relatedEvents || []).length + ' 条长期记忆，识别 ' + (block.relatedElements || []).length + ' 个相关事物') : null,
          block.status === 'failed' ? h('div', { className: 'sg-error-note' }, '原始记忆已保存，不会丢失。') : null,
          h('span', { className: 'sg-entry-chevron', 'aria-hidden': 'true' }, '›'))))
          : h(Empty, { title: '还没有最近记忆', copy: '完成一些对话后，AI 完整记下的内容会出现在这里。' }))
    }

    function SourceDetails({ item, source, kind }) {
      const messages = source?.messages || []
      return h('div', { className: 'sg-detail-section' },
        h('h3', { className: 'sg-section-title' }, '来源'),
        h('div', { className: 'sg-source-label' }, h('span', { className: 'sg-source-icon', 'aria-hidden': 'true' }, '▣'), h('span', null, '当前 DeepSeek 对话')),
        h('details', { className: 'sg-tech' }, h('summary', null, '技术详情'), h('div', { className: 'sg-tech-body' },
          h('div', { className: 'sg-tech-row' }, h('span', { className: 'sg-muted' }, kind === 'block' ? 'Block ID' : kind === 'event' ? 'Event ID' : 'Element ID'), h('span', { className: 'sg-code' }, item.id)),
          kind === 'block' && item.turnRange ? h('div', { className: 'sg-tech-row' }, h('span', { className: 'sg-muted' }, 'Turn'), h('span', null, item.turnRange.join(' - '))) : null,
          messages.length ? messages.map((message) => h('div', { key: message.id, className: 'sg-raw-message' }, h('div', { className: 'sg-muted' }, String(message.role || '') + ' · ' + formatTime(message.createdAt)), h('div', { className: 'sg-code' }, String(message.content || '')))) : h('div', { className: 'sg-muted' }, '当前数据中没有可显示的来源消息。'))))
    }

    function EventDetail({ event, project, source, openElement, onBack, backLabel }) {
      return h(React.Fragment, null,
        h(BackBar, { label: backLabel, onBack }),
        h('header', { className: 'sg-detail-header' }, h('h2', { className: 'sg-detail-title' }, event.title || '记忆详情'), event.summary ? h('p', { className: 'sg-detail-subtitle' }, event.summary) : null, h('div', { className: 'sg-meta' }, h('span', null, formatTime(event.updatedAt || event.createdAt)), h('span', { className: 'sg-meta-sep' }, project))),
        event.narrative ? h('div', { className: 'sg-detail-section' }, h('h3', { className: 'sg-section-title' }, 'AI 对这段经历的理解'), h('p', { className: 'sg-prose' }, event.narrative)) : null,
        h('div', { className: 'sg-detail-section' }, h('h3', { className: 'sg-section-title' }, '相关事物'), h(ElementTags, { elements: event.relatedElements || [], onOpen: openElement })),
        h(SourceDetails, { item: event, source, kind: 'event' }))
    }

    function ElementDetail({ element, events, source, openEvent, onBack, backLabel }) {
      const facts = []
      if (element.currentState) facts.push(element.currentState)
      for (const fact of element.facts || []) {
        const value = Array.isArray(fact.value) ? fact.value.join('、') : fact.value
        if (value && !facts.includes(String(value))) facts.push(String(value))
      }
      const related = events.filter((event) => (element.sourceEventIds || []).includes(event.id)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      return h(React.Fragment, null,
        h(BackBar, { label: backLabel, onBack }),
        h('header', { className: 'sg-detail-header' }, h('h2', { className: 'sg-detail-title' }, element.name || '相关事物'), h('p', { className: 'sg-detail-subtitle' }, 'AI 关于它目前知道这些'), h('div', { className: 'sg-meta' }, h('span', null, '相关经历 ' + related.length + ' 条'), h('span', { className: 'sg-meta-sep' }, '最近更新 ' + formatTime(element.updatedAt)))),
        h('div', { className: 'sg-detail-section' }, facts.length ? h('ul', { className: 'sg-facts' }, facts.map((fact, index) => h('li', { key: index }, fact))) : h('div', { className: 'sg-muted' }, '暂时没有形成可展示的认识。')),
        h('div', { className: 'sg-detail-section' }, h('h3', { className: 'sg-section-title' }, '相关经历'), related.length ? h('div', { className: 'sg-related-list' }, related.map((event) => h('button', { key: event.id, className: 'sg-related', onClick: () => openEvent(event) }, h('span', { className: 'sg-related-name' }, event.title), h('span', { className: 'sg-related-time' }, formatTime(event.updatedAt || event.createdAt))))) : h('div', { className: 'sg-muted' }, '没有关联经历。')),
        h(SourceDetails, { item: element, source, kind: 'element' }))
    }

    function BlockDetail({ block, project, source, openEvent, openElement, onBack }) {
      const events = source?.events?.length ? source.events : (block.relatedEvents || [])
      const elements = source?.elements?.length ? source.elements : (block.relatedElements || [])
      return h(React.Fragment, null,
        h(BackBar, { label: '最近记忆', onBack }),
        h('header', { className: 'sg-detail-header' }, h('h2', { className: 'sg-detail-title' }, '记忆内容'), h('p', { className: 'sg-detail-subtitle sg-prose' }, block.summary || block.title || '暂无可显示内容'), h('div', { className: 'sg-meta' }, h('span', null, formatTime(block.createdAt)), h('span', { className: 'sg-meta-sep' }, project))),
        h('div', { className: 'sg-detail-section' }, h('h3', { className: 'sg-section-title' }, '整理结果'), block.status === 'failed' ? h('div', { className: 'sg-safe-note' }, '原始记忆已保存，不会丢失。') : null, h('div', { className: 'sg-status ' + block.status }, statusText(block.status)),
          events.length ? h(React.Fragment, null, h('p', { className: 'sg-result-count' }, '形成经历 ' + events.length + ' 条'), h('div', null, events.map((event) => h('button', { key: event.id, className: 'sg-related', onClick: () => openEvent(event) }, h('span', { className: 'sg-related-name' }, event.title), h('span', { className: 'sg-chevron' }, '›'))))) : null,
          elements.length ? h(React.Fragment, null, h('p', { className: 'sg-result-count', style: { marginTop: '15px' } }, '识别相关事物 ' + elements.length + ' 个'), h(ElementTags, { elements, onOpen: openElement })) : null,
          block.status === 'processing' && !events.length ? h('p', { className: 'sg-error-note' }, '后续结构正在生成，完成后会显示在这里。') : null),
        h(SourceDetails, { item: block, source, kind: 'block' }))
    }

    function ProcessingStatus({ overview, blocks, onBack, refresh }) {
      const failures = overview.failedJobDetails || []
      const failedBlocks = blocks.filter((block) => block.status === 'failed')
      const first = failures[0]
      return h(React.Fragment, null,
        h(BackBar, { label: '返回', onBack }),
        h('div', { className: 'sg-intro' }, h('h2', null, '处理状态'), h('p', null, failures.length + ' 个任务需要继续处理')),
        h('div', { className: 'sg-safe-note' }, '原始记忆已保存，不会丢失。'),
        h('div', { className: 'sg-detail-section' }, h('div', { className: 'sg-pipeline' },
          h('div', { className: 'sg-stage' }, h('span', null, '记忆保存'), h('span', { className: 'sg-stage-value done' }, '✓ 已完成')),
          h('div', { className: 'sg-stage' }, h('span', null, '事件提取'), h('span', { className: 'sg-stage-value ' + (first?.kind === 'event-extraction' ? 'failed' : 'done') }, first?.kind === 'event-extraction' ? '× 失败' : '✓ 已完成')),
          h('div', { className: 'sg-stage' }, h('span', null, '元素投影'), h('span', { className: 'sg-stage-value ' + (first?.kind === 'element-projection' ? 'failed' : first?.kind === 'event-extraction' ? 'waiting' : 'done') }, first?.kind === 'element-projection' ? '× 失败' : first?.kind === 'event-extraction' ? '— 等待' : '✓ 已完成')))),
        failedBlocks.length ? h('div', { className: 'sg-detail-section' }, h('h3', { className: 'sg-section-title' }, '受影响的最近记忆'), failedBlocks.map((block) => h('div', { key: block.id, className: 'sg-result-event' }, block.title || block.summary || '近期记忆'))) : null,
        h('button', { className: 'sg-alert', onClick: refresh, style: { marginTop: '16px' } }, h('span', { className: 'sg-alert-mark' }, '↻'), h('span', null, h('span', { className: 'sg-alert-title' }, '重新检查状态'), h('br'), h('span', { className: 'sg-alert-copy' }, '任务会沿用现有重试机制继续处理。')), h('span', { className: 'sg-chevron' }, '›')),
        h('details', { className: 'sg-tech' }, h('summary', null, '技术错误详情'), h('pre', { className: 'sg-tech-body sg-code' }, first?.lastErrorFull || first?.lastError || '没有记录技术错误。')))
    }

    function MoreHome({ selected, setView }) {
      const rows = [
        ['structure', '◇', '记忆结构', '浏览经历与相关事物'],
        ['system', '✓', '系统状态', '处理任务和最近整理时间'],
        ['audit', '↗', '使用记录', '长期记忆何时被使用'],
        ['raw', '{}', '原始数据', 'Block、Event、Element 与模型响应'],
        ['settings', '⚙', '高级设置', 'Schema、提取间隔与项目空间'],
      ]
      return h(React.Fragment, null, h('div', { className: 'sg-intro' }, h('h2', null, '更多'), h('p', null, '高级信息与工程视图')), h('div', { className: 'sg-menu' }, rows.map(([id, icon, title, subtitle]) => h('button', { key: id, className: 'sg-menu-row', onClick: () => setView({ name: id }) }, h('span', { className: 'sg-menu-icon', 'aria-hidden': 'true' }, icon), h('span', null, h('span', { className: 'sg-menu-title' }, title), h('br'), h('span', { className: 'sg-menu-subtitle' }, subtitle)), h('span', { className: 'sg-chevron' }, '›')))))
    }

    function StructurePage({ events, elements, openEvent, openElement, onBack }) {
      return h(React.Fragment, null,
        h(BackBar, { label: '更多', onBack }),
        h('div', { className: 'sg-intro' }, h('h2', null, '记忆结构'), h('p', null, '完整浏览现有结构化记忆')),
        h('div', { className: 'sg-counts' },
          h('div', null, h('div', { className: 'sg-count-value' }, events.length), h('div', { className: 'sg-count-label' }, '经历 / Event')),
          h('div', null, h('div', { className: 'sg-count-value' }, elements.length), h('div', { className: 'sg-count-label' }, '相关事物 / Element'))),
        h('div', { className: 'sg-structured-group' },
          h('h3', { className: 'sg-section-title' }, '经历'),
          events.map((event) => h('button', { key: event.id, className: 'sg-related', onClick: () => openEvent(event) }, h('span', null, event.title), h('span', { className: 'sg-related-time' }, formatTime(event.updatedAt))))),
        h('div', { className: 'sg-structured-group' },
          h('h3', { className: 'sg-section-title' }, '相关事物'),
          elements.map((element) => h('button', { key: element.id, className: 'sg-related', onClick: () => openElement(element.id) }, h('span', null, element.name), h('span', { className: 'sg-related-time' }, (element.sourceEventIds || []).length + ' 条经历')))))
    }

    function SystemPage({ selected, blocks, onBack, refresh }) {
      const processing = blocks.filter((block) => block.status === 'processing').length
      return h(React.Fragment, null, h(BackBar, { label: '更多', onBack }), h('div', { className: 'sg-intro' }, h('h2', null, '系统状态'), h('p', null, '仅在这里展示记忆处理的工程状态')), h('div', { className: 'sg-pipeline' },
        [['Block 数量', selected.blocks], ['待处理任务', processing], ['失败任务', selected.failedJobs], ['最近整理时间', formatTime(selected.lastActivityAt)], ['Event 提取', selected.failedJobDetails?.some((item) => item.kind === 'event-extraction') ? '有失败' : '正常'], ['Element 投影', selected.failedJobDetails?.some((item) => item.kind === 'element-projection') ? '有失败' : '正常']].map(([label, value]) => h('div', { key: label, className: 'sg-stage' }, h('span', null, label), h('span', { className: 'sg-stage-value ' + (label === '失败任务' && value ? 'failed' : 'waiting') }, String(value))))), h('button', { className: 'sg-quiet-button', onClick: refresh, style: { marginTop: '14px' } }, '↻ 重新检查'))
    }

    function AuditPage({ audit, onBack }) {
      return h(React.Fragment, null, h(BackBar, { label: '更多', onBack }), h('div', { className: 'sg-intro' }, h('h2', null, '使用记录'), h('p', null, '长期记忆被使用的时间与来源')), audit.length ? audit.map((item) => { const value = item.audit || {}; return h('details', { key: item.id, className: 'sg-audit' }, h('summary', null, h('strong', null, '使用了 ' + ((item.events || []).length + (item.elements || []).length) + ' 条记忆'), h('span', { className: 'sg-muted' }, ' · ' + formatTime(item.createdAt))), h('div', { className: 'sg-audit-body' }, h('div', null, (item.events || []).map((event) => event.title).join('、') || (item.elements || []).map((element) => element.name).join('、') || '旧版使用记录'), h('div', { className: 'sg-tech-row sg-audit-evidence' }, h('span', { className: 'sg-muted' }, '来源会话'), h('span', { className: 'sg-code' }, value.sessionId || '未记录')), value.turn !== undefined ? h('div', { className: 'sg-tech-row' }, h('span', { className: 'sg-muted' }, 'Turn'), h('span', null, value.turn)) : null)) }) : h(Empty, { title: '还没有使用记录', copy: 'AI 在回答中采用长期记忆后会记录在这里。' }))
    }

    function RawPage({ data, selected, onBack }) {
      const groups = [['Block raw', data.blocks], ['Event raw', data.events], ['Element raw', data.elements], ['Usage raw', data.audit], ['模型响应', selected.successfulModelResponses || []]]
      return h(React.Fragment, null, h(BackBar, { label: '更多', onBack }), h('div', { className: 'sg-intro' }, h('h2', null, '原始数据'), h('p', null, '供排查问题使用的内部字段与 JSON')), groups.map(([label, value]) => h('details', { key: label, className: 'sg-raw-group' }, h('summary', null, label + ' (' + value.length + ')'), h('pre', { className: 'sg-raw-json sg-code' }, JSON.stringify(value, null, 2)))))
    }

    function SettingsPage({ selected, namespace, onBack, updateLambda, savingLambda }) {
      const [lambda, setLambda] = React.useState(String(selected.blockDecayLambda ?? 0.3))
      React.useEffect(() => setLambda(String(selected.blockDecayLambda ?? 0.3)), [selected.blockDecayLambda])
      const changeLambda = (event) => {
        const raw = event.target.value
        setLambda(raw)
        const value = Number(raw)
        if (raw !== '' && Number.isFinite(value) && value >= 0) void updateLambda(value)
      }
      const rows = [['Schema 版本', 'v' + selected.schemaVersion], ['提取间隔', '每 ' + selected.blockTurnSize + ' 轮形成一个 Block'], ['模型', '由 DSH 当前模型配置提供'], ['内部空间 ID', namespace], ['已处理轮次', selected.currentTurn]]
      return h(React.Fragment, null,
        h(BackBar, { label: '更多', onBack }),
        h('div', { className: 'sg-intro' }, h('h2', null, '高级设置'), h('p', null, '修改后会立即应用到所有已有工作区，并作为新工作区的默认值。')),
        h('div', { className: 'sg-pipeline' },
          h('div', { className: 'sg-stage' }, h('span', null, 'Block 衰减系数 λ'), h('span', { className: 'sg-lambda-control' }, h('input', { className: 'sg-number-input', type: 'number', min: '0', step: '0.05', value: lambda, onChange: changeLambda, 'aria-label': 'Block 衰减系数 λ' }), h('span', { className: 'sg-stage-value waiting' }, savingLambda ? '保存中…' : '已保存'))),
          h('p', { className: 'sg-setting-note' }, '默认 0.3；数字越小，记忆遗忘越慢，消耗 token 越多，不建议大于 0.4。'),
          rows.map(([label, value]) => h('div', { key: label, className: 'sg-stage' }, h('span', null, label), h('span', { className: label === '内部空间 ID' ? 'sg-stage-value sg-code' : 'sg-stage-value' }, String(value)))))
      )
    }

    function MemoryPage({ useWorkspaces }) {
      const workspaceItems = useWorkspaces((state) => state.items)
      const [overview, setOverview] = React.useState({ namespaces: [] })
      const [namespace, setNamespace] = React.useState('')
      const [workspaceTitles, setWorkspaceTitles] = React.useState({})
      const [section, setSection] = React.useState('long')
      const [view, setView] = React.useState({ name: 'root' })
      const [data, setData] = React.useState({ events: [], elements: [], blocks: [], audit: [] })
      const [query, setQuery] = React.useState('')
      const [source, setSource] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState('')
      const [savingLambda, setSavingLambda] = React.useState(false)

      React.useEffect(() => {
        let active = true
        void Promise.all((workspaceItems || []).map(async (workspace) => [
          await workspaceProjectKey(workspace.path),
          String(workspace.title || '').trim(),
        ])).then((entries) => {
          if (!active) return
          setWorkspaceTitles(Object.fromEntries(entries.filter(([key, title]) => key && title)))
        })
        return () => { active = false }
      }, [workspaceItems])

      const loadOverview = React.useCallback(() => {
        setError('')
        return api('overview').then((next) => { setOverview(next); setNamespace((current) => next.namespaces?.some((item) => item.namespace === current) ? current : (next.namespaces?.[0]?.namespace || '')); return next }).catch((reason) => { setError(String(reason.message || reason)); return null })
      }, [])

      const loadMemoryData = React.useCallback((activeNamespace, options = {}) => {
        const background = options.background === true
        if (!activeNamespace) { setData({ events: [], elements: [], blocks: [], audit: [] }); if (!background) setLoading(false); return Promise.resolve() }
        if (!background) setLoading(true)
        return Promise.allSettled([
          api('memories', { namespace: activeNamespace, kind: 'events', limit: '200' }),
          api('memories', { namespace: activeNamespace, kind: 'elements', limit: '200' }),
          api('memories', { namespace: activeNamespace, kind: 'blocks', limit: '200' }),
          api('audit', { namespace: activeNamespace, limit: '100' }),
        ]).then((results) => {
          const [events, elements, blocks, audit] = results
          setData((previous) => ({
            events: events.status === 'fulfilled' ? events.value.items || [] : previous.events,
            elements: elements.status === 'fulfilled' ? elements.value.items || [] : previous.elements,
            blocks: blocks.status === 'fulfilled' ? blocks.value.items || [] : previous.blocks,
            audit: audit.status === 'fulfilled' ? audit.value.items || [] : previous.audit,
          }))
          const failure = results.find((result) => result.status === 'rejected')
          if (failure && failure.status === 'rejected') setError(String(failure.reason?.message || failure.reason))
          else setError('')
        }).finally(() => { if (!background) setLoading(false) })
      }, [])

      React.useEffect(() => { setLoading(true); void loadOverview().finally(() => setLoading(false)) }, [])
      React.useEffect(() => {
        setView({ name: 'root' }); setSource(null); setData({ events: [], elements: [], blocks: [], audit: [] }); void loadMemoryData(namespace)
      }, [namespace])
      React.useEffect(() => {
        if (!namespace) return undefined
        const timer = window.setInterval(() => {
          void Promise.all([loadOverview(), loadMemoryData(namespace, { background: true })])
        }, 2500)
        return () => window.clearInterval(timer)
      }, [namespace, loadOverview, loadMemoryData])

      const selected = (overview.namespaces || []).find((item) => item.namespace === namespace)
      const project = projectName(selected || namespace, workspaceTitles)
      const failedCount = Number(selected?.failedJobs || 0)
      const processing = !error && (Number(selected?.processingJobs || 0) > 0
        || data.blocks.some((block) => block.status === 'processing'))
      const goSection = (next) => { setSection(next); setView({ name: 'root' }); setSource(null) }
      const sourceParams = (kind, item) => kind === 'event' ? { eventId: item.id } : kind === 'element' ? { elementId: item.id } : { blockId: item.id }
      const loadSource = (kind, item) => {
        setSource(null)
        void api('sources', { namespace, ...sourceParams(kind, item) }).then(setSource).catch((reason) => setError(String(reason.message || reason)))
      }
      const openWithSource = (kind, item) => {
        setView((current) => ({ name: kind, item, back: current })); loadSource(kind, item)
      }
      const openEvent = (event) => openWithSource('event', data.events.find((item) => item.id === event.id) || event)
      const openElement = (id) => { const element = data.elements.find((item) => item.id === id); if (element) openWithSource('element', element) }
      const openBlock = (block) => openWithSource('block', block)
      const goBack = () => {
        const previous = view.back || { name: 'root' }
        setView(previous)
        if (previous.item && ['event', 'element', 'block'].includes(previous.name)) loadSource(previous.name, previous.item)
        else setSource(null)
      }
      const backLabel = view.back?.name === 'block' ? '最近记忆' : view.back?.name === 'element' ? '相关事物' : view.back?.name === 'event' ? '长期记忆' : view.back?.name === 'structure' ? '记忆结构' : section === 'recent' ? '最近记忆' : '长期记忆'
      const refresh = () => Promise.all([loadOverview(), loadMemoryData(namespace)])
      const updateLambda = (value) => {
        setSavingLambda(true)
        setError('')
        return api('settings', { blockDecayLambda: value }, { method: 'PATCH' })
          .then(loadOverview)
          .catch((reason) => setError(String(reason.message || reason)))
          .finally(() => setSavingLambda(false))
      }
      const moreBack = () => setView({ name: 'root' })

      let content = null
      if (loading && !selected) content = h(Loading)
      else if (!selected) content = h(Empty, { title: '还没有记忆', copy: '完成一些 DSH 对话后，长期记忆和最近记忆会出现在这里。' })
      else if (view.name === 'event') content = h(EventDetail, { event: view.item, project, source, openElement, onBack: goBack, backLabel })
      else if (view.name === 'element') content = h(ElementDetail, { element: view.item, events: data.events, source, openEvent, onBack: goBack, backLabel })
      else if (view.name === 'block') content = h(BlockDetail, { block: view.item, project, source, openEvent, openElement, onBack: goBack })
      else if (view.name === 'status') content = h(ProcessingStatus, { overview: selected, blocks: data.blocks, onBack: () => setView({ name: 'root' }), refresh })
      else if (view.name === 'structure') content = h(StructurePage, { events: data.events, elements: data.elements, openEvent, openElement, onBack: moreBack })
      else if (view.name === 'system') content = h(SystemPage, { selected, blocks: data.blocks, onBack: moreBack, refresh })
      else if (view.name === 'audit') content = h(AuditPage, { audit: data.audit, onBack: moreBack })
      else if (view.name === 'raw') content = h(RawPage, { data, selected, onBack: moreBack })
      else if (view.name === 'settings') content = h(SettingsPage, { selected, namespace, onBack: moreBack, updateLambda, savingLambda })
      else content = h(React.Fragment, null,
        h(FailureAlert, { count: failedCount, onOpen: () => setView({ name: 'status' }) }),
        loading ? h(Loading) : section === 'long' ? h(LongTermPage, { events: data.events, elements: data.elements, project, query, setQuery, openEvent, openElement }) : section === 'recent' ? h(RecentPage, { blocks: data.blocks, project, openBlock }) : h(MoreHome, { setView }))

      return h('main', { className: 'sg-memory', 'data-testid': 'stratagate-memory-ui' },
        h('style', null, css),
        h('header', { className: 'sg-header' },
          h('a', { className: 'sg-brand', href: STAR_REPOSITORY_URL, target: '_blank', rel: 'noopener noreferrer' }, h('img', { className: 'sg-logo', src: MASCOT_DATA_URL, alt: '' }), h('span', { className: 'sg-brand-name' }, 'StrataGate-AgentMemory')),
          h('div', { className: 'sg-header-usage' }, h('span', null, 'StrataGate 已在当前工作区中帮助使用记忆 ', Number(selected?.memoryUseCount || 0), ' 次。'), h('a', { className: 'sg-header-star', href: STAR_REPOSITORY_URL, target: '_blank', rel: 'noopener noreferrer' }, '为 StrataGate 点 🌟🌟'))),
        h('div', { className: 'sg-project' }, h('span', { className: 'sg-project-label' }, '当前工作区：'), h('select', { className: 'sg-project-select', value: namespace, onChange: (event) => setNamespace(event.target.value), 'aria-label': '当前工作区' }, (overview.namespaces || []).map((item) => h('option', { key: item.namespace, value: item.namespace }, projectName(item, workspaceTitles))))),
        h('nav', { className: 'sg-tabs', 'aria-label': '记忆视图' }, [['long', '长期记忆'], ['recent', '最近记忆'], ['more', '更多']].map(([id, label]) => h('button', { key: id, className: 'sg-tab ' + (section === id ? 'active' : ''), onClick: () => goSection(id) }, label))),
        error ? h('div', { className: 'sg-error' }, h('div', { className: 'sg-error-title' }, '暂时无法读取完整记忆'), h('div', null, '已显示能够读取的内容，请稍后重新加载。'), h('details', null, h('summary', null, '技术详情'), h('div', { className: 'sg-code' }, error))) : null,
        h(ProcessingAlert, { visible: processing }),
        content)
    }

    function apply(ctx) {
      const slots = ctx.get('slots')
      if (!slots) return
      slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'stratagate-memory', order: 32, label: () => 'StrataGate-AgentMemory' }, (props) => h(MemoryPage, props)))
    }

    exports.name = 'stratagate-dsh'
    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
