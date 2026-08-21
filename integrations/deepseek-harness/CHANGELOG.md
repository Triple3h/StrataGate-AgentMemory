# Changelog

## 0.2.15 - 2026-08-21

- Disable reasoning for internal structured memory workers because the current DSH adapters do not map `tool_choice` to the provider request.
- Keep strict native tool-call validation with a legal JSON fallback for adapters that expose tools but not forced tool selection.

## 0.2.14 - 2026-08-21

- Force each internal structured worker to target its one required tool when the provider supports the OpenAI-compatible `tool_choice` request field.
- Preserve the active session's reasoning effort on auxiliary memory-model calls instead of silently falling back to the provider default.
- Add regression coverage for forced tool selection and reasoning-effort propagation.

## 0.2.13 - 2026-08-21

- Run block summarization, event extraction, and element projection through single-purpose native tool calls with strict argument schemas.
- Keep reasoning/text blocks as diagnostics only instead of parsing them as memory results.
- Report internal structured-worker failures with the expected tool name so they are not mistaken for memory search argument failures.

## 0.2.12 - 2026-08-21

- Inject the complete open tail, every sealed Block at its current decay-pointer level, and a bounded set of activated Events and Element facts before each main-model call.
- Build activation queries from the current user message plus the latest two open-tail turns, retaining BM25 as the relevance gate and fusing relevance with existing memory weights through RRF.
- Keep automatic context read-only with respect to adoption: it never calls `recordMemoryUse`, increments `mentionCount`, or changes `lastAdoptedTurn`.
- Require every explicit retrieval batch to finish with `memory_record_use`: selected evidence refs reinforce only their own cards once, while an empty list records a zero-increment receipt and allows the turn to finish.
- Enforce unresolved retrieval accounting at DSH's turn-stopping boundary instead of relying only on prompt compliance.
- Close namespace storage when pending-work initialization fails so a retry does not leak a SQLite handle.

## 0.2.11 - 2026-08-21

- Recover a namespace after pending-work initialization fails instead of caching a rejected runtime promise.
- Distinguish intentionally skipped extraction from Blocks waiting for extraction.

## 0.2.10 - 2026-08-21

- Keep readable memory data visible when one administrative read fails.
- Refresh the Memory UI automatically and distinguish waiting Blocks from active processing.
- Prevent persisted ingestion failures from turning concurrent administrative reads into transient HTTP errors.

## 0.2.9 - 2026-08-20

- Force element projection responses to be JSON-only and require changes for identifiable entities.
- Recover structured JSON after model reasoning text and validate required response fields before accepting it.
- Surface empty element projections with an explicit event-count diagnostic and retry historical skipped extraction jobs on startup.
- Show a red in-progress banner with a loading indicator while block, event, or element memory processing is active.

## 0.2.8 - 2026-08-20

- Increase model output and retry limits to 10,000 tokens.
- Normalize generated timestamps to UTC+8 and treat truncated extraction responses as failures.

## 0.2.7 - 2026-08-20

- Make extractor context target-first: target retains L5 evidence while neighboring blocks provide only L2 context.
- Add an explicit target source-message allowlist and reject empty extraction results as failed work instead of silently skipping them.
- Add a bounded `resumePendingWork({ retrySkipped: true })` path for repairing historical skipped extraction jobs.

## 0.2.6 - 2026-08-20

- Redesign the Memory UI around Long-term Memory, Recent Memory, and More for narrow DeepSeek plugin windows.
- Present Events as long-term memories, Elements as related-item details, and Blocks as recent memories without changing extraction logic.
- Add user-facing organization states, reassuring failure messaging, memory-first search, and responsive light/dark layouts.
- Move system status, usage audit, raw data, model responses, and advanced settings out of the primary experience.

## 0.2.5 - 2026-08-20

- Republish the successful-response history and diagnostics as a distinct installable package version.

## 0.2.4 - 2026-08-20

- Republish the complete error-retention and 10,000-token default configuration as a distinct installable package version.

## 0.2.3 - 2026-08-20

- Improve model JSON recovery for reasoning-only, truncated, BOM-prefixed, and explanatory responses.
- Include bounded raw-response diagnostics when extraction or projection parsing fails.
- Preserve complete failure details for copying while showing only a 500-character preview in the Memory UI.
- Raise the default memory model output budget to 10,000 tokens.
- Retain the five most recent successful memory-model responses per namespace for diagnostics.

## 0.2.2 - 2026-08-19

- Retry malformed or truncated model JSON once with a correction instruction and parse balanced JSON values safely.
- Change the DeepSeek Harness block size default from four to six turns while keeping `blockTurnSize` configurable.
- Redesign the read-only Memory UI with pipeline health, visible block cadence, responsive metrics, and failed-job diagnostics.

## 0.2.1 - 2026-08-18

- Make marketplace, npm, and README descriptions match common agent searches for user preferences, project decisions, cross-session memory, and source-traceable recall.
- Show a dismissible GitHub Star invitation after StrataGate memory has been used in three evidence-backed answers.

## 0.2.0

- Add a read-only StrataGate Memory page for namespaces, Events, Elements, Blocks, source messages, and usage audits.
- Persist the Evidence Gate decision and evidence references with each use receipt.
- Add package-content, clean-install, Node, and DeepSeek Harness compatibility checks.

## 0.1.0

- Initial DeepSeek Harness integration with automatic ingestion, retrieval, expansion, evidence assessment, and use-only reinforcement.
