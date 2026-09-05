import { hostBuild } from '../../scripts/host-build.js'
export default hostBuild({ 'gateway-client': 'src/gateway-client.ts', config: 'src/config.ts', delivery: 'src/delivery.ts', outbox: 'src/outbox.ts' })
