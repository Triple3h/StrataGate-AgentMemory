# Evaluation record and reporting rules

This document separates completed development experiments from benchmark claims. Every public score should state the dataset scope, question categories, extraction model, answer model, judge model, prompt, repetitions, and whether the memory state was created inside the same run.

## Completed `conv-26` directional pairing

The latest completed comparison covers one LoCoMo conversation, `conv-26`: 419 messages, 35 sessions, and 152 category 1-4 questions. Both arms answered the same questions in the same order and used `gpt-5.6-sol` with the same Judge prompt and ten independent Judge decisions per question.

> [!IMPORTANT]
> This is a single-conversation directional comparison, not a full LoCoMo score or a cross-project leaderboard. The two arms did not use the same memory-construction pipeline or answer context, so the result does not isolate memory architecture as a single causal variable.

### Overall result

| Metric | StrataGate round seven | Mem0 base | StrataGate - Mem0 |
| --- | ---: | ---: | ---: |
| Ten-Judge mean accuracy | **71.9737%** | 63.2237% | **+8.7500 pp** |
| Majority-correct questions | **111 / 152** | 96 / 152 | **+15** |
| Majority accuracy | **73.03%** | 63.1579% | **+9.87 pp** |

Mem0's ten independent Judge runs ranged from 61.8421% to 65.1316%, with a standard deviation of 0.9045 percentage points.

### Mean accuracy by category

| Category | Questions | StrataGate round seven | Mem0 base | StrataGate - Mem0 |
| --- | ---: | ---: | ---: | ---: |
| Multi-hop | 32 | **63.4375%** | 61.5625% | +1.8750 pp |
| Temporal | 37 | **61.3514%** | 34.5946% | **+26.7568 pp** |
| Open-domain | 13 | 83.8462% | **84.6154%** | -0.7692 pp |
| Single-hop | 70 | **79.2857%** | 75.1429% | +4.1428 pp |

The largest observed gap is in the temporal category. That observation is consistent with StrataGate's explicit event-time fields and raw-message fallback, but this comparison alone is not an ablation and does not prove that either mechanism caused the full difference.

### Paired majority outcomes

| Outcome | Questions |
| --- | ---: |
| Both correct | 76 |
| StrataGate correct, Mem0 wrong | 35 |
| StrataGate wrong, Mem0 correct | 20 |
| Both wrong | 21 |

### Protocol matrix

| Field | StrataGate round seven | Mem0 base |
| --- | --- | --- |
| Dataset scope | `conv-26`, categories 1-4, 152 questions | Same IDs, order, text, gold answers, and categories |
| Memory construction | Reused an existing state extracted with `gpt-4o-mini` | Fresh build with `gpt-5.6-sol` |
| Retrieval and assessment | StrataGate tools and five-field evidence gate with `gpt-5.6-sol` | Two speaker searches, top-30 each; no graph |
| Answer model | `gpt-5.6-sol`, `reasoning_effort=low` | `gpt-5.6-sol`, `reasoning_effort=low` |
| Judge | `gpt-5.6-sol`, ten repeats | Same model, prompt, parser, and repeats |
| Judge prompt SHA-256 | `44fb3d8f7a1f37b2430772cf90518a32172e4056b7a0dec085402763fd179b9f` | Same |
| Answer context and prompt | StrataGate-specific | Mem0-specific |
| Embedding | Architecture-specific retrieval; no shared embedding protocol | `text-embedding-3-small`, 1536 dimensions |

Mem0 used the local base SDK version 0.1.97 pinned to commit `2b58775c17eb1c1b7532242b7154af6744102280`, with Graph, Cloud, and Platform v3 disabled. It processed 419 source messages through two speaker views, completed all 428 write units, and produced 173 final memories.

Both runs completed 152 / 152 questions and 1,520 / 1,520 Judge decisions. The Mem0 run retained 187 historical failed-attempt traces, but all were recovered and the unrecovered failure count is zero. Those bodyless failed attempts have no returned model value; they are not successful responses from a different model. The standalone structural protocol audit reports `passed=true`, while the generated summary keeps `passed=false` because its stricter request audit counts those historical `response.model=None` attempts. Completion and clean-transport acceptance are therefore reported separately.

The public, machine-readable aggregate is [`benchmarks/locomo-conv26-sol-mem0-paired.json`](../benchmarks/locomo-conv26-sol-mem0-paired.json). Raw requests and per-question traces are not copied into this public repository.

| Source artifact | SHA-256 |
| --- | --- |
| StrataGate round-seven `summary.json` | `fe6ae48ca3d1c8fcc8bf65f11058e2253f64927db9b5b69af5fd1d8b91dcaa8e` |
| Mem0 `summary.json` | `88f39b729546c6f343e51a11ad8f80bc1eea06ba831f33008fad779b04962927` |
| Mem0 `paired-comparison.json` | `27b604692364f24600d9513d8d2b91da9b52245a4574f581afb0afc6f00ee7fc` |
| Mem0 `protocol-audit.json` | `c1e39714eb08a775f9cbe12d0a43de6d825c142991840eab329398d1b9d744eb` |

## Development sequence

The first five completed runs used one LoCoMo conversation, `conv-26`:

- 419 messages;
- 35 sessions;
- 152 category 1-4 questions;
- `gpt-4o-mini` extraction;
- `gpt-4o` answerer and judge.

The fixed slice made regressions cheap to inspect, but it is not a full LoCoMo evaluation.

| Run | Main intervention | Correct | Accuracy | Protocol note |
| --- | --- | ---: | ---: | --- |
| 1 | Initial block/event architecture | 67 / 152 | 44.08% | Temporal questions were especially weak |
| 2 | Multiple event cards per block and explicit event occurrence time | 77 / 152 | 50.66% | Temporal-category accuracy rose from 18.92% to 45.95% |
| 3 | Extraction, read tools, and per-batch assessment changed together | 116 / 152 | 76.32% | One adoption-rule violation; strict score 115 / 152 (75.66%) |
| 4 | Bounded assessment context and fixed budget-end adoption | 118 / 152 | 77.63% | Zero recorded adoption violations; about 10.35% fewer QA tokens than run 3 |
| 5 | Larger structured retrieval scratchpad | 97 / 152 | 63.82% | Regression led to restoring run 4's five-field contract |

These runs show an engineering process. They do not isolate every causal variable. In particular, run 3 changed several components at once, so its gain cannot be attributed to a single tool or prompt.

## Protocol controls and sensitivity checks

Later runs answered different questions about the evaluation protocol and are not added to the development curve.

### Frozen mini-model protocol

A completed 152-question run fixed extraction, answering, judging, prompt, temperature, category scope, and ten independent judge decisions per question to the chosen mini-model protocol.

- 152 / 152 questions completed;
- ten judge decisions per question;
- mean score: 48.9474%;
- majority score: 74 / 152 (48.68%).

This result is useful for protocol comparability. It must not be plotted as a direct regression from run 4 because the answerer and judge changed.

### Sol retrieval/answer/judge sensitivity run

Another completed run used `gpt-5.6-sol` for retrieval, assessment, answering, and judging:

- 152 / 152 questions completed;
- 1,520 judge decisions;
- mean score: 71.9737%;
- majority score: 111 / 152 (73.03%).

This run reused a previously extracted memory state. It was not an end-to-end Sol extraction result. Retrieval, assessment, answering, and judging changed together, so the score is directional and not evidence that any one memory component caused the difference.

### Judge sensitivity

At least one fixed answer received opposite judgments under two judge models: 10 / 10 correct with the mini judge and 0 / 10 with the Sol judge. This is why StrataGate does not treat judge changes as memory-quality changes.

## Reporting checklist

Before treating two scores as comparable, freeze and report:

- dataset version and conversation/question scope;
- included categories;
- extraction code and model;
- retrieval code, tools, budgets, and prompts;
- answer model, temperature, and reasoning configuration;
- judge prompt, model, temperature, and repetitions;
- provider and returned-model audit;
- memory-state provenance;
- retries, missing responses, and checkpoint completion;
- exact numerator and denominator, not only a rounded percentage.

## What the current evidence supports

The current evidence supports these narrow claims:

- on this single conversation and these tested configurations, StrataGate round seven scored 111 / 152 by majority vote and Mem0 base scored 96 / 152;
- the largest observed paired category gap was temporal, while Mem0 was slightly higher on open-domain questions;
- separating event occurrence time from mention time improved temporal questions on the fixed development conversation;
- evidence checking after retrieval batches was part of the best-performing development configuration;
- the larger retrieval scratchpad caused a reproducible regression on the same slice;
- judge choice can materially change the score of identical answers;
- completed per-question checkpoints and request traces are necessary to distinguish model behavior from transport failure.

It does not yet support these broader claims:

- state of the art on LoCoMo;
- generalization across the full LoCoMo dataset;
- superiority to another open-source memory system under a shared end-to-end protocol;
- a single-component causal explanation for the run 3 or Sol gains.

The next credible milestone is a full-dataset, end-to-end run with one frozen protocol, a freshly built StrataGate memory state, and a baseline created under the same extraction, answer, and Judge configuration.
