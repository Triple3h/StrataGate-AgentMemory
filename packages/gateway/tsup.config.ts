import { hostBuild } from '../../scripts/host-build.js'
export default hostBuild({ gateway: 'src/gateway.ts', runtime: 'src/runtime.ts', server: 'src/mcp-server.ts' }, true)
