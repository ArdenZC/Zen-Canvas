# Zen Canvas 对标整改执行指令（Claude Code Brief）

> **用法**：将本文件放入仓库 `docs/remediation/BRIEF.md`，在 Zen Canvas 仓库根目录启动 Claude Code 后，让它先完整阅读本文件；或直接把全文粘贴为首条指令。
> **优先级**：本 Brief 是任务优先级的唯一来源；仓库代码的实际行为是事实的最高来源。二者与任何旧讨论、旧矩阵冲突时，以此为准。

---

## 0. 角色与总目标

你是 Zen Canvas（本仓库）的整改分析与实施工程师。工作分两个阶段：

- **阶段 A（最先执行）**：接手并处置 PR #18（由 GPT 生成的改动），产出评审结论，未经用户批准不合并、不关闭。
- **阶段 B**：按第 4 节的模块顺序，逐模块产出代码级整改方案（`docs/remediation/<nn>-<slug>.md`），每个模块方案获批后才进入实施或下一模块。

贯穿两个阶段的第一原则：**证据优先**。任何关于任一仓库的断言必须附 `文件路径:行号区间`；找不到就写"未找到"，禁止臆造文件、函数或行为。

---

## 1. 环境准备

1. **基线**：Zen Canvas 当前 `master`（≥ v0.1.39，含 2026-07-10 全仓库审计整改）。记录基线 commit SHA 到 `docs/remediation/00-overview.md`。
2. **参考仓库**：浅克隆到 `../refs/`（**只读**，禁止把其中任何代码复制进本仓库，例外见第 3 节许可证门）：

   ```bash
   git clone --depth 1 --branch v0.4.3 https://github.com/spacedriveapp/spacedrive ../refs/spacedrive-v1
   git clone --depth 1 https://github.com/qarmin/czkawka        ../refs/czkawka
   git clone --depth 1 https://github.com/refactoringhq/tolaria ../refs/tolaria
   git clone --depth 1 https://github.com/accomplish-ai/accomplish ../refs/accomplish
   git clone --depth 1 https://github.com/hyperfield/ai-file-sorter ../refs/ai-file-sorter
   git clone --depth 1 https://github.com/QiuYannnn/Local-File-Organizer ../refs/local-file-organizer
   git clone --depth 1 https://github.com/tagspaces/tagspaces   ../refs/tagspaces
   ```

   - Spacedrive 必须锚定 `v0.4.3`（V1 架构）。其 master 已是重写方向，可另拉一份浅克隆仅作方向参考，但矩阵对比一律以 v0.4.3 为准。
   - Accomplish 的 agent 核心委托给 OpenCode（见其依赖 `@opencode-ai/sdk`）。分析"模型适配 / 工具边界"时，按其 package.json 追溯上游 OpenCode 仓库并浅克隆到 `../refs/opencode`。
   - 每个参考仓库记录克隆到的 commit SHA。
3. **许可证登记（首个动作之一）**：读取每个参考仓库的 LICENSE 原文，将实际许可证登记进 `00-overview.md` 的许可证表。任何仓库在登记完成前，一律按"仅思想借鉴"处理。
4. **验证基线**：先在干净工作区跑一遍并记录结果——`npm run typecheck`、`npm test`、`npm run test:performance`、`cargo test`（src-tauri）、`cargo clippy`、`cargo fmt --check`；完整门槛沿用仓库既有 `npm run verify`。后续所有改动以"不低于此基线"为最低验收线。

---

## 2. 阶段 A：接手 PR #18

1. 读取 PR：`gh pr view 18 --json title,body,headRefName,baseRefName,commits,files` 与 `gh pr diff 18`；若无 `gh`，用 `git fetch origin pull/18/head:pr-18`。
2. 产出 `docs/remediation/pr-18-review.md`，包含：
   - **PR 意图**：仅依据其描述与 diff 重述，不补充假设。
   - **逐文件评审**：与审计后 master 的既有不变量是否冲突。重点核对：受保护路径与清理白名单；操作 / 恢复 / Safe Trash journal 及启动对账；任务身份、取消与重入；IPC 与规则运行时校验；分页与虚拟化的数据源；密钥的系统凭据库存储。
   - **测试影响**：现有前端与 Rust 测试套件在该分支是否全绿；PR 是否附带新测试；缺哪些。
   - **结论（三选一）**：可直接继续（附补齐清单）/ 修正后继续（附逐条修正点）/ 建议关闭重做（附理由与替代路径）。
3. **红线**：不合并、不 force-push、不关闭 PR、不在其分支上继续提交——先呈报评审结论，等用户裁决。
4. 若裁决为"继续"：将 PR 内容映射到第 4 节对应模块，登记为该模块的"已有进展"，后续该模块方案必须显式引用它，避免重复实现或方向冲突。

---

## 3. 硬性守则（全程有效）

**证据规则**
- 每份模块文档末尾附"证据清单"：列出本文档引用过的全部 `路径:行号`（两侧仓库分开列）。
- 引用参考仓库代码仅限说明所需的最小摘录，并注明 `仓库@SHA 路径:行号`。

**基线规则**
- 对比对象是当前 master。旧矩阵的**每一条前提**在使用前必须先在代码里重验。已知两处过时：`dedupe.rs` 已存在（任务管理、取消标记、BLAKE3 完整哈希、文件身份检查、批量写入、进度事件）；建议列表已用 `@tanstack/react-virtual`（含 overscan 与键盘交互）。同理，journal、任务身份、watcher 有界合并、受保护路径等审计成果可能已覆盖矩阵假设的其他缺口——一律以代码实测为准。

**许可证门**
- Zen Canvas 无开源许可证（专有，© Startlan）。因此：
  - AGPL / GPL 系（预期含 Spacedrive、TagSpaces，以 LICENSE 实测为准）：**只允许概念与架构层借鉴**。禁止复制代码，也禁止"改写式移植"（照着源码逐段翻译等衍生行为）。
  - MIT（预期含 Czkawka、Accomplish，以实测为准）：允许有限复用，但每次复用必须在 `00-overview.md` 的"引入登记表"记录来源文件、许可证与修改说明；默认仍优先自研，仅借结构与思路。
  - 未确认许可证（如 Tolaria）：按 AGPL 同级处理，直至确认。

**安全边界规则（不得回退）**
以下 Zen Canvas 既有安全属性，任何方案与实施都不得削弱；参考项目与此冲突时，保留 Zen Canvas 的做法并在"拒绝清单"中说明：
- 启动不自动扫描；扫描只建索引和建议。
- 删除只作为建议，不执行（MVP 边界）。
- 敏感文件只显示建议与原因，不生成默认可执行勾选。
- 冲突、低置信、规则接近项默认进入待确认队列。
- 所有移动 / 重命名必须先经预览确认；执行层二次校验操作类型、绝对路径、安全文件名、源路径一致性、系统目录与覆盖冲突。
- 恢复只覆盖本应用执行过的操作；journal 与启动对账机制保持权威。
- AI API Key 保持存放于系统凭据库。

**范围与产出规则**
- 只做第 4 节的 8 个模块，不新发明模块。
- 禁止"感想式"建议：每条建议必须能落到具体文件、接口或表结构的修改。
- 实施阶段：一个模块一个分支 + PR 系列；涉及数据库迁移必须提供 up/down 与迁移测试；破坏性变更显式标注并先获批准。

---

## 4. 模块顺序、参考与对比深度

按下表顺序推进。**每完成一个模块的方案文档即停下呈报**，获批后才实施该模块或开始下一模块（用户可改为批量推进）。

| # | 模块 | 参考仓库 | 对比深度 | 锚定版本 |
|---|------|---------|---------|---------|
| 1 | 重复检测 | Czkawka（重点 `czkawka_core` 的 duplicate 流水线） | 代码级（同为 Rust） | 最新 release tag，记录 SHA |
| 2 | 大型文件列表 | Spacedrive V1 + 第 6 节自查题 | 概念级 | v0.4.3 |
| 3 | 扫描与索引 | Spacedrive V1（Job / Location / Indexer） | 概念级 + 事故复盘 | v0.4.3 |
| 4 | 全局快捷搜索 | Tolaria | 代码级（同栈 Tauri + React + TS） | main，记录 SHA |
| 5 | 文件库 | TagSpaces | 设计级 | 最新 release |
| 6 | AI 整理预览 | ai-file-sorter | 设计级（C++ / Qt，栈不同） | 最新 release |
| 7 | 自然语言规则 | Accomplish（agent 核心追溯至 OpenCode） | 半代码级（MIT，Electron 栈需翻译） | main，记录 SHA |
| 8 | 本地内容理解 | Local-File-Organizer | 轻量设计级（Python 工具，量级有限） | main |

对"概念级 / 设计级"的模块，模板第 2 节允许省略无法适用的栏目（如对 Local-File-Organizer 不必强填状态机与并发模型），但必须写明省略原因。对 Spacedrive V1，第 2 节必须额外包含一小节"它为何失败"：结合其架构复杂度分析哪些设计是我们要**主动拒绝**的（其团队自述 V1 至 2025 年初已不可维护并暂停开发）。

---

## 5. 每模块统一模板（7 节 + 证据清单）

输出到 `docs/remediation/<nn>-<slug>.md`（如 `01-dedupe.md`）：

1. **Zen Canvas 现状**：涉及的 Rust / TS / React / SQL 文件；调用链起点与经过的函数；当前数据结构；Tauri command 与 event；Zustand / UI 状态；取消、错误、重试与持久化方式；当前测试覆盖；已做得好的部分；实际存在的问题。
2. **参考实现**：源码路径；核心 struct / class / trait；状态机；数据流；并发方式；缓存方式；UI 组件；为什么这样设计；它解决了什么规模或可靠性问题。
3. **逐项差异表**：`对比点 | Zen Canvas | 参考 | 结论` 四列。
4. **借鉴与拒绝清单**：直接采用 / 简化后采用 / Zen Canvas 已更优 / 不适合的设计 / 许可证禁止复制的部分。
5. **目标设计**：目标数据模型；Rust 模块结构；数据库字段或新表；Tauri command；event payload；TypeScript DTO；前端组件结构；页面交互；错误码；取消与恢复语义。
6. **文件级修改清单**：精确到文件路径，逐条列出"改什么、为什么"。
7. **实施拆分**：Task 1 数据模型与迁移 → Task 2 Rust 核心 → Task 3 Tauri 接口 → Task 4 前端状态 → Task 5 页面 → Task 6 单元测试 → Task 7 集成与性能测试。每个 Task 标注优先级、依赖、风险、是否涉及数据库迁移、是否可能破坏性变更、验收标准。
8. **证据清单**（见第 3 节证据规则）。

---

## 6. 各模块必答的种子问题

**1 重复检测（vs Czkawka）**
- 当前"按大小分组后直接 BLAKE3 完整哈希"是否需要增加预哈希阶段（仅读前 N KB 先淘汰）？在典型个人盘规模下收益如何量化？
- 哈希结果是否跨次运行持久化缓存？失效键用什么（path + size + mtime，或结合已有文件身份检查）？
- 结果分组模型与 UI 呈现如何组织；取消语义如何与既有任务身份体系对齐。

**2 大型文件列表（自查为主）**
- 分页是否真正下沉到 SQLite？用的是 keyset / cursor 还是 OFFSET？
- 虚拟列表的数据源是否仍一次性全量加载？
- 选择状态能否基于后端权威 ID 跨页、跨刷新稳定存在？写入之后的缓存失效路径是什么？

**3 扫描与索引（vs Spacedrive V1）**
- 遍历、入库、清 stale 是否拆成显式 phase 并统一进度协议？
- watcher overflow 后是否标记 scan root 为 degraded 并触发 reconciliation，而不是只向前端发一次错误事件？
- 是否需要轻量 `ScanRoot` 领域对象与 `index_health`、`scan_runs` 等新表（作为候选设计，以现状分析结论为准）？
- 明确写出 Spacedrive 通用 Job 基建中我们拒绝引入的复杂度及理由。

**4 全局快捷搜索（vs Tolaria）**
- 命令面板的键盘状态机、焦点管理、结果分组与命令执行如何组织。
- 对照 Tolaria 的两个模式：可见性过滤在命令边界统一处理；重型过滤任务下沉到 Tokio blocking pool 以避免冻结 UI 线程。

**5 文件库（vs TagSpaces）**
- 文件列表、筛选模型、标签、详情面板、预览与批量操作的信息架构；哪些交互值得设计级借鉴。

**6 AI 整理预览（vs ai-file-sorter）**
- Dry-run 计划对象、逐项审核、修改建议、Undo Plan 的数据结构。
- 借鉴其分类缓存、taxonomy 归一化与会话内一致性提示，评估如何嫁接到我们的四区解释模型上。

**7 自然语言规则（vs Accomplish / OpenCode）**
- 目录授权模型、Agent 工具边界、执行审批与过程日志的设计。
- 模型适配层实际位于 OpenCode：评估是引入类似运行时还是自研最小闭环；结论必须给出维护成本对比。

**8 本地内容理解（vs Local-File-Organizer）**
- 文本提取、图片理解、提示词与结构化输出 schema、按文件类型的适配层。仅作管线与提示词参考，不作架构参考。

---

## 7. 交付物清单

- `docs/remediation/pr-18-review.md`（阶段 A）
- `docs/remediation/00-overview.md`：基线与参考仓库 SHA、许可证表、MIT 引入登记表、跨模块依赖、合并后的任务总清单与进度表
- `docs/remediation/01-dedupe.md` … `08-content-understanding.md`
- 实施阶段：每模块独立 PR 系列 + 测试，并同步更新 `00-overview.md`

---

## 8. 停点与沟通协议

每个停点（PR #18 评审完成、每份模块方案完成、每个实施 Task 完成）用固定格式汇报：

```
完成：<一句话>
证据：<关键 路径:行号，或 PR/commit 链接>
待决策：<需要用户拍板的问题，无则写"无">
建议下一步：<一句话>
```

不确定的事实先查代码，再不确定就提问。禁止在不确定时编造仓库内容。