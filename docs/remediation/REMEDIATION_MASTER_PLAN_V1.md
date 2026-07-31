# Zen Canvas Architecture Remediation Master Plan V1

## 1. 总目标

Zen Canvas 的整改目标不是堆叠零散工具，而是把扫描、系统搜索、Managed AI、规则分类、重复检测、空间分析、整理建议、文件操作和恢复收敛为一套：

- 本地优先；
- 安全审核；
- 持久事实；
- 可恢复执行；
- 跨平台一致；
- 用户拥有最终控制权；
- 可继续扩展但不泛化失控；

的智能文件治理工作台。

Zen Canvas 不改造成完整文件资源管理器、多设备文件系统、云盘、通用自治桌面 Agent、OCR/格式转换工具箱或文件编辑器/播放器集合。

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
| 7 | 自然语言规则 | Coworker（原 Accomplish）+ OpenCode | proposal、permission、structured approval | MIT；翻译为 typed Rule Proposal，不引入 Agent runtime |
| 8 | 本地内容理解 | Local-File-Organizer | 本地提取、轻量语义、摘要输入 | 轻量设计级；隐私合同先行 |

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
| 06 | 模块 6：AI 整理预览 | 已通过 PR #40 合并，schema 32 |
| 07 | 模块 7：自然语言规则 | **已实现，schema 33，Draft PR 等待人工代码级验收** |
| 08 | 模块 8：本地内容理解 | 等待 Task 07，禁止执行 |

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
- Task 07 不重建 native provider/service。

### 4.2 Managed File Library

- managed `files` 是 File Library authority；
- scan roots、sessions、runs、generation 和 watcher reconciliation 已持久化；
- scanner 是 `scan_seen` owner；
- watcher 不写 `scan_seen`，不推进 generation；
- File Library 与 Global Index 数据域、scope、cursor 和 revision 独立；
- `files.id` 不迁移；
- Task 07 impact preview 使用 File Library V2 durable scope；
- root disabled/degraded/reconciliation 必须 fail closed。

### 4.3 Managed AI 与交互式 Proposal AI

- 持久 Managed AI queue、scope ownership、provider policy、fingerprint、cancel 和 correction gate 已存在；
- `ai_jobs` 继续只服务 managed file analysis，不泛化为通用 runtime；
- Task 07 的规则提案是用户触发、短时、可取消的 provider request，不建立第二 durable queue；
- 复用现有 provider client、credential store、preset、timeout 与 JSON 能力；
- 只发送用户 prompt 和固定 Rule AST schema；
- 不发送文件正文、文件列表、路径样本、operation logs 或 secrets；
- 模型不直接写、启用或运行 rule。

### 4.4 文件 mutation 与恢复

- 所有移动、重命名和清理必须先 preview；
- operation/cleanup journal 是恢复事实；
- Safe Trash 与 restore 不得弱化；
- renderer 不得提交任意 path 作为 mutation authority；
- Organization Plan 是审核和 provenance artifact，不是第二 journal；
- Rule 只更新 classification/suggestion metadata；
- Rule Proposal 和 Apply 不产生 filesystem mutation。

### 4.5 Analysis、Dedupe、Finding 与 Plan

- active duplicate group/member 是重复权威；
- Analysis Run/Finding/Decision 是分析权威；
- duplicate/finding 不直接授权 mutation；
- Plan 可读取 bounded summary，但不修改其 schema 或决策；
- Task 07 第一组修复 Plan 的 live dry-run equivalence、scope health、review transition、recovery、retention 和 summary；
- Plan 和 Rule Proposal 保持独立 ledger。

### 4.6 Rule AST

- 当前结构化 Rule AST V1 是唯一目标格式；
- Task 07 不创建 Rule AST V2、脚本表达式、正则执行器、SQL、JavaScript 或 shell；
- backend canonical validation 是 AST authority；
- renderer 不再提交整套 Rule vector 作为执行事实；
- 正式规则使用 per-rule revision 和 catalog revision CAS；
- proposal Apply 后规则默认 disabled；
- Enable 与 Run 为独立显式动作。

### 4.7 平台与 CI

- Windows/macOS Rust、前端、原生回归、性能、安全审计和打包验证持续生效；
- package job 的 success/skipped 必须分别记录；
- 本地 package 不冒充远端 artifact；
- 后续模块优先扩展现有能力，不旁路或重建。

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

已建立 Query V2、revision/keyset pagination、durable roots、summary/detail/selection、user tags、Saved Views、Inspector 和权限。Task 05 的 9 项接受遗留已由 Task 06 第一组实现。

### AI 整理预览（Task 06）

PR #40 squash merge：`29e85c099c5ee921ad7d4237c780dc47126e0fa3`。

已建立 schema 32：

- `organization_plans`；
- `organization_plan_items`；
- user tags/Saved Views 单调 revision。

已实现 durable plan、bounded source materialization、review decisions、Managed AI adapter、dry run、existing operation journal execution、restart projection、virtual UI 和 permissions。

人工验收接受并转入 Task 07 第一组的遗留：

1. dry run 审核 target 与 execution current target 可能不一致；
2. refresh/dry run/execution 未完整重验 managed root health；
3. `needs_review` 人工审核后执行路径不可达；
4. journal 全完成后的 crash projection 可能停在 partial；
5. terminal retention 错用 age AND count；
6. Plan UI 全局计数从已加载 100 行推断；
7. CI package success/skipped 证据混写。

这些遗留不得再次后移。

---

## 6. 当前模块：Task 07 Natural-Language Rule Proposal

权威任务书：

```text
docs/remediation/TASK_07_NATURAL_LANGUAGE_RULE_PROPOSAL_AND_APPROVAL.md
```

### 6.1 参考边界

Coworker（原 Accomplish）：

```text
accomplish-ai/coworker
SHA 2cf74d08f22078b8b1fd3f97bff3ec4612262613
MIT
```

OpenCode：

```text
anomalyco/opencode
SHA 7565e03536d19e850f9996c407f9bf5e932b5f7a
MIT
```

只借鉴：可见 proposal/plan、用户控制范围、ask/allow/deny、一次批准、明确拒绝、纠正后重新生成、权限评估与动作分离。

拒绝：Agent runtime、daemon、OpenCode SDK、shell、MCP、skills、subagents、browser automation、generic tool permission registry、auto approve、session always-allow、UI/DTO/event bus 移植。

### 6.2 Schema 33

Task 07 授权 schema `32→33`：

- `rules.ast_version`；
- `rules.revision`；
- `rules.origin_proposal_id`；
- `rule_catalog_state`；
- `rule_proposals`。

不 ALTER `files`，不迁移 `files.id`，不修改 operation/cleanup journal、Managed AI、Analysis/Finding、Plan 或 Global Index schema。

### 6.3 Proposal artifact

Rule Proposal 是 durable candidate/review/provenance artifact：

- 用户 prompt 最大 4,000 code points；
- candidate 只允许 Rule AST V1；
- model output 经过 strict JSON parse、literal grounding 和 backend canonical validation；
- 不保存 raw response、reasoning、文件正文、文件列表、tool trace 或 secrets；
- proposal revision 是 generate/edit/preview/apply/cancel CAS；
- update proposal 绑定 target rule + base revision；
- proposal 不自动 apply、enable 或 run。

### 6.4 Permission classification

- `deny`：delete/trash、shell/script/tool、content/OCR、unmanaged scope、任意 path mutation、unsupported AST、protected target、虚构 literal、自动 enable/run；
- `ask`：Move/Rename/Archive、path/directory、Sensitive/System/Caution、duplicate、宽匹配、冲突、update existing rule；
- `allow`：只表示可进入普通人工批准，绝不代表自动 Apply。

### 6.5 Impact preview

- metadata-only；
- managed File Library V2 scope；
- 同一 SQLite snapshot；
- exact 或明确 deferred，不估算；
- sample 最多 20，明确标为 sample；
- preview fingerprint 绑定 proposal/rule/catalog/library/scope/policy；
- Apply 必须获得 exact impact 并重新验证。

### 6.6 Human Apply

Apply：

- 只接受 IDs、expected revisions、preview fingerprint 和 confirmed；
- backend 重算 candidate、scope、impact 和 fingerprint；
- 单 transaction 写 proposal + user rule；
- 新规则由 backend 生成 ID/source/timestamps；
- 新规则默认 disabled；
- update 使用 rule + catalog CAS；
- Apply 不执行规则、不修改 files、不创建 Plan、不调用 journal。

### 6.7 Rule Repository V2

- Create/Update/Toggle/Delete 分离；
- per-rule revision + catalog revision；
- renderer 不再 whole-object overwrite；
- system/learned rules 受保护；
- 旧 write command 退出生产 capability；
- 前端与 browser mock 迁移到 V2。

### 6.8 Backend-authoritative execution

- `execute_rules_for_scope_v2` 从 SQLite 加载 enabled rules；
- renderer 不提交 Rule vector；
- expected catalog revision fail closed；
- scanner/watcher/manual adapters 使用同一 authority；
- Rule 只更新分类/建议；
- 任何 move/rename/delete 仍走 Organization Plan 与 journal。

### 6.9 UI/State

Rules workspace 提供：

- Describe a rule；
- Manual rule builder；
- proposal list/Continue Later；
- clarification、candidate AST、validation；
- impact exact/deferred、sample、conflicts；
- Edit/Regenerate/Apply as Disabled；
- Enable 独立；
- Run 独立；
- revision conflict、latest-wins、focus/ARIA、narrow/zoom/CJK/RTL。

### 6.10 明确不做

- Content Artifact/OCR/正文读取；
- Agent/task/tool runtime；
- shell/MCP/browser automation；
- Rule AST V2/脚本规则语言；
- 第二 AI queue；
- 自动文件 mutation；
- operation/cleanup journal schema 修改；
- Task 08。

### 6.11 Task 07 delivery state

Task 07 的完整实现位于 `remediation/07-rule-proposal`，包含 Task 06 七项接受遗留的真实行为修复、schema 33、durable Rule Proposal、Rule AST V1 canonical validation、truthful impact preview、Human Apply、Rule Repository V2 和 backend-authoritative execution。实现已停止在唯一 Draft PR，等待人工代码级验收；PR 不自动合并。Task 08 仍未开始。

---

## 7. Task 08 边界

只有 Task 07 合并后才可设计 Content Artifact、格式 extractor、隐私 consent、size budget、retention、local/cloud provider gate 和 rebuild/delete semantics。

Task 07 继续 metadata-only。任何自然语言条件涉及文件正文、OCR、语义摘要或内容搜索时必须 deny/clarify，不得提前实现。

---

## 8. 统一交付要求

每个后续完整模块必须：

- 人工任务书先进入 master；
- 一个实施分支；
- 一个 Draft PR；
- schema 只按任务书授权推进；
- 完整 frontend/Rust/remediation/security/performance/build；
- Windows/macOS/release/package 真实证据；
- Closeout、Risk Register、Index、Capability Matrix 和 permission matrix 同步；
- 停止等待人工代码级验收；
- 不自动合并或提前开始下一模块。
