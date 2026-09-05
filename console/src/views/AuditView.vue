<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '../components/EmptyState.vue'
import ViewScaffold from '../components/ViewScaffold.vue'
import { fmt } from '../lib/format.js'
import { workspace } from '../stores/workspace.js'

const rows = computed(() => [...(workspace.snapshot?.usageReceipts ?? [])].reverse())

function adoptedCount(receipt: { eventIds?: string[]; elementIds?: string[] }): number {
  return (receipt.eventIds?.length ?? 0) + (receipt.elementIds?.length ?? 0)
}
</script>

<template>
  <ViewScaffold title="使用审计" :subtitle="rows.length + ' 条使用回执'">
    <template v-if="rows.length">
      <article v-for="receipt in rows" :key="receipt.id" class="item">
        <div class="item-heading">
          <h2>采用 {{ adoptedCount(receipt) }} 条记忆</h2>
          <time class="date">{{ fmt(receipt.createdAt) }}</time>
        </div>
        <span class="scope-id">{{ receipt.id }}</span>
        <pre class="json">{{ JSON.stringify({ eventIds: receipt.eventIds ?? [], elementIds: receipt.elementIds ?? [], audit: receipt.audit }, null, 2) }}</pre>
      </article>
    </template>
    <EmptyState v-else title="还没有使用记录" />
  </ViewScaffold>
</template>
