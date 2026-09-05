import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const gatewayOrigin = process.env.STRATAGATE_GATEWAY_ORIGIN ?? 'http://127.0.0.1:43731'
const proxy = { '/v1': gatewayOrigin, '/health': gatewayOrigin }

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(Object.entries(proxy).map(([path, target]) => [path, { target, changeOrigin: true }])),
  },
  preview: {
    port: 4173,
    proxy: Object.fromEntries(Object.entries(proxy).map(([path, target]) => [path, { target, changeOrigin: true }])),
  },
})
