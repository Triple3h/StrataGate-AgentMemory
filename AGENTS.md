# AGENTS.md

Local-first, source-traceable cross-session memory for AI agents, shipped as plugins/adapters for DeepSeek Harness (DSH), WorkBuddy, Codex, and ZCode. Derived facts (events, elements, weights) are one-way projections from source messages (blocks L0–L5) and are evidence-gated before use: nothing is remembered as an unquestioned fact.

## Layout

- `src/` — DSH plugin (`stratagate-dsh`): `index.ts` (apply + memory protocol system prompt), `config.ts`, `llm.ts` (model bridge), `runtime.ts`, `tools.ts` (memory_* tools), `web.ts` (Memory UI).
- `packages/core/` — `@diqier/stratagate`, the shared engine: `blocks.ts` (layered L0–L5), `events.ts`, `elements.ts`, `graph.ts`, `retrieval.ts`, `search.ts`, `weights.ts`, `sqlite.ts`/`store.ts`.
- `packages/adapter-sdk/` — `@diqier/stratagate-adapter-sdk`: connection config (`~/.stratagate/connection.json`), `GatewayClient` (HTTP transport), `DeliveryJournal` (durable per-receipt delivery), state/contracts/transcript helpers shared by the standalone adapters.
- `packages/gateway/` — `@diqier/stratagate-gateway`: HTTP API (ingest, context, memory reads, settings, provenance admin), background derivation, and the shared stdio `mcp-server.ts` that the adapter shims re-export.
- `integrations/workbuddy/` — `stratagate-workbuddy`, the WorkBuddy host adapter. Its dist is no longer shared: Codex and ZCode build their own artifacts, so model engine edits in `packages/`, not here.
- `integrations/codex/` — `stratagate-codex`, standalone Codex adapter: own capture/hook/server/cli (TS + tsup), depends on adapter-sdk + gateway. See `integrations/codex/README.md` and `skills/memory/SKILL.md`.
- `integrations/zcode/` — `stratagate-zcode`, standalone ZCode adapter (same shape as codex): `src/transcript.ts` (model_io rollout parser), `src/hook.ts` (UserPromptSubmit / Stop / SessionStart / PostToolUse), own `dist/`. See `integrations/zcode/README.md`.
- `console/` — standalone Vue 3 + Vite memory console SPA (own lockfile, **not** an npm workspace). `Dockerfile` + `nginx.conf` run it as a separate service proxying `/v1` + `/health` to the gateway. See `console/README.md`. The gateway's inline vanilla console in `packages/gateway/src/gateway-ui.ts` remains the zero-build fallback.
- `docs/` — `ARCHITECTURE.md` (system boundaries, block sealing, L3 policy, evidence gate), `DSH.md` (plugin dev/verify), `EVALUATION.md`.
- `.codebuddy-plugin/marketplace.json` — DSH plugin marketplace entry.
- `.codegraph/` — local codegraph index; fully gitignored, ignore it.

## Commands

Node `^22.19 || >=24`. No linter is configured.

```bash
npm install
npm run check        # typecheck: core + dsh + workbuddy + adapters (codex, zcode)
npm test             # all tests (vitest)
npm run build        # build all packages
```

Focused: `npm run check:dsh` / `test:dsh` / `build:dsh` / `verify:dsh` (tarball allowlist check — run before release), `…:core` / `…:workbuddy` / `…:codex` / `…:zcode` scoped to the workspaces, and `verify:codex` / `verify:zcode` (build + installer migration gate in a clean temp config). `verify:dsh` installs the exact tarball in a clean temp project and imports it. Console SPA: `npm run console` (dev), `check:console` / `build:console` (type-check via vue-tsc, build via Vite).

## Conventions

- TypeScript, ESM (`"type": "module"`); local relative imports use the `.js` extension (`import { X } from './config.js'`).
- Tests are vitest; bundling is tsup (entry `src/index.ts`, `noExternal` bundles `@diqier/stratagate`).
- Adapters stay thin and standalone: host transport lives in each adapter; connection config, delivery, and evidence contracts come from `packages/adapter-sdk`; ingestion/derivation come from the engine. No adapter loads another adapter's build artifacts.
- Memory protocol invariant: every retrieval batch is assessed (`memory_assess`, sufficient needs a ref from that batch) before reliance, and `memory_record_use` is called only with refs actually used from that exact batch. Mere retrieval never strengthens a card. Read the `MEMORY_PROTOCOL` string in `src/index.ts` before touching tools or the protocol prompt.

## Gotchas

- **ZCode hooks**: ZCode fires exactly seven events — `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `Stop`. `SubagentStart`/`SubagentStop`/`PreCompact`/`Interrupt` are **not** supported (silently ignored). `~/.zcode/cli/config.json` requires a non-empty `matcher` per hook group (use `".*"`). ZCode transcripts are `model_io` rollout files (`~/.zcode/cli/rollout/model-io-<sessionId>.jsonl`, OpenAI Responses format), not Anthropic/Codex style. The Stop hook's `transcript_path` is a temp file with only the last message; read the rollout file instead. Hook stdout must be strict JSON (`{}` is fine; extra keys fail validation) and `async: true` has no effect — hooks run inline.
- **Codex**: plugin `.mcp.json` servers do not auto-connect and hooks require per-hook trust; `codex exec` (headless) never runs UserPromptSubmit/Stop hooks. Wiring goes through `integrations/codex/scripts/install.mjs`.
- **Shared DB**: all adapters use `~/.stratagate/agent-memory/memory.db`; namespace is `<host>:project:<sha256 of project dir>`.
- **Layered-raw mode**: turns left in the open tail (`deferProcessing`) are stored but not searchable until a model is configured on the MCP server env (`STRATAGATE_MODEL_BASE_URL` / `STRATAGATE_MODEL` / `STRATAGATE_MODEL_API_KEY`), which lets the background worker seal blocks.

## Read before changing

- `docs/ARCHITECTURE.md` before touching blocks, events, retrieval, or weights.
- `docs/DSH.md` before touching plugin packaging, compatibility, or release gates.
- `integrations/zcode/README.md` and `integrations/codex/skills/memory/SKILL.md` before changing adapter installers or hooks.
