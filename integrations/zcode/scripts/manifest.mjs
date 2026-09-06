import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const dir = new URL('../dist/', import.meta.url)
const files = ['hook.cjs', 'server.cjs', 'cli.cjs', 'star-widget-client.global.js']
const hashes = Object.fromEntries(files.map(name => [name, createHash('sha256').update(readFileSync(new URL(name, dir))).digest('hex')]))
writeFileSync(new URL('manifest.json', dir), JSON.stringify({ name: 'stratagate-zcode', version, files: hashes }, null, 2) + '\n')
