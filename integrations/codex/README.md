# StrataGate for Codex

Local-first, source-traceable cross-session memory for Codex, backed by the same
StrataGate engine as the WorkBuddy plugin.

- **Auto-recall on prompt** — a `UserPromptSubmit` hook searches saved memory and
  injects relevant evidence into the turn via `additionalContext`.
- **Auto-capture on stop** — a `Stop` hook incrementally reads the transcript and
  saves the completed turn to local SQLite (L5 source), with a stable receipt so
  replays never duplicate.
- **Evidence-gated MCP tools** — search events / elements / raw memory, expand
  cards and blocks, assess evidence sufficiency, and record adopted evidence.

## Layout

```text
.codex-plugin/plugin.json   Codex plugin manifest (name: stratagate-memory)
.mcp.json                   MCP server declaration (uses the shared engine)
hooks/hooks.json            UserPromptSubmit + Stop hooks (shared engine)
skills/memory/SKILL.md      Agent skill describing the memory protocol
scripts/install.mjs         Idempotent installer that writes ~/.codex/config.toml
```

This is a thin adapter: the MCP server and hooks are the shared engine built in
`../workbuddy/dist` (`server.cjs` / `hook.cjs`). Build it once with:

```bash
npm run build:workbuddy
```

## Install

### Via the installer (recommended)

```bash
node integrations/codex/scripts/install.mjs
```

This ensures `~/.codex/config.toml` has:

- a `stratagate` MCP server (stdio, absolute path to the shared engine);
- `UserPromptSubmit` and `Stop` hooks calling the shared `hook.cjs`.

It backs up `config.toml` first and never removes unrelated config; an existing
`stratagate` MCP entry is preserved.

**Hook trust:** Codex gates hooks behind per-hook trust. After installing, start
a Codex session and approve/trust the new hooks when prompted. Until they are
trusted they will not run. (Headless `codex exec` sessions do not run
UserPromptSubmit/Stop hooks at all — use the desktop interactive session.)

### Via marketplace

```bash
codex plugin marketplace add <this-repo> --sparse integrations/codex
codex plugin add stratagate-memory
```

Note: on Codex 0.139 the plugin-declared MCP server and hooks may not auto-connect
(they require trust / a newer build). The installer above is the reliable path.

## Model for memory processing

Memory processing (L0–L4, events, graph projection) uses an OpenAI-compatible
endpoint when configured; otherwise it falls back to `layered-raw` mode (L5 raw
capture + L0–L4 sealing, no event/graph extraction).

Set these in the `stratagate` MCP server env (or export them) to enable full
event/graph extraction:

```bash
export STRATAGATE_MODEL_BASE_URL="https://.../v1"
export STRATAGATE_MODEL="your-model"
export STRATAGATE_MODEL_API_KEY="your-key"
```

## Tools

All tools are exposed as `mcp__stratagate__*` in Codex:

```text
memory_search_events   memory_expand_event
memory_search_elements memory_expand_element
memory_search_graph    memory_expand_graph_node
memory_search_raw      memory_get_blocks
memory_expand_block    memory_assess
memory_record_use      memory_status
```

See `skills/memory/SKILL.md` for the usage protocol.
