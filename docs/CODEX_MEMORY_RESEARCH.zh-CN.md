# Codex 记忆适配研究固化

> 研究来源：Codex 任务 [`01a06f27-2fe0-7173-9828-425b30038fd3`](codex://threads/01a06f27-2fe0-7173-9828-425b30038fd3)
>
> 固化日期：2026-09-05（Asia/Shanghai）
>
> 适用目标：ChatGPT/GPT 桌面端内置的 Codex，而不是单独安装的旧版 CLI。

这份文档把一次排查得到的事实、代码判断和后续设计要求集中保存。它不是“已完成跨 Agent 记忆”的声明；凡是标为“待修复”或“待验证”的项目，都不能在发布说明中当作已支持能力。

## 结论摘要

当前实现可以作为“同一项目内跨会话持久化”的原型：共享引擎会把原始对话写入本地 SQLite，并通过 Hook 自动召回/捕获，通过 MCP 工具执行证据评估和使用记录。

它还不能直接宣称满足“跨 Agent、跨会话持久化记忆”。阻断点不是 Codex 版本兼容性，而是运行上下文没有完全闭环：

1. MCP server 的项目 namespace 与 Hook 的当前 `cwd` 可能不一致（P0）。
2. DSH、WorkBuddy/Codex、ZCode 默认使用不同 namespace 前缀，单一数据库文件不等于共享记忆（P0）。
3. 还没有完整的 `user_id / agent_id / project_id / conversation_id` 身份和权限模型（P1）。
4. Codex 混合 transcript 中，发现 `event_msg/item_completed` 的人类文本后会提前返回，部分 `response_item/custom_tool_call*` 可能漏记（P1）。
5. 子 Agent 相关 Hook、cursor 和 pending 状态尚未按 Agent/Transcript 完整隔离（P1）。
6. 当前衰减按 turn/use 计算，不是自然时间驱动的 confidence 衰减（P1）。
7. 安装器默认关闭 WorkBuddy 模型处理，因此默认是可持久化的原始/分层记忆，不是完整的事件、元素和图谱语义记忆（P2）。

准确的产品表述应是：

> Codex 适配已具备跨会话持久化基础；跨 Agent 共享、身份隔离、子 Agent 捕获和自然时间置信度衰减尚未闭环。

## 已验证事实

### 运行时和官方能力

- GPT 桌面端内置二进制：`/Applications/ChatGPT.app/Contents/Resources/codex`。
- 本机核验版本：`codex-cli 0.153.1`。
- `/opt/homebrew/bin/codex 0.139.0` 是另一份旧 CLI，不能代表桌面端目标运行时。
- 当前 OpenAI Docs 明确说明：Codex 支持 `config.toml` 内联 Hooks，也支持 `hooks.json`；启用的插件可以捆绑 MCP server、skills 和 lifecycle hooks。
- 桌面端 Codex 支持插件；IDE 扩展不支持插件。CLI 可通过 `/plugins` 浏览和安装插件。
- Hook 需要逐个审查/信任；未信任的非托管 Hook 会被跳过。
- `codex exec`（headless）不会运行本适配依赖的 `UserPromptSubmit`/`Stop` 交互式 Hook，因此自动召回/捕获应在桌面端交互会话中验证。

官方来源：

- [Hooks | ChatGPT Learn](https://learn.chatgpt.com/docs/hooks)
- [Plugins | ChatGPT Learn](https://learn.chatgpt.com/docs/plugins)
- [Config basics | ChatGPT Learn](https://learn.chatgpt.com/docs/config-file/config-basic)

### 本仓库当前实现

- Codex 适配器复用 `integrations/workbuddy` 的共享 MCP server 和 Hook，不应再复制一套 ingestion/derivation 逻辑。
- 安装器在 `~/.codex/config.toml` 写入 `[mcp_servers.stratagate]` 和 `[hooks]`，并备份原配置。
- 插件包另有 `integrations/codex/hooks/hooks.json`，目前只注册 `UserPromptSubmit` 和 `Stop`。
- Hook 在 `UserPromptSubmit` 写入 pending prompt，并把召回上下文作为 `additionalContext` 返回；在 `Stop` 读取 transcript 增量并写入共享引擎。
- 共享数据库默认位于 `~/.stratagate/agent-memory/memory.db`；项目 namespace 由适配器配置计算。
- 记忆协议要求：检索批次必须先 `memory_assess`，只有实际采用该批次证据时才 `memory_record_use`；仅检索不会增强记忆。
- 当前工程在研究会话中通过了类型检查、构建和全部 140 个测试；这证明代码内部契约基本成立，不等于跨 Agent 端到端链路已证明。

## 问题与影响

### P0：MCP 与 Hook 的 namespace 不一致

安装器把 MCP 环境中的 `STRATAGATE_PROJECT_DIR` 固定为 StrataGate 仓库目录：

- `integrations/codex/scripts/install.mjs:72-76`

而 Hook 调用 `resolveConfig(process.env, input.cwd)`，会使用 Codex 当前会话的 `cwd`：

- `integrations/workbuddy/src/config.ts:63-69`
- `integrations/workbuddy/src/hook.ts:76-88`

因此可能出现：Hook 把记忆写入当前项目 namespace，MCP 却搜索仓库 namespace；注入的 `batch_id` 交给 `memory_assess` 时也可能因 namespace 不匹配而失败。用户会看到“有召回”，但无法评估、展开或记录使用。

修复要求：由 Codex 当前项目上下文生成唯一且一致的 namespace；MCP 与 Hook 必须共享同一套 `projectDir`/namespace 解析，禁止安装器写死仓库目录。

### P0：共享数据库不等于跨 Agent 共享

当前默认 namespace 前缀至少包括：

| 适配器 | 默认前缀 |
| --- | --- |
| DSH | `dsh` |
| WorkBuddy/Codex | `workbuddy` |
| ZCode | `zcode` |

即使三者使用同一个 `memory.db`，默认仍会查到不同 namespace。跨 Agent 方案应显式定义稳定身份键，例如：

```text
namespace = user_id + memory_scope + project_id
```

`agent_id` 应作为来源和权限维度保留，而不是偷偷拼进一个不透明字符串。

### P1：身份和权限边界不完整

当前持久化信息覆盖 namespace、session/thread、source block 和 provenance，但没有形成强制的：

- `user_id`
- `agent_id` / `source_agent`
- `project_id`
- `conversation_id`
- 读取/写入权限边界

如果未来改成 global namespace，raw 搜索可能把其他 Agent 或其他用户的原始对话注入当前会话，造成记忆串线和隐私泄漏。任何“全局共享”设计都必须先定义可审计的身份、租户和授权规则。

### P1：Codex transcript 混合格式可能漏记

0.153.1 transcript 同时可见：

- `event_msg / item_completed`
- `response_item / custom_tool_call`
- `response_item / custom_tool_call_output`

当前归一化逻辑位于 `integrations/workbuddy/src/transcript.ts:218-224`。只要 `eventEntries` 中出现人类文本，就直接返回 `eventEntries`，不会再合并 `responseEntries`。因此常见 `CommandExecution` 可以被记录，但某些 custom tool/MCP 调用及其结果可能遗漏。应增加混合格式 fixture，按事件 ID/工具调用 ID 去重并合并，而不是二选一。

### P1：子 Agent 尚未形成闭环

Hook 代码已经识别 `SubagentStop`（`integrations/workbuddy/src/hook.ts:119-129`），但插件 hooks 配置只注册 `UserPromptSubmit` 和 `Stop`（`integrations/codex/hooks/hooks.json:2-27`）。此外，cursor/pending 当前按 `session_id` 存储：

- `integrations/workbuddy/src/state.ts:74-95`

并行子 Agent 可能互相覆盖 cursor，或者把父 Agent 的 prompt 当成子 Agent 的 prompt。需要注册并验证 `SubagentStart`、`SubagentStop`，并以 `agent_id + transcript_path`（必要时加 session）隔离状态；父子关系也应进入 provenance。

### P1：衰减语义与自然时间要求不一致

当前 `memoryWeightAt()` 使用：

```text
elapsed = currentTurn - lastAdoptedTurn
```

见 `packages/core/src/weights.ts:13-20`。它会降低检索权重，但不是“几天未验证就降低 confidence”；没有新 turn 时，记忆不会自然变旧。若产品要求自然时间衰减，应把以下字段分开：

```text
base_confidence
last_verified_at
effective_confidence
```

示例模型（参数需经评估校准）：

```text
effective_confidence = base_confidence * exp(-lambda * days_since_last_verified)
```

这与现有 adoption/weight 衰减是两条正交轴，不应互相冒充。

### P2：默认是 layered-raw，而非完整语义记忆

安装器默认写入：

```toml
STRATAGATE_DISABLE_WORKBUDDY_MODEL = "1"
```

因此默认可保证 SQLite 持久化、L5 原始对话和基础分层 Block，但没有完整的 Event/Element/Graph 提取。启用结构化处理需要在 MCP server 环境配置：

```bash
STRATAGATE_MODEL_BASE_URL="https://.../v1"
STRATAGATE_MODEL="your-model"
STRATAGATE_MODEL_API_KEY="your-key"
```

发布或验收时必须明确区分“原始证据已持久化”和“语义记忆已生成”。

## 与 mem0 Codex 插件的对照

研究中参考了 `/Users/triple3h/Downloads/mem0-main` 的 Codex 插件。它的主要启发是：

- 在 `SessionStart`、`PreCompact`、`Stop` 等多个生命周期点维护状态；
- 安装器把生命周期 hooks 合并到 `~/.codex/hooks.json`，并处理 Hook 开关；
- 把 cursor/摘要等状态视为安装器和 Hook 的一等问题。

这不是要求照搬 mem0。StrataGate 的优势和不可丢失的边界仍是：L5 原始证据、事件 provenance、冲突/替代关系、evidence gate，以及只有 `memory_record_use` 才增强记忆。对照结果只能用于补足 Codex 生命周期覆盖和安装可靠性，不能以摘要替代可追溯来源。

## 推荐实施顺序

1. 统一 MCP/Hook namespace，移除安装器对仓库目录的硬编码。
2. 定义并持久化 `user_id / agent_id / project_id / conversation_id`，明确共享与隔离策略。
3. 修复 transcript 混合格式合并、工具调用 ID 配对和按 transcript 隔离的 cursor。
4. 注册并验证 `SubagentStart/SubagentStop/PreCompact/Interrupt`，补齐父子 Agent provenance。
5. 在不改变现有 adoption weight 语义的前提下，增加自然时间 `effective_confidence`。
6. 将 WorkBuddy 运行时和 Codex 插件打成真正自包含、可安装验证的包。

## 验收清单

### 静态和单元验证

- `npm run check`
- `npm test`
- `npm run build`
- `git diff --check`
- transcript fixture 覆盖 `event_msg` 与 `response_item` 混合输入、MCP/custom tool、工具结果、压缩和子 Agent。

### 桌面端端到端验证

1. 用 `/Applications/ChatGPT.app/Contents/Resources/codex --version` 确认实际桌面端版本。
2. 安装后检查 `~/.codex/config.toml` 或插件 hooks 是否加载了 MCP 与 lifecycle hooks。
3. 在 Codex `/hooks` 中审查并信任当前 Hook 定义。
4. 在两个不同会话、两个不同 Agent 中写入一条带 provenance 的测试记忆。
5. 确认两端使用同一 namespace 时可以检索、`memory_assess`、展开并 `memory_record_use`；不同 namespace 时必须隔离。
6. 并行运行父 Agent/子 Agent，确认 cursor、pending、receipt 和 source agent 不互相覆盖。
7. 分别验证无模型（layered-raw）和配置模型（Event/Element/Graph）两种运行模式。

## 维护规则

- 每次 Codex 或桌面端升级，只更新“已验证事实”并重新跑端到端验收；不要把旧 CLI 的结果外推到桌面端。
- 官方行为以 OpenAI Docs 当前页面为准；本文件中的代码行号是仓库快照定位，代码移动后应更新。
- 任何新增的共享 namespace 能力，都必须同时补充身份/权限、provenance 和跨 Agent 隔离测试。
- 研究结论、实现状态和测试状态分开记录，避免“测试通过”被误读为“产品目标已达成”。

## 2026-09-05 实现更新

已在三套接入中落地第一阶段重构：

- `packages/core/src/identity.ts` 提供统一 namespace 和自然时间
  `effectiveConfidence` 计算；WorkBuddy、Codex、ZCode 默认使用同一共享规则。
- Codex/ZCode/WorkBuddy 的 MCP 声明和安装器移除了仓库目录硬编码，并会迁移旧配置。
- Codex transcript 合并 `event_msg/item_completed` 与 `response_item`，Hook 状态按
  agent + transcript 路径隔离；ZCode fallback receipt 也改为稳定值。
- 三端注册并处理 `SubagentStart/SubagentStop/PreCompact/Interrupt` 生命周期。

这轮仍未把 `user_id/agent_id/project_id/conversation_id` 全部写入 SQLite 的独立列，
也未完成跨主机端到端测试和真正自包含发布包；因此产品表述仍应是“跨 Agent 共享原型
已具备基础闭环，生产级身份权限和发布验收待完成”。
