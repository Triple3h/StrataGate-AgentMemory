<script setup lang="ts">
import { computed } from 'vue'
import AppSelect from './AppSelect.vue'
import { workspace } from '../stores/workspace.js'

const model = defineModel<string>({ default: '' })

const options = computed(() => [
  { value: '', label: '全部项目' },
  ...(workspace.dashboard?.namespaces ?? []).map((row) => ({
    value: row.namespace,
    label: row.projectName || row.namespace,
  })),
])
</script>

<template>
  <label class="filter">
    <span>项目</span>
    <AppSelect
      class="filter-select"
      :model-value="model"
      :options="options"
      label="项目筛选"
      @update:model-value="model = $event"
    />
  </label>
</template>
