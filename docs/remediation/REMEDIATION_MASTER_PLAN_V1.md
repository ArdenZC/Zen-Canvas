# Zen Canvas Architecture Remediation Master Plan V1

## 1. 总目标

Zen Canvas 的整改目标不是继续堆叠零散工具，而是把已有扫描、系统级搜索、Managed AI、规则分类、重复检测、空间分析、整理建议、文件操作和恢复能力，收敛为一套：

- 本地优先；
-安全审核；
-持久事实；
-可恢复执行；
-跨平台一致；
-用户拥有最终控制权；
-可继续扩展但不泛化失控；

的智能文件治理工作台。

Zen Canvas 不改造成：

- 完整文件资源管理器；
-多设备分布式文件系统；
-云盘；
-通用自治桌面 Agent；
-OCR/格式转换工具箱；
-文件编辑器或媒体播放器集合。

---

## 2. 固定的 8 个产品功能模块

整改始终围绕以下 8 个功能模块。不得因为技术债、schema 或内部类名发明新的产品模块。

| 原模块 | Zen Canvas 功能 | 主要参考项目 | 重点参考 | 借鉴边界 |
|---|---|---|---|---|
| 1 | 重复检测 | Czkawka | size grouping、prehash、full hash、cache、hardlink、cancel | 按 LICENSE 登记；优先独立实现 |
| 2 | 大型文件列表/空间分析 | Spacedrive V1 | 大文件/目录、后台分析、结果投影、虚拟列表 | 概念级；主动拒绝其过度复杂 V1 架构 |
| 3 | 扫描与索引 | Spacedrive V1 | Job、Location、Indexer phase、health、reconciliation | 概念级 + 事故复盘；不建第二套 Global Index |
| 4 | 全局快捷搜索 | Tolaria | keyboard-first、Command Palette、稳定 command metadata、菜单/快捷键一致性 | AGPL 设计级，只读分析不移植 |
| 5 | 文件库 | TagSpaces | Location、标签、筛选、Saved View、Inspector、批量交互分层 | 设计级；不复制 AGPL 实现 |
| 6 | AI 整理预览 | ai-file-sorter | taxonomy、dry run、建议计划、分类缓存、审核 | AGPL 概念级；不复制代码或结构 |
| 7 | 自然语言规则 | Accomplish + OpenCode | agent/tool 边界、proposal、permission、structured execution | 按 LICENSE 登记；翻译到 Zen Canvas 安全模型 |
| 8 | 本地内容理解 | Local-File-Organizer | 本地提取、轻量语义、摘要与分类输入 | 轻量设计级；不引入无预算全文处理 |

参考实现只提供设计证据。任何与 Zen Canvas 许可证、数据域或安全模型冲突的做法必须进入拒绝清单。

---

## 3. 实施阶段与产品模块映射

依赖关系要求扫描/索引先于重复检测和分析，因此实施阶段不机械照抄原模块编号，但始终服务于上述 8 个功能模块。

| Task | 产品模块 | 状态 |
|---|---|---|
| 00 | 合并后架构基线审计 | 已完成 |
| 01A + 01B | 模块 3：扫描与索引 | 已完成 |
| 02 | 模块 1：重复检测 | 已完成，schema 29 |
| 03 | 模块 2：大型文件列表/空间分析 | 已完成，schema 30 |
| 04 | 模块 4：全局快捷搜索 | 当前完整模块 |
| 05 | 模块 5：文件库 | 等待 Task 04 |
| 06 | 模块 6：AI 整理预览 | 等待 Task 05 |
| 07 | 模块 7：自然语言规则 | 等待 Task 06 |
| 08 | 模块 8：本地内容理解 | 等待 Task 07 |

每个 Task 是一个完整产品模块，不拆为 A/B/C，不创建单独“收尾任务”。上一阶段人工接受的遗留，必须作为下一完整模块的第一组生产改动完成，然后继续完成该模块全部目标。

---

## 4. PR #15 后不可回退的架构前提

### 4.1 系统级 Global Index

- Windows：MFT/USN 与安全回退；
- macOS：Spotlight/FSEvents；
- volume 级启用、禁用、状态和增量同步；
- disabled volume 不进入搜索、计数、状态、打开或 reveal；
-原生文件身份与短查询性能策略；
-系统级索引与 managed 数据域隔离；
-Global Search 不 join File Library `files`；
-open/reveal 只接受 entry ID 并由 backend revalidate。

### 4.2 Managed AI

-持久 AI job/queue；
-backpressure；
-scope ownership；
-provider policy；
-fingerprint；
-cancellation；
-用户 correction；
-provider 输出类型验证；
-调用前后重新验证。

### 4.3 文件 mutation 与恢复

-所有移动、重命名和清理必须先 preview；
-operation/cleanup journal 是恢复事实；
-Safe Trash 与 restore 不得弱化；
-operation identity 不得被 dedupe fingerprint 替代；
-renderer 不得提交任意 path 绕过 backend authoritative resolve。

### 4.4 平台与 CI

- Windows Named Pipe 和 native service 安全边界；
-安装/卸载回滚钩子；
-Windows/macOS Rust、前端、原生回归、性能、安全审计和打包验证。

后续优先扩展这些能力，不旁路或重建。

---

## 5. 已完成模块

### 5.1 模块 3：扫描与索引（Task 01A/01B）

已完成：

- scan root lease；
-session/run/generation；
-scanner-owned `scan_seen`；
-stale safety；
-crash recovery；
-multi-root mapping；
-durable revision；
-Rust watcher mutation owner；
-overflow/revision-gap reconciliation；
-renderer 脱离最终一致性 owner。

持续边界：

- File Library Scan 与 Global Index 独立；
- watcher 不写 `scan_seen`、不推进 generation；
-不建立 raw watcher event 通用日志；
-不泛化 `ai_jobs`。

### 5.2 模块 1：重复检测（Task 02）

已完成：

- lightweight physical identity；
-fingerprint cache；
-prehash/full BLAKE3；
-bounded worker；
-durable dedupe run；
-hardlink-safe duplicate groups；
-global authority；
-read-only duplicate UI；
-cancel/restart/cache reuse。

持续边界：

-不迁移 `files.id`；
-`files.content_hash` 只是兼容镜像；
-active group/member 是 duplicate authority；
-不自动 keeper/delete。

### 5.3 模块 2：大型文件/空间分析（Task 03）

已完成：

- durable Analysis Run；
-fixed Detector registry；
-Finding/Evidence/Decision；
-large file/large directory；
-cleanup heuristic；
-Safe/Review/Caution；
-atomic staged publication；
-invalidation/retention；
-cleanup/AI compatibility；
-durable frontend hydration。

Task 03 唯一接受遗留：

- duplicate exact 与 Safe exact 对同一 physical subject 仍可能重复累计。

该遗留必须在 Task 04 第一组关闭，不得成为独立技术任务。

---

## 6. 当前模块：Task 04 全局快捷搜索

主要参考 Tolaria，但仅设计级借鉴。

目标：

-先关闭 Task 03 exact physical-union 遗留；
-将全局快捷搜索收敛为明确的 window/hotkey/query session 架构；
-Global Index 继续是唯一文件搜索 authority；
-建立 latest-request-wins；
-响应携带 index health/completeness；
-稳定 ranking/tie-breaker；
-open/reveal live revalidation；
-Rust 独占 search window 与 global shortcut lifecycle；
-建立 Zen Canvas 自有 stable command catalog；
-command metadata 与 context execution 分离；
-command 不成为 mutation authority；
-standalone/main/browser 共享语义；
-完整 keyboard、IME、ARIA、focus、reduced-motion；
-100k/1M、rapid query、Windows/macOS 性能与打包门禁。

默认：

- schema 保持 30；
-无新依赖；
-不修改 native providers/service；
-不开始 File Library Query V2。

Task 04 权威合同：

```text
docs/remediation/TASK_04_GLOBAL_SHORTCUT_SEARCH.md
```

---

## 7. 后续完整模块

### 7.1 Task 05：文件库（TagSpaces）

目标：

- FileQuerySpec V2；
-keyset cursor 与 snapshot；
-跨页 selection；
-筛选/排序下沉 SQLite；
-用户 tags 与系统 Purpose/Lifecycle/Risk 分离；
-Saved Views；
-Summary DTO 与 Inspector Detail DTO；
-列表、查询、选择、Inspector store 分层；
-虚拟列表、键盘和无障碍；
-10 万日常基准、100 万性能门槛。

Task 04 的遗留若被人工接受，将作为 Task 05 第一组处理。

明确不做：

- Organization Plan；
-AI 自动整理；
-Content Artifact；
-把 Global Search cursor 当 Library snapshot。

### 7.2 Task 06：AI 整理预览（ai-file-sorter）

目标：

-把规则、AI、duplicate/finding 和用户修正生成的整理建议收敛为 Organization Plan；
-plan/item/evidence/conflict/decision/revision 持久化；
-dry run 与 diff；
-跨重启审核；
-identity expiry；
-后端解析 source/target；
-执行继续进入 operation journal、Safe Trash 和 restore；
-taxonomy 与分类缓存使用 Zen Canvas 自有 schema。

明确不做：

-直接执行模型输出；
-自动移动/删除；
-绕过 preview/journal/restore；
-复制 ai-file-sorter AGPL 代码。

### 7.3 Task 07：自然语言规则（Accomplish + OpenCode）

目标：

-自然语言只生成 proposal；
-编译为现有受约束 Rule AST；
-严格 allowlist；
-歧义询问；
-保存前模拟匹配；
-新规则默认关闭；
-provenance、revision、approval；
-agent/tool permission boundary；
-规则只产生分类/计划建议，不直接执行文件操作。

禁止生成 Bash、PowerShell、任意 SQL、任意绝对执行路径或永久删除动作。

### 7.4 Task 08：本地内容理解（Local-File-Organizer）

目标：

-受预算控制的 Extractor；
-Content Artifact；
-模型只接收 Artifact，不读取任意 path；
-local/cloud policy 分离；
-fingerprint/version/policy cache；
-consent、脱敏、retention；
-用户 correction 最高优先；
-OCR/视觉模型可选，不成为基础安装依赖；
-完成全部模块后的 migration、10万/100万、跨平台整合验收。

明确不做：

-默认读取或上传全文；
-把 AI trace 当内容库；
-无预算 OCR；
-自治文件 mutation。

---

## 8. 依赖关系

```text
Task 00 基线审计
        │
        ▼
Task 01A/01B 扫描与索引
        │
        ▼
Task 02 重复检测
        │
        ▼
Task 03 大型文件/空间分析
        │
        ▼
Task 04 全局快捷搜索
        │
        ▼
Task 05 文件库
        │
        ▼
Task 06 AI 整理预览
        │
        ▼
Task 07 自然语言规则
        │
        ▼
Task 08 本地内容理解 + 最终整合
```

依赖图是执行顺序。参考项目模块编号仍按第 2 节固定，不因实现顺序改变。

---

## 9. 遗留处理规则

人工验收可以在不破坏当前模块核心安全与可用性的前提下接受有限遗留，但必须：

1. 明确记录 failure mode；
2.登记 Risk Register；
3.冻结为下一完整模块第一组生产改动；
4.下一任务书给出针对性测试；
5.不得再次后移；
6.不得创建独立 debt-cleanup 阶段；
7.修复后继续完成下一完整模块，而不是停止。

---

## 10. 任务治理

每个完整模块：

-任务书由人工编写并合并；
-Codex 只执行；
-一个分支；
-一个 Draft PR；
-原子提交；
-完整测试、性能、安全、跨平台与打包；
-Closeout；
-停止等待人工代码级验收；
-不得自动合并；
-不得提前开始下一模块。

当前事实优先级：

```text
生产源码与测试
> 当前人工 TASK_*.md
> CODEX_REMEDIATION_INDEX_V1.md
> 本 Master Plan
> 参考分析/旧 Brief/旧讨论
```

许可证、安全和恢复边界不因参考项目设计更“方便”而降低。

---

## 11. 优先级

### P0

-数据域与 owner 边界；
-迁移和恢复安全；
-scan/watcher/dedupe/analysis durable truth；
-Global Search fail-closed 与 lifecycle；
-Organization Plan identity/revision；
-所有 mutation 的 preview/journal/restore。

### P1

-File Query V2；
-keyset cursor 与跨页选择；
-Tag/Saved View/Inspector；
-command catalog；
-content artifact；
-natural-language proposal；
-持久化任务结果与性能。

### P2

-高级 taxonomy；
-更丰富本地文档/图片理解；
-可选 OCR；
-相似图片；
-代码项目理解；
-音视频语义。

P2 能力不得在 Task 04–07 中夹带实施。
