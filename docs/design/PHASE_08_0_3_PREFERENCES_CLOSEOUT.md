# Phase 8.0.3 Preferences Interaction & QA Closeout

## Scope and delivery identity

- Branch: `ui/design-foundation-v4`
- Baseline SHA: `b79a833c0c497d0deea8801f68b5e3d442dbf7ed`
- Final implementation SHA: `7b22371957ac2f003cc040b1d1de45a182a4099c`
- The implementation SHA is the product-code commit validated by this document. The following QA-only commit contains the behavior tests and this report; its pushed SHA is verified in the delivery report because a commit cannot embed its own content hash.
- Scope stopped at Phase 8.0.3. Stage 9 was not started.

This closeout is limited to Preferences interaction correctness, accessibility semantics, responsive behavior, and verifiable QA evidence. It does not redesign the application or change Automation rule selection, Rust file execution, database schema, migrations, versioning, Preview, Safe Trash, Restore, conflict checks, or confirmation boundaries.

## Correctness changes

- Switch: the native checkbox remains `type="checkbox"`, `role="switch"`, and `aria-checked`; its visible track, thumb, and associated label are one native label target. Disabled switches are inert and use a neutral track so a preserved checked value is not presented as currently active.
- Section navigation: Arrow keys and Home/End activate and scroll the requested section while retaining navigation focus. Mouse navigation scrolls and focuses the section heading. `focusContent=false` suppresses heading focus only; it no longer suppresses scrolling.
- Spotlight: theme, search-scope, and AI targets restore focus to the corresponding Settings heading. `settings-search-scope` continues to map to `settings-search`.
- AI Off: cleanup, provider, presets, and advanced request controls are disabled without clearing their values. Re-enabling Local or Cloud restores the retained configuration. A dirty On-to-Off transition remains saveable.
- AI save failure: persistence remains fail-closed. Failed settings are rolled back, runtime mode is not published, the key is sanitized from errors, and the AI section renders one failure alert.
- API Key: a local-only `SettingsSecretField` defaults to `type="password"`, exposes keyboard-accessible Eye/EyeOff reveal state with localized labels, and never persists reveal state. Provider changes preserve the input value.
- Inline messages: static guidance has no live-region role. Dynamic success/loading messages opt into `role="status"`; failures opt into `role="alert"`.
- Responsive layout: Settings rows and AI advanced grids share the `1180px` wide-layout breakpoint. Below it, controls stack instead of compressing descriptions into a narrow column.
- Narrow navigation: below `1180px`, the horizontal section navigation is sticky inside the single Settings scroll owner, has an opaque surface/divider/z-index, scrolls the active item with `block: nearest` and `inline: nearest`, and offsets destination headings. At and above `1180px`, only the vertical sticky navigation is used.

## Automated verification

| Command | Result | Counts / warnings |
| --- | --- | --- |
| `npm install` | exit 0 | 308 packages audited; 0 vulnerabilities |
| `npm run typecheck` | exit 0 | 0 TypeScript errors |
| `npm test` | exit 0 | 62 files; 403 tests passed |
| `npm run test:performance` | exit 0 | 2 files / 9 behavior tests; 100,000-row FTS benchmark passed |
| `npm run security:audit` | exit 0 | 0 vulnerabilities |
| `npm run security:audit:rust` | exit 0 | 16 existing allowlisted advisory warnings; 0 new warnings |
| `npm run build` | exit 0 | production UI, release binary, and NSIS installer built; existing plugin-timing and chunk-size advisories only |
| `npm run verify` | exit 0 | typecheck, 403 tests, performance benchmark, build, and npm audit repeated successfully |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | exit 0 | 0 formatting errors |
| `cargo test --manifest-path src-tauri/Cargo.toml` | exit 0 | 318 passed; 1 ignored benchmark; 0 failed |
| `cargo build --release --manifest-path src-tauri/Cargo.toml` | exit 0 | release profile completed |
| `git diff --check` | exit 0 | no whitespace errors; Windows LF/CRLF notices only |

The new real DOM/React tests cover visible track/thumb/label switching, disabled switch behavior, keyboard and mouse section navigation, Spotlight focus restoration, AI Off dependency preservation, fail-closed save rollback/runtime isolation, API Key reveal/hide/provider preservation, InlineMessage roles, and the responsive/sticky source contracts. Existing tests were retained.

## Browser QA matrix

The Browser QA used the Zen Canvas Browser mock, not a real Tauri backend or real AI provider. Every row was captured in both Glacier Light and Deep Sea Dark.

| Requested viewport | Light | Dark | Layout evidence |
| --- | --- | --- | --- |
| 1920×1080 | pass | pass | actual 1920×1080 PNG; vertical nav; wide rows |
| 1440×900 | pass | pass | vertical nav; wide rows |
| 1280×800 | pass | pass | vertical nav; wide rows |
| 1180×720 | pass | pass | vertical nav; wide rows |
| 1100×700 | pass | pass | horizontal sticky nav; stacked rows |
| 1024×700 | pass | pass | horizontal sticky nav; stacked rows |
| 1000×700 | pass | pass | horizontal sticky nav; stacked rows |
| 981×680 | pass | pass | horizontal sticky nav; stacked rows |
| 980×680 | pass | pass | horizontal sticky nav; stacked rows |
| 900×650 | pass | pass | horizontal sticky nav; stacked rows |

All 20 matrix records report no horizontal overflow, `appShellScrollTop=0`, matching requested/inner viewport dimensions, matching screenshot pixel dimensions, and zero console errors/warnings. The Browser backend screenshot stream was written as true PNG without resizing and dimensions were read back from each file.

## Specialty evidence

- Focus visible: `preferences-focus-visible-light.png`, `preferences-focus-visible-dark.png`
- Switch click: `preferences-switch-off-dark.png`, `preferences-switch-on-dark.png`; click target was `data-settings-switch-track`, with DOM `aria-checked` changing from `false` to `true`
- AI mode: `preferences-ai-off-light.png`, `preferences-ai-cloud-light.png`
- AI developer: `preferences-ai-developer-dark.png`; AI active, Developer mode enabled, Advanced expanded, connection/API key/model/performance controls visible
- API Key: `preferences-api-key-hidden-dark.png`, `preferences-api-key-visible-dark.png`; only a temporary non-production value was used, then hidden and cleared
- Save failure: `preferences-ai-save-failure-light.png`; URL-gated fixture, one AI alert, rollback confirmed, secret absent
- Sticky navigation: `preferences-900x650-sticky-nav-light.png`, `preferences-900x650-sticky-nav-dark.png`; AI/Privacy headings clear the sticky nav and active items are visible

Focus SHA-256 proof:

- Light focus: `2d5c64462e529627f5be3d89e798bd1f1d87b3bc643235943267b261ed8a6839`
- Light normal: `b9107de08d39a9d463ede0af08807569e36de9fed9bc424ee1e303c605c0d36a`
- Dark focus: `a23f35adaf9c5e0a33ddcea9592de8fa0c758144cc19ef41ebdee6c99794849b`
- Dark normal: `bc6eaa74957e9da9ca897e37696dc9effecfd42f526ecb3b5aa6bc3aa929755d`

Both focus images differ from their normal counterparts.

- Proof JSON: `C:\Users\77588\.codex\artifacts\zen-canvas-phase8-0-3-preferences\phase8-0-3-browser-proof.json`
- Screenshot directory: `C:\Users\77588\.codex\artifacts\zen-canvas-phase8-0-3-preferences\`

The temporary save-failure fixture was removed before the final Browser reload. The final clean page used `/` with no fixture query, contained no temporary test value, and reported zero console errors/warnings. Fixtures and screenshots are outside the repository and are not committed.

## Limits and safety evidence

- Browser QA cannot validate a real AI provider; no real provider was connected.
- Native Tauri folder pickers cannot return real folder selections in Browser mock mode.
- Real backend verification comes from 318 passing Rust tests, the release build, and the generated desktop installer.
- No Rust source, Cargo dependency, database, migration, file-operation chain, version, Automation user-rule semantics, or safety execution boundary was changed.
- No automatic move, rename, delete, permanent delete, or overwrite path was introduced.
- Preview, execution confirmation, conflict checks, Safe Trash, Restore, and API Key preservation remain intact.
- Screenshots, Browser fixtures, installers, `dist`, cache, and `target` outputs are not committed.
- Final normal push verification records a clean worktree and equal local/remote SHAs in the delivery report.

Generated installer (not committed):

- Path: `F:\Coding\Zen-Canvas\src-tauri\target\release\bundle\nsis\Zen Canvas_0.1.39_x64-setup.exe`
- Size: `5,534,971` bytes
- SHA-256: `F688247748A1CD1DCE9B749DE4AF39346834A0173B96DFC6A870E73FBD49C49B`
