<div align="center">

<img src="docs/assets/stratagate-avatar.png" alt="StrataGate 吉祥物" width="200" />

# StrataGate

### 近处保留原话，远处只看索引；证据够了才回答。

面向长期 AI Agent 的分层记忆与证据检索系统。

[![CI](https://github.com/diqierjia/StrataGate/actions/workflows/ci.yml/badge.svg)](https://github.com/diqierjia/StrataGate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://www.typescriptlang.org/)

[English](README.md) · [架构说明](docs/ARCHITECTURE.md) · [完整评测](docs/EVALUATION.md)

**LoCoMo `conv-26`：StrataGate 73.03% · Mem0 base 63.16%**

**时间类问题：61.35% · 34.59%（+26.76 个百分点）**

</div>

## 结果

在 LoCoMo `conv-26` 的 152 道 category 1–4 问题上，StrataGate 多数票正确 **111 / 152**，Mem0 base 为 **96 / 152**。

| 指标 | StrataGate | Mem0 base | 差值 |
| --- | ---: | ---: | ---: |
| 多数票准确率 | **73.03%** | 63.16% | **+9.87** |
| 十次 Judge 平均准确率 | **71.97%** | 63.22% | **+8.75** |
| Single-hop | **79.29%** | 75.14% | +4.14 |
| Multi-hop | **63.44%** | 61.56% | +1.88 |
| Temporal | **61.35%** | 34.59% | **+26.76** |
| Open-domain | 83.85% | **84.62%** | -0.77 |

最大的差距出现在时间类问题。StrataGate 将事件发生时间与对话提及时间分开保存，并在事件卡缺少细节时回查原始消息。

这次对照使用相同的问题集合与顺序、GPT-5.6 Sol 回答模型与 Judge、相同 Judge prompt，以及每题十次独立判断。StrataGate 复用既有 memory state，Mem0 在本轮重新写入记忆；完整协议矩阵见[评测说明](docs/EVALUATION.md)。

### 🎯 更有效的检索，不等于更多检索

在同一份 StrataGate memory state 上：

| 下游模型协议 | 多数票 | 平均检索轮数 |
| --- | ---: | ---: |
| GPT-4o-mini | 74 / 152（48.68%） | 2.7039 |
| GPT-5.6 Sol | **111 / 152（73.03%）** | **1.7961** |

Sol 运行以更少的检索轮数恢复了第六轮 51 道退步题中的 40 道。策略选择比单纯增加搜索次数更重要。

### 🪶 更复杂的内部状态，反而更差

| 检索控制方式 | 正确题数 | 准确率 |
| --- | ---: | ---: |
| 五字段证据门 | **118 / 152** | **77.63%** |
| 更复杂的结构化检索便签 | 97 / 152 | 63.82% |

这次回归决定了当前证据门的形态：字段少、长度受限、下一步动作明确，并且可以由代码检查。

## 核心优势

| 分层记忆 | 时间记忆 | 证据门 |
| --- | --- | --- |
| 同一段对话保留 L0–L5 六种详细程度；越旧显示越浅，需要时回到原文。 | 事件发生时间与提及时间分开保存，支持计划、取消、范围和纠正。 | 搜到相关内容后先判断证据是否充分；不足就继续搜索、展开事件或回查原文。 |

StrataGate 还将“搜索命中”和“回答实际采用”分开。只有真正用于回答的记忆才会被强化，避免检索结果不断强化自身。

## 工作流程

![StrataGate 工作流程：分层记忆、事件卡与证据门](docs/assets/stratagate-how-it-works.zh-CN.png)

对话先封存为分层记忆；值得长期查找的信息进入事件卡。问题到来后先搜索，证据不足就换策略或回查原文，直到通过证据门。

> **记忆有深浅，回答有门槛。**

## 一次真实的检索

在一道关于 Caroline 学校演讲时间的问题中：

```text
事件卡命中“学校演讲”
        ↓
事件相关，但缺少日期
verdict = partial
        ↓
搜索原始消息
        ↓
找到 2023-06-09 消息中的 “last week”
        ↓
verdict = sufficient
        ↓
回答
```

事件卡负责快速定位，原始消息负责最终核对，证据门负责阻止不完整证据进入回答。

## 核心设计

### 🪜 分层记忆块

默认每 12 轮完整对话封存为一个记忆块。

| 层级 | 内容 | 作用 |
| --- | --- | --- |
| L0 | 标题和标签 | 旧记忆索引 |
| L1 | 简短摘要 | 快速了解主题 |
| L2 | 关键点 | 紧凑事实 |
| L3 | 规则精简后的对话 | 去除范围明确的冗余 |
| L4 | 接近原文的可读对话 | 核对自然语言上下文 |
| L5 | 完整消息和工具记录 | 最终来源 |

新块从 L5 开始，随着会话推进逐渐显示更浅的层级。L0–L4 是同一来源的不同视图，L5 原始记录始终保留。

### 🗓️ 事件卡

决定、偏好、计划、纠正和时间事件会被整理为可搜索的事件卡。每张卡都保留来源块和来源消息，并分别记录：

- `mentionedAt`：什么时候在对话中被提到；
- `happenedStart` / `happenedEnd`：事情实际发生的时间；
- 参与者、事件类型、状态、纠正与冲突关系。

### 🚦 证据门

每批新检索结果都会生成五个短字段：

```text
verdict · evidence_refs · fit · missing · next_strategy
```

只有证据来自最新检索结果、`verdict=sufficient` 且 `next_strategy=answer` 时，系统才进入回答。`partial` 和 `wrong` 会触发下一轮搜索、事件展开或原文回查。

### 🌱 实际采用后再强化

搜索只更新检索记录。回答真正采用某张事件卡以后，才调用 `recordMemoryUse()` 更新其长期权重。

新事件可以取代旧事件，但旧来源仍然可追溯；遗忘会让事件退出搜索，同时保留来源链路。

## SQLite 持久化存储

默认构造函数仍然提供内存参考实现。如需让记忆在进程重启后恢复，安装可选的 SQLite 驱动：

```bash
npm install @diqier/stratagate better-sqlite3
```

```ts
import { StrataGate } from '@diqier/stratagate';
import { SqliteStorage } from '@diqier/stratagate/sqlite';

const memory = await StrataGate.open({
  storage: new SqliteStorage({ filename: './data/stratagate.db' }),
  namespace: 'user:alice',
  summarizer,
  extractor,
});

await memory.appendTurn({ user, assistant });
const results = await memory.searchEvents(question);

await memory.recordMemoryUse(
  results.map(({ event }) => event.id),
  { receiptId: `answer:${answerMessageId}` },
);

await memory.close();
```

SQLite 会保存未封块的原始消息、已封存的 L0-L5、事件来源、抽取任务、指针锚点和采用回执。所有写入使用事务和 namespace revision；旧进程继续写入时会得到冲突错误，不会静默覆盖新记忆。

原始 turn 会在摘要和抽取模型调用前提交。任一模型调用失败后，重启进程并调用 `resumePendingWork()`，只会继续未完成的 block。持久化模式下采用记忆必须传入稳定的 `receiptId`，同一个回答即使重试也不会重复强化事件。

适配器会启用 WAL 和外键检查。StrataGate 本身不加密数据库文件；保存敏感对话时，应用必须在文件系统或数据库层提供保护。

## 评测

评测文档包含：

- R1–R5 的设计迭代；
- GPT-4o-mini 与 GPT-5.6 Sol 的模型敏感性实验；
- StrataGate 与 Mem0 base 的配对结果；
- 分类成绩、逐题差异与真实检索路径；
- Judge 设置、模型审计、重试、Token、成本和产物哈希。

详见 [`docs/EVALUATION.md`](docs/EVALUATION.md)。

## 接下来

- 在完整 LoCoMo 数据集上冻结端到端协议；
- 使用 GPT-5.6 Sol 重新构建 StrataGate memory state；
- 对时间字段、事件卡和原文回查做消融实验；
- 完成可复现的 Mem0 clean run；
- 增加一个真实框架 adapter 和数据库原生检索索引。

## 项目结构

```text
src/
  blocks.ts       对话块分层与衰减
  retrieval.ts    证据门合同
  storage.ts      持久化快照与 adapter 合同
  sqlite.ts       事务式 SQLite adapter
  store.ts        内存与持久化生命周期
  types.ts        数据结构与模型适配接口
  weights.ts      记忆采用与权重规则

tests/            核心规则测试
examples/         最小接入示例
docs/             架构与评测文档
benchmarks/       实验记录与机器可读结果
```

## 许可证

StrataGate 使用 [MIT License](LICENSE)。
