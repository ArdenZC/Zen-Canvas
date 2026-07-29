# Zen Canvas Codex Remediation Index V1

## 1. 当前执行状态

- Task 00 已通过 PR #16 合并；
- Task 01A/01B 已完成扫描代际与 watcher reconciliation；
- Task 02 已通过 PR #26 合并，schema 29；
- Task 03 已通过 PR #28 合并，schema 30；
- Task 04 已通过 PR #35 合并，squash merge `14616d4344314afce0878dbc681988c04183a9bc`；
- Task 05 已通过 PR #38 合并，squash merge `5468a17790165a149c462a17b64d011750b45410`，schema 31；
- Task 06 已通过 PR #40 合并，squash merge `29e85c099c5ee921ad7d4237c780dc47126e0fa3`，schema 32；
- Task 06 人工接受的 6 项实现问题与 1 项 CI 证据问题已冻结为 Task 07 第一组生产改动，不得再次后移；
- **Task 07 是当前唯一可执行完整产品模块，授权 schema 33；**
- Task 08 继续禁止执行。

| Task | 任务书 | 产品模块/目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 后架构、安全与数据基线 | 已完成 |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | scan generation/run/session/recovery | 已完成 |
| 01B | `TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md` | watcher owner/reconciliation | 已完成 |
| 02 | `TASK_02_IDENTITY_FINGERPRINT_AND_DUPE.md` | 模块 1：重复检测；Czkawka 对标 | 已合并，schema 29 |
| 03 | `TASK_03_ANALYSIS_RUN_FINDING_AND_DETECTORS.md` | 模块 2：空间分析；Spacedrive V1 对标 | 已合并，schema 30 |
| 04 | `TASK_04_GLOBAL_SHORTCUT_SEARCH.md` | 模块 4：全局快捷搜索；Tolaria 对标 | 已合并，schema 30 |
| 05 | `TASK_05_FILE_LIBRARY_QUERY_TAGS_SAVED_VIEWS.md` | 模块 5：文件库；TagSpaces 对标 | 已合并，schema 31 |
| 06 | `TASK_06_DURABLE_ORGANIZATION_PLAN_AND_DRY_RUN.md` | 模块 6：AI 整理预览；ai-file-sorter 对标 | 已合并，schema 32；7 项遗留转入 Task 07 |
| 07 | `TASK_07_NATURAL_LANGUAGE_RULE_PROPOSAL_AND_APPROVAL.md` | 模块 7：自然语言规则；Coworker + OpenCode 对标 | **当前唯一可执行；授权 schema 33** |
| 08 | 待创建 | 模块 8：本地内容理解；Local-File-Organizer 对标 | 禁止执行 |

不得创建 debt-cleanup、06.5、07A/07B/07C 或并行产品阶段。上一阶段接受遗留必须作为下一完整模块第一组关闭，然后连续完成该模块。

---

## 2. 固定的 8 模块主线

| 原模块 | Zen Canvas 功能 | 参考项目 | 借鉴边界 | 承载阶段 |
|---|---|---|---|---|
| 1 | 重复检测 | Czkawka | 按许可证登记，独立实现 | Task 02，已完成 |
| 2 | 大型文件/空间分析 | Spacedrive V1 | 概念级，拒绝过度复杂架构 | Task 03，已完成 |
| 3 | 扫描与索引 | Spacedrive V1 | Job/Location/Indexer 概念级 | Task 01A/01B，已完成 |
| 4 | 全局快捷搜索 | Tolaria | AGPL 设计级，只读分析不移植 | Task 04，已完成 |
| 5 | 文件库 | TagSpaces | AGPL 设计级，不复制实现或结构 | Task 05，已完成 |
| 6 | AI 整理预览 | ai-file-sorter | AGPL 概念级，独立实现 | Task 06，已完成 |
| 7 | 自然语言规则 | Coworker（原 Accomplish）+ OpenCode | MIT，原则级翻译到 typed Rule Proposal | Task 07，当前 |
| 8 | 本地内容理解 | Local-File-Organizer | 轻量设计级 | Task 08，禁止 |

标准流程：

```text
完整产品模块
→ 人工任务书先进入 master
→ 一个实施分支
→ 一个 Draft PR
→ 完整代码级验收
→ 有限遗留登记到下一完整模块
```

---

## 3. 唯一执行授权

Task 07 生产实施必须同时满足：

```text
本索引指向 Task 07
+
docs/remediation/TASK_07_NATURAL_LANGUAGE_RULE_PROPOSAL_AND_APPROVAL.md 存在
+
任务书已位于当前 master
+
master 包含 29e85c099c5ee921ad7d4237c780dc47126e0fa3
```

任务书进入 `master` 后即满足文档门禁。不得再使用 PR #40 的旧 Draft/Open 状态、Task 06 Closeout 旧文案或历史 review 指令制造额外阻断。

每阶段开始前依次阅读：

1. 根目录当前开发说明；
2. `docs/remediation/README.md`；
3. `REMEDIATION_MASTER_PLAN_V1.md`；
4. 本索引；
5. 当前人工任务书；
6. 前置任务书、Closeout、测试与实际源码；
7. 涉及 UI 时读取 `docs/design/`；
8. 任务书指定的参考项目、固定 SHA 与 LICENSE。

Codex 只负责实施、migration、测试、原子提交、唯一 Draft PR 和 Closeout；不得重写任务书、拆分阶段或提前建设 Task 08。

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

环境无法运行的项目必须如实记录并由 GitHub CI 补充；不得删除测试、放宽断言、缩小 fixture 或关闭功能规避。

### 实施中

- 只修改任务书允许范围；
- 测试与生产代码同步；
- renderer 不重复或替代 Rust canonical validation；
- 不绕过 Managed Scope、AI provider policy、Rule AST、Organization Plan、preview、journal、Safe Trash 或 restore；
- 一个实施分支、一个 Draft PR；
- 内部原子提交不是独立任务；
- 先关闭 Task 06 七项遗留，再连续完成整个 Task 07。

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

还必须满足 Task 07 的 schema 33、proposal lifecycle、AST validation、impact exact/deferred、Rule Repository V2、backend-authoritative execution、Windows/macOS 和真实 package 门禁。

---

## 5. 已冻结的不可回退边界

### Scan / Watcher

- File Library Managed Scan 与 Global Index 独立；
- scanner 是 `scan_seen` 和 generation 唯一 owner；
- Rust/Tauri 是 watcher mutation/reconciliation owner；
- watcher 不写 `scan_seen`、不推进 generation；
- Task 07 不重写 scanner/watcher ownership。

### Identity / Dedupe / Analysis

- 不迁移 `files.id`；
- operation identity 与 dedupe physical identity 分离；
- active duplicate group/member 是重复权威；
- Analysis Finding 和 duplicate 不直接授权 mutation；
- Rule Proposal 只能读取 bounded metadata，不修改这些 schema。

### Global Search / File Library

- Global Search 与 File Library Query V2 数据域独立；
- managed `files` 是 File Library authority；
- Rule impact scope 使用 durable File Library scope IDs；
- disabled/stale/degraded root fail closed；
- Search window 不获得 Rule Proposal/Rule write/run 权限。

### Managed AI

- 现有 durable Managed AI queue 保持文件分类领域专用；
- Task 07 不建立第二 durable AI queue，也不泛化 `ai_jobs`；
- Rule proposal 仅复用现有 provider client/credential/configuration；
- 不发送文件正文、文件列表或 secrets；
- 模型不直接写、启用或执行 rule。

### Organization Plan / Mutation

- Task 06 Organization Plan 是 durable approval/provenance artifact；
- Task 07 第一组必须修复 live dry-run/execute equivalence 和 root-health fail-closed；
- Rule 只修改 classification/suggestion metadata；
- Rule 不移动、重命名、删除文件；
- filesystem mutation 继续经过 Organization Plan、authoritative preview、identity、operation journal 和 restore；
- 不修改 operation/cleanup journal schema。

### Rule AST / Proposal

- 现有 Rule AST V1 是唯一目标格式；
- 自然语言只生成 durable candidate proposal；
- backend canonical validation 是 authority；
- proposal impact preview 不是执行；
- human Apply 后 rule 默认 disabled；
- Enable 和 Run 是独立显式动作；
- renderer Rule list 不再成为 rule execution authority；
- 不建设 Agent、shell、MCP、tools、script rule language 或 Content Artifact。

---

## 6. Task 06 → Task 07 强制遗留

Task 07 第一组必须关闭，且不得再次后移：

1. Organization dry run 与 execution 必须绑定同一 live authoritative proposal/target；
2. refresh/dry run/execution 全链重新验证 managed root/scope health；
3. `needs_review` 建立可达的人工作审转换，blocked/delete/unsupported 永不可升级；
4. crash recovery 在 journal 全完成且无 remaining 时正确投影 `completed`；
5. terminal plan retention 使用 age **UNION** count overflow；
6. plan summary 使用 backend 全计划聚合，不从当前 100 行推断；
7. CI/Closeout 分开记录本地 package、远端 success 与 skipped job，提供真实 NSIS/unsigned DMG 证据。

完成第一组后继续 schema 33、Rule Proposal、impact preview、human Apply、Rule Repository V2 和 backend execution authority，不得停止。

---

## 7. Task 07 冻结决定

1. Coworker 固定 SHA `2cf74d08f22078b8b1fd3f97bff3ec4612262613`，MIT；
2. OpenCode 固定 SHA `7565e03536d19e850f9996c407f9bf5e932b5f7a`，MIT；
3. 只借鉴可见 plan、用户控制范围、ask/allow/deny、一次批准、拒绝/纠正后停止等原则；
4. 不引入 Coworker/OpenCode runtime、daemon、SDK、shell、MCP、skills、tools 或 Agent；
5. schema `32→33`；
6. `rules` 增加 `ast_version/revision/origin_proposal_id`；
7. 新增 `rule_catalog_state` 与 `rule_proposals`；
8. Rule AST V1 是唯一候选目标；
9. 模型输出先经过 strict parse、literal grounding、canonical validation；
10. impact preview 使用 managed File Library scope，exact 或明确 deferred，绝不估算；
11. Apply 需要 proposal/catalog/rule/library/scope/fingerprint 全链重验；
12. Apply 原子写 proposal + user rule，规则默认 disabled；
13. Enable 和 Run 独立；
14. Rule Repository V2 使用 per-rule + catalog revision CAS；
15. rule execution 从 SQLite 加载 enabled rules，不接受 renderer Rule vector；
16. Rule 只更新 classification/suggestion metadata；
17. 不读取文件正文，不开始 Task 08；
18. 默认不新增依赖或修改 lockfile。

权威任务书：

```text
docs/remediation/TASK_07_NATURAL_LANGUAGE_RULE_PROPOSAL_AND_APPROVAL.md
```

---

## 8. Task 07 标准交付

Task 07 完成时必须：

1. 分支 `remediation/07-rule-proposal`；
2. 一个 Draft PR；
3. 可审查原子提交；
4. Task 06 七项遗留全部关闭；
5. schema 33 migration/rollback/future guard；
6. durable Rule Proposal、provider adapter、AST validation、literal grounding；
7. truthful impact preview 与 exact resolver；
8. human Apply、default disabled、enable/run separation；
9. Rule Repository V2 和 backend-authoritative execution；
10. 完整 frontend/Rust/remediation/security/performance/build；
11. Windows/macOS、NSIS、unsigned DMG 和 dependency audit 真实证据；
12. `TASK_07_IMPLEMENTATION_CLOSEOUT.md`；
13. 停止等待人工代码级验收；
14. 不自动合并、不开始 Task 08。
