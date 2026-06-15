# File Manager Assistant

[中文](#中文) | [English](#english)

## 中文

File Manager Assistant 是一个本地优先的个人文件生命周期管理助手。它不是简单按扩展名分类文件，而是扫描文件后生成用途、生命周期、场景、风险等级、建议动作和目标路径，并在用户确认后执行移动或重命名。

### 适合解决的问题

- 下载目录、桌面和文档目录长期堆积，难以判断哪些文件还需要保留。
- 简单文件分类器只能按类型移动，无法解释“为什么这样整理”。
- 敏感文件、财务文件、证件扫描件需要更谨慎的处理方式。
- 希望先看到整理方案，再决定是否真的移动或重命名文件。

### MVP 功能

- Electron + React + TypeScript 桌面应用。
- SQLite 本地索引，数据默认保存在本机。
- 支持选择任意文件夹扫描，也支持扫描 Desktop / Downloads / Documents。
- 识别 `file_type`、`purpose`、`lifecycle`、`context`、`risk_level`、`suggested_action`、`suggested_target_path`、`confidence` 和 `classification_reason`。
- 内置规则 + 用户自定义规则 + 本次扫描临时规则的数据结构。
- 高级规则构建器：字段、条件、动作、权重和启用状态。
- 整理方案预览：显示原路径、目标路径、原文件名、新文件名、风险和置信度。
- 用户确认后执行移动、重命名、移动加重命名。
- 操作写入 `operation_logs`。
- 中英双语界面。

### 安全模型

- 扫描只建立索引和建议，不会自动改变文件。
- MVP 不执行删除；删除只作为建议。
- 敏感文件不会生成可直接执行的操作。
- 执行层会再次校验操作，防止前端被绕过：
  - 拒绝敏感文件。
  - 拒绝非 MVP 支持的操作类型。
  - 拒绝相对路径、路径穿越和不安全文件名。
  - 拒绝源路径与索引记录不一致的操作。
  - 拒绝系统目录目标路径。
  - 拒绝覆盖已存在目标文件。
- Electron 主进程启用 `contextIsolation`、禁用 `nodeIntegration`、启用 sandbox，并拒绝非预期导航、新窗口和权限请求。

### 如何扫描文件夹

1. 启动应用。
2. 在工作台点击 `选择文件夹`。
3. 选择一个或多个文件夹。
4. 查看识别结果、命中规则和整理建议。
5. 打开 `预览`，确认目标路径和新文件名。
6. 只执行你选中的整理方案。

### 开发命令

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run security:audit
npm run verify
```

### 打包发行

本项目使用 `electron-builder`。

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

支持的发行目标：

- Windows: NSIS + zip, `x64` / `ia32` / `arm64`
- macOS: dmg + zip, `x64` / `arm64`
- Linux: AppImage + deb + rpm, `x64` / `arm64`

macOS 和 Linux 的可靠发行包应在对应系统或 GitHub Actions runner 中构建。仓库包含 `.github/workflows/release-build.yml`，可以通过手动触发或推送 `v*` tag 生成全平台产物。

### 当前测试覆盖

- 规则分类：简历、发票、护照扫描、安装包、用户规则覆盖、冲突确认、敏感文件不执行。
- 扫描器：普通文件扫描、隐藏目录跳过、系统/依赖目录跳过、缺失目录记录、重复文件 hash。
- 执行安全：安全重命名、敏感文件拒绝、伪造源路径拒绝、相对路径拒绝、不安全文件名拒绝、未知操作类型拒绝、目标文件存在拒绝、系统目录拒绝。

## English

File Manager Assistant is a local-first personal file lifecycle management assistant. It does not simply sort files by extension. It scans files, explains purpose, lifecycle, context, risk, suggested action, target path, and confidence, then applies move or rename actions only after user confirmation.

### Problems It Solves

- Downloads, Desktop, and Documents folders become hard to reason about over time.
- Extension-only file sorters cannot explain why a file should move.
- Sensitive, finance, and identity files need conservative handling.
- Users should see an organizing plan before real file operations happen.

### MVP Features

- Electron + React + TypeScript desktop app.
- Local SQLite index stored on the device.
- Choose any folder to scan, or scan Desktop / Downloads / Documents.
- Classifies `file_type`, `purpose`, `lifecycle`, `context`, `risk_level`, `suggested_action`, `suggested_target_path`, `confidence`, and `classification_reason`.
- Built-in rules, user rules, and session-rule-ready data model.
- Advanced rule builder with fields, conditions, actions, weights, and enabled state.
- Plan preview with source path, target path, original name, new name, risk, and confidence.
- Confirmed move, rename, and move plus rename operations.
- Operation history in `operation_logs`.
- Bilingual UI: 中文 / English.

### Safety Model

- Scanning only indexes files and creates suggestions.
- Deletion is not executed in the MVP.
- Sensitive files are excluded from directly executable operations.
- The execution layer validates every operation again:
  - Blocks sensitive files.
  - Blocks unsupported operation types.
  - Blocks relative paths, path traversal, and unsafe file names.
  - Blocks operations whose source path no longer matches the indexed file.
  - Blocks protected system targets.
  - Blocks overwriting existing target files.
- The Electron main process uses `contextIsolation`, disables `nodeIntegration`, enables sandboxing, and rejects unexpected navigation, new windows, and permission prompts.

### How To Scan A Folder

1. Start the app.
2. On Home, click `Choose Folder`.
3. Pick one or more folders.
4. Review classification results, matched rules, and suggestions.
5. Open `Preview` to confirm target paths and new names.
6. Execute only the selected plan items.

### Development Commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run security:audit
npm run verify
```

### Release Packaging

This project uses `electron-builder`.

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Release targets:

- Windows: NSIS + zip, `x64` / `ia32` / `arm64`
- macOS: dmg + zip, `x64` / `arm64`
- Linux: AppImage + deb + rpm, `x64` / `arm64`

macOS and Linux packages should be built on their matching operating systems or GitHub Actions runners. The repository includes `.github/workflows/release-build.yml`, which builds all platform artifacts when manually triggered or when a `v*` tag is pushed.

### Current Test Coverage

- Rule classification: resumes, invoices, passport scans, installers, user override rules, conflict review, sensitive-file execution exclusion.
- Scanner: regular file scanning, hidden directory skipping, system/dependency directory skipping, missing root logging, duplicate hash detection.
- Execution safety: safe rename, sensitive-file rejection, forged source rejection, relative path rejection, unsafe name rejection, unknown operation rejection, existing target rejection, protected system target rejection.
