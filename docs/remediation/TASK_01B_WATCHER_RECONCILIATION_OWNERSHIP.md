# Task 01B — Watcher Reconciliation Ownership

## 1. 任务状态

- 状态：**任务书已由人工编写；本任务书所在 PR 合并到 `master` 后可执行**
- 类型：生产实施任务
- 前置：Task 01A 已验收并合并
- 建议实施分支：`remediation/01b-watcher-reconciliation-ownership`
- 建议 Draft PR：`feat: move File Library watcher reconciliation to Rust`
- 后续阶段：Task 02 及以后继续禁止执行

本任务书是 Task 01B 的唯一实施合同。Codex 只负责实现、测试和提交，不负责重新设计、改写任务书或调整阶段顺序。

---

## 2. 基线与启动门禁

开始前必须确认：

1. 当前分支为最新 `master`；
2. 工作树干净；
3. Task 01A 的 scan ledger、root lease、session/run/generation、`scan_seen` 和 stale safety 已存在；
4. 数据库当前 schema 为 27；
5. `docs/remediation/TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md` 已存在于 `master`；
6. PR #21 未合并；其 `dedupe_runs` schema 28 不属于当前基线；
7. 没有其他分支同时修改 watcher ownership 或占用 schema 28。

执行：

```bash
git checkout master
git pull --ff-only
git status --short
git rev-parse HEAD
git merge-base --is-ancestor a2c0516dc7a8628cb7210003da3d66f5d84f3a2f HEAD
```

随后记录完整基线：

```bash
npm run verify:frontend
npm run verify:rust
npm run verify:security
```

任一启动条件不满足时停止并汇报，不得自行重新排序 Task 02 或复用 PR #21 的 schema 28。

---

## 3. 当前实现事实

当前 File Library watcher 分成两段：

```text
notify callback / bounded Rust channel
        ↓
150ms coalesce
        ↓
Rust emit `fs-event`
        ↓
React `useFsWatcher`
        ↓
renderer 内存 `WatcherRetryQueue`
        ↓
markFilesStaleByPaths / upsertFilesByPaths / executeRulesForPaths
        ↓
refresh File Library
```

关键事实：

- `src-tauri/src/watcher.rs`
  - 使用 `notify::recommended_watcher`；
  - callback 通过容量 2048 的 `sync_channel` 和 `try_send` 避免阻塞；
  - 150ms 合并窗口；
  - overflow 目前只发出 “需要重新扫描” 的错误提示；
  - Rust 只发事件，不拥有 `files` 最终更新。
- `src/hooks/fsWatcherQueue.ts`
  - renderer 内存队列；
  - generation 覆盖、最多 8 次重试、指数退避；
  -应用退出、renderer 崩溃或 hook 卸载后队列消失。
- `src/hooks/useFsWatcher.ts`
  - renderer 依次调用 stale、upsert 和规则执行 RPC；
  - renderer 是 watcher 数据库更新的事实 owner；
  -永久失败只存在于当前 React 生命周期。
- `src-tauri/src/main.rs`
  -启动时建立 watcher，但没有恢复 watcher 未完成更新；
  -已经先执行 Task 01A 的 `recover_scan_state`。
- Task 01A 已提供：
  - `scan_roots.health_status`；
  - `scan_roots.needs_reconciliation`；
  - root lease、active run、generation、durable revision；
  - managed scan session/run；
  -崩溃恢复和安全 stale reconciliation。

当前缺陷不是 Rust 捕获事件本身，而是：

> renderer 仍承担最终一致性；事件处理没有跨崩溃水位；overflow、永久失败和应用退出无法可靠收敛到 Task 01A 的 root health 与 managed scan 对账。

---

## 4. 本阶段目标

Task 01B 必须完成：

1. 将 File Library watcher 的数据库更新 owner 从 React 移到 Rust/Tauri 后端；
2. renderer 只负责显示状态和刷新投影，不再调用 watcher mutation RPC；
3. 为每个 File Library scan root 建立 durable watcher revision 水位；
4. 在处理事件前先持久化 dirty revision，处理成功后再推进 applied revision；
5. crash、queue overflow、ambiguous directory event、永久处理失败和 revision gap 自动收敛为 managed scan reconciliation；
6. watcher 不写 `scan_seen`，不推进 scanner generation，不伪造完整扫描证据；
7. watcher 事件发生在 active scan 期间时，阻止该 run 依据过期 discovery 执行错误 stale；
8.启动时自动发现 watcher revision gap，并安全调度正常 managed scan；
9.保留旧命令和旧事件的有限兼容，但运行时只能有一个 mutation owner；
10.不触碰 Global Index、Managed AI、dedupe、operation journal、Safe Trash 或 `files.id`。

---

## 5. 非目标与绝对禁止

本阶段禁止：

- 建立通用 Job Runtime；
- 泛化 `ai_jobs`；
- 修改 `src-tauri/src/global_index/` 的 provider、MFT/USN、Spotlight/FSEvents 或 service；
- 把 Global Index event 写入 File Library scan generation；
- 持久化逐条原始 notify event；
- 新建 `pending_fs_changes` 通用事件日志；
- 修改 `files.id`；
- 修改 dedupe 算法、prehash、duplicate group 或 durable dedupe run；
- 合入或 cherry-pick PR #21 的 schema 28；
- 修改 operation/cleanup journal、Safe Trash、restore；
- 实现 Query V2、Organization Plan、Content Artifact、自然语言规则或 Spotlight 重构；
- 新增第三方依赖；
-自动扫描 unmanaged scope；
-让 watcher 的局部观察冒充完整 scan generation；
-同时启用 renderer 与 Rust 两套 mutation owner；
-发布版本、tag 或安装包。

---

## 6. 冻结架构决定

### 6.1 唯一事实 owner

- notify callback：仅捕获 OS event；
- Rust watcher coordinator：事件规范化、dirty revision、重试、局部更新、分类触发和 reconciliation 调度的唯一 owner；
- SQLite：root watcher 水位和 reconciliation 需求的持久事实；
- managed scanner：完整 discovery、`scan_seen`、missing reconciliation 和 generation 的唯一 owner；
- renderer：状态投影、用户提示和刷新，不拥有持久事实。

### 6.2 不持久化原始事件

本阶段不保存逐路径 raw event。持久语义是：

```text
watcher_revision > watcher_applied_revision
    = 至少一个事件批次未被确认处理
    = 启动后必须执行 full managed reconciliation
```

这提供 crash safety，同时避免无界 raw event 日志和复杂的跨平台事件重放。

### 6.3 局部更新只是优化

文件级 create/modify/delete/rename 可以由 Rust 后端立即观察磁盘并更新 `files`，但它不是最终一致性的唯一保证。

以下情况必须升级为 root 级 managed scan：

- bounded channel overflow；
- notify provider error；
- directory create/remove/rename；
-路径无法明确映射到一个 enabled File Library root；
-重试耗尽；
-应用崩溃后存在 revision gap；
- active scan 期间发生 watcher event；
-文件类型、symlink/reparse 或权限状态无法安全判断；
-批量事件超过安全阈值。

### 6.4 File Library 与 Search Root 边界

Task 01B 的后端 reconciliation 只拥有 enabled `default_scan_folders` / `scan_roots(source_kind='file_library')`。

`custom_search_roots` 和 Global Index source 不得通过本 watcher 写入 managed `files`。若旧 watcher 仍为兼容目的监听 search roots，必须在路由层明确标记为 non-managed，并禁止 mutation。

### 6.5 Task 01A generation 不变量

Watcher：

- 不写 `scan_seen`；
-不增加 `scan_roots.current_generation`；
-不更新 `last_successful_generation`；
-不将 watcher event 记为 scanner 已见；
-不自行执行 missing reconciliation。

---

## 7. Schema 28

PR #21 未合并，因此 Task 01B 正式占用 schema 28。

必须使用 additive migration，不重建现有大表。

建议冻结 SQL：

```sql
ALTER TABLE scan_roots
    ADD COLUMN watcher_revision INTEGER NOT NULL DEFAULT 0
    CHECK (watcher_revision >= 0);

ALTER TABLE scan_roots
    ADD COLUMN watcher_applied_revision INTEGER NOT NULL DEFAULT 0
    CHECK (watcher_applied_revision >= 0);

ALTER TABLE scan_roots
    ADD COLUMN watcher_last_event_at INTEGER;

ALTER TABLE scan_roots
    ADD COLUMN watcher_last_applied_at INTEGER;

ALTER TABLE scan_roots
    ADD COLUMN watcher_last_error_code TEXT;

ALTER TABLE scan_roots
    ADD COLUMN watcher_last_error_message TEXT;

ALTER TABLE scan_runs
    ADD COLUMN watcher_revision_at_start INTEGER NOT NULL DEFAULT 0
    CHECK (watcher_revision_at_start >= 0);

CREATE INDEX IF NOT EXISTS idx_scan_roots_reconciliation_enabled
    ON scan_roots(enabled, needs_reconciliation, updated_at);
```

约束：

- `watcher_applied_revision <= watcher_revision` 必须由 repository CAS 保证；
-不能通过迁移伪造 watcher 历史；
- schema 27 数据迁移后 revision 均为 0；
-旧 scan/session/run、operation journal、AI jobs、Global Index 和用户规则必须完整保留；
- schema 28 的旧 binary rollback 规则与 Task 01A 相同：旧 schema-27 binary 必须继续拒绝 future schema；回退只能使用 schema-28-capable build 关闭新 owner。

如实现发现 SQLite 版本不支持上述直接 `ALTER TABLE ADD COLUMN ... CHECK`，允许使用语义等价的 additive 迁移，但不得重建 `files` 或 journal 表。

---

## 8. Durable watcher revision 协议

### 8.1 事件批次开始

对一个 coalesced batch，在任何 `files` mutation 前：

1. 将路径映射到唯一 enabled File Library root；
2. 在短事务中执行：

```sql
UPDATE scan_roots
SET watcher_revision = watcher_revision + 1,
    watcher_last_event_at = :now,
    watcher_last_error_code = NULL,
    watcher_last_error_message = NULL,
    revision = revision + 1,
    updated_at = :now
WHERE id = :root_id AND enabled = 1
RETURNING watcher_revision, active_run_id, revision;
```

3. 返回的 `watcher_revision` 是该批次 durable token；
4.如果在此后崩溃，启动恢复可通过 revision gap 发现未完成事实。

### 8.2 成功确认

只有该批次所有必须完成的 exact mutation 已成功时，才允许：

```sql
UPDATE scan_roots
SET watcher_applied_revision = :batch_revision,
    watcher_last_applied_at = :now,
    revision = revision + 1,
    updated_at = :now
WHERE id = :root_id
  AND watcher_applied_revision < :batch_revision
  AND watcher_revision >= :batch_revision;
```

不得把 applied revision 推进到未处理的更新 revision。

### 8.3 不确定或失败

出现 ambiguity、overflow、永久失败或 active scan 竞争时：

- 不推进对应 batch 的 applied revision；
-设置 `needs_reconciliation = 1`；
-设置 `health_status = 'reconciliation_required'`，除非现有状态是更具体的 `missing` 或 `permission_required`；
-记录 watcher error code/message；
-由 reconciliation scheduler 调度 normal managed scan。

### 8.4 并发与 CAS

- 同 root 批次必须有序提交；
-不同 root 可有限并行；
-旧 batch 不得覆盖较新 applied revision；
-root disabled、删除、active lease 变化或 revision CAS 失败时重新读取状态；
-不允许 renderer 提交 watcher revision。

---

## 9. Watcher coordinator

建议将 `watcher.rs` 拆分或内部模块化为：

```text
watcher/
├── mod.rs
├── capture.rs
├── routing.rs
├── coordinator.rs
├── processor.rs
├── reconciliation.rs
├── progress.rs
└── tests.rs
```

不强制物理拆文件，但职责必须分离：

- Capture：notify callback、有界 channel、overflow signal；
- Routing：规范化路径、root mapping、ignore/protected policy；
- Coordinator：per-root 顺序、有限并行、取消/关闭；
- Processor：磁盘重新观察、exact upsert/stale、规则执行；
- Reconciliation：mark root dirty、admit managed scan、startup resume；
- Progress：向 renderer 投影状态。

### 9.1 队列

-继续使用 bounded queue；
-不得在 notify callback 中访问 SQLite 或执行文件 IO；
- callback full 时必须发送 durable overflow control signal，而不只是 UI 文案；
-同一路径保留最新 action；
- stale 与 upsert 冲突以磁盘重新观察结果为准，而不是只信任 event kind；
-每批上限建议继续 500；
-重试语义可沿用现有 8 次与 bounded backoff，但实现在 Rust。

### 9.2 exact 文件处理

对单文件 path：

1. 再次校验 path 位于唯一 enabled File Library root；
2.使用统一 ignore/protected contract；
3.调用 `symlink_metadata` 或平台安全等价物；
4.存在则 upsert metadata；
5.不存在则 exact stale；
6.在 mutation 后触发 backend effective rule evaluation；
7.规则失败不回滚 metadata，但必须记录 warning；
8.成功后推进 applied revision。

### 9.3 目录事件

目录 create/remove/rename 不执行不受限的递归 watcher upsert。

处理：

-允许更新目录自身的 row；
-将 root 标记为需要 reconciliation；
-调度 full managed scan；
-不得在 watcher worker 中递归扫描任意大型目录；
-不得绕过 Task 01A root lease。

### 9.4 rename

-如果 old/new 均在同一 managed root：磁盘观察后 exact stale old + upsert new，随后按目录/文件规则决定是否需要 full reconciliation；
-跨 root rename：两个 root 分别获得 revision；old root stale、new root upsert；任何一侧不确定则两侧均 reconciliation；
-移入/移出 managed scope 必须严格映射，不得更新 Global Index domain。

---

## 10. Active scan 协调

Task 01B 必须修改 Task 01A 的 claim/finalize contract：

### 10.1 claim

scan run 从 queued 进入 running 时，将当前 root `watcher_revision` 写入：

```text
scan_runs.watcher_revision_at_start
```

### 10.2 扫描期间事件

若 watcher event 发生在 root 存在 active run 时：

-可以做安全 exact update；
-但必须保留 watcher revision；
-当前 scan run 不得据此写 `scan_seen`；
-当前 run 在 finalization 前必须比较 watcher revision。

### 10.3 stale gate

只有以下条件全部成立，run 才允许 missing/stale reconciliation：

```text
coverage_complete = true
AND stale_reconciliation_allowed = true
AND lease/generation ownership 仍有效
AND current_root.watcher_revision = run.watcher_revision_at_start
```

若 watcher revision 已变化：

-跳过本轮 missing reconciliation；
-run 可完成为 `completed_with_warnings` 或任务书现有等价终态；
-root 设置 `needs_reconciliation = 1`；
-root health 为 `reconciliation_required`；
-调度后续 managed scan；
-不得推进错误的 stale 事实。

### 10.4 follow-up scan 去重

-使用 Task 01A root active lease 阻止并行 full scan；
-同 root 只允许一个 pending/running reconciliation intent；
-request key 必须 deterministic，例如 `watcher-reconcile:<root-id>:<watcher-revision>`；
-相同 revision 幂等返回已有 session；
-较新 revision 在现有 run 完成后再调度；
-dedupe 默认 `false`，避免每次 watcher 对账都触发全量查重。

---

## 11. Startup 与 overflow recovery

启动顺序必须调整为：

```text
open database
→ recover Task 01A scan state
→ recover watcher revision gaps / reconciliation roots
→ setup watcher manager
→ schedule eligible managed reconciliations
→ renderer hydrate
```

### 11.1 启动判定

以下任一成立即需要 reconciliation：

- `watcher_revision > watcher_applied_revision`；
- `needs_reconciliation = 1` 且 root enabled；
- watcher error 记录表示 overflow/permanent failure；
- active run 已被 Task 01A 恢复为 interrupted，且 watcher revision 在该 run 开始后变化。

### 11.2 调度限制

- root 不存在：health `missing`，不循环重试；
-权限不足：health `permission_required`；
-root disabled：不自动调度，保留事实；
-active run 存在：等待，不抢 lease；
-成功 full scan 后只有在 watcher revision 未继续变化时才允许清除 reconciliation 状态；
-启动恢复失败是 non-fatal，但必须持久错误并向 UI 投影。

### 11.3 overflow

bounded channel overflow 时：

-标记当前 File Library managed roots；
-每个 root increment/dirty 或以等价 durable gap 表达；
-设置 reconciliation_required；
-调度 managed scan；
-旧 `fs-watcher-error` 可继续用于 UI，但不能是唯一动作。

---

## 12. Rule classification

当前 React watcher 在 upsert 后执行 `executeRulesForPaths`。Task 01B 必须保留功能，但 owner 移到后端。

要求：

-抽取 backend internal rule application entry；
-从 SQLite/settings 加载当前 effective rules，不接收 renderer 提交的 Rule[] 作为权威；
-只对成功 upsert 的 managed file 执行；
-规则执行失败记录 warning，不把 metadata upsert 回滚；
-不触发 AI；
-不改变用户 correction 优先级；
-不建立新的规则引擎。

---

## 13. API 与事件契约

### 13.1 新 DTO

建议：

```ts
interface WatcherRootStatusDto {
  scanRootId: string;
  path: string;
  watcherRevision: number;
  watcherAppliedRevision: number;
  pending: boolean;
  needsReconciliation: boolean;
  healthStatus: string;
  activeRunId: string | null;
  lastEventAt: number | null;
  lastAppliedAt: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  rootRevision: number;
}
```

### 13.2 命令

允许新增：

- `list_watcher_root_statuses`
- `retry_watcher_reconciliation`
- `get_watcher_runtime_status`

也可以扩展现有 `list_scan_roots/get_scan_root_health` 返回 watcher 字段，避免重复查询。必须选择一个单一接口，不允许长期双轨。

### 13.3 事件

新增统一事件，例如：

```text
watcher-reconciliation-status
```

payload 至少包含：

- root ID；
-root revision；
-watcher/applied revision；
-status；
-pending count 或 batch summary；
-active reconciliation run；
-error；
-timestamp。

renderer 必须以 root revision 为水位，旧事件不能回退状态；revision gap 时 refetch。

### 13.4 Legacy 兼容

暂时保留：

- `fs-event`；
- `fs-watcher-ready`；
- `fs-watcher-error`；
- `mark_files_stale_by_paths`；
- `upsert_files_by_paths`；
- `execute_rules_for_paths`。

但默认路径下 `useFsWatcher` 不得再调用 mutation command。

---

## 14. 前端迁移

### 14.1 `useFsWatcher`

改为：

-监听 watcher status/error；
-触发 File Library projection refresh；
-显示“正在同步”“需要校准”“权限不足”等状态；
-不维护 retry queue；
-不提交 stale/upsert/classify mutations。

### 14.2 `WatcherRetryQueue`

-生产路径移除；
-若 legacy fallback 仍需要，可放在明确的 legacy adapter；
-不得让 default backend owner 与 legacy queue 同时运行；
-兼容期结束后删除。

### 14.3 UI

至少展示：

```text
已同步
正在同步变化
正在校准索引
位置不可用
需要权限
同步失败，可重试
```

状态来源必须是后端 durable root snapshot，不是 renderer 自己推断。

---

## 15. Rollout 与 rollback

新增 schema 28 后，旧 schema-27 binary 无法直接回滚。

必须在 schema-28-capable build 内提供临时 kill switch：

```text
ZEN_CANVAS_BACKEND_WATCHER_RECONCILIATION
```

默认：`true`。

语义：

- `true`：Rust 是唯一 mutation owner；renderer 仅投影；
- `false`：启用明确的 legacy renderer adapter，Rust 不进行 `files` mutation，也不推进 watcher revision；
-运行时能力通过 `runtime_capabilities` 或等价接口暴露给前端；
-禁止两边同时写；
-关闭开关必须记录诊断日志；
-该开关只用于紧急回退，不是长期产品设置。

删除开关的前提：

- Windows/macOS watcher 回归稳定；
-至少一个发布周期无 owner/overflow/revision 事故；
-Task 01B closeout 明确列为后续清理项。

---

## 16. 允许修改范围

允许：

```text
src-tauri/src/watcher.rs 或新的 watcher/ 子模块
src-tauri/src/scanner.rs
src-tauri/src/db/schema.rs
src-tauri/src/db/queries/scan.rs
src-tauri/src/db/queries/files.rs（仅 watcher exact mutation 所需）
src-tauri/src/settings.rs（仅 watcher root 路由）
src-tauri/src/main.rs
src-tauri/src/runtime_capabilities.rs
src-tauri/build.rs
src/api/tauriApi.ts
src/api/browserMockApi.ts
src/hooks/useFsWatcher.ts
src/hooks/fsWatcherQueue.ts
相关 scan/watcher store、UI、i18n、权限矩阵与测试
docs/remediation/
```

禁止：

```text
src-tauri/src/global_index/
src-tauri/src/dedupe.rs
Managed AI worker/provider/schema
file_ops 与 operation journal
storage_analyzer cleanup journal / Safe Trash / restore
files.id migration
Query V2 / Organization Plan / Content Artifact / Spotlight redesign
package dependencies 和 lockfile
installer / release / version
```

如必须越过禁止范围，停止并汇报。

---

## 17. 实施提交顺序

在一个 Draft PR 中按原子提交推进：

1. `db: add watcher reconciliation watermarks`
2. `watcher: add Rust-owned event processor`
3. `watcher: coordinate active scans and reconciliation`
4. `watcher: recover overflow and revision gaps on startup`
5. `rules: apply effective rules from backend watcher`
6. `api: expose durable watcher status`
7. `ui: project backend watcher reconciliation`
8. `test: cover watcher ownership crash and overflow safety`
9. `docs: close Task 01B implementation`

不得夹带 Task 02。

---

## 18. 测试计划

### 18.1 Migration

-空数据库 → schema 28；
-schema 27 fixture → 28；
-原有 scan ledger、files、rules、AI jobs、global index、operation/cleanup journal 全保留；
-watcher revision 默认 0；
-schema 28 幂等 reopen；
-确定性失败注入后回滚仍为 27，且不留半列/半索引；
-future schema 29 拒绝；
-100k files fixture 迁移锁时长和磁盘增长。

### 18.2 Rust watcher

-单文件 create；
-modify；
-delete；
-rename；
-跨 managed root rename；
-目录 create/remove/rename 升级 full reconciliation；
-ignore/generated/protected 路径；
-symlink/reparse；
-per-root ordering；
-different-root limited parallelism；
-queue overflow；
-notify error；
-retry exhaustion；
-root missing；
-permission denied；
-disabled root；
-custom search root 不写 managed files；
-callback 不执行 DB/IO；
-newer action 覆盖 older action；
-disk re-observation 覆盖 event kind。

### 18.3 Crash windows

- increment watcher revision 前崩溃：无 durable fact；
-increment 后 mutation 前崩溃：revision gap，启动调度 scan；
-mutation 后 applied 前崩溃：安全重复 full scan；
-applied 后 event emit 前崩溃：snapshot 可恢复；
-overflow 标记后调度前崩溃：启动恢复；
-reconciliation scan 运行中崩溃：Task 01A interrupted 语义保持。

### 18.4 Active scan race

- watcher event 在 run claim 前；
-discovery 中；
-batch commit 后；
-reconciling_missing 前；
-reconciling_missing 期间；
-finalizing 期间；
-断言 watcher revision 变化时当前 run 不执行错误 stale；
-后续 scan 去重；
-持续变化不产生并行 root run。

### 18.5 Frontend

-默认 backend owner 时 mutation RPC 调用数为 0；
-legacy kill switch 时只有 legacy owner；
-renderer unmount 不影响处理；
-renderer restart hydrate；
-root revision old/duplicate/gap；
-status 文案；
-manual retry；
-background/foreground window；
-File Library 刷新不循环。

### 18.6 Rules

-upsert 后规则执行；
-renderer 未运行时仍执行；
-rule failure 不回滚 metadata；
-user correction 不被覆盖；
-AI 不被触发。

### 18.7 Performance

-10k coalesced file events；
-500 batch transaction；
-WAL reader latency；
-overflow 标记 100 roots；
-startup gap query；
-rapid rename storm；
-CPU/内存有界；
-不让 File Library 查询 P95 显著退化。

---

## 19. 验收标准

Task 01B 通过必须满足：

1. 默认模式下 renderer 不再执行 watcher stale/upsert/rule mutation；
2. renderer 关闭、崩溃或切换页面不影响 watcher 数据库处理；
3.事件处理前存在 durable root revision；
4.任意 crash gap 在下次启动自动转为 managed scan reconciliation；
5.overflow 不再只提示用户，而是持久标记并调度对账；
6.watcher 永不写 `scan_seen` 或推进 generation；
7.active scan 期间发生事件时不会错误 stale；
8.同 root 不出现并行 full reconciliation；
9.custom search roots/Global Index 不被写入 managed `files`；
10.后端规则执行保留当前功能且不触发 AI；
11.默认和 legacy rollback 路径均有测试，且不会双写；
12.schema 27→28 安全迁移和失败回滚通过；
13.Global Index、Managed AI、dedupe、journals、Safe Trash、restore 无行为或 schema 回归；
14.Windows/macOS CI、打包、性能和安全门禁通过；
15.Task 02 仍未开始。

---

## 20. 停止条件

实施中出现以下任一情况必须停止：

-需要修改 Global Index provider；
-需要让 watcher 写 `scan_seen` 或 generation；
-需要建立通用 raw event table；
-需要修改 `files.id`；
-需要泛化 AI queue；
-需要修改 dedupe；
-需要修改 operation/cleanup journal；
-无法保证单一 mutation owner；
-无法安全处理 active scan race；
-schema 27 无法无损升级；
-需要新依赖；
-需要扩大为 Task 02 或 Query V2。

停止时只汇报事实，不自行改任务书。

---

## 21. 完成验证

至少运行：

```bash
npm run verify:frontend
npm run verify:rust
npm run verify:security
npm run test:performance
npm run build
git diff --check
git status --short
```

并保留 GitHub 双平台 CI 和打包结果。

---

## 22. Closeout 与交付

新增：

```text
docs/remediation/TASK_01B_IMPLEMENTATION_CLOSEOUT.md
```

更新：

```text
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
```

Closeout 必须记录：

-基线与最终 HEAD；
-schema 28；
-owner 迁移；
-watcher revision 协议；
-active scan race；
-overflow/startup recovery；
-rule execution；
-legacy rollback；
-测试与性能；
-已知风险；
-Task 02 仍未开始。

完成后创建 Draft PR并停止，等待人工验收。