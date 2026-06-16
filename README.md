# Zen Canvas

**A local-first file lifecycle assistant with a Spotlight-grade search surface.**

[中文](#中文) | [English](#english)

## 中文

Zen Canvas 是一个面向个人电脑的文件生命周期管理助手。它不是资源管理器替代品，也不是简单文件分类器，而是把扫描、索引、解释、整理预览、执行日志和恢复记录串成一个安全闭环。

产品体验采用玻璃质感、空间背景、雷达扫描和顶部常驻 Spotlight 搜索。第一屏直接进入可操作的工作区，普通用户只需要选择扫描范围、查看建议、确认执行；高级用户可以再进入规则和设置。

### 核心体验

- **顶部快速搜索**：常驻顶部中央，`Ctrl/Cmd + K` 打开 Spotlight 式弹窗。
- **空间扫描**：扫描用户空间全盘或选择指定文件夹，不扫描系统根目录。
- **智能整理**：用四区模型解释文件去向：核心资产、沉寂归档、隐私保险箱、临时清理。
- **文件库**：查看搜索结果详情、筛选元数据和解释原因，不直接移动文件。
- **预览执行**：所有移动、重命名、移动加重命名都必须先进入预览。
- **自动规则**：内置规则稳定运行，用户规则可长期生效，高级构建器默认折叠。
- **恢复记录**：只恢复 Zen Canvas 自己执行过的操作，默认按批次保留 15 天。

### 搜索能力

- 本地 SQLite + FTS5 索引，不依赖 Everything、Spotlight 或系统搜索服务。
- 支持文件名、路径、空格分词和 `ext:pdf` 这类扩展名过滤。
- 排序结合相关性、最近修改、最近打开和路径深度。
- 结果支持打开文件、在系统文件管理器中定位、进入文件库详情。
- 专用性能测试覆盖 10 万条模拟索引，查询目标 `<100ms`。

### 安全边界

- 启动不自动扫描，扫描只建立索引和建议。
- MVP 不执行删除；删除只作为建议。
- 敏感文件只显示建议和原因，不生成默认可执行勾选。
- 冲突、低置信、规则接近项默认进入待确认队列。
- 执行层会再次校验操作类型、绝对路径、安全文件名、源路径一致性、系统目录和覆盖冲突。
- Electron 启用 `contextIsolation`、禁用 `nodeIntegration`、启用 sandbox，并拒绝异常导航、弹窗和权限请求。

### 技术栈

- Electron + React + TypeScript
- `better-sqlite3` + SQLite WAL + FTS5
- Vite + Vitest
- electron-builder

### 开发命令

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run test:performance
npm run build
npm run security:audit
```

完整发布前验证：

```bash
npm run verify
```

### 打包与发布

本项目只发布 Windows 和 macOS 未签名公开版，后续预留签名配置。

```bash
npm run dist:win
npm run dist:mac
```

发布目标：

- Windows: NSIS + zip, `x64` / `ia32` / `arm64`
- macOS: dmg + zip, `x64` / `arm64`

GitHub Actions 工作流 `.github/workflows/release-build.yml` 会在 `v*` tag 推送时构建两个系统的软件包，并自动挂载到 GitHub Release。

## English

Zen Canvas is a personal file lifecycle assistant for local desktops. It is not a file explorer replacement and not a simple classifier. It connects scanning, indexing, explanation, preview execution, operation logs, and restore records into one safe workflow.

The product language uses glass surfaces, spatial depth, radar scanning, and a persistent Spotlight-style search bar. The first screen is a real workspace: choose a scan scope, review suggestions, confirm changes. Advanced users can move into rules and settings.

### Core Experience

- **Top Search**: centered global search, opened with `Ctrl/Cmd + K`.
- **Space Scan**: scan the user space or selected folders, never system roots.
- **Smart Organize**: explains files through four zones: Core Assets, Quiet Archive, Privacy Vault, Cleanup Lane.
- **File Library**: inspect details, filters, and reasons without direct file changes.
- **Preview Execute**: every move, rename, or move plus rename action must be previewed first.
- **Auto Rules**: built-in rules stay stable, user rules apply globally, advanced builder is folded by default.
- **Restore Records**: restores only operations executed by Zen Canvas, grouped by batch for 15 days by default.

### Search

- Local SQLite + FTS5 index. No dependency on Everything, Spotlight, or OS search backends.
- Filename, path, tokenized search, and `ext:pdf` style extension filters.
- Ranking combines relevance, recent modification, recent opens, and path depth.
- Results can open files, reveal files in the system file manager, or open details in File Library.
- Dedicated 100k simulated-index performance test targets `<100ms` query latency.

### Safety

- The app does not scan automatically on launch. Scanning only creates an index and suggestions.
- Deletion is suggestion-only in the MVP.
- Sensitive files show advice and reasons, but are not selected for execution.
- Conflicts, low-confidence items, and close rule scores enter manual confirmation by default.
- The execution layer revalidates operation type, absolute paths, safe filenames, source-path consistency, protected system targets, and overwrite conflicts.
- Electron uses `contextIsolation`, disables `nodeIntegration`, enables sandboxing, and blocks unexpected navigation, popups, and permission prompts.

### Stack

- Electron + React + TypeScript
- `better-sqlite3` + SQLite WAL + FTS5
- Vite + Vitest
- electron-builder

### Development

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run test:performance
npm run build
npm run security:audit
```

Full release verification:

```bash
npm run verify
```

### Packaging And Release

Zen Canvas currently ships unsigned public builds for Windows and macOS. Signing configuration is reserved for later.

```bash
npm run dist:win
npm run dist:mac
```

Targets:

- Windows: NSIS + zip, `x64` / `ia32` / `arm64`
- macOS: dmg + zip, `x64` / `arm64`

The GitHub Actions workflow `.github/workflows/release-build.yml` builds both platforms on `v*` tags and attaches the installers to the GitHub Release.
