# Zen Canvas Codex Remediation Index V1

## 1. 当前执行状态

- Task 00 已通过 PR #16 合并；
- Task 01A/01B 已完成扫描代际与 watcher reconciliation；
- Task 02 已通过 PR #26 合并，schema 29；
- Task 03 已通过 PR #28 合并，schema 30；
- Task 04 已通过 PR #35 合并，squash merge `14616d4344314afce0878dbc681988c04183a9bc`；
- Task 05 已通过 PR #38 合并，squash merge `5468a17790165a149c462a17b64d011750b45410`，schema 31；
- Task 06 已通过 PR #40 合并，squash merge `29e85c099c5ee921ad7d4237c780dc47126e0fa3`，schema 32；
- Task 07 已通过 PR #42 合并，squash merge `4e07de9c02198eb3352d9b2b1f289d61a3df128c`，schema 33；
- Task 07 人工接受的六项代码审查问题已冻结为 Task 08 第一组生产改动，不得再次后移；
- **Task 08 是当前唯一可执行完整产品模块，授权 schema 34。**

| Task | 任务书 | 产品模块/目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 后架构、安全与数据基线 | 已完成 |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | scan generation/run/session/recovery | 已完成 |
| 01B | `TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md` | watcher owner/reconciliation | 已完成 |
| 02 | `TASK_02_IDENTITY_FINGERPRINT_AND_DUPE.md` | 模块 1：重复检测；Czkawka 对标 | 已合并，schema 29 |
| 03 | `TASK_03_ANALYSIS_RUN_FINDING_AND_DETECTORS.md` | 模块 2：空间分析；Spacedrive V1 对标 | 已合并，schema 30 |
| 04 | `TASK_04_GLOBAL_SHORTCUT_SEARCH.md` | 模块 4：全局快捷搜索；Tolaria 对标 | 已合并，schema 30 |
| 05 | `TASK_05_FILE_LIBRARY_QUERY_TAGS_SAVED_VIEWS.md` | 模块 5：文件库；TagSpaces 对标 | 已合并，schema 31 |
| 06 | `TASK_06_DURABLE_ORGANIZATION_PLAN_AND_DRY_RUN.md` | 模块 6：AI 整理预览；ai-file-sorter 对标 | 已合并，schema 32 |
| 07 | `TASK_07_NATURAL_LANGUAGE_RULE_PROPOSAL_AND_APPROVAL.md` | 模块 7：自然语言规则；Coworker + OpenCode 对标 | 已合并，schema 33；六项遗留转入 Task 08 |
| 08 | `TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md` | 模块 8：本地内容理解；Local-File-Organizer 对标 | **Draft PR #44；第四轮 Provider pre-claim/PDF timeout-through-run gap 已修订，code head `80bfabd7ce1d11d7dfbadb4ef8df9d875935e437` 的 code-head CI `30690147656` 已通过；停止等待第五轮人工验收，schema 34** |

不得创建 debt-cleanup、07.5、08A/08B/08C、OCR-only 或并行产品阶段。上一阶段接受遗留必须作为下一完整模块第一组关闭，然后连续完成该模块。

---

## 2. 固定的 8 模块主线

| 模块 | Zen Canvas 功能 | 参考项目 | 借鉴边界 | 承载阶段 |
|---|---|---|---|---|
| 1 | 重复检测 | Czkawka | 按许可证登记，独立实现 | Task 02，已完成 |
| 2 | 大型文件/空间分析 | Spacedrive V1 | 概念级，拒绝过度复杂架构 | Task 03，已完成 |
| 3 | 扫描与索引 | Spacedrive V1 | Job/Location/Indexer 概念级 | Task 01A/01B，已完成 |
| 4 | 全局快捷搜索 | Tolaria | AGPL 设计级，只读分析不移植 | Task 04，已完成 |
| 5 | 文件库 | TagSpaces | AGPL 设计级，不复制实现或结构 | Task 05，已完成 |
| 6 | AI 整理预览 | ai-file-sorter | AGPL 概念级，独立实现 | Task 06，已完成 |
| 7 | 自然语言规则 | Coworker + OpenCode | MIT，原则级翻译为 typed Rule Proposal | Task 07，已完成 |
| 8 | 本地内容理解 | Local-File-Organizer | MIT，轻量设计级，独立 Rust/Tauri 实现 | Task 08，当前 |

标准流程：

```text
完整产品模块
→ 人工任务书先进入 master
→ 一个实施分支
→ 一个 Draft PR
→ 完整代码级验收
→ 人工决定合并或登记有限遗留
```

Task 08 是固定八模块主线最后一项。不得自行创建 Task 09。

---

## 3. 唯一执行授权

Task 08 生产实施必须同时满足：

```text
本索引指向 Task 08
+
docs/remediation/TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md 存在
+
任务书位于当前 master
+
master 包含 4e07de9c02198eb3352d9b2b1f289d61a3df128c
```

实施分支固定为：

```text
remediation/08-local-content-understanding
```

每阶段开始前依次阅读：

1. 根目录当前开发说明；
2. `docs/remediation/README.md`；
3. `REMEDIATION_MASTER_PLAN_V1.md`；
4. 本索引；
5. `TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md`；
6. Task 07 任务书、Closeout、PR #42 review 和实际源码/测试；
7. 涉及 UI 时读取 `docs/design/`；
8. `QiuYannnn/Local-File-Organizer` 固定 SHA、LICENSE 与任务书列出的文件。

Codex 只负责生产代码、migration、测试、原子提交、唯一 Draft PR 和 Closeout；不得重写任务书、拆分阶段、自动合并或自行设计 Task 09。

---

## 4. Task 08 第一组强制遗留

Task 08 开始后必须先关闭：

1. effective Rule catalog 覆盖 learned rule 与影响 ruleset 的 settings/policy；
2. `execute_rules_for_scope_v2` 消除 catalog/rules/scope TOCTOU，冻结单一权威执行快照；
3. Rule impact 与真实 classification engine 做 differential equivalence；
4. Proposal Workspace 展示 before/after、risk、confirmation、scope、permission、broad match 和 conflict completeness；
5. manual candidate edit 清理旧 AI summary/provenance 并标记 manually edited；
6. backend 对 delete/trash/tool/auto-run 等原始 prompt 意图确定性 deny。

这六项必须有真实行为、并发或 differential tests；不得仅添加字符串断言。完成后连续实施完整 Task 08，不得停点。

---

## 5. Task 08 冻结决定

1. schema `33→34`；
2. 新增 consent-bound content policy、run/item ledger、Content Artifact 和 managed content FTS；
3. 不 ALTER `files`，不迁移 `files.id`；
4. 内容分析默认关闭；
5. 只接受 durable managed scope/selection IDs；
6. root disabled/degraded/reconciliation 必须 fail closed；
7. 先 backend preview，再 `confirmed=true` 开始；
8. local deterministic extraction 与 optional provider understanding 分离；
9. 默认不持久化 extracted/raw text；
10. cloud 每次单独确认，不发送 path/filename/secrets；
11. Sensitive/System/blocked 不发送 cloud；
12. fixed typed extractor registry；
13. mandatory：txt/md/csv、text-layer PDF、docx/xlsx/pptx；
14. unsupported：legacy Office、OCR-only PDF、image OCR/VLM、audio/video/ebook/archive；
15. 不捆绑 Python/Conda/Tesseract/Nexa/外部 executable；
16. 不建设第二 durable AI queue；
17. Content Search 只属于 managed File Library，不进入 Global Search；
18. Content Artifact 不直接授权 Rule/Plan/filesystem mutation；
19. Delete/Purge 只删除 artifact/run/FTS facts，不删除源文件；
20. Task 08 完成后停止等待人工验收，不自动合并或发布。

权威任务书：

```text
docs/remediation/TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md
```

---

## 6. 已冻结的不可回退边界

### Scan / Watcher

- File Library Managed Scan 与 Global Index 独立；
- scanner 是 `scan_seen` 和 generation 唯一 owner；
- Rust/Tauri 是 watcher mutation/reconciliation owner；
- watcher 不写 `scan_seen`、不推进 generation；
- Task 08 只允许 watcher 标记 Content Artifact stale 或触发已同意的 local extraction；
- watcher 永不自动发送 cloud provider。

### Identity / Dedupe / Analysis

- 不迁移 `files.id`；
- operation identity 与 physical/content identity 分离；
- active duplicate group/member 是重复权威；
- Analysis Finding 不是 mutation authority；
- Content Artifact 不是 file identity、operation identity 或 duplicate authority。

### Global Search / File Library

- Global Search 与 managed File Library/Content Search 数据域独立；
- Global Search 不 join Content Artifact；
- managed `files` 是 File Library authority；
- Content Search 绑定 file/content/library revisions 与 keyset cursor；
- Search window denied content read/run/delete/provider commands。

### AI / Privacy

- AI trace 只作 bounded diagnostics；
- Content Artifact 是独立业务事实；
- provider payload 只含 bounded extracted text 与固定 schema；
- 不发送路径、文件名、文件列表、operation logs、tags、credentials 或 secrets；
- raw provider response 不持久化；
- 不把 `ai_jobs` 泛化为通用 runtime，不创建第二 AI queue。

### Rule / Plan / Mutation

- Rule AST V1 继续 metadata-only；
- Task 08 不创建 content condition 或 AST V2；
- Rule/Content Artifact 只产生分类、摘要、关键词或建议事实；
- 任何 move/rename/delete 继续经过 Organization Plan、authoritative preview、identity、journal、Safe Trash 和 restore；
- content delete/purge 不调用 operation/cleanup journal。

---

## 7. 统一门禁

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

环境无法运行的项目必须如实记录并由 GitHub CI 补充；不得删除测试、放宽断言、缩小 fixture 或关闭功能规避。

### 实施中

- 只修改 Task 08 允许范围；
- 测试与生产代码同步；
- Rust 是 extractor、consent、identity、provider payload 和 retention authority；
- renderer 不提交 arbitrary path、raw content、file list、bytes/count 或 provider secret；
- 一个实施分支、一个 Draft PR；
- 内部原子提交不是独立任务；
- 先关闭六项遗留，再连续完成 Content Artifact 产品模块。

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

还必须满足 schema 34、extractor fixtures、consent/provider privacy、recovery/retention、100k/1M Content Search、Windows/macOS、NSIS/unsigned DMG 和 package-size 门禁。

---

## 8. 标准交付

Task 08 完成时必须：

1. 分支 `remediation/08-local-content-understanding`；
2. 一个 Draft PR；
3. 可审查原子提交；
4. Task 07 六项遗留全部关闭；
5. schema 34 migration/rollback/future guard；
6. content policies、runs/items、artifacts、FTS；
7. fixed extractor registry 与 bomb/malformed tests；
8. authoritative preview/confirmation；
9. local/cloud privacy gate；
10. current/stale/rebuild/delete/purge semantics；
11. File Library Content Search/Inspector UI；
12. 完整 frontend/Rust/remediation/security/performance/build；
13. Windows/macOS、NSIS、unsigned DMG、dependency audit 与 package size 真实证据；
14. `TASK_08_IMPLEMENTATION_CLOSEOUT.md`（实现 closeout 与 PR #44 验证记录）；
15. 明确依赖/lockfile变化；
16. 停止等待人工代码级验收；
17. 不自动合并、不发布、不创建 Task 09。

## 9. Task 08 第四轮 review 收尾记录

- PDF extractor 已切换为纯 Rust cooperative bounded parser：object/decompressed/page/output/time/cancel、CMap entry/decoded-byte 和 literal/hex temporary-buffer 限制在解析过程中执行；O(1) 输出计数器和分块 deadline/cancel 检查覆盖长扫描，恶意压缩/decompression bomb、mid-flight timeout/cancel 和真实 text-layer PDF fixture 均有行为回归；不引入 Python、LibreOffice runtime、Tesseract、sidecar 或外部 executable，且 timeout/cancel 不发布 artifact/FTS。
- Provider settings 读取、enabled/configuration/validation 和 provider construction 现在全部发生在 `claim_provider_phase` 之前；配置错误、禁用、settings read/validation failure 不产生 owner 或 revision。claim 后的直接错误路径使用 run id/expected revision/provider owner/expected status CAS abort，失败不会留下 running owner。既有 interactive provider 的 run/item owner、revision 与 `BEGIN IMMEDIATE` publication transaction 仍保持；claim 拒绝已有 owner，artifact、FTS、item completion 同事务，所有 CAS 验证 changed=1，artifact CAS 冲突终止 item，completed item no-replay。双连接 contention 和故障注入证明失败 claimant/崩溃恢复不留下 running owner，也不产生第二通用 AI queue。
- provider send 绑定 run 的 library/root/policy/source revision，并在完整 orchestration 最后边界复核真实文件 size/mtime/hash；injectable fake provider 的 mutation-after-extraction 测试证明 provider request count 为零。
- PDF parser-only timeout/cancel 测试不再断言未参与执行的空数据库；新增真实 `process_content_run → candidate extraction → PDF parser → mid-flight deadline → failed item → terminal run` timeout-through-run 行为测试，断言 work started、有界耗时、`content_extractor_timeout`、无 running/cancelling、无 artifact/FTS。Content Search stale cursor、multi-root purge、delete/purge rollback、provider crash windows 和 UI Remount refresh 均由行为测试覆盖。本轮代码 head 为 `80bfabd7ce1d11d7dfbadb4ef8df9d875935e437`，code-head CI `30690147656` 成功；最终 docs-only branch tip/final-tip CI 由 PR #44 body 记录，停止等待第五轮人工验收，不得用旧 HEAD 或旧 benchmark 代替。
