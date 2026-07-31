# Zen Canvas Architecture Remediation Master Plan V1

## 1. 总目标

Zen Canvas 的整改目标不是堆叠零散工具，而是把扫描、系统搜索、Managed AI、规则分类、重复检测、空间分析、整理建议、内容理解、文件操作和恢复收敛为一套：

- 本地优先；
- 安全审核；
- 持久事实；
- 可恢复执行；
- 跨平台一致；
- 用户拥有最终控制权；
- 可扩展但不泛化失控；

的智能文件治理工作台。

Zen Canvas 不改造成完整文件资源管理器、多设备文件系统、云盘、通用自治桌面 Agent、通用 OCR/格式转换工具箱、文档编辑器、播放器集合、RAG 平台或向量数据库。

---

## 2. 固定的 8 个产品模块

| 模块 | Zen Canvas 功能 | 主要参考项目 | 重点参考 | 借鉴边界 |
|---|---|---|---|---|
| 1 | 重复检测 | Czkawka | size grouping、prehash、full hash、cache、hardlink、cancel | 按 LICENSE 登记；独立实现 |
| 2 | 大型文件/空间分析 | Spacedrive V1 | 大文件/目录、后台分析、结果投影、虚拟列表 | 概念级；拒绝过度复杂架构 |
| 3 | 扫描与索引 | Spacedrive V1 | Job、Location、Indexer phase、health、reconciliation | 概念级；不建第二套 Global Index |
| 4 | 全局快捷搜索 | Tolaria | keyboard-first、Command Palette、stable command metadata | AGPL 设计级，只读不移植 |
| 5 | 文件库 | TagSpaces | Location、标签、筛选、Saved View、Inspector、批量交互 | AGPL 设计级，不复制实现 |
| 6 | AI 整理预览 | ai-file-sorter | taxonomy、dry run、建议计划、审核、continue later | AGPL 概念级，独立实现 |
| 7 | 自然语言规则 | Coworker + OpenCode | proposal、permission、structured approval | MIT；typed Rule Proposal，无 Agent runtime |
| 8 | 本地内容理解 | Local-File-Organizer | local extraction、bounded understanding、dry-run disclosure | MIT；轻量设计级，独立 Rust/Tauri 实现 |

参考项目只提供设计证据；与 Zen Canvas 许可证、数据域或安全模型冲突的做法必须进入拒绝清单。

---

## 3. 实施阶段映射

| Task | 产品模块 | 状态 |
|---|---|---|
| 00 | 合并后架构基线审计 | 已完成 |
| 01A + 01B | 模块 3：扫描与索引 | 已完成 |
| 02 | 模块 1：重复检测 | 已完成，schema 29 |
| 03 | 模块 2：大型文件/空间分析 | 已完成，schema 30 |
| 04 | 模块 4：全局快捷搜索 | 已合并，schema 30 |
| 05 | 模块 5：文件库 | 已合并，schema 31 |
| 06 | 模块 6：AI 整理预览 | 已合并，schema 32 |
| 07 | 模块 7：自然语言规则 | PR #42 已合并，schema 33 |
| 08 | 模块 8：本地内容理解 | **当前唯一可执行，授权 schema 34** |

每个 Task 是完整产品模块，不拆为 A/B/C，不创建独立收尾任务。上一阶段人工接受的遗留必须作为下一完整模块第一组完成，然后继续该模块全部目标。Task 08 是固定主线最后一项，不自动创建 Task 09。

---

## 4. 不可回退的架构前提

### 4.1 Global Index

- Windows 使用 MFT/USN 与安全回退；
- macOS 使用 Spotlight/FSEvents；
- volume 级启用、禁用、状态和增量同步；
- disabled/stale/degraded source 不得被表示为完整；
- Global Search 不 join managed `files` 或 Content Artifact；
- open/reveal 只接受 entry ID 并由 backend revalidate；
- Task 08 不重建 native provider/service。

### 4.2 Managed File Library

- managed `files` 是 File Library authority；
- scan roots、sessions、runs、generation 和 watcher reconciliation 已持久化；
- scanner 是 `scan_seen` owner；
- watcher 不写 `scan_seen`，不推进 generation；
- File Library 与 Global Index 数据域、scope、cursor 和 revision 独立；
- `files.id` 不迁移；
- Task 08 content scope 使用 durable File Library scope/selection；
- root disabled/degraded/reconciliation 必须 fail closed。

### 4.3 Managed AI 与交互式 provider

- 持久 Managed AI queue、scope ownership、provider policy、fingerprint、cancel 和 correction gate 已存在；
- `ai_jobs` 不泛化为通用 Job Runtime；
- Task 07 proposal 与 Task 08 optional understanding 都复用现有交互式 provider client；
- 不建立第二 durable AI queue；
- cloud 内容发送必须每次显式确认；
- 不发送路径、文件名、文件列表、operation logs、tags、credentials 或 secrets；
- raw provider response 不成为业务事实。

### 4.4 文件 mutation 与恢复

- 所有移动、重命名和清理必须先 preview；
- operation/cleanup journal 是恢复事实；
- Safe Trash 与 restore 不得弱化；
- renderer 不得提交任意 path 作为 mutation authority；
- Organization Plan 是审核和 provenance artifact，不是第二 journal；
- Rule 和 Content Artifact 都不直接产生 filesystem mutation；
- content delete/purge 只删除内容数据，不删除源文件。

### 4.5 Analysis、Dedupe、Finding、Plan 与 Content

- active duplicate group/member 是重复权威；
- Analysis Run/Finding/Decision 是分析权威；
- duplicate/finding 不直接授权 mutation；
- Organization Plan 是整理审核权威；
- Rule Proposal 是规则候选审核权威；
- Content Artifact 是内容提取/理解业务事实；
- 这些 ledger 不互相替代、不共享 owner、不成为通用 runtime。

### 4.6 Rule AST

- Rule AST V1 继续是唯一规则格式；
- 不创建 Rule AST V2、脚本表达式、正则执行器、SQL、JavaScript 或 shell；
- backend canonical validation 是 authority；
- renderer 不提交 Rule vector 作为执行事实；
- 正式规则使用 per-rule revision 和 catalog revision CAS；
- proposal Apply 后规则默认 disabled；
- Enable 与 Run 为独立显式动作；
- Task 08 不加入 content rule field。

### 4.7 Content privacy

- 内容分析默认关闭；
- policy 只绑定 durable managed root；
- 每次 run 先 authoritative preview，再确认；
- deterministic extraction 与 provider understanding 分离；
- raw extracted text 默认不持久化；
- retained text 必须显式开启、bounded、可删除、有 retention；
- Sensitive/System/blocked 文件不发送 cloud；
- Search window 不获得内容读取或 provider 权限。

### 4.8 平台与 CI

- Windows/macOS Rust、前端、原生回归、性能、安全审计和打包验证持续生效；
- package job 的 success/skipped 必须分别记录；
- 本地 package 不冒充远端 artifact；
- 新 extractor 依赖需要 license、transitive、RustSec 和 package-size 证据；
- 不引入外部 runtime 或服务。

---

## 5. 已完成模块

### 扫描与索引（Task 01A/01B）

已完成 scan root lease、session/run/generation、scanner-owned `scan_seen`、stale safety、crash recovery、multi-root mapping、durable revision、Rust watcher owner 和 overflow/revision-gap reconciliation。

### 重复检测（Task 02）

已完成 physical identity、fingerprint cache、prehash/full BLAKE3、bounded worker、durable dedupe run、hardlink-safe duplicate groups、global duplicate authority 和只读 Duplicate UI。

### 空间分析（Task 03）

已完成 durable Analysis Run、fixed Detector registry、Finding/Evidence/Decision、large file/directory、cleanup heuristic、atomic publication、invalidation/retention 和 frontend hydration。

### 全局快捷搜索（Task 04）

PR #35 squash merge：`14616d4344314afce0878dbc681988c04183a9bc`。

已完成唯一 Global Index authority、versioned query、source health/revision snapshot、bounded ranking、ID-only actions、native Search window/hotkey owner、command catalog、IME/ARIA 和 100k/1M 门禁。

### 文件库（Task 05）

PR #38 squash merge：`5468a17790165a149c462a17b64d011750b45410`。

已建立 Query V2、revision/keyset pagination、durable roots、summary/detail/selection、user tags、Saved Views、Inspector 和权限。

### AI 整理预览（Task 06）

PR #40 squash merge：`29e85c099c5ee921ad7d4237c780dc47126e0fa3`。

已建立 schema 32 Organization Plan/Item ledger、bounded source materialization、review decisions、Managed AI adapter、dry run、existing operation journal execution、restart projection、virtual UI 和 permissions。Task 06 接受遗留已由 Task 07 第一组关闭。

### 自然语言规则（Task 07）

PR #42 squash merge：`4e07de9c02198eb3352d9b2b1f289d61a3df128c`。

已建立 schema 33：

- `rules.ast_version/revision/origin_proposal_id`；
- `rule_catalog_state`；
- `rule_proposals`。

已实现 durable Rule Proposal、strict AST V1 validation、literal grounding、metadata impact、human Apply、default disabled、Rule Repository V2 和 backend-authoritative execution。

人工接受并转入 Task 08 第一组的遗留：

1. effective catalog 未覆盖 learned/settings 等全部实际 ruleset 变化；
2. manual rule execution 存在 catalog/rules/scope TOCTOU；
3. impact preview 未完整模拟真实 classification engine；
4. Proposal Workspace 未展示完整审核事实；
5. manual edit 后旧 AI summary/provenance 可能失真；
6. forbidden prompt 意图仍部分依赖模型主动映射。

这些遗留不得再次后移。

---

## 6. 当前模块：Task 08 Local Content Artifacts and Understanding

权威任务书：

```text
docs/remediation/TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md
```

### 6.1 参考边界

```text
QiuYannnn/Local-File-Organizer
SHA a19559942a35d98e9d2168fa58f288d9ea294bc6
LICENSE: MIT
```

只借鉴本地优先、按格式提取、有界读取、结果预览、内容理解与文件操作分离等轻量原则。

拒绝 Python/Conda/Nexa/Tesseract runtime、源码/提示词/CLI 移植、任意 path 扫描、隐式模型下载、无 consent 内容读取、自动复制/移动/重命名和 cloud 静默发送。

### 6.2 Schema 34

Task 08 授权 additive schema `33→34`：

- `content_scope_policies`；
- `content_runs`；
- `content_run_items`；
- `content_artifacts`；
- `content_artifact_fts`。

不 ALTER `files`，不迁移 `files.id`，不修改 operation/cleanup journal、Dedupe、Analysis、Plan 或 Rule Proposal schema，不创建 vector store 或通用 Job Runtime。

### 6.3 Consent-bound preview

内容读取前必须：

```text
durable managed scope
+
healthy root/policy/library authority
+
backend preview
+
exact/deferred count and budgets
+
provider/retention disclosure
+
preview fingerprint
+
confirmed=true
```

Policy 默认 disabled。Cloud 每次单独确认；Sensitive/System/blocked 不发送 cloud。

### 6.4 Extractor registry

Mandatory：

- txt/md/csv；
- text-layer PDF；
- docx/xlsx/pptx。

Unsupported：

- legacy doc/xls/ppt；
- encrypted/protected；
- arbitrary archive；
- OCR-only PDF；
- image OCR/VLM；
- audio/video/ebook；
- symlink traversal/remote URL。

Extractor 必须 typed/versioned、进程内、bounded，并覆盖 bytes/pages/slides/sheets/rows/archive entries/decompressed bytes/ratio/nesting/chars/time/cancel。

### 6.5 Content Artifact

Artifact 绑定 file/root identity、extractor/policy/provider version，具有 current/stale/unsupported/blocked/failed 语义。

默认不持久化 raw text。summary、keywords、language、truncation 和 provenance 是 bounded 业务事实。Rebuild 原子替换 current projection；Delete/Purge 不影响源文件。

### 6.6 Optional understanding

- deterministic local summary/keywords 始终可用；
- configured provider 最多处理 20 个 selected artifacts；
- 复用交互式 provider client，不写第二 AI queue；
- cloud payload 不含 path/filename/secrets；
- strict JSON envelope；
- raw response 不持久化；
- timeout/cancel 不自动 retry。

### 6.7 Content Search / UI

Content Search 只服务 managed File Library，使用 content/library revisions 与 keyset cursor，不进入 Global Search。

Inspector 展示 policy、status、summary、keywords、language、extractor/provider、current/stale/truncated、Rebuild 和 Delete Content Data。UI 必须明确“删除内容数据不会删除源文件”。

### 6.8 Run lifecycle / retention

- staged/atomic materialization，上限 10,000；
- domain-specific run/item owner、CAS、cancel、recovery；
- extraction concurrency ≤2，provider ≤1；
- current artifact 不按 age 删除；
- stale artifact 30 天；
- retained text 默认 7 天和总容量上限；
- terminal run age UNION count，child-first，每批 20；
- active run 不删除。

### 6.9 明确不做

- OCR/image VLM；
- Python/Conda/Tesseract/Nexa；
- external executable；
- vector database/RAG/chat；
- Rule AST V2/content conditions；
- second durable AI queue；
- Agent/tool/shell/MCP；
- automatic filesystem mutation；
- Task 09。

---

## 7. 统一交付要求

Task 08 必须：

- 先关闭 Task 07 六项接受遗留；
- 一个实施分支；
- 一个 Draft PR；
- schema 34 migration/rollback/future guard；
- 真实格式/malformed/bomb/privacy fixtures；
- consent/provider/retention/rebuild/delete tests；
- 100k/1M query/FTS/WAL evidence；
- 完整 frontend/Rust/remediation/security/performance/build；
- Windows/macOS/release/package 真实证据；
- dependency/license/package-size inventory；
- Closeout、Risk Register、Index、Capability Matrix 和 permission matrix 同步；
- 停止等待人工代码级验收；
- 不自动合并、发布或创建 Task 09。