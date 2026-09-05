export function fmt(value?: string | null): string {
  const date = value ? new Date(value) : null
  if (!value || !date || Number.isNaN(date.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function compact(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function unique(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

const OK_STATUSES = ['succeeded', 'completed', 'skipped', 'ready', 'active', 'organized']

export function statusTone(status?: string): string {
  if (status === 'failed') return 'error'
  if (status === 'running') return 'info'
  if (status && OK_STATUSES.includes(status)) return 'ok'
  return 'warn'
}

export function timeValue(value?: string | null): number {
  const parsed = Date.parse(value ?? '')
  return Number.isNaN(parsed) ? 0 : parsed
}
