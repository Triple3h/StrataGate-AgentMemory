import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import OverviewView from './views/OverviewView.vue'
import ConversationsView from './views/ConversationsView.vue'
import BlocksView from './views/BlocksView.vue'
import StructureView from './views/StructureView.vue'
import ProcessingView from './views/ProcessingView.vue'
import AuditView from './views/AuditView.vue'
import ImportView from './views/ImportView.vue'
import SettingsView from './views/SettingsView.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'overview', component: OverviewView, meta: { title: '记忆总览' } },
  { path: '/sessions', name: 'conversations', component: ConversationsView, meta: { title: '对话来源' } },
  { path: '/blocks', name: 'blocks', component: BlocksView, meta: { title: 'Block 分层' } },
  { path: '/memory', name: 'structure', component: StructureView, meta: { title: '记忆结构' } },
  { path: '/processing', name: 'processing', component: ProcessingView, meta: { title: '处理状态' } },
  { path: '/audit', name: 'audit', component: AuditView, meta: { title: '使用审计' } },
  { path: '/import', name: 'import', component: ImportView, meta: { title: '导入' } },
  { path: '/settings', name: 'settings', component: SettingsView, meta: { title: '设置' } },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  const title = to.meta.title
  document.title = (typeof title === 'string' ? title : 'StrataGate Memory Console') + ' · StrataGate'
})
