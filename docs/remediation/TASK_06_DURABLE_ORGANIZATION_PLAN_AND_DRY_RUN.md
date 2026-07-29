# Task 06 — Durable Organization Plan、审核式 Dry Run 与安全执行

## 1. 当前状态与唯一授权

Task 06 对应固定产品模块 6：**AI 整理预览**。

当前生产基线：

```text
Task 05 / PR #38 squash merge
5468a17790165a149c462a17b64d011750b45410

Database schema
31
```

Task 06 是一个完整产品模块，不是 Task 05 的独立收尾任务，也不得拆分为 06A、06B、06C。Task 05 人工代码级审查中接受的 9 项遗留必须作为 Task 06 第一组生产改动关闭，随后连续完成 Durable Organization Plan、review、dry run、execution、recovery projection、UI、测试、性能和 Closeout。

唯一生产实施分支：

```text
remediation/06-organization-plan
```

唯一任务书：

```text
docs/remediation/TASK_06_DURABLE_ORGANIZATION_PLAN_AND_DRY_RUN.md
```

Task 07、Task 08 在 Task 06 人工验收合并前继续禁止执行。

---

## 2. 产品目标

Task 06 将当前临时的：

```text
legacy organize queue
+ renderer 内存 decision
+ 计算式 operation preview
+ 临时 preview session
```

整改为：

```text
managed File Library selection/query
→ durable Organization Plan
→ backend-generated proposal
→ human review/keep/edit
→ authoritative dry run
→ explicit execution approval
→ existing operation journal
→ restore/recovery projection
```

用户必须能够：

1. 从当前 File Library selection、Saved View 或 Query V2 结果创建整理计划；
2. 关闭应用后重新打开并继续审核；
3. 查看每个文件的 From/To、建议原因、风险、冲突和目录创建影响；
4. 对单项或安全批次执行 Accept、Keep、Edit filename；
5. 对缺少可靠分类的计划项调用现有 Managed AI 分析；
6. 在执行前获得完整、权威、可复验的 dry run；
7. 只执行已经明确接受且当前仍有效的计划项；
8. 在部分失败、取消、崩溃或重启后看到真实结果，并继续使用现有恢复能力。

Task 06 不建设自治 Agent，不允许 AI 自动执行文件操作，不读取文件正文，不引入自然语言规则，不复制参考项目实现。

---

## 3. 现有架构事实

必须基于当前代码实施，不得假设以下能力不存在：

### 3.1 已存在且必须复用

- managed `files`、scan root/session/run/generation 与 watcher reconciliation；
- FileQuerySpec V2、library revision、selection、tags、Saved Views、Inspector；
- durable Managed AI queue、provider policy、managed scope、cancel、fingerprint 和 user correction gate；
- server-authoritative operation preview；
- file identity、source claim、no-overwrite、protected-path 和 platform safety；
- durable operation journal、startup reconciliation、undo/restore；
- Safe Trash/cleanup journal；
- Analysis Run/Finding/Decision；
- Windows/macOS CI、native regression、security audit 和 packaging gates。

### 3.2 当前缺口

当前组织页面仍以 `useFileLibraryStore.organizeQueue`、legacy path scope、OFFSET page walk、`useOrganizeDecisionStore` 内存 decision 和 `useOperationQueueStore` 临时 whitelist 组合工作。它没有：

- durable plan ID；
- plan/item revision；
- source query provenance；
- restart-safe decision；
- authoritative item-set materialization；
- versioned dry run；
- execution lease；
- plan 与 operation batch 的 durable mapping；
- crash 后的 plan result projection。

现有 operation preview 和 journal 是安全基础，不是 Organization Plan 的替代品；Organization Plan 也不得替代 operation journal。

---

## 4. 参考项目与许可证边界

参考仓库：

```text
hyperfield/ai-file-sorter
```

冻结分析 SHA：

```text
cd9a024219b9434fb0a1df6b272f7145d9c67b28
```

许可证：

```text
GNU AGPL-3.0
```

开始实施前必须读取该 SHA 的：

- `LICENSE`；
- `README.md`；
- `app/include/CategorizationDialog.hpp`；
- `app/lib/CategorizationDialog.cpp`；
- dry-run、undo、review 和相关测试文件。

只允许独立借鉴以下产品原则：

- mutation 前先 review；
- From/To dry-run；
- per-item select/keep/edit；
- only-safe batch selection；
- continue later；
- 分类建议与实际移动分离；
- 冲突、重名和目录创建在执行前可见。

严格拒绝：

- 复制或逐段改写 AGPL 源码；
- 复制 Qt dialog/model/row-role/column 结构；
- 复制其 DTO、database、undo plan、plugin 或 model runtime；
- 复制 UI、图标、CSS、文案或交互布局；
- renderer/path-authoritative move；
- 其独立 undo 数据库；
- 自动创建目录并移动而不经过 Zen Canvas 安全链；
- filename/sidecar tag；
- document/image content analyzer；
- user-learning implementation；
- 将参考项目的 taxonomy 直接写入 Zen Canvas schema。

Closeout 必须记录实际阅读文件、借鉴原则和主动拒绝内容。

---

## 5. 第一组生产改动：关闭 Task 05 九项接受遗留

以下 9 项不得再次后移。完成后继续整个 Task 06，不得停止等待单独验收。

### 5.1 消除 Vault 查询循环

必须将 query state 更新和 query execution 改为单向流：

```text
user intent
→ canonical query state update
→ one query effect/request
→ result state update
```

`loadFirstPage` 不得在执行查询时再次无条件 clone/set 同一 spec。必须真正 mount `VaultView`，验证：

- 初次加载只触发预期一次请求；
- search debounce 每个 committed query 一次；
- filter/sort/scope/Saved View 各一次；
- late response 不覆盖新 query；
- React Strict Mode 下没有无限循环或重复 publish。

### 5.2 Cursor 必须由 backend 权威验证

不增加新的 secret/crypto dependency。冻结方案：

1. cursor 仍可使用现有 encoding；
2. cursor 只作为 backend-issued locator，不作为事实；
3. 后续页在同一 read transaction 中重新验证：
   - fingerprint；
   - snapshot revision；
   - sort kind/direction；
   - anchor file 当前仍属于 canonical query；
   - anchor file 的完整真实 sort tuple 与 cursor 完全一致；
4. `total_count` 不得从 renderer-editable cursor 获得权威性；
5. anchor missing、tuple mismatch、membership mismatch、NaN/invalid bits、合法 JSON 篡改均 fail closed。

必须增加仍可正常解析的 JSON tamper tests，覆盖 total、file ID、rank、mtime、name、confidence、direction 和 query mismatch。

### 5.3 100,000 explicit selection 真正 chunk-safe

冻结方案：使用 backend 创建的 SQLite TEMP selection set，或等价的 request-local bounded set materialization。

要求：

- renderer ID 不得进入 SQL identifier；
- ID 以不超过 500 条的 chunk 写入 TEMP table；
- query、summary、tag mutation 和 Task 06 plan materialization通过 join 使用该 set；
- transaction/connection 结束时清理；
-失败不残留旧 set；
-不得生成包含 100,000 placeholders 的单条 SQL；
- explicit ID 与 all-matching exclusions 使用独立上限校验，exclusions 不得被通用 128 限制提前拒绝。

测试边界：0、1、128、129、SQLite variable limit 附近、99,999、100,000、100,001。

### 5.4 Snapshot expired 保留当前画面

- 已加载 rows 保留；
-显示 non-blocking banner/action；
- generic error 不得覆盖专用状态；
- all-matching selection 立即失效；
- explicit selection 可保留但需 backend revalidation；
-刷新建立新 snapshot；
-真实 UI interaction test 必须覆盖。

### 5.5 完整用户标签 UI

补齐可用交互：

- list + usage count；
- create；
- rename；
- fixed color token change；
- usage-confirmed delete；
- explicit/all-matching assign/remove；
- stale conflict、validation、loading 和 error；
- keyboard、focus、dialog 和 screen-reader 行为。

### 5.6 完整 Saved Views UI

补齐：

- create/open；
- rename；
- update current query；
- delete；
- position/reorder；
- invalid root/tag reference；
- stale conflict；
- open 后创建新 snapshot。

不得以 backend method 已存在代替产品交付。

### 5.7 补齐 Detail 与 Selection Summary

`FileLibraryDetailDto` 增加 bounded active finding summary，至少包含：

- finding ID/type/severity；
- detector；
- state/decision；
- bounded evidence summary；
- analysis revision。

multi-selection summary 增加：

- common directory；
- common tag IDs/tags；
- partial tag commonality count；
- stale/missing/excluded count。

必须使用固定数量 query 或 grouped query，不得 N+1，不读取文件内容。

### 5.8 强制无碰撞 optimistic concurrency

Schema 32 为 `user_tags` 和 `library_saved_views` 增加单调 `revision INTEGER NOT NULL DEFAULT 1`。

- update/delete request 必须携带 `expectedRevision`；
- revision 不得可选；
-成功 mutation revision +1；
- `updated_at` 只用于显示，不作为唯一 CAS；
-同一毫秒/同一秒连续写仍必须拒绝旧请求；
-创建返回 revision 1。

### 5.9 1M complex exact count 的批准替代方案

不得估算，不得谎报 complete。采用 **deferred exact count**：

```text
FileQueryResponseV2
- countState: exact | deferred
- totalCount: integer | null
- countToken: opaque token | null
```

规则：

- common/simple query 保持同 snapshot exact count；
-当 active managed rows 超过 250,000 且 query 包含 FTS、tag 或多维 composite filter 时，首屏允许返回 `countState=deferred`；
- deferred 时页面结果仍来自真实 query，但 UI 不显示虚假总数；
-新增 `resolve_file_library_exact_count_v2`，在显式用户动作或后台低优先级请求中计算 exact count；
- count token 绑定 canonical query fingerprint、snapshot revision 和 membership；
- revision 变化返回 snapshot expired；
- select-all-matching、bulk metadata mutation 和 plan creation 必须在 exact count 或 backend 自身原子 materialization 后继续；
- UI 显示“正在计算精确数量”或“精确数量尚未计算”；
-不得建立 durable count job 或通用 runtime；
-结果可使用 bounded revision+membership cache，但 cache 不成为 authority。

性能门禁：

- 1M complex 首屏 p95 ≤ 150ms；
- exact count 单独记录真实耗时，不设虚假 150ms 门限；
- exact count 必须可取消/latest-wins、可观察且不阻塞 UI；
- EXPLAIN、WAL reader 和正确性测试必须完整。

---

## 6. Schema 32

Task 06 授权 schema 31→32。

不得 ALTER `files` 大表，不得迁移 `files.id`，不得修改 operation/cleanup journal schema、Managed AI schema、Analysis/Finding schema 或 Rule AST。

### 6.1 `organization_plans`

```sql
CREATE TABLE organization_plans (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'draft', 'building', 'ready', 'stale', 'executing',
        'partially_completed', 'completed', 'cancelled', 'failed'
    )),
    source_kind TEXT NOT NULL CHECK (source_kind IN ('explicit', 'all_matching')),
    source_query_spec_json TEXT,
    source_query_fingerprint TEXT,
    source_snapshot_revision INTEGER NOT NULL,
    requested_count INTEGER NOT NULL CHECK (requested_count >= 0),
    materialized_count INTEGER NOT NULL CHECK (materialized_count >= 0),
    planner_version INTEGER NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    active_execution_id TEXT,
    active_operation_batch_id TEXT,
    last_error_code TEXT,
    last_error_detail TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    ready_at INTEGER,
    completed_at INTEGER
);

CREATE INDEX idx_organization_plans_status_updated
    ON organization_plans(status, updated_at DESC, id);
```

合同：

- source query 保存 backend canonicalized QuerySpec V2；
- explicit source 不保存任意 renderer path；
- plan revision 是所有 decision/refresh/execution 的 CAS；
- status 不得从 terminal 倒退；
- executing plan 只有一个 execution owner；
- plan 不保存 AI raw response 或文件正文。

### 6.2 `organization_plan_items`

```sql
CREATE TABLE organization_plan_items (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES organization_plans(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    file_id_snapshot TEXT NOT NULL,
    source_path_snapshot TEXT NOT NULL,
    source_name_snapshot TEXT NOT NULL,
    source_size_snapshot INTEGER NOT NULL,
    source_mtime_snapshot INTEGER NOT NULL,
    source_is_dir_snapshot INTEGER NOT NULL,
    proposal_fingerprint TEXT NOT NULL,
    proposal_kind TEXT NOT NULL CHECK (proposal_kind IN (
        'move', 'rename', 'move_rename', 'keep', 'blocked'
    )),
    proposed_target_directory TEXT NOT NULL,
    proposed_name TEXT NOT NULL,
    proposed_target_path TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN (
        'undecided', 'accepted', 'kept', 'edited'
    )),
    edited_name TEXT,
    validity TEXT NOT NULL CHECK (validity IN (
        'ready', 'needs_analysis', 'needs_review', 'blocked',
        'stale', 'executing', 'executed', 'failed', 'skipped'
    )),
    confidence REAL NOT NULL,
    risk_level TEXT NOT NULL,
    requires_confirmation INTEGER NOT NULL,
    blocking_code TEXT,
    blocking_detail TEXT,
    authoritative_preview_id TEXT,
    operation_log_id TEXT,
    execution_id TEXT,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(plan_id, ordinal),
    UNIQUE(plan_id, file_id_snapshot)
);

CREATE INDEX idx_organization_plan_items_plan_state
    ON organization_plan_items(plan_id, validity, decision, ordinal, id);
CREATE INDEX idx_organization_plan_items_file
    ON organization_plan_items(file_id_snapshot, plan_id);
CREATE INDEX idx_organization_plan_items_execution
    ON organization_plan_items(execution_id, validity, id);
```

`file_id_snapshot` 故意不建立到 `files(id)` 的外键。它是计划历史引用，不得阻断现有 move/restore 更新 `files.id`。执行时必须通过当前 authoritative preview、path/identity mapping 和 live revalidation 解析当前文件，不能把 snapshot 当实时身份。

### 6.3 小表 revision migration

```sql
ALTER TABLE user_tags
ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE library_saved_views
ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
```

Migration 必须：

- 在现有 `BEGIN IMMEDIATE` 事务中执行；
-失败完整回滚，`user_version` 保持 31；
-全部成功后最后设置 32；
- current-schema startup 执行 idempotent ensure；
- future schema 拒绝；
-不 backfill/重写 `files`；
-新 plan tables 初始为空；
-验证 schema 31 fixture、WAL reader、100k/1M files fixture 和旧 binary guard。

---

## 7. Organization Plan 状态机

### 7.1 Plan 状态

```text
draft
→ building
→ ready
→ stale
→ ready
→ executing
→ partially_completed
→ executing
→ completed
```

其他终点：

```text
draft/building/ready/stale → cancelled
building/executing → failed
```

规则：

- `building` 失败不得发布半成品 items；
-创建使用 staged transaction，全部 items 成功后才 `ready`；
-任何 source/query/classification/preview/identity 变化可使 plan `stale`；
- stale 不得执行；
- refresh 后才能回到 ready；
- executing 使用 revision CAS + execution ID；
- operation journal 已产生 pending logs 后，journal 是恢复事实；
- plan crash recovery 只投影 journal，不自行重放 filesystem mutation。

### 7.2 Item 状态

- `needs_analysis`：缺少可用分类或建议；
- `needs_review`：低 confidence、Sensitive/System、duplicate、目录创建、跨 volume 或需确认；
- `blocked`：stale/missing、删除类建议、非法目标、protected path、冲突或不支持操作；
- `ready`：proposal 当前有效；
- `stale`：proposal fingerprint 或 current identity 变化；
- `executing/executed/failed/skipped`：由 execution/journal projection 决定。

人工 decision 优先于模型，但 proposal fingerprint 变化时不得静默继承 `accepted/edited`；必须转为 `needs_review`，保留旧 decision 作为审计信息或明确清除，禁止自动执行。

---

## 8. Plan 创建与 source materialization

建立 versioned request：

```text
CreateOrganizationPlanRequestV1 {
  version: 1,
  requestId,
  title?,
  source: LibrarySelectionV1,
  expectedCount?
}
```

要求：

-只接受 File Library V2 selection；
- explicit IDs 使用 Task 05 修复后的 TEMP selection set；
- all_matching 验证 canonical query、fingerprint、snapshot revision 和 root/tag health；
- source degraded/invalid/expired fail closed；
- target 上限 10,000；10,001 在写入前整体拒绝；
- materialized count 与 expected count 不一致拒绝；
-每个 file 只生成一个 plan item；
- source order deterministic；
-计划创建可物化 durable item set，这是业务 artifact，不得与 Query V2 stateless snapshot 混淆；
-不从 renderer 接收 source path、target path、operation kind 或 suggested directory。

计划 proposal 只从 backend 当前事实生成：

- current `files` classification fields；
- active duplicate membership；
- active finding summary；
- current server-authoritative operation preview；
- managed root/scope health；
- current file metadata/identity inputs。

`DeleteCandidate`、cleanup、trash 或永久删除类建议不得进入可执行 Organization Plan；它们只能被标为 blocked/review 并链接到现有 Cleanup 流程。

---

## 9. AI 分析边界

Task 06 不创建新的 AI queue、provider、schema 或 content extractor。

新增 plan adapter 可包含：

```text
analyze_organization_plan_items
```

它必须：

-通过 plan ID/item ID 解析 managed file ID；
-只处理 `needs_analysis` 或用户明确选择的项；
-每次最多 100 项；
-复用现有 Managed AI queue、provider policy、scope、fingerprint、cancel 和 correction protection；
-不覆盖 user correction；
-不自动改变 plan decision；
-AI 完成后计划仍需 explicit refresh/revalidation；
-不上传 unmanaged/global-only 文件；
-不读取正文，继续 metadata-only；
-不保存 raw prompt/response 到 Organization Plan。

Task 08 才能设计 Content Artifact 和本地内容提取。

---

## 10. Review、decision 与 filename edit

支持：

- per-item Accept；
- Keep；
- Edit filename；
- Clear decision；
- batch Accept Safe；
- batch Keep；
- batch Clear。

禁止 renderer 修改：

- source path；
- target directory/path；
- operation type；
- file identity；
- confidence/risk；
- authoritative preview ID；
- blocking state。

Edit 只提交 filename：

```text
UpdateOrganizationPlanDecisionRequestV1 {
  planId,
  expectedPlanRevision,
  itemDecisions[] {
    itemId,
    expectedItemRevision,
    decision,
    editedName?
  }
}
```

Backend 必须复用 extension-preserving filename normalization、安全字符、reserved name、collision 和 target path policy。每批最多 10,000 items，单 transaction，plan revision 只 bump 一次。

Safe batch 仅允许：

- validity = ready；
- risk = Normal；
- confidence ≥ 0.8；
-不 duplicate；
-不 requires confirmation；
-不跨 volume；
-不创建受保护或未知 parent；
-无 collision/blocking reason。

---

## 11. Refresh 与 stale 语义

`refresh_organization_plan` 必须：

1. expected plan revision CAS；
2.重新解析当前 file row；
3.重新构造 authoritative preview；
4.重新验证 managed scope/root health；
5.重新验证 source metadata/identity inputs；
6.计算新的 proposal fingerprint；
7.更新 stale/missing/collision/blocked；
8. proposal 未变化时保留人工 decision；
9. proposal 变化时 accepted/edited 降级为 needs-review；
10. transaction 中一次性发布并 bump plan revision。

Refresh 不调用 AI、不执行文件操作、不自动重新接受。

---

## 12. Authoritative Dry Run

新增：

```text
get_organization_plan_dry_run
```

请求只接受：

- plan ID；
- expected plan revision；
- accepted item IDs 或 `all_accepted`；

Backend 返回 versioned snapshot：

- plan ID/revision；
- selected/executable/blocked/stale counts；
- total bytes；
- operation kinds；
- From/To；
- edited filename；
- parent directories to create；
- target collision；
- same/cross-volume；
- risk/requires confirmation；
- source health；
- authoritative preview ID；
- execution batch limit；
- dry-run fingerprint。

要求：

-每次 dry run 都重新验证 live facts；
-不读取文件正文；
-不执行 `create_dir`、move、rename 或 trash；
- target path 仅用于显示和 backend execution，不回传为 renderer execution authority；
-dry-run fingerprint 绑定 plan revision、selected item set 和 proposal fingerprints；
-任何变化使旧 dry run 失效。

---

## 13. 安全执行

新增：

```text
execute_organization_plan
```

请求：

```text
ExecuteOrganizationPlanRequestV1 {
  planId,
  expectedPlanRevision,
  dryRunFingerprint,
  itemIds? | allAccepted,
  confirmed: true
}
```

执行流程：

1. main-window authorization；
2. plan revision/status CAS；
3.验证 dry-run fingerprint；
4.验证 item decisions 与 revisions；
5.重新读取当前 files/preview/identity；
6.拒绝 stale/missing/blocked/changed/collision；
7. backend 内部构造 `OperationSelection`；
8. plan 生成 execution ID 和 operation batch ID；
9.进入现有 operation journal pipeline；
10.现有 source claim、identity、protected path、no-overwrite、platform policy 执行；
11.结果写入现有 operation logs；
12. plan/item 只投影 operation log 结果；
13. plan status 更新为 partially_completed/completed/failed。

边界：

- renderer 不提交 path；
-不创建第二套 mutation executor；
-不创建第二套 undo/restore journal；
-不允许 move_to_trash/delete；
-单次 execution 最多 1,000 个 filesystem operations；
-超过时分批执行，plan 保持 partially_completed；
-只执行 accepted/edited 且当前有效 items；
- Keep/undecided/needs-review/blocked 不执行；
- cancellation 复用现有 operation cancellation；
- execution 已进入 journal 后不得仅靠 plan status 自动重试。

为支持恢复，现有内部 operation executor 可接受 caller-generated batch ID，但不得改变 operation journal schema 或恢复语义。

---

## 14. Crash、restart 与 reconciliation

启动时：

- `building` 且无完整 staged publication → failed/cancelled，不发布 items；
- `executing` 且无 operation batch/log →安全回退 ready 或 failed，并记录原因；
- `executing` 且已有 operation logs →按 journal phase/result 投影；
- journal pending/manual_review/reconciliation_required → plan 保持 executing/partially_completed，不自动重放；
- completed logs →更新对应 items；
-未知/不一致 mapping → plan stale/failed，要求人工复审。

Operation journal 和 restore 始终是 filesystem truth；Organization Plan 只是 approval/provenance/result projection。

---

## 15. UI 与 Store 重构

当前 `useOrganizeDecisionStore` 不再作为 durable truth。允许保留纯 UI draft buffer，但所有计划、items、decisions、revision 和 results 必须从 backend hydrate。

至少分离：

1. Plan list/create state；
2. Active plan summary/revision state；
3. Plan item page/cursor state；
4. Decision draft/mutation state；
5. Dry-run state；
6. Execution/progress/result state；
7. Managed AI adapter state。

组织页面必须提供：

- New Plan；
- plan list/status/last updated；
- Continue Later；
- source summary；
- review list + Inspector；
- Accept/Keep/Edit；
- safe batch；
- Analyze missing；
- Refresh stale plan；
- Dry Run；
- explicit confirmation；
- execution progress/results；
- link to existing History/Restore。

UI 约束：

-不再加载 legacy 3,000-row organize queue 作为 truth；
-不再扫描 12,000 OFFSET previews 匹配 file IDs；
-不依赖 File Library 当前 loaded page；
-不使用 localStorage 保存 native plan/decision；
-计划 item 列表使用 keyset cursor/virtualization；
- latest-request-wins；
- plan revision conflict 明确显示；
- stale 时保留画面并禁用 execute；
- narrow layout、200% zoom、CJK/RTL、reduced motion/high contrast；
- keyboard：Arrow/Home/End/PageUp/PageDown、Space decision、K keep、E edit、batch selection、ContextMenu/Shift+F10；
- `aria-activedescendant` 只引用 mounted row；
- screen reader 宣读 decision/dry-run/execution summary。

不得照搬 ai-file-sorter 的 table/dialog UI。

---

## 16. API 与权限

至少新增：

- `create_organization_plan`；
- `list_organization_plans`；
- `get_organization_plan`；
- `query_organization_plan_items`；
- `update_organization_plan_decisions`；
- `refresh_organization_plan`；
- `cancel_organization_plan`；
- `delete_organization_plan`；
- `analyze_organization_plan_items`；
- `get_organization_plan_dry_run`；
- `execute_organization_plan`；
- `resolve_file_library_exact_count_v2`。

要求：

-全部只允许 main window；
- Search window 无 plan/AI/mutation 权限；
-所有 write request 使用 expected revision；
-所有 action 使用 IDs，不接受任意 path；
- stable error codes；
- TypeScript/Rust/browser mock DTO 一致；
- browser mock 可内存模拟 plan review，但不得伪造 native persistence、AI、filesystem execution 或 restore 成功；
- capability JSON、build.rs、main/lib registration、permission matrix 和 tests 同步；
-不新增 generic invoke/SQL/shell/script surface。

---

## 17. Retention

- draft/ready/stale/executing/partially_completed plan 不自动删除；
- completed/cancelled/failed plan 默认保留 30 天；
-最多自动保留 100 个 terminal plans；
- prune child-first，单次最多 20 plans；
- operation logs/cleanup logs 不随 plan prune 删除；
-用户显式删除仅允许 terminal plan，要求 expected revision 和确认；
-正在执行、需要 reconciliation 或含 unresolved journal 的计划禁止删除。

---

## 18. 性能与容量门禁

### 18.1 Task 05 遗留

- 1M complex 首屏 deferred-count p95 ≤ 150ms；
- exact count 单独记录；
- cursor live-anchor verification p95 ≤ 20ms 增量；
-100k explicit selection summary/mutation 成功；
-Vault mount 无重复 query。

### 18.2 Plan

必须覆盖 100、1,000、10,000 items：

- create/materialize；
- hydrate first page；
- keyset deep page；
- batch decisions；
- refresh/revalidate；
- dry run；
- execution preparation；
- terminal prune；
- concurrent WAL reader；
- scanner/watcher/AI/operation journal 写入竞争。

目标：

- plan first page p95 ≤ 100ms；
-1,000-item create ≤ 500ms；
-10,000-item create ≤ 3s；
-10,000-item batch decision ≤ 500ms；
-10,000-item refresh ≤ 3s；
-1,000-item dry run ≤ 1s；
-execution preparation 1,000 items ≤ 1s，不含真实 filesystem IO；
-不得在 renderer materialize 10,000 rows；
-不得长期持有跨 IPC transaction。

每个新增 index 必须有 EXPLAIN QUERY PLAN 和 write-amplification 说明。

### 18.3 Migration

- schema 31→32 with 100k files；
- schema 31→32 with 1M files；
- rollback/future schema；
-WAL reader；
-database size delta；
-小表 revision backfill；
- plan tables empty。

---

## 19. 必须新增的测试

### 19.1 Task 05 handoff

覆盖本任务第 5 节全部 9 项，不得只做静态源码字符串测试。

### 19.2 Plan schema/state

- migration/rollback/future guard；
- state transition matrix；
- building atomic publication；
- plan/item revision CAS；
- terminal no-regression；
- active execution single owner；
- restart projection；
- retention safety。

### 19.3 Source/materialization

- explicit 1/100k/100001；
- all_matching exact/deferred count；
- exclusions；
- missing/degraded roots/tags；
- snapshot expired；
- deterministic item order/ID；
-10k cap atomic rejection；
-no renderer path authority。

### 19.4 Proposal/review

- move/rename/move_rename/keep/blocked；
- cleanup/delete suggestion blocked；
- low-confidence/sensitive/duplicate/requires-confirmation；
- collision/parent/cross-volume/protected path；
- accept/keep/edit/clear；
- batch safe matrix；
- filename/extension/reserved validation；
- stale proposal invalidates acceptance；
- user decision not overwritten by unchanged AI refresh。

### 19.5 AI adapter

- managed scope only；
- existing queue only；
- max 100；
- correction protection；
- cancel；
- no raw/content persistence；
- completion requires plan refresh；
- no automatic decision/execution。

### 19.6 Dry run/execution

- dry-run fingerprint；
- stale dry run rejection；
- ID-only request；
- live preview/identity revalidation；
- operation batch mapping；
-1,000 limit；
- partial completion；
- cancellation；
- crash before/after journal persist；
- manual review/reconciliation projection；
- no move_to_trash/delete；
- restore remains existing authority。

### 19.7 UI/accessibility

- create/open/continue later；
- latest request wins；
- revision conflict；
- stale banner；
- decisions persist across remount/restart mock；
- dry-run confirmation；
- execution result；
- virtual focus/ARIA mounted row；
-keyboard/batch/narrow layout；
-no legacy organize queue/offset scan truth；
-browser mock honest limitations。

### 19.8 Security/contracts

- Search window denied；
-main-only commands；
-no arbitrary source/target path；
-no SQL/shell/script；
-no second AI queue；
-no second operation/undo journal；
-no journal schema change；
-no files.id migration；
-no content read；
-no AGPL transplant；
-no dependencies/lockfiles；
-schema exactly 32；
-Task 07/08 absent。

---

## 20. 允许修改范围

允许：

- schema/migration 和新 Organization Plan repository；
- File Library 第一组遗留相关 Rust/TS/UI；
-现有 operation executor 的最小内部复用接口；
-现有 Managed AI 的 plan-ID adapter；
- organize/preview/history UI 与 stores；
- Tauri commands/capabilities/browser mock；
- tests/performance/scripts；
- remediation/security/design docs。

禁止大范围重写：

- Global Index/provider/service；
- scanner/watcher generation model；
- Managed AI provider/schema/worker ownership；
- dedupe hashing/group schema；
- Analysis/Finding schema；
- Rule AST；
- operation/cleanup journal schema；
- Safe Trash/restore protocol；
- content extractor/Artifact；
- release/version/tag；
- package/Cargo dependencies。

---

## 21. 依赖合同

默认：

- `package.json` dependency list 不变；
- `package-lock.json` 不变；
- `Cargo.toml` dependency list 不变；
- `Cargo.lock` 不变。

现有 serde、BLAKE3、rusqlite、UUID、Zustand、React Virtual 和 Tauri 足够完成任务。若确实无法完成，必须停止并提交最小依赖提案，不得自行添加。

---

## 22. 停止条件

以下任一情况立即停止并汇报：

-需要 schema 33；
-需要 ALTER/迁移 `files.id`；
-需要修改 operation/cleanup journal schema；
-需要第二套 file mutation/undo/restore；
-需要第二套 AI queue/provider；
-需要读取或上传文件正文；
-需要复制 ai-file-sorter AGPL 代码/结构；
-需要 renderer 传 source/target path 才能执行；
-无法保证 stale plan/dry run fail closed；
-无法在 journal persist 后恢复 plan projection；
-无法保证 10k materialization atomic；
-需要新增 dependency/lockfile；
-已有并行 Task 06 branch/PR；
-需要开始 Task 07/08。

不得自行拆分任务或重写任务书。

---

## 23. 建议原子提交

同一个实施分支和 Draft PR 中建议：

1. `fix(library): close accepted task05 review gaps`
2. `db: add schema32 organization plan ledger`
3. `plan: add durable source materialization and proposals`
4. `plan: add decision revision and refresh contracts`
5. `plan: add authoritative dry run`
6. `plan: connect safe execution to operation journal`
7. `ai: add managed plan analysis adapter`
8. `ui: rebuild organize workspace around durable plans`
9. `api: align plan permissions and browser mock`
10. `test: cover plan recovery performance and security`
11. `docs: close task06 implementation`

它们只是 review-friendly commits，不是独立任务或停点。

---

## 24. 完成验证

必须运行：

```bash
npm run verify:frontend
npm run verify:rust
npm run verify:security
npm run test:remediation
npm run test:performance
npm run build
git diff --check
git status --short
```

并完成：

- Task 05 9 项 focused tests；
- schema 31→32 migration/rollback；
- plan state/recovery tests；
-100/1k/10k plan benchmarks；
-100k explicit selection；
-1M deferred/exact count；
-Windows/macOS Rust quality；
-release compile；
-NSIS；
-unsigned DMG；
-Dependency audit；
-permission/scope/architecture contract。

平台无法本地运行时等待 GitHub CI，不得伪造结果。

---

## 25. Closeout 与 Draft PR

创建：

```text
docs/remediation/TASK_06_IMPLEMENTATION_CLOSEOUT.md
```

更新：

- `CODEX_REMEDIATION_INDEX_V1.md`；
- `REMEDIATION_RISK_REGISTER.md`；
- `REMEDIATION_MASTER_PLAN_V1.md`；
- `TASK_05_IMPLEMENTATION_CLOSEOUT.md`；
- `TAURI_COMMAND_PERMISSION_MATRIX.md`；
-必要设计/测试文档。

唯一 Draft PR：

```text
feat: add durable organization plans and dry run
```

PR 必须保持 Draft、不得自动合并、不得开始 Task 07。

Closeout 至少记录：

- baseline/final HEAD；
- Task 05 九项 handoff 修复映射；
- ai-file-sorter SHA/LICENSE/借鉴/拒绝；
- schema 32；
- plan/item state/revision；
- source materialization；
- AI adapter；
- proposal/decision/refresh；
- dry run；
- operation journal integration；
- crash/restart；
- UI/accessibility；
- permissions/browser mock；
- tests/query plans/performance；
- Windows/macOS/package/security；
- dependencies/lockfiles；
- known risks；
- Task 07 未开始。
