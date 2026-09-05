import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENGINE_ARTIFACT_FILES, ENGINE_ARTIFACT_SCHEMA } from './engine-artifact.mjs'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const engineDir = join(packageRoot, 'dist')
const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
const corePackage = JSON.parse(readFileSync(join(packageRoot, '..', '..', 'packages', 'core', 'package.json'), 'utf8'))
const files = Object.fromEntries(ENGINE_ARTIFACT_FILES.map((file) => [
  file,
  createHash('sha256').update(readFileSync(join(engineDir, file))).digest('hex'),
]))
const manifest = {
  schema: ENGINE_ARTIFACT_SCHEMA,
  name: 'stratagate-shared-engine',
  version: packageJson.version,
  coreVersion: corePackage.version,
  files,
}
const target = join(engineDir, 'manifest.json')
const temporary = `${target}.${process.pid}.tmp`
writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
renameSync(temporary, target)
process.stdout.write(`Wrote ${target} (engine ${manifest.version}, core ${manifest.coreVersion})\n`)
