import { FileOutbox, outboxDirectory } from '@diqier/stratagate'
import { GatewayClient, replayGatewayOutbox } from './gateway-client.js'

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'status'
  const outbox = new FileOutbox(outboxDirectory())
  if (command === 'status') {
    process.stdout.write(`${JSON.stringify(await outbox.status(), null, 2)}\n`)
    return
  }
  if (command === 'replay') {
    const result = await replayGatewayOutbox(GatewayClient.fromEnv(), outbox)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }
  throw new Error(`Usage: stratagate-memory-outbox [status|replay]`)
}

void main().catch((error) => {
  process.stderr.write(`[stratagate-outbox] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
