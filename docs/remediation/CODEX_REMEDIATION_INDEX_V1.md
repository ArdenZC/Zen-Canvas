# Zen Canvas Codex Remediation Index V1

## 1. 当前执行状态

- Task 00 已通过 PR #16 完成人工验收并合并。
- Task 01A 已完成生产实施、人工验收并合并。
- Task 01B 已完成生产实施、条件验收并通过 PR #23 合并，合并提交为 `1bc9ead144601892feb13feaf53a6a6137df3904`。
- Task 01B 遗留的 watcher 规则恢复持久状态，已被列为 Task 02 第一项强制实施内容。
- PR #21 因越过 Task 01B 提前进入旧版 dedupe/schema 28，已关闭且未合并；不得整体恢复或 cherry-pick，其代码只能作为人工对照资料。
- Task 02 任务书由人工完整编写，不拆分为 02A/02B 等授权任务；生产实施已在 `remediation/02-identity-fingerprint-dedupe` 完成。
- Task 02 代码实现提交为 `615e42e`，当前 Draft PR 为 [#26](https://github.com/ArdenZC/Zen-Canvas/pull/26)，等待 Windows/macOS CI 和人工代码级验收。

| 阶段 | 任务书 | 目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 合并后架构、安全和数据基线审计 | **已验收并合并** |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | File Library Scan root lease、session/run/generation、scan_seen、stale safety、恢复和 durable revision | **已验收并合并** |
| 01B | `TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md` | Rust watcher owner、durable revision gap、overflow/startup reconciliation、renderer 脱离 | **已验收并合并** |
| 02 | `TASK_02_IDENTITY_FINGERPRINT_AND_DUPE.md` | watcher rule recovery debt、physical identity、fingerprint cache、prehash/full hash、durable run、hardlink-safe duplicate groups | **实施完成，PR #26 Draft，待人工验收** |
| 03 | 待创建 | Analysis Run、Finding 与 detector | **等待 Task 02，禁止执行** |
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

`BRIEF.md`、`00-overview.md`、`01-dedupe.md` 等调研/对标文档没有执行授权，不得改变本索引的阶段顺序、schema 分配、任务范围或前置关系。

任务书和架构设计由人工编写。Codex 只执行生产代码、migration、测试、提交、Draft PR 和 Closeout；不得重新设计任务书或拆分执行授权。

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

环境不支持某项验证时，记录事实并保留 CI 作为权威门禁，不得修改生产代码、放宽测试或伪造结果。

### 实施中

- 只修改任务书允许路径；
-先写或同步更新测试；
-不把兼容层变成永久双轨；
-不在 renderer 重复 Rust 的安全解析；
-不绕过 Managed Scope、Global Index、AI queue、preview、journal 和 restore；
-不跨阶段顺手重构；
-不得提前占用后续阶段 schema；
-一个阶段只使用一个实施分支和一个 Draft PR；
-任务内部可使用原子提交，但不得把完整任务拆成新的授权阶段。

### 完成后

```bash
npm run typecheck
npm test
npm run test:remediation
npm run test:performance
npm run build
npm run verify:rust
npm run security:audit
npm run security:audit:rust
git diff --check
git status --short
```

数据库、性能、原生和安全阶段还必须运行任务书规定的专项门禁。

---

## 4. 标准交付

每阶段：

1. 独立分支；
2.一个 Draft PR；
3.按任务书使用可审查的原子提交；
4.完成整个任务后统一验证；
5.提交 Closeout；
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
8. `scan_seen` successful 保留 7 天，非成功 terminal 保留 30 天，每 root 保留最新两个 terminal run；active run 不进入 terminal retention candidate。
9. multi-root session 持久化 requested→effective mapping，包括 duplicate、nested、invalid 和 cancelled-not-started。
10. session phase 使用独立聚合阶段 `preparing/running/finalizing/completed`。
11. run/session revision 是 renderer durable 事件水位；先 hydrate，按 revision/generation/identity 过滤。
12. schema 27 commit 前 transaction rollback；commit 后只能使用支持新 schema 的 build 关闭 feature gate，旧 binary 继续拒绝 future schema。
13. Task 01A 不修改 dedupe，不承诺 exactly-once；扫描后的 dedupe dispatch 为 at-least-once。
14. durable dedupe run、fingerprint、prehash、group 归 Task 02。
15. Query V2 必须先于 Organization Plan。

---

## 6. Task 01B 已冻结决定

1. Rust/Tauri 后端是 File Library watcher mutation 和 reconciliation 的唯一默认 owner。
2. renderer 只投影状态和刷新，不再默认调用 stale/upsert/rule mutation RPC。
3.不持久化逐条 raw notify event；使用 per-root `watcher_revision / watcher_applied_revision` 表达 durable crash gap。
4. Task 01B 占用 schema 28；PR #21 的 dedupe schema 28 不属于基线。
5. watcher 不写 `scan_seen`、不推进 scanner generation、不更新 `last_successful_generation`。
6.局部 exact update 是优化；overflow、ambiguity、revision gap、active scan race 和永久失败升级为 managed scan。
7. scan run claim 记录 `watcher_revision_at_start`；扫描期间 watcher revision 变化时禁止错误 missing/stale reconciliation。
8. custom search roots 和 Global Index source 不得通过 File Library watcher 写 managed `files`。
9. backend rule evaluation 不触发 AI、不覆盖 user correction。
10. backend/legacy kill switch 仅作故障隔离，默认 backend，任何时刻只能有一个 mutation owner。
11. Task 01B 不修改 dedupe、Global Index、Managed AI、`files.id` 或任何 journal。
12. 遗留问题：最近错误字段无法作为 pending rule recovery 的持久 owner；Task 02 必须首先增加独立 `watcher_rule_recovery_required` 或等价事实并完成交错测试。

---

## 7. Task 02 冻结决定

1. Task 02 是一个完整任务，不拆成 02A/02B 等独立任务或多个 PR。
2. 基线 schema 28，目标 schema 29。
3. 第一项生产改动是补齐 Task 01B watcher rule recovery durable flag。
4. 不迁移 `files.id`；使用旁路 `file_fingerprints` 映射 path row 与 physical identity。
5. operation/restore identity 与 dedupe identity 分离；不得弱化 mutation safety。
6. `files.content_hash` 只作兼容镜像；duplicate group/member 是新权威事实。
7. prehash 为头尾采样，只淘汰不确认；完整 BLAKE3 才确认内容重复。
8. hardlink 多路径只算一个物理副本，不增加精确可释放空间。
9. Dedupe 使用领域专用 durable `dedupe_runs`，不泛化 `ai_jobs`。
10. crash 后 run 标 interrupted，下一 run 重新 collection 并复用持久 fingerprint，不建设巨型 per-file candidate queue。
11. worker 使用标准库固定有界池，不新增并发依赖。
12. scanner/watcher 只负责短事务 invalidation，不在其 mutation transaction 中执行 hash IO。
13. group publication必须原子，scope snapshot变化时不得用不完整集合替换全部 active groups。
14. Duplicate Groups UI 只读，不提供删除、移动、自动保留或清理动作。
15. Task 03 才建设 Analysis Run/Finding、风险分层和 cleanup 建议。

---

## 8. Task 02 实施入口

Codex 只需读取并完整执行：

```text
docs/remediation/TASK_02_IDENTITY_FINGERPRINT_AND_DUPE.md
```

推荐实施分支：

```text
remediation/02-identity-fingerprint-dedupe
```

完成后新增：

```text
docs/remediation/TASK_02_IMPLEMENTATION_CLOSEOUT.md
```

并将本索引更新为：

```text
Task 02：实施完成，PR #26 Draft，待人工验收
Task 03：仍禁止执行
```

Task 02 的详细实现证据、验证结果、已知风险和硬边界见：

```text
docs/remediation/TASK_02_IMPLEMENTATION_CLOSEOUT.md
```

只有 Task 02 生产实施通过人工验收并合并后，才由人工创建 Task 03 任务书。

---

## 9. 审计产物与硬边界

- `POST_MERGE_BASELINE_AUDIT.md`：当前进程、数据库、任务和安全边界；
- `REMEDIATION_CAPABILITY_MATRIX.md`：已有、部分、缺失、冲突和不应建设的能力；
- `REMEDIATION_RISK_REGISTER.md`：Critical/High 风险与阶段门禁。

硬边界：

- 不建设第二套 Global Index；
-不泛化 Managed AI queue；
-所有用户文件变更继续走 server-authoritative preview、identity、journal、Safe Trash 和 restore；
-Task 02 不执行用户文件 mutation；
-Path ID、Global native identity、operation identity 和 AI fingerprint 继续保持明确领域边界。

---

## 10. 后续阶段契约

| 阶段 | 必须先回答 | 明确不做 | 专项验证 |
|---|---|---|---|
| 01A Scan Generation | root lease、generation、scan_seen、stale、crash recovery | 不重建 Global Index、不持久化 watcher、不改 dedupe | migration、kill/restart、cancel、stale safety、100k |
| 01B Watcher | durable owner、revision gap、overflow、renderer 脱离、active scan race | 不伪造 scanner generation、不建 raw event log | overflow、rename/delete、renderer restart、跨平台、schema 28 |
| 02 Identity/Dedupe | rule recovery flag、path/native/physical identity、prehash/cache/group、durable run | 不迁移 `files.id`、不自动删除、不建 Finding | migration、rename、hardlink、changed file、cancel/restart、durable groups、schema 29 |
| 03 Analysis | run/finding identity、evidence、stale、decision、reclaimable risk | 不把内存结果冒充 artifact、不直接删除 | cancel、partial、rerun、idempotency、Safe/Review/Caution |
| 04 Query V2 | scope、snapshot、sort、cursor、selection | 不把 Global Search join 到 Library | concurrent scan/watcher、跨页选择、100k/1M |
| 05 Organization Plan | plan revision、identity expiry、decision | 不直接执行 filesystem mutation | diff、expiry、confirm、restore |
| 06 Workspace migration | Query/Plan 已稳定 | 不绕过 operation journal | old/new path、stale plan、fallback |
| 07 Library surface | Query/Plan selection 稳定 | 不把 UI sorting 当后端事实 | virtual list、a11y、Saved View/tag |
| 08 Content Artifact | extractor、budget、consent、retention | 不默认读取/上传内容 | type/size/secret/cloud/local |
| 09 NL Rule | allowlist、ambiguity、preview | 不生成 shell/SQL/绝对执行路径 | adversarial prompt、scope、preview |
| 10 Spotlight | provider、ranking、permission、manifest | 不把 command 当 mutation 授权 | unavailable、source attribution、keyboard |
| 11 Integration | 全部前置验收 | 不夹带业务修复 | full CI、migration、performance、native/security rollback |
