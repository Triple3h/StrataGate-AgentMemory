<script setup lang="ts">
import { computed } from 'vue'
import AppSelect from './AppSelect.vue'

const props = defineProps<{ title: string; modelValue: string; options: string[] }>()
const emit = defineEmits<{ update: [value: string] }>()

const selectOptions = computed(() => [
  { value: '', label: `全部${props.title}` },
  ...props.options.map((option) => ({ value: option, label: option })),
])
</script>

<template>
  <label class="filter">
    <span>{{ title }}</span>
    <AppSelect
      class="filter-select"
      :model-value="modelValue"
      :options="selectOptions"
      :label="title + '筛选'"
      @update:model-value="emit('update', $event)"
    />
  </label>
</template>
