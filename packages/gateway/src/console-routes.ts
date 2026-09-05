export const CONSOLE_ROUTES = [
  { path: '/dashboard', view: 'overview', title: '记忆总览', icon: 'dashboard' },
  { path: '/sessions', view: 'conversations', title: '对话来源', icon: 'sessions' },
  { path: '/blocks', view: 'blocks', title: 'Block 分层', icon: 'blocks' },
  { path: '/memory', view: 'structure', title: '记忆结构', icon: 'memory' },
  { path: '/processing', view: 'processing', title: '处理状态', icon: 'processing' },
  { path: '/audit', view: 'audit', title: '使用审计', icon: 'audit' },
  { path: '/import', view: 'import', title: '导入', icon: 'import' },
  { path: '/settings', view: 'settings', title: '设置', icon: 'settings' },
] as const

export function isConsolePath(path: string): boolean {
  const normalized = path.replace(/\/$/, '') || '/'
  return ['/', '/console', '/v1/console'].includes(normalized)
    || CONSOLE_ROUTES.some(route => route.path === normalized)
}
