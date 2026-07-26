# Zen Canvas Codex Remediation Index V1

## 1. 当前执行状态

Task 00 已完成人工验收并通过 PR #16 合并。

Task 01A 已完成生产实施、人工验收并合并到 `master`。

Task 01B 任务书已由人工编写。**只有承载该任务书的文档 PR 合并到 `master` 后，Task 01B 才可执行。**

PR #21 因越过 Task 01B 提前进入 Task 02 dedupe/schema 28，已关闭且未合并；其分支仅作未来参考，不是当前基线。

| 阶段 | 任务书 | 目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 合并后架构、安全和数据基线审计 | **已验收并合并** |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | File Library Scan root lease、session/run/generation、scan_seen、stale safety、恢复和 durable revision | **已验收并合并** |
| 01B | `TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md` | Rust watcher owner、durable revision gap、overflow/startup reconciliation、renderer 脱离 | **任务书已完成；文档 PR 合并后可执行** |
| 02 | 待创建 | 文件 identity/fingerprint、prehash、duplicate group 和 durable dedupe | **等待 Task 01B，禁止执行** |
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
-不得提前占用后续阶段 schema。

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

任务书和架构设计由人工编写。Codex 只执行代码、测试、提交和汇报。

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
11. run/session revision 是 renderer 的 durable 事件水位；先 hydrate，后接收事件。
12. schema 27 commit 前可以 transaction rollback；commit 后只能使用 schema-27-capable build 关闭 feature gate，旧 schema-26 binary 必须继续拒绝 future schema。
13. Task 01A 不修改 dedupe 实现，不承诺 logical at-most-once。Dedupe 是 at-least-once、安全可重复计算的下游。
14. durable dedupe job、固定 idempotency、prehash/cache/group 归 Task 02。
15. Query V2 必须先于 Organization Plan。

---

## 6. Task 01B 冻结决定

1. Rust/Tauri 后端是 File Library watcher mutation 和 reconciliation 的唯一默认 owner。
2. renderer 只投影状态和刷新，不再默认调用 stale/upsert/rule mutation RPC。
3.不持久化逐条 raw notify event；使用 per-root `watcher_revision / watcher_applied_revision` 表达 durable crash gap。
4. Task 01B 正式占用 schema 28；PR #21 的 dedupe schema 28 不进入基线。
5. watcher 不写 `scan_seen`、不推进 scanner generation、不更新 `last_successful_generation`。
6.局部 exact update 是优化；overflow、ambiguity、revision gap、active scan race 和永久失败升级为 normal managed scan。
7. scan run claim 记录 `watcher_revision_at_start`；watcher revision 在 run 期间变化时禁止该 run 执行 missing/stale reconciliation。
8. custom search roots 和 Global Index source 不得通过 File Library watcher 写 managed `files`。
9. backend rule evaluation 保留当前 watcher 分类行为，但不触发 AI、不覆盖用户 correction。
10. schema-28-capable build 提供临时 backend/legacy owner kill switch，默认 backend；任何时刻只能有一个 mutation owner。
11. Task 01B 不修改 dedupe、Global Index、Managed AI、files.id 或任何 journal。
12. Task 02 只能在 Task 01B 实施验收并合并后开始，届时 schema 从 28 继续演进。

---

## 7. Task 01B 实施入口

任务书文档 PR 合并后，Codex 只需读取并执行：

```text
docs/remediation/TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md
```

推荐实施分支：

```text
remediation/01b-watcher-reconciliation-ownership
```

完成后新增：

```text
docs/remediation/TASK_01B_IMPLEMENTATION_CLOSEOUT.md
```

并将本索引更新为：

```text
Task 01B：实施完成，待人工验收
Task 02：仍禁止执行
```

只有 Task 01B 生产实施通过人工验收并合并后，才由人工创建 Task 02 任务书。

---

## 8. 审计产物

- `POST_MERGE_BASELINE_AUDIT.md`：当前进程、数据库、任务和安全边界；
- `REMEDIATION_CAPABILITY_MATRIX.md`：已有、部分、缺失、冲突和不应建设的能力；
- `REMEDIATION_RISK_REGISTER.md`：Critical/High 风险与阶段门禁。

硬边界：

- 不建设第二套 Global Index；
-不泛化 Managed AI queue；
-所有用户文件变更继续走 server-authoritative preview、identity、journal、Safe Trash 和 restore；
-Path ID、native identity、operation identity 和 AI fingerprint 在正式 mapping/migration 前继续隔离。

---

## 9. 后续阶段契约

| 阶段 | 必须先回答 | 明确不做 | 专项验证 |
|---|---|---|---|
| 01A Scan Generation | root lease、generation、scan_seen、stale、crash recovery | 不重建 Global Index、不持久化 watcher、不改 dedupe | migration、kill/restart、cancel、stale safety、100k |
| 01B Watcher | durable owner、revision gap、overflow、renderer 脱离、active scan race | 不伪造 scanner generation、不建 raw event log | overflow、rename/delete、renderer restart、跨平台、schema 28 |
| 02 Identity/Dedupe | path/native/physical identity、prehash/cache/group、durable run | 不直接迁移 `files.id`、不自动删除 | rename、hardlink、changed file、durable dedupe |
| 03 Analysis | run/finding identity、stale、decision | 不把内存结果冒充 artifact | cancel、partial、rerun、idempotency |
| 04 Query V2 | scope、snapshot、sort、cursor、selection | 不把 Global Search join 到 Library | concurrent scan/watcher、跨页选择、100k/1M |
| 05 Organization Plan | plan revision、identity expiry、decision | 不直接执行 filesystem mutation | diff、expiry、confirm、restore |
| 06 Workspace migration | Query/Plan 已稳定 | 不绕过 operation journal | old/new path、stale plan、fallback |
| 07 Library surface | Query/Plan selection 稳定 | 不把 UI sorting 当后端事实 | virtual list、a11y、Saved View/tag |
| 08 Content Artifact | extractor、budget、consent、retention | 不默认读取/上传内容 | type/size/secret/cloud/local |
| 09 NL Rule | allowlist、ambiguity、preview | 不生成 shell/SQL/绝对执行路径 | adversarial prompt、scope、preview |
| 10 Spotlight | provider、ranking、permission、manifest | 不把 command 当 mutation 授权 | unavailable、source attribution、keyboard |
| 11 Integration | 全部前置验收 | 不夹带业务修复 | full CI、migration、performance、native/security rollback |