# StrataGate 观测与生产门禁

第六阶段把观测定义为本地、可审计的 JSONL 事件，而不是远程服务依赖。默认不写文件；需要
启用时，WorkBuddy 设置 `STRATAGATE_OBSERVABILITY_FILE=/absolute/path/observations.jsonl`，
DSH 设置 `STRATAGATE_OBSERVABILITY_LOG=1` 输出结构化日志。

每条 `ObservabilityEvent` 都包含：

```text
schema_version emitted_at operation outcome duration_ms
request_id batch_id assessment_id receipt_id namespace
user_id agent_id conversation_id source_adapter storage_revision attributes
```

`batch_id`、`assessment_id` 和 `receipt_id` 分别对应检索、证据评估和采用回执；不适用时为
空字符串。`storage_revision` 用于把并发冲突、重试和恢复与 SQLite 提交顺序对齐。观测 sink
异常会被吞掉，不会阻断 Hook、MCP 或记忆写入。

## 指标

`ObservabilityCollector.metrics()` 提供：

- retrieval requests、empty 数和 P95 延迟；
- MCP 请求和后台 derivation 的请求数、失败数与 P95 延迟；
- assessment sufficient 数、拒绝数和拒绝率；
- record-use attempts、duplicate 数和 rejected 数；
- fail-open error 数和错误率；
- 全局 P50/P95/max 延迟以及 operation/outcome 计数。

这些数字描述实现行为，不替代回答准确率评测。固定评测使用：

```bash
npm run evaluate
npm run evaluate -- --input benchmarks/locomo-conv26-r8-final.json --min-majority 75
```

## 发布门禁

```bash
npm run verify:production
```

门禁会运行类型检查、全量测试、构建、WorkBuddy 清洁包验证、宿主协议 smoke 和固定评测，
然后检查两个部署人员提供的证据文件：

```bash
export STRATAGATE_GPT_DESKTOP_E2E_EVIDENCE=/path/to/gpt-desktop-e2e.json
export STRATAGATE_DR_EVIDENCE=/path/to/backup-restore.json
```

这两个文件分别证明真实桌面 Hook trust/并行 Agent 行为和目标部署环境的备份恢复演练。缺少
任一文件时门禁退出码为 2；此时只能称为“已通过自动化验证的持久化原型”，不能宣称生产级
跨 Agent 闭环。
