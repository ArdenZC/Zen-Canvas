# Zen Canvas Codex Remediation Index V1

## 1. 当前执行状态

- Task 00 已通过 PR #16 完成人工验收并合并。
- Task 01A 已完成生产实施、人工验收并合并。
- Task 01B 已完成生产实施、条件验收并通过 PR #23 合并，合并提交为 `1bc9ead144601892feb13feaf53a6a6137df3904`。
- Task 02 已通过 PR #26 合并，合并提交为 `ac0ffd78244d61833d13c8ff7878be0a0e2bceaf`，当前数据库基线为 schema 29。
- Task 02 人工审查确认的 6 个遗留正确性问题已被冻结为 Task 03 第一组强制生产改动，不得再次后移。
- Task 03 任务书已通过 PR #27 合并，合并提交为 `d2f5093713d38928c9ba36b6193589ed956bf053`。
- **Task 03 现在是唯一可执行阶段。**
- Task 04 及所有后续阶段继续禁止执行。

| 阶段 | 任务书 | 目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 合并后架构、安全和数据基线审计 | **已验收并合并** |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | Scan root lease、session/run/generation、scan_seen、stale safety、恢复和 durable revision | **已验收并合并** |
| 01B | `TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md` | Rust watcher owner、durable revision gap、overflow/startup reconciliation、renderer 脱离 | **已验收并合并** |
| 02 | `TASK_02_IDENTITY_FINGERPRINT_AND_DUPE.md` | physical identity、fingerprint cache、prehash/full hash、durable run、hardlink-safe duplicate groups | **已合并，schema 29** |
| 03 | `TASK_03_ANALYSIS_RUN_FINDING_AND_DETECTORS.md` | 关闭 Task 02 遗留；durable Analysis Run、Detector、Finding、Evidence、Decision 与 cleanup 兼容 | **可执行，目标 schema 30** |
| 04 | 待创建 | File Query V2、snapshot、cursor 与跨页 selection | **等待 Task 03，禁止执行** |
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
3. `docs/remediation/REMEDIATION_MASTER_PLAN_V1.md`；
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

Task 03 已满足以上三个条件。

`BRIEF.md`、`00-overview.md`、`01-dedupe.md`、旧 plan 或其他对标资料没有执行授权，不得改变阶段顺序、schema 分配、任务范围或前置关系。

任务书和架构设计由人工编写。Codex 只执行生产代码、migration、测试、提交、一个 Draft PR 和 Closeout；不得重新设计任务书或拆分执行授权。

当前代码、测试和安全边界高于旧文档。发现冲突时停止并提交证据，不自行扩大范围。

---

## 3. 每阶段统一门禁

### 开始前

```bash
git checkout master
git pull --ff-only
git status --short
git rev-parse HEAD
npm run typecheck
npm test
npm run test:remediation
npm run test:performance
npm run build
npm run verify:rust
npm run security:audit
npm run security:audit:rust
```

环境不支持某项验证时，记录事实并保留 GitHub CI 作为权威门禁；不得修改生产代码、放宽测试或伪造结果。

### 实施中

- 只修改任务书允许路径；
- 先写或同步更新测试；
- 不把兼容层变成永久双轨；
- 不在 renderer 重复 Rust 的安全解析；
- 不绕过 Managed Scope、Global Index、AI queue、preview、journal 和 restore；
- 不跨阶段顺手重构；
- 不得提前占用后续阶段 schema；
- 一个阶段只使用一个实施分支和一个 Draft PR；
- 任务内部可使用原子提交，但不得拆成新的授权任务。

### 完成后

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

数据库、性能、原生和安全阶段还必须运行任务书规定的专项门禁。

---

## 4. 标准交付

每阶段：

1. 独立分支；
2. 一个 Draft PR；
3. 可审查的原子提交；
4. 完成整个任务后统一验证；
5. 提交 Closeout；
6. 停止等待人工验收；
7. 不得自动合并或开始下一阶段。

---

## 5. 已冻结的前置边界

### Task 01A

- 不建立跨领域通用 Job Runtime；`ai_jobs` 保持 Managed AI 专用。
- File Library Managed Scan 与 Global Index 是两个独立领域。
- scanner 是 `scan_seen` 和 generation 的唯一 owner。
- 不修改 `files.id`、operation/cleanup journal、Safe Trash 或 restore。
- root lease、generation、revision 和持久 session/run 共同保护扫描事实。

### Task 01B

- Rust/Tauri 是 File Library watcher mutation/reconciliation 唯一默认 owner。
- renderer 只投影状态和刷新。
- watcher 不写 `scan_seen`、不推进 generation。
- overflow、ambiguity、revision gap 和 active scan race 升级 managed reconciliation。
- custom search roots 和 Global Index 不得写 managed `files`。
- watcher rule recovery 独立持久事实已由 Task 02 建立。

### Task 02

- 不迁移 `files.id`，使用旁路 `file_fingerprints`。
- operation/restore identity 与 dedupe physical identity 分离。
- `files.content_hash` 仅为兼容镜像；active duplicate group/member 是重复权威。
- prehash 只淘汰，完整 BLAKE3 才确认。
- hardlink 多路径只算一个物理副本。
- Dedupe 使用领域专用 durable `dedupe_runs`，不泛化 `ai_jobs`。
- scanner/watcher 只做短事务 fingerprint/group invalidation。
- Duplicate Groups UI 只读。

### Task 02 合并时接受并转入 Task 03 的强制遗留

1. 局部 root dedupe 不得破坏跨 root 全局 group；
2. prehash 读取前后必须重新验证 physical identity；
3. cancel 后已完成有效 hash 必须落库但不得发布 partial group；
4. byte progress 必须来自真实 IO；
5. 小文件 size collision 只能完整读取一次；
6. rename cache reuse 必须同步 `files.content_hash` 兼容镜像。

这些问题不是可选技术债。Task 03 必须首先修复并增加回归测试。

---

## 6. Task 03 冻结决定

1. Task 03 是一个完整任务，不拆成 03A/03B/03C 或多个生产 PR。
2. 基线 schema 29，目标 schema 30。
3. 第一组生产改动是关闭上述 6 个 Task 02 遗留问题。
4. active duplicate groups 是全部 enabled managed roots 的全局 authority；局部或 diagnostic run 不得发布或 stale 全局 group。
5. 建立 durable dedupe authority revision/health，供 Analysis snapshot 使用。
6. 建立领域专用 `analysis_runs`、`analysis_run_detectors`、`analysis_findings`、`analysis_finding_evidence` 和 `analysis_finding_decisions`。
7. Detector 使用固定 Rust allowlist，不允许动态脚本、任意 SQL、renderer detector 或模型工具。
8. finding 是证据和建议，不是 mutation 授权。
9. staged finding 只有在 source snapshot 未变化、run 未取消且 detector 成功时才能原子发布。
10. 一个 detector 失败不得删除该 detector 上一次 active findings。
11. finding key 必须包含 identity 版本，旧 dismissal 不得作用于已变化文件。
12. Safe/Review/Caution 必须由后端规则约束；AI 只能追加评估或提高风险，不能升级为 Safe 或可执行。
13. duplicate finding 永远只读，不自动选择 keeper 或删除。
14. 现有 cleanup mutation 只能通过 finding → authoritative preview → identity → cleanup journal → Safe Trash → restore 兼容适配。
15. 不修改 cleanup/operation journal schema，不弱化 restore。
16. 不建设 Organization Plan、Query V2、Content Artifact、NL Rule 或 Spotlight。
17. Task 04 只有在 Task 03 通过人工验收并合并后才能创建任务书。

---

## 7. Task 03 实施入口

Codex 现在只需读取并完整执行：

```text
docs/remediation/TASK_03_ANALYSIS_RUN_FINDING_AND_DETECTORS.md
```

唯一实施分支：

```text
remediation/03-analysis-run-findings
```

完成后新增：

```text
docs/remediation/TASK_03_IMPLEMENTATION_CLOSEOUT.md
```

并将本索引更新为：

```text
Task 03：实施完成，Draft PR 和 CI 待人工验收
Task 04：仍禁止执行
```

---

## 8. 审计产物与硬边界

- `POST_MERGE_BASELINE_AUDIT.md`：当前进程、数据库、任务和安全边界；
- `REMEDIATION_CAPABILITY_MATRIX.md`：已有、部分、缺失、冲突和不应建设的能力；
- `REMEDIATION_RISK_REGISTER.md`：Critical/High 风险与阶段门禁。

硬边界：

- 不建设第二套 Global Index；
- 不泛化 Managed AI queue；
- 所有用户文件变更继续走 server-authoritative preview、identity、journal、Safe Trash 和 restore；
- detector/finding 不直接执行 mutation；
- Path ID、Global native identity、operation identity、dedupe physical identity 和 AI fingerprint 保持明确领域边界。

---

## 9. 后续阶段契约

| 阶段 | 必须先回答 | 明确不做 | 专项验证 |
|---|---|---|---|
| 01A Scan Generation | root lease、generation、scan_seen、stale、crash recovery | 不重建 Global Index、不改 dedupe | migration、kill/restart、cancel、stale safety、100k |
| 01B Watcher | durable owner、revision gap、overflow、renderer 脱离、active scan race | 不伪造 generation、不建 raw event log | overflow、rename/delete、renderer restart、跨平台 |
| 02 Identity/Dedupe | physical identity、prehash/cache/group、durable run | 不迁移 `files.id`、不自动删除、不建 Finding | migration、rename、hardlink、changed file、cancel/restart |
| 03 Analysis | dedupe authority、run/finding identity、evidence、stale、decision、risk | 不把内存结果当 artifact、不直接删除、不建 Plan/Query V2 | six-debt regression、partial detector、cancel、rerun、Safe/Review/Caution、schema 30 |
| 04 Query V2 | scope、snapshot、sort、cursor、selection | 不把 Global Search join 到 Library | concurrent scan/watcher、跨页选择、100k/1M |
| 05 Organization Plan | plan revision、identity expiry、decision | 不直接执行 filesystem mutation | diff、expiry、confirm、restore |
| 06 Workspace migration | Query/Plan 已稳定 | 不绕过 operation journal | old/new path、stale plan、fallback |
| 07 Library surface | Query/Plan selection 稳定 | 不把 UI sorting 当后端事实 | virtual list、a11y、Saved View/tag |
| 08 Content Artifact | extractor、budget、consent、retention | 不默认读取或上传内容 | type/size/secret/cloud/local |
| 09 NL Rule | allowlist、ambiguity、preview | 不生成 shell/SQL/绝对执行路径 | adversarial prompt、scope、preview |
| 10 Spotlight | provider、ranking、permission、manifest | 不把 command 当 mutation 授权 | unavailable、source attribution、keyboard |
| 11 Integration | 全部前置验收 | 不夹带业务修复 | full CI、migration、performance、native/security rollback |
