# Task 07 Implementation Closeout — Natural-Language Rule Proposal and Approval

## 1. Final delivery state

- Baseline HEAD：`42dce2ea2dbdfdf9b0c5616364f090a9a5d89761`；
- Task 06 merge ancestor：`29e85c099c5ee921ad7d4237c780dc47126e0fa3`；
- Implementation branch：`remediation/07-rule-proposal`；
- Final branch HEAD：`bb6ab156690829b141fc72961afbcfe0e854805b`；
- PR：#42 `feat: add natural-language rule proposals and approval`；
- Schema：`32 → 33`；
- Human disposition：接受合并，六项代码审查问题转入 Task 08 第一组；
- Squash merge：`4e07de9c02198eb3352d9b2b1f289d61a3df128c`。

Task 07 已完成并合并。Task 08 只有在其人工任务书和治理文档进入 `master` 后才获得生产实施授权。

---

## 2. Task 06 accepted handoff closure

Task 07 第一组关闭了 Task 06 的七项接受遗留：

1. dry run 与 execution 统一 live authoritative proposal/target；
2. refresh/dry run/execution 全链重验 managed root health；
3. `needs_review` 建立显式 reviewed 路径；
4. crash finalize/recovery 共用 terminal projection；
5. retention 使用 age UNION count overflow、dedup、child-first、每批最多 20；
6. Plan summary 由后端全 ledger 聚合；
7. 本地 package、远端 success 与 skipped job 分开记录。

对应回归测试和 CI 证据均随 PR #42 合并。

---

## 3. Delivered Task 07 product module

### Schema 33 / durable ledger

- `rules.ast_version`；
- `rules.revision`；
- `rules.origin_proposal_id`；
- singleton `rule_catalog_state`；
- durable `rule_proposals` 与索引；
- additive migration、rollback、idempotence、future-schema guard；
- 未 ALTER `files`，未迁移 `files.id`，未修改 operation/cleanup journal schema。

### Rule Proposal lifecycle

实现：

```text
draft → generating → ready → applying → applied
```

并支持 clarification、invalid、failed、stale、cancelled、startup recovery、revision-owned generation、bounded cancellation 和 terminal retention。

### AI boundary

- 复用现有 provider client、credential、preset、timeout 与 JSON mode；
- 全局并发最多 2；
- 不写 `ai_jobs`，不建设第二 durable AI queue；
- 只发送用户 prompt、固定 schema 和 update target canonical AST；
- 不发送文件正文、文件列表、路径样本、operation logs、credentials、secrets、SQL、shell 或 tool definitions；
- raw provider response 不持久化。

### AST / validation / permission

- Rule AST V1 是唯一 candidate target；
- strict JSON envelope 与 unknown-field rejection；
- Rust canonicalization、deterministic IDs/fingerprint、capacity limits；
- literal grounding；
- allow/ask/deny 仅作为 proposal validation；
- Apply、Enable、Run 分离；
- 新建或更新正式规则默认 `enabled=false`。

### Impact / Apply / repository

- managed File Library metadata-only impact；
- exact/deferred count、bounded sample、opaque resolver token；
- preview fingerprint 绑定 proposal/rule/catalog/library/scope/policy；
- Apply 只接受 durable IDs、expected revisions、exact fingerprint 与 `confirmed=true`；
- proposal + user rule 单事务 CAS；
- Rule Repository V2 Create/Update/Toggle/Delete 分离；
- system/learned rules 受保护；
- legacy whole-object write 退出 production capability。

### Backend execution authority

- `execute_rules_for_scope_v2` 不接受 renderer Rule vector；
- scanner、watcher 和 Rules UI 迁移到后端加载 persisted rules；
- Rule execution 只更新 classification/suggestion metadata；
- 不移动、重命名、删除文件，不调用 operation/cleanup journal。

### UI / permissions / mock

- Describe / Manual 双入口；
- proposal history、clarification、AST、impact、conflict、Edit、Regenerate、Apply as Disabled；
- backend hydration、remount reload、latest-request-wins；
- no localStorage truth；
- 新命令 main-window-only，Search denied；
- browser mock 明确不代表真实 AI、native persistence、Rule execution 或 filesystem mutation。

---

## 4. Validation and package evidence

### Frontend / Rust / security

- Frontend：78 files、535 tests passed；
- remediation：13 tests passed；
- TypeScript、Rust full tests、`cargo fmt --check`、Clippy `-D warnings` passed；
- `npm audit`：0 vulnerabilities；
- RustSec：exit 0，15 条既有允许警告；
- dependencies 和 lockfiles 未变化。

### Migration / performance

- schema migration：100k 17.237 ms；1M 16.398 ms；size delta 0；
- impact：100k exact 50.143 ms；1M deferred 110.074 ms；1M exact 500.199 ms；
- query plan 使用 `idx_library_files_modified`；
- WAL reader 在 proposal writer 期间保持可读；
- disabled separation、enable CAS、SQLite loading、stale catalog rejection 回归通过。

### CI / package

- Final PR CI：`30621028065`，quality/compile/performance/audit success；该 PR run 的 package jobs 为 skipped；
- Full workflow dispatch：`30619441431`；Windows NSIS 与 macOS unsigned DMG jobs success；
- Local NSIS：`Zen Canvas_0.1.40_x64-setup.exe`，6,883,407 bytes；
- SHA-256：`B7F000CB19978796EF486DDD01563F0D20FD0FD04E7F82432B8DE70C6A4397F9`；
- CI package jobs 不上传 installer artifact，本地 package 与远端 runner 证据分开记录。

---

## 5. Human-accepted Task 07 → Task 08 handoff

人工代码审查发现并接受以下六项进入 Task 08 第一组：

1. **Effective catalog authority**：learned rule 与影响实际 ruleset 的 settings/policy 尚未完全进入 catalog revision；
2. **Execution TOCTOU**：manual execution 需冻结 catalog/settings/rules/scope/root/library 单一权威快照；
3. **Impact equivalence**：preview 需完整复用真实 classification engine 语义并建立 differential tests；
4. **Review UI completeness**：展示 before/after、risk、confirmation、scope health、permission、broad match 与 conflict completeness；
5. **Manual edit provenance**：手工编辑后旧 AI summary/provenance 必须失效或明确区分；
6. **Forbidden prompt gate**：后端确定性拒绝 delete/trash/tool/auto-run 等原始 prompt 意图，不依赖模型主动映射。

这些问题的 failure mode、强制方案和测试门禁已冻结在：

```text
docs/remediation/TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md
```

不得再次后移，也不得拆成独立 debt task。

---

## 6. Final explicit declarations

Task 07：

- 没有拆分；
- 没有创建 Agent/OpenCode/Coworker runtime；
- 没有创建 shell/tool/MCP permission system；
- 没有创建第二 AI queue；
- 没有读取或上传文件正文；
- 没有让模型直接写、启用或执行 Rule；
- 没有让 renderer Rule list 成为 execution authority；
- 没有自动移动、重命名或删除文件；
- 没有修改 operation/cleanup journal schema；
- 没有迁移 `files.id`；
- 没有新增依赖或修改 lockfile。

PR #42 已按人工决定 squash 合并。Task 08 生产代码尚未在本 Closeout 中开始。