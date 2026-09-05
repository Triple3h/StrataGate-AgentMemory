<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'
import MemoryDialog from '../components/MemoryDialog.vue'
import SearchBox from '../components/SearchBox.vue'
import ViewScaffold from '../components/ViewScaffold.vue'
import type { DetailKind, DetailRow } from '../api/types.js'
import { rowStatus, rowSummary, rowTitle, rowType } from '../lib/console-data.js'
import { compact } from '../lib/format.js'
import { paramValue, projectOnlyQuery, useQueryNav } from '../lib/query.js'
import { workspace } from '../stores/workspace.js'

const route = useRoute()
const { pushQuery } = useQueryNav()

const TABS: Array<{ id: DetailKind; label: string }> = [
  { id: 'events', label: 'Events' },
  { id: 'elements', label: 'Elements' },
  { id: 'graph', label: 'Graph' },
]

const tab = computed<DetailKind>(() => {
  const value = paramValue(route.query, 'tab')
  return value === 'elements' || value === 'graph' ? value : 'events'
})

const query = computed(() => paramValue(route.query, 'q').toLowerCase())
const rows = computed<DetailRow[]>(() => {
  const snapshot = workspace.snapshot
  return tab.value === 'events' ? (snapshot?.events ?? []) : tab.value === 'elements' ? (snapshot?.elements ?? []) : (snapshot?.graphNodes ?? [])
})
const filtered = computed(() => rows.value.filter((row) => !query.value || JSON.stringify(row).toLowerCase().includes(query.value)))

const selectedId = ref('')

const selectedRowDetail = computed<DetailRow | null>(() => (selectedId.value ? rows.value.find((row) => row.id === selectedId.value) ?? null : null))
</script>

<template>
  <ViewScaffold title="记忆结构">
    <nav class="tabs" aria-label="记忆类型">
      <RouterLink
        v-for="item in TABS"
        :key="item.id"
        class="tab"
        :class="{ active: tab === item.id }"
        :to="{ query: { ...projectOnlyQuery(route.query), tab: item.id === 'events' ? undefined : item.id } }"
        :aria-current="tab === item.id ? 'page' : undefined"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
    <div class="toolbar">
      <SearchBox :model-value="paramValue(route.query, 'q')" placeholder="搜索名称或内容" @submit="(value) => pushQuery({ q: value || undefined })" />
      <span class="count">{{ filtered.length }} 条记录</span>
    </div>
    <div v-if="filtered.length" class="grid">
      <button v-for="row in filtered" :key="row.id" class="memory-item" type="button" @click="selectedId = row.id">
        <h3>{{ rowTitle(row) }}</h3>
        <p>{{ compact(rowSummary(row)) }}</p>
        <span class="tags">
          <span class="badge">{{ rowType(row, tab) }}</span>
          <span v-if="rowStatus(row)" class="badge">{{ rowStatus(row) }}</span>
        </span>
      </button>
    </div>
    <EmptyState v-else title="暂无匹配的记忆" />
    <section v-if="tab === 'graph' && (workspace.snapshot?.graphEdges?.length ?? 0) > 0" class="section">
      <h2>关系</h2>
      <pre class="json">{{ JSON.stringify(workspace.snapshot?.graphEdges, null, 2) }}</pre>
    </section>
    <MemoryDialog v-if="selectedRowDetail" :row="selectedRowDetail" @close="selectedId = ''" />
  </ViewScaffold>
</template>
