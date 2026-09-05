# StrataGate Memory Console

Read-only memory audit console, rebuilt as a **Vue 3 + Vite + TypeScript SPA**. It replaces the inline vanilla-JS console still embedded in `packages/gateway/src/gateway-ui.ts` (which remains the zero-build fallback for a lone gateway).

## Stack

- Vue 3 (`<script setup>`), vue-router 4, Vite 7, vue-tsc
- No state library: `src/stores/session.ts` (token gate) and `src/stores/workspace.ts` (dashboard + snapshot with generation-guarded aborts) are plain reactive singletons; per-view filters live in the URL query (`project`, `q`, `agent`, `source`, `session`, `tab`)
- Icons: `lucide-vue-next`; design tokens ported verbatim from `packages/gateway/src/console-styles.ts` into `src/styles/app.css` (OpenViking light/dark themes)

This directory is deliberately **not an npm workspace** — it has its own lockfile so the gateway image, the DSH plugin release gates, and adapter builds never depend on the frontend toolchain.

## Development

```bash
cd console
npm install
npm run dev        # http://localhost:5173, proxies /v1 + /health to the gateway
```

The dev/preview proxy target defaults to `http://127.0.0.1:43731` and can be overridden with `STRATAGATE_GATEWAY_ORIGIN`. Start a gateway first (`npm run gateway` at the repo root).

```bash
npm run check      # vue-tsc --noEmit
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ with the same proxy (port 4173)
```

For a cross-origin deployment without a proxy, build with `VITE_GATEWAY_ORIGIN=http://gateway-host:43731` — the gateway already sends permissive CORS headers.

## Deployment: console and gateway as two services

`console/Dockerfile` builds the SPA and serves it from nginx, which also reverse-proxies `/v1` and `/health` to the gateway service — the browser only ever talks to the console origin, and the gateway token still gates every API call.

```bash
# from the repo root
docker compose up --build               # gateway on :43731 + console on :8080
docker compose up --build stratagate-memory-gateway   # gateway only (inline console stays available)
STRATAGATE_CONSOLE_PORT=3000 docker compose up stratagate-console
```

The console service is read-only static nginx (no volumes, `no-new-privileges`). Gateway-only deployments keep the legacy inline console at the gateway origin.

## Behavior notes

- Auth matches the legacy console: the token is stored in `localStorage` under `stratagate_gateway_token`; a 401 from any API call flips back to the login panel. Project scope persists under `stratagate_console_project`, theme under `stratagate_theme`.
- Project selection is part of the URL (`?project=…`) and survives view switches — filters and session selection are cleared when the project changes.
- Data sources: `GET /v1/dashboard` and `GET /v1/console/snapshot?namespace=…` only; the console is strictly read-only.
