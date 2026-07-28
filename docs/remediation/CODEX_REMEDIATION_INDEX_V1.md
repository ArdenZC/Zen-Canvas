# Zen Canvas Codex Remediation Index V1

## 1. 当前执行状态

- Task 00 已通过 PR #16 验收并合并；
- Task 01A/01B 已完成扫描代际与 watcher reconciliation；
- Task 02 已通过 PR #26 合并，数据库推进至 schema 29；
- Task 03 已通过 PR #28 合并，数据库推进至 schema 30；
- Task 04 已通过 PR #35 合并，squash merge 为 `14616d4344314afce0878dbc681988c04183a9bc`；
- Task 04 人工接受的 4 项遗留已冻结为 Task 05 第一组生产改动，不得再次后移；
- Task 05 是当前唯一可执行完整产品模块；
- Task 06–08 继续禁止执行。

| 阶段 | 任务书 | 产品模块/目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 后架构、安全和数据基线审计 | 已完成 |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | scan generation、run/session、scan_seen、恢复 | 已完成 |
| 01B | `TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md` | Rust watcher owner、revision gap、reconciliation | 已完成 |
| 02 | `TASK_02_IDENTITY_FINGERPRINT_AND_DUPE.md` | 模块 1：重复检测；Czkawka 对标 | 已合并，schema 29 |
| 03 | `TASK_03_ANALYSIS_RUN_FINDING_AND_DETECTORS.md` | 模块 2：大型文件/空间分析；Spacedrive V1 对标 | 已合并，schema 30 |
| 04 | `TASK_04_GLOBAL_SHORTCUT_SEARCH.md` | 模块 4：全局快捷搜索；Tolaria 设计级对标 | 已合并，schema 30 |
| 05 | `TASK_05_FILE_LIBRARY_QUERY_TAGS_SAVED_VIEWS.md` | 模块 5：文件库；Query V2、cursor、selection、tags、Saved Views、Inspector | **当前唯一可执行；授权 schema 31** |
| 06 | 待创建 | 模块 6：AI 整理预览；Organization Plan | 禁止执行 |
| 07 | 待创建 | 模块 7：自然语言规则；Proposal → Rule AST | 禁止执行 |
| 08 | 待创建 | 模块 8：本地内容理解；Content Artifact | 禁止执行 |

不得创建 debt-cleanup、04.5、05A/05B/05C 或并行产品阶段。上一阶段接受遗留必须作为下一完整模块第一组关闭，然后继续完成该模块。

---

## 2. 固定的 8 模块主线

| 原模块 | Zen Canvas 功能 | 参考项目 | 借鉴边界 | 当前承载阶段 |
|---|---|---|---|---|
| 1 | 重复检测 | Czkawka | 按许可证登记，独立实现 | Task 02，已完成 |
| 2 | 大型文件/空间分析 | Spacedrive V1 | 概念级，拒绝过度复杂架构 | Task 03，已完成 |
| 3 | 扫描与索引 | Spacedrive V1 | Job/Location/Indexer 概念级 | Task 01A/01B，已完成 |
| 4 | 全局快捷搜索 | Tolaria | AGPL 设计级，只读分析不移植 | Task 04，已完成 |
| 5 | 文件库 | TagSpaces | AGPL 设计级，不复制实现或结构 | Task 05，当前 |
| 6 | AI 整理预览 | ai-file-sorter | AGPL 概念级 | Task 06 |
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

Task 05 生产实施必须同时满足：

```text
本索引指向 Task 05
+
docs/remediation/TASK_05_FILE_LIBRARY_QUERY_TAGS_SAVED_VIEWS.md 存在
+
该任务书已位于当前 master
+
master 包含 14616d4344314afce0878dbc681988c04183a9bc
```

任务书进入 master 即满足文档门禁，不得再使用旧 PR 的 Draft/Open 状态或过时索引文案制造额外阻断。

`BRIEF.md`、`00-overview.md`、旧对标分析、PR review 备忘和临时计划不授权生产修改。当前代码与测试是事实来源，当前人工 Task 是执行合同。

Codex 只负责实施、migration、测试、原子提交、唯一 Draft PR 和 Closeout；不得重写任务书、拆分阶段或提前建设 Task 06。

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
-不把兼容 API 变成永久双轨；
-renderer 不重复 Rust 的安全解析；
-不绕过 Global Index、Managed Scope、AI queue、preview、journal、Safe Trash 或 restore；
-一个实施分支、一个 Draft PR；
-内部原子提交不是独立任务；
-先关闭上一阶段接受遗留，再连续完成整个 Task 05。

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

还必须满足 Task 05 的 schema 31、query plan、100k/1M、权限、Windows/macOS 和打包专项门禁。

---

## 5. 已冻结的核心边界

### Scan / Watcher

- File Library Managed Scan 与 Global Index 独立；
- scanner 是 `scan_seen` 和 generation 唯一 owner；
- Rust/Tauri 是 watcher mutation/reconciliation owner；
- watcher 不写 `scan_seen`、不推进 generation；
- custom search roots 和 Global Index 不写 managed `files`。

### Identity / Dedupe

- 不迁移 `files.id`；
- operation/restore identity 与 dedupe physical identity 分离；
- active duplicate group/member 是重复权威；
- hardlink 多路径只算一个物理副本；
- Duplicate Groups UI 只读。

### Analysis / Cleanup

- Analysis Run/Finding/Decision 是 durable truth；
- finding 不是 mutation 授权；
-所有 mutation 继续经过 authoritative preview、identity、journal、Safe Trash 和 restore；
-不修改 operation/cleanup journal schema。

### Global Search

- `global_entries/global_entries_fts/global_volumes` 是唯一全局搜索 authority；
- Global Search 与 File Library Query V2 独立；
- disabled/stale/degraded source fail closed；
- open/reveal 使用 entry ID 并由 backend revalidate；
- command surface 不成为 mutation authority。

### File Library

- managed `files` 是 File Library authority；
- Query V2 只在 managed scope 内查询，不 join Global Index；
- V2 scope 由 durable scan root/session ID 解析，不信任 renderer 任意 path；
- cursor 是 backend-issued keyset cursor，不复用 Global Search cursor；
- snapshot 使用 File Library 专用 revision，不复用 scan generation；
- user tags 与 Purpose/Lifecycle/Risk/AI classification 分离；
- selection 只授权 metadata tag mutation，不直接移动、删除、重命名或执行建议；
- Inspector detail/reveal 使用 file ID；
- schema 31 不 ALTER `files` 大表、不迁移 `files.id`。

---

## 6. Task 04 合并时接受并转入 Task 05 的强制遗留

Task 05 第一组必须关闭，且不得再次后移：

1. `permission_required`、Spotlight/FSEvents unavailable 等 degraded Global Search source 不得被表示为 complete；
2. standalone navigation 在 main-window ready ACK 后必须重新验证原 session/revision，并只隐藏原 session，旧请求不得隐藏新窗口；
3. extension tier 必须以 durable `ge.id` 最终 tie-break，punctuation fallback 必须保持 `.gitignore`、`C++` 等查询语义且 benchmark 断言正确结果；
4. 增加 mounted `CommandModal` IME 测试，证明 composition 期间 0 次 backend query，compositionend 后只提交最终查询一次。

完成这 4 项后继续 Task 05 Query V2、selection、tags、Saved Views 和 Inspector，不得停下等待单独验收。

---

## 7. Task 05 冻结决定

1. Task 05 是完整文件库模块，参考 `tagspaces/tagspaces` SHA `7ec3a2e8632b8bf5db685436e6d2d8805977a880`，仅 AGPL 设计级借鉴；
2. schema 30→31，新增 `user_tags`、`file_user_tags`、`library_saved_views`、`library_query_state`；
3. `file_user_tags.file_id` 必须 `ON UPDATE CASCADE`，以兼容现有 operation/restore 更新 `files.id` 的行为；
4. Query V2 将 text/filter/sort 下沉 SQLite；
5. V2 分页使用 revision-validated stateless snapshot + opaque keyset cursor，禁止 OFFSET；
6. list summary、Inspector detail、selection summary DTO 分离；
7. selection 支持 explicit 与 all_matching + exclusions，UI 必须区分“已加载”与“全部匹配”；
8. tags 是数据库 metadata，不写 filename/sidecar，不触发 AI 或文件操作；
9. Saved View 保存 canonical QuerySpec，不保存 cursor、selection、SQL 或任意 path；
10. VaultView 移除 renderer 端 advanced filtering/sorting 和 10k collection workaround；
11. 默认不新增依赖或 lockfile；
12. Task 06 Organization Plan、AI 自动整理和 Content Artifact 均禁止开始。

权威任务书：

```text
docs/remediation/TASK_05_FILE_LIBRARY_QUERY_TAGS_SAVED_VIEWS.md
```

---

## 8. 标准交付

Task 05 完成时必须：

1. 分支 `remediation/05-file-library`；
2. 一个 Draft PR；
3. 可审查原子提交；
4. schema 31 migration/rollback 证据；
5. Query V2、selection、tags、Saved Views、Inspector 全部完成；
6. 完整 frontend/Rust/remediation/security/performance/build；
7. Windows/macOS 与 package 证据；
8. `TASK_05_IMPLEMENTATION_CLOSEOUT.md`；
9. 停止等待人工验收；
10. 不自动合并、不开始 Task 06。
