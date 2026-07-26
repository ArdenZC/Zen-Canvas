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

### 1.1 依赖与非依赖

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

推荐建立四张 File Library Scan 专用表：

1. scan_roots：持久 root identity、health 和 generation 账本；
2. scan_sessions：一次用户/后台多 root 请求的父聚合；
3. scan_runs：一个 root 的一个 generation 的状态机；
4. scan_seen：该 run 由 scanner 观察到的文件事实。

这四张表不是通用 job runtime，也不复用 ai_jobs、job_runs 或 Global Index 表。每张表的生命周期、状态和 foreign key 都只服务 File Library Scan。

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
| last_successful_generation | INTEGER NULL；只由成功 finalization 更新 |
| last_full_scan_at | INTEGER NULL；只由成功 discovery reconciliation 更新 |
| needs_reconciliation | INTEGER；失败、取消、root 变化、watcher overflow 或旧数据未归属时置 1 |
| last_error_code | TEXT NULL；稳定错误码，不把完整日志塞进字段 |
| last_error_message | TEXT NULL；有限长度展示信息 |
| created_at、updated_at | INTEGER；SQLite Unix time |

推荐额外保留 source_kind 或等价字段，用来区分 default_scan_folder、显式 foreground root 和 background/search root 的来源；不能因为当前 background index 共用 scan_directory，就把 custom search root 误宣称为 Global Index 或 Managed Scope。settings 仍是用户配置的来源，scan_roots 是 scan domain 的运行时账本。

### 5.3 ScanSession

推荐单独建立小型、领域专用的 scan_sessions，而不是把 parent-child 关系塞进 generic runtime。候选字段：

- id、status、phase、cancel_requested；
- requested_root_count、completed_root_count、failed_root_count、cancelled_root_count；
- scanned_files、scanned_directories、warnings_count、errors_count；
- started_at、finished_at、last_checkpoint_at；
- error_code、error_message、result_json。

session 只聚合 root run，不拥有 scanner 看到的事实；每个事实仍归属于 scan_runs 和 scan_seen。

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
| completed_with_warnings | 无 | discovery 完整、结果可用但 optimize/entry metadata 等有 warning |
| cancelled | 无 | 重试创建新 run |
| failed | 无 | 重试创建新 run；不把它伪装成 interrupted |
| interrupted | 无 | startup 将遗留 running/cancelling 标记为 interrupted |
| requires_reconciliation | 无 | 需要显式 retry/full scan，不直接自动把它当 success |

requires_reconciliation 表示该 run 或 root 的安全状态还不能证明 missing reconcile 已完成；它不是“部分成功也可以当完成”的别名。

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
- 应用启动扫描恢复时，所有遗留 running 或 cancelling run 标记为 interrupted，对应 root needs_reconciliation=1；不恢复旧 jwalk iterator，不继续旧 run 的 stale。
- preparing/discovering/persisting 中收到 cancel：设置 cancel_requested，停止后续 batch，回滚当前 transaction，终态 cancelled。
- reconciling_missing 前收到 cancel：不进入 stale transaction，终态 cancelled 或 requires_reconciliation。
- reconciling_missing transaction 中收到 cancel：若 transaction 尚未提交则 rollback 并 requires_reconciliation；提交后不得假称取消回滚，需在 finalization 记录已完成的安全结果并带 warning。
- root 不存在、不是 directory、权限不足、被卸载：该 run failed 或 requires_reconciliation，root health 为 missing/permission_required，禁止 stale。
- 单个 entry metadata error：计入 warning/error，若 coverage 仍可证明完整则可 completed_with_warnings；root enumeration、DB 锁、磁盘错误等破坏 coverage 的错误必须 failed/requires_reconciliation。
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

## 8. Multi-root session 规格

1. 推荐持久化 scan_sessions；parent_session_id 是 domain-specific parent，不是 generic Job Runtime。
2. 默认先采用顺序 root 执行，保持当前前端行为、SQLite 锁压力和 progress 解释简单；并发扫描不是 01A 第一版要求。
3. session cancel 设置 session cancel_requested，backend 传播给当前 run，并阻止尚未开始的 queued roots；当前 run 达到终态后，未启动 roots 不创建成功 run，并计入 cancelled_root_count。
4. 一个 root failed 或 requires-reconciliation 时，默认继续尝试其余 roots；session 最终为：全部成功则 completed，至少一个成功且有 warning/failed root 则 completed_with_warnings，全部失败则 failed，用户取消则 cancelled，任何 coverage 未安全闭合则保留 requires_reconciliation 汇总。
5. session counts 从持久 root runs 聚合，不从 renderer 的 totalFiles 拼接推断；每个 root 的失败、warning、health 都可查询。
6. dedupe 只能作为已完成 scan run/session 的下游 hook。多 root session 的 dedupe timing 需要在实现阶段固定为“session terminal 后一次调度”；legacy 单 root compatibility call 保留旧 runDedupe 行为，不能让 dedupe 反过来决定 scan completion。
7. session 不拥有 Global Index volume、Managed AI job 或 watcher event；这些 domain 继续各自运行。
8. LibraryScope::CurrentScan.scanSessionId 可在后续 renderer/API 兼容层中使用，但 SQLite scan session 才是事实 owner，localStorage 只保存当前展示选择。

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

sequence 必须在 run/session 内单调，终态事件可重放；事件是 UI projection，不是数据库事实。current_path 可以为空，不能把文件完整内容或 raw watcher event 放进 scan event。

### 9.3 旧事件兼容

- scan-started 映射到 queued/running + preparing；
- scan-batch/scan-progress 继续提供旧 jobId/jobKind/root 和计数；
- scan-error 对应 entry warning 时继续作为 warning，不把所有 metadata error 误报成 fatal；
- scan-complete 只有在新 run finalization 完成后发出；
- scan-canceled 只有 backend 已确认 cancelled 后发出；
- 新 status/phase/run id 可作为扩展字段，旧 renderer 仍可按 jobId 过滤；
- command 返回的 ScanSummary 在兼容期仍可保留，但后端必须保证返回前已有 durable terminal state。

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
    completed_root_count INTEGER NOT NULL DEFAULT 0,
    failed_root_count INTEGER NOT NULL DEFAULT 0,
    cancelled_root_count INTEGER NOT NULL DEFAULT 0,
    scanned_files INTEGER NOT NULL DEFAULT 0,
    scanned_directories INTEGER NOT NULL DEFAULT 0,
    warnings_count INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
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
    cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
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
~~~

补充约束：

- scan_seen.file_id 第一版不强制 REFERENCES files(id)，因为 files path-id 会被 operation/restore path change 影响；observed_path 保留事实，run retention 负责清理。
- 所有 status/phase 字符串必须由 domain repository 统一常量管理；SQL CHECK 只做 fail-closed guard。
- migration 必须在当前 schema migration 的单个 BEGIN IMMEDIATE/rollback 机制中完成；不能删除旧表或重建 files。
- schema 27 完成后，当前版本拒绝 future schema 的既有行为必须保留。

### 10.2 Backfill 和 fixture

1. 空数据库：创建 27 的所有表、索引和 CHECK，scan_roots 为空，不能把空库伪造为已成功扫描。
2. schema 26 fixture：保留 files、FTS、Global Index、Managed AI、operation/cleanup journal 全部已有表；新表为空或只写 settings root ledger。
3. settings backfill：读取 app_settings_v1 的 JSON，按现有 ScanRootSetting/SearchRootSetting normalization 创建/merge scan_roots；duplicate normalized path 必须 deterministic。
4. old files backfill：不写 scan_seen，不写 last_successful_generation；root 置 needs_reconciliation=1，第一次完整 scan 后才建立 success fact。
5. 已有 zc-library-scope localStorage 不进入 SQLite migration；它不是数据库事实。
6. 迁移必须可重复执行；已存在 root/table/index 时不重复生成 generation，不覆盖已有 error 或用户 enabled 选择。
7. 中途失败必须 rollback 到 schema 26；新旧表都不能被部分使用。磁盘不足、WAL/lock busy、foreign key 失败均要在测试中记录。
8. 大表风险主要来自新增索引、settings backfill 和后续 stale reconcile；第一版避免 ALTER files，并以 100k files fixture 测 transaction time 和 query plan。

## 11. Crash、恢复与人工介入

| 场景 | 启动后处理 | 是否自动 stale | 用户动作 |
|---|---|---:|---|
| preparing/discovering 中进程退出 | 遗留 run 标记 interrupted，root 置 reconciliation required | 否 | 查看详情后 retry full scan |
| persisting batch 已写入后断电 | 保留已写 rows 和 scan_seen，但旧 run 不成功 | 否 | 新 generation full discovery；不得 resume 旧 iterator |
| reconciling_missing 前断电 | run interrupted/requires-reconciliation | 否 | 重试完整 scan |
| stale transaction 内 DB busy/断电 | transaction rollback；run requires-reconciliation | 否 | 等待 DB 空闲后 retry |
| stale transaction 已提交、finalization 未提交 | 启动按 phase 校验；只能补全可证明的 finalization 或标记 requires-reconciliation，不能猜 | 不新增 stale | 人工 retry/审查 |
| optimize_search_index 失败 | 保留 discovery 结果，status completed_with_warnings | 允许此前已原子完成的 stale | 可稍后重试 optimize/scan |
| root 被删除、卸载或失去权限 | failed/requires-reconciliation，health missing/permission_required | 否 | root 恢复后显式 retry |
| renderer 重启但 app 进程仍在 | get/list command 读取 durable run；事件可按 sequence 补投影 | 按 backend 状态 | UI 重新订阅 |
| app 正常退出 | scan backend 先收到 shutdown/cancel；不能留下假 success | 否 | 下次启动查看 interrupted |

第一版不做目录遍历断点 resume。即使部分 files 已写入，只有新的、覆盖完整的 generation 才能执行 missing reconciliation；这牺牲重复遍历时间以换取不误 stale 的安全边界。不得自动删除 files 行、不得永久删除文件、不得自动移动文件。

## 12. 测试计划

Task 01A 实施时必须新增或扩展测试；本任务只定义计划，不修改 tests。

### 12.1 Rust/domain tests

- success：单 root full discovery 写入 run/root/scan_seen，generation 单调，finalization 更新 last_successful_generation 和 health。
- cancel：在 preparing、discovery、batch flush、reconciling_missing 各阶段取消；均不能产生错误 stale。
- failure/interrupted：注入 metadata、permission、root disappearance、DB busy、process exit marker；startup 可识别并标记 interrupted。
- stale contract：unseen row 只在 completed discovery stale；cancelled/failed/interrupted 不 stale；watcher upsert 不插 scan_seen；同秒 last_seen update 采用保守 < started_at。
- optimize：optimize 成功为 completed，失败为 completed_with_warnings，files/FTS 仍可查询。
- root health：missing、permission_required、degraded、recovery、needs_reconciliation 的持久转移。
- generation/idempotency：重复 start 不复用 generation；同 root 并发 start 的唯一约束和 cancel race。
- nested/overlap/case：Windows slash/case、macOS case-sensitive、duplicate roots、nested roots、ignored/protected subtree、symlink/reparse point。
- watcher concurrency：scan_seen 只由 scanner 写；watcher 同时 upsert/stale 不伪造 generation；重命名和 cross-root move 保持 path-id 兼容。
- multi-root：顺序执行、一个 root failed 仍可继续、session aggregate、cancel propagation、all-failed/partial statuses。
- dedupe：每个 session 只执行一次 downstream schedule 语义；dedupe failure 不回滚 scan completion。

### 12.2 Migration tests

- 空数据库初始化；
- schema 26 真 fixture，包括 files/FTS、Global Index、Managed AI、operation/cleanup journal；
- old settings string/object roots、duplicate normalized roots、disabled roots；
- old files rows 无误 backfill，last_seen_at 不伪造 generation；
- migration 重复执行和 future schema rejection；
- malformed settings、缺字段、duplicate path、foreign key/CHECK 失败；
- migration rollback、WAL lock、disk/error injection；
- 100k files migration/scan_seen retention 和 stale reconcile 交易时间。

### 12.3 Frontend/API compatibility tests

- old scan_directory/create_scan_job_id/cancel_scan adapter 事件；
- renderer 在重启后先 get_scan_run/list_scan_runs，不依赖旧内存 progress；
- old scan-progress/scan-complete/cancelled payload 映射；
- session partial root、root health、retry interrupted；
- cancel request 在 terminal confirmation 前保持 cancelling；
- useScanManagerStore 不再成为事实 owner，scope 只使用 backend session id；
- 多根不再以 renderer totals 作为最终事实；
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
- scan_seen retention/prune 不得锁住正常 File Library 查询。

## 13. Rollout、fallback 与 rollback

1. 先以内部 feature gate managed_scan_generation_v1 关闭；schema 迁移与新 backend path 分开可验证。
2. 保留旧 scan_directory adapter 一段明确的 compatibility window；旧 payload 由 backend durable run 投影，不允许旧 renderer 自己制造成功。
3. 新 stale reconciliation 必须有独立 gate；gate 关闭时可以继续写新 run/scan_seen，但禁用新的 missing stale，回到人工/旧 rescan 语义。
4. migration 失败时拒绝启用新 path，保留 schema 26 和旧 commands；不删除新表、不删除旧 files、不删除 journal。
5. 一旦新 path 成为唯一事实 owner，清理 compatibility 代码需要单独任务，不保留长期双轨写入。
6. rollback 只允许禁用 feature gate、回退代码并保留新表；禁止降级 schema、删除 scan ledger 或通过永久删除数据库恢复。
7. Global Index、Managed AI、operation/cleanup journal 必须在 gate 开关和 migration 前后继续可用，不能以 scan 迁移为理由重启或重建这些 domain。

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
14. 只改动 Task 01A 允许路径，Task 01B 和后续任务保持未执行。

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
- 需要因无关测试 race、平台工具链或性能问题去放宽断言、删除测试或顺手修复业务；
- 需要开始 Task 01B、Task 02 或任何后续阶段。

本任务书完成后，Task 01A 仍为“待人工验收，禁止执行”；只有人工明确验收并重新授权，才可进入实现。
