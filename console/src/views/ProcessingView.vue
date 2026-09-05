<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '../components/EmptyState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import ViewScaffold from '../components/ViewScaffold.vue'
import type { JobRow } from '../api/types.js'
import { fmt } from '../lib/format.js'
import { workspace } from '../stores/workspace.js'

const sections = computed(() => {
  const snapshot = workspace.snapshot
  return [
    { title: '摘要任务', items: snapshot?.summaryJobs ?? [] },
    { title: 'Event 提取', items: snapshot?.extractionJobs ?? [] },
    { title: 'Element 投影', items: snapshot?.elementProjectionJobs ?? [] },
    { title: 'Graph 投影', items: snapshot?.graphProjectionJobs ?? [] },
  ]
})

function jobLabel(job: JobRow): string {
  return job.blockId || job.id || '未知任务'
}
</script>

<template>
  <ViewScaffold title="处理状态">
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
            <tr v-for="(job, index) in section.items" :key="job.id ?? index">
              <td>
                <span class="scope-id">{{ jobLabel(job) }}</span>
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
  </ViewScaffold>
</template>
