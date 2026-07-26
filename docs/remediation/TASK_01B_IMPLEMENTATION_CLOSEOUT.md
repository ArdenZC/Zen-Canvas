# Task 01B Implementation Closeout

## 1. 状态

Task 01B 生产实施已完成，当前仅等待人工验收。本 closeout 不授权、不开始 Task 02 或任何后续阶段。

- 实施分支：`remediation/01b-watcher-reconciliation-ownership`
- 基线：`f0a574982bd9d9949eea80d131ce1e831747a2df`（PR #22 合并提交）
- 基线 schema：27
- 上一版 PR #23 HEAD：`ac3d53c`
- 交付方式：Draft PR，禁止自动合并，等待人工验收

PR #21 的 dedupe/schema 28 分支没有被 cherry-pick，也没有进入本实现基线。Task 02 仍未开始。

## 2. 实施结果

### 2.1 Schema 28 与 durable revision

- 将当前 schema 从 27 提升到 28；schema 27 fixture 可无损补齐 watcher 列，旧 scan ledger、`files`、rules、AI jobs、Global Index、operation/cleanup journal 保留。
- `scan_roots` 增加 `watcher_revision`、`watcher_applied_revision`、最近事件/应用时间和最近错误字段；`scan_runs` 增加 `watcher_revision_at_start`。
- watcher exact mutation 与 applied revision 使用事务内 CAS；revision gap、overflow、ambiguity、永久失败和 active-scan 竞态均会留下 durable reconciliation-required 状态。
- future schema rejection 仍由现有启动路径保证；不接受高于 28 的数据库。

### 2.2 唯一 owner、队列与重启恢复

- 默认模式由 Rust/Tauri watcher 负责 File Library 的事件路由、磁盘重观察、exact upsert/stale 和规则执行；notify callback 只做有界队列投递与 overflow 信号，不执行 DB/IO。
- 同一 root 的 reconciliation 使用确定性调度 key 和既有 managed scan root lease，保证单 root 不出现并行 active run；不同 root 可受控并行。
- exact 处理先重读磁盘 metadata，再决定 create/modify/delete；目录、symlink/reparse、跨 root/路径歧义、root 不可用和规则失败升级为完整 managed scan，不写 `scan_seen`，不推进 generation。
- overflow 只在 burst 首次发生时发信号；worker 将受影响 root durable 标记为 dirty，再调度对账。启动时先恢复 revision gap，再进入 normal-ready 路径。
- active scan claim 记录 `watcher_revision_at_start`；扫描期间发生 watcher revision 变化时，run 保留 01A 的 session/generation ownership，不执行错误 stale/missing reconciliation，并以 warning/reconciliation-required 完成，后续调度由确定性 key 去重。
- full scan 在确认 watcher revision 稳定后才推进 `watcher_applied_revision`；因此 full scan 与 watcher 事件之间不会错误关闭新的 revision gap。

### 2.3 Rule 与范围边界

- Rust 后端在 exact upsert 后执行现有规则分类；rule failure 不回滚 metadata，并使 root 进入后续 reconciliation。
- 规则路径不触发 AI、不覆盖 user correction。
- `custom_search_roots` 与 Global Index 不通过 File Library watcher 写入 managed `files`；Global Index 生产实现没有修改。
- 没有修改 dedupe、`files.id`、operation/cleanup journal、Safe Trash、restore 或 Query V2。

### 2.4 Renderer 迁移与 rollback

- 默认 backend capability 下，renderer 只 hydrate durable status、接受单调递增 revision 事件并刷新 File Library；不再调用 watcher stale/upsert/rule mutation RPC，也不依赖 renderer 存活完成对账。
- renderer 重启后通过 `listScanRoots` hydrate；旧 revision、重复 revision 和不符合当前 root 状态的事件被拒绝/忽略，gap 触发状态刷新。
- `ZEN_CANVAS_BACKEND_WATCHER_RECONCILIATION=false` 是显式 legacy fallback：旧 renderer owner 路径继续工作；默认值为 backend owner，任何时刻只启用一个 owner，不双写。
- Settings UI 显示 durable root health、active run、pending revision/gap 和错误状态；manual retry 仍由用户显式触发。

### 2.5 PR #23 最新人工验收阻塞项修订

本轮只修订 Task 01B 实现、测试与本 closeout；没有修改 Global Index、Managed AI、dedupe、`files.id`、operation/cleanup journal，也没有恢复 PR #21 或开始 Task 02。

1. **同 revision reconciliation retry**：scheduler 只把同一 root/revision 的 queued/running/cancelling 视为 active；已终态的 `failed`、`interrupted`、`requires_reconciliation`、`completed_with_warnings` 会使用 durable attempt key（`...:attempt:N`）重试，不再永久复用已失败的旧 request key。自动 retry 有 3 次上限与 2s/10s durable backoff；耗尽后留下 manual retry 所需的 attention 状态，人工 retry 使用新 key。
2. **目录 rename 两侧**：notify rename 一律保守标记 old/new 两侧为 reconciliation path；同 root、跨 root 和 move-out-of-root 均按各自 root 调度完整对账。exact mutation 不会假装删除目录后代，full reconciliation 会将旧目录后代标记 stale，避免旧 active rows 残留。
3. **legacy kill switch 隔离**：`ZEN_CANVAS_BACKEND_WATCHER_RECONCILIATION=false` 的 Rust watcher 只观察 enabled `default_scan_folders`；`custom_search_roots` 不再进入 legacy watcher path，因此不会通过 legacy renderer mutation RPC 写入 managed files。
4. **规则失败恢复**：exact upsert 后的规则执行采用 Rust bounded retry（3 次，250ms/500ms）；失败会 durable 标记 `watcher_rule_failure`。对账 scan 若发现该状态，会使用 `AllChangedOrRuleChanged` 在 effective root 上重新执行规则；永久耗尽使用 `watcher_rule_retry_exhausted`，人工 retry 仍进入规则恢复路径。未成功恢复时 full scan 只能以 `completed_with_warnings` 结束，保留 root error 和 `needs_reconciliation`，不会以“扫描完成”伪装修复；user correction 继续受保护。
5. **legacy adapter unmount**：adapter cleanup 现在返回给 hook，unmount 时清除 timer、retry queue 和 listener；每个 stale/upsert/classify mutation 前后均检查 disposed，保证 unmount 后不启动新的 mutation。
6. **watcher reload owner handoff**：`FileWatcherManager` 用 reload mutex 串行化 reload，先停止并 join 旧 session，再启动新 session，禁止旧/新 Rust mutation owner 重叠。handoff listening gap 在启动前 durable 标记 reconciliation；start failure 保持无 owner 并保留 gap，下一次 scheduler/人工 retry 负责恢复。

本轮新增/覆盖的针对性测试：

- `src-tauri/src/db/queries/scan.rs`：三类 terminal status 的同 revision retry、新 attempt key 的 restart/manual retry、跨 root 旧目录后代 full reconciliation、rule failure restart/preserve/recovery。
- `src-tauri/src/watcher.rs`：bounded retry transient/permanent failure、rename old/new path、custom search root legacy exclusion、owner handoff overlap、start failure with/without previous owner。
- `src-tauri/src/db/tests/part2.rs`：rule recovery scope 不覆盖 user correction。
- `tests/fsWatcher.test.ts`：legacy adapter unmount 前清理 timer/queue，unmount 后 mutation call 数为 0。

## 3. 验证结果

以下命令均已在 Windows 工作区执行并通过：

| 验证 | 结果 |
|---|---|
| `npm run verify:frontend` | 通过；typecheck、70 个前端测试/485 tests、remediation contract 13 tests、performance、production build 全部通过 |
| `npm run verify:rust` | 通过；fmt、443 passed/2 ignored unit tests、全部 integration tests、clippy `-D warnings` 通过 |
| `npm run verify:security` | 通过；npm audit 0 vulnerabilities；cargo audit exit 0，报告 15 个既有 allowed unmaintained/unsound warnings |
| `npm run test:performance` | 通过；SQLite/FTS 100k rows search p95 约 2.05 ms，managed-scan 100k observation benchmark 通过 |
| `npm run build` | 通过（同时由 `verify:frontend` 执行）；生成 `src-tauri/target/release/bundle/nsis/Zen Canvas_0.1.40_x64-setup.exe` |
| `git diff --check` | 通过 |
| `git status --short` | 提交前工作树干净；文档提交后再次确认 |

本轮人工验收阻塞项的定向验证已通过：

| 定向验证 | 结果 |
|---|---|
| `cargo check --manifest-path src-tauri/Cargo.toml --features desktop-runtime` | 通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime watcher::tests` | 21 passed |
| `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime db::queries::scan::tests::watcher` | 5 passed |
| `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime moved_directory_old_descendants_are_removed_only_by_full_reconciliation` | 通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime rule_recovery_scope_preserves_user_correction` | 通过 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings` | 通过 |
| `npm exec vitest run tests/fsWatcher.test.ts` | 17 passed |
| `npm run typecheck` | 通过 |
| `git diff --check` | 通过 |

新增/覆盖的重点测试包括 schema 27→28 fixture、watcher revision CAS、overflow once-per-burst、active scan revision race、backend 默认 owner、legacy kill switch、renderer restart/status hydration、旧 revision 忽略、watcher 不写 `scan_seen`/generation 以及 full scan applied-revision closure。

本地验证平台为 Windows；GitHub 双平台 CI 和 Draft PR checks 保留给推送后的 CI 运行及人工验收，不在本地声称 macOS 已验证。

## 4. 已知风险与后续边界

- legacy kill switch 仅为回滚/故障隔离手段，默认路径仍是 Rust backend owner；在人工验收前不应扩大 legacy 使用范围。
- notify、symlink/reparse、权限和 root unavailable 的平台差异仍需结合 GitHub Windows/macOS CI 结果确认；不确定状态按 full reconciliation fail-safe 处理。
- cargo audit 的 15 项警告来自当前既有依赖树，本 Task 未添加或升级依赖，也未改变 lockfile。
- 本文档只记录 Task 01B 的实施交付。人工验收通过并合并前，Task 02 仍禁止创建、设计或实施。
