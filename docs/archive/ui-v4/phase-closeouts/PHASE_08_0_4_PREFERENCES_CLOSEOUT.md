# Phase 8.0.4 — Preferences State, Navigation & QA Evidence Closeout

## Scope and revisions

- Branch: `ui/design-foundation-v4`
- Starting SHA: `e0c0565731b6840798570c27a6c64431f86a7ca4`
- Tested implementation SHA: `56cbbb59e1ae26170b579c1eb7fc9cde7002565d`
- Delivery tip: the documentation commit is intentionally not self-referential; the exact final local/remote SHA is recorded in `phase8-0-4-browser-proof.json` and the final delivery report after the documentation commit and push.
- Scope remained inside Preferences/Settings UI, interaction state, localization, and frontend tests. No version, migration, Rust file-safety policy, database schema, or Stage 9 functionality changed.

## Modified files

- `src/views/settings/SettingsView.tsx`: separates runtime, persisted, draft, dirty, saving, and failure presentation; adds the sticky AI save bar; keeps failed drafts; removes the duplicate advanced Provider control; coordinates API Key reveal reset events; stabilizes initial and requested section navigation.
- `src/views/settings/components/SettingsPrimitives.tsx`: adds deterministic active-section selection, a zero-scroll General anchor, horizontal-only active-nav centering, hidden scrollbar/wheel support, edge fades, all-at-once three-option responsiveness, and controlled disclosures.
- `src/views/settings/components/SettingsSecretField.tsx`: resets local reveal state from a parent lifecycle key without persisting it.
- `src/i18n.ts`: adds natural Chinese and English active-mode and unsaved-draft copy.
- `tests/settingsComponentSystem.test.tsx`: exercises section boundaries, all navigation keys, horizontal centering/wheel behavior, reveal reset/remount, and semantic controls.
- `tests/settingsViewBehavior.test.tsx`: exercises active Off versus Cloud draft, success publication, fail-closed retry, one Provider, initial/Spotlight navigation, and all required secret-hide transitions.
- `tests/settingsViewUi.test.ts`: updates the source contract for sticky state, responsive layout, hidden scrollbar, and Provider deduplication.

## AI state and save behavior

The page now treats the Zustand processing-mode store as runtime state, the last backend response as persisted state, and local form values as the editable draft. `aiSettingsEqual` derives dirty state; saving and failure remain separate UI state.

The sticky save bar always identifies the current active mode. A dirty draft adds a separate unsaved draft mode. The sidebar continues to read runtime state and does not follow draft edits.

On success, the backend result updates persisted and draft settings, publishes runtime mode, clears dirty/error state, announces success once, hides the API Key, and leaves the user in AI. On failure, runtime and persisted state remain unchanged, the draft remains editable, exactly one dynamic `role=alert` is shown, the error is sanitized, reveal resets to password, and Save remains retryable.

## Navigation and responsiveness

- A normal Preferences entry explicitly starts at General with Settings `scrollTop=0`; a pending Spotlight request is the only initial override.
- General navigation is a hard zero-scroll anchor. Other sections account for the sticky horizontal-nav height.
- Scroll-spy uses a main-visibility activation line, avoids letting a previous section tail dominate, and selects the final section at the bottom.
- Mouse navigation focuses the target heading. Arrow keys, Home, and End retain navigation focus while scrolling the correct section.
- Active narrow-nav items are centered or fully revealed by changing only the nav's `scrollLeft`; the implementation no longer calls element `scrollIntoView`, which previously changed the vertical Settings position.
- Narrow navigation retains horizontal scrolling and wheel/trackpad input, hides the native scrollbar, and provides two non-interactive edge fades.
- AI Mode is a three-column grid at the shared `1180px` wide breakpoint and a three-row equal-width grid below it. A 2+1 wrap is not possible.
- The AI section contains one editable Provider select. Advanced Connection exposes only the selected Provider's connection and performance fields.

## API Key reveal lifecycle

Reveal remains local component state, defaults to `password`, uses a button with `aria-pressed` and localized accessible names, and is never persisted. It resets after Appearance or Privacy navigation, any AI section departure, AI Off, Developer Mode off, Advanced collapse, Provider change, save success, save failure, and component unmount/remount.

Browser QA used an empty Browser-mock credential by default and a temporary harmless local UI value only for the reveal interaction. The value was cleared before closeout. No credential value, authorization header, or request body is present in source, logs, proof JSON, or documentation.

## Browser QA evidence

UI QA used the local Browser mock at device scale factor 1. It did not connect to a real AI Provider. The Browser mock's fixed hotkey-registration warning was neutralized only while collecting clean baselines, and save-failure screenshots used a temporary in-memory Tauri invoke rejection. Both fixtures were removed before validation and commit. Native Tauri folder-picker behavior was not verified in Browser.

Artifact root (not committed):

`C:\Users\77588\.codex\artifacts\zen-canvas-phase8-0-4-preferences\`

Proof JSON:

`C:\Users\77588\.codex\artifacts\zen-canvas-phase8-0-4-preferences\phase8-0-4-browser-proof.json`

The proof contains 20 baseline entries and 22 specialty entries. All 42 JPEGs were dimension-checked after capture.

### Baseline matrix

For both `baseline-light-<size>.jpg` and `baseline-dark-<size>.jpg`:

- `1920x1080`
- `1440x900`
- `1280x800`
- `1180x720`
- `1100x700`
- `1024x700`
- `1000x700`
- `981x680`
- `980x680`
- `900x650`

Every baseline recorded General as active and first visible, AppShell and Settings scroll positions of zero, one vertical scroll owner, no document overflow, no alert/status residue, body focus with `focusVisible=false`, and empty page console error/warning arrays.

### Specialty screenshots

- `special-ai-active-off-unsaved-cloud-light.jpg`
- `special-ai-active-off-unsaved-cloud-dark.jpg`
- `special-ai-saved-cloud-light.jpg`
- `special-ai-saved-cloud-dark.jpg`
- `special-ai-save-failure-light.jpg`
- `special-ai-save-failure-dark.jpg`
- `special-ai-off-dependent-controls-light.jpg`
- `special-ai-off-dependent-controls-dark.jpg`
- `special-ai-mode-wide-three-columns.jpg`
- `special-ai-mode-narrow-vertical.jpg`
- `special-settings-nav-narrow-light.jpg`
- `special-settings-nav-narrow-dark.jpg`
- `special-privacy-active-correct.jpg`
- `special-spotlight-ai-active.jpg`
- `special-ai-sticky-save-bar-long-page.jpg`
- `special-api-key-hidden.jpg`
- `special-api-key-temporarily-revealed.jpg`
- `special-api-key-auto-hidden-after-section.jpg`
- `special-provider-single-entry.jpg`
- `special-focus-visible-light.jpg`
- `special-focus-visible-dark.jpg`
- `special-stable-no-focus-ring.jpg`

Failure evidence records `runtimeMode=cloud`, `savedMode=cloud`, `draftMode=cloud`, `dirty=true`, one alert, zero statuses, and password input after rejection. Wide AI Mode recorded three equal-width items on one top coordinate; narrow mode recorded three equal-width items on three distinct top coordinates. Narrow nav recorded `scrollbar-width: none`, two fades, horizontal overflow inside the nav only, and the correct active item. Focus screenshots record the exact radio role/name and `focusVisible=true`; the stable screenshot records body focus and `focusVisible=false`.

## Automated verification

All commands exited 0:

| Command | Result |
| --- | --- |
| `npm install` | 308 packages audited; 0 vulnerabilities |
| `npm run typecheck` | passed |
| `npm test` | 62 files, 409 tests passed |
| `npm run test:performance` | 2 files / 9 frontend checks passed; 100k-row FTS benchmark passed |
| `npm run security:audit` | 0 vulnerabilities |
| `npm run security:audit:rust` | passed with 16 existing allowed dependency warnings |
| `npm run build` | Tauri application and NSIS installer built |
| `npm run verify` | passed, including repeated typecheck/test/performance/build/npm audit |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | passed |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 318 passed, 1 ignored, 0 failed |
| `cargo build --release --manifest-path src-tauri/Cargo.toml` | passed |
| `git diff --check` | passed |

The Rust suite and release build are the real-backend safety evidence. They retain Preview confirmation, conflict checks, Safe Trash, Restore, user-rule-only manual automation, and existing file execution boundaries.

## Installer

- Path: `F:\Coding\Zen-Canvas\src-tauri\target\release\bundle\nsis\Zen Canvas_0.1.39_x64-setup.exe`
- Size: 5,535,732 bytes (5.28 MiB)
- SHA-256: `0B40B09E417CDCDFF0AC4291E9D8540A3708B8F0E92AE1FA94432329CE9B3D68`
- The installer and all `dist`, `target`, screenshot, fixture, cache, and Browser profile artifacts are excluded from commits.

## Known limitations and unverified items

- Browser QA validates the browser-rendered UI against local mocks; it is not a real Tauri backend session.
- A real AI Provider connection and production credential were intentionally not used.
- The native folder picker, macOS, non-1 device scale factors, operating-system high-contrast modes, and real screen readers were not verified in this phase.
- Rust audit still reports 16 allowed warnings in existing transitive dependencies; this UI-only phase did not change dependency versions.
- Build retains the existing large-chunk and Tailwind plugin-timing warnings.

Phase 8.0.4 is closed without entering Stage 9.
