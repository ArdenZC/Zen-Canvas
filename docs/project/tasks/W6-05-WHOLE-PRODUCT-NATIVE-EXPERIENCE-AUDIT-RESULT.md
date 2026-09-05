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

This commit is evidence-contract and archive-quality repair only. The Whole-Product Native Audit was not rerun, and the 63-shot product workflow was not repeated.

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

The complete machine-readable matrix is in [audit-results.json](../../../outputs/w6-05-native-audit/manifests/audit-results.json). Every capability/state uses only `PASS`, `FAIL`, `DEGRADED` or `UNVERIFIED`.

Matrix totals:

These totals are emitted from the final JSON `surfaceMatrix` by the evidence-repair validation script.

- `PASS`: **45**
- `FAIL`: **6**
- `DEGRADED`: **7**
- `UNVERIFIED`: **22**
- total rows: **80**

Confirmed findings:

- `FAIL` — Cleanup rejects the disposable F: fixture with `//?/F:/... unsupported path characters` before candidate review.
- `FAIL` — Image, CSV, JSON and folder Quick Preview return the generic unavailable error state.
- `FAIL` — Global Index reports `Unavailable` with zero sources.
- `DEGRADED` — Organization Plan cannot load suggestions/safe preview for the disposable one-file plan.
- `DEGRADED` — Browse reports the fixture location as status unknown, and first-launch scan recovery requires an exact-process restart.
- `UNVERIFIED` — Dry Run, safe execution, Safe Trash and Restore were not reached because their authoritative prerequisites failed or no candidate existed.

Successful native coverage includes onboarding, Overview shell, File Library, File Library search/filter/sort, saved views, list/grid, context panel, single/multiple selection, Markdown/code/plain-text preview, History empty state, Automation empty/create surfaces, Settings, Chinese/English, light/dark, and wide/medium/narrow native window smoke.

## Finding severity

Severity is separate from the capability status matrix.

- `P0`: **0**
- `P1`: **0**
- `P2`: **5**
- `P3`: **0**

The five consolidated product findings are classified `P2` because they are material functional/UX/capability defects but did not demonstrate data loss, unsafe mutation, security-boundary failure, or a whole-product/core-startup condition requiring emergency remediation:

1. `W6-05-F-001` — Cleanup extended-path rejection.
2. `W6-05-F-002` — Image/CSV/JSON/folder Quick Preview unavailable.
3. `W6-05-F-003` — Global Index source unavailable in the isolated audit environment.
4. `W6-05-F-004` — Organization Plan suggestion/safe-preview loading degraded.
5. `W6-05-F-005` — Browse status and first-scan recovery friction.

Detailed notes: [findings.md](../../../outputs/w6-05-native-audit/notes/findings.md).

## Files changed

Result artifacts are scoped to the result branch:

- this result document;
- `outputs/w6-05-native-audit/manifests/audit-results.json`;
- `outputs/w6-05-native-audit/manifests/fixture-before-state.json`;
- `outputs/w6-05-native-audit/notes/` audit notes;
- 62 valid real Windows/Tauri JPEG screenshots under `outputs/w6-05-native-audit/screenshots/`; the invalid 13x13 intermediate capture was removed and was not recreated;
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
- `git diff --check` — completed at result-branch closeout.

No production code or test inputs changed during W6-05, so broad source-test lanes were not rerun and are not claimed as audit evidence.

## Visual and native verification

The evidence set contains native Windows/Tauri screenshots, not browser screenshots. Representative dimensions include:

- wide: 1920x1032;
- medium: approximately 1299x884;
- narrow: approximately 969x675.

The evidence set includes core-page screenshots for Overview, File Library, Browse, Organize, Cleanup, History, Automation and Settings, plus typed preview states, selection/filter/sort/saved-view states, R0/R1, error/recovery, language/theme and responsive states.

The R0 proof is summarized in [r0-native-control-probe.md](../../../outputs/w6-05-native-audit/notes/r0-native-control-probe.md). Isolation and the mutation boundary are summarized in [r1-isolation.md](../../../outputs/w6-05-native-audit/notes/r1-isolation.md).

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

## User Journey Friction Map

This map is a synthesis of the retained native evidence; it does not add new product observations.

| Journey | Smooth point | Friction point | Blocker/degraded state | Downstream consequence |
| --- | --- | --- | --- | --- |
| First launch → onboarding → scan | The branded onboarding flow and real Windows folder picker accepted the disposable fixture. | The first launch exposed an active-run scan error and the first-value view remained unclear until exact-process recovery. | `DEGRADED` — [onboarding](../../../outputs/w6-05-native-audit/screenshots/R1-onboarding-fixture-selected.jpg), [initial Overview](../../../outputs/w6-05-native-audit/screenshots/Overview-initial-scan-error.jpg). | A user may not know whether scanning is progressing, failed or ready for Library. |
| Overview → File Library | Persistent navigation and the completed 21-item fixture Library were reachable. | Overview and managed-file status did not present one coherent readiness story after recovery. | `DEGRADED` — [final Overview](../../../outputs/w6-05-native-audit/screenshots/Overview-final-stable.jpg), [Library](../../../outputs/w6-05-native-audit/screenshots/FileLibrary-all-indexed-21.jpg). | The user can see files in Library while Overview still asks for a searchable position. |
| Library → Preview | Context Panel and Markdown/code/plain-text Preview provided useful content. | Image, CSV, JSON and folder requests ended in a generic unavailable state; PDF used metadata fallback. | `FAIL` / `DEGRADED` — [Markdown](../../../outputs/w6-05-native-audit/screenshots/QuickPreview-Welcome-Markdown.jpg), [image error](../../../outputs/w6-05-native-audit/screenshots/QuickPreview-image-unavailable.jpg), [PDF fallback](../../../outputs/w6-05-native-audit/screenshots/QuickPreview-PDF-metadata-fallback.jpg). | Preview confidence varies by format and several representative types cannot be reviewed. |
| Browse | Empty state and navigation modal were explicit. | The fixture location was shown as status unknown and Open location was disabled. | `DEGRADED` / `UNVERIFIED` — [Browse navigation](../../../outputs/w6-05-native-audit/screenshots/Browse-navigation-open.jpg). | A user cannot complete the location-opening journey from the observed state. |
| Organize → Organization Plan → Dry Run | A disposable one-file plan could be created and cancelled. | Suggestions and the authoritative safe preview failed to load. | `DEGRADED`; Dry Run is `UNVERIFIED` — [plan error](../../../outputs/w6-05-native-audit/screenshots/OrganizationPlan-missing-info.jpg). | Safe execution remained unreachable without bypassing the preview boundary. |
| Cleanup → Safe Trash → Restore | Cleanup clearly stated that confirmation is required and permanent deletion is not automatic. | The valid disposable F: path was rejected by path validation before candidate review. | `FAIL`; Safe Trash/Restore are `UNVERIFIED` — [cleanup error](../../../outputs/w6-05-native-audit/screenshots/Cleanup-scan-fixture-result.jpg). | No candidate, journal record or restore state could be truthfully exercised. |
| Global Search | The command palette and unavailable state were honest rather than fabricating results. | Global Index had zero sources and reported Unavailable. | `FAIL` — [Global Index unavailable](../../../outputs/w6-05-native-audit/screenshots/Settings-global-index-unavailable.jpg). | System-wide search cannot provide an indexed result in this run. |
| Settings / advanced surfaces | Settings sections, language/theme, diagnostics, AI, privacy and About were discoverable. | Some technical capability states were unavailable; deep-link/reveal behavior was not exercised. | `DEGRADED` / `UNVERIFIED` — [Settings overview](../../../outputs/w6-05-native-audit/screenshots/Settings-overview.jpg), [diagnostics](../../../outputs/w6-05-native-audit/screenshots/Settings-platform-diagnostics-english-dark.jpg). | Users can inspect configuration but may need implementation-level knowledge to interpret readiness. |

## Visual / UX Inconsistency Inventory

Only the retained screenshots and notes are used here.

- Hierarchy: evidence is sufficient to compare Overview, Library and Settings; the shell has a clear sidebar, but Overview's next action competes with the readiness/error banner.
- Spacing: wide, medium and narrow captures show the shell remaining usable, but no measured spacing baseline was retained; detailed token-level judgment is evidence insufficient.
- Typography: Chinese/English and light/dark captures exist; cross-surface typography comparison is qualitative only, so exact font/line-height inconsistency is evidence insufficient.
- Control density: Settings and filter controls visibly expose many options in compact groups; this is a supported density observation from [Settings files](../../../outputs/w6-05-native-audit/screenshots/Settings-files-scanning-english.jpg) and [filter](../../../outputs/w6-05-native-audit/screenshots/FileLibrary-filter-image.jpg).
- Cards/borders: Overview, Settings and plan surfaces repeatedly use bordered card containers; the pattern is observable, while whether every border is token-consistent is evidence insufficient.
- Radius/shadow: the screenshots retain rounded panels, but no dedicated visual token inspection was retained; detailed radius/shadow inconsistency is evidence insufficient.
- Icon alignment: icons are visible in navigation and controls, but no focused alignment comparison was recorded; evidence insufficient.
- Toolbar/command hierarchy: the command palette is visually distinct from Library controls; the relationship between system-wide search and File Library search remains technically exposed in the observed wording.
- Selected/focus/disabled state: focus and multi-selection were directly visible, and Browse's disabled Open location was clear; hover-state coverage is evidence insufficient.
- Empty/loading/error state: empty and error surfaces are explicit, but loading/recovery and Preview errors do not share one coherent explanation; [error evidence](../../../outputs/w6-05-native-audit/screenshots/QuickPreview-image-unavailable.jpg) supports the observation.
- Terminology consistency: Library, Global Index, status unknown, unavailable and safe preview are distinct concepts, but technical terms such as index sources and capability availability leak into ordinary decision points.
- Technical-control exposure: Platform Diagnostics and Global Index expose implementation-level availability details; this is directly visible in [diagnostics](../../../outputs/w6-05-native-audit/screenshots/Settings-platform-diagnostics-english-dark.jpg) and [Global Index](../../../outputs/w6-05-native-audit/screenshots/Settings-global-index-unavailable.jpg).
- Responsive behavior: wide 1920x1032, medium and approximately 969x675 narrow captures show the shell adapting; Preview-specific narrow behavior was not retained, so that part is evidence insufficient.
- Preview consistency: successful text/code, metadata-only PDF fallback and generic unavailable image/CSV/JSON/folder states are materially inconsistent; previous/next/loading/pinned behavior is `UNVERIFIED`.

## Strengths To Preserve

Direct native strengths:

- Library list/grid, filter, sort, saved-view, context-panel and multi-selection interaction were usable in the real app.
- Markdown, code and plain-text Preview rendered real fixture content; PDF fallback remained honest metadata rather than fabricated content.
- Cleanup and Organize surfaces exposed confirmation/safe-preview boundaries and did not silently mutate files when prerequisites failed.
- Chinese/English, light/dark and wide/medium/narrow shell states were controllable in the isolated profile.
- Error states were visible and did not claim success; History remained empty when no mutation occurred.

Architectural strengths to preserve:

- Library/Browse authority separation and distinct Global Index ownership.
- Safe mutation chain, disposable-fixture boundary and no-overwrite/restore authority boundaries.
- Local/no-upload privacy posture and explicit AI provider/consent boundary.
- Organization Plan safe-preview gating before Dry Run or execution.
- History/Restore ledger boundary, even though destructive recovery was not reached in this audit.
- Durable managed-scope and Rule Repository boundaries rather than renderer-owned mutation state.

These strengths do not convert unverified or degraded states into native `PASS`; they are preservation inputs for W6-06/W6-07.

## Environment Provenance

The retained audit record contains:

- Windows edition/build: `UNVERIFIED / not retained`.
- Architecture: `x86_64` (retained in the Platform Diagnostics capture).
- Native capture: wide `1920x1032`; display scaling: `UNVERIFIED / not retained`.
- Native executable: `F:\CargoTarget\w6-05-production\debug\zen-canvas.exe`.
- Audited production: `ee1163fbf32f23cc95150adca4e1cb5a53081654` / tree `57dc0ac45810477c8477542512c3c65a60605fb9`.
- Governance execution: `78eac408c4bd812848db0bb0dad73575e8251bb7` / tree `371e618dfd3dcb52af5ab4f0d0e64191fe8d384c`.
- Isolated profile: `com.startlan.zencanvas.w605qa2`; retained paths were `C:\Users\77588\AppData\Roaming\com.startlan.zencanvas.w605qa2` and `C:\Users\77588\AppData\Local\com.startlan.zencanvas.w605qa2`.
- Fixture root: `F:\Coding\Zen-Canvas-w6-05-production\.tmp-tests\w6-05-native-audit-fixture-20260905`.
- Computer Use surface: generic Windows `computer` surface; optional `getApp/native-app binding` was unavailable.
- Pre-existing service: `C:\Program Files\Zen Canvas\zen-canvas.exe --index-service` was observed and left untouched.

Windows scaling, edition/build and any additional display topology are `UNVERIFIED / not retained`; no values are inferred from the screenshot dimensions.

## Source-visible functionality remaining UNVERIFIED

The final matrix explicitly leaves the following unverified because the completed audit did not exercise them: Getting Started re-entry; safe startup/database failure and retry; Browse Open location; select-all-matching; Preview previous/next navigation; pinned Preview; Preview loading transition; Settings deep-link/reveal; Shift+Tab; Space activation; supported search-focus shortcut; native minimize/restore; Narrator; and the pre-restart File Library intermediate state whose original capture was invalid/near-blank.

## W6-06 design inputs

W6-06 should use the retained screenshots and findings to design a coherent product experience rather than immediately patching each surface independently. Priority design inputs are:

- clarify first-value and scan/recovery states so progress, completion and retry ownership are obvious;
- make Browse/Library/Global Index authority distinctions understandable without exposing implementation vocabulary as primary UI;
- define consistent unavailable/fallback/error presentation for Preview instead of a generic dead-end state;
- simplify Organization Plan hierarchy and make suggestion/safe-preview readiness legible before Dry Run;
- define a consistent system for spacing, typography, control density, cards/borders, focus, selected/disabled states, dialogs/popovers and responsive behavior across the captured core pages;
- preserve the existing safety boundaries and mature backend authorities while redesigning the presentation layer.

## W6-08 Preview inputs

W6-08 should treat the Windows Preview gap as an experience problem on top of the existing Preview Core/`ZenFloatingQuickPreview` architecture. Inputs from W6-05 include:

- Markdown/code/plain text can render successfully and should anchor the successful target behavior;
- image/CSV/JSON/folder currently end in generic unavailable states;
- PDF currently provides metadata fallback rather than content preview;
- fallback, loading, error, navigation, chrome, sizing and visual hierarchy need a coherent cross-format design;
- do not introduce a second Preview architecture merely to address these presentation/capability gaps.

## Closeout and cleanup

The exact task-owned runtime was stopped and the following bounded paths were removed after the archive was verified:

- `C:\Users\77588\AppData\Roaming\com.startlan.zencanvas.w605qa2`;
- `C:\Users\77588\AppData\Local\com.startlan.zencanvas.w605qa2`;
- `F:\Coding\Zen-Canvas-w6-05-production\.tmp-tests\w6-05-runtime-20260905`;
- `F:\Coding\Zen-Canvas-w6-05-production\.tmp-tests\w6-05-native-audit-fixture-20260905`.

The common checkout remained on its existing `master` HEAD. The audited production worktree is clean and its `src-tauri/Cargo.toml` working-copy blob matches the baseline; the earlier modified timestamp was only an index/stat refresh condition. The installed `C:\Program Files\Zen Canvas\zen-canvas.exe --index-service` process was observed and left untouched.

## Evidence archive

Repository evidence archive: [w6-05-native-audit-evidence.zip](../../../outputs/w6-05-native-audit/w6-05-native-audit-evidence.zip)

SHA-256: `0659F2BAEF45666D9380C623B179B9513D5643281B21B0B0411824D2EC0EFDA3`

The previous pre-review archive SHA-256 `ADA10467710564EAFCC734F6C66502D7EEDD8715A47D56BBD46E4C5D0326280B` is superseded and is not the final archive hash.

## Final decision

**W6-05 COMPLETE — PROCEED TO W6-06 DESIGN**

This decision closes the audit stage only. It does not silently activate W6-06, authorize production remediation, change `v0.1.40`, or authorize publication. W6-06 requires a separate current-truth activation after this result/evidence PR is merged.
