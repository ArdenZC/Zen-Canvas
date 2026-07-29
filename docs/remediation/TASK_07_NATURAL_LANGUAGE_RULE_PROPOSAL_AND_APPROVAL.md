# Task 07 — Durable Natural-Language Rule Proposal、Validation 与 Human Approval

> 状态：任务书已由人工冻结；进入 `master` 后才可执行生产实施。
> 产品模块：固定模块 7「自然语言规则」。
> 前置合并：Task 06 / PR #40，squash merge `29e85c099c5ee921ad7d4237c780dc47126e0fa3`。
> 数据库授权：schema `32 → 33`。
> 实施方式：一个完整任务、一个实施分支、一个 Draft PR；不得拆成 07A/07B/07C，不得建立独立 Task 06 收尾任务。

---

## 1. 产品目标

Task 07 把现有「手工 Rule AST 编辑器 + renderer 提交整套规则执行」整改为可信、可继续、可解释的自然语言规则链：

```text
用户自然语言
→ durable proposal
→ 受限模型输出
→ backend canonical Rule AST
→ deterministic validation
→ 本地影响预览
→ 人工编辑/批准
→ 默认禁用的 durable user rule
→ 独立启用
→ backend-authoritative rule execution
```

核心原则：

- 自然语言不是执行命令；
- 模型输出不是规则事实；
- renderer 不是规则执行 authority；
- proposal 只可落入现有 Rule AST V1；
- 人工批准前不得写入正式规则；
- Apply 后规则默认禁用；
- Enable 和 Run 必须是独立显式动作；
- 文件内容、OCR 和 Content Artifact 属于 Task 08；
- 不建设通用桌面 Agent、OpenCode runtime、shell、MCP、skills 或工具调用系统。

示例目标：

- “把超过 500MB 的视频标记为 Archive”；
- “文件名以 screenshot 开头的图片归为 Personal，并建议移动到 Screenshots”；
- “30 天内修改过的代码文件保持 Active”；
- “重复文件只标记为 Review，不要移动”。

系统必须把请求转换成可见、可编辑、可验证的候选规则，不得直接修改文件或静默启用规则。

---

## 2. 现有能力与缺口

### 2.1 必须复用

现有代码已经具备：

- SQLite `rules` 表；
- Rust/TypeScript `Rule`、`RuleConditionGroup`、`RuleCondition`、`RuleAction`；
- `AND/OR` 分组；
- 字段、operator、enum、数值、日期和 template 校验；
- 手工 `AutomationRuleDialog`；
- Rule classification engine；
- classification version/fingerprint；
- File Library managed scope；
- AI provider、credential、preset、timeout 与 JSON 输出基础；
- main-window capability 和 browser mock；
- Rules UI、Inspector、手动重新应用规则；
- Task 06 Organization Plan、preview、journal 和 restore 安全链。

Rule AST V1 条件字段固定为：

```text
name
extension
file_type
path
directory
size
modified_at
is_duplicate
risk_level
```

Rule AST V1 action 字段固定为：

```text
purpose
lifecycle
context
risk_level
suggested_action
target_template
rename_template
```

Task 07 不扩展 Content/OCR 条件，不引入脚本表达式、SQL、JavaScript、shell 或任意函数调用。

### 2.2 必须关闭的缺口

1. `save_user_rule` 接受 renderer 完整 Rule，包括 ID、source、timestamps，且没有 revision CAS；
2. delete/toggle 没有统一 catalog revision；
3. `execute_rules_for_scope` 与 `execute_rules_for_paths` 接受 renderer `Vec<Rule>`；
4. Rules UI 运行状态主要是 renderer 内存态；
5. 没有 durable natural-language proposal；
6. 没有模型输出与正式 Rule AST 的隔离层；
7. 没有 impact preview、冲突提示和 apply fingerprint；
8. 没有 clarification、stale、continue-later 和 restart contract；
9. 没有规则目录单调 revision；
10. 旧请求可能覆盖较新规则。

---

## 3. Task 06 接受遗留：Task 07 第一组

PR #40 已按人工决定合并。以下 6 项实现问题和 1 项交付证据问题必须首先解决，且不得再次后移。完成后必须继续整个 Task 07，不得停止做单独收尾。

### 3.1 Dry run 与 execution 使用同一 live proposal

- dry run 重新生成 current authoritative preview/proposal；
- fingerprint 绑定 current classification、preview ID、operation kind、target、risk、edited target、collision 和 identity facts；
- execution 消费与 dry run 相同的 canonical live selection；
- classification、target、risk、preview、edited target 或 collision 任一变化返回 `organization_dry_run_expired`；
- edited filename collision 针对最终 edited target 计算；
- 禁止执行器在 dry run 后静默采用另一 target。

### 3.2 Managed scope/root health 全链 revalidation

`refresh_organization_plan`、dry run 和 execution 都必须重新验证：

- source query provenance；
- managed root ID；
- root enabled；
- health status；
- reconciliation required；
- missing/invalid references；
- file 当前仍属于允许 scope。

任何 disabled、missing、degraded、reconciliation-required 或 invalid reference 必须使 item/plan stale/blocked 并禁止执行。

### 3.3 `needs_review` 人工审核可达

- `needs_review` 可经用户 Accept/Edit 成为 reviewed/executable；
- 转换前重新验证完整 live facts；
- low confidence、Sensitive、duplicate、requires-confirmation、跨卷、目录创建保留明确风险；
- blocked、delete、trash、unsupported、protected path、collision 永远不能升级；
- UI、DTO 和测试区分 `ready`、`needs_review`、`reviewed`、`blocked`；
- 使用 schema 32 现有字段/约定完成，不推进 schema 34。

### 3.4 Crash recovery 正确投影 terminal 状态

- journal 全完成且无 remaining accepted+ready items → `completed`；
- 仍有可执行项或 failed/skipped → `partially_completed`；
- pending/manual_review/reconciliation → 保持 executing/partial 且不可自动重放；
- unknown mapping → stale/failed；
- finalize 与 startup recovery 使用同一 projection helper；
- 增加 final journal persist 后、plan projection 前崩溃的故障注入测试。

### 3.5 Retention 使用 union contract

terminal plan 候选为：

```text
超过 30 天
UNION
不在最新 100 个 terminal plans 内
```

要求去重、child-first、每次最多 20、不删除 operation/cleanup logs、不删除 unresolved journal 引用，并分别测试 age、count、overlap。

### 3.6 Plan summary 必须 backend authoritative

Plan DTO 增加全计划聚合：

```text
undecided
accepted
kept
edited
needsAnalysis
needsReview
ready
blocked
stale
executing
executed
failed
skipped
remainingExecutable
```

Organize UI 不得从当前加载的 100 行推断完整数量或动作可用性。

### 3.7 CI/package 证据必须真实

- CI `30454740982` 的 package jobs 为 skipped，不得写为成功；
- 提供真实 NSIS 和 unsigned DMG 成功 run/job/artifact；
- Draft 条件导致 skipped 时使用明确 package workflow 或 Ready/人工触发；
- 本地 package 与远端 package 分开记录；
- 不得用 workflow 总体 success 掩盖 skipped job。

---

## 4. 参考项目与许可证

### 4.1 Coworker（原 Accomplish）

```text
repository: accomplish-ai/coworker
SHA: 2cf74d08f22078b8b1fd3f97bff3ec4612262613
license: MIT
```

实施前至少阅读：

```text
LICENSE
README.md
packages/agent-core/src/opencode/config-generator.ts
packages/agent-core/src/opencode/system-prompt-behaviors.ts
docs/qa-suites/permissions-filesystem-tests.md
```

只借鉴：可见 plan/proposal、用户控制范围、写操作显式批准、拒绝后停止、完成/失败/剩余工作明确、本地优先。

### 4.2 OpenCode

```text
repository: anomalyco/opencode
SHA: 7565e03536d19e850f9996c407f9bf5e932b5f7a
license: MIT
```

实施前至少阅读：

```text
LICENSE
packages/opencode/src/permission/index.ts
packages/web/src/content/docs/permissions.mdx
packages/schema/src/permission.ts
packages/opencode/src/tool/task.ts
```

只借鉴：`allow/ask/deny`、明确 deny 不被覆盖、一次批准与持久批准分离、reject/correction 后停止并重新提案、权限评估与动作分离。

### 4.3 主动拒绝

禁止移植或建设：

- Coworker daemon；
- OpenCode SDK/runtime/serve；
- shell/bash/edit/write/patch 工具；
- MCP、skills、subagents、browser automation；
- 通用 tool permission registry；
- wildcard path execution permission；
- auto approve 或 session always-allow 执行授权；
- Agent todo/task runtime；
- generic ask/allow/deny 数据库；
- 模型直接调用 Rule、filesystem 或 operation API；
- 复制 Coworker/OpenCode UI、DTO、event bus、daemon 或 session 结构。

Task 07 只把原则翻译为 Zen Canvas typed Rule Proposal。

---

## 5. Schema 33

Task 07 唯一授权：

```text
32 → 33
```

不得推进 schema 34。

### 5.1 `rules` 小表 migration

```sql
ALTER TABLE rules ADD COLUMN ast_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rules ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rules ADD COLUMN origin_proposal_id TEXT;
```

合同：

- `revision` 是 update/toggle/delete CAS；
- `ast_version=1` 对应当前 Rule AST；
- `origin_proposal_id` 记录 provenance，不形成执行依赖；
- existing user/system/learned rules backfill revision 1；
- 不改变现有 AST JSON 语义；
- 不 ALTER `files`，不迁移 `files.id`。

### 5.2 `rule_catalog_state`

```sql
CREATE TABLE rule_catalog_state (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    updated_at INTEGER NOT NULL
);
```

初始化 revision 1。所有正式 rule create/update/toggle/delete 在同一 transaction 中 bump catalog revision 一次。

### 5.3 `rule_proposals`

```sql
CREATE TABLE rule_proposals (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN (
        'draft', 'generating', 'ready', 'needs_clarification',
        'invalid', 'stale', 'applying', 'applied',
        'cancelled', 'failed'
    )),
    intent_kind TEXT NOT NULL CHECK (intent_kind IN ('create', 'update')),
    target_rule_id TEXT,
    base_rule_revision INTEGER,
    prompt TEXT NOT NULL,
    prompt_fingerprint TEXT NOT NULL,
    provider_kind TEXT,
    provider_preset TEXT,
    model TEXT,
    ast_version INTEGER NOT NULL,
    candidate_rule_json TEXT,
    candidate_fingerprint TEXT,
    summary TEXT,
    clarification_json TEXT NOT NULL DEFAULT '[]',
    validation_json TEXT NOT NULL DEFAULT '{}',
    applied_rule_id TEXT,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    last_error_code TEXT,
    last_error_detail TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    generated_at INTEGER,
    applied_at INTEGER
);

CREATE INDEX idx_rule_proposals_status_updated
ON rule_proposals(status, updated_at DESC, id);

CREATE INDEX idx_rule_proposals_target
ON rule_proposals(target_rule_id, status, updated_at DESC);
```

合同：

- prompt 最大 4,000 Unicode code points；
- 不保存文件正文、文件列表、raw provider response、reasoning、tool trace 或 secrets；
- candidate 只保存 backend canonical AST；
- provider/model 只作 provenance；
- proposal revision 是 generate/edit/preview/apply/cancel/delete CAS；
- update proposal 绑定 target rule ID + base revision；
- proposal 不是 rule execution authority。

### 5.4 Migration

- 使用现有 `BEGIN IMMEDIATE`；
- 任一失败完整 rollback，`user_version` 保持 32；
- 全部成功后最后设为 33；
- current-schema ensure idempotent；
- future schema reject；
- 真实 schema32 fixture；
- 100k/1M `files` fixture证明不重写 files；
- WAL reader；
- rules revision backfill；
- Plan/journal tables 不变；
- old-binary future guard。

---

## 6. Proposal 状态机

```text
draft → generating → ready
generating → needs_clarification | invalid | failed
needs_clarification | invalid | failed | stale → generating
ready → applying → applied
draft | generating | ready | needs_clarification | invalid | stale | failed → cancelled
```

规则：

- `applied/cancelled` 不倒退；
- 每个 proposal 只有一个 active generation owner；
- generating crash → failed + `rule_proposal_generation_interrupted`；
- applying 在单 transaction 中写 rule + proposal，不存在部分 applied；
- candidate、target rule 或 catalog 变化 → stale；
- stale 不能 Apply；
- correction 生成新 proposal revision；
- 不自动 retry provider；
- 不自动 Apply、Enable 或 Run。

---

## 7. Rule AST V1 与 canonical validation

### 7.1 模型可提出

- display name；
- root operator `AND|OR`；
- 最多 32 groups；
- 每组最多 32 conditions；
- 当前允许字段/operators；
- 当前 RuleAction 字段；
- summary、clarifications、warnings。

### 7.2 模型不得控制

- rule/proposal ID；
- source/enabled/revision/ast version；
- timestamps/catalog revision；
- file IDs 或 path 列表；
- SQL、shell、script、function、tool；
- filesystem execution；
- provider credential；
- source scope；
- delete/trash。

### 7.3 Backend canonicalization

1. `deny_unknown_fields` parse；
2. normalize enum/operator casing；
3. normalize extension、size/date units；
4. 只在语义不变时 sort/dedupe；
5. backend 生成 group/condition/rule IDs；
6. 调用与手工 builder 相同的 canonical validator；
7. 生成 deterministic candidate fingerprint；
8. 返回 stable validation/error codes。

不得长期维护互相漂移的 TS/Rust validator；Rust 为 authority，前端只做即时提示。

### 7.4 Literal grounding

free-text、path/directory literal、target/rename template 必须：

- 直接出现于用户 prompt；或
- 是确定性规范化形式，例如 `PDF→pdf`、`500 MB→bytes`；或
- 来自固定 enum vocabulary。

模型虚构的目录、模式、数字、天数或 target 必须进入 `needs_clarification`，不得静默接受。

---

## 8. AI generation 边界

### 8.1 不建设第二 AI queue

- 复用现有 provider client、credential store、preset、timeout、JSON mode/schema；
- 不写入 Managed AI `ai_jobs`；
- 不泛化 Managed AI worker；
- 不建 durable rule generation queue；
- 可使用内存 cancellation owner；
- 每 proposal 最多一次 active generation；
- 全局并发最多 2；
- timeout/cancel 后 durable status=failed/cancelled；
- 不自动 retry。

### 8.2 模型输入

只发送：

- 用户 prompt；
- 固定 AST V1 schema；
- 固定 enum/operator vocabulary；
- 当前 rule canonical AST（仅 update）；
- 安全政策与输出约束。

禁止发送文件正文、文件名/路径样本、File Library rows、operation logs、AI traces、secrets、工具定义或其他规则的自由文本。

### 8.3 模型输出

只允许严格 JSON envelope：

```text
intent
candidate?
clarifications[]
explanation[]
literalGrounding[]
warnings[]
```

Raw response 只可在现有诊断 ring buffer 按既有脱敏规则短暂存在，不得持久化到 proposal。

### 8.4 无 AI 情况

- 未配置 provider → `rule_proposal_provider_unavailable`；
- UI 提供手工规则编辑器；
- 不伪造已生成 proposal；
- browser mock 只能返回标记为 mock 的 deterministic fixture；
- 不建设未经批准的本地 NLP parser。

---

## 9. Permission classification

Task 07 借鉴 `allow/ask/deny`，但只作为 proposal validation 分类，不建立通用权限系统。

### `deny`

- delete/trash/清空回收站；
- shell/script/command/tool；
- 文件正文/OCR/content 条件；
- unmanaged/global-only scope；
- 任意 path mutation；
- unsupported field/operator/action；
- protected system target；
- 模型虚构 literal；
- 绕过 Plan/preview/journal/restore；
- 自动启用或运行规则。

### `ask`

- Move/Rename/MoveAndRename/Archive；
- path/directory 条件；
- Sensitive/System/Caution；
- duplicate；
- target parent 可能创建；
- 匹配范围过宽；
- 与 enabled rules 冲突；
- update existing rule；
- action 会产生 `requires_confirmation`。

### `allow`

只表示 candidate 可进入普通人工批准，不代表自动 Apply、Enable 或 Run。

---

## 10. Proposal API

至少新增：

```text
create_rule_proposal
regenerate_rule_proposal
get_rule_proposal
list_rule_proposals
cancel_rule_proposal
delete_rule_proposal
replace_rule_proposal_candidate
preview_rule_proposal
resolve_rule_proposal_exact_impact
apply_rule_proposal
```

创建/重新生成 request 只接受：

```text
version
requestId
prompt
intentKind
proposalId? / targetRuleId?
expectedProposalRevision?
expectedTargetRuleRevision?
```

不得接受 candidate AST、rule ID、enabled、source、path list 或 provider secret。

`replace_rule_proposal_candidate` 允许用户在手工 builder 编辑 candidate，但 backend 必须重新 canonicalize、validate、fingerprint，旧 preview 失效。

Cancel 必须终止 active generation；Delete 只允许 terminal 或先 cancel，要求 expected revision + confirmed。Applied proposal 删除不得影响正式 rule。

---

## 11. Impact Preview

`preview_rule_proposal` 是本地 metadata-only 影响分析，不执行规则、不修改文件或 classification。

Request：

```text
proposalId
expectedProposalRevision
scope: FileLibraryScopeV2
pageSize <= 20
```

Response 至少包含：

```text
proposalId
proposalRevision
candidateFingerprint
catalogRevision
libraryRevision
scopeHealth
permissionClass
impactState: exact | deferred
matchedCount?
impactToken?
sampleRows[]
actionSummary
riskSummary
requiresConfirmation
broadMatch
conflictAnalysisState
conflicts[]
previewFingerprint
```

要求：

- 同一 SQLite read snapshot；
- scope healthy；
- missing/degraded/reconciliation/invalid fail closed；
- 不从 loaded rows 推断全库；
- sample 明确标为 sample，最多 20；
- bounded conflict sample 不描述为完整；
- matched count 只能 exact 或明确 deferred，不估算。

当 active managed rows >250,000 且 predicate 昂贵时：

- 首屏可 `impactState=deferred`；
- 不返回虚假 matchedCount；
- 返回 opaque token；
- resolver token 绑定 proposal revision、candidate fingerprint、catalog revision、library revision、scope；
- revision/health 变化返回 stale；
- Apply 必须拥有 exact impact；
- 不建 durable count job。

Preview fingerprint 绑定 proposal/candidate/target rule/catalog/library/scope/exact count/permission/policy version。

---

## 12. Human Apply

`apply_rule_proposal` request 只接受：

```text
proposalId
expectedProposalRevision
expectedCatalogRevision
expectedTargetRuleRevision?
previewFingerprint
confirmed=true
```

Backend 必须：

1. main-window authorization；
2. proposal revision/status CAS；
3. 重新 canonicalize candidate；
4. 重新验证 target rule revision；
5. 重新验证 catalog/library/scope health；
6. 重新计算 exact impact 和 preview fingerprint；
7. 拒绝 deny/invalid/stale/deferred；
8. 单 transaction create/update user rule；
9. backend 生成新 rule ID/source/timestamps；
10. 新 rule `enabled=false`；
11. rule revision 1 或 update +1；
12. catalog revision +1；
13. proposal → applied；
14. 保存 origin proposal ID；
15. 返回 rule + catalog revision。

Apply 不执行规则、不修改 files、不创建 Plan、不移动/重命名/删除文件、不调用 journal 或 Managed AI queue。

---

## 13. Rule Repository V2

至少新增：

```text
list_user_rules_v2
create_user_rule_v2
update_user_rule_v2
set_user_rule_enabled_v2
delete_user_rule_v2
get_rule_catalog_state
```

Create：renderer 只提交 AST draft + expected catalog revision；backend 生成 ID/source/timestamps/revision，默认 disabled。

Update：校验 expected rule revision + expected catalog revision + AST canonical validation。

Toggle：使用独立 command，不 whole-object overwrite。

Delete：expected rule revision + catalog revision + confirmed；只允许 source=user；不删除 proposal provenance；catalog bump。

前端生产路径迁移 V2；旧 `save_user_rule/delete_user_rule` 退出 capability write authority。若暂留 compatibility，只能 internal/test/fallback，不得永久双轨。

---

## 14. Backend-authoritative Rule Execution

新增/替换：

```text
execute_rules_for_scope_v2
```

Request：

```text
scope: durable IDs only
mode
expectedCatalogRevision
confirmed
```

Backend：

- 从 SQLite 加载 enabled user rules；
- 按 settings 决定 system/learned rules；
- canonical validate；
- 计算 ruleset/classification version；
- 执行 existing classification engine；
- 返回实际 catalog revision/version；
- old catalog revision fail closed；
- 不接受 renderer Rule list。

迁移 RulesView、scanner、watcher/reconciliation 和 path/file-ID adapters。Task 07 不建立新 durable Rule Job Runtime。

Rule 只修改 classification/suggestion metadata；任何 move/rename/delete 仍需 Organization Plan review/dry run/journal。

---

## 15. UI / UX

Rules workspace 提供双入口：

```text
Describe a rule
Manual rule builder
```

Natural-language composer：

- 简洁输入；
- provider/model disclosure；
- “只发送你输入的文字，不发送文件内容”；
- examples；
- generate/cancel；
- provider unavailable；
- manual fallback。

Proposal workspace：

- proposal list/status/Continue Later；
- prompt/clarifications；
- summary/AST inspector；
- permission class；
- validation warnings/errors；
- impact exact/deferred；
- sample before/after；
- conflicts；
- Edit Candidate；
- Regenerate；
- Apply as Disabled Rule；
- Cancel/Delete。

Apply 成功后显示 “Rule saved, currently disabled”。Enable 是独立按钮，Run on current scope 又是独立 confirmation。禁止 Apply+Enable+Run 单按钮。

Manual builder 改用 Repository V2，新建默认 disabled，stale conflict 明确显示。编辑 proposal candidate 时保存回 proposal，不直接创建正式 rule。

Accessibility：keyboard-first、focus restore、dialog trap、200% zoom、narrow、CJK/RTL、reduced motion/high contrast、`aria-live` generation/validation/impact/apply、stable error localization。不得复制 Coworker/OpenCode UI。

---

## 16. Store、权限与 Mock

Store 至少分离：

1. Rule catalog；
2. Rule CRUD；
3. Proposal list/detail；
4. Generation/cancel；
5. Candidate edit；
6. Impact preview/exact resolver；
7. Apply；
8. Rule execution。

要求 backend hydrate、latest-wins、revision conflict、stale 保留画面、不用 localStorage 作为 truth、不从 loaded page 推断 total、重启可继续 proposal、迟到 response 不覆盖新 revision。

所有新增 command：

- main window only；
- Search window denied；
- 无 arbitrary path；
- 无 generic invoke/SQL/shell/script；
- write 使用 expected revision；
- stable error code；
- capability/build.rs/main/lib/permission matrix 同步。

Browser mock 可模拟 lifecycle/review，生成结果必须是标记 mock 的固定 fixture；不得声称真实 AI、native persistence、真实 rule execution、filesystem mutation、credential 或 package 成功。

---

## 17. Retention

Rule proposals：

- draft/ready/needs_clarification/stale 不自动删除；
- applied/cancelled/invalid/failed 默认 30 天；
- 最多自动保留 100 个 terminal proposals；
- age UNION count overflow；
- 单次 prune 20；
- 不删除正式 rule；
- generating/applying 不删除；
- 显式删除要求 expected revision + confirmed。

正式 rules 不自动 prune。

---

## 18. 性能与容量

容量：

- prompt ≤4,000 code points；
- clarifications ≤8；
- warnings ≤32；
- candidate ≤32 groups × 32 conditions；
- sample ≤20；
- proposal list page ≤100；
- user rules 测试 1/100/500/1,000；
- terminal prune ≤20。

性能目标（不含外部 provider latency）：

- canonical parse/validation p95 ≤25ms；
- proposal DB create/finalize p95 ≤50ms；
- list 1,000 rules/proposals first page p95 ≤50ms；
- 100k simple impact first page p95 ≤150ms；
- 1M deferred impact first page p95 ≤200ms；
- 1M exact impact 单独记录，p95 ≤2s；
- Apply transaction p95 ≤100ms；
- rule toggle/update/delete p95 ≤50ms；
- 现有 100k rule execution 不回退超过 10%；
- migration 不扫描/重写 files。

必须覆盖 cold/warm、EXPLAIN、WAL reader、并发 writers、cancel/latest-wins 和 memory bounds。

---

## 19. 测试合同

### Task 06 handoff

- dry run/execution target equivalence；
- live classification/target/risk change；
- edited target collision；
- root disable/degrade/reconciliation；
- needs-review manual transition matrix；
- crash final projection completed；
- retention age/count union；
- plan summary across pages；
- package evidence contract。

### Migration/schema

- schema32→33 real fixture/rollback/future guard；
- rules revision backfill/catalog init/proposal empty；
- 100k/1M files untouched；
- WAL reader/size delta。

### Proposal/AI

- lifecycle、single owner、restart、terminal no-regression、CAS、late response、target-rule stale、retention；
- strict schema、unknown fields、malformed JSON、tool-call rejection、prompt injection、no content/raw persistence、provider unavailable、timeout/cancel、max prompt、literal grounding、deny intents。

### AST/Impact

- 每个 field/operator/value；
- AND/OR、size/date units、extension normalization、template/protected target；
- limits、deterministic IDs/fingerprint、TS/Rust parity；
- exact/deferred token binding、snapshot/root health、sample truthfulness、conflicts、broad match、preview fingerprint、1M resolver、no mutation。

### Apply/Repository/Execution

- create default disabled；
- update/catalog CAS；
- preview stale/deny reject；
- atomic proposal+rule；
- origin provenance、no auto run、no mutation、idempotency；
- backend ID/timestamp/source ownership；
- create/update/toggle/delete CAS；
- system/learned protection；
- legacy command denied；
- renderer Rule vector rejected；
- backend loads enabled rules；
- scanner/watcher/manual adapters；
- disabled/applied-only rules not executed。

### UI/security

- composer/disclosure/cancel/clarification/continue-later/remount；
- candidate edit/impact/apply-disabled/enable separate/run separate；
- conflict/keyboard/focus/ARIA/narrow/zoom/mock honesty；
- main-only/Search denied/no path/no SQL/shell/tool/MCP/no second queue/no Agent/no content/no journal schema/no files.id migration/schema exactly33/no Task08/no dependency change。

不得只做静态源码字符串测试来代替核心行为测试。

---

## 20. 允许与禁止范围

允许：Task06 handoff相关 Plan/UI/tests/docs、schema33、rules small-table revision、proposal repository、existing AI client adapter、canonical validator、impact preview、Repository V2、backend execution、Rules UI/store/API/mock、permissions、tests、performance、Closeout。

禁止：schema34、ALTER files、迁移 files.id、Global Index 重写、scan/watcher owner 重写、Managed AI schema/queue ownership修改、第二 AI queue、Agent/tool runtime、shell/MCP/browser automation、Content Artifact/OCR/正文读取、Rule AST V2/脚本语言、operation/cleanup journal schema 修改、Safe Trash/restore 弱化、自动 filesystem mutation、Task08、release/version/tag、dependency/lockfile。

依赖默认保持：

```text
package.json dependencies 不变
package-lock.json 不变
Cargo.toml dependencies 不变
Cargo.lock 不变
```

无法在现有依赖完成时停止并提交最小提案，不得自行增加。

---

## 21. 停止条件

以下任一情况立即停止并提交证据：

- 需要 schema34；
- 需要 ALTER files 或迁移 files.id；
- 需要 Rule AST V2；
- 需要读取/上传文件正文；
- 需要 Agent/OpenCode/Coworker runtime；
- 需要 shell/MCP/tool calling；
- 需要第二 AI queue；
- 需要修改 operation/cleanup journal schema；
- 无法阻止模型直接写 rule；
- 无法保证 Apply 默认 disabled；
- 无法让 execution 从 backend 加载 rules；
- 无法保证 exact/deferred impact truthfulness；
- 需要 dependency/lockfile；
- 已有并行 Task07 branch/PR；
- 需要开始 Task08。

不得自行拆分 07A/07B，不得改变任务书。

---

## 22. 实施分支、提交与 PR

实施分支：

```text
remediation/07-rule-proposal
```

建议原子提交：

1. `fix(plan): close accepted task06 review gaps`
2. `db: add schema33 rule proposal and catalog revisions`
3. `rules: canonicalize ast and add revision repository`
4. `ai: add bounded natural-language rule proposal adapter`
5. `rules: add truthful impact preview and fingerprint`
6. `rules: apply proposals as disabled rules`
7. `rules: make execution backend authoritative`
8. `ui: add proposal review workspace`
9. `api: align permissions and browser mock`
10. `test: cover rule proposal safety recovery and performance`
11. `docs: close task07 implementation`

这些不是独立任务或停止点。

唯一 Draft PR：

```text
feat: add natural-language rule proposals and approval
```

PR 必须保持 Draft，不自动合并。

---

## 23. 验证与 Closeout

运行：

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

GitHub CI 必须包含 Windows/macOS Rust+Clippy、frontend/typecheck、focused tests、migration/performance、audit、release compile、NSIS、unsigned DMG、permission/scope/license contracts。Package job 必须实际 success，不得以 skipped 冒充。

创建：

```text
docs/remediation/TASK_07_IMPLEMENTATION_CLOSEOUT.md
```

更新 Index、Master Plan、Risk Register、Capability Matrix、permission matrix 和 Task06 Closeout。

Closeout 必须记录 baseline/final HEAD、七项 handoff、参考 SHA/license/文件、schema33、proposal lifecycle、AST/literal grounding、provider privacy、permission、impact、Apply/default-disabled、Repository V2、backend execution、UI/accessibility、permissions/mock、tests/performance/package/security、dependencies、known risks、Task08 未开始。

---

## 24. 最终汇报格式

```text
Task 07 已作为完整自然语言规则产品模块完成并停止，等待人工代码级验收。

Baseline HEAD：
Final HEAD：
分支：remediation/07-rule-proposal
Draft PR：
Schema：32 → 33
Coworker reference SHA：2cf74d08f22078b8b1fd3f97bff3ec4612262613
OpenCode reference SHA：7565e03536d19e850f9996c407f9bf5e932b5f7a

Task 06 接受遗留：
1. Dry run/execution equivalence：
2. Managed root health：
3. needs_review approval：
4. Crash projection：
5. Retention union：
6. Plan summary：
7. Package evidence：

Rule Proposal：
- Schema/ledger：
- State machine：
- AI adapter：
- AST validation：
- Literal grounding：
- Permission classification：
- Impact preview：
- Human apply：
- Default disabled：
- Rule Repository V2：
- Backend execution authority：
- UI/store：
- Permissions/mock：
- Retention：

验证：
- Frontend：
- Remediation：
- Rust：
- Security：
- Migration：
- Query plans：
- 100k/1M impact：
- Rule execution regression：
- Windows/macOS：
- NSIS/DMG：
- Dependency audit：

提交列表：
Known risks：
工作树是否干净：
依赖或 lockfile 是否变化：
Task 08 是否开始：
PR 是否仍为 Draft：
PR 是否合并：
最终 GitHub CI run：

明确声明：
没有拆分 Task 07。
没有创建 Agent/OpenCode/Coworker runtime。
没有创建 tool/shell/MCP 权限系统。
没有创建第二套 AI queue。
没有读取或上传文件正文。
没有让模型直接写、启用或执行 rule。
没有让 renderer Rule list 成为 execution authority。
没有自动移动、重命名、删除文件。
没有修改 operation/cleanup journal schema。
没有迁移 files.id。
没有新增依赖或修改 lockfile。
没有开始 Task 08。
PR 保持 Draft且未合并。
等待人工代码级验收。
```
