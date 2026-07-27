# Task 02 — File Identity, Fingerprint, Durable Dedupe and Duplicate Groups

## 1. 任务状态

- 状态：任务书已完成人工架构设计；本任务书 PR 合并后可执行
- 类型：生产代码、SQLite migration、Rust/Tauri、前端结果投影和完整测试
- 建议实施分支：`remediation/02-identity-fingerprint-dedupe`
- 建议 Draft PR：`feat: rebuild duplicate detection with durable groups`
- 基线：`master` 必须包含 PR #23 合并提交 `1bc9ead144601892feb13feaf53a6a6137df3904`
- 基线 schema：28
- 目标 schema：29
- 前置：Task 01A、Task 01B 已合并
- 后续：Task 03 及以后继续禁止执行，直到本阶段通过人工验收并合并

本任务按照人工决定作为一个完整大任务实施，不再拆分为 02A/02B/02C。它必须在一个 Draft PR 中完成 watcher rule recovery 遗留项、持久 dedupe run、物理文件身份、fingerprint、prehash、受控并行完整哈希、hard-link 语义、duplicate groups、reclaimable bytes、结果 API 和最小审核 UI。

实现可以按原子提交和内部里程碑推进，但不能把任何内部里程碑当作新的独立整改阶段，也不能在只完成部分能力时申请本任务验收。

---

## 2. 开始前必须阅读

依次完整阅读：

1. 仓库根目录当前开发说明；
2. `docs/remediation/README.md`；
3. `docs/remediation/REMEDIATION_MASTER_PLAN_V1.md`；
4. `docs/remediation/CODEX_REMEDIATION_INDEX_V1.md`；
5. `docs/remediation/POST_MERGE_BASELINE_AUDIT.md`；
6. `docs/remediation/REMEDIATION_CAPABILITY_MATRIX.md`；
7. `docs/remediation/REMEDIATION_RISK_REGISTER.md`；
8. `docs/remediation/TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md`；
9. `docs/remediation/TASK_01A_IMPLEMENTATION_CLOSEOUT.md`；
10. `docs/remediation/TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md`；
11. `docs/remediation/TASK_01B_IMPLEMENTATION_CLOSEOUT.md`；
12. 本任务书；
13. 当前 `dedupe.rs`、scan dedupe dispatch/recovery、schema、files queries、path filter、filesystem identity、安全 claim、Tauri API、前端 scan/dedupe/store/view 和对应测试。

`BRIEF.md`、`00-overview.md`、`01-dedupe.md` 等材料只能作为调研证据，不具有执行授权。若其中内容与本任务书、当前源码或安全测试冲突，以本任务书和当前生产事实为准。

---

## 3. 当前实现事实

实施前必须重新核验，不得仅复制本文。

### 3.1 当前 dedupe pipeline

当前 `src-tauri/src/dedupe.rs`：

- `DedupeJobManager` 只在进程内保存 active job 和 `AtomicBool` cancel flag；
- `spawn_duplicate_detection` 自动生成 job ID，并通过 `spawn_blocking` 启动；
- worker 完成后从内存 manager 删除，重启后无法查询终态；
-候选先按 `files.size` 分组，只选择 `content_hash = ''` 的行；
-候选逐文件、单线程执行完整 BLAKE3；
-哈希前后验证 size/mtime，写入时再以 `id/size/mtime/is_stale` 做 CAS；
-进度按文件数，不按字节；
-结果通过 `files.content_hash` 和多处重复 SQL 临时推导，没有 durable duplicate group；
-取消、阶段、统计和错误没有持久账本。

### 3.2 当前 scan-side durable dispatch

Task 01A 已在 `scan_sessions` 中建立：

- `dedupe_requested`；
- `dedupe_dispatch_state`；
- `dedupe_attempt_count`；
- `dedupe_job_id`；
- `dedupe_last_error`。

这些字段只表示 scan session 到 dedupe 的派发意图和最近关联 run。Task 02 保留其兼容 projection，但 dedupe run 的真实状态必须迁移到领域专用持久账本。

### 3.3 当前 hash cache

`files.content_hash` 是现有完整哈希缓存和兼容查询字段，但仅与 path row、秒级 mtime 和 size 绑定。它不能表达：

- rename 后同一物理文件；
- hard-link 多路径同一底层对象；
-高精度 mtime/ctime；
- prehash；
- fingerprint 算法版本；
- identity confidence；
- group/member 历史。

Task 02 建立新的 physical identity 和 fingerprint owner。`files.content_hash` 在兼容期保留为 projection，不再作为正式 duplicate group 的唯一事实来源。

### 3.4 Task 01B 遗留项

当前 watcher rule recovery 仍可能依赖 `watcher_last_error_code`。普通 watcher batch 可以清理最近错误，从而擦除“规则恢复尚未完成”的事实。

Task 02 的第一项生产修改必须建立独立持久字段：

```text
watcher_rule_recovery_required
```

该项不得再次延后。

---

## 4. 本任务必须完成

1. 修复 watcher rule recovery 的独立持久事实；
2. schema 28 → 29；
3. 建立领域专用 durable dedupe run、error ledger、queue、cancel、revision 和 startup recovery；
4. 建立 read-only physical identity mapping，不迁移 `files.id`；
5. 建立版本化 fingerprint cache；
6. 识别并合并同一物理文件的 hard-link aliases；
7. 实现头尾 prehash；
8. 实现有界、可配置、可取消的完整哈希 worker pool；
9. 将进度升级为 phase + files + bytes；
10. 建立 durable duplicate groups 和 group members；
11. 正确计算 path count、distinct physical copy count、hard-link alias count 和 reclaimable bytes；
12. 建立 group rebuild/publish 事务，失败或取消不得污染当前结果；
13. 将现有 duplicate filter/查询迁移到正式 group membership；
14. 提供 run/group 查询 API、keyset pagination 和最小只读审核 UI；
15. 保留旧 command/event 的兼容期；
16. 完成 migration、crash、identity、hard-link、cache、prehash、并行、group、reclaim、性能和双平台验证。

---

## 5. 明确非目标

本任务禁止：

- 修改或迁移 `files.id`；
-把 Global Index 的 `platform_file_id` 直接写入 `files` 主键；
-把 dedupe identity 代替 `fs_safety`、operation claim 或 restore identity；
-修改 Global Index、Windows MFT/USN、macOS Spotlight/FSEvents；
-修改 Managed AI、`ai_jobs`、provider policy 或 user correction；
-建立跨领域通用 Job Runtime；
-建设 Analysis Run/Finding；
-自动删除、移动、重命名、链接、合并或覆盖文件；
-提供“自动保留一个并删除其他副本”的按钮；
-修改 operation journal、cleanup journal、Safe Trash 或 restore；
-把 reclaimable bytes 当作已授权清理空间；
-将 duplicate group 直接转化为 filesystem mutation；
-实现 Query V2、Organization Plan、Content Artifact、自然语言规则或 Spotlight 重构；
-恢复或 cherry-pick 已关闭 PR #21；
-新增第三方依赖或修改 lockfile；
-修改版本号、installer、tag 或 release；
-开始 Task 03 或任何后续阶段。

本任务可以显示“建议保留”的只读提示，但它不得创建删除决策，也不得绕过后续 Analysis、Organization Plan、authoritative preview、journal 和 Safe Trash。

---

## 6. 冻结架构决定

### 6.1 领域 owner

- SQLite 是 dedupe run、physical identity、fingerprint、group、member、统计和终态的唯一持久事实来源；
- Rust dedupe coordinator 是这些表的唯一业务 owner；
- `DedupeJobManager` 只可保留为当前进程 active worker/cancel registry；
- `scan_sessions` 只保留派发意图和最近关联 run；
- renderer 只发起、取消、查询和投影；
- dedupe 只读用户文件并更新索引/分析数据，绝不修改用户文件。

### 6.2 不迁移 path ID

- `files.id` 在本阶段继续是 path-row identity；
-新增 read-only physical identity layer；
-rename、hard-link 和同路径内容变化通过 mapping/fingerprint 解决；
-不得修改 operation、restore、AI 或 Global Index 的 identity 合同。

### 6.3 全局单 run owner，内部有界并行

当前 dedupe 针对整个 managed `files` 数据域：

-任意时刻最多一个 dedupe run 为 `running` 或 `cancelling`；
-允许多个 `queued` run，按 `created_at, id` FIFO claim；
-每个 scan session 产生自己的 request identity，不能把更早启动、可能未看到本次 scan 的 active run 当作已满足；
-一个 run 内允许受控并行 prehash/full hash；
-不得并行运行两个全局 dedupe run。

### 6.4 at-least-once 与缓存复用

- scan-triggered dedupe 保持 at-least-once；
-应用崩溃后 active run 进入 `interrupted`；
-符合恢复条件时创建新的 recovery run，并设置 `retry_of_run_id`；
-已成功写入并仍然有效的 fingerprint 可被重试复用；
-不承诺跨崩溃 exactly-once；
-重复计算不得改变 scan generation、stale、watcher revision、用户文件或任何恢复账本。

### 6.5 结果发布必须原子化

-运行中的 group build 不得直接替换当前可见结果；
-新 group/member 初始为未发布 run result；
-只有 run 完成全部 collecting/identity/prehash/hash/grouping 且仍持有 run CAS owner，才在短事务中发布该 run 的结果；
-发布事务将旧 current result 退役，并将本 run 结果设为 current；
-cancelled、failed、interrupted run 的部分结果永不成为 current；
-旧 current 结果在新 run 失败时继续可读。

---

## 7. Schema 29

迁移必须在现有 `BEGIN IMMEDIATE` 事务中完成，并继续拒绝 future schema。以下 SQL 是冻结的数据合同；实现可以按仓库 helper 调整语法，但不能改变语义。

### 7.1 watcher rule recovery fact

向 `scan_roots` 增加：

```sql
ALTER TABLE scan_roots
ADD COLUMN watcher_rule_recovery_required INTEGER NOT NULL DEFAULT 0
CHECK (watcher_rule_recovery_required IN (0, 1));
```

规则：

- watcher exact rule execution 最终失败时设为 `1`；
-普通 watcher batch begin/complete 不得清除；
- overflow、rename、permission 或其他最近错误不得覆盖；
- full managed reconciliation 根据该字段决定是否运行 root-level `AllChangedOrRuleChanged`；
-只有 root-level rule recovery 成功，并在 finalization CAS 中确认 run 仍拥有 root lease/revision，才设为 `0`；
-恢复失败继续为 `1`；
-字段为 `1` 时，root 不得标记为 healthy，`needs_reconciliation` 不得清除；
-`watcher_last_error_code/message` 只负责最近错误展示。

### 7.2 physical identity

```sql
CREATE TABLE file_physical_identities (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL
        CHECK (provider IN ('windows_file_id', 'unix_inode', 'path_fallback')),
    volume_id TEXT NOT NULL,
    native_file_id TEXT NOT NULL,
    identity_confidence TEXT NOT NULL
        CHECK (identity_confidence IN ('native', 'path_only')),
    size INTEGER NOT NULL CHECK (size >= 0),
    mtime_ns INTEGER NOT NULL,
    ctime_ns INTEGER,
    link_count INTEGER NOT NULL DEFAULT 1 CHECK (link_count >= 1),
    last_verified_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(provider, volume_id, native_file_id)
);

CREATE INDEX idx_file_physical_identity_native
ON file_physical_identities(provider, volume_id, native_file_id);
```

`id` 应由 provider + volume + native ID 的稳定规范化值确定。`mtime_ns/ctime_ns/size` 是 fingerprint validity，不是 identity 主键。

### 7.3 path row → physical identity mapping

```sql
CREATE TABLE file_identity_links (
    file_id TEXT PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
    physical_identity_id TEXT NOT NULL
        REFERENCES file_physical_identities(id) ON DELETE CASCADE,
    observed_path TEXT NOT NULL,
    observed_size INTEGER NOT NULL CHECK (observed_size >= 0),
    observed_mtime_ns INTEGER NOT NULL,
    observed_at INTEGER NOT NULL
);

CREATE INDEX idx_file_identity_links_physical
ON file_identity_links(physical_identity_id, file_id);
```

多个 path rows 可以映射到同一 physical identity，这正是 hard-link alias 的正式表达。

### 7.4 fingerprint cache

```sql
CREATE TABLE file_fingerprints (
    physical_identity_id TEXT PRIMARY KEY
        REFERENCES file_physical_identities(id) ON DELETE CASCADE,
    size INTEGER NOT NULL CHECK (size >= 0),
    mtime_ns INTEGER NOT NULL,
    ctime_ns INTEGER,
    prehash TEXT,
    prehash_algorithm TEXT,
    prehash_version INTEGER,
    full_hash TEXT,
    full_hash_algorithm TEXT,
    full_hash_version INTEGER,
    valid INTEGER NOT NULL DEFAULT 1 CHECK (valid IN (0, 1)),
    computed_at INTEGER NOT NULL,
    last_verified_at INTEGER NOT NULL
);
```

缓存有效条件至少为：

```text
physical identity 一致
+ size 一致
+ mtime_ns 一致
+ ctime_ns（平台可用时）一致
+ algorithm/version 一致
+ valid = 1
```

### 7.5 durable dedupe runs

```sql
CREATE TABLE dedupe_runs (
    id TEXT PRIMARY KEY,
    parent_scan_session_id TEXT REFERENCES scan_sessions(id) ON DELETE SET NULL,
    retry_of_run_id TEXT REFERENCES dedupe_runs(id) ON DELETE SET NULL,
    trigger_kind TEXT NOT NULL
        CHECK (trigger_kind IN ('scan_session', 'manual', 'recovery')),
    request_key TEXT,
    status TEXT NOT NULL
        CHECK (status IN (
            'queued', 'running', 'cancelling',
            'completed', 'cancelled', 'failed', 'interrupted'
        )),
    phase TEXT NOT NULL
        CHECK (phase IN (
            'collecting', 'identifying', 'prehashing',
            'hashing', 'grouping', 'finalizing', 'completed'
        )),
    cancel_requested INTEGER NOT NULL DEFAULT 0
        CHECK (cancel_requested IN (0, 1)),
    candidate_files INTEGER NOT NULL DEFAULT 0 CHECK (candidate_files >= 0),
    candidate_bytes INTEGER NOT NULL DEFAULT 0 CHECK (candidate_bytes >= 0),
    physical_files INTEGER NOT NULL DEFAULT 0 CHECK (physical_files >= 0),
    hardlink_aliases INTEGER NOT NULL DEFAULT 0 CHECK (hardlink_aliases >= 0),
    prehashed_files INTEGER NOT NULL DEFAULT 0 CHECK (prehashed_files >= 0),
    prehashed_bytes INTEGER NOT NULL DEFAULT 0 CHECK (prehashed_bytes >= 0),
    hashed_files INTEGER NOT NULL DEFAULT 0 CHECK (hashed_files >= 0),
    hashed_bytes INTEGER NOT NULL DEFAULT 0 CHECK (hashed_bytes >= 0),
    duplicate_groups INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_groups >= 0),
    duplicate_paths INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_paths >= 0),
    reclaimable_bytes INTEGER NOT NULL DEFAULT 0 CHECK (reclaimable_bytes >= 0),
    skipped_files INTEGER NOT NULL DEFAULT 0 CHECK (skipped_files >= 0),
    error_files INTEGER NOT NULL DEFAULT 0 CHECK (error_files >= 0),
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

CREATE UNIQUE INDEX idx_dedupe_single_active
ON dedupe_runs((1))
WHERE status IN ('running', 'cancelling');

CREATE INDEX idx_dedupe_runs_status_created
ON dedupe_runs(status, created_at, id);

CREATE INDEX idx_dedupe_runs_session_created
ON dedupe_runs(parent_scan_session_id, created_at DESC);

CREATE UNIQUE INDEX idx_dedupe_runs_request_key
ON dedupe_runs(request_key)
WHERE request_key IS NOT NULL;
```

若 retry 需要新的 request key，应以原逻辑 key + retry attempt 构造，不复用 terminal run ID。

### 7.6 run errors

```sql
CREATE TABLE dedupe_run_errors (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES dedupe_runs(id) ON DELETE CASCADE,
    file_id TEXT,
    path TEXT,
    phase TEXT NOT NULL,
    error_code TEXT NOT NULL,
    error_message TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_dedupe_run_errors_run_created
ON dedupe_run_errors(run_id, created_at, id);
```

### 7.7 run-versioned duplicate groups

```sql
CREATE TABLE duplicate_groups (
    id TEXT PRIMARY KEY,
    group_key TEXT NOT NULL,
    result_run_id TEXT NOT NULL REFERENCES dedupe_runs(id) ON DELETE CASCADE,
    hash_algorithm TEXT NOT NULL,
    full_hash TEXT NOT NULL,
    size_each INTEGER NOT NULL CHECK (size_each > 0),
    path_count INTEGER NOT NULL CHECK (path_count >= 2),
    physical_copy_count INTEGER NOT NULL CHECK (physical_copy_count >= 1),
    hardlink_alias_count INTEGER NOT NULL DEFAULT 0 CHECK (hardlink_alias_count >= 0),
    reclaimable_bytes INTEGER NOT NULL DEFAULT 0 CHECK (reclaimable_bytes >= 0),
    identity_confidence TEXT NOT NULL
        CHECK (identity_confidence IN ('native', 'mixed', 'path_only')),
    recommended_keep_file_id TEXT,
    is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(result_run_id, group_key)
);

CREATE INDEX idx_duplicate_groups_current_reclaim
ON duplicate_groups(is_current, reclaimable_bytes DESC, size_each DESC, group_key);

CREATE INDEX idx_duplicate_groups_run
ON duplicate_groups(result_run_id, group_key);
```

`group_key` 必须由 `hash_algorithm + full_hash + size` 确定；`id` 可以由 `result_run_id + group_key` 确定，以便一个 run 构建完整不可见结果，再原子发布。

### 7.8 group members

```sql
CREATE TABLE duplicate_group_members (
    group_id TEXT NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
    file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    physical_identity_id TEXT NOT NULL
        REFERENCES file_physical_identities(id) ON DELETE CASCADE,
    member_kind TEXT NOT NULL
        CHECK (member_kind IN ('physical_copy', 'hardlink_alias', 'path_fallback')),
    path_snapshot TEXT NOT NULL,
    is_recommended_keep INTEGER NOT NULL DEFAULT 0
        CHECK (is_recommended_keep IN (0, 1)),
    is_valid INTEGER NOT NULL DEFAULT 1 CHECK (is_valid IN (0, 1)),
    created_at INTEGER NOT NULL,
    PRIMARY KEY(group_id, file_id)
);

CREATE INDEX idx_duplicate_members_file
ON duplicate_group_members(file_id, group_id);

CREATE INDEX idx_duplicate_members_physical
ON duplicate_group_members(physical_identity_id, group_id);
```

### 7.9 migration/backfill

- 不从旧 `content_hash` 直接伪造 physical identity 或 current groups；
-不在 migration 中遍历文件系统；
-旧 `files.content_hash` 保留；
-首次 Task 02 run 通过真实 filesystem observation 建 identity/fingerprint/group；
-旧 hash 只能作为兼容 hint，不得未经高精度 identity/stat 复核直接晋升为 authoritative fingerprint；
-空数据库、真实 schema 28 fixture、重复打开、失败 rollback 和 future schema rejection 必须覆盖；
-不得要求用户删除数据库。

---

## 8. Physical identity contract

### 8.1 Windows

优先使用稳定 volume identity + native file ID，并读取 link count。实现可以复用现有 read-only metadata helper，但不得复用或削弱 mutation claim 的权限/语义。

### 8.2 macOS / Unix

使用 device + inode，读取 link count；mtime/ctime 使用可获得的最高精度。

### 8.3 path fallback

仅当平台 API 或权限无法提供 native identity 时使用 normalized path fallback：

- `identity_confidence = path_only`；
-可以参与 hash 相等判断；
-不得把其空间计入可信 reclaimable bytes；
-UI 必须显示“身份不确定，需要检查”；
-不得假装已排除 hard-link。

### 8.4 symlink/reparse

- 不跟随 symlink、junction、reparse point 或设备节点进行 duplicate hashing；
-按既有 path safety policy 跳过并记录原因；
-不得通过 dedupe 读取 managed scope 外的目标。

### 8.5 hard-link

-多个 path rows 映射到同一 native physical identity；
-同一 physical identity 只读取和哈希一次；
-其他路径记录为 `hardlink_alias`；
-hard-link aliases 不增加 `physical_copy_count`；
-删除一个 hard-link 通常不释放 file data，因此不增加 reclaimable bytes；
-UI 必须把“同一底层文件的多个路径”与“真正内容相同的独立副本”分开显示。

---

## 9. Fingerprint invalidation contract

### 9.1 runtime verification

使用缓存前必须重新读取磁盘 identity/stat，并验证：

- physical identity；
- size；
- mtime_ns；
- ctime_ns（可用时）；
-算法/version；
-文件仍在 managed scope；
-文件不是 stale、directory、symlink/reparse。

### 9.2 scanner/watcher invalidation

-同 path row metadata 内容变化时，必须使关联 fingerprint `valid = 0`，并使当前 group member 失效；
-path stale/delete/rename 时，必须使该 path 的 current group member 失效，并移除或更新 link；
-仅路径消失不得无条件使同一 physical identity 的其他 hard-link alias fingerprint 失效；
-watcher 永不写 `scan_seen`，Task 02 不改变 Task 01A/01B owner。

### 9.3 `files.content_hash` 兼容期

-新完整哈希成功后，在同一安全写入路径同步更新 `file_fingerprints.full_hash` 与 `files.content_hash`；
-正式 duplicate 查询改为 current group membership；
-旧 `content_hash` 只用于兼容旧 UI/查询，不再单独证明 duplicate group；
-任何 cache invalidation 必须避免两套值相互矛盾。

---

## 10. Dedupe run 状态机

### 10.1 status

```text
queued
  → running
  → cancelling
  → cancelled

running
  → completed
  → failed
  → interrupted

cancelling
  → cancelled
  → failed
  → interrupted
```

terminal：`completed/cancelled/failed/interrupted`。

### 10.2 phase

```text
collecting
→ identifying
→ prehashing
→ hashing
→ grouping
→ finalizing
→ completed
```

phase 单调，不能倒退。

### 10.3 revision/CAS

- admission、claim、phase、checkpoint、cancel、terminal 和 publish 均原子递增 revision；
-旧 worker 更新 affected rows 必须为 1，否则停止写入；
-renderer 以 durable revision 为水位；
-旧/重复 event 不得回退状态；
-gap 触发 snapshot refetch。

### 10.4 queue/pump

-创建 run 只写 `queued`；
-单一 pump claim 最早 queued run；
-partial unique index + claim CAS 保证单 active run；
-pump 在应用启动、run terminal 和新 run admission 后唤醒；
-不得 busy loop；
-queue 状态必须可查询。

### 10.5 cancel

- cancel command 只设置 durable `cancel_requested = 1` 并将 running 改为 `cancelling`；
-进程内 flag 仅用于加速；
-worker 必须在阶段、文件和哈希 chunk 边界检查 durable/in-memory cancel；
-cancelled run 不发布 group，不退役旧 current result；
-renderer 只能在 durable terminal 后显示 cancelled。

### 10.6 startup recovery

- `queued` 保持 queued；
-遗留 `running/cancelling` 原子改为 `interrupted`；
-若 cancel 已请求，不自动重试；
-其他 eligible interrupted run 可创建 bounded recovery run，设置 `retry_of_run_id`；
-最多自动恢复 3 次，耗尽后留 failed/attention；
-旧 run 不复活，不复用 ID；
-已写入的有效 fingerprint 可以复用；
-未发布 groups 自动随 run 保持不可见并由 retention 清理。

---

## 11. Hash pipeline

### 11.1 collecting

只选择：

- managed `files`；
- `is_dir = 0`；
- `is_stale = 0`；
- `size > 0`；
-至少有另一个同 size path row；
-不在 ignored/protected/symlink/reparse 范围。

空文件继续不进入 duplicate group，并在 UI/文档明确说明。

### 11.2 identifying

-逐候选真实读取 physical identity；
-持久化 physical identity 和 file link；
-同一 physical identity 在本 run 内合并为一个物理对象；
-统计 path count、physical count 和 hard-link aliases；
-身份失败记录 error；path fallback 保守继续，但不产生可信 reclaim bytes。

### 11.3 prehash

算法冻结为：

- BLAKE3；
-文件头最多 4 KiB + 文件尾最多 4 KiB；
-文件 `size <= 8 KiB` 时整文件读取一次，不重复重叠区；
-加入 domain separator、文件 size 和 prehash version；
-只对 size collision group 的 distinct physical identities 执行；
-必须为该 size group 的所有 distinct physical identities获得有效 prehash，包含已具有旧 full hash 但没有 prehash 的成员；
-按 `(size, prehash)` 分组；
-只有至少两个 distinct physical identities 的 prehash bucket 进入 full hash；
-全部为 singleton 的 size group 不执行 full hash；
-prehash 持久缓存并遵守 fingerprint invalidation。

### 11.4 full hash

-算法继续 BLAKE3；
-仅对晋级 bucket 中缺少有效 full hash 的 physical identities读取完整内容；
-已有有效 full hash 零 IO 复用；
-哈希前后重新验证 physical identity/stat；
-变化则丢弃结果、记录 changed_during_hash，不写缓存；
-写入以 physical identity + size + high precision times + revision 做 CAS；
-同时维护 `files.content_hash` 兼容 projection；
-完整哈希读取必须支持 chunk-level cancellation。

### 11.5 worker pool

-不新增第三方依赖；
-使用 Rust 标准线程/channel或仓库现有运行时原语；
-默认 worker 数：`min(max(1, available_parallelism / 2), 4)`；
-支持 `ZEN_CANVAS_DEDUPE_HASH_WORKERS` 覆盖，允许 1，最大 8；
-非法值回退默认并记录 warning；
-任务队列必须有界，不能把所有大文件同时载入内存；
-DB connection/transaction 不跨文件 IO 长时间持有；
-单个 worker 不得向共享 SQLite 高频逐 chunk 写入；
-统计聚合和 checkpoint 应批量或按时间节流。

### 11.6 byte progress

run snapshot/event 至少包括：

- phase；
- candidate files/bytes；
- physical files；
- hard-link aliases；
- prehashed files/bytes；
- hashed files/bytes；
- duplicate groups/paths；
- reclaimable bytes；
- skipped/error；
- current path 可选且必须脱敏/受 scope；
- revision/timestamp。

---

## 12. Duplicate group contract

### 12.1 group inclusion

只有满足以下条件的 full-hash bucket 才创建正式 group：

-相同 size；
-相同 full BLAKE3；
-至少两个 distinct physical identities；
-或存在 path-only fallback 且至少两个 path，但此时 identity confidence 为 mixed/path_only，reclaimable bytes 保守为 0。

仅一个 physical identity + 多个 hard-link aliases 不能被描述为“可释放的重复副本”。可以作为 alias 信息附着到其他真实 duplicate group，但不能单独构成 reclaimable group。

### 12.2 reclaimable bytes

当所有可计 physical copies 都有 native identity：

```text
reclaimable_bytes = size_each × (physical_copy_count - 1)
```

hard-link alias 不增加 physical copy count。

当存在 path fallback、identity 冲突、文件变化、权限不确定或成员失效时：

```text
reclaimable_bytes = 0
identity_confidence = mixed/path_only
```

UI 必须说明“占用空间”不等于“已授权可释放空间”。

### 12.3 recommended keep

可以使用稳定、可解释、无副作用的排序产生一个 `recommended_keep_file_id`：

1. managed root 中更正式的路径优先于 Downloads/Temp；
2.非 stale、可访问、native identity 优先；
3.路径层级更稳定；
4.名称非 copy-suffix 优先；
5.最后以 normalized path 确定性排序。

它只是一条 UI 建议，不是删除决策。用户未确认前不得产生 filesystem mutation。

### 12.4 publish/rebuild

-每次 completed run 构建独立 run-versioned groups；
- finalization 短事务把旧 `is_current=1` 改为 0，再发布本 run；
- current group 查询只读 `is_current=1`；
-取消/失败/中断不改变 current generation；
-文件 metadata 变化时相关 current member `is_valid=0`，查询不得把它计入 reclaim；
-旧 group history 按 retention 清理，不与 Task 03 finding 混淆。

### 12.5 pagination

group 列表必须使用真 keyset cursor，不使用 OFFSET：

```text
(reclaimable_bytes DESC, size_each DESC, group_key ASC, id ASC)
```

cursor 必须包含所有排序键，覆盖并列翻页测试。

---

## 13. API 与事件

必须提供或完善：

```text
start_dedupe_run
cancel_dedupe_run
get_dedupe_run
list_dedupe_runs
get_active_dedupe_run
list_duplicate_groups
get_duplicate_group
```

建议 DTO：

```text
DedupeRunDto
DedupeRunSnapshotDto
DuplicateGroupSummaryDto
DuplicateGroupDetailDto
DuplicateGroupMemberDto
CursorPage<T>
```

兼容要求：

-旧 `dedupe-progress` / `dedupe-complete` 在兼容期继续发送；
-其中 job ID 必须等于 durable run ID；
-旧 `cancel_dedupe` 转接 durable cancel；
-scan-side `dedupe_job_id` 指向 durable run；
-前端不再仅依赖事件判定终态，必须 hydrate snapshot；
-不把 Task 04 Query V2 提前引入普通 File Library 查询；仅 duplicate group API 使用本任务局部 cursor。

所有 Tauri command 必须保持现有 main-window authorization 和 permission/capability 配置。

---

## 14. 最小只读 UI

在现有最合理的 File Library 或 Storage/Scan surface 中提供：

-当前/最近 dedupe run；
-queued/running/cancelling/terminal；
-phase、文件进度和字节进度；
-开始、取消、失败后重试；
-duplicate group 列表；
-group path count、physical copy count、hard-link alias count、size_each、reclaimable bytes；
-group detail 和 member paths；
-hard-link alias 标签；
-identity uncertain 标签；
-recommended keep 的解释；
-空文件不参与的说明。

禁止加入：

-删除按钮；
-自动清理；
-永久删除；
-“保留推荐项并删除其他项”；
-绕过 Analysis/Plan/Preview/Safe Trash 的 action。

UI 必须遵守当前 `docs/design/` 和 Windows/macOS 平台契约。

---

## 15. Retention

- active/queued run 不清理；
- terminal dedupe runs 和 errors 至少保留 30 天；
-至少保留最近 20 个 terminal runs；
- current group result 永不因普通 retention 删除；
-非 current group history 随对应旧 run retention 批量清理；
- physical identity/link 随 `files` 生命周期和重新观察维护；
- fingerprint 可长期缓存，但 invalid 且无任何 link 的记录可有界清理；
-每批删除有上限，不在 UI 查询或 active finalization 长事务中执行；
-不得清理 operation/cleanup journal。

---

## 16. Migration 与 rollback

必须覆盖：

-空数据库直接 schema 29；
-真实 schema 28 fixture；
-Task 01A scan ledger；
-Task 01B watcher columns；
-Global Index、Managed AI、rules、files、operation/cleanup journal 保留；
-重复打开 schema 29；
-确定性 migration failure rollback，`user_version` 保持 28；
-不留下半表、半索引或半列；
-future schema 30 拒绝；
-100k `files` fixture 的 migration 时间和 WAL reader；
-不扫描文件系统、不回填虚假 groups。

rollback：

- schema 29 commit 前依赖事务 rollback；
- commit 后只能使用 schema-29-capable build 关闭新 dedupe surface/worker；
-旧 schema-28 binary 继续拒绝 future schema，不能声称可直接降级；
-关闭 feature gate 后新表可以保留，不影响 scan/watcher/Global/AI/journal；
-不得通过删除数据库回滚。

---

## 17. 测试计划

### 17.1 watcher rule recovery

- rule failure 设 flag；
-随后成功 watcher batch 不清 flag；
-最近错误可以清理但 flag 保留；
-overflow/rename/permission error 不覆盖；
-重启后仍恢复；
-full rule recovery 成功后 CAS 清零；
-恢复失败继续保留，root 不 healthy；
-user correction 不覆盖。

### 17.2 durable run/queue

- manual admission；
-scan-session admission idempotency；
-每个新 scan session 独立 queued run；
-FIFO；
-single active partial unique index；
-old worker CAS；
-phase 单调；
-revision/gap；
-durable cancel；
-queued cancel；
-running cancel；
-cancel during prehash/full hash/grouping；
-startup queued recovery；
-running/cancelling → interrupted；
-bounded recovery retry；
-terminal run 不复活；
-old events 不回退 UI。

### 17.3 physical identity/hard-link

- Windows native identity；
-macOS/Unix dev+inode；
-same file rename；
-case-only rename；
-cross-directory rename；
-hard-link two paths one physical identity；
-hard-link + independent same-content copy；
-link count change；
-native ID unavailable path fallback；
-file ID reuse/metadata mismatch invalidation；
-symlink/reparse/device skip；
-managed scope escape negative test。

### 17.4 fingerprint/prehash

- head different；
-tail different；
-same head/tail but different middle进入 full hash 后分开；
-size <= 8KiB 不重复读取；
-all singleton prehash groups跳过 full hash；
-promoted bucket只 hash missing fingerprint；
-existing valid cache zero full-file IO；
-algorithm/version invalidation；
-size/mtime_ns/ctime change invalidation；
-change during prehash；
-change during full hash；
-rename复用 native fingerprint；
-hard-link只 hash一次；
-legacy `content_hash` 不被盲目信任。

### 17.5 workers/cancel/progress

-worker override 1；
-default worker calculation；
-invalid override fallback；
-upper bound 8；
-bounded queue；
-no DB lock across IO；
-chunk cancellation on large file；
-byte counters monotonic；
-files/bytes terminal exact；
-worker panic/failure转 run error；
-slow disk模拟；
-concurrent File Library readers。

### 17.6 groups/reclaim

-two independent copies；
-three copies；
-hardlink aliases不增加 reclaim；
-one physical identity only不创建 reclaim group；
-mixed/path fallback reclaim=0；
-member change后 invalid；
-cancel/failed run不发布；
-completed run原子替换 current；
-old current在新run失败时继续可见；
-recommended keep确定性；
-keyset并列翻页；
-existing duplicateOnly filter迁移；
-group detail path/member正确。

### 17.7 migration

-空库；
-schema 28 fixture；
-失败 rollback；
-schema 29 reopen；
-future schema；
-100k files；
-旧 ledger/journal/AI/global/rules保留；
-不伪造 group/fingerprint。

### 17.8 frontend/API

-hydrate active run；
-event revision gate；
-queued/running/cancelling/terminal；
-restart；
-cancel确认；
-retry；
-group cursor；
-group detail；
-hard-link/uncertain labels；
-no destructive actions；
-browser mock和Tauri permissions。

### 17.9 性能

至少记录：

-100k file rows candidate query；
-100k identity/link upsert；
-prehash 全互异大文件组相对 full hash 的 bytes saved；
-cache warm run；
-worker=1 与默认 worker；
-大量小文件；
-少量超大文件；
-group publish transaction；
-group keyset page P95；
-WAL reader latency；
-checkpoint频率和主库 lock time；
-内存峰值随 candidate count 的边界。

---

## 18. 允许修改范围

允许按需要修改：

```text
src-tauri/src/dedupe.rs
src-tauri/src/dedupe/
src-tauri/src/db/schema.rs
src-tauri/src/db/queries/scan.rs
src-tauri/src/db/queries/files.rs
src-tauri/src/db/queries/dedupe.rs
src-tauri/src/scanner.rs
src-tauri/src/main.rs
src-tauri/src/fs_safety/（仅新增/复用 read-only identity helper，不改 mutation contract）
src-tauri/tests/
src/api/tauriApi.ts
src/store/（dedupe/run/group相关）
src/views/（最小只读dedupe surface）
src-tauri/capabilities/
tests/
scripts/（仅专项性能/契约测试）
docs/remediation/
```

明确禁止：

```text
src-tauri/src/global_index/
Managed AI worker/provider/schema
operation journal/cleanup journal状态机
Safe Trash/restore执行
files.id主键迁移
installer/version/release
Task03及后续业务
```

不得新增第三方依赖，不得修改 Cargo/npm lockfile。

---

## 19. 一个 PR 内的原子提交顺序

这是一个大任务，但必须在同一个 Draft PR 中按原子提交完成：

1. `db: add watcher recovery identity fingerprint and dedupe schema`
2. `watcher: persist independent rule recovery requirement`
3. `dedupe: add durable run repository queue and recovery`
4. `dedupe: observe physical identity and hardlink aliases`
5. `dedupe: add fingerprint cache and prehash pipeline`
6. `dedupe: add bounded parallel full hashing and byte progress`
7. `dedupe: publish durable duplicate groups and reclaim semantics`
8. `api: expose dedupe runs groups and keyset pagination`
9. `ui: add read-only duplicate group review surface`
10. `test: cover migration crash identity hash groups and performance`
11. `docs: close Task 02 implementation`

不得创建多个实现 PR，不得在中间提交后声称 Task 02 已完成。所有提交都在一个 Draft PR 中，最终一次性验收。

---

## 20. 验收标准

必须全部满足：

- `watcher_rule_recovery_required` 不会被普通 watcher batch 清除；
- schema 28→29 安全迁移并可 rollback；
- dedupe run、cancel、phase、revision、errors 和 terminal 可跨重启查询；
-任意时刻只有一个 active global dedupe run；
- prehash 正确减少不必要 full-file IO；
- full hash 有界并行、可配置、可取消；
- native identity 正确识别 rename 和 hard-link；
-不迁移 `files.id`，不削弱 operation identity；
- fingerprint cache 有高精度 invalidation 和版本合同；
- cancelled/failed/interrupted run 不发布部分 groups；
- completed run 原子发布 current result；
-hard-link aliases 不增加 reclaimable bytes；
- path-only identity 不产生可信 reclaimable bytes；
- group API 使用真 keyset pagination；
-旧 duplicate filter 不再依赖临时 `GROUP BY files.content_hash` 作为唯一事实；
-UI 只读，无删除或清理动作；
-Global Index、Managed AI、journal、Safe Trash、restore 无行为/schema 回归；
-100k、large-file、cache-warm、worker和WAL基准通过；
-Windows/macOS CI 全绿；
-Task 03 未开始。

---

## 21. 停止条件

出现以下任一情况立即停止并汇报，不自行扩大范围：

-必须迁移 `files.id` 才能继续；
-必须改变 operation claim/restore identity；
-无法在 Windows 或 macOS 获得安全 read-only identity，且 fallback 会产生错误 reclaim；
-必须修改 Global Index 或 Managed AI；
-必须修改 operation/cleanup journal、Safe Trash 或 restore；
-需要自动删除/移动文件；
-需要新增第三方依赖；
-无法保证 single active run；
-无法保证失败/取消 run 不发布结果；
-无法兼容 schema 28；
-并行哈希需要长期持有 SQLite write transaction；
-hard-link 和 independent copy 无法可靠区分；
-reclaimable bytes 无法保守计算；
-需要提前建设 Analysis/Plan/Query V2；
-发现与本任务无关的历史竞态，修复会扩大范围。

---

## 22. 验证命令

开始前记录：

```bash
npm run verify:frontend
npm run verify:rust
npm run verify:security
npm run test:performance
npm run build
```

完成后至少运行：

```bash
npm run verify:frontend
npm run verify:rust
npm run verify:security
npm run test:performance
npm run build
npm run security:audit
npm run security:audit:rust
git diff --check
git status --short
```

还必须运行本任务新增的 migration、dedupe、identity、hard-link、prehash、worker、group、pagination 和 100k/large-file 专项测试。

平台专用验证无法本地运行时必须如实记录，并以 GitHub Windows/macOS CI 为权威门禁。

---

## 23. Closeout 与 PR

完成后新增：

```text
docs/remediation/TASK_02_IMPLEMENTATION_CLOSEOUT.md
```

并更新：

```text
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
```

Closeout 必须记录：

-实际基线和最终 HEAD；
-schema 29；
-watcher rule recovery；
-run/queue/recovery；
-physical identity/hard-link；
-fingerprint/prehash/full hash；
-worker和byte progress；
-group publish/reclaim；
-API/UI；
-migration/rollback；
-完整测试和性能；
-已知风险；
-Task 03 未开始。

创建一个 Draft PR：

```text
feat: rebuild duplicate detection with durable groups
```

PR 必须引用本任务书，列出原子提交，说明无用户文件 mutation、无 files.id 迁移、无 Global/AI/journal 改动，并保持 Draft 等待人工验收。

---

## 24. 完成汇报

1. 实际基线 HEAD；
2. 修改文件及目的；
3. schema 29 migration；
4. watcher rule recovery；
5. durable run/queue/cancel/restart；
6. physical identity/hard-link；
7. fingerprint/prehash/full hash；
8. worker和byte progress；
9. duplicate groups/reclaim/keyset；
10. API/UI；
11.新增测试；
12.完整验证和性能结果；
13.提交 SHA 和 Draft PR；
14.已知风险；
15.明确声明没有用户文件 mutation、没有开始 Task 03。

完成后停止，等待人工验收。