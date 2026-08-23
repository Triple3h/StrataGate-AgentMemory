import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
mkdirSync(new URL('dist/', root), { recursive: true })
const clientSource = readFileSync(new URL('src/client.js', root), 'utf8')
const mascot = readFileSync(new URL('../../docs/assets/stratagate-avatar.png', root)).toString('base64')
writeFileSync(
  new URL('dist/client.js', root),
  clientSource.replace('__STRATAGATE_MASCOT_DATA_URL__', `data:image/png;base64,${mascot}`),
)
copyFileSync(new URL('src/client.d.ts', root), new URL('dist/client.d.ts', root))
