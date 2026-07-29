# Zen Canvas Architecture Remediation V1

本目录管理 Zen Canvas 在 PR #15 之后的架构整改、SQLite 演进、跨模块重构和 Codex 分阶段实施。

- `docs/design/`：品牌、UI/UX、页面交互和视觉验收；
- `docs/remediation/`：Rust/Tauri、SQLite、索引、文件身份、搜索、文件库、整理计划、内容理解和工程治理。

涉及界面时同时遵守当前设计规范；涉及文件、数据库、AI、权限和恢复时，既有安全边界优先。

---

## 1. 当前基线

- 仓库：`ArdenZC/Zen-Canvas`；
- 默认分支：`master`；
- PR #15 锚点：`a2c0516dc7a8628cb7210003da3d66f5d84f3a2f`；
- Task 03 / PR #28 merge：`70427ff648dd5b9fab66e247fbf0a5ddf8912f45`；
- Task 04 / PR #35 squash merge：`14616d4344314afce0878dbc681988c04183a9bc`；
- Task 05 / PR #38 squash merge：`5468a17790165a149c462a17b64d011750b45410`；
- 当前数据库基线：schema 31；
- Task 06 授权目标：schema 32；
- 当前版本线：`0.1.40`。

每个任务开始时必须记录实际 `HEAD` 并确认包含对应前置合并提交，不得 reset 到文档中的旧 SHA。

---

## 2. 固定产品模块主线

1. 重复检测 — Czkawka；
2. 大型文件/空间分析 — Spacedrive V1；
3. 扫描与索引 — Spacedrive V1；
4. 全局快捷搜索 — Tolaria；
5. 文件库 — TagSpaces；
6. AI 整理预览 — ai-file-sorter；
7. 自然语言规则 — Accomplish + OpenCode；
8. 本地内容理解 — Local-File-Organizer。

当前映射：

- Task 01A/01B：扫描与索引，已完成；
- Task 02：重复检测，已完成；
- Task 03：大型文件/空间分析，已完成；
- Task 04：全局快捷搜索，已通过 PR #35 合并；
- Task 05：文件库，已通过 PR #38 合并，schema 31；
- Task 06：Durable Organization Plan、审核式 dry run 与安全执行，当前唯一可执行完整模块；
- Task 07–08：禁止执行。

禁止创建独立 debt-cleanup、05.5、06A/06B/06C 或其他产品模块。上一阶段人工接受的遗留进入下一完整模块第一组，然后继续完成该模块，不单独停点。

---

## 3. 执行授权

Codex 开始阶段前依次阅读：

1. 根目录 `AGENTS.md`、`CLAUDE.md` 或当前开发说明；
2. 本 `README.md`；
3. `REMEDIATION_MASTER_PLAN_V1.md`；
4. `CODEX_REMEDIATION_INDEX_V1.md`；
5. 当前人工任务书；
6. 前置 Closeout、测试和实际源码；
7. 涉及 UI 时读取 `docs/design/`；
8. 任务书指定的参考项目和 LICENSE。

生产实施必须满足：

```text
主索引指向当前完整模块
+
人工任务书存在
+
任务书已位于当前 master
```

Task 06 权威入口：

```text
docs/remediation/TASK_06_DURABLE_ORGANIZATION_PLAN_AND_DRY_RUN.md
```

任务书进入 master 即满足文档门禁，不得再使用旧 PR 的 Draft/Open 文案制造额外阻断。

`BRIEF.md`、`00-overview.md`、旧模块分析、PR review 备忘和临时计划仅供研究，不授权生产修改。事实与冲突优先级：数据/恢复/许可证安全 → 当前源码与测试 → 当前 Task → Index → Master Plan → 旧研究。

---

## 4. 执行原则

### 4.1 一个完整模块、一个实施分支、一个 Draft PR

每阶段必须连续完成整个产品模块、完整测试、性能、安全、跨平台验证和 Closeout，然后停止等待人工代码级审核。

不得拆分授权任务、创建并行生产 PR、中途完成内部子模块就停止、顺手开始后续模块或自动合并。

### 4.2 任务书由人工编写

架构、参考边界、schema、状态机、允许范围和验收标准由人工冻结。Codex 只实施代码、migration、测试、原子提交、唯一 Draft PR 和 Closeout；不得重写任务书或重排阶段。

### 4.3 遗留处理

人工接受有限遗留时必须记录 failure mode、登记 Risk Register、转入下一完整模块第一组、给出测试，且不得再次后移。

Task 06 第一组必须关闭 Task 05 人工审查的 9 项：

1. Vault query effect / `loadFirstPage` 持续请求循环；
2. 可被合法 JSON 篡改的 File Library cursor；
3. 非真正 chunk-safe 的 100,000 explicit selection 与 exclusions 上限错误；
4. snapshot-expired 覆盖列表且未失效 all-matching selection；
5. 用户标签与 Saved Views CRUD UI 不完整；
6. Detail 缺 active finding、selection summary 缺 common directory/tag commonality；
7. optional/秒级 optimistic concurrency；
8. `aria-activedescendant` 指向未挂载虚拟行；
9. 1M complex exact count 未按门禁处理。

这些问题采用 Task 06 任务书冻结的 authoritative cursor anchor、TEMP selection set、revision CAS 和 deferred exact count 方案，不得再次后移。

### 4.4 不得重复建设

后续扩展现有 Global Index、Managed AI、scan/watcher、dedupe、Analysis/Finding、preview/journal/Safe Trash/restore，不建设第二套索引、AI 队列、文件 mutation 或恢复入口。

### 4.5 Task 06 特别授权与禁止

Task 06 授权 schema 31→32，新增 Organization Plan/Item ledger，并为 Task 05 小表补单调 revision。禁止 ALTER `files` 大表、迁移 `files.id`、修改 operation/cleanup journal schema、建设第二 AI queue、读取文件内容、开始自然语言规则或 Content Artifact、增加依赖或 lockfile。

---

## 5. 持续安全不变量

1. 扫描、索引、搜索、分析、tag 和 plan 构建本身不修改用户文件；
2. Global Index 与 managed File Library 是独立数据域；
3. Global Search、File Library Query V2 和 Organization Plan revision 不互用；
4. 只有明确 managed scope 才可进入 AI/整理；
5. 文件 mutation 继续经过 authoritative preview、identity、journal、Safe Trash 和 restore；
6. renderer path 不成为 action authority；
7. disabled、unavailable、partial、expired、stale 或 blocked 不得表示为 complete/safe；
8. user tag 与 Purpose/Lifecycle/Risk/AI classification 分离；
9. all-matching selection 必须绑定 canonical query、fingerprint 和 snapshot revision；
10. Organization Plan 是审核与 provenance artifact，不是 operation journal；
11. AI 不得自动接受或执行计划；
12. delete/trash 不进入 Task 06 Organization Plan；
13.参考项目许可证边界不得因同栈而降低。

---

## 6. 标准分支

```text
remediation/06-organization-plan
remediation/07-natural-language-rules
remediation/08-local-content-understanding
```

原子提交必须描述单一目的，不使用 `update`、`fix stuff` 或 `refactor all`。

---

## 7. 当前权威文档

```text
docs/remediation/
├── README.md
├── REMEDIATION_MASTER_PLAN_V1.md
├── CODEX_REMEDIATION_INDEX_V1.md
├── POST_MERGE_BASELINE_AUDIT.md
├── REMEDIATION_CAPABILITY_MATRIX.md
├── REMEDIATION_RISK_REGISTER.md
├── TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md
├── TASK_01A_IMPLEMENTATION_CLOSEOUT.md
├── TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md
├── TASK_01B_IMPLEMENTATION_CLOSEOUT.md
├── TASK_02_IDENTITY_FINGERPRINT_AND_DUPE.md
├── TASK_02_IMPLEMENTATION_CLOSEOUT.md
├── TASK_03_ANALYSIS_RUN_FINDING_AND_DETECTORS.md
├── TASK_03_IMPLEMENTATION_CLOSEOUT.md
├── TASK_04_GLOBAL_SHORTCUT_SEARCH.md
├── TASK_04_IMPLEMENTATION_CLOSEOUT.md
├── TASK_05_FILE_LIBRARY_QUERY_TAGS_SAVED_VIEWS.md
├── TASK_05_IMPLEMENTATION_CLOSEOUT.md
└── TASK_06_DURABLE_ORGANIZATION_PLAN_AND_DRY_RUN.md
```

Task 07–08 的任务书只能在前一完整模块人工验收合并后创建。

---

## 8. 完成汇报最低内容

每阶段必须汇报 baseline/final HEAD、修改文件、owner/data flow、参考项目 SHA/许可证/借鉴与拒绝、schema/dependency、兼容与安全、测试、性能、Windows/macOS/package、已知风险、提交列表、唯一 Draft PR，并明确停止且未开始下一模块。