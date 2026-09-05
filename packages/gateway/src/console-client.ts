// The console is shipped inline so local and packaged Gateways use the same assets.
export const CONSOLE_CLIENT = String.raw`
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const fmt = value => { const d = new Date(value); return !value || Number.isNaN(d.getTime()) ? '时间未知' : new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false}).format(d); };
const storage = { get(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } }, set(key,value) { try { localStorage.setItem(key,value); } catch {} } };
const state = {dashboard:null, snapshot:null, namespace:'', view:'overview', subview:'events', query:'', agentFilter:'', sourceFilter:'', session:'', selected:null, loading:false, authenticated:null, error:'', loggingIn:false};
let generation = 0;
let snapshotNamespace = '';
let returnFocus = null;
const icon = name => ICONS[name] || ICONS.memory;
const iconButton = (action, label, name, extra='') => '<button class="icon-button" data-action="'+action+'" aria-label="'+esc(label)+'" title="'+esc(label)+'" '+extra+'>'+icon(name)+'</button>';
const badge = name => '<span class="badge source-badge '+(name==='codex'?'codex':name==='zcode'?'zcode':'')+'">'+esc(name)+'</span>';
const unique = values => [...new Set(values.filter(Boolean))];
function routeUrl(view=state.view, changes={}) {
  const values = {...state, ...changes};
  const url = new URL(ROUTES.find(r=>r.view===view)?.path || '/dashboard', location.origin);
  if(values.namespace) url.searchParams.set('project', values.namespace);
  if(values.query) url.searchParams.set('q', values.query);
  if(view==='conversations') {
    if(values.agentFilter) url.searchParams.set('agent',values.agentFilter);
    if(values.sourceFilter) url.searchParams.set('source',values.sourceFilter);
    if(values.session) url.searchParams.set('session',values.session);
  }
  if(view==='structure' && values.subview!=='events') url.searchParams.set('tab',values.subview);
  return url.pathname+url.search;
}
function readRoute() {
  const url = new URL(location.href), path = url.pathname.replace(/\/$/,'') || '/';
  state.view = ROUTES.find(r=>r.path===path)?.view || 'overview';
  state.namespace = url.searchParams.has('project') ? url.searchParams.get('project') : storage.get('stratagate_console_project');
  state.query = url.searchParams.get('q') || '';
  state.agentFilter = url.searchParams.get('agent') || '';
  state.sourceFilter = url.searchParams.get('source') || '';
  state.session = state.view==='conversations' ? url.searchParams.get('session') || '' : '';
  state.subview = ['events','elements','graph'].includes(url.searchParams.get('tab')) ? url.searchParams.get('tab') : 'events';
  state.selected = null;
}
async function navigate(url, replace=false) {
  history[replace?'replaceState':'pushState']({},'',url);
  readRoute();
  if(state.dashboard && state.namespace!==snapshotNamespace) await loadData(false);
  else render();
}
async function api(path, signal) {
  const token=storage.get('stratagate_gateway_token');
  const res=await fetch(path,{cache:'no-store', signal, headers:token?{Authorization:'Bearer '+token}:{}});
  const data=await res.json().catch(()=>({}));
  if(res.status===401) { state.authenticated=false; throw new Error('登录已失效，请重新输入 Gateway Token。'); }
  if(!res.ok) throw new Error(data.error || '请求失败（HTTP '+res.status+'）');
  state.authenticated=true;
  return data;
}
let activeRequest;
async function loadData(refreshDashboard=true) {
  const current=++generation;
  activeRequest?.abort();
  const controller=new AbortController(); activeRequest=controller;
  state.loading=true; state.error=''; state.snapshot=null; snapshotNamespace=''; render();
  try {
    if(refreshDashboard || !state.dashboard) {
      const dashboard=await api('/v1/dashboard',controller.signal);
      if(current!==generation) return;
      state.dashboard=dashboard;
    }
    const rows=state.dashboard.namespaces || [];
    const explicit=new URL(location.href).searchParams.has('project');
    if(!rows.some(r=>r.namespace===state.namespace)) {
      if(explicit && state.namespace) throw new Error('链接中的项目不存在或已移除，请重新选择项目。');
      state.namespace=[...rows].sort((a,b)=>(Date.parse(b.lastActivityAt)||0)-(Date.parse(a.lastActivityAt)||0))[0]?.namespace || '';
    }
    if(state.namespace) {
      const namespace=state.namespace;
      const snapshot=await api('/v1/console/snapshot?namespace='+encodeURIComponent(namespace),controller.signal);
      if(current!==generation) return;
      state.snapshot=snapshot; snapshotNamespace=namespace;
      storage.set('stratagate_console_project',namespace);
    }
    history.replaceState({},'',routeUrl());
  } catch(error) {
    if(current!==generation || error.name==='AbortError') return;
    state.error=error.message || String(error);
  } finally { if(current===generation) { state.loading=false; render(); } }
}
function selectedRow() { return (state.dashboard?.namespaces || []).find(r=>r.namespace===state.namespace); }
function projectLabel(row) {
  const name=row.projectName || row.label?.replace(/^项目\s*/,'') || row.namespace;
  const legacy=!row.namespace.startsWith('shared:');
  return name+' · '+(legacy?'历史 '+row.namespace.split(':')[0]:'共享')+' · '+(row.sourceAdapters?.join(', ') || '未标注来源')+' · '+row.namespace.slice(-6);
}
function projectBar() {
  const rows=state.dashboard?.namespaces || [], current=selectedRow();
  return '<section class="scope-bar" aria-label="项目范围"><div class="project-field"><label for="project-select">当前项目</label><select id="project-select" '+(!rows.length?'disabled':'')+'>'+
    (!current?'<option value="">'+(state.namespace?'选择有效项目':'暂无项目')+'</option>':'')+
    rows.map(row=>'<option value="'+esc(row.namespace)+'" '+(row.namespace===state.namespace?'selected':'')+'>'+esc(projectLabel(row))+'</option>').join('')+
    '</select></div><div class="scope-meta">'+(current?(current.sourceAdapters || []).map(badge).join('')+'<span class="muted">'+esc(current.userId)+' · '+current.turns+' 轮</span>':'')+'</div></section>';
}
function heading(title, subtitle='') {
  return '<header class="page-heading"><div><h1>'+esc(title)+'</h1>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div><div class="actions">'+iconButton('refresh','刷新','refresh',state.loading?'disabled':'')+'</div></header>';
}
function messages() { const s=state.snapshot; return [...(s?.openTail || []),...(s?.blocks || []).flatMap(b=>b.l5Raw || [])].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)); }
function sessions() {
  const groups=new Map();
  for(const m of messages()) {
    const id=m.conversationId || m.threadId || '__legacy__';
    const row=groups.get(id) || {id,messages:[],last:null,title:''};
    row.messages.push(m); row.last=m.createdAt;
    if(!row.title && m.role==='user') row.title=compact(m.content).slice(0,120);
    groups.set(id,row);
  }
  return [...groups.values()].sort((a,b)=>Date.parse(b.last)-Date.parse(a.last));
}
function empty(title, detail='', reset=false) { return '<div class="empty"><strong>'+esc(title)+'</strong>'+(detail?'<p>'+esc(detail)+'</p>':'')+(reset?'<button class="button" data-action="reset-filters">清除筛选</button>':'')+'</div>'; }
function searchBox(placeholder) { return '<form class="search" id="search-form"><input id="query" type="search" value="'+esc(state.query)+'" placeholder="'+esc(placeholder)+'" aria-label="'+esc(placeholder)+'"><button class="icon-button" type="submit" title="搜索" aria-label="搜索">'+icon('search')+'</button></form>'; }
function filter(values, value, title, id) {
  return '<label class="filter"><span>'+title+'</span><select id="'+id+'" aria-label="'+title+'筛选"><option value="">全部'+title+'</option>'+unique([...values,value]).sort().map(v=>'<option value="'+esc(v)+'" '+(v===value?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
}
function sessionTable(rows) {
  return '<div class="table-wrap"><table class="session-table"><thead><tr><th>对话</th><th>来源 / Agent</th><th>消息 / 轮次</th><th>最近活动</th></tr></thead><tbody>'+rows.map(row=>{
    const sources=unique(row.messages.map(m=>m.sourceAdapter)), agents=unique(row.messages.map(m=>m.agentId));
    return '<tr><td class="session-cell"><a class="session-title" data-route href="'+esc(routeUrl('conversations',{session:row.id}))+'">'+esc(row.title || '历史对话')+'</a><span class="session-id" title="'+esc(row.id)+'">'+esc(row.id)+'</span></td><td>'+(sources.length?sources.map(badge).join(''):badge('未标注'))+'<div class="row-agents">'+esc(agents.join(' · ') || '未知 Agent')+'</div></td><td class="numeric">'+row.messages.length+' <span class="muted">消息</span> / '+row.messages.filter(m=>m.role==='user').length+' <span class="muted">轮</span></td><td class="date">'+esc(fmt(row.last))+'</td></tr>';
  }).join('')+'</tbody></table></div>';
}
function overview() {
  const row=selectedRow() || {}, s=state.snapshot || {}, recent=sessions();
  const stats=[['对话',recent.length,row.turns || 0,'轮对话'],['Blocks',row.blocks || 0,row.openTailMessages || 0,'条未封存消息'],['Events',row.events || 0,row.processingJobs || 0,'个待处理任务'],['Elements',row.elements || 0,row.graphNodes || 0,'个图谱节点']];
  return heading('记忆总览',row.projectName || row.label || '')+'<section class="stats" aria-label="当前项目统计">'+stats.map(([label,value,sub,unit])=>'<div class="stat"><span>'+label+'</span><strong>'+value+'</strong><small>'+sub+' '+unit+'</small></div>').join('')+'</section><div class="summary-strip"><span>来源<b>'+esc((row.sourceAdapters || []).join('、') || '无')+'</b></span><span>使用回执<b>'+ (s.usageReceipts?.length || 0)+'</b></span><span>最近活动<b>'+esc(fmt(recent[0]?.last))+'</b></span></div><section class="section"><div class="section-heading"><h2>最近对话</h2><a class="button" data-route href="'+esc(routeUrl('conversations',{query:'',session:''}))+'">查看全部 '+icon('arrow')+'</a></div>'+(recent.length?sessionTable(recent.slice(0,5)):empty('当前项目还没有对话'))+'</section>';
}
function conversations() {
  const rows=sessions(), query=state.query.toLowerCase();
  const filtered=rows.filter(row=>(!query || row.id.toLowerCase().includes(query) || row.messages.some(m=>String(m.content || '').toLowerCase().includes(query))) && row.messages.some(m=>(!state.agentFilter || m.agentId===state.agentFilter) && (!state.sourceFilter || m.sourceAdapter===state.sourceFilter)));
  const hasFilters=Boolean(state.query || state.agentFilter || state.sourceFilter);
  return heading('对话来源')+'<div class="toolbar">'+searchBox('搜索对话或消息内容')+'<div class="filters">'+filter(rows.flatMap(r=>r.messages.map(m=>m.agentId)),state.agentFilter,'Agent','agent-filter')+filter(rows.flatMap(r=>r.messages.map(m=>m.sourceAdapter)),state.sourceFilter,'来源','source-filter')+'</div><span class="count">'+filtered.length+' / '+rows.length+' 个对话</span>'+(hasFilters?iconButton('reset-filters','清除筛选','reset'):'')+'</div>'+(filtered.length?sessionTable(filtered):empty(hasFilters?'没有匹配的对话':'当前项目还没有对话','',hasFilters));
}
function blocks() {
  const all=state.snapshot?.blocks || [], query=state.query.toLowerCase(), rows=all.filter(b=>!query || JSON.stringify(b).toLowerCase().includes(query));
  const levels=b=>[b.l0Title,b.l1Summary,(b.l2Keypoints || []).join('\n'),b.l3Condensed,b.l4Readable,(b.l5Raw || []).map(m=>m.role+': '+m.content).join('\n\n')];
  return heading('Block 分层')+'<div class="toolbar">'+searchBox('搜索 Block 标题、摘要或消息')+'<span class="count">'+rows.length+' / '+all.length+' 个 Block</span></div>'+(rows.length?rows.map(b=>'<article class="item"><div class="item-heading"><div><h2>'+esc(b.l0Title || 'Block #'+b.sequence)+'</h2><small>Turn '+esc(b.startTurn)+'–'+esc(b.endTurn)+' · '+esc(fmt(b.createdAt))+'</small></div><span class="badge '+(b.processingStatus==='ready'?'':'warn')+'">'+esc(b.processingStatus || 'pending')+'</span></div>'+levels(b).map((v,i)=>'<details class="layer" '+(i===0?'open':'')+'><summary>L'+i+' · '+['标题','摘要','要点','压缩内容','可读内容','原始消息'][i]+'</summary><pre>'+esc(v || '尚未生成')+'</pre></details>').join('')+'</article>').join(''):empty('暂无 Block'));
}
function memory() {
  const s=state.snapshot || {}, tab=state.subview, query=state.query.toLowerCase();
  const rows=(tab==='events'?s.events:tab==='elements'?s.elements:s.graphNodes) || [];
  const filtered=rows.filter(r=>!query || JSON.stringify(r).toLowerCase().includes(query));
  return heading('记忆结构')+'<nav class="tabs" aria-label="记忆类型">'+[['events','Events'],['elements','Elements'],['graph','Graph']].map(([id,label])=>'<a class="tab '+(tab===id?'active':'')+'" data-route href="'+esc(routeUrl('structure',{subview:id,query:''}))+'" '+(tab===id?'aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav><div class="toolbar">'+searchBox('搜索名称或内容')+'<span class="count">'+filtered.length+' 条记录</span></div>'+(filtered.length?'<div class="grid">'+filtered.map(r=>'<button class="memory-item" data-kind="'+tab+'" data-id="'+esc(r.id)+'"><h3>'+esc(r.title || r.name || r.id)+'</h3><p>'+esc(compact(r.summary || r.narrative || r.currentState || '暂无摘要').slice(0,240))+'</p><span class="tags"><span class="badge">'+esc(r.type || r.temporal?.eventType || tab)+'</span><span class="badge">'+esc(r.status || r.temporal?.status || '')+'</span></span></button>').join('')+'</div>':empty('暂无匹配的记忆'))+(tab==='graph' && s.graphEdges?.length?'<section class="section"><h2>关系</h2><pre class="json">'+esc(JSON.stringify(s.graphEdges,null,2))+'</pre></section>':'');
}
function processing() {
  const s=state.snapshot || {};
  return heading('处理状态')+[['摘要任务',s.summaryJobs],['Event 提取',s.extractionJobs],['Element 投影',s.elementProjectionJobs],['Graph 投影',s.graphProjectionJobs]].map(([title,items])=>'<section class="section"><div class="section-heading"><h2>'+title+'</h2><span class="count">'+(items?.length || 0)+' 个任务</span></div>'+(items?.length?'<div class="table-wrap"><table><thead><tr><th>任务</th><th>状态</th><th>更新时间</th></tr></thead><tbody>'+items.map(j=>'<tr><td><span class="scope-id">'+esc(j.blockId || j.id)+'</span>'+(j.lastError?'<p class="item-summary">'+esc(j.lastError)+'</p>':'')+'</td><td><span class="badge '+(j.status==='failed'?'error':'')+'">'+esc(j.status)+'</span></td><td class="date">'+esc(fmt(j.updatedAt))+'</td></tr>').join('')+'</tbody></table></div>':empty('暂无任务'))+'</section>').join('');
}
function audit() {
  const rows=[...(state.snapshot?.usageReceipts || [])].reverse();
  return heading('使用审计',rows.length+' 条使用回执')+(rows.length?rows.map(r=>'<article class="item"><div class="item-heading"><h2>采用 '+((r.eventIds?.length || 0)+(r.elementIds?.length || 0))+' 条记忆</h2><time class="date">'+esc(fmt(r.createdAt))+'</time></div><span class="scope-id">'+esc(r.id)+'</span><pre class="json">'+esc(JSON.stringify({eventIds:r.eventIds,elementIds:r.elementIds,audit:r.audit},null,2))+'</pre></article>').join(''):empty('还没有使用记录'));
}
function settings() {
  const s=state.snapshot || {}, row=selectedRow() || {};
  return heading('设置')+'<dl class="facts">'+[['项目',row.projectName || row.label || ''],['用户',row.userId || ''],['命名空间',state.namespace],['Agent',(row.agents || []).join('、')],['来源',(row.sourceAdapters || []).join('、')],['Block 轮数',s.blockTurnSize ?? ''],['衰减系数',s.blockDecayLambda ?? ''],['Gateway',location.origin],['版本修订',row.revision ?? '']].map(([label,value])=>'<dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd>').join('')+'</dl>';
}
function imports() { return heading('导入')+'<div class="notice">当前 Gateway 暂不支持从控制台导入。请在 DSH 插件的「导入别的 AI 记忆」中完成导入。</div>'; }
function sourceMessages(ids) { const refs=new Set(ids || []); return messages().filter(m=>refs.has(m.id)); }
function messageList(rows) { return rows.map(m=>'<article class="message"><header><strong>'+esc(m.role==='user'?'用户':m.role==='assistant'?'助手':m.role)+'</strong>'+badge(m.sourceAdapter || '未标注')+'<time class="muted">'+esc(fmt(m.createdAt))+'</time></header><div class="message-content">'+esc(m.content)+'</div></article>').join(''); }
function modal() {
  let title='', id='', body='';
  if(state.session) {
    const row=sessions().find(r=>r.id===state.session); title=row?.title || '对话详情'; id=state.session;
    body=row?messageList(row.messages):empty('当前项目中未找到此对话');
  } else if(state.selected) {
    const {kind,id:ref}=state.selected, s=state.snapshot || {};
    const row=(kind==='events'?s.events:kind==='elements'?s.elements:s.graphNodes)?.find(r=>r.id===ref) || {};
    title=row.title || row.name || ref; id=ref;
    const refs=row.sourceMessageIds || (row.sourceEventIds || []).flatMap(e=>s.events?.find(v=>v.id===e)?.sourceMessageIds || []);
    body='<pre class="json">'+esc(JSON.stringify(row,null,2))+'</pre><section class="section"><h2>来源消息</h2>'+messageList(sourceMessages(refs))+'</section>';
  } else return '';
  return '<dialog id="detail-dialog" class="dialog" aria-labelledby="detail-title"><header class="dialog-head"><div><h2 id="detail-title">'+esc(title)+'</h2><p class="scope-id">'+esc(id)+'</p></div><div class="actions">'+iconButton('close-detail','关闭详情','close')+'</div></header>'+body+'</dialog>';
}
function loginPage() {
  return '<main class="login"><section class="login-box"><a href="/dashboard" class="brand"><span class="logo">'+icon('brand')+'</span>StrataGate</a><h1>登录记忆控制台</h1><form id="login-form"><label for="token">Gateway Token</label><input id="token" name="token" type="password" autocomplete="off" required><button class="button primary" '+(state.loggingIn?'disabled':'')+'>'+(state.loggingIn?'正在验证…':'使用 Token 登录')+'</button></form>'+(state.error?'<div class="error" role="alert">'+esc(state.error)+'</div>':'')+'</section></main>';
}
function render() {
  const root=document.getElementById('app');
  if(state.authenticated===false) { root.innerHTML=loginPage(); return; }
  const route=ROUTES.find(r=>r.view===state.view) || ROUTES[0];
  document.title=route.title+' · StrataGate';
  const views={overview,conversations,blocks,structure:memory,processing,audit,import:imports,settings};
  const content=state.loading?heading(route.title)+empty('正在读取项目数据…'):state.error?'':!state.namespace?heading(route.title)+empty('还没有项目数据'):views[state.view]();
  root.innerHTML='<header class="top"><a class="brand" data-route href="'+esc(routeUrl('overview',{query:'',session:''}))+'"><span class="logo">'+icon('brand')+'</span>StrataGate</a><div class="top-status"><span class="status-dot '+(state.error?'off':'')+'"></span><span>'+(state.error?'连接异常':'Memory Console')+'</span><span>只读审计</span></div></header><div class="layout"><aside class="sidebar"><nav aria-label="主导航">'+ROUTES.map(r=>'<a class="nav-link '+(r.view===state.view?'active':'')+'" '+(r.view===state.view?'aria-current="page"':'')+' data-route href="'+esc(routeUrl(r.view,{query:'',session:''}))+'">'+icon(r.icon)+'<span>'+r.title+'</span></a>').join('')+'</nav></aside><main class="main" aria-busy="'+state.loading+'">'+projectBar()+(state.error?heading(route.title)+'<div class="error" role="alert">'+esc(state.error)+'</div>':'')+content+'</main></div>'+(!state.loading && !state.error?modal():'');
  const dialog=document.getElementById('detail-dialog');
  if(dialog) { dialog.showModal(); dialog.addEventListener('cancel',event=>{event.preventDefault();closeDetail();}); dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY<rect.bottom)closeDetail();}); }
}
function closeDetail() { state.selected=null; if(state.session) void navigate(routeUrl('conversations',{session:''})); else render(); if(returnFocus) document.querySelector(returnFocus)?.focus(); }
document.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target:null;
  const link=target?.closest('a[data-route]');
  if(link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button===0) {
    event.preventDefault(); returnFocus='a[href="'+CSS.escape(link.getAttribute('href'))+'"]'; void navigate(link.href); return;
  }
  const item=target?.closest('[data-kind]');
  if(item) { returnFocus='[data-kind="'+item.dataset.kind+'"][data-id="'+CSS.escape(item.dataset.id)+'"]'; state.selected={kind:item.dataset.kind,id:item.dataset.id};render();return; }
  const action=target?.closest('[data-action]')?.dataset.action;
  if(action==='refresh') void loadData();
  if(action==='reset-filters') void navigate(routeUrl(state.view,{query:'',agentFilter:'',sourceFilter:'',session:''}));
  if(action==='close-detail') closeDetail();
});
document.addEventListener('change',event=>{
  const target=event.target;
  if(target.id==='project-select' && target.value) void navigate(routeUrl(state.view,{namespace:target.value,query:'',agentFilter:'',sourceFilter:'',session:''}));
  if(target.id==='agent-filter') void navigate(routeUrl(state.view,{agentFilter:target.value,session:''}));
  if(target.id==='source-filter') void navigate(routeUrl(state.view,{sourceFilter:target.value,session:''}));
});
document.addEventListener('submit',event=>{
  if(event.target.id==='search-form') { event.preventDefault(); void navigate(routeUrl(state.view,{query:document.getElementById('query').value,session:''})); }
  if(event.target.id==='login-form') { event.preventDefault(); void login(new FormData(event.target).get('token')); }
});
async function login(token) {
  if(!String(token || '').trim() || state.loggingIn) return;
  state.loggingIn=true;state.error='';render();
  try { const res=await fetch('/health',{cache:'no-store',headers:{Authorization:'Bearer '+String(token).trim()}});if(!res.ok)throw new Error('Token 无效（HTTP '+res.status+'）');storage.set('stratagate_gateway_token',String(token).trim());state.authenticated=true;await loadData(); }
  catch(error) { state.error=error.message;state.authenticated=false; }
  finally { state.loggingIn=false;render(); }
}
window.addEventListener('popstate',()=>{readRoute();if(state.namespace!==snapshotNamespace)void loadData(false);else render();});
readRoute();
void loadData();
`;
