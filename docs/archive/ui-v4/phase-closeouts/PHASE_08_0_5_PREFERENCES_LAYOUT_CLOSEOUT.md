# Phase 8.0.5 — Preferences Layout Integrity & Evidence Correction Closeout

## Scope and revisions

- Branch: `ui/design-foundation-v4`
- Starting local/remote SHA: `66173228c6b0af2eafd2e6f29493187042fc640f`
- Tested implementation SHA: `caace68ef20cab7f1453ecf1a3b4068111581b3b`
- Delivery tip: the documentation commit is intentionally not self-referential. Its exact final local/remote SHA is recorded in `phase8-0-5-browser-proof.json` and the final delivery report after the documentation commit and push.
- Scope stayed within Preferences layout, interaction presentation, frontend tests, and this closeout report. No Rust source, database schema, version, file-execution policy, business module, or Stage 9 feature changed.

## Root-cause conclusion

The investigation found both an invalid historical capture and a smaller real DOM overflow.

Phase 8.0.4 部分截图证据因 capture 区域或 viewport 配置错误而无效，Phase 8.0.5 已重新采集并替换证据。

The old nominal `1440x900` images contained approximately doubled layout coordinates: the sidebar boundary appeared near x=454 instead of the real x=228, the title bar near 94 px instead of 48 px, and Spotlight near x=1000 instead of x=500. They were the upper-left portion of a scaled raster, not a trustworthy full-window capture. The old proof JSON also lacked screenshot pixel dimensions, `visualViewport`, and nested Settings metrics, so it could not disprove the visible cropping.

Separately, the real 1440px DOM had a repeatable 5 px overflow chain. The AI mode row limited its control to 360 px; its three tracks were about 114 px each; `whitespace-nowrap` made “Using a local model” require 163 px and “Using cloud AI” require 124 px. The radiogroup measured `358/364` client/scroll width and propagated the 5 px delta through the AI section and Settings content. It was not caused by Spotlight or the AppShell.

## Implementation

- The wide Settings grid is bounded at 1240 px with `200px minmax(0,1fr)` columns and a controlled 32–44 px gap, giving the content column more usable width while keeping it shrinkable.
- `SettingsRow` exposes a bounded 480 px wide-control variant for AI mode. Layout, content, row, segmented-control, and advanced-connection measurement hooks were added for real DOM evidence.
- Three-option controls remain one column below 1180 px and exactly three columns at or above 1180 px. Their labels use `min-width: 0` and natural wrapping instead of forcing overflow. No text, control, or font was hidden or reduced.
- Narrow section navigation has 20 px scroll gutters. General and About can move outside the fade masks with Home/End while only the nav `scrollLeft` changes horizontally.
- The AI save region is now a compact divider treatment. Runtime remains the primary line; draft appears only while dirty; save failure appears once in a separate inline alert with the retained-runtime explanation. Dynamic error text uses safe anywhere wrapping.
- Save semantics remain fail-closed: failure does not update runtime or persisted state, retains the draft, leaves Save retryable, redacts secrets, and returns the API Key to password mode.
- Spotlight production code did not require a change. Real-browser measurements proved the full control stayed inside the title bar at all target widths; opening, Esc close, target navigation, and exact trigger focus restoration all passed.

## Modified files and responsibilities

- `src/views/settings/components/SettingsPrimitives.tsx`: controlled wide grid, shrinkable content, wide AI control slot, wrapping three-option labels, narrow-nav scroll gutters, and DOM measurement hooks.
- `src/views/settings/SettingsView.tsx`: compact runtime/draft presentation, one failure alert, wide AI mode row, safe error wrapping, and status/advanced-grid hooks.
- `tests/settingsComponentSystem.test.tsx`: real rendered component tests for bounded layout, wrapping three-option controls, edge-gutter navigation, Home/End, and focus behavior.
- `tests/settingsViewBehavior.test.tsx`: confirms one success status region and API Key password reset after full unmount/remount in addition to existing success/failure/provider/section checks.
- `tests/settingsViewUi.test.ts`: updates supplementary source contracts for the new layout and measurement surface.
- `docs/design/PHASE_08_0_5_PREFERENCES_LAYOUT_CLOSEOUT.md`: records the audit, implementation, command results, Browser evidence, and delivery boundary.

## Browser layout evidence

Artifact root, screenshots, and proof JSON are external and are not committed:

`C:\Users\77588\.codex\artifacts\zen-canvas-phase8-0-5-preferences\`

All 24 Light/Dark baseline images are full-viewport JPEG captures at device pixel ratio 1 and browser zoom 1. Their decoded pixel dimensions exactly equal the requested viewport. `innerWidth/innerHeight` and `visualViewport.width/height` also equal the request; no element clip, page transform, scale, or DevTools dock was used.

The table shows Light measurements as `clientWidth/scrollWidth`; Dark produced the same pass classification. A 1 px CSSOM delta inside some fractional grid descendants is browser integer rounding (`getBoundingClientRect().width` is fractional), not a scrollable page overflow: the document, AppShell, main, and Settings scroll owner are exact, and no row or segmented control exceeds the accepted 1 px rounding tolerance.

| Viewport | Document | AppShell | Main | Settings owner | Content | AI | Row max delta | Segmented max delta | Nav (intentional) | Screenshot |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1920x1080 | 1920/1920 | 1920/1920 | 1692/1692 | 1637/1637 | 988/989 | 988/989 | 1 | 0 | 200/200 | 1920x1080 |
| 1600x900 | 1600/1600 | 1600/1600 | 1372/1372 | 1317/1317 | 988/989 | 988/989 | 1 | 0 | 200/200 | 1600x900 |
| 1440x900 | 1440/1440 | 1440/1440 | 1212/1212 | 1157/1157 | 902/903 | 902/903 | 1 | 0 | 200/200 | 1440x900 |
| 1366x768 | 1366/1366 | 1366/1366 | 1138/1138 | 1083/1083 | 830/831 | 830/831 | 1 | 0 | 200/200 | 1366x768 |
| 1280x800 | 1280/1280 | 1280/1280 | 1052/1052 | 997/997 | 747/748 | 747/748 | 1 | 0 | 200/200 | 1280x800 |
| 1180x720 | 1180/1180 | 1180/1180 | 952/952 | 897/897 | 650/651 | 650/651 | 1 | 0 | 200/200 | 1180x720 |
| 1100x700 | 1100/1100 | 1100/1100 | 872/872 | 817/817 | 805/806 | 805/806 | 1 | 0 | 805/894 | 1100x700 |
| 1024x700 | 1024/1024 | 1024/1024 | 848/848 | 809/809 | 797/798 | 797/798 | 1 | 0 | 797/894 | 1024x700 |
| 1000x700 | 1000/1000 | 1000/1000 | 824/824 | 785/785 | 773/774 | 773/774 | 1 | 0 | 773/894 | 1000x700 |
| 981x680 | 981/981 | 981/981 | 805/805 | 766/766 | 754/755 | 754/755 | 1 | 0 | 754/894 | 981x680 |
| 980x680 | 980/980 | 980/980 | 804/804 | 765/765 | 753/754 | 753/754 | 1 | 0 | 753/894 | 980x680 |
| 900x650 | 900/900 | 900/900 | 724/724 | 685/685 | 673/674 | 673/674 | 1 | 0 | 673/894 | 900x650 |

Only the narrow section nav intentionally scrolls horizontally. At 900x650 its overflow is 221 px; End exposes About fully outside both 20 px fade gutters at nav `scrollLeft=220.5`, Home restores General at `scrollLeft=0`, and document/body horizontal and vertical offsets remain zero. Section activation itself correctly changes the Settings owner's vertical position.

At 980x680, AI mode has three distinct row tops and `751/751` group width with zero button overflow. At 1180x720 it has one row, three computed columns, `416/416` group width, and zero button overflow.

Every clean baseline has General active, Settings `scrollTop=0`, one main vertical scroll owner, Spotlight inside the viewport, no alert/status, and no accidental `:focus-visible` element. Browser console errors and warnings were both zero. The dedicated keyboard screenshot proves a real focus-visible ring separately.

## AI and secret evidence

- Active Off plus unsaved Cloud: runtime `off`, persisted `off`, draft `cloud`, dirty `true`, no alert.
- Forced save failure: exactly one alert; runtime and persisted remain `off`; Cloud draft remains dirty; Save remains retryable; the temporary in-memory Tauri rejection is removed immediately after the interaction.
- Browser-mock save success: runtime, persisted, and draft become `cloud`; dirty becomes `false`; one success status is emitted.
- API Key starts as password, can be revealed with a harmless temporary in-memory value, returns to password after section change, and the temporary value is cleared before closeout. No credential, Authorization header, or request body is stored in proof JSON, documentation, source, or Git.

## Automated validation

Every required command exited 0:

- `npm install`: 308 packages audited; 0 vulnerabilities.
- `npm run typecheck`: pass.
- `npm test`: 62 files, 411 tests passed.
- `npm run test:performance`: 2 files, 9 tests passed; 100k-row FTS search p95 1.716 ms in the standalone run and 2.022 ms in `verify`, under the 1000 ms threshold.
- `npm run security:audit`: 0 vulnerabilities.
- `npm run security:audit:rust`: pass with 16 repository-existing allowed warnings; no blocking vulnerability was introduced.
- `npm run build`: pass; Vite transformed 2065 modules and Tauri produced one NSIS bundle.
- `npm run verify`: pass; repeated typecheck, 411 tests, performance, build, and npm audit.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: pass.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 318 passed, 0 failed, 1 ignored benchmark.
- `cargo build --release --manifest-path src-tauri/Cargo.toml`: pass.
- `git diff --check`: pass.

## Browser mock and native boundary

Browser QA exercised the local Browser mock and did not contact a real AI Provider. The clean baselines temporarily cleared only the Browser mock's fixed global-hotkey warning through the development store module. Failure used a temporary in-memory `save_ai_settings` rejection. Both fixtures were removed, the harmless API Key value was cleared, and no fixture was written to source or Git.

Frontend component tests prove DOM behavior and fail-closed presentation. Cargo tests and the Tauri release build validate the real Rust backend and existing file-safety boundaries, but this phase did not test a real provider credential, real provider network response, native folder picker, or operating-system global-hotkey registration. Those are explicitly unverified here.

## Installer and safety closeout

- Installer: `F:\Coding\Zen-Canvas\src-tauri\target\release\bundle\nsis\Zen Canvas_0.1.39_x64-setup.exe`
- Size: 5,536,195 bytes (5.28 MiB)
- SHA-256: `AD0093C4E4A833EE2703B983205F03E7480CF0945257D40FE52B8371AB3A7F4B`

Automation remains suggestion-only and continues to use enabled user rules. Organize Preview, allowed preview IDs, blocked/conflict checks, explicit selection and confirmation, Safe Trash, History, and Restore were not bypassed or weakened. No fixture, screenshot, cache, `dist`, `target`, installer, or credential is committed. Phase 8.0.5 stops here and does not enter Stage 9.
