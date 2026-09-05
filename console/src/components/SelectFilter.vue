<script setup lang="ts">
defineProps<{ title: string; modelValue: string; options: string[] }>()
const emit = defineEmits<{ update: [value: string] }>()

function onChange(event: Event) {
  emit('update', (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <label class="filter">
    <span>{{ title }}</span>
    <select :value="modelValue" :aria-label="title + '筛选'" @change="onChange">
      <option value="">全部{{ title }}</option>
      <option v-for="option in options" :key="option" :value="option">{{ option }}</option>
    </select>
  </label>
</template>
