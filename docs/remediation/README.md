# Zen Canvas Architecture Remediation V1

本目录管理 Zen Canvas 在 PR #15 之后的架构整改、SQLite 演进、跨模块重构和 Codex 分阶段实施。

- `docs/design/`：品牌、UI/UX、页面交互和视觉验收；
- `docs/remediation/`：Rust/Tauri、SQLite、索引、文件身份、搜索、文件库、整理计划、规则、内容理解和工程治理。

涉及界面时同时遵守当前设计规范；涉及文件、数据库、AI、权限、隐私和恢复时，既有安全边界优先。

---

## 1. 当前基线

- 仓库：`ArdenZC/Zen-Canvas`；
- 默认分支：`master`；
- PR #15 锚点：`a2c0516dc7a8628cb7210003da3d66f5d84f3a2f`；
- Task 04 / PR #35 squash merge：`14616d4344314afce0878dbc681988c04183a9bc`；
- Task 05 / PR #38 squash merge：`5468a17790165a149c462a17b64d011750b45410`；
- Task 06 / PR #40 squash merge：`29e85c099c5ee921ad7d4237c780dc47126e0fa3`；
- Task 07 / PR #42 squash merge：`4e07de9c02198eb3352d9b2b1f289d61a3df128c`；
- 当前数据库基线：schema 33；
- Task 08 授权 schema：`33→34`；
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
7. 自然语言规则 — Coworker + OpenCode；
8. 本地内容理解 — Local-File-Organizer。

当前映射：

- Task 01A/01B：扫描与索引，已完成；
- Task 02：重复检测，已完成；
- Task 03：大型文件/空间分析，已完成；
- Task 04：已通过 PR #35 合并；
- Task 05：已通过 PR #38 合并，schema 31；
- Task 06：已通过 PR #40 合并，schema 32；
- Task 07：已通过 PR #42 合并，schema 33；
- Task 08：**当前唯一可执行完整模块，授权 schema 34**。

禁止创建独立 debt-cleanup、07.5、08A/08B/08C、OCR-only 或其他产品模块。上一阶段人工接受的遗留进入下一完整模块第一组，然后继续完成该模块，不单独停点。Task 08 完成后不得自行创建 Task 09。

---

## 3. 执行授权

Codex 开始阶段前依次阅读：

1. 根目录 `AGENTS.md`、`CLAUDE.md` 或当前开发说明；
2. 本 `README.md`；
3. `REMEDIATION_MASTER_PLAN_V1.md`；
4. `CODEX_REMEDIATION_INDEX_V1.md`；
5. 当前人工任务书；
6. 前置任务书、Closeout、PR review、测试和实际源码；
7. 涉及 UI 时读取 `docs/design/`；
8. 任务书指定的参考项目、固定 SHA 和 LICENSE。

生产实施必须满足：

```text
主索引指向当前完整模块
+
人工任务书存在
+
任务书已位于当前 master
```

Task 08 当前权威入口：

```text
docs/remediation/TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md
```

实施分支：

```text
remediation/08-local-content-understanding
```

`BRIEF.md`、旧模块分析、历史 PR Draft/Open 文案、临时 review 备忘和聊天指令仅供研究，不覆盖当前 Task 08 任务书。事实与冲突优先级：数据/恢复/隐私/许可证安全 → 当前源码与测试 → 当前 Task → Index → Master Plan → 旧研究。

---

## 4. 执行原则

### 4.1 一个完整模块、一个实施分支、一个 Draft PR

每阶段必须连续完成整个产品模块、完整测试、性能、安全、跨平台验证和 Closeout，然后停止等待人工代码级审核。

不得拆分授权任务、创建并行生产 PR、中途完成内部子模块就停止、顺手创建 Task 09 或自动合并。

### 4.2 任务书由人工冻结

架构、参考边界、schema、状态机、允许范围和验收标准由任务书冻结。Codex 只实施代码、migration、测试、原子提交、唯一 Draft PR 和 Closeout；不得重写任务书或重排阶段。

### 4.3 遗留处理

Task 08 第一组必须关闭 Task 07 人工代码审查接受的六项：

1. effective Rule catalog 覆盖 learned/settings 等全部实际 ruleset 变化；
2. Rule execution catalog/rules/scope 单一权威快照；
3. impact preview 与真实 classification engine differential equivalence；
4. Proposal Workspace 完整审核事实；
5. manual candidate edit provenance；
6. backend-owned forbidden prompt intent gate。

这些问题不得再次后移，且必须有真实行为、并发或 differential tests。

### 4.4 不得重复建设

后续扩展现有 Global Index、Managed File Library、Managed Scope、provider client、Rule AST、Organization Plan、preview/journal/Safe Trash/restore，不建设第二套索引、第二 durable AI queue、通用 Job Runtime、向量数据库或恢复入口。

### 4.5 Task 08 特别授权与禁止

Task 08 授权 schema 33→34，新增 consent-bound content policies、runs/items、Content Artifact 和 managed content FTS。允许增加最小纯 Rust 格式解析依赖并记录 license/lockfile/package size。

禁止：

- ALTER `files` 大表；
- 迁移 `files.id`；
- 修改 operation/cleanup journal schema；
- OCR/image VLM；
- Python/Conda/Tesseract/Nexa/external executable；
- Rule AST V2/content condition；
- cloud 静默发送；
- second durable AI queue；
- Agent/shell/MCP/tools；
- automatic filesystem mutation；
- Task 09。

---

## 5. 持续安全不变量

1. 扫描、索引、搜索、分析、tag、plan、rule 和 content 构建本身不修改用户文件；
2. Global Index 与 managed File Library/Content Search 是独立数据域；
3. Global Search 不 join Content Artifact；
4. 只有明确 managed scope 和健康 root 才可进入内容分析；
5. 内容分析默认关闭并要求 authoritative preview + confirmation；
6. 文件 mutation 继续经过 preview、identity、journal、Safe Trash 和 restore；
7. renderer path/file list/count/bytes/raw content 不成为 authority；
8. disabled、unavailable、partial、expired、stale 或 blocked 不得表示为 complete/current/safe；
9. user tag、Rule、classification、Content Artifact 分离；
10. Organization Plan 是审核/provenance artifact，不是 operation journal；
11. Rule Proposal 是候选规则 artifact，不是 execution authority；
12. Content Artifact 不是 file identity 或 mutation authority；
13. AI/provider 不自动接受、启用、运行、发送云端或执行计划；
14. delete content data 不删除源文件；
15.参考项目许可证边界不得因同栈而降低。

---

## 6. 标准分支

```text
remediation/06-organization-plan
remediation/07-rule-proposal
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
├── TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md
├── TASK_02_IDENTITY_FINGERPRINT_AND_DUPE.md
├── TASK_03_ANALYSIS_RUN_FINDING_AND_DETECTORS.md
├── TASK_04_GLOBAL_SHORTCUT_SEARCH.md
├── TASK_05_FILE_LIBRARY_QUERY_TAGS_SAVED_VIEWS.md
├── TASK_06_DURABLE_ORGANIZATION_PLAN_AND_DRY_RUN.md
├── TASK_07_NATURAL_LANGUAGE_RULE_PROPOSAL_AND_APPROVAL.md
├── TASK_07_IMPLEMENTATION_CLOSEOUT.md
└── TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md
```

---

## 8. 完成汇报最低内容

Task 08 必须汇报 baseline/final HEAD、Task 07 六项遗留关闭证据、修改文件、owner/data flow、参考项目 SHA/许可证/借鉴与拒绝、schema/dependency/lockfile/package size、extractor/consent/provider/privacy、兼容与安全、recovery/retention/rebuild/delete、测试、性能、Windows/macOS/package、已知风险、提交列表、唯一 Draft PR，并明确停止且未创建 Task 09。