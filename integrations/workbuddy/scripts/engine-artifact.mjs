import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const ENGINE_ARTIFACT_SCHEMA = 1
export const ENGINE_ARTIFACT_FILES = ['server.cjs', 'hook.cjs', 'runtime.cjs']

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export function readEngineManifest(engineDir) {
  const manifestPath = join(engineDir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Shared engine manifest not found at ${manifestPath}. Run "npm run build:workbuddy" first.`)
  }
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    throw new Error(`Shared engine manifest is invalid at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!manifest || manifest.schema !== ENGINE_ARTIFACT_SCHEMA || typeof manifest.version !== 'string') {
    throw new Error(`Shared engine manifest has unsupported schema at ${manifestPath}`)
  }
  return manifest
}

export function verifyEngineArtifacts(engineDir, options = {}) {
  const directory = resolve(engineDir)
  const manifest = readEngineManifest(directory)
  const expectedVersion = options.expectedVersion
  if (expectedVersion && manifest.version !== expectedVersion) {
    throw new Error(`Shared engine version mismatch: manifest=${manifest.version}, package=${expectedVersion}`)
  }
  const expectedCoreVersion = options.expectedCoreVersion
  if (expectedCoreVersion && manifest.coreVersion !== expectedCoreVersion) {
    throw new Error(`Shared Core version mismatch: manifest=${manifest.coreVersion ?? 'unknown'}, package=${expectedCoreVersion}`)
  }
  const files = options.files ?? ENGINE_ARTIFACT_FILES
  if (!manifest.files || typeof manifest.files !== 'object') {
    throw new Error('Shared engine manifest does not contain file hashes')
  }
  for (const file of files) {
    const path = join(directory, file)
    if (!existsSync(path)) throw new Error(`Shared engine artifact is missing: ${path}`)
    const expected = manifest.files[file]
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/u.test(expected)) {
      throw new Error(`Shared engine manifest has no valid hash for ${file}`)
    }
    const actual = sha256(path)
    if (actual !== expected) {
      throw new Error(`Shared engine artifact hash mismatch for ${file}: expected ${expected}, got ${actual}`)
    }
  }
  return manifest
}
