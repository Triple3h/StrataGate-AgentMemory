<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { paramValue } from '../lib/query.js'
import { session } from '../stores/session.js'
import { loadWorkspace, workspace } from '../stores/workspace.js'

const route = useRoute()
const router = useRouter()

const projectParam = computed(() => paramValue(route.query, 'project'))

async function syncProject(value: string) {
  await loadWorkspace(false, value)
  const resolved = workspace.namespace
  if (paramValue(route.query, 'project') !== resolved) {
    void router.replace({ query: { ...route.query, project: resolved || undefined } })
  }
}

onMounted(async () => {
  await loadWorkspace(true, projectParam.value)
  if (paramValue(route.query, 'project') !== workspace.namespace) {
    void router.replace({ query: { ...route.query, project: workspace.namespace || undefined } })
  }
})

watch(projectParam, (value) => {
  if (session.authenticated !== true) return
  if (value && value === workspace.snapshotNamespace) return
  void syncProject(value)
})
</script>

<template>
  <main class="main" :aria-busy="workspace.loading">
    <slot />
  </main>
</template>
