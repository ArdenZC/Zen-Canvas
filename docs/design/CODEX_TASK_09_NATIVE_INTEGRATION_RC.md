# Codex 任务 09：Native Integration, Real Filesystem E2E & Release Candidate

## 任务定位

Stage 9 将 Phase 1–8 完成的 UI/UX v4 与真实 Tauri/Rust 后端、SQLite、Windows 系统能力、隔离文件系统和发布构建连接起来，完成一次候选发布验收。

本阶段不是新的 UI 重构，不创建新业务模块。只允许修复被真实原生闭环证明的集成缺陷，并为每个修复增加回归测试。

Stage 9 必须明确区分四类证据：

1. Browser QA；
2. Tauri dev QA；
3. release executable QA；
4. installed application QA。

任何一类证据都不能冒充另一类。

## Git 与交付边界

- 起始分支：`ui/design-foundation-v4`
- 起始 SHA：`83fed2acf0f678825b958fac19d7f36fa22681d2`
- Stage 9 分支：`stage9/native-integration-rc`
- 远端目标：`origin/stage9/native-integration-rc`
- 只允许普通 fast-forward push；禁止 amend、rebase 已推送提交、force push 和 `reset --hard` 清理未知修改。
- 不创建或合并 PR，不合并 main，不创建 Tag，不发布 GitHub Release，不修改版本号。
- 完成后停止，不进入 Stage 10，等待人工验收。

## 开始前阅读和基线

按顺序完整阅读：

1. `README.md` 与 `ZEN_CANVAS_UIUX_BRAND_SYSTEM_V4.md`；
2. `CODEX_TASK_INDEX_V4.md` 和任务 01–08；
3. 全部 Phase 8 closeout 文档；
4. `package.json`、Tauri 配置和 `src-tauri/Cargo.toml`；
5. 扫描、索引、File Library、Spotlight、Suggestions、Preview、文件执行、Safe Trash、History、Restore、Automation、Settings、全局热键和窗口行为的前端/Rust 实现与测试。

开始和结束均执行仓库实际存在的完整命令：

```text
npm install
npm run typecheck
npm test
npm run test:performance
npm run security:audit
npm run security:audit:rust
npm run build
npm run verify
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo build --release --manifest-path src-tauri/Cargo.toml
git diff --check
git status --short
```

先检查 `package.json`，只执行真实存在的 Tauri、E2E、integration 和 installer scripts，不创造不存在的命令。记录每条命令的开始/结束时间、退出码、数量、warning 和失败摘要。

同时记录 Node/npm、Rust/cargo、Windows、WebView2、显示缩放、应用版本、测试数量、审计/构建 warning 和安装器 SHA-256。

## 最高优先级安全边界

所有真实文件操作只允许发生在：

`%USERPROFILE%\.codex\artifacts\zen-canvas-stage9\`

禁止扫描或修改用户真实 Documents、Desktop、Downloads、AppData 或其他个人文件。禁止读取真实敏感文件、使用真实 API Key、连接生产 AI Provider、永久删除、覆盖、跳过 Preview、跳过最终确认、绕过 `allowedPreviewIds`、blocked 检查、名称/路径冲突或 Restore 安全检查。

Automation 必须继续只生成建议。任何自动移动、自动重命名、自动删除、Preview 绕过、越界写入、覆盖或永久删除都属于 Critical，立即阻断 RC。

不得通过手工移动文件、修改数据库或 Browser mock 伪造原生成功。

## 隔离证据目录

使用以下外部结构，不提交任何内容：

```text
zen-canvas-stage9/
  fixture-root/
    Inbox/
    Documents/
    Images/
    Archives/
    Duplicates/
    Long Paths/
    Unicode/
    Conflicts/
  organization-target/
  restore-target/
  canary-outside-fixture/
  screenshots/
  logs/
  manifests/
  installer/
  profile/
  stage9-native-proof.json
```

在 fixture 外创建 `canary-outside-fixture/DO_NOT_TOUCH.txt`，执行前后 SHA-256 必须一致。所有 fixture 在任何扫描或执行前先生成路径、大小和 SHA-256 manifest。

测试配置必须使用现有 profile/test mode/app-data override；若仓库没有安全隔离机制，先调查真实配置和数据库路径。无法证明不污染用户状态的项目必须跳过并标记未验证，不能强行执行。

## Fixture 数据集

fixture 必须可重复、无敏感信息且由本轮创建，至少包含：PDF、TXT、Markdown、CSV、JSON、PNG/JPG、ZIP、无扩展名、大写扩展名、0 字节、同内容不同名称、同名不同目录、中文、空格/括号、长文件名、深目录、目标同名冲突、只读文件、索引后外部移除文件和适度大文件。

不得创建或运行危险脚本、恶意程序或真实可执行载荷。若验证 EXE 类型，仅使用无害占位文件。

## 原生验收范围

### A. Tauri 启动和配置隔离

- 使用项目真实支持的 Tauri dev 命令启动桌面窗口，不以 Vite Browser 页面替代。
- 验证主窗口、资源、Rust invoke、SQLite、标题栏、窗口控制、页面切换、console 和 Rust panic。
- 定位真实 app-data、配置、数据库和缓存路径；不删除或覆盖已有用户配置。

### B. 首次运行、Settings 与系统行为

- 验证 onboarding、本地优先/不自动移动说明、Scan/Search/Organization roots、Light/Dark/System、中英文、命名语言、关闭行为、后台索引、Launch at login、AI Off/Local/Cloud、Developer mode 和日志保留。
- 重启验证持久化；Launch at login 测试后恢复原始系统状态。
- AI 保存失败必须 fail-closed；密钥默认隐藏、临时显示后自动隐藏，错误不得泄露密钥或请求正文。

### C. 原生 folder picker

真实验证 Scan Root、Search Root、组织目标目录、取消、重复、失效目录、删除、保存失败、重启持久化和长路径显示。Browser 固定目录不能作为通过证据。

### D. 扫描、索引、Library 与 Spotlight

- 只扫描 `fixture-root`；覆盖进度、取消、失败、部分完成、Unicode/长路径/无扩展名/0 字节、删除、重复/增量扫描和重启持久化。
- 扫描前后 fixture 哈希必须完全一致；SQLite 计数与 UI 一致，不上传也不修改文件内容。
- File Library 验证真实路径、类型、大小、时间、标签、选择、Shift 连选、键盘、右键、Inspector、预览不可用、筛选、排序、搜索、分页/虚拟化、打开和 reveal；所有外部动作只能指向 fixture。
- Spotlight 在真实 Tauri 中验证 Ctrl+K、实际全局热键、真实文件/文件夹/操作/Settings/History、键盘、Esc、焦点恢复和后台唤起。

### E. Suggestions、Preview 与真实执行

- 基于 fixture 生成真实建议；建议不得自动移动文件。
- 覆盖 undecided、accepted、kept、edited、needs-review、blocked、冲突、批量、Inspector 和 Preview eligibility。
- Preview 和最终确认前再次生成全量 manifest；取消 Preview 后所有文件必须不变。
- 只通过现有 UI → Suggestions → Preview → 明确确认 → Rust 安全路径执行最小可恢复操作。
- 至少覆盖安全移动、重命名、父目录创建、同名冲突、blocked、源不存在、权限失败、部分成功、取消和 skipped。
- 执行项必须与 Preview 选择完全一致；不得覆盖、越界或永久删除；成功项必须进入 History 并可 Restore。

### F. Safe Trash、History 与 Restore

- Cleanup 只使用无害 fixture，经过 review、风险说明、应用内确认和最终 Safe Trash 确认。
- 不清空回收站，不调用永久删除。
- History 覆盖成功、失败、部分成功、skipped、canceled、needs review、restore failed、restored、not restorable、搜索、筛选和长路径。
- Restore 必须重新验证资格，不覆盖现有文件，不恢复到错误路径，不越界；覆盖冲突、重复 Restore 和重启持久化。

### G. Automation

- 规则范围只指向 fixture。
- 验证创建、编辑、启停、删除、条件/动作、重启持久化和失败状态。
- 手动运行只使用启用的 user rules，system templates 不作为隐藏输入。
- 运行只能生成 Suggestions，之后仍需 Preview 和明确确认；冲突继续被拦截。

### H. AI

- 不使用真实生产密钥；Cloud failure 使用不可达 loopback 或无凭据状态。
- 验证 Off/Local/Cloud、成功/失败、runtime/persisted/draft/dirty/saving、单一 alert、重试、密钥生命周期、provider 切换和 Developer mode 门控。
- 没有本地模型时明确标记未连接，不伪造成功。

### I. 窗口、DPI 和可访问性

- 验证 Ask/Minimize/Quit、系统托盘、最小化/最大化/恢复、后台唤起、退出/重启和可支持的窗口状态持久化。
- Windows 原生验证 100%、125%、150% DPI、200% 文本缩放、Light/Dark/System、高对比度、完整键盘、Dialog 焦点、radio/switch、Reduced Motion 和可用时的 Narrator。
- Browser viewport/CSS zoom 不能冒充原生 DPI。不可用的 macOS、Narrator 或显示配置必须写“未验证”。

### J. release executable 和 installer

- 使用真实 release build，记录 NSIS 文件、大小、SHA-256 和数字签名状态。
- 在不会覆盖真实安装或 AppData 的前提下验证安装、首次启动、升级、卸载、残留、重装和 release 模式核心流程。
- 无法隔离时跳过升级/卸载并明确说明，不删除真实用户 AppData。

## 允许和禁止修改

允许修改真实原生运行、前后端映射、invoke 错误、持久化、folder picker、热键、窗口、扫描/索引、Preview/执行/History/Restore 或安全边界中被证据证明的缺陷，以及对应测试和 Stage 9 文档。

禁止无关视觉、品牌、导航、新模块、新云服务、账号、自动文件执行、永久删除、覆盖、Preview 快捷绕过、版本、发布渠道、自动更新、不相关依赖升级和大规模 Rust 重写。

默认不增加依赖、不修改数据库结构。若确实需要依赖或 migration，必须先停止该子任务，记录体积/许可证/安全/兼容风险；不得自行继续。

## 测试要求

每个修复必须有回归测试。前端重点覆盖 invoke 成败、状态映射、Settings 持久化、AI fail-closed、Automation userRules、Preview 选择、History、Restore eligibility、原生路径、热键和关闭行为。

Rust 重点覆盖白名单、traversal、冲突、no-overwrite、缺失源/目标、部分成功、Safe Trash、Restore、重复 Restore、跨目录边界、blocked、`allowedPreviewIds`、Automation 不执行、SQLite 持久化和错误脱敏。

不得删除、跳过、弱化测试或用 production mock 替换真实逻辑。

## 必须生成的外部证据

- `stage9-native-proof.json`
- `stage9-fixture-before-sha256.json`
- `stage9-fixture-after-scan-sha256.json`
- `stage9-fixture-before-execution-sha256.json`
- `stage9-fixture-after-execution-sha256.json`
- `stage9-canary-sha256.json`
- `stage9-command-results.json`
- `stage9-console-log.json`
- `stage9-rust-log.json`
- `stage9-installer-manifest.json`
- `stage9-screenshot-index.json`

截图优先 PNG，并逐张记录来源、像素、窗口/viewport、DPR、Windows 缩放、主题、页面、状态和 SHA-256。必须明确 Browser、Tauri dev、release、installed application 和原生 DPI 来源。

核心 Tauri 截图至少覆盖 Overview、Library/Inspector、Suggestions、Preview/确认/结果、History/Restore、Automation、Preferences、Spotlight、原生 picker、冲突、Safe Trash、980×680、1440×900、1920×1080 和可验证的 125%/150% 原生 DPI。

## Release Candidate 门禁

只有以下事实全部有真实证据时才能判定通过：

- Tauri dev 和 release 可启动，无未处理崩溃；
- fixture 扫描、SQLite Library 和 Spotlight 真实数据闭环；
- Suggestions 在 Preview/确认前不修改文件；
- Preview 选择等于执行选择；
- 冲突、blocked、越界、no-overwrite 全部阻止；
- Safe Trash 不永久删除；History 与实际结果一致；Restore 成功且不覆盖；
- Automation 只生成建议；AI failure 不发布 runtime；Settings 重启持久化；
- 真实全局热键和 native folder picker 可用；
- canary 不变且没有真实个人文件被修改；
- 全量前端/Rust测试、审计、release build、installer hash 通过；
- 工作区干净、本地远端 SHA 一致，无 Critical/High；
- 所有未验证平台项目明确列出。

以下任一情况阻断 RC：意外覆盖、越界、Automation 直接操作、Preview 绕过、永久删除、Restore 覆盖、API Key 泄露、真实用户文件被测试、数据库损坏、release 无法启动、History 不一致或依靠弱化安全检查通过。

## Closeout

新增 `PHASE_09_NATIVE_INTEGRATION_RC_CLOSEOUT.md`，逐项记录范围、SHA、分支、修改、四类运行证据、fixture/manifests、canary、SQLite、Suggestions/Preview/执行、Safe Trash/History/Restore、Automation、AI、系统行为、DPI/无障碍、全部命令、限制、安装器和 RC 结论。

结论不得笼统写“已验证”；每一项都必须对应命令、日志、截图、manifest、DOM、SQLite 或 Rust 测试证据。
