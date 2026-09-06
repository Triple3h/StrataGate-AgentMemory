<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'

interface AppSelectOption {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  options: AppSelectOption[]
  label: string
  placeholder?: string
  disabled?: boolean
  id?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const activeIndex = ref(-1)
const triggerRef = ref<HTMLButtonElement | null>(null)
const popRef = ref<HTMLDivElement | null>(null)
const popId = `app-select-${Math.random().toString(36).slice(2, 8)}`

const selectedIndex = computed(() => props.options.findIndex((option) => option.value === props.modelValue))
const selectedLabel = computed(() =>
  selectedIndex.value >= 0 ? props.options[selectedIndex.value].label : (props.modelValue || props.placeholder || ''),
)
const showPlaceholder = computed(() => selectedIndex.value < 0)

function openList() {
  if (props.disabled || open.value) return
  open.value = true
  activeIndex.value = selectedIndex.value >= 0 ? selectedIndex.value : 0
  void nextTick(() => {
    positionPop()
    scrollActiveIntoView()
  })
}

function closeList(refocus = false) {
  if (!open.value) return
  open.value = false
  activeIndex.value = -1
  if (refocus) triggerRef.value?.focus()
}

function toggleList() {
  if (open.value) closeList()
  else openList()
}

function choose(option: AppSelectOption) {
  closeList(true)
  if (option.value !== props.modelValue) emit('update:modelValue', option.value)
}

function moveActive(delta: number) {
  if (!props.options.length) return
  const total = props.options.length
  activeIndex.value = (activeIndex.value + delta + total) % total
  scrollActiveIntoView()
}

function scrollActiveIntoView() {
  const pop = popRef.value
  if (!pop) return
  pop.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
}

let typeahead = ''
let typeaheadTimer: ReturnType<typeof setTimeout> | undefined

function typeaheadSearch(char: string) {
  typeahead += char.toLowerCase()
  clearTimeout(typeaheadTimer)
  typeaheadTimer = setTimeout(() => {
    typeahead = ''
  }, 500)
  const from = activeIndex.value + 1
  const order = [...props.options.keys()].map((index) => (index + from) % props.options.length)
  const match = order.find((index) => props.options[index].label.toLowerCase().startsWith(typeahead))
  if (match !== undefined) {
    activeIndex.value = match
    scrollActiveIntoView()
  }
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (open.value) moveActive(event.key === 'ArrowDown' ? 1 : -1)
    else openList()
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (open.value && activeIndex.value >= 0) choose(props.options[activeIndex.value])
    else openList()
  } else if (event.key === 'Escape') {
    closeList(true)
  } else if (event.key === 'Tab') {
    closeList()
  } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
    if (!open.value) openList()
    typeaheadSearch(event.key)
  }
}

function positionPop() {
  const trigger = triggerRef.value
  const pop = popRef.value
  if (!trigger || !pop) return
  const rect = trigger.getBoundingClientRect()
  pop.style.minWidth = `${Math.max(rect.width, 140)}px`
  const popHeight = pop.offsetHeight
  const below = window.innerHeight - rect.bottom - 8
  const above = rect.top - 8
  const openUp = below < Math.min(popHeight, 200) && above > below
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - pop.offsetWidth - 8))
  pop.style.left = `${left}px`
  pop.style.top = openUp ? `${Math.max(8, rect.top - popHeight - 6)}px` : `${rect.bottom + 6}px`
}

function onWindowChange() {
  if (open.value) positionPop()
}

function onDocumentPointerdown(event: PointerEvent) {
  const target = event.target as Node
  if (triggerRef.value?.contains(target) || popRef.value?.contains(target)) return
  closeList()
}

watch(open, (value) => {
  if (value) {
    window.addEventListener('scroll', onWindowChange, true)
    window.addEventListener('resize', onWindowChange)
    document.addEventListener('pointerdown', onDocumentPointerdown)
  } else {
    window.removeEventListener('scroll', onWindowChange, true)
    window.removeEventListener('resize', onWindowChange)
    document.removeEventListener('pointerdown', onDocumentPointerdown)
  }
})

onBeforeUnmount(() => {
  clearTimeout(typeaheadTimer)
  window.removeEventListener('scroll', onWindowChange, true)
  window.removeEventListener('resize', onWindowChange)
  document.removeEventListener('pointerdown', onDocumentPointerdown)
})

watch(
  () => props.modelValue,
  () => {
    if (open.value) positionPop()
  },
)
</script>

<template>
  <div class="app-select">
    <button
      :id="id"
      ref="triggerRef"
      type="button"
      class="app-select-trigger"
      role="combobox"
      :aria-label="label"
      :aria-expanded="open"
      :aria-controls="open ? popId : undefined"
      :aria-activedescendant="open && activeIndex >= 0 ? `${popId}-opt-${activeIndex}` : undefined"
      aria-haspopup="listbox"
      :disabled="disabled"
      @click="toggleList"
      @keydown="onTriggerKeydown"
    >
      <span class="app-select-label" :class="{ 'app-select-placeholder': showPlaceholder }">{{ selectedLabel }}</span>
      <ChevronDown class="app-select-caret" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        :id="popId"
        ref="popRef"
        class="app-select-pop"
        role="listbox"
        :aria-label="label"
      >
        <p v-if="!options.length" class="app-select-empty">暂无选项</p>
        <div
          v-for="(option, index) in options"
          :id="`${popId}-opt-${index}`"
          :key="option.value"
          class="app-select-option"
          :class="{ selected: index === selectedIndex }"
          role="option"
          :data-active="index === activeIndex"
          :aria-selected="index === selectedIndex"
          @pointerenter="activeIndex = index"
          @click="choose(option)"
        >
          <Check class="app-select-check" aria-hidden="true" />
          <span class="app-select-option-label">{{ option.label }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>
