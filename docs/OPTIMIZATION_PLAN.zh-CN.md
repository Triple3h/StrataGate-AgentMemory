# StrataGate Agent Memory 优化总体计划

状态：第二阶段已完成，第三阶段待执行
更新日期：2026-09-05

## 1. 总体结论

StrataGate 已经从“单适配器、同一项目内的跨会话记忆原型”，推进到“多适配器共享 namespace、保留来源 provenance、具备自然时间置信度语义的持久化原型”。

目前不需要继续进行大范围适配器重写。下一步应以真实宿主验证、故障恢复、安全边界和发布形态为主，避免在没有端到端证据的情况下宣称生产级跨 Agent 记忆闭环。

目标架构保持如下边界：

```text
DSH / Codex / WorkBuddy / ZCode
        |
        v
统一身份与 Hook/MCP 接入契约
        |
        v
StrataGate Core
  L0-L5 来源层 -> Event/Element/Graph 派生层
  Retrieval + Evidence Gate + Adoption Weight
        |
        v
共享 SQLite（按 namespace 路由，按 provenance 追溯）
```

## 2. 目标、边界与验收口径

### 2.1 最终目标

在同一用户和项目范围内，多个 Agent 能够：

1. 写入同一个共享记忆空间；
2. 按 Agent、会话和 transcript 隔离状态；
3. 保留原始消息、工具调用和派生记忆的完整来源链；
4. 在使用记忆前经过 evidence gate；
5. 让自然时间衰减基于“最后验证时间”，而不是检索或任意修改时间；
6. 在重启、并发、压缩、中断和重试后不重复、不丢失；
7. 能够通过宿主级端到端测试和可观测数据证明上述行为。

### 2.2 明确不做的事情

- 不把 `agent_id` 放进共享 project namespace；
- 不用检索次数代替事实验证；
- 不用摘要覆盖 L5 原始证据；
- 不先引入向量数据库或远程记忆服务来掩盖身份和来源问题；
- 不把“静态 manifest 检查通过”当成 GPT 桌面端兼容性证明；
- 不把 WorkBuddy 共享构建产物问题误判为核心记忆一致性问题。

## 3. 第一阶段成果：统一接入原型闭环（已完成）

### 3.1 统一身份与 namespace

新增 [packages/core/src/identity.ts](../packages/core/src/identity.ts)，所有宿主适配器采用统一的 project namespace 规则：

```text
shared:user:<user_id>:scope:project:<project_hash>
```

同时保留 `project`、`session`、`global` 三种 scope。Agent 身份不参与共享 namespace，而用于 provenance、状态隔离和并行 Agent 协作。

### 3.2 接入层收敛

- Codex、ZCode、WorkBuddy MCP 配置不再把记忆读取目录绑定到某个固定仓库目录；
- 旧安装配置支持迁移；
- Hook 状态按 `agent + transcript_path` 隔离，避免并行 Agent 覆盖 cursor/pending；
- Codex transcript 合并 `event_msg/item_completed` 与 `response_item`，保留 custom tool 调用及结果；
- DSH、Codex、WorkBuddy、ZCode 注册 `SubagentStart`、`SubagentStop`、`PreCompact`、`Interrupt`；
- ZCode fallback ingestion 使用稳定 receipt，避免重试重复写入。

### 3.3 检索和置信度接口

- 适配器检索结果同时暴露基础 `confidence` 与派生 `effectiveConfidence`；
- `effectiveConfidence` 不覆盖 evidence-backed 的基础置信度；
- 补充跨适配器 namespace、混合 transcript、置信度和 fallback 幂等测试。

### 3.4 第一阶段边界

第一阶段主要改动接入适配器和身份接口，Block、Event、Element、Graph、Evidence Gate、SQLite 原有状态机保持总体独立。因此它解决的是“多个宿主如何连接同一个记忆空间”，还没有解决“身份和验证语义如何作为核心持久化数据被审计”。

## 4. 第二阶段成果：核心 provenance 与验证时间（已完成）

### 4.1 SQLite schema v11

SQLite schema 已从 v10 升级到 v11，并增加旧数据库迁移逻辑；旧 v10 snapshot 也可以被规范化到当前版本。

namespace 级别保存稳定的用户/项目/scope 元数据；原始消息级别保存：

```text
user_id
agent_id
project_id
conversation_id
source_adapter
```

这样多个 Agent 可以共享同一 namespace，同时仍能回溯每条原始消息来自哪个 Agent 和会话。

### 4.2 独立验证时间

EventCard 新增 `lastVerifiedAt`。其职责与 `updatedAt` 分离：

- `updatedAt`：任意字段变更的最后时间；
- `lastVerifiedAt`：最后一次 evidence-backed 验证时间；
- `effectiveConfidence`：基于 `lastVerifiedAt` 和自然时间半衰期计算；
- `recordMemoryUse()` 只增加 adoption weight，不刷新验证时间。

这避免了“记忆被使用过”被错误解释为“记忆刚刚被验证过”。

### 4.3 三端身份上下文传递

DSH、WorkBuddy、ZCode 在打开 Core 和写入 Turn 时传入身份上下文。Usage audit 也保存用户、Agent、项目、会话和适配器信息，形成从答案采用到原始来源的审计链。

### 4.4 发布验证兼容性

WorkBuddy package verifier 已兼容当前 npm 的 `npm pack --json` 返回格式，并处理 npm 11 的 lifecycle script policy。清洁安装、Hook smoke test 和 MCP handshake 已通过。

## 5. 当前验证证据

最近一次验证结果：

| 检查项 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm test` | 通过，147 个测试 |
| `npm run build` | 通过 |
| `npm run verify:workbuddy` | 通过，清洁安装、Hook、MCP handshake |
| 三端脚本语法检查 | 通过 |
| 三端 manifest JSON 检查 | 通过 |
| `git diff --check` | 通过 |
| GPT 桌面端真实多 Agent E2E | 尚未执行 |

上述结果证明代码、迁移、构建和 WorkBuddy 独立安装路径可用，但尚未证明 GPT 桌面端真实 Hook trust、事件 payload 和并行 Agent 行为。

## 6. 第三阶段：宿主级真实 E2E 与可靠性（下一阶段）

目标：证明真实宿主行为，而不是只证明 Node 脚本能运行。

### 6.1 测试矩阵

至少覆盖：

| 场景 | 验收标准 |
| --- | --- |
| Agent A/B 同一项目并行写入 | namespace 相同，原始消息的 agent/conversation provenance 不混淆 |
| 两个 transcript 同时增长 | cursor、pending、receipt 互不覆盖 |
| UserPromptSubmit -> MCP search | 返回 batch 可被同一上下文的 assess 接受 |
| assess -> record_use | 只能采用当前 batch 的 evidence refs，receipt 幂等 |
| SubagentStart/Stop | 子 Agent 写入和主 Agent 状态互不覆盖 |
| PreCompact | 压缩前后不重复写入，L5 保留 |
| Interrupt/重启 | 已落盘内容保留，未完成 job 可恢复 |
| MCP 未连接或 Hook 未信任 | 主流程 fail-open，错误可观测 |
| project/session/global scope | 读取边界与配置一致，不发生跨用户串线 |

### 6.2 实施方式

1. 在 GPT 桌面端启用 Codex plugin 和 Hook trust；
2. 使用两个真实 Agent/transcript 执行固定脚本；
3. 从 Hook 输出、MCP 响应和 SQLite provenance 三侧交叉核对；
4. 保留最小可复现日志和数据库快照；
5. 将成功场景固化为可重复的宿主级 smoke test。

### 6.3 阶段退出条件

- 所有关键事件的真实 payload 已记录并解析；
- 并行 Agent 无 cursor/pending 覆盖；
- batch/assessment/usage receipt 链路在真实宿主中闭环；
- 重启和中断恢复至少验证一次；
- 失败场景不会阻断宿主主流程。

## 7. 第四阶段：发布形态与安装隔离

这阶段不改变记忆语义，专注交付。

### 7.1 共享构建产物模式

继续使用 `integrations/workbuddy/dist/server.cjs` 作为 Codex/ZCode 的共享引擎，要求：

- 文档明确说明依赖关系；
- 安装器检查 dist 版本和完整性；
- 升级时避免 Codex/ZCode 使用不同版本的 Core。

### 7.2 完全自包含模式（可选）

只有在需要独立分发、离线安装或版本隔离时再实施：

- Codex 包自带 server/hook 与 Core；
- ZCode 包自带 server/hook 与 Core；
- 增加跨包版本兼容检查；
- 清洁环境验证数据库、native SQLite 依赖和 Hook。

默认建议先保留共享构建产物，避免重复打包造成逻辑分叉。

## 8. 第五阶段：安全、隐私与多用户边界

当第三阶段 E2E 通过后，再处理更强的安全边界：

- 对 namespace identity 做不可变校验和冲突告警；
- 明确用户、项目、全局 scope 的访问策略；
- 对 raw search、graph search 和 admin UI 做权限边界审查；
- 审计跨 Agent 导入、外部记忆导入和人工 undo；
- 记录敏感字段脱敏策略及其不可逆限制；
- 为数据库备份、迁移失败和恢复建立运维手册。

这里的重点是“可证明地不串线”，而不是增加更多记忆类型。

## 9. 第六阶段：评测、可观测性与生产门禁

### 9.1 评测维度

- 跨会话召回准确率；
- 跨 Agent 来源正确率；
- 时间衰减和验证时间一致性；
- 并发写入冲突率；
- Hook 漏记、重复写入和恢复成功率；
- Evidence Gate 拒绝无证据采用的比例；
- P95 检索、MCP 和后台 derivation 延迟。

### 9.2 必备观测字段

```text
request_id
batch_id
assessment_id
receipt_id
namespace
user_id
agent_id
conversation_id
source_adapter
schema_version
storage_revision
```

### 9.3 生产发布门禁

只有在以下条件同时满足时，才可以对外表述为生产级跨 Agent 持久化记忆：

1. 第三阶段宿主级 E2E 通过；
2. 迁移、并发和恢复测试通过；
3. provenance 和 scope 边界有可审计证据；
4. 关键失败路径 fail-open 且可观测；
5. 至少一轮固定数据集回归评测通过；
6. 发布包在干净环境可安装和运行。

## 10. 推荐执行顺序

```text
已完成：第一阶段 接入统一化
        |
已完成：第二阶段 Core provenance + lastVerifiedAt
        |
下一步：第三阶段 GPT Desktop 真实 E2E
        |
随后：第四阶段 发布形态与安装隔离
        |
随后：第五阶段 安全、隐私、多用户边界
        |
最后：第六阶段 评测、可观测性、生产门禁
```

短期不建议继续增加新的 Agent 适配器或新的记忆类型。优先把现有四套入口在真实宿主中跑通，并把失败、恢复和权限边界证据固定下来。

## 11. 当前剩余事项清单

- [ ] GPT 桌面端真实双 Agent、双 transcript E2E；
- [ ] 真实 Hook trust 和六类生命周期事件 payload 记录；
- [ ] 并发写入、冲突重试、重启恢复的宿主级证据；
- [ ] 评估是否需要 `memory_space_agents` 等更细粒度的 Agent 注册表；
- [ ] 决定共享构建产物还是完全自包含发布包；
- [ ] 固化生产环境备份、迁移和隐私运维流程。

在这些事项完成前，最准确的产品表述是：

> StrataGate 已具备跨适配器、跨会话共享记忆的持久化原型，并具备来源追踪、证据门和自然时间置信度机制；生产级跨 Agent 闭环仍待真实宿主 E2E 和发布门禁验证。
