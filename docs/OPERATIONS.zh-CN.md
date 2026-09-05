# StrataGate 安全与隐私运维手册

## 访问边界

- SQLite 文件是本地事实源；文件权限应限制为当前用户可读写（例如 `0600`）。
- namespace 的 `userId`、`projectId`、`memoryScope` 和 `namespacePrefix` 在首次写入后不可变。重新打开时发生冲突会拒绝加载并发出 `STRATAGATE_IDENTITY_CONFLICT` 告警。
- `session` 级 Event、Block 和原始消息只能由同一 conversation/thread 读取；`project` namespace 仍允许多个 Agent 协作，但每条原始消息保留 Agent、会话和适配器 provenance。
- DSH 管理接口默认面向本机插件。部署到共享 HTTP 入口时设置 `STRATAGATE_ADMIN_TOKEN`，请求使用 `Authorization: Bearer <token>` 或 `X-StrataGate-Admin-Token`。比较采用常量时间；token 不写入日志。
- 管理接口按当前配置的 `userId` 过滤 namespace，未知或其他用户的空间返回 404/空列表。

## 脱敏边界

原始 L5 数据在 SQLite 中保留，便于审计和恢复；发送到模型、MCP 结果或管理 UI 前只做一次不可逆的出站脱敏。目前覆盖常见 `sk-*`、GitHub token、Bearer token 以及 `api_key/token/password/secret=value` 形式。脱敏不是加密，也不能替代数据库访问控制；如果敏感值已经进入原始库，应按泄露处理并在上游撤销凭证。

## 备份、迁移与恢复

1. 在备份前停止会写入该数据库的 Hook/MCP 进程，或使用 SQLite 的在线备份能力；不要复制正在写入的 WAL 文件集合。
2. 备份数据库文件、校验和、StrataGate 版本和 schema 版本（当前为 11），并将备份放在与生产库不同的受限目录。
3. 恢复前复制一份当前数据库作为回滚点；恢复后先以只读方式打开并检查 namespace identity、revision、消息数量和最新 provenance，再重新启用宿主。
4. 迁移失败时保留原文件和迁移日志，不要覆盖原库。将失败副本交给 `StrataGate.open` 重试；遇到 `StorageConflictError` 时重新加载最新 revision 后再提交，禁止强制覆盖。
5. 外部记忆导入先走 preview/confirmation；已提交批次通过管理 UI 的 undo 撤销。导入任务的 actor、适配器、会话和撤销时间保存在任务 audit trail 中。

定期演练“备份 -> 新目录只读恢复 -> provenance 抽查 -> 原子切换”流程，并记录结果；未完成演练前不要宣称具备生产级灾备能力。

## Docker 本地部署

仓库根目录提供 `Dockerfile` 与 `docker-compose.yml`。推荐将 Compose 项目放在
`~/Docker/stratagate-memory-gateway`，并让数据目录保持在 `~/.stratagate/agent-memory`：

```bash
cp .env.example ~/Docker/stratagate-memory-gateway/.env
chmod 600 ~/Docker/stratagate-memory-gateway/.env
docker compose up -d --build
curl -fsS -H "Authorization: Bearer $STRATAGATE_GATEWAY_TOKEN" http://127.0.0.1:43731/ready
```

容器只以 `node` 用户运行，根文件系统只读，SQLite 数据和 JSONL 审计日志写入挂载卷。
HTTP/TCP 默认绑定宿主机端口，必须设置 `STRATAGATE_GATEWAY_TOKEN`；Unix Socket 适合单机
插件调用，设置 `STRATAGATE_GATEWAY_SOCKET=/var/lib/stratagate/gateway.sock` 并通过同一数据
卷共享 Socket，宿主侧权限由目录 owner/group 控制（不要将 Socket 目录设为 `0777`）。

`/health` 表示进程存活，`/ready` 会实际打开并迁移 SQLite，`/metrics` 返回请求、错误、活动
请求、后台队列、namespace 数和当前限额。可用 `STRATAGATE_GATEWAY_MAX_BODY_BYTES`、
`STRATAGATE_GATEWAY_MAX_CONCURRENT_REQUESTS`、`STRATAGATE_GATEWAY_MAX_QUEUE_LENGTH`、
`STRATAGATE_GATEWAY_REQUEST_TIMEOUT_MS`、`STRATAGATE_GATEWAY_RATE_LIMIT_PER_MINUTE`
调整边界；所有值都会被服务端限制在安全范围内。

备份时先 `docker compose stop`，复制 `memory.db`（同时保留同目录的 `-wal`/`-shm` 仅作
故障现场），再 `docker compose start`。恢复到新目录后先以只读方式调用 `/ready` 和
`/v1/dashboard`，核对 schema、namespace、revision 与 provenance，再切换挂载路径。
迁移失败保留原库和容器日志，不覆盖原文件。
