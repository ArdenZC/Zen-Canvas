# Zen Canvas Codex Remediation Index V1

## 1. 当前执行状态

Task 00 已完成人工验收并通过 PR #16 合并。

Task 01A 已完成生产实施、人工验收并合并到 `master`。

Task 01B 已完成生产实施，并通过 PR #23 合并到 `master`。PR #23 合并提交为：

```text
1bc9ead144601892feb13feaf53a6a6137df3904
```

Task 01B 合并时保留一项明确技术债：未恢复的 watcher rule failure 仍依赖最近错误字段，后续正常 watcher batch 可能清除该诊断。该问题已成为 Task 02A 的第一项强制实施内容，不得再次延后。

PR #21 因越过 Task 01B 提前进入 dedupe/schema 28，已关闭且未合并；其分支仅作历史参考，不是当前基线，也不得直接 cherry-pick。

| 阶段 | 任务书 | 目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 合并后架构、安全和数据基线审计 | **已验收并合并** |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | File Library Scan root lease、session/run/generation、scan_seen、stale safety、恢复和 durable revision | **已验收并合并** |
| 01B | `TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md` | Rust watcher owner、durable revision gap、overflow/startup reconciliation、renderer 脱离 | **有条件验收并合并；遗留项进入 02A** |
| 02A | `TASK_02A_WATCHER_RULE_RECOVERY_AND_DURABLE_DEDUPE_RUNS.md` | 独立 watcher rule recovery fact、schema 29、durable dedupe run/queue/cancel/recovery | **任务书已创建，待文档 PR 合并，禁止执行** |
| 02B | 待创建 | physical identity、fingerprint、prehash、hard-link 排除和 hash pipeline | **等待 02A，禁止执行** |
| 02C | 待创建 | duplicate groups、group members、reclaimable bytes 和正式结果 API | **等待 02B，禁止执行** |
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

## 2. 唯一执行授权与文档优先级

每阶段开始前依次读取：

1. 根目录当前开发说明；
2. `docs/remediation/README.md`；
3. `REMEDIATION_MASTER_PLAN_V1.md`；
4. 本索引；
5. 当前人工编写并批准的阶段任务书；
6. 已合并 closeout、测试和实际源码；
7. 涉及 UI 时读取当前 `docs/design/`。

生产实施必须同时满足：

```text
本索引标记阶段可执行
+ 阶段存在人工批准的 TASK_*.md
+ 任务书已合并到 master
```

`BRIEF.md`、`00-overview.md`、`01-dedupe.md` 等调研/对标文档没有执行授权，不得改变本索引的阶段顺序、schema 分配或前置关系。

安全边界、当前源码和测试事实高于旧文档。发现冲突时停止，不自行扩大范围。

任务书和架构设计由人工直接编写。Codex 只执行代码、测试、提交和汇报，不再负责设计或修订阶段任务书。

---

## 3. 每阶段统一门禁

### 开始前

```bash
git status --short
git rev-parse HEAD
git merge-base --is-ancestor a2c0516dc7a8628cb7210003da3d66f5d84f3a2f HEAD
npm run typecheck
npm test
```

按影响范围再运行：

```bash
npm run test:remediation
npm run test:performance
npm run build
npm run verify:rust
npm run security:audit
npm run security:audit:rust
```

环境不支持某项验证时，记录事实并保留 CI 作为权威门禁，不得通过修改生产代码或放宽测试规避。

### 实施中

- 只修改任务书允许路径；
-先写或同步更新测试；
-不把兼容层变成永久双轨；
-不在 renderer 重复 Rust 的安全解析；
-不绕过 Managed Scope、Global Index、AI queue、preview、journal 和 restore；
-不跨阶段顺手重构；
-不得提前占用后续阶段 schema；
-已关闭或未合并 PR 的代码不得直接恢复，必须以当前 master 重新评估。

### 完成后

```bash
npm run typecheck
npm test
npm run test:remediation
npm run build
npm run verify:rust
git diff --check
git status --short
```

数据库、性能、原生和安全阶段还必须运行对应专项门禁。

---

## 4. 标准交付

每阶段：

1. 独立分支；
2.一个 Draft PR；
3.按任务书拆成原子提交；
4.完整验证；
5.提交 closeout；
6.停止等待人工验收；
7.不得自动合并或开始下一阶段。

---

## 5. Task 01A 已冻结决定

1. 不建立跨领域通用 Job Runtime；`ai_jobs` 保持 Managed AI 专用。
2. File Library Managed Scan 与 Global Index 是两个独立领域；不修改 `global_*` 或平台 provider。
3. Task 01A 不持久化 raw watcher event，不创建 `pending_fs_changes`；watcher owner 属于 Task 01B。
4. Task 01A 不修改 `files.id`、operation/cleanup journal、Safe Trash 或 restore。
5. 同一 root 的 active 集合仅为 `queued/running/cancelling`；partial unique index、root active pointer、lease token、generation 和 durable revision 共同保护 owner。
6.重复 start：相同 `request_key + canonical request hash` 幂等返回；其他 active root 冲突拒绝整个请求，不分配 generation。
7. metadata error 是 coverage-breaking：记录 `scan_run_errors`、不写 `scan_seen`、禁止 stale。
8. `scan_seen` successful 保留 7 天，非成功 terminal 保留 30 天，每 root 保留最新两个 terminal run；active run 不进入 terminal retention candidate，不能以 interrupted/requires-reconciliation 状态永久 pin。
9. multi-root session 持久化 requested→effective mapping，包括 duplicate、nested、invalid 和 cancelled-not-started。
10. session phase 是独立聚合阶段：`preparing -> running -> finalizing -> completed`，不跟随 root phase 倒退。
11. run/session revision 是 renderer 的 durable 事件水位；先 hydrate，按 revision/generation/identity 过滤和 gap refetch。
12. schema 27 commit 前可以 transaction rollback；commit 后只能使用 schema-27-capable build关闭 feature gate，旧 schema-26 binary继续拒绝 future schema。
13. Task 01A 不修改 dedupe 实现，不承诺 logical at-most-once。Dedupe 是 at-least-once、安全可重复计算的下游。
14. durable dedupe run、固定 run identity、prehash/cache/group 归 Task 02 子阶段。
15. Query V2 必须先于 Organization Plan。

---

## 6. Task 01B 已冻结决定与遗留项

1. Rust/Tauri 后端是 File Library watcher mutation 和 reconciliation 的唯一默认 owner。
2. renderer 只投影状态和刷新，不再默认调用 stale/upsert/rule mutation RPC。
3.不持久化逐条 raw notify event；使用 per-root `watcher_revision / watcher_applied_revision` 表达 durable crash gap。
4. Task 01B 正式占用 schema 28；PR #21 的 dedupe schema 28 未进入基线。
5. watcher 不写 `scan_seen`、不推进 scanner generation、不更新 `last_successful_generation`。
6.局部 exact update 是优化；overflow、ambiguity、revision gap、active scan race 和永久失败升级为 normal managed scan。
7. scan run claim 记录 `watcher_revision_at_start`；watcher revision 在 run 期间变化时禁止该 run执行 missing/stale reconciliation。
8. custom search roots 和 Global Index source 不得通过 File Library watcher写 managed `files`。
9. backend rule evaluation保留 watcher分类行为，但不触发 AI、不覆盖 user correction。
10. schema-28-capable build提供临时 backend/legacy owner kill switch，默认 backend；任何时刻只能有一个 mutation owner。
11. Task 01B 不修改 dedupe、Global Index、Managed AI、files.id 或任何 journal。
12. reconciliation retry、rename两侧、legacy隔离、rule bounded retry、unmount cleanup和single-owner reload已由PR #23实现并通过双平台CI。
13. **遗留项**：待恢复 rule failure不能继续依赖 `watcher_last_error_code`。Task 02A必须新增独立 `watcher_rule_recovery_required`，普通 watcher batch不得清除，恢复成功后才能在CAS finalization中清零。

---

## 7. Task 02A 实施入口

Task 02A 的正式任务书：

```text
docs/remediation/TASK_02A_WATCHER_RULE_RECOVERY_AND_DURABLE_DEDUPE_RUNS.md
```

该任务书文档 PR 合并前，Task 02A 不可执行。

文档 PR 合并后，推荐实施分支：

```text
remediation/02a-durable-dedupe-runs
```

完成后新增：

```text
docs/remediation/TASK_02A_IMPLEMENTATION_CLOSEOUT.md
```

并将本索引更新为：

```text
Task 02A：实施完成，待人工验收
Task 02B/02C：仍禁止执行
```

只有 Task 02A 生产实施通过人工验收并合并后，才由人工创建 Task 02B 任务书。

---

## 8. Task 02 拆分决定

原 Task 02 不再作为一个巨型 PR 实施，正式拆分：

### Task 02A — Durable Dedupe Run Foundation

- schema 29；
- watcher rule recovery durable fact；
- dedupe run/error ledger；
-单一 worker owner；
-queued pump、cancel、revision、startup recovery；
-现有完整 BLAKE3 pipeline接入持久 run；
-不实现 prehash、hard-link或group。

### Task 02B — File Identity, Fingerprint and Hash Pipeline

- physical/native identity mapping；
-不迁移 `files.id`；
-fingerprint失效合同；
-头尾 prehash；
-hard-link排除；
-受控并行 hashing；
-byte progress；
-不得创建删除动作。

### Task 02C — Duplicate Groups and Reclaim Semantics

- durable duplicate groups/members；
-硬链接与同内容副本区分；
-reclaimable bytes；
-recommended copy只作建议；
-group query/API和最小审核UI；
-所有删除仍延后到 Analysis/Plan/Safe Trash路径。

---

## 9. 审计产物

- `POST_MERGE_BASELINE_AUDIT.md`：当前进程、数据库、任务和安全边界；
- `REMEDIATION_CAPABILITY_MATRIX.md`：已有、部分、缺失、冲突和不应建设的能力；
- `REMEDIATION_RISK_REGISTER.md`：Critical/High 风险与阶段门禁。

硬边界：

- 不建设第二套 Global Index；
-不泛化 Managed AI queue；
-所有用户文件变更继续走 server-authoritative preview、identity、journal、Safe Trash 和 restore；
-Path ID、native identity、operation identity 和 AI fingerprint在正式 mapping/migration前继续隔离。

---

## 10. 后续阶段契约

| 阶段 | 必须先回答 | 明确不做 | 专项验证 |
|---|---|---|---|
| 01A Scan Generation | root lease、generation、scan_seen、stale、crash recovery | 不重建 Global Index、不持久化 watcher、不改 dedupe | migration、kill/restart、cancel、stale safety、100k |
| 01B Watcher | durable owner、revision gap、overflow、renderer 脱离、active scan race | 不伪造 scanner generation、不建 raw event log | overflow、rename/delete、renderer restart、跨平台、schema 28 |
| 02A Dedupe Run | durable owner、queue、cancel、revision、restart、rule recovery fact | 不做prehash/hardlink/group、不改files.id | migration、crash、cancel、FIFO、single worker、双平台 |
| 02B Identity/Fingerprint | path/native/physical identity、prehash、cache、hardlink、workers | 不直接迁移 `files.id`、不建删除动作 | rename、hardlink、changed file、large files、worker count |
| 02C Duplicate Groups | group identity、member、reclaim、recommendation | 不自动删除、不绕过Plan/Safe Trash | group rebuild、stale member、hardlink、pagination、reclaim |
| 03 Analysis | run/finding identity、stale、decision | 不把内存结果冒充 artifact | cancel、partial、rerun、idempotency |
| 04 Query V2 | scope、snapshot、sort、cursor、selection | 不把 Global Search join到 Library | concurrent scan/watcher、跨页选择、100k/1M |
| 05 Organization Plan | plan revision、identity expiry、decision | 不直接执行 filesystem mutation | diff、expiry、confirm、restore |
| 06 Workspace migration | Query/Plan已稳定 | 不绕过 operation journal | old/new path、stale plan、fallback |
| 07 Library surface | Query/Plan selection稳定 | 不把 UI sorting当后端事实 | virtual list、a11y、Saved View/tag |
| 08 Content Artifact | extractor、budget、consent、retention | 不默认读取/上传内容 | type/size/secret/cloud/local |
| 09 NL Rule | allowlist、ambiguity、preview | 不生成 shell/SQL/绝对执行路径 | adversarial prompt、scope、preview |
| 10 Spotlight | provider、ranking、permission、manifest | 不把 command当 mutation授权 | unavailable、source attribution、keyboard |
| 11 Integration | 全部前置验收 | 不夹带业务修复 | full CI、migration、performance、native/security rollback |
