<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from './components/AppShell.vue'
import LoginPanel from './components/LoginPanel.vue'
import { bootstrapSession, session } from './stores/session.js'

onMounted(() => {
  bootstrapSession()
})
</script>

<template>
  <LoginPanel v-if="session.authenticated === false" />
  <AppShell v-else-if="session.authenticated === true" />
</template>
