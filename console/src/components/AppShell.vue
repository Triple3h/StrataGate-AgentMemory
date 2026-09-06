<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Activity, BookOpen, CheckCheck, Download, Layers, LayoutDashboard, MessageSquare, Moon, Settings, Sparkles, Sun } from 'lucide-vue-next'
import { isDarkTheme, toggleTheme } from '../composables/theme.js'
import { workspace } from '../stores/workspace.js'
import MainPane from './MainPane.vue'
import ProjectBar from './ProjectBar.vue'

const route = useRoute()

const NAV_GROUPS = [
  {
    label: '工作区',
    items: [
      { path: '/dashboard', title: '记忆总览', icon: LayoutDashboard },
      { path: '/sessions', title: '对话来源', icon: MessageSquare },
      { path: '/blocks', title: 'Block 分层', icon: Layers },
      { path: '/memory', title: '记忆结构', icon: BookOpen },
    ],
  },
  {
    label: '运行',
    items: [
      { path: '/processing', title: '处理状态', icon: Activity },
      { path: '/audit', title: '使用审计', icon: CheckCheck },
    ],
  },
  {
    label: '配置',
    items: [
      { path: '/import', title: '导入', icon: Download },
      { path: '/settings', title: '设置', icon: Settings },
    ],
  },
] as const

// 工作区页面按所选项目取数；运行/配置页是全局视图，自带页内筛选。
const WORKSPACE_PATHS = new Set<string>(NAV_GROUPS[0].items.map(({ path }) => path))
const showProjectBar = computed(() => WORKSPACE_PATHS.has(route.path))

const dark = ref(isDarkTheme())

// View switches keep the project scope but drop per-view filters, as before.
function navTo(path: string) {
  const project = typeof route.query.project === 'string' ? route.query.project : ''
  return { path, query: project ? { project } : {} }
}

function onTheme() {
  toggleTheme()
  dark.value = isDarkTheme()
}
</script>

<template>
  <header class="top">
    <RouterLink class="brand" :to="navTo('/dashboard')">
      <span class="logo"><Sparkles /></span>StrataGate
    </RouterLink>
    <div class="top-status">
      <span class="chip"><span class="status-dot" :class="{ off: Boolean(workspace.error) }"></span>{{ workspace.error ? '连接异常' : '已连接' }}</span>
      <span class="chip">只读审计</span>
      <button class="icon-button" type="button" :aria-label="dark ? '切换到浅色主题' : '切换到深色主题'" :title="dark ? '切换到浅色主题' : '切换到深色主题'" @click="onTheme">
        <Sun v-if="dark" />
        <Moon v-else />
      </button>
    </div>
  </header>
  <div class="layout">
    <aside class="sidebar">
      <nav aria-label="主导航">
        <div v-for="group in NAV_GROUPS" :key="group.label" class="nav-group">
          <span class="nav-label">{{ group.label }}</span>
          <RouterLink
            v-for="item in group.items"
            :key="item.path"
            class="nav-link"
            :class="{ active: route.path === item.path }"
            :to="navTo(item.path)"
            :aria-current="route.path === item.path ? 'page' : undefined"
          >
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
          </RouterLink>
        </div>
      </nav>
    </aside>
    <MainPane>
      <ProjectBar v-if="showProjectBar" />
      <RouterView />
    </MainPane>
  </div>
</template>
