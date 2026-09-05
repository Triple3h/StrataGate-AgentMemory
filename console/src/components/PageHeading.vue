<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { loadWorkspace, workspace } from '../stores/workspace.js'

defineProps<{ title: string; subtitle?: string }>()

function onRefresh() {
  if (!workspace.loading) void loadWorkspace(true)
}
</script>

<template>
  <header class="page-heading">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div class="actions">
      <slot />
      <button class="icon-button" type="button" aria-label="刷新" title="刷新" :disabled="workspace.loading" @click="onRefresh">
        <RotateCcw />
      </button>
    </div>
  </header>
</template>
