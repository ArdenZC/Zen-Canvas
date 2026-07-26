# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Zen Canvas 是本地优先的个人文件生命周期管理助手，桌面应用。**Tauri 2 + Rust 后端**，前端为 React 19 + TypeScript + Tailwind CSS 4 + Zustand + Vite 8，索引与搜索层为 SQLite（WAL）+ FTS5 trigram。

技术栈事实以 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 和实际代码为准。

## 常用命令

```bash
npm install
npm run dev            # tauri dev --features desktop-runtime
npm run build          # tauri build --features desktop-runtime（Windows 产出 NSIS，macOS 产出 DMG）
npm run typecheck      # tsc -p tsconfig.json（--noEmit）
npm test               # vitest run，全部前端测试
npm run test:performance   # 前端架构守卫 + Rust SQLite/FTS 100k 行 benchmark
```

单个前端测试 / 单个用例：

```bash
npx vitest run tests/scanManager.test.ts
npx vitest run tests/scanManager.test.ts -t "关键字"
```

Rust 侧从仓库根目录运行需带 manifest 与 feature：

```bash
cargo test  --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo test  --manifest-path src-tauri/Cargo.toml --features desktop-runtime scan::tests::name   # 单个测试
cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings
cargo fmt   --manifest-path src-tauri/Cargo.toml -- --check
```

`desktop-runtime` 是 `[[bin]]` 的 `required-features`；不带它只能编译 lib。benchmark 类测试标记为 `ignored`，普通 `cargo test` 不会跑。

## 架构要点

**进程与边界**：前端不直接访问文件系统。扫描、索引、移动/重命名、恢复、清理全部在 Rust command 层执行；前端只通过 `src/api/tauriApi.ts` 的 `invoke` / `listen` 与后端通信。

**双窗口权限模型**：`main` 与 `search` 两个窗口。能力清单分离（`src-tauri/capabilities/default.json` 给 main，`search.json` 只给只读子集），Rust 侧 mutation 命令额外调用 `window_auth::require_main_window` 二次校验。新增命令必须四处同步，否则契约测试失败：

- `src-tauri/src/main.rs` 的 `tauri::generate_handler!` 列表
- `src-tauri/build.rs` 的 `COMMANDS` allowlist
- `src-tauri/capabilities/*.json`
- `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md`

**数据层**：单个 SQLite 文件（`app_data_dir/zen-canvas.sqlite3`），r2d2 连接池（`src-tauri/src/db/connection.rs`）。schema 版本号与线性迁移集中在 `src-tauri/src/db/schema.rs` 的 `CURRENT_SCHEMA_VERSION` + `migrate()`；改 schema 必须 +1 并补迁移分支。查询按域拆在 `src-tauri/src/db/queries/`（`files` / `operations` / `rules_repo` / `scan`）。

**持久化权威在 SQLite，不在前端**。`src/store/` 的 Zustand store 只承载运行时状态与 UI 交互；规则、操作日志、扫描账本、设置都以数据库为准。启动时 `main.rs` 依次执行 `recover_scan_state` → `reconcile_pending_operation_journal` → `reconcile_pending_cleanup_journal` 做对账。

**Rust 模块职责**（`src-tauri/src/`）：

| 模块 | 职责 |
|---|---|
| `scanner.rs` | 扫描作业与持久扫描账本（scan roots / sessions / runs） |
| `watcher.rs` | notify 文件系统监听，增量 upsert；删除事件只标 `is_stale` |
| `dedupe.rs` | BLAKE3 重复检测 |
| `file_ops.rs` | 移动 / 重命名 / 恢复，operation journal |
| `storage_analyzer.rs` | 存储清理候选、Safe Trash 与其恢复 |
| `fs_safety/` | 原子移动、路径守卫、文件身份校验、平台支持门 |
| `global_index/` | 独立于文件库的全局元数据索引与全局搜索 |
| `ai/` | provider 适配（OpenAI 兼容 / Ollama）、分类、清理分析、trace |
| `path_filter.rs` | 忽略目录与受保护路径的单一来源 |

**前端结构**：`src/views/<域>/` 为页面与其模型（`*Model.ts` 存放纯逻辑，便于单测），`src/components/` 为跨页面组件，`src/store/` 为 Zustand store，`src/types/domain.ts` 为与 Rust DTO 对应的类型。文案集中在 `src/i18n.ts`（zh / en 两份对象），不要硬编码用户可见字符串。

**浏览器 mock**：`src/api/browserMockApi.ts` 在 dev 且检测不到 Tauri runtime 时自动接管 `invoke`，可用 `npx vite` 单跑 UI。它不是生产路径，但新增命令时需同步 mock，否则纯浏览器预览会崩。

**事件通道**：后端通过 event 推送进度，前端在 `tauriApi.ts` 订阅（`scan-progress` / `scan-batch` / `scan-run-updated` / `dedupe-progress` / `operation-progress` / `ai-classification-progress` / `storage-cleanup-*` / `fs-event` 等）。新增事件同样要在 `tauriApi.ts` 收口，不要在组件里直接 `listen`。

**契约测试**：`tests/remediationContract.test.ts` 直接读取 Rust 与 TS 源码文本做正则断言（命令签名必须带 `job_id`、平台门必须存在等）。改动相关函数签名会让它失败——这是有意的护栏，应修改代码或同步更新契约，不要绕过。

## 安全边界（不得回退）

以下不变量是本项目的核心设计，任何改动都不得削弱。与参考项目做法冲突时，保留本项目的做法：

- 启动不自动扫描；扫描只建立索引和建议。
- 删除只作为建议，不执行（MVP 边界）。
- 敏感文件只显示建议和原因，不生成默认可执行勾选。
- 冲突、低置信、规则接近项默认进入待确认队列。
- 所有移动 / 重命名必须先经预览确认；执行层二次校验操作类型、绝对路径、安全文件名、源路径一致性、系统目录与覆盖冲突。
- 恢复只覆盖本应用执行过的操作；journal 与启动对账机制保持权威。
- AI API Key 保持存放于系统凭据库，不落盘明文。

## 验证门槛

改动完成后须通过完整验证，不低于既有基线：

```bash
npm run verify
```

它串联三段（见 `package.json` scripts）：

- `verify:frontend` = `typecheck` + `test` + `test:remediation` + `test:performance` + `build`
- `verify:rust` = `cargo fmt --check` + `cargo test` + `cargo clippy -D warnings`（均带 `--features desktop-runtime`）
- `verify:security` = `npm audit --audit-level=high` + `cargo audit`

CI（`.github/workflows/ci.yml`）在 windows-latest 与 macos-latest 上跑同一套门槛，另加 macOS 路径/临时目录回归与 Windows 原生文件系统加固冒烟测试。

## 许可证门

本仓库为专有代码（© Startlan），无开源许可证。参考其他开源项目时：

- AGPL / GPL 系（如 Spacedrive、TagSpaces）：**只允许概念与架构层借鉴**，禁止复制代码，也禁止照着源码逐段改写的移植。
- MIT 系（如 Czkawka、Accomplish）：允许有限复用，但须在 `docs/remediation/00-overview.md` 的引入登记表记录来源、许可证与修改说明。
- 许可证未确认的仓库：按 AGPL 同级处理，直至确认。

## 进行中的工作

对标整改的完整流程、模块顺序与产出模板见 `docs/remediation/BRIEF.md`，需要时再读取。
