<script setup lang="ts">
import { ref } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { login, session } from '../stores/session.js'

const token = ref('')

async function onSubmit() {
  if (await login(token.value)) token.value = ''
}
</script>

<template>
  <main class="login">
    <section class="login-box">
      <a href="/dashboard" class="brand"><span class="logo"><Sparkles /></span>StrataGate</a>
      <h1>登录记忆控制台</h1>
      <p class="login-sub">输入 Gateway Token 查看只读的记忆审计视图。</p>
      <form @submit.prevent="onSubmit">
        <label for="token">Gateway Token</label>
        <input id="token" v-model="token" name="token" type="password" autocomplete="off" required />
        <button class="button primary" type="submit" :disabled="session.loggingIn">
          {{ session.loggingIn ? '正在验证…' : '使用 Token 登录' }}
        </button>
      </form>
      <div v-if="session.error" class="error" role="alert">{{ session.error }}</div>
    </section>
  </main>
</template>
