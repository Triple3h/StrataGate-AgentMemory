# StrataGate Full for WorkBuddy Desktop

Automatic, local-first cross-session memory for WorkBuddy Desktop. The plugin bundles a Host Adapter and MCP server: `UserPromptSubmit` retrieves local evidence into `additionalContext`, `Stop` incrementally ingests the transcript into L5, and the persistent MCP process uses WorkBuddy's built-in `lite` model to derive L0-L4 blocks, Events, and Elements in the background. No separate API key is required.

## Memory Gateway

The package also ships a standalone local Gateway for sharing one SQLite-backed memory store across DSH, WorkBuddy, Codex, ZCode, and the browser console:

```bash
npm run build:workbuddy
STRATAGATE_GATEWAY_PORT=43731 npm run gateway
```

It exposes `POST /v1/ingest/turn`, `GET /v1/context`, `GET /v1/memory/*`, `PATCH /v1/memory/blocks/expand`, `GET /v1/dashboard`, and the read-only `GET /v1/console/snapshot?namespace=...` projection used by the console. The console is available at `/`; it only calls the API and never receives SQLite or SQL access. `STRATAGATE_GATEWAY_TOKEN` enables Bearer-token authentication, and `STRATAGATE_GATEWAY_SOCKET` selects a Unix socket instead of TCP.

Hooks prefer the Gateway and are Gateway-only by default. During migration, set
`STRATAGATE_GATEWAY_FALLBACK=1` to explicitly allow the legacy local SQLite
fallback; an unavailable Gateway otherwise fails open without bypassing it.

WorkBuddy, Codex, and ZCode share the `~/.stratagate/agent-memory/memory.db`
store and default to `shared:user:<user_id>:scope:project:<project_hash>`.
Set `STRATAGATE_USER_ID` consistently when agents should share a user's project
memory; transcript cursors remain isolated by agent and transcript path.

After three distinct evidence-backed adoption receipts, the plugin shows one dismissible GitHub Star invitation. WorkBuddy Web/IDE clients render a native MCP App card, while terminal clients receive a text fallback. The UI is bundled locally, the shown marker stays local, and no impression, dismissal, or click telemetry is sent.

## Development

```bash
npm install
npm run build:workbuddy
codebuddy plugin validate ./integrations/workbuddy
codebuddy --plugin-dir ./integrations/workbuddy
```

See [README.zh-CN.md](README.zh-CN.md) for the complete workflow, model configuration, tool contract, privacy boundary, and marketplace installation instructions.

Search cards are compact by default. Event and fact hits keep stable ids, title, summary/value, time,
and `rankScore`; `rankScore` is only the BM25/RRF ordering metric, not confidence or factual accuracy.
Raw hits keep a bounded excerpt plus message id and `blockId`; expand the block for complete source content.

When the Gateway is temporarily unavailable, completed turns are atomically queued in the local outbox (credential fields are redacted) and replayed automatically after recovery. Use `stratagate-memory-outbox status` or `stratagate-memory-outbox replay` to inspect or manually replay pending entries.

`memory_get_blocks` defaults to the active session (`scope=session`) and accepts `scope=namespace` to list every thread in the current project namespace. Responses include the selected scope, namespace, thread id, counts, and a machine-readable `emptyReason`; `memory_search_raw` defaults to namespace scope and accepts the same filter so raw block hits can be browsed or expanded consistently.
