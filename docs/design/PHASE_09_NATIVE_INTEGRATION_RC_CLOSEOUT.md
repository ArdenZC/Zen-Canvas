# Stage 9 — Native Integration, Real Filesystem E2E & Release Candidate Closeout

## 1. Stage 9 范围

本阶段把现有 UI 与真实 Tauri/Rust、SQLite、Windows 系统能力、隔离文件系统和 release 构建连通。没有增加业务模块、数据库 migration、生产 AI 调用、自动文件执行、永久删除或覆盖能力，也没有修改版本号、发布渠道或主导航结构。

所有真实文件操作均限定在 `C:\Users\77588\.codex\artifacts\zen-canvas-stage9`。Browser、Tauri dev、release executable 与 installed application 证据严格分开。

## 2. 起始 SHA

- 基线分支：`ui/design-foundation-v4`
- 本地与远端基线：`83fed2acf0f678825b958fac19d7f36fa22681d2`
- Stage 9 任务书提交：`c5477a11e772da8144c95b3248de292478fcc87d`

## 3. 最终 SHA

代码与测试 SHA、closeout 提交 SHA 以及最终远端 SHA 在普通 push 后记录于交付报告。Git 提交不能可靠地在自身内容中保存自身 SHA，因此本文件不伪造自引用值。

## 4. 分支

`stage9/native-integration-rc`，远端目标 `origin/stage9/native-integration-rc`。不创建 PR、不合并 main、不建 Tag、不发布 Release。

## 5. 实际修改文件

生产代码：

- `src-tauri/src/app_control.rs`：全局热键在 standalone search window 可见性读取失败时恢复主窗口并请求 in-window Spotlight；恢复最小化窗口。
- `src-tauri/src/db/queries/files.rs`：建议 Preview 在目标已存在时直接标记不可执行且不默认选择。
- `src-tauri/src/settings.rs`：全新安装不再默认扫描 Desktop、Downloads、Documents；仅保留 legacy 字符串配置迁移。
- `src-tauri/src/storage_analyzer.rs`：Windows Safe Trash 改为源目录相邻的 `.zen-canvas-trash`，不再落到盘符根目录。
- `src/api/tauriApi.ts`、`src/components/AppRuntimeProviders.tsx`：桥接 `global-search-requested` 原生事件并打开 Spotlight。
- `src/components/spotlight/commandRegistry.ts`、`src/i18n.ts`：在不改主导航的前提下提供 Cleanup Spotlight 入口和中英文说明。
- `src/store/useOperationQueueStore.ts`、`src/views/timeline/TimelineView.tsx`：authoritative Preview 失效时显示脱敏、可行动错误；没有执行日志时不显示伪成功计数。
- `src/utils/format.ts`：兼容持久化 epoch 秒/毫秒字符串，非法日期 fail-closed 为 `-`。

回归测试：

- `src-tauri/src/db/tests/part1.rs`
- `src-tauri/tests/settings.rs`
- `src-tauri/tests/storage_analyzer.rs`
- `tests/appSettings.test.ts`
- `tests/appShellBehavior.test.ts`
- `tests/operationQueueCallbacks.test.ts`
- `tests/overviewV4.test.tsx`
- `tests/searchSpotlight.test.ts`
- `tests/tauriApi.test.ts`

文档：`CODEX_TASK_09_NATIVE_INTEGRATION_RC.md`、`CODEX_TASK_INDEX_V4.md` 和本 closeout。

## 6. 根因分析

1. 新数据库默认设置直接包含用户个人目录，导致首次运行可能在未选择范围前接触真实文件；改为空列表，旧配置迁移仍兼容。
2. Windows Safe Trash 通过盘符根路径推导，可能越出用户选定 fixture；改为源父目录内的安全回收路径。
3. Preview 构建只在最终执行时检查目标冲突，UI 可把已存在目标显示为可执行；现在 Preview 层即阻止，最终 no-overwrite 检查仍保留。
4. SQLite 历史时间戳可能是数字字符串，前端直接交给 `Date` 导致 `RangeError`；现在区分 epoch 秒、毫秒和 ISO，并处理非法值。
5. 当前 Windows WebView2 runtime 对隐藏 search window 的 `is_visible()` 返回通道错误；原处理直接失败。现在将该错误转为主窗口恢复 + Spotlight 事件，真实后台 `Ctrl+K` 可用。
6. authoritative Preview 过期错误包含内部 ID 且结果页可能显示 `0/0/0`；现在使用用户文案并仅在真实日志存在时显示结果统计。
7. Cleanup 已存在但不在主导航中，缺少稳定入口；新增 Spotlight 命令，没有违反“不得修改主导航结构”。

## 7. 真实 Tauri 验证

真实 `tauri dev` WebView2 窗口完成启动、Rust invoke、SQLite、窗口控制、页面切换和 fixture 文件闭环。最终观察未出现 panic；修复前 console/runtime 错误及其处理记录在外部 `stage9-console-log.json` 和 `stage9-rust-log.json`。

窗口实际验证为 980×681、1440×901、1920×1081，DPR 2；Light、Dark、System 切换和根主题状态一致。

## 8. Browser 验证

Stage 9 没有以 Browser mock 证明原生文件结果。Browser/jsdom 仅用于 62 个前端测试文件中的状态、API bridge、文案与 source-contract 回归；真实扫描、文件执行、SQLite、folder picker 和全局热键结论均来自 Tauri/Windows。

## 9. Release 验证

使用独立 identifier `com.startlan.zencanvas.stage9qa` 构建并启动 release executable，页面源为 `http://tauri.localhost/`，不是 Vite dev server。release 模式真实扫描 24 个 fixture 文件，总计 6,292,910 bytes，显示 16 项需确认建议；Spotlight、Preview、History 和重启持久化均通过。

release Preview 只到执行前页面，没有触发额外文件操作。

## 10. Installer 验证

正式 `npm run build` 生成 NSIS 安装器并计算大小、SHA-256 与签名状态。隔离 QA installer 也已生成。

安装、升级、卸载、残留检查和重装未执行：当前 NSIS 是 per-machine 流程，没有安全隔离的提升权限安装沙箱；为避免覆盖现有安装或触碰真实 AppData，按任务安全规则标记“未验证”。

## 11. Fixture 说明

初始 fixture 25 个文件、6,292,761 bytes，覆盖 PDF、TXT、Markdown、CSV、JSON、PNG/JPG、ZIP、无扩展名、大写扩展名、零字节、重复内容、同名不同目录、Unicode、空格/括号、长/深路径、只读、目标冲突、索引后移除和适度大文件。

所有内容均为本轮生成的无敏感测试数据；没有运行占位可执行文件。

## 12. 文件哈希变化

- 扫描前、扫描后、执行前均为 25 文件、6,292,761 bytes；扫描阶段哈希不变。
- 最终为 28 文件、6,292,910 bytes。
- `inbox/stale/will-be-removed-after-scan.txt` 被测试流程外部移除，用于验证 stale source。
- `cleanup-project/dist/bundle.js` 与 `cleanup-project/node_modules/demo/index.js` 由 Safe Trash Restore 恢复。
- 原 `inbox/data.csv` 内容经过应用移动/重命名保存在 `organized/Documents/Spreadsheets/data-renamed.csv`；同路径新 fixture 内容用于恢复冲突/no-overwrite 验证。
- `organized/Media/Images/image.png` 是目标同名冲突 fixture；源文件仍保留。
- 其他同路径文件哈希不变；每一步完整 manifest 位于外部证据目录。

## 13. Canary 结果

fixture 外 canary 前后 SHA-256 均为 `A4A42C819FE5A32270DAF1F548F870CE908417DD327BB0416127310043DCC08B`，大小 47 bytes。未发生越界修改。

## 14. 扫描结果

Tauri dev 首次扫描 25 个文件、6,292,761 bytes，扫描前后全量哈希一致。release 复扫当前状态处理 24 个文件、跳过 2、警告 0；当前索引摘要 6.0 MB。扫描根仅为 fixture inbox。

## 15. SQLite 结果

File Library 的真实 SQLite 全索引视图显示 26 个文件，分页状态为 50/62 entries（包含历史索引状态）；当前扫描范围摘要为 24 个现存文件。重启后索引摘要、真实文件搜索和五条 History 操作记录仍在。

## 16. Suggestions

fixture 生成的建议不会自动移动文件。未决定、接受、保留、重命名、需复核、blocked、目标冲突、批量选择和 Inspector 路径均经过真实 Tauri 验证。Automation 手动运行结果只进入 Suggestions。

## 17. Preview

只有接受/调整项进入 Preview。Preview 显示实际可执行数、blocked 和目标路径；在明确确认前 manifest 不变。取消/返回不会修改文件。目标已存在时 Preview 现在直接 `is_executable=false`、`selected_by_default=false`，最终执行检查仍保留。

## 18. 执行

全部执行均经 Suggestions → Preview → 最终确认 → Rust 安全路径：

- 安全移动和安全重命名成功；
- 自动创建目标目录成功；
- 同名目标和 stale source fail-closed；
- 一个 Windows 独占锁文件构造了同批次 1 成功/1 失败；
- 成功项随后通过 History Restore；
- 没有覆盖、永久删除或越出 fixture。

## 19. Safe Trash

Cleanup 只分析明确 fixture root；确认后候选移至源目录相邻 `.zen-canvas-trash`，没有进入盘符根目录，也没有永久删除或清空系统回收站。取消、确认、错误、History 和 Restore 路径均验证。

## 20. History

真实 History 包含成功、失败、部分成功、恢复成功与恢复失败/不可恢复状态。部分成功批次在同一批次显示 1 success、1 failed；重启后仍持久化。长路径没有引入水平滚动。

## 21. Restore

移动成功项恢复到原路径；重复 Restore 不会重复移动；源/目标缺失会重新判断资格；原路径存在冲突时 Restore 被拒绝且不覆盖。Safe Trash 候选成功恢复。

## 22. Automation

创建、编辑、启用、暂停、删除、重启持久化和手动运行已在真实 Tauri 验证。手动运行仅使用页面展示且启用的 `userRules`；system templates 不作为隐藏输入。运行只生成建议，未直接移动、重命名、删除或绕过 Preview。

## 23. AI

AI Off 正常；Local/Cloud 设置状态、无 key Cloud 提示和不可用路径明确。保存失败保持 draft、不会发布 runtime，也不会泄漏 key/请求正文。没有使用真实 API Key、真实 Provider 或发送 fixture 内容；本机无可用模型时不宣称连接成功。

## 24. 窗口行为

Ask every time、Minimize to background、Quit、最小化/最大化/恢复和重启完成真实窗口验证。测试后没有修改生产 launch-at-login 状态。多显示器边界和窗口位置持久化未单独验证。

## 25. 全局热键

真实 Win32 `SendInput` 在主窗口最小化/非前台时发送 `Ctrl+K`，Rust callback 被触发；当 standalone search window 可见性读取失败时，主窗口被 unminimize/show/focus，Spotlight 打开且焦点位于命令输入框。该 runtime fallback 有 Rust 单测、API listener 测试和真实截图。

## 26. Folder picker

真实 Windows `#32770`、标题“选择要扫描的空间”的原生对话框完成选择、取消和重复目录去重。一次探索中导航到 `D:\Install_Package` 后没有点击扫描，立即通过 UI 删除并确认最终 root 仅 fixture；没有扫描该目录或个人目录。不存在目录、Search Root 和组织目标的所有错误注入组合未全部逐项覆盖。

## 27. DPI 和可访问性

在当前系统实际 DPR 2 下完成 980×681、1440×901、1920×1081 的 Tauri 窗口验证，Light/Dark/System、键盘 Spotlight Esc/焦点恢复和 Dialog 路径可用。

未验证：独立切换 Windows 125%/150% DPI、200% 文本缩放、高对比度、Narrator、完整 reduced-motion 组合；不得把窗口 resize 或 DPR 2 截图冒充这些项目。macOS 无实机，仅保留平台代码审计。

## 28. 自动化测试结果

- `npm test`：62 files，415 passed，0 failed。
- `npm run test:performance`：2 files / 9 behavior tests passed；100,000-row SQLite/FTS benchmark passed。
- `npm run verify`：typecheck、415 frontend tests、performance、build 和 npm audit 全部退出码 0。

## 29. Rust 测试结果

`cargo test --manifest-path src-tauri/Cargo.toml --jobs 1`：320 passed、0 failed、1 ignored（既有 100k benchmark 由专用 performance 命令执行并通过）。新增覆盖 existing target Preview block、fixture-local Safe Trash 和全局热键 fallback。

曾在 dev watcher 同时编译时出现一次 Windows pagefile/rlib 环境失败；停止 dev 并顺序单作业重跑后完整门禁通过，没有跳过或弱化测试。

## 30. 安全审计

- npm audit：0 vulnerabilities，退出码 0。
- cargo audit：0 denied advisories，16 allowed warnings，退出码 0。warning 包含既有 unmaintained/unsound transitive dependencies；没有新增依赖或更改 allowlist。
- `git diff --check`：退出码 0；仅报告 Windows LF/CRLF 工作区提示，没有 whitespace error。

## 31. 已知限制

- standalone search WebView 的 `is_visible()` 在当前 WebView2 runtime 仍可能返回通道错误；用户可见路径使用已验证的主窗口 Spotlight fail-safe fallback。
- Vite 报告主 chunk 578.38 kB 超过 500 kB warning；Stage 9 未做无关架构重构。
- installer 与 release binary 未数字签名。
- 100k benchmark 的首次 pre-optimize probe 约 43.7 s；写入 optimize 后 search p95 3.043 ms（verify 重跑 3.141 ms），低于 1000 ms 门槛。

## 32. 未验证项目

installed application 安装/升级/卸载/重装、Windows 125%/150% DPI、200% text scaling、高对比度、Narrator、多显示器边界、完整 launch-at-login 系统重启链、macOS 实机。以上均不写“通过”。

## 33. Release Candidate 结论

Windows RC 的 34 项硬门槛在代码、Tauri dev、release executable、fixture manifests、回归测试和审计证据下满足：无 Critical/High 安全问题，无越界、覆盖、永久删除、Preview 绕过或 Automation 直接执行。结论为 **Stage 9 已完成，Windows Release Candidate 通过，带明确平台/安装/DPI 限制**。

这不等同于 installed-application、签名或跨平台发布通过；这些项目仍需人工/专用环境门禁。

## 34. 安装器大小和 SHA-256

- 正式 NSIS：`F:\Coding\Zen-Canvas\src-tauri\target\release\bundle\nsis\Zen Canvas_0.1.39_x64-setup.exe`
- 大小：5,537,118 bytes
- SHA-256：`CB9112C52C8E9B8AF7E634B3F317251EC545ECFEAF742FB28BE490E5FE8C6B47`
- Authenticode：`NotSigned`
- 隔离 QA release executable：19,621,888 bytes，SHA-256 `94C15CA5C0ABF0E2F71D05FB43D5A21CD60D0D50FC888753C6588C73F23EEF09`

## 35. 外部证据目录

`C:\Users\77588\.codex\artifacts\zen-canvas-stage9`

包含任务要求的 native proof、fixture 各阶段 SHA-256 manifest、canary、command results、console/Rust log index、installer manifest、screenshot index、原始日志和 PNG。fixture、日志、截图、installer、`dist`、`target` 均未提交。

## 36. Git 提交和 push 状态

提交采用任务书建议的四类语义：任务书、修复、测试、closeout。最终普通 push、本地/远端 SHA 相等与 clean worktree 由交付报告记录；不 amend、不 rebase、不 force push。
