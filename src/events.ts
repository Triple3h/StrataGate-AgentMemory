import { normalizeSearchText } from './search.js';
import type { StandardEventType } from './types.js';

/** Maps multilingual/free-text legacy labels into the stable Event taxonomy. */
export function normalizeStandardEventType(value: string | undefined): StandardEventType {
  const normalized = normalizeSearchText(value ?? '').replace(/[\s_-]+/g, '');
  const aliases: Record<string, StandardEventType> = {
    '发布': 'release', '版本发布': 'release', release: 'release', released: 'release',
    '决定': 'decision', '决策': 'decision', decision: 'decision',
    '完成': 'task_completed', '任务完成': 'task_completed', taskcompleted: 'task_completed', completed: 'task_completed',
    '计划': 'plan', plan: 'plan', planned: 'plan',
    '变更': 'change', '修改': 'change', change: 'change',
    '取消': 'cancellation', cancellation: 'cancellation', cancelled: 'cancellation', canceled: 'cancellation',
    '故障': 'incident', incident: 'incident',
    '会议': 'meeting', meeting: 'meeting',
    '协作': 'collaboration', collaboration: 'collaboration',
    '迁移': 'migration', migration: 'migration', other: 'other',
  };
  return aliases[normalized] ?? 'other';
}
