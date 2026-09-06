<script setup lang="ts">
import EmptyState from './EmptyState.vue'
import PageHeading from './PageHeading.vue'
import { workspace } from '../stores/workspace.js'

defineProps<{ title: string; subtitle?: string; global?: boolean }>()
</script>

<template>
  <PageHeading :title="title" :subtitle="subtitle" />
  <div v-if="workspace.error" class="error" role="alert">{{ workspace.error }}</div>
  <EmptyState v-if="workspace.loading" title="正在读取项目数据…" />
  <template v-else-if="!workspace.error">
    <EmptyState v-if="!global && !workspace.namespace" title="还没有项目数据" />
    <slot v-else />
  </template>
</template>
