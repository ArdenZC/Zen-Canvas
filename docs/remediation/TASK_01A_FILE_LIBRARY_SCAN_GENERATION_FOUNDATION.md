# Task 01A — File Library Scan Generation Foundation

## 1. 状态与实施授权

- 状态：**已完成人工验收；PR #17 合并后可执行。**
- 类型：File Library Managed Scan 的生产实施任务。
- 目标实施分支：`remediation/01a-scan-generation-foundation`
- 文档基线：PR #15、PR #16 和 PR #17 已进入 `master` 后的实际最新提交。
- 当前数据库基线：schema 26。
- 目标数据库版本：schema 27。

Codex 开始实施前必须确认：

```bash
git checkout master
git pull --ff-only
git status --short
git rev-parse HEAD
git merge-base --is-ancestor a2c0516dc7a8628cb7210003da3d66f5d84f3a2f HEAD
```

并确认以下文件已存在于 `master`：

```text
docs/remediation/POST_MERGE_BASELINE_AUDIT.md
docs/remediation/REMEDIATION_CAPABILITY_MATRIX.md
docs/remediation/REMEDIATION_RISK_REGISTER.md
docs/remediation/TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md
```

如果工作树不干净、PR #17 未合并、schema 不再是 26，或扫描相关代码已发生大规模变化，停止并汇报，不自行重写任务书。

---

## 2. 本阶段目标

Task 01A 只建设 **File Library Managed Scan** 的持久运行基础：

1. 后端拥有持久的 scan root、session、run 和 generation；
2. 同一 root 同时最多一个 active run；
3. scanner 独占本轮已见事实 `scan_seen`；
4. cancelled、failed、interrupted 或 coverage 不完整的 run 永不执行 missing/stale reconciliation；
5. 应用重启后能识别中断任务和 root 健康状态；
6. 多 root 请求由持久 session 聚合，不再由 renderer 拼接成功事实；
7. run/session 状态通过 durable revision 投影到前端；
8. 保留旧扫描 command/event 的兼容入口；
9. dedupe 仍是扫描完成后的只读下游任务，不拥有扫描完成事实。

Task 01A 不尝试实现目录遍历断点续扫。中断后重新创建新 generation 并完整扫描，以牺牲少量重复工作换取 stale 安全。

---

## 3. 冻结边界

### 3.1 禁止建立通用 Job Runtime

不得：

- 把 `ai_jobs`、`ai_job_items` 或 `ai_analysis_state` 改造成通用任务表；
- 让 scan、dedupe、cleanup、operation 共用 Managed AI worker；
- 新建跨领域万能 `jobs/job_events/job_failures`；
- 修改 Managed AI 的 scope、provider policy、fingerprint、backpressure 或 user correction。

### 3.2 不修改 Global Index

不得修改：

```text
src-tauri/src/global_index/
global_volumes
global_entries
global_entries_fts
Windows MFT/USN/service
macOS Spotlight/FSEvents
```

Global Index 的 journal cursor、provider checkpoint 和 native identity 不是 File Library scan generation。

### 3.3 不进入 Task 01B

本阶段不得：

- 持久化 raw watcher event；
- 新建 `pending_fs_changes`；
- 将 watcher 最终一致性 owner 从 renderer 移入 Rust；
- 实现 overflow replay。

Watcher 可以继续并发更新 `files`，但不得写 `scan_seen`。

### 3.4 不修改文件操作与身份主键

不得修改：

- `files.id` 的 path-id 语义；
- operation journal、cleanup journal、Safe Trash、restore；
- `file_ops` 的预览、身份验证和恢复链；
- dedupe 算法、fingerprint、duplicate group；
- Organization Plan、Query V2、Content Artifact。

---

## 4. 当前问题与唯一事实 owner

当前扫描任务、取消标记、多 root 聚合、后台队列和 watcher retry 主要存在于内存或 renderer。批量写入过的 `files` 行无法说明来自哪一次扫描，也无法证明扫描是否完成；`last_seen_at` 还会被 watcher 和 restore 更新，因此不能代表“本轮 scanner 已见”。

完成 Task 01A 后的唯一 owner：

| 事实 | 唯一 owner |
|---|---|
| scan root、generation、health、active lease | SQLite scan repository |
| session/run 状态、阶段、取消、revision | Tauri/Rust scan backend + SQLite |
| scanner 本轮已见文件 | `scan_seen`，只允许 scanner 写 |
| missing/stale reconciliation | coverage 完整且仍拥有 root lease 的 run |
| renderer 展示 | durable state 的 projection，不是事实 owner |
| dedupe | 既有 `DedupeJobManager`，只作为下游计算 |

---

## 5. Schema 27

Task 01A 实施时将主数据库从 schema 26 迁移到 schema 27。不得重建或 ALTER `files` 大表。

### 5.1 `scan_roots`

```sql
CREATE TABLE scan_roots (
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

CREATE INDEX idx_scan_roots_enabled_health
    ON scan_roots(enabled, health_status, updated_at DESC);
CREATE INDEX idx_scan_roots_active_lease
    ON scan_roots(active_run_id, active_generation);
```

`active_run_id + active_generation + revision` 是 root lease 账本。由于建表顺序会形成循环引用，`active_run_id` 第一版不声明外键，完整性由 repository 的同事务 CAS、`scan_runs` partial unique index 和测试保证。

### 5.2 `scan_sessions`

Session 使用独立的聚合 phase，不复用单 root discovery phase：

```text
preparing -> running -> finalizing -> completed
```

```sql
CREATE TABLE scan_sessions (
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
        CHECK (phase IN ('preparing', 'running', 'finalizing', 'completed')),
    cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
    requested_root_count INTEGER NOT NULL DEFAULT 0,
    effective_root_count INTEGER NOT NULL DEFAULT 0,
    completed_root_count INTEGER NOT NULL DEFAULT 0,
    failed_root_count INTEGER NOT NULL DEFAULT 0,
    cancelled_root_count INTEGER NOT NULL DEFAULT 0,
    covered_root_count INTEGER NOT NULL DEFAULT 0,
    unstarted_root_count INTEGER NOT NULL DEFAULT 0,
    dedupe_requested INTEGER NOT NULL DEFAULT 0 CHECK (dedupe_requested IN (0, 1)),
    dedupe_dispatch_state TEXT NOT NULL DEFAULT 'not_requested'
        CHECK (dedupe_dispatch_state IN (
            'not_requested', 'pending', 'dispatching',
            'dispatched', 'unknown', 'failed', 'suppressed'
        )),
    dedupe_attempt_count INTEGER NOT NULL DEFAULT 0,
    dedupe_job_id TEXT,
    dedupe_last_error TEXT,
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

CREATE INDEX idx_scan_sessions_status_created
    ON scan_sessions(status, created_at DESC);
```

`dedupe_dispatch_state` 只记录 scan domain 的调度意图和观察结果，不把 `DedupeJobManager` 伪装成持久队列。

### 5.3 `scan_runs`

```sql
CREATE TABLE scan_runs (
    id TEXT PRIMARY KEY,
    scan_root_id TEXT NOT NULL REFERENCES scan_roots(id) ON DELETE RESTRICT,
    generation INTEGER NOT NULL CHECK (generation >= 1),
    parent_session_id TEXT REFERENCES scan_sessions(id) ON DELETE SET NULL,
    lease_token TEXT NOT NULL UNIQUE,
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

CREATE UNIQUE INDEX idx_scan_runs_one_active_per_root
    ON scan_runs(scan_root_id)
    WHERE status IN ('queued', 'running', 'cancelling');
CREATE INDEX idx_scan_runs_root_created
    ON scan_runs(scan_root_id, created_at DESC);
CREATE INDEX idx_scan_runs_session_status
    ON scan_runs(parent_session_id, status, created_at DESC);
```

同一 root 的 active 集合严格是 `queued/running/cancelling`。`failed/cancelled/interrupted/requires_reconciliation` 不再持有 lease。

### 5.4 `scan_session_roots`

每个用户请求的 root 都必须保留一行，即使重复、被祖先 root 吸收、无效或在开始前取消。

```sql
CREATE TABLE scan_session_roots (
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

CREATE INDEX idx_scan_session_roots_effective
    ON scan_session_roots(session_id, effective_index, effective_root_id);
CREATE INDEX idx_scan_session_roots_run
    ON scan_session_roots(run_id, status);
```

### 5.5 `scan_seen`

```sql
CREATE TABLE scan_seen (
    run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
    file_id TEXT NOT NULL,
    observed_path TEXT NOT NULL,
    observed_at INTEGER NOT NULL,
    PRIMARY KEY(run_id, file_id)
);

CREATE INDEX idx_scan_seen_run_path
    ON scan_seen(run_id, observed_path);
```

第一版不为 `file_id` 声明到 `files(id)` 的外键，因为 path-id 会随 operation/restore 路径变化。`observed_path` 保留扫描当时事实。

### 5.6 `scan_run_errors`

```sql
CREATE TABLE scan_run_errors (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
    path TEXT,
    error_code TEXT NOT NULL,
    error_message TEXT,
    affects_coverage INTEGER NOT NULL DEFAULT 1
        CHECK (affects_coverage IN (0, 1)),
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_scan_run_errors_run_created
    ON scan_run_errors(run_id, created_at);
```

---

## 6. 运行状态机

### 6.1 Run status

```text
queued
running
cancelling
cancelled
completed
completed_with_warnings
failed
interrupted
requires_reconciliation
```

合法转移：

| 当前状态 | 可进入 |
|---|---|
| queued | running、cancelled、interrupted |
| running | cancelling、completed、completed_with_warnings、failed、interrupted、requires_reconciliation |
| cancelling | cancelled、failed、interrupted、requires_reconciliation |
| 所有 terminal 状态 | 不再转移；重试必须创建新 generation |

### 6.2 Run phase

```text
preparing
-> discovering
-> persisting
-> reconciling_missing
-> optimizing_search
-> finalizing
-> completed
```

### 6.3 Session 状态与阶段

Session phase 是聚合阶段，不跟随每个 root 倒退：

```text
preparing -> running -> finalizing -> completed
```

当前 active root 的详细 phase 通过 run DTO 单独展示，不写入 session phase。

Session terminal status 由所有 `scan_session_roots` 聚合，固定优先级：

```text
requires_reconciliation / interrupted
> failed / invalid
> cancelled / cancelled_not_started
> completed_with_warnings
> completed
```

只有所有 requested mapping 都是 terminal 或 covered，session 才能进入 terminal。

---

## 7. 核心安全不变量

1. 每个 root 的 generation 单调递增；分配 generation 不代表成功。
2. 同一 root 同时最多一个 active run。
3. 重复 start：相同 non-null `request_key + canonical_request_hash` 返回已有 session；其他 active 冲突拒绝整个 canonical request，不分配任何 generation。
4. run、root、session 所有状态写入使用 expected revision CAS，并检查 affected-row。
5. 旧 worker 在 lease、generation、revision 或 active pointer 不匹配时不得写 `files`、`scan_seen`、stale、health 或 terminal success。
6. `scan_seen` 只允许 scanner 在成功 metadata upsert 的同一 transaction 中写入。
7. watcher、restore、AI、renderer 不得写 `scan_seen`。
8. metadata 读取失败不写 `scan_seen`；写 `scan_run_errors`，设置 coverage incomplete，整个 run 禁止 stale，终态为 `requires_reconciliation`。
9. cancelled、failed、interrupted、requires_reconciliation 不推进 `last_successful_generation` 或 `last_full_scan_at`。
10. missing/stale transaction 只允许 coverage 完整、cancel 未请求、仍拥有 root lease 的 run 进入。
11. `last_seen_at` 只作为保守并发护栏；它不是 scan generation。
12. finalization 必须在一个短 transaction 中同时完成 run terminal、root lease 释放、成功 generation 和 session projection；任一 CAS 失败都不得发出成功事件。
13. optimize 失败不回滚完整扫描，结果为 `completed_with_warnings`。
14. renderer event 永远是 projection；数据库是事实 owner。

---

## 8. 执行流程

### 8.1 Admission

在一个 `BEGIN IMMEDIATE` transaction 中：

1. 规范化 requested roots；
2. 生成 deterministic canonical request hash；
3. 处理 `request_key` 幂等；
4. 解析 duplicate/nested/invalid requested mappings；
5. 检查所有 effective root 是否存在 active lease；任一冲突则整个请求失败；
6. 插入 session 和全部 `scan_session_roots`；
7. 对每个 effective root 原子递增 generation；
8. 插入 queued run；
9. 设置 root active pointer、generation、revision；
10. commit 后才发 queued event。

第一版多 root 顺序执行，不并发扫描多个 root。

### 8.2 Batch persistence

每个 batch transaction 必须：

1. 验证 run id、root id、generation、lease token、run revision 和 root active pointer；
2. 对成功 metadata entry upsert `files`；
3. 同 transaction 插入 `scan_seen`；
4. metadata/traversal error 写 `scan_run_errors`；
5. 更新 run counter、coverage flags 和 revision；
6. 更新 session aggregate 和 revision；
7. 任一 CAS 失败则 rollback 整个 batch；
8. commit 后才发送 progress event。

### 8.3 Stale reconciliation

进入前必须满足：

```text
status = running
cancel_requested = 0
coverage_complete = 1
stale_reconciliation_allowed = 1
root.active_run_id = run.id
root.active_generation = run.generation
lease_token 与 expected revision 匹配
```

Stale transaction 必须：

- 限定 exact effective root coverage；
- 编码 ignored/protected subtree、nested root、case 和平台路径规则；
- 只 stale `scan_seen` 中不存在的旧 row；
- 使用 `last_seen_at < run.started_at` 保守保护扫描期间 watcher/restore 更新；
- 同 transaction CAS 更新 run phase；
- CAS 失败时 rollback stale update。

不得永久删除 `files` 行。

### 8.4 Finalization

成功 finalization 必须：

- CAS 将 run 更新为 `completed` 或 `completed_with_warnings`；
- CAS 将 root `last_successful_generation` 更新为当前 generation；
- 清除 root active lease；
- 更新 health、last scan time 和 revision；
- 更新 requested/effective mapping；
-更新 session revision；
-聚合 session terminal；
-commit 后发送 terminal event。

失败、取消、中断和 requires-reconciliation 的 finalization 仍使用 lease/generation/revision CAS 释放 root lease，但绝不更新成功 generation。

### 8.5 启动恢复

应用启动时：

- 遗留 `queued/running/cancelling` run 变为 `interrupted`；
- 使用 run id、generation、lease token、root active pointer 和 revision CAS 清除 lease；
- root 置 `needs_reconciliation=1`；
- session 根据 mapping 聚合为 interrupted/requires-reconciliation；
- 不恢复旧 jwalk iterator；
- 不继续旧 run 的 stale transaction；
- 用户重试时创建新 generation。

---

## 9. Dedupe 下游契约

Task 01A **不修改 `src-tauri/src/dedupe.rs`，也不承诺跨重启 logical at-most-once**。

当前 `DedupeJobManager` 是进程内 manager，job ID 由 `spawn_duplicate_detection` 自动生成，完成后内存状态被删除。因此本阶段使用以下明确语义：

1. Session terminal 为 `completed` 或 `completed_with_warnings`、至少一个 effective run 成功且 `dedupe_requested=1` 时，将 `dedupe_dispatch_state` 置为 `pending`。
2. backend CAS claim 为 `dispatching`，递增 attempt count，然后调用现有 `spawn_duplicate_detection`。
3. 成功获得 job ID 后记录 `dispatched + dedupe_job_id`；同步调用失败记录 `failed`。
4. 如果进程在 `dispatching` 与记录 job ID 之间崩溃，启动后标记 `unknown`。
5. `unknown` 允许人工或自动重新派发；这可能造成重复 hash 计算。
6. 重复 dedupe 是 **at-least-once、安全可重复计算**，不得改变 scan terminal、generation、stale、文件内容或恢复账本。
7. 不允许宣传“只调度一次”或“可按 dispatch key 查询旧 dedupe job”。
8. 真正的 durable dedupe job、固定 idempotency key、prehash/cache/group 属于 Task 02。

如果实施过程中发现现有 dedupe 重复运行并非幂等或可能修改用户文件，立即停止；不得在 01A 扩大 dedupe 实现。

---

## 10. `scan_seen` 保留与清理

固定策略：

- active run 永不 prune；
- successful run 的 `scan_seen` 至少保留 7 天；
- failed/cancelled/interrupted/requires-reconciliation 的 `scan_seen` 和 `scan_run_errors` 至少保留 30 天；
- 每个 root 无论时间都保留最新两个 terminal run 的 observation/error；
- recovery-pinned run 不删除；
- 每次最多删除 1000 行；
- maintenance 不与 run finalization 同时执行；
-只删除 observation/error，保留 `scan_runs` 历史与统计。

清理策略第一版不可配置。

---

## 11. API 与事件兼容

### 11.1 新 command

```text
start_managed_scan
cancel_scan_run
get_scan_run
list_scan_runs
list_scan_roots
get_scan_root_health
retry_interrupted_scan
```

`start_managed_scan` 返回 session 和 run 概要。`cancel_scan_run` 只提交取消请求，终态由 backend 确认。

### 11.2 兼容 command

暂时保留：

```text
scan_directory
create_scan_job_id
cancel_scan
```

旧 command 必须成为新 backend 的 adapter，不能继续让 renderer 生成权威成功状态。

### 11.3 Event DTO

至少包含：

```text
event_id
run_id
scan_root_id
parent_session_id
generation
run_revision
session_revision
status
run_phase
session_phase
scanned_files
scanned_directories
processed_bytes
warnings_count
errors_count
current_path
error_code
error_message
timestamp
```

- `run_revision/session_revision` 是 durable 水位；
-事件只在对应 transaction commit 后发送；
- renderer 启动或重订阅先 get/list hydrate；
-低 revision 事件丢弃；
-相同 revision 和 event ID 视为重复；
-相同 revision 不同 event ID 或 revision gap 触发 refetch；
-generation、run、session 不匹配的事件丢弃；
-终态不得被旧 progress/error 回退。

---

## 12. Migration、rollout 与 rollback

### 12.1 Migration

- 空数据库直接建立 schema 27；
- schema 26 fixture 必须保留 `files/FTS/global index/Managed AI/operation/cleanup journal`；
-读取现有 settings roots，规范化后 backfill `scan_roots`；
-旧 `files` 不伪造成功 generation，不写 `scan_seen`；
-backfilled root 初始 `needs_reconciliation=1`；
-不读取 renderer localStorage 作为数据库事实；
-migration 使用现有 transaction/rollback 机制；
-提交前失败完整回滚到 schema 26；
-不得要求用户删除数据库。

### 12.2 两阶段 rollout

1. 首先发布或验证 schema-27-capable build，`managed_scan_generation_v1` 和新 stale gate 默认关闭；
2. schema 27 能在 gate 关闭时正常打开并保留旧 adapter；
3.再启用新 ledger/scan path；
4.最后独立启用新 stale reconciliation；
5.稳定后再在后续任务删除旧双轨。

### 12.3 Rollback 矩阵

| 数据库 | 允许 binary | 行为 |
|---|---|---|
| schema 26，migration 未提交 | schema-26 或 schema-27-capable | 可继续旧路径或执行迁移 |
| schema 27，gate 关闭 | schema-27-capable | 可启动，读取 ledger，使用旧 adapter |
| schema 27，新路径需回退 | schema-27-capable rollback build | 关闭 gate，保留 user_version=27 和新表 |
| schema 27 + schema-26 binary | 不允许 | 必须保持 future-schema rejection |
| 必须运行 schema-26 binary | 恢复经过验证的 schema-26 backup | 属于数据恢复，不是普通代码 rollback |

不得降低 `user_version`，不得删除新表伪造 downgrade。

---

## 13. 允许修改范围

实施允许：

```text
src-tauri/src/scanner.rs
src-tauri/src/db/schema.rs
src-tauri/src/db/queries/files.rs
src-tauri/src/db/queries/scan*.rs（可新增）
src-tauri/src/main.rs
src/api/tauriApi.ts
src/store/useScanManagerStore.ts
src/store/useBackgroundIndexerStore.ts
src/store/useFileLibraryStore.ts
与 Task 01A 直接相关的 Rust/前端/migration/performance 测试
docs/remediation/ 下的 closeout/index
```

禁止：

```text
src-tauri/src/global_index/
Managed AI worker/schema/provider
src-tauri/src/dedupe.rs 的算法和 manager
file_ops / storage analyzer execution
operation/cleanup journal / Safe Trash / restore
files.id 迁移
watcher raw event persistence
Organization Plan / Query V2 / Content Artifact
新依赖、lockfile、installer、版本号、release
```

允许调用现有 `spawn_duplicate_detection`，不允许修改其实现。

---

## 14. 推荐实施提交

在一个 Draft PR 中按原子提交推进：

1. `db: add managed scan ledger schema`
2. `scan: add root lease session and run repository`
3. `scan: persist scan seen and safe stale reconciliation`
4. `scan: add crash recovery and session aggregation`
5. `api: add managed scan commands and event revisions`
6. `ui: project durable scan sessions with legacy compatibility`
7. `test: cover scan generation migration and failure safety`
8. `docs: close Task 01A implementation`

每个提交都必须可 review/bisect；不得混入 Task 01B。

---

## 15. 必须测试

### 15.1 Rust/domain

- 单 root 完整成功；
-同 root active lease 冲突；
-request key 幂等和冲突；
-old worker lease/generation/revision CAS 失败；
-取消发生在 preparing/discovery/batch/reconciliation；
-cancelled/failed/interrupted 不 stale；
-metadata error coverage-breaking；
-root permission denied、消失、卸载；
-optimize failure -> completed_with_warnings；
-nested/duplicate/overlap/case/symlink/reparse；
-watcher 同时 upsert 不写 scan_seen；
-multi-root 顺序执行、部分失败、未启动取消；
-session terminal priority；
-dedupe pending/dispatched/unknown 的 at-least-once 安全；
-restart recovery 和 root health；
-scan_seen 7/30 日 + newest-two + active pin prune。

### 15.2 Migration

-空数据库；
-真实 schema 26 fixture；
-已有 Global Index、Managed AI、operation/cleanup journal；
-settings root backfill；
-旧 files 不伪造 generation；
-重复 migration；
-migration failure rollback；
-future-schema rejection；
-schema-27-capable gate-off 启动；
-100k files 与 scan_seen fixture。

### 15.3 Frontend/API

-旧 command 和旧 event 兼容；
-renderer restart 先 hydrate；
-revision/generation/gap/duplicate 事件过滤；
-cancelling 与 cancelled 区分；
-session 独立 phase 不随 root phase 倒退；
-multi-root durable mapping；
-background queue 与 foreground 互斥；
-Global Search、Managed AI、operation preview 无回归。

### 15.4 性能

-100k `scan_seen` batch insert；
-100k missing reconcile；
-batch transaction 时长；
-WAL reader latency；
-scan history/root health 查询；
-retention bounded prune；
-File Library 既有查询性能不显著退化。

---

## 16. 客观验收标准

Task 01A 实现通过必须满足：

1. cancelled、failed、interrupted、requires-reconciliation 永不 stale unseen files；
2. 同 root 同时只有一个 active run；
3. generation 单调，只有成功 finalization 推进成功 generation；
4.旧 worker 不能写入新 owner 的事实；
5. metadata error 不会把真实文件误标 stale；
6.重启后可读取中断 run、root health 和 session；
7.多 root requested/effective mapping 持久可解释；
8.session phase 是独立聚合阶段；
9.renderer 不是事实 owner；
10.dedupe 仅为 at-least-once 可重复计算下游，不影响 scan 事实；
11.schema 26→27 fixture、回滚矩阵和 future-schema guard 通过；
12.旧 API/event 在兼容期可用；
13.Global Index、Managed AI、operation/cleanup journal 行为不变；
14.没有 raw watcher event queue、通用 Job Runtime 或 files.id 迁移；
15.完整 CI、性能和安全门禁通过。

---

## 17. 停止条件

出现以下任一情况立即停止并汇报：

-需要修改 Global Index provider/service；
-需要修改 Managed AI queue/scope/provider/correction；
-需要修改 `files.id`；
-需要建立通用 Job Runtime；
-需要持久化 raw watcher event；
-需要修改 operation/cleanup journal 或用户文件操作语义；
-需要修改 dedupe 算法或建设 durable dedupe job；
-现有 dedupe 重复执行被证明会修改用户文件或非幂等；
-需要新增第三方依赖；
-schema 26 fixture 无法安全迁移；
-无法保证 root lease、generation、revision 或 stale 安全；
-需要开始 Task 01B 或任何后续阶段。

---

## 18. Codex 完成汇报

完成后必须汇报：

1. 实际基线 HEAD；
2. 修改文件及目的；
3. schema 27 migration；
4. root/session/run/scan_seen 所有权；
5. stale 与 crash safety；
6.旧 API/event 兼容；
7.dedupe at-least-once 结果；
8.新增测试；
9.所有验证命令；
10.性能结果；
11.提交 SHA 和 Draft PR；
12.已知风险；
13.明确声明未开始 Task 01B。

完成后停止，等待人工验收。