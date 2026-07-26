# Zen Canvas Architecture Remediation Master Plan V1

## 1. 目标

Zen Canvas 的下一阶段不是继续堆叠小工具，而是把已存在的扫描、系统级搜索、Managed AI、规则分类、重复检测、清理、整理建议、文件操作和恢复能力，收敛为一套一致、可持久、可审计、可扩展的文件治理架构。

目标产品定位：

> 一个以本地优先、安全审核、内容理解、可恢复执行和用户最终控制权为核心的智能文件治理工作台。

本计划不试图把 Zen Canvas 改造成：

- 完整文件资源管理器；
- 多设备分布式文件系统；
- 云盘；
- 通用桌面 Agent；
- OCR/格式转换工具箱；
- 文件编辑器或媒体播放器集合。

---

## 2. 参考矩阵

| Zen Canvas 模块 | 主要参考项目 | 重点参考 | 明确不照搬 |
|---|---|---|---|
| 扫描与索引 | Spacedrive | Job、Location、Indexer phase、健康状态、事件体系 | 分布式设备、云同步、完整资源管理器 |
| 重复与垃圾检测 | Czkawka | 大小分组、预哈希、完整哈希、缓存、硬链接、取消 | 独立工具集合式产品形态 |
| AI 整理预览 | AI File Sorter | Dry Run、计划审核、批准决策、持久 Undo 思想 | 简单一次性 AI 分类器架构 |
| 文件库 | TagSpaces | Location、标签、筛选、Inspector、批量操作分层 | AGPL 代码、文件名内嵌标签、笔记应用边界 |
| 自然语言规则 | Accomplish/Coworker | scope 授权、提议/执行分离、permission gate、日志 | Bash、浏览器 Agent、自治桌面控制 |
| 本地内容理解 | Local File Organizer | 文本/图片先提取中间语义，再分类和命名 | 顺序脚本、无预算全文传模、弱安全执行 |
| 全局快捷搜索 | Tolaria | 命令注册、fuzzy ranking、键盘优先、菜单一致性 | 笔记应用业务和开放式 AI 聊天 |
| 大型文件列表 | Spacedrive | 虚拟列表、选择 Set、数据来源集中、键盘导航 | 一次请求 1000 条或无限目录列表 |

参考实现只提供设计证据。不得复制与 Zen Canvas 许可证、产品边界或安全模型不兼容的代码。

---

## 3. PR #15 后的架构前提

PR #15 已合并，后续所有设计必须承认以下既有能力。

### 3.1 系统级全局索引

- Windows：MFT/USN 及安全回退；
- macOS：Spotlight/FSEvents；
- volume 级启用、禁用、状态和增量同步；
- disabled volume 不得进入搜索、计数、状态、打开或 reveal；
- 原生文件身份和短查询性能策略；
- 系统级索引与 managed 数据域隔离。

### 3.2 Managed AI

- 持久 AI job/queue；
- backpressure；
- scope ownership；
- provider policy；
- fingerprint；
- cancellation；
- 用户 correction；
- provider 输出类型验证；
- 调用前后重新验证。

### 3.3 平台与 CI

- Windows Named Pipe 安全边界；
- 安装与卸载回滚钩子；
- Windows/macOS Rust、前端、原生回归、性能、安全审计和打包验证。

这些能力应优先扩展，而不是旁路或重建。

---

## 4. 八个整改模块

## 4.1 扫描与索引

目标：

- 明确全局索引与 Managed Index 的边界；
- 统一或协调扫描任务生命周期；
- 持久化 scan root 健康状态；
- 引入正式 scan generation；
- 将 watcher 最终一致性从 React 移到后端；
- 建立 durable reconciliation；
- 多 root 扫描形成父子任务；
- 避免与 PR #15 建立第二套系统级索引。

候选能力：

```text
scan_roots
scan_runs / job_runs
job_failures
pending_fs_changes
scan_generation
root health
global → managed bootstrap
```

是否真的需要通用 Job Runtime，必须由 Task 00 判断。Managed AI queue 不得未经证据直接泛化。

---

## 4.2 重复与空间分析

目标：

- 按大小分组；
- 排除硬链接；
- 头尾预哈希；
- 完整 BLAKE3；
- 持久 fingerprint cache；
- 正式 duplicate group；
- 持久 analysis run/finding；
- 区分“占用空间”和“可安全释放空间”；
- 保留 Safe/Review/Caution 和 Safe Trash 安全边界。

候选能力：

```text
file_fingerprints
duplicate_groups
duplicate_group_members
analysis_runs
analysis_findings
detector architecture
```

---

## 4.3 Organization Plan

目标：

- 把规则、AI、重复检测和用户修正生成的整理建议收敛为正式计划；
- 计划、项目、证据、冲突、决策和版本持久化；
- 用户可跨重启继续审核；
- 执行只接受 plan ID、revision 和批准范围；
- 后端重新解析权威 source/target；
- 最终仍进入既有 operation journal 和恢复系统。

候选能力：

```text
organization_plans
organization_plan_items
organization_plan_evidence
organization_plan_decisions
organization_plan_conflicts
plan validation
execution adapter
```

Organization Plan 是整改计划中最重要的领域边界之一。

---

## 4.4 文件库

目标：

- 统一 QuerySpec；
- 筛选和排序下沉 SQLite；
- 用户标签与 Purpose/Lifecycle/Risk 分离；
- Saved Views；
- 列表 Summary DTO 和 Inspector Detail DTO 分离；
- Store 按查询、选择、Inspector、内容理解和计划拆分；
- 文件库不再承担整理计划全量拼接。

候选能力：

```text
FileQuerySpec V2
tags
file_tags
saved_library_views
FileSummaryDto
FileDetailDto
```

TagSpaces 只参考状态和交互分层，不复制 AGPL 实现。

---

## 4.5 自然语言规则

目标：

- 自然语言只编译为现有 Rule AST；
- 不创建第二套规则执行器；
- 严格 schema 与 allowlist；
- 歧义必须询问；
- 保存前执行模拟匹配；
- 新规则默认关闭；
- 规则只产生分类和整理建议，不直接执行文件操作；
- 记录 proposal provenance。

候选能力：

```text
rule_proposals
NaturalLanguageRuleRequest
RuleProposal
ambiguity flow
rule preview
```

明确禁止生成 Bash、PowerShell、任意 SQL、任意绝对执行路径和永久删除动作。

---

## 4.6 本地内容理解

目标：

- 文件先进入受预算控制的 Extractor；
- 生成 Content Artifact；
- 模型只接收 Artifact，不直接读取任意路径；
- 本地与云策略分离；
- 提取、摘要和理解缓存以 fingerprint/version/policy 为键；
- 用户 correction 最高优先级；
- OCR 和视觉模型可选，不成为基础安装强依赖。

候选能力：

```text
content_artifacts
content_extraction_runs
ContentExtractor
ExtractionBudget
privacy/provider policy
```

---

## 4.7 全局快捷搜索

目标：

- 将超大 CommandModal 拆分；
- 建立 Search Provider；
- 文件、命令、设置、任务和历史使用统一结果协议；
- 建立 query sequence/cancellation 状态机；
- 每类结果有配额；
- 统一 Command Manifest 生成 Spotlight、快捷键、菜单和测试；
- 保留 PR #15 disabled/unavailable 安全过滤。

候选能力：

```text
SearchCoordinator
SearchProvider
UnifiedSearchResult
CommandManifest
SearchSession
ranking/quota
```

---

## 4.8 大型文件列表

目标：

- 后端 keyset cursor；
- 查询快照；
- 局部失效；
- O(1) 选择；
- 跨页 `all_matching` 选择；
- 页面缓存；
- 列表轻 DTO；
- 组织计划后端分页；
- 10 万文件日常基准、100 万文件性能门槛。

候选能力：

```text
CursorPage
queryHash
snapshotRevision
SelectionScope
QueryCache
```

是否立即替换所有 OFFSET，必须根据 Task 00 对当前查询和 PR #15 搜索路径的审计决定。

---

## 5. 依赖关系

```text
PR #15 合并后基线审计
          │
          ▼
扫描/索引/身份/任务基础
          │
   ┌──────┴────────┐
   ▼               ▼
指纹与重复检测     内容 Artifact 基础
   │               │
   └──────┬────────┘
          ▼
   Organization Plan
          │
   ┌──────┴─────────────┐
   ▼                    ▼
文件查询与大型列表       自然语言规则
   │
   ▼
文件库标签/视图/Inspector
   │
   ▼
Spotlight Provider 重构
   │
   ▼
集成、迁移、性能与发布 QA
```

该依赖图只是规划草案。Task 00 必须根据合并后真实代码修正。

---

## 6. 暂定阶段

| 阶段 | 暂定名称 | 状态 |
|---|---|---|
| 00 | Post-Merge Baseline Audit | 可执行 |
| 01 | Job, Scan and Reconciliation Foundation | 待 Task 00 冻结 |
| 02 | File Identity, Fingerprint and Dedupe | 待 Task 00 冻结 |
| 03 | Storage Analysis Runs and Findings | 待 Task 00 冻结 |
| 04 | Organization Plan Core | 待 Task 00 冻结 |
| 05 | Organization Plan Workspace Migration | 待 Task 04 |
| 06 | File Query V2 and Cursor Pagination | 待 Task 00 冻结 |
| 07 | Library Tags, Saved Views and Inspector | 待 Task 06 |
| 08 | Content Artifact Pipeline | 待 Task 00 冻结 |
| 09 | Natural Language Rule Compiler | 待 Task 08 或审计结论 |
| 10 | Spotlight Provider Architecture | 待 Task 06 与 PR #15 稳定 |
| 11 | Integration, Migration and Performance QA | 待前置阶段 |

---

## 7. 优先级

### P0

- 合并后基线审计；
- 索引域边界；
- watcher durable reconciliation；
- scan generation；
- Organization Plan；
- fingerprint；
- 查询筛选排序后端化；
- 迁移安全。

### P1

- duplicate groups；
- analysis findings；
- keyset cursor；
- 跨页选择；
- content artifact；
- plan evidence/conflict；
- 持久化任务结果。

### P2

- 自然语言规则；
- 用户标签；
- Saved Views；
- 本地文档与图片理解；
- Spotlight provider 化。

### P3

- OCR；
- 相似图片；
- 代码项目理解；
- 音视频语义；
- 复杂 taxonomy；
- 可选本地 VLM。

---

## 8. 数据库原则

后续可能新增的表仅为候选，不是 Task 00 的实施授权：

```text
scan_roots
job_runs
job_failures
pending_fs_changes

file_fingerprints
duplicate_groups
duplicate_group_members
analysis_runs
analysis_findings

organization_plans
organization_plan_items
organization_plan_evidence
organization_plan_decisions

tags
file_tags
saved_library_views

content_artifacts
content_extraction_runs
rule_proposals
```

数据库演进必须满足：

- 空数据库升级；
- 当前版本用户数据库升级；
- 迁移幂等边界；
- 失败时明确报错；
- 不得要求用户删除数据库；
- 不得丢失 operation journal、AI queue、全局索引状态、规则或用户修正；
- 大型表迁移必须评估锁时长、磁盘增长和回滚策略。

---

## 9. 非目标

本轮架构整改不包含：

- Ubuntu/Linux 正式发布支持扩张；
- 版本号提升；
- release/tag；
- 代码签名和 notarization；
- 云同步；
- P2P；
- 移动端；
- 浏览器自动化；
- 邮件/日历；
- 格式转换；
- 通用 OCR 工作台；
- 通用 Agent；
- 完整文件管理器替代。

任何阶段发现必须引入上述能力才能继续时，应停止并提交架构问题，不得自行扩张产品范围。

---

## 10. 成功标准

整改完成后，Zen Canvas 应具备：

1. 全局索引、Managed Index 和内容理解边界清晰；
2. 所有长期任务可观察、可取消、可恢复或明确标记中断；
3. watcher 不依赖 React 保证最终一致性；
4. 重复检测有缓存、分阶段哈希和正式组；
5. 清理结果可持久、可解释且不夸大可释放空间；
6. 整理建议是版本化、持久化的 Organization Plan；
7. 文件库对大规模数据执行真正的后端查询；
8. 内容理解有预算、缓存和隐私策略；
9. 自然语言规则只能生成受限 Rule AST；
10. Spotlight 与命令系统有统一来源；
11. 既有文件操作、journal、恢复、scope 和 Managed AI 安全边界不退化。
