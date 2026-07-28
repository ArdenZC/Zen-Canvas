# Task 03 Implementation Closeout — Analysis Runs, Findings and Detectors

## 1. 执行状态

- 任务：Task 03，一次完整生产实施；未拆分为 03A/03B/03C。
- 分支：`remediation/03-analysis-run-findings`。
- 基线 HEAD：`9e4637c232bb5ba8ab4bd7ae107e0b943f45a0d9`。
- 基线数据库：schema 29；Task 02 合并提交为 `ac0ffd78244d61833d13c8ff7878be0a0e2bceaf`。
- 目标数据库：schema 30。
- 实施提交、最终 HEAD、Draft PR URL 和 CI 状态在提交/推送/CI 触发后补记于本文件的末尾与最终汇报。

Task 04 及所有后续阶段未开始。

## 2. 六项 Task 02 遗留关闭

1. Global duplicate-group authority：`all_managed_file_library` 才能 authoritative publication；显式 root 运行固定为 diagnostic。authority singleton、revision、scope snapshot、root health/reconciliation/watcher-rule recovery 检查和 group publication/invalidation 在同一短事务内更新。新增 `part4.rs` 覆盖 diagnostic 不替换全局组、healthy authority、unhealthy root 阻断。
2. Prehash identity：`dedupe.rs` 在 sample 前后捕获 physical identity，变化时返回 `file_changed_during_prehash`，不写入可复用 sample；真实 read bytes 写入 progress。
3. Cancellation：取消停止新的调度，排空 worker 结果，仍通过 identity/CAS 保存有效 fingerprint，禁止 partial group publication；已有 dedupe integration tests 覆盖取消和 changed-file 路径。
4. Byte progress：cache hit 为零 IO；小文件直接一次 full hash；大文件先读 head/tail，确定 survivors 后才增加 full-hash budget；`processed_bytes` 只来自实际读取。
5. Small files：碰撞的小文件不再走 prehash+full hash 双读；dedupe integration test 固定一次 full read 预期。
6. Rename cache mirror：verified rename cache reuse 同步 `files.content_hash`，后续 invalidation 清理 fingerprint validity 和 mirror；rename integration test 固定两者一致。

## 3. Schema 29 → 30

`schema.rs` 在现有 immediate migration transaction 中新增：

- `dedupe_runs.publication_mode`，约束为 `authoritative|diagnostic`；
- singleton `dedupe_authority_state`，初始为 `rebuild_required`，不伪造历史 authority；
- `analysis_runs`、`analysis_run_detectors`、`analysis_findings`、`analysis_finding_evidence`、`analysis_finding_decisions` 及分页/查询索引；
- run、detector、finding、decision 的 CHECK domain 和 CAS revision。

保留既有 scan/watcher/dedupe/fingerprint/group/AI/Global/journal/rules 数据；没有修改 `files.id`、Managed AI schema、Global Index production provider/schema/service、operation journal 或 cleanup journal。`dedupe_authority_state.last_authoritative_run_id` 对旧 run 使用 `ON DELETE SET NULL`，避免 retention 被历史引用永久阻塞。

验证：empty DB→30、schema 29→30、schema 30 reopen、schema 31 rejection，以及 deliberate conflicting `analysis_runs` table 的 migration rollback 都有 Rust tests。另有 100k-file schema 29→30/WAL benchmark。

## 4. Run / detector state machine and publication

合法 run 路径：

```text
queued/preparing → running/preparing → running/running_detectors
→ running/finalizing → completed|completed_with_warnings / completed
```

取消：`queued|running → cancelling → cancelled`；启动恢复：`queued|running|cancelling → interrupted`；失败为 `failed`。每次 run/detector transition 都要求 durable revision CAS；canonical `(scope_hash, detector_set_hash)` 只允许一个 active run。同 request key + payload 幂等；active 同 scope 请求只设置 `rerun_required`。terminal retry 增加 `request_attempt`。source change 或 coalesced request 最多触发一次自动 retry，第二次要求人工处理。

运行器只保留进程内 cancel flag/worker handle。检测器不持有 SQLite 写事务执行 traversal、hash、AI 或长计算；结果先 staged，publication 为一笔短 immediate transaction：成功 detector 的新 finding 先存在，再 supersede 同 scope/detector 的旧 active set，最后写 detector/run terminal revision。失败、取消、中断或 source snapshot 改变时 staged rows 不会变 active，失败 detector 的旧 active findings 保留。

## 5. Fixed detector registry

Rust registry 固定 allowlist/version：

- `duplicate_reclaimable_v1`：只读 healthy global dedupe authority；review、`review_duplicate_group`、不可执行；带 group/member、physical-copy、hardlink evidence；
- `large_file_v1`：managed/approved scope large-file review/reveal；每一条 finding 都绑定 managed file ID、indexed row、fingerprint 和 live physical identity；
- `large_directory_v1`：approved traversal 的 review/reveal，过滤嵌套大目录 ancestor，避免 naïve double count；
- `cleanup_heuristics_v1`：复用现有 deterministic protected/excluded/allowlist 分类；只有既有 allowlisted safe candidate 才可能 executable。

大文件/大目录 detector 始终独立构造 `Review + Reveal + non-executable` finding；同一 subject 可以同时存在独立的 heuristic finding。detector 之间不共享 heuristic 的 Safe/MoveToTrash 结论。

未知 detector、错误 scope 组合和 arbitrary renderer detector 都在 admission/central finding validation 拒绝或 durable skip；没有 plugin、shell、renderer SQL、model tool 或 detector filesystem mutation。

## 6. Finding / evidence / decision

Finding key 由 detector/version、subject 和 identity evidence 构成。approved-path key 包含 normalized path、size、mtime、physical identity；managed file 使用库记录和 live identity；duplicate 使用 deterministic group ID。改变 identity 会产生新 key，旧 dismissal 不会转移。run-scoped row ID 防止未发布 rerun 覆盖旧 active row。

Finding lifecycle：`staged → active → stale|superseded`。失败 detector 的 staged rows 为 `discarded`；run-level cancel、source snapshot change、startup interruption 会保留 staged diagnostics，但它们永远不能转为 active。scanner/watcher/root/group/cleanup mutation 通过短 DB helper 标记相关 active finding stale；managed file finding 以 durable file ID 为 primary subject，并在 detail、preview 和 execution 前重新比较 indexed row、fingerprint、live physical identity；duplicate group、directory、approved path 分别按 group revision/full hash、目录 identity、path identity revalidate。

`analysis_finding_evidence` 为 Rust detector 产生的 typed JSON；AI 仅追加 `ai_assessment`。`analysis_finding_decisions` 是 triage fact，不是 mutation approval，使用 decision revision CAS；decision 随同一 identity key rerun 保留，changed key 不继承。snooze 需要 expiry。

Retention：active finding 保留；stale/superseded/discarded/staged 30 天，run 90 天，孤立 decision 180 天。每轮共享一个最多 1000 个物理行的全局预算，按 evidence → finding → orphan decision → detector child → run 的顺序 child-first 删除；run 只有在没有任何 finding/detector child 时才可删除；active run 存在时不 prune，run 删除不依赖 cascade 释放子表。

`exact_reclaimable_bytes` 只有物理证据足够时写入；`potential_reclaimable_bytes` 单独展示为上限/诊断估计。potential 按路径层级去重；path-owned exact 也按路径层级去重，但 duplicate-group exact 使用稳定 group/physical key 独立聚合，因此同一路径的 large-file finding 不会覆盖 duplicate exact bytes。

## 7. Cleanup / AI compatibility and mutation safety

Legacy `start_storage_cleanup_scan`、status、page、cancel 现在适配 durable analysis run/finding；renderer restart 通过 SQLite hydrate，旧 `StorageCleanupState` 不再由 production command 作为结果 authority。cleanup adapter 以 durable `CleanupFindingSelection` 传递 finding identity/revision。

执行前 backend 解析 run/finding、校验 approved scope、active status、allowlisted action/tier、path existence、subject identity 和 finding revision。preview/operation preview/Safe Trash 都必须提交 `findingId + expectedRevision`；Review finding 还必须提交 server 已持久化的 `acknowledged` decision revision。未确认 Review、Caution、duplicate group、Reveal-only finding 和 stale revision 一律拒绝。已确认的 eligible Review 只在本次 server resolution 内投影为 Safe Trash，不能改变 durable tier。旧的 `move_cleanup_candidates_to_trash` Tauri command/API/capability 已移除，所有生产清理执行只走现有 cleanup journal、Safe Trash、restore。成功后 finding 标记 stale。没有 permanent delete、自动 keeper、直接 detector mutation 或 journal/restore safety weakening。

AI cleanup adapter 重新读取 durable finding，只追加 evidence；不能降低风险、把 Review/Caution 升成 Safe、改变 user decision 或新建 executable authorization。每次 AI assessment 与 finding/evidence 写入同一 immediate transaction，并在同一事务内重算 run 的 counts、findings_published、exact/potential totals 和 run revision；提交后发出带新 durable revision 的 `analysis-run-updated` event，renderer gap/restart 重新 hydrate。

## 8. API / events / UI

新增 Tauri capability/API：run start/cancel/retry/get/list、active run、detector list、finding keyset page/detail/evidence、decision、revalidate、dedupe authority；events 为 `analysis-run-updated`、`analysis-detector-updated`、`analysis-findings-published`，都携带 durable revision。

Storage Cleanup surface 现已提供 durable run history、phase/status、detector progress、Safe/Review/Caution 和 exact/potential summary、detector/category/tier/decision/status filters、keyset load-more、finding reason/identity/evidence、stale/revalidate、reveal、acknowledge/dismiss/snooze/reopen。cleanup API 不再传裸 finding ID，而是传 `CleanupFindingSelection`（`findingId`、`expectedRevision`、可选 `reviewConfirmation.decisionRevision`）。duplicate finding 显示 read-only 语义；只有 server 重新验证后的 Safe 或已明确确认且允许的 Review 才能进入 Safe Trash。store 在订阅事件前 hydrate；旧 revision 被拒绝，revision gap 重新读取 durable status/page/findings。

## 9. Tests and performance

新增/更新：

- `src-tauri/src/analysis.rs`：managed file indexed/fingerprint/live identity、duplicate group hash/member/revision revalidation、独立 Review+Reveal detector contract、server-side per-item Review authorization；
- `src-tauri/src/db/tests/part4.rs`：schema 30、migration rollback/reopen preservation、run idempotency/coalescing/CAS/retry、staged rerun decision persistence、cancel/source-change/interruption publication safety、failed/partial detector publication、snooze expiry、managed file mutation invalidation、global prune 1000-row child-first/WAL、shared-path duplicate exact aggregation、AI aggregate/revision/evidence refresh、global authority；
- `src-tauri/tests/dedupe.rs`：prehash/cancel/small-file/rename mirror；
- `src-tauri/src/storage_analyzer.rs`：finding revision CAS、Review decision revision confirmation、unconfirmed/Caution/duplicate rejection；
- `src-tauri/tests/migrations.rs`：schema 29→30 100k-file/WAL benchmark；
- `tests/dedupeContract.test.ts`：schema/registry/safety/API/UI contract；
- `tests/storageCleanupStore.test.ts`：renderer restart durable hydrate 和 stale revision rejection；
- 既有 schema 29 assertion、Rust integration、frontend/browser mock、Tauri permission 和 performance script 更新。

已完成的 targeted evidence：

| 验证 | 结果 |
|---|---|
| targeted Rust analysis/cleanup tests | pass；managed identity、detector contract、duplicate revalidation、selection/decision CAS、prune budget/WAL、shared-path exact、AI aggregate 相关目标测试通过 |
| targeted frontend contract tests | pass；remediation contract、Tauri selection payload、Storage Cleanup review/CAS surface 共 47 项通过 |
| `npm run verify:frontend` | pass；typecheck、71 个 frontend test files / 496 tests、remediation 13/13、performance、Vite build 和 NSIS installer 全部通过 |
| `npm run verify:rust` | pass；fmt check、482 个 Rust unit tests（6 ignored）、全部 integration tests、doc tests 和 clippy `-D warnings` 全部通过 |
| `npm run verify:security` | pass；`npm audit` 0 vulnerabilities；`cargo audit` 通过，报告 15 条既有 allowed warnings |
| `npm run test:performance` | pass；FTS、managed scan、schema 28→29、schema 29→30、Task 03 findings/publication/prune、Task 02 repository/hash benchmarks 全部通过；prune global budget/WAL check 通过 |
| schema 29→30 100k/WAL | pass；latest migration 14.863 ms，reader 1.170 ms |
| analysis findings 100k/WAL | pass；latest page 46.323 ms，review filter page 34.227 ms，decision/detail/evidence 0.195 ms，reader 4.257 ms |
| 10k finding publication | pass；latest publication transaction 5393.821 ms |
| `npm run build` / installer | pass；`src-tauri/target/release/bundle/nsis/Zen Canvas_0.1.40_x64-setup.exe` |
| GitHub Windows Quality | 待本次推送后重新运行 |
| GitHub macOS Quality | 待本次推送后重新运行 |
| GitHub Dependency audit | 待本次推送后重新运行 |

## 10. Known risks and gates

- Windows/macOS filesystem identity、watcher timing 和 installer packaging 仍需 GitHub matrix CI/人工验收；
- approved-path traversal 仍沿用既有 cleanup analyzer，durable adapter 已把执行 authority 收回 DB，但平台特有目录语义需人工复核；
- Task 03 不替代 Task 04 的全库 Query V2/snapshot/selection；本实现只使用 analysis module 自己的 keyset cursor。

## 11. Completion declaration

```text
Task 03 implementation has been revised against the latest code-level review and stopped for human acceptance.
No Task 03A/03B/03C or multiple production PRs were created.
No detector or finding directly mutated a user file.
Task 04 and all later tasks were not started.
Waiting for human code-level acceptance.
```

## 12. Delivery record

- Implementation commits：`5b22eeed68edb886ceb48f5ca110653bac9da3ce`、`5f0c308e422fd9f090efb7ad27b68d8c8ad3ab13`。
- Final delivery HEAD：`5f0c308e422fd9f090efb7ad27b68d8c8ad3ab13`；工作树保持干净。
- Draft PR：[#28](https://github.com/ArdenZC/Zen-Canvas/pull/28)，`feat: add durable analysis runs and findings`。
- GitHub CI run：`30360573025`；Windows/macOS Quality 与 Dependency audit 全部通过。
