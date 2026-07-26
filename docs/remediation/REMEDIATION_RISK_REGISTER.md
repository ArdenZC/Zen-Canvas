# Remediation Risk Register

这是 PR #15 合并后、Task 00 审计形成的风险基线。风险记录的是当前架构在后续整改时可能被放大的 failure mode，不是本次要修复的业务问题。Task 00 不改变任何风险对应的生产行为。

等级定义：

- **Critical**：可能越过文件/AI/隐私/恢复安全边界，或造成不可逆数据后果。
- **High**：可能造成跨域数据错误、任务丢失、错误执行或不可兼容迁移。
- **Medium**：会造成一致性、性能、可观测性或维护风险，但当前有局部缓解。
- **Low**：影响范围或概率较低，但需要在对应阶段留下证据。

| ID | 风险 | 等级 | 触发条件/影响 | 当前证据 | 阻断/缓解与验收条件 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | 重建第二套 Global Index | Critical | 新模块重新扫描全盘、产生第二套 volume/entry/FTS，导致 search、AI、scope、stale 事实分裂 | `db/schema.rs::ensure_global_index_schema`; `global_index/coordinator.rs`; `global_index/repository.rs` | 所有 global discovery/search/managed resolution 必须复用 `global_*`；需要 architecture guard 和 source ownership review | 已登记，阻断后续越界 |
| R-002 | 把 Managed AI `ai_jobs` 误作通用 Job Runtime | High | 扫描/cleanup/dedupe 复用 AI 字段，污染 provider/scope/fingerprint/correction 状态或绕过校验 | `managed_worker_hardened.rs`; `legacy_queue.rs`; schema `ai_jobs` | 先定义跨域 lifecycle primitives；保持 Managed AI 表/worker 独立；必须有 policy/correction regression tests | 已登记，禁止直接泛化 |
| R-003 | 引入无边界的跨域 durable queue | Critical | 同一 task 同时由 renderer、Tauri thread、native service、provider worker 消费，重复执行或丢失 | `watcher.rs`; `useFsWatcher.ts`; `coordinator.rs`;各 domain manager | 每个任务定义唯一 owner、claim、idempotency key、cancel、retry、recovery；未定义前不得建 queue | 已登记 |
| R-004 | Scan 崩溃/重启后误判为完成 | High | in-memory scan job 消失但 `files` 已部分写入，stale cleanup/generation 不知道边界 | `scanner.rs::ScanJobManager/scan_directory_blocking`; `useBackgroundIndexerStore.ts` | 先设计 generation/run/partial semantics；用 kill/restart/partial batch 测试；旧 scan path 保持 fallback | 已登记 |
| R-005 | Watcher overflow 后最终一致性丢失 | High | bounded notify channel 或 renderer queue overflow，变化信号丢失且没有 durable change journal | `watcher.rs` capacity 2048/overflow；`fsWatcherQueue.ts`; `windows/fallback.rs` | 明确 overflow -> authoritative rescan、owner 和 source cursor；必须有 duplicate/missed event test | 已登记 |
| R-006 | 多个 watcher/provider 重复消费同一变化 | High | File Library watcher、USN、FSEvents、Spotlight reconcile 同时写不同表或同表 | `watcher.rs`; `global_index/windows/usn.rs`; `global_index/macos/mod.rs` | 保持 files/global 的边界；未来必须有 source id/generation/idempotency evidence | 已登记 |
| R-007 | Path ID 与 native ID 混用 | Critical | rename/cross-volume/case change 后把不同实体误合并，或丢失 operation/AI history | `scanner.rs::scanned_entry_to_insert_request` (`id = path`); `global_index/models.rs::stable_entry_id`; `path_identity.rs` | 先做 mapping、collision、backfill、rollback 设计；禁止无迁移改 `files.id` | 已登记，阻断 identity phase |
| R-008 | 把 operation identity 当成普通 file fingerprint | Critical | 外部修改、symlink/reparse、目录 manifest、claim/restore semantics 被弱化，错误移动或恢复 | `fs_safety/identity.rs`; `file_ops.rs`; `db/queries/operations.rs` | 所有 mutation 继续走 claim + identity + preview；抽象只读 identity components 要有 negative tests | 已登记 |
| R-009 | Dedupe 只按 size/hash 产生错误用户语义 | High | hardlink、物理同一文件、同内容独立文件、外部变化被混为 duplicate/reclaim | `dedupe.rs::run_duplicate_detection_job`; `files.content_hash`/`idx_files_dedupe` | 先定义 group/finding/physical identity/reclaim；未经确认不能自动 move/delete | 已登记 |
| R-010 | Dedupe/cleanup finding 在重启后丢失 | High | 用户看到的分析列表和确认状态属于内存 job，重启后无法重放或审计 | `dedupe.rs::DedupeJobManager`; `storage_analyzer.rs::StorageCleanupState` | 先设计 analysis run/finding；Safe Trash journal 独立保持现有恢复链 | 已登记 |
| R-011 | Global cursor/checkpoint 被误认为通用 generation | High | USN/FSEvents/Spotlight/fallback 的 cursor 语义不同，回放时跳过或重复 | `global_index/coordinator.rs`; `windows/usn.rs::sync_volume`; `macos/mod.rs::PendingUpdates` | 每个 provider 声明 cursor/rebuild/permission contract；用 journal gap/rename/permission 测试 | 已登记 |
| R-012 | Managed Scope/Cloud AI 越权 | Critical | global search 或 unmanaged File Library row 直接进入 AI；cloud provider 读取未授权内容/路径 | `managed_scope.rs`; `legacy_queue.rs`; worker pre/post validation; `ai/settings.rs` | 保持 scope enabled + managed entry + provider policy + user correction 四重 gate；加 negative tests | 已登记，必须阻断 AI 扩展 |
| R-013 | AI 结果覆盖用户纠正 | Critical | force reanalysis、provider retry 或 scope backfill 覆盖 correction | `managed_worker_hardened.rs` `user_corrected`; `legacy_queue.rs` force update; schema state | correction 永远阻断完成写入；任何新 consumer 要有 correction precedence test | 已登记 |
| R-014 | Content Artifact 泄露隐私/密钥 | Critical | 默认读取文件内容、将内容发送 cloud、长期保存 raw/extracted text 或 trace | `managed_worker_hardened.rs::build_managed_ai_request`; `ai/trace.rs`; `ai_analysis_state.content_summary='metadata_only'` | 先人工决定类型、大小、脱敏、加密、retention、local/cloud consent；Task 00 不创建 artifact | 已登记，阻断 content phase |
| R-015 | 把 AI trace 当业务内容库 | High | ring buffer 截断/重启丢失/secret redaction 造成内容不可复用或错误授权 | `ai/trace.rs::MAX_AI_TRACE_COUNT/MAX_EXTRACTED_CONTENT_CHARS/record_trace` | trace 仅诊断；artifact 必须有独立 schema、权限、版本和删除语义 | 已登记 |
| R-016 | Organization Plan 过期仍执行 | Critical | renderer 持有旧 preview，文件已变更/AI 已重算，执行错误移动或错误重命名 | `file_ops.rs::execute_moves`; `get_operation_previews_by_file_ids`; `verify_indexed_file_identity` | Plan 必须绑定 revision/snapshot/identity/server preview；执行仍只接受 authoritative preview | 已登记，阻断 plan phase |
| R-017 | 业务层绕过 preview/journal/restore | Critical | AI、cleanup、自然语言规则或跨页 selection 直接调用 filesystem API，无法恢复 | `file_ops.rs`; `storage_analyzer.rs`; `ai/prompts.rs` safety contract | 所有 mutation 经过现有 preview + identity + journal + Safe Trash；加 source-contract guard | 已登记 |
| R-018 | OFFSET 在 realtime 数据中跳页/重复 | High | scan/watcher/stale update 在分页期间改变排序，用户/plan 选择错行 | `db/queries/files.rs` 多处 `LIMIT/OFFSET`; `global_index/search.rs`; `VaultView.tsx` | 先决定 snapshot/cursor；并发 scan/watcher/query 测试；保留 Query V1 fallback | 已登记 |
| R-019 | 跨页选择表达不真实 | High | UI 只选择 loaded rows，却把操作描述成全结果；未加载 rows 没有 server-side selection | `VaultView.tsx::selectedIds/selectedFiles`; `fileLibraryModel.ts::selectionForRowClick`; `FileLibraryList.tsx` | Query V2 设计 query selection/plan binding；不要仅扩大 renderer array | 已登记 |
| R-020 | 大表 total/count 和排序成本失控 | Medium | CTE/duplicate join/total count + OFFSET 在大表或连续 watcher 下变慢，UI 事实滞后 | `get_paged_files_in_scope_with_filter`; performance benchmark | 先用现有 benchmark 建 threshold/plan evidence；再决定 index/cursor，不在 Task 00 优化 | 已登记 |
| R-021 | Native helper/service 协议漂移 | High | Windows service pipe 版本、desktop fallback、installer/CI 不一致造成不可用或安全降级 | `global_index/windows/service.rs`; `service_host.rs`; `.github/workflows/ci.yml`; release workflow | 保持 versioned protocol、source snapshot validation、direct fallback；必须做 native smoke/release test | 已登记 |
| R-022 | 权限/partial index 被当作 complete | High | Spotlight/MFT/FSEvents/fallback 只返回部分结果，但 UI/AI 当全量事实 | provider status enums; `SettingsView.tsx` status mapping; coordinator status | 状态必须带 source/completeness/error/permission；managed AI 默认不消费 stale/partial 未授权条目 | 已登记 |
| R-023 | 迁移破坏 operation/cleanup 账本 | Critical | 新 identity/plan/finding schema 破坏 schema v18–26 字段、恢复阶段或 startup reconcile | `db/schema.rs::migrate`; `db/queries/operations.rs`; cleanup journal | 每次迁移需 forward/backward/fixture/rollback/reconcile tests；不得在 Task 00 改 schema | 已登记 |
| R-024 | 同一主库中的跨域锁竞争 | High | 新表/长事务在 global upsert、AI claim、library query、operation journal 间产生 SQLite busy/尾延迟 | `Database` single SQLite; global repository transactions; worker `TransactionBehavior::Immediate` | 先测锁边界/事务时长；禁止把大型 analysis 或内容写入放进 mutation transaction | 已登记 |
| R-025 | 文档与实现漂移 | Medium | 旧 remediation/design/security docs 的阶段、表名或边界与 PR #15 当前源码不一致，后续按错规格实现 | `docs/design/*`; `docs/security/*`; 本目录 task/index 与当前 source map | 以当前代码/测试为事实；每阶段更新 source evidence；将 drift 纳入 CI/manual review | 已登记 |
| R-026 | 阶段顺序产生循环依赖 | High | Plan 需要 finding，finding 需要 identity/run，run 又依赖通用 runtime，导致半成品 schema 互相引用 | 本报告第 12 节阶段顺序；`CODEX_REMEDIATION_INDEX_V1.md` | 每阶段声明 prerequisite/non-goal/migration/rollback；人工批准后逐阶段合并 | 已登记 |
| R-027 | 性能基线被优化步骤掩盖 | Medium | benchmark pre-optimize 约 50 秒，post-optimize p95 仅毫秒，误把一次性建索引成本当作持续性能 | `npm run test:performance` 输出；`scripts/runPerformanceTest.mjs` | 保留 cold/warm/optimize 分段指标和阈值；后续大表/增量/重启 benchmark | 已登记 |
| R-028 | 安全审计 warning 被误当修复完成 | Medium | cargo audit exit 0 但有 15 allowed warnings，GTK/glib advisory 未解决 | `npm run security:audit:rust` 输出 | 在 release/security gate 记录 warning inventory 和 owner；Task 00 不升级为代码修复 | 已登记 |
| R-029 | 过早扩大 scope 造成越权扫描 | Critical | global index root、cleanup root、search root、Managed Scope 混为一套，扫描/AI/清理越过用户授权 | `global_index/managed_scope.rs`; `storage_analyzer.rs::validate_cleanup_roots`; Settings search scope | 每个 root/scope 类型保持显式；跨域需要授权映射和 negative tests | 已登记 |
| R-030 | 发布/分支混入非 Task 00 文件 | High | mixed worktree 下 stage -A 或 broad commit 把生产代码、permissions、build output 一并发布 | Task 00 allowed path；当前工作树初始有未跟踪内容 | 只用 `git add docs/remediation`，cached diff/stat/path check 后再 commit；Draft PR review scope | 已登记 |

## Task 00 风险结论

当前没有需要在 Task 00 中修复的生产缺陷。风险登记的目的，是在人工验收后把“架构可扩展”与“现在可以动代码”分开。任何 Critical/High 风险在对应阶段没有 owner、测试、迁移和 rollback 证据时，保持该阶段不可执行。
