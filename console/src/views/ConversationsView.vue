<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Compass, X } from 'lucide-vue-next'
import EmptyState from '../components/EmptyState.vue'
import MessageBubble from '../components/MessageBubble.vue'
import SearchBox from '../components/SearchBox.vue'
import SelectFilter from '../components/SelectFilter.vue'
import SessionCard from '../components/SessionCard.vue'
import SourceBadge from '../components/SourceBadge.vue'
import ViewScaffold from '../components/ViewScaffold.vue'
import type { SessionRow } from '../api/types.js'
import { groupSessions, snapshotMessages, withCompactFlags } from '../lib/console-data.js'
import { unique } from '../lib/format.js'
import { paramValue, useQueryNav } from '../lib/query.js'
import { workspace } from '../stores/workspace.js'

const route = useRoute()
const { pushQuery } = useQueryNav()

const query = computed(() => paramValue(route.query, 'q').toLowerCase())
const agentFilter = computed(() => paramValue(route.query, 'agent'))
const sourceFilter = computed(() => paramValue(route.query, 'source'))
const sessionId = computed(() => paramValue(route.query, 'session'))

const rows = computed(() => groupSessions(snapshotMessages(workspace.snapshot)))
const filtered = computed(() =>
  rows.value.filter(
    (row) =>
      (!query.value || row.id.toLowerCase().includes(query.value) || row.messages.some((message) => String(message.content ?? '').toLowerCase().includes(query.value))) &&
      row.messages.some(
        (message) =>
          (!agentFilter.value || message.agentId === agentFilter.value) &&
          (!sourceFilter.value || message.sourceAdapter === sourceFilter.value),
      ),
  ),
)
const hasFilters = computed(() => Boolean(query.value || agentFilter.value || sourceFilter.value))
const active = computed<SessionRow | null>(() => (sessionId.value ? rows.value.find((row) => row.id === sessionId.value) ?? null : null))

const agentOptions = computed(() => unique(rows.value.flatMap((row) => row.messages.map((message) => message.agentId))).sort())
const sourceOptions = computed(() => unique(rows.value.flatMap((row) => row.messages.map((message) => message.sourceAdapter))).sort())

const threadSources = computed(() => (active.value ? unique(active.value.messages.map((message) => message.sourceAdapter)) : []))
const threadAgents = computed(() => (active.value ? unique(active.value.messages.map((message) => message.agentId)) : []))
const threadTurns = computed(() => (active.value ? active.value.messages.filter((message) => message.role === 'user').length : 0))
const threadMessages = computed(() => (active.value ? withCompactFlags(active.value.messages) : []))

function cardTo(row: SessionRow) {
  return { query: { ...route.query, session: row.id } }
}

function onSearch(value: string) {
  pushQuery({ q: value || undefined, session: undefined })
}

function onAgent(value: string) {
  pushQuery({ agent: value || undefined, session: undefined })
}

function onSource(value: string) {
  pushQuery({ source: value || undefined, session: undefined })
}

function resetFilters() {
  pushQuery({ q: undefined, agent: undefined, source: undefined, session: undefined })
}

const scroller = ref<HTMLDivElement | null>(null)

function scrollToBottom() {
  void nextTick(() => {
    const el = scroller.value
    if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight
  })
}

watch(active, scrollToBottom)
onMounted(scrollToBottom)
</script>

<template>
  <ViewScaffold title="对话来源">
    <div class="session-split" :class="{ 'has-thread': Boolean(active) }">
      <aside class="session-list">
        <div class="toolbar session-toolbar">
          <SearchBox :model-value="paramValue(route.query, 'q')" placeholder="搜索对话或消息内容" @submit="onSearch" />
          <div class="filters">
            <SelectFilter title="Agent" :model-value="agentFilter" :options="agentOptions" @update="onAgent" />
            <SelectFilter title="来源" :model-value="sourceFilter" :options="sourceOptions" @update="onSource" />
          </div>
          <span class="count">{{ filtered.length }} / {{ rows.length }} 个对话</span>
          <button v-if="hasFilters" class="icon-button" type="button" aria-label="清除筛选" title="清除筛选" @click="resetFilters">
            <X />
          </button>
        </div>
        <div class="session-list-scroll">
          <div v-if="filtered.length" class="session-cards">
            <SessionCard v-for="row in filtered" :key="row.id" :row="row" :active="row.id === sessionId" :to="cardTo(row)" />
          </div>
          <EmptyState v-else :title="hasFilters ? '没有匹配的对话' : '当前项目还没有对话'">
            <button v-if="hasFilters" class="button" type="button" @click="resetFilters">清除筛选</button>
          </EmptyState>
        </div>
      </aside>
      <section class="thread-pane" aria-live="polite">
        <template v-if="sessionId">
          <template v-if="active">
            <header class="thread-head">
              <div class="thread-title">
                <h2>{{ active.title || '对话详情' }}</h2>
                <span class="scope-id" :title="active.id">{{ active.id }}</span>
              </div>
              <div class="thread-meta">
                <SourceBadge v-for="name in threadSources" :key="name" :name="name" />
                <span class="chip">{{ threadAgents.join('、') || '未知 Agent' }}</span>
                <span class="chip">{{ active.messages.length }} 消息 / {{ threadTurns }} 轮</span>
                <button class="icon-button" type="button" aria-label="返回对话列表" title="返回对话列表" @click="pushQuery({ session: undefined })">
                  <X />
                </button>
              </div>
            </header>
            <div ref="scroller" class="thread-scroll">
              <MessageBubble
                v-for="(item, index) in threadMessages"
                :key="item.message.id ?? index"
                :message="item.message"
                :compact="item.compact"
              />
            </div>
          </template>
          <EmptyState v-else title="当前项目中未找到此对话" />
        </template>
        <div v-else class="thread-empty">
          <span class="empty-icon large"><Compass /></span>
          <strong>选择一个对话</strong>
          <p>从左侧列表选择对话，这里会以聊天气泡展示完整的消息记录。</p>
        </div>
      </section>
    </div>
  </ViewScaffold>
</template>
