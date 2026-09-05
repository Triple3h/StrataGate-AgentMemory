<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'

defineProps<{ title: string; detail?: string }>()
</script>

<template>
  <div class="empty">
    <span class="empty-icon"><BookOpen /></span>
    <strong>{{ title }}</strong>
    <p v-if="detail">{{ detail }}</p>
    <slot />
  </div>
</template>
