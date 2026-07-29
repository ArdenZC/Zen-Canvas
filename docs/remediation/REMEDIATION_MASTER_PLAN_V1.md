# Zen Canvas Architecture Remediation Master Plan V1

## 1. 总目标

Zen Canvas 的整改目标不是堆叠零散工具，而是把扫描、系统搜索、Managed AI、规则分类、重复检测、空间分析、整理建议、文件操作和恢复能力收敛为一套：

- 本地优先；
-安全审核；
-持久事实；
-可恢复执行；
-跨平台一致；
-用户拥有最终控制权；
-可继续扩展但不泛化失控；

的智能文件治理工作台。

Zen Canvas 不改造成完整文件资源管理器、多设备文件系统、云盘、通用自治桌面 Agent、OCR/格式转换工具箱或文件编辑器/播放器集合。

---

## 2. 固定的 8 个产品功能模块

| 原模块 | Zen Canvas 功能 | 主要参考项目 | 重点参考 | 借鉴边界 |
|---|---|---|---|---|
| 1 | 重复检测 | Czkawka | size grouping、prehash、full hash、cache、hardlink、cancel | 按 LICENSE 登记；独立实现 |
| 2 | 大型文件/空间分析 | Spacedrive V1 | 大文件/目录、后台分析、结果投影、虚拟列表 | 概念级；拒绝过度复杂架构 |
| 3 | 扫描与索引 | Spacedrive V1 | Job、Location、Indexer phase、health、reconciliation | 概念级；不建第二套 Global Index |
| 4 | 全局快捷搜索 | Tolaria | keyboard-first、Command Palette、stable command metadata | AGPL 设计级，只读不移植 |
| 5 | 文件库 | TagSpaces | Location、标签、筛选、Saved View、Inspector、批量交互 | AGPL 设计级，不复制实现 |
| 6 | AI 整理预览 | ai-file-sorter | taxonomy、dry run、建议计划、审核、continue later | AGPL 概念级，独立实现 |
| 7 | 自然语言规则 | Accomplish + OpenCode | proposal、permission、structured execution | 按许可证登记并翻译到安全模型 |
| 8 | 本地内容理解 | Local-File-Organizer | 本地提取、轻量语义、摘要输入 | 轻量设计级 |

参考项目只提供设计证据；与 Zen Canvas 许可证、数据域或安全模型冲突的做法必须进入拒绝清单。

---

## 3. 实施阶段映射

| Task | 产品模块 | 状态 |
|---|---|---|
| 00 | 合并后架构基线审计 | 已完成 |
| 01A + 01B | 模块 3：扫描与索引 | 已完成 |
| 02 | 模块 1：重复检测 | 已完成，schema 29 |
| 03 | 模块 2：大型文件/空间分析 | 已完成，schema 30 |
| 04 | 模块 4：全局快捷搜索 | 已通过 PR #35 合并，schema 30 |
| 05 | 模块 5：文件库 | 已通过 PR #38 合并，schema 31 |
| 06 | 模块 6：AI 整理预览 | **实施完成，单一 Draft PR 人工验收中；未合并** |
| 07 | 模块 7：自然语言规则 | 等待 Task 06 |
| 08 | 模块 8：本地内容理解 | 等待 Task 07 |

每个 Task 是完整产品模块，不拆为 A/B/C，不创建独立收尾任务。上一阶段人工接受的遗留必须作为下一完整模块第一组完成，然后继续该模块全部目标。

---

## 4. 不可回退的架构前提

### 4.1 Global Index

- Windows 使用 MFT/USN 与安全回退；
- macOS 使用 Spotlight/FSEvents；
- volume 级启用、禁用、状态和增量同步；
- disabled/stale/degraded source 不得被表示为完整；
- Global Search 不 join managed `files`；
- open/reveal 只接受 entry ID 并由 backend revalidate；
-不得为 Task 06 重建 native provider/service。

### 4.2 Managed File Library

- managed `files` 是 File Library authority；
- scan roots、sessions、runs、generation 和 watcher reconciliation 已持久化；
- scanner 是 `scan_seen` owner；
- watcher 不写 `scan_seen`，不推进 generation；
- File Library 与 Global Index 数据域、scope、cursor 和 revision 独立；
- `files.id` 不迁移；
- FileQuerySpec V2、tags、Saved Views 和 Inspector 已进入 schema 31；
- Task 06 plan source 必须使用 File Library V2 selection/query，不得退回 legacy path scope。

### 4.3 Managed AI

-持久 AI queue、scope ownership、provider policy、fingerprint、cancel 和 correction gate 已存在；
- Task 06 不修改 Managed AI schema/provider/worker ownership；
- Organization Plan 只增加 plan-ID adapter；
-AI 完成后不得自动接受或执行计划；
- user correction 和 human plan decision 优先。

### 4.4 文件 mutation 与恢复

-所有移动、重命名和清理必须先 preview；
- operation/cleanup journal 是恢复事实；
- Safe Trash 与 restore 不得弱化；
- operation identity 与 dedupe identity 分离；
-renderer 不得提交任意 path 作为 mutation/reveal authority；
- Organization Plan 是审核和 provenance artifact，不是第二 journal；
- Task 06 不允许 delete/move_to_trash。

### 4.5 Analysis、Dedupe 与 Finding

- active duplicate group/member 是重复权威；
- Analysis Run/Finding/Decision 是分析权威；
- duplicate/finding 不直接授权 mutation；
- plan 可读取 bounded summary，但不修改其 schema 或决策。

### 4.6 平台与 CI

- Windows/macOS Rust、前端、原生回归、性能、安全审计和打包验证持续生效；
-后续模块优先扩展现有能力，不旁路或重建。

---

## 5. 已完成模块

### 5.1 扫描与索引（Task 01A/01B）

已完成 scan root lease、session/run/generation、scanner-owned `scan_seen`、stale safety、crash recovery、multi-root mapping、durable revision、Rust watcher owner 和 overflow/revision-gap reconciliation。

持续边界：File Library Scan 与 Global Index 独立；不建立 raw watcher 通用日志；不泛化 `ai_jobs`。

### 5.2 重复检测（Task 02）

已完成 physical identity、fingerprint cache、prehash/full BLAKE3、bounded worker、durable dedupe run、hardlink-safe duplicate groups、global duplicate authority 和只读 Duplicate UI。

持续边界：不迁移 `files.id`；active group/member 是 duplicate authority；不自动 keeper/delete。

### 5.3 空间分析（Task 03）

已完成 durable Analysis Run、fixed Detector registry、Finding/Evidence/Decision、large file/directory、cleanup heuristic、atomic publication、invalidation/retention 和 frontend hydration。

持续边界：Finding 不是 execution authority；cleanup 继续走 Safe Trash/journal。

### 5.4 全局快捷搜索（Task 04）

PR #35 squash merge：

```text
14616d4344314afce0878dbc681988c04183a9bc
```

已完成唯一 Global Index authority、versioned query、source health/revision snapshot、bounded ranking、ID-only actions、native Search window/hotkey owner、command catalog、IME/ARIA 和 100k/1M 门禁。

### 5.5 文件库（Task 05）

PR #38 squash merge：

```text
5468a17790165a149c462a17b64d011750b45410
```

已建立 schema 31：

- `user_tags`；
- `file_user_tags`；
- `library_saved_views`；
- `library_query_state`。

已实现 Query V2、canonical fingerprint、revision/keyset pagination、durable roots、summary/detail/selection、tags、Saved Views、Vault migration 和 permissions。

人工决定转入 Task 06 第一组的 9 项：

1. Vault query loop；
2. cursor 可合法篡改；
3. 100k explicit selection 非真正 chunk-safe；
4. snapshot-expired UI 不真实；
5. tags/Saved Views CRUD UI 不完整；
6. Detail/selection summary 字段缺失；
7. optimistic concurrency 不足；
8. virtual ARIA 指向未挂载 row；
9. 1M complex exact count 需要 bounded truthful alternative。

这些遗留不得再次后移。

---

## 6. 当前模块：Task 06 Durable Organization Plan

Implementation status: the complete module and the nine accepted Task 05 findings are implemented on `remediation/06-organization-plan`, with evidence in `TASK_06_IMPLEMENTATION_CLOSEOUT.md`. The implementation remains unmerged and does not unlock Task 07.

### 6.1 参考边界

参考：`hyperfield/ai-file-sorter`，冻结分析 SHA：

```text
cd9a024219b9434fb0a1df6b272f7145d9c67b28
```

许可证为 GNU AGPL-3.0。只允许概念级借鉴：review-before-change、From/To dry run、per-item select/keep/edit、safe batch、continue later、冲突预览。

禁止复制源码、Qt model/dialog/role/column 结构、DTO、数据库、undo implementation、plugin/model runtime、UI/CSS、content analyzer 或 path-authoritative move。

### 6.2 Schema 32

Task 06 授权 schema 31→32：

-新增 `organization_plans`；
-新增 `organization_plan_items`；
-为 `user_tags` 和 `library_saved_views` 增加单调 revision；
-不 ALTER `files`；
-不迁移 `files.id`；
-不修改 operation/cleanup journal、Managed AI、Analysis/Finding 或 Rule AST schema。

### 6.3 Plan artifact

Organization Plan 是 durable review/approval/provenance artifact：

- source 使用 File Library V2 selection/query；
- source item set 可物化，最多 10,000；
- plan/item 有状态机和 revision CAS；
- proposal 由 backend 当前 classification、preview、finding、duplicate 和 scope health 生成；
- renderer 不提交 path、target directory 或 operation kind；
- accepted/edited proposal 变化后必须重新审核；
-计划可关闭应用后继续。

### 6.4 Task 05 第一组修复

冻结方案：

- cursor 使用 live anchor membership + complete tuple revalidation；
- explicit selection 使用 TEMP/request-local set；
- tags/Saved Views 使用 mandatory monotonic revision；
-1M complex query 使用 deferred exact count，绝不估算；
-Vault、snapshot、DTO、CRUD 和 virtual ARIA 按任务书补齐。

### 6.5 AI

-只复用现有 Managed AI queue；
-plan adapter 每批最多 100；
- managed scope/provider/correction gate 不变；
-AI 不改变 decision，不自动执行；
- metadata-only；
- plan refresh 后才更新 proposal。

### 6.6 Review 与 Dry Run

支持：

- Accept；
- Keep；
- Edit filename；
- safe batch；
- Refresh stale；
- authoritative dry run；
- From/To、collision、parent creation、volume/risk/blocked summary。

Dry run 绑定 plan revision、item set 和 proposal fingerprint；任何变化使其失效。

### 6.7 Execution 与恢复

- execute request 只接受 IDs、expected revision 和 dry-run fingerprint；
- backend 重新读取 preview/identity；
-内部构造 existing `OperationSelection`；
-单次最多 1,000 operations；
- operation journal 是 filesystem truth；
-plan 记录 execution/batch mapping 并投影结果；
-crash/restart 从 operation logs reconcile，不自动重放；
- History/Restore 继续使用现有能力；
- delete/trash 不进入 plan。

### 6.8 UI/State

- plan list/create；
- durable active plan/items/decisions；
- review list + Inspector；
- Analyze missing；
- Dry Run/confirm/execute/progress/results；
- stale/revision conflict；
- virtual/keyset/accessibility；
-不再以 legacy 3,000 organize queue、12,000 OFFSET preview scan 或 localStorage decision 为 truth。

### 6.9 性能

- Task 05：100k explicit selection、1M deferred/exact count；
- Plan：100/1k/10k create、hydrate、decision、refresh、dry run；
-单次 execution prepare 1,000；
-WAL reader、query plan、migration；
-Windows/macOS/package/security。

### 6.10 明确不做

-自然语言规则 proposal；
- Content Artifact/OCR/正文读取；
-自治 Agent；
-第二 AI queue；
-第二 operation/undo journal；
-自动删除或永久删除；
-renderer path authority；
-ai-file-sorter 源码/结构移植。

---

## 7. Task 07–08 边界

### Task 07

只有 Task 06 合并后才可设计自然语言 proposal → validation → human approval → existing Rule AST。Task 06 不解析自然语言命令，不允许模型直接写 rule。

### Task 08

只有 Task 07 合并后才可设计 Content Artifact、格式 extractor、隐私 consent、size budget、retention 和 provider gate。Task 06 继续 metadata-only。

---

## 8. 统一交付要求

每个后续完整模块必须：

-人工任务书先进入 master；
-一个实施分支；
-一个 Draft PR；
-schema 只按任务书授权推进；
-完整 frontend/Rust/remediation/security/performance/build；
-Windows/macOS/release/package 证据；
-Closeout、Risk Register、Index 和 permission matrix 同步；
-停止等待人工代码级验收；
-不自动合并或提前开始下一模块。
