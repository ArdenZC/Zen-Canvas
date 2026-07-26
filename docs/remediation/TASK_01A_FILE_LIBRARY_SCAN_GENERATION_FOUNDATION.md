# Task 01A — File Library Scan Generation Foundation

## 1. 任务状态、基线与前置条件

- 状态：待人工验收，禁止执行。
- 类型：File Library Managed Scan 的架构规格、数据契约、迁移计划和验证计划。
- 本任务书不是实施授权；人工验收前不得修改生产代码、数据库 schema、migration、测试或依赖。
- 仓库：ArdenZC/Zen-Canvas。
- 目标分支：remediation/01a-scan-generation-spec。
- 本次文档基线为 master 的实际提交：

~~~text
c51aec01f05e7edbb7cc127950523116a351eda6
~~~

- PR #15 合并提交锚点已存在于当前 master 历史：

~~~text
a2c0516dc7a8628cb7210003da3d66f5d84f3a2f
~~~

- PR #16 已合并到 master。Task 00 的原始实现提交为 717ccec9065038fd68892ea3648d56ebdf33f43f；由于 PR #16 采用 squash merge，当前 master 直接包含的对应合并提交是 c51aec01f05e7edbb7cc127950523116a351eda6。以下 Task 00 产物已在当前 master：
  - docs/remediation/POST_MERGE_BASELINE_AUDIT.md
  - docs/remediation/REMEDIATION_CAPABILITY_MATRIX.md
  - docs/remediation/REMEDIATION_RISK_REGISTER.md
- 当前 schema 版本为 26，证据为 src-tauri/src/db/schema.rs 的 CURRENT_SCHEMA_VERSION。
- Task 00 已由人工接受；Task 01A 仍需单独人工验收，验收前不得实施 Task 01A，也不得开始 Task 01B。

### 1.1 PR #17 最新人工审核闭环

2026-07-26 PR #17 Conversation 的最新人工意见要求补齐五项进入实施授权前的阻塞契约：同一 root 的唯一 active lease、重复 start 与 generation ownership/finalization CAS；metadata error 下 scan_seen/stale 的保守语义与 retention/prune；multi-root requested-to-effective durable mapping、session terminal priority 与 dedupe dispatch idempotency；schema 27 rollback 与旧 schema-26 future-schema rejection 的版本矩阵；以及 run/session durable revision 与 renderer restart 的旧事件拒绝规则。

本次修订只更新 remediation 文档，逐项将上述规则写入领域模型、完整 SQL 草案、状态机、transaction 顺序、测试计划、rollout/rollback 和验收标准。Task 01A 仍是“待人工验收，禁止执行”；本节不构成生产实现授权，Task 01B 和后续任务继续禁止。

### 1.2 依赖与非依赖

Task 01A 依赖：

1. Task 00 的审计产物和人工接受；
2. 当前 schema 26、当前 files path-id 兼容期和既有 scan/watcher API；
3. 本任务书中的 File Library Scan 领域所有权、generation、stale 和恢复契约。

Task 01A 不依赖、也不得修改：

1. Global Index：global_volumes、global_entries、global_entries_fts、Windows MFT/USN/service、macOS Spotlight/FSEvents；
2. Managed Scope、Managed AI、ai_jobs、ai_job_items、ai_analysis_state；
3. operation journal、cleanup journal、Safe Trash、restore；
4. dedupe、content extraction、Organization Plan、Query V2、files.id 稳定身份迁移；
5. Task 01B 的 watcher durable owner、raw event persistence 和 overflow replay。

## 2. 当前实现事实

以下均为 PR #15 合并后的代码事实，不是根据旧 README 或类名推断。

### 2.1 前端入口与多根行为

| 事实 | 源码证据 |
|---|---|
| 前台扫描从 scanPaths 进入，读取选中的路径，逐个创建前台 job id 并顺序调用后端；多根不是一个持久父任务。 | src/store/useScanManagerStore.ts — scanPaths、activeScanJobId、createScanJobId("foreground")、startScan |
| 前台每个 root 返回后才开始下一个 root；取消会在 root 之间停止后续 root。 | src/store/useScanManagerStore.ts — for (const [index, path] of scanRoots.entries())、scanJobCanceled |
| 多根全部完成后，renderer 才设置 completedScanRoots、刷新 File Library 并显示总文件数。 | src/store/useScanManagerStore.ts — setCurrentScanScope(completedScanRoots)、refresh |
| 当前 dedupe 只绑定到最后一个前台 root 的 job id；后端在 scan complete 事件之后启动 dedupe。 | src/store/useScanManagerStore.ts — activeDedupeParentScanJobId；src-tauri/src/scanner.rs — emit_scan_complete_then_schedule_dedupe |
| 后台索引器拥有自己的内存 pending/completed/failed root 状态，等待前台扫描后逐根调用相同的 scan command。 | src/store/useBackgroundIndexerStore.ts — processBackgroundQueue、activeBackgroundJobId、backgroundGeneration |
| 后台 root 的去重是 renderer 内存集合和历史列表，不是 SQLite scan run。 | src/store/useBackgroundIndexerStore.ts — recentlyIndexedRoots、completedRoots、failedRoots |
| 当前 settings 同时保存 defaultScanFolders 和 customSearchRoots；watcher 也会监听两者。 | src-tauri/src/settings.rs — AppSettings、ScanRootSetting、SearchRootSetting；src-tauri/src/watcher.rs — watch_paths_from_settings |
| LibraryScope::CurrentScan 已预留可选 scanSessionId，但当前 scanPaths 没有传入持久 session id；scope 实际保存在 renderer localStorage。 | src-tauri/src/db/types.rs — LibraryScope::CurrentScan；src/store/useFileLibraryStore.ts — setCurrentScanScope、readPersistedLibraryScope |

### 2.2 Rust 扫描生命周期、遍历与写入

| 事实 | 源码证据 |
|---|---|
| Tauri command 是 scan_directory；它先由 ScanJobManager::register 建立一个内存 HashMap<String, Arc<AtomicBool>>，然后使用 spawn_blocking 执行扫描。 | src-tauri/src/scanner.rs — scan_directory、ScanJobManager::register |
| cancel_scan 只设置对应内存 AtomicBool，同时尝试取消同 id 的 dedupe job；没有数据库 cancel_requested 或终态记录。 | src-tauri/src/scanner.rs — cancel_scan、ScanJobManager::cancel |
| 扫描开始时只校验 root 存在且为 file/directory；目录遍历使用 jwalk，跳过 hidden、禁止 follow links，并通过 is_ignored_dir_name 排除忽略目录。 | src-tauri/src/scanner.rs — validate_root、scan_directory_blocking、WalkDir、process_read_dir |
| symlink entry 被跳过；metadata 错误和遍历错误增加 error counter 并发出 scan-error，但不会自动把整个扫描判为失败。 | src-tauri/src/scanner.rs — entry_to_payload、emit_scan_error、ScanCounters |
| batch 达到 500 条或 200ms 时 flush；每个 batch 由 insert_files 自己包一个 SQLite transaction，然后发出 scan-batch 和 scan-progress。 | src-tauri/src/scanner.rs — SCAN_BATCH_SIZE、SCAN_EMIT_INTERVAL、ScanBatchBuffer::flush |
| 扫描返回的 ScannedEntry.id 由 path 直接填充；当前没有 scanner-owned generation 或 run id 写入 files。 | src-tauri/src/scanner.rs — scanned_entry_to_insert_request |
| FTS optimize 只在存在 flush batch 时调用；optimize 结果以报告形式发出，失败本身不改变 scan complete 的现有路径。 | src-tauri/src/scanner.rs — run_search_index_optimize、emit_search_index_optimized；src-tauri/src/db/queries/mod.rs — run_search_index_optimize |
| scan complete 事件先发出，再按 run_dedupe 调用 spawn_duplicate_detection；dedupe 不是 scan completion owner。 | src-tauri/src/scanner.rs — emit_scan_complete_then_schedule_dedupe |
| 应用启动管理 Global Index、Managed AI、ScanJobManager、DedupeJobManager 和 FileWatcherManager；应用退出时显式 shutdown 的是 Global Index 和 Managed AI，没有持久化 scan manager 的收尾。 | src-tauri/src/main.rs — setup、app.manage、RunEvent::ExitRequested |

### 2.3 files、stale、revive 与 watcher upsert

| 事实 | 源码证据 |
|---|---|
| files 的主键是 id TEXT PRIMARY KEY，同时 path TEXT NOT NULL UNIQUE；当前 scanner 使用 path 作为 id。 | src-tauri/src/db/schema.rs — schema version 1 的 files 建表；src-tauri/src/scanner.rs — scanned_entry_to_insert_request |
| insert_files 对 path-id 做 upsert，更新 metadata、将 is_stale 复活为 0，并把 last_seen_at 写成当前 Unix 秒。 | src-tauri/src/db/queries/files.rs — Database::insert_files |
| 完整 scan 的 missing cleanup 以 root 和 scan_started_at 比较 last_seen_at < scan_started_at；它只排除 cancelled，不要求一个持久成功 run。 | src-tauri/src/db/queries/files.rs — mark_missing_files_stale_after_scan；src-tauri/src/scanner.rs — should_run_stale_cleanup |
| watcher 删除事件调用 legacy command remove_files_by_paths，实际标记 stale 而不是删除；create/modify/rename 通过 upsert_files_by_paths 读取 metadata 并写回 files。 | src-tauri/src/db/queries/files.rs — remove_files_by_paths；src-tauri/src/db/queries/mod.rs — upsert_files_by_paths_for_db_with_warnings |
| watcher 深度 upsert 有 WATCHER_DEEP_UPSERT_ENTRY_LIMIT，超限只写部分结果并提示手动完整扫描；大批 upsert 达到阈值时可能触发 FTS optimize。 | src-tauri/src/db/queries/mod.rs — collect_upsert_requests_for_path、optimize_search_index_after_bulk_upsert |
| watcher 原始事件进入容量 2048 的 bounded sync channel，150ms coalesce；overflow 只发出“需要 rescan”的错误，不把事件落库。 | src-tauri/src/watcher.rs — WATCHER_CHANNEL_CAPACITY、WATCHER_COALESCE_WINDOW、start_watcher_session |
| renderer watcher queue 是 React hook 生命周期内的内存 retry queue；stale/upsert/classify 成功后移除，失败最多重试 8 次，退出 renderer 时队列丢失。 | src/hooks/fsWatcherQueue.ts — WatcherRetryQueue；src/hooks/useFsWatcher.ts — flushQueues、cleanup |
| watcher upsert、scanner upsert 和 operation restore 都能改变 files 的 last_seen_at，所以该字段不是“某一轮 scanner 已见”的事实。 | src-tauri/src/db/queries/files.rs — insert_files、restore finalization；src-tauri/src/db/queries/mod.rs — watcher upsert |

### 2.4 进度、取消与真实重启行为

- Rust 当前向 renderer 发出 scan-started、scan-batch、scan-progress、scan-complete、scan-canceled、scan-error；payload 主要是 jobId、jobKind、root、计数和 elapsed time。证据：src-tauri/src/scanner.rs 的 ScanStartedPayload、ScanBatchPayload、ScanProgressPayload、ScanErrorPayload。
- src/api/tauriApi.ts 将 ScanSummary 直接定义为 ScanProgressPayload，command 仍是 scan_directory、create_scan_job_id、cancel_scan。
- useScanManagerStore 依据 activeScanJobId 丢弃旧事件，并在 command resolve 后刷新；progress callback 本身不负责持久化 scan scope。证据：src/store/useScanManagerStore.ts 的 initializeScanListeners 和 scanPaths。
- 进程退出、崩溃或 renderer 卸载后，ScanJobManager 的 HashMap、AtomicBool、前端 activeScanJobId、WatcherRetryQueue 和 background queue 都消失。数据库只留下已写入的 files 行，不知道该行属于哪个 run、哪个 generation、哪个阶段，也不知道最后一次扫描是否完成。
- 应用启动时 main.rs::setup 没有扫描 run recovery；它只打开数据库、reconcile operation/cleanup journal、启动 Global Index/Managed AI，并重新加载 watcher。故障发现只能靠下一次人工/后台扫描。

### 2.5 Global Index 与 Managed AI 的隔离事实

- Global Index 有自己的 coordinator/provider/sink 生命周期；GlobalIndexCoordinator::run_index 依次发现 volume、选择 provider、写入 global_entries，并保存 volume 的 journal_id/journal_cursor。证据：src-tauri/src/global_index/coordinator.rs — GlobalIndexCoordinator、GlobalIndexProvider、GlobalIndexSink、run_index。
- Windows provider 由 WindowsGlobalIndexProvider 在 service stream 与 DirectWindowsGlobalIndexProvider 之间 fallback，分别调用 MFT/USN 或 bounded recursive fallback；证据：src-tauri/src/global_index/windows/mod.rs — WindowsGlobalIndexProvider、DirectWindowsGlobalIndexProvider、start_initial_index、resume_incremental_sync。
- macOS provider 以 Spotlight 提供 metadata baseline，以 FSEvents 作为 gap/overflow/full-reconcile signal；pending updates 和 native event id 是 provider 内部状态，不是 File Library scan generation。证据：src-tauri/src/global_index/macos/mod.rs — MacosSpotlightProvider、PendingUpdates；src-tauri/src/global_index/macos/fsevents.rs — fsevent_requires_full_reconcile、start_reconcile_watcher。
- Global entries 的 upsert、stale、managed scope 和 AI job enqueue 都由 Global Index repository 处理；证据：src-tauri/src/global_index/repository.rs — upsert_global_entries_batch、mark_global_entries_stale_for_volume。
- Global search 的入口明确不接收 LibraryScope，也不 join files；证据：src-tauri/src/global_index/search.rs — search_global_entries。
- 因此 global_volumes.journal_cursor、global_entries.last_seen_at、native platform_file_id 和 Managed AI job 状态都不能作为 File Library Scan generation 或 scan_seen。

### 2.6 已复核的测试证据

- scanner 内置测试覆盖 authoritative job id、cancel flag、stale cleanup 只在非 cancelled、batch flush、event ordering 和独立 cancellation token。证据：src-tauri/src/scanner.rs — tests 模块。
- File Library 数据库测试覆盖 stale root boundary、旧 last_seen_at、stale revive、FTS optimize、schema 11 到当前 schema 的迁移和 future schema rejection。证据：src-tauri/src/db/tests/part1.rs — mark_missing_files_stale_after_scan_marks_only_old_entries_under_root、schema_12_migrates_v11_non_trigram_fts_and_restores_triggers、database_rejects_a_future_schema_version。
- watcher 测试覆盖 bounded/coalesced event routing、rename old/new、stale wins、retry 和永久失败可见性。证据：src-tauri/src/watcher.rs — tests；tests/fsWatcher.test.ts — WatcherRetryQueue、watcherQueueSnapshotFromEvent、takeWatcherQueueBatch。
- 前端 scan 测试确认多 root 串行、取消不启动后续 root、事件只更新 projection、scan-error 是 warning、command reject 才是 error。证据：tests/scanManager.test.ts。
- background indexer 测试确认前台互斥、default/search roots、force enqueue 和内存 history；证据：tests/backgroundIndexer.test.ts。

## 3. Task 01A 要解决的问题

Task 01A 只解决 File Library Managed Scan 的 durable generation foundation，不重做 Global Index 或 watcher。必须解决以下问题：

1. 扫描和取消现在只在内存中，无法在应用重启后解释一个仍为 running/cancelling 的任务。
2. 前端把多个 root 串行调用多个独立 job，再在 renderer 拼接结果；没有持久的 parent session、聚合状态和跨 root cancel 语义。
3. 没有 durable scan run；scan start、batch、complete 事件不能作为数据库事实。
4. 没有正式的 per-root generation；当前 job id 只是一次调用标识，不是成功扫描代次。
5. 当前不能可靠区分 success、partial、cancelled、failed、interrupted 和 requires-reconciliation。
6. stale missing 只允许由覆盖完整、可证明完成的 discovery run 产生；取消、失败、断电或根不可访问不能把 unseen 当成 missing。
7. last_seen_at 同时被 scanner、watcher、restore 使用，不能代替本轮 scanner attribution。
8. 重启后无法知道任务处于 preparing、discovering、persisting、reconciling_missing、optimizing_search 还是 finalizing。
9. root health 目前没有 File Library durable owner；权限、卸载、暂时不可访问和恢复后的状态不能与一个 scan run 绑定。
10. watcher 更新在 scan 期间不能伪造“本轮 scanner 已见”；Task 01A 不得用 pending_fs_changes 或任何 raw watcher event queue 偷渡解决这个问题。
11. generation 不能复用 Global Index 的 journal_cursor、last_full_index_at 或 native provider cursor；两个 domain 的生命周期和身份不同。

## 4. 唯一事实 owner 与领域边界

| 事实 | 唯一 owner | 非 owner |
|---|---|---|
| File Library Scan session/run、状态、阶段、取消和恢复 | Tauri/Rust File Library Scan backend | renderer、Global Index、Managed AI、dedupe |
| root identity、health、generation、成功代次 | SQLite 的 scan domain repository | app localStorage、Global provider cursor、watcher queue |
| scanner 本轮看到的 file fact | scanner-owned scan_seen（仅 scanner 写入） | watcher upsert、renderer 事件、last_seen_at |
| missing/stale reconciliation | 已完成且 coverage 完整的 File Library discovery run | cancelled/failed/interrupted run、watcher、dedupe |
| 多 root 聚合 | File Library 专用 scan_sessions | 通用 Job Runtime、ai_jobs |
| dedupe | 既有 DedupeJobManager，作为 scan 的下游 consumer | 不得决定 scan 是否 completed |
| Global Index provider checkpoint | global_volumes.journal_id/journal_cursor 和 Global Index coordinator | File Library Scan generation |

Task 01A 不建立跨领域 generic Job Runtime。未来可以复用极小的 Rust cancellation/progress/terminal primitives，但本任务书不实现它们，也不改变 Managed AI worker 的 schema、provider policy、scope、fingerprint 或 user correction 边界。

## 5. 领域模型与推荐归属方案

### 5.1 推荐模型总览

推荐建立七个 File Library Scan 专用持久模型：

1. scan_roots：持久 root identity、health 和 generation 账本；
2. scan_sessions：一次用户/后台多 root 请求的父聚合；
3. scan_session_roots：保留每个 requested root 与 effective root/run 的映射；
4. scan_session_effects：保留 session terminal 后下游 effect（当前仅 dedupe）的幂等 dispatch ledger；
5. scan_runs：一个 root 的一个 generation 的状态机和 durable revision；
6. scan_seen：该 run 由 scanner 观察到的文件事实；
7. scan_run_errors：coverage-breaking metadata/traversal error 的诊断事实。

这七个模型不是通用 job runtime，也不复用 ai_jobs、job_runs 或 Global Index 表。每张表的生命周期、状态和 foreign key 都只服务 File Library Scan。

### 5.2 ScanRoot

候选字段：

| 字段 | 类型/语义 |
|---|---|
| id | TEXT，稳定的 scan-domain root id；优先沿用 settings 中已有 root id，legacy string root 用规范化 path 派生稳定 id |
| normalized_path | TEXT NOT NULL UNIQUE；统一 slash、去尾部分隔符，Windows 比较时按平台大小写规则处理；不把 path id 迁成 native file id |
| display_name | TEXT NOT NULL；来自 settings label 或规范化 basename，仅用于展示 |
| enabled | INTEGER；控制默认后台是否可入队，不阻止显式一次性扫描 |
| health_status | TEXT；建议 unknown/healthy/scanning/degraded/missing/permission_required/reconciliation_required |
| current_generation | INTEGER NOT NULL；每次创建新 run 单调增加，不代表成功 |
| active_run_id | TEXT NULL；该 root 当前唯一 lease owner；只允许指向 queued/running/cancelling run，不能由 renderer 写入 |
| active_generation | INTEGER NULL；active_run_id 对应的 generation，和 active_run_id 一起做 ownership/CAS 校验 |
| last_successful_generation | INTEGER NULL；只由成功 finalization 更新 |
| revision | INTEGER NOT NULL；root ledger 的 durable revision，用于 lease、health 和 generation CAS |
| last_full_scan_at | INTEGER NULL；只由成功 discovery reconciliation 更新 |
| needs_reconciliation | INTEGER；失败、取消、root 变化、watcher overflow 或旧数据未归属时置 1 |
| last_error_code | TEXT NULL；稳定错误码，不把完整日志塞进字段 |
| last_error_message | TEXT NULL；有限长度展示信息 |
| created_at、updated_at | INTEGER；SQLite Unix time |

推荐额外保留 source_kind 或等价字段，用来区分 default_scan_folder、显式 foreground root 和 background/search root 的来源；不能因为当前 background index 共用 scan_directory，就把 custom search root 误宣称为 Global Index 或 Managed Scope。settings 仍是用户配置的来源，scan_roots 是 scan domain 的运行时账本。

### 5.3 ScanSession

推荐单独建立小型、领域专用的 scan_sessions，而不是把 parent-child 关系塞进 generic runtime。候选字段：

- id、status、phase、cancel_requested；
- request_key、requested_root_count、effective_root_count、completed_root_count、failed_root_count、cancelled_root_count、covered_root_count、unstarted_root_count；
- dedupe_requested；
- scanned_files、scanned_directories、warnings_count、errors_count；
- revision；每次 session 状态、聚合计数、terminal/effect 状态变化递增，并作为 session event sequence；
- started_at、finished_at、last_checkpoint_at；
- error_code、error_message、result_json。

session 只聚合 root run，不拥有 scanner 看到的事实；每个事实仍归属于 scan_runs 和 scan_seen。request_key 为空时不承诺重复请求语义；request_key 非空时，同一 canonical root request 必须返回已有 session，key 与 root 集合不一致必须拒绝。

### 5.3.1 Requested root 与 effective root 的持久映射

每个 session 必须为每个用户传入的 requested root 保留一行 scan_session_roots，即使该 root 尚未启动、被重复项去重、被祖先 root 吸收、解析失败或在 session cancel 前未启动。该行至少记录 requested_index、requested_path、normalized_requested_path、resolution、effective_root_id、effective_path、effective_index、run_id、status 和 reason。

resolution 的固定值为 effective、duplicate_requested、nested_under_effective、invalid；requested_index 保留原始请求顺序，effective_index 由规范化后的有效 root 集合确定。duplicate_requested 和 nested_under_effective 行可以共享同一 effective root/run，但不能创建第二个 generation。尚未启动即取消的有效 root 保留 resolution=effective、run_id=NULL、status=cancelled_not_started。

### 5.4 ScanRun

候选字段：

| 字段 | 类型/语义 |
|---|---|
| id | TEXT PRIMARY KEY，后端生成，不接受 renderer 自造事实 id |
| scan_root_id | TEXT NOT NULL REFERENCES scan_roots(id) |
| generation | INTEGER NOT NULL；同一 root 的 generation 单调增加 |
| parent_session_id | TEXT NULL REFERENCES scan_sessions(id)；单 root compatibility call 也可为空或由后端创建隐式 session |
| status | queued/running/cancelling/cancelled/completed/completed_with_warnings/failed/interrupted/requires_reconciliation |
| phase | preparing/discovering/persisting/reconciling_missing/optimizing_search/finalizing/completed |
| scanned_files、scanned_directories、processed_bytes | INTEGER，checkpoint 计数 |
| warnings_count、errors_count | INTEGER |
| cancel_requested | INTEGER；取消请求事实，不等于已 cancelled |
| started_at、finished_at、last_checkpoint_at | INTEGER NULL/NOT NULL 按阶段约束 |
| error_code、error_message | 稳定错误码和有限展示信息 |
| result_json | TEXT NULL；仅存聚合结果/兼容信息，不存无限事件日志 |

同一 (scan_root_id, generation) 必须唯一；重试创建新 generation，不重写旧 run 的历史。

scan_run 另有 lease_token、revision、coverage_complete、stale_reconciliation_allowed、metadata_error_count、coverage_error_count 和 request_key_snapshot。lease_token 由 backend 生成；任何 worker、batch、stale 或 finalization 写入都必须同时验证 run id、scan_root_id、generation、lease_token、scan_roots.active_run_id 和 expected revision。generation ownership 不由 renderer、session 或旧 jobId 推断。

### 5.5 Scanner attribution 的四个候选方案

| 方案 | 结论 | 主要问题 |
|---|---|---|
| A. 在 files 增加 last_seen_scan_run_id | 拒绝作为第一版 | 需要 ALTER 大表；一行 path 在重叠 root、nested root、迁移和 watcher 并发下只有一个归属，不能表达多个 run；旧 files backfill 只能猜测 |
| B. 在 files 增加 last_seen_generation + scan_root_id | 拒绝作为第一版 | 同样需要大表写放大；generation 必须和 root 绑定，cross-root move、同 path 多 root 和旧行缺 root 时语义不稳定 |
| C. 独立持久 scan_seen | 推荐 | 不改 files 大表；run-scoped、可在 stale reconciliation 中原子使用；崩溃后可识别未完成 run；通过 retention 控制增长 |
| D. 纯 TEMP 表、只靠 last_seen_at 或新 generic observation/job 表 | 拒绝 | TEMP 表断电即失去恢复事实；last_seen_at 被 watcher/restore 共用；generic observation/job 表会破坏 domain owner 和 Task 01A 边界 |

推荐 C：scan_seen(run_id, file_id, observed_path, observed_at)。只有 scanner 在 discovery batch 的同一 SQLite transaction 中插入 scan_seen；watcher upsert、operation restore、AI 或 renderer 不得插入。file_id 记录当时的 path-id，observed_path 保留 scanner 看到的规范化路径，以便处理 path-id 兼容期和诊断。

### 5.6 nested/overlap、cross-root move 和并发规则

1. 一个 session 开始前先规范化 root；完全重复 root 去重。
2. 同一 session 中，若 root A 是 root B 的祖先，推荐只建立一个 effective discovery root A，并把 B 作为 session scope 元数据；不得让 B 的不完整 run 把 A/B 的 files 互相 stale。
3. 跨 session 的重叠 root 不假设共享 generation；每个 root 只能在自己的 coverage 完整时 reconcile，自身没有 coverage 就置 needs_reconciliation。
4. 当前 files.id=path 的 cross-root move 不在 01A 改造成 stable identity；scanner 看到新 path 时按现有 upsert 语义处理，旧 path 由 operation/watcher/下一次完整 scan 的既有规则处理。
5. watcher 在扫描期间可以继续更新 files，但不得写 scan_seen。stale query 只把 scanner scan_seen 当“本轮已见”；对 last_seen_at >= run.started_at 的行采取保守不 stale 策略，因此 watcher 只能延迟 stale，不能伪造 scanner fact。
6. 当前 last_seen_at 精度为 Unix 秒；严格使用 < started_at，同秒更新宁可留下待 reconcile，也不能作为 missing 依据。generation 和 scan_seen 才是新契约的事实。
7. 同一 scan root 的 active run 集合严格定义为 queued、running、cancelling；同一 root 同时最多一个 active run。requires_reconciliation、failed、cancelled、interrupted 和其他 terminal 状态不持有 active lease，但 needs_reconciliation 仍可阻止把它们当成功。
8. start_managed_scan 对 canonical request 采用全量 admission：只要任一 effective root 已有其他 session 的 active lease，整个 start 拒绝且不分配 generation；相同 non-null request_key 且 canonical root hash 相同则返回已有 session/run，绝不创建重复 generation。

### 5.7 settings 兼容和旧 files

- app_settings_v1 继续保存 AppSettings.defaultScanFolders、customSearchRoots 和 revision；scan_roots 是规范化运行账本，不立即取代 settings。
- 迁移读取现有 settings JSON，沿用 src-tauri/src/settings.rs 的 root normalization、label 和 id 规则；空、相对或重复 path 不产生有效 root。
- 当前 renderer localStorage 的 zc-library-scope 不能作为 scan generation 事实；它最多在 UI 迁移时作为展示 scope 的兼容输入。
- 旧 files 行不回填到一个伪造的 successful generation；新 root 初始 last_successful_generation=NULL、needs_reconciliation=1，由第一次完成的 managed scan 建立事实。
- 不删除、不重写、不批量 ALTER files；旧 last_seen_at 保留为兼容展示/保守并发保护字段。

## 6. 状态机、阶段与 root health

### 6.1 Status

合法 status：

~~~text
queued
running
cancelling
cancelled
completed
completed_with_warnings
failed
interrupted
requires_reconciliation
~~~

合法 status 转移：

| 当前 | 允许的下一状态 | 说明 |
|---|---|---|
| queued | running、cancelled、interrupted | 尚未 discovery；cancelled 不得 stale |
| running | cancelling、completed、completed_with_warnings、failed、interrupted、requires_reconciliation | completed 只能由 finalization 产生 |
| cancelling | cancelled、interrupted、requires_reconciliation、failed | 取消请求不是终态；要等 backend 收尾 |
| completed | 无 | 成功终态 |
| completed_with_warnings | 无 | discovery 完整、结果可用但 optimize 或其他不影响 coverage 的 warning |
| cancelled | 无 | 重试创建新 run |
| failed | 无 | 重试创建新 run；不把它伪装成 interrupted |
| interrupted | 无 | startup 将遗留 running/cancelling 标记为 interrupted |
| requires_reconciliation | 无 | 需要显式 retry/full scan，不直接自动把它当 success |

requires_reconciliation 表示该 run 或 root 的安全状态还不能证明 missing reconcile 已完成；它不是“部分成功也可以当完成”的别名。

### 6.1.1 Session terminal state machine

session 的状态由持久化 scan_session_roots 映射聚合，不能由 renderer totals 或最后一个 run 事件直接决定：

~~~text
queued -> running -> cancelling -> terminal
queued -> cancelled
running -> interrupted / requires_reconciliation
terminal = requires_reconciliation | failed | cancelled
         | completed_with_warnings | completed
~~~

只有所有 requested mapping 都是 terminal 或 covered、所有 effective run 都已 terminal、且 session revision CAS 成功时，session 才能进入 terminal。聚合优先级固定为 requires_reconciliation/interrupted > failed/invalid > cancelled/cancelled_not_started > completed_with_warnings > completed；terminal 后不可回退。session 的 active 只表示仍有 effective run 处于 active lease，不新增另一套 queue owner。

### 6.2 Phase

~~~text
preparing -> discovering -> persisting -> reconciling_missing
           -> optimizing_search -> finalizing -> completed
~~~

- preparing：解析 root、建立 generation、确认 root health 和 effective coverage。
- discovering：jwalk/metadata discovery；不允许 stale。
- persisting：按 bounded batch 写 files 与 scan_seen，可循环回到自身。
- reconciling_missing：只有 discovery coverage 完整且未取消时进入。
- optimizing_search：FTS/SQLite optimize；失败产生 warning，不抹掉已经完成的 discovery。
- finalizing：在一个短 transaction 中更新 run/root/session 的成功事实。
- completed：phase 终态镜像；status 仍需为 completed 或 completed_with_warnings。

### 6.3 启动恢复、取消和错误

- 启动扫描任务时先以 BEGIN IMMEDIATE 原子分配下一个 generation 并插入 queued run；current_generation 增加不等于成功。
- 应用启动扫描恢复时，所有遗留 running 或 cancelling run 标记为 interrupted，并在同一 recovery transaction 中以 run id/generation/lease_token/active_run_id CAS 清除对应 root lease、置 needs_reconciliation=1；不恢复旧 jwalk iterator，不继续旧 run 的 stale。queued run 也必须按同一规则转为 interrupted 或 cancelled_not_started，不能遗留 active lease。
- preparing/discovering/persisting 中收到 cancel：设置 cancel_requested，停止后续 batch，回滚当前 transaction，终态 cancelled。
- reconciling_missing 前收到 cancel：不进入 stale transaction，终态 cancelled 或 requires_reconciliation。
- reconciling_missing transaction 中收到 cancel：若 transaction 尚未提交则 rollback 并 requires_reconciliation；提交后不得假称取消回滚，需在 finalization 记录已完成的安全结果并带 warning。
- root 不存在、不是 directory、权限不足、被卸载：该 run failed 或 requires_reconciliation，root health 为 missing/permission_required，禁止 stale。
- 单个 entry metadata error：记录 scan_run_errors，不能形成 scan_seen fact；本版选择把这类错误定义为 coverage-breaking，整个 run 禁止进入 stale reconciliation，终态为 requires_reconciliation（而不是 completed_with_warnings）。只有不影响目录 coverage 的 optimize 或展示性 warning 才能使用 completed_with_warnings。
- optimize 失败：不回滚 files，也不把完整 discovery 改为 failed；status 可为 completed_with_warnings，保留 error code。
- root 恢复可访问后，health 由下一次成功的 preparing/discovery/finalization 更新为 healthy；没有成功完整 run 不得清除 needs_reconciliation。

## 7. Generation、stale 与 finalization 契约

### 7.1 不变量

1. 每个 scan_root_id 的 generation 严格单调递增；分配 generation 不表示成功。
2. run start 不等于 scan success；last_successful_generation 只能在 finalization 成功时更新。
3. discovery 不完整、root 不可访问、cancelled、failed、interrupted 或 DB transaction 失败时不得 stale unseen rows。
4. watcher upsert 不得写入当前 run 的 scan_seen，不得伪造“scanner 本轮已见”。
5. stale 只比较当前成功 run 的 scanner-owned scan_seen；last_seen_at 只能作为保守并发护栏和旧数据兼容，不能作为 generation。
6. cancelled/failed/interrupted 不推进 last_successful_generation，也不更新 last_full_scan_at。
7. 只有完成 coverage、missing reconcile 和 finalization 的 run 才能把 root health 更新为 healthy 并清除 needs_reconciliation。
8. optimize 失败可以产生 completed_with_warnings，但不能把未完成 discovery 当 completed。
9. nested/overlap effective root 不得因为一个子 root 的 incomplete run 把父 root 覆盖范围内的 rows 批量 stale。
10. 旧 last_seen_at、旧 files path-id、旧 operation/restore 行必须继续可读；没有回填依据时保持 unknown/reconciliation required。
11. 旧 worker 即使持有旧 run id，也不能在 root lease、generation 或 revision CAS 失败后写 files、scan_seen、stale、root health 或 terminal success。
12. finalization 必须验证 run update、root ownership update 和 session aggregate update 的 affected-row；任一为 0 都不能发出 completed/completed_with_warnings 事件。
13. metadata error 没有 scan_seen-only fallback；无法形成成功 metadata fact 的 entry 必须使 coverage_complete=0 和 stale_reconciliation_allowed=0。
14. scan_seen 只在 successful metadata upsert 的同一 batch transaction 中写入；active run 永不 prune，terminal run 按固定 retention/prune 规则清理。
15. run.revision 和 session.revision 是 durable state sequence；事件必须在对应 transaction commit 后发送，renderer 以 durable revision 做水位线。

### 7.2 推荐 transaction 顺序（伪 SQL）

以下是规格，不是本任务的 migration 或生产实现：

~~~sql
BEGIN IMMEDIATE;
SELECT current_generation FROM scan_roots WHERE id = :root_id;
UPDATE scan_roots
   SET current_generation = current_generation + 1,
       health_status = 'scanning',
       updated_at = :now
 WHERE id = :root_id;
INSERT INTO scan_runs(id, scan_root_id, generation, parent_session_id,
                      status, phase, cancel_requested, started_at,
                      last_checkpoint_at)
VALUES (:run_id, :root_id, :next_generation, :session_id,
        'queued', 'preparing', 0, NULL, NULL);
COMMIT;
~~~

每个 discovery batch：

~~~sql
BEGIN;
-- scanner-owned only; watcher/restore never writes scan_seen
UPSERT files (..., is_stale = 0, last_seen_at = :now);
INSERT OR IGNORE INTO scan_seen(run_id, file_id, observed_path, observed_at)
VALUES (:run_id, :file_id, :observed_path, :now);
UPDATE scan_runs
   SET phase = 'persisting',
       scanned_files = :files,
       scanned_directories = :directories,
       processed_bytes = :bytes,
       last_checkpoint_at = :now
 WHERE id = :run_id AND status IN ('running', 'cancelling');
COMMIT;
~~~

进入 stale 前必须先确认 root 可访问、遍历没有 coverage-breaking error、cancel 未请求，并把 phase 更新为 reconciling_missing。missing transaction：

~~~sql
BEGIN IMMEDIATE;
UPDATE files
   SET is_stale = 1
 WHERE is_stale = 0
   AND path IN :effective_root_coverage
   AND last_seen_at < :run_started_at
   AND NOT EXISTS (
       SELECT 1
         FROM scan_seen
        WHERE scan_seen.run_id = :run_id
          AND scan_seen.file_id = files.id
   );
UPDATE scan_runs SET phase = 'optimizing_search',
       last_checkpoint_at = :now
 WHERE id = :run_id;
COMMIT;
~~~

实际实现必须把 path coverage、ignored/protected subtree 和 nested root 规则编译为可审计的 backend predicate；不能用一个宽泛 root exemption 规避错误，也不能把 watcher 的 last_seen_at 当成 scan_seen。finalization：

~~~sql
BEGIN IMMEDIATE;
UPDATE scan_runs
   SET status = :terminal_status,
       phase = 'completed',
       finished_at = :now,
       last_checkpoint_at = :now,
       error_code = :error_code,
       error_message = :error_message,
       result_json = :result_json
 WHERE id = :run_id
   AND phase IN ('optimizing_search', 'finalizing');
UPDATE scan_roots
   SET last_successful_generation = :generation,
       last_full_scan_at = :now,
       health_status = :health,
       needs_reconciliation = 0,
       last_error_code = :warning_code,
       last_error_message = :warning_message,
       updated_at = :now
 WHERE id = :root_id
   AND :terminal_status IN ('completed', 'completed_with_warnings');
COMMIT;
~~~

last_successful_generation 的 update 必须和 terminal status、root health 在同一个 finalization transaction 中完成；任何一项失败都不能暴露成功事实。

### 7.2.1 五项阻塞规则的规范 transaction 顺序

下列顺序是实现时唯一可直接翻译的规范；本节前面的短 SQL 仅为概念示意。每个写 transaction 都必须检查 affected-row；检查失败必须 rollback，并且不得发送比数据库事实更新的事件。

1. start admission、request idempotency 和 generation ownership：

~~~sql
BEGIN IMMEDIATE;

-- same non-null request_key + same canonical_request_hash is an idempotent read.
SELECT id, canonical_request_hash, status, result_json
  FROM scan_sessions
 WHERE request_key = :request_key;
-- Existing row + matching hash returns it; existing row + different hash
-- aborts with request_key_conflict.

-- The resolver has already produced the request-local effective_root_ids set;
-- any active row here rejects the whole canonical multi-root request.
SELECT r.id, r.active_run_id, r.active_generation
   FROM scan_roots r
 WHERE r.id IN :effective_root_ids
   AND r.active_run_id IS NOT NULL;

-- Resolve/insert all requested-root mappings before allocating any run.
INSERT INTO scan_sessions(
    id, request_key, canonical_request_hash, status, phase,
    requested_root_count, effective_root_count, dedupe_requested,
    revision, created_at, updated_at
) VALUES (
    :session_id, :request_key, :canonical_request_hash, 'queued',
    'preparing', :requested_count, :effective_count, :dedupe_requested,
    1, :now, :now
);

INSERT INTO scan_session_roots(
    session_id, requested_index, requested_path, normalized_requested_path,
    resolution, effective_root_id, effective_path, effective_index,
    status, created_at, updated_at
) VALUES (...);

-- The root lease is claimed before the run is visible as executable.
UPDATE scan_roots
   SET current_generation = current_generation + 1,
       active_generation = current_generation + 1,
       revision = revision + 1,
       health_status = 'scanning',
       updated_at = :now
 WHERE id = :root_id
   AND active_run_id IS NULL
   AND revision = :root_revision;
-- require exactly one affected row; :next_generation is the returned value.

INSERT INTO scan_runs(
    id, scan_root_id, generation, parent_session_id, lease_token,
    status, phase, coverage_complete, stale_reconciliation_allowed,
    revision, created_at, updated_at
) VALUES (
    :run_id, :root_id, :next_generation, :session_id, :lease_token,
    'queued', 'preparing', 0, 0, 1, :now, :now
);

UPDATE scan_roots
   SET active_run_id = :run_id,
       active_generation = :next_generation,
       revision = revision + 1,
       updated_at = :now
 WHERE id = :root_id
   AND active_run_id IS NULL
   AND active_generation = :next_generation
   AND current_generation = :next_generation
   AND revision = :root_revision_after_generation;
-- require exactly one affected row; otherwise rollback the whole admission.

UPDATE scan_session_roots
   SET run_id = :run_id, status = 'queued', updated_at = :now
 WHERE session_id = :session_id
   AND effective_root_id = :root_id
   AND resolution = 'effective';

COMMIT;
-- emit queued only after commit, using run.revision=1/session.revision=1.
~~~

The actual implementation must use a deterministic effective-root resolution before the first generation update. A request with no request_key never silently joins an active run. A request with an existing request_key either returns the existing session without writes or fails with request_key_conflict; it never allocates a second session.

2. run claim, batch persistence and metadata error：

~~~sql
BEGIN IMMEDIATE;
UPDATE scan_runs
   SET status = 'running',
       phase = 'discovering',
       started_at = COALESCE(started_at, :now),
       revision = revision + 1,
       updated_at = :now
 WHERE id = :run_id
   AND scan_root_id = :root_id
   AND generation = :generation
   AND lease_token = :lease_token
   AND revision = :expected_revision
   AND status = 'queued'
   AND EXISTS (
       SELECT 1 FROM scan_roots
        WHERE id = :root_id
          AND active_run_id = :run_id
          AND active_generation = :generation
   );
-- require one row; a zero-row claim is an old-worker/lease loss.
COMMIT;

BEGIN;
-- For each successful metadata entry, these two writes are one fact:
UPSERT files (..., is_stale = 0, last_seen_at = :now);
INSERT OR IGNORE INTO scan_seen(
    run_id, file_id, observed_path, observed_at
) VALUES (:run_id, :file_id, :observed_path, :now);

-- For each metadata error, record the error but deliberately write no scan_seen.
INSERT INTO scan_run_errors(
    id, run_id, path, error_code, error_message,
    affects_coverage, created_at
) VALUES (:error_id, :run_id, :path, :code, :message, 1, :now);

UPDATE scan_runs
   SET scanned_files = :files,
       scanned_directories = :directories,
       processed_bytes = :bytes,
       metadata_error_count = :metadata_errors,
       coverage_complete = CASE WHEN :metadata_errors = 0
                                AND :coverage_errors = 0 THEN 1 ELSE 0 END,
       stale_reconciliation_allowed = CASE WHEN :metadata_errors = 0
                                           AND :coverage_errors = 0
                                           AND cancel_requested = 0
                                           THEN 1 ELSE 0 END,
       last_checkpoint_at = :now,
       revision = revision + 1,
       updated_at = :now
 WHERE id = :run_id
   AND scan_root_id = :root_id
   AND generation = :generation
   AND lease_token = :lease_token
   AND revision = :expected_revision
   AND status IN ('running', 'cancelling')
   AND EXISTS (
       SELECT 1 FROM scan_roots
        WHERE id = :root_id
          AND active_run_id = :run_id
          AND active_generation = :generation
   );
-- require one row; otherwise rollback and discard the batch.
UPDATE scan_sessions
   SET scanned_files = scanned_files + :batch_files,
       scanned_directories = scanned_directories + :batch_directories,
       warnings_count = warnings_count + :batch_warnings,
       errors_count = errors_count + :batch_errors,
       revision = revision + 1,
       last_checkpoint_at = :now,
       updated_at = :now
 WHERE id = :session_id
   AND status IN ('queued', 'running', 'cancelling')
   AND revision = :expected_session_revision;
-- require one row; session revision is part of the same batch CAS.
COMMIT;
~~~

A metadata error is therefore observable in diagnostics but cannot make an unseen old file stale. An implementation that instead writes an entry-observed scan_seen-only fact must obtain separate human approval; it is not the 01A contract.

3. cancel and stale gate：

~~~sql
BEGIN IMMEDIATE;
UPDATE scan_runs
   SET cancel_requested = 1,
       status = CASE WHEN status = 'queued' THEN 'cancelled'
                     ELSE 'cancelling' END,
       phase = CASE WHEN status = 'queued' THEN 'completed' ELSE phase END,
       finished_at = CASE WHEN status = 'queued' THEN :now ELSE NULL END,
       revision = revision + 1,
       updated_at = :now
 WHERE id = :run_id
   AND scan_root_id = :root_id
   AND generation = :generation
   AND lease_token = :lease_token
   AND revision = :expected_revision
   AND status IN ('queued', 'running');
-- require one row; queued cancellation also clears the root lease below.
UPDATE scan_roots
   SET active_run_id = NULL,
       active_generation = NULL,
       health_status = 'reconciliation_required',
       needs_reconciliation = 1,
       revision = revision + 1,
       updated_at = :now
 WHERE id = :root_id
   AND active_run_id = :run_id
   AND active_generation = :generation
   AND :cancelled_terminal = 1;
COMMIT;

BEGIN IMMEDIATE;
SELECT status, phase, cancel_requested, coverage_complete,
       stale_reconciliation_allowed, revision
  FROM scan_runs
 WHERE id = :run_id
   AND scan_root_id = :root_id
   AND generation = :generation
   AND lease_token = :lease_token;
-- Proceed only when status is running, cancel_requested=0,
-- coverage_complete=1, stale_reconciliation_allowed=1 and the root
-- still has active_run_id=:run_id and active_generation=:generation.
UPDATE scan_runs
   SET phase = 'reconciling_missing',
       revision = revision + 1,
       updated_at = :now
 WHERE id = :run_id
   AND status = 'running'
   AND cancel_requested = 0
   AND coverage_complete = 1
   AND stale_reconciliation_allowed = 1
   AND revision = :expected_revision
   AND EXISTS (
       SELECT 1 FROM scan_roots
        WHERE id = :root_id
          AND active_run_id = :run_id
          AND active_generation = :generation
   );
-- require one row, then commit this phase transition.
COMMIT;

BEGIN IMMEDIATE;
UPDATE files
   SET is_stale = 1
 WHERE is_stale = 0
   AND path IN :effective_root_coverage
   AND last_seen_at < :run_started_at
   AND NOT EXISTS (
       SELECT 1 FROM scan_seen
        WHERE scan_seen.run_id = :run_id
          AND scan_seen.file_id = files.id
   )
   AND EXISTS (
       SELECT 1 FROM scan_runs
        WHERE id = :run_id
          AND scan_root_id = :root_id
          AND generation = :generation
          AND status = 'running'
          AND cancel_requested = 0
          AND coverage_complete = 1
          AND stale_reconciliation_allowed = 1
   )
   AND EXISTS (
       SELECT 1 FROM scan_roots
        WHERE id = :root_id
          AND active_run_id = :run_id
          AND active_generation = :generation
   );
UPDATE scan_runs
   SET phase = 'optimizing_search',
       revision = revision + 1,
       last_checkpoint_at = :now,
       updated_at = :now
 WHERE id = :run_id
   AND scan_root_id = :root_id
   AND generation = :generation
   AND revision = :expected_revision;
-- require one run-row update; if owner/CAS is lost, rollback the stale update.
COMMIT;
~~~

The existing path-coverage predicate must also encode ignored/protected subtree and nested-root exclusions. It cannot be replaced by a broad root exemption.

4. finalization CAS、generation monotonicity and session aggregation：

~~~sql
BEGIN IMMEDIATE;
UPDATE scan_runs
   SET status = :terminal_status,
       phase = 'completed',
       finished_at = :now,
       last_checkpoint_at = :now,
       error_code = :error_code,
       error_message = :error_message,
       result_json = :result_json,
       revision = revision + 1,
       updated_at = :now
 WHERE id = :run_id
   AND scan_root_id = :root_id
   AND generation = :generation
   AND lease_token = :lease_token
   AND phase IN ('optimizing_search', 'finalizing')
   AND status = 'running'
   AND revision = :expected_revision
   AND (
       :terminal_status IN ('completed', 'completed_with_warnings')
       AND coverage_complete = 1
       AND stale_reconciliation_allowed = 1
       OR :terminal_status IN ('failed', 'cancelled', 'requires_reconciliation')
   );
-- require exactly one affected row.

UPDATE scan_roots
   SET last_successful_generation = :generation,
       last_full_scan_at = :now,
       health_status = :health,
       needs_reconciliation = 0,
       active_run_id = NULL,
       active_generation = NULL,
       last_error_code = :warning_code,
       last_error_message = :warning_message,
       revision = revision + 1,
       updated_at = :now
 WHERE id = :root_id
   AND active_run_id = :run_id
   AND active_generation = :generation
   AND current_generation = :generation
   AND (last_successful_generation IS NULL
        OR last_successful_generation < :generation)
   AND revision = :expected_root_revision;
-- require exactly one affected row. A zero-row result is not success.

UPDATE scan_session_roots
   SET status = :requested_projection_status,
       updated_at = :now
 WHERE session_id = :session_id
   AND run_id = :run_id;

UPDATE scan_sessions
   SET revision = revision + 1,
       last_checkpoint_at = :now,
       updated_at = :now
 WHERE id = :session_id
   AND revision = :expected_session_revision;
-- require one row; the terminal aggregator then re-reads all mapping rows,
-- applies the fixed priority, and performs one session terminal CAS.
COMMIT;
~~~

For failed/cancelled/requires_reconciliation finalization, the run terminal update and root lease clear still use run id, generation, lease_token, root active pointer and expected revision; they never update last_successful_generation. If any finalization CAS affects zero rows, the transaction must not expose terminal success. Recovery may mark the run requires_reconciliation only through a fresh owner/recovery CAS. A replay that finds an already-terminal run may return the existing durable result, but must not emit a second success event or lower last_successful_generation.

4.1 session terminal 与 dedupe effect dispatch：

~~~sql
BEGIN IMMEDIATE;
-- Re-read all requested mappings and apply the fixed terminal priority.
SELECT status, resolution, run_id
  FROM scan_session_roots
 WHERE session_id = :session_id
 ORDER BY requested_index;

UPDATE scan_sessions
   SET status = :session_terminal_status,
       phase = 'completed',
       completed_root_count = :completed_count,
       failed_root_count = :failed_count,
       cancelled_root_count = :cancelled_count,
       covered_root_count = :covered_count,
       unstarted_root_count = :unstarted_count,
       finished_at = :now,
       revision = revision + 1,
       updated_at = :now
 WHERE id = :session_id
   AND revision = :expected_session_revision
   AND :all_mappings_terminal_or_covered = 1;
-- require exactly one row; a second aggregator re-reads the terminal row.

INSERT OR IGNORE INTO scan_session_effects(
    session_id, effect_kind, dispatch_key, status, created_at, updated_at
) SELECT :session_id, 'dedupe', :dispatch_key, 'pending', :now, :now
  WHERE :session_terminal_status IN ('completed', 'completed_with_warnings')
    AND :dedupe_requested = 1
    AND :successful_effective_run_count > 0;

INSERT OR IGNORE INTO scan_session_effects(
    session_id, effect_kind, dispatch_key, status, created_at, updated_at
) SELECT :session_id, 'dedupe', :dispatch_key, 'suppressed', :now, :now
  WHERE NOT (:session_terminal_status IN ('completed', 'completed_with_warnings')
             AND :dedupe_requested = 1
             AND :successful_effective_run_count > 0);

UPDATE scan_session_effects
   SET status = 'dispatching',
       attempt_count = attempt_count + 1,
       claimed_at = :now,
       updated_at = :now
 WHERE session_id = :session_id
   AND effect_kind = 'dedupe'
   AND dispatch_key = :dispatch_key
   AND status = 'pending';
-- zero rows means another dispatcher owns it or it is already terminal.
COMMIT;

-- Outside the transaction, call DedupeJobManager with the same dispatch_key.
-- Then record dispatched/completed/failed with a CAS on status+dispatch_key.
-- On crash after claim, startup changes only stale dispatching rows to unknown;
-- recovery first queries the downstream by dispatch_key and never makes a new key.
~~~

effect 状态变更若要向 renderer 暴露，也必须在同一 effect transaction 中递增 scan_sessions.revision；effect ledger 的 revision 不能由内存 attempt counter 代替。

5. scan_seen retention/prune：

~~~sql
-- Run in bounded maintenance transactions; never include active runs.
DELETE FROM scan_seen
 WHERE rowid IN (
   SELECT ss.rowid
     FROM scan_seen ss
     JOIN scan_runs r ON r.id = ss.run_id
     WHERE (
         r.status IN ('completed', 'completed_with_warnings')
         AND r.finished_at < :success_cutoff
       OR r.status IN ('failed', 'cancelled', 'interrupted',
                       'requires_reconciliation')
         AND r.finished_at < :terminal_cutoff
     )
       AND EXISTS (
           SELECT 1 FROM scan_runs newer
            WHERE newer.scan_root_id = r.scan_root_id
              AND newer.status IN ('completed', 'completed_with_warnings',
                                   'failed', 'cancelled', 'interrupted',
                                   'requires_reconciliation')
              AND newer.finished_at IS NOT NULL
              AND newer.finished_at > r.finished_at
              AND newer.id <> r.id
            LIMIT 1 OFFSET 1
       )
    LIMIT 1000
 );

DELETE FROM scan_run_errors
 WHERE id IN (
   SELECT e.id
     FROM scan_run_errors e
     JOIN scan_runs r ON r.id = e.run_id
    WHERE r.status IN ('failed', 'cancelled', 'interrupted',
                       'requires_reconciliation')
      AND r.finished_at < :terminal_cutoff
      AND EXISTS (
          SELECT 1 FROM scan_runs newer
           WHERE newer.scan_root_id = r.scan_root_id
             AND newer.status IN ('completed', 'completed_with_warnings',
                                  'failed', 'cancelled', 'interrupted',
                                  'requires_reconciliation')
             AND newer.finished_at IS NOT NULL
             AND newer.finished_at > r.finished_at
             AND newer.id <> r.id
           LIMIT 1 OFFSET 1
      )
    LIMIT 1000
 );
~~~

The exact retention policy is fixed: completed/completed_with_warnings scan_seen is retained for 7 days after finished_at and at least the newest two terminal runs per root, whichever retains more; failed/cancelled/interrupted/requires_reconciliation scan_seen and scan_run_errors are retained for 30 days and at least the newest two terminal runs per root. The maintenance job deletes in 1000-row batches, never prunes queued/running/cancelling rows, never runs while a run is being finalized, and keeps scan_runs history/counts after scan_seen deletion. If a run is selected for an active recovery/reconciliation operation, it is pinned until that operation is terminal. The prune policy is not user-configurable in 01A and any change requires a later task/re-review.

## 8. Multi-root session 规格

1. 推荐持久化 scan_sessions；parent_session_id 是 domain-specific parent，不是 generic Job Runtime。
2. 默认先采用顺序 root 执行，保持当前前端行为、SQLite 锁压力和 progress 解释简单；并发扫描不是 01A 第一版要求。
3. session cancel 设置 session cancel_requested，backend 传播给当前 run，并阻止尚未开始的 queued roots；当前 run 达到终态后，未启动 roots 不创建成功 run，并计入 cancelled_root_count。
4. 一个 root failed 或 requires-reconciliation 时，默认继续尝试其余 roots；只有所有 requested root mapping 都达到 terminal/covered 状态后才聚合 session。terminal 优先级固定为：requires_reconciliation/interrupted > failed/invalid > cancelled/cancelled_not_started > completed_with_warnings > completed。也就是说 failed 不会被成功 root 降级成 completed_with_warnings，cancel 请求也不会掩盖 failed/reconciliation。
5. session counts 从持久 root runs 聚合，不从 renderer 的 totalFiles 拼接推断；每个 root 的失败、warning、health 都可查询。
6. dedupe 只能作为已完成 scan run/session 的下游 hook。只有 session terminal 为 completed 或 completed_with_warnings 且至少一个 effective run 成功时才创建 dedupe effect；failed、cancelled、interrupted 或 requires_reconciliation session 不调度。session terminal 后通过 scan_session_effects 的唯一键和 dispatch_key 只产生一个逻辑 dispatch；legacy 单 root compatibility call 也必须经过同一 marker，不能让 dedupe 反过来决定 scan completion。
7. session 不拥有 Global Index volume、Managed AI job 或 watcher event；这些 domain 继续各自运行。
8. LibraryScope::CurrentScan.scanSessionId 可在后续 renderer/API 兼容层中使用，但 SQLite scan session 才是事实 owner，localStorage 只保存当前展示选择。

session terminal 和 dedupe effect 的事务规则：

- terminal aggregator 必须用 session.revision CAS，在看到所有 requested mapping 已达到 terminal/covered 状态后一次性写 session status、counts、finished_at 和 revision；
- dedupe effect 使用 session_id + effect_kind 的唯一键。插入 pending、claim dispatch、记录 dispatched/failed/unknown 都是可重试的 durable 状态变更；重复 aggregator 只能读到既有 effect，不能再插入第二个；
- dispatch_key 必须传给既有 DedupeJobManager 适配层作为幂等 key。dispatching 期间进程崩溃后，启动恢复先用同一 key 查询/确认下游，再决定 dispatched 或 retry；不能生成新 key，也不能无条件重发。若下游无法按 key 查询或幂等，必须停在人工决策，不能宣称“只调度一次”。

## 9. API 与事件契约（仅规格，不实现）

### 9.1 推荐 command

| command | 作用 | 约束 |
|---|---|---|
| start_managed_scan | 接收 roots、foreground/background、是否 include entries、是否请求 dedupe；返回 session/run 标识 | 后端规范化 roots、去重并持久化 queued 状态 |
| cancel_scan_run | 请求取消一个 run 或 session | 只写 cancel requested，终态由 backend 确认 |
| get_scan_run | 读取一个 run 的当前 durable state | renderer 重启后可恢复显示 |
| list_scan_runs | 按 root/session/status 分页列出历史 | 不返回无限 event log |
| list_scan_roots | 读取 root health、generation 和 last successful generation | settings 和 scan ledger 的差异可诊断 |
| get_scan_root_health | 读取一个 root 的 health/error/reconciliation 信息 | missing/permission 不隐藏 |
| retry_interrupted_scan | 对 interrupted/requires-reconciliation run 创建新的 full discovery run | 不复用旧 generation，不做目录遍历断点 resume |

旧 scan_directory、create_scan_job_id、cancel_scan 先保留 compatibility adapter。adapter 只能把旧调用映射到新的 backend run/session，不得继续由 renderer 生成权威状态。不能在 01A 实施中一次性重写所有 UI。

### 9.2 事件字段

新事件可以采用一个 managed-scan-event，也可保留多个事件名，但每个事件至少包含：

~~~text
sequence
event_id
generation
run_revision
session_revision
run_id
scan_root_id
parent_session_id
status
phase
scanned_files
scanned_directories
processed_bytes
warnings_count
errors_count
current_path
warning
error_code
error_message
timestamp
~~~

run_revision/session_revision 是由 scan_runs/scan_sessions 持久化的单调水位；sequence 只作为兼容别名，不得由内存计数器独立生成。event_id 至少由 domain、run_id、run_revision、session_revision 组成，事件必须在对应状态 transaction commit 后发送。事件是 UI projection，不是数据库事实；current_path 可以为空，不能把文件完整内容或 raw watcher event 放进 scan event。

### 9.3 旧事件兼容

- scan-started 映射到 queued/running + preparing；
- scan-batch/scan-progress 继续提供旧 jobId/jobKind/root 和计数；
- scan-error 对应无法形成 scan_seen 的 metadata error 时标记 coverage-breaking/requires_reconciliation；只有不影响 coverage 的 warning 才继续作为 warning；
- scan-complete 只有在新 run finalization 完成后发出；
- scan-canceled 只有 backend 已确认 cancelled 后发出；
- 新 status/phase/run id 可作为扩展字段，旧 renderer 仍可按 jobId 过滤；
- command 返回的 ScanSummary 在兼容期仍可保留，但后端必须保证返回前已有 durable terminal state。

renderer restart/旧事件规则：

1. renderer 启动或重新订阅时，先调用 get_scan_run/list_scan_runs 读取 durable state，再把该 run_revision/session_revision 设为水位线；水位线建立前不得把缓存事件写入 projection。
2. 对同一 run，event.run_revision 小于水位线直接丢弃；等于水位线且 event_id 相同视为重复；等于水位线但 event_id 不同触发 durable refetch；大于当前水位线但出现 gap 时先 refetch，只有 refetch 返回的 revision 不低于事件 revision 才能应用。
3. generation、run_id、session_id 任一不匹配当前 projection 的事件直接丢弃；旧 jobId 事件不能覆盖已 hydrate 的新 run。终态水位一旦建立，任何更低 revision 的 progress/error/complete/cancel event 都不能回退状态。
4. 事件丢失不是数据丢失：renderer 只以 durable get/list 结果恢复；01A 不建立 raw watcher event queue 或 pending_fs_changes。

不得新增 pending_fs_changes、raw notify::Event 持久队列或把 fs-event 改造成 Task 01A 的扫描事件。watcher owner、overflow replay 和 durable event cursor 属于 Task 01B。

## 10. Migration 规格与 SQLite 风险

### 10.1 目标 schema

当前 schema 26；Task 01A 实施阶段预期新增一个 schema version 27 migration。以下是完整 SQL 草案，供人工验收和实现测试使用；本任务不写入 src-tauri/src/db/schema.rs，也不执行迁移。

~~~sql
CREATE TABLE IF NOT EXISTS scan_roots (
    id TEXT PRIMARY KEY,
    normalized_path TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    source_kind TEXT NOT NULL DEFAULT 'file_library',
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    health_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (health_status IN (
            'unknown', 'healthy', 'scanning', 'degraded',
            'missing', 'permission_required', 'reconciliation_required'
        )),
    current_generation INTEGER NOT NULL DEFAULT 0 CHECK (current_generation >= 0),
    active_run_id TEXT,
    active_generation INTEGER,
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    last_successful_generation INTEGER,
    last_full_scan_at INTEGER,
    needs_reconciliation INTEGER NOT NULL DEFAULT 1 CHECK (needs_reconciliation IN (0, 1)),
    last_error_code TEXT,
    last_error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_roots_enabled_health
    ON scan_roots(enabled, health_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS scan_sessions (
    id TEXT PRIMARY KEY,
    request_key TEXT UNIQUE,
    canonical_request_hash TEXT,
    status TEXT NOT NULL
        CHECK (status IN (
            'queued', 'running', 'cancelling', 'cancelled',
            'completed', 'completed_with_warnings', 'failed',
            'interrupted', 'requires_reconciliation'
        )),
    phase TEXT NOT NULL DEFAULT 'preparing'
        CHECK (phase IN (
            'preparing', 'discovering', 'persisting',
            'reconciling_missing', 'optimizing_search',
            'finalizing', 'completed'
        )),
    cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
    requested_root_count INTEGER NOT NULL DEFAULT 0,
    effective_root_count INTEGER NOT NULL DEFAULT 0,
    completed_root_count INTEGER NOT NULL DEFAULT 0,
    failed_root_count INTEGER NOT NULL DEFAULT 0,
    cancelled_root_count INTEGER NOT NULL DEFAULT 0,
    covered_root_count INTEGER NOT NULL DEFAULT 0,
    unstarted_root_count INTEGER NOT NULL DEFAULT 0,
    dedupe_requested INTEGER NOT NULL DEFAULT 0 CHECK (dedupe_requested IN (0, 1)),
    scanned_files INTEGER NOT NULL DEFAULT 0,
    scanned_directories INTEGER NOT NULL DEFAULT 0,
    warnings_count INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    started_at INTEGER,
    finished_at INTEGER,
    last_checkpoint_at INTEGER,
    error_code TEXT,
    error_message TEXT,
    result_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_sessions_status_created
    ON scan_sessions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS scan_runs (
    id TEXT PRIMARY KEY,
    scan_root_id TEXT NOT NULL REFERENCES scan_roots(id) ON DELETE RESTRICT,
    generation INTEGER NOT NULL CHECK (generation >= 1),
    parent_session_id TEXT REFERENCES scan_sessions(id) ON DELETE SET NULL,
    lease_token TEXT NOT NULL UNIQUE,
    request_key_snapshot TEXT,
    status TEXT NOT NULL
        CHECK (status IN (
            'queued', 'running', 'cancelling', 'cancelled',
            'completed', 'completed_with_warnings', 'failed',
            'interrupted', 'requires_reconciliation'
        )),
    phase TEXT NOT NULL
        CHECK (phase IN (
            'preparing', 'discovering', 'persisting',
            'reconciling_missing', 'optimizing_search',
            'finalizing', 'completed'
        )),
    scanned_files INTEGER NOT NULL DEFAULT 0,
    scanned_directories INTEGER NOT NULL DEFAULT 0,
    processed_bytes INTEGER NOT NULL DEFAULT 0,
    warnings_count INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    metadata_error_count INTEGER NOT NULL DEFAULT 0,
    coverage_error_count INTEGER NOT NULL DEFAULT 0,
    coverage_complete INTEGER NOT NULL DEFAULT 0 CHECK (coverage_complete IN (0, 1)),
    stale_reconciliation_allowed INTEGER NOT NULL DEFAULT 0
        CHECK (stale_reconciliation_allowed IN (0, 1)),
    cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    started_at INTEGER,
    finished_at INTEGER,
    last_checkpoint_at INTEGER,
    error_code TEXT,
    error_message TEXT,
    result_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(scan_root_id, generation)
);

CREATE INDEX IF NOT EXISTS idx_scan_runs_root_created
    ON scan_runs(scan_root_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_runs_session_status
    ON scan_runs(parent_session_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS scan_seen (
    run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
    file_id TEXT NOT NULL,
    observed_path TEXT NOT NULL,
    observed_at INTEGER NOT NULL,
    PRIMARY KEY(run_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_seen_run_path
    ON scan_seen(run_id, observed_path);

-- One lease owner per root. requires_reconciliation is terminal and does not
-- remain active; needs_reconciliation on scan_roots still blocks false success.
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_runs_one_active_per_root
    ON scan_runs(scan_root_id)
 WHERE status IN ('queued', 'running', 'cancelling');

CREATE INDEX IF NOT EXISTS idx_scan_roots_active_lease
    ON scan_roots(active_run_id, active_generation);

CREATE TABLE IF NOT EXISTS scan_session_roots (
    session_id TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
    requested_index INTEGER NOT NULL CHECK (requested_index >= 0),
    requested_path TEXT NOT NULL,
    normalized_requested_path TEXT NOT NULL,
    resolution TEXT NOT NULL
        CHECK (resolution IN (
            'effective', 'duplicate_requested',
            'nested_under_effective', 'invalid'
        )),
    effective_root_id TEXT REFERENCES scan_roots(id) ON DELETE RESTRICT,
    effective_path TEXT,
    effective_index INTEGER,
    run_id TEXT REFERENCES scan_runs(id) ON DELETE SET NULL,
    status TEXT NOT NULL
        CHECK (status IN (
            'pending', 'queued', 'running', 'completed',
            'completed_with_warnings', 'failed', 'cancelled',
            'interrupted', 'requires_reconciliation', 'covered',
            'duplicate', 'nested', 'invalid', 'cancelled_not_started'
        )),
    reason TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(session_id, requested_index)
);

CREATE INDEX IF NOT EXISTS idx_scan_session_roots_effective
    ON scan_session_roots(session_id, effective_index, effective_root_id);
CREATE INDEX IF NOT EXISTS idx_scan_session_roots_run
    ON scan_session_roots(run_id, status);

CREATE TABLE IF NOT EXISTS scan_session_effects (
    session_id TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
    effect_kind TEXT NOT NULL CHECK (effect_kind IN ('dedupe')),
    dispatch_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL
        CHECK (status IN (
            'suppressed', 'pending', 'dispatching', 'dispatched',
            'completed', 'failed', 'unknown'
        )),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error_code TEXT,
    last_error_message TEXT,
    claimed_at INTEGER,
    dispatched_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(session_id, effect_kind)
);

CREATE INDEX IF NOT EXISTS idx_scan_session_effects_status
    ON scan_session_effects(status, updated_at);

CREATE TABLE IF NOT EXISTS scan_run_errors (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
    path TEXT,
    error_code TEXT NOT NULL,
    error_message TEXT,
    affects_coverage INTEGER NOT NULL DEFAULT 1
        CHECK (affects_coverage IN (0, 1)),
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_run_errors_run_created
    ON scan_run_errors(run_id, created_at);
~~~

补充约束：

- scan_seen.file_id 第一版不强制 REFERENCES files(id)，因为 files path-id 会被 operation/restore path change 影响；observed_path 保留事实，run retention 负责清理。
- 所有 status/phase 字符串必须由 domain repository 统一常量管理；SQL CHECK 只做 fail-closed guard。
- migration 必须在当前 schema migration 的单个 BEGIN IMMEDIATE/rollback 机制中完成；不能删除旧表或重建 files。
- active_run_id/active_generation 是 scan_roots 的 lease 账本；因为 scan_roots 先于 scan_runs 创建，active_run_id 不依赖循环 foreign key，所有引用完整性由同一事务的 root ownership/CAS 和 active-run partial unique index 保证。
- idx_scan_runs_one_active_per_root 的 active 集合只有 queued/running/cancelling；terminal run 不占 lease。
- run.revision/session.revision 每次状态、phase、counter、coverage、health 或 effect 聚合变化递增；它们是 durable sequence，不是 renderer 内存计数器。
- metadata error 必须进入 scan_run_errors 且 affects_coverage=1；该 run 的 coverage_complete 和 stale_reconciliation_allowed 必须保持 0，不能仅用 warning count 表示。
- schema 27 migration 事务提交前失败时必须完整 rollback 到 schema 26；提交后不允许把 user_version 降回 26，也不允许删除新表来伪造 downgrade。
- schema 27 完成后，schema-26 binary 对 future schema 的既有拒绝行为必须保留。

### 10.2 Backfill 和 fixture

1. 空数据库：创建 27 的所有表、索引和 CHECK，scan_roots 为空，不能把空库伪造为已成功扫描。
2. schema 26 fixture：保留 files、FTS、Global Index、Managed AI、operation/cleanup journal 全部已有表；新表为空或只写 settings root ledger。
3. settings backfill：读取 app_settings_v1 的 JSON，按现有 ScanRootSetting/SearchRootSetting normalization 创建/merge scan_roots；duplicate normalized path 必须 deterministic。
4. old files backfill：不写 scan_seen，不写 last_successful_generation；root 置 needs_reconciliation=1，第一次完整 scan 后才建立 success fact。
5. 已有 zc-library-scope localStorage 不进入 SQLite migration；它不是数据库事实。
6. 迁移必须可重复执行；已存在 root/table/index 时不重复生成 generation，不覆盖已有 error 或用户 enabled 选择。
7. migration transaction 在 schema 27 commit 前中途失败必须 rollback 到 schema 26；新旧表都不能被部分使用。磁盘不足、WAL/lock busy、foreign key 失败均要在测试中记录。这个 rollback 只指 migration failure，不表示 schema 27 commit 后可以运行 schema-26 binary。
8. 大表风险主要来自新增索引、settings backfill 和后续 stale reconcile；第一版避免 ALTER files，并以 100k files fixture 测 transaction time 和 query plan。
9. migration fixture 必须覆盖 schema-27-capable binary 在 feature gate 关闭时读取 schema 27、旧 schema-26 binary 读取 schema 27 时稳定得到 future-schema rejection，以及恢复 schema-26 backup 后旧 binary 可打开的路径。
10. scan_seen retention fixture 必须证明 active/dispatching/recovery-pinned run 不被 prune，completed run 按 7 天加 newest-two 规则、非成功 terminal run 按 30 天加 newest-two 规则清理，scan_runs 历史仍保留。
11. requested/effective fixture 必须保留原始 requested_index、duplicate/nested mapping、invalid root、cancelled_not_started root 和同一 session 的 run_id 映射；重复 migration 不得重排或重新分配 generation。

## 11. Crash、恢复与人工介入

| 场景 | 启动后处理 | 是否自动 stale | 用户动作 |
|---|---|---:|---|
| preparing/discovering 中进程退出 | 遗留 run 标记 interrupted，root 置 reconciliation required | 否 | 查看详情后 retry full scan |
| persisting batch 已写入后断电 | 保留已写 rows 和 scan_seen，但旧 run 不成功 | 否 | 新 generation full discovery；不得 resume 旧 iterator |
| reconciling_missing 前断电 | run interrupted/requires-reconciliation | 否 | 重试完整 scan |
| stale transaction 内 DB busy/断电 | transaction rollback；run requires-reconciliation | 否 | 等待 DB 空闲后 retry |
| stale transaction 已提交、finalization 未提交 | 启动按 phase 校验；只能补全可证明的 finalization 或标记 requires-reconciliation，不能猜 | 不新增 stale | 人工 retry/审查 |
| optimize_search_index 失败 | 保留 discovery 结果，status completed_with_warnings | 允许此前已原子完成且 coverage_complete=1 的 stale | 可稍后重试 optimize/scan |
| entry metadata error | 保留成功 batch 与 scan_run_errors，run 标记 coverage-breaking/requires_reconciliation | 否；该 run 不得进入 stale | 修复权限/文件状态后 retry full scan |
| root 被删除、卸载或失去权限 | failed/requires-reconciliation，health missing/permission_required | 否 | root 恢复后显式 retry |
| renderer 重启但 app 进程仍在 | 先 get/list hydrate durable state，再以 run/session revision 为水位拒绝旧事件 | 按 backend 状态 | UI 重新订阅；revision gap 触发 refetch |
| old worker 在新 run/lease 后返回 | root active_run_id、generation、lease_token 或 revision CAS 失败；丢弃其 batch/finalization | 否 | 由 current owner 或人工 recovery 处理 |
| session terminal 后 dedupe dispatching 期间崩溃 | effect 保留 unknown，恢复先用同一 dispatch_key 查询下游，不自动生成新 dispatch | 不影响已完成 scan 的 stale 事实 | 查询确认后标记 dispatched 或人工 retry |
| app 正常退出 | scan backend 先收到 shutdown/cancel；不能留下假 success | 否 | 下次启动查看 interrupted |

第一版不做目录遍历断点 resume。即使部分 files 已写入，只有新的、覆盖完整且拥有当前 root lease 的 generation 才能执行 missing reconciliation；这牺牲重复遍历时间以换取不误 stale 的安全边界。不得自动删除 files 行、不得永久删除文件、不得自动移动文件。

## 12. 测试计划

Task 01A 实施时必须新增或扩展测试；本任务只定义计划，不修改 tests。

### 12.1 Rust/domain tests

- success：单 root full discovery 写入 run/root/scan_seen，generation 单调，finalization 更新 last_successful_generation 和 health。
- cancel：在 preparing、discovery、batch flush、reconciling_missing 各阶段取消；均不能产生错误 stale。
- failure/interrupted：注入 metadata、permission、root disappearance、DB busy、process exit marker；startup 可识别并标记 interrupted。
- stale contract：unseen row 只在 completed discovery stale；cancelled/failed/interrupted/requires_reconciliation 不 stale；watcher upsert 不插 scan_seen；同秒 last_seen update 采用保守 < started_at；metadata error 没有 scan_seen-only fallback 且 coverage-breaking。
- optimize：optimize 成功为 completed，失败为 completed_with_warnings，files/FTS 仍可查询。
- root health：missing、permission_required、degraded、recovery、needs_reconciliation 的持久转移。
- generation/idempotency：同 root 只有 queued/running/cancelling 一个 active lease；相同 request_key 返回既有 session、不同 request 拒绝且不分配 generation；旧 worker 的 lease/generation/revision CAS 失败不能写入；finalization 每个 affected-row 都必须验证。
- nested/overlap/case：Windows slash/case、macOS case-sensitive、duplicate roots、nested roots、ignored/protected subtree、symlink/reparse point。
- watcher concurrency：scan_seen 只由 scanner 写；watcher 同时 upsert/stale 不伪造 generation；重命名和 cross-root move 保持 path-id 兼容。
- multi-root：顺序执行、requested_index 到 effective root/run durable mapping、duplicate/nested/invalid/cancelled_not_started、一个 root failed 仍可继续、固定 terminal priority、session aggregate 和 cancel propagation。
- dedupe：scan_session_effects 唯一键、dispatch_key、dispatching crash/unknown recovery、重复 terminal aggregator 不重复调度；dedupe failure 不回滚 scan completion。
- revision/event：run/session revision 在同一 state transaction 中递增；renderer restart hydrate 水位、duplicate/gap/old terminal event rejection 和 generation mismatch。

### 12.2 Migration tests

- 空数据库初始化；
- schema 26 真 fixture，包括 files/FTS、Global Index、Managed AI、operation/cleanup journal；
- old settings string/object roots、duplicate normalized roots、disabled roots；
- old files rows 无误 backfill，last_seen_at 不伪造 generation；
- migration 重复执行和 future schema rejection；
- schema 27 migration commit 前失败回滚到 26；schema 27 commit 后 schema-26 binary 必须拒绝，schema-27-capable binary 关闭 feature gate 可继续打开；仅恢复 schema-26 backup 才允许旧 binary 回退；
- malformed settings、缺字段、duplicate path、foreign key/CHECK 失败；
- migration rollback、WAL lock、disk/error injection；
- 100k files migration/scan_seen retention 和 stale reconcile 交易时间；验证 7/30 日 retention、newest-two 保留、active/recovery pin 不被 prune。

### 12.3 Frontend/API compatibility tests

- old scan_directory/create_scan_job_id/cancel_scan adapter 事件；
- renderer 在重启后先 get_scan_run/list_scan_runs，不依赖旧内存 progress；以 durable revision hydrate 并拒绝旧、重复、越代、gap 未 refetch 的事件；
- old scan-progress/scan-complete/cancelled payload 映射；
- session partial root、root health、retry interrupted；
- requested/effective root mapping、original order、nested coverage、duplicate、invalid 和 cancelled_not_started projection；
- cancel request 在 terminal confirmation 前保持 cancelling；
- useScanManagerStore 不再成为事实 owner，scope 只使用 backend session id；
- 多根不再以 renderer totals 作为最终事实；
- session terminal priority deterministic；dedupe effect 在 crash/retry 后按 dispatch_key 保证 logical at-most-once/可确认重试；
- background queue 仍尊重 foreground lock、force 语义和旧 UI copy；
- global search、Managed AI、operation preview/journal 的既有 API 无回归。

### 12.4 Performance/query gates

- 100k files migration、100k scan_seen insert/reconcile；
- batch transaction duration、WAL reader latency、DB busy retry；
- root health/run history query latency；
- cold scan 与 warm scan 的 discovery throughput；
- FTS optimize 成功/失败路径；
- nested/overlap scope predicate query plan；
- files 既有 library page/search/count latency 不得因 scan tables 引入回归；
- scan_seen retention/prune 不得锁住正常 File Library 查询；bounded batch、active/recovery pin 和 7/30 日 cutoff 必须可观测。

## 13. Rollout、fallback 与 rollback

1. 先部署 schema-27-capable binary，feature gate managed_scan_generation_v1 保持关闭；schema migration、durable ledger 和新 backend path 分开可验证。旧 schema-26 binary 不能读取已升级到 27 的数据库。
2. 保留旧 scan_directory adapter 一段明确的 compatibility window；旧 payload 由 backend durable run 投影，不允许旧 renderer 自己制造成功。
3. 新 stale reconciliation 必须有独立 gate；gate 关闭时可以继续写新 run/scan_seen，但禁用新的 missing stale，回到人工/旧 rescan 语义。
4. migration commit 前失败时拒绝启用新 path，事务 rollback 到 schema 26，保留旧 commands；不删除新表、不删除旧 files、不删除 journal。
5. 一旦新 path 成为唯一事实 owner，清理 compatibility 代码需要单独任务，不保留长期双轨写入。
6. rollback 必须区分两个时间点：schema 27 commit 前可回滚 migration；schema 27 commit 后只能回到仍能理解 schema 27 的 schema-27-capable build 并关闭 feature gate，保留新表和 user_version=27。不得把 schema-26 binary 当作 post-migration code rollback，不得降低 schema、删除 scan ledger 或通过永久删除数据库恢复。
7. Global Index、Managed AI、operation/cleanup journal 必须在 gate 开关和 migration 前后继续可用，不能以 scan 迁移为理由重启或重建这些 domain。

rollback matrix（必须进入 rollout 验证）：

| 数据库状态 | 允许的 binary | 结果 |
|---|---|---|
| schema 26，migration 未提交 | schema-26 或 schema-27-capable | schema-26 正常；schema-27-capable 可继续执行 migration/保持 gate 关闭 |
| schema 27，feature gate 关闭 | schema-27-capable | 允许启动，读取 ledger 但不启用新 scan/stale path |
| schema 27，feature gate 已启用后需要回退 | schema-27-capable rollback build | 关闭 gate，保留 user_version=27 和新表；只读/旧 adapter 是否可用必须有兼容测试 |
| schema 27，尝试使用旧 schema-26 binary | 任意 schema-26 binary | 必须稳定 future-schema rejection；禁止绕过 guard |
| 必须运行 schema-26 binary | 恢复经过校验的 schema-26 backup | 这是数据库恢复而非代码 rollback；明确接受 backup 之后的新 ledger 写入丢失，并在启动前停止所有 writer |

因此“回退代码并保留新表”只适用于 schema-27-capable rollback build；旧 binary 的 future-schema rejection 是保留的安全行为，不是待修复的兼容缺陷。

## 14. 后续实施允许路径与禁止路径

人工验收并授权实现后，允许的第一方路径：

- src-tauri/src/scanner.rs 的 scan command/backend coordinator；
- src-tauri/src/db/schema.rs、scan domain repository/queries 和 migration tests；
- src/api/tauriApi.ts 的 scan compatibility API/event types；
- src/store/useScanManagerStore.ts、src/store/useBackgroundIndexerStore.ts、src/store/useFileLibraryStore.ts 的 projection/compatibility 调整；
- 与 scan generation 直接相关的 Rust、frontend、migration、performance tests；
- 本任务书和 remediation index 的 closeout 文档。

禁止在 Task 01A 实施中触碰：

- src-tauri/src/global_index/，尤其 windows/、macos/ provider、MFT/USN、Spotlight/FSEvents、service；
- Managed AI worker、ai_jobs/ai_job_items、classification engine、provider policy、user correction；
- file_ops、storage analyzer execution、operation journal、cleanup journal、Safe Trash/restore；
- dedupe schema/algorithm、content extraction、Organization Plan、Query V2/cursor；
- files.id 到 native stable id 的迁移；
- raw watcher event persistence、pending_fs_changes、Task 01B 的 durable watcher owner；
- 新依赖、package/Cargo lock、installer、版本号、release。

## 15. 实施拆分、提交和 PR 建议

授权实施后，建议按以下小提交拆分，每个提交只保留一种可验证事实：

1. scan schema、repository、migration fixture 和 rollback tests；
2. Rust scan run/session/generation backend；
3. scanner-owned scan_seen 与 stale contract；
4. API、events、旧 command compatibility；
5. frontend store/session projection 和 background compatibility；
6. crash/cancel/retry、root health、multi-root aggregate；
7. performance、cross-platform fixture、docs closeout。

推荐一个 Task 01A Draft PR 承载以上原子提交：schema、backend、API 和 renderer 是一个可审计契约，但每个提交可独立 review/bisect；不要把 Task 01B 混入。01B 必须是 Task 01A 人工验收后的独立 PR，并重新验证 watcher owner、overflow replay 和 durable event contract。

## 16. Task 01A 客观验收标准

人工验收必须确认：

1. cancel、failed、interrupted、requires-reconciliation run 不会 stale unseen files；
2. restart 能识别遗留 running/cancelling，并持久显示 interrupted；
3. root health、last error、needs reconciliation 跨重启保留；
4. 每个 root 的 generation 单调，只有成功 finalization 才推进 last_successful_generation；
5. 多 root 有 durable session aggregate、cancel propagation 和 partial result；
6. 旧 scan command、progress、complete/cancelled event 有兼容映射；
7. files.id、Global Index、Managed AI、operation/cleanup journal 未被重定义；
8. 没有第二套 Global Index、generic ai_jobs runtime 或 universal jobs/job_events/job_failures；
9. 没有 raw watcher event queue；watcher upsert 不能写 scan_seen；
10. schema 26/空库/旧 settings/旧 files/失败回滚 fixture 齐全；
11. 100k migration/reconcile 和既有 files query 无回归证据；
12. stale predicate 对 nested/overlap/ignored/symlink/reparse/case 行为有测试；
13. 新表、状态机、事件和 migration 都有唯一 owner、幂等规则和 rollback gate；
14. 同一 root 的 active 集合只有 queued/running/cancelling 一个 lease；重复 start、request_key、generation owner、finalization affected-row/CAS 和旧 worker 拒绝都有明确实现测试；
15. metadata error 必须保留 scan_run_errors、禁止 stale；scan_seen retention/prune 有 7/30 日 cutoff、newest-two、active/recovery pin 和 bounded delete 证据；
16. 每个 requested root 都有 durable requested-to-effective mapping，nested/duplicate/invalid/cancelled_not_started 可查询；session terminal priority 和 dedupe dispatch_key/idempotency 在 crash 后可证明；
17. schema 27 migration failure rollback 与 post-commit feature rollback 已分离；schema-26 binary 对 schema 27 的 future-schema rejection 测试通过，只有 schema-27-capable rollback build 可关闭 feature gate；
18. run/session revision 在状态 transaction 中持久递增；renderer restart 先 hydrate durable state，并拒绝旧、重复、越代、generation mismatch 和未 refetch 的 gap event；
19. 只改动 Task 01A 允许路径，Task 01B 和后续任务保持未执行。

## 17. 停止条件

出现以下任一情况，必须停止 Task 01A 实施并重新人工决策：

- 需要修改 Global Index provider、Windows MFT/USN、macOS Spotlight/FSEvents 或 service；
- 需要改变 Managed AI 的 queue、scope、provider、fingerprint 或 user correction；
- 需要修改 files.id 或在没有 mapping/rollback 的情况下引入 native identity；
- 需要建立 generic Job Runtime、把 ai_jobs 改成通用表，或建立 universal jobs/events/failures；
- 需要把 raw watcher event、pending_fs_changes、overflow replay 放入 01A；
- 需要修改 operation/cleanup journal、Safe Trash、restore 或自动文件移动/删除；
- 需要新增依赖、改变 schema 26 兼容性、删除旧数据库或绕过 migration rollback；
- 无法保证唯一 owner、generation idempotency、run terminal semantics 或 stale safety；
- 无法证明 schema 27 commit 后只使用 schema-27-capable rollback build，或有人要求让 schema-26 binary 直接打开 schema 27；
- 下游 dedupe consumer 无法用 dispatch_key 查询/幂等，导致只能在 crash 后猜测是否重复调度；
- event revision 无法持久化，或 renderer 只能依赖进程内 sequence 恢复状态；
- 需要因无关测试 race、平台工具链或性能问题去放宽断言、删除测试或顺手修复业务；
- 需要开始 Task 01B、Task 02 或任何后续阶段。

本任务书完成后，Task 01A 仍为“待人工验收，禁止执行”；只有人工明确验收并重新授权，才可进入实现。
