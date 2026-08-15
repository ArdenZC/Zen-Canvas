# Codex 任务 10：Final Code Review, Installation Gate & Release Readiness

**状态：已完成（PR Ready；Windows RC 保持；公开发布门禁未通过）**

## 任务定位

Stage 10 是 Zen Canvas v4 在进入人工合并评审前的最后工程门禁。它不增加功能、不重构 UI、不修改版本、数据库结构或文件执行安全模型，只完成 Stage 9 全量审查、Windows 安装与辅助技术实机门禁、签名准备、RC 文档和未合并 PR。

## Git 边界

- 起始分支：`stage9/native-integration-rc`
- 起始 SHA：`f08b7f5877648b85e28e736ef09a933adf80c190`
- 执行分支：`stage10/release-readiness`
- PR base：`ui/design-foundation-v4`
- PR head：`stage10/release-readiness`
- 只做普通提交和 push；禁止 amend、rebase 已推送历史、force push、合并 PR、合并 main、Tag、GitHub Release 和版本修改。

## 代码与安全审查

审查 `origin/ui/design-foundation-v4...HEAD` 的全部生产、测试和文档改动，尤其是原生窗口/热键、设置、扫描范围、Preview authority、执行、Safe Trash、History/Restore、Automation 和 AI fail-closed。

分级：

- Critical：覆盖、越界、Preview 绕过、自动文件执行、永久删除、Restore 覆盖、密钥泄漏、数据库损坏、路径遍历或任意命令执行。
- Important：stale Preview、状态/History 不一致、设置伪成功、Safe Trash 不稳定、热键/窗口泄漏、release/dev 分歧或安装/卸载破坏数据。
- Minor：低风险文案、结构、性能或日志问题。

通过要求为 Critical 0、Important 0；Minor 只做有明确收益的低风险修复。任何修复必须带回归测试，不能削弱已有门禁。

文件安全专项确认 canonicalization、`..`/symlink/junction 边界、no-overwrite、缺失源/目标、blocked、`allowedPreviewIds`、authoritative Preview freshness、Safe Trash 合法范围、Restore 重验证、Automation/AI suggestion-only、后端错误 fail-closed 和 History 对实况一致性。

## 安装器与隔离

安装优先使用 Windows Sandbox/VM/专用测试用户；不能安全隔离时不得强行安装、升级或卸载。允许使用不提交的临时配置构建 `com.startlan.zencanvas.stage10qa` QA 安装器，构建前后必须证明生产配置未变。

安全环境中验证：全新安装、首次启动、默认空扫描范围、设置/规则/索引/History 重启持久化、同版本覆盖安装、卸载后的程序/快捷方式/进程/启动项和用户数据状态，以及重装。不得删除真实 AppData、真实数据库或 fixture 原始文件。

## Windows 原生显示与辅助技术

只接受真实系统设置证据，不以 Browser zoom/CSS scale 替代：

- 100%、125%、150% 显示缩放；
- 200% Windows 文本大小；
- Windows Contrast Theme；
- Narrator 基础关键路径；
- 完整键盘旅程；
- Standalone Search WebView2 fallback 重复调用、监听生命周期、关闭和重启。

每项记录窗口、DPR、像素、系统缩放/文本/Contrast 状态、页面、主题、状态和 SHA-256；改变系统设置后恢复原状态。无法安全验证的项目明确写“未验证”。

## 数字签名

记录 release EXE/NSIS 的 Authenticode、SmartScreen 风险、OV/EV 方案、时间戳、私钥保护、CI 顺序和签名后验证命令。不购买证书、不使用自签名冒充正式签名、不提交证书或私钥。未签名时公开发布门禁不通过，Windows RC 可保持。

## 命令矩阵

开始和结束均执行仓库真实存在的：

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
cargo test --manifest-path src-tauri/Cargo.toml --jobs 1
cargo build --release --manifest-path src-tauri/Cargo.toml --jobs 1
git diff --check
git status --short
```

记录环境、起止时间、退出码、测试数量、warning、审计、性能、安装器大小/SHA-256/签名。

## 证据与交付

外部证据根目录：`%USERPROFILE%\.codex\artifacts\zen-canvas-stage10\`，不得提交。

必须生成：

- `stage10-release-proof.json`
- `stage10-command-results.json`
- `stage10-installer-proof.json`
- `stage10-accessibility-proof.json`
- `stage10-screenshot-index.json`

仓库文档：

- `WINDOWS_CODE_SIGNING_PLAN.md`
- `RELEASE_CANDIDATE_NOTES.md`
- `PHASE_10_RELEASE_READINESS_CLOSEOUT.md`

创建标题为 `feat: complete Zen Canvas v4 Windows release candidate` 的未合并 PR，base 为 `ui/design-foundation-v4`，head 为 `stage10/release-readiness`。PR 不包含本地路径、fixture、截图、安装器、密钥、临时 identifier、debug 端口或构建产物。

## 结论规则

Stage 10 可得出：

1. PR Ready，Windows RC 保持通过，但公开发布门禁未通过；或
2. PR Ready，Windows 安装发布门禁通过，但 macOS 发布门禁未通过；或
3. 不建议合并，存在阻断问题。

代码通过不等于公开发布通过。完成后停止，不进入 Stage 11。
