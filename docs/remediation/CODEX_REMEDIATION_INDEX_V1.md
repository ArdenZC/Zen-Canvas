# Zen Canvas Codex Remediation Index V1

## 1. 当前执行状态

- Task 00 已通过 PR #16 完成人工验收并合并。
- Task 01A 已完成生产实施、人工验收并合并。
- Task 01B 已完成生产实施、条件验收并通过 PR #23 合并。
- Task 02 已通过 PR #26 合并，数据库推进至 schema 29。
- Task 03 已通过 PR #28 合并，合并提交为 `70427ff648dd5b9fab66e247fbf0a5ddf8912f45`，数据库推进至 schema 30。
- Task 03 最终接受的 exact reclaimable physical-union 遗留已由 Task 04 第一组生产改动关闭。
- Task 04 全局快捷搜索与命令面已完成生产实施，Draft PR 和 CI 待人工验收。
- Task 05–08 继续禁止执行。

| 阶段 | 任务书 | 产品模块/目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 后架构、安全和数据基线审计 | **已验收并合并** |
| 01A | `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md` | 扫描代际、run/session、scan_seen、stale safety、恢复 | **已验收并合并** |
| 01B | `TASK_01B_WATCHER_RECONCILIATION_OWNERSHIP.md` | Rust watcher owner、revision gap、overflow/startup reconciliation | **已验收并合并** |
| 02 | `TASK_02_IDENTITY_FINGERPRINT_AND_DUPE.md` | 模块 1：重复检测；Czkawka 对标；identity、fingerprint、durable dedupe、duplicate groups | **已合并，schema 29** |
| 03 | `TASK_03_ANALYSIS_RUN_FINDING_AND_DETECTORS.md` | 模块 2：大型文件/空间分析；Spacedrive V1 对标；Analysis Run、Detector、Finding | **已合并，schema 30** |
| 04 | `TASK_04_GLOBAL_SHORTCUT_SEARCH.md` | 模块 4：全局快捷搜索；Tolaria 设计级对标；window/hotkey/query/command surface | **实施完成，Draft PR 和 CI 待人工验收；schema 30** |
| 05 | 待创建 | 模块 5：文件库；TagSpaces 对标；Query V2、cursor、selection、tag、Saved View、Inspector | **等待 Task 04，禁止执行** |
| 06 | 待创建 | 模块 6：AI 整理预览；ai-file-sorter 概念级对标；Organization Plan、workspace、preview | **后续阶段，禁止执行** |
| 07 | 待创建 | 模块 7：自然语言规则；Accomplish + OpenCode 对标；Proposal 到受约束 Rule AST | **后续阶段，禁止执行** |
| 08 | 待创建 | 模块 8：本地内容理解；Local-File-Organizer 对标；Content Artifact、受控 extractor | **后续阶段，禁止执行** |

说明：原对标模块 3“扫描与索引”已经通过 Task 01A + Task 01B 完成；模块 1 通过 Task 02 完成；模块 2 通过 Task 03 完成。阶段编号从 Task 04 起继续对应剩余完整产品模块，不创建独立 debt-cleanup、03.5、04A 或其他新模块。

---

## 2. 固定的 8 模块对标主线

| 原模块 | Zen Canvas 功能 | 参考项目 | 借鉴深度 | 当前承载阶段 |
|---|---|---|---|---|
| 1 | 重复检测 | Czkawka | Rust 代码级思想对比，遵守许可证登记 | Task 02，已完成 |
| 2 | 大型文件列表/空间分析 | Spacedrive V1 | 概念级，主动拒绝其过度复杂架构 | Task 03，已完成 |
| 3 | 扫描与索引 | Spacedrive V1 | Job/Location/Indexer 概念级 + 事故复盘 | Task 01A/01B，已完成 |
| 4 | 全局快捷搜索 | Tolaria | AGPL 设计级，只读分析不移植 | Task 04，当前阶段 |
| 5 | 文件库 | TagSpaces | 设计级 | Task 05 |
| 6 | AI 整理预览 | ai-file-sorter | AGPL 概念级 | Task 06 |
| 7 | 自然语言规则 | Accomplish + OpenCode | 半代码级思想翻译，按实际许可证登记 | Task 07 |
| 8 | 本地内容理解 | Local-File-Organizer | 轻量设计级 | Task 08 |

每个模块必须是：

```text
一个完整功能模块
→ 一份人工编写任务书
→ 一个实施分支
→ 一个 Draft PR
→ 完整代码级验收
→ 遗留登记到下一完整模块
```

禁止将遗留问题单独包装成新阶段。

---

## 3. 唯一执行授权与文档优先级

每阶段开始前依次读取：

1. 根目录当前开发说明；
2. `docs/remediation/README.md`；
3. `docs/remediation/REMEDIATION_MASTER_PLAN_V1.md`；
4. 本索引；
5. 当前人工编写并批准的 `TASK_*.md`；
6. 已合并 closeout、测试和实际源码；
7. 涉及 UI 时读取当前 `docs/design/`；
8. 任务书指定的参考项目与 LICENSE。

生产实施必须同时满足：

```text
本索引指向该完整模块
+ 人工任务书存在
+ 任务书已位于当前 master
```

Task 04 的可执行判断是：当前 `master` 中存在且完整包含：

```text
docs/remediation/TASK_04_GLOBAL_SHORTCUT_SEARCH.md
```

不要再以任务书 PR 的旧 Draft/Open 文案作为额外阻断。

`BRIEF.md`、`00-overview.md` 和各参考分析文档用于模块映射、许可证和研究，不直接授权生产实施。它们不得自行改变人工任务书冻结的 schema、边界或阶段顺序。

任务书与架构设计由人工完成。Codex 只负责：

- 实施生产代码；
- migration（仅在任务书授权时）；
-测试与性能；
-原子提交；
-一个 Draft PR；
-Closeout；
-停止等待人工验收。

Codex 不得重新设计任务、拆分阶段或创建并行 PR。

---

## 4. 每阶段统一门禁

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

- 只修改任务书允许范围；
-先写或同步更新测试；
-不把兼容层变成永久双轨；
-不在 renderer 重复 Rust 的安全解析；
-不绕过 Managed Scope、Global Index、AI queue、preview、journal、Safe Trash 和 restore；
-不跨模块顺手重构；
-不得提前占用后续 schema；
-一个阶段只使用一个实施分支和一个 Draft PR；
-任务内部可使用原子提交，但不得拆成新的授权任务；
-上一阶段接受遗留必须先完成，然后继续完成整个当前产品模块。

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

数据库、性能、原生、权限和安全阶段还必须运行任务书规定的专项门禁。

---

## 5. 标准交付

每阶段：

1. 独立分支；
2. 一个 Draft PR；
3. 可审查的原子提交；
4. 连续完成整个产品模块；
5. 完整验证；
6. 提交 Closeout；
7. 停止等待人工验收；
8. 不自动合并或开始下一阶段。

---

## 6. 已冻结的核心边界

### Scan / Watcher

- File Library Managed Scan 与 Global Index 独立；
- scanner 是 `scan_seen` 和 generation 唯一 owner；
- Rust/Tauri 是 File Library watcher mutation/reconciliation owner；
- watcher 不写 `scan_seen`、不推进 generation；
- overflow、ambiguity 和 revision gap 升级 managed reconciliation；
- custom search roots 和 Global Index 不写 managed `files`。

### Identity / Dedupe

- 不迁移 `files.id`；
- operation/restore identity 与 dedupe physical identity 分离；
- `files.content_hash` 仅为兼容镜像；active duplicate groups 是重复权威；
- prehash 只淘汰，完整 BLAKE3 才确认；
- hardlink 多路径只算一个物理副本；
- dedupe 使用领域专用 durable runs，不泛化 `ai_jobs`；
- Duplicate Groups UI 只读。

### Analysis / Finding / Cleanup

- Analysis Run、Detector、Finding、Evidence、Decision 是 durable truth；
- Detector 使用固定 Rust allowlist；
- finding 是证据和建议，不是 mutation 授权；
- partial/cancelled detector 不发布 active findings；
- finding identity 变化生成新 key；
- AI 只能追加评估或提高风险；
- duplicate finding 永远只读；
-所有 cleanup mutation 必须经过 authoritative preview、identity、journal、Safe Trash 和 restore；
-不修改 operation/cleanup journal schema，不弱化 restore。

### Global Search

- `global_entries/global_entries_fts/global_volumes` 是唯一全局文件搜索 authority；
- Global Search 与 File Library Query/Managed AI scope 独立；
- disabled/stale source fail closed；
- open/reveal 只接受 entry ID 并由 backend revalidate；
- native providers/service 不因 UI 整改重建；
- command surface 不成为 mutation authority。

---

## 7. Task 03 合并时接受并转入 Task 04 的强制遗留

Task 04 第一组必须修复：

1. duplicate-group exact 与 Safe cleanup exact 对同一 physical subject 不得重复计数；
2. hardlink alias 不增加 exact；
3. keeper 不计为 reclaimable；
4. unrelated physical subjects 正常相加；
5. exact 与 potential 保持独立；
6. terminal、AI refresh、stale/revalidation 和 reopen 使用同一 physical-union；
7.结果不依赖 finding/HashMap 顺序；
8.修正 Task 03 Closeout 的 source HEAD、merge commit 和 CI 记录。

这些问题不得再次后移到 Task 05。

---

## 8. Task 04 冻结决定

1. Task 04 是完整全局快捷搜索模块，不是 exact-union 收尾任务。
2. 参考 Tolaria，但因 AGPL 只允许设计级借鉴，禁止源码或结构移植。
3. 第一组提交关闭 Task 03 exact physical-union 遗留。
4. schema 默认保持 30，不新增依赖或 lockfile。
5. Global Index 继续是唯一 search authority，不建设第二套索引。
6. Rust/Tauri 是 search window 与 global hotkey lifecycle owner。
7. 搜索使用 session/request identity，保证 latest-request-wins。
8. query response 必须表达 index health/completeness，partial 不得伪装 complete。
9. 排名与 tie-breaker 必须确定。
10. open/reveal backend revalidate enabled/stale/live identity。
11. command metadata 使用单一 Zen Canvas 自有 catalog；领域 adapter 拥有 availability/execute。
12. command 不得绕过 preview、journal、Safe Trash、restore 或执行 AI/finding suggestion。
13. standalone window、main modal 和 browser mock 共享语义但各自拥有 lifecycle。
14. keyboard、IME、ARIA、focus 和 reduced-motion 是验收内容。
15. File Library Query V2、跨页 selection、Tag、Saved Views、Inspector 留给 Task 05。
16. Organization Plan/AI 整理预览留给 Task 06。
17. Task 05 只能在 Task 04 人工验收并合并后创建任务书。

---

## 9. Task 04 实施入口

Codex 只需完整执行：

```text
docs/remediation/TASK_04_GLOBAL_SHORTCUT_SEARCH.md
```

唯一实施分支：

```text
remediation/04-global-shortcut-search
```

完成后新增：

```text
docs/remediation/TASK_04_IMPLEMENTATION_CLOSEOUT.md
```

并将本索引更新为：

```text
Task 04：实施完成，Draft PR 和 CI 待人工验收
Task 05：仍禁止执行
```

---

## 10. 后续完整模块契约

| 阶段 | 必须先回答 | 明确不做 | 专项验证 |
|---|---|---|---|
| 04 Global Shortcut Search | query/session、ranking、health、window、hotkey、command catalog、a11y | 不建第二索引、不做 File Query V2、不执行 mutation | rapid query、100k/1M、hotkey/window、IME/a11y、Windows/macOS |
| 05 File Library | snapshot/cursor、selection、Tag、Saved View、Inspector | 不把 Global Search cursor 当 Library cursor、不开始 Plan | concurrent scan/watcher、跨页选择、100k/1M、virtual list/a11y |
| 06 AI Organization Preview | Plan revision、identity expiry、diff、preview、workspace | 不直接执行模型输出、不绕过 journal | stale plan、confirm、restore、AI policy |
| 07 Natural Language Rules | proposal、allowlist AST、ambiguity、preview | 不生成 shell/SQL/绝对执行路径 | adversarial prompt、scope、preview、approval |
| 08 Local Content Understanding | artifact、extractor、budget、consent、retention | 不默认读取/上传内容、不把 trace 当 artifact | type/size/secret/cloud/local、migration、final integration |

---

## 11. 审计产物与持续硬边界

- `POST_MERGE_BASELINE_AUDIT.md`：当前进程、数据库、任务和安全边界；
- `REMEDIATION_CAPABILITY_MATRIX.md`：已有、部分、缺失、冲突和不应建设能力；
- `REMEDIATION_RISK_REGISTER.md`：Critical/High 风险与阶段门禁。

持续硬边界：

- 不建设第二套 Global Index；
-不泛化 Managed AI queue；
-所有用户文件变更继续走 server-authoritative preview、identity、journal、Safe Trash 和 restore；
-detector/finding/command 不直接执行 mutation；
-Path ID、Global native identity、operation identity、dedupe physical identity 和 AI fingerprint 保持明确领域边界；
-参考项目许可证边界优先于“同栈方便”；
-当前代码和测试是事实来源，人工任务书是执行授权来源。
