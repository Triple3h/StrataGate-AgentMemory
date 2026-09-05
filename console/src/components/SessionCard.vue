<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { MessageSquare } from 'lucide-vue-next'
import type { SessionRow } from '../api/types.js'
import { unique } from '../lib/format.js'
import { fmt } from '../lib/format.js'
import SourceBadge from './SourceBadge.vue'

const props = defineProps<{ row: SessionRow; active: boolean; to: RouteLocationRaw }>()

const sources = computed(() => unique(props.row.messages.map((message) => message.sourceAdapter)))
const userTurns = computed(() => props.row.messages.filter((message) => message.role === 'user').length)
</script>

<template>
  <RouterLink class="session-card" :class="{ active }" :to="to">
    <span class="card-icon"><MessageSquare /></span>
    <span class="card-body">
      <span class="card-title">{{ row.title || '历史对话' }}</span>
      <span class="card-meta">
        <SourceBadge v-for="name in sources" :key="name" :name="name" />
        <span>{{ row.messages.length }} 消息 / {{ userTurns }} 轮</span>
      </span>
      <span class="card-sub">
        <span class="session-id" :title="row.id">{{ row.id }}</span>
        <span class="muted">{{ fmt(row.last) }}</span>
      </span>
    </span>
  </RouterLink>
</template>
