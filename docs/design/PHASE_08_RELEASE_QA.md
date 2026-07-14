# Phase 8 — Final Polish & QA v4.0

## 1. 验收范围

- 项目：Zen Canvas
- 分支：`ui/design-foundation-v4`
- Phase 8 基线：`f13c5b370ad196d31d5920987c03a9379e96dd04`
- 远端：`origin/ui/design-foundation-v4`
- 交付边界：只完成 Phase 8 Final Polish & QA v4.0；完成后停止，不进入 Stage 9。
- 本阶段不新增业务功能、不修改 Rust 文件执行安全策略、不修改数据库结构、不增加版本号。

本次验收依据 `docs/design/` 下的完整设计文档集合：

1. `README.md`
2. `ZEN_CANVAS_UIUX_BRAND_SYSTEM_V4.md`
3. `CODEX_TASK_INDEX_V4.md`
4. `CODEX_TASK_01_DESIGN_FOUNDATION_V4.md`
5. `CODEX_TASK_02_APP_SHELL_V4.md`
6. `CODEX_TASK_03_OVERVIEW_V4.md`
7. `CODEX_TASK_04_FILE_LIBRARY_V4.md`
8. `CODEX_TASK_05_ORGANIZE_SUGGESTIONS_V4.md`
9. `CODEX_TASK_06_CLEANUP_HISTORY_V4.md`
10. `CODEX_TASK_07_AUTOMATION_SETTINGS_V4.md`
11. `CODEX_TASK_08_FINAL_POLISH_QA_V4.md`

## 2. 安全边界复核

Phase 8 只改变前端展示、状态提示、焦点、响应式布局、首次使用引导和 QA 证据。自动化仍然只生成建议；没有新增自动移动、重命名、删除、永久删除或覆盖文件的路径。

- Automation 页面继续使用启用的 `userRules` 作为手动运行集合；系统模板不会隐藏在 UI 之外并传入本次运行。
- 规则建议仍需进入 Organize Preview，并继续经过 `allowedPreviewIds`、blocked 检查、名称/路径冲突检查、最终执行选择、安全确认以及 History/Restore。
- Storage Cleanup 的 Review candidate 改为应用内 `ConfirmDialog`，最终 Safe Trash 确认逻辑保持原有安全路径。
- AI 错误提示不再把供应商内部参数、模型调试字段或原始请求错误直接暴露到普通界面。
- 首次使用引导只保存用户选择和设置，不触发文件移动、删除、重命名、覆盖或自动执行。
- 本阶段未修改 `src-tauri` 的执行安全策略、数据库结构、版本号或 Stage 8 之外的业务能力。

## 3. 本阶段修改清单

| 文件 | 职责 |
| --- | --- |
| `src/components/AppShell.tsx` | 挂载首次使用引导，不改变主导航和业务执行流程。 |
| `src/components/OnboardingDialog.tsx` | 三步首次使用引导：本地优先与安全边界、扫描范围、AI 模式选择；持久化成功才完成引导。 |
| `src/i18n.ts` | Settings/AI/开发检查及引导相关中英文文案。 |
| `src/store/useFileLibraryStore.ts` | 将 AI 请求失败转换为普通用户可理解、无工程参数泄露的错误提示。 |
| `src/views/cleanup/StorageCleanupView.tsx` | Review candidate 使用应用内确认弹窗；保留 Safe Trash 最终确认。 |
| `src/views/rules/AutomationRuleList.tsx` | 规则开关 loading 使用主题语义对比色。 |
| `src/views/settings/SettingsView.tsx` | 设置分组锚点、Spotlight 定位、自动化安全说明、AI 工程参数开发者模式门控、主题/语言文案与持久化状态。 |
| `src/views/shared/ui.ts` | 将控件、状态、开关和交互行统一到语义 token；补充设置分组的稳定焦点锚点。 |
| `src/views/vault/AssetCard.tsx` | 清理遗留硬编码调色板，统一使用语义颜色 token。 |
| `tests/onboardingDialog.test.tsx` | 首次使用引导的真实 DOM 流程、范围设置、AI 保存失败 fail-closed。 |
| `tests/cleanupReviewConfirm.test.tsx` | Review candidate 应用内确认弹窗真实 DOM 流程。 |
| `tests/phase8ReleaseAudit.test.ts` | 源码级发布审计：禁止 native confirm、固定调色板、跳过测试及未门控开发字段。 |
| `tests/appArchitecture.test.ts` | 更新 AI 设置源代码契约，验证 i18n 后仍保留 per-request batch、并发和 cleanup 设置。 |
| `tests/fileLibraryAIError.test.ts` | 更新普通 AI 错误面向用户的文案断言。 |
| `tests/settingsViewUi.test.ts` | 设置分组锚点、开发者模式可见性和 AI 工程参数门控。 |
| `tests/storageCleanupView.test.tsx` | Review candidate 使用应用内 ConfirmDialog。 |
| `docs/design/PHASE_08_RELEASE_QA.md` | 本文件：正式发布验收矩阵、证据、限制和交付记录。 |

## 4. 状态与交互验收矩阵

| 状态/场景 | 预期语义 | 证据 |
| --- | --- | --- |
| 首次加载 | 不阻塞主界面；引导只在未完成时出现。 | `tests/onboardingDialog.test.tsx`；Browser 截图 `phase8-1440x900-light-onboarding.png`。 |
| 加载中 | 显示可理解的 loading，不把内部请求参数当作状态文案。 | `npm test`、Settings DOM QA。 |
| 空状态 | Automation 只保留面板内一个视觉主 CTA；顶部创建入口仍键盘可达。 | `tests/automationWorkspace.test.tsx`、Browser `phase8-automation-empty-1024x700-light-en.png`。 |
| 正常状态 | 主内容、详情、设置分组和导航均有稳定标题/锚点。 | `tests/settingsViewUi.test.ts`、9 个响应式尺寸证据。 |
| 运行中/成功/失败 | 自动化只生成建议；结果与当前范围、规则集合和安全确认链保持一致。 | Phase 7 自动化行为测试；Rust 测试；本阶段未改执行链。 |
| 权限失败/配置失败 | 保存或连接失败不先更新本地成功状态；引导保存失败保持打开。 | `tests/onboardingDialog.test.tsx`；Settings 文案与状态断言。 |
| 取消/关闭/Esc | 关闭后焦点回到真实触发元素，触发元素卸载时使用稳定 fallback。 | `tests/rulesViewBehavior.test.tsx`、`tests/automationWorkspace.test.tsx`；Browser 空状态新建后 Esc 回到 `Create first rule`。 |
| 可恢复错误 | 保留重试、重新生成建议或返回安全入口；不自动执行文件操作。 | Automation/Preview/History 现有测试与安全审计。 |
| 不可恢复错误 | 显示安全、自然语言提示，不暴露内部枚举/原始请求细节。 | `tests/fileLibraryAIError.test.ts`、源码审计。 |

## 5. Automation 规则一致性复核

- 手动运行的最终集合是页面展示的启用 `userRules`；系统模板不进入 `executeRulesForScope`。
- `enabledRulesVersion`、运行确认数量、运行参数和 UI 说明以同一最终集合为依据。
- `weight` 与 `priority` 均由 Rust 分类引擎真实使用：规则先按 priority 排序，并将 weight 与 priority 共同纳入匹配评分；不是无意义配置。
- 新建/编辑规则 Inspector 与高级设置保留简短说明，解释冲突时 priority 先决定顺序，weight 参与评分。
- 规则运行过期、并发写入、旧响应拒绝和安全边界测试来自 Phase 7 真实组件/后端测试；本阶段只修复其余 Settings/提示/视觉层问题，不绕过这些边界。

## 6. Settings、主题与首次使用引导

### Settings 分组

Settings 现在有稳定分组锚点：`settings-general`、`settings-appearance`、`settings-files-scan`、`settings-search`、`settings-automation`、`settings-ai`、`settings-privacy`、`settings-about`。Spotlight 会将“外观”和“搜索范围”分别定位到对应分组。

普通 AI 设置只显示用户需要理解的开关和隐私说明。Batch Size、Max Tokens、Timeout、response format/thinking、Extra Body JSON 和调试入口仅在显式开启开发者模式后显示；普通设置不会展示无意义的工程参数。

### 主题证据

- 白昼：根节点无 `dark` class，页面背景为 `rgb(244, 246, 249)`，白昼按钮为 pressed。
- 深海：根节点为 `dark`，页面背景为 `rgb(10, 15, 26)`，深海按钮为 pressed。
- 跟随系统：系统为白昼时根节点无 `dark` class，System 按钮为 pressed。
- 刷新后：主题根节点和完成引导状态保持；现有真实主题测试覆盖 remount/system 持久化。
- 证据文件：`C:\Users\77588\.codex\artifacts\zen-canvas-phase8-final-qa\phase8-theme-proof.json`、`phase8-theme-refresh-proof.json`；Browser console 最终 error/warn 数为 0。

### 首次使用引导

引导顺序为“本地优先与安全边界 → 扫描范围 → AI 模式”。选择文件夹使用既有目录设置 API；云端模式记录 provider/preset 但保持 disabled，直到用户在设置中完成凭据配置。任何持久化失败都保持当前步骤，不写入完成标记。

## 7. 响应式与布局证据

### 断点语义

工作区使用实际容器宽度决定列表/详情结构；React 的 narrow 语义与 CSS 使用同一容器断点。1024px 不再因为 `lg` 视为可用双栏宽屏。

### 尺寸矩阵

| CSS viewport | 水平溢出 | 主滚动容器 | 结果 |
| --- | --- | --- | --- |
| 1440×900 | 无 | 0 | 通过 |
| 1280×800 | 无 | 0 | 通过 |
| 1180×720 | 无 | 1 | 通过 |
| 1100×700 | 无 | 1 | 通过 |
| 1024×700 | 无 | 1 | 通过 |
| 1000×700 | 无 | 1 | 通过 |
| 981×680 | 无 | 1 | 通过 |
| 980×680 | 无 | 1 | 通过 |
| 900×650 | 无 | 1 | 通过 |

原始测量保存在 `C:\Users\77588\.codex\artifacts\zen-canvas-phase8-final-qa\phase8-layout-metrics.json`。9 个尺寸均满足 `document.scrollWidth === body.scrollWidth === viewport.width`；1180px 以下只有预期的主内容滚动容器。

Browser 视口是 CSS viewport，不等同于 Windows 系统 125%/150% DPI 的原生缩放验证；125%/150% 仍需在真实 Windows Tauri 窗口中人工复核。当前执行环境未覆盖 macOS 原生窗口。

## 8. History 长路径与可访问性

- 批次路径默认限制为最多两行并保留尾部语义；完整路径通过 `title`/可访问描述和 Inspector 获取。
- Inspector 允许完整路径换行；reveal 与现有 restore eligibility / no-overwrite 逻辑保持不变。
- Browser 证据 `phase8-history-1024x700-light-en.png` 和 `phase8-history-proof.json` 验证 Windows 深层路径在 1024px 下没有横向溢出。
- 现有 History 测试覆盖长路径 line clamp；本阶段没有引入 fixture、截图或构建产物到仓库。
- 全局 reduced-motion CSS 与现有 `tests/phase10AccessibilityMotion.test.ts` 保持；live region 不再让完整实时摘要在每次输入时重复播报。
- 200% zoom、系统高对比度和真正 Tauri 原生焦点环需在桌面环境人工复核；本次 Browser QA 使用 CSS 视口和 DOM/截图证据。

## 9. Browser QA 证据

外部证据目录（不提交）：

`C:\Users\77588\.codex\artifacts\zen-canvas-phase8-final-qa\`

已保存：

- 9 个尺寸的 Light/Dark 主页面截图：`phase8-{1440x900,1280x800,1180x720,1100x700,1024x700,1000x700,981x680,980x680,900x650}-{light,dark}.png`
- 首次引导：`phase8-1440x900-light-onboarding.png`
- Settings 英文 Light/Dark：`phase8-settings-1024x700-light-en.png`、`phase8-settings-1024x700-dark-en.png`
- Automation 空状态：`phase8-automation-empty-1024x700-light-en.png`
- History 长路径：`phase8-history-1024x700-light-en.png`
- 布局、主题、History 机器可读证据：`phase8-layout-metrics.json`、`phase8-theme-proof.json`、`phase8-theme-refresh-proof.json`、`phase8-history-proof.json`

Browser QA 使用 Vite 本地页面的 Browser mock 数据，只用于验证 DOM、主题、焦点、响应式和展示状态；不能替代 Tauri/Rust 后端数据流验证。真实后端证据来自 Rust 单元/集成测试、前端现有真实 API contract tests 和安全审计命令。没有把 Browser fixture、截图、安装包、缓存或 debug entry 提交到仓库。

已覆盖的 Browser 场景：Light/Dark/System、刷新后主题保持、中文/English 设置、首次引导稍后设置、自动化空状态、创建规则后 Esc 回到空状态 CTA、History 深层 Windows 路径、9 个尺寸无水平溢出。

## 10. 命令矩阵

以下命令在最终提交前运行并记录退出码；若安装器由构建生成，只记录外部路径和 SHA-256，不提交安装器。

| 命令 | 结果 |
| --- | --- |
| `npm install` | 退出码 0；依赖已是最新，0 vulnerabilities |
| `npm run typecheck` | 退出码 0 |
| `npm test` | 退出码 0；59 files / 378 tests passed |
| `npm run test:performance` | 退出码 0；2 files / 9 tests passed；100,000 rows，search P95 1.798ms，total P95 3.876ms，阈值 1000ms |
| `npm run security:audit` | 退出码 0；0 vulnerabilities |
| `npm run security:audit:rust` | 退出码 0；16 个既有允许 warning，未阻断发布 |
| `npm run build` | 退出码 0；生成 NSIS 安装器 |
| `npm run verify` | 退出码 0；包含 typecheck、npm test、performance、build、npm audit |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 退出码 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 退出码 0；318 passed / 1 ignored |
| `cargo build --release --manifest-path src-tauri/Cargo.toml` | 退出码 0 |
| `git diff --check` | 退出码 0；仅有 Windows 换行格式提示 |
| `git status --short` | 最终必须为空 |

## 11. 发布评分与已知限制

| 维度 | 结果 | 说明 |
| --- | --- | --- |
| 全局一致性与视觉系统 | 通过 | 语义 token、Light/Dark、遗留固定色清理。 |
| Settings/Onboarding | 通过 | 分组锚点、三步引导、失败 fail-closed、开发字段门控。 |
| Automation | 通过 | userRules 与实际运行集合一致；安全边界保留。 |
| 响应式 | 通过（CSS viewport） | 9 个尺寸无水平溢出；主滚动容器符合预期。 |
| 焦点与可访问性 | 通过（DOM/自动化） | Esc/focus、reduced motion、live region 证据；系统高对比度需桌面复核。 |
| History | 通过 | 长路径两行密度与完整路径可达；restore 安全链未改。 |
| 性能与安全 | 通过 | 前端、性能、npm/Rust 安全和 Rust 测试矩阵需以最终命令输出为准。 |

已知限制：

1. Browser QA 使用本地 mock，不声称已替代真实 Tauri 端到端后端 QA。
2. Windows 原生 125%/150% DPI、macOS 原生窗口和系统高对比度尚未在本环境完成人工截图。
3. 当前未创建或合并 Pull Request；交付后只建议从最终分支创建 PR，由用户决定。
4. Phase 8 完成即停止，不进入 Stage 9。

## 12. 交付记录

- 提交策略：独立、语义清晰的普通提交；不 amend、不 rebase、不 force push。
- 实现提交：`f55f9629cdcf763cff6b1a1aeab7be28f5c55c42`（`fix(ui): close phase 8 final polish gaps`）。
- 推送策略：仅正常 push 到 `origin/ui/design-foundation-v4`。
- 安装器：`F:\Coding\Zen-Canvas\src-tauri\target\release\bundle\nsis\Zen Canvas_0.1.39_x64-setup.exe`，5,531,028 bytes，SHA-256 `43376F4A984F862F2E433B8C7A03FB9E115D7647C5ACE2A12721C14F25B270A1`；安装器不提交。
- 最终 SHA、远端 SHA 和工作区状态在推送完成后补齐。
