import { parse, stringify } from 'smol-toml'

export const EVENTS = { UserPromptSubmit: 20, Stop: 30, SubagentStart: 10, SubagentStop: 30, PreCompact: 30, Interrupt: 30 }
const ours = command => typeof command === 'string' && /(?:stratagate|StrataGate|integrations\/(?:codex|workbuddy))/.test(command) && /hook\.cjs/.test(command)
export function updateCodexConfig(original, { node, root, connection }) {
  const doc = parse(original)
  const mcp = { ...(doc.mcp_servers?.stratagate ?? {}), type: 'stdio', command: node, args: [`${root}/dist/server.cjs`], startup_timeout_sec: 20, tool_timeout_sec: 120 }
  mcp.env = Object.fromEntries(Object.entries(mcp.env ?? {}).filter(([key]) => !key.startsWith('STRATAGATE_')))
  mcp.env.STRATAGATE_CONNECTION_CONFIG = connection
  const hooks = { ...(doc.hooks ?? {}) }
  delete hooks.state
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`
  const command = `${quote(node)} ${quote(`${root}/dist/hook.cjs`)} --connection-config ${quote(connection)}`
  for (const [event, timeout] of Object.entries(EVENTS)) {
    const groups = Array.isArray(hooks[event]) ? hooks[event] : []
    const retained = groups.map(group => ({ ...group, hooks: (group.hooks ?? []).filter(hook => !ours(hook.command)) })).filter(group => group.hooks.length)
    hooks[event] = [...retained, { hooks: [{ type: 'command', command, timeout }] }]
  }
  // Parse table headers to handle quoted keys and arrays of tables. Preserve all
  // unrelated sections, including hook trust records, byte-for-byte.
  let keep = true
  const lines = []
  for (const line of original.split('\n')) {
    if (/^\s*\[/.test(line)) {
      let header
      try { header = parse(line) } catch { lines.push(line); continue }
      const ownedMcp = header.mcp_servers && Object.hasOwn(header.mcp_servers, 'stratagate')
      const ownedHooks = header.hooks && !Object.hasOwn(header.hooks, 'state')
      keep = !(ownedMcp || ownedHooks)
    }
    if (keep) lines.push(line)
  }
  const result = lines.join('\n').trimEnd() + '\n\n' + stringify({ mcp_servers: { stratagate: mcp }, hooks })
  parse(result)
  return result
}
