<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ApiError, api } from '../api/client.js'
import EmptyState from '../components/EmptyState.vue'
import ProjectFilter from '../components/ProjectFilter.vue'
import StatusBadge from '../components/StatusBadge.vue'
import ViewScaffold from '../components/ViewScaffold.vue'
import type { ProcessingJobRow } from '../api/types.js'
import { fmt } from '../lib/format.js'
import { markUnauthorized } from '../stores/session.js'
import { workspace } from '../stores/workspace.js'

const jobs = ref<ProcessingJobRow[]>([])
const error = ref('')
const loading = ref(false)
const projectFilter = ref('')

const kinds = [
  { kind: 'summary', title: '摘要任务' },
  { kind: 'extraction', title: 'Event 提取' },
  { kind: 'elementProjection', title: 'Element 投影' },
  { kind: 'graphProjection', title: 'Graph 投影' },
] as const

const sections = computed(() =>
  kinds.map(({ kind, title }) => ({
    title,
    items: jobs.value
      .filter((job) => job.kind === kind && (!projectFilter.value || job.namespace === projectFilter.value))
      .sort((a, b) => (Date.parse(b.updatedAt ?? '') || 0) - (Date.parse(a.updatedAt ?? '') || 0)),
  })),
)

const total = computed(() =>
  jobs.value.filter((job) => !projectFilter.value || job.namespace === projectFilter.value).length,
)

function jobLabel(job: ProcessingJobRow): string {
  return job.id || '未知任务'
}

function projectLabel(job: ProcessingJobRow): string {
  return job.projectName || job.namespace
}

async function loadJobs(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const payload = await api<{ status: string; jobs: ProcessingJobRow[] }>('/v1/console/jobs')
    jobs.value = payload.jobs ?? []
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
  void loadJobs()
})

// The page-level refresh button drives loadWorkspace; pick up its completion.
watch(
  () => workspace.loading,
  (loading, previous) => {
    if (!loading && previous) void loadJobs()
  },
)
</script>

<template>
  <ViewScaffold title="处理状态" :subtitle="`全部项目 · ${total} 个任务`" global>
    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <EmptyState v-if="loading && !total" title="正在读取任务…" />
    <template v-else-if="!error">
      <div class="toolbar">
        <ProjectFilter v-model="projectFilter" />
        <span class="count">{{ total }} 个任务</span>
      </div>
      <section v-for="section in sections" :key="section.title" class="section">
        <div class="section-heading">
          <h2>{{ section.title }}</h2>
          <span class="count">{{ section.items.length }} 个任务</span>
        </div>
        <div v-if="section.items.length" class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>任务</th>
                <th>状态</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="job in section.items" :key="job.kind + ':' + job.namespace + ':' + job.id">
                <td>
                  <div class="job-task">
                    <span class="badge" :title="job.namespace">{{ projectLabel(job) }}</span>
                    <span class="scope-id">{{ jobLabel(job) }}</span>
                  </div>
                  <p v-if="job.lastError" class="item-summary">{{ job.lastError }}</p>
                </td>
                <td><StatusBadge :status="job.status" /></td>
                <td class="date">{{ fmt(job.updatedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState v-else title="暂无任务" />
      </section>
    </template>
  </ViewScaffold>
</template>
