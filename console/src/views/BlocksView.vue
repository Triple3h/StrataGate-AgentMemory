<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'
import SearchBox from '../components/SearchBox.vue'
import StatusBadge from '../components/StatusBadge.vue'
import ViewScaffold from '../components/ViewScaffold.vue'
import type { MemoryBlock } from '../api/types.js'
import { fmt } from '../lib/format.js'
import { paramValue, useQueryNav } from '../lib/query.js'
import { workspace } from '../stores/workspace.js'

const route = useRoute()
const { pushQuery } = useQueryNav()

const query = computed(() => paramValue(route.query, 'q').toLowerCase())
const all = computed(() => workspace.snapshot?.blocks ?? [])
const rows = computed(() => all.value.filter((block) => !query.value || JSON.stringify(block).toLowerCase().includes(query.value)))

const LAYER_LABELS = ['标题', '摘要', '要点', '压缩内容', '可读内容', '原始消息']

function layers(block: MemoryBlock): Array<{ label: string; value: string; open: boolean }> {
  const values = [
    block.l0Title,
    block.l1Summary,
    (block.l2Keypoints ?? []).join('\n'),
    block.l3Condensed,
    block.l4Readable,
    (block.l5Raw ?? []).map((message) => message.role + ': ' + message.content).join('\n\n'),
  ]
  return values.map((value, index) => ({ label: 'L' + index + ' · ' + LAYER_LABELS[index], value: value || '尚未生成', open: index === 0 }))
}

function blockTitle(block: MemoryBlock): string {
  return block.l0Title || 'Block #' + (block.sequence ?? '?')
}
</script>

<template>
  <ViewScaffold title="Block 分层">
    <div class="toolbar">
      <SearchBox :model-value="paramValue(route.query, 'q')" placeholder="搜索 Block 标题、摘要或消息" @submit="(value) => pushQuery({ q: value || undefined })" />
      <span class="count">{{ rows.length }} / {{ all.length }} 个 Block</span>
    </div>
    <template v-if="rows.length">
      <article v-for="(block, index) in rows" :key="block.sequence ?? index" class="item">
        <div class="item-heading">
          <div>
            <h2>{{ blockTitle(block) }}</h2>
            <small>Turn {{ block.startTurn ?? '?' }}–{{ block.endTurn ?? '?' }} · {{ fmt(block.createdAt) }}</small>
          </div>
          <StatusBadge :status="block.processingStatus" />
        </div>
        <details v-for="layer in layers(block)" :key="layer.label" class="layer" :open="layer.open">
          <summary>{{ layer.label }}</summary>
          <pre>{{ layer.value }}</pre>
        </details>
      </article>
    </template>
    <EmptyState v-else title="暂无 Block" />
  </ViewScaffold>
</template>
