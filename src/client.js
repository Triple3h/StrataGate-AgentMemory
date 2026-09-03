// StrataGate AgentMemory UI for DSH.
window.__ModuleLoader__.load({
  id: 'stratagate-dsh',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const h = React.createElement
    const cytoscape = globalThis.__StrataGateGraphLibraries?.cytoscape
    const STAR_REPOSITORY_URL = 'https://github.com/diqierjia/StrataGate-AgentMemory'
    const ISSUE_URL = STAR_REPOSITORY_URL + '/issues/new'
    const DISCUSSION_URL = STAR_REPOSITORY_URL + '/discussions/categories/q-a'
    const MASCOT_DATA_URL = '__STRATAGATE_MASCOT_DATA_URL__'
    const MEMORY_CITATIONS_KIND = 'stratagate-memory-citations'
    const MEMORY_RETRIEVAL_TOOLS = new Set([
      'memory_search_events', 'memory_search_graph', 'memory_expand_graph_node',
      'memory_search_elements', 'memory_search_raw', 'memory_get_blocks',
      'memory_expand_block', 'memory_expand_event', 'memory_expand_element',
    ])

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
        --sg-level-0:color-mix(in srgb,var(--sg-accent) 12%,var(--sg-surface));
        --sg-level-1:color-mix(in srgb,var(--sg-accent) 22%,var(--sg-surface));
        --sg-level-2:color-mix(in srgb,var(--sg-accent) 34%,var(--sg-surface));
        --sg-level-3:color-mix(in srgb,var(--sg-accent) 46%,var(--sg-surface));
        --sg-level-4:color-mix(in srgb,var(--sg-accent) 58%,var(--sg-surface));
        --sg-level-5:color-mix(in srgb,var(--sg-accent) 72%,var(--sg-surface));
        --sg-good:var(--dsw-alias-state-success-primary,#22c55e);
        --sg-good-soft:var(--dsw-alias-state-success-tertiary,#e6faed);
        --sg-warn:var(--dsw-alias-state-warn-label,#dd8629);
        --sg-warn-soft:var(--dsw-alias-state-warn-tertiary,#fef5e7);
        --sg-danger:var(--dsw-alias-state-error-primary,#ec1313);
        --sg-danger-soft:var(--dsw-alias-interactive-bg-hover-danger,rgba(236,19,19,.05));
        --sg-focus:color-mix(in srgb,var(--sg-accent) 32%,transparent);
        --sg-shadow:0 14px 36px color-mix(in srgb,var(--sg-text) 10%,transparent);
        --sg-ease:cubic-bezier(.22,1,.36,1);
        --sg-fast:140ms;
        --sg-medium:220ms;
        position:relative;isolation:isolate;box-sizing:border-box;width:100%;max-width:1200px;min-width:0;margin:0 auto;padding:18px 20px 36px;
        background:radial-gradient(circle at 8% -8%,color-mix(in srgb,var(--sg-accent) 5%,transparent),transparent 32%),var(--sg-page);color:var(--sg-text);font:14px/1.55 "Segoe UI Variable Text","Segoe UI",ui-sans-serif,system-ui,-apple-system,"Microsoft YaHei",sans-serif;
        letter-spacing:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums;
      }
      .sg-memory *{box-sizing:border-box;letter-spacing:0}.sg-memory button,.sg-memory input,.sg-memory select{font:inherit;color:inherit}.sg-memory button,.sg-memory a,.sg-memory input,.sg-memory select,.sg-memory summary{transition:color var(--sg-fast) var(--sg-ease),background-color var(--sg-fast) var(--sg-ease),border-color var(--sg-fast) var(--sg-ease),box-shadow var(--sg-fast) var(--sg-ease),opacity var(--sg-fast) var(--sg-ease),transform var(--sg-fast) var(--sg-ease)}.sg-memory button:active,.sg-memory a:active{transform:scale(.985)}.sg-memory :is(button,a,input,select,summary,[tabindex]):focus-visible{outline:2px solid var(--sg-accent);outline-offset:2px;box-shadow:0 0 0 4px var(--sg-focus)}
      .sg-header{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin-bottom:12px;padding:12px 13px;border:1px solid color-mix(in srgb,var(--sg-accent) 16%,var(--sg-border));border-radius:12px;background:color-mix(in srgb,var(--sg-surface) 84%,transparent);box-shadow:0 8px 24px color-mix(in srgb,var(--sg-text) 6%,transparent)}.sg-brand{display:flex;align-items:center;gap:10px;min-width:0;color:var(--sg-text);text-decoration:none}.sg-brand:hover .sg-logo{transform:translateY(-1px) rotate(-1.5deg)}.sg-logo{width:38px;height:38px;display:block;object-fit:cover;flex:0 0 auto;border-radius:11px;box-shadow:0 5px 14px color-mix(in srgb,var(--sg-accent) 22%,transparent);transition:transform var(--sg-medium) var(--sg-ease)}.sg-brand-copy{display:grid;min-width:0;gap:1px}.sg-brand-name{min-width:0;font-size:15px;font-weight:740;letter-spacing:-.018em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-brand-kicker{color:var(--sg-muted);font-size:11px;white-space:nowrap}.sg-header-usage{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;width:100%;flex-wrap:wrap;color:var(--sg-muted);font-size:11px;line-height:1.4;text-align:right}.sg-usage-count{display:inline-flex;align-items:baseline;gap:4px;padding:4px 8px;border-radius:7px;background:var(--sg-soft)}.sg-usage-number{color:var(--sg-text);font-size:14px;font-weight:760}.sg-header-star{white-space:nowrap;color:var(--sg-accent);text-decoration:none;font-weight:680}.sg-header-star:hover{opacity:.78}
      .sg-icon-button,.sg-back,.sg-quiet-button{border:0;background:transparent;cursor:pointer}.sg-icon-button{width:32px;height:32px;border-radius:6px;font-size:20px}.sg-icon-button:hover,.sg-back:hover,.sg-quiet-button:hover{background:var(--sg-soft);transform:translateY(-1px)}
      .sg-project{display:flex;align-items:center;gap:7px;min-width:0;margin:0 0 9px;color:var(--sg-muted);font-size:12px}.sg-project-label{flex:0 0 auto}.sg-project-select{min-width:0;max-width:100%;padding:3px 22px 3px 5px;border:0;border-radius:5px;background:transparent;color:var(--sg-text);font-weight:620;cursor:pointer;text-overflow:ellipsis}
      .sg-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:22px;padding:4px;border:1px solid var(--sg-border);border-radius:11px;background:color-mix(in srgb,var(--sg-surface) 58%,transparent)}.sg-tab{position:relative;min-width:0;padding:9px 6px;border:0;border-radius:7px;background:transparent;color:var(--sg-muted);cursor:pointer;white-space:nowrap}.sg-tab:hover{color:var(--sg-text);background:color-mix(in srgb,var(--sg-soft) 70%,transparent)}.sg-tab.active{color:var(--sg-accent);background:var(--sg-surface);font-weight:720;box-shadow:0 3px 12px color-mix(in srgb,var(--sg-text) 7%,transparent)}.sg-tab.active:after{content:"";position:absolute;left:32%;right:32%;bottom:3px;height:2px;border-radius:2px;background:var(--sg-accent)}
      .sg-alert{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:11px 12px;margin:0 0 18px;border:1px solid color-mix(in srgb,var(--sg-warn) 28%,var(--sg-border));border-radius:8px;background:var(--sg-warn-soft);text-align:left;cursor:pointer}.sg-alert-mark{color:var(--sg-warn);font-size:17px}.sg-alert-title{font-weight:700}.sg-alert-copy{color:var(--sg-muted);font-size:12px}.sg-chevron{color:var(--sg-muted);font-size:18px}.sg-processing-alert{display:flex;align-items:center;gap:9px;width:100%;padding:11px 12px;margin:0 0 18px;border:1px solid color-mix(in srgb,var(--sg-danger) 34%,var(--sg-border));border-radius:8px;background:var(--sg-danger-soft);color:var(--sg-danger)}.sg-processing-icon{display:inline-grid;place-items:center;width:20px;height:20px;flex:0 0 auto;font-size:19px;font-weight:700;line-height:1;animation:sg-spin 1s linear infinite}.sg-processing-title{display:block;font-weight:720}.sg-processing-copy{display:block;margin-top:2px;color:var(--sg-muted);font-size:12px}@keyframes sg-spin{to{transform:rotate(360deg)}}
      .sg-intro{margin-bottom:17px}.sg-intro h2,.sg-detail-title{margin:0;font-size:19px;line-height:1.28;font-weight:760;letter-spacing:-.025em;text-wrap:balance}.sg-intro p,.sg-detail-subtitle{max-width:65ch;margin:5px 0 0;color:var(--sg-muted);font-size:13px;text-wrap:pretty}.sg-search{position:relative;margin-bottom:7px}.sg-search-mark{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--sg-muted);font-size:16px;pointer-events:none}.sg-search input{width:100%;height:41px;padding:0 12px 0 37px;border:1px solid var(--sg-border);border-radius:9px;background:var(--sg-surface);outline:0}.sg-search input:hover{border-color:color-mix(in srgb,var(--sg-accent) 35%,var(--sg-border))}.sg-search input:focus{border-color:var(--sg-accent);box-shadow:0 0 0 3px var(--sg-focus)}
      .sg-feed{border-top:1px solid var(--sg-border)}.sg-entry{position:relative;width:100%;min-width:0;padding:17px 10px;margin:0 -10px;border:0;border-bottom:1px solid var(--sg-border);border-radius:8px;background:transparent;text-align:left}.sg-entry-button{cursor:pointer}.sg-entry-button:hover{background:color-mix(in srgb,var(--sg-accent) 5%,transparent);transform:translateX(2px)}.sg-entry-button:hover .sg-entry-title{color:var(--sg-accent)}.sg-entry-title{padding-right:22px;font-size:15px;line-height:1.42;font-weight:720;letter-spacing:-.01em}.sg-entry-summary{margin-top:5px;color:var(--sg-text);white-space:pre-wrap}.sg-entry-chevron{position:absolute;right:9px;top:18px;color:var(--sg-muted);font-size:18px}.sg-entry-button:hover .sg-entry-chevron{color:var(--sg-accent);transform:translateX(2px)}.sg-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px;color:var(--sg-muted);font-size:12px}.sg-meta-sep:before{content:"·";margin-right:7px}.sg-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.sg-tag{max-width:100%;padding:3px 8px;border:1px solid var(--sg-border);border-radius:7px;background:var(--sg-soft);color:var(--sg-text);font-size:12px;line-height:1.45;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}.sg-tag-button{cursor:pointer}.sg-tag-button:hover{border-color:var(--sg-accent);color:var(--sg-accent);transform:translateY(-1px)}
      .sg-status{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:5px;font-size:12px;font-weight:650}.sg-status:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}.sg-status.organized{color:var(--sg-good);background:var(--sg-good-soft)}.sg-status.processing{color:var(--sg-accent);background:var(--sg-accent-soft)}.sg-status.waiting{color:var(--sg-muted);background:var(--sg-soft)}.sg-status.failed{color:var(--sg-warn);background:var(--sg-warn-soft)}
      .sg-backbar{display:flex;align-items:center;min-height:35px;margin:-4px 0 13px}.sg-back{display:inline-flex;align-items:center;gap:6px;margin-left:-7px;padding:6px 7px;border-radius:6px;font-weight:650}.sg-detail-header{padding-bottom:16px;border-bottom:1px solid var(--sg-border)}.sg-detail-section{padding:18px 0;border-bottom:1px solid var(--sg-border)}.sg-detail-section:last-child{border-bottom:0}.sg-section-title{margin:0 0 11px;font-size:14px;font-weight:730}.sg-prose{margin:0;white-space:pre-wrap}.sg-facts{margin:0;padding-left:20px}.sg-facts li+li{margin-top:7px}.sg-related-list{display:flex;flex-direction:column}.sg-related{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border:0;border-bottom:1px solid var(--sg-border);background:transparent;text-align:left;cursor:pointer}.sg-related:last-child{border-bottom:0}.sg-related-name{color:var(--sg-accent)}.sg-related-time{flex:0 0 auto;color:var(--sg-muted);font-size:12px}
      .sg-source-label{display:flex;align-items:center;gap:8px}.sg-source-icon{color:var(--sg-muted)}.sg-tech{margin-top:13px}.sg-tech summary{color:var(--sg-muted);font-size:12px;cursor:pointer}.sg-tech-body{margin-top:10px;padding:11px;border-radius:7px;background:var(--sg-soft);font-size:12px}.sg-tech-row{display:grid;grid-template-columns:88px minmax(0,1fr);gap:9px;padding:3px 0}.sg-code{font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.sg-raw-message{padding-top:10px;margin-top:10px;border-top:1px solid var(--sg-border)}
      .sg-result-count{margin:0 0 9px;color:var(--sg-muted);font-size:12px}.sg-result-event{padding:8px 0;border-bottom:1px solid var(--sg-border)}.sg-result-event:last-child{border-bottom:0}.sg-pipeline{display:flex;flex-direction:column}.sg-stage{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:9px 0;border-bottom:1px solid var(--sg-border)}.sg-stage:last-child{border-bottom:0}.sg-stage-value{font-size:12px}.sg-stage-value.done{color:var(--sg-good)}.sg-stage-value.failed{color:var(--sg-danger)}.sg-stage-value.waiting{color:var(--sg-muted)}.sg-lambda-control{display:flex;align-items:center;justify-content:flex-end;gap:7px}.sg-number-input{width:82px;padding:4px 5px;border:1px solid var(--sg-border);border-radius:6px;background:var(--sg-surface);text-align:right}.sg-setting-note{margin:7px 0 11px;color:var(--sg-muted);font-size:12px}.sg-setting-suggestion{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;margin:4px 0 10px;border-radius:7px;background:var(--sg-soft);font-size:12px}.sg-save-button{align-self:flex-end;padding:7px 12px;margin-top:12px;border:0;border-radius:6px;background:var(--sg-accent);color:white;cursor:pointer}.sg-save-button:disabled{opacity:.5;cursor:not-allowed}.sg-safe-note{padding:11px 12px;margin-bottom:12px;border-radius:7px;background:var(--sg-good-soft);color:var(--sg-good);font-weight:650}.sg-error-note{margin:8px 0 0;color:var(--sg-muted);font-size:12px}
      .sg-menu{display:grid;gap:7px}.sg-menu-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:11px;width:100%;padding:12px;border:1px solid transparent;border-radius:10px;background:color-mix(in srgb,var(--sg-surface) 48%,transparent);text-align:left;cursor:pointer}.sg-menu-row:hover{border-color:color-mix(in srgb,var(--sg-accent) 22%,var(--sg-border));background:color-mix(in srgb,var(--sg-accent) 6%,var(--sg-surface));transform:translateY(-1px);box-shadow:0 8px 20px color-mix(in srgb,var(--sg-text) 6%,transparent)}.sg-menu-row:hover .sg-menu-title,.sg-menu-row:hover .sg-chevron{color:var(--sg-accent)}.sg-menu-icon{width:32px;height:32px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--sg-accent) 14%,var(--sg-border));border-radius:8px;background:var(--sg-soft);color:var(--sg-muted);font-weight:700}.sg-menu-title{font-weight:700}.sg-menu-subtitle{color:var(--sg-muted);font-size:12px}.sg-counts{display:flex;gap:22px;padding:5px 0 18px;border-bottom:1px solid var(--sg-border)}.sg-count-value{font-size:22px;font-weight:760;letter-spacing:-.03em}.sg-count-label{color:var(--sg-muted);font-size:12px}.sg-structured-group{padding-top:17px}.sg-raw-group{padding:12px 0;border-bottom:1px solid var(--sg-border)}.sg-raw-group summary{cursor:pointer;font-weight:680}.sg-raw-json{max-height:360px;padding:11px;margin:10px 0 0;overflow:auto;border-radius:7px;background:var(--sg-soft)}
      .sg-import-card{padding:15px;border:1px solid color-mix(in srgb,var(--sg-accent) 22%,var(--sg-border));border-radius:11px;background:color-mix(in srgb,var(--sg-surface) 72%,transparent);box-shadow:0 8px 24px color-mix(in srgb,var(--sg-text) 5%,transparent)}.sg-import-card textarea{width:100%;min-height:270px;padding:11px;border:1px solid var(--sg-border);border-radius:8px;background:var(--sg-page);resize:vertical;outline:0;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}.sg-import-card textarea:focus{border-color:var(--sg-accent);box-shadow:0 0 0 3px var(--sg-focus)}.sg-import-actions{display:flex;align-items:center;gap:10px;margin-top:11px;flex-wrap:wrap}.sg-import-button{padding:8px 13px;border:1px solid var(--sg-accent);border-radius:7px;background:var(--sg-accent);color:#fff;cursor:pointer;font-weight:680}.sg-import-button:disabled{cursor:wait;opacity:.6}.sg-import-hint{margin:8px 0 0;color:var(--sg-muted);font-size:12px}.sg-import-result{margin-top:12px;padding:10px 11px;border-radius:7px;background:var(--sg-good-soft);color:var(--sg-good);font-size:12px}.sg-import-error{margin-top:12px;padding:10px 11px;border-radius:7px;background:var(--sg-danger-soft);color:var(--sg-danger);font-size:12px}
      .sg-import-overlay{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.52);backdrop-filter:blur(2px);animation:sg-view-in var(--sg-medium) var(--sg-ease) both}.sg-import-dialog{width:min(720px,calc(100vw - 28px));max-height:calc(100vh - 36px);overflow:auto;padding:14px;border:1px solid color-mix(in srgb,var(--sg-border) 90%,#fff 10%);border-radius:12px;background:var(--sg-page);box-shadow:0 24px 80px rgba(0,0,0,.42)}.sg-import-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}.sg-import-dialog-title{margin:0;font-size:18px;font-weight:760}.sg-import-step{padding:12px;margin-top:10px;border-radius:9px;background:color-mix(in srgb,var(--sg-surface) 78%,transparent)}.sg-import-step-head{display:flex;align-items:center;gap:9px;margin-bottom:9px}.sg-import-step-num{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:var(--sg-text);color:var(--sg-page);font-weight:760}.sg-import-step-title{font-weight:720}.sg-import-prompt{max-height:185px;padding:10px;overflow:auto;border-radius:7px;background:var(--sg-page);color:var(--sg-muted);font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap}.sg-import-dialog .sg-import-card{padding:0;border:0;box-shadow:none;background:transparent}.sg-import-dialog .sg-import-card textarea{min-height:165px;background:var(--sg-page)}.sg-import-dialog-foot{display:flex;justify-content:flex-end;gap:9px;margin-top:14px}.sg-import-cancel{padding:8px 18px;border:1px solid var(--sg-border);border-radius:7px;background:transparent;cursor:pointer}.sg-import-dialog .sg-import-button{padding:8px 18px}.sg-import-copy{margin-left:auto;padding:6px 11px;border:1px solid var(--sg-border);border-radius:6px;background:var(--sg-page);cursor:pointer;font-size:12px}.sg-import-copy:hover{border-color:var(--sg-accent);color:var(--sg-accent)}.sg-import-loading{color:var(--sg-muted);font-size:12px}.sg-import-preview{display:grid;gap:8px;margin-top:10px}.sg-import-preview-item{padding:10px;border:1px solid var(--sg-border);border-radius:8px;background:var(--sg-page)}.sg-import-preview-title{font-weight:700}.sg-import-preview-meta{display:flex;gap:8px;margin-top:5px;color:var(--sg-muted);font-size:12px}.sg-import-preview-reason{margin-top:5px;font-size:12px}.sg-import-review{display:flex;gap:7px;align-items:flex-start;margin-top:8px;color:var(--sg-warn);font-size:12px}
      .sg-audit{padding:14px 0;border-bottom:1px solid var(--sg-border)}.sg-audit summary{cursor:pointer}.sg-audit-body{margin-top:10px}.sg-audit-evidence{margin-top:9px}.sg-star{padding:14px 0;margin-top:14px;border-top:1px solid var(--sg-border)}.sg-star-actions{display:flex;gap:10px;align-items:center;margin-top:8px}.sg-link{color:var(--sg-accent);text-decoration:none}.sg-quiet-button{padding:5px 7px;border-radius:5px;color:var(--sg-muted);font-size:12px}.sg-pagination{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 0;color:var(--sg-muted);font-size:12px}.sg-page-button{padding:6px 10px;border:1px solid var(--sg-border);border-radius:6px;background:var(--sg-surface);cursor:pointer}.sg-page-button:hover:not(:disabled){border-color:var(--sg-accent);color:var(--sg-accent)}.sg-page-button:disabled{cursor:not-allowed;opacity:.45}.sg-page-error{color:var(--sg-danger)}
      .sg-decay-overview{padding:15px 16px 13px;margin-bottom:12px;border:1px solid color-mix(in srgb,var(--sg-accent) 20%,var(--sg-border));border-radius:12px;background:linear-gradient(145deg,color-mix(in srgb,var(--sg-surface) 88%,transparent),color-mix(in srgb,var(--sg-accent) 4%,var(--sg-surface)));box-shadow:0 8px 24px color-mix(in srgb,var(--sg-text) 5%,transparent)}.sg-decay-title{margin:0;font-size:14px;font-weight:740;letter-spacing:-.012em}.sg-decay-copy{margin:3px 0 12px;color:var(--sg-muted);font-size:12px}.sg-distribution{display:flex;align-items:stretch;gap:4px;min-width:0;overflow-x:auto;padding:2px 0 3px}.sg-level-chip{display:grid;place-items:center;min-width:39px;height:38px;padding:0 10px;border:1px solid color-mix(in srgb,var(--sg-accent) 36%,var(--sg-border));border-radius:7px;font-weight:740;white-space:nowrap;box-shadow:inset 0 1px 0 color-mix(in srgb,var(--sg-surface) 55%,transparent)}.sg-level-chip:hover{transform:translateY(-2px)}.sg-level-chip[data-level="0"],.sg-level-badge[data-level="0"],.sg-layer-item.current[data-level="0"]{background:var(--sg-level-0)}.sg-level-chip[data-level="1"],.sg-level-badge[data-level="1"],.sg-layer-item.current[data-level="1"]{background:var(--sg-level-1)}.sg-level-chip[data-level="2"],.sg-level-badge[data-level="2"],.sg-layer-item.current[data-level="2"]{background:var(--sg-level-2)}.sg-level-chip[data-level="3"],.sg-level-badge[data-level="3"],.sg-layer-item.current[data-level="3"]{background:var(--sg-level-3)}.sg-level-chip[data-level="4"],.sg-level-badge[data-level="4"],.sg-layer-item.current[data-level="4"]{background:var(--sg-level-4)}.sg-level-chip[data-level="5"],.sg-level-badge[data-level="5"],.sg-layer-item.current[data-level="5"]{background:var(--sg-level-5)}.sg-open-chip{min-width:116px;border-style:dashed;background:transparent;color:var(--sg-text);font-weight:650;box-shadow:none}.sg-time-direction{display:flex;align-items:center;gap:9px;margin-top:9px;color:var(--sg-muted);font-size:11px}.sg-time-line{height:1px;flex:1;background:linear-gradient(90deg,var(--sg-border),var(--sg-accent))}.sg-overview-meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:8px;color:var(--sg-muted);font-size:12px}
      .sg-block-list{position:relative;border:1px solid var(--sg-border);border-radius:12px;background:color-mix(in srgb,var(--sg-surface) 56%,transparent);overflow:hidden}.sg-block-header,.sg-block-toggle{display:grid;grid-template-columns:88px 98px minmax(128px,1fr) 116px 24px;align-items:center;gap:8px;width:100%;min-width:0}.sg-block-header{padding:9px 12px;border-bottom:1px solid var(--sg-border);background:color-mix(in srgb,var(--sg-soft) 48%,transparent);color:var(--sg-muted);font-size:11px}.sg-block-unit+.sg-block-unit{border-top:1px solid var(--sg-border)}.sg-block-toggle{padding:11px 12px;border:0;background:transparent;text-align:left;cursor:pointer}.sg-block-toggle:hover,.sg-block-toggle[aria-expanded="true"]{background:color-mix(in srgb,var(--sg-accent) 6%,transparent)}.sg-block-toggle:hover .sg-row-chevron{color:var(--sg-accent);transform:translateX(2px)}.sg-block-toggle[aria-expanded="true"] .sg-row-chevron{color:var(--sg-accent);transform:rotate(180deg)}.sg-level-cell{display:flex;align-items:center;gap:6px;min-width:0}.sg-level-badge{display:inline-grid;place-items:center;min-width:38px;height:25px;padding:0 8px;border:1px solid color-mix(in srgb,var(--sg-accent) 42%,var(--sg-border));border-radius:6px;font-weight:740}.sg-lifted{padding:1px 5px;border:1px solid var(--sg-border);border-radius:5px;color:var(--sg-muted);font-size:10px;white-space:nowrap}.sg-block-name{font-weight:690}.sg-block-distance,.sg-block-turn{color:var(--sg-muted);font-size:12px}.sg-row-chevron{color:var(--sg-muted);font-size:17px;text-align:right;transition:color var(--sg-fast) var(--sg-ease),transform var(--sg-medium) var(--sg-ease)}.sg-open-row{cursor:default}.sg-open-row:hover{background:transparent}.sg-open-badge{display:inline-flex;align-items:center;height:25px;padding:0 8px;border:1px dashed var(--sg-muted);border-radius:6px;white-space:nowrap}.sg-block-expanded{padding:0 10px 11px;transform-origin:top;animation:sg-expand var(--sg-medium) var(--sg-ease) both}.sg-layer-panel{padding:11px;border:1px solid var(--sg-border);border-radius:9px;background:color-mix(in srgb,var(--sg-page) 82%,var(--sg-surface));box-shadow:inset 0 1px 0 color-mix(in srgb,var(--sg-surface) 70%,transparent)}.sg-layer-heading{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px}.sg-layer-heading strong{font-size:13px}.sg-layer-heading span{color:var(--sg-muted);font-size:11px}.sg-layer-stack{display:flex;flex-direction:column;gap:5px}.sg-layer-hover{position:relative}.sg-layer-hover:after{content:"";position:absolute;left:100%;top:0;width:12px;height:100%}.sg-layer-item{position:relative;display:grid;grid-template-columns:39px minmax(0,1fr) 30px;align-items:stretch;min-height:39px;border:1px solid var(--sg-border);border-radius:7px;background:color-mix(in srgb,var(--sg-soft) 55%,transparent);color:var(--sg-muted)}.sg-layer-item:hover{border-color:color-mix(in srgb,var(--sg-accent) 34%,var(--sg-border));transform:translateX(2px)}.sg-layer-item.current{border-color:color-mix(in srgb,var(--sg-accent) 72%,var(--sg-border));color:var(--sg-text);box-shadow:inset 2px 0 0 var(--sg-accent)}.sg-layer-label{display:grid;place-items:center;border-right:1px solid var(--sg-border);font-weight:720;color:inherit}.sg-layer-preview{padding:8px 10px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px}.sg-layer-more{width:30px;border:0;border-left:1px solid transparent;border-radius:0 6px 6px 0;background:transparent;color:inherit;cursor:pointer;font-weight:800;letter-spacing:1px}.sg-layer-more:hover,.sg-layer-more[aria-expanded="true"]{background:color-mix(in srgb,var(--sg-accent) 14%,transparent)}.sg-layer-menu{position:absolute;right:3px;top:34px;z-index:14;min-width:132px;padding:4px;border:1px solid var(--sg-border);border-radius:8px;background:var(--sg-surface);box-shadow:var(--sg-shadow);animation:sg-pop var(--sg-fast) var(--sg-ease) both}.sg-layer-menu button{width:100%;padding:7px 9px;border:0;border-radius:5px;background:transparent;text-align:left;cursor:pointer;white-space:nowrap}.sg-layer-menu button:hover:not(:disabled){background:var(--sg-soft);color:var(--sg-accent)}.sg-layer-menu button:disabled{cursor:not-allowed;opacity:.45}.sg-layer-popover{position:absolute;left:calc(100% + 11px);top:-7px;z-index:12;width:min(360px,46vw);max-height:340px;padding:12px;overflow:auto;border:1px solid color-mix(in srgb,var(--sg-accent) 32%,var(--sg-border));border-radius:10px;background:var(--sg-surface);box-shadow:var(--sg-shadow);visibility:hidden;opacity:0;transform:translateX(-4px);transition:opacity var(--sg-fast) var(--sg-ease),transform var(--sg-fast) var(--sg-ease),visibility var(--sg-fast)}.sg-layer-hover:hover .sg-layer-popover,.sg-layer-item:focus-visible + .sg-layer-popover{visibility:visible;opacity:1;transform:translateX(0)}.sg-layer-popover strong{display:block;margin-bottom:7px}.sg-layer-full{margin:0;white-space:pre-wrap;font:12px/1.55 "Segoe UI Variable Text","Segoe UI",ui-sans-serif,system-ui,-apple-system,"Microsoft YaHei",sans-serif}.sg-inline-error{padding:7px 9px;margin-bottom:7px;border-radius:6px;background:var(--sg-danger-soft);color:var(--sg-danger);font-size:12px}
      .sg-loading{padding:32px 0}.sg-skeleton{position:relative;height:12px;margin:10px 0;overflow:hidden;border-radius:5px;background:var(--sg-soft)}.sg-skeleton:after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 15%,color-mix(in srgb,var(--sg-surface) 80%,transparent) 48%,transparent 82%);transform:translateX(-110%);animation:sg-shimmer 1.35s ease-in-out infinite}.sg-skeleton:nth-child(2){width:72%}.sg-empty{padding:40px 16px;text-align:center;color:var(--sg-muted)}.sg-empty strong{display:block;margin-bottom:5px;color:var(--sg-text);font-size:14px}.sg-error{padding:13px;margin-bottom:16px;border:1px solid color-mix(in srgb,var(--sg-danger) 28%,var(--sg-border));border-radius:9px;background:var(--sg-danger-soft);animation:sg-pop var(--sg-medium) var(--sg-ease) both}.sg-error-title{font-weight:700;color:var(--sg-danger)}.sg-error details{margin-top:7px;font-size:12px}
      .sg-muted{color:var(--sg-muted);font-size:12px}
      .sg-long-tabs{display:flex;gap:4px;width:max-content;margin:0 0 14px;padding:4px;border:1px solid var(--sg-border);border-radius:999px;background:color-mix(in srgb,var(--sg-surface) 62%,transparent)}.sg-long-tabs button{padding:7px 19px;border:0;border-radius:999px;background:transparent;color:var(--sg-muted);cursor:pointer}.sg-long-tabs button.active{background:var(--sg-soft);color:var(--sg-accent)}
      .sg-migration{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;margin:0 0 10px;padding:9px 12px;border:1px solid color-mix(in srgb,var(--sg-accent) 28%,var(--sg-border));border-radius:8px;background:color-mix(in srgb,var(--sg-accent) 7%,transparent);font-size:12px}.sg-migration small{color:var(--sg-muted)}
      .sg-long-explorer{position:relative}.sg-long-explorer.fullscreen{position:fixed;inset:12px;z-index:2147482000;display:flex;flex-direction:column;max-width:none;padding:18px;border:1px solid var(--sg-border);border-radius:12px;background:var(--sg-page);box-shadow:0 24px 80px rgba(0,0,0,.48)}.sg-long-explorer.fullscreen .sg-long-layout{flex:1;height:auto;min-height:0}.sg-long-explorer.fullscreen .sg-long-tabs{flex:0 0 auto}.sg-long-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:8px}.sg-long-toolbar .sg-search{flex:1;margin:0}.sg-toolbar-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:39px;padding:0 13px;border:1px solid var(--sg-border);border-radius:7px;background:var(--sg-surface);color:var(--sg-text);cursor:pointer;white-space:nowrap}.sg-toolbar-button:hover,.sg-toolbar-button[aria-expanded="true"]{border-color:var(--sg-accent);color:var(--sg-accent)}.sg-toolbar-count{color:var(--sg-muted);font-size:11px;white-space:nowrap}.sg-long-layout{display:grid;grid-template-columns:minmax(0,1.72fr) minmax(280px,.9fr);height:min(680px,calc(100vh - 320px));min-height:480px;border:1px solid var(--sg-border);border-radius:9px;overflow:hidden;background:color-mix(in srgb,var(--sg-page) 74%,transparent)}.sg-summary-layout{grid-template-columns:minmax(0,1fr)}
      .sg-filterbar{display:flex;gap:7px;margin:0 0 8px;padding:8px;border:1px solid var(--sg-border);border-radius:7px;background:color-mix(in srgb,var(--sg-surface) 62%,transparent);flex-wrap:wrap}.sg-filterbar select{min-width:112px;padding:6px 25px 6px 8px;border:1px solid var(--sg-border);border-radius:6px;background:var(--sg-surface);color:var(--sg-text);font-size:11px}.sg-active-filter-count{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--sg-accent);color:white;font-size:10px}
      .sg-graph-canvas{position:relative;min-width:0;overflow:hidden;background-image:radial-gradient(circle at center,color-mix(in srgb,var(--sg-accent) 6%,transparent),transparent 62%)}.sg-cytoscape{position:absolute;inset:0 0 38px;min-height:0}.sg-graph-zoom{position:absolute;z-index:7;top:12px;right:12px;display:grid;grid-template-columns:30px minmax(86px,124px) 30px;align-items:center;gap:5px;padding:5px;border:1px solid color-mix(in srgb,var(--sg-accent) 20%,var(--sg-border));border-radius:7px;background:color-mix(in srgb,var(--sg-surface) 94%,transparent);box-shadow:0 6px 18px color-mix(in srgb,var(--sg-text) 10%,transparent);backdrop-filter:blur(8px)}.sg-graph-zoom button{display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--sg-text);font-size:20px;line-height:1;cursor:pointer}.sg-graph-zoom button:hover:not(:disabled){background:var(--sg-soft);color:var(--sg-accent)}.sg-graph-zoom button:disabled{cursor:default;opacity:.35}.sg-graph-zoom input{width:100%;min-width:0;height:18px;margin:0;accent-color:var(--sg-accent);cursor:pointer}.sg-graph-legend{position:absolute;z-index:5;left:14px;bottom:10px;display:flex;gap:14px;flex-wrap:wrap;color:var(--sg-muted);font-size:11px}.sg-graph-legend span{display:flex;align-items:center;gap:5px}.sg-graph-legend i{width:9px;height:9px;border-radius:50%}.sg-node-bubble{position:absolute;z-index:8;width:min(310px,42%);padding:12px;border:1px solid color-mix(in srgb,var(--sg-accent) 38%,var(--sg-border));border-radius:9px;background:color-mix(in srgb,var(--sg-surface) 94%,transparent);box-shadow:0 14px 34px rgba(0,0,0,.3);transform:translate(35px,-50%)}.sg-node-bubble.flip{transform:translate(calc(-100% - 35px),-50%)}.sg-node-bubble h3{margin:0;font-size:14px}.sg-node-bubble-head,.sg-node-bubble-foot{display:flex;align-items:center;justify-content:space-between;gap:8px}.sg-node-bubble-state{margin:7px 0;color:var(--sg-muted);font-size:11px}.sg-node-bubble ul{margin:7px 0;padding-left:17px;font-size:11px;line-height:1.55}.sg-node-bubble-foot{padding-top:8px;border-top:1px solid var(--sg-border);color:var(--sg-muted);font-size:11px}.sg-node-bubble button{border:0;background:transparent;color:var(--sg-accent);cursor:pointer;font-weight:680}.sg-node-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.sg-node-tag{padding:2px 7px;border-radius:999px;background:var(--sg-accent-soft);color:var(--sg-accent);font-size:11px}.sg-graph-a11y{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      .sg-long-detail{min-width:0;padding:16px;overflow:auto;border-left:1px solid var(--sg-border);background:color-mix(in srgb,var(--sg-surface) 70%,transparent)}.sg-placeholder-detail{display:grid;place-items:center;color:var(--sg-muted);text-align:center}.sg-long-detail h2{margin:0;font-size:17px}.sg-long-detail section{padding:13px 0;border-top:1px solid var(--sg-border)}.sg-long-detail section:first-of-type{margin-top:13px}.sg-long-detail h3{margin:0 0 8px;font-size:13px}.sg-long-detail ul{margin:0;padding-left:18px;font-size:12px;line-height:1.65}.sg-detail-copy{margin:0;color:var(--sg-muted);font-size:12px;line-height:1.65;white-space:pre-wrap}.sg-node-head{display:flex;align-items:center;gap:10px}.sg-node-avatar{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;color:white;font-size:20px}.sg-status-dot{color:var(--sg-good);font-size:12px}.sg-relation-row{display:grid;grid-template-columns:68px 1fr auto;gap:7px;padding:7px 0;border-bottom:1px solid color-mix(in srgb,var(--sg-border) 65%,transparent);font-size:12px}.sg-relation-row span,.sg-relation-row small{color:var(--sg-muted)}.sg-support-event{display:flex;align-items:center;justify-content:space-between;width:100%;margin:5px 0;padding:9px;border:1px solid var(--sg-border);border-radius:7px;background:transparent;color:var(--sg-text);text-align:left;cursor:pointer}.sg-support-event:hover{border-color:var(--sg-accent)}
      .sg-timeline-layout{grid-template-columns:minmax(420px,1.35fr) minmax(320px,.9fr)}.sg-timeline{position:relative;padding:10px 20px 18px;overflow:auto}.sg-time-group{position:relative}.sg-time-group>h3{margin:7px 0 8px;padding-left:17px;font-size:13px}.sg-time-group:before{content:"";position:absolute;left:5px;top:30px;bottom:-12px;width:1px;background:var(--sg-border)}.sg-timeline-card{position:relative;display:grid;grid-template-columns:112px minmax(0,1fr) auto;gap:12px;width:100%;margin:0 0 8px;padding:12px 14px;border:1px solid var(--sg-border);border-radius:8px;background:color-mix(in srgb,var(--sg-surface) 62%,transparent);color:var(--sg-text);text-align:left;cursor:pointer}.sg-timeline-card:hover,.sg-timeline-card.selected{border-color:var(--sg-accent);background:color-mix(in srgb,var(--sg-accent) 7%,var(--sg-surface))}.sg-timeline-dot{position:absolute;left:-19px;top:17px;width:9px;height:9px;border:2px solid var(--sg-accent);border-radius:50%;background:var(--sg-page)}.sg-event-clock{font-size:11px;white-space:normal}.sg-event-clock small{display:block;margin-top:3px;color:var(--sg-muted);line-height:1.35}.sg-event-title-row{display:flex;align-items:center;gap:7px;min-width:0}.sg-event-title-row strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sg-event-main p{margin:5px 0 7px;color:var(--sg-muted);font-size:12px;line-height:1.4;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.sg-type-badge{display:inline-flex;align-items:center;width:max-content;padding:2px 7px;border:1px solid color-mix(in srgb,var(--sg-accent) 30%,var(--sg-border));border-radius:5px;background:color-mix(in srgb,var(--sg-accent) 10%,transparent);color:var(--sg-accent);font-size:10px}.sg-event-status{display:inline-flex;width:max-content;height:max-content;padding:3px 8px;border:1px solid var(--sg-border);border-radius:999px;color:var(--sg-muted);font-size:10px;white-space:nowrap}.sg-event-status.occurred{border-color:color-mix(in srgb,var(--sg-good) 40%,var(--sg-border));background:var(--sg-good-soft);color:var(--sg-good)}.sg-event-status.planned,.sg-event-status.ongoing{border-color:color-mix(in srgb,var(--sg-accent) 35%,var(--sg-border));color:var(--sg-accent)}.sg-event-status.cancelled{color:var(--sg-danger)}.sg-event-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:7px}.sg-event-popover{position:fixed;z-index:2147483000;width:min(380px,calc(100vw - 24px));max-height:min(72vh,620px);overflow:auto;border:1px solid color-mix(in srgb,var(--sg-accent) 38%,var(--sg-border));border-radius:10px;background:var(--sg-page);box-shadow:0 18px 50px rgba(0,0,0,.38)}.sg-event-popover .sg-long-detail{border:0;background:transparent}.sg-popover-close{position:absolute;right:8px;top:8px;z-index:2;width:27px;height:27px;border:0;border-radius:6px;background:var(--sg-soft);cursor:pointer}.sg-time-grid{display:grid;grid-template-columns:92px 1fr;margin:0;border:1px solid var(--sg-border);border-radius:7px;overflow:hidden;font-size:11px}.sg-time-grid dt,.sg-time-grid dd{margin:0;padding:7px 8px;border-bottom:1px solid var(--sg-border)}.sg-time-grid dt{color:var(--sg-muted);background:var(--sg-soft)}.sg-time-grid dt:nth-last-of-type(1),.sg-time-grid dd:nth-last-of-type(1){border-bottom:0}.sg-entity-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid var(--sg-border);border-radius:999px;background:transparent;color:var(--sg-text);font-size:11px;cursor:pointer}.sg-evidence-row{display:flex;justify-content:space-between;gap:8px;padding:6px 0;color:var(--sg-muted);font-size:11px}.sg-evidence-row code{max-width:180px;overflow:hidden;text-overflow:ellipsis}.sg-source-button{width:100%;padding:9px;border:1px solid color-mix(in srgb,var(--sg-accent) 42%,var(--sg-border));border-radius:7px;background:transparent;color:var(--sg-accent);cursor:pointer}
      .sg-view{min-width:0;animation:sg-view-in var(--sg-medium) var(--sg-ease) both}.sg-long-tabs{border-radius:10px}.sg-long-tabs button{border-radius:7px}.sg-long-tabs button:hover{color:var(--sg-text)}.sg-long-tabs button.active{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sg-accent) 16%,var(--sg-border))}.sg-toolbar-button:hover,.sg-source-button:hover,.sg-primary-link:hover{transform:translateY(-1px);box-shadow:0 7px 18px color-mix(in srgb,var(--sg-accent) 14%,transparent)}.sg-long-layout{border-radius:12px;box-shadow:0 10px 28px color-mix(in srgb,var(--sg-text) 6%,transparent)}.sg-long-explorer.fullscreen{animation:sg-fullscreen-in var(--sg-medium) var(--sg-ease) both}.sg-node-bubble{animation:sg-fade var(--sg-medium) var(--sg-ease) both;box-shadow:var(--sg-shadow)}.sg-event-popover{animation:sg-pop var(--sg-medium) var(--sg-ease) both;box-shadow:var(--sg-shadow)}.sg-long-detail{animation:sg-panel-in var(--sg-medium) var(--sg-ease) both}.sg-timeline-card:hover{transform:translateX(2px);box-shadow:0 7px 18px color-mix(in srgb,var(--sg-text) 6%,transparent)}.sg-timeline-card.selected{box-shadow:inset 3px 0 0 var(--sg-accent)}.sg-support-event:hover,.sg-entity-pill:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--sg-accent) 5%,transparent)}
      @keyframes sg-view-in{from{opacity:0}to{opacity:1}}
      @keyframes sg-expand{from{opacity:0;transform:translateY(-5px) scale(.992)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes sg-pop{from{opacity:0;transform:translateY(5px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes sg-fade{from{opacity:0}to{opacity:1}}
      @keyframes sg-panel-in{from{opacity:0;transform:translateX(7px)}to{opacity:1;transform:translateX(0)}}
      @keyframes sg-fullscreen-in{from{opacity:0;transform:scale(.99)}to{opacity:1;transform:scale(1)}}
      @keyframes sg-shimmer{to{transform:translateX(110%)}}
      @media (min-width:720px){.sg-header{grid-template-columns:minmax(0,1fr) auto;align-items:center}.sg-header-usage{width:auto}.sg-brand-kicker{display:block}}
      @media (max-width:900px){.sg-long-layout{grid-template-columns:1fr;height:auto;max-height:none}.sg-long-explorer.fullscreen{inset:4px;padding:10px}.sg-long-explorer.fullscreen .sg-long-layout{overflow:auto}.sg-graph-canvas{height:520px}.sg-long-detail{max-height:520px;border-top:1px solid var(--sg-border);border-left:0}.sg-timeline{max-height:520px}.sg-toolbar-count{display:none}.sg-node-bubble{width:min(300px,72%)}}
      @media (max-width:620px){.sg-long-toolbar{flex-wrap:wrap}.sg-long-toolbar .sg-search{flex-basis:100%}.sg-toolbar-button{flex:1}.sg-timeline-card{grid-template-columns:78px minmax(0,1fr)}.sg-timeline-card>.sg-event-status{grid-column:2}.sg-node-bubble{left:50%!important;top:auto!important;bottom:45px;width:calc(100% - 24px);transform:translateX(-50%)!important}}
      @media (max-width:860px){.sg-layer-hover:after{display:none}.sg-layer-popover{position:relative;left:auto;top:auto;width:auto;max-height:280px;margin:5px 0 1px;display:none;transform:none}.sg-layer-hover:hover .sg-layer-popover,.sg-layer-item:focus-visible + .sg-layer-popover{display:block;transform:none}}
      @media (max-width:560px){.sg-memory{padding:12px 12px 26px}.sg-brand-name{font-size:14px}.sg-tabs{margin-left:-2px;margin-right:-2px}.sg-tab{padding-left:0;padding-right:0}.sg-alert{grid-template-columns:auto minmax(0,1fr)}.sg-alert>.sg-chevron{display:none}.sg-tech-row{grid-template-columns:1fr;gap:1px}.sg-counts{gap:16px}.sg-entry-title{font-size:14px}.sg-block-header{display:none}.sg-block-toggle{grid-template-columns:76px minmax(76px,1fr) 24px;gap:6px}.sg-block-turn{grid-column:1/3}.sg-block-distance{display:none}.sg-layer-heading{display:block}.sg-layer-heading span{display:block;margin-top:2px}}
      .sg-decay-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.sg-conversation{display:flex;align-items:center;justify-content:flex-end;gap:5px;min-width:0;color:var(--sg-muted);font-size:11px}.sg-conversation select{min-width:0;max-width:230px;padding:3px 21px 3px 6px;border:1px solid var(--sg-border);border-radius:5px;background:var(--sg-surface);font-size:11px;text-overflow:ellipsis}.sg-distribution{scrollbar-width:none}.sg-distribution::-webkit-scrollbar{display:none}.sg-distribution-rail{display:block;width:100%;height:14px;margin:4px 0 0;accent-color:var(--sg-accent);cursor:pointer}.sg-distribution-rail:disabled{cursor:default;opacity:.38}.sg-layer-hover:after{display:none}.sg-layer-more-placeholder{width:30px}.sg-layer-popover{position:fixed!important;left:0;top:0;z-index:2147483000;width:min(390px,calc(100vw - 24px));max-height:min(70vh,520px);display:block!important;margin:0;overflow:auto;visibility:visible!important;opacity:1!important;transform:none!important;transition:opacity .1s ease;border:1px solid color-mix(in srgb,var(--sg-accent) 38%,var(--sg-border));background:var(--sg-surface);color:var(--sg-text);box-shadow:0 18px 50px rgba(0,0,0,.38)}
      .sg-support-card{padding:14px 0;border-bottom:1px solid var(--sg-border)}.sg-support-card h3{margin:0;font-size:14px}.sg-support-card p{margin:4px 0 10px;color:var(--sg-muted);font-size:12px}.sg-primary-link{display:inline-flex;padding:7px 11px;border:1px solid var(--sg-accent);border-radius:6px;background:var(--sg-accent);color:#fff;text-decoration:none;cursor:pointer}.sg-check{display:flex;align-items:flex-start;gap:8px;margin:9px 0;color:var(--sg-text);font-size:12px}.sg-check input{margin-top:3px}.sg-privacy-note{padding:10px 11px;margin:12px 0;border-radius:7px;background:var(--sg-good-soft);color:var(--sg-good);font-size:12px}.sg-footer{margin-top:24px;padding-top:13px;border-top:1px solid var(--sg-border);text-align:center;color:var(--sg-muted);font-size:12px}.sg-footer button{padding:2px 4px;border:0;background:transparent;color:var(--sg-accent);cursor:pointer}.sg-virtual-note{margin-top:6px;color:var(--sg-muted);font-size:11px}
      @media (max-width:560px){.sg-decay-head{align-items:flex-start;flex-direction:column}.sg-conversation{width:100%;justify-content:flex-start}.sg-conversation select{max-width:100%;flex:1}}
      @media (prefers-reduced-motion:reduce){.sg-memory *,.sg-memory *:before,.sg-memory *:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}.sg-processing-icon{animation:none}.sg-skeleton:after{display:none}}
    `

    const citationCss = `
      .sg-answer-citations{display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:start;gap:7px 9px;margin-top:14px;font-size:13px;line-height:22px;color:var(--dsw-alias-label-secondary,#61666b)}
      .sg-answer-citations-label{color:var(--dsw-alias-label-tertiary,#8a8f98);white-space:nowrap}
      .sg-answer-citations-list{display:flex;flex-wrap:wrap;gap:7px;min-width:0}
      .sg-answer-citation{display:inline-flex;align-items:center;gap:6px;max-width:min(100%,420px);min-width:0;padding:2px 8px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));border-radius:7px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-secondary,#61666b);font:inherit;cursor:pointer}
      .sg-answer-citation:hover{border-color:var(--dsw-alias-state-business-primary,#4176e6);color:var(--dsw-alias-label-primary,#0f1115)}
      .sg-answer-citation:focus-visible,.sg-answer-retrieval-toggle:focus-visible,.sg-retrieved-memory:focus-visible,.sg-citation-close:focus-visible,.sg-citation-disclosure summary:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}
      .sg-answer-citation-kind{flex:0 0 auto;color:var(--dsw-alias-state-business-primary,#4176e6);font-weight:680}
      .sg-answer-citation-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .sg-answer-citation-action{flex:0 0 auto;color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:12px}
      .sg-answer-retrieval{max-width:640px;margin-top:8px;color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:11px;line-height:18px}
      .sg-answer-retrieval-toggle{display:inline-flex;align-items:center;gap:5px;padding:1px 3px;margin-left:-3px;border:0;border-radius:4px;background:transparent;color:inherit;font:inherit;cursor:pointer}
      .sg-answer-retrieval-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-secondary,#61666b)}
      .sg-answer-retrieval-chevron{display:inline-block;font-size:12px;transition:transform 180ms cubic-bezier(.22,1,.36,1)}
      .sg-answer-retrieval-chevron.open{transform:rotate(90deg)}
      .sg-retrieved-panel{max-height:380px;margin-top:6px;padding:7px 0 2px 12px;overflow:auto;border-left:2px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));animation:sg-retrieved-in 180ms cubic-bezier(.22,1,.36,1) both}
      .sg-retrieved-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 8px 5px;color:var(--dsw-alias-label-secondary,#61666b)}
      .sg-retrieved-heading strong{font-size:12px;font-weight:650}.sg-retrieved-heading span{color:var(--dsw-alias-label-tertiary,#8a8f98)}
      .sg-retrieved-group{padding-top:7px;border-top:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1))}.sg-retrieved-group+.sg-retrieved-group{margin-top:8px}
      .sg-retrieved-group-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 8px 4px;color:var(--dsw-alias-label-secondary,#61666b)}.sg-retrieved-group-head strong{font-size:12px;font-weight:680}.sg-retrieved-group-head span{color:var(--dsw-alias-label-tertiary,#8a8f98);font-variant-numeric:tabular-nums}
      .sg-retrieved-list{margin:0;padding:0;list-style:none}
      .sg-retrieved-memory{display:grid;grid-template-columns:20px auto minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;padding:7px 8px;border:0;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));background:transparent;color:var(--dsw-alias-label-secondary,#61666b);font:inherit;text-align:left;cursor:pointer}
      .sg-retrieved-memory:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-primary,#0f1115)}
      .sg-retrieved-index{color:var(--dsw-alias-label-tertiary,#8a8f98);font-variant-numeric:tabular-nums;text-align:right}.sg-retrieved-memory-kind{color:var(--dsw-alias-label-tertiary,#8a8f98);font-weight:650}.sg-retrieved-memory-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.sg-retrieved-memory-state{color:var(--dsw-alias-label-tertiary,#8a8f98);white-space:nowrap}
      .sg-retrieved-unavailable{padding:6px 8px;color:var(--dsw-alias-label-tertiary,#8a8f98)}
      @keyframes sg-retrieved-in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}
      .sg-citation-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.46);backdrop-filter:blur(2px)}
      .sg-citation-dialog{--sg-page:var(--dsw-alias-bg-layer-2,#fff);--sg-surface:var(--dsw-specific-input-major,var(--sg-page));--sg-soft:var(--dsw-alias-interactive-bg-hover-solid,#f1f3f5);--sg-text:var(--dsw-alias-label-primary,#0f1115);--sg-muted:var(--dsw-alias-label-secondary,#61666b);--sg-border:var(--dsw-alias-border-l2,rgba(0,0,0,.1));--sg-accent:var(--dsw-alias-state-business-primary,#4176e6);width:min(760px,calc(100vw - 28px));max-height:calc(100vh - 36px);overflow:auto;border:1px solid var(--sg-border);border-radius:13px;background:var(--sg-page);color:var(--sg-text);box-shadow:0 24px 80px rgba(0,0,0,.34);font:13px/1.6 "Segoe UI Variable Text","Segoe UI",ui-sans-serif,system-ui,-apple-system,"Microsoft YaHei",sans-serif}
      .sg-citation-dialog *{box-sizing:border-box}
      .sg-citation-dialog-head{position:sticky;top:0;z-index:3;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 17px 13px;border-bottom:1px solid var(--sg-border);background:var(--sg-page)}
      .sg-citation-dialog-kicker{color:var(--sg-accent);font-size:12px;font-weight:700}
      .sg-citation-dialog-title{margin:2px 0 0;font-size:18px;line-height:1.35}
      .sg-citation-close{width:30px;height:30px;flex:0 0 auto;border:0;border-radius:7px;background:transparent;color:var(--sg-muted);font-size:20px;cursor:pointer}
      .sg-citation-close:hover{background:var(--sg-soft)}
      .sg-citation-dialog-body{display:grid;gap:14px;padding:16px 17px 19px}
      .sg-citation-context-note{margin:0;padding:9px 11px;border-left:3px solid color-mix(in srgb,var(--sg-accent) 58%,var(--sg-border));background:color-mix(in srgb,var(--sg-accent) 6%,var(--sg-page));color:var(--sg-muted);font-size:12px}
      .sg-citation-section{display:grid;gap:8px;min-width:0}
      .sg-citation-section-title{margin:0;font-size:13px;font-weight:720}
      .sg-citation-copy{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
      .sg-citation-muted{color:var(--sg-muted)}
      .sg-citation-facts{display:grid;gap:7px;margin:0;padding:0;list-style:none}
      .sg-citation-fact{padding:8px 10px;border-radius:7px;background:var(--sg-soft)}
      .sg-citation-related{display:grid;gap:7px}
      .sg-citation-disclosure{border-top:1px solid var(--sg-border)}
      .sg-citation-disclosure:last-child{border-bottom:1px solid var(--sg-border)}
      .sg-citation-disclosure summary{padding:9px 2px;color:var(--sg-muted);cursor:pointer;font-weight:650}
      .sg-citation-disclosure[open] summary{color:var(--sg-text)}
      .sg-citation-disclosure-body{padding:1px 2px 11px}
      .sg-citation-events{display:grid;gap:7px}
      .sg-citation-event{padding:8px 10px;border-radius:7px;background:var(--sg-soft)}
      .sg-citation-event strong{display:block}
      .sg-citation-event p{margin:2px 0 0;color:var(--sg-muted)}
      .sg-citation-messages{display:grid;gap:8px}
      .sg-citation-message{padding:9px 10px;border-left:3px solid var(--sg-border);background:color-mix(in srgb,var(--sg-soft) 72%,transparent);white-space:pre-wrap;overflow-wrap:anywhere}
      .sg-citation-message-role{display:block;margin-bottom:3px;color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:11px;text-transform:uppercase}
      .sg-citation-tech{font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-tertiary,#8a8f98);overflow-wrap:anywhere;white-space:pre-wrap}
      .sg-citation-layers{display:grid;gap:6px}
      .sg-citation-layer{display:grid;grid-template-columns:42px minmax(0,1fr);border:1px solid var(--sg-border);border-radius:7px;background:var(--sg-soft);color:var(--sg-muted)}
      .sg-citation-layer.adopted{border-color:var(--sg-accent);background:color-mix(in srgb,var(--sg-accent) 8%,var(--sg-page));color:var(--sg-text);box-shadow:inset 3px 0 0 var(--sg-accent)}
      .sg-citation-layer.retrieved{border-color:color-mix(in srgb,var(--sg-muted) 48%,var(--sg-border));background:color-mix(in srgb,var(--sg-muted) 5%,var(--sg-page));color:var(--sg-text);box-shadow:inset 3px 0 0 color-mix(in srgb,var(--sg-muted) 52%,transparent)}
      .sg-citation-layer-level{display:grid;place-items:center;border-right:1px solid var(--sg-border);font-weight:740}
      .sg-citation-layer-content{min-width:0;padding:8px 10px;white-space:pre-wrap;overflow-wrap:anywhere}
      .sg-citation-layer:not(.adopted):not(.retrieved) .sg-citation-layer-content{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .sg-citation-layer-state{display:block;margin-top:2px;color:var(--sg-accent);font-size:11px;font-weight:700}
      .sg-citation-layer-state.retrieved{color:var(--sg-muted)}
      .sg-citation-graph{display:grid;gap:7px}
      .sg-citation-graph-frame{position:relative;height:320px;overflow:hidden;border:1px solid var(--sg-border);border-radius:9px;background:radial-gradient(circle at center,color-mix(in srgb,var(--sg-accent) 7%,transparent),transparent 65%),var(--sg-page)}
      .sg-citation-graph-canvas{position:absolute;inset:0}
      .sg-citation-graph-note{margin:0;color:var(--sg-muted);font-size:11px}
      .sg-citation-graph-fallback{display:grid;gap:6px;padding:12px}
      .sg-citation-relation{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:center;padding:7px 9px;border-radius:7px;background:var(--sg-soft)}
      .sg-citation-relation span{color:var(--sg-muted);text-align:center}
      .sg-citation-graph-a11y{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      .sg-citation-loading,.sg-citation-error{padding:12px;border-radius:8px;background:var(--sg-soft)}
      .sg-citation-error{color:var(--dsw-alias-state-error-primary,#c42b1c)}
      @media(max-width:560px){.sg-answer-citations{grid-template-columns:1fr}.sg-answer-citations-list{display:grid}.sg-answer-citation{max-width:100%;width:100%}.sg-retrieved-memory{grid-template-columns:20px auto minmax(0,1fr)}.sg-retrieved-memory-state{grid-column:3}.sg-citation-overlay{padding:8px}.sg-citation-dialog{width:100%;max-height:calc(100vh - 16px)}.sg-citation-graph-frame{height:280px}}
    `

    function api(path, params, options) {
      const query = new URLSearchParams(params || {})
      const url = '/api/stratagate/' + path + (query.size ? '?' + query : '')
      let attempt = 0
      const request = () => fetch(url, { cache: 'no-store', ...options })
        .then((res) => res.json().catch(() => ({})).then((data) => {
          if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status)
          return data
        }))
        .catch((reason) => {
          const message = String(reason?.message || reason)
          const networkFailure = reason instanceof TypeError || message.includes('Failed to fetch')
          if (networkFailure && !options?.method && attempt < 2) {
            attempt += 1
            return new Promise((resolve) => window.setTimeout(resolve, attempt * 300)).then(request)
          }
          throw new Error(message + '（' + path + '）')
        })
      return request()
    }

    function citationKindLabel(citation) {
      if (citation.kind === 'event') return 'Event'
      if (citation.kind === 'graph') return '知识图谱'
      return 'Block'
    }

    function citationActionLabel(citation) {
      if (citation.kind === 'block' && citation.expanded && Number.isInteger(citation.level)) return '展开到 L' + citation.level
      if (citation.kind === 'block' && Number.isInteger(citation.level)) return 'L' + citation.level
      if (citation.expanded) return '已展开'
      if (String(citation.evidenceRef || '').startsWith('raw:')) return '原始片段'
      return ''
    }

    function retrievalGroupLabel(index) {
      const chineseNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
      return '第' + (chineseNumerals[index] || index + 1) + '次检索'
    }

    function selectMemoryCitations(owner) {
      const data = owner.turn.data.get(MEMORY_CITATIONS_KIND)
      if (!data || !Array.isArray(data.entries)) return null
      const selected = []
      const seen = new Set()
      const retrievalGroups = []
      const seenGroups = new Set()
      let retrievedCount = 0
      for (const entry of data.entries) {
        if (entry.seq > owner.seq || !Array.isArray(entry.citations)) continue
        const groupCount = Number.isInteger(entry.retrievedCount) && entry.retrievedCount >= 0 ? entry.retrievedCount : entry.citations.length
        const groupKey = String(entry.batchId || 'legacy:' + entry.seq)
        if (!seenGroups.has(groupKey)) {
          seenGroups.add(groupKey)
          retrievedCount += groupCount
          retrievalGroups.push({
            batchId: entry.batchId,
            sequence: Number.isInteger(entry.retrievalSequence) ? entry.retrievalSequence : null,
            seq: entry.seq,
            count: groupCount,
            memories: (Array.isArray(entry.retrievedMemories) ? entry.retrievedMemories : []).map((memory) => ({ ...memory, namespace: entry.namespace })),
          })
        }
        for (const citation of entry.citations) {
          const key = [citation.detailKind, citation.id, citation.evidenceRef].join(':')
          if (seen.has(key)) continue
          seen.add(key)
          selected.push({ ...citation, namespace: entry.namespace })
        }
      }
      retrievalGroups.sort((left, right) => left.sequence !== null && right.sequence !== null
        ? left.sequence - right.sequence
        : left.sequence !== null
          ? -1
          : right.sequence !== null
            ? 1
            : left.seq - right.seq)
      return selected.length === 0 && retrievalGroups.length === 0 ? null : { citations: selected, retrievedCount, retrievalGroups }
    }

    function parseToolResultJson(event) {
      if (event.type !== 'tool/result') return null
      const result = event.data?.message?.content?.[0]
      if (!result || result.isError === true || !Array.isArray(result.content)) return null
      const text = result.content.find((block) => block?.type === 'text' && typeof block.text === 'string')?.text
      if (!text) return null
      try {
        return JSON.parse(text)
      } catch {
        return null
      }
    }

    function parseMemoryRecordUseResult(event, callIds) {
      const callId = String(event.data?.message?.source?.callId || '')
      if (!callIds.has(callId)) return null
      try {
        const value = parseToolResultJson(event)
        if (value?.recorded !== true || typeof value.namespace !== 'string' || !Array.isArray(value.citations)) return null
        const retrievedCount = Number.isInteger(value.retrievedCount) && value.retrievedCount >= value.citations.length
          ? value.retrievedCount
          : value.citations.length
        const retrievedMemories = Array.isArray(value.retrievedMemories) ? value.retrievedMemories : []
        return {
          namespace: value.namespace,
          batchId: typeof value.batchId === 'string' ? value.batchId : undefined,
          retrievalSequence: Number.isInteger(value.retrievalSequence) ? value.retrievalSequence : undefined,
          citations: value.citations,
          retrievedCount,
          retrievedMemories,
        }
      } catch {
        return null
      }
    }

    const memoryCitationsDefinition = {
      kind: MEMORY_CITATIONS_KIND,
      match: (event) => {
        if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
        if (event.type === 'stratagate/memory-citations') return { id: String(event.data.turn), role: 'update' }
        if (event.type === 'tool/call' && (event.data.name === 'memory_record_use' || MEMORY_RETRIEVAL_TOOLS.has(event.data.name))) return { id: String(event.data.turn), role: 'update' }
        if (event.type === 'tool/result') return { id: String(event.data.turn), role: 'update' }
        return null
      },
      start: (_context, match) => ({ turn: match.event.data.turn, callIds: new Set(), retrievalCallIds: new Map(), batchOrder: new Map(), entries: [] }),
      update: (context, match) => {
        if (match.event.type === 'stratagate/memory-citations') return {
          ...context.state,
          entries: [...context.state.entries, {
            seq: match.event.seq,
            namespace: match.event.data.namespace,
            batchId: match.event.data.batchId,
            retrievalSequence: match.event.data.retrievalSequence,
            citations: match.event.data.citations,
            retrievedCount: match.event.data.retrievedCount,
            retrievedMemories: match.event.data.retrievedMemories,
          }],
        }
        if (match.event.type === 'tool/call') {
          const callIds = new Set(context.state.callIds)
          const retrievalCallIds = new Map(context.state.retrievalCallIds)
          const callId = String(match.event.data.callId)
          if (match.event.data.name === 'memory_record_use') callIds.add(callId)
          if (MEMORY_RETRIEVAL_TOOLS.has(match.event.data.name)) retrievalCallIds.set(callId, match.event.seq)
          return { ...context.state, callIds, retrievalCallIds }
        }
        const resultCallId = String(match.event.data?.message?.source?.callId || '')
        if (context.state.retrievalCallIds.has(resultCallId)) {
          const value = parseToolResultJson(match.event)
          if (typeof value?.batchId !== 'string') return context.state
          const batchOrder = new Map(context.state.batchOrder)
          batchOrder.set(value.batchId, context.state.retrievalCallIds.get(resultCallId))
          return { ...context.state, batchOrder }
        }
        const result = parseMemoryRecordUseResult(match.event, context.state.callIds)
        return result === null ? context.state : {
          ...context.state,
          entries: [...context.state.entries, {
            seq: match.event.seq,
            namespace: result.namespace,
            batchId: result.batchId,
            retrievalSequence: context.state.batchOrder.get(result.batchId) ?? result.retrievalSequence,
            citations: result.citations,
            retrievedCount: result.retrievedCount,
            retrievedMemories: result.retrievedMemories,
          }],
        }
      },
      buildLocationData: (context, scope) => scope !== 'turn' || context.state === undefined ? null : {
        kind: 'turn',
        turn: context.state.turn,
        key: MEMORY_CITATIONS_KIND,
        value: { entries: context.state.entries },
      },
    }

    function ensureCitationStyles() {
      if (typeof document === 'undefined' || document.querySelector('style[data-stratagate-citations]')) return
      const style = document.createElement('style')
      style.dataset.stratagateCitations = 'true'
      style.textContent = citationCss
      document.head.appendChild(style)
    }

    function CitationSection({ title, children }) {
      if (children === null || children === undefined || children === '') return null
      return h('section', { className: 'sg-citation-section' }, h('h4', { className: 'sg-citation-section-title' }, title), children)
    }

    function CitationDisclosure({ title, children }) {
      if (children === null || children === undefined || children === '') return null
      return h('details', { className: 'sg-citation-disclosure' },
        h('summary', null, title),
        h('div', { className: 'sg-citation-disclosure-body' }, children))
    }

    function citationPreview(value, limit = 50) {
      const text = String(value || '').replace(/\s+/g, ' ').trim() || '暂无内容'
      return text.length > limit ? text.slice(0, limit) + '…' : text
    }

    function citationAdoptedFacts(citation, facts) {
      const activeFacts = facts.filter((fact) => !fact.status || fact.status === 'active')
      const factId = String(citation.evidenceRef || '').match(/:fact:([^:]+)$/)?.[1]
      if (factId) return activeFacts.filter((fact) => String(fact.id) === factId)
      return citation.expanded ? activeFacts : []
    }

    function CitationGraph({ citation, detail, primary, adopted = true }) {
      const containerRef = React.useRef(null)
      const graphRef = React.useRef(null)
      const center = detail?.node || primary
      const nodes = Array.isArray(detail?.nodes) && detail.nodes.length ? detail.nodes : center ? [center] : []
      const edges = Array.isArray(detail?.edges) ? detail.edges.filter((edge) => !edge.status || edge.status === 'active') : []
      const nodeMap = new Map(nodes.map((node) => [node.id, node]))
      const signature = JSON.stringify({
        center: center?.id,
        adopted,
        nodes: nodes.map((node) => [node.id, node.name, node.type]),
        edges: edges.map((edge) => [edge.id, edge.fromNodeId, edge.toNodeId, edge.relation]),
      })

      React.useEffect(() => {
        const container = containerRef.current
        if (!container || !cytoscape || !center || !nodes.length) return undefined
        const computed = getComputedStyle(container)
        const textColor = computed.getPropertyValue('--sg-text').trim() || '#0f1115'
        const mutedColor = computed.getPropertyValue('--sg-muted').trim() || '#64748b'
        const pageColor = computed.getPropertyValue('--sg-page').trim() || '#ffffff'
        const accentColor = computed.getPropertyValue('--sg-accent').trim() || '#4176e6'
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
        const graph = cytoscape({
          container,
          elements: [
            ...nodes.map((node) => {
              const meta = NODE_META[node.type] || ['实体', '#64748b', '•']
              return { data: { id: node.id, label: node.name, color: meta[1] }, classes: node.id === center.id ? adopted ? 'adopted' : 'retrieved' : 'related' }
            }),
            ...edges.filter((edge) => nodeMap.has(edge.fromNodeId) && nodeMap.has(edge.toNodeId)).map((edge) => ({ data: { id: 'citation-edge-' + edge.id, source: edge.fromNodeId, target: edge.toNodeId, label: edge.relation } })),
          ],
          userZoomingEnabled: true,
          userPanningEnabled: true,
          minZoom: .45,
          maxZoom: 2.2,
          wheelSensitivity: .22,
          style: [
            { selector: 'node', style: { width: 62, height: 62, 'background-color': 'data(color)', 'background-opacity': .2, 'border-color': 'data(color)', 'border-width': 1.5, label: 'data(label)', color: textColor, 'font-size': 11, 'font-weight': 650, 'text-wrap': 'wrap', 'text-max-width': 86, 'text-valign': 'center', 'text-halign': 'center', 'overlay-opacity': 0 } },
            { selector: 'node.adopted', style: { width: 76, height: 76, 'border-width': 4, 'border-color': accentColor, 'underlay-color': accentColor, 'underlay-opacity': .16, 'underlay-padding': 7 } },
            { selector: 'node.retrieved', style: { width: 72, height: 72, 'border-width': 3, 'border-color': mutedColor, 'border-style': 'dashed', 'underlay-color': mutedColor, 'underlay-opacity': .08, 'underlay-padding': 6 } },
            { selector: 'node.related', style: { opacity: .78 } },
            { selector: 'edge', style: { width: 1.4, 'line-color': mutedColor, 'target-arrow-color': mutedColor, 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', opacity: .68, label: 'data(label)', color: textColor, 'font-size': 10, 'text-background-color': pageColor, 'text-background-opacity': .9, 'text-background-padding': '2px', 'text-rotation': 'autorotate', 'arrow-scale': .75, 'overlay-opacity': 0 } },
          ],
        })
        graphRef.current = graph
        graph.layout({ name: 'concentric', concentric: (node) => node.id() === center.id ? 2 : 1, levelWidth: () => 1, minNodeSpacing: 36, animate: reduceMotion ? false : true, animationDuration: reduceMotion ? 0 : 220, fit: true, padding: 48 }).run()
        const resizeObserver = globalThis.ResizeObserver ? new globalThis.ResizeObserver(() => graph.resize()) : null
        resizeObserver?.observe(container)
        return () => { resizeObserver?.disconnect(); graphRef.current = null; graph.destroy() }
      }, [signature])

      if (!center) return null
      return h('div', { className: 'sg-citation-graph' },
        h('div', { className: 'sg-citation-graph-frame' },
          cytoscape ? h('div', { ref: containerRef, className: 'sg-citation-graph-canvas' }) : h('div', { className: 'sg-citation-graph-fallback' }, edges.map((edge) => h('div', { key: edge.id, className: 'sg-citation-relation' }, h('strong', null, nodeMap.get(edge.fromNodeId)?.name || edge.fromNodeId), h('span', null, edge.relation), h('strong', null, nodeMap.get(edge.toNodeId)?.name || edge.toNodeId)))),
          h('div', { className: 'sg-citation-graph-a11y' }, (adopted ? '采用节点：' : '检索候选：') + center.name + '。关联节点：' + nodes.filter((node) => node.id !== center.id).map((node) => node.name).join('、'))),
        h('p', { className: 'sg-citation-graph-note' }, adopted
          ? citation.expanded
            ? '高亮节点及展开结果为本次采用内容；周边节点帮助理解关系。'
            : '高亮节点为本次采用内容；周边节点为点击后加载的关联信息，不进入本次上下文。'
          : '高亮节点是本次检索到的候选；它未参与回答，周边节点仅用于理解关系。'))
    }

    function CitationLayers({ citation, layers, adopted = true }) {
      const layerMap = new Map(layers.map((layer) => [Number(layer.level), layer]))
      const selectedLevel = Number.isInteger(citation.level) ? Number(citation.level) : String(citation.evidenceRef || '').startsWith('raw:') ? 5 : null
      return h('div', { className: 'sg-citation-layers' }, [0, 1, 2, 3, 4, 5].map((level) => {
        const layer = layerMap.get(level)
        const content = String(layer?.content || '尚未生成')
        const selected = selectedLevel === level
        const state = selected ? adopted ? 'adopted' : 'retrieved' : ''
        return h('div', { key: level, className: 'sg-citation-layer ' + state, title: selected ? undefined : content },
          h('span', { className: 'sg-citation-layer-level' }, 'L' + level),
          h('div', { className: 'sg-citation-layer-content' }, selected ? content : citationPreview(content), selected ? h('span', { className: 'sg-citation-layer-state ' + (adopted ? '' : 'retrieved') }, adopted ? '本次采用' : '本次检索 · 未采用') : null))
      }))
    }

    function CitationDetail({ citation, detail, adopted = true }) {
      const messages = Array.isArray(detail?.messages) ? detail.messages : []
      const sourceMessages = Array.isArray(detail?.sourceMessages) ? detail.sourceMessages : messages
      let primary = null
      let facts = []
      if (citation.kind === 'event') primary = (detail?.events || []).find((item) => item.id === citation.id) || detail?.events?.[0]
      else if (citation.detailKind === 'nodeId') {
        primary = detail?.node
        facts = Array.isArray(primary?.facts) ? primary.facts : []
      } else if (citation.detailKind === 'elementId') {
        primary = (detail?.elements || []).find((item) => item.id === citation.id) || detail?.elements?.[0]
        facts = Array.isArray(primary?.facts) ? primary.facts : []
      }
      const selectedLayer = citation.kind === 'block' && Array.isArray(detail?.layers)
        ? detail.layers.find((layer) => Number(layer.level) === Number(citation.level)) || detail.layers.at(-1)
        : null
      const summary = citation.kind === 'event'
        ? primary?.narrative || primary?.summary
        : citation.kind === 'graph'
          ? primary?.currentState
          : selectedLayer?.content
      const adoptedFacts = citationAdoptedFacts(citation, facts)
      const relatedEvents = (Array.isArray(detail?.events) ? detail.events : []).filter((event) => citation.kind !== 'event' || event.id !== primary?.id)
      const primaryTitle = adopted ? '已用于回答' : '检索候选 · 未采用'
      return h(React.Fragment, null,
        h('p', { className: 'sg-citation-context-note' }, adopted ? '弹窗中的关联信息与来源内容用于查看依据；只有标记为“本次采用”的内容参与了回答。' : '这是本次检索到的候选记忆，但它没有参与回答。关联信息与来源内容仅供核对。'),
        citation.kind === 'graph' ? h(CitationSection, { title: primaryTitle },
          summary ? h('p', { className: 'sg-citation-copy' }, summary) : null,
          adoptedFacts.length ? h('ul', { className: 'sg-citation-facts' }, adoptedFacts.map((fact, index) => h('li', { key: fact.id || index, className: 'sg-citation-fact' }, h('strong', null, String(fact.key || '事实') + '：'), Array.isArray(fact.value) ? fact.value.join('、') : String(fact.value || '')))) : null,
          h(CitationGraph, { citation, detail, primary, adopted })) : null,
        citation.kind === 'event' ? h(CitationSection, { title: primaryTitle }, h('p', { className: 'sg-citation-copy' }, summary || '暂无可展示的摘要。')) : null,
        citation.kind === 'block' ? h(CitationSection, { title: 'L0–L5 记忆层级' }, h(CitationLayers, { citation, layers: Array.isArray(detail?.layers) ? detail.layers : [], adopted })) : null,
        relatedEvents.length ? h(CitationDisclosure, { title: '关联信息' }, h('div', { className: 'sg-citation-events' }, relatedEvents.map((event, index) => h('article', { key: event.id || index, className: 'sg-citation-event' }, h('strong', null, event.title || '关联事件'), h('p', null, event.summary || event.narrative || '暂无摘要'))))) : null,
        sourceMessages.length ? h(CitationDisclosure, { title: adopted ? '来源对话 ·未作为加入本次上下文' : '来源对话 · 未用于本次回答' }, h('div', { className: 'sg-citation-messages' }, sourceMessages.map((message, index) => h('div', { key: message.id || index, className: 'sg-citation-message' }, h('span', { className: 'sg-citation-message-role' }, message.role || 'message'), String(message.content || ''))))) : null,
        h(CitationDisclosure, { title: '详细情况' }, h('div', { className: 'sg-citation-tech' }, citation.evidenceRef + '\n' + citation.detailKind + ': ' + citation.id)))
    }

    function MemoryCitationTail({ matched }) {
      const citations = matched.citations
      const retrievedCount = matched.retrievedCount
      const retrievalGroups = matched.retrievalGroups
      const [showRetrieved, setShowRetrieved] = React.useState(false)
      const [selected, setSelected] = React.useState(null)
      const [detail, setDetail] = React.useState(null)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState('')
      const close = () => { setSelected(null); setDetail(null); setError(''); setLoading(false) }
      const open = (citation, adopted = true) => {
        setSelected({ ...citation, adopted })
        setDetail(null)
        setError('')
        setLoading(true)
        void api('sources', { namespace: citation.namespace, [citation.detailKind]: citation.id })
          .then(setDetail)
          .catch((reason) => setError(String(reason?.message || reason)))
          .finally(() => setLoading(false))
      }
      React.useEffect(() => {
        if (!selected) return undefined
        const onKeyDown = (event) => { if (event.key === 'Escape') close() }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
      }, [selected])
      return h(React.Fragment, null,
        citations.length ? h('div', { className: 'sg-answer-citations', 'data-testid': 'stratagate-answer-citations' },
          h('span', { className: 'sg-answer-citations-label' }, '本回答参考了 ' + citations.length + ' 条记忆'),
          h('div', { className: 'sg-answer-citations-list' }, citations.map((citation) => {
            const action = citationActionLabel(citation)
            return h('button', { key: citation.batchId + ':' + citation.evidenceRef, type: 'button', className: 'sg-answer-citation', title: citation.evidenceRef, onClick: () => open(citation, true) },
              h('span', { className: 'sg-answer-citation-kind' }, citationKindLabel(citation)),
              h('span', { className: 'sg-answer-citation-title' }, citation.title),
              action ? h('span', { className: 'sg-answer-citation-action' }, action) : null)
          }))) : null,
        citations.length === 0 && retrievalGroups.length > 0 ? h('div', { className: 'sg-answer-retrieval', 'data-testid': 'stratagate-answer-retrieval-note' },
          h('button', { type: 'button', className: 'sg-answer-retrieval-toggle', 'aria-expanded': showRetrieved, onClick: () => setShowRetrieved((value) => !value) },
            h('span', null, '已进行 ' + retrievalGroups.length + ' 次检索，共返回 ' + retrievedCount + ' 条记忆，未采用'),
            h('span', { className: 'sg-answer-retrieval-chevron ' + (showRetrieved ? 'open' : ''), 'aria-hidden': 'true' }, '›')),
          showRetrieved ? h('section', { className: 'sg-retrieved-panel', 'aria-label': '本次检索到但未采用的记忆' },
            h('div', { className: 'sg-retrieved-heading' }, h('strong', null, '检索过程'), h('span', null, retrievalGroups.length + ' 次 · ' + retrievedCount + ' 条 · 均未采用')),
            retrievalGroups.map((group, groupIndex) => h('section', { key: group.batchId || group.seq, className: 'sg-retrieved-group', 'aria-label': retrievalGroupLabel(groupIndex) },
              h('div', { className: 'sg-retrieved-group-head' }, h('strong', null, retrievalGroupLabel(groupIndex)), h('span', null, group.count + ' 条')),
              group.memories.length ? h('ol', { className: 'sg-retrieved-list' }, group.memories.map((memory, memoryIndex) => {
                const action = citationActionLabel(memory)
                return h('li', { key: memory.batchId + ':' + memory.evidenceRef }, h('button', { type: 'button', className: 'sg-retrieved-memory', title: memory.evidenceRef, onClick: () => open(memory, false) },
                  h('span', { className: 'sg-retrieved-index', 'aria-hidden': 'true' }, memoryIndex + 1 + '.'),
                  h('span', { className: 'sg-retrieved-memory-kind' }, citationKindLabel(memory)),
                  h('span', { className: 'sg-retrieved-memory-title' }, memory.title),
                  h('span', { className: 'sg-retrieved-memory-state' }, action ? action + ' · 未采用' : '未采用')))
              })) : h('div', { className: 'sg-retrieved-unavailable' }, group.count === 0 ? '本次检索没有返回匹配记忆。' : '这条历史回执未保存候选摘要。')))) : null) : null,
        selected ? h('div', { className: 'sg-citation-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) close() } },
          h('section', { className: 'sg-citation-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': citationKindLabel(selected) + ' 详情' },
            h('header', { className: 'sg-citation-dialog-head' },
              h('div', null, h('div', { className: 'sg-citation-dialog-kicker' }, (selected.adopted ? '' : '检索候选 · ') + citationKindLabel(selected) + (citationActionLabel(selected) ? ' · ' + citationActionLabel(selected) : '')), h('h3', { className: 'sg-citation-dialog-title' }, selected.title)),
              h('button', { type: 'button', className: 'sg-citation-close', onClick: close, 'aria-label': '关闭记忆详情' }, '×')),
            h('div', { className: 'sg-citation-dialog-body' }, loading ? h('div', { className: 'sg-citation-loading' }, '正在读取来源…') : error ? h('div', { className: 'sg-citation-error' }, error) : h(CitationDetail, { citation: selected, detail, adopted: selected.adopted })))) : null)
    }

    function dashboardApi(params, options = {}) {
      const query = new URLSearchParams(params || {})
      const url = '/api/stratagate/dashboard' + (query.size ? '?' + query : '')
      let attempt = 0
      const request = () => fetch(url, {
        cache: 'no-cache',
        signal: options.signal,
        headers: options.etag ? { 'If-None-Match': options.etag } : undefined,
      }).then(async (res) => {
        const etag = res.headers.get('etag') || options.etag || ''
        if (res.status === 304) return { notModified: true, etag, data: null }
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status)
        return { notModified: false, etag, data }
      }).catch((reason) => {
        if (reason?.name === 'AbortError') throw reason
        const message = String(reason?.message || reason)
        const networkFailure = reason instanceof TypeError || message.includes('Failed to fetch')
        if (networkFailure && attempt < 2) {
          attempt += 1
          return new Promise((resolve) => window.setTimeout(resolve, attempt * 300)).then(request)
        }
        throw new Error(message + '（dashboard）')
      })
      return request()
    }

    function pageMeta(value, fallbackLimit) {
      return {
        total: Math.max(0, Number(value?.total || 0)),
        offset: Math.max(0, Number(value?.offset || 0)),
        limit: Math.max(1, Number(value?.limit || fallbackLimit)),
      }
    }

    function usePagedMemory({ namespace, kind, initialItems, initialPage, fallbackLimit, extraParams = {} }) {
      const key = namespace + '\u0000' + kind + '\u0000' + JSON.stringify(extraParams)
      const [state, setState] = React.useState(() => ({ items: initialItems, page: pageMeta(initialPage, fallbackLimit) }))
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState('')
      React.useEffect(() => {
        setState({ items: initialItems, page: pageMeta(initialPage, fallbackLimit) })
        setError('')
      }, [key])
      React.useEffect(() => {
        setState((current) => current.page.offset === 0
          ? { items: initialItems, page: pageMeta(initialPage, fallbackLimit) }
          : current)
      }, [initialItems, initialPage?.total, initialPage?.limit])
      const loadOffset = (offset) => {
        setLoading(true)
        setError('')
        const path = kind === 'audit' ? 'audit' : 'memories'
        const params = { namespace, offset, limit: state.page.limit, ...extraParams }
        if (kind !== 'audit') params.kind = kind
        return api(path, params).then((result) => {
          setState({ items: result.items || [], page: pageMeta(result, state.page.limit) })
        }).catch((reason) => {
          setError(String(reason?.message || reason))
        }).finally(() => setLoading(false))
      }
      return { ...state, loading, error, loadOffset }
    }

    function Pagination({ page, loading, error, onOffset }) {
      const totalPages = Math.max(1, Math.ceil(page.total / page.limit))
      const currentPage = Math.min(totalPages, Math.floor(page.offset / page.limit) + 1)
      const start = page.total ? page.offset + 1 : 0
      const end = Math.min(page.total, page.offset + page.limit)
      return h('div', { className: 'sg-pagination', role: 'navigation', 'aria-label': '分页' },
        h('button', { type: 'button', className: 'sg-page-button', disabled: loading || page.offset <= 0, onClick: () => onOffset(Math.max(0, page.offset - page.limit)) }, '上一页'),
        h('span', null, loading ? '加载中…' : '第 ' + currentPage + ' / ' + totalPages + ' 页 · 显示 ' + start + '–' + end + ' / 共 ' + page.total + ' 条'),
        h('button', { type: 'button', className: 'sg-page-button', disabled: loading || page.offset + page.limit >= page.total, onClick: () => onOffset(page.offset + page.limit) }, '下一页'),
        error ? h('span', { className: 'sg-page-error' }, '加载失败：' + error) : null)
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
        h('span', null, h('span', { className: 'sg-alert-title' }, count + ' 条短期记忆尚未整理完成'), h('br'), h('span', { className: 'sg-alert-copy' }, '原始内容已经保存，不会丢失。')),
        h('span', { className: 'sg-chevron', 'aria-hidden': 'true' }, '›'))
    }

    function ProcessingAlert({ visible }) {
      if (!visible) return null
      return h('div', { className: 'sg-processing-alert', role: 'status', 'aria-live': 'polite' },
        h('span', { className: 'sg-processing-icon', 'aria-hidden': 'true' }, '↻'),
        h('span', null,
          h('span', { className: 'sg-processing-title' }, '正在触发记忆整理'),
          h('span', { className: 'sg-processing-copy' }, 'Block、Event 和知识图谱正在生成，请稍候。')))
    }

    function SearchBox({ value, onChange }) {
      return h('div', { className: 'sg-search' }, h('span', { className: 'sg-search-mark', 'aria-hidden': 'true' }, '⌕'), h('input', { value, onChange: (event) => onChange(event.target.value), placeholder: '搜索记忆、人物、项目、概念…', 'aria-label': '搜索长期记忆' }))
    }

    const NODE_META = {
      person: ['人物', '#8b6ccf', '♙'], project: ['项目', '#6f55ae', '▣'], organization: ['组织', '#3978cf', '⌘'],
      tool: ['工具', '#3b854d', '▤'], place: ['地点', '#a9632b', '⌂'],
    }
    const EVENT_TYPE_TEXT = { decision: '决策', release: '发布', task_completed: '任务完成', plan: '计划', change: '变更', cancellation: '取消', incident: '事件', meeting: '会议', collaboration: '协作', migration: '迁移', other: '其他' }
    const EVENT_STATUS_TEXT = { occurred: '已发生', planned: '计划中', cancelled: '已取消', ongoing: '进行中', unknown: '未知' }
    const EVENT_RELATIONS = [['supersedesEventIds', '取代'], ['conflictsWithEventIds', '冲突'], ['sameEventId', '同一事件'], ['beforeEventIds', '之前'], ['afterEventIds', '之后'], ['relatedEventIds', '相关']]

    function exactTime(value) {
      if (!value) return '未知'
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
    }

    function eventOccurrence(event) {
      const happened = event.temporal?.happenedStart || event.temporal?.happenedEnd
      return { value: happened || event.temporal?.mentionedAt || event.createdAt, known: Boolean(happened) }
    }

    function NodePill({ node, onClick }) {
      const meta = NODE_META[node.type] || ['实体', '#64748b', '•']
      return h('button', { className: 'sg-entity-pill', onClick }, h('span', { style: { color: meta[1] } }, meta[2]), node.name)
    }

    function NodeSummaryBubble({ node, x, y, width, height = 560, onViewDetails }) {
      if (!node) return null
      const facts = (node.facts || []).filter((fact) => fact.status === 'active').slice(0, 5)
      const eventCount = new Set(node.sourceEventIds || []).size
      return h('aside', { className: 'sg-node-bubble ' + (x > width * .62 ? 'flip' : ''), style: { left: (x / width * 100) + '%', top: (y / height * 100) + '%' } },
        h('div', { className: 'sg-node-bubble-head' }, h('h3', null, node.name), h('span', { className: 'sg-status-dot' }, '● ' + (node.status === 'active' ? '活跃' : node.status || '未知'))),
        (node.tags || []).length ? h('div', { className: 'sg-node-tags' }, node.tags.slice(0, 4).map((tag) => h('span', { key: tag, className: 'sg-node-tag' }, tag))) : null,
        h('p', { className: 'sg-node-bubble-state' }, node.currentState || '暂无当前状态'),
        facts.length ? h('ul', null, facts.map((fact) => h('li', { key: fact.id }, h('strong', null, fact.key + '：'), Array.isArray(fact.value) ? fact.value.join('、') : fact.value))) : h('p', { className: 'sg-node-bubble-state' }, '暂无关键事实'),
        h('div', { className: 'sg-node-bubble-foot' }, h('span', null, eventCount + ' 条相关事件'), h('button', { type: 'button', onClick: onViewDetails }, '查看详情 →')))
    }

    const GRAPH_NODE_RADIUS = { peripheral: 30, normal: 38, important: 46, core: 54 }
    const GRAPH_IMPORTANCE_TEXT = { peripheral: '边缘节点', normal: '普通节点', important: '重要节点', core: '核心节点' }

    function graphNameKey(value) {
      return String(value || '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    }

    function graphTimestamp(value) {
      const timestamp = Date.parse(String(value || ''))
      return Number.isFinite(timestamp) ? timestamp : 0
    }

    // Importance is derived from the complete persisted graph snapshot. The caller
    // deliberately computes this before search/type filters are applied, so a view
    // change never changes the meaning of a node's size.
    function graphNodeImportance(nodes, edges, project) {
      const activeEdges = edges.filter((edge) => edge.status === 'active')
      const activeSupportingEvents = (node) => (node.supportingEvents || []).filter((event) => event.status !== 'forgotten' && event.status !== 'archived')
      const relationCounts = new Map(nodes.map((node) => [node.id, 0]))
      const neighbors = new Map(nodes.map((node) => [node.id, new Set()]))
      for (const edge of activeEdges) {
        relationCounts.set(edge.fromNodeId, (relationCounts.get(edge.fromNodeId) || 0) + 1)
        relationCounts.set(edge.toNodeId, (relationCounts.get(edge.toNodeId) || 0) + 1)
        neighbors.get(edge.fromNodeId)?.add(edge.toNodeId)
        neighbors.get(edge.toNodeId)?.add(edge.fromNodeId)
      }

      const projectKey = graphNameKey(project)
      const directWorkspaceNodes = new Set(nodes.filter((node) => projectKey && [node.name, ...(node.aliases || [])].some((name) => {
        const key = graphNameKey(name)
        return key === projectKey || (key.length >= 5 && projectKey.length >= 5 && (key.includes(projectKey) || projectKey.includes(key)))
      })).map((node) => node.id))
      const workspaceAffinity = new Map(nodes.map((node) => [node.id, directWorkspaceNodes.has(node.id) ? 1 : 0]))
      for (const nodeId of directWorkspaceNodes) {
        for (const neighborId of neighbors.get(nodeId) || []) {
          workspaceAffinity.set(neighborId, Math.max(workspaceAffinity.get(neighborId) || 0, .55))
          for (const secondHopId of neighbors.get(neighborId) || []) {
            workspaceAffinity.set(secondHopId, Math.max(workspaceAffinity.get(secondHopId) || 0, .25))
          }
        }
      }

      const supportCounts = new Map(nodes.map((node) => {
        const supportingEvents = activeSupportingEvents(node)
        return [node.id, supportingEvents.length ? new Set(supportingEvents.map((event) => event.id)).size : new Set(node.sourceEventIds || []).size]
      }))
      const maxSupport = Math.max(1, ...supportCounts.values())
      const maxRelations = Math.max(1, ...relationCounts.values())
      let latestActivity = 0
      for (const node of nodes) {
        latestActivity = Math.max(latestActivity, graphTimestamp(node.updatedAt))
        for (const event of activeSupportingEvents(node)) latestActivity = Math.max(latestActivity, graphTimestamp(event.updatedAt || event.createdAt))
      }
      for (const edge of activeEdges) latestActivity = Math.max(latestActivity, graphTimestamp(edge.updatedAt))
      const halfLife = 90 * 24 * 60 * 60 * 1000
      const recency = (timestamp) => timestamp && latestActivity ? Math.exp(-Math.max(0, latestActivity - timestamp) / halfLife) : 0

      const scored = nodes.map((node) => {
        const supportingEvents = activeSupportingEvents(node)
        const sustainedMentions = supportingEvents.map((event) => recency(graphTimestamp(event.updatedAt || event.createdAt))).sort((left, right) => right - left).slice(0, 3)
        const recentScore = .25 * recency(graphTimestamp(node.updatedAt)) + .75 * sustainedMentions.reduce((sum, value) => sum + value, 0) / 3
        const supportScore = Math.log1p(supportCounts.get(node.id) || 0) / Math.log1p(maxSupport)
        const relationScore = Math.log1p(relationCounts.get(node.id) || 0) / Math.log1p(maxRelations)
        const score = .42 * supportScore + .28 * relationScore + .15 * recentScore + .15 * (workspaceAffinity.get(node.id) || 0)
        return { id: node.id, score }
      })
      const ordered = scored.map(({ score }) => score).sort((left, right) => left - right)
      const quantile = (ratio) => ordered[Math.ceil(Math.max(0, ordered.length - 1) * ratio)] || 0
      const spread = (ordered[ordered.length - 1] || 0) - (ordered[0] || 0)
      const thresholds = { normal: quantile(.25), important: quantile(.6), core: quantile(.85) }
      return new Map(scored.map(({ id, score }) => {
        let tier
        if (spread < .02) tier = score >= .65 ? 'core' : score >= .38 ? 'important' : 'normal'
        else if (score >= thresholds.core) tier = 'core'
        else if (score >= thresholds.important) tier = 'important'
        else if (score >= thresholds.normal) tier = 'normal'
        else tier = 'peripheral'
        return [id, { score, tier, radius: GRAPH_NODE_RADIUS[tier] }]
      }))
    }

    function GraphCanvas({ nodes, edges, clusters, importance, selectedId, onSelect, nodeLimit = 100, showSummary = false, onViewDetails }) {
      const containerRef = React.useRef(null)
      const graphRef = React.useRef(null)
      const selectedIdRef = React.useRef(selectedId)
      selectedIdRef.current = selectedId
      const [selectedPoint, setSelectedPoint] = React.useState(null)
      const [zoomPercent, setZoomPercent] = React.useState(100)
      const displayedNodes = [...nodes].sort((left, right) => (importance.get(right.id)?.score || 0) - (importance.get(left.id)?.score || 0)).slice(0, nodeLimit)
      const displayedIds = new Set(displayedNodes.map((node) => node.id))
      const visibleClusters = (clusters || []).map((cluster) => ({ ...cluster, nodeIds: (cluster.nodeIds || []).filter((id) => displayedIds.has(id)) })).filter((cluster) => cluster.nodeIds.length)
      const assignedIds = new Set(visibleClusters.flatMap((cluster) => cluster.nodeIds))
      for (const node of displayedNodes.filter((item) => !assignedIds.has(item.id))) visibleClusters.push({ id: 'fallback-' + node.id, label: (node.tags || [])[0] || node.name, nodeIds: [node.id], tags: node.tags || [] })
      const membership = new Map(visibleClusters.flatMap((cluster) => cluster.nodeIds.map((id) => [id, cluster.id])))
      const activeEdges = edges.filter((edge) => edge.status === 'active' && displayedIds.has(edge.fromNodeId) && displayedIds.has(edge.toNodeId))
      const signature = JSON.stringify({
        nodes: displayedNodes.map((node) => [node.id, node.name, node.type, node.tags || [], importance.get(node.id)?.tier]),
        edges: activeEdges.map((edge) => [edge.id, edge.fromNodeId, edge.toNodeId, edge.relation, edge.confidence]),
        clusters: visibleClusters.map((cluster) => [cluster.id, cluster.label, cluster.nodeIds]),
      })

      React.useEffect(() => {
        const container = containerRef.current
        if (!container || !cytoscape || !displayedNodes.length) return undefined
        const computed = getComputedStyle(container)
        const textColor = computed.getPropertyValue('--sg-text').trim() || '#0f1115'
        const mutedColor = computed.getPropertyValue('--sg-muted').trim() || '#64748b'
        const borderColor = computed.getPropertyValue('--sg-border').trim() || '#d5d9df'
        const pageColor = computed.getPropertyValue('--sg-page').trim() || '#ffffff'
        const accentColor = computed.getPropertyValue('--sg-accent').trim() || '#4176e6'
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
        const parentIds = new Map(visibleClusters.map((cluster) => [cluster.id, 'sg-parent-' + cluster.id]))
        const clusterSizes = new Map(visibleClusters.map((cluster) => [cluster.id, cluster.nodeIds.length]))
        const elements = [
          ...visibleClusters.map((cluster) => ({ data: { id: parentIds.get(cluster.id), label: cluster.label + ' · ' + cluster.nodeIds.length }, classes: 'sg-community' })),
          ...displayedNodes.map((node) => {
            const meta = NODE_META[node.type] || ['实体', '#64748b', '•']
            const semantic = (node.tags || [])[0] || meta[0]
            const visualImportance = importance.get(node.id) || { tier: 'normal', radius: GRAPH_NODE_RADIUS.normal }
            return { data: { id: node.id, parent: parentIds.get(membership.get(node.id)), label: node.name + '\n' + semantic, color: meta[1], size: visualImportance.radius * 2, tier: visualImportance.tier }, classes: 'sg-memory-node' }
          }),
          ...activeEdges.map((edge) => {
            const fromCluster = membership.get(edge.fromNodeId); const toCluster = membership.get(edge.toNodeId)
            const sameCluster = fromCluster === toCluster
            const labeled = sameCluster && (clusterSizes.get(fromCluster) || 0) <= 6
            return { data: { id: 'sg-edge-' + edge.id, source: edge.fromNodeId, target: edge.toNodeId, label: edge.relation }, classes: 'sg-memory-edge ' + (sameCluster ? 'same-community' : 'cross-community') + (labeled ? ' labeled' : '') }
          }),
        ]
        const graph = cytoscape({
          container,
          elements,
          wheelSensitivity: .22,
          minZoom: .25,
          maxZoom: 2.4,
          selectionType: 'single',
          boxSelectionEnabled: false,
          style: [
            { selector: 'node.sg-community', style: { 'background-color': accentColor, 'background-opacity': .045, 'border-color': accentColor, 'border-opacity': .28, 'border-width': 1, 'border-style': 'dashed', shape: 'round-rectangle', padding: '22px', label: 'data(label)', color: mutedColor, 'font-size': 12, 'font-weight': 700, 'text-valign': 'top', 'text-halign': 'center', 'text-margin-y': -9, 'text-background-color': pageColor, 'text-background-opacity': .82, 'text-background-padding': '3px' } },
            { selector: 'node.sg-memory-node', style: { width: 'data(size)', height: 'data(size)', 'background-color': 'data(color)', 'background-opacity': .28, 'border-color': 'data(color)', 'border-width': 1.5, label: 'data(label)', color: textColor, 'font-size': 11, 'font-weight': 650, 'text-wrap': 'wrap', 'text-max-width': 96, 'text-valign': 'center', 'text-halign': 'center', 'overlay-opacity': 0, 'transition-property': 'border-width, border-color, underlay-opacity', 'transition-duration': reduceMotion ? '0ms' : '180ms' } },
            { selector: 'node.sg-memory-node:selected', style: { 'border-width': 4, 'border-color': accentColor, 'underlay-color': accentColor, 'underlay-opacity': .16, 'underlay-padding': 7 } },
            { selector: 'edge.sg-memory-edge', style: { width: 1.2, 'line-color': mutedColor, 'target-arrow-color': mutedColor, 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', opacity: .58, 'arrow-scale': .75, label: '', 'overlay-opacity': 0 } },
            { selector: 'edge.sg-memory-edge.labeled', style: { label: 'data(label)', color: textColor, 'font-size': 10, 'text-background-color': pageColor, 'text-background-opacity': .88, 'text-background-padding': '2px', 'text-rotation': 'autorotate' } },
            { selector: 'edge.sg-memory-edge.cross-community', style: { opacity: .24, 'line-style': 'dashed' } },
            { selector: 'edge.sg-memory-edge.selected-relation', style: { opacity: .9, width: 2, label: 'data(label)', color: textColor, 'font-size': 10, 'text-background-color': pageColor, 'text-background-opacity': .9, 'text-background-padding': '2px' } },
          ],
        })
        graphRef.current = graph
        const updatePoint = () => {
          const selected = graph.getElementById(selectedIdRef.current)
          if (!selected.length) { setSelectedPoint(null); return }
          const point = selected.renderedPosition()
          setSelectedPoint({ x: point.x, y: point.y, width: container.clientWidth || 760, height: container.clientHeight || 522 })
        }
        graph.on('tap', 'node.sg-memory-node', (event) => onSelect(event.target.id()))
        const updateZoom = () => setZoomPercent(Math.round(graph.zoom() * 100))
        graph.on('pan zoom resize', updatePoint)
        graph.on('zoom', updateZoom)
        graph.on('layoutstop', updatePoint)
        graph.on('layoutstop', updateZoom)
        const resizeObserver = globalThis.ResizeObserver ? new globalThis.ResizeObserver(() => { graph.resize(); updatePoint() }) : null
        resizeObserver?.observe(container)
        graph.layout({ name: 'fcose', quality: 'default', randomize: true, animate: reduceMotion ? false : 'end', animationDuration: reduceMotion ? 0 : 320, animationEasing: 'ease-out-cubic', fit: true, padding: 48, nodeRepulsion: 5200, idealEdgeLength: (edge) => edge.hasClass('cross-community') ? 170 : 78, edgeElasticity: .42, nestingFactor: 1.35, gravity: .28, gravityCompound: 1, gravityRangeCompound: 1.5, tile: true }).run()
        return () => { resizeObserver?.disconnect(); graphRef.current = null; graph.destroy() }
      }, [signature])

      React.useEffect(() => {
        const graph = graphRef.current
        if (!graph) return
        graph.nodes('.sg-memory-node').unselect()
        graph.edges().removeClass('selected-relation')
        const selected = graph.getElementById(selectedId)
        if (!selected.length) { setSelectedPoint(null); return }
        selected.select()
        selected.connectedEdges().addClass('selected-relation')
        const point = selected.renderedPosition()
        const container = containerRef.current
        setSelectedPoint({ x: point.x, y: point.y, width: container?.clientWidth || 760, height: container?.clientHeight || 522 })
      }, [selectedId, signature])

      const setGraphZoom = (nextPercent) => {
        const graph = graphRef.current
        const container = containerRef.current
        if (!graph || !container) return
        const percent = Math.min(240, Math.max(25, Number(nextPercent)))
        graph.zoom({ level: percent / 100, renderedPosition: { x: container.clientWidth / 2, y: container.clientHeight / 2 } })
      }

      if (!nodes.length) return h(Empty, { title: '知识图谱正在形成', copy: 'Event 会在后台分批投影为节点与关系。' })
      if (!cytoscape) return h(Empty, { title: '图谱组件未能加载', copy: '请重新加载页面后再试。' })
      const selectedNode = nodes.find((node) => node.id === selectedId)
      return h('div', { className: 'sg-graph-canvas', role: 'img', 'aria-label': visibleClusters.length + ' 个 Leiden 主题群组的知识图谱' },
        h('div', { ref: containerRef, className: 'sg-cytoscape' }),
        h('div', { className: 'sg-graph-zoom', role: 'group', 'aria-label': '知识图谱缩放' },
          h('button', { type: 'button', onClick: () => setGraphZoom(zoomPercent - 20), disabled: zoomPercent <= 25, title: '缩小', 'aria-label': '缩小知识图谱' }, '\u2212'),
          h('input', { type: 'range', min: '25', max: '240', step: '5', value: String(zoomPercent), onInput: (event) => setGraphZoom(event.target.value), title: '缩放比例 ' + zoomPercent + '%', 'aria-label': '知识图谱缩放比例', 'aria-valuetext': zoomPercent + '%' }),
          h('button', { type: 'button', onClick: () => setGraphZoom(zoomPercent + 20), disabled: zoomPercent >= 240, title: '放大', 'aria-label': '放大知识图谱' }, '+')),
        h('div', { className: 'sg-graph-a11y', 'aria-label': '知识图谱节点列表' }, displayedNodes.map((node) => h('button', { key: node.id, onClick: () => onSelect(node.id) }, node.name + '，' + ((node.tags || [])[0] || (NODE_META[node.type] || ['实体'])[0]) + '，' + GRAPH_IMPORTANCE_TEXT[importance.get(node.id)?.tier || 'normal']))),
        showSummary && selectedNode && selectedPoint ? h(NodeSummaryBubble, { node: selectedNode, x: selectedPoint.x, y: selectedPoint.y, width: selectedPoint.width, height: selectedPoint.height, onViewDetails }) : null,
        h('div', { className: 'sg-graph-legend' }, Object.entries(NODE_META).map(([type, meta]) => h('span', { key: type }, h('i', { style: { background: meta[1] } }), meta[0]))))
    }

    function NodeDetailPanel({ node, nodes, edges, events, onEvent }) {
      if (!node) return h('aside', { className: 'sg-long-detail sg-placeholder-detail' }, '选择节点查看当前状态与证据')
      const meta = NODE_META[node.type] || ['实体', '#64748b', '•']
      const relations = edges.filter((edge) => edge.status === 'active' && (edge.fromNodeId === node.id || edge.toNodeId === node.id))
      const eventMap = new Map(events.map((event) => [event.id, event]))
      return h('aside', { className: 'sg-long-detail' },
        h('div', { className: 'sg-node-head' }, h('span', { className: 'sg-node-avatar', style: { background: meta[1] } }, meta[2]), h('div', null, h('h2', null, node.name), h('span', { className: 'sg-muted' }, meta[0]))),
        (node.tags || []).length ? h('section', null, h('h3', null, '语义标签'), h('div', { className: 'sg-node-tags' }, node.tags.map((tag) => h('span', { key: tag, className: 'sg-node-tag' }, tag)))) : null,
        h('section', null, h('h3', null, '当前状态'), h('span', { className: 'sg-status-dot' }, '● ' + (node.status === 'active' ? '活跃' : node.status)), node.currentState ? h('p', { className: 'sg-detail-copy' }, node.currentState) : null),
        h('section', null, h('h3', null, '关键事实'), node.facts?.filter((fact) => fact.status === 'active').length ? h('ul', null, node.facts.filter((fact) => fact.status === 'active').map((fact) => h('li', { key: fact.id }, h('strong', null, fact.key + '：'), Array.isArray(fact.value) ? fact.value.join('、') : fact.value))) : h('p', { className: 'sg-muted' }, '暂无关键事实')),
        h('section', null, h('h3', null, '相关关系'), relations.length ? relations.map((edge) => { const outgoing = edge.fromNodeId === node.id; const other = nodes.find((item) => item.id === (outgoing ? edge.toNodeId : edge.fromNodeId)); return h('div', { key: edge.id, className: 'sg-relation-row' }, h('span', null, outgoing ? edge.relation : '被' + edge.relation), h('strong', null, other?.name || '未知节点'), h('small', null, Math.round(edge.confidence * 100) + '%')) }) : h('p', { className: 'sg-muted' }, '暂无关系')),
        h('section', null, h('h3', null, '支撑事件'), (node.sourceEventIds || []).flatMap((id) => eventMap.get(id) || []).slice(0, 8).map((event) => h('button', { key: event.id, className: 'sg-support-event', onClick: () => onEvent(event.id) }, h('span', null, exactTime(eventOccurrence(event).value) + ' · ' + event.title), h('b', null, '›')))))
    }

    function EventDetailPanel({ event, nodes, events, onNode, openSource, className = '', onMouseEnter, onMouseLeave }) {
      if (!event) return h('aside', { className: 'sg-long-detail sg-placeholder-detail' }, '选择事件查看完整时间、关系与证据')
      const temporal = event.temporal || {}; const eventMap = new Map(events.map((item) => [item.id, item])); const nodeMap = new Map(nodes.map((node) => [node.id, node]))
      const relations = EVENT_RELATIONS.flatMap(([key, label]) => { const value = temporal[key]; const ids = Array.isArray(value) ? value : value ? [value] : []; return ids.map((id) => ({ id, label })) })
      return h('aside', { className: 'sg-long-detail ' + className, onMouseEnter, onMouseLeave },
        h('div', { className: 'sg-event-detail-head' }, h('h2', null, event.title), h('span', { className: 'sg-event-status ' + (temporal.status || 'unknown') }, EVENT_STATUS_TEXT[temporal.status] || '未知')),
        h('span', { className: 'sg-type-badge' }, EVENT_TYPE_TEXT[temporal.eventType] || temporal.eventType || '其他'),
        h('section', null, h('h3', null, '摘要'), h('p', { className: 'sg-detail-copy' }, event.summary || '暂无摘要')),
        event.narrative && event.narrative !== event.summary ? h('section', null, h('h3', null, '事件叙述'), h('p', { className: 'sg-detail-copy' }, event.narrative)) : null,
        h('section', null, h('h3', null, '时间信息'), h('dl', { className: 'sg-time-grid' },
          h('dt', null, '实际发生时间'), h('dd', null, temporal.happenedStart ? exactTime(temporal.happenedStart) + (temporal.happenedEnd && temporal.happenedEnd !== temporal.happenedStart ? ' — ' + exactTime(temporal.happenedEnd) : '') : '未知'),
          h('dt', null, '提及时间'), h('dd', null, exactTime(temporal.mentionedAt || event.createdAt)),
          h('dt', null, '时间精度'), h('dd', null, temporal.precision || 'unknown'),
          h('dt', null, '原始表达'), h('dd', null, temporal.originalText || '未记录'))),
        h('section', null, h('h3', null, '参与实体'), h('div', { className: 'sg-tags' }, (temporal.participantNodeIds || []).flatMap((id) => nodeMap.get(id) || []).map((node) => h(NodePill, { key: node.id, node, onClick: () => onNode(node.id) })), !(temporal.participantNodeIds || []).length ? (temporal.participants || []).map((name) => h('span', { key: name, className: 'sg-tag' }, name)) : null)),
        relations.length ? h('section', null, h('h3', null, '事件关系'), relations.map((relation) => h('div', { key: relation.label + relation.id, className: 'sg-relation-row' }, h('span', null, relation.label), h('strong', null, eventMap.get(relation.id)?.title || relation.id)))) : null,
        h('section', null, h('h3', null, '证据来源'), h('div', { className: 'sg-evidence-row' }, h('span', null, '来源 Block'), h('code', null, event.sourceBlockId)), h('div', { className: 'sg-evidence-row' }, h('span', null, '置信度'), h('strong', null, Math.round((event.confidence || 0) * 100) + '%'))),
        h('button', { className: 'sg-source-button', onClick: () => openSource(event) }, '查看来源原始消息 →'))
    }

    function TimelineList({ events, nodes, query, filters, onSelect, selectedId, floating = false, onNode, openSource }) {
      const [preview, setPreview] = React.useState(null)
      const pinnedId = React.useRef('')
      const hideTimer = React.useRef(null)
      const cancelHide = () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); hideTimer.current = null }
      const hidePreview = () => { cancelHide(); setPreview(null); pinnedId.current = '' }
      const showPreview = (event, target, pin = false) => {
        if (!floating || (!pin && pinnedId.current)) return
        cancelHide()
        const rect = target.getBoundingClientRect(); const width = Math.min(380, window.innerWidth - 24); const maxHeight = Math.min(620, window.innerHeight * .72)
        const rightSide = rect.right + 12 + width <= window.innerWidth - 12
        const left = rightSide ? rect.right + 12 : Math.max(12, rect.left - width - 12)
        const top = Math.min(Math.max(12, rect.top - 8), Math.max(12, window.innerHeight - maxHeight - 12))
        setPreview({ event, left, top })
        if (pin) pinnedId.current = event.id
      }
      const scheduleHide = () => {
        if (pinnedId.current) return
        cancelHide()
        hideTimer.current = window.setTimeout(() => setPreview(null), 140)
      }
      React.useEffect(() => () => cancelHide(), [])
      const normalized = query.trim().toLocaleLowerCase(); const now = new Date(); const weekAgo = now.getTime() - 7 * 86400000
      const groups = { '今天': [], '本周': [], '更早': [] }
      events.filter((event) => event.status !== 'forgotten' && event.status !== 'archived')
        .filter((event) => !normalized || JSON.stringify(event).toLocaleLowerCase().includes(normalized))
        .filter((event) => !filters.type || event.temporal?.eventType === filters.type)
        .filter((event) => !filters.status || event.temporal?.status === filters.status)
        .filter((event) => !filters.node || (event.temporal?.participantNodeIds || []).includes(filters.node))
        .filter((event) => { const info = eventOccurrence(event); const time = Date.parse(info.value); return !filters.time || (filters.time === 'unknown' ? !info.known : filters.time === 'today' ? Number.isFinite(time) && new Date(time).toDateString() === now.toDateString() : filters.time === 'week' ? time >= weekAgo : true) })
        .sort((a, b) => String(eventOccurrence(b).value).localeCompare(String(eventOccurrence(a).value)))
        .forEach((event) => { const info = eventOccurrence(event); const time = Date.parse(info.value); const sameDay = Number.isFinite(time) && new Date(time).toDateString() === now.toDateString(); groups[sameDay ? '今天' : time >= weekAgo ? '本周' : '更早'].push(event) })
      const nodeMap = new Map(nodes.map((node) => [node.id, node]))
      return h('div', { className: 'sg-timeline' }, Object.entries(groups).map(([label, items]) => items.length ? h('section', { key: label, className: 'sg-time-group' }, h('h3', null, label), items.map((event) => {
        const info = eventOccurrence(event); const temporal = event.temporal || {}
        return h('button', { key: event.id, className: 'sg-timeline-card ' + (event.id === selectedId ? 'selected' : ''), onMouseEnter: (hover) => showPreview(event, hover.currentTarget), onMouseLeave: scheduleHide, onFocus: (focus) => showPreview(event, focus.currentTarget), onBlur: scheduleHide, onClick: (click) => { onSelect(event.id); showPreview(event, click.currentTarget, true) } },
          h('span', { className: 'sg-timeline-dot' }), h('div', { className: 'sg-event-clock' }, info.known ? exactTime(info.value).replace(/^\d{4}\//, '') : '发生时间未知', !info.known ? h('small', null, '提及于 ' + exactTime(info.value)) : null),
          h('div', { className: 'sg-event-main' }, h('div', { className: 'sg-event-title-row' }, h('strong', null, event.title), h('span', { className: 'sg-type-badge' }, EVENT_TYPE_TEXT[temporal.eventType] || temporal.eventType || '其他')), h('p', null, event.summary || '暂无摘要'), h('div', { className: 'sg-tags' }, (temporal.participantNodeIds || []).flatMap((id) => nodeMap.get(id) || []).map((node) => h('span', { key: node.id, className: 'sg-tag' }, node.name)), !(temporal.participantNodeIds || []).length ? (temporal.participants || []).map((name) => h('span', { key: name, className: 'sg-tag' }, name)) : null)),
          h('span', { className: 'sg-event-status ' + (temporal.status || 'unknown') }, EVENT_STATUS_TEXT[temporal.status] || '未知'))
      })) : null), floating && preview ? h('div', { className: 'sg-event-popover', style: { left: preview.left + 'px', top: preview.top + 'px' }, onMouseEnter: cancelHide, onMouseLeave: scheduleHide },
        h('button', { type: 'button', className: 'sg-popover-close', 'aria-label': '关闭事件详情', onClick: hidePreview }, '×'),
        h(EventDetailPanel, { event: preview.event, nodes, events, onNode, openSource })) : null)
    }

    function LongTermPage({ events, eventPage, graph, project, query, setQuery, openEvent, namespace }) {
      const [mode, setMode] = React.useState('graph')
      const [selectedNodeId, setSelectedNodeId] = React.useState('')
      const [selectedEventId, setSelectedEventId] = React.useState('')
      const [graphNodeLimit, setGraphNodeLimit] = React.useState(100)
      const [eventFilters, setEventFilters] = React.useState({ time: '', node: '', type: '', status: '' })
      const [nodeType, setNodeType] = React.useState('')
      const [nodeTag, setNodeTag] = React.useState('')
      const [filtersOpen, setFiltersOpen] = React.useState(false)
      const [fullScreen, setFullScreen] = React.useState(false)
      const pagedEvents = usePagedMemory({ namespace, kind: 'events', initialItems: events, initialPage: eventPage, fallbackLimit: 40 })
      const timelineEvents = pagedEvents.items
      const nodes = graph.nodes || []; const edges = graph.edges || []; const clusters = graph.clusters || []; const normalized = query.trim().toLocaleLowerCase()
      const nodeImportance = React.useMemo(() => graphNodeImportance(nodes, edges, project), [nodes, edges, project])
      const nodeTags = [...new Set(nodes.flatMap((node) => node.tags || []))].sort((left, right) => left.localeCompare(right))
      React.useEffect(() => {
        if (!fullScreen) return undefined
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKeyDown = (event) => { if (event.key === 'Escape') { setFullScreen(false); setFiltersOpen(false) } }
        window.addEventListener('keydown', onKeyDown)
        return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKeyDown) }
      }, [fullScreen])
      const visibleNodes = nodes.filter((node) => node.status !== 'archived').filter((node) => !nodeType || node.type === nodeType).filter((node) => !nodeTag || (node.tags || []).includes(nodeTag)).filter((node) => !normalized || JSON.stringify(node).toLocaleLowerCase().includes(normalized))
      const displayedGraphIds = new Set([...visibleNodes].sort((left, right) => (nodeImportance.get(right.id)?.score || 0) - (nodeImportance.get(left.id)?.score || 0)).slice(0, graphNodeLimit).map((node) => node.id))
      const activeEdges = edges.filter((edge) => edge.status === 'active')
      const displayedEdgeCount = activeEdges.filter((edge) => displayedGraphIds.has(edge.fromNodeId) && displayedGraphIds.has(edge.toNodeId)).length
      const selectEvent = (id) => { setSelectedEventId(id); setMode('timeline') }
      const selectNode = (id) => { setSelectedNodeId(id); setMode('graph') }
      const openExplorer = () => {
        if (mode === 'graph' && !selectedNodeId && visibleNodes[0]) setSelectedNodeId(visibleNodes[0].id)
        if (mode === 'timeline' && !selectedEventId && timelineEvents[0]) setSelectedEventId(timelineEvents[0].id)
        setFiltersOpen(true)
        setFullScreen(true)
      }
      const migration = graph.migration || { projected: pagedEvents.page.total, total: pagedEvents.page.total, complete: true }
      const activeFilterCount = mode === 'graph' ? Number(Boolean(nodeType)) + Number(Boolean(nodeTag)) : Object.values(eventFilters).filter(Boolean).length
      const filterControls = mode === 'graph'
        ? h('div', { className: 'sg-filterbar' }, h('select', { value: nodeType, onChange: (event) => setNodeType(event.target.value), 'aria-label': '节点类型' }, h('option', { value: '' }, '全部节点类型'), Object.entries(NODE_META).map(([value, meta]) => h('option', { key: value, value }, meta[0]))), h('select', { value: nodeTag, onChange: (event) => setNodeTag(event.target.value), 'aria-label': '语义标签' }, h('option', { value: '' }, '全部语义标签'), nodeTags.map((tag) => h('option', { key: tag, value: tag }, tag))))
        : h('div', { className: 'sg-filterbar' },
          h('select', { value: eventFilters.time, onChange: (event) => setEventFilters({ ...eventFilters, time: event.target.value }), 'aria-label': '时间范围' }, h('option', { value: '' }, '全部时间'), h('option', { value: 'today' }, '今天'), h('option', { value: 'week' }, '本周'), h('option', { value: 'unknown' }, '发生时间未知')),
          h('select', { value: eventFilters.node, onChange: (event) => setEventFilters({ ...eventFilters, node: event.target.value }), 'aria-label': '参与实体' }, h('option', { value: '' }, '全部实体'), nodes.map((node) => h('option', { key: node.id, value: node.id }, node.name))),
          h('select', { value: eventFilters.type, onChange: (event) => setEventFilters({ ...eventFilters, type: event.target.value }), 'aria-label': '事件类型' }, h('option', { value: '' }, '全部类型'), Object.entries(EVENT_TYPE_TEXT).map(([value, label]) => h('option', { key: value, value }, label))),
          h('select', { value: eventFilters.status, onChange: (event) => setEventFilters({ ...eventFilters, status: event.target.value }), 'aria-label': '事件状态' }, h('option', { value: '' }, '全部状态'), Object.entries(EVENT_STATUS_TEXT).map(([value, label]) => h('option', { key: value, value }, label))))
      return h('section', { className: 'sg-long-explorer ' + (fullScreen ? 'fullscreen' : ''), 'aria-label': fullScreen ? '长期记忆全屏探索' : '长期记忆浏览' },
        h('nav', { className: 'sg-long-tabs' }, h('button', { className: mode === 'graph' ? 'active' : '', onClick: () => setMode('graph') }, '知识图谱'), h('button', { className: mode === 'timeline' ? 'active' : '', onClick: () => setMode('timeline') }, '事件时间线')),
        !migration.complete ? h('div', { className: 'sg-migration', role: 'status' }, h('span', { className: 'sg-processing-icon' }, '↻'), h('span', null, '正在升级长期记忆 · ' + migration.projected + ' / ' + migration.total + ' Events'), h('small', null, migration.failed ? migration.failed + ' 批待重试' : '后台增量处理，不影响其他功能')) : null,
        h('div', { className: 'sg-long-toolbar' },
          h(SearchBox, { value: query, onChange: setQuery }),
          h('button', { type: 'button', className: 'sg-toolbar-button', 'aria-expanded': filtersOpen ? 'true' : 'false', onClick: () => setFiltersOpen(!filtersOpen) }, '筛选 ▾', activeFilterCount ? h('span', { className: 'sg-active-filter-count' }, activeFilterCount) : null),
          h('span', { className: 'sg-toolbar-count' }, mode === 'graph' ? '显示 ' + Math.min(graphNodeLimit, visibleNodes.length) + ' / 共 ' + visibleNodes.length + ' 个节点 · 显示 ' + displayedEdgeCount + ' / 共 ' + activeEdges.length + ' 条关系' : '显示 ' + timelineEvents.length + ' / 共 ' + pagedEvents.page.total + ' 条事件 · ' + project),
          mode === 'graph' && graphNodeLimit < visibleNodes.length ? h('button', { type: 'button', className: 'sg-toolbar-button', onClick: () => setGraphNodeLimit((current) => Math.min(visibleNodes.length, current + 100)) }, '再显示 100 个') : null,
          h('button', { type: 'button', className: 'sg-toolbar-button', onClick: fullScreen ? () => { setFullScreen(false); setFiltersOpen(false) } : openExplorer }, fullScreen ? '退出全屏' : '⛶ 全屏查看' + (mode === 'graph' ? '图谱' : '时间线'))),
        filtersOpen ? filterControls : null,
        mode === 'graph'
          ? h('div', { className: 'sg-long-layout ' + (fullScreen ? '' : 'sg-summary-layout') },
            h(GraphCanvas, { nodes: visibleNodes, edges, clusters, importance: nodeImportance, selectedId: selectedNodeId, onSelect: setSelectedNodeId, nodeLimit: graphNodeLimit, showSummary: !fullScreen, onViewDetails: openExplorer }),
            fullScreen ? h(NodeDetailPanel, { node: nodes.find((node) => node.id === selectedNodeId), nodes, edges, events, onEvent: selectEvent }) : null)
          : h(React.Fragment, null,
            h('div', { className: 'sg-long-layout ' + (fullScreen ? 'sg-timeline-layout' : 'sg-summary-layout') },
              h(TimelineList, { events: timelineEvents, nodes, query, filters: eventFilters, onSelect: setSelectedEventId, selectedId: selectedEventId, floating: !fullScreen, onNode: selectNode, openSource: openEvent }),
              fullScreen ? h(EventDetailPanel, { event: timelineEvents.find((event) => event.id === selectedEventId), nodes, events: timelineEvents, onNode: selectNode, openSource: openEvent }) : null),
            h(Pagination, { page: pagedEvents.page, loading: pagedEvents.loading, error: pagedEvents.error, onOffset: pagedEvents.loadOffset })))
    }

    function previewText(value) {
      const text = String(value || '').replace(/\s+/g, ' ').trim() || '暂无内容'
      return text.length > 200 ? text.slice(0, 200) + '…' : text
    }

    function turnRangeText(range) {
      if (!Array.isArray(range) || range.length < 2 || range[1] < range[0]) return '等待新对话'
      return 'Turn ' + range[0] + '–' + range[1]
    }

    function LayerPreview({ layer, currentLevel, expanding, menuOpen, allowExpand, onMenuToggle, onExpand }) {
      const itemRef = React.useRef(null)
      const hideTimer = React.useRef(null)
      const popoverRef = React.useRef(null)
      const level = Number(layer.level)
      const actionable = allowExpand && level > currentLevel

      const cancelHide = () => {
        if (hideTimer.current) window.clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
      const removePopover = () => {
        popoverRef.current?.remove()
        popoverRef.current = null
      }
      const showPopover = () => {
        cancelHide()
        const rect = itemRef.current?.getBoundingClientRect()
        if (!rect) return
        const width = Math.min(390, Math.max(240, window.innerWidth - 24))
        const maxHeight = Math.min(520, window.innerHeight * 0.7)
        const right = rect.right + 12
        const left = right + width <= window.innerWidth - 12 ? right : Math.max(12, rect.left - width - 12)
        const top = Math.min(Math.max(12, rect.top - 8), Math.max(12, window.innerHeight - maxHeight - 12))
        if (!popoverRef.current) {
          const popover = document.createElement('aside')
          const title = document.createElement('strong')
          const content = document.createElement('p')
          const theme = window.getComputedStyle(itemRef.current)
          const pageTheme = window.getComputedStyle(itemRef.current.closest('.sg-memory'))
          popover.className = 'sg-layer-popover'
          popover.setAttribute('role', 'tooltip')
          popover.style.background = pageTheme.backgroundColor
          popover.style.color = pageTheme.color
          popover.style.borderColor = theme.borderColor
          title.textContent = 'L' + level + ' 完整内容'
          content.className = 'sg-layer-full'
          content.textContent = String(layer.content || '暂无内容')
          popover.append(title, content)
          popover.addEventListener('mouseenter', cancelHide)
          popover.addEventListener('mouseleave', scheduleHide)
          document.body.appendChild(popover)
          popoverRef.current = popover
        }
        popoverRef.current.style.left = left + 'px'
        popoverRef.current.style.top = top + 'px'
      }
      const scheduleHide = () => {
        cancelHide()
        hideTimer.current = window.setTimeout(removePopover, 140)
      }
      React.useEffect(() => () => { cancelHide(); removePopover() }, [])

      return h('div', { className: 'sg-layer-hover' },
        h('div', { ref: itemRef, className: 'sg-layer-item ' + (level === currentLevel ? 'current' : ''), 'data-level': String(level), tabIndex: 0, onMouseEnter: showPopover, onMouseLeave: scheduleHide, onFocus: showPopover, onBlur: scheduleHide },
          h('span', { className: 'sg-layer-label' }, 'L' + level),
          h('span', { className: 'sg-layer-preview' }, previewText(layer.content)),
          actionable ? h('button', { className: 'sg-layer-more', type: 'button', 'aria-label': 'L' + level + ' 操作', 'aria-expanded': menuOpen ? 'true' : 'false', onClick: (event) => { event.stopPropagation(); onMenuToggle(level) } }, '···') : h('span', { className: 'sg-layer-more-placeholder', 'aria-hidden': 'true' }),
          menuOpen ? h('div', { className: 'sg-layer-menu' }, h('button', { type: 'button', disabled: expanding, onClick: (event) => { event.stopPropagation(); onMenuToggle(null); void onExpand(level) } }, expanding ? '正在展开…' : '展开到这一层')) : null))
    }

    function BlockLayerPanel({ block, detail, loading, expandingLevel, onExpand }) {
      const [openMenuLevel, setOpenMenuLevel] = React.useState(null)
      React.useEffect(() => {
        const closeMenu = (event) => {
          if (event.key === 'Escape') { setOpenMenuLevel(null); return }
          const target = event.target
          if (!target?.closest?.('.sg-layer-more, .sg-layer-menu')) setOpenMenuLevel(null)
        }
        document.addEventListener('pointerdown', closeMenu)
        document.addEventListener('keydown', closeMenu)
        return () => {
          document.removeEventListener('pointerdown', closeMenu)
          document.removeEventListener('keydown', closeMenu)
        }
      }, [])
      if (loading) return h('div', { className: 'sg-layer-panel' }, h(Loading))
      const layers = Array.isArray(detail?.layers) ? detail.layers : []
      return h('div', { className: 'sg-layer-panel' },
        h('div', { className: 'sg-layer-heading' }, h('strong', null, '分层内容预览'), h('span', null, '当前层级：L' + block.currentLevel + ' · 悬停可查看完整内容')),
        block.virtual ? h('div', { className: 'sg-virtual-note' }, '旧会话展示片段为只读内容，不会改写原始数据库。') : null,
        layers.length ? h('div', { className: 'sg-layer-stack' }, layers.slice().sort((a, b) => a.level - b.level).map((layer) => h(LayerPreview, { key: layer.level, layer, currentLevel: block.currentLevel, expanding: expandingLevel === layer.level, menuOpen: openMenuLevel === layer.level, allowExpand: !block.virtual, onMenuToggle: (level) => setOpenMenuLevel((current) => current === level ? null : level), onExpand }))) : h('div', { className: 'sg-muted' }, '暂时无法读取该 Block 的分层内容。'))
    }

    function expansionLabel(source) {
      if (source === 'user') return '用户展开'
      if (source === 'agent') return 'Agent 展开'
      if (source === 'legacy') return '曾展开'
      return ''
    }

    function ShortTermPage({ blocks, blockPage, openBlock, conversations, activeThreadId, namespace, onConversationChange, refresh }) {
      const pagedBlocks = usePagedMemory({ namespace, kind: 'blocks', initialItems: blocks, initialPage: blockPage, fallbackLimit: 40, extraParams: { threadId: activeThreadId } })
      const visible = [...pagedBlocks.items].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0) || String(a.createdAt).localeCompare(String(b.createdAt)))
      const distributionRef = React.useRef(null)
      const [rail, setRail] = React.useState({ value: 0, max: 0 })
      const [expandedId, setExpandedId] = React.useState('')
      const [details, setDetails] = React.useState({})
      const [loadingId, setLoadingId] = React.useState('')
      const [expanding, setExpanding] = React.useState({ blockId: '', level: -1 })
      const [inlineError, setInlineError] = React.useState('')
      const currentOpen = openBlock || { turnRange: null, messages: 0, status: 'open' }

      React.useEffect(() => {
        const node = distributionRef.current
        if (!node) return undefined
        const updateRail = () => {
          const max = Math.max(0, node.scrollWidth - node.clientWidth)
          setRail({ value: Math.min(max, Math.round(node.scrollLeft)), max })
        }
        node.scrollLeft = node.scrollWidth
        updateRail()
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateRail) : null
        observer?.observe(node)
        return () => observer?.disconnect()
      }, [visible.length, activeThreadId])

      const toggleBlock = (block) => {
        if (expandedId === block.id) { setExpandedId(''); return }
        setExpandedId(block.id)
        setInlineError('')
        if (details[block.id]) return
        setLoadingId(block.id)
        void api('sources', { namespace, blockId: block.id })
          .then((value) => setDetails((current) => ({ ...current, [block.id]: value })))
          .catch((reason) => setInlineError(String(reason.message || reason)))
          .finally(() => setLoadingId(''))
      }

      const expandTo = (block, level) => {
        setInlineError('')
        setExpanding({ blockId: block.id, level })
        return api('blocks/expand', { namespace, blockId: block.id, level: 'L' + level }, { method: 'PATCH' })
          .then(() => refresh())
          .then(() => pagedBlocks.page.offset > 0 ? pagedBlocks.loadOffset(pagedBlocks.page.offset) : null)
          .catch((reason) => setInlineError(String(reason.message || reason)))
          .finally(() => setExpanding({ blockId: '', level: -1 }))
      }

      return h(React.Fragment, null,
        h('section', { className: 'sg-decay-overview', 'aria-labelledby': 'sg-decay-title' },
          h('div', { className: 'sg-decay-head' },
            h('h2', { className: 'sg-decay-title', id: 'sg-decay-title' }, '块衰减总览'),
            h('label', { className: 'sg-conversation' }, h('span', null, '当前对话：'), h('select', { value: activeThreadId || '', disabled: !conversations.length, onChange: (event) => onConversationChange(event.target.value), 'aria-label': '当前对话' }, conversations.map((conversation) => h('option', { key: conversation.id, value: conversation.id }, conversation.label))))),
          h('p', { className: 'sg-decay-copy' }, 'L0 层最浅最简略，L5 层最深最详细，离当前对话越远，Block 会逐渐简略。'),
          h('div', { ref: distributionRef, className: 'sg-distribution', 'aria-label': 'Block 当前层级分布', onScroll: (event) => { const node = event.currentTarget; setRail({ value: Math.round(node.scrollLeft), max: Math.max(0, node.scrollWidth - node.clientWidth) }) }, onWheel: (event) => { if (rail.max <= 0) return; event.preventDefault(); event.currentTarget.scrollLeft += event.deltaY + event.deltaX } },
            visible.map((block) => h('span', { key: block.id, className: 'sg-level-chip', 'data-level': String(block.currentLevel), title: 'Block #' + block.sequence }, 'L' + block.currentLevel)),
            h('span', { className: 'sg-level-chip sg-open-chip' }, '开放块 · 未封存')),
          h('input', { className: 'sg-distribution-rail', type: 'range', min: '0', max: String(Math.max(1, rail.max)), step: '1', value: String(Math.min(rail.value, Math.max(1, rail.max))), disabled: rail.max <= 0, onChange: (event) => { const value = Number(event.target.value); if (distributionRef.current) distributionRef.current.scrollLeft = value; setRail((current) => ({ ...current, value })) }, 'aria-label': 'Block 分布滑轨' }),
          h('div', { className: 'sg-time-direction', 'aria-hidden': 'true' }, h('span', null, '更旧'), h('span', { className: 'sg-time-line' }), h('span', null, '更新 →')),
          h('div', { className: 'sg-overview-meta' }, h('span', null, '已封存块：本页 ' + visible.length + ' / 共 ' + pagedBlocks.page.total), h('span', null, '开放块：' + turnRangeText(currentOpen.turnRange) + '（未封存）'))),
        h('section', { className: 'sg-block-list', 'aria-label': 'Block 列表' },
          h('div', { className: 'sg-block-header', 'aria-hidden': 'true' }, h('span', null, '当前层级'), h('span', null, 'Block'), h('span', null, '覆盖 Turn'), h('span', null, '距最新封存块'), h('span')),
          inlineError ? h('div', { className: 'sg-inline-error' }, '操作未完成：' + inlineError) : null,
          visible.map((block) => h('div', { key: block.id, className: 'sg-block-unit' },
            h('button', { className: 'sg-block-toggle', type: 'button', onClick: () => toggleBlock(block), 'aria-expanded': expandedId === block.id ? 'true' : 'false' },
              h('span', { className: 'sg-level-cell' }, h('span', { className: 'sg-level-badge', 'data-level': String(block.currentLevel) }, 'L' + block.currentLevel), expansionLabel(block.expansionSource) ? h('span', { className: 'sg-lifted' }, expansionLabel(block.expansionSource)) : null),
              h('span', { className: 'sg-block-name' }, (block.virtual ? '旧 Block #' : 'Block #') + block.sequence),
              h('span', { className: 'sg-block-turn' }, turnRangeText(block.turnRange)),
              h('span', { className: 'sg-block-distance' }, block.distanceFromLatest === 0 ? '0（最新）' : block.distanceFromLatest + ' 个 Block'),
              h('span', { className: 'sg-row-chevron', 'aria-hidden': 'true' }, expandedId === block.id ? '⌃' : '›')),
            expandedId === block.id ? h('div', { className: 'sg-block-expanded' }, h(BlockLayerPanel, { block, detail: details[block.id], loading: loadingId === block.id, expandingLevel: expanding.blockId === block.id ? expanding.level : -1, onExpand: (level) => expandTo(block, level) })) : null)),
          h('div', { className: 'sg-block-unit' }, h('div', { className: 'sg-block-toggle sg-open-row' },
            h('span', { className: 'sg-level-cell' }, h('span', { className: 'sg-open-badge' }, '开放块')),
            h('span', { className: 'sg-block-name' }, '未封存'),
            h('span', { className: 'sg-block-turn' }, turnRangeText(currentOpen.turnRange)),
            h('span', { className: 'sg-block-distance' }, '—'),
            h('span')))),
        h(Pagination, { page: pagedBlocks.page, loading: pagedBlocks.loading, error: pagedBlocks.error, onOffset: pagedBlocks.loadOffset }))
    }

    function SourceDetails({ item, source, kind }) {
      const messages = source?.messages || []
      return h('div', { className: 'sg-detail-section' },
        h('h3', { className: 'sg-section-title' }, '来源'),
        h('div', { className: 'sg-source-label' }, h('span', { className: 'sg-source-icon', 'aria-hidden': 'true' }, '▣'), h('span', null, '当前 DeepSeek 对话')),
        h('details', { className: 'sg-tech' }, h('summary', null, '技术详情'), h('div', { className: 'sg-tech-body' },
          h('div', { className: 'sg-tech-row' }, h('span', { className: 'sg-muted' }, kind === 'block' ? 'Block ID' : 'Event ID'), h('span', { className: 'sg-code' }, item.id)),
          kind === 'block' && item.turnRange ? h('div', { className: 'sg-tech-row' }, h('span', { className: 'sg-muted' }, 'Turn'), h('span', null, item.turnRange.join(' - '))) : null,
          messages.length ? messages.map((message) => h('div', { key: message.id, className: 'sg-raw-message' }, h('div', { className: 'sg-muted' }, String(message.role || '') + ' · ' + formatTime(message.createdAt)), h('div', { className: 'sg-code' }, String(message.content || '')))) : h('div', { className: 'sg-muted' }, '当前数据中没有可显示的来源消息。'))))
    }

    function EventDetail({ event, project, source, onBack, backLabel }) {
      return h(React.Fragment, null,
        h(BackBar, { label: backLabel, onBack }),
        h('header', { className: 'sg-detail-header' }, h('h2', { className: 'sg-detail-title' }, event.title || '记忆详情'), event.summary ? h('p', { className: 'sg-detail-subtitle' }, event.summary) : null, h('div', { className: 'sg-meta' }, h('span', null, formatTime(event.updatedAt || event.createdAt)), h('span', { className: 'sg-meta-sep' }, project))),
        event.narrative ? h('div', { className: 'sg-detail-section' }, h('h3', { className: 'sg-section-title' }, 'AI 对这段经历的理解'), h('p', { className: 'sg-prose' }, event.narrative)) : null,
        h('div', { className: 'sg-detail-section' }, h('h3', { className: 'sg-section-title' }, '参与实体'), (event.temporal?.participants || []).length ? h('div', { className: 'sg-tags' }, event.temporal.participants.map((name) => h('span', { key: name, className: 'sg-tag' }, name))) : h('span', { className: 'sg-muted' }, '未记录')),
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
          h('div', { className: 'sg-stage' }, h('span', null, '图谱投影'), h('span', { className: 'sg-stage-value ' + (first?.kind === 'graph-projection' ? 'failed' : first?.kind === 'event-extraction' ? 'waiting' : 'done') }, first?.kind === 'graph-projection' ? '× 失败' : first?.kind === 'event-extraction' ? '— 等待' : '✓ 已完成')))),
        failedBlocks.length ? h('div', { className: 'sg-detail-section' }, h('h3', { className: 'sg-section-title' }, '受影响的短期记忆'), failedBlocks.map((block) => h('div', { key: block.id, className: 'sg-result-event' }, block.title || block.summary || '短期记忆'))) : null,
        h('button', { className: 'sg-alert', onClick: refresh, style: { marginTop: '16px' } }, h('span', { className: 'sg-alert-mark' }, '↻'), h('span', null, h('span', { className: 'sg-alert-title' }, '重新检查状态'), h('br'), h('span', { className: 'sg-alert-copy' }, '任务会沿用现有重试机制继续处理。')), h('span', { className: 'sg-chevron' }, '›')),
        h('details', { className: 'sg-tech' }, h('summary', null, '技术错误详情'), h('pre', { className: 'sg-tech-body sg-code' }, first?.lastErrorFull || first?.lastError || '没有记录技术错误。')))
    }

    function ImportPage({ namespace, onBack, refresh }) {
      const [text, setText] = React.useState('')
      const [prompt, setPrompt] = React.useState('')
      const [promptLoading, setPromptLoading] = React.useState(true)
      const [copied, setCopied] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [job, setJob] = React.useState(null)
      const [choices, setChoices] = React.useState({})
      const [result, setResult] = React.useState(null)
      const [error, setError] = React.useState('')
      const [connectionError, setConnectionError] = React.useState('')
      React.useEffect(() => {
        let active = true; let restoreTimer
        api('import').then((value) => { if (active) setPrompt(String(value.prompt || '')) }).catch((reason) => { if (active) setError(String(reason?.message || reason)) }).finally(() => { if (active) setPromptLoading(false) })
        const restore = () => api('import', { operation: 'status', namespace })
          .then((value) => {
            if (!active) return
            setConnectionError('')
            if (value?.jobId && value.status !== 'undone') { setJob(value); if (value.status === 'committed') setResult(value) }
          })
          .catch(() => {
            if (!active) return
            setConnectionError('连接暂时中断，正在自动重试…')
            restoreTimer = window.setTimeout(restore, 2500)
          })
        void restore()
        const onKeyDown = (event) => { if (event.key === 'Escape') onBack() }
        window.addEventListener('keydown', onKeyDown)
        return () => { active = false; window.clearTimeout(restoreTimer); window.removeEventListener('keydown', onKeyDown) }
      }, [])
      React.useEffect(() => {
        if (!job?.jobId || !['extracting', 'processing'].includes(job.status)) return undefined
        let active = true; let timer
        const poll = () => api('import', { operation: 'status', namespace, jobId: job.jobId }).then((next) => {
          if (!active) return
          setConnectionError('')
          setJob(next)
          if (['extracting', 'processing'].includes(next.status)) timer = window.setTimeout(poll, 1200)
        }).catch(() => {
          if (!active) return
          setConnectionError('连接暂时中断，正在自动重试…')
          timer = window.setTimeout(poll, 2500)
        })
        timer = window.setTimeout(poll, 600)
        return () => { active = false; window.clearTimeout(timer) }
      }, [job?.jobId, job?.status, namespace])
      const copyPrompt = () => {
        if (!prompt) return
        const copiedPromise = navigator.clipboard?.writeText
          ? navigator.clipboard.writeText(prompt)
          : Promise.reject(new Error('当前浏览器不支持自动复制'))
        void copiedPromise.then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600) }).catch((reason) => setError(String(reason?.message || reason)))
      }
      const analyze = () => {
        if (!text.trim() || busy) return
        setBusy(true); setError(''); setResult(null); setJob(null); setChoices({})
        return api('import', { namespace }, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'preview', namespace, text }),
        }).then(setJob).catch((reason) => setError(String(reason?.message || reason))).finally(() => setBusy(false))
      }
      const commit = () => {
        if (!job || busy) return
        const requestedChoices = (job.decisions || []).flatMap((decision, index) => decision.requiresConfirmation
          ? [{ index, action: choices[index] || decision.action || 'IGNORE' }]
          : [])
        setBusy(true); setError('')
        return api('import', { namespace }, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'commit', namespace, jobId: job.jobId, choices: requestedChoices }),
        }).then((next) => { setResult(next); setJob(next); return refresh() })
          .catch((reason) => setError(String(reason?.message || reason))).finally(() => setBusy(false))
      }
      const retry = () => {
        if (!job?.jobId || busy) return
        setBusy(true); setError('')
        return api('import', { namespace }, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'retry', namespace, jobId: job.jobId }),
        }).then(setJob).catch((reason) => setError(String(reason?.message || reason))).finally(() => setBusy(false))
      }
      const undo = () => {
        if (!result?.sourceBlockId || busy) return
        setBusy(true); setError('')
        return api('import', { namespace }, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'undo', namespace, sourceBlockId: result.sourceBlockId }),
        }).then(() => { setResult(null); setJob(null); setText(''); return refresh() })
          .catch((reason) => setError(String(reason?.message || reason))).finally(() => setBusy(false))
      }
      const reset = () => { setResult(null); setJob(null); setChoices({}); setText(''); setError('') }
      const actionLabel = { ADD: '新增', MERGE: '合并', SUPERSEDE: '取代旧记忆', CONFLICT: '保留并标记冲突', IGNORE: '忽略' }
      const running = job && ['extracting', 'processing'].includes(job.status)
      const reviewable = job && ['ready', 'awaiting_confirmation'].includes(job.status)
      const emptyJob = reviewable && Number(job.totalCount || 0) === 0
      const percent = !job ? 0 : job.status === 'extracting' ? 5 : job.totalCount ? Math.round(job.processedCount / job.totalCount * 100) : 100
      return h('div', { className: 'sg-import-overlay', role: 'presentation', onMouseDown: (event) => { if (event.target === event.currentTarget) onBack() } },
        h('section', { className: 'sg-import-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sg-import-title' },
          h('header', { className: 'sg-import-dialog-head' }, h('h2', { id: 'sg-import-title', className: 'sg-import-dialog-title' }, '将记忆导入 StrataGate'), h('button', { type: 'button', className: 'sg-icon-button', onClick: onBack, 'aria-label': '关闭' }, '×')),
          h('div', { className: 'sg-import-step' },
            h('div', { className: 'sg-import-step-head' }, h('span', { className: 'sg-import-step-num' }, '1'), h('span', { className: 'sg-import-step-title' }, '复制以下提示词到其他 AI 对话中'), h('button', { type: 'button', className: 'sg-import-copy', disabled: promptLoading || !prompt, onClick: copyPrompt }, copied ? '已复制' : '复制')),
            promptLoading ? h('div', { className: 'sg-import-loading' }, '正在加载提示词…') : h('div', { className: 'sg-import-prompt', tabIndex: '0' }, prompt || '提示词暂时无法读取。')),
          h('div', { className: 'sg-import-step' },
            h('div', { className: 'sg-import-step-head' }, h('span', { className: 'sg-import-step-num' }, '2'), h('span', { className: 'sg-import-step-title' }, '粘贴结果，先分析再导入')),
            h('div', { className: 'sg-import-card' }, h('textarea', { value: text, disabled: busy || Boolean(job) || Boolean(result), onChange: (event) => setText(event.target.value), placeholder: '粘贴 JSON；格式不合格时会自动尝试恢复', 'aria-label': '外部 AI 记忆 JSON' }))),
          running ? h('div', { className: 'sg-import-step' },
            h('div', { className: 'sg-import-step-head' }, h('span', { className: 'sg-import-step-num' }, '3'), h('span', { className: 'sg-import-step-title' }, job.status === 'extracting' ? '正在修复并提取候选记忆' : '正在检测重复与冲突')),
            h('div', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': percent, style: { height: '9px', overflow: 'hidden', borderRadius: '999px', background: 'var(--sg-border)' } }, h('div', { style: { width: percent + '%', height: '100%', background: 'var(--sg-accent)', transition: 'width .25s ease' } })),
            h('div', { className: 'sg-import-hint', style: { marginTop: '8px' } }, job.status === 'extracting' ? '原 JSON 不合格，正在使用模型兜底。可以关闭页面，任务会继续。' : '已完成 ' + job.processedCount + '/' + job.totalCount + '，正在判断第 ' + Math.min(job.processedCount + 1, job.totalCount) + ' 条；可以关闭页面，稍后重新打开查看。')) : null,
          reviewable ? h('div', { className: 'sg-import-step' },
            h('div', { className: 'sg-import-step-head' }, h('span', { className: 'sg-import-step-num' }, '3'), h('span', { className: 'sg-import-step-title' }, '导入预览')),
            h('div', { className: 'sg-import-hint' }, emptyJob ? '没有发现可导入的长期记忆。' : job.recoveredFromInvalidJson ? '这些候选由兜底模型恢复，全部需要人工确认。' : '高置信度结果自动采用；低置信度结果请人工选择处理方式。'),
            h('div', { className: 'sg-import-preview' }, (job.decisions || []).map((decision, index) => h('div', { key: index, className: 'sg-import-preview-item' },
              h('div', { className: 'sg-import-preview-title' }, decision.candidate?.title || '未命名记忆'),
              h('div', { className: 'sg-import-preview-meta' }, h('span', null, actionLabel[decision.action] || decision.action), h('span', null, '置信度 ' + Math.round(Number(decision.confidence || 0) * 100) + '%'), decision.existingEventIds?.length ? h('span', null, '关联 ' + decision.existingEventIds.length + ' 条') : null),
              decision.reason ? h('div', { className: 'sg-import-preview-reason' }, decision.reason) : null,
              decision.requiresConfirmation ? h('label', { className: 'sg-import-review' }, h('span', null, '人工选择'), h('select', { value: choices[index] || decision.action, onChange: (event) => setChoices((current) => ({ ...current, [index]: event.target.value })) },
                (decision.existingEventIds?.length ? ['ADD', 'MERGE', 'SUPERSEDE', 'CONFLICT', 'IGNORE'] : ['ADD', 'IGNORE']).map((action) => h('option', { key: action, value: action }, actionLabel[action])))) : null,
            )))) : null,
          job?.status === 'failed' ? h('div', { className: 'sg-import-error' }, '任务失败：' + (job.lastError || '未知错误')) : null,
          connectionError ? h('div', { className: 'sg-import-hint' }, connectionError) : null,
          error ? h('div', { className: 'sg-import-error' }, error) : null,
          result ? h('div', { className: 'sg-import-result' }, '导入完成：新增 ' + Number(result.importedCount || 0) + ' 条记忆。可立即撤销本批次。') : null,
          h('footer', { className: 'sg-import-dialog-foot' },
            result ? h('button', { type: 'button', className: 'sg-import-cancel', disabled: busy, onClick: undo }, busy ? '正在撤销…' : '撤销本次导入') : h('button', { type: 'button', className: 'sg-import-cancel', onClick: onBack }, running ? '关闭，后台继续' : '取消'),
            result ? h('button', { type: 'button', className: 'sg-import-button', disabled: busy, onClick: reset }, '导入另一批')
              : job?.status === 'failed' ? h('button', { type: 'button', className: 'sg-import-button', disabled: busy, onClick: retry }, busy ? '正在重试…' : '重试')
                : emptyJob ? h('button', { type: 'button', className: 'sg-import-button', onClick: reset }, '导入另一批')
                  : reviewable ? h('button', { type: 'button', className: 'sg-import-button', disabled: busy, onClick: commit }, busy ? '正在导入…' : '确认导入')
                    : running ? h('button', { type: 'button', className: 'sg-import-button', disabled: true }, '后台处理中')
                      : h('button', { type: 'button', className: 'sg-import-button', disabled: busy || !text.trim(), onClick: analyze }, busy ? '正在创建任务…' : '分析并预览'))))
    }

    function MoreHome({ selected, setView }) {
      const rows = [
        ['import', '⇄', '导入别的 AI 记忆', '粘贴外部 AI 总结并导入'],
        ['structure', '◇', '记忆结构', '浏览 Event 与知识图谱'],
        ['system', '✓', '系统状态', '处理任务和最近整理时间'],
        ['audit', '↗', '使用记录', '长期记忆何时被使用'],
        ['raw', '{}', '原始数据', 'Block、Event、Graph 与模型响应'],
        ['settings', '⚙', '高级设置', 'Schema、提取间隔与项目空间'],
        ['support', '?', '反馈与支持', '报告问题、提出建议或咨询使用方法'],
      ]
      return h(React.Fragment, null, h('div', { className: 'sg-intro' }, h('h2', null, '更多'), h('p', null, '高级信息与工程视图')), h('div', { className: 'sg-menu' }, rows.map(([id, icon, title, subtitle]) => h('button', { key: id, className: 'sg-menu-row', onClick: () => setView({ name: id }) }, h('span', { className: 'sg-menu-icon', 'aria-hidden': 'true' }, icon), h('span', null, h('span', { className: 'sg-menu-title' }, title), h('br'), h('span', { className: 'sg-menu-subtitle' }, subtitle)), h('span', { className: 'sg-chevron' }, '›')))))
    }

    function limitedJson(value, limit = 4500) {
      const text = JSON.stringify(value, null, 2)
        .replace(/\b(?:sk|gh[opasu]|github_pat)_[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_TOKEN]')
        .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]{12,}={0,2}\b/gi, '$1[REDACTED]')
        .replace(/\b(api[_-]?key|token|password|secret)\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]')
      return text.length > limit ? text.slice(0, limit) + '\n…（内容已截断）' : text
    }

    function safeErrorSummary(value) {
      const firstLine = String(value || '').split(/\r?\n/, 1)[0].trim()
      return firstLine.length > 240 ? firstLine.slice(0, 240) + '…' : firstLine
    }

    function SupportPage({ overview, selected, project, data, recentError, onBack }) {
      const [includeLogs, setIncludeLogs] = React.useState(false)
      const [includeMemory, setIncludeMemory] = React.useState(false)
      const latestJobError = selected?.failedJobDetails?.[0]?.lastError || ''
      const lines = [
        '## 自动诊断信息',
        '',
        '- StrataGate 版本：' + (overview.pluginVersion || 'unknown'),
        '- Harness 版本：' + (overview.harnessVersion || 'unknown'),
        '- 当前工作区：' + project,
        '- blockTurnSize：' + (selected?.blockTurnSize ?? 'unknown'),
        '- 已封存块：' + (selected?.blocks ?? 0),
        '- Event / Graph Node 数量：' + (selected?.events ?? 0) + ' / ' + (selected?.graphNodes ?? 0),
        '- 最近错误：' + (safeErrorSummary(recentError || latestJobError) || '无'),
        '',
        '> 默认诊断不包含原始聊天、L5、Event 或 Graph 内容。',
      ]
      if (includeLogs) lines.push('', '<details><summary>诊断日志</summary>', '', '```json', limitedJson({ frontendError: recentError || null, failedJobs: selected?.failedJobDetails || [] }), '```', '</details>')
      if (includeMemory) lines.push('', '<details><summary>用户主动附加的记忆数据（可能包含对话内容）</summary>', '', '```json', limitedJson({ blocks: data.blocks, events: data.events, graph: data.graph }), '```', '</details>')
      const issueParams = new URLSearchParams({ title: '[Bug] StrataGate：', body: lines.join('\n') })
      const featureParams = new URLSearchParams({ title: '[Feature] StrataGate：', body: '请描述希望增加的能力、使用场景和预期行为。' })
      return h(React.Fragment, null,
        h(BackBar, { label: '更多', onBack }),
        h('div', { className: 'sg-intro' }, h('h2', null, '反馈与支持'), h('p', null, '选择最合适的入口，我们会带上必要且安全的上下文。')),
        h('div', { className: 'sg-privacy-note' }, '基础诊断不会附带原始聊天、L5、Event 或 Graph 内容。'),
        h('section', { className: 'sg-support-card' }, h('h3', null, '遇到问题'), h('p', null, '插件会整理版本、配置、数量和最近错误，帮助快速定位。'),
          h('label', { className: 'sg-check' }, h('input', { type: 'checkbox', checked: includeLogs, onChange: (event) => setIncludeLogs(event.target.checked) }), h('span', null, '附加诊断日志')),
          h('label', { className: 'sg-check' }, h('input', { type: 'checkbox', checked: includeMemory, onChange: (event) => setIncludeMemory(event.target.checked) }), h('span', null, '附加记忆数据（可能包含对话内容）')),
          includeMemory ? h('div', { className: 'sg-error-note' }, '你已选择附加可能包含对话内容的记忆数据，请在 GitHub 提交前再次检查。') : null,
          h('a', { className: 'sg-primary-link', href: ISSUE_URL + '?' + issueParams, target: '_blank', rel: 'noopener noreferrer' }, '在 GitHub 提交 Issue')),
        h('section', { className: 'sg-support-card' }, h('h3', null, '功能建议'), h('p', null, '描述使用场景和希望实现的行为。'), h('a', { className: 'sg-link', href: ISSUE_URL + '?' + featureParams, target: '_blank', rel: 'noopener noreferrer' }, '创建 Feature Request →')),
        h('section', { className: 'sg-support-card' }, h('h3', null, '使用疑问'), h('p', null, '在 GitHub Discussion 的 Q&A 区交流使用方法。'), h('a', { className: 'sg-link', href: DISCUSSION_URL, target: '_blank', rel: 'noopener noreferrer' }, '前往 Discussion / Q&A →')))
    }

    function StructurePage({ events, eventPage, graph, openEvent, namespace, onBack }) {
      const pagedEvents = usePagedMemory({ namespace, kind: 'events', initialItems: events, initialPage: eventPage, fallbackLimit: 40 })
      return h(React.Fragment, null,
        h(BackBar, { label: '更多', onBack }),
        h('div', { className: 'sg-intro' }, h('h2', null, '记忆结构'), h('p', null, '完整浏览现有结构化记忆')),
        h('div', { className: 'sg-counts' },
          h('div', null, h('div', { className: 'sg-count-value' }, pagedEvents.page.total), h('div', { className: 'sg-count-label' }, '经历 / Event')),
          h('div', null, h('div', { className: 'sg-count-value' }, graph.nodes.length), h('div', { className: 'sg-count-label' }, '知识图谱节点'))),
        h('div', { className: 'sg-structured-group' },
          h('h3', { className: 'sg-section-title' }, '经历'),
          pagedEvents.items.map((event) => h('button', { key: event.id, className: 'sg-related', onClick: () => openEvent(event) }, h('span', null, event.title), h('span', { className: 'sg-related-time' }, formatTime(event.updatedAt))))),
        h(Pagination, { page: pagedEvents.page, loading: pagedEvents.loading, error: pagedEvents.error, onOffset: pagedEvents.loadOffset }),
        h('div', { className: 'sg-structured-group' },
          h('h3', { className: 'sg-section-title' }, '图谱节点'),
          graph.nodes.map((node) => h('div', { key: node.id, className: 'sg-related' }, h('span', null, node.name), h('span', { className: 'sg-related-time' }, (node.sourceEventIds || []).length + ' 条支撑事件')))))
    }

    function SystemPage({ selected, blocks, onBack, refresh }) {
      const processing = blocks.filter((block) => block.status === 'processing').length
      return h(React.Fragment, null, h(BackBar, { label: '更多', onBack }), h('div', { className: 'sg-intro' }, h('h2', null, '系统状态'), h('p', null, '仅在这里展示记忆处理的工程状态')), h('div', { className: 'sg-pipeline' },
        [['Block 数量', selected.blocks], ['待处理任务', processing], ['失败任务', selected.failedJobs], ['最近整理时间', formatTime(selected.lastActivityAt)], ['Event 提取', selected.failedJobDetails?.some((item) => item.kind === 'event-extraction') ? '有失败' : '正常'], ['图谱投影', selected.failedJobDetails?.some((item) => item.kind === 'graph-projection') ? '有失败' : '正常']].map(([label, value]) => h('div', { key: label, className: 'sg-stage' }, h('span', null, label), h('span', { className: 'sg-stage-value ' + (label === '失败任务' && value ? 'failed' : 'waiting') }, String(value))))), h('button', { className: 'sg-quiet-button', onClick: refresh, style: { marginTop: '14px' } }, '↻ 重新检查'))
    }

    function AuditPage({ audit, auditPage, namespace, onBack }) {
      const pagedAudit = usePagedMemory({ namespace, kind: 'audit', initialItems: audit, initialPage: auditPage, fallbackLimit: 100 })
      return h(React.Fragment, null,
        h(BackBar, { label: '更多', onBack }),
        h('div', { className: 'sg-intro' }, h('h2', null, '使用记录'), h('p', null, '长期记忆被使用的时间与来源')),
        pagedAudit.items.length ? pagedAudit.items.map((item) => { const value = item.audit || {}; return h('details', { key: item.id, className: 'sg-audit' }, h('summary', null, h('strong', null, '使用了 ' + ((item.events || []).length + (item.elements || []).length) + ' 条记忆'), h('span', { className: 'sg-muted' }, ' · ' + formatTime(item.createdAt))), h('div', { className: 'sg-audit-body' }, h('div', null, (item.events || []).map((event) => event.title).join('、') || (item.elements || []).map((element) => element.name).join('、') || '旧版使用记录'), h('div', { className: 'sg-tech-row sg-audit-evidence' }, h('span', { className: 'sg-muted' }, '来源会话'), h('span', { className: 'sg-code' }, value.sessionId || '未记录')), value.turn !== undefined ? h('div', { className: 'sg-tech-row' }, h('span', { className: 'sg-muted' }, 'Turn'), h('span', null, value.turn)) : null)) }) : h(Empty, { title: '还没有使用记录', copy: 'AI 在回答中采用长期记忆后会记录在这里。' }),
        h(Pagination, { page: pagedAudit.page, loading: pagedAudit.loading, error: pagedAudit.error, onOffset: pagedAudit.loadOffset }))
    }

    function RawPage({ data, selected, onBack }) {
      const groups = [['Block raw', data.blocks, data.pagination?.blocks?.total], ['Event raw', data.events, data.pagination?.events?.total], ['Graph raw', data.graph], ['Usage raw', data.audit, data.pagination?.audit?.total], ['模型响应', selected.successfulModelResponses || []]]
      return h(React.Fragment, null, h(BackBar, { label: '更多', onBack }), h('div', { className: 'sg-intro' }, h('h2', null, '原始数据'), h('p', null, '供排查问题使用的内部字段与 JSON')), groups.map(([label, value, total]) => h('details', { key: label, className: 'sg-raw-group' }, h('summary', null, label + ' (' + (Array.isArray(value) && Number(total) > value.length ? '已加载 ' + value.length + ' / 共 ' + total : Array.isArray(value) ? value.length : ((value.nodes?.length || 0) + (value.edges?.length || 0))) + ')'), h('pre', { className: 'sg-raw-json sg-code' }, JSON.stringify(value, null, 2)))))
    }

    function SettingsPage({ selected, namespace, onBack, updateSettings, savingSettings }) {
      const [turnSize, setTurnSize] = React.useState(String(selected.blockTurnSize ?? 6))
      const [lambda, setLambda] = React.useState(String(selected.blockDecayLambda ?? 0.3))
      React.useEffect(() => {
        setTurnSize(String(selected.blockTurnSize ?? 6))
        setLambda(String(selected.blockDecayLambda ?? 0.3))
      }, [selected.blockTurnSize, selected.blockDecayLambda])
      const turnSizeValue = Number(turnSize)
      const lambdaValue = Number(lambda)
      const valid = Number.isSafeInteger(turnSizeValue) && turnSizeValue >= 1 && lambda !== '' && Number.isFinite(lambdaValue) && lambdaValue >= 0
      const changed = valid && (turnSizeValue !== selected.blockTurnSize || lambdaValue !== selected.blockDecayLambda)
      const suggestedLambda = Math.round(((selected.blockDecayLambda ?? 0.3) * turnSizeValue / (selected.blockTurnSize || 6)) / 0.05) * 0.05
      const showSuggestion = Number.isSafeInteger(turnSizeValue) && turnSizeValue >= 1 && turnSizeValue !== selected.blockTurnSize
      const rows = [['Schema 版本', 'v' + selected.schemaVersion], ['模型', '由 DSH 当前模型配置提供'], ['内部空间 ID', namespace], ['已处理轮次', selected.currentTurn]]
      return h(React.Fragment, null,
        h(BackBar, { label: '更多', onBack }),
        h('div', { className: 'sg-intro' }, h('h2', null, '高级设置'), h('p', null, '修改后会立即应用到所有已有工作区，并作为新工作区的默认值。')),
        h('div', { className: 'sg-pipeline' },
          h('div', { className: 'sg-stage' }, h('span', null, '每个 Block 的对话轮数'), h('span', { className: 'sg-lambda-control' }, h('input', { className: 'sg-number-input', type: 'number', min: '1', step: '1', value: turnSize, onChange: (event) => setTurnSize(event.target.value), 'aria-label': '每个 Block 的对话轮数' }), h('span', { className: 'sg-stage-value waiting' }, '轮'))),
          h('p', { className: 'sg-setting-note' }, '1 轮是一次用户提问和 AI 完整回复。轮数越小，Block 生成越频繁，也会让相同长度的对话衰减得更快；已有 Block 不会重新切分，尚未封存的内容按新阈值继续处理。'),
          h('div', { className: 'sg-stage' }, h('span', null, 'Block 衰减系数 λ'), h('span', { className: 'sg-lambda-control' }, h('input', { className: 'sg-number-input', type: 'number', min: '0', step: '0.05', value: lambda, onChange: (event) => setLambda(event.target.value), 'aria-label': 'Block 衰减系数 λ' }))),
          h('p', { className: 'sg-setting-note' }, '默认 0.3；数字越小，记忆遗忘越慢，消耗 token 越多，不建议大于 0.4。'),
          showSuggestion ? h('div', { className: 'sg-setting-suggestion' }, h('span', null, '为保持按对话轮数计算的遗忘速度，建议 λ 调整为 ' + suggestedLambda.toFixed(2) + '。'), h('button', { type: 'button', className: 'sg-quiet-button', onClick: () => setLambda(String(Number(suggestedLambda.toFixed(2)))) }, '采用建议值')) : null,
          rows.map(([label, value]) => h('div', { key: label, className: 'sg-stage' }, h('span', null, label), h('span', { className: label === '内部空间 ID' ? 'sg-stage-value sg-code' : 'sg-stage-value' }, String(value)))),
          h('button', { type: 'button', className: 'sg-save-button', disabled: !changed || savingSettings, onClick: () => void updateSettings({ blockTurnSize: turnSizeValue, blockDecayLambda: lambdaValue }) }, savingSettings ? '保存中…' : changed ? '保存设置' : '已保存'))
      )
    }

    function MemoryPage({ useWorkspaces, useSessions }) {
      const workspaceItems = useWorkspaces((state) => state.items)
      const sessionById = useSessions((state) => state.byId || {})
      const [overview, setOverview] = React.useState({ namespaces: [] })
      const [namespace, setNamespace] = React.useState('')
      const [workspaceTitles, setWorkspaceTitles] = React.useState({})
      const [workspaceSessionIds, setWorkspaceSessionIds] = React.useState({})
      const [conversationId, setConversationId] = React.useState('')
      const [section, setSection] = React.useState('short')
      const [view, setView] = React.useState({ name: 'root' })
      const [data, setData] = React.useState({ events: [], graph: { nodes: [], edges: [], migration: null }, blocks: [], openBlock: null, conversations: [], activeThreadId: null, audit: [], pagination: { events: { total: 0, offset: 0, limit: 40 }, blocks: { total: 0, offset: 0, limit: 40 }, audit: { total: 0, offset: 0, limit: 100 } } })
      const [query, setQuery] = React.useState('')
      const [source, setSource] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState('')
      const [recentError, setRecentError] = React.useState('')
      const [savingSettings, setSavingSettings] = React.useState(false)
      const [pollFast, setPollFast] = React.useState(false)
      const dashboardRequestRef = React.useRef(null)
      const dashboardEtagsRef = React.useRef(new Map())
      const loadedNamespaceRef = React.useRef('')
      const reportError = (reason) => {
        const message = String(reason?.message || reason)
        setError(message)
        setRecentError(message)
      }

      React.useEffect(() => {
        let active = true
        void Promise.all((workspaceItems || []).map(async (workspace) => ({
          key: await workspaceProjectKey(workspace.path),
          title: String(workspace.title || '').trim(),
          sessionIds: Array.isArray(workspace.sessionIds) ? workspace.sessionIds.map(String) : [],
        }))).then((entries) => {
          if (!active) return
          setWorkspaceTitles(Object.fromEntries(entries.filter(({ key, title }) => key && title).map(({ key, title }) => [key, title])))
          setWorkspaceSessionIds(Object.fromEntries(entries.filter(({ key }) => key).map(({ key, sessionIds }) => [key, sessionIds])))
        })
        return () => { active = false }
      }, [workspaceItems])

      const loadDashboard = React.useCallback((activeNamespace, options = {}) => {
        const background = options.background === true
        if (background && dashboardRequestRef.current) return Promise.resolve(null)
        dashboardRequestRef.current?.abort()
        const controller = new AbortController()
        dashboardRequestRef.current = controller
        const key = String(activeNamespace || '') + '\u0000' + String(options.threadId || '')
        if (!background) setLoading(true)
        if (!background) setError('')
        return dashboardApi({
          ...(activeNamespace ? { namespace: activeNamespace } : {}),
          ...(options.threadId ? { threadId: options.threadId } : {}),
        }, { etag: options.force ? '' : dashboardEtagsRef.current.get(key), signal: controller.signal }).then((result) => {
          if (result.etag) dashboardEtagsRef.current.set(key, result.etag)
          if (result.notModified || !result.data) return null
          const next = result.data
          setOverview(next.overview || { namespaces: [] })
          setPollFast(next.processing === true)
          if (next.namespace) {
            loadedNamespaceRef.current = next.namespace
            setNamespace((current) => next.overview?.namespaces?.some((item) => item.namespace === current) ? current : next.namespace)
          }
          if (next.data) {
            setData(next.data)
            setConversationId(next.data.activeThreadId || '')
          }
          setError('')
          return next
        }).catch((reason) => {
          if (reason?.name !== 'AbortError') reportError(reason)
          return null
        }).finally(() => {
          if (dashboardRequestRef.current === controller) dashboardRequestRef.current = null
          if (!background) setLoading(false)
        })
      }, [])

      React.useEffect(() => {
        void loadDashboard('')
        return () => dashboardRequestRef.current?.abort()
      }, [loadDashboard])
      React.useEffect(() => {
        if (!namespace || loadedNamespaceRef.current === namespace) return
        setConversationId(''); setView({ name: 'root' }); setSource(null); setData({ events: [], graph: { nodes: [], edges: [], migration: null }, blocks: [], openBlock: null, conversations: [], activeThreadId: null, audit: [], pagination: { events: { total: 0, offset: 0, limit: 40 }, blocks: { total: 0, offset: 0, limit: 40 }, audit: { total: 0, offset: 0, limit: 100 } } }); void loadDashboard(namespace, { force: true })
      }, [namespace, loadDashboard])
      React.useEffect(() => {
        if (!namespace) return undefined
        let stopped = false
        let timer = null
        const schedule = (delay) => {
          if (stopped || document.hidden) return
          timer = window.setTimeout(run, delay)
        }
        const run = () => {
          if (stopped || document.hidden) return
          void loadDashboard(namespace, { background: true, threadId: conversationId }).finally(() => {
            schedule(pollFast ? 2500 : 30000)
          })
        }
        const onVisibilityChange = () => {
          if (document.hidden) {
            if (timer !== null) window.clearTimeout(timer)
            timer = null
            dashboardRequestRef.current?.abort()
          } else {
            run()
          }
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        schedule(pollFast ? 2500 : 30000)
        return () => {
          stopped = true
          if (timer !== null) window.clearTimeout(timer)
          document.removeEventListener('visibilitychange', onVisibilityChange)
        }
      }, [namespace, conversationId, pollFast, loadDashboard])

      const selected = (overview.namespaces || []).find((item) => item.namespace === namespace)
      const project = projectName(selected || namespace, workspaceTitles)
      const activeProjectKey = namespace.includes(':project:') ? namespace.split(':project:').pop() : ''
      const hostSessionIds = workspaceSessionIds[activeProjectKey] || []
      const memoryConversations = new Map(data.conversations.map((conversation) => [conversation.id, conversation]))
      const conversations = []
      const seenConversations = new Set()
      for (const id of hostSessionIds) {
        const session = sessionById[id]
        if (session?.parentId) continue
        const memory = memoryConversations.get(id)
        const dshTitle = String(session?.title || '').trim()
        conversations.push({ ...(memory || {}), id, label: dshTitle || memory?.label || ('对话 ' + id.slice(0, 8)) })
        seenConversations.add(id)
      }
      for (const memory of data.conversations) {
        if (seenConversations.has(memory.id)) continue
        conversations.push(memory)
      }
      conversations.sort((left, right) => left.id === '__legacy__' ? 1 : right.id === '__legacy__' ? -1 : 0)
      const failedCount = Number(selected?.failedJobs || 0)
      const processing = !error && (Number(selected?.processingJobs || 0) > 0
        || data.blocks.some((block) => block.status === 'processing'))
      const goSection = (next) => { setSection(next); setView({ name: 'root' }); setSource(null) }
      const sourceParams = (kind, item) => kind === 'event' ? { eventId: item.id } : kind === 'element' ? { elementId: item.id } : { blockId: item.id }
      const loadSource = (kind, item) => {
        setSource(null)
        void api('sources', { namespace, ...sourceParams(kind, item) }).then(setSource).catch(reportError)
      }
      const openWithSource = (kind, item) => {
        setView((current) => ({ name: kind, item, back: current })); loadSource(kind, item)
      }
      const openEvent = (event) => openWithSource('event', data.events.find((item) => item.id === event.id) || event)
      const goBack = () => {
        const previous = view.back || { name: 'root' }
        setView(previous)
        if (previous.item && ['event', 'block'].includes(previous.name)) loadSource(previous.name, previous.item)
        else setSource(null)
      }
      const backLabel = view.back?.name === 'block' ? '短期记忆' : view.back?.name === 'event' ? '长期记忆' : view.back?.name === 'structure' ? '记忆结构' : section === 'short' ? '短期记忆' : '长期记忆'
      const refresh = () => loadDashboard(namespace, { threadId: conversationId, force: true })
      const selectConversation = (nextConversationId) => {
        setConversationId(nextConversationId)
        return loadDashboard(namespace, { threadId: nextConversationId, force: true })
      }
      const updateSettings = (values) => {
        setSavingSettings(true)
        setError('')
        return api('settings', values, { method: 'PATCH' })
          .then(() => loadDashboard(namespace, { threadId: conversationId, force: true }))
          .catch(reportError)
          .finally(() => setSavingSettings(false))
      }
      const moreBack = () => setView({ name: 'root' })

      let content = null
      if (loading && !selected) content = h(Loading)
      else if (!selected) content = h(Empty, { title: '还没有记忆', copy: '完成一些 DSH 对话后，短期记忆和长期记忆会出现在这里。' })
      else if (view.name === 'event') content = h(EventDetail, { event: view.item, project, source, onBack: goBack, backLabel })
      else if (view.name === 'status') content = h(ProcessingStatus, { overview: selected, blocks: data.blocks, onBack: () => setView({ name: 'root' }), refresh })
      else if (view.name === 'import') content = h(ImportPage, { namespace, onBack: moreBack, refresh })
      else if (view.name === 'structure') content = h(StructurePage, { events: data.events, eventPage: data.pagination?.events, graph: data.graph, openEvent, namespace, onBack: moreBack })
      else if (view.name === 'system') content = h(SystemPage, { selected, blocks: data.blocks, onBack: moreBack, refresh })
      else if (view.name === 'audit') content = h(AuditPage, { audit: data.audit, auditPage: data.pagination?.audit, namespace, onBack: moreBack })
      else if (view.name === 'raw') content = h(RawPage, { data, selected, onBack: moreBack })
      else if (view.name === 'settings') content = h(SettingsPage, { selected, namespace, onBack: moreBack, updateSettings, savingSettings })
      else if (view.name === 'support') content = h(SupportPage, { overview, selected, project, data, recentError, onBack: moreBack })
      else content = h(React.Fragment, null,
        h(FailureAlert, { count: failedCount, onOpen: () => setView({ name: 'status' }) }),
        loading ? h(Loading) : section === 'short' ? h(ShortTermPage, { key: namespace + ':' + conversationId, blocks: data.blocks, blockPage: data.pagination?.blocks, openBlock: data.openBlock, conversations, activeThreadId: conversationId || data.activeThreadId || '', namespace, onConversationChange: selectConversation, refresh }) : section === 'long' ? h(LongTermPage, { key: namespace, events: data.events, eventPage: data.pagination?.events, graph: data.graph, project, query, setQuery, openEvent, namespace }) : h(MoreHome, { setView }))

      return h('main', { className: 'sg-memory', 'data-testid': 'stratagate-memory-ui' },
        h('style', null, css),
        h('header', { className: 'sg-header' },
          h('a', { className: 'sg-brand', href: STAR_REPOSITORY_URL, target: '_blank', rel: 'noopener noreferrer' },
            h('img', { className: 'sg-logo', src: MASCOT_DATA_URL, alt: 'StrataGate 吉祥物' }),
            h('span', { className: 'sg-brand-copy' }, h('span', { className: 'sg-brand-name' }, 'StrataGate-AgentMemory'), h('span', { className: 'sg-brand-kicker' }, '有来源、可追溯的跨会话记忆'))),
          h('div', { className: 'sg-header-usage' },
            h('span', { className: 'sg-usage-count', 'aria-label': 'StrataGate 已在当前工作区中帮助使用记忆 ' + Number(selected?.memoryUseCount || 0) + ' 次。' }, h('strong', { className: 'sg-usage-number' }, Number(selected?.memoryUseCount || 0)), h('span', null, '次记忆采用')),
            h('a', { className: 'sg-header-star', href: STAR_REPOSITORY_URL, target: '_blank', rel: 'noopener noreferrer' }, '为 StrataGate 点 🌟🌟'))),
        h('div', { className: 'sg-project' }, h('span', { className: 'sg-project-label' }, '当前工作区：'), h('select', { className: 'sg-project-select', value: namespace, onChange: (event) => setNamespace(event.target.value), 'aria-label': '当前工作区' }, (overview.namespaces || []).map((item) => h('option', { key: item.namespace, value: item.namespace }, projectName(item, workspaceTitles))))),
        h('nav', { className: 'sg-tabs', 'aria-label': '记忆视图' }, [['short', '短期记忆'], ['long', '长期记忆'], ['more', '更多']].map(([id, label]) => h('button', { key: id, type: 'button', className: 'sg-tab ' + (section === id ? 'active' : ''), 'aria-current': section === id ? 'page' : undefined, onClick: () => goSection(id) }, label))),
        error ? h('div', { className: 'sg-error' }, h('div', { className: 'sg-error-title' }, '暂时无法读取完整记忆'), h('div', null, '已显示能够读取的内容，请稍后重新加载。'), h('details', null, h('summary', null, '技术详情'), h('div', { className: 'sg-code' }, error))) : null,
        h(ProcessingAlert, { visible: processing }),
        h('section', { key: section + ':' + view.name, className: 'sg-view', 'aria-label': 'StrataGate 记忆内容' }, content),
        h('footer', { className: 'sg-footer' }, '发现问题？ ', h('button', { type: 'button', onClick: () => { setSection('more'); setView({ name: 'support' }); setSource(null) } }, '提交反馈')))
    }

    function apply(ctx) {
      const slots = ctx.get('slots')
      if (!slots) return
      const conversationEvents = ctx.get('conversationEvents')
      if (conversationEvents) {
        conversationEvents.register(memoryCitationsDefinition)
        ensureCitationStyles()
        slots.inject('conversation.chat.turnTail', () => slots.register({
          name: 'conversation.chat.turnTail',
          select: selectMemoryCitations,
        }, MemoryCitationTail))
      }
      slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'stratagate-memory', order: 32, label: () => 'StrataGate-AgentMemory' }, (props) => h(MemoryPage, props)))
    }

    exports.name = 'stratagate-dsh'
    exports.inject = ['slots', 'conversationEvents']
    exports.apply = apply
    return module.exports
  },
})
