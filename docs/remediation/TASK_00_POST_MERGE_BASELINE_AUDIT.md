# Task 00 — Post-Merge Architecture Baseline Audit

## 1. 任务状态

- 状态：可执行
- 类型：只读代码审计 + 文档
- 生产代码修改：禁止
- 数据库 schema 修改：禁止
- 新依赖：禁止
- 后续阶段实现：禁止
- 建议分支：`remediation/00-post-merge-audit`
- 建议提交：`docs: establish post-merge remediation baseline`

---

## 2. 基线要求

仓库：

```text
ArdenZC/Zen-Canvas
```

当前 `master` 必须包含 PR #15 合并提交：

```text
a2c0516dc7a8628cb7210003da3d66f5d84f3a2f
```

开始时执行：

```bash
git checkout master
git pull --ff-only
git status --short
git rev-parse HEAD
git merge-base --is-ancestor a2c0516dc7a8628cb7210003da3d66f5d84f3a2f HEAD
```

要求：

- 工作区必须干净；
- 记录实际 `HEAD`；
- `merge-base --is-ancestor` 必须成功；
- 不要强制把 `master` 回退到合并提交；
- 不要以 PR #15 合并前源码作为当前实现事实。

创建分支：

```bash
git checkout -b remediation/00-post-merge-audit
```

若该分支已存在，先停止并汇报，不覆盖现有远端工作。

---

## 3. 任务目标

对 PR #15 合并后的 `master` 进行完整、代码级、可追溯的架构审计，回答：

1. 当前到底有哪些扫描、索引、watcher、任务、队列和 worker；
2. global index 与 managed data 的真实边界；
3. Windows MFT/USN 与 macOS Spotlight/FSEvents 如何协调；
4. Managed AI durable queue 的数据、状态、恢复和安全边界；
5. native file identity 与 fingerprint 当前如何表达；
6. 当前数据库 schema、migration 和持久化状态；
7. 应用内文件库查询与系统级搜索的关系；
8. 已有能力与整改规划的重叠、缺口和冲突；
9. 哪些候选能力应扩展、替换、延后或取消；
10. 后续任务应如何拆成可独立提交、测试和回滚的阶段。

所有结论必须包含源码证据。不得根据类名、旧 README 或之前的聊天结论推断当前实现。

---

## 4. 非目标

本任务不得：

- 修改 `src/`；
- 修改 `src-tauri/`；
- 修改 `tests/`；
- 修改 `.github/`；
- 修改 `package.json`、lockfile 或 Cargo 文件；
- 修改数据库 schema 或 migration；
- 添加依赖；
- 修复业务缺陷；
- 重构 Store、Tauri command、Rust 模块或 SQL；
- 实现 Job Runtime；
- 实现 scan generation；
- 实现 watcher queue；
- 实现 fingerprint；
- 实现 duplicate group；
- 实现 analysis finding；
- 实现 Organization Plan；
- 实现 Query V2 或 cursor；
- 实现 content artifact；
- 实现自然语言规则；
- 重构 Spotlight；
- 更新版本号；
- 发布 tag、release 或安装包；
- 开始 Task 01。

发现缺陷时只记录，不在 Task 00 修复。

---

## 5. 允许修改范围

只允许创建或修改：

```text
docs/remediation/
```

计划内输出：

```text
docs/remediation/POST_MERGE_BASELINE_AUDIT.md
docs/remediation/REMEDIATION_CAPABILITY_MATRIX.md
docs/remediation/REMEDIATION_RISK_REGISTER.md
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
```

只有发现本任务书存在事实错误时，才可以对 `TASK_00_POST_MERGE_BASELINE_AUDIT.md` 做最小修正，并必须在汇报中说明。

---

## 6. 开始前验证

先运行：

```bash
npm run typecheck
npm test
npm run test:remediation
npm run test:performance
npm run build
npm run verify:rust
```

若环境支持网络和审计工具，再运行：

```bash
npm run security:audit
npm run security:audit:rust
```

### 基线失败处理

若命令失败：

1. 不修复无关问题；
2. 记录命令、平台、退出码和关键错误；
3. 区分：
   - 环境或工具链问题；
   - 平台不匹配；
   - 网络/审计源问题；
   - 仓库当前代码问题；
4. 只读审计仍可继续；
5. 不得把失败伪造为成功；
6. 不得删除或放宽测试；
7. 最终 Draft PR 必须保留失败说明，由 CI 作为跨平台权威门禁。

---

## 7. 必须调查的范围

## 7.1 仓库与开发契约

调查：

- 根目录开发说明和文档优先级；
- 当前版本、scripts、feature flags；
- 前端、Rust、原生 helper/service 的构建关系；
- Windows/macOS 支持范围；
- CI 工作流、永久验证矩阵和性能门禁；
- release 与普通 PR 验证边界。

输出：

- 当前开发与验证命令表；
- 平台专用门禁；
- 不得在后续整改中破坏的 CI 契约。

---

## 7.2 数据库与 migration

列出所有当前数据库及其职责，例如但不限于：

- 主应用 SQLite；
- 全局搜索数据库；
- 服务或 staging 数据；
- 可能独立存在的 job/queue 数据。

必须列出：

- schema version；
- migration 文件或迁移入口；
- 所有与以下领域相关的表：
  - files；
  - FTS；
  - volumes/global entries；
  - rules；
  - AI jobs/queue；
  - operation journal/restore；
  - duplicate/hash；
  - scan/index；
  - settings；
  - user correction；
- 主要主键和外键；
- 哪些状态持久化；
- 哪些状态仅在内存；
- 哪些状态跨进程；
- 数据库之间如何关联；
- 迁移测试覆盖；
- 大表迁移风险。

输出数据库关系图，允许使用 Mermaid。

---

## 7.3 扫描、索引与 watcher

梳理完整调用链。

### Managed scan

- 前端入口；
- Tauri command；
- Rust coordinator；
- 遍历器；
- path filter；
- 批量写入；
- progress/cancellation；
- stale/revive；
- FTS optimize；
- dedupe/classification 后续触发。

### Global index

- volume discovery；
- enable/disable；
- Windows MFT；
- USN journal；
- Windows fallback；
- macOS Spotlight；
- FSEvents；
- initial build；
- incremental sync；
- rebuild；
- paused/error/degraded；
- opening/reveal；
- disabled volume isolation。

### Watcher/reconciliation

- 原始事件来源；
- debounce/coalesce；
- channel/backpressure；
- rename/create/modify/delete；
- retry；
- 是否持久；
- 应用退出或 renderer 卸载后的行为；
- overflow；
- 深度限制；
- 最终一致性由哪个层负责。

必须明确：

- global index 与 managed `files` 是否重复扫描；
- managed scope 如何定义；
- global entry 如何升级为 managed file；
- 是否已经存在 scan generation；
- 是否已经存在 durable reconciliation；
- 是否已有 root health；
- 多 root 是否是正式父子任务。

---

## 7.4 后台任务、队列和 worker

列出每一个：

- job manager；
- queue；
- worker；
- daemon/service；
- cancellation token；
- progress event；
- retry/backoff；
- backpressure；
- persistent job state；
- startup recovery；
- interrupted state；
- parent-child relationship；
- concurrency limit。

至少覆盖：

- Managed AI jobs；
- scan；
- dedupe；
- storage analysis；
- file execution；
- restore；
- global indexing；
- background index roots；
- search service；
- native helper/service。

对每项回答：

```text
领域专用还是通用？
内存还是持久？
单进程还是跨进程？
可取消吗？
可恢复吗？
有终态记录吗？
有失败明细吗？
适合扩展还是应保持隔离？
```

重点评估：

> Managed AI durable queue 是否适合作为通用 Job Runtime 的基础。

不得只因为它已有持久队列就默认泛化。必须比较其 schema、状态机、领域复核、worker 生命周期和其他任务需求。

---

## 7.5 文件身份、fingerprint 与重复检测

调查：

- native volume ID；
- native file ID；
- path 是否仍充当主身份；
- size/mtime 精度；
- content hash；
- 快速 hash；
- full hash；
- AI fingerprint；
- operation identity；
- restore identity；
- MFT/Spotlight identity；
- hard-link 行为；
- symlink/reparse point 行为；
- cache invalidation；
- dedupe phases；
- dedupe cancellation；
- 重复组是否持久化；
- 可释放空间如何计算。

输出：

- 当前身份模型；
- 各子系统身份不一致处；
- 是否可建立共享 fingerprint；
- 迁移到稳定 ID 的风险；
- 是否需要保留 path ID 兼容期。

---

## 7.6 Managed AI

梳理：

- job schema；
- job state；
- queue ownership；
- scope ownership；
- most-specific-scope；
- provider policy；
- key storage；
- fingerprint；
- cancellation；
- retry；
- backpressure；
- startup recovery；
- user correction；
- output schema validation；
- before/after provider revalidation；
- partial success；
- trace；
- error persistence；
- content/metadata 边界。

明确：

- 哪些能力已经完整覆盖原整改计划；
- 哪些能力只适用于 AI，不能泛化；
- 内容 Artifact 是否已部分存在；
- 是否存在从 unmanaged 文件绕过队列的路径；
- 不同 AI 入口是否全部收敛到同一安全边界。

只记录发现，不修改实现。

---

## 7.7 文件操作、预览和恢复

调查：

- operation preview；
- preview ID；
- source/target 权威解析；
- plan 是否存在；
- batch；
- pending journal；
- operation phase；
- file identity；
- no overwrite；
- protected path；
- cancellation；
- fault injection；
- startup reconciliation；
- restore preflight；
- partial restore；
- operation log retention；
- 执行后索引修复。

明确回答：

- 当前是否已经存在 Organization Plan；
- 当前 preview 与 plan 的区别；
- 用户 decision 是否持久；
- 建议变化后旧 decision 如何失效；
- 执行是否只依赖后端权威数据；
- 现有 journal 哪些部分必须原样保留。

---

## 7.8 文件库、查询和大列表

调查：

- FTS query builder；
- library scope；
- filter；
- sort；
- count；
- pagination；
- OFFSET；
- keyset cursor；
- query plan tests；
- 10万文件 benchmark；
- 前端虚拟化；
- page cache；
- selection；
- cross-page selection；
- Inspector data；
- organize queue loading；
- watcher invalidation；
- summary/detail DTO。

明确：

- 哪些筛选和排序在 SQLite；
- 哪些仍在 React；
- 是否会为了高级筛选拉取所有页；
- OFFSET 最大风险路径；
- PR #15 global search 与文件库查询能否共享协议；
- 哪些查询不适合 cursor；
- duplicate CTE 是否重复计算。

---

## 7.9 Spotlight 与命令系统

调查：

- 全局搜索窗口；
- CommandModal；
- command registry；
- shortcut；
- native menu；
- file/global search provider；
- result grouping；
- ranking；
- quota；
- query cancellation；
- recent files/history；
- disabled/unavailable filtering；
- activation/open/reveal；
- 测试覆盖。

明确：

- 是否已有 Search Provider 抽象；
- 命令是否有单一 manifest；
- 快捷键、菜单和命令是否可能漂移；
- recent 是否来自完整数据还是当前页面；
- 哪些 PR #15 能力必须保留。

---

## 7.10 规则和内容理解

调查：

- Rule AST；
- condition/operator allowlist；
- rule version；
- rule execution；
- classification fingerprint；
- AI classification input；
- 是否读取正文；
- 是否已有 extractor；
- OCR/图片理解；
- model/provider；
- prompt schema；
- ID/refId 校验；
- user correction；
- natural language rule；
- rule proposal；
- preview；
- scope。

明确：

- 自然语言规则是否应只编译为现有 Rule；
- 当前 Rule 是否足以表达规划中的条件；
- 内容 Artifact 是否必要；
- 哪些文件类型已有安全读取能力；
- 云端发送策略是否足够显式。

---

## 8. 必须生成的文档

## 8.1 `POST_MERGE_BASELINE_AUDIT.md`

至少包含：

1. 审计基线：实际 HEAD、平台、日期和验证结果；
2. 当前系统架构图；
3. 关键进程和数据域；
4. 数据库关系图；
5. 扫描/索引数据流；
6. Managed AI 数据流；
7. 文件操作和恢复数据流；
8. 所有后台任务/队列清单；
9. 文件身份模型；
10. 搜索与文件库查询模型；
11. 已有安全边界；
12. PR #15 对原整改计划的实际影响；
13. 建议保留、扩展、替换和不建设的模块；
14. 推荐的后续任务依赖图；
15. 关键源码入口表。

关键结论格式：

```markdown
### 结论：Managed AI queue 不应直接泛化为通用 Job Runtime

- 判定：……
- 源码依据：
  - `path/to/file.rs` — `SymbolName`
  - `path/to/schema.rs` — `table_name`
- 原因：……
- 后续建议：……
- 风险：……
```

---

## 8.2 `REMEDIATION_CAPABILITY_MATRIX.md`

逐项评估：

| 候选能力 | 当前状态 | 源码证据 | 结论 | 建议阶段 |
|---|---|---|---|---|
| Unified Job Runtime | 完整/部分/不存在/冲突/不应建设 | 文件与符号 | 保留/扩展/替换/取消 | Task ? |
| Scan Generation |  |  |  |  |
| Watcher Reconciliation Queue |  |  |  |  |
| File Fingerprint Cache |  |  |  |  |
| Duplicate Groups |  |  |  |  |
| Analysis Runs/Findings |  |  |  |  |
| Organization Plan |  |  |  |  |
| File Query V2 |  |  |  |  |
| Keyset Cursor |  |  |  |  |
| Cross-page Selection |  |  |  |  |
| Content Artifact |  |  |  |  |
| Natural Language Rule Proposal |  |  |  |  |
| Search Provider |  |  |  |  |
| Command Manifest |  |  |  |  |

状态只允许：

```text
完整存在
部分存在，可扩展
不存在
与现有架构冲突
不应建设
```

---

## 8.3 `REMEDIATION_RISK_REGISTER.md`

至少记录：

| ID | 风险 | 影响 | 概率 | 证据 | 缓解 | 阻塞阶段 |
|---|---|---|---|---|---|---|

必须覆盖：

- 重复建设全局索引；
- 泛化 Managed AI queue；
- 数据库大表迁移；
- path ID → stable ID；
- global/managed 数据越权；
- watcher renderer 依赖；
- 旧 decision 套用新建议；
- OFFSET 与实时更新；
- 内容隐私和云 provider；
- duplicate 可释放空间误算；
- operation journal 兼容；
- 跨平台原生 helper；
- 打包/卸载回归；
- 性能基准失真；
- 旧文档与当前代码漂移。

风险级别：

```text
Critical
High
Medium
Low
```

---

## 8.4 更新 `CODEX_REMEDIATION_INDEX_V1.md`

根据审计证据：

- 修正阶段顺序；
- 标记重叠能力；
- 合并或拆分阶段；
- 列出每阶段前置；
- 列出每阶段非目标；
- 列出每阶段预期 migration；
- 列出每阶段专项测试；
- 仍不得把 Task 01 标记为可执行。

更新后的 Task 00 状态：

```text
已完成，待人工验收
```

---

## 9. 验收标准

Task 00 通过必须同时满足：

- 生产代码零变化；
- schema 零变化；
- 依赖零变化；
- 所有修改都在 `docs/remediation/`；
- 每个关键结论都有具体源码文件和符号；
- 明确区分事实、推断和建议；
- 明确说明 PR #15 已覆盖哪些原规划；
- 明确说明哪些能力不能重复建设；
- 给出真实数据库和进程关系；
- 给出所有重要 task/queue/worker 清单；
- 后续阶段没有明显循环依赖；
- 每个后续阶段可独立提交和回滚；
- 没有把 Task 01 标记为可执行；
- `git diff --check` 通过；
- 工作区只包含预期文档变化。

---

## 10. 完成后验证

执行：

```bash
git diff --check
git status --short
git diff --stat
git diff -- docs/remediation/
```

再次执行至少：

```bash
npm run typecheck
npm test
```

由于本任务只有文档变化，若前后结果不同，必须说明原因，不得自行修复生产代码。

---

## 11. 提交与 Draft PR

提交：

```bash
git add docs/remediation
git commit -m "docs: establish post-merge remediation baseline"
git push -u origin remediation/00-post-merge-audit
```

创建 Draft PR，标题建议：

```text
docs: establish post-merge remediation baseline
```

PR 描述必须包含：

- 基线 HEAD；
- 审计范围；
- 新增文档；
- 关键结论摘要；
- 所有验证结果；
- 未运行的验证及原因；
- 明确声明无生产代码、schema、依赖变化；
- 明确声明未开始 Task 01。

---

## 12. 最终汇报格式

1. 实际基线 HEAD；
2. 调查过的核心文件和符号；
3. 当前真实架构摘要；
4. PR #15 已覆盖的原规划能力；
5. 仍需建设的能力；
6. 不应建设或不应泛化的能力；
7. 高风险冲突；
8. 新增和修改的文档；
9. 所有验证命令结果；
10. 提交 SHA；
11. Draft PR；
12. 明确声明：

```text
Task 00 已完成并停止。未开始 Task 01，等待人工验收。
```
