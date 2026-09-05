<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight } from 'lucide-vue-next'
import EmptyState from '../components/EmptyState.vue'
import SessionCard from '../components/SessionCard.vue'
import ViewScaffold from '../components/ViewScaffold.vue'
import { groupSessions, snapshotMessages } from '../lib/console-data.js'
import { fmt } from '../lib/format.js'
import { projectOnlyQuery } from '../lib/query.js'
import { selectedRow, workspace } from '../stores/workspace.js'

const route = useRoute()

const row = computed(() => selectedRow())
const recent = computed(() => groupSessions(snapshotMessages(workspace.snapshot)))
const stats = computed(() => [
  { label: '对话', value: recent.value.length, sub: (row.value?.turns ?? 0) + ' 轮对话' },
  { label: 'Blocks', value: row.value?.blocks ?? 0, sub: (row.value?.openTailMessages ?? 0) + ' 条未封存消息' },
  { label: 'Events', value: row.value?.events ?? 0, sub: (row.value?.processingJobs ?? 0) + ' 个待处理任务' },
  { label: 'Elements', value: row.value?.elements ?? 0, sub: (row.value?.graphNodes ?? 0) + ' 个图谱节点' },
])
</script>

<template>
  <ViewScaffold title="记忆总览" :subtitle="row?.projectName ?? row?.label ?? ''">
    <section class="stats" aria-label="当前项目统计">
      <div v-for="stat in stats" :key="stat.label" class="stat">
        <span>{{ stat.label }}</span>
        <strong>{{ stat.value }}</strong>
        <small>{{ stat.sub }}</small>
      </div>
    </section>
    <div class="summary-strip">
      <span>来源<b>{{ (row?.sourceAdapters ?? []).join('、') || '无' }}</b></span>
      <span>使用回执<b>{{ workspace.snapshot?.usageReceipts?.length ?? 0 }}</b></span>
      <span>最近活动<b>{{ fmt(recent[0]?.last) }}</b></span>
    </div>
    <section class="section">
      <div class="section-heading">
        <h2>最近对话</h2>
        <RouterLink class="button" :to="{ path: '/sessions', query: projectOnlyQuery(route.query) }">
          查看全部
          <ArrowRight />
        </RouterLink>
      </div>
      <div v-if="recent.length" class="session-cards">
        <SessionCard
          v-for="item in recent.slice(0, 5)"
          :key="item.id"
          :row="item"
          :active="false"
          :to="{ path: '/sessions', query: { ...projectOnlyQuery(route.query), session: item.id } }"
        />
      </div>
      <EmptyState v-else title="当前项目还没有对话" />
    </section>
  </ViewScaffold>
</template>
