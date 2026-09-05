import { Activity, ArrowRight, BookOpen, CheckCheck, Database, Download, LayoutDashboard, Layers, MessageSquare, RotateCcw, Search, Settings, Sparkles, X, type IconNode } from 'lucide'
import { CONSOLE_CLIENT } from './console-client.js'
import { CONSOLE_ROUTES } from './console-routes.js'
import { CONSOLE_STYLES } from './console-styles.js'

function svg(nodes: IconNode): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + nodes.map(([tag, attributes]) => '<' + tag + ' ' + Object.entries(attributes).map(([key, value]) => key + '="' + String(value) + '"').join(' ') + '></' + tag + '>').join('') + '</svg>'
}

const icons = Object.fromEntries(Object.entries({
  dashboard: LayoutDashboard, sessions: MessageSquare, blocks: Layers, memory: BookOpen,
  processing: Activity, audit: CheckCheck, import: Download, settings: Settings,
  refresh: RotateCcw, search: Search, close: X, reset: X, arrow: ArrowRight,
  brand: Sparkles, database: Database,
}).map(([name, nodes]) => [name, svg(nodes)]))

/** Static UI assets only. All source data is fetched through authenticated Gateway APIs. */
export const MEMORY_CONSOLE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>StrataGate Memory Console</title>
<link rel="icon" href="data:,">
<style>${CONSOLE_STYLES}</style>
</head>
<body>
<div id="app"></div>
<script>
const ROUTES = ${JSON.stringify(CONSOLE_ROUTES)};
const ICONS = ${JSON.stringify(icons)};
${CONSOLE_CLIENT}
</script>
</body>
</html>`
