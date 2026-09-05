import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
const dir = new URL('../dist/', import.meta.url)
const files = ['hook.cjs', 'server.cjs', 'cli.cjs', 'capture.cjs', 'star-widget-client.global.js']
const hashes = Object.fromEntries(files.map(name => [name, createHash('sha256').update(readFileSync(new URL(name, dir))).digest('hex')]))
writeFileSync(new URL('manifest.json', dir), JSON.stringify({ name: 'stratagate-codex', version: '0.1.0', files: hashes }, null, 2) + '\n')
