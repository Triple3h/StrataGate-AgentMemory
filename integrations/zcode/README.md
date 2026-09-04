# StrataGate for ZCode

Local-first, source-traceable cross-session memory for ZCode, backed by the same
StrataGate engine as the WorkBuddy plugin.

- **Auto-recall on prompt** — a `UserPromptSubmit` hook searches saved memory and
  injects relevant evidence into the turn via `additionalContext`.
- **Auto-capture on stop** — a `Stop` hook reads the ZCode rollout
  (`~/.zcode/cli/rollout/model-io-<sessionId>.jsonl`), folds the unseen turns
  (user prompt, assistant replies, tool calls), and saves them to local SQLite
  (L5 source) with a turnId cursor so replays never duplicate.
- **Evidence-gated MCP tools** — search events / elements / raw memory, expand
  cards and blocks, assess evidence sufficiency, and record adopted evidence.

## Layout

```text
.zcode-plugin/plugin.json   ZCode plugin manifest (name: stratagate-memory)
.mcp.json                   MCP server declaration (uses the shared engine)
hooks/hooks.json            UserPromptSubmit + Stop hooks (ZCode-native adapter)
skills/memory/SKILL.md      Agent skill describing the memory protocol
lib/zcode-turns.mjs         ZCode rollout parser (model_io format → TurnInput)
scripts/zcode-hook.mjs      ZCode-native hook: recall on prompt, capture on stop
scripts/install.mjs         Idempotent installer that writes ~/.zcode/cli/config.json
```

The MCP server is the shared engine built in `../workbuddy/dist/server.cjs`. The
hook is **ZCode-native** (`scripts/zcode-hook.mjs`) — the generic
`../workbuddy/dist/hook.cjs` reads Codex/Anthropic-style transcripts and cannot
parse ZCode's `model_io` rollout, so it would silently write nothing. Build the
engine once with:

```bash
npm run build:workbuddy
```

## Install

### Via the installer (recommended)

```bash
node integrations/zcode/scripts/install.mjs
```

This ensures `~/.zcode/cli/config.json` has:

- an enabled `stratagate` MCP server (stdio, absolute path to the shared engine);
- `UserPromptSubmit` and `Stop` hooks calling the ZCode-native `zcode-hook.mjs`,
  each with `matcher: ".*"` — ZCode's `config.json` hook schema **requires** a
  non-empty `matcher` per group (omitting it makes the whole config fail to load);
- a `memory` skill contribution when the plugin is loaded.

It never removes unrelated config; if an entry already exists it is left
untouched and reported. Then restart ZCode (or run `/reload-plugins`).

### Via marketplace (ZCode GUI)

Add this repository as a marketplace in **Settings → Plugin Management → Discover**
(pointing at the repo root, whose `.codebuddy-plugin/marketplace.json` lists the
plugin), install `stratagate-memory`, and enable it.

## What gets recorded (and how)

Only two hooks are needed. ZCode already writes the *complete* conversation —
user prompts, assistant replies, **tool calls and their results** — into the
per-session rollout file `~/.zcode/cli/rollout/model-io-<sessionId>.jsonl`:

- an assistant tool call appears as `response.toolCalls[].{id, name, input}`;
- its result appears in a later line as `request.body.input[].function_call_output`
  `{call_id, output}`.

`zcode-hook.mjs` correlates the two by `call_id` and stores them as
`assistantToolCalls` (a `ToolTrace` with `name`, `arguments`, `result`), so the
L5 source and every `summarizeToolTrace` summary know what a `Bash`/`Edit`/…
call did — e.g. the Maven `-dg` invocation and its output.

Because the rollout already carries tool results, we deliberately do **not**
register `PreToolUse`/`PostToolUse` hooks: they would run inline on *every*
tool call, blocking the session, just to record data the Stop hook already gets
for free. Tool calls/results are captured exactly once at `Stop`.

## Model for memory processing

Memory processing (L0–L4, events, graph projection) uses the WorkBuddy `lite`
model by default when available. If you are not running WorkBuddy, set
`STRATAGATE_DISABLE_WORKBUDDY_MODEL=1` (the installer does this by default) to
fall back to `layered-raw` mode: L5 raw capture still happens, L0–L4 still seal,
but events/graph are deferred until a model endpoint is configured.

To enable full event/graph extraction with an OpenAI-compatible endpoint, add
these to the `stratagate` MCP server env in `~/.zcode/cli/config.json`:

```jsonc
// mcp.servers.stratagate.env
"STRATAGATE_MODEL_BASE_URL": "https://.../v1",
"STRATAGATE_MODEL": "your-model",
"STRATAGATE_MODEL_API_KEY": "your-key"
```

## Tools

All tools are exposed as `mcp__stratagate__*` in ZCode:

```text
memory_search_events   memory_expand_event
memory_search_elements memory_expand_element
memory_search_graph    memory_expand_graph_node
memory_search_raw      memory_get_blocks
memory_expand_block    memory_assess
memory_record_use      memory_status
```

See `skills/memory/SKILL.md` for the usage protocol.
