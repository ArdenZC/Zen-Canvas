# Task 02 Implementation Closeout

## 1. Delivery identity

| 项目 | 实际值 |
|---|---|
| 任务 | Task 02 — Identity, Fingerprint and Duplicate Groups |
| 基线 | `master` gate 已通过；实际基线 `7f1454475a87b66d1fbb6479b72a49107bae3c6e`，schema 28 |
| 分支 | `remediation/02-identity-fingerprint-dedupe` |
| Draft PR | [#26](https://github.com/ArdenZC/Zen-Canvas/pull/26) — `feat: add durable file fingerprints and duplicate groups` |
| 代码实现提交 | `615e42e` + `91b5d2c46ae66695f98453d95d86d601740319a2`（最终 HEAD） |
| 状态 | 已完成生产实施，保持 Draft，等待人工代码级验收 |

本 Closeout 记录代码实现提交 `615e42e` 以及后续 cache/test/benchmark 补强提交 `91b5d2c46ae66695f98453d95d86d601740319a2`；PR #26 当前 HEAD 与该 SHA 一致。

## 2. Scope and hard boundaries

本任务只实现 durable identity/fingerprint/dedupe domain 及 Task 01B 遗留的 watcher rule recovery durable flag。

- 未迁移或重写 `files.id`。
- 未修改 Global Index provider/schema/生产模块；`src-tauri/src/global_index/tests.rs` 仅同步既有 schema 版本断言。
- 未修改 Managed AI schema、worker、provider policy 或 queue。
- 未修改 operation/cleanup journal、Safe Trash、restore 或任何文件 mutation。
- 未新增依赖，未修改 `package.json`、Cargo manifest 或 lockfile。
- Task 03 Analysis Run/Finding、风险分析和 cleanup 建议未开始。

## 3. Schema 29 SQL and migration

`src-tauri/src/db/schema.rs` 将 `CURRENT_SCHEMA_VERSION` 设为 29。schema 28→29 在同一个 migration transaction 中执行：

1. 为 `scan_roots` 增加 `watcher_rule_recovery_required`，默认 `0` 且有 `0/1` CHECK。
2. 创建 `dedupe_runs`：request key/attempt、canonical scope snapshot/hash、active run 状态、phase、cancel/rerun、progress、error counters、revision、timestamps。
3. 创建 `file_fingerprints`：`file_id` 旁路映射、path/size/mtime/modified-ns、平台 physical key、link count、prehash/full hash 算法版本、validity/error、revision。
4. 创建 `dedupe_run_errors` 有界错误账本。
5. 创建 `duplicate_groups` 和 `duplicate_group_members`，保存 physical copy、hardlink alias、exact/potential reclaimable 及 confidence。
6. 创建 active-scope partial unique index、fingerprint/group/error 查询索引和 `active_duplicate_membership` 只读投影 view。

迁移不从 `files.content_hash` fabricated fingerprint/group；`files.content_hash` 只作为兼容镜像。schema 29 reopen 使用幂等的 `ensure_dedupe_schema`；schema 30+ 继续在打开数据库时拒绝。

证据：

- `database_rejects_schema_30_as_a_future_version`
- `schema_28_to_29_conflict_rolls_back_dedupe_migration_atomically`
- schema 27/28 fixture 保留 scan roots/runs/seen、watcher revision、AI、Global Index、operation/cleanup journal 和 rules，并确认没有伪造 dedupe rows
- migrations integration suite 5/5 passed

## 4. Watcher rule recovery debt

规则执行失败现在把 root 事实写为 `watcher_rule_recovery_required = 1`。后续正常 watcher batch、rename、overflow 或最近错误字段变化都不会清零该 flag。只有 root 级 full reconciliation 成功完成，并通过已有 watcher revision/applied-revision ownership/finalization CAS 后才清零；失败、重启和未完成 recovery 保持 pending。root flag 为 1 时不能将 root 报为 healthy。

这项改动没有泛化 Managed AI queue，也没有让不会执行规则的 full scan 伪装成规则恢复。

## 5. Physical identity and fingerprint validity

新增 `src-tauri/src/fs_safety/physical.rs` 是 dedupe 专用、只读的轻量 helper：

- Windows 使用 volume/file identity 和 link count；Unix/macOS 使用 device/inode/link count。
- symlink/reparse path fail closed；native identity 不可用时只记录 `path_only`，不会提升为 verified/reclaimable exact 证据。
- `physical_key` 只用于识别物理同一文件；operation/restore identity、claim、preview 和 journal 语义未改变。
- helper 不读取文件内容，hash IO 只在 dedupe worker 中发生。

fingerprint 只有在 path snapshot、active `files` row、size、indexed mtime、`modified_ns`、physical key、algorithm/version 和 fingerprint revision 全部匹配时才可复用。prehash/full-hash 写回都使用数据库 CAS；full hash 写回前后再次读取 identity，变化则拒绝持久化并记录 error。scanner/watcher invalidation 在短事务中清除兼容 `files.content_hash`、将 fingerprint 置 stale/missing/unsupported/error，并使相关 active groups stale。

stale/missing/error fingerprint 和 terminal run/error/group 账本按 30 天 retention 清理；每次 prune 对所有类别共享 bounded cap（测试使用 1000 cap）。单个 run 的 error detail 最多持久化 1000 条，并保留 truncation/warning 事实。

## 6. Dedupe pipeline and bounded IO

候选先按 managed active files 的 size 过滤，只有 size count > 1 才进入 prehash。prehash 是头尾采样（4 KiB，`blake3-head-tail` v1），只用于淘汰；只有完整 BLAKE3 v1 才能确认内容重复。

- worker 使用标准库 `sync_channel` 的有界池；worker 数为 1..8，默认 `min(4, available_parallelism)`，可由 `ZEN_CANVAS_DEDUPE_HASH_WORKERS` 约束。
- 不在 worker 中直接写 SQLite；单一 DB writer 以 batch/CAS 写 fingerprint，publication 使用短事务。
- progress 同时维护 files/bytes，并保证 processed 不超过 candidate/total。
- hash 前、hash 中、hash 后 identity 任一变化都拒绝旧结果；取消不删除已验证 fingerprint，也不发布 partial groups。
- old `run_duplicate_detection_with_hasher` 保留为兼容入口，但现在只适配 durable pipeline，不再运行旧的内存 hash/CTE authority。

## 7. Durable run, retry and recovery

`dedupe_runs` 是唯一 run authority：

```text
queued -> running -> completed
                 -> completed_with_warnings
                 -> cancelled
                 -> failed
                 -> interrupted (startup recovery)
queued/running -> cancelling -> cancelled|interrupted|failed
```

同一 canonical managed scope 由 partial unique index 保证最多一个 active run。相同 request key + canonical request/scope hash 幂等返回；active scope 会 coalesce/rerun mark；terminal `failed/interrupted/cancelled/completed_with_warnings` 可用显式 retry 创建新 attempt，不被旧 request key 永久阻塞。scan-session dispatch 保留 request attempt 和 `scope_changed_retry_exhausted`，scope 变化最多 bounded rerun，耗尽后不自动产生无界新 run。

每个 claim、checkpoint、error/warning、publication、terminal transition 都带 expected durable revision；CAS 失败不会覆盖新 owner。启动时 queued/running/cancelling 的 run 标为 interrupted，历史 fingerprint/group 不被删除；UI 可以查询并显式 retry。取消会保存已完成 fingerprint，但禁止使用当前不完整候选集替换 active groups。

scope snapshot 记录 canonical managed roots、watcher revision/applied revision 和 snapshot hash。publication 前重新验证 snapshot；变化只写 warning/rerun intent，不替换权威 active group 集合。

## 8. Duplicate group semantics and consumers

publication 在一个短事务内写 deterministic groups/members，并以 snapshot/CAS guard 防止半成品可见。分页使用本模块专用的 `(potential_reclaimable_bytes DESC, size_each DESC, full_hash ASC, id ASC)` keyset cursor；`active_duplicate_membership` 是 File Library、classification、learning、AI duplicate projection 和 browser mock 的共同 membership authority。

- hardlink-only paths 共享一个 physical key，不产生可释放 duplicate copy。
- hardlink + true copy 可形成内容 group，但 exact reclaimable 只计算物理副本；hardlink alias 单独计数。
- physical identity 不可验证时不宣称 exact reclaimable，UI 显示 potential/unknown confidence。
- UI/API 只提供 start/cancel/retry、查询、分页、reveal/read-only 投影；没有 delete、move、keep-one、cleanup 或自动执行动作。
- renderer store 先 hydrate；旧 revision 被拒绝，revision gap 触发重新 hydrate，避免 renderer 重启后旧事件覆盖 durable 状态。

## 9. Tests and verification

Rust/TS/contract/integration coverage includes:

- schema 28→29 migration, rollback, reopen and future-schema rejection;
- recovery flag interleaving and root health semantics;
- active-scope admission/idempotency, retry, startup interrupted recovery, cancellation, revision CAS and scope snapshot/rerun exhaustion;
- physical identity, symlink/reparse fail-closed, hardlink-only, hardlink + true copy, same-size/different-content and changed-during-hash;
- physical identity path-only/cross-volume/rename reuse, same-second `modified_ns` detection, hardlink versus true-copy accounting and algorithm/version invalidation;
- prehash/full-hash, cold/warm cache (warm custom hasher calls = 0), distinct-sample pruning, prehash collision full-hash confirmation, fingerprint invalidation/error retention, fingerprint CAS and bounded error ledger;
- group atomic publication, stale-on-invalidation, deterministic group revision, keyset cursor, file/group membership projections, legacy `content_hash` false-group guard, cancellation preservation and read-only UI/permission surface;
- bounded worker parity (1 versus multi-worker) and the repository/performance gate's candidate, fingerprint, publication, keyset and retention measurements.

| Gate | Result |
|---|---|
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | passed |
| `cargo clippy --features desktop-runtime --all-targets -- -D warnings` | passed |
| `npm run verify:frontend` | passed: 71 files / 490 tests, remediation 13/13, performance and build passed |
| `npm run verify:rust` | passed: 460 library tests, all integration suites and doc tests; 0 failures |
| `npm run verify:security` | passed: npm audit 0 vulnerabilities; cargo audit exit 0 with 15 existing advisory warnings |
| Task 02 performance | passed: 100k candidate/FTS fixtures, fingerprint index/query, 10k groups/20k members, keyset page, prune cap |
| installer/build | passed: `Zen Canvas_0.1.40_x64-setup.exe` generated |
| GitHub CI run `30237626153` | passed: Dependency audit, Windows Quality 16m35s, macOS Quality 5m19s；HEAD 与 PR #26 一致 |
| `git diff --check` | passed; only Windows LF→CRLF normalization warnings |

Representative Task 02 performance run:

```text
candidate_collection_ms=136.106
fingerprint_batch_write_and_index_query_ms=1293.846
publication_10k_groups_20k_members_ms=482.865
keyset_page_100_ms=5.576
prune_1000_cap_ms=19.582
```

Hash IO benchmark evidence (same implementation, release build):

```text
reduced CI fixture: files=16, bytes_each=1048576, identity_io_ms=0.733, prehash_bytes=131072, prehash_ms=0.549, full_hash_bytes=16777216, one_worker_ms=7.026, default_workers=4, default_worker_ms=2.815
local 1000x16MiB: files=1000, bytes_each=16777216, identity_io_ms=43.942, prehash_bytes=8192000, prehash_ms=34.823, full_hash_bytes=16777216000, one_worker_ms=4239.608, default_workers=4, default_worker_ms=1350.852
100k schema migration/WAL reader: schema_28_to_29_ms=14.089, wal_reader_count_ms=1.056
warm fingerprint cache: custom hasher calls=0; no full-hash content IO on the warm integration run
```

The task-book 1000 × 16 MiB workload is a local-only evidence item; the checked-in performance gate uses the permitted reduced CI-sized fixture. The repository benchmark separately covers the database write/index query, atomic publication, keyset page, and bounded prune stages.

## 10. Remaining acceptance and stop state

GitHub CI run `30237626153` 已针对最终代码 HEAD `91b5d2c46ae66695f98453d95d86d601740319a2` 完成并通过 Dependency audit、Windows Quality 和 macOS Quality。Native platform identity remains platform-review evidence; path-only fallback is intentionally fail-closed. The extended large-file IO benchmark has now been executed locally and is recorded above.

Task 02 is complete as an implementation, but remains Draft and must stop here for human review. No automatic merge and no Task 03 start are permitted.
