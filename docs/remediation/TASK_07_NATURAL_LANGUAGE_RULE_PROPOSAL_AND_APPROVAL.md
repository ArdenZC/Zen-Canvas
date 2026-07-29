# Task 07 — Durable Natural-Language Rule Proposal、Validation 与 Human Approval

> 状态：任务书已由人工冻结；进入 `master` 后才可执行生产实施。  
> 产品模块：固定模块 7「自然语言规则」。  
> 前置合并：Task 06 / PR #40，squash merge `29e85c099c5ee921ad7d4237c780dc47126e0fa3`。  
> 数据库授权：schema `32 → 33`。  
> 实施方式：一个完整任务、一个实施分支、一个 Draft PR；不得拆成 07A/07B/07C，不得建立独立 Task 06 收尾任务。

---

## 1. 产品目标

Task 07 把现有「手工 Rule AST 编辑器 + renderer 提交整套规则执行」整改为一条可信、可继续、可解释的自然语言规则链：

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
- proposal 应用后规则默认禁用；
- 启用和重新应用规则必须是独立显式动作；
- 文件内容、OCR 和 Content Artifact 继续属于 Task 08；
- 不建设通用桌面 Agent、OpenCode runtime、shell、MCP、skills 或工具调用系统。

Task 07 完成后，用户能够用自然语言描述规则，例如：

- “把超过 500MB 的视频标记为 Archive”；
- “文件名以 screenshot 开头的图片归为 Personal，并建议移动到 Screenshots”；
- “30 天内修改过的代码文件保持 Active”；
- “重复文件只标记为 Review，不要移动”；

系统必须把请求转换成可见、可编辑、可验证的候选规则，而不是直接修改文件或静默启用规则。

---

## 2. 前置事实与现有代码结论

### 2.1 已存在且必须复用

现有代码已经具备：

- `rules` SQLite 表；
- Rust/TypeScript `Rule`、`RuleConditionGroup`、`RuleCondition`、`RuleAction`；
- `AND/OR` 分组；
- 字段、operator、enum、数值、日期和 template 校验；
- 手工 `AutomationRuleDialog`；
- Rule classification engine；
- classification version/fingerprint；
- File Library managed scope；
- AI provider/credential/configuration 基础；
- main-window capability 和 browser mock；
- Rules UI、Inspector、手动重新应用规则；
- Task 06 Organization Plan、preview、journal 和 restore 安全链。

现有 Rule AST V1 支持的条件字段固定为：

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

现有 action 字段固定为：

```text
purpose
lifecycle
context
risk_level
suggested_action
target_template
rename_template
```

Task 07 不扩展 Content/OCR 条件，不引入脚本表达式、正则执行器、SQL、JavaScript、shell 或任意函数调用。

### 2.2 现有关键缺口

当前实现存在以下产品与安全缺口：

1. `save_user_rule` 接受 renderer 提交的完整 Rule，包括 ID、source、timestamps，且没有 revision CAS；
2. `delete_user_rule` 与 enabled toggle 没有统一 catalog revision；
3. `execute_rules_for_scope`、`execute_rules_for_paths` 接受 renderer 传入的 `Vec<Rule>`；
4. Rules UI 当前运行状态是 renderer 内存态；
5. 没有 durable natural-language proposal；
6. 没有模型输出与正式 Rule AST 之间的隔离层；
7. 没有 proposal impact preview、冲突提示和 apply fingerprint；
8. 没有 clarification、stale、continue-later 和 restart contract；
9. 没有规则目录单调 revision；
10. 规则更改的并发覆盖与旧请求拒绝不足。

Task 07 必须关闭这些缺口，但不得把 Rules 改造成通用自动化语言或 Agent runtime。

---

## 3. Task 06 接受遗留：Task 07 第一组生产改动

PR #40 已按人工决定合并。以下 6 项实现问题和 1 项交付证据问题被接受并转入 Task 07 第一组，**不得再次后移**。完成后必须继续 Task 07 全部目标，不得停下做单独验收。

### 3.1 Dry run 与 execution 使用同一 live proposal

必须修复 Organization Plan 中“用户审核旧 target、执行器重新解析新 target”的差异：

- dry run 在可信后端重新生成 current authoritative preview/proposal；
- fingerprint 必须绑定 current classification、preview ID、operation kind、target、risk、edited target、collision 和 identity facts；
- execution 必须消费与 dry run 相同的 canonical live selection；
- classification、target、risk、preview、edited target 或 collision 任一变化必须 `organization_dry_run_expired`；
- edited filename collision 必须针对最终 edited target 计算；
- 禁止执行器在 dry run 之后静默采用另一 target。

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

必须建立明确的后端审核转换：

- `needs_review` 可以经用户 Accept/Edit 后成为“reviewed and executable”；
-转换前重新验证完整 live facts；
- low confidence、Sensitive、duplicate、requires-confirmation、跨卷、目录创建等必须保留明确风险；
- blocked、delete、trash、unsupported、protected path、collision 永远不能通过人工点击升级；
- UI、DTO 和测试必须区分 `ready`、`needs_review`、`reviewed`、`blocked`。

可通过 schema 32 现有字段和严格状态约定实现；不得为此推进 schema 34。

### 3.4 Crash recovery 正确投影 terminal 状态

- journal 全部完成且无 remaining accepted+ready items → `completed`；
-仍有可执行项或 failed/skipped → `partially_completed`；
- pending/manual_review/reconciliation → 保持执行/部分完成且不可自动重放；
- unknown mapping → stale/failed；
- finalize 与 startup recovery 使用同一 projection helper；
-增加 final journal persist 后、plan projection 前崩溃的故障注入测试。

### 3.5 Retention 使用 union contract

terminal plan prune candidate 必须是：

```text
超过 30 天
UNION
不在最新 100 个 terminal plans 内
```

要求：

-去重；
-child-first；
-每次最多 20；
-不删除 operation/cleanup logs；
-不删除 unresolved journal 引用；
-分别测试 age、count 和 overlap 三种情况。

### 3.6 Plan summary 必须 backend authoritative

Plan DTO 增加后端聚合：

- undecided；
- accepted；
- kept；
- edited；
- needsAnalysis；
- needsReview；
- ready；
- blocked；
- stale；
- executing；
- executed；
- failed；
- skipped；
- remainingExecutable。

Rules/Organize UI 不得从当前加载的 100 行推断完整计划数量或动作可用性。

### 3.7 CI/package 证据必须真实

Task 07 Closeout 必须修正 Task 06 的证据表述：

- CI `30454740982` 的 package jobs 为 skipped，不得写为成功；
-提供真实 NSIS 和 unsigned DMG 成功 run/job/artifact；
-若 Draft 条件导致 skipped，使用明确的 package workflow 或 Ready/人工触发；
-本地 package 与远端 package 分开记录；
-不得用 workflow 总体 success 掩盖 skipped job。

---

## 4. 参考项目与许可证边界

### 4.1 Coworker（原 Accomplish）

仓库当前名称：

```text
accomplish-ai/coworker
```

冻结分析 SHA：

```text
2cf74d08f22078b8b1fd3f97bff3ec4612262613
```

许可证：MIT。

实施前至少阅读：

```text
LICENSE
README.md
packages/agent-core/src/opencode/config-generator.ts
packages/agent-core/src/opencode/system-prompt-behaviors.ts
docs/qa-suites/permissions-filesystem-tests.md
```

只借鉴：

-任务先形成可见 plan/proposal；
-用户选择可访问范围；
-写入/移动等动作需要显式批准；
-被拒绝后停止而不是绕路；
-完成状态、失败状态和剩余工作明确；
-本地优先和用户拥有最终控制权。

### 4.2 OpenCode

仓库：

```text
anomalyco/opencode
```

冻结分析 SHA：

```text
7565e03536d19e850f9996c407f9bf5e932b5f7a
```

许可证：MIT。

实施前至少阅读：

```text
LICENSE
packages/opencode/src/permission/index.ts
packages/web/src/content/docs/permissions.mdx
packages/schema/src/permission.ts
packages/opencode/src/tool/task.ts
```

只借鉴：

- `allow / ask / deny` 的显式决策分类；
-默认 ask、明确 deny 不可被自动模式覆盖；
-一次批准与持久批准分离；
- rejection/correction 使当前请求停止并重新生成；
-权限评估与实际动作分离；
-最后匹配/更具体规则优先等可解释原则。

### 4.3 主动拒绝

严格禁止移植或建设：

- Coworker daemon；
- `opencode serve`、OpenCode SDK/runtime；
- shell/bash/edit/write/patch 工具；
- MCP、skills、subagents、browser automation；
-通用 tool permission registry；
- wildcard path execution permission；
- `auto` 自动批准模式；
- session 级 “always allow” 执行授权；
- Agent todo/task runtime；
- generic ask/allow/deny 数据库；
-模型直接调用 Rule、filesystem 或 operation API；
-复制 Coworker/OpenCode UI、DTO、daemon、event bus 或 session 结构。

Task 07 将这些原则翻译为 Zen Canvas 的 typed Rule Proposal，不建立 Agent。

---

## 5. Schema 33

Task 07 唯一授权 schema：

```text
32 → 33
```

不得推进 schema 34。

### 5.1 `rules` 小表 migration

新增：

```sql
ALTER TABLE rules
ADD COLUMN ast_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE rules
ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE rules
ADD COLUMN origin_proposal_id TEXT;
```

合同：

- `revision` 是 update/toggle/delete CAS；
- `ast_version=1` 对应当前固定 Rule AST；
- `origin_proposal_id` 只记录 provenance，不形成执行依赖；
- existing user/system/learned rules backfill revision 1；
-不修改现有 Rule AST JSON 的语义；
-不 ALTER `files`；
-不迁移 `files.id`。

### 5.2 `rule_catalog_state`

```sql
CREATE TABLE rule_catalog_state (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    updated_at INTEGER NOT NULL
);
```

初始化 revision 1。

所有正式 rule create/update/toggle/delete 必须在同一 transaction 中 bump catalog revision 一次。

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

- prompt 是用户主动输入，最大 4,000 Unicode code points；
-不保存文件正文、文件列表、raw provider response、reasoning、tool trace 或 secrets；
- candidate 只保存 backend canonical AST；
- provider/model 只用于 provenance；
- proposal revision 是 generate/edit/preview/apply/cancel/delete CAS；
- update proposal 必须绑定 target rule ID + base rule revision；
- applied proposal 不因 rule 后续更新而改变；
- proposal 不是 rule execution authority。

### 5.4 Migration 规则

-使用现有 `BEGIN IMMEDIATE` migration；
-任一失败完整 rollback，`user_version` 保持 32；
-全部成功后最后设置 33；
-current schema ensure idempotent；
-future schema reject；
-真实 schema32 fixture；
-100k/1M `files` fixture 证明不重写 files；
-WAL reader；
-rules revision backfill；
-plan/journal tables 不变；
-旧 binary future guard。

---

## 6. Proposal 状态机

### 6.1 创建 proposal

```text
draft
→ generating
→ ready
```

其他生成结果：

```text
generating → needs_clarification
generating → invalid
generating → failed
```

重试：

```text
needs_clarification/invalid/failed/stale
→ generating
→ ready/needs_clarification/invalid/failed
```

应用：

```text
ready
→ applying
→ applied
```

取消：

```text
draft/generating/ready/needs_clarification/invalid/stale/failed
→ cancelled
```

### 6.2 状态规则

- status 不得从 `applied/cancelled` 倒退；
-同一 proposal 只允许一个 active generation owner；
-生成过程中 app crash → `failed` + `rule_proposal_generation_interrupted`；
- applying 必须在单 transaction 中写 rule + proposal；不存在部分 applied；
- proposal candidate、target rule 或 catalog 变化 → stale；
- stale proposal 不能 apply；
- correction 必须生成新 proposal revision；
-不自动 retry provider；
-不自动 apply；
-不自动 enable rule。

---

## 7. Rule AST V1 目标合同

自然语言 proposal 只能生成当前 AST V1。

### 7.1 模型可提出

- rule display name；
- root operator `AND|OR`；
-最多 32 groups；
-每组最多 32 conditions；
-当前允许字段和 operators；
-当前 RuleAction 字段；
-用户明确表达的 purpose/lifecycle/risk/action/template；
-可解释 summary 和 clarification。

### 7.2 模型不得控制

- rule ID；
- source；
- enabled；
- revision；
- ast version；
- created/updated timestamps；
- proposal ID；
- catalog revision；
- file IDs/paths 列表；
- SQL；
- shell/script/function/tool；
-任意 operation execution；
- provider/credential；
- source scope；
- direct delete/trash。

### 7.3 Canonicalization

Backend 必须：

1. `deny_unknown_fields` parse；
2. normalize enum/operator casing；
3. normalize extension 和 size/date units；
4. sort/dedupe only where语义不变；
5. backend 生成 group/condition IDs；
6. server 生成 rule ID；
7.调用与手工 builder 相同的 canonical validator；
8.生成 deterministic candidate fingerprint；
9.输出 stable validation/error codes。

不得在 TypeScript 和 Rust 各自维护不同 AST 规则。

### 7.4 Literal grounding

所有 free-text 条件值、path/directory literal、target template 和 rename template 必须满足：

-直接出现在用户 prompt；或
-是 backend 认可的确定性规范化形式，例如 “PDF” → `pdf`、 “500 MB” → bytes；或
-来自固定 enum vocabulary。

模型虚构的目录、文件名模式、数字、天数或 target 必须进入 `needs_clarification`，不得静默接受。

---

## 8. AI generation 边界

### 8.1 不建设第二 AI queue

Rule proposal 是用户触发的短交互请求：

-复用现有 provider client、credential store、preset、timeout、JSON mode/schema 能力；
-不写入 Managed AI `ai_jobs`；
-不泛化 Managed AI worker；
-不建立 rule generation durable queue；
-可使用内存 generation cancellation owner；
-每个 proposal 最多一次 active generation；
-全局并发最多 2；
-超时/取消后 durable status=failed/cancelled；
-不自动 retry。

### 8.2 模型输入

只发送：

-用户 prompt；
-固定 AST V1 schema；
-固定 enum/operator vocabulary；
-当前 rule 的 canonical AST（仅 update proposal）；
-安全政策与输出约束。

禁止发送：

-文件正文；
-文件名/路径样本；
-File Library rows；
-用户标签列表，除非 Task 07 任务书另行明确，本任务不发送；
-operation logs；
-AI traces；
-其他 rules 的自由文本；
-secrets/API keys；
-任意工具定义。

### 8.3 输出

Provider 输出只允许严格 JSON candidate envelope：

```text
intent
candidate?
clarifications[]
explanation[]
literalGrounding[]
warnings[]
```

Raw response 只在现有诊断 ring buffer 中按既有脱敏规则短暂存在；不得保存到 `rule_proposals`。

### 8.4 无 AI 情况

-未配置 provider 时返回稳定 `rule_proposal_provider_unavailable`；
-UI 提供“打开手工规则编辑器”；
-不得伪造已生成 proposal；
-browser mock 只能返回明确的 deterministic fixture，并标记 mock；
-不建设未经批准的本地 NLP parser。

---

## 9. Permission classification

Task 07 借鉴 `allow/ask/deny`，但只作为 proposal validation 分类，不建立通用权限系统。

### 9.1 `deny`

以下 intent/candidate 必须 blocked/invalid：

-直接删除、永久删除、清空回收站；
-执行 shell/script/command；
-读取文件正文、OCR、内容语义条件；
-访问 unmanaged/global-only scope；
-任意 path mutation；
-unsupported field/operator/action；
-受保护系统目录 target；
-模型虚构 literal；
-绕过 Preview/Plan/journal/restore；
-试图自动启用或自动运行规则。

### 9.2 `ask`

以下 proposal 需要完整 impact preview 和额外确认：

- Move/Rename/MoveAndRename/Archive 建议；
-path/directory 条件；
-Sensitive/System/Caution risk；
-duplicate 条件；
-target parent 可能创建；
-匹配范围过宽；
-与现有 enabled rules 有明显冲突；
-update existing rule；
-规则 action 会产生 `requires_confirmation`。

### 9.3 `allow`

“allow”只表示 candidate 可进入普通人工批准，不表示自动 apply/enable/run。

通常包括：

-固定 enum 分类；
-安全 metadata-only 条件；
-无 mutation suggestion；
-窄范围、无冲突、无 protected target。

所有 proposal 仍必须人工 Apply，且生成的 rule 默认 disabled。

---

## 10. Proposal API

至少新增 versioned commands：

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

### 10.1 创建/重新生成

Request 只接受：

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

### 10.2 Replace candidate

用户可在现有手工 builder 中编辑 proposal candidate，但提交目标仍是 proposal：

```text
proposalId
expectedProposalRevision
candidateAstV1
```

Backend 重新 canonicalize/validate/fingerprint，status 回到 ready/invalid，旧 preview 失效。

### 10.3 Cancel/delete

- cancel generation 必须终止 active owner；
- delete 仅 terminal proposal，或先 cancel；
- expected revision + confirmed；
- applied proposal 默认保留 provenance；删除不得影响正式 rule；
-正在 applying 不允许删除。

---

## 11. Impact Preview

`preview_rule_proposal` 是本地 metadata-only 影响分析，不执行规则、不修改文件、不修改 classification。

### 11.1 请求

只接受：

```text
proposalId
expectedProposalRevision
scope: FileLibraryScopeV2
pageSize <= 20
```

### 11.2 返回

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

Sample 每项最多包含：

- managed file ID；
- name/display directory；
- current classification summary；
- candidate outcome；
- matched conditions；
- winning existing rule；
- conflict/warning；
-不含正文。

### 11.3 Truthfulness

-所有数据来自同一 SQLite read snapshot；
-scope 必须 healthy；
-missing/degraded root 或 invalid tag/reference fail closed；
-不从 renderer loaded rows 推断全库；
-样本明确标为 sample；
-不得把 bounded conflict sample 描述为完整；
-匹配总数只能 exact 或明确 deferred，不估算。

### 11.4 Deferred exact impact

当 active managed rows >250,000 且 predicate 含 text/path contains、多组 OR 或其他昂贵组合时：

-首屏样本可 `impactState=deferred`；
-不返回虚假 matchedCount；
-返回 opaque token；
-新增 `resolve_rule_proposal_exact_impact`；
-token 绑定 proposal revision、candidate fingerprint、catalog revision、library revision、scope；
-revision/health 变化返回 stale；
-Apply 必须拥有 exact impact；
-不建设 durable count job。

### 11.5 Preview fingerprint

必须绑定：

- proposal ID/revision；
- candidate fingerprint；
- target rule/base revision；
- rule catalog revision；
- File Library revision；
- scope + root health；
- exact impact count；
- permission class；
- candidate AST；
-当前 validation policy version。

---

## 12. Human Apply

新增：

```text
apply_rule_proposal
```

Request 只接受：

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
3.重新 canonicalize candidate；
4.重新验证 target rule revision；
5.重新验证 catalog/library/scope health；
6.重新计算 exact impact 和 preview fingerprint；
7.拒绝 deny/invalid/stale/deferred；
8.单 transaction create/update user rule；
9.新 rule ID 由 backend 生成；
10.新 rule `enabled=false`；
11. rule revision 1 或 update +1；
12. catalog revision +1；
13. proposal → applied；
14.保存 origin proposal ID；
15.返回 rule + catalog revision。

Apply 不得：

-执行规则；
-修改 files；
-创建 Organization Plan；
-移动/重命名/删除文件；
-自动启用；
-调用 operation journal；
-调用 Managed AI queue。

---

## 13. Rule Repository V2

Task 07 必须把正式 user-rule CRUD 改为 revision/CAS contract。

至少新增：

```text
list_user_rules_v2
create_user_rule_v2
update_user_rule_v2
set_user_rule_enabled_v2
delete_user_rule_v2
get_rule_catalog_state
```

### 13.1 Create

Renderer 只提交 AST draft + expected catalog revision；不得提交：

- ID；
- source；
- timestamps；
- revision；
- origin proposal ID。

Backend 生成这些字段；新 rule 默认 disabled。

### 13.2 Update

必须同时校验：

- expected rule revision；
- expected catalog revision；
- AST V1 canonical validation。

### 13.3 Toggle

`enabled` 使用独立 command；旧 rule object 不得 whole-object overwrite。

### 13.4 Delete

- expected rule revision；
- expected catalog revision；
- confirmed；
-只允许 source=user；
-不删除 proposal provenance；
-catalog revision bump。

### 13.5 Compatibility

-前端生产路径迁移到 V2；
-旧 `save_user_rule/delete_user_rule` 不得继续在 capability allow-list 中成为 write authority；
-确需保留 compatibility 时只能 internal/test/fallback，并明确不可由 Search window 调用；
-不得维持永久双轨。

---

## 14. Backend-authoritative Rule Execution

现有生产入口接受 renderer `Vec<Rule>`，Task 07 必须关闭该边界。

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

-从 SQLite 加载 enabled user rules；
-按 settings 决定 system/learned rules；
- canonical validate；
-计算 ruleset/classification version；
-执行 existing classification engine；
-返回实际 catalog revision 和 version；
-旧 catalog revision fail closed；
-不得接受 renderer Rule list。

所有生产调用点必须迁移：

- RulesView 手动运行；
- scanner 后分类；
- watcher/reconciliation 后规则应用；
-任何 path/file ID rule execution adapter；
-browser mock。

Task 07 不建立新的 durable Rule Job Runtime；现有 batch/classification ownership保持。若发现现有执行无法满足 crash/partial 语义，必须登记到 Task 08 后而不是泛化 `ai_jobs`，除非构成数据安全阻断。

---

## 15. Organization Plan 与 Rule 的边界

- Rule 只修改 classification/suggestion metadata；
- Rule 不直接执行 move/rename/delete；
- Rule action 产生的 suggestion 仍需 Organization Plan review/dry run/journal；
-自然语言 “移动所有…” 只能生成规则 proposal，不移动文件；
-自然语言 “删除…” 必须 deny 或转换为 clarification/Review，不能执行；
- proposal preview 不是 Organization Plan dry run；
- applied rule 不是 filesystem permission；
- Task 06 七项遗留必须在 Task 07 第一组修复，但 Rule proposal 不得与 Plan ledger 混表。

---

## 16. UI / UX

Rules workspace 改造成双入口：

```text
Describe a rule
Manual rule builder
```

### 16.1 Natural-language composer

必须提供：

-单一简洁输入；
-provider/model disclosure；
-明确“只发送你输入的文字，不发送文件内容”；
-示例 prompts；
-generate/cancel；
-provider unavailable state；
-no-AI manual builder fallback。

### 16.2 Proposal workspace

必须提供：

- proposal list/status/updated；
- Continue Later；
- prompt；
- clarification questions；
- candidate human summary；
- AST inspector；
- permission class；
-validation warnings/errors；
- impact count exact/deferred；
-sample before/after；
-conflict labels；
- Edit Candidate；
- Regenerate；
- Apply as Disabled Rule；
- Cancel/Delete。

### 16.3 Apply/enable separation

Apply 成功后：

-显示“Rule saved, currently disabled”；
-提供跳转到 rule inspector；
-Enable 是另一个明确按钮和 CAS 请求；
-Run on current scope 又是独立 confirmation；
-不得在单一按钮中 apply + enable + run。

### 16.4 Manual builder

-改用 Rule Repository V2；
-新建默认 disabled；
-stale conflict 明确显示；
-编辑 proposal candidate 时保存回 proposal，不直接创建正式 rule；
-所有字段和 validation 与 Rust 一致。

### 16.5 Accessibility

- keyboard-first；
- proposal list virtual/keyset（超过阈值时）；
- focus restore；
- dialog trap；
- 200% zoom；
-narrow layout；
-CJK/RTL；
-reduced motion/high contrast；
- `aria-live` 宣读 generation、validation、impact 和 apply；
-不把 model explanation 当唯一错误信息；
-stable error code 转本地化文案。

不得复制 Coworker/OpenCode UI。

---

## 17. Store / State

至少分离：

1. Rule catalog state；
2. Rule CRUD mutation state；
3. Proposal list/detail；
4. Generation/cancel state；
5. Candidate edit state；
6. Impact preview/exact resolver；
7. Apply state；
8. Rule execution state。

要求：

- backend hydrate；
- latest-request-wins；
- proposal/rule/catalog revision conflict；
-stale 时保留当前画面；
-不使用 localStorage 作为 proposal/rule truth；
-不从 loaded page 推断 totals；
-关闭/重开应用可继续 proposal；
-生成 response 迟到不得覆盖新 revision。

---

## 18. Permissions 与 Browser Mock

所有新增 command：

- main window only；
- Search window denied；
-无 arbitrary path；
-无 generic invoke/SQL/shell/script；
-write 使用 expected revision；
-stable error code；
-build.rs、capabilities、main/lib、permission matrix 同步。

Browser mock：

-可在内存中模拟 proposal lifecycle 和 manual review；
-生成结果必须是固定 fixture，并标记 mock；
-不得声称调用真实 AI；
-不得声称 native persistence；
-不得声称执行真实 rules/filesystem；
-不得伪造 package/credential/provider 成功。

---

## 19. Retention

Rule proposals：

- draft/ready/needs_clarification/stale 不自动删除；
- applied/cancelled/invalid/failed 默认 30 天；
-最多自动保留 100 个 terminal proposals；
-候选为 age UNION count overflow；
-单次 prune 20；
-不删除正式 rule；
-不删除 AI trace；
-正在 generating/applying 不删除；
-显式删除要求 expected revision + confirmed。

正式 rules 不自动 prune。

---

## 20. 性能与容量

### 20.1 容量

- prompt ≤4,000 code points；
- proposal clarification ≤8；
- proposal warnings ≤32；
- candidate ≤32 groups × 32 conditions；
- sample ≤20；
- proposal list page ≤100；
- user rules 测试覆盖 1/100/500/1,000；
- terminal proposal prune ≤20。

### 20.2 性能目标

不含外部 provider latency：

- canonical parse/validation p95 ≤25ms；
- proposal create/finalize DB p95 ≤50ms；
- list 1,000 rules p95 ≤50ms；
- list 1,000 proposals first page p95 ≤50ms；
- 100k simple impact first page p95 ≤150ms；
- 1M deferred impact first page p95 ≤200ms；
- 1M exact impact 单独记录，p95 ≤2s；
- apply transaction p95 ≤100ms；
- rule toggle/update/delete p95 ≤50ms；
-现有 100k rule execution 不得回退超过 10%；
-schema32→33 migration 不扫描/重写 files。

必须有：

- cold/warm；
- EXPLAIN QUERY PLAN；
-WAL reader；
-scanner/watcher/AI/plan/journal concurrent writer；
-cancel/latest-wins；
-memory bounds。

---

## 21. 必须新增的测试

### 21.1 Task 06 handoff

覆盖第 3 节全部 7 项：

- dry run/execution target equivalence；
-live classification/target/risk change；
-edited target collision；
-root disable/degrade/reconciliation；
-needs-review manual transition matrix；
-crash final projection completed；
-retention age/count union；
-plan summary across pages；
-package evidence contract。

### 21.2 Migration/schema

- schema32→33 real fixture；
- rollback；
-future guard；
-rules revision backfill；
-rule catalog init；
-proposal table empty；
-100k/1M files untouched；
-WAL reader；
-size delta。

### 21.3 Proposal lifecycle

- create/generate/clarify/regenerate/cancel/apply；
-single generation owner；
-crash generating recovery；
-terminal no regression；
-revision CAS；
-late response rejection；
-update proposal base rule stale；
-retention。

### 21.4 AI boundary

- strict schema；
-unknown fields；
-malformed JSON；
-tool-call output rejection；
-prompt injection cannot create tool/path action；
-no file/content input；
-no raw response persistence；
-provider unavailable；
-timeout/cancel；
-max prompt；
-literal grounding；
-delete/content/script intent denied。

### 21.5 AST validation

-每个 field/operator/value；
-AND/OR；
-size/date units；
-extension normalization；
-template safety；
-protected target；
-max groups/conditions；
-deterministic IDs/fingerprint；
-TS/Rust DTO parity；
-manual builder 和 proposal 共用 validator。

### 21.6 Impact preview

- exact/deferred；
-token binding；
-snapshot stale；
-root health；
-sample truthfulness；
-before/after；
-conflict bounded labeling；
-broad match；
-preview fingerprint；
-1M exact resolver；
-no mutation。

### 21.7 Apply

- create default disabled；
-update existing CAS；
-catalog CAS；
-preview stale reject；
-deny candidate reject；
-atomic rule+proposal transaction；
-origin proposal provenance；
-no auto run；
-no file mutation；
-idempotent duplicate request behavior。

### 21.8 Rule Repository V2

- backend ID/timestamp/source ownership；
-create/update/toggle/delete CAS；
-catalog bump once；
-old Rule object cannot overwrite；
-source system/learned protected；
-legacy command removed/denied；
-1,000 rules list。

### 21.9 Execution authority

- renderer Rule vector ignored/not accepted；
-backend loads enabled rules；
-old catalog rejected；
-manual scope run；
-scanner/watcher adapters；
-disabled rule not executed；
-proposal apply not executed；
-classification version stable。

### 21.10 UI/accessibility

- composer；
-provider disclosure；
-cancel；
-clarification；
-continue later/remount；
-candidate edit；
-impact exact/deferred；
-apply disabled rule；
-enable separate；
-run separate；
-revision conflict；
-keyboard/focus/ARIA；
-narrow/zoom；
-browser mock honesty。

### 21.11 Security/contracts

- main-only；
-Search window denied；
-no arbitrary path；
-no SQL/shell/script/tool/MCP；
-no second AI queue；
-no Agent runtime；
-no content read；
-no operation/cleanup journal schema change；
-no files.id migration；
-schema exactly 33；
-Coworker/OpenCode MIT reference inventory；
-no Task 08 implementation；
-no dependency/lockfile change。

---

## 22. 允许修改范围

允许：

- Task 06 handoff相关 Organization Plan/UI/tests/docs；
-schema33 migration；
-rules small-table revision/AST/provenance；
-rule proposal repository；
-dedicated provider adapter using existing AI client；
-rule canonical validator；
-impact preview/compiler；
-Rule Repository V2；
-backend-authoritative rule execution；
-Rules UI/store/API/mock；
-capabilities/security docs；
-tests/performance/Closeout。

禁止：

- schema34；
- ALTER `files`；
-迁移 `files.id`；
-Global Index 重写；
-scan/watcher ownership 重写；
-Managed AI schema/queue/provider ownership修改；
-第二 AI queue；
-Agent/task/tool runtime；
-shell/MCP/browser automation；
-Content Artifact/OCR/正文读取；
-Rule AST V2 或脚本规则语言；
-operation/cleanup journal schema 修改；
-Safe Trash/restore 弱化；
-自动移动/重命名/删除；
-Task 08；
-release/version/tag；
-dependency/lockfile。

---

## 23. 依赖合同

默认保持：

```text
package.json dependencies 不变
package-lock.json 不变
Cargo.toml dependencies 不变
Cargo.lock 不变
```

现有 serde/serde_json、BLAKE3/SHA、rusqlite、UUID、React、Zustand、Tauri 和 AI provider client 足够。

若确实无法在现有依赖完成，停止并提交最小依赖提案；不得自行增加。

---

## 24. 停止条件

以下任一情况立即停止并提交证据：

-需要 schema34；
-需要 ALTER files 或迁移 files.id；
-需要 Rule AST V2；
-需要读取/上传文件正文；
-需要 Agent/OpenCode/Coworker runtime；
-需要 shell/MCP/tool calling；
-需要第二 AI queue；
-需要修改 operation/cleanup journal schema；
-无法保证模型输出不能直接写 rule；
-无法保证 proposal apply 默认 disabled；
-无法让 execution 从 backend 加载 rules；
-无法保证 exact/deferred impact truthfulness；
-需要 dependency/lockfile；
-已有并行 Task 07 branch/PR；
-需要开始 Task 08。

停止时不得自行拆分 07A/07B，不得改变任务书。

---

## 25. 实施分支与建议提交

实施分支固定：

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

---

## 26. 验证与 CI

完成后运行：

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

GitHub CI 必须包含：

- Windows/macOS Rust tests + Clippy；
- frontend/typecheck；
- Task06/07 focused tests；
- migration/performance；
- dependency audit；
- release compile；
- NSIS；
- unsigned DMG；
- permission/scope/architecture/license contracts。

Package job 必须实际 success，不得以 skipped 冒充。

---

## 27. Closeout

创建：

```text
docs/remediation/TASK_07_IMPLEMENTATION_CLOSEOUT.md
```

更新：

```text
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
docs/remediation/REMEDIATION_MASTER_PLAN_V1.md
docs/remediation/REMEDIATION_RISK_REGISTER.md
docs/remediation/REMEDIATION_CAPABILITY_MATRIX.md
docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md
docs/remediation/TASK_06_IMPLEMENTATION_CLOSEOUT.md
```

Closeout 必须记录：

1. baseline/final HEAD；
2. Task06 七项 handoff 修复映射；
3. Coworker/OpenCode SHA、license、阅读文件；
4.借鉴与拒绝；
5.schema32→33 migration/rollback；
6.rule proposal schema/status/revision；
7.AST canonicalization/literal grounding；
8.provider input/output/privacy；
9.permission classification；
10.impact exact/deferred/fingerprint；
11.apply transaction/default disabled；
12.Rule Repository V2/CAS；
13.backend-authoritative execution；
14.UI/store/accessibility；
15.permissions/mock；
16.tests/query plans/performance；
17.Windows/macOS/package/security；
18.dependencies/lockfiles；
19.known risks；
20.Task08 未开始。

---

## 28. Draft PR

唯一 Draft PR 标题：

```text
feat: add natural-language rule proposals and approval
```

PR 必须说明：

-完整 Task07；
-Task06 七项遗留已关闭；
-schema32→33；
-durable Rule Proposal；
-existing Rule AST V1 only；
-strict validation/literal grounding；
-impact preview exact/deferred；
-human apply；
-rule default disabled；
-enable/run separate；
-backend loads rules；
-no Agent/OpenCode runtime；
-no tool/shell/MCP；
-no second AI queue；
-no content read；
-no filesystem mutation；
-no dependency/lockfile；
-no Task08；
-tests/performance/package evidence。

PR 保持 Draft，不自动合并。

---

## 29. 最终汇报格式

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
