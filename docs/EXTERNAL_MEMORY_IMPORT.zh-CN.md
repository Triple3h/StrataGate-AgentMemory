# 外部 AI 记忆导入

StrataGate 提供 `importExternalMemory()` 编排外部记忆迁移：

```text
外部 AI JSON
    ↓ extractor（候选 Event）
每个候选 Event → searchEvents()（确定性 BM25，Top-K）
    ↓ decider（ADD / MERGE / SUPERSEDE / CONFLICT / IGNORE）
写入新的规范 Event，保留来源和 supersedes/conflicts 关系
    ↓
只为新 Event 创建元素/知识图谱投影任务
```

## 最小接入

```ts
import {
  EXTERNAL_MEMORY_EXPORT_PROMPT_ZH_CN,
  StrataGate,
  externalMemoryJsonExtractor,
} from '@diqier/stratagate';

// 把 EXTERNAL_MEMORY_EXPORT_PROMPT_ZH_CN 交给外部 AI，并把它返回的 JSON 放入 text。
const result = await memory.importExternalMemory({
  text,
  extractor: externalMemoryJsonExtractor,
  topK: 5,
  decider: async ({ candidate, matches }) => {
    // 这里通常调用你的 LLM；它只能从 matches 中选择 existingEventIds。
    // 返回的 MERGE/SUPERSEDE 会创建新 Event，不会覆盖旧 Event。
    return {
      action: matches.length === 0 ? 'ADD' : 'MERGE',
      existingEventIds: matches.slice(0, 1).map(({ event }) => event.id),
      mergedCandidate: candidate,
    };
  },
});
```

`decider` 的 `matches` 已经被限制为 `topK` 条；即使模型返回其它事件 ID，库也会丢弃这些越界引用。`IGNORE` 只留下审计记录，不会写入 Event。`CONFLICT` 会在新旧事件两侧建立对称的 `conflictsWithEventIds`。

## 给外部 AI 的提示词

直接使用导出的 `EXTERNAL_MEMORY_EXPORT_PROMPT_ZH_CN`。它要求外部 AI 只输出 `stratagate.external-memory.v2` JSON，并区分 `memoryKind`（instruction/preference/fact/event）与 `category`，同时特别约束时间：

- `mentionedAt`（被提及时间）与 `happenedStart/happenedEnd`（实际发生/计划时间）分开；
- 没有明确时间或可靠参照时，不填写日期，不把当前时间、导出时间或聊天顺序当作事件时间；
- 保留 `originalText`，用 `precision` 和 `basis` 标记粒度与依据；
- “上周”等相对时间只有在能依据已知消息时间唯一换算时才转换，否则保持 `unknown`。

如果外部 AI 仍然返回 Markdown 代码块，`parseExternalMemoryExport()` 会自动去除围栏；其它非 JSON 文本会被拒绝，避免把模型解释误写进记忆。

用于第二阶段裁决的系统提示词可使用 `EXTERNAL_MEMORY_DECIDER_PROMPT_ZH_CN`。它明确规定了五种写入动作的边界，并要求模型只能引用本次 Top-K 结果中的事件 ID。
