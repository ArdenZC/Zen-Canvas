# Zen Canvas Codex Remediation Index V1

## 1. 当前执行状态

Task 00 已完成人工验收并通过 PR #16 合并。

Task 01A 任务书已由人工完成最终修订和验收。**PR #17 合并到 `master` 后，Task 01A 实施可执行。** 在 PR #17 合并前不得开始生产实施。

| 阶段 | 任务书 | 目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 合并后架构、安全和数据基线审计 | **已验收并合并** |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | File Library Scan root lease、session/run/generation、scan_seen、stale safety、恢复和 durable revision | **实施完成，待人工验收** |
| 01B | 待创建 | Watcher Reconciliation Ownership、overflow replay 和 durable watcher owner | **等待 Task 01A 实施验收，禁止执行** |
| 02 | 待创建 | 文件 identity/fingerprint、prehash、duplicate group 和 durable dedupe | **后续阶段，禁止执行** |
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

## 2. 文档和事实优先级

每阶段开始前依次读取：

1. 根目录当前开发说明；
2. `docs/remediation/README.md`；
3. `REMEDIATION_MASTER_PLAN_V1.md`；
4. 本索引；
5. 当前阶段任务书；
6. 已合并 closeout、测试和实际源码；
7. 涉及 UI 时读取当前 `docs/design/`。

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
-不跨阶段顺手重构。

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
2. 一个 Draft PR；
3. 按任务书拆成原子提交；
4.完整验证；
5.提交 closeout；
6.停止等待人工验收；
7.不得自动合并或开始下一阶段。

---

## 5. Task 01A 最终冻结决定

1. 不建立跨领域通用 Job Runtime；`ai_jobs` 保持 Managed AI 专用。
2. File Library Managed Scan 与 Global Index 是两个独立领域；不修改 `global_*` 或平台 provider。
3. Task 01A 不持久化 raw watcher event，不创建 `pending_fs_changes`；watcher owner 属于 Task 01B。
4. Task 01A 不修改 `files.id`、operation/cleanup journal、Safe Trash 或 restore。
5. 同一 root 的 active 集合仅为 `queued/running/cancelling`；partial unique index、root active pointer、lease token、generation 和 durable revision 共同保护 owner。
6.重复 start：相同 `request_key + canonical request hash` 幂等返回；其他 active root 冲突拒绝整个请求，不分配 generation。
7. metadata error 是 coverage-breaking：记录 `scan_run_errors`、不写 `scan_seen`、禁止 stale。
8. `scan_seen` successful 保留 7 天，非成功 terminal 保留 30 天，每 root 至少保留最新两个 terminal run；active/recovery-pinned 不 prune。
9. multi-root session 持久化 requested→effective mapping，包括 duplicate、nested、invalid 和 cancelled-not-started。
10. session phase 是独立聚合阶段：`preparing -> running -> finalizing -> completed`，不跟随 root phase 倒退。
11. run/session revision 是 renderer 的 durable 事件水位；先 hydrate，后接收事件。
12. schema 27 commit 前可以 transaction rollback；commit 后只能使用 schema-27-capable build 关闭 feature gate，旧 schema-26 binary 必须继续拒绝 future schema。
13. Task 01A 不修改 dedupe 实现，不承诺 logical at-most-once。Dedupe 是 at-least-once、安全可重复计算的下游；crash 可产生重复 hash 计算，但不得影响 scan terminal、generation、stale 或用户文件。
14. durable dedupe job、固定 idempotency、prehash/cache/group 归 Task 02。
15. Query V2 必须先于 Organization Plan。

---

## 6. Task 01A 实施入口

PR #17 合并后，Codex 只需读取并执行：

```text
docs/remediation/TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md
```

推荐实施分支：

```text
remediation/01a-scan-generation-foundation
```

Task 01A 完成后必须新增 closeout，并将本索引更新为：

```text
Task 01A：实施完成，待人工验收
Task 01B：仍禁止执行

本次 closeout：

```text
docs/remediation/TASK_01A_IMPLEMENTATION_CLOSEOUT.md
```
```

只有 Task 01A 生产实施通过人工验收并合并后，才由人工创建 Task 01B 任务书。

---

## 7. 审计产物

- `POST_MERGE_BASELINE_AUDIT.md`：当前进程、数据库、任务和安全边界；
- `REMEDIATION_CAPABILITY_MATRIX.md`：已有、部分、缺失、冲突和不应建设的能力；
- `REMEDIATION_RISK_REGISTER.md`：Critical/High 风险与阶段门禁。

硬边界：

- 不建设第二套 Global Index；
-不泛化 Managed AI queue；
-所有用户文件变更继续走 server-authoritative preview、identity、journal、Safe Trash 和 restore；
-Path ID、native identity、operation identity 和 AI fingerprint 在正式 mapping/migration 前继续隔离。

---

## 8. 后续阶段契约

| 阶段 | 必须先回答 | 明确不做 | 专项验证 |
|---|---|---|---|
| 01A Scan Generation | root lease、generation、scan_seen、stale、crash recovery | 不重建 Global Index、不持久化 watcher、不改 dedupe | migration、kill/restart、cancel、stale safety、100k |
| 01B Watcher | durable owner、overflow、replay、renderer 脱离 | 不伪造 scanner generation | overflow、rename/delete、renderer restart、跨平台 |
| 02 Identity/Dedupe | path/native/physical identity、prehash/cache/group | 不直接迁移 `files.id`、不自动删除 | rename、hardlink、changed file、durable dedupe |
| 03 Analysis | run/finding identity、stale、decision | 不把内存结果冒充 artifact | cancel、partial、rerun、idempotency |
| 04 Query V2 | scope、snapshot、sort、cursor、selection | 不把 Global Search join 到 Library | concurrent scan/watcher、跨页选择、100k/1M |
| 05 Organization Plan | plan revision、identity expiry、decision | 不直接执行 filesystem mutation | diff、expiry、confirm、restore |
| 06 Workspace migration | Query/Plan 已稳定 | 不绕过 operation journal | old/new path、stale plan、fallback |
| 07 Library surface | Query/Plan selection 稳定 | 不把 UI sorting 当后端事实 | virtual list、a11y、Saved View/tag |
| 08 Content Artifact | extractor、budget、consent、retention | 不默认读取/上传内容 | type/size/secret/cloud/local |
| 09 NL Rule | allowlist、ambiguity、preview | 不生成 shell/SQL/绝对执行路径 | adversarial prompt、scope、preview |
| 10 Spotlight | provider、ranking、permission、manifest | 不把 command 当 mutation 授权 | unavailable、source attribution、keyboard |
| 11 Integration | 全部前置验收 | 不夹带业务修复 | full CI、migration、performance、native/security rollback |
