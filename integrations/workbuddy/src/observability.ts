import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { ObservabilityEvent, ObservabilitySink } from '@diqier/stratagate'

/**
 * Opt-in JSONL sink for host operators. Telemetry is disabled by default and
 * must never become a dependency of the memory path.
 */
export function observabilitySink(env: NodeJS.ProcessEnv = process.env): ObservabilitySink | undefined {
  const target = env.STRATAGATE_OBSERVABILITY_FILE?.trim()
  if (!target) return undefined
  const path = resolve(target)
  let pending = Promise.resolve()
  return (event: ObservabilityEvent) => {
    pending = pending.then(async () => {
      try {
        await mkdir(dirname(path), { recursive: true })
        await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8')
      } catch {
        // The core observe helper also treats sinks as best-effort.
      }
    })
  }
}
