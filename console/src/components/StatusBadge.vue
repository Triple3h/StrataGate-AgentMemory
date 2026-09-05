<script setup lang="ts">
import { computed } from 'vue'
import { statusTone } from '../lib/format.js'

const props = defineProps<{ status?: string }>()

const tone = computed(() => statusTone(props.status))
</script>

<template>
  <span class="badge" :class="tone">{{ status || 'pending' }}</span>
</template>
