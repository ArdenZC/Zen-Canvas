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
- `large_file_v1`：managed/approved scope large-file review/reveal；带 size、identity evidence；
- `large_directory_v1`：approved traversal 的 review/reveal，过滤嵌套大目录 ancestor，避免 naïve double count；
- `cleanup_heuristics_v1`：复用现有 deterministic protected/excluded/allowlist 分类；只有既有 allowlisted safe candidate 才可能 executable。

未知 detector、错误 scope 组合和 arbitrary renderer detector 都在 admission/central finding validation 拒绝或 durable skip；没有 plugin、shell、renderer SQL、model tool 或 detector filesystem mutation。

## 6. Finding / evidence / decision

Finding key 由 detector/version、subject 和 identity evidence 构成。approved-path key 包含 normalized path、size、mtime、physical identity；managed file 使用库记录和 live identity；duplicate 使用 deterministic group ID。改变 identity 会产生新 key，旧 dismissal 不会转移。run-scoped row ID 防止未发布 rerun 覆盖旧 active row。

Finding lifecycle：`staged → active → stale|superseded`。失败 detector 的 staged rows 为 `discarded`；run-level cancel、source snapshot change、startup interruption 会保留 staged diagnostics，但它们永远不能转为 active。scanner/watcher/root/group/cleanup mutation 通过短 DB helper 标记相关 active finding stale；approved path 在 detail、preview 和 execution 前再次 identity revalidate。

`analysis_finding_evidence` 为 Rust detector 产生的 typed JSON；AI 仅追加 `ai_assessment`。`analysis_finding_decisions` 是 triage fact，不是 mutation approval，使用 decision revision CAS；decision 随同一 identity key rerun 保留，changed key 不继承。snooze 需要 expiry。

Retention：active finding 保留；stale/superseded/discarded/staged 30 天，run 90 天，孤立 decision 180 天；每轮每类最多 1000，active finding 不会因 run retention 被 cascade 删除，active publication 时不 prune。

`exact_reclaimable_bytes` 只有物理证据足够时写入；`potential_reclaimable_bytes` 单独展示为上限/诊断估计。duplicate 使用 Task 02 physical-copy semantics，directory/overlap 不作为安全 exact claim。

## 7. Cleanup / AI compatibility and mutation safety

Legacy `start_storage_cleanup_scan`、status、page、cancel 现在适配 durable analysis run/finding；renderer restart 通过 SQLite hydrate，旧 `StorageCleanupState` 不再由 production command 作为结果 authority。legacy candidate ID 即 finding ID。

执行前 backend 解析 run/finding、校验 approved scope、active status、allowlisted action/tier、path existence、physical/operation identity 和 revision；preview 仍 server-authoritative，执行仍走现有 cleanup journal、Safe Trash、restore。duplicate/review-only/caution finding 不会直接移动。成功后 finding 标记 stale。没有 permanent delete、自动 keeper、直接 detector mutation 或 journal/restore safety weakening。

AI cleanup adapter 重新读取 durable finding，只追加 evidence；不能降低风险、把 Review/Caution 升成 Safe、改变 user decision 或新建 executable authorization。

## 8. API / events / UI

新增 Tauri capability/API：run start/cancel/retry/get/list、active run、detector list、finding keyset page/detail/evidence、decision、revalidate、dedupe authority；events 为 `analysis-run-updated`、`analysis-detector-updated`、`analysis-findings-published`，都携带 durable revision。

Storage Cleanup surface 现已提供 durable run history、phase/status、detector progress、Safe/Review/Caution 和 exact/potential summary、detector/category/tier/decision/status filters、keyset load-more、finding reason/identity/evidence、stale/revalidate、reveal、acknowledge/dismiss/snooze/reopen。duplicate finding 显示 read-only 语义；只有既有 Safe Trash confirmation flow 可执行 eligible cleanup。store 在订阅事件前 hydrate；旧 revision 被拒绝，revision gap 重新读取 durable status/page。

## 9. Tests and performance

新增/更新：

- `src-tauri/src/db/tests/part4.rs`：schema 30、migration rollback/reopen preservation、run idempotency/coalescing/CAS/retry、staged rerun decision persistence、cancel/source-change/interruption publication safety、failed/partial detector publication、snooze expiry、managed root-set invalidation、overlap totals、global authority；
- `src-tauri/tests/dedupe.rs`：prehash/cancel/small-file/rename mirror；
- `src-tauri/tests/migrations.rs`：schema 29→30 100k-file/WAL benchmark；
- `tests/dedupeContract.test.ts`：schema/registry/safety/API/UI contract；
- `tests/storageCleanupStore.test.ts`：renderer restart durable hydrate 和 stale revision rejection；
- 既有 schema 29 assertion、Rust integration、frontend/browser mock、Tauri permission 和 performance script 更新。

已完成的 targeted evidence：

| 验证 | 结果 |
|---|---|
| `npm run verify:frontend` | pass；typecheck、71 个 frontend test files / 494 tests、remediation 13/13、完整 performance suite、installer build 全部通过 |
| `npm run verify:rust` | pass；feature-enabled lib 472 passed / 6 ignored，全部 integration suites passed，clippy `-D warnings` passed |
| `npm run verify:security` | pass；`npm audit` 0 vulnerabilities；`cargo audit` 通过，报告 15 条既有 allowed warnings |
| `npm run test:performance` | pass；包含 FTS、100k scan、schema 28→29、schema 29→30、100k findings、10k publication、Task 02 repository/hash-I/O benchmarks |
| schema 29→30 100k/WAL | pass；latest migration 15.510 ms，reader 1.181 ms |
| analysis findings 100k/WAL | pass；latest page 41.923 ms，review filter page 31.181 ms，decision/detail/evidence 0.159 ms，reader 3.816 ms |
| 10k finding publication | pass；latest publication transaction 4344.017 ms |
| `npm run build` / installer | pass；`src-tauri/target/release/bundle/nsis/Zen Canvas_0.1.40_x64-setup.exe` |
| GitHub Windows Quality | pass；run `30344608991` / job `90227780430`，16m55s；frontend、Remediation、Rust format/tests/clippy、100k search、native hardening、Windows NSIS package 通过 |
| GitHub macOS Quality | pass；run `30344608991` / job `90227780561`，4m08s；frontend、Remediation、Rust format/tests/clippy、macOS path policy、macOS packaging 通过 |
| GitHub Dependency audit | pass；run `30344608991` / job `90227780382`，7m04s；npm audit 与 RustSec audit 通过 |

## 10. Known risks and gates

- Windows/macOS filesystem identity、watcher timing 和 installer packaging 仍需 GitHub matrix CI/人工验收；
- approved-path traversal 仍沿用既有 cleanup analyzer，durable adapter 已把执行 authority 收回 DB，但平台特有目录语义需人工复核；
- Task 03 不替代 Task 04 的全库 Query V2/snapshot/selection；本实现只使用 analysis module 自己的 keyset cursor。

## 11. Completion declaration

```text
Task 03 has been completed as one full task and stopped.
No Task 03A/03B/03C or multiple production PRs were created.
No detector or finding directly mutated a user file.
Task 04 and all later tasks were not started.
Waiting for human code-level acceptance.
```

## 12. Delivery record

- Implementation commit：`43cb64c540360644bfc69a9f6dac6d3f26bd3a1f`。
- Final delivery HEAD：本次 closeout delivery commit 的 SHA 在最终汇报中记录；工作树保持干净。
- Draft PR：[#28](https://github.com/ArdenZC/Zen-Canvas/pull/28)，`feat: add durable analysis runs and findings`。
- GitHub CI run：`30344608991`；Windows/macOS Quality 与 Dependency audit 全部通过。
