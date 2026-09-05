# StrataGate for Codex

Codex has its own hook, rollout capture, installer, MCP entrypoint, and diagnostics.
It shares the memory engine and Gateway with other agents. No Codex entrypoint
loads a build artifact from `integrations/workbuddy/dist`.

## Responsibilities

- `packages/core`: storage, blocks, derivation, retrieval, evidence gates.
- `packages/gateway`: authenticated ingestion, processing, MCP tool registration,
  and the Memory Console. WorkBuddy's old entrypoints are compatibility exports.
- `packages/adapter-sdk`: connection configuration, Gateway transport, evidence
  contracts, state helpers, and the source-preserving delivery journal.
- `integrations/codex/src`: Codex lifecycle and native turn parsing. Identity is
  always `sourceAdapter=codex`; project namespaces remain shared with other hosts.

## Build and Install

Requires Node `^22.19 || >=24`.

```bash
npm install
npm run build
node integrations/codex/scripts/install.mjs --connection-env /path/to/gateway.env
```

`--connection-env` is optional when a shared connection already exists. The
installer copies connection settings, never prints tokens, backs up existing
configuration, and verifies the hashes of Codex's own build artifacts. Unrelated
Codex settings and hook commands are preserved. Hook entries are inserted in
their own TOML tables, including when `[hooks.state]` already exists.

Hook and MCP use the same owner-readable `~/.stratagate/connection.json`:

```json
{
  "STRATAGATE_GATEWAY_URL": "http://127.0.0.1:43731",
  "STRATAGATE_GATEWAY_TOKEN": "your-existing-gateway-token",
  "STRATAGATE_USER_ID": "your-user-id",
  "STRATAGATE_DATA_DIR": "/absolute/path/to/agent-memory"
}
```

Override its path with `--connection-config` during installation. Explicit process
environment values override saved connection values. Codex host identity is set
by the adapter; a project directory is resolved from each rollout/hook, not from
the installation directory. Run MCP from the active project directory.

After installation, restart Codex and trust the changed hook commands when
prompted. Installation does not prove a hook executed. Headless clients that do
not emit hooks require explicit capture/backfill.

## Capture and Recovery

`UserPromptSubmit` recalls evidence. `Stop` and `SubagentStop` capture completed
turns. `PreCompact` and `Interrupt` capture already completed turns while leaving
unfinished work in the source rollout. `SubagentStart` records lifecycle telemetry.

The parser groups messages and tools by the native Codex turn ID. Upstream
generation IDs are not turn boundaries. Actual UserMessage events take precedence
over injected AGENTS/environment records. Repeated text in different turns is
retained. Partial JSON at the end of a growing rollout is retried later.

Each turn is journaled with owner-only permissions before the capture offset
advances. A native session/turn receipt is shared by live capture and backfill,
independent of the hook's transient agent label. The Gateway acknowledges or
deduplicates it before the journal marks delivery complete. Source text and tool
results are preserved without redaction in this local journal. Do not publish it.

Authentication, network, and ingestion errors leave a pending journal entry.
The MCP process retries every 30 seconds; hooks and `replay` also retry. Large
turns may require increasing `STRATAGATE_GATEWAY_MAX_BODY_BYTES` on the Gateway
(up to 16 MiB). A pending status of 413 identifies that condition. Failed delivery
does not block the conversation itself.

```bash
node integrations/codex/dist/cli.cjs doctor
node integrations/codex/dist/cli.cjs replay
node integrations/codex/dist/cli.cjs backfill --project /absolute/project --report /tmp/backfill.json
node integrations/codex/dist/cli.cjs backfill --project /absolute/project --apply
```

Backfill requires a project or `--transcript FILE`. Without `--apply` it is a
preview. Incomplete turns are omitted. The receipt journal prevents live/backfill
overlap from appending the same native turn again. Exact legacy matches can adopt
the new receipt while retaining their original raw messages; a more complete
source capture may be retained alongside an older partial legacy capture.

## Correct Legacy Source Labels

```bash
node integrations/codex/dist/cli.cjs repair-sources --project /absolute/project --report /tmp/sources.json
node integrations/codex/dist/cli.cjs repair-sources --project /absolute/project --apply
```

The repair requires matching conversation identity and verbatim role-specific
text in a local Codex rollout. It only changes legacy `workbuddy` agent records
whose source is `workbuddy` or `gateway`. The Gateway checks the expected content
hash and revision, records the old provenance in an audit file, and preserves
message IDs and raw content. Regenerate the report on a conflict.

`doctor` separates installation, authenticated connectivity, actual hook
timestamps, pending delivery, and the last successful delivery. A healthy
Gateway is not evidence of successful Codex capture.

The evidence protocol and MCP tool names are unchanged; see
`skills/memory/SKILL.md`. Model credentials and background derivation belong to
the Gateway deployment. Codex never launches WorkBuddy to derive memory.
