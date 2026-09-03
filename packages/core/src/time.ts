/** Canonical application timestamps use the UTC+8 offset explicitly. */
const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000

export function toUtc8Iso(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date')
  return new Date(date.getTime() + UTC8_OFFSET_MS).toISOString().replace('Z', '+08:00')
}

export function nowUtc8(): string {
  return toUtc8Iso(new Date())
}
