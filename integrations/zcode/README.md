# StrataGate for ZCode

Local-first, source-traceable cross-session memory for ZCode, shipped as a
standalone adapter package (`stratagate-zcode`). Like the Codex adapter, it
owns its build artifacts and loads nothing from `integrations/workbuddy/dist`.

## Layout

```text
.zcode-plugin/plugin.json   ZCode plugin manifest (name: stratagate-memory)
.mcp.json                   MCP server declaration → dist/server.cjs (own build)
hooks/hooks.json            UserPromptSubmit + Stop + SessionStart + PostToolUse
skills/memory/SKILL.md      Agent skill describing the memory protocol
src/config.ts               zcodeEnv/zcodeConfig over the shared adapter-sdk
src/transcript.ts           ZCode rollout parser (model_io format → turns)
src/capture.ts              cursor state + DeliveryJournal + Gateway delivery
src/hook.ts                 hook entrypoint: recall / capture / recap
src/server.ts               MCP shim: sourceAdapter=zcode → gateway MCP tools
src/cli.ts                  doctor / replay / repair-sources
scripts/lib.mjs             installer config-mutation logic (unit tested)
scripts/install.mjs         idempotent installer for ~/.zcode/cli/config.json
scripts/manifest.mjs        pins dist artifact hashes into dist/manifest.json
scripts/verify-install.mjs  release gate (npm run verify:zcode)
```

Build it with:

```bash
npm run build:zcode
```

## Hook events (ZCode supports exactly seven)

The adapter registers four of the seven events ZCode actually fires —
`SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`. Earlier releases
also declared `SubagentStart`, `SubagentStop`, `PreCompact`, and `Interrupt`;
those names are not supported by ZCode and never fired. The installer removes
them.

- **UserPromptSubmit** — flushes the delivery journal, then recalls saved
  memory through the Gateway (`GET /v1/context`) and injects it as
  `additionalContext`.
- **Stop** — reads the ZCode rollout
  (`~/.zcode/cli/rollout/model-io-<sessionId>.jsonl`), folds unseen turns
  (user prompt, assistant replies, tool calls correlated by `call_id`), and
  queues them for the Gateway with a stable cursor and receipt idempotency.
- **PostToolUse** — incremental capture: folds every *completed* turn after
  the cursor and leaves the active turn for Stop, so a crash or interrupt
  cannot lose closed turns. Runs inline on every tool call; with no complete
  turn pending it is a single rollout read.
- **SessionStart** — flushes the delivery journal (crash recovery). When the
  trigger reason is `compact` or `clear`, it also injects a short recap
  pointer (plus recent event titles when the Gateway has them), replacing the
  old PreCompact intent: ZCode has no PreCompact, but post-compaction
  SessionStart is where durable memory must be re-surfaced.

## Install

### Via the installer (recommended)

```bash
npm run build:zcode
node integrations/zcode/scripts/install.mjs
```

This verifies `dist/manifest.json` hashes, then:

- merges connection settings into the owner-readable shared
  `~/.stratagate/connection.json` (also used by the Codex adapter; previous
  MCP env values — including model-provider settings — are carried over);
- points `mcp.servers.stratagate` at this package's `dist/server.cjs`;
- registers the four supported hooks calling `dist/hook.cjs` and removes
  legacy `zcode-hook.mjs` entries, including the four unsupported events;
- backs up `config.json` and never touches unrelated settings.

Restart ZCode (or run `/reload-plugins`) afterwards.

### Via marketplace (ZCode GUI)

Add this repository as a marketplace in **Settings → Plugin Management →
Discover** (pointing at the repo root, whose `.codebuddy-plugin/marketplace.json`
lists the plugin), install `stratagate-memory`, and enable it. The plugin
manifest is self-contained: hooks and MCP servers reference `${ZCODE_PLUGIN_ROOT}/dist/...`.

## What gets recorded (and how)

ZCode writes the complete conversation — user prompts, assistant replies,
tool calls and their results — into the per-session rollout file
`~/.zcode/cli/rollout/model-io-<sessionId>.jsonl`:

- an assistant tool call appears as `response.toolCalls[].{id, name, input}`;
- its result appears in a later line as `request.body.input[].function_call_output`
  `{call_id, output}`.

`src/transcript.ts` correlates the two by `call_id` and stores them as
`assistantToolCalls` (a `ToolTrace` with `name`, `arguments`, `result`), so the
engine can reason about *how* an answer was produced. Every turn carries a
stable receipt (`zcode:<session>:<agent>:turn:<turnId>`), and the Gateway is
the idempotency boundary: replays and hook re-runs never duplicate.

Delivery is durable: turns land in a file-per-receipt journal
(`~/.stratagate/agent-memory/adapters/zcode/deliveries`) and are replayed by
every hook start, the MCP server (every 30s), and `npm run replay` until the
Gateway acknowledges them. With `STRATAGATE_DISABLE_GATEWAY=1` the adapter
steps aside entirely — the rollout file remains the source of truth.

## Provenance

The MCP shim sets `sourceAdapter=zcode`, so assess/record-use provenance is
labeled correctly (the legacy workbuddy shim mislabeled it). To relabel
historical messages that were mislabeled `workbuddy` while ZCode used the
shared shim:

```bash
node integrations/zcode/dist/cli.cjs repair-sources --project /path/to/project --apply
```

Omit `--apply` for a dry run; the matching is content-hash verified by the
Gateway (`POST /v1/admin/adapter-provenance`) and audited under
`<dataDir>/audit/`.

## Diagnostics

```bash
node integrations/zcode/dist/cli.cjs doctor    # installation, gateway auth, journal, identity
npm run replay --workspace stratagate-zcode    # flush the delivery journal
```
