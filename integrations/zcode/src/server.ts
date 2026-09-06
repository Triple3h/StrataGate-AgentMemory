import { zcodeEnv } from './config.js'
import { journal } from './capture.js'
import { GatewayClient } from '../../../packages/adapter-sdk/src/gateway-client.js'

// Standalone ZCode MCP entrypoint: labels every assess/record-use call with
// sourceAdapter=zcode (the legacy workbuddy shim mislabeled them), replays the
// delivery journal, then serves the shared Gateway MCP tools over stdio.
Object.assign(process.env, zcodeEnv())
const replay = () => journal().flush(GatewayClient.fromEnv()).catch(() => undefined)
const timer = setInterval(() => { void replay() }, 30_000)
timer.unref()
void replay()
void import('../../../packages/gateway/src/mcp-server.js')
