const THEME_KEY = 'stratagate_theme'

function storedTheme(): string {
  try {
    return localStorage.getItem(THEME_KEY) ?? ''
  } catch {
    return ''
  }
}

function systemDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(): void {
  const root = document.documentElement
  if (!root || typeof root.setAttribute !== 'function') return
  const pref = storedTheme()
  if (pref === 'dark' || pref === 'light') root.setAttribute('data-theme', pref)
  else if (typeof root.removeAttribute === 'function') root.removeAttribute('data-theme')
}

export function initTheme(): void {
  applyTheme()
}

export function isDarkTheme(): boolean {
  const pref = storedTheme()
  return pref ? pref === 'dark' : systemDark()
}

export function toggleTheme(): void {
  try {
    localStorage.setItem(THEME_KEY, isDarkTheme() ? 'light' : 'dark')
  } catch {
    /* storage unavailable */
  }
  applyTheme()
}
