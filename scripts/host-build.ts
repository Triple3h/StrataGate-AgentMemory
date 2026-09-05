import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'
const root = fileURLToPath(new URL('..', import.meta.url))
export function hostBuild(entry: Record<string, string>, widget = false) {
  return defineConfig([
    { entry, format: ['cjs'], target: 'node22', outExtension: () => ({ js: '.cjs' }), sourcemap: true, clean: true, splitting: false, removeNodeProtocol: false,
      noExternal: [new RegExp('^@diqier/stratagate'), new RegExp('^@modelcontextprotocol/'), /^zod/, /^smol-toml/], external: ['better-sqlite3'],
      esbuildOptions(options) { options.alias = { ...options.alias, 'node:sqlite': resolve(root, 'packages/gateway/src/node-sqlite-shim.ts') } },
      banner: { js: '#!/usr/bin/env node' } },
    ...(widget ? [{ entry: { 'star-widget-client': resolve(root, 'packages/gateway/src/star-widget-client.ts') }, format: ['iife' as const], platform: 'browser' as const, target: 'es2022', minify: true, clean: false, splitting: false }] : []),
  ])
}
