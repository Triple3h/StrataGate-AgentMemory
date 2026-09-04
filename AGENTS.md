# AGENTS.md

Local-first, source-traceable cross-session memory for AI agents, shipped as plugins/adapters for DeepSeek Harness (DSH), WorkBuddy, Codex, and ZCode. Derived facts (events, elements, weights) are one-way projections from source messages (blocks L0–L5) and are evidence-gated before use: nothing is remembered as an unquestioned fact.

## Layout

- `src/` — DSH plugin (`stratagate-dsh`): `index.ts` (apply + memory protocol system prompt), `config.ts`, `llm.ts` (model bridge), `runtime.ts`, `tools.ts` (memory_* tools), `web.ts` (Memory UI).
- `packages/core/` — `@diqier/stratagate`, the shared engine: `blocks.ts` (layered L0–L5), `events.ts`, `elements.ts`, `graph.ts`, `retrieval.ts`, `search.ts`, `weights.ts`, `sqlite.ts`/`store.ts`.
- `integrations/workbuddy/` — `stratagate-workbuddy`, builds the shared engine artifacts other adapters reuse: `dist/server.cjs` (MCP server) + `dist/hook.cjs` (generic Codex/Anthropic-style hook). Model your edits here, not by forking logic.
- `integrations/zcode/` — ZCode-native adapter: `scripts/zcode-hook.mjs` + `lib/zcode-turns.mjs` (rollout parser), hooks.json, skill. See `integrations/zcode/README.md`.
- `integrations/codex/` — Codex plugin manifest + `scripts/install.mjs` (writes `~/.codex/config.toml`). See `integrations/codex/skills/memory/SKILL.md`.
- `docs/` — `ARCHITECTURE.md` (system boundaries, block sealing, L3 policy, evidence gate), `DSH.md` (plugin dev/verify), `EVALUATION.md`.
- `.codebuddy-plugin/marketplace.json` — DSH plugin marketplace entry.
- `.codegraph/` — local codegraph index; fully gitignored, ignore it.

## Commands

Node `^22.19 || >=24`. No linter is configured.

```bash
npm install
npm run check        # typecheck: core + dsh + workbuddy (tsc --noEmit)
npm test             # all tests (vitest)
npm run build        # build all three
```

Focused: `npm run check:dsh` / `test:dsh` / `build:dsh` / `verify:dsh` (tarball allowlist check — run before release), and `…:core` / `…:workbuddy` scoped to the workspaces. `verify:dsh` installs the exact tarball in a clean temp project and imports it.

## Conventions

- TypeScript, ESM (`"type": "module"`); local relative imports use the `.js` extension (`import { X } from './config.js'`).
- Tests are vitest; bundling is tsup (entry `src/index.ts`, `noExternal` bundles `@diqier/stratagate`).
- Adapters stay thin: reuse the workbuddy engine, don't reimplement ingestion/derivation.
- Memory protocol invariant: every retrieval batch is assessed (`memory_assess`, sufficient needs a ref from that batch) before reliance, and `memory_record_use` is called only with refs actually used from that exact batch. Mere retrieval never strengthens a card. Read the `MEMORY_PROTOCOL` string in `src/index.ts` before touching tools or the protocol prompt.

## Gotchas

- **ZCode hooks**: `~/.zcode/cli/config.json` requires a non-empty `matcher` per hook group (use `".*"`). ZCode transcripts are `model_io` rollout files (`~/.zcode/cli/rollout/model-io-<sessionId>.jsonl`, OpenAI Responses format), not Anthropic/Codex style — the generic workbuddy `hook.cjs` cannot parse them; use `integrations/zcode/scripts/zcode-hook.mjs`. The Stop hook's `transcript_path` is a temp file with only the last message; read the rollout file instead.
- **Codex**: plugin `.mcp.json` servers do not auto-connect and hooks require per-hook trust; `codex exec` (headless) never runs UserPromptSubmit/Stop hooks. Wiring goes through `integrations/codex/scripts/install.mjs`.
- **Shared DB**: all adapters use `~/.stratagate/agent-memory/memory.db`; namespace is `<host>:project:<sha256 of project dir>`.
- **Layered-raw mode**: turns left in the open tail (`deferProcessing`) are stored but not searchable until a model is configured on the MCP server env (`STRATAGATE_MODEL_BASE_URL` / `STRATAGATE_MODEL` / `STRATAGATE_MODEL_API_KEY`), which lets the background worker seal blocks.

## Read before changing

- `docs/ARCHITECTURE.md` before touching blocks, events, retrieval, or weights.
- `docs/DSH.md` before touching plugin packaging, compatibility, or release gates.
- `integrations/zcode/README.md` and `integrations/codex/skills/memory/SKILL.md` before changing adapter installers or hooks.
