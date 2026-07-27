# Task 02A — Watcher Rule Recovery and Durable Dedupe Run Foundation

## 1. 任务状态

- 状态：任务书已完成架构设计；文档 PR 合并后可执行
- 类型：生产代码、SQLite migration、Rust/Tauri、兼容前端投影和测试
- 建议实施分支：`remediation/02a-durable-dedupe-runs`
- 建议 Draft PR：`feat: add durable dedupe runs`
- 基线：`master` 必须包含 PR #23 合并提交 `1bc9ead144601892feb13feaf53a6a6137df3904`
- 基线 schema：28
- 目标 schema：29
- 前置：Task 01A、Task 01B 已合并
- 后续：Task 02B、Task 02C 继续禁止执行，直到本阶段通过人工验收并合并

本任务是原 Task 02（Identity/Fingerprint/Dedupe）的第一个可审查子阶段。它只建立可靠的持久运行时和修复 Task 01B 延后的规则恢复事实，不在同一个 PR 中同时重写哈希算法、建立 duplicate group 或迁移文件身份。

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
13. 当前 `dedupe.rs`、scan dispatch/recovery、schema、files queries、Tauri API、前端 scan/dedupe store 和对应测试。

`BRIEF.md`、`00-overview.md`、`01-dedupe.md` 等材料只能作为调研参考，不具有执行授权。出现冲突时以本任务书、当前源码和安全测试为准。

---

## 3. 当前实现事实

实施前必须重新核验以下事实，不得仅复制本文：

### 3.1 当前 dedupe pipeline

当前 `src-tauri/src/dedupe.rs`：

- `DedupeJobManager` 只在进程内保存 `HashMap<String, DedupeJob>`；
- `spawn_duplicate_detection` 自动生成 job ID，并通过 `spawn_blocking` 启动；
- worker 完成后从内存 manager 删除；
- candidate 先按 `files.size` 分组，只选择 `content_hash = ''` 的文件；
-每个候选执行完整 BLAKE3；
-哈希前后验证 size/mtime，写入时再做 CAS；
-进度按文件数，不按字节；
-只有 `dedupe-progress` 与 `dedupe-complete` 事件，没有可查询的 durable run；
-取消只修改进程内 `AtomicBool`；
-应用崩溃后无法查询上次 dedupe 的终态、阶段、统计或错误。

### 3.2 当前 dispatch durable 事实

Task 01A 已在 `scan_sessions` 中建立：

- `dedupe_requested`；
- `dedupe_dispatch_state`；
- `dedupe_attempt_count`；
- `dedupe_job_id`；
- `dedupe_last_error`。

这些字段只表示 **scan session 到 dedupe 的派发意图和最近一次链接**，不等于 dedupe run ledger。Task 02A 不删除这些字段；它们在兼容期继续作为 scan 侧 projection。

### 3.3 当前 hash cache

`files.content_hash` 已经是有效的完整哈希缓存：

- file metadata 变化时会清空；
-哈希前后检查磁盘身份；
-写入时检查 `id/size/mtime/is_stale`；
-已哈希文件不会再次进入完整哈希候选。

Task 02A 保留该缓存，不新建重复 full-hash cache，不改变 hash algorithm。

### 3.4 Task 01B 延后问题

Task 01B 的规则恢复是否存在，当前仍通过 `scan_roots.watcher_last_error_code` 间接判断。普通 watcher batch 的 begin/complete 会清理“最近错误”，因此未恢复的规则失败可能在 full reconciliation 前丢失。

Task 02A 必须首先引入独立 durable fact：

```text
watcher_rule_recovery_required
```

最近错误字段继续只负责展示，不能再充当待办状态 owner。

---

## 4. 本阶段目标

Task 02A 必须完成：

1. 修复 watcher rule recovery 的独立持久事实；
2. schema 28 → 29；
3. 建立领域专用 `dedupe_runs` 持久账本；
4. 建立 dedupe run error ledger；
5. 让 run ID、status、phase、revision、取消、统计和终态跨重启可查询；
6. 将现有完整哈希 pipeline 接入 durable run，而不改变其算法；
7. 建立单一 dedupe worker owner 和有界 queued-run pump；
8. 对崩溃、取消、scan dispatch 和启动恢复定义明确语义；
9. 保留旧 Tauri command/event 的兼容期；
10. 为 Task 02B 的 prehash/physical identity 和 Task 02C 的 duplicate groups 提供稳定基础。

---

## 5. 明确非目标

本阶段禁止：

- 直接迁移或改写 `files.id`；
-把 Global Index 的 `platform_file_id` 直接写入 `files` 主键；
-建立 `file_fingerprints` 或 native identity mapping 表；
-实现 prehash；
-实现头尾采样；
-实现 hard-link 排除；
-实现并行 hash worker pool；
-改变 BLAKE3；
-建立 `duplicate_groups` 或 group members；
-计算正式 reclaimable bytes；
-建设 Analysis Run/Finding；
-建设清理执行；
-自动删除、移动、重命名或合并文件；
-修改 operation journal、cleanup journal、Safe Trash 或 restore；
-修改 Global Index、Managed AI、Content Artifact、Query V2、Organization Plan；
-泛化 `ai_jobs`；
-建设跨领域通用 Job Runtime；
-恢复或 cherry-pick 已关闭 PR #21；
-开始 Task 02B、02C 或 Task 03。

---

## 6. 冻结架构决定

### 6.1 领域 owner

- `dedupe_runs` 由 Rust dedupe coordinator 独占写入；
- `scan_sessions` 只记录派发意图和最近关联 run；
- renderer 只发起、取消、查询和投影；
- `DedupeJobManager` 可以保留为 active worker 的进程内 cancellation registry，但不再是状态事实来源；
- SQLite 是 run status、phase、revision、统计、错误和终态的唯一事实来源。

### 6.2 全局单 worker

当前 dedupe 对整个 managed `files` 数据域执行，不能安全地把两个 run 当作互不相关的 root job。

因此：

- 任意时刻最多一个 run 处于 `running` 或 `cancelling`；
-允许多个 `queued` run；
- queued run 按 `created_at, id` 顺序 claim；
-后续 scan session 的请求不得错误地把“更早启动、可能未看到本次扫描结果”的 active run当作已经满足；
-允许多个 queued run 顺序执行，Task 02A 不提前实现 coalescing；
-重复 run 是只读/缓存写入型计算，允许发生，但必须保持文件操作零副作用；
-Task 02B 可以在充分测试后再决定是否安全合并 queued requests。

### 6.3 run identity

- durable `dedupe_runs.id` 就是新的 dedupe job ID；
- worker 不得在 spawn 时另生成第二个 ID；
- scan session `dedupe_job_id` 指向最新关联的 durable run；
- retry 创建新 run，并通过 `retry_of_run_id` 保留关系；
-不复用 terminal run ID；
-旧事件中的 `dedupeJobId` 与 durable run ID 相同。

### 6.4 at-least-once

- scan-triggered dedupe 保持 at-least-once；
-崩溃前已完成的 `content_hash` 写入允许被新 run复用；
-重试可以重新收集候选并从头执行 pipeline；
-不承诺跨崩溃 exactly-once；
-重复计算不得改变 scan generation、stale、watcher revision、用户文件或任何恢复账本。

---

## 7. Schema 29

迁移必须在现有 `BEGIN IMMEDIATE` 事务中完成，并继续保留 future-schema rejection。

### 7.1 watcher rule recovery fact

向 `scan_roots` 增加：

```sql
ALTER TABLE scan_roots
ADD COLUMN watcher_rule_recovery_required INTEGER NOT NULL DEFAULT 0
CHECK (watcher_rule_recovery_required IN (0, 1));
```

语义：

- watcher exact rule execution 最终失败时设为 `1`；
-普通 watcher batch begin/complete 不得清除；
-overflow、rename、permission 或其他最近错误不得覆盖；
-full managed reconciliation 根据该字段决定是否运行 root-level `AllChangedOrRuleChanged`；
-只有 root-level rule recovery 成功，并在 finalization CAS 事务中确认 run 仍拥有 root lease/revision 后，才设为 `0`；
-恢复失败继续为 `1`；
-字段为 `1` 时，root 不得被标记为 `healthy`，`needs_reconciliation` 不得清除；
-`watcher_last_error_code/message` 仍可被最近事件更新或清理，但只负责诊断展示。

### 7.2 dedupe_runs

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
        CHECK (phase IN ('collecting', 'hashing', 'finalizing', 'completed')),

    cancel_requested INTEGER NOT NULL DEFAULT 0
        CHECK (cancel_requested IN (0, 1)),

    candidate_files INTEGER NOT NULL DEFAULT 0 CHECK (candidate_files >= 0),
    candidate_bytes INTEGER NOT NULL DEFAULT 0 CHECK (candidate_bytes >= 0),
    processed_files INTEGER NOT NULL DEFAULT 0 CHECK (processed_files >= 0),
    processed_bytes INTEGER NOT NULL DEFAULT 0 CHECK (processed_bytes >= 0),
    hashed_files INTEGER NOT NULL DEFAULT 0 CHECK (hashed_files >= 0),
    hashed_bytes INTEGER NOT NULL DEFAULT 0 CHECK (hashed_bytes >= 0),
    duplicate_files INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_files >= 0),
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
```

索引：

```sql
CREATE INDEX idx_dedupe_runs_status_created
ON dedupe_runs(status, created_at, id);

CREATE INDEX idx_dedupe_runs_session_created
ON dedupe_runs(parent_scan_session_id, created_at DESC);

CREATE INDEX idx_dedupe_runs_finished
ON dedupe_runs(finished_at DESC)
WHERE finished_at IS NOT NULL;

CREATE UNIQUE INDEX uq_dedupe_runs_request_key
ON dedupe_runs(request_key)
WHERE request_key IS NOT NULL;

CREATE UNIQUE INDEX uq_dedupe_runs_single_worker
ON dedupe_runs((1))
WHERE status IN ('running', 'cancelling');
```

迁移测试必须证明 SQLite 目标版本支持常量表达式 partial unique index。若实际 SQLite 构建不支持，停止并汇报；不得悄悄放宽为“每个 status 一个 active run”。

### 7.3 dedupe_run_errors

```sql
CREATE TABLE dedupe_run_errors (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES dedupe_runs(id) ON DELETE CASCADE,
    file_id TEXT,
    path TEXT,
    error_code TEXT NOT NULL,
    error_message TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_dedupe_run_errors_run_created
ON dedupe_run_errors(run_id, created_at, id);
```

只记录需要诊断的文件级错误。不得把每个正常 skip 写成 error row。

### 7.4 不新增的表

Task 02A 不创建：

```text
file_fingerprints
dedupe_run_items
duplicate_groups
duplicate_group_members
analysis_runs
analysis_findings
```

---

## 8. Migration 与 backfill

### 8.1 schema 28 → 29

必须验证：

-空数据库直接到 29；
-真实 schema 28 fixture 到 29；
-Task 01A scan ledger、Task 01B watcher columns 和数据保留；
-Global Index、Managed AI、rules、files、operation/cleanup journal 保留；
-迁移失败时 `user_version` 仍为 28，列、表和索引无半成品；
-schema 29 reopen 幂等；
-schema 30 被拒绝；
-100k `files` fixture 的 migration 时长和 WAL reader 影响。

### 8.2 backfill

-所有现有 root 的 `watcher_rule_recovery_required` 默认 `0`；
-不根据历史 `watcher_last_error_code` 猜测并 backfill `1`，避免把过时诊断变成永久待办；
-`dedupe_runs` 不伪造历史；
-现有 `scan_sessions.dedupe_job_id` 不回填为虚构 run；
-若某 session 在升级时 `dedupe_dispatch_state` 为 pending/unknown/failed，由现有启动恢复路径创建新的 schema-29 run。

---

## 9. Dedupe run 状态机

### 9.1 status

合法 transition：

```text
queued -> running
queued -> cancelled

running -> cancelling
running -> completed
running -> failed
running -> interrupted

cancelling -> cancelled
cancelling -> failed
cancelling -> interrupted
```

terminal：

```text
completed
cancelled
failed
interrupted
```

terminal 不得回到 active。retry 必须创建新 run。

### 9.2 phase

```text
collecting -> hashing -> finalizing -> completed
```

规则：

- `queued` 初始 phase=`collecting`；
- claim 后仍可在 collecting 统计候选；
- candidate snapshot 完成后进入 hashing；
-哈希循环结束进入 finalizing；
- terminal status 写入时 phase=`completed`；
- failed/cancelled/interrupted 也将 phase 设为 `completed`，原失败点通过 result/error 保留；
- phase 不得倒退。

### 9.3 revision

-每次 status、phase、cancel flag、checkpoint 或 terminal 更新原子递增 `revision`；
-worker 更新必须带 expected revision 或等价 CAS；
-旧 worker、迟到 checkpoint 和重复 terminal update affected-row 必须为 0，并被安全拒绝；
-事件携带 durable revision；
-renderer 先 hydrate，再按 run ID + revision 过滤；
-revision gap 触发 refetch，不由 renderer猜测状态。

---

## 10. Admission、queue 与 worker pump

### 10.1 创建 run

提供领域 repository：

```text
create_dedupe_run
claim_next_dedupe_run
checkpoint_dedupe_run
request_dedupe_cancel
finalize_dedupe_run
interrupt_active_dedupe_runs_on_startup
list/get/retry
```

### 10.2 scan session dispatch

scan session 派发必须：

1. CAS claim `dedupe_dispatch_state`；
2. 在同一数据库事务或可证明不会丢失的补偿协议中创建 `dedupe_runs` queued row；
3. 使用稳定 request key，例如：
   `scan-session:<session-id>:dedupe-attempt:<attempt>`；
4. 将 `scan_sessions.dedupe_job_id` 指向新 run；
5.记录 dispatched/failed；
6.唤醒 worker pump。

不得先 spawn 内存 worker、后补 durable row。

### 10.3 manual start

-每次明确用户操作创建新的 queued run；
-可以接受调用方 request key 以防按钮双击，但相同 key 必须校验 canonical request；
-Task 02A 的 manual run仍扫描整个 managed `files` 数据域；
-不接受任意文件路径列表或 unmanaged scope。

### 10.4 worker pump

-任何时刻最多一个 running/cancelling；
-claim oldest queued；
-claim 与 single-worker unique index共同保护；
-claim 成功后才注册进程内 cancel flag；
-worker terminal 后自动尝试 claim 下一个；
-启动时完成 recovery 后启动 pump；
-pump 异常不得导致应用崩溃，应留下 queued/failed/interrupted durable 状态。

---

## 11. 将现有算法接入 durable run

Task 02A 不改变候选和哈希算法，但必须重构执行入口，使其接受 durable run ID。

### 11.1 candidate collection

-收集 candidate files 和 candidate bytes；
-持久 phase/counters；
-仍使用 `is_dir=0, is_stale=0, size>0, content_hash=''`；
-不得把空文件计为可释放重复；
-查询或 DB failure 使 run failed。

### 11.2 hashing

-仍为单线程完整 BLAKE3；
-每个文件前检查 durable cancel flag和进程内 flag；
-哈希前后身份检查保持；
-content_hash CAS 保持；
-每个 batch 或最多约 200ms 做 durable checkpoint，禁止每个 chunk 一次 SQLite 写；
-processed/hashed bytes 使用文件 size 累计；
-取消后未处理数量不能与 CAS skip 混为同一语义：
  - `skipped_files` 只表示已选择但由于 identity/CAS/策略跳过；
  -未开始的剩余候选写入 `result_json.cancelledRemainingFiles` 或明确独立字段；若需要新增字段，应在本任务实施前停止并请求任务书修订，不得偷偷重解释计数。

### 11.3 finalization

-重新计算当前 duplicate file count仅作为兼容统计；
-Task 02A 不创建正式 group；
-completed/cancelled/failed/interrupted 都持久化终态和 summary；
-事件 emit 失败不得反转 durable terminal；
-文件级 IO error进入 bounded `dedupe_run_errors`，并累计 error_files；
-单个文件 IO error不是整个 run fatal；DB/schema/worker owner failure可以 fatal。

---

## 12. 启动恢复

应用启动时，在接受新 dedupe start 前：

1. 将遗留 `running/cancelling` run 标记为 `interrupted`；
2.保留已写入的 `files.content_hash`；
3.保留 queued run；
4.恢复 scan session pending/unknown/failed dispatch，按既有 attempt 语义创建新 queued run；
5.启动 worker pump；
6.不自动 retry 用户手动触发的 interrupted run；
7.提供显式 retry command，新 run设置 `retry_of_run_id`；
8.不得把旧内存 `DedupeJobManager` 状态当作恢复证据。

崩溃窗口必须覆盖：

- queued row commit 后、pump 唤醒前；
- claim running 后、worker启动前；
- hash CAS commit 后、checkpoint 前；
- checkpoint 后、event emit 前；
- final terminal commit 后、complete event 前；
- cancel_requested commit 后、worker观察前。

---

## 13. Watcher rule recovery 修复

### 13.1 写入

当 watcher exact upsert 后，bounded rule retry最终失败：

- `watcher_rule_recovery_required = 1`；
- `needs_reconciliation = 1`；
- health 保持 degraded/reconciliation_required；
-最近 error 可写 `watcher_rule_failure` 或 `watcher_rule_retry_exhausted`。

普通 watcher begin/complete：

-允许清理最近 error；
-不得清理 recovery flag。

### 13.2 scan claim与执行

`ScanRunRecord` 或等价 authoritative snapshot必须包含 flag。

- scan 开始时读取 flag；
-若为 1，完整扫描在 metadata/stale 阶段成功后执行 root-level rules；
-规则执行仍保护 AI/user correction；
-规则执行失败则 run `completed_with_warnings` 或 requires_reconciliation；
-不得因为 metadata scan成功就清 flag。

### 13.3 finalization CAS

只有同时满足：

- run仍持有 root lease/generation/revision；
-metadata discovery和允许的 stale reconciliation成功；
-root-level rule recovery成功；

才能：

```text
watcher_rule_recovery_required = 0
needs_reconciliation = 0（且没有其他未解决原因）
health = healthy
```

若恢复失败或发生新的 watcher revision：

- flag 保持 1；
-root不得 healthy；
-applied revision不得错误越过未解决工作。

### 13.4 必测交错

```text
A 规则失败
→ recovery flag=1
→ B 的 watcher batch成功并清最近错误
→应用重启或 scheduler full reconciliation
→仍必须执行 A 所属 root 的规则恢复
→成功后才清 flag
```

---

## 14. API 与事件

建议新 API：

```text
start_dedupe_run
cancel_dedupe_run
get_dedupe_run
list_dedupe_runs
retry_dedupe_run
```

DTO 至少包含 schema 中的 status/phase/counters/revision/timestamps/error/parent session。

兼容：

-旧 `cancel_dedupe(job_id)` 保留一个版本周期，内部转接 durable cancel；
-旧 `dedupe-progress` 和 `dedupe-complete` 保留；
-payload 增加或映射 durable `revision`，不得生成内存 sequence冒充；
-可以新增 `dedupe-run-updated` 作为正式 projection；
-前端刷新或重启后必须通过 get/list hydrate；
-Task 02A 不新增完整 dedupe history 页面，只保证现有 scan UI/进度不退化并能恢复当前/最近 run。

所有新 command 必须加入 Tauri permission、browser mock 和合同测试。

---

## 15. Retention

Task 02A 必须定义并实现 bounded retention：

- active/queued run不删除；
- terminal runs至少保留 30 天；
-至少保留最新 20 个 terminal runs；
-被 `scan_sessions.dedupe_job_id` 引用的 run不删除；
-被 `retry_of_run_id` 链直接引用的 run在子 run保留期间不删除；
-error rows随 run级联删除；
-每批最多删除 500 个 run；
-prune不能与 active worker finalization竞争；
-prune性能和 WAL reader延迟需测试。

若产品后续需要更长历史，由 Task 03 Analysis Run/Finding 决定，不在本阶段无限保留。

---

## 16. Rollout 与 rollback

- schema 29 commit 前：transaction rollback到 28；
- schema 29 commit 后：旧 schema-28 binary继续拒绝 future schema；
-只能使用 schema-29-capable build通过内部 feature gate关闭 durable worker路径；
-允许临时 gate：
  `ZEN_CANVAS_DURABLE_DEDUPE_RUNS=false`；
-即使 gate关闭，schema 29仍需可打开，旧同步 dedupe路径只作为短期回退；
-回退路径不得创建第二个同时运行的 owner；
-兼容期结束条件必须写入 closeout；
-不允许长期双写内存状态和 durable状态；
-新表可在功能 gate关闭时安全保留。

---

## 17. 建议允许修改范围

允许按实际需要修改：

```text
src-tauri/src/db/schema.rs
src-tauri/src/db/mod.rs
src-tauri/src/db/queries/scan.rs
src-tauri/src/db/queries/（新增 dedupe repository）
src-tauri/src/dedupe.rs
src-tauri/src/scanner.rs
src-tauri/src/main.rs
src-tauri/src/lib.rs
src-tauri/capabilities/
src-tauri/tests/migrations.rs
src-tauri/tests/dedupe.rs
src/api/tauriApi.ts
src/store/useScanManagerStore.ts
必要的 dedupe projection/store
tests/browserTauri.ts
tests/dedupe*.test.ts
tests/managedScan*.test.ts
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
docs/remediation/TASK_02A_IMPLEMENTATION_CLOSEOUT.md
```

禁止修改：

```text
src-tauri/src/global_index/
Managed AI worker/schema/provider
file_ops / operation journal
storage cleanup execution / cleanup journal
Safe Trash / restore
files.id
Query V2 / Organization Plan
installer / version / release
package lock / Cargo lock（本阶段不新增依赖）
```

---

## 18. 实施提交顺序

一个 Draft PR，按原子提交推进：

1. `db: add watcher rule recovery and dedupe run schema`
2. `db: add durable dedupe run repository`
3. `dedupe: run existing hash pipeline through durable ledger`
4. `dedupe: add startup recovery queue and cancellation`
5. `scan: link dedupe dispatch to durable runs`
6. `api: expose durable dedupe snapshots with legacy compatibility`
7. `test: cover migration crash cancellation and recovery`
8. `docs: close Task 02A implementation`

不得把 Task 02B 的 prehash/worker pool/hardlink/group混入。

---

## 19. 测试计划

### 19.1 Migration

- empty → 29；
-真实 28 fixture → 29；
- migration conflict/rollback，user_version仍28；
- watcher列、scan ledger、AI、Global、journal保留；
-不伪造 dedupe history；
- schema29 reopen；
- future30 rejection；
-索引和 check constraints；
-100k files fixture性能。

### 19.2 Watcher rule recovery

- rule failure设 flag；
-成功 watcher batch不清 flag；
-begin/complete清最近错误但不清 flag；
-overflow/rename/permission错误不覆盖 flag；
-重启后仍执行恢复；
-full recovery成功清 flag；
-full recovery失败保留；
-新的 watcher revision竞态不错误清除；
-user correction不被覆盖；
-flag=1时root不能healthy。

### 19.3 Dedupe repository/state

- queued admission；
-单一 running/cancelling；
-多个 queued FIFO；
-request key idempotency/冲突；
-claim CAS；
-旧 revision checkpoint拒绝；
-legal/illegal transition；
-cancel queued；
-cancel running；
-terminal不可复活；
-retry创建新 ID和关系；
-scan session link；
-retention。

### 19.4 Pipeline

-现有 size candidate语义不变；
-已缓存 full hash零 IO；
-哈希前后 identity；
-content_hash CAS；
-单文件错误不终止run；
-DB fatal使run failed；
-计数与字节；
-checkpoint节流；
-event failure不反转terminal；
-空文件继续排除；
-取消剩余语义明确。

### 19.5 Crash/restart

- queued commit后重启；
-running claim后崩溃；
-hash写入后checkpoint前；
-terminal commit后event前；
-cancelling重启；
-startup marks interrupted；
-queued pump恢复；
-scan pending/unknown/failed创建新run；
-manual interrupted不自动重试；
-retry复用content_hash。

### 19.6 Frontend/API

-旧 command/event兼容；
-hydrate current/latest run；
-revision过滤/gap refetch；
-cancelling与cancelled；
-renderer重启；
-scan session显示关联run；
-browser mock/permission；
-feature gate单一owner。

### 19.7 性能

-100k files candidate collection；
-100k cached rows no-IO run；
-checkpoint写入频率；
-WAL reader latency；
-20 queued admissions；
-retention prune；
-不得显著恶化 File Library query；
-记录 cold/warm/optimized，而不是只报告最佳值。

---

## 20. 验收标准

全部满足才可通过：

1. schema 29 migration、rollback和future guard有测试；
2. watcher rule recovery不会被后续正常事件擦除；
3. flag未恢复时root不会healthy；
4. dedupe run可跨重启查询；
5. run ID与worker/event ID一致；
6.任意时刻最多一个running/cancelling；
7. queued run不会因崩溃丢失；
8. cancel是durable事实；
9. startup将遗留active标为interrupted；
10. scan-triggered dispatch可以恢复；
11.现有content_hash cache和三重identity防护不退化；
12.不改变用户文件；
13.不实现或混入prehash/hardlink/group；
14.不修改Global Index、Managed AI、files.id或journal；
15. frontend、Rust、migration、remediation、performance、security、Windows/macOS CI全通过；
16. closeout明确Task 02B仍未开始。

---

## 21. 停止条件

出现以下任一项立即停止并汇报：

-需要修改 `files.id` 才能继续；
-需要把 Global Index identity直接写入 managed files；
-需要新增第三方依赖；
-需要修改 operation/cleanup journal；
-发现当前 content_hash cache在重复运行时会修改用户文件；
-无法用单一 owner保证最多一个active worker；
-常量表达式 partial unique index不受当前 SQLite支持且无任务书批准的替代；
-需要提前建立 prehash、fingerprint或duplicate group；
-需要改变 Task 03/04/05 的 schema；
-schema28无法安全迁移；
-无法保证 watcher recovery flag的CAS语义；
-出现与本阶段无关的历史架构冲突。

不得自行重写任务书或扩大范围。

---

## 22. 验证命令

开始前：

```bash
git status --short
git rev-parse HEAD
git merge-base --is-ancestor 1bc9ead144601892feb13feaf53a6a6137df3904 HEAD
npm run verify:frontend
npm run verify:rust
npm run verify:security
```

完成后至少：

```bash
npm run verify:frontend
npm run verify:rust
npm run verify:security
npm run test:performance
npm run build
git diff --check
git status --short
```

平台专用项无法本地运行时如实记录，以GitHub Windows/macOS CI为最终门禁。

---

## 23. Closeout 与交付

完成后新增：

```text
docs/remediation/TASK_02A_IMPLEMENTATION_CLOSEOUT.md
```

更新：

```text
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
```

Closeout必须记录：

-基线和最终HEAD；
-schema29 SQL与migration；
-watcher rule recovery fact；
-dedupe owner、queue、状态机和revision；
-startup recovery；
-scan dispatch兼容；
-旧 API/event兼容；
-retention；
-测试与性能；
-已知风险；
-明确声明未开始Task02B/02C/03。

创建 Draft PR：

```text
feat: add durable dedupe runs
```

完成后停止等待人工验收，不自动合并，不开始下一阶段。
