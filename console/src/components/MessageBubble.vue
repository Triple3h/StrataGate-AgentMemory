<script setup lang="ts">
import { Sparkles, User } from 'lucide-vue-next'
import type { L5Message } from '../api/types.js'
import { fmt } from '../lib/format.js'
import SourceBadge from './SourceBadge.vue'

defineProps<{ message: L5Message; compact?: boolean }>()
</script>

<template>
  <article class="msg" :class="[message.role === 'user' ? 'msg-user' : 'msg-ai', { compact: compact }]">
    <span v-if="message.role !== 'user'" class="msg-avatar" aria-hidden="true"><Sparkles /></span>
    <div class="msg-body">
      <div class="bubble">
        <div class="msg-content">{{ message.content }}</div>
      </div>
      <div class="msg-meta">
        <SourceBadge :name="message.sourceAdapter || '未标注'" />
        <time class="muted">{{ fmt(message.createdAt) }}</time>
      </div>
    </div>
    <span v-if="message.role === 'user'" class="msg-avatar user" aria-hidden="true"><User /></span>
  </article>
</template>
