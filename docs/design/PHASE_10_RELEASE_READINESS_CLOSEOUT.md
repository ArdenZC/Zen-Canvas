# Zen Canvas Stage 10 Release Readiness Closeout

## 1. Stage 10 范围

完成 Stage 9 全量代码与文件安全审查、Windows 安装链、原生 DPI/文本缩放、High Contrast、Narrator 基础验证、发布文档和未合并 PR 准备；未增加业务功能，未进入 Stage 11。

## 2. 起始 SHA

`f08b7f5877648b85e28e736ef09a933adf80c190`（`stage9/native-integration-rc`）。

## 3. 最终 SHA

最终代码修复 SHA 为 `57ba240`；包含本 closeout 的最终交付 SHA 以 `stage10/release-readiness` 远端 HEAD 和 PR head 为准。

## 4. 分支

`stage10/release-readiness`，PR base 为 `ui/design-foundation-v4`。

## 5. 提交

- `2611520 docs(stage10): define release readiness gate`
- `57ba240 fix(stage10): close final release blockers`
- 最终证据文档提交见本分支后续日志。

## 6. 代码审查结果

审查范围为 `origin/ui/design-foundation-v4...stage10/release-readiness`。生产代码、测试、安装配置和安全边界审查通过，适合进入人工合并评审。

## 7. Critical / Important / Minor

Critical 0；Important 0；Minor 0。Stage 10 修复了 200% 文本大小下标题栏、侧栏、Overview 长文案和 Onboarding Dialog 的裁切/滚动阻断，并新增回归测试。

## 8. 文件安全审查

通过。Preview authority、`allowedPreviewIds`、blocked、canonicalization、路径/名称冲突、no-overwrite、Safe Trash、History/Restore、Automation suggestion-only 和 AI fail-closed 均保留；未修改数据库结构或 Rust 文件执行策略。

## 9. 安装器测试

正式 NSIS 安装器可启动、识别既有同版本安装、提示运行中应用、在无法关闭残留进程时中止而非继续覆盖，并可在进程关闭后成功安装。

## 10. 安装测试

通过真实 Windows UI 完成同版本覆盖安装和首次启动。WebView2 正常，Onboarding 可见，无白屏或 panic。当前测试继承 Stage 9 隔离安装目录，不代表默认终端用户安装路径验收。

## 11. 升级测试

真实跨版本升级：未验证。因禁止修改版本号，本阶段只验证同版本覆盖；覆盖安装成功且数据未损坏。

## 12. 卸载测试

通过。卸载器可启动；“Delete the application data”保持未勾选；程序目录、注册表项和进程被清除，应用数据未删除。

## 13. 重装测试

通过。卸载后重新安装成功，release executable 可启动，未出现旧进程冲突或损坏配置。

## 14. 用户数据策略

默认保留 AppData。卸载前后 SQLite 主库哈希均为 `54E55DE227015F6387866C38372D154EF00888654D307B479FA67B9107F86628`；重装并启动后 `PRAGMA integrity_check` 为 `ok`，业务表与业务记录数保持一致（`files`/`files_fts` 均为 2036）。FTS 内部页计数因启动维护变化，不代表用户记录丢失。日志、Safe Trash 和用户索引随 AppData 保留。

## 15. 签名状态

release EXE 与 NSIS 均为 `NotSigned`。未使用自签名证书冒充正式签名。

## 16. SmartScreen

本机运行未出现可记录的 SmartScreen 拦截，但未签名安装器仍存在 Unknown Publisher/SmartScreen 风险；干净信誉环境验证未完成，公开发布门禁不通过。

## 17. 100% DPI

真实 Windows 100% 显示缩放通过，App Shell、Overview 和窗口控制正常。

## 18. 125% DPI

真实 Windows 125% 显示缩放通过，截图证据已记录。

## 19. 150% DPI

真实 Windows 150% 显示缩放通过，截图证据已记录。

## 20. 200% 文本缩放

真实 Windows 文本大小 200% 验证通过；发现并修复标题栏、侧栏、Overview 长文案和 Onboarding Dialog 问题后复测通过，系统设置已恢复。

## 21. High Contrast

真实 Windows “夜空”对比度主题基础验证通过，导航、文字和关键操作可辨识；完成后恢复为“无”。

## 22. Narrator

真实 Narrator 基础验证通过：启动、页面标题、导航、按钮和 Onboarding Dialog 语义可读取；完成后 Narrator 已关闭。完整 WCAG/逐控件审计未执行。

## 23. 键盘完整旅程

`Ctrl+K`、Escape、Dialog 焦点路径和基础导航已验证；依赖完整生产数据的 25 步端到端键盘旅程未完整重复，标记为未验证。

## 24. Standalone Search

保留 Stage 9 已验证的主窗口 Spotlight fallback。Standalone Search WebView2 可见性读取限制仍存在；未进行高风险架构重写，fallback 不是 Windows RC 阻断项。

## 25. 测试结果

前端 62 个文件、417 个测试全部通过；Rust 320 passed、0 failed、1 ignored；性能前端 9 个测试通过。所有规定命令退出码均为 0。

## 26. 性能

100,000 行 SQLite/FTS 场景通过；搜索 p95 为 1.780 ms，总体 p95 为 3.963 ms。

## 27. 安全审计

`npm audit` 0 vulnerabilities；Rust denied advisories 0，allowlisted warnings 16；敏感信息人工扫描未发现密钥或私钥泄露。

## 28. Release build

`npm run build`、`npm run verify` 和 `cargo build --release --jobs 1` 均以退出码 0 完成。

## 29. 安装器路径、大小和 SHA-256

本地路径：`src-tauri/target/release/bundle/nsis/Zen Canvas_0.1.39_x64-setup.exe`；大小 5,536,409 bytes；SHA-256 `396DD4B2ACD29317D5F9F1001A29A093E8E1B260414F86D262440ADA78FF4B6D`。安装器未提交。

## 30. 证据目录

本机外部证据位于 `%USERPROFILE%/.codex/artifacts/zen-canvas-stage10/`，包含 proof JSON、命令日志、截图索引和安装 UI 证据；该目录未提交。

## 31. PR URL

<https://github.com/ArdenZC/Zen-Canvas/pull/8>。本地 `C:`/`F:` 证据路径未进入 PR 描述。

## 32. PR 状态

Open，等待人工审查，未启用自动合并。

## 33. 已知限制

- 安装器与 executable 未签名，SmartScreen 信誉未建立。
- 真实跨版本升级未验证。
- 依赖完整数据的全键盘旅程未完整重复。
- Standalone Search WebView2 可见性读取存在已知限制，使用主窗口 fallback。
- macOS 实机、签名和公证未验证。
- 安装位置继承 Stage 9 隔离 QA 路径；默认终端用户安装路径未单独验证。

## 34. 发布门禁结论

PR Ready：是。Windows RC：通过。Windows 安装链本身通过，但因正式签名和干净 SmartScreen 信誉门禁未完成，Windows 公开安装发布门禁未通过；跨平台公开发布门禁未通过。

## 35. 未进入 Stage 11

确认未进入 Stage 11。

## 36. 未创建 Tag 或 Release

确认未创建 Git Tag 或 GitHub Release，未修改版本号，未公开上传安装器。

## 37. 未合并 PR

确认 Stage 10 只创建并保留未合并 PR，等待人工审查。

## Final recommendation

建议合并到 `ui/design-foundation-v4`，保持 Windows RC，不建议公开发布。
