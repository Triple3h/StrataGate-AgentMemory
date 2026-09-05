<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ name?: string }>()

const tone = computed(() => (props.name === 'codex' ? 'codex' : props.name === 'zcode' ? 'zcode' : ''))
</script>

<template>
  <span class="badge source-badge" :class="tone">{{ name }}</span>
</template>
