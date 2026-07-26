# Remediation Capability Matrix

本矩阵是 Task 00 的基线盘点，不是实现清单。状态只使用任务书允许的五种值：`完整存在`、`部分存在，可扩展`、`不存在`、`与现有架构冲突`、`不应建设`。

判定依据均来自 PR #15 合并后的当前源码；“后续建议”不授权 Task 01 或任何生产代码修改。

| 能力/契约 | 状态 | 当前源码证据 | 边界与缺口 | 后续建议（人工验收后） |
| --- | --- | --- | --- | --- |
| 单库 Global Index | 完整存在 | `src-tauri/src/db/schema.rs::ensure_global_index_schema`; `src-tauri/src/global_index/coordinator.rs::GlobalIndexCoordinator`; `global_index/repository.rs` | `global_*` 表、FTS、volume/provider 状态已存在 | 复用现有主索引；不建设第二全局索引 |
| Windows native provider | 完整存在 | `global_index/windows/mft.rs::enumerate_volume`; `usn.rs::sync_volume`; `windows/service.rs` | MFT/USN、service/direct fallback、journal cursor 已有；fallback recovery 仍有风险 | 只补 provider/reconcile contract，保持 service 与 direct fallback |
| macOS Spotlight/FSEvents provider | 部分存在，可扩展 | `global_index/macos/mod.rs::MacosSpotlightProvider/PendingUpdates`; `spotlight.rs`; `fsevents.rs` | native stream、pending、event checkpoint 存在；pending 集合非 durable，权限/partial 状态复杂 | 先定义 full reconcile、pending replay、permission 状态机 |
| File Library scan job | 部分存在，可扩展 | `src-tauri/src/scanner.rs::ScanJobManager/scan_directory_blocking`; `useScanManagerStore.ts`; `useBackgroundIndexerStore.ts` | in-memory job/cancel/progress；无 durable run、generation、crash recovery | 后续独立设计 scan generation；不直接接入 Managed AI queue |
| Watcher reconciliation queue | 部分存在，可扩展 | `src-tauri/src/watcher.rs::FileWatcherManager`; `src/hooks/fsWatcherQueue.ts`; `global_index/windows/fallback.rs` | bounded channel/coalesce/rescan signal；没有统一 durable event owner | 先决定 renderer watcher 与 native provider 的 owner、replay 和 overflow contract |
| 通用 Job Runtime | 与现有架构冲突 | `global_index/managed_worker_hardened.rs::ManagedAiWorker`; `legacy_queue.rs`; scan/dedupe/cleanup 各自 job state | `ai_jobs` 强绑定 global entry/scope/provider/fingerprint；其他域生命周期不同 | 不直接泛化 `ai_jobs`；若要抽取只做独立 primitives 设计并保留现有 queue |
| Durable Managed AI queue | 完整存在 | `schema.rs` 的 `ai_jobs/ai_job_items/ai_analysis_state`; `managed_worker_hardened.rs` | claim、attempt、policy block、stale、user correction、completion、restart reset 已有 | 保持唯一 Managed AI 执行入口；继续禁止 unmanaged/legacy bypass |
| Managed Scope policy boundary | 完整存在 | `global_index/managed_scope.rs`; `legacy_queue.rs`; `managed_worker_hardened.rs::validate_managed_ai_job` | local/cloud policy、enabled scope/entry/volume、backfill limit 已有 | Content/AI 扩展必须绑定 scope、provider consent 和 correction protection |
| File identity safety | 完整存在 | `fs_safety/identity.rs::ExpectedFileIdentity/capture_identity`; `file_ops.rs`; `fs_safety/*` | operation identity 有 native id/hash/claim；不是通用实体主键 | 复用安全校验；不把它等同于 `files.id` 或 AI fingerprint |
| Cross-domain stable file identity | 部分存在，可扩展 | `global_index/models.rs::stable_entry_id`; `scanner.rs::id = path`; `path_identity.rs` | global native identity、library path id、operation identity 分裂 | 先做 mapping/冲突/rename/cross-volume 审计，再决定是否迁移 |
| Classification input fingerprint | 部分存在，可扩展 | `schema.rs` classification fingerprint columns; `managed_worker_hardened.rs::metadata_fingerprint` | File Library rule/classification fingerprint 与 global AI fingerprint 不同 | 先定义版本、失效和 provider/scope 维度，不能直接合并 |
| Dedupe content hash | 部分存在，可扩展 | `src-tauri/src/dedupe.rs::run_duplicate_detection_job`; `files.content_hash`; `idx_files_dedupe` | size + BLAKE3 聚合；无 run/group/finding/reclaim artifact，未表达 hardlink | 先定义 duplicate finding/group/physical identity/reclaim semantics |
| Durable analysis run | 不存在 | `storage_analyzer.rs::StorageCleanupState`、`dedupe.rs::DedupeJobManager` 都以内存 job 为主 | cleanup/dedupe 分析重启即丢，只有 Safe Trash action journal durable | 后续可提出统一 run contract，但不能用 `ai_jobs` 代替 |
| Durable analysis finding | 不存在 | cleanup candidates 和 dedupe groups 在查询/内存结构中计算 | 没有稳定 finding id、版本、ack/decision/expiry | 先定义 finding identity、证据和 stale semantics |
| Organization Plan | 不存在 | `db/queries/files.rs::get_operation_previews_for_scope`; `file_ops.rs::execute_moves` | 有计算式 preview + operation log，无 versioned plan/decision/revision | 单独设计 plan artifact，必须引用 server preview、identity 和 restore |
| Server-authoritative operation preview | 完整存在 | `file_ops.rs::execute_moves`; `get_operation_previews_by_file_ids`; `verify_indexed_file_identity` | execute 使用 authoritative preview IDs 和当前 row/identity | 保持为所有整理/移动入口的唯一安全 gate |
| Durable operation journal | 完整存在 | `db/queries/operations.rs`; `file_ops.rs::persist_pending_operation_journal`; startup reconcile | operation/restore phase、claim、hash、volume id 已有 | 不另建 generic file mutation log；扩展需兼容 schema v18–24 |
| Safe Trash / cleanup journal | 完整存在 | `storage_analyzer.rs`; `cleanup_trash_batches/items`; `reconcile_pending_cleanup_journal` | 非永久删除；restore 依赖 identity/journal | 继续复用；AI 只能给建议，不能升级为直接删除 |
| Library Query V1 | 完整存在 | `db/queries/files.rs::get_paged_files_in_scope_with_filter`; `files_fts`; `VaultView.tsx` | scope/filter/FTS/total/page/virtual list 已有 | 保留兼容路径，作为 Query V2 fallback |
| Query V2 / unified QuerySpec | 部分存在，可扩展 | Rust filter/scope 类型与 TS `FileQueryResult` 已有 | global search 与 library search 分开；缺统一 snapshot/provider/source contract | 先定义 source、scope、snapshot、sort、filter 和 security boundary |
| Keyset cursor | 不存在 | Library/global/operation preview SQL 使用 `LIMIT/OFFSET` | 大表 realtime 下可能 skip/duplicate；无 cursor token | 在人工决定 snapshot 后再设计 cursor，保留 OFFSET fallback |
| Cross-page selection | 部分存在，可扩展 | `VaultView.tsx` 的 `selectedIds/selectedFiles`; `selectionForRowClick` | 可选择 renderer 已加载 rows；无 server-side query selection/“全选结果” | 结合 Query V2/Plan revision 设计，不扩张现有 local selection 假象 |
| Large-list truthfulness | 部分存在，可扩展 | `FileLibraryList.tsx` virtual/load-more; `librarySortLoadedOnly`; `collectLibraryPages` max 10,000 | 页面有上限与 loaded-only sort；organization queue 另行最多 10,000 | 先做 cursor/snapshot/selection contract，再调整上限 |
| Content extractor | 不存在 | classification/managed AI 只组装 metadata/path；无文件内容读取器 | 没有格式策略、artifact、retention、脱敏和 provider gate | 仅在人工批准隐私/存储/权限后设计 |
| Content Artifact | 不存在 | `ai_analysis_state.content_summary = 'metadata_only'`; schema 无 artifact table | AI trace 的 `extracted_content` 是内存响应诊断，不是文件内容 artifact | 先定 artifact identity/version/size/delete/rebuild；不在 Task 00 建表 |
| AI trace diagnostics | 完整存在 | `src-tauri/src/ai/trace.rs` | 32 条 ring buffer、raw/extracted/cleaned/parsed、redaction/truncation；不是业务持久化 | 保持诊断与业务 artifact 分离 |
| Structured rule AST | 完整存在 | `db/queries/rules_repo.rs`; `AutomationRuleDialog.tsx`; `db/learning.rs` | operator/condition/action/template 校验和 correction hints 已有 | 作为 NL proposal 的唯一受约束目标格式 |
| NL Rule Proposal | 不存在 | 没有 proposal/diff/approval/version command/table | 模型不可直接写 rule 或触发 operation | 后续设计 proposal -> validation -> human approval -> rule revision |
| Global Search | 完整存在 | `global_index/search.rs`; `repository.rs`; `CommandModal.tsx` | 独立 FTS/LIKE fallback、disabled/stale filter、limit/offset | 保持与 Library Query 分离，补 source/status contract |
| Search Provider abstraction | 部分存在，可扩展 | provider trait 只在 global index；Spotlight 直接组合 global results/commands/recent files | 没有统一 source capability/ranking/permission/failure manifest | 后续以只读 provider interface 设计，不能改变安全 action authority |
| Command Registry | 部分存在，可扩展 | `spotlight/commandRegistry.ts::createCommandRegistry/queryCommandRegistry/executeSpotlightCommand` | 前端静态列表；没有动态 capability、permission、version、unavailable state | 后续定义 manifest schema；native global search 与 command action 保持分层 |
| Search/command source boundary tests | 完整存在 | `tests/searchSpotlight.test.ts`; `tests/commandModalUi.test.ts`; `tests/remediationContract.test.ts` | 已固定 global index 与 Library scope 不混用、AI/preview 安全 contract | 每一后续 phase 扩充 source-contract tests，不删除现有 guard |
| Content-aware cleanup AI | 部分存在，可扩展 | `ai/cleanup.rs`; `storage_analyzer.rs` | 仅对 cleanup candidate 做 advisory JSON 分析；不能直接 delete | 保持 advisory；若接入 content 必须复用 Managed Scope/provider policy |
| Durable reconciliation framework | 不存在 | operation/cleanup 各有 journal；scan/watcher/dedupe/AI/global 各自 semantics | 无跨域 owner、run/generation、resume/rollback contract | 先通过人工决策定义域边界，再决定是否建设；不可默认统一 |

## 结论

当前最接近“完整可复用基础设施”的是 Global Index、Managed Scope、Managed AI policy queue、File Identity Safety、Operation/Restore Journal 和 Safe Trash。当前最危险的误读是把这些领域能力拼成一套未经定义的万能 runtime。Task 00 的结论是：先保留域边界，再按审计报告中的阶段顺序逐一完成设计和人工验收。
