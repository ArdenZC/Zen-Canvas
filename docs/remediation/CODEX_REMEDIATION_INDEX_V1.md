# Zen Canvas Codex Remediation Index V1

## 1. 当前执行状态

- Task 00 已通过 PR #16 验收并合并；
- Task 01A/01B 已完成扫描代际与 watcher reconciliation；
- Task 02 已通过 PR #26 合并，数据库推进至 schema 29；
- Task 03 已通过 PR #28 合并，数据库推进至 schema 30；
- Task 04 已通过 PR #35 合并，squash merge 为 `14616d4344314afce0878dbc681988c04183a9bc`；
- Task 05 已通过 PR #38 合并，squash merge 为 `5468a17790165a149c462a17b64d011750b45410`，数据库推进至 schema 31；
- Task 05 人工接受的 9 项遗留已冻结为 Task 06 第一组生产改动，不得再次后移；
- Task 06 是当前唯一可执行完整产品模块，授权 schema 32；
- Task 07–08 继续禁止执行。

| 阶段 | 任务书 | 产品模块/目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 后架构、安全和数据基线审计 | 已完成 |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | scan generation、run/session、scan_seen、恢复 | 已完成 |
| 01B | `TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md` | Rust watcher owner、revision gap、reconciliation | 已完成 |
| 02 | `TASK_02_IDENTITY_FINGERPRINT_AND_DUPE.md` | 模块 1：重复检测；Czkawka 对标 | 已合并，schema 29 |
| 03 | `TASK_03_ANALYSIS_RUN_FINDING_AND_DETECTORS.md` | 模块 2：大型文件/空间分析；Spacedrive V1 对标 | 已合并，schema 30 |
| 04 | `TASK_04_GLOBAL_SHORTCUT_SEARCH.md` | 模块 4：全局快捷搜索；Tolaria 设计级对标 | 已合并，schema 30 |
| 05 | `TASK_05_FILE_LIBRARY_QUERY_TAGS_SAVED_VIEWS.md` | 模块 5：文件库；Query V2、selection、tags、Saved Views、Inspector | 已合并，schema 31；9 项遗留转入 Task 06 |
| 06 | `TASK_06_DURABLE_ORGANIZATION_PLAN_AND_DRY_RUN.md` | 模块 6：AI 整理预览；Durable Organization Plan、review、dry run、安全执行 | **当前唯一可执行；授权 schema 32** |
| 07 | 待创建 | 模块 7：自然语言规则；Proposal → Rule AST | 禁止执行 |
| 08 | 待创建 | 模块 8：本地内容理解；Content Artifact | 禁止执行 |

不得创建 debt-cleanup、05.5、06A/06B/06C 或并行产品阶段。上一阶段接受遗留必须作为下一完整模块第一组关闭，然后继续完成该模块。

---

## 2. 固定的 8 模块主线

| 原模块 | Zen Canvas 功能 | 参考项目 | 借鉴边界 | 当前承载阶段 |
|---|---|---|---|---|
| 1 | 重复检测 | Czkawka | 按许可证登记，独立实现 | Task 02，已完成 |
| 2 | 大型文件/空间分析 | Spacedrive V1 | 概念级，拒绝过度复杂架构 | Task 03，已完成 |
| 3 | 扫描与索引 | Spacedrive V1 | Job/Location/Indexer 概念级 | Task 01A/01B，已完成 |
| 4 | 全局快捷搜索 | Tolaria | AGPL 设计级，只读分析不移植 | Task 04，已完成 |
| 5 | 文件库 | TagSpaces | AGPL 设计级，不复制实现或结构 | Task 05，已完成 |
| 6 | AI 整理预览 | ai-file-sorter | AGPL 概念级，独立实现 | Task 06，当前 |
| 7 | 自然语言规则 | Accomplish + OpenCode | 按实际许可证登记 | Task 07 |
| 8 | 本地内容理解 | Local-File-Organizer | 轻量设计级 | Task 08 |

标准流程：

```text
完整产品模块
→ 人工任务书
→ 一个实施分支
→ 一个 Draft PR
→ 完整代码级验收
→ 有限遗留登记到下一完整模块
```

---

## 3. 唯一执行授权

每阶段开始前依次阅读：

1. 根目录当前开发说明；
2. `docs/remediation/README.md`；
3. `docs/remediation/REMEDIATION_MASTER_PLAN_V1.md`；
4. 本索引；
5. 当前人工任务书；
6. 前置 Closeout、测试和实际源码；
7. 涉及 UI 时读取 `docs/design/`；
8. 任务书指定的参考项目和 LICENSE。

Task 06 生产实施必须同时满足：

```text
本索引指向 Task 06
+
docs/remediation/TASK_06_DURABLE_ORGANIZATION_PLAN_AND_DRY_RUN.md 存在
+
该任务书已位于当前 master
+
master 包含 5468a17790165a149c462a17b64d011750b45410
```

任务书进入 master 即满足文档门禁，不得再使用旧 PR 的 Draft/Open 状态、Task 05 旧 Closeout 文案或过时索引制造额外阻断。

`BRIEF.md`、`00-overview.md`、旧对标分析、PR review 备忘和临时计划不授权生产修改。当前代码与测试是事实来源，当前人工 Task 是执行合同。

Codex 只负责实施、migration、测试、原子提交、唯一 Draft PR 和 Closeout；不得重写任务书、拆分阶段或提前建设 Task 07。

---

## 4. 统一门禁

### 开始前

```bash
git checkout master
git pull --ff-only
git status --short
git rev-parse HEAD
npm run typecheck
npm test
npm run test:remediation
npm run test:performance
npm run build
npm run verify:rust
npm run security:audit
npm run security:audit:rust
```

环境无法运行的项目必须如实记录并由 GitHub CI 补充；不得删除测试、放宽断言或关闭功能规避。

### 实施中

-只修改任务书允许范围；
-测试与生产代码同步；
-不把 compatibility API 变成永久双轨；
-renderer 不重复 Rust 的安全解析；
-不绕过 Global Index、Managed Scope、Managed AI queue、preview、journal、Safe Trash 或 restore；
-一个实施分支、一个 Draft PR；
-内部原子提交不是独立任务；
-先关闭 Task 05 接受遗留，再连续完成整个 Task 06。

### 完成后

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

还必须满足 Task 06 的 schema 32、plan recovery、100/1k/10k、100k selection、1M deferred/exact count、权限、Windows/macOS 和打包专项门禁。

---

## 5. 已冻结的核心边界

### Scan / Watcher

- File Library Managed Scan 与 Global Index 独立；
- scanner 是 `scan_seen` 和 generation 唯一 owner；
- Rust/Tauri 是 watcher mutation/reconciliation owner；
- watcher 不写 `scan_seen`、不推进 generation；
- custom search roots 和 Global Index 不写 managed `files`。

### Identity / Dedupe

-不迁移 `files.id`；
- operation/restore identity 与 dedupe physical identity 分离；
- active duplicate group/member 是重复权威；
- hardlink 多路径只算一个物理副本；
- duplicate/finding 不直接授权 mutation。

### Analysis / Cleanup

- Analysis Run/Finding/Decision 是 durable truth；
- finding 不是 mutation 授权；
- cleanup/delete 继续走 cleanup journal 和 Safe Trash；
- Task 06 Organization Plan 不允许 `move_to_trash` 或 delete；
-不修改 operation/cleanup journal schema。

### Global Search

- `global_entries/global_entries_fts/global_volumes` 是唯一全局搜索 authority；
- Global Search 与 File Library Query V2 独立；
- disabled/stale/degraded source fail closed；
- open/reveal 使用 entry ID 并由 backend revalidate；
- Search window 不获得 Organization Plan 权限。

### File Library

- managed `files` 是 File Library authority；
- Query V2 只在 managed scope 内查询，不 join Global Index；
- V2 scope 由 durable scan root/session ID 解析；
- cursor anchor 和 tuple 必须由 backend live validation；
- snapshot 使用 File Library 专用 revision；
- user tags 与系统分类分离；
- schema 31 不 ALTER `files` 大表、不迁移 `files.id`。

### Managed AI

-现有 durable Managed AI queue 是唯一 AI execution owner；
- Task 06 只增加 plan-ID adapter；
- provider policy、managed scope、fingerprint、cancel 和 correction gate 不得旁路；
-AI 不自动接受、编辑或执行计划；
- metadata-only，Task 08 前不读取文件内容。

### Organization Plan / Mutation

- Organization Plan 是 durable approval/provenance artifact；
- plan item snapshot 不是当前 file identity；
- proposal 由 backend 生成；
-renderer 只提交 IDs、decision 和 edited filename；
- dry run 不是执行授权的永久凭证，任何 revision/identity 变化使其失效；
-真正 mutation 继续经过 authoritative preview、identity、source claim、operation journal 和 restore；
- journal 是 filesystem truth，plan 只投影结果。

---

## 6. Task 05 合并时接受并转入 Task 06 的强制遗留

Task 06 第一组必须关闭，且不得再次后移：

1. 修复 `VaultView` query effect 与 `loadFirstPage(spec)` 的循环，并以 mounted invoke-count 测试证明；
2. cursor 合法 JSON 篡改必须通过 backend anchor membership + complete tuple revalidation 拒绝；
3. 100,000 explicit selection 使用 TEMP/request-local set，exclusions 不受错误的 128 上限；
4. snapshot expired 保留 rows、显示 banner、使 all-matching selection 失效；
5. tags 完整 create/rename/color/delete-confirm/assign/remove UI；
6. Saved Views 完整 create/open/rename/update/delete/position UI；
7. Detail active finding 与 selection common directory/tag commonality；
8. tag/Saved View 使用 mandatory monotonic revision CAS；
9. 1M complex query 采用 deferred exact count：首屏真实且 bounded，精确 count 另行解析，不估算。

完成这些问题后继续 Task 06 plan ledger、review、dry run、execution 和 recovery，不得停下等待单独验收。

---

## 7. Task 06 冻结决定

1. 参考 `hyperfield/ai-file-sorter` SHA `cd9a024219b9434fb0a1df6b272f7145d9c67b28`，许可证 GNU AGPL-3.0，仅概念级借鉴；
2. schema 31→32；
3.新增 `organization_plans`、`organization_plan_items`；
4. `user_tags` 与 `library_saved_views` 增加单调 revision；
5. plan source 只接受 File Library V2 selection/query；
6. plan materialization 上限 10,000，单次 execution 上限 1,000；
7. current classification + authoritative preview 生成 proposal；
8. plan decision 为 durable backend truth；
9. filename 可编辑，target directory/path 和 operation kind 不可由 renderer 修改；
10. stale proposal 不继承 accepted/edited 执行授权；
11. AI 只复用现有 Managed AI queue；
12. dry run 每次 live revalidation 并绑定 plan revision/item set；
13. execution 复用现有 operation journal，允许内部 caller-generated batch ID，但不改 journal schema；
14. crash recovery 从 operation logs 投影，不自动重放；
15. cleanup/delete/trash 不进入 Organization Plan；
16.默认不新增依赖或 lockfile；
17. Task 07–08 不开始。

权威任务书：

```text
docs/remediation/TASK_06_DURABLE_ORGANIZATION_PLAN_AND_DRY_RUN.md
```

---

## 8. 标准交付

Task 06 完成时必须：

1. 分支 `remediation/06-organization-plan`；
2. 一个 Draft PR；
3. 可审查原子提交；
4. schema 32 migration/rollback 证据；
5. Task 05 九项遗留全部关闭；
6. Organization Plan、review、AI adapter、dry run、execution、restart projection 全部完成；
7. 完整 frontend/Rust/remediation/security/performance/build；
8. Windows/macOS 与 package 证据；
9. `TASK_06_IMPLEMENTATION_CLOSEOUT.md`；
10. 停止等待人工验收；
11. 不自动合并、不开始 Task 07。