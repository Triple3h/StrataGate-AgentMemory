<script setup lang="ts">
import { computed } from 'vue'
import { Database } from 'lucide-vue-next'
import { projectLabel } from '../lib/console-data.js'
import { useQueryNav } from '../lib/query.js'
import { selectedRow, workspace } from '../stores/workspace.js'
import AppSelect from './AppSelect.vue'
import SourceBadge from './SourceBadge.vue'

const { pushQuery } = useQueryNav()

const rows = computed(() => workspace.dashboard?.namespaces ?? [])
const current = computed(() => selectedRow())
const projectOptions = computed(() => rows.value.map((row) => ({ value: row.namespace, label: projectLabel(row) })))
const placeholder = computed(() => (workspace.namespace ? '选择有效项目' : '暂无项目'))

function onProject(value: string) {
  pushQuery({ project: value || undefined, q: undefined, agent: undefined, source: undefined, session: undefined })
}
</script>

<template>
  <section class="scope-bar" aria-label="项目范围">
    <div class="path-field">
      <label class="sr-only" for="project-select">当前项目</label>
      <span class="path-scheme"><Database />stratagate://</span>
      <AppSelect
        id="project-select"
        class="path-select"
        :model-value="workspace.namespace"
        :options="projectOptions"
        :placeholder="placeholder"
        :disabled="!rows.length"
        label="当前项目"
        @update:model-value="onProject"
      />
    </div>
    <div class="scope-meta">
      <template v-if="current">
        <SourceBadge v-for="name in current.sourceAdapters ?? []" :key="name" :name="name" />
        <span class="chip">{{ current.userId ?? 'default' }} · {{ current.turns ?? 0 }} 轮</span>
      </template>
    </div>
  </section>
</template>
