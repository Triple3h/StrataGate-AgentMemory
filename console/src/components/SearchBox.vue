<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'

const props = defineProps<{ modelValue: string; placeholder: string }>()
const emit = defineEmits<{ submit: [value: string] }>()

const value = ref(props.modelValue)
watch(
  () => props.modelValue,
  (next) => {
    value.value = next
  },
)

function onSubmit() {
  emit('submit', value.value)
}
</script>

<template>
  <form class="search" @submit.prevent="onSubmit">
    <input v-model="value" type="search" :placeholder="placeholder" :aria-label="placeholder" />
    <button class="icon-button" type="submit" title="搜索" aria-label="搜索">
      <Search />
    </button>
  </form>
</template>
