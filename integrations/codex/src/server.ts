import { codexEnv } from './config.js'
import { journal } from './capture.js'
import { GatewayClient } from '../../../packages/adapter-sdk/src/gateway-client.js'

Object.assign(process.env, codexEnv())
const replay = () => journal().flush(GatewayClient.fromEnv()).catch(() => undefined)
const timer = setInterval(() => { void replay() }, 30_000)
timer.unref()
void replay()
void import('../../../packages/gateway/src/mcp-server.js')
