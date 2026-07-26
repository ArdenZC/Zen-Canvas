# Task 01A Implementation Closeout

## 1. 交付状态与边界

- 状态：**实施完成，待人工验收**。
- 任务：`TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md`。
- 实施分支：`remediation/01a-scan-generation-foundation`。
- 实施基线：PR #17 合并提交 `3b3d7b8178368058b15eddf026bf0cdbf01e9b34`。
- 数据库基线/目标：schema 26 -> schema 27。
- 本次没有修改 Task 01A 任务书设计，没有修改 schema 27 以外的数据库 schema，没有新增依赖。
- 没有修改 Global Index、Managed AI、`files.id`、operation/cleanup journal、Safe Trash、restore、watcher raw event persistence 或 `src-tauri/src/dedupe.rs`。
- Task 01B 及所有后续阶段未开始。

## 2. 实施范围

| 区域 | 交付内容 |
|---|---|
| 数据库/Repository | schema 27 的 scan ledger、schema 26 fixture migration/backfill、root/session/run/scan_seen/error repository、事务 CAS、恢复和 bounded prune |
| Scanner | managed scan admission、顺序 multi-root runner、metadata/error coverage、stale gate、finalization、启动恢复和 commit 后事件 |
| API/权限 | managed scan commands、durable event revision 字段、Tauri handler/allowlist、旧 command adapter |
| Renderer | durable session/run projection、restart hydrate、generation/revision/gap/duplicate/terminal-regression 事件规则、foreground/background 互斥与 durable cancellation |
| 测试/性能 | migration、lease/generation/revision、metadata error、stale/cancel、recovery、multi-root、dedupe dispatch、renderer restart、100k observation/WAL/prune 夹具 |
| 文档 | 本 closeout、remediation index 状态；Task 01B 继续禁止执行 |

## 3. Schema 27 与迁移

新增的领域表和索引为：

- `scan_roots`：规范化 root、health、current/last successful generation、active lease pointer 和 root revision；
- `scan_sessions`：请求、独立 session phase、terminal aggregate、cancel、revision 和 dedupe dispatch intent；
- `scan_runs`：generation、lease token、run phase/status、coverage counters、cancel、revision 和 result；
- `scan_session_roots`：每个 requested root 的 requested -> effective mapping，包含 duplicate、nested、invalid 和 cancelled-not-started；
- `scan_seen`：每个 run 的 scanner successful metadata observation；
- `scan_run_errors`：metadata/traversal error 和 coverage 影响标记；
- active-root partial unique index、root/session/run/history 查询索引和 `scan_seen` run/path 索引。

schema 26 -> 27 使用现有 migration transaction。它不重建或 ALTER `files` 大表，不伪造旧 `files` 的 successful generation 或 `scan_seen`，读取 settings roots 并以 `needs_reconciliation=1` backfill `scan_roots`。空数据库直接建立 schema 27；重复 migration 是幂等的；schema-26 binary 对 user_version 27 继续走 future-schema rejection。migration commit 前失败仍回滚到 schema 26；commit 后 rollback 只允许使用 schema-27-capable build，不能降低 user_version 或删除新表伪造 downgrade。

## 4. Ownership、状态机与事务不变量

- SQLite scan repository 是 root、generation、health、active lease、session/run status、revision 和 scan history 的唯一事实 owner。
- admission 在 `BEGIN IMMEDIATE` 中规范化请求、计算 canonical hash、处理 request-key 幂等、解析 mapping、检查所有 effective root 冲突、分配 generation、插入 queued runs、设置 root active pointer 后才 commit；同 root active 集合仍严格为 `queued/running/cancelling`。
- 相同 `request_key + canonical_request_hash` 返回已有 session；其他 active root 冲突使整个请求拒绝，不能部分分配 generation。
- 一个 session 的 root 按持久 mapping 顺序串行执行；session phase 独立为 `preparing -> running -> finalizing -> completed`，不会因下一个 root 开始而倒退。
- 每个 batch transaction 同时验证 run/root/session revision、generation、lease token 和 active pointer；成功 metadata upsert 与 `scan_seen` 写入同一 transaction；任何 CAS 失败整体 rollback；commit 后才发 progress event。
- finalization 在短 transaction 内以 CAS 同时完成 run terminal、root lease 释放、health/generation 更新、mapping 更新和 session projection；只有 `completed`/`completed_with_warnings` 才推进 last successful generation。

## 5. Stale、metadata error、cancel 与 crash safety

- metadata/traversal error 写入 `scan_run_errors`，不写 `scan_seen`，递增 coverage-breaking counters；该 run 只能进入 `requires_reconciliation`，禁止 stale。
- stale reconciliation 只允许 coverage complete、未请求 cancel、仍拥有 root lease 且 revisions/generation 匹配的 run；使用本轮 `scan_seen`、root 边界、ignored/protected subtree 和 `last_seen_at < started_at` 并发护栏。cancelled、failed、interrupted、requires-reconciliation 永不 stale unseen rows。
- 在 preparing/discovery/batch/reconciliation/finalization 期间的 durable cancel 都由 backend 观察；stale 已提交后取消不能把已提交的成功事实改写为 cancelled，也不能重新执行 stale。
- 启动恢复将遗留 active run 标为 `interrupted`，以 CAS 释放 root lease、置 root health 为 reconciliation-required，并聚合 session；不恢复旧 iterator，不继续旧 run 的 stale transaction；重试创建新 generation。
- `scan_seen`/`scan_run_errors` 采用固定 bounded retention：successful 至少 7 天，非成功 terminal 至少 30 天，每 root 永久保留最新两个 terminal run，active/recovery-pinned 不 prune，每次最多删除 1000 行，只删除 observation/error，不删除 run history。

## 6. API、事件与兼容性

新增 commands：`start_managed_scan`、`cancel_scan_run`、`get_scan_run`、`list_scan_runs`、`list_scan_roots`、`get_scan_root_health`、`retry_interrupted_scan`。

`scan_directory`、`create_scan_job_id`、`cancel_scan` 保留为兼容 adapter。managed event `scan-run-updated` 带有 event id、run/root/session identity、generation、run revision、session revision、run/session phase、counters、error 和 timestamp；事件只在对应 transaction commit 后发送。

Renderer 启动/重订阅先 hydrate durable state，再安装 event listener；低 revision、旧 generation、identity mismatch、duplicate event、revision gap 和 terminal regression 分别丢弃或触发 durable refetch。renderer 只做 projection，不生成成功事实。

## 7. Dedupe 结果

未修改既有 `DedupeJobManager` 或 `src-tauri/src/dedupe.rs`。scan session 只持久化 dispatch intent，并通过 pending -> dispatching -> dispatched/failed/unknown 记录观察结果；dispatch crash 窗口允许重新派发。语义是 at-least-once、安全可重复计算，重复 hash 计算不得改变 scan terminal、generation、stale、文件内容或用户操作账本。durable dedupe job、固定 idempotency key、prehash/cache/group 仍属于 Task 02。

## 8. 验证结果

已执行并通过的专项结果：

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo check --bin zen-canvas --features desktop-runtime`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime db::queries::scan::tests`：15 passed，1 ignored（性能夹具）
- `npm run typecheck`
- `npm test`：68 files / 477 tests passed
- `npm run test:remediation`：13 tests passed
- `npm run test:performance`：前端 bounded checks 9/9、FTS 100k 和 managed-scan 100k 均通过
- `npm run verify:frontend`：通过（包含上述 typecheck、477 个前端测试、remediation、性能和 build）
- `npm run verify:rust`：重试后通过（fmt、417 个 lib tests、全部 integration tests、clippy）；首次运行仅触发既有 `file_ops` 取消测试的临时目录计数波动，未修改该无关代码
- `npm run verify:security`：通过；npm audit 为 0 vulnerabilities，cargo audit exit 0 并保留 15 条既有 allowed advisory warnings
- `git diff --check`

上述最终 frontend、Rust、security、build 和 diff 门禁均已执行；提交后还会核对最终 HEAD、提交序列、远端分支和工作树状态。

## 9. 性能证据

- FTS 100k：post-optimize search p95 `1.985 ms`，count p95 `2.509 ms`，total p95 `4.371 ms`；pre-optimize probe total `22471.300 ms`，保留为 cold/optimize 分段基线。
- managed scan 100k：`scan_seen_insert=9.0432662 s`、`missing_reconcile=4.9132965 s`、`wal_reader=0.673 ms`、`prune=43.9 us`。
- 性能夹具包含并发 WAL reader、bounded prune 和 scan history/root health 查询；没有把大型分析事务与 finalization 合并。

## 10. 已知风险与 rollback

- schema 27 一旦 migration commit，不支持普通代码 downgrade；若必须运行 schema-26 binary，需恢复已验证的 schema-26 backup，并继续保持 future-schema rejection。
- scanner managed path 的 stale reconciliation gate 默认关闭，只有显式 rollout 配置才允许 stale；schema-27-capable build 可在 gate 关闭时启动并保留兼容 adapter。
- 现有 dedupe 仍是进程内 at-least-once 下游，dispatch crash 可能重复计算；本阶段不把它宣传为 exactly-once。
- retention 是固定策略，后续如需可配置 retention、durable dedupe 或 watcher ownership，必须由后续人工验收后的任务书承接。

## 11. 后续边界

Task 01B（watcher reconciliation ownership、overflow replay、durable watcher owner）未开始；Task 02 及所有后续阶段未开始。当前分支、Draft PR 和 closeout 完成后停止，等待人工验收。
