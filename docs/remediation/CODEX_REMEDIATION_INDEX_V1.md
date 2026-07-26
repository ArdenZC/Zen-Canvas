# Zen Canvas Codex Remediation Index V1

## 1. 执行状态

Task 00 已完成并合并，且已经人工验收。当前只允许进行 Task 01A 的任务书人工验收；Task 01A 任务书本身仍禁止执行，Task 01B 和所有后续阶段继续禁止执行。

Task 01 已按领域拆分为 File Library Scan Generation Foundation（01A）和 Watcher Reconciliation Ownership（01B）。01A 未验收前不得开始 01B；不得把 01A 任务书状态理解为生产实施授权。

| 阶段 | 任务书 | 目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 合并后代码、数据和安全边界审计 | **已验收并合并** |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | File Library Scan 的 root lease、run/generation ownership、scan_seen/stale safety、恢复、durable revision 和多根 session 规格 | **待人工验收，禁止执行** |
| 01B | 待创建 | Watcher Reconciliation Ownership、overflow replay 和 durable watcher owner | **等待 Task 01A，禁止执行** |
| 02 | 待创建 | 原生身份、fingerprint、prehash 与 duplicate group/finding | **后续阶段，禁止执行** |
| 03 | 待创建 | Analysis Run、Finding 与 detector | **后续阶段，禁止执行** |
| 04 | 待创建 | File Query V2、snapshot、cursor 与跨页 selection | **后续阶段，禁止执行** |
| 05 | 待创建 | Organization Plan 后端领域模型 | **后续阶段，禁止执行** |
| 06 | 待创建 | 整理工作区迁移到持久化 Plan | **后续阶段，禁止执行** |
| 07 | 待创建 | 文件库标签、Saved Views、Inspector 分层 | **后续阶段，禁止执行** |
| 08 | 待创建 | Content Artifact 与受控 Extractor | **后续阶段，禁止执行** |
| 09 | 待创建 | 自然语言 Proposal 到受约束 Rule AST | **后续阶段，禁止执行** |
| 10 | 待创建 | Spotlight Provider 与 Command Manifest | **后续阶段，禁止执行** |
| 11 | 待创建 | 数据迁移、10万/100万性能与跨平台整合验收 | **后续阶段，禁止执行** |

---

## 2. Task 00 的输入

必须基于：

- `master` 的实际最新提交；
- PR #15 合并提交锚点 `a2c0516dc7a8628cb7210003da3d66f5d84f3a2f`；
- 当前仓库根开发说明；
- 当前 schema、migration、Rust、Tauri、React、Zustand、测试和 CI；
- 不得把 PR #15 合并前的分析当作当前事实。

---

## 3. Task 00 的输出

Codex 应新增：

```text
docs/remediation/POST_MERGE_BASELINE_AUDIT.md
docs/remediation/REMEDIATION_CAPABILITY_MATRIX.md
docs/remediation/REMEDIATION_RISK_REGISTER.md
```

并在有充分源码证据时更新本索引：

- 修正后续阶段顺序；
- 合并重复阶段；
- 拆分过大阶段；
- 标注前置依赖；
- 标注不应建设的能力；
- 但不得创建 Task 01 的实施代码。

Task 00 完成并人工验收后，本索引的下一状态应是：

```text
Task 00：已验收并合并
Task 01A：待人工验收，禁止执行
Task 01B：等待 Task 01A，禁止执行
Task 02+：后续阶段，禁止执行
```

只有人工审核明确通过 Task 01A 后，才可另行授权 01A 实施；只有 01A 实施完成并人工验收后，才可创建并授权 Task 01B。

---

## 4. 每阶段统一门禁

### 开始前

```bash
git status --short
git rev-parse HEAD
git merge-base --is-ancestor a2c0516dc7a8628cb7210003da3d66f5d84f3a2f HEAD
npm run typecheck
npm test
```

根据任务影响范围，再运行：

```bash
npm run test:remediation
npm run test:performance
npm run build
npm run verify:rust
npm run security:audit
npm run security:audit:rust
```

若环境不支持某一平台专用验证：

- 不伪造通过结果；
- 记录平台、命令和错误；
- 不通过修改生产代码规避环境问题；
- 继续执行不依赖该命令的只读调查；
- 在 PR 中保留 CI 作为最终权威门禁。

### 实施中

- 只修改当前任务书允许的路径；
- 先写/更新测试，再完成实现；
- 不把临时兼容层变成永久双轨；
- 不在前端重复 Rust 已有安全解析；
- 不绕过 current managed scope、AI queue、global index 或 operation journal；
- 不跨阶段修改后续模块。

### 完成后

最低执行：

```bash
npm run typecheck
npm test
npm run test:remediation
npm run build
npm run verify:rust
git diff --check
git status --short
```

性能、原生、安全或数据库阶段还必须执行对应专项门禁。

---

## 5. 标准交付

每阶段：

1. 创建 `remediation/<stage>-<name>` 分支；
2. 只完成当前任务；
3. 创建独立提交；
4. 推送分支；
5. 创建 Draft PR；
6. PR 描述引用当前任务书；
7. 汇报测试和风险；
8. 停止等待人工验收。

不得自动合并，不得自动开始下一阶段。

---

## 6. Task 01A 冻结决策

以下决策已根据 Task 00 审计和 Task 01A 任务书冻结，未获人工重新批准不得反向扩大范围：

1. 不建立跨领域 generic Job Runtime；不把 `ai_jobs` 改成通用 job 表。`ai_jobs`、`ai_job_items`、`ai_analysis_state` 继续只服务 Managed AI。
2. Task 01A 只负责 File Library Managed Scan 的 run/generation/stale/recovery/session foundation，不重建 Global Index，不触碰 `global_volumes`、`global_entries` 或平台 provider。
3. Task 01A 不持久化 raw watcher event，不创建 `pending_fs_changes`，不抢占 Task 01B 的 watcher reconciliation owner。
4. File Library Scan 和 Global Index 是两个独立 domain；Global provider 的 native cursor/journal checkpoint 不是 File Library generation。
5. Query V2 必须先于 Organization Plan；在 query/scope/snapshot/selection 语义未稳定前，不得实施 Organization Plan。
6. files 的 path id、Global Index native id、operation identity 和 AI fingerprint 继续隔离；Task 01A 不迁移 `files.id`。
7. 同一 scan root 的 active 集合只包含 queued/running/cancelling，必须由数据库 partial unique index 加 root active_run_id/active_generation/lease_token/revision CAS 共同保护；重复 start 不得分配第二个 generation。
8. metadata error 若不能形成成功 metadata fact，必须记录 scan_run_errors、标记 coverage-breaking、禁止 stale；scan_seen 只保留成功 fact，并按 7/30 日 cutoff 加每 root newest-two 的 retention/prune 规则清理。
9. 每个 multi-root session 必须持久化 requested_index 到 effective_root/run 的映射，包括 duplicate、nested、invalid 和 cancelled_not_started；session terminal priority 与 dedupe dispatch_key/effect ledger 是实现前置条件。
10. schema 27 commit 前的 migration rollback 与 commit 后的 code rollback 分开；schema 27 只能由 schema-27-capable build 关闭 feature gate 回退，旧 schema-26 binary 必须继续 future-schema rejection。
11. scan run/session 的 durable revision 是事件水位；renderer restart 先 hydrate durable state，按 revision、generation、run/session identity 拒绝旧、重复和越代事件。事件不得升级为 raw watcher persistence。

未完成 01A 任务书人工验收前，不得实施 Task 01A；未完成 01A 实施验收前，不得开始 Task 01B。

---

## 7. Task 00 审计产物和证据入口

Task 00 的独立产物为：

- `POST_MERGE_BASELINE_AUDIT.md`：基线、运行时/数据库关系、各域调用链、PR #15 影响、人工决策点和暂定实施顺序；
- `REMEDIATION_CAPABILITY_MATRIX.md`：按任务书五种状态盘点当前能力，标记可复用、可扩展、冲突和不应建设的能力；
- `REMEDIATION_RISK_REGISTER.md`：Critical/High/Medium 风险、源码证据、阻断条件、测试和 rollback 要求。

审计确认的硬边界：

1. Global Index 继续复用 `global_volumes/global_entries/global_entries_fts`，不建设第二套全局索引。
2. Managed AI 继续复用 `managed_scopes/managed_entries/ai_jobs/ai_job_items/ai_analysis_state`，不把 `ai_jobs` 直接改造成通用 Job Runtime。
3. 整理、清理、恢复继续经过 server-authoritative preview、filesystem identity、operation/cleanup journal、Safe Trash 和 restore；AI 只能写建议/分析。
4. `files` 的 path id、Global Index 的 native id、operation identity 和 AI fingerprint 暂不合并，任何迁移前必须有 mapping、冲突、回滚和旧账本兼容方案。
5. Content Artifact、Organization Plan、Analysis Run/Findings、NL Rule Proposal、Search Provider/Command Manifest 均未达到可执行状态。

---

## 8. 审计后阶段契约（全部不可执行）

| 阶段 | 必须先回答 | 明确不做 | 可能涉及的数据变化 | 专项验证/回滚 |
|---|---|---|---|---|
| 01A File Library Scan | scan root/run/session owner、generation、scan_seen、stale invariant、crash recovery | 不重建 Global Index，不统一所有队列，不持久化 raw watcher event，不修改 ai_jobs/files.id | 任务书先冻结；实现时才可新增 scan domain tables/fixtures | kill/restart、cancel、stale safety、nested roots、multi-root、migration rollback |
| 01B Watcher Reconciliation | overflow、durable watcher owner、replay、renderer 脱离后的最终一致性 | 不在 01A 前实施，不让 watcher 伪造 scanner generation | 必须等待 01A 实施验收 | overflow、event replay、rename/delete、renderer restart、跨平台 watcher |
| 02 Identity/Dedupe | path/native/operation/AI identity 关系、hardlink 语义 | 不直接改 `files.id`，不自动清理 | mapping/backfill/冲突方案 | rename/cross-volume/hardlink/changed file；可回退旧字段 |
| 03 Analysis | run/finding identity、版本、stale、decision | 不把内存 cleanup/dedupe 结果冒充 artifact | run/finding 草案 | cancel/partial/re-run/idempotency；旧分析继续可用 |
| 04 Query V2 | source/scope/snapshot/sort/cursor/selection | 不把 Global Search join 到 Library，不扩大 renderer selection | cursor/snapshot/selection contract | concurrent scan/watcher、cross-page selection；Query V1 fallback |
| 05 Organization Plan | plan revision、preview reference、identity expiry | 不直接执行 filesystem mutation | plan/decision/revision 草案 | diff/expiry/confirm/restore；废弃 plan 可安全回退 |
| 06 Workspace migration | Query/Plan 已有稳定契约 | 不绕过 operation journal/Safe Trash | 旧 preview 到 plan 的映射 | old/new path、stale plan、restore；保留旧入口 fallback |
| 07 Library surface | Query/Plan 的稳定 selection semantics | 不把 UI sorting 当后端事实 | Saved View/tag 草案 | large list/virtual list/accessibility；只读 UI 可回退 |
| 08 Content Artifact | 文件类型、大小、脱敏、local/cloud、retention | 不默认读内容，不绕过 Managed Scope | artifact metadata/version 草案 | privacy/provider/expiry/rebuild；可禁用 artifact consumer |
| 09 NL Rule | AST、validation、approval、version、rollback | 不直接写 rule 或执行 move | proposal/diff/approval 草案 | invalid/malicious output；proposal 单独丢弃 |
| 10 Spotlight | source/provider/capability/permission/ranking | 不把 command 当 mutation authorization | manifest 草案 | unavailable/source attribution；旧 registry 保留 |
| 11 Integration | 所有前置人工验收 | 不夹带业务修复 | migrations/release only after approval | full CI、性能、native/security、rollback drill |

只有人工确认每阶段的前置条件、非目标、数据迁移和 rollback 后，才可创建或实施对应 `TASK_0N_*.md`；Task 01A 任务书已经创建但仍不可执行，01B 任务书和代码必须等待 01A。
