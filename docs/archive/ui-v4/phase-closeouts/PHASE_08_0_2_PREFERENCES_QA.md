# Phase 8.0.2 — Preferences 与 Settings Component System QA

## Scope

- Branch: `ui/design-foundation-v4`
- Baseline: `4addb25f6fb02bf7b8acf793758da71ca7154db7`
- Scope: Preferences / Settings component system、响应式临界区、焦点与键盘交互、主题与语言持久化、AI 设置 fail-closed。
- Explicitly unchanged: Rust safety policy、数据库结构、版本号、文件执行路径、Stage 9。

## Implemented contract

- `SettingsPrimitives.tsx` 提供统一的布局、section nav、control group、row、segmented radio、switch、select、textfield、disclosure、empty state 和 inline message。
- Settings 只有一个主滚动容器；`>=1180px` 使用垂直侧栏，`<1180px` 使用紧凑水平导航。React 导航交互与 CSS 使用同一 `1180px` 语义断点。
- Appearance、Files & Scan、Search、Automation、AI、Privacy、About 按固定顺序渲染，页面不重复输出 Settings `h1`。
- Automation 手动运行说明和规则集合统一限定为启用的 user rules；系统模板不会隐藏参与运行。
- Segmented control 使用真实 `radiogroup/radio` 语义和方向键；switch 使用真实 `checkbox`，没有可见 On/Off 文案。
- AI 普通层隐藏工程连接参数；Developer mode 下通过默认折叠的 Advanced disclosure 暴露。provider preset 不清除 API key；保存失败回滚本地设置并显示错误。
- Spotlight section command 将焦点还原到目标 section heading；普通 Dialog 仍优先还原真实触发元素。
- Scan Roots / Search Roots 空状态各只有一个视觉主 CTA；文件夹选择或删除持久化失败时不提前关闭状态或吞掉错误。

## Automated validation

| Command | Result |
| --- | --- |
| `npm install` | exit 0; 0 vulnerabilities |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0; 61 files / 393 tests |
| `npm run test:performance` | exit 0; 2 files / 9 tests; SQLite/FTS benchmark passed |
| `npm run security:audit` | exit 0; 0 vulnerabilities |
| `npm run security:audit:rust` | exit 0; existing allowlisted warnings only |
| `npm run build` | exit 0 |
| `npm run verify` | exit 0 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | exit 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | exit 0; 248 + 22 + 1 + 5 + 1 + 9 + 32 Rust tests passed |
| `cargo build --release --manifest-path src-tauri/Cargo.toml` | exit 0 |
| `git diff --check` | exit 0; only Windows LF/CRLF normalization warnings |

## Browser QA evidence

Browser evidence is stored outside the repository at:

`C:\Users\77588\.codex\artifacts\zen-canvas-phase8-0-2-preferences\`

The formal proof file is `phase8-0-2-browser-proof.json`. It records Light and Dark runs for:

`1920x1080`, `1440x900`, `1280x800`, `1180x720`, `1100x700`, `1024x700`, `1000x700`, `981x680`, `980x680`, `900x650`.

For every size and theme:

- AppShell root remained at `scrollTop=0` after section navigation.
- HTML, body, and Settings scroll container had no horizontal overflow.
- Settings header remained visible; the `1024px` root-scroll regression was fixed and rechecked.
- Navigation was grid/vertical at `1180px` and above, flex/horizontal below `1180px`.
- Focus-visible, keyboard navigation, Escape close, Spotlight anchor focus, theme switching, language switching, and reload persistence were checked.
- Final clean Browser tab reported `0` console errors and `0` console warnings.

Representative screenshots include:

- `preferences-1180.png`
- `preferences-1100.png`
- `preferences-1024.png`
- `preferences-980.png`
- `preferences-900.png`
- `preferences-appearance-light-1440x900.png`
- `preferences-appearance-dark-1440x900.png`
- `preferences-ai-user-light.png`
- `preferences-ai-developer-dark.png`
- `preferences-focus-visible.png`
- `preferences-spotlight-anchor.png`

The Browser environment does not provide the native Tauri folder picker, so a real populated folder list could not be produced without adding production fixture data. The empty-state CTA and picker failure handling were verified instead. A URL-gated AI save-failure fixture was used only temporarily to verify the visible rollback/error state; it was removed before final validation, and no fixture code or screenshot was committed. The save-failure screenshot is explicitly marked as fixture evidence in the proof JSON and is not a real backend result.

## Security and delivery boundary

No automatic move, rename, delete, permanent-delete, overwrite, preview bypass, or Rust/database safety change was introduced. No fixture, screenshot, cache, installer, or build output is tracked by this change. Delivery stops at Phase 8.0.2; Stage 9 is not started.
