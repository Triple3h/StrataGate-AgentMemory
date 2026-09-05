# StrataGate 统一 Memory Gateway 迭代计划

状态：阶段一至四已完成；阶段五、六已实现并完成本地 Docker 自动验收；真实桌面端 E2E 与灾备演练证据仍需部署人员提供

更新日期：2026-09-05

## 1. 目标

将 StrataGate 从“各宿主适配器直接打开 SQLite”演进为：

```text
DSH / WorkBuddy / Codex / ZCode
              |
              v
      Memory Gateway API
              |
              v
      StrataGate Core + 队列
              |
              v
       SQLite memory.db
              ^
              |
      Memory Console API
              ^
              |
           浏览器
```

最终边界：

- Gateway 是唯一的持久化写入入口；
- Core 继续负责 namespace、幂等、L5、Block、Event、Element、Graph、Evidence Gate 和使用审计；
- SQLite 只作为 Gateway 的内部存储，插件和浏览器不获得数据库文件或 SQL 权限；
- 所有原始消息保留来源身份、会话、线程、适配器和 receipt；
- Gateway 不替换 StrataGate Core，也不在适配器中复制 ingestion/derivation 逻辑。

## 2. 当前实现基线

已落地：

- `integrations/workbuddy/src/gateway.ts`：独立本地 HTTP Gateway 入口；
- `integrations/workbuddy/src/gateway-api.ts`：请求校验、身份解析、幂等写入、检索、状态和快照 API；
- `integrations/workbuddy/src/gateway-ui.ts`：黑白、圆角卡片、左侧导航和指标卡片风格的 Memory Console；
- `WorkBuddyRuntime.snapshot()` 及可配置 `namespacePrefix/projectId`；
- `receiptId` 重复提交返回 `duplicate=true`，不会增加 Turn；
- 支持 TCP、Unix Socket、Bearer Token、CORS 和 4 MB body 限制；
- Gateway 写入后异步调用 `resumePendingWork()`，触发 Block 封存及后续派生；
- `integrations/workbuddy/src/gateway-client.ts` 提供 HTTP/Unix Socket 客户端和统一超时、Bearer、重试；
- WorkBuddy/Codex/ZCode Hook 的上下文读取和 Stop 写入默认调用 Gateway；
- DSH Runtime 的写入、自动上下文、检索、展开、Evidence Gate 和 usage receipt 已映射到 Gateway batch；
- WorkBuddy MCP 默认调用 Gateway；设置 `STRATAGATE_DISABLE_GATEWAY=1` 才回到进程内 Runtime；
- `STRATAGATE_GATEWAY_FALLBACK=1` 是显式兼容回退开关，默认关闭；
- 包命令：`npm run gateway` / `stratagate-memory-gateway`；
- 已增加 Gateway API 测试，`npm run check`、`npm test`、`npm run verify:workbuddy` 通过。

当前仍存在的明确缺口：

- 已提供跨进程本地 Outbox：适配器在 Gateway 不可用时将脱敏请求原子写入 `STRATAGATE_DATA_DIR/outbox/*.json`，Gateway 启动及每 30 秒自动 replay；也可使用 `stratagate-memory-outbox status|replay` 诊断或手动恢复；
- 独立 Gateway Console 已扩展为总览、对话来源、Block 分层、Event/Element/Graph、使用审计、导入说明和设置视图；完整外部记忆导入仍复用 DSH 的受控导入工作流；
- 已提供 Docker Compose、`/health`/`/ready`/`/metrics`、请求/队列限制、结构化审计日志和安全/备份运维手册；真实桌面端 E2E 与目标环境灾备演练仍不由自动化冒充。

## 3. API 契约

### 3.1 写入：`POST /v1/ingest/turn`

请求至少包含：

```json
{
  "userId": "triple3h",
  "agentId": "codex",
  "sourceAdapter": "codex",
  "projectId": "project-key",
  "conversationId": "conversation-id",
  "threadId": "thread-id",
  "receiptId": "codex:session:turn:123",
  "user": "用户消息",
  "assistant": "助手回复",
  "toolCalls": []
}
```

处理顺序：

1. 校验字段、身份和 namespace 路由；
2. 以 `receiptId` 做幂等判断；
3. 调用 Core `appendTurn()` 原子保存 L5；
4. 将封存和模型派生任务放入 Gateway 进程队列；
5. 返回 namespace、receipt、duplicate、处理状态和 Core 结果。

### 3.2 读取

| 接口 | 用途 | 约束 |
| --- | --- | --- |
| `GET /v1/context?q=...` | 获取受控上下文 | 返回 evidence batch，调用方仍需 Evidence Gate |
| `GET /v1/memory/events` | Event 检索 | 保留 rankScore 与来源引用 |
| `GET /v1/memory/elements` | Element/事实检索 | 保留 validFrom/validTo 和 Event 来源 |
| `GET /v1/memory/graph` | 图谱检索 | 不把排序分数解释为事实置信度 |
| `GET /v1/memory/raw` | L5/Open Tail 检索 | 支持 namespace/session scope |
| `GET /v1/memory/blocks` | Block 列表 | 返回层级、线程和处理状态 |
| `GET /v1/memory/search` | 统一召回 | 聚合 Event、Element、Raw 和 Tail |
| `GET /v1/memory/snapshot` | 受控诊断读取 | 必须经过身份/权限校验 |
| `GET /v1/console/snapshot` | Console 来源快照 | 只读、受 Gateway 认证和统一脱敏保护 |
| `PATCH /v1/memory/blocks/expand` | 手动展开 Block | 仅允许受控管理操作 |
| `GET /v1/memory/{events,elements,graph}/expand` | 按 retrieval batch 展开来源 | 必须携带 `batchId` |
| `POST /v1/memory/assess` | Evidence Gate 评估 | 评估必须引用同一 Gateway batch |
| `POST /v1/memory/record-use` | 记录采用证据 | 仅接受同一 batch 的 sufficient assessment |
| `GET /v1/dashboard` | Console 聚合 | 只返回统计和可展示字段 |

### 3.3 错误和安全

- 未授权返回 `401`，参数错误返回 `400`，未知资源返回 `404`，冲突返回 `409`；
- 所有 JSON 输出经过敏感信息脱敏；
- token 比较使用常量时间比较；
- 默认只监听 `127.0.0.1`；跨机器部署必须显式配置认证、TLS 或可信反向代理；
- 读取失败对 Agent 请求应 fail-open，但必须写入可观测事件；写入失败不得静默丢失。

## 4. 分阶段实施

### 阶段一：Gateway 原型和 Console（已完成）

交付：独立 Gateway、基础 API、异步处理、幂等写入、只读 Console、测试和启动文档。

退出条件：

- 临时 SQLite 中可完成 ingest -> dashboard -> memory search；
- 相同 `receiptId` 重放不会增加 Turn；
- 服务重启后 namespace、L5 和 revision 可恢复；
- Console 不包含 SQLite 文件读取或 SQL 执行代码。

### 阶段二：四个适配器切换到 Gateway（已完成）

目标：让 DSH、WorkBuddy、Codex、ZCode 的写入和上下文读取默认经过 Gateway。

实施任务：

1. ~~增加共享 `GatewayClient`，统一 HTTP/Unix Socket、超时、重试和错误分类~~（已完成，当前为两次有限重试）；
2. 将各适配器的 `UserPromptSubmit` 映射到 `GET /v1/context`；
3. 将 Stop/完成事件映射到 `POST /v1/ingest/turn`；
4. 将 MCP 检索和 Evidence Gate 请求迁移到 `/v1/memory/*`；
5. 保留短期兼容开关，Gateway 不可用时可显式选择本地 fallback；
6. 统一传递 `userId/agentId/projectId/conversationId/threadId/sourceAdapter/receiptId`；
7. 禁止新代码直接调用 `StrataGate.open()` 进行宿主写入。

验收结果：

- WorkBuddy/Codex/ZCode Hook 在 Gateway 可用时已走 `/v1/context` 和 `/v1/ingest/turn`；
- Gateway 端对同一 namespace 的并发 ingest 串行化，避免 receipt 检查竞态；
- 四个适配器写入同一个 project namespace；
- provenance 能区分四个 sourceAdapter 和各自 thread；
- 同一 transcript 重试只产生一个 receipt；
- Gateway 不可用时的行为、日志和恢复策略有自动化测试覆盖。
- DSH 的批次、Evidence Gate 和 usage receipt 能跨进程映射到 Gateway；
- `npm run check`、`npm test`、`npm run verify:dsh`、`npm run verify:workbuddy` 和宿主 smoke 已通过。

### 阶段三：本地 Outbox 和可靠投递

目标：Gateway 停止、升级或短暂不可用时不丢失对话。

设计：

```text
适配器 -> 本地 outbox/*.json -> Gateway -> SQLite
                         ^
                         |
                    失败重试/退避
```

实施任务：

- Outbox 记录完整请求、创建时间、attempts、nextRetryAt 和最后错误；
- 文件写入采用临时文件 + rename；
- 使用 `receiptId` 作为最终幂等键；
- 重试采用指数退避并设置最大尝试次数；
- 成功后归档或删除已确认项目；
- 提供 `outbox status/replay` 诊断命令；
- 不在 Outbox 中保存未脱敏的凭证。

验收：

- Gateway 停止期间完成的 Turn 在恢复后最终可见；
- 进程崩溃发生在发送前、发送中、响应丢失后三种情况都不会重复写入；
- Outbox 不会阻塞宿主主流程，且失败可观测。

落地说明：

- `@diqier/stratagate` 导出 `FileOutbox`，WorkBuddy、Codex、ZCode 和 DSH 共用同一目录及文件格式；
- `GatewayClient.ingestWithOutbox()` / `DshGatewayClient.ingestWithOutbox()` 仅在网络错误或 5xx 时排队，4xx 参数/权限错误仍直接返回；
- 文件名由 `receiptId`（无 receipt 时由请求指纹）哈希得到，重复 enqueue 不产生第二份记录；写入使用临时文件后 `rename`，权限为 `0600`；
- 每次 replay 先持久化递增的 `attempts` 和指数退避 `nextRetryAt`，因此发送中崩溃会在下一次到期后重试；达到 20 次后保留为 dead-letter，等待人工诊断；
- Outbox 只保存请求体，凭证字段（token、authorization、apiKey、password、secret、credential）写入前替换为 `[REDACTED]`；
- 环境变量：`STRATAGATE_OUTBOX_DIR`（可选，默认 `STRATAGATE_DATA_DIR/outbox`）、`STRATAGATE_DATA_DIR`、`STRATAGATE_GATEWAY_*`；可通过 `STRATAGATE_GATEWAY_FALLBACK=1` 保留旧的本地即时回退行为。

### 阶段四：Memory Console 完整化

目标：将现有参考 UI 风格扩展为可审计的记忆控制台。

页面：

- 总览：namespace、轮次、Block、Event、Element、Graph、队列和最近活动；
- 对话来源：按 Agent/Conversation/Thread 浏览原始消息；
- Block：查看 L0–L5、处理状态、展开记录和关联 Event；
- Event/Element/Graph：查看当前状态、版本、冲突、validity 和来源链；
- 使用审计：查看 retrieval batch、assessment、adoption receipt；
- 导入：调用受控导入 API，不直接写数据库；
- 设置：Block 大小、衰减参数、Gateway 地址和认证状态。

UI 约束：

- 延续参考图的浅灰背景、白色圆角卡片、黑色主按钮、低饱和辅助色；
- 所有数据通过 API 获取；
- 只读数据默认不可编辑/删除；
- 删除、修改和批量覆盖第一版不开放；
- 处理中的任务显示状态和最后错误，但不伪装成已完成。

### 阶段五：部署、安全与运维

目标：让 Gateway 具备稳定的本地服务形态。

实施任务：

- 提供 Docker Compose，读写挂载 `~/.stratagate/agent-memory`；
- 提供 `/health`、`/ready` 和队列/SQLite/revision 指标；
- 明确 TCP 与 Unix Socket 的权限模型；
- 增加请求大小、并发数、队列长度和超时限制；
- 对备份、迁移失败、WAL 和恢复写运维手册；
- 增加 namespace 越权、跨用户读取和 token 泄漏测试；
- 记录结构化审计日志，但不记录完整敏感消息内容。

落地说明：

- 根目录 `Dockerfile` 使用 Node 22 多阶段构建，运行镜像以非 root `node` 用户、只读根文件系统和 `no-new-privileges` 启动；`docker-compose.yml` 将 `~/.stratagate/agent-memory` 挂载到 `/var/lib/stratagate`，并提供 Bearer token、自动重启和容器健康检查。
- Gateway 提供 `/health`（存活）、`/ready`（实际打开/迁移 SQLite）和 `/metrics`（请求、错误、活动请求、队列、namespace、限额）；审计日志只包含 request/path/status/duration/remote 等结构化元数据。
- `STRATAGATE_GATEWAY_MAX_BODY_BYTES`、`STRATAGATE_GATEWAY_MAX_CONCURRENT_REQUESTS`、`STRATAGATE_GATEWAY_MAX_QUEUE_LENGTH`、`STRATAGATE_GATEWAY_REQUEST_TIMEOUT_MS` 和 `STRATAGATE_GATEWAY_RATE_LIMIT_PER_MINUTE` 均在服务端做上下界限制；超限分别返回 413/429。
- 安全测试覆盖 Bearer 认证、显式 foreign namespace 拒绝、请求体上限和频率限制；Unix Socket 继续由数据目录 owner/group 提供文件权限边界。

### 阶段六：宿主级验收和发布

必须同时通过：

- `npm run check`；
- `npm test`；
- `npm run build`；
- `npm run verify:workbuddy`；
- 四适配器 Gateway smoke；
- Gateway 停止/恢复和 Outbox replay；
- 并行 Agent、PreCompact、Interrupt、重启和重复 receipt；
- Console 来源追踪和权限边界；
- 清洁环境安装与数据库迁移。

自动化落地：`npm run verify:gateway` 会启动真实构建产物，验证 `/ready`、认证、ingest 幂等、`/metrics`，停止 Gateway 后写入 Outbox，再重启并 replay；`npm run verify:host` 覆盖 WorkBuddy/Codex/ZCode Hook、MCP、并行 Agent、重启恢复、Evidence Gate 和重复 receipt。两者均纳入 `npm run verify:production`。

真实 GPT Desktop Hook trust、PreCompact/Interrupt 和目标机器备份恢复必须由部署人员在实际宿主环境执行，并分别通过 `STRATAGATE_GPT_DESKTOP_E2E_EVIDENCE`、`STRATAGATE_DR_EVIDENCE` 提供证据；自动化 smoke 不替代这两项证据。

发布门禁：

- API 契约和环境变量文档已更新；
- 旧适配器兼容开关和迁移路径明确；
- 不把静态检查结果冒充真实桌面端 E2E 结果；
- 变更按功能模块提交，Gateway、适配器迁移、Outbox、Console 和部署配置分开提交。

## 5. 暂不做的事情

- 不让浏览器直接打开 `memory.db`；
- 不在适配器内复制 Core 的 Block/Event/Graph 派生逻辑；
- 不用检索次数刷新 `lastVerifiedAt` 或替代 Evidence Gate；
- 不在第一版加入删除/编辑历史事实的 UI；
- 不以引入向量数据库作为 Gateway 落地前提；
- 不把共享 Hook/API smoke 误写成真实桌面宿主 E2E；桌面宿主仍需在各自运行环境单独验收。

## 6. 推荐执行顺序

```text
Gateway API 原型（已完成）
        |
        v
GatewayClient + 四适配器迁移
        |
        v
Outbox 与恢复演练
        |
        v
Console 来源/审计/导入页面
        |
        v
Docker、权限、指标和发布门禁
```

每个阶段都先补测试和可观测性，再扩大写入范围；任何阶段出现 namespace 串线、receipt 重复或来源丢失，都应停止迁移并回到上一阶段修复。
