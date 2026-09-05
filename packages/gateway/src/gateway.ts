import { createServer } from 'node:http'
import { gatewayPort, gatewayLimits, createGatewayHandler } from './gateway-api.js'
import { replayGatewayOutbox } from '../../adapter-sdk/src/gateway-client.js'

const { handler } = createGatewayHandler()
const server = createServer((req, res) => { void handler(req, res) })
const limits = gatewayLimits()
server.requestTimeout = limits.requestTimeoutMs
server.headersTimeout = Math.min(limits.requestTimeoutMs, 60_000)
server.keepAliveTimeout = Math.min(limits.requestTimeoutMs, 10_000)
const socket = process.env.STRATAGATE_GATEWAY_SOCKET?.trim()
const host = process.env.STRATAGATE_GATEWAY_HOST?.trim() || '127.0.0.1'
let replayTimer: NodeJS.Timeout | undefined

async function replayOutbox(): Promise<void> {
  try {
    const result = await replayGatewayOutbox()
    if (result.sent > 0 || result.failed > 0) process.stderr.write(`[stratagate-gateway] outbox replay sent=${result.sent} failed=${result.failed} skipped=${result.skipped}\n`)
  } catch (error) {
    process.stderr.write(`[stratagate-gateway] outbox replay failed: ${error instanceof Error ? error.message : String(error)}\n`)
  }
}

server.on('error', (error) => {
  process.stderr.write(`[stratagate-gateway] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
if (socket) server.listen(socket, () => { process.stderr.write(`[stratagate-gateway] listening on ${socket}\n`); void replayOutbox() })
else server.listen(gatewayPort(), host, () => { process.stderr.write(`[stratagate-gateway] listening on http://${host}:${gatewayPort()}\n`); void replayOutbox() })
replayTimer = setInterval(() => { void replayOutbox() }, 30_000)
replayTimer.unref?.()

async function shutdown(): Promise<void> {
  if (replayTimer) clearInterval(replayTimer)
  await new Promise<void>((resolve) => server.close(() => resolve()))
}
process.once('SIGINT', () => { void shutdown() })
process.once('SIGTERM', () => { void shutdown() })
