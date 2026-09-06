<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ApiError, api } from '../api/client.js'
import EmptyState from '../components/EmptyState.vue'
import ProjectFilter from '../components/ProjectFilter.vue'
import ViewScaffold from '../components/ViewScaffold.vue'
import type { UsageReceiptRow } from '../api/types.js'
import { fmt } from '../lib/format.js'
import { markUnauthorized } from '../stores/session.js'
import { workspace } from '../stores/workspace.js'

const receipts = ref<UsageReceiptRow[]>([])
const error = ref('')
const loading = ref(false)
const projectFilter = ref('')

const filtered = computed(() =>
  receipts.value.filter((receipt) => !projectFilter.value || receipt.namespace === projectFilter.value),
)

function adoptedCount(receipt: UsageReceiptRow): number {
  return receipt.eventIds.length + receipt.elementIds.length
}

async function loadReceipts(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const payload = await api<{ status: string; receipts: UsageReceiptRow[] }>('/v1/console/receipts')
    receipts.value = payload.receipts ?? []
  } catch (value) {
    if (value instanceof ApiError && value.status === 401) {
      markUnauthorized()
      return
    }
    error.value = value instanceof Error ? value.message : String(value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadReceipts()
})

// The page-level refresh button drives loadWorkspace; pick up its completion.
watch(
  () => workspace.loading,
  (loading, previous) => {
    if (!loading && previous) void loadReceipts()
  },
)
</script>

<template>
  <ViewScaffold title="使用审计" :subtitle="`全部项目 · ${filtered.length} 条使用回执`" global>
    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <EmptyState v-if="loading && !receipts.length" title="正在读取回执…" />
    <template v-else-if="!error">
      <div class="toolbar">
        <ProjectFilter v-model="projectFilter" />
        <span class="count">{{ filtered.length }} 条回执</span>
      </div>
      <template v-if="filtered.length">
        <article v-for="receipt in filtered" :key="receipt.namespace + ':' + receipt.id" class="item">
          <div class="item-heading">
            <h2>采用 {{ adoptedCount(receipt) }} 条记忆</h2>
            <time class="date">{{ fmt(receipt.createdAt) }}</time>
          </div>
          <div class="job-task">
            <span class="badge" :title="receipt.namespace">{{ receipt.projectName || receipt.namespace }}</span>
            <span class="scope-id">{{ receipt.id }}</span>
          </div>
          <pre class="json">{{ JSON.stringify({ eventIds: receipt.eventIds, elementIds: receipt.elementIds, audit: receipt.audit }, null, 2) }}</pre>
        </article>
      </template>
      <EmptyState v-else title="还没有使用记录" />
    </template>
  </ViewScaffold>
</template>
