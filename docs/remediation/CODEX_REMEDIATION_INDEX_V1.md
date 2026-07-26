# Zen Canvas Codex Remediation Index V1

## 1. 执行状态

当前只允许执行 **Task 00**。Task 00 的代码级审计已完成，状态转为**待人工验收**；人工验收前不得执行任何后续 Task。

Task 01 及之后的名称、顺序和范围都是暂定项，必须等待 Task 00 的代码级审计结论和人工验收后再冻结。

| 阶段 | 任务书 | 目标 | 状态 |
|---|---|---|---|
| 00 | `TASK_00_POST_MERGE_BASELINE_AUDIT.md` | PR #15 合并后代码、数据和安全边界审计 | **待人工验收** |
| 01 | 待创建 | Scan Generation、Watcher Reconciliation 与恢复基础 | 暂定，禁止执行 |
| 02 | 待创建 | 原生身份、fingerprint、prehash 与 duplicate group/finding | 暂定，禁止执行 |
| 03 | 待创建 | Analysis Run、Finding 与 detector | 暂定，禁止执行 |
| 04 | 待创建 | File Query V2、snapshot、cursor 与跨页 selection | 暂定，禁止执行 |
| 05 | 待创建 | Organization Plan 后端领域模型 | 暂定，禁止执行 |
| 06 | 待创建 | 整理工作区迁移到持久化 Plan | 暂定，禁止执行 |
| 07 | 待创建 | 文件库标签、Saved Views、Inspector 分层 | 暂定，禁止执行 |
| 08 | 待创建 | Content Artifact 与受控 Extractor | 暂定，禁止执行 |
| 09 | 待创建 | 自然语言 Proposal 到受约束 Rule AST | 暂定，禁止执行 |
| 10 | 待创建 | Spotlight Provider 与 Command Manifest | 暂定，禁止执行 |
| 11 | 待创建 | 数据迁移、10万/100万性能与跨平台整合验收 | 暂定，禁止执行 |

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

Task 00 完成后，本索引的下一状态应是：

```text
Task 00：待人工验收
Task 01：仍不可执行
```

只有人工审核明确通过后，才创建 `TASK_01_*.md` 并把 Task 01 标记为可执行。

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

## 6. Task 00 后的人工决策点

审计后必须由人工确认：

- 是否建立通用 Job Runtime；
- Managed AI queue 是否只保持领域专用；
- global index 与 managed scan 的复用边界；
- watcher 是否已经具有 durable reconciliation；
- native identity 是否足以作为 fingerprint 基础；
- 当前 duplicate/cache 是否需要迁移；
- Organization Plan 是否应先于 Query V2；
- 哪些 OFFSET 查询需要 cursor；
- content artifact 是否已有可扩展基础；
- 哪些旧文档需要归档或标记过时。

未完成这些决策前，不得实施 Task 01。

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

## 8. 审计后暂定阶段契约（全部不可执行）

| 阶段 | 必须先回答 | 明确不做 | 可能涉及的数据变化 | 专项验证/回滚 |
|---|---|---|---|---|
| 01 Scan/Watcher | owner、generation、overflow、cursor、crash recovery | 不重建 Global Index，不统一所有队列 | 先写契约和 fixture；是否建 run/change 表待批准 | kill/restart、overflow、duplicate replay；旧 rescan 保留 |
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

只有人工确认每阶段的前置条件、非目标、数据迁移和 rollback 后，才可创建对应 `TASK_0N_*.md`；在此之前不得创建 Task 01 任务书、代码或 schema。
