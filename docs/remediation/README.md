# Zen Canvas Architecture Remediation V1

本目录用于管理 Zen Canvas 在 PR #15 合并后的架构整改、数据模型演进、跨模块重构和 Codex 分阶段任务。

它与 `docs/design/` 的职责不同：

- `docs/design/`：品牌、UI/UX、页面交互、视觉规范和设计验收；
- `docs/remediation/`：Rust/Tauri、SQLite、任务与队列、索引、文件身份、搜索、整理计划、查询协议、内容理解和跨模块工程治理。

两套文档可以同时生效。涉及界面时遵守当前 UI/UX 规范；涉及文件系统、数据库、AI、搜索或恢复时，既有安全边界优先。

---

## 1. 当前基线

- 仓库：`ArdenZC/Zen-Canvas`
- 默认分支：`master`
- PR #15：已合并
- PR #15 锚点：`a2c0516dc7a8628cb7210003da3d66f5d84f3a2f`
- Task 03 / PR #28 merge：`70427ff648dd5b9fab66e247fbf0a5ddf8912f45`
- 当前数据库基线：schema 30
- 当前版本线：`0.1.40`

每个任务开始时必须记录实际 `HEAD`，并确认它包含对应前置合并提交。不得假设本文件记录的 SHA 永远是最新 HEAD。

---

## 2. 固定产品模块主线

整改按以下 8 个功能模块推进：

1. 重复检测 — Czkawka；
2. 大型文件/空间分析 — Spacedrive V1；
3. 扫描与索引 — Spacedrive V1；
4. 全局快捷搜索 — Tolaria；
5. 文件库 — TagSpaces；
6. AI 整理预览 — ai-file-sorter；
7. 自然语言规则 — Accomplish + OpenCode；
8. 本地内容理解 — Local-File-Organizer。

实施依赖导致模块 3 先于模块 1/2 完成，但剩余任务必须继续对应完整产品模块：

- Task 01A/01B：扫描与索引，已完成；
- Task 02：重复检测，已完成；
- Task 03：大型文件/空间分析，已完成；
- Task 04：全局快捷搜索，当前阶段；
- Task 05：文件库；
- Task 06：AI 整理预览；
- Task 07：自然语言规则；
- Task 08：本地内容理解。

禁止创建独立 debt-cleanup、03.5、04A/04B 或其他新产品模块。上一阶段人工接受的遗留必须作为下一完整模块第一组生产改动完成，然后继续完成该模块。

---

## 3. 文档优先级与执行授权

Codex 开始阶段前依次阅读：

1. 根目录 `AGENTS.md`、`CLAUDE.md` 或当前开发说明；
2. 本 `README.md`；
3. `REMEDIATION_MASTER_PLAN_V1.md`；
4. `CODEX_REMEDIATION_INDEX_V1.md`；
5. 当前人工编写并批准的 `TASK_*.md`；
6. 前置 closeout、测试和实际源码；
7. 涉及 UI 时读取当前 `docs/design/`；
8. 任务书指定的参考项目和 LICENSE。

### 3.1 唯一执行授权

生产实施必须满足：

```text
主索引指向当前完整模块
+
人工 TASK_*.md 存在
+
任务书已位于当前 master
```

Task 04 的权威入口：

```text
docs/remediation/TASK_04_GLOBAL_SHORTCUT_SEARCH.md
```

任务书位于当前 master 即满足文档合并门禁；不得再使用旧 PR 的 Draft/Open 文案制造额外阻断。

### 3.2 研究文档不得自行授权

以下文档用于调研、参考项目对比、许可证结论和未来输入，但不直接授权生产实施：

- `BRIEF.md`；
- `00-overview.md`；
- `01-dedupe.md` 等模块研究文档；
- PR review 备忘；
- Claude/Codex 临时计划；
-未写入人工任务书的决策日志。

它们不得自行改变 schema、阶段、前置关系或安全边界。模块映射由 Master Plan/Index 冻结，具体执行由当前 Task 冻结。

### 3.3 事实与冲突优先级

1. 数据安全、文件安全、恢复和许可证边界最高；
2. 当前生产源码与测试是事实来源；
3. 当前人工 Task 是执行合同；
4. Index 是阶段入口；
5. Master Plan 是产品模块主线；
6. 旧研究和讨论仅作参考。

发现无法判断的冲突时停止并汇报，不自行扩大范围。

---

## 4. 执行原则

### 4.1 一个完整模块、一个分支、一个 Draft PR

每阶段必须：

-独立实施分支；
-一个 Draft PR；
-可审查原子提交；
-连续完成整个模块；
-完整测试、性能、安全和跨平台验证；
-Closeout；
-停止等待人工代码级审核。

不得：

-拆分为多个授权任务；
-创建并行生产 PR；
-中途完成一个内部子模块就停止要求重新设计；
-顺手开始后续产品模块；
-自动合并。

### 4.2 任务书由人工编写

-架构分析、参考项目边界、schema、状态机、允许范围和验收标准由人工完成；
-Codex 只负责实现、migration、测试、提交、Draft PR 和汇报；
-Codex 不重新写任务书、不重排阶段、不提前建后续表。

### 4.3 遗留处理

人工可以在不破坏当前模块核心安全与可用性的前提下接受有限遗留。接受时必须：

-记录 failure mode；
-登记 Risk Register；
-转入下一完整模块第一组；
-下一 Task 给出测试；
-不得再次后移；
-不得创建独立收尾阶段。

### 4.4 不得重复建设

PR #15 及后续任务已经加入或强化：

- Windows MFT/USN 与 macOS Spotlight/FSEvents；
-disabled volume 隔离；
-原生文件身份；
-Managed AI 持久队列；
-scope/provider/fingerprint/correction gate；
-scan/watcher durable ownership；
-fingerprint/dedupe groups；
-Analysis Run/Finding；
-preview/journal/Safe Trash/restore；
-跨平台 CI。

后续先扩展现有能力，不建设第二套 Global Index、第二套 Managed AI queue、第二套文件 mutation 或恢复入口。

### 4.5 默认禁止事项

除非当前 Task 明确授权：

-不修改 schema；
-不新增第三方依赖或 lockfile；
-不改变持久化协议；
-不删除、放宽或跳过测试；
-不删除功能规避架构问题；
-不把 mock、调试页或测试数据带入生产；
-不把 AI/command/finding 变成任意文件操作 Agent；
-不信任 renderer 提交的 path/identity；
-不让 unmanaged 文件进入内容提取或 cloud AI；
-不将清理改为永久删除；
-不绕过 preview、journal、Safe Trash、restore；
-不修改发布版本、tag、release 或公开发布配置。

---

## 5. 安全与产品不变量

所有整改持续满足：

1. 扫描、索引、搜索、分析本身不修改用户文件；
2. Global Index 是 metadata-only 独立数据域；
3. Global Search 与 File Library/Managed AI scope 隔离；
4. 只有明确 managed scope 才能进入内容理解、AI 和整理；
5. 所有移动、重命名和清理先生成 backend authoritative preview；
6. 执行时重新验证 identity、scope、path、conflict 和 revision；
7. 文件操作先写 pending journal；
8. 应用启动时协调中断操作；
9. 恢复只针对 Zen Canvas 成功执行且仍可验证的操作；
10. Safe Trash 优先于永久删除；
11. Sensitive、冲突、低置信和 identity 不确定默认要求确认；
12. 用户 correction/decision 优先于 AI；
13. disabled、unavailable、partial 或 stale 数据不得被表示为 complete/safe；
14. command surface 不成为 mutation authority；
15.参考项目许可证边界不得因同栈而降低。

---

## 6. 标准分支与提交

当前建议：

```text
remediation/04-global-shortcut-search
remediation/05-file-library
remediation/06-ai-organization-preview
remediation/07-natural-language-rules
remediation/08-local-content-understanding
```

实施提交必须描述单一原子目的，不使用 `update`、`fix stuff` 或 `refactor all`。

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
└── TASK_04_GLOBAL_SHORTCUT_SEARCH.md
```

Task 05–08 的详细任务书由人工在前一完整模块验收合并后创建。

---

## 8. 完成汇报最低内容

每个阶段汇报：

1. 实际 baseline HEAD；
2. final HEAD；
3. 修改文件及目的；
4. 关键设计、owner 和数据流；
5. 参考项目 SHA、许可证和实际借鉴/拒绝项；
6. schema/dependency 结论；
7. 兼容性与安全边界；
8. 新增/修改测试；
9. 完整验证与性能；
10. Windows/macOS CI 和 package；
11. 已知风险和接受遗留；
12.提交列表；
13.唯一 Draft PR；
14.明确停止，未开始下一完整模块。
