# W6-05 — Whole-Product Native Experience Audit Result

Date: 2026-09-05
Result branch: `docs/w6-05-whole-product-native-audit-result`

## Completed

The amended W6-05 audit completed on the exact audited production baseline:

- production commit: `ee1163fbf32f23cc95150adca4e1cb5a53081654`
- production tree: `57dc0ac45810477c8477542512c3c65a60605fb9`
- governance commit: `78eac408c4bd812848db0bb0dad73575e8251bb7`
- governance tree: `371e618dfd3dcb52af5ab4f0d0e64191fe8d384c`

The baseline-to-governance comparison remained documentation-only. No production source was changed.

The audit outcome is `DEGRADED`: the native audit itself completed, but the product has confirmed failures in Cleanup, Global Index and several Quick Preview types, plus degraded Organization Plan/Browse/recovery states. These were recorded truthfully and were not bypassed.

## Authority and compatibility paths

- `R0 native-control = PASS` through the generic Windows `computer` surface. The real Windows desktop displayed the real Zen Canvas Tauri window, pointer and keyboard input changed the UI, and native screenshots were captured.
- `getApp/native-app binding: unavailable` is recorded as a helper limitation only. It did not block R0 under `docs/project/tasks/W6-05-WINDOWS-COMPUTER-SURFACE-CONTROL-AMENDMENT.md`.
- The product was launched from the independent production worktree, not the stale common `master` checkout.
- R1 isolation used a fresh Tauri profile and a disposable F: fixture. Normal user roots were not scanned, opened in the audited profile, or mutated.
- File Library indexing and Global Index remained distinct. The completed managed-file fixture scan was not used as a substitute for system-wide Global Search.
- No renderer state, preview result, plan row, or loaded page was treated as durable authority.
- No Organize, Cleanup, Safe Trash, Restore, rule execution, provider request, or other filesystem mutation bypassed the existing preview/confirmation/revalidation boundary.

## Important product and architecture decisions

The following decisions were applied during the audit:

- The Windows amendment changed only the native-control判定. Browser or in-app-browser evidence was not used.
- All destructive or mutation-adjacent flows were limited to the exact disposable fixture. Cleanup failed before candidate review because the product rejected the normalized extended path; Safe Trash and Restore therefore remain `UNVERIFIED`.
- The PDF fallback was accepted only as metadata fallback. It was not counted as content-preview success.
- The initial active-run scan error was recorded as a degraded recovery experience. Restarting the exact task-owned process recovered the completed 21-item fixture index; this did not justify claiming a clean first-launch experience.
- The temporary saved view was created and deleted inside the isolated profile. No temporary rule or tag was left enabled or persisted.

## Result matrix

The complete machine-readable matrix is in [audit-results.json](/F:/Coding/Zen-Canvas-w6-05-whole-product-native-audit-result/outputs/w6-05-native-audit/manifests/audit-results.json). Every capability/state uses only `PASS`, `FAIL`, `DEGRADED` or `UNVERIFIED`.

Confirmed findings:

- `FAIL` — Cleanup rejects the disposable F: fixture with `//?/F:/... unsupported path characters` before candidate review.
- `FAIL` — Image, CSV, JSON and folder Quick Preview return the generic unavailable error state.
- `FAIL` — Global Index reports `Unavailable` with zero sources.
- `DEGRADED` — Organization Plan cannot load suggestions/safe preview for the disposable one-file plan.
- `DEGRADED` — Browse reports the fixture location as status unknown, and first-launch scan recovery requires an exact-process restart.
- `UNVERIFIED` — Dry Run, safe execution, Safe Trash and Restore were not reached because their authoritative prerequisites failed or no candidate existed.

Successful native coverage includes onboarding, Overview shell, File Library, File Library search/filter/sort, saved views, list/grid, context panel, single/multiple selection, Markdown/code/plain-text preview, History empty state, Automation empty/create surfaces, Settings, Chinese/English, light/dark, and wide/medium/narrow native window smoke.

## Files changed

Result artifacts are scoped to the result branch:

- this result document;
- `outputs/w6-05-native-audit/manifests/audit-results.json`;
- `outputs/w6-05-native-audit/manifests/fixture-before-state.json`;
- `outputs/w6-05-native-audit/notes/` audit notes;
- `outputs/w6-05-native-audit/w6-05-native-audit-evidence.zip` and its SHA-256 recorded below.

No production source, normal user profile, release metadata, tag or hosted release was changed.

## Tests and commands run

Evidence and provenance commands:

- `git fetch origin master` — completed.
- Exact baseline/tree and branch checks — completed for the common checkout, production worktree and result worktree.
- Exact baseline-to-governance diff — completed; documentation paths only.
- `npm ci --no-audit --no-fund` in the production worktree — completed for the audited baseline.
- Production app launch with `CARGO_TARGET_DIR=F:\CargoTarget\w6-05-production` and the task-local Tauri config — completed.
- Native CUA probe and full UI walkthrough — completed through the generic Windows `computer` surface.
- JSON manifest parse and screenshot-evidence path validation — completed.
- `git diff --check` — required at closeout for the result branch.

No production code or test inputs changed during W6-05, so broad source-test lanes were not rerun and are not claimed as audit evidence.

## Visual and native verification

The evidence set contains native Windows/Tauri screenshots, not browser screenshots. Representative dimensions include:

- wide: 1920x1032;
- medium: approximately 1299x884;
- narrow: approximately 969x675.

The evidence set includes core-page screenshots for Overview, File Library, Browse, Organize, Cleanup, History, Automation and Settings, plus typed preview states, selection/filter/sort/saved-view states, R0/R1, error/recovery, language/theme and responsive states.

The R0 proof is summarized in [r0-native-control-probe.md](/F:/Coding/Zen-Canvas-w6-05-whole-product-native-audit-result/outputs/w6-05-native-audit/notes/r0-native-control-probe.md). Isolation and the mutation boundary are summarized in [r1-isolation.md](/F:/Coding/Zen-Canvas-w6-05-whole-product-native-audit-result/outputs/w6-05-native-audit/notes/r1-isolation.md).

## Acceptance checklist

- `PASS` — amended R0 generic Windows native control.
- `PASS` — exact audited production provenance and docs-only governance delta.
- `PASS` — isolated profile and disposable fixture boundary.
- `PASS` — full requested page/state walkthrough reached where prerequisites allowed.
- `PASS` — real native screenshots captured for the core pages and important states.
- `DEGRADED` — product result because confirmed failures remain documented.
- `UNVERIFIED` — destructive recovery paths that could not be reached without bypassing a failed prerequisite.
- `PASS` — no production code, release, tag, Codex Review, v0.1.40 publication or W6-06 activation.

## Deferred or unverified

The following are intentionally not claimed:

- Safe Trash deletion and Restore, because Cleanup failed before candidate review;
- Organization Dry Run and safe execution, because the plan safe preview failed;
- enabled automation execution, because no rule was enabled;
- AI provider or cloud-upload behavior, because AI remained off;
- fresh-install, SmartScreen/UAC, uninstall or release acceptance, because W6-05 is a product audit on the exact existing production build;
- broad production test-suite pass, because no production inputs changed and no such run was performed for this audit.

## Risks requiring human review

Human review is required for the cleanup path normalization defect, Global Index source availability, typed/folder Quick Preview coverage, Organization Plan suggestion loading, Browse root-status reconciliation and the transient active-run recovery UX. These are product findings, not reasons to bypass the documented authority boundaries.

## Closeout and cleanup

The exact task-owned runtime was stopped and the following bounded paths were removed after the archive was verified:

- `C:\Users\77588\AppData\Roaming\com.startlan.zencanvas.w605qa2`;
- `C:\Users\77588\AppData\Local\com.startlan.zencanvas.w605qa2`;
- `F:\Coding\Zen-Canvas-w6-05-production\.tmp-tests\w6-05-runtime-20260905`;
- `F:\Coding\Zen-Canvas-w6-05-production\.tmp-tests\w6-05-native-audit-fixture-20260905`.

The common checkout remained on its existing `master` HEAD. The audited production worktree is clean and its `src-tauri/Cargo.toml` working-copy blob matches the baseline; the earlier modified timestamp was only an index/stat refresh condition. The installed `C:\Program Files\Zen Canvas\zen-canvas.exe --index-service` process was observed and left untouched.

## Evidence archive

Evidence archive: [w6-05-native-audit-evidence.zip](/F:/Coding/Zen-Canvas-w6-05-whole-product-native-audit-result/outputs/w6-05-native-audit/w6-05-native-audit-evidence.zip)

SHA-256: `ADA10467710564EAFCC734F6C66502D7EEDD8715A47D56BBD46E4C5D0326280B`
