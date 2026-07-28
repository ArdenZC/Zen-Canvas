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
| 6 | AI 整理预览 | ai-file-sorter | taxonomy、dry run、建议计划、审核 | AGPL 概念级 |
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
| 05 | 模块 5：文件库 | **当前完整模块，授权 schema 31** |
| 06 | 模块 6：AI 整理预览 | 等待 Task 05 |
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
-不得为 Task 05 重建 native provider/service。

### 4.2 Managed File Library

- managed `files` 是 File Library authority；
- scan roots、sessions、runs、generation 和 watcher reconciliation 已持久化；
- scanner 是 `scan_seen` owner；
- watcher 不写 `scan_seen`，不推进 generation；
- File Library 与 Global Index 数据域、scope、cursor 和 revision 独立；
- `files.id` 不迁移。

### 4.3 Managed AI

-持久 AI queue、scope ownership、provider policy、fingerprint、cancel 和 correction gate 已存在；
-Task 05 不修改 Managed AI schema/provider；
-user tag 不是 AI 分类，也不自动触发 AI。

### 4.4 文件 mutation 与恢复

-所有移动、重命名和清理必须先 preview；
-operation/cleanup journal 是恢复事实；
-Safe Trash 与 restore 不得弱化；
-operation identity 与 dedupe identity 分离；
-renderer 不得提交任意 path 作为 mutation/reveal authority；
-Task 05 标签操作仅修改数据库 metadata，不修改用户文件。

### 4.5 平台与 CI

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

Task 03 的 exact physical-union 遗留已由 Task 04 第一组关闭。

### 5.4 全局快捷搜索（Task 04）

PR #35 已 squash 合并，merge commit：

```text
14616d4344314afce0878dbc681988c04183a9bc
```

已完成：

- Global Index 作为唯一全局搜索 authority；
- versioned request/response、latest-request-wins；
- source health/revision snapshot；
- bounded tiered ranking；
- ID-only open/reveal；
- Rust search window/hotkey lifecycle owner；
- stable command catalog；
- keyboard/IME/ARIA 基础能力；
-100k/1M 性能门禁。

人工决定接受并转入 Task 05 第一组的遗留：

1. 所有 degraded provider/source 状态必须从 `collectionComplete` 中严格排除；
2. standalone navigation 在 ready ACK 后重新验证原 session/revision，并不得隐藏新 session；
3. extension tier 使用 durable ID tie-break，punctuation fallback 保持真实查询语义；
4. 补 mounted IME interaction test，验证 composition 期间不调用 backend。

这些遗留不得再次后移。

---

## 6. 当前模块：Task 05 文件库

### 6.1 参考边界

参考：`tagspaces/tagspaces`，冻结分析 SHA：

```text
7ec3a2e8632b8bf5db685436e6d2d8805977a880
```

许可证为 GNU AGPL-3.0，只允许设计级借鉴：Location、标签词汇、Saved Search/View、Inspector、批量交互分层。禁止复制源码、component/hook/context/reducer 结构、SearchQuery 字段、UI/CSS、filename tags、sidecar metadata 或 localStorage truth。

### 6.2 Schema 31

Task 05 授权 schema 30→31，新增：

- `user_tags`；
- `file_user_tags`；
- `library_saved_views`；
- `library_query_state`。

关键边界：

-不得 ALTER/重建 `files` 大表；
-不得迁移 `files.id`；
-`file_user_tags.file_id` 使用 `ON UPDATE CASCADE`；
- migration transaction 失败完整回滚到 schema 30；
- library query revision 在业务 transaction 中由 repository helper 一次性 bump，不使用每行 trigger。

### 6.3 Query V2

目标：

-严格 versioned `FileQuerySpec V2`；
-scope 使用 durable scan root/session ID；
-text/filter/sort 下沉 SQLite；
-复用 managed files FTS，不 join Global Index；
-backend canonicalization + BLAKE3 fingerprint；
-revision-validated stateless snapshot；
-opaque keyset cursor；
-禁止 V2 OFFSET；
-results/count/scope health 同一 read snapshot；
-snapshot revision 变化时 fail closed 为 `library_snapshot_expired`。

### 6.4 DTO 分层

- list 仅返回 `FileLibrarySummaryDto`；
- Inspector 通过 file ID 获取 `FileLibraryDetailDto`；
-多选汇总由 backend selection summary 计算；
-列表不携带完整 classification reason、matched rules、content hash、finding evidence、operation journal、AI trace 或内容；
-Inspector 不依赖当前 loaded page。

### 6.5 Selection

支持：

```text
explicit { fileIds[] }
all_matching { canonical query, fingerprint, snapshot revision, exclusions[] }
```

UI 必须区分“已选择已加载 X”与“已选择全部 N，排除 M”。Query/scope/filter/sort 变化清空 selection；snapshot expired 使 all_matching 失效。

Task 05 selection 只新增 user tag metadata mutation，不直接 move/delete/rename/classify/execute suggestion。

### 6.6 用户标签

-用户标签与 Purpose/Lifecycle/Risk/AI classification 严格分离；
-支持 create/rename/fixed color/delete、usage count、assign/remove、all/any/not filter；
-不写 filename 或 sidecar；
-不触发 AI、规则或文件 mutation；
-批量写入 authoritative resolve、expected count、single transaction、single revision bump；
-首版 all-matching tag target 上限 100,000，超过 fail closed，不允许部分提交。

### 6.7 Saved Views

- durable SQLite truth；
-保存 canonical QuerySpec，不保存 cursor、selection、SQL 或任意 path；
-打开时创建新 snapshot；
-缺失 root/tag 显示 invalid reference，不静默扩大；
-使用 expected revision/updatedAt 防旧 UI 覆盖；
-browser mock 不伪装 native persistence。

### 6.8 UI/State

- Query、Results、Selection、Inspector、Tags、Saved Views 职责分层；
-移除 renderer advanced filter/sort；
-移除 `collectLibraryPages` 的 10k truthfulness workaround；
-保留 React Virtual；
-完善 PageUp/PageDown、range、two-stage Ctrl/Cmd+A、focus、ARIA、snapshot refresh；
-Inspector reveal 使用 file ID backend revalidation；
-preview 仍 metadata-only，内容理解延至 Task 08。

### 6.9 性能

-100k 日常 page/filter/tag/text/detail/selection/bulk tag/concurrent reader；
-1M default page、text、tag、composite filter、deep keyset、count、WAL reader；
-常见 100k page p95 ≤ 100 ms，复杂 filter ≤ 150 ms，detail ≤ 50 ms；
-1M 常见 page p95 ≤ 150 ms；
-每个新增 index 需要 EXPLAIN 与 write-amplification 证据。

### 6.10 明确不做

- Organization Plan、AI 整理 dry run；
-自动移动/删除/重命名；
-自然语言规则；
-Content Artifact/OCR/内容读取；
-Global Search cursor/snapshot 复用；
-第二套 files/FTS authority；
-长期跨 IPC read transaction；
-每个 query 物化全部 snapshot items；
-新依赖或 lockfile；
-Task 06。

Task 05 权威合同：

```text
docs/remediation/TASK_05_FILE_LIBRARY_QUERY_TAGS_SAVED_VIEWS.md
```

---

## 7. 后续模块

### Task 06：AI 整理预览

将规则、AI、duplicate/finding 和用户修正收敛为 durable Organization Plan；dry run/diff/审核/identity expiry；执行仍进入 operation journal、Safe Trash 和 restore。禁止直接执行模型输出。

### Task 07：自然语言规则

自然语言只生成 proposal，编译为现有受约束 Rule AST；严格 allowlist、歧义询问、模拟匹配、新规则默认关闭。禁止 Bash、PowerShell、任意 SQL 或直接文件操作。

### Task 08：本地内容理解

受预算控制的 Extractor 和 Content Artifact；模型只接收 Artifact；local/cloud policy、consent、脱敏、retention、correction。OCR/视觉模型可选，不成为基础安装依赖。

Task 06–08 在 Task 05 人工验收合并前均禁止执行。
