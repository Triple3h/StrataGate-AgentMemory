import { hostBuild } from '../../scripts/host-build.js'
export default hostBuild({ hook: 'src/hook.ts', server: 'src/server.ts', cli: 'src/cli.ts' }, true)
