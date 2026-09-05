<script setup lang="ts">
import { computed } from 'vue'
import ViewScaffold from '../components/ViewScaffold.vue'
import { selectedRow, workspace } from '../stores/workspace.js'

const facts = computed(() => {
  const row = selectedRow()
  const snapshot = workspace.snapshot
  return [
    ['项目', row?.projectName || row?.label || ''],
    ['用户', row?.userId ?? ''],
    ['命名空间', workspace.namespace],
    ['Agent', (row?.agents ?? []).join('、')],
    ['来源', (row?.sourceAdapters ?? []).join('、')],
    ['Block 轮数', snapshot?.blockTurnSize ?? ''],
    ['衰减系数', snapshot?.blockDecayLambda ?? ''],
    ['Gateway', window.location.origin],
    ['版本修订', row?.revision ?? ''],
  ]
})
</script>

<template>
  <ViewScaffold title="设置">
    <dl class="facts">
      <template v-for="fact in facts" :key="fact[0]">
        <dt>{{ fact[0] }}</dt>
        <dd>{{ fact[1] }}</dd>
      </template>
    </dl>
  </ViewScaffold>
</template>
