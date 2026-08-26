import type {
  EventTemporal,
  ExternalMemoryCandidate,
  ExternalMemoryExtractionResult,
  ExternalMemoryExtractor,
  ExternalMemoryKind,
  MemoryCriticality,
  MemoryScope,
} from './types.js';

export const EXTERNAL_MEMORY_EXPORT_SCHEMA = 'stratagate.external-memory.v2';

/** System prompt for the local model that adjudicates one imported candidate. */
export const EXTERNAL_MEMORY_DECIDER_PROMPT_ZH_CN = `
你是 StrataGate 的外部记忆合并裁决器。输入包含一个外部 candidate Event，以及本地检索得到的 Top-K existing Events。只能依据 candidate 和 existing Events 判断，不得引入列表之外的本地事件，也不得凭常识补全时间。

action 只能是：
- ADD：没有足够相同或可更新的本地事件。
- MERGE：candidate 与一个或多个 existing Events 表达同一事实的补充或整合；返回一条更完整的 mergedCandidate，并引用要被新事实取代的 existingEventIds。
- SUPERSEDE：candidate 明确是同一事实的较新版本、纠正或状态更新；引用被取代的 existingEventIds。
- CONFLICT：两条陈述都应保留，但内容无法同时成立；引用冲突的 existingEventIds。
- IGNORE：重复、临时、无长期价值、证据不足，或无法安全判断。

时间裁决：外部 candidate 的时间字段只在其自身有明确依据时保留。不要因为 candidate 较新就假设它发生在导入时间；不确定就保留 originalText 并让 precision/basis 为 unknown。MERGE/SUPERSEDE 不应抹掉旧事件的来源。

只输出 JSON：{"action":"ADD|MERGE|SUPERSEDE|CONFLICT|IGNORE","existingEventIds":["只能来自 Top-K 的 id"],"mergedCandidate":{...可选...},"reason":"不超过 200 字的客观理由"}。
`.trim();

/** Copy this prompt into another AI to obtain a directly importable memory export. */
const LEGACY_EXTERNAL_MEMORY_EXPORT_PROMPT_ZH_CN = `
请为我导出一份可迁移到 StrataGate 的长期记忆。仅使用你当前确实能够访问到的、与我有关的长期记忆和本次会话上下文；不要补充常识推测，不要把助手自己的建议写成我的事实。

抽取范围
1. 指令：我明确要求长期遵循的规则、格式、语气、禁忌和对助手行为的纠正。尽量保留我的原话。
2. 身份：我主动分享的非敏感身份、背景、关系、语言和兴趣。不要输出证件号、联系方式、账号、密码、精确住址等敏感数据。
3. 职业：明确提到的当前或过往职位、公司、职责和技能。
4. 项目：我实际参与或投入精力的项目、状态、决定、变更和结果。
5. 偏好：能够跨会话复用的观点、品味与工作方式。一次性的临时要求不要提升为长期偏好。

事件拆分
- 每个 candidate 只表达一个可独立更新、合并或冲突判断的事实/事件；不要把多个项目或多个时间点塞进一条。
- 同一事实的更新可以分别输出；互相矛盾且无法确认哪条更新时，也分别输出，不要擅自选边。
- 寒暄、重复内容、助手推测、没有长期价值的临时内容不要输出。

时间规则（必须严格遵守）
- mentionedAt 是这条信息被我说出或记录的时间；happenedStart/happenedEnd 是事情实际发生或预计发生的时间，二者不能混用。
- 只有来源明确给出时间，或相对时间能依据已知消息时间唯一换算时，才填写时间字段。
- 不得把今天、导出时间、聊天排序、模型知识截止时间当作事件发生时间。
- “上周、最近、以前、明年”等表达若缺少可核对的参照时间：保留在 temporal.originalText 中，basis 写 unknown，precision 写 unknown，并省略 happenedStart/happenedEnd。
- 若能可靠换算相对时间：basis 写 relative，originalText 保留原表达，并按实际精度填写 precision。不能把“2024 年”伪装成某一天，不能把“3 月”伪装成某个时刻。
- 时间精度只能是 instant/day/month/year/range/unknown。已知年份写 YYYY；已知月份写 YYYY-MM；已知日期写 YYYY-MM-DD；只有确知时刻和时区才写 RFC 3339 时间。
- 时间不确定时宁可省略，不猜测。不要输出 null；未知的可选字段直接省略。

字段规则
- category: instruction/identity/career/project/preference 之一。
- eventType: decision/release/task_completed/plan/change/cancellation/incident/meeting/collaboration/migration/other 之一。
- status: occurred/planned/cancelled/ongoing/unknown 之一。
- scope: user/project/session 之一；通常使用 user，明确只属于某项目时使用 project。
- criticality: routine/preference/identity/safety 之一。
- confidence 是 0 到 1。只有直接、清楚、可归因于我的陈述才可高于 0.85；含糊或间接信息应降低置信度。
- quotes 只放我确实说过且值得保留的短原话；无法逐字确认时留空，不要伪造引号。
- tags 必须包含 category，并可添加少量便于检索的主题标签。

只输出一个合法 JSON 对象，不要使用 Markdown 代码块，不要在 JSON 前后解释。格式如下：
{
  "schemaVersion": "stratagate.external-memory.v1",
  "candidates": [
    {
      "category": "project",
      "title": "简短、可检索的标题",
      "summary": "独立、客观、可长期保存的一条事实",
      "narrative": "必要时补充上下文；没有则与 summary 相同",
      "tags": ["project", "主题标签"],
      "quotes": ["可确认的用户原话"],
      "temporal": {
        "mentionedAt": "2026-08-26T10:30:00+08:00",
        "happenedStart": "2026-08",
        "originalText": "2026 年 8 月",
        "precision": "month",
        "basis": "explicit",
        "status": "occurred",
        "participants": ["相关的人、项目或组织"],
        "eventType": "change"
      },
      "scope": "project",
      "criticality": "routine",
      "confidence": 0.95
    }
  ],
  "coverage": "是否已覆盖当前可访问的全部相关长期信息",
  "uncertainItems": ["未纳入、需用户确认的内容及原因"]
}

如果没有符合条件的长期记忆，仍输出该 JSON 结构，并令 candidates 为空数组。
`.trim();

/** Copy this prompt into another AI to obtain the v2, directly importable export format. */
export const EXTERNAL_MEMORY_EXPORT_PROMPT_ZH_CN = `
请为我导出一份可以迁移到另一个 AI 系统的长期记忆。

你的任务不是写总结文章，而是从你当前能够访问到的、与我有关的长期信息和本次会话上下文中，提取可以长期复用的事实、偏好、规则、项目状态和历史事件。

只记录有明确依据的内容。

不要把你的推测、建议、常识、臆测或助手自己的观点写成我的事实。

────────────────
一、记忆类型
────────────────

每条 candidate 必须先判断 memoryKind：

1. instruction
我明确要求 AI 长期遵循的行为规则。

例如：
- 回答风格
- 输出格式
- 始终做什么
- 绝不要做什么
- 对助手行为的长期纠正

2. preference
稳定、可跨会话复用的偏好。

例如：
- 工作方式
- 工具偏好
- 设计品味
- 信息详细程度
- 稳定习惯或观点

一次性的临时要求不要提升为 preference。

3. fact
相对稳定的事实。

例如：
- 身份背景
- 教育经历
- 职业方向
- 某个项目长期属性
- 人物、组织、工具之间相对稳定的关系

4. event
具有发生、变化、决策或时间过程的信息。

例如：
- 完成某项工作
- 做出某个决定
- 发布版本
- 改变计划
- 开始或结束项目
- 合作、会议、迁移、故障等

────────────────
二、Category
────────────────

category 只能是：

- instruction
- identity
- career
- project
- preference

memoryKind 与 category 是不同概念。

例如：

“用户偏好简洁回答”

memoryKind = preference
category = preference

“用户发布 StrataGate 0.2.8”

memoryKind = event
category = project

“用户是某学校研究生”

memoryKind = fact
category = identity

────────────────
三、提取范围
────────────────

请重点提取：

1. instruction

长期协作规则，包括：
- 语气
- 格式
- 风格
- 助手行为约束
- 长期可复用的纠正规则

2. identity

用户主动分享的非敏感身份信息，包括：
- 姓名
- 年龄
- 大致所在地
- 教育背景
- 家庭和人际关系
- 语言能力
- 长期兴趣

不要输出：

- 身份证号
- 手机号
- 邮箱
- 密码
- API Key
- 精确住址
- 账号凭证
- 其他敏感隐私

3. career

用户明确提到的：

- 当前或过去职位
- 公司或组织
- 职责
- 技能领域
- 职业方向
- 长期职业计划

4. project

用户实际参与、维护或投入过精力的项目，包括：

- 项目名称
- 项目用途
- 当前状态
- 技术方案
- 重要决策
- 已完成工作
- 计划工作
- 取消或改变的工作

项目的重要状态变化应拆成独立 candidate。

5. preference

可以跨会话长期复用的稳定偏好。

────────────────
四、拆分规则
────────────────

每个 candidate 只表达一条能够独立判断的记忆。

不要把：

- 多个项目
- 多个决定
- 多个不同时间点
- 多个无直接依赖的事实

合并成一条。

如果同一事实出现多个版本，可以分别输出。

如果内容互相矛盾，但无法可靠判断哪一条正确：

分别输出。

不要自行替用户选择。

不要输出：

- 寒暄
- 重复信息
- 无长期价值的闲聊
- 临时上下文
- 助手自己的推测

不要把助手说“我记得……”本身作为用户事实。

除非用户明确确认。

────────────────
五、时间规则
────────────────

时间必须谨慎处理。

宁可缺失，也不要猜测。

### mentionedAt

表示这条信息被提及、记录或确认的时间。

只有明确知道消息时间时才填写。

不要使用：

- 当前导出时间
- 当前日期
- 模型知识截止时间

代替 mentionedAt。

### happenedStart / happenedEnd

表示事情实际：

- 发生
- 开始
- 结束
- 或计划发生

的时间。

消息发送时间不能直接作为事情发生时间。

### 相对时间

如果只知道：

- 上周
- 最近
- 以前
- 之后
- 明年
- 过几天
- 不久前
- 去年

但不知道可靠参照日期：

保留原始表达：

temporal.originalText

并设置：

precision = unknown
basis = unknown

不要填写 happenedStart / happenedEnd。

只有明确知道参照日期并能够可靠换算时，才允许换算相对时间。

### precision

只能使用：

- instant
- day
- month
- year
- range
- unknown

不要人为制造更高时间精度。

例如：

“2024 年”

只能：

precision = year

不能转换成：

2024-01-01

### 时间格式

年：
YYYY

月：
YYYY-MM

日期：
YYYY-MM-DD

时刻：
RFC 3339

例如：

2026-08-26T14:30:00+08:00

只有明确知道时区和时刻时才填写 instant。

────────────────
六、Event 字段
────────────────

只有 memoryKind = event 时，eventType 才需要填写。

eventType 只能是：

- decision
- release
- task_completed
- plan
- change
- cancellation
- incident
- meeting
- collaboration
- migration
- other

对于：

instruction
preference
fact

如果不存在明确事件语义，可以省略 eventType。

temporal.status 只能是：

- occurred
- planned
- cancelled
- ongoing
- unknown

────────────────
七、其他字段
────────────────

scope 只能是：

- user
- project
- session

criticality 只能是：

- routine
- preference
- identity
- safety

confidence：

必须为 0 到 1 之间的数字。

明确、直接、重复得到确认的信息可以给予较高置信度。

模糊、间接、可能过时或经过助手总结的信息，应降低 confidence。

quotes：

只能填写可以确认是用户说过的原话。

无法逐字确认时，不要生成引号内容。

participants：

填写与该记忆相关的：

- 人
- 项目
- 组织
- 工具
- 地点

tags：

至少包含 category。

可以增加少量真正有帮助的主题标签。

不要为了增加 tags 数量而生成宽泛标签。

narrative：

只有 summary 无法完整表达必要上下文时才填写。

未知字段不要输出 null。

直接省略。

────────────────
八、来源信息
────────────────

这是一次外部 AI 记忆导出。

请在顶层输出来源信息：

sourceSystem：
当前 AI 系统名称。

如果无法确定，填写 "unknown"。

sourceType：

固定为：

"external_ai_memory_export"

exportedAt：

只有当前系统能够可靠获得当前时间时才填写。

否则省略。

────────────────
九、输出格式
────────────────

只输出一个合法 JSON 对象。

不要输出 Markdown 代码块。

不要在 JSON 前后添加解释。

不要输出分析过程。

结构如下：

{
  "schemaVersion": "stratagate.external-memory.v2",
  "sourceType": "external_ai_memory_export",
  "sourceSystem": "ChatGPT",
  "exportedAt": "2026-08-26T21:00:00+08:00",
  "candidates": [
    {
      "memoryKind": "event",
      "category": "project",
      "title": "简短、明确、方便检索的标题",
      "summary": "一条独立、客观、可以长期保存的记忆",
      "narrative": "必要的上下文",
      "tags": [
        "project",
        "主题标签"
      ],
      "quotes": [
        "能够确认的用户原话"
      ],
      "temporal": {
        "mentionedAt": "只有明确知道时填写",
        "happenedStart": "只有可靠确定时填写",
        "happenedEnd": "只有可靠确定时填写",
        "originalText": "原始时间表达",
        "precision": "day",
        "basis": "explicit",
        "status": "occurred",
        "participants": [
          "相关人物、项目、组织、工具或地点"
        ],
        "eventType": "decision"
      },
      "scope": "project",
      "criticality": "routine",
      "confidence": 0.95
    }
  ],
  "coverage": "full",
  "coverageNote": "必要时简短说明覆盖范围",
  "uncertainItems": [
    "没有导出的内容以及具体原因"
  ]
}

coverage 只能是：

- full
- partial
- limited

请按照以下顺序输出 candidates：

instruction
→ identity
→ career
→ project
→ preference

同一 category 内，可以按照时间或重要程度排序。

如果没有符合条件的长期记忆，请输出：

{
  "schemaVersion": "stratagate.external-memory.v2",
  "sourceType": "external_ai_memory_export",
  "sourceSystem": "unknown",
  "candidates": [],
  "coverage": "limited",
  "coverageNote": "没有找到足够明确且适合长期保存的记忆",
  "uncertainItems": []
}
`.trim();

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function optionalString(value: unknown, maxLength = 2_000): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

function stringArray(value: unknown, limit: number, maxLength = 200): string[] {
  return Array.isArray(value)
    ? [...new Set(value.flatMap((item) => optionalString(item, maxLength) ?? []).slice(0, limit))]
    : [];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined;
}

function parseTemporal(value: unknown): EventTemporal | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  const temporal: EventTemporal = {};
  for (const key of ['mentionedAt', 'happenedStart', 'happenedEnd', 'originalText'] as const) {
    const parsed = optionalString(raw[key], 200);
    if (parsed) temporal[key] = parsed;
  }
  const precision = oneOf(raw.precision, ['instant', 'day', 'month', 'year', 'range', 'unknown'] as const);
  const basis = oneOf(raw.basis, ['explicit', 'relative', 'inferred', 'unknown'] as const);
  const status = oneOf(raw.status, ['occurred', 'planned', 'cancelled', 'ongoing', 'unknown'] as const);
  const eventType = optionalString(raw.eventType, 80);
  const participants = stringArray(raw.participants, 24);
  if (precision) temporal.precision = precision;
  if (basis) temporal.basis = basis;
  if (status) temporal.status = status;
  if (eventType) temporal.eventType = eventType;
  if (participants.length > 0) temporal.participants = participants;
  // A model must not smuggle an exact date alongside an explicitly unknown
  // basis/precision. Keep the original wording for later human review.
  if (precision === 'unknown' || basis === 'unknown') {
    delete temporal.happenedStart;
    delete temporal.happenedEnd;
  }
  return temporal;
}

function parseCandidate(value: unknown): ExternalMemoryCandidate | null {
  const raw = record(value);
  if (!raw) return null;
  const title = optionalString(raw.title, 160);
  const summary = optionalString(raw.summary, 2_000);
  if (!title || !summary) return null;
  const category = oneOf(raw.category, ['instruction', 'identity', 'career', 'project', 'preference'] as const);
  const memoryKind = oneOf<ExternalMemoryKind>(raw.memoryKind, ['instruction', 'preference', 'fact', 'event']);
  const tags = stringArray(raw.tags, 12);
  const candidate: ExternalMemoryCandidate = {
    title,
    summary,
    ...(memoryKind ? { memoryKind } : {}),
    ...(category ? { category } : {}),
    tags: [...new Set([...(category ? [category] : []), ...tags])].slice(0, 12),
    quotes: stringArray(raw.quotes, 12, 500),
  };
  const narrative = optionalString(raw.narrative, 8_000);
  const temporal = parseTemporal(raw.temporal);
  const scope = oneOf<MemoryScope>(raw.scope, ['user', 'project', 'session']);
  const criticality = oneOf<MemoryCriticality>(raw.criticality, ['routine', 'preference', 'identity', 'safety']);
  if (narrative) candidate.narrative = narrative;
  if (temporal) candidate.temporal = temporal;
  if (scope) candidate.scope = scope;
  if (criticality) candidate.criticality = criticality;
  if (typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)) {
    candidate.confidence = Math.max(0, Math.min(1, raw.confidence));
  }
  return candidate;
}

function unwrapJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return fenced?.[1]?.trim() ?? trimmed;
}

/** Parses the structured export prompt output without another model call. */
export function parseExternalMemoryExport(text: string): ExternalMemoryExtractionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapJson(text));
  } catch (error) {
    throw new TypeError(`Invalid external memory JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const root = record(parsed);
  if (!root) throw new TypeError('Invalid external memory JSON: expected an object');
  const schemaVersion = optionalString(root.schemaVersion, 80);
  if (schemaVersion && schemaVersion !== 'stratagate.external-memory.v1' && schemaVersion !== EXTERNAL_MEMORY_EXPORT_SCHEMA) {
    throw new TypeError(`Unsupported external memory schema: ${schemaVersion}`);
  }
  const sourceType = optionalString(root.sourceType, 80);
  if (sourceType && sourceType !== 'external_ai_memory_export') {
    throw new TypeError(`Invalid external memory sourceType: ${sourceType}`);
  }
  const rawCandidates = Array.isArray(root.candidates) ? root.candidates : Array.isArray(root.events) ? root.events : [];
  const candidates = rawCandidates.flatMap((value) => parseCandidate(value) ?? []).slice(0, 200);
  return { candidates, reason: `Parsed ${candidates.length} candidate events from external memory export.` };
}

/** Ready-to-use extractor for JSON created with EXTERNAL_MEMORY_EXPORT_PROMPT_ZH_CN. */
export const externalMemoryJsonExtractor: ExternalMemoryExtractor = async ({ text }) => parseExternalMemoryExport(text);
