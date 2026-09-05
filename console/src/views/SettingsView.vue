<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import ViewScaffold from '../components/ViewScaffold.vue'
import { api, apiSend, ApiError } from '../api/client.js'
import type { ModelProviderTestResult, ModelProviderView } from '../api/types.js'
import { selectedRow, workspace } from '../stores/workspace.js'

const view = ref<ModelProviderView | null>(null)
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const notice = ref('')
const error = ref('')
const form = reactive({ baseUrl: '', model: '', apiKey: '', maxOutputTokens: '' })

const modeLabel = computed(() => (view.value?.mode === 'full' ? '完整记忆' : '基础模式（仅原始存档）'))
const sourceLabel = computed(() => {
  if (view.value?.source === 'runtime') return '运行时配置（重启后仍生效）'
  if (view.value?.source === 'env') return '环境变量'
  return '未配置'
})
const keyPlaceholder = computed(() => {
  if (view.value?.apiKeySet) return `已配置（${view.value.apiKeyMasked}），留空保持不变`
  return '未配置，可留空（部分端点无需鉴权）'
})
const updatedLabel = computed(() => {
  const value = view.value?.updatedAt
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
})

function errorText(value: unknown): string {
  return value instanceof ApiError || value instanceof Error ? value.message : String(value)
}

function applyView(next: ModelProviderView): void {
  view.value = next
  form.baseUrl = next.baseUrl ?? ''
  form.model = next.model ?? ''
  form.apiKey = ''
  form.maxOutputTokens = next.maxOutputTokens ? String(next.maxOutputTokens) : ''
}

async function load(): Promise<void> {
  error.value = ''
  try {
    applyView(await api<ModelProviderView>('/v1/settings/model-provider'))
  } catch (value) {
    error.value = errorText(value)
  } finally {
    loading.value = false
  }
}

onMounted(load)

function payload(): Record<string, unknown> {
  return {
    baseUrl: form.baseUrl,
    model: form.model,
    ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
    ...(form.maxOutputTokens.trim() ? { maxOutputTokens: Number(form.maxOutputTokens) } : {}),
  }
}

async function save(): Promise<void> {
  saving.value = true
  notice.value = ''
  error.value = ''
  try {
    applyView(await apiSend<ModelProviderView>('PUT', '/v1/settings/model-provider', payload()))
    notice.value = '已保存，新供应商对全部项目命名空间立即生效。'
  } catch (value) {
    error.value = errorText(value)
  } finally {
    saving.value = false
  }
}

async function test(): Promise<void> {
  testing.value = true
  notice.value = ''
  error.value = ''
  try {
    const result = await apiSend<ModelProviderTestResult>('POST', '/v1/settings/model-provider/test', payload())
    if (result.ok) notice.value = `连接成功，耗时 ${result.latencyMs} ms。`
    else error.value = `连接失败：${result.detail}`
  } catch (value) {
    error.value = errorText(value)
  } finally {
    testing.value = false
  }
}

async function reset(): Promise<void> {
  if (!window.confirm('清除运行时供应商配置，恢复为环境变量默认？')) return
  saving.value = true
  notice.value = ''
  error.value = ''
  try {
    applyView(await apiSend<ModelProviderView>('DELETE', '/v1/settings/model-provider'))
    notice.value = '已恢复环境变量默认配置。'
  } catch (value) {
    error.value = errorText(value)
  } finally {
    saving.value = false
  }
}

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
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="notice" class="notice">{{ notice }}</p>

    <section class="section">
      <div class="section-heading">
        <h2>模型供应商</h2>
        <span v-if="view" class="badge" :class="view.mode === 'full' ? 'ok' : 'warn'">{{ modeLabel }}</span>
      </div>
      <div class="provider-box">
        <p class="muted">
          供应商用于后台记忆派生（Block 封存与事件/元素抽取）。未配置时系统仅保存原始对话，不生成可检索的记忆。
        </p>
        <dl v-if="view" class="facts provider-facts">
          <dt>配置来源</dt>
          <dd>{{ sourceLabel }}<template v-if="updatedLabel"> · 更新于 {{ updatedLabel }}</template></dd>
          <dt>Base URL</dt>
          <dd>{{ view.baseUrl || '—' }}</dd>
          <dt>模型</dt>
          <dd>{{ view.model || '—' }}</dd>
          <dt>API Key</dt>
          <dd>{{ view.apiKeySet ? view.apiKeyMasked : '未配置' }}</dd>
          <dt>配置文件</dt>
          <dd class="mono">{{ view.configFile }}</dd>
        </dl>
        <form class="provider-form" @submit.prevent="save">
          <div class="field">
            <label for="provider-base-url">API Base URL</label>
            <input id="provider-base-url" v-model="form.baseUrl" placeholder="https://api.example.com/v1" autocomplete="off" spellcheck="false" />
          </div>
          <div class="field">
            <label for="provider-model">模型</label>
            <input id="provider-model" v-model="form.model" placeholder="glm-5.3-flash" autocomplete="off" spellcheck="false" />
          </div>
          <div class="field">
            <label for="provider-api-key">API Key</label>
            <input id="provider-api-key" v-model="form.apiKey" type="password" :placeholder="keyPlaceholder" autocomplete="new-password" />
            <small class="hint">保存时留空表示沿用当前已配置的 Key；Key 只保存在 Gateway 数据目录，不会回传到浏览器。</small>
          </div>
          <div class="field">
            <label for="provider-max-tokens">最大输出 Token（可选）</label>
            <input id="provider-max-tokens" v-model="form.maxOutputTokens" inputmode="numeric" placeholder="10000" autocomplete="off" />
          </div>
          <div class="actions form-actions">
            <button type="button" class="button" :disabled="testing || saving || loading" @click="test">测试连接</button>
            <button type="submit" class="button primary" :disabled="testing || saving || loading">保存</button>
            <button
              v-if="view?.source === 'runtime'"
              type="button"
              class="button"
              :disabled="testing || saving || loading"
              @click="reset"
            >恢复环境变量默认<template v-if="view.envProvider">（{{ view.envProvider.model }}）</template></button>
          </div>
        </form>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <h2>系统信息</h2>
      </div>
      <dl class="facts">
        <template v-for="fact in facts" :key="fact[0]">
          <dt>{{ fact[0] }}</dt>
          <dd>{{ fact[1] }}</dd>
        </template>
      </dl>
    </section>
  </ViewScaffold>
</template>
