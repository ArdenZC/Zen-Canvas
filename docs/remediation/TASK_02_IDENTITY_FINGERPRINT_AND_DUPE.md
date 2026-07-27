# Task 02 — File Identity, Fingerprint Cache and Durable Duplicate Groups

## 1. 任务状态

- 状态：**人工设计完成；本任务书合并到 `master` 后可执行**
- 类型：完整生产实施任务
- 实施方式：一个分支、一个 Draft PR、一次完整验收
- 禁止拆分为 02A/02B/02C 等独立授权任务
- 建议实施分支：`remediation/02-identity-fingerprint-dedupe`
- 建议 PR 标题：`feat: add durable file fingerprints and duplicate groups`
- 基线提交：`1bc9ead144601892feb13feaf53a6a6137df3904`（PR #23 合并提交）
- 基线 schema：28
- 目标 schema：29

本任务内部可以使用可审查的原子提交，但 Codex 不得在某个中间提交完成后停止并要求重新设计，也不得把本任务拆成多个阶段 PR。除非触发本文定义的停止条件，否则应一次性完成全部实现、测试、Closeout 和 Draft PR。

---

## 2. 任务目标

一次性完成以下能力：

1. 补齐 Task 01B 遗留的 watcher 规则恢复持久状态；
2. 建立 File Library 专用的轻量物理身份采集和 path→physical identity 映射；
3. 建立版本化、可失效、可复用的 prehash/full-hash fingerprint cache；
4. 将 dedupe 从内存 job 改为领域专用 durable run；
5. 实现 size → prehash → full hash 的分阶段检测流水线；
6. 排除 hardlink 对“可释放空间”的错误贡献；
7. 建立正式、持久、可分页的 duplicate group/member 模型；
8. 将文件库中的 duplicate 状态从重复 CTE 迁移到正式 group membership；
9. 提供可重启 hydrate、取消、重试、进度、错误和只读组审查 UI；
10. 保持现有 scan、watcher、Global Index、Managed AI、operation journal、Safe Trash 和 restore 安全边界不退化。

Task 02 只负责“识别与呈现重复事实”。它不执行删除、移动、重命名、自动保留副本或清理。重复组进入空间分析 Finding、风险分层和清理建议属于 Task 03。

---

## 3. 当前实现事实

实施前必须重新核验以下事实和源码符号；代码事实高于本文行号：

- `src-tauri/src/dedupe.rs::DedupeJobManager` 仅为进程内 `HashMap`；完成后删除 job 状态；
- `spawn_duplicate_detection` 每次生成新的内存 job ID；
- 当前流水线按 size 分组后直接进行单线程完整 BLAKE3；
- 哈希前后只用 size 和秒级 mtime 检查文件变化；
- 结果只写入 `files.content_hash`；
- duplicate 状态由多处 `(size, content_hash)` CTE 现场计算；
- 没有 durable dedupe run、phase、revision、字节进度、错误清单或启动恢复；
- 没有 duplicate group/member 表；
- 没有 hardlink/physical-copy 语义；
- `files.id` 仍是 path identity，不是跨路径稳定实体 ID；
- `fs_safety::identity::capture_identity` 会读取并完整哈希内容，适用于 mutation/restore 安全校验，不适合作为 dedupe 候选的轻量 identity 入口；
- Global Index 已有自己的 native identity，但 Task 02 不将其变成 File Library 主键，也不直接 join 两个数据域；
- Task 01A 的 scan session 只持久化 dedupe dispatch intent，允许 at-least-once；
- Task 01B 已将 watcher mutation owner 移到 Rust，并占用 schema 28；
- Task 01B 遗留问题：`watcher_last_error_code` 不能可靠表达跨后续事件仍待恢复的规则失败。

开始实施前还必须搜索并列出所有读取或写入以下字段/概念的源码：

```text
files.content_hash
is_duplicate
duplicateOnly
dedupe-progress
dedupe-complete
cancel_dedupe
dedupe_dispatch_state
dedupe_job_id
```

不得遗漏 classification、File Library、Organize、Storage、API、permission、browser mock 和测试中的消费者。

---

## 4. 冻结架构决定

### 4.1 不迁移 `files.id`

本任务不得把 path ID 改成 native ID，也不得更改 `files` 主键、operation journal 外键或现有 API 的 file ID 语义。

采用旁路映射：

```text
files.id（当前 path identity）
        ↓ 1:1
file_fingerprints.file_id
        ↓ contains
platform_volume_id + platform_file_id + physical_key
```

rename 后可以根据新旧路径观察到的相同 `physical_key` 安全复用 fingerprint，但不得把两行 `files` 强制合并成一个实体。

### 4.2 Operation identity 与 dedupe identity 分离

`fs_safety::ExpectedFileIdentity` 继续服务于文件 mutation、preview、journal 和 restore。Task 02 可以复用平台原生 ID 的采集思想或抽取不改变语义的轻量 helper，但不得弱化、替换或绕过 operation identity。

Dedupe physical identity 仅用于：

- 判断多个路径是否指向同一底层对象；
- 避免 hardlink 重复读取；
- 计算物理副本数量和可释放空间置信度；
- fingerprint cache 重用。

### 4.3 不建设通用 Job Runtime

`dedupe_runs` 是 dedupe 领域专用 ledger。不得复用或泛化 `ai_jobs`，不得让 scan、cleanup、operation 共用该表或 worker。

### 4.4 Dedupe 不修改用户文件

Task 02 的所有命令都是只读分析或数据库状态更新：

- 不删除；
- 不进入 Trash；
- 不移动或重命名；
- 不自动选择“保留副本”；
- 不调用 operation execution；
- 不创建 cleanup journal。

### 4.5 Fingerprint 是 authority，`files.content_hash` 是兼容镜像

完成迁移后：

- duplicate group 的唯一权威来源是 `file_fingerprints + duplicate_groups + duplicate_group_members`；
- `files.content_hash` 暂时保留，完整哈希成功时 CAS 同步写入，供旧分类和兼容路径使用；
- 旧 `files.content_hash` 不得直接 backfill 为已验证 fingerprint；
- 任何 duplicate UI/filter/query 不得继续以 `files.content_hash` CTE 作为最终事实；
- Task 02 不删除 `files.content_hash`，删除或彻底迁移留待后续兼容清理。

### 4.6 Prehash 只淘汰，不确认

相同 prehash 不能证明文件相同，只能决定是否进入 full hash。只有完整 BLAKE3 相同才建立 duplicate group。

### 4.7 Hardlink 不计为可释放副本

相同 `physical_key` 的多个路径属于同一物理对象：

- 可以在 member 列表中显示为 hardlink alias；
- hash 只读取一次；
- 不增加 `physical_copy_count`；
- 删除其中一个链接不被计入可释放空间；
- 只有至少两个不同物理对象具有相同 full hash，才属于实际内容重复组。

### 4.8 Crash 后不做逐文件断点续算

本任务不建立巨大的 per-run candidate queue。应用崩溃后：

- `queued/running/cancelling` run 在启动时转为 `interrupted`；
- 下一次 run 重新 collection；
- 已持久化且仍有效的 prehash/full hash 全部复用；
- 已完成 IO 不丢失；
- 旧 run 历史、统计和错误可查询；
- 不声称从精确文件偏移恢复。

---

## 5. Schema 29

Schema 28→29 必须在一个 `BEGIN IMMEDIATE` migration 中完成；失败时完整 rollback 并保持 28。不得要求用户删除数据库。

### 5.1 Task 01B 遗留字段

```sql
ALTER TABLE scan_roots
ADD COLUMN watcher_rule_recovery_required INTEGER NOT NULL DEFAULT 0
CHECK (watcher_rule_recovery_required IN (0, 1));
```

语义：

- watcher exact rule execution 最终失败时设为 1；
-普通 watcher batch begin/complete 不清除；
-overflow、rename、其他错误和最近错误字段变化不清除；
-managed reconciliation scan 根据该字段决定是否执行 root 级 `AllChangedOrRuleChanged`；
-只有 root 级规则恢复成功，且 finalization CAS 仍拥有 root/run/revision 时才清零；
-恢复失败继续保持 1、保留 `needs_reconciliation`，root 不得变为 healthy；
-`watcher_last_error_code` 继续只表示最近错误，不再作为 rule recovery owner。

### 5.2 `dedupe_runs`

建议完整 schema：

```sql
CREATE TABLE dedupe_runs (
    id TEXT PRIMARY KEY,
    request_key TEXT NOT NULL,
    request_attempt INTEGER NOT NULL DEFAULT 1 CHECK (request_attempt > 0),
    parent_scan_session_id TEXT,
    scope_json TEXT NOT NULL,
    scope_hash TEXT NOT NULL,
    scope_snapshot_json TEXT NOT NULL DEFAULT '{}',
    scope_snapshot_hash TEXT NOT NULL DEFAULT '',

    status TEXT NOT NULL CHECK (status IN (
        'queued', 'running', 'cancelling',
        'completed', 'completed_with_warnings',
        'cancelled', 'failed', 'interrupted'
    )),
    phase TEXT NOT NULL CHECK (phase IN (
        'collecting', 'capturing_identity', 'prehashing',
        'full_hashing', 'building_groups', 'finalizing', 'completed'
    )),

    revision INTEGER NOT NULL DEFAULT 1,
    cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
    rerun_required INTEGER NOT NULL DEFAULT 0 CHECK (rerun_required IN (0, 1)),

    candidate_files INTEGER NOT NULL DEFAULT 0,
    candidate_physical_objects INTEGER NOT NULL DEFAULT 0,
    candidate_bytes INTEGER NOT NULL DEFAULT 0,
    identity_verified_files INTEGER NOT NULL DEFAULT 0,
    identity_unknown_files INTEGER NOT NULL DEFAULT 0,
    hardlink_aliases INTEGER NOT NULL DEFAULT 0,
    prehashed_files INTEGER NOT NULL DEFAULT 0,
    prehash_pruned_files INTEGER NOT NULL DEFAULT 0,
    full_hashed_files INTEGER NOT NULL DEFAULT 0,
    duplicate_groups INTEGER NOT NULL DEFAULT 0,
    duplicate_members INTEGER NOT NULL DEFAULT 0,
    exact_reclaimable_bytes INTEGER NOT NULL DEFAULT 0,
    potential_reclaimable_bytes INTEGER NOT NULL DEFAULT 0,
    processed_files INTEGER NOT NULL DEFAULT 0,
    processed_bytes INTEGER NOT NULL DEFAULT 0,
    total_bytes INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,

    started_at INTEGER,
    finished_at INTEGER,
    last_checkpoint_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    error_code TEXT,
    error_message TEXT,

    UNIQUE(request_key, request_attempt)
);

CREATE UNIQUE INDEX idx_dedupe_runs_one_active_scope
ON dedupe_runs(scope_hash)
WHERE status IN ('queued', 'running', 'cancelling');

CREATE INDEX idx_dedupe_runs_created
ON dedupe_runs(created_at DESC, id);

CREATE INDEX idx_dedupe_runs_parent_scan
ON dedupe_runs(parent_scan_session_id, created_at DESC);
```

`scope_json` 第一版只允许：

```text
all_managed_file_library
explicit_enabled_scan_roots
```

不得接受任意路径、custom search roots、Global Index volume 或 unmanaged scope。

### 5.3 `file_fingerprints`

```sql
CREATE TABLE file_fingerprints (
    file_id TEXT PRIMARY KEY,
    path_snapshot TEXT NOT NULL,

    identity_status TEXT NOT NULL CHECK (identity_status IN (
        'verified', 'path_only', 'unsupported', 'missing', 'stale', 'error'
    )),
    platform_kind TEXT NOT NULL DEFAULT '',
    platform_volume_id TEXT,
    platform_file_id TEXT,
    physical_key TEXT,
    link_count INTEGER,

    size INTEGER NOT NULL,
    modified_ns INTEGER,

    prehash TEXT,
    prehash_algorithm TEXT NOT NULL DEFAULT 'blake3-head-tail',
    prehash_version INTEGER NOT NULL DEFAULT 1,
    prehash_sample_bytes INTEGER NOT NULL DEFAULT 4096,

    full_hash TEXT,
    full_hash_algorithm TEXT NOT NULL DEFAULT 'blake3',
    full_hash_version INTEGER NOT NULL DEFAULT 1,

    fingerprint_status TEXT NOT NULL CHECK (fingerprint_status IN (
        'identity_only', 'prehash_complete', 'complete', 'stale',
        'missing', 'unsupported', 'error'
    )),

    captured_at INTEGER NOT NULL,
    prehashed_at INTEGER,
    full_hashed_at INTEGER,
    last_verified_at INTEGER NOT NULL,
    error_code TEXT,
    error_message TEXT,
    revision INTEGER NOT NULL DEFAULT 1,

    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_fingerprints_physical
ON file_fingerprints(physical_key)
WHERE physical_key IS NOT NULL;

CREATE INDEX idx_file_fingerprints_validity
ON file_fingerprints(size, modified_ns, fingerprint_status);

CREATE INDEX idx_file_fingerprints_prehash
ON file_fingerprints(size, prehash)
WHERE prehash IS NOT NULL;

CREATE INDEX idx_file_fingerprints_full_hash
ON file_fingerprints(size, full_hash)
WHERE full_hash IS NOT NULL;
```

不能对 `physical_key` 建 UNIQUE，因为 hardlink 的多个 path row 会共享它。

### 5.4 `dedupe_run_errors`

```sql
CREATE TABLE dedupe_run_errors (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    file_id TEXT,
    path_snapshot TEXT NOT NULL,
    phase TEXT NOT NULL,
    error_code TEXT NOT NULL,
    error_message TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (run_id) REFERENCES dedupe_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_dedupe_run_errors_run
ON dedupe_run_errors(run_id, created_at, id);
```

每个 run 最多持久化 1000 条明细；超出数量只增加聚合计数并记录 `errors_truncated` warning，防止异常目录使数据库无界增长。

### 5.5 `duplicate_groups`

```sql
CREATE TABLE duplicate_groups (
    id TEXT PRIMARY KEY,
    size_each INTEGER NOT NULL,
    full_hash TEXT NOT NULL,
    full_hash_algorithm TEXT NOT NULL DEFAULT 'blake3',
    full_hash_version INTEGER NOT NULL DEFAULT 1,

    member_count INTEGER NOT NULL,
    physical_copy_count INTEGER NOT NULL,
    hardlink_alias_count INTEGER NOT NULL DEFAULT 0,
    exact_reclaimable_bytes INTEGER,
    potential_reclaimable_bytes INTEGER NOT NULL,
    reclaimable_confidence TEXT NOT NULL CHECK (reclaimable_confidence IN (
        'exact', 'estimated', 'unknown'
    )),

    status TEXT NOT NULL CHECK (status IN ('active', 'stale', 'superseded')),
    last_built_run_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_verified_at INTEGER NOT NULL,

    UNIQUE(size_each, full_hash, full_hash_algorithm, full_hash_version),
    FOREIGN KEY (last_built_run_id) REFERENCES dedupe_runs(id)
);

CREATE INDEX idx_duplicate_groups_active_reclaimable
ON duplicate_groups(status, potential_reclaimable_bytes DESC, size_each DESC, id);
```

Group ID 必须由版本化的 `(size, algorithm, version, full_hash)` 确定性生成，不得依赖 run ID。

### 5.6 `duplicate_group_members`

```sql
CREATE TABLE duplicate_group_members (
    group_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    path_snapshot TEXT NOT NULL,
    physical_key TEXT,
    identity_status TEXT NOT NULL,
    is_hardlink_alias INTEGER NOT NULL DEFAULT 0 CHECK (is_hardlink_alias IN (0, 1)),
    size INTEGER NOT NULL,
    modified_ns INTEGER,
    verified_at INTEGER NOT NULL,
    PRIMARY KEY (group_id, file_id),
    FOREIGN KEY (group_id) REFERENCES duplicate_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_duplicate_group_members_file
ON duplicate_group_members(file_id, group_id);

CREATE INDEX idx_duplicate_group_members_physical
ON duplicate_group_members(group_id, physical_key);
```

### 5.7 Migration/backfill

- 不把既有 `files.content_hash` 直接视为已验证 fingerprint；
- 不创建虚假 dedupe run/group 历史；
- 现有 hash 可以保留在 `files` 兼容列，首次新 run 根据 live identity 决定是否重新计算；
- schema 29 reopen 必须幂等；
- schema 30+ 继续拒绝；
- migration 失败后 schema、表、索引和 Task 01A/01B ledger 必须保持 28 原状；
- 需要真实 schema 28 fixture，包括 scan roots/runs/seen、watcher revision、AI、Global Index、operation/cleanup journal 和 rules。

---

## 6. Lightweight physical identity

必须新增不读取完整文件内容的 identity 入口，不能为了获取 native file ID 调用 `capture_identity`。

建议类型：

```rust
pub struct PhysicalFileIdentity {
    pub size: u64,
    pub modified_ns: Option<i64>,
    pub platform_kind: PlatformKind,
    pub platform_volume_id: Option<String>,
    pub platform_file_id: Option<String>,
    pub physical_key: Option<String>,
    pub link_count: Option<u64>,
}
```

规则：

- 使用 `symlink_metadata`；symlink/reparse point 返回 unsupported，不跟随；
- Windows 使用打开的 file handle 获取 volume serial、file index 和 number of links；
- Unix 使用 `MetadataExt` 的 device/inode/nlink；
- macOS 仍使用 dev+ino，不读取 Spotlight identity；
- 无法取得原生 ID时允许 `path_only`，不得伪造 physical key；
- `physical_key` 必须包含 platform/version，并对原始 volume/file IDs 做稳定编码；
- size/modified_ns 在 hash 前后重新采集；
- handle 能力可测试注入，不得在业务代码中散落 `cfg` 分支；
- 不修改 Global Index native identity 表或 provider。

### 6.1 Hardlink subject

Dedupe worker 的 IO 单位不是 path，而是 physical subject：

```text
verified physical_key → 同 key 只读取一次
path_only             → 每个 file_id 视为独立 subject
```

同一 subject 的 hash 结果要在一个 DB transaction 中写入全部仍满足 identity CAS 的 path members。

### 6.2 Rename cache reuse

发现新的 active file row 与旧/stale fingerprint 具有相同 verified physical key，且 live `(size, modified_ns, algorithm/version)` 一致时，可以复制或重新绑定已有 prehash/full hash，避免重复 IO。

不得：

- 只凭 name/path/size/秒级 mtime 复用；
-跨 volume 仅凭相同 size/mtime 复用；
-把 path_only identity 当成 rename 证明；
-删除旧 `files` row 或改写 journal。

---

## 7. Fingerprint validity and invalidation

### 7.1 有效缓存条件

缓存命中必须同时满足：

```text
active files row
+ live file exists and is regular file
+ not symlink/reparse
+ size equal
+ modified_ns equal when available
+ physical_key equal when cached identity is verified
+ algorithm/version equal
+ fingerprint_status supports requested stage
```

任一条件不满足即视为 stale，不得用于 group confirmation。

### 7.2 Scanner/watcher invalidation

Task 02 必须在现有 scanner 和 watcher metadata upsert transaction 中加入 fingerprint/group invalidation，但不得改变 scan generation、watcher revision 或 stale owner：

- size、mtime、is_dir 或 path-row lifecycle 变化时，将该 file fingerprint 标为 stale并清空兼容 `files.content_hash`；
- file row 被 stale/missing 时 fingerprint 同步 stale/missing；
-与该 file 相关的 active duplicate group 标记 stale；
-没有变化时不触碰 fingerprint；
- watcher 永不写 prehash/full hash；
- scanner 永不自行计算 hash；
- invalidation 必须是短事务，不能在 scanner/watcher transaction 中做文件 IO。

必须覆盖同一秒内内容变化：run collection 会比较 live `modified_ns`，不能只依赖 `files.mtime` 秒级字段。

### 7.3 Retention

- active file 的 complete fingerprint 持久保留；
- stale/missing fingerprint 保留 30 天以支持 rename 复用和诊断；
- stale/superseded group 保留 30 天；
- dedupe run 历史保留 90 天；
- run errors 保留 30 天或随 run 删除；
-每次 prune 最多删除 1000 行；
- active run/group publication transaction 期间不得 prune；
- retention 不得阻塞 File Library reader。

---

## 8. Dedupe pipeline

### 8.1 状态机

合法主路径：

```text
queued
→ running/collecting
→ running/capturing_identity
→ running/prehashing
→ running/full_hashing
→ running/building_groups
→ running/finalizing
→ completed|completed_with_warnings
```

取消：

```text
queued|running → cancelling → cancelled
```

失败：

```text
queued|running|cancelling → failed
```

启动恢复：

```text
queued|running|cancelling → interrupted
```

所有状态/phase/revision 更新必须 CAS，affected row 必须为 1。旧 worker 不得更新新 run 或覆盖 terminal 状态。

### 8.2 Admission and scope

- 第一版同一 `scope_hash` 只允许一个 active run；
- 相同 request key + request payload 幂等返回；
-已有 active run 收到同 scope 新请求时，不再启动第二 worker，而是设置 `rerun_required=1`；
- terminal run 的 retry 使用 `request_attempt + 1`；
- scan-triggered request key 使用 `scan-session:<session-id>`；
- manual request key 使用 UUID；
- scope 只包含 enabled File Library managed roots；
- explicit roots 必须从 `scan_roots` ID 解析，前端不能提交任意磁盘路径。

### 8.3 Collection snapshot

Run collection 时记录 enabled root 的：

```text
root id
last_successful_generation
watcher_revision
watcher_applied_revision
needs_reconciliation
```

形成 `scope_snapshot_hash`。

在 group publication 前重新计算：

-完全相同：可以发布 authoritative groups；
-发生变化：允许保留已验证 fingerprint cache，但本 run 只能 `completed_with_warnings + rerun_required=1`，不得用不完整集合替换所有 active group；
- scan-triggered run 自动安排一个合并后的 follow-up attempt；
- manual run 显示“索引在运行期间变化”，允许用户 retry；
-不得形成无限 rerun 循环；连续三次变化后转 requires-attention/warning。

### 8.4 Candidate collection

只包含：

- `files.is_dir = 0`；
- `files.is_stale = 0`；
- size > 0；
-属于 run scope；
-同 size 至少两个 active path row。

空文件继续排除，并在 UI 说明“空文件不纳入内容重复组”。

### 8.5 Prehash

- 阈值：`PREHASH_MIN_SIZE = 1 MiB`；
-大于等于阈值：读取头 4 KiB + 尾 4 KiB；size ≤8 KiB 时读取完整内容；
-算法：BLAKE3，加入 domain、version 和 file size；
-每个 physical subject 只读取一次；
-持久写入 `file_fingerprints.prehash`；
-同 `(size, prehash)` 中至少两个不同 physical subject 才进入 full hash；
-单例 prehash subject 被永久淘汰于当前 identity 版本，后续 run 直接复用；
-prehash 相同不能建立 group；
-低于 1 MiB 的 size collision subject 直接进入 full hash。

### 8.6 Full hash

- 使用 BLAKE3；保持与当前 `files.content_hash` 兼容的 hash 值格式；
-固定 1 MiB buffer 手动 read loop；
-每个 chunk 检查 cancel；
-持续累计 processed bytes；
- hash 前后重新 capture lightweight identity；
- before/after 不一致则结果丢弃，记录 `file_changed_during_hash`；
-写入时再次 CAS file active、size、mtime/path snapshot 和 fingerprint revision；
-成功后同步 `files.content_hash` 兼容镜像；
-取消时必须 flush 已经完成且通过 CAS 的 fingerprint，不浪费已完成 IO；
-取消后不发布 partial duplicate groups。

### 8.7 Worker pool

不得新增 Rayon 或其他并发依赖。

使用 `std::thread`/`thread::scope` + bounded `sync_channel`：

-默认 worker 数：`min(4, available_parallelism)`，至少 1；
-环境覆盖：`ZEN_CANVAS_DEDUPE_HASH_WORKERS=1..8`；
-非法值回退默认并产生 warning；
-DB writer 单线程批量提交；
-worker 不直接长时间持有 SQLite transaction；
-队列有界，防止候选全量堆入内存；
-同 physical subject 不重复调度；
-测试至少覆盖 1 worker 和多 worker 结果一致。

### 8.8 Progress

Durable run 与事件均包含：

- status/phase/revision；
- processed/total files；
- processed/total bytes；
- identity/prehash/full-hash/group counters；
- warnings/errors；
- current path 可选且不得持久保存过长敏感路径历史。

事件仍保持节流，renderer 先 hydrate run snapshot，再以 revision 水位过滤旧事件。

### 8.9 Error policy

Per-file 以下错误属于 warning，可继续：

- missing；
-permission denied；
-unsupported/symlink/reparse；
-file changed during hash；
-identity unavailable（降级 path_only）；
-CAS miss。

以下为 fatal：

- schema/repository invariant；
-run lease/revision owner 丢失；
-无法写 durable run/fingerprint/group；
-worker protocol corruption；
-database corruption。

Warning run 可以 `completed_with_warnings`，但不得把未验证 member放进 exact group。

---

## 9. Duplicate group publication

### 9.1 Group 条件

只有：

```text
same size
+ same complete full hash
+ active files rows
+ valid fingerprint
+ at least 2 distinct physical subjects
```

才是 active duplicate group。

Hardlink-only aliases 不建立内容重复组；可以通过 fingerprint/member诊断显示，但 `duplicateOnly` 不应把纯 hardlink alias 当成可清理重复。

### 9.2 Reclaimable semantics

- `member_count`：所有 path members；
- `physical_copy_count`：distinct verified physical key；path-only member 单独计 potential subject；
- `hardlink_alias_count = member_count - physical path representatives`；
-所有 member identity verified 时：
  - `exact_reclaimable_bytes = size × (physical_copy_count - 1)`；
  - confidence=`exact`；
-存在 path_only/unknown identity 时：
  - `exact_reclaimable_bytes = NULL`；
  - `potential_reclaimable_bytes = size × (potential physical subjects - 1)`；
  - confidence=`estimated` 或 `unknown`；
-UI 不得把 potential 显示为“可安全释放”；只能显示“最多可能释放，需检查”。

### 9.3 Atomic publication

Group publication必须在短事务中：

1. 根据当前有效 fingerprints 构造本 run group set；
2. upsert deterministic groups；
3.替换对应 members；
4.设置 `last_built_run_id`；
5.只有 scope snapshot 未变化时，才把本 scope 中未被本 run 重建的旧 active groups 标 stale；
6.更新 run 统计和 terminal revision。

不得先删除全部 groups 再长时间重建，不得让 reader 观察到空窗。

### 9.4 Group invalidation

任何 member fingerprint 失效、file stale/missing 或 scope root 禁用时，相关 group 必须立即标 stale；查询默认只返回 active group。

---

## 10. Dedupe dispatch 与启动恢复

### 10.1 Scan session integration

Task 01A 的 `scan_sessions.dedupe_*` 保留为 dispatch intent：

- claim 后创建或复用 durable `dedupe_runs`；
- `dedupe_job_id` 改为记录 run ID；
-同一 scan session 重放不得生成多个 active run；
-如果 run 已 complete，dispatch 可确认完成；
-如果 run interrupted/failed，按 retry budget 生成下一 attempt；
- at-least-once 仍允许重复 collection，但 fingerprint cache 和 run admission避免重复 IO/并行 worker；
-不得让 dedupe terminal 反向修改 scan generation、stale 或 scan terminal status。

### 10.2 Startup

应用启动时：

1. 将 active dedupe runs 标记为 interrupted；
2.保留 fingerprint cache；
3. scan-triggered interrupted run 将对应 scan session dispatch 恢复为可重试状态；
4. manual interrupted run显示 retry；
5.清理孤立的内存 cancel handle；
6.验证 active group/member 的 fingerprint validity；明显无效 group 标 stale；
7.不自动进行无限全盘 hash。

### 10.3 Cancel

- cancel command 先 CAS `cancel_requested=1,status=cancelling`；
-再设置内存 flag；
-worker 逐 chunk 和阶段边界响应；
-terminal snapshot 后 UI 才显示 cancelled；
-已完成 fingerprint 保留；
-不发布 partial groups；
-取消任一 dedupe run不取消 scan session或其他 run。

---

## 11. API, events and permissions

新增或替换为：

```text
start_dedupe_run
authorize/start by managed scope ids only
cancel_dedupe_run
retry_dedupe_run
get_dedupe_run
list_dedupe_runs
get_active_dedupe_run
list_duplicate_groups
get_duplicate_group
get_file_duplicate_membership
```

### 11.1 DTO

Run DTO 必须暴露 status、phase、revision、files/bytes、warnings/errors、scope、start/end 和 retry/rerun 状态。

Group list DTO：

```text
id
size_each
member_count
physical_copy_count
hardlink_alias_count
exact_reclaimable_bytes
potential_reclaimable_bytes
reclaimable_confidence
representative names/paths (bounded)
updated_at
```

Group detail按需加载全部 members。

### 11.2 Pagination

Duplicate group list 使用本模块专用 keyset cursor，不等待 Query V2：

```text
potential_reclaimable_bytes DESC
size_each DESC
full_hash ASC
id ASC
```

Cursor 必须签名/校验版本或至少严格解析，不接受任意 SQL 字段。该 cursor 只服务 duplicate groups，不得提前改造整个 File Library Query V1。

### 11.3 Legacy compatibility

兼容期保留：

```text
dedupe-progress
dedupe-complete
cancel_dedupe
parentScanJobId 字段
```

旧命令/事件适配到 durable run；不得继续启动第二套旧 worker。前端迁移完成后，legacy 事件只作为兼容投影。

需要更新 Tauri allowlist/permission、browser mock、TypeScript API、DTO 和 contract tests。

---

## 12. Frontend and product surface

### 12.1 Durable run projection

新增领域 store（或明确拆分现有 scan store）：

-启动时 hydrate active/recent dedupe run；
-按 revision 接收事件；
-gap 时 refetch；
-cancelling 与 cancelled 分离；
-renderer 不推断 terminal；
-重启后可继续查看 interrupted/completed 历史；
-不把 scan session status 当 dedupe run status。

### 12.2 Duplicate Groups UI

提供只读审查界面，至少包含：

-当前/最近一次查重状态；
-阶段、文件进度和字节进度；
-取消、失败重试；
-重复组总数、成员数、精确/潜在空间；
-按 reclaimable keyset 加载 group；
-展开成员路径、identity 状态和 hardlink alias；
-open/reveal；
-空文件排除说明；
-identity unknown 显示“需检查”；
-不得提供删除、自动保留、批量清理或文件 mutation 按钮。

### 12.3 Existing duplicate consumers

必须迁移所有：

- File Library `duplicateOnly`；
- row `is_duplicate`；
- Organize suggestion 的 duplicate evidence；
- classification duplicate input；
-任何 storage summary；

到正式 active group membership。不得保留三套重复 CTE 和 group 表双重事实。

如果某个旧 consumer 暂时必须兼容，必须由同一个 repository helper投影 group membership，不得重新写 `(size, content_hash)` SQL。

---

## 13. Retained watcher rule recovery debt

这是 Task 02 的**第一个生产改动**，但不是独立任务或独立 PR。

必须覆盖交错场景：

```text
A 文件规则执行失败
→ watcher_rule_recovery_required = 1
→ B 文件正常 watcher batch 成功
→ 最近错误字段可以变化/清空
→ recovery flag 仍为 1
→ 应用重启或 scheduler full reconciliation
→ root 级规则恢复仍执行
→ 成功后 flag 清零
```

测试必须包括：

-正常 watcher batch 不清 flag；
-overflow/rename/其他 error不清 flag；
-restart 保留；
-full recovery 成功清零；
-full recovery 失败保留；
-user correction 不覆盖；
-root flag=1 时 finalization 不得 healthy；
-schema 28→29 和 rollback。

完成后在风险登记中关闭该遗留项。

---

## 14. Allowed modification scope

允许：

```text
src-tauri/src/dedupe.rs 或拆分后的 src-tauri/src/dedupe/
src-tauri/src/fs_safety/ 中新增轻量 physical identity helper
src-tauri/src/db/schema.rs
src-tauri/src/db/queries/scan.rs（仅 watcher flag、dispatch 和 fingerprint invalidation）
src-tauri/src/db/queries/files.rs（duplicate membership projection）
src-tauri/src/db/ 下新的 dedupe/fingerprint repository
src-tauri/src/scanner.rs（dispatch、startup、invalidation integration）
src-tauri/src/watcher.rs（rule recovery flag/invalidation integration）
src-tauri/src/main.rs
src-tauri/capabilities/ 与 permission
src/api/tauriApi.ts
相关 store、duplicate UI、File Library/Organize consumer
browser mock
相关 Rust/TS/integration/performance tests
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
docs/remediation/REMEDIATION_RISK_REGISTER.md
docs/remediation/TASK_02_IMPLEMENTATION_CLOSEOUT.md
```

禁止：

```text
src-tauri/src/global_index/ provider/schema/identity
Managed AI schema/worker/policy
files.id 主键迁移
operation journal
cleanup journal
Safe Trash/restore execution
storage analyzer Finding 架构（Task 03）
Query V2 通用 cursor/snapshot（Task 04）
Organization Plan
Content Artifact/NL Rule/Spotlight 重构
installer/version/tag/release
新第三方依赖或 lockfile 变化
```

若为了 hardlink 测试需要平台 API，只能使用现有标准库或现有依赖。

---

## 15. Tests

### 15.1 Migration

-空数据库→29；
-真实 schema 28 fixture→29；
-watcher rule recovery flag default；
-不 backfill 虚假 fingerprint/run/group；
-scan/watcher/AI/Global/journal/rules 数据保持；
-故意制造中途冲突，验证完整 rollback至28；
-29 reopen 幂等且已有 run/fingerprint/group 行保留；
-30 future schema拒绝；
-100k files fixture migration 时间和 WAL reader。

### 15.2 Watcher debt

执行第 13 节全部交错测试。

### 15.3 Identity

- Windows volume/file id/link count；
- Unix dev/inode/nlink；
-symlink/reparse skipped；
-path_only fallback；
-hardlink 多路径同 physical key；
-普通副本不同 physical key；
-rename 复用；
-cross-volume 不误复用；
-case/separator normalization；
-same-second content change 由 modified_ns 发现；
-identity capture 不读取完整文件（mock/reader instrumentation）。

### 15.4 Fingerprint

- size singleton 不 hash；
-小文件 size collision full hash；
-大文件 prehash 全异跳过 full hash；
-prehash 相同但 full hash 不同不建组；
-真实重复建组；
-prehash/full hash cache hit 零内容 IO；
-算法/version 变化失效；
-file changed before/during/after hash；
-CAS miss；
-hardlink 只 hash 一次；
-cancel flush 已完成 cache；
-stale/missing invalidation；
-rename cache reuse；
-多 worker 与 1 worker 结果一致。

### 15.5 Durable run

- admission idempotency；
-同 scope唯一 active；
-rerun_required coalescing；
-status/phase/revision CAS；
-startup interrupted；
-scan-triggered retry；
-manual retry；
-cancel queued/running；
-terminal 不回退；
-per-file error cap/truncation；
-scope snapshot change不发布不完整 replacement；
-连续变化有 retry 上限。

### 15.6 Groups

-hardlink-only 不建内容重复组；
-2 true copies exact reclaim；
-2 hardlinks + 1 true copy 的 member/physical/reclaim 数；
-unknown identity 只给 potential；
-deterministic group id；
-member change group revision；
-file invalidation group stale；
-atomic publication无空窗；
-old groups stale；
-keyset 并列翻页不重复/不遗漏；
-get file membership；
-legacy content_hash 不产生虚假 group。

### 15.7 Frontend/API

-hydrate/revision/gap；
-cancelling/cancelled；
-restart interrupted/history；
-files+bytes progress；
-group list/detail/cursor；
-hardlink/unknown labels；
-no mutation action；
-duplicateOnly来自 group membership；
-Organize/classification不再使用独立 duplicate CTE；
-legacy event/command兼容；
-browser mode mock。

### 15.8 Performance

最低基准：

-100k files candidate collection；
-100k fingerprint index/query；
-10k same-size mock candidates prehash grouping；
-10k group members publication；
-1000 × 16MiB 临时文件的 1-worker/默认-worker IO benchmark（可标记本地专项，CI使用缩小夹具）；
-WAL reader p95；
-batch fingerprint write；
-keyset group page；
-bounded memory/queue；
-prune 1000 rows。

性能报告必须区分：

```text
identity IO
prehash bytes
full hash bytes
DB write
publication
cold/warm cache
1 worker/default workers
```

不得只报告 optimize 后单一数字。

---

## 16. Rollout and rollback

- schema 29 commit 前：transaction rollback；
- commit 后：只能使用 schema-29-capable binary 关闭新 dedupe UI/worker；schema-28 binary继续拒绝 future schema；
-提供临时 `ZEN_CANVAS_DURABLE_DEDUPE=false` gate，仅用于故障隔离；
- gate=false 时不得恢复旧内存 worker作为第二 owner；允许禁用自动运行并保留只读旧 `files.content_hash` 投影，但必须明确 degraded；
- legacy `dedupe-progress/complete/cancel_dedupe` 适配新 owner，不形成双轨；
-新表可以在 rollback build 中保留；
-不降级 user_version；
- rollout 不改变任何文件 mutation 路径；
- Task 03 前不开放清理动作。

兼容层删除条件必须写入 Closeout：至少一个后续稳定版本、无 legacy consumer、contract tests迁移完成。

---

## 17. Atomic commits inside one PR

本任务是一个完整任务，不设置中途人工验收点。建议在同一个分支和 Draft PR 中按以下顺序提交：

1. `db: add schema 29 dedupe and fingerprint ledger`
2. `watcher: persist pending rule recovery state`
3. `identity: add lightweight physical file identity`
4. `dedupe: add durable run coordinator and recovery`
5. `dedupe: add prehash and bounded full hash workers`
6. `dedupe: publish durable duplicate groups`
7. `api: expose durable dedupe runs and groups`
8. `ui: project dedupe runs and read-only duplicate groups`
9. `test: cover migration identity hardlinks and crash safety`
10. `docs: close Task 02 implementation`

这些只是 commit 建议，不是可单独执行或停止的子任务。Codex 应连续完成整个 Task 02。

---

## 18. Acceptance criteria

Task 02 只有同时满足以下条件才可验收：

- schema 28→29 安全、rollback、reopen、future guard全部通过；
-watcher rule recovery flag 完整解决遗留交错问题；
-`files.id` 未迁移；
-Global Index/Managed AI/journal未修改；
-dedupe run 跨重启可查询，active crash标 interrupted；
-取消保留已完成 fingerprint且不发布 partial groups；
-prehash 只淘汰、full hash确认；
-hardlink-only不被计为可释放重复；
-真实物理副本数量和 reclaimable confidence正确；
-duplicate groups/member持久、原子发布、可分页；
-file变化会失效 fingerprint/group；
-所有 duplicate consumer使用 group membership；
-没有删除/移动/清理动作；
-冷/热缓存、字节进度和性能数据完整；
-Windows/macOS CI、依赖审计、installer/package gate通过；
-没有新增依赖或 lockfile修改；
-Task 03 未开始。

---

## 19. Stop conditions

出现以下任一情况必须停止并汇报，不得自行扩大范围：

-需要迁移 `files.id`；
-需要修改 Global Index provider/schema；
-需要泛化 Managed AI queue；
-需要修改 operation/cleanup journal；
-需要执行文件删除、移动或自动清理；
-需要建设 Task 03 Finding；
-需要建设 Query V2；
-需要新增第三方依赖；
-无法在 schema 28 fixture 上安全迁移；
-无法用轻量 identity 识别 hardlink且只能通过完整 operation identity 扫全文件；
-无法保证 group publication 原子性；
-无法保证 scanner/watcher invalidation不改变其 generation/revision owner；
-平台 native identity 导致 mutation safety helper语义退化；
-发现现有 Task 01B 规则恢复遗留需要独立 schema 之外的大规模 watcher重构。

---

## 20. Closeout and delivery

完成后新建：

```text
docs/remediation/TASK_02_IMPLEMENTATION_CLOSEOUT.md
```

并更新：

```text
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
docs/remediation/REMEDIATION_RISK_REGISTER.md
```

Closeout 必须记录：

1. 实际基线和最终 HEAD；
2. schema 29 SQL、migration、rollback；
3. watcher rule recovery遗留关闭证据；
4. identity/physical key平台实现；
5. fingerprint validity/invalidation；
6. prehash/full hash/worker参数；
7. durable run状态机和启动恢复；
8. hardlink和 reclaimable语义；
9. group publication和cursor；
10. legacy compatibility；
11.完整测试和性能；
12.已知风险；
13.明确说明没有文件 mutation；
14.Task 03仍未开始。

最终 Draft PR 必须保持 Draft，等待人工代码级验收，不得自动合并或开始 Task 03。