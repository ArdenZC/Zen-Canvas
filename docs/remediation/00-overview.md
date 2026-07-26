# Zen Canvas 对标整改总览

> 本文件是 `docs/remediation/BRIEF.md` 第 7 节要求的跨阶段总览：基线、参考仓库 SHA、许可证表、MIT 引入登记表、跨模块依赖、任务总清单与进度。
> 建立时间：2026-07-26。所有 SHA 与许可证均为实测记录，非引用二手描述。

---

## 1. Zen Canvas 基线

| 项 | 值 |
|---|---|
| 仓库 | `ArdenZC/Zen-Canvas` |
| 默认分支 | `master` |
| **基线 commit SHA** | `3b3d7b8178368058b15eddf026bf0cdbf01e9b34` |
| 基线提交标题 | `docs: finalize File Library scan generation task (#17)` |
| 版本 | `0.1.40`（`package.json:3`） |
| 数据库 schema | 26（`src-tauri/src/db/schema.rs:7` @ master） |
| 许可证 | **无开源许可证（专有，© Startlan）** |

### 1.1 基线验证结果（在 master `3b3d7b8` 实测）

| 命令 | 结果 |
|---|---|
| `cargo test --features desktop-runtime --lib` | **400 passed / 0 failed / 1 ignored**（exit 0） |

在 PR #18 head `c259fa7` 实测的对照结果见 `pr-18-review.md` 第 6 节（前端 478 测试通过；Rust 完整套件 exit 0）。

**尚未在 master 上执行**：`npm run typecheck`、`npm test`、`npm run test:performance`、`cargo clippy`、`cargo fmt --check`、`npm run verify:security`。这些将在进入模块 1 实施前补齐，作为"不低于基线"的完整验收线。

---

## 2. 参考仓库（`../refs/`，只读）

克隆位置：`F:\Coding\refs\`（相对本仓库为 `../refs/`）。磁盘占用合计约 442 MB。

| 目录 | 仓库 | 锚定 | commit SHA |
|---|---|---|---|
| `spacedrive-v1` | spacedriveapp/spacedrive | tag **`0.4.3`** | `2ee62186a296115f825dbad43c9c2c35c6d10186` |
| `czkawka` | qarmin/czkawka | 默认分支 | `3c3523a8c00f2bf643db6f449542c1558b1db0d4` |
| `tolaria` | refactoringhq/tolaria | 默认分支（`alpha-v2026.7.24-alpha.0004`） | `a904e2f96ae634c05155abdf05a89456a8f54f52` |
| `accomplish` | accomplish-ai/accomplish | 默认分支 | `2cf74d08f22078b8b1fd3f97bff3ec4612262613` |
| `opencode` | sst/opencode | tag **`v1.14.18`** | `23fb5e0516c99ac04a1aa46c193efda2e1b9bb24` |
| `ai-file-sorter` | hyperfield/ai-file-sorter | 默认分支 | `cd9a024219b9434fb0a1df6b272f7145d9c67b28` |
| `local-file-organizer` | QiuYannnn/Local-File-Organizer | 默认分支（`new_version`） | `a19559942a35d98e9d2168fa58f288d9ea294bc6` |
| `tagspaces` | tagspaces/tagspaces | 默认分支 | `7ec3a2e8632b8bf5db685436e6d2d8805977a880` |

### 2.1 克隆备注

- **Spacedrive**：Brief 写的 `--branch v0.4.3` 克隆失败——上游 tag 名为 `0.4.3`，**无 `v` 前缀**（`git ls-remote --tags` 实测）。已用正确 tag 重新克隆。仓库另有 `v2.0.0-alpha.*` 系列 tag，属重写后的 V2 方向，**不作为矩阵对比依据**。
- **OpenCode**：按 Brief 第 1.2 节要求从 Accomplish 的依赖追溯。Accomplish 锁定 `@opencode-ai/sdk` 与 `opencode-ai` 均为 `1.14.18`（`accomplish/apps/desktop/package.json:73-74`、`accomplish/apps/daemon/package.json:20`），上游仓库由 `accomplish/apps/desktop/package.json:2` 的注释明确指向 `sst/opencode`。因此锚定 tag `v1.14.18` 而非 main，保证与 Accomplish 实际使用的版本一致。
- **Tolaria / Local-File-Organizer**：无 release tag，锚定默认分支 HEAD。

---

## 3. 许可证表（实测）

**读取方式**：直接读各仓库的 LICENSE 原文首部与 crate 清单的 `license` 字段，不依赖 README 或第三方描述。

| 仓库 | 实测许可证 | 证据 | Zen Canvas 可用边界 |
|---|---|---|---|
| spacedrive @ `0.4.3` | **AGPL-3.0-only** | `spacedrive-v1/LICENSE`；`spacedrive-v1/Cargo.toml:17` | **仅概念与架构层借鉴**。禁止复制代码，禁止改写式移植 |
| czkawka（`czkawka_core`） | **MIT** | `czkawka/czkawka_core/Cargo.toml:8`；`czkawka/LICENSE_MIT_EVERYTHING_OUTSIDE_ANY_CARGO_APP_LIBRARY` | **允许有限复用**，每次复用必须登记到第 4 节 |
| czkawka（`cedinia`、`krokiet`） | **GPL-3.0-only** | `czkawka/cedinia/Cargo.toml:8`；`czkawka/krokiet/Cargo.toml:8` | **仅概念借鉴**。非模块 1 的对比目标，但不得误取 |
| tolaria | **AGPL-3.0** | `tolaria/LICENSE` | **仅概念与架构层借鉴** |
| accomplish | **MIT** | `accomplish/LICENSE` | **允许有限复用**，须登记 |
| opencode | **MIT** | `opencode/LICENSE` | **允许有限复用**，须登记 |
| ai-file-sorter | **AGPL-3.0** | `ai-file-sorter/LICENSE` | **仅概念与架构层借鉴** |
| local-file-organizer | **MIT** | `local-file-organizer/LICENSE` | **允许有限复用**，须登记 |
| tagspaces | **AGPL-3.0** | `tagspaces/LICENSE.txt` | **仅概念与架构层借鉴** |

### 3.1 与 BRIEF 预期的偏差（需要注意）

Brief 第 3 节按"预期"分类，实测后有两处需要收紧：

1. **ai-file-sorter 实测为 AGPL-3.0**，Brief 的 AGPL 预期名单里没有它。**模块 6「AI 整理预览」必须降为纯概念级借鉴**——即使 Brief 把它定为"设计级"，也不得出现任何形式的源码复制或逐段改写。其分类缓存、taxonomy 归一化等做法只能作为思路输入，实现必须自研。
2. **tolaria 实测确认为 AGPL-3.0**（Brief 标记为"未确认，按 AGPL 同级处理"）。这与 Brief 第 4 节把模块 4 定为"**代码级**对比（同栈 Tauri + React + TS）"存在张力：同栈 + AGPL 是最容易发生"改写式移植"的组合。因此模块 4 的"代码级"深度限定为——**可以逐行阅读并写出差异分析，产出必须是独立设计**；文档中引用其源码不得超过说明所需的最小摘录，且必须标注 `仓库@SHA 路径:行号`。

### 3.2 czkawka 许可证结构说明

czkawka 仓库根目录的 MIT 文件名为 `LICENSE_MIT_EVERYTHING_OUTSIDE_ANY_CARGO_APP_LIBRARY`，字面含义是"MIT 适用于任何 cargo app/library 之外的一切"，各 crate 的实际许可证以自身 `Cargo.toml` 的 `license` 字段为准。**模块 1 的对比目标 `czkawka_core` 明确为 MIT**，可有限复用。图标资源另按 CC BY 4.0（`czkawka/LICENSE_CC_BY_4_ICONS`），本项目不涉及。

---

## 4. MIT 引入登记表

> 规则（Brief 第 3 节）：默认优先自研，仅借结构与思路。任何实际复用 MIT 代码的行为，必须在此登记来源文件、许可证与修改说明，并在代码中保留版权声明。

| # | 引入日期 | 目标文件（Zen Canvas） | 来源 | 许可证 | 修改说明 |
|---|---|---|---|---|---|
| — | — | — | — | — | *尚无引入* |

---

## 5. 跨模块依赖

```
模块 3 扫描与索引  ──┬─→ 模块 1 重复检测（依赖 scan 的 generation / 索引新鲜度语义）
                    ├─→ 模块 2 大型文件列表（依赖 files 表与查询协议）
                    └─→ 模块 5 文件库（依赖扫描范围与索引健康）
模块 2 大型文件列表 ──→ 模块 5 文件库（列表与筛选的数据源）
模块 8 本地内容理解 ──→ 模块 6 AI 整理预览（提取管线是预览的输入）
模块 7 自然语言规则 ──→ 模块 6 AI 整理预览（规则产出进入预览与审核）
模块 4 全局快捷搜索 ──→ 独立（依赖既有 global_index，不依赖其他整改模块）
```

**当前已知的硬约束**：

- PR #18 已在 master 之外建立 schema 27 的扫描账本（`scan_roots / scan_sessions / scan_runs / scan_session_roots / scan_seen / scan_run_errors`）。按 Brief 2.4，它登记为**模块 3 的已有进展**，模块 3 方案必须显式引用它，不得另起炉灶。
- 模块 1 的许可证前置已解除：`czkawka_core` = MIT，允许有限复用（须登记）。

---

## 6. 任务总清单与进度

### 6.1 阶段 A：PR #18

| 项 | 状态 | 产出 |
|---|---|---|
| PR #18 评审 | ✅ 完成 | `pr-18-review.md`，结论「修正后继续」 |
| 用户裁决 | ✅ 已下达 | 裁决 1–4（见 `pr-18-review.md` 第 7 节与本文件 6.3） |
| 裁决 1 前提核实 | ✅ 完成 | 前提成立，但发现事实基础需修正——见 `pr-18-review.md` 第 4.1b 节 |
| 裁决 5（gate 默认 `true`） | ✅ 已下达 | kill switch，非 rollout flag |
| M1–M6 实施 | ✅ 完成，待验收 | `m1-m6-implementation.md`；分支 `remediation/01a-scan-generation-fixes` |
| S1–S5 | ⏳ 未开始（未获批准，未改动） | — |

### 6.2 阶段 B：环境准备

| 项 | 状态 |
|---|---|
| 参考仓库浅克隆（8 个，含 OpenCode） | ✅ 完成，SHA 已记录（第 2 节） |
| 许可证实测与登记 | ✅ 完成（第 3 节），发现 2 处需收紧（3.1 节） |
| 基线 commit SHA 记录 | ✅ 完成（第 1 节） |
| 基线验证（完整 `npm run verify` 门槛） | 🔶 部分完成——master 侧仅跑了 `cargo test --lib` |

### 6.3 已解决的阻塞项

裁决 1 的事实基础曾被核实推翻：master 每次扫描都无条件执行 stale 清理（`master:src-tauri/scanner.rs:345-347,634-636`），PR #18 默认不再执行——即"从查变成不查"，而非"保持现状"。

**裁决 5 已解决**：gate 默认值取 `true`，性质由"发布前标志"改为"紧急回退开关"。裁决 1 的语义保留，但适用场景从常态变为异常路径。实施见 `m1-m6-implementation.md`。

### 6.4 待模块 3 承接的设计缺口

索引健康信号（`scan_roots.needs_reconciliation` / `health_status`）目前**只写不读**——没有任何生产代码或 UI 消费它，也没有任何机制会执行对账。这是裁决 2.4 的回答，详见 `m1-m6-implementation.md` 第 6 节。模块 3 方案必须回答谁消费、何时触发、对账动作是什么、如何退出。

### 6.4 阶段 B：模块（**未开始，按 Brief 第 4 节顺序**）

| # | 模块 | 参考仓库 | 对比深度 | 状态 |
|---|---|---|---|---|
| 1 | 重复检测 | czkawka（`czkawka_core`，MIT） | 代码级 | ⏳ 未开始 |
| 2 | 大型文件列表 | Spacedrive V1 + 自查 | 概念级 | ⏳ 未开始 |
| 3 | 扫描与索引 | Spacedrive V1 | 概念级 + 事故复盘 | ⏳ 未开始（PR #18 为已有进展） |
| 4 | 全局快捷搜索 | Tolaria（AGPL，见 3.1） | 代码级（读析，非移植） | ⏳ 未开始 |
| 5 | 文件库 | TagSpaces（AGPL） | 设计级 | ⏳ 未开始 |
| 6 | AI 整理预览 | ai-file-sorter（**AGPL**，见 3.1） | 概念级（自 Brief 的"设计级"收紧） | ⏳ 未开始 |
| 7 | 自然语言规则 | Accomplish + OpenCode（均 MIT） | 半代码级 | ⏳ 未开始 |
| 8 | 本地内容理解 | Local-File-Organizer（MIT） | 轻量设计级 | ⏳ 未开始 |

### 6.5 独立立项

| 项 | 状态 | 产出 |
|---|---|---|
| `file_ops` 测试并行不稳定性（裁决 4） | ✅ **根因已确认**，修复待实施 | `issue-file-ops-flaky.md` |

根因：Windows 文件共享冲突（`os error 32` / `ERROR_SHARING_VIOLATION`）——资源压力下外部进程短暂持有测试临时文件句柄。影响至少 5 个 `file_ops` 用例。**产品代码无缺陷**；`target_committed_identity_mismatch → manual_review` 是执行层安全校验的正确响应。已确认不影响 M1–M6 的测试组。

---

## 7. 安全边界（贯穿全程，不得回退）

复述 Brief 第 3 节，任何模块方案与实施都不得削弱：

1. 启动不自动扫描；扫描只建索引和建议。
2. 删除只作为建议，不执行（MVP 边界）。
3. 敏感文件只显示建议与原因，不生成默认可执行勾选。
4. 冲突、低置信、规则接近项默认进入待确认队列。
5. 所有移动 / 重命名必须先经预览确认；执行层二次校验操作类型、绝对路径、安全文件名、源路径一致性、系统目录与覆盖冲突。
6. 恢复只覆盖本应用执行过的操作；journal 与启动对账机制保持权威。
7. AI API Key 保持存放于系统凭据库。

**已核实的相关事实**：stale 标记（`files.is_stale`）**不触及用户文件，也不参与 restore / operation journal / cleanup journal 语义**——`file_ops.rs` 与 `storage_analyzer.rs` 对 `is_stale` 零引用。它只是读侧过滤器。证据见 `pr-18-review.md` 第 4.1b 节。
