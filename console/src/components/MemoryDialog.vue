<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import type { DetailRow } from '../api/types.js'
import { detailSourceRefs, rowTitle, withCompactFlags } from '../lib/console-data.js'
import { sourceMessagesFor } from '../lib/console-data.js'
import { workspace } from '../stores/workspace.js'
import EmptyState from './EmptyState.vue'
import MessageBubble from './MessageBubble.vue'

const props = defineProps<{ row: DetailRow }>()
const emit = defineEmits<{ close: [] }>()

const el = ref<HTMLDialogElement | null>(null)
let previousFocus: Element | null = null

const title = computed(() => rowTitle(props.row))
const json = computed(() => JSON.stringify(props.row, null, 2))
const sourceRows = computed(() => withCompactFlags(sourceMessagesFor(workspace.snapshot, detailSourceRefs(props.row, workspace.snapshot))))

function onBackdrop(event: MouseEvent) {
  const dialog = el.value
  if (!dialog || event.target !== dialog) return
  const rect = dialog.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY < rect.bottom) emit('close')
}

onMounted(() => {
  previousFocus = document.activeElement
  el.value?.showModal()
})

onBeforeUnmount(() => {
  const focusable = previousFocus as HTMLElement | null
  focusable?.focus?.()
})
</script>

<template>
  <dialog ref="el" class="dialog" @cancel.prevent="emit('close')" @click="onBackdrop">
    <header class="dialog-head">
      <div>
        <h2>{{ title }}</h2>
        <p class="scope-id">{{ row.id }}</p>
      </div>
      <div class="actions">
        <button class="icon-button" type="button" aria-label="关闭详情" title="关闭详情" @click="emit('close')">
          <X />
        </button>
      </div>
    </header>
    <pre class="json">{{ json }}</pre>
    <section class="section">
      <h2>来源消息</h2>
      <MessageBubble v-for="(item, index) in sourceRows" :key="item.message.id ?? index" :message="item.message" :compact="item.compact" />
      <EmptyState v-if="!sourceRows.length" title="没有关联的源消息" />
    </section>
  </dialog>
</template>
