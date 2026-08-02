# Zen Canvas UI/UX V4.3 Final QA

Date: 2026-08-02
Branch: `codex/ui-v4-3-product-integration`
PR11 baseline: `292cae2` (`ui-v4.3(pr10): integrate settings and overview health`)
Fourth-round starting HEAD: `8f79b4c67cc3639092961744fb9cf25709f4844d`

## Stage completion

PR0 through PR10 are committed in order. PR11 records the repository-wide QA pass, the two stale static-contract test repairs exposed by the full suite, the Rust test-fixture lint allowance required by Clippy, the rendered matrix evidence available in the local browser preview, and the remaining native/remote release evidence. The fourth-round closure below records the final independent-review remediation on top of that history.

No schema, persistence, Tauri capability, queue, filesystem mutation authority, or product workflow authority was added in PR11.

## Authority migrations and safety boundaries

- Overview projects Global Index, watcher, managed-scope, Organization Plan, Analysis Run, Content Run, operation, and restore facts from existing APIs. It does not become a second ledger.
- Settings is sectioned presentation over the existing settings context and provider/diagnostics APIs. `SettingsView` remains the orchestration owner for dirty/save and provider lifecycle behavior.
- File Library, Organize Files, Storage Cleanup, Preview, History, Automation, Content Understanding, and restore retain the durable authorities documented in `UI_UX_V4_3_AUTHORITY_MAP.md`.
- Preview, Safe Trash, Restore, journals, consent, bounded/redacted diagnostics, AI-advisory behavior, and no-automatic-file-mutation boundaries remain intact.
- No Schema 35, arbitrary script/SQL/regex execution, second AI queue, second Global Index, or renderer-only authoritative grouping was introduced.

## Commands and results

All commands below were run from `F:\Coding\Zen-Canvas`.

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd test` | Passed: 89 files, 572 tests. The final run includes the mounted fourth-round group-action behavior tests and refreshed Organization Plan contracts. |
| `npm.cmd run test:remediation` | Passed: 1 file, 13 tests. |
| `npm.cmd run test:performance` | Passed with the required architecture guard, bounded library tests, SQLite/FTS, Global Search 100k, managed scan 100k, migration, Analysis, Dedupe, File Library 100k/1M, Organization Plan, and Rule Proposal performance profiles. |
| `npm.cmd run build` | Passed. Vite, Windows release compile, and NSIS installer generation completed. Installer: `F:\CargoTarget\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe`. |
| `npm.cmd run verify:rust` | Passed: format, Rust test phase, and Clippy with `-D warnings`; the primary unit target reported 583 passed, 0 failed, and 9 ignored. |
| `npm.cmd run verify:security` | Passed. npm audit found 0 vulnerabilities. `cargo audit` reported 15 existing allowed unmaintained/unsound warnings and no failing vulnerability result. |
| `git diff --check` | Passed for the final working diff. |
| `npm.cmd run test:docs` | Passed for the final documentation diff. |
| `cargo test ... pdf_resource_limits_are_enforced_during_scan_and_decode -- --exact --test-threads=1 --nocapture` | Passed; the exact target also passed 10/10 consecutive runs. |

The Rust helper change is limited to `#[allow(clippy::too_many_arguments)]` on the test-only `seed_group_item` fixture in `organization.rs`; it does not affect production code.

## CI contract and release evidence

The current `.github/workflows/ci.yml` contract was inspected. The cumulative production diff is not docs-only: the touched `src-tauri/src/db/` path is high risk, so the workflow classifier selects `full_validation=true`, which includes the full performance profile, Windows/macOS release compiles, and NSIS/unsigned-DMG packaging jobs. No PR-number exception, threshold weakening, or docs-only classification was added.

Local evidence:

- Windows release compile and NSIS packaging passed through `npm.cmd run build`.
- The full local performance profile, including configured 1M-scale checks, passed.

Not available in this local, unpushed branch:

- GitHub Actions run/check URLs and remote CI artifact evidence;
- macOS release compile and unsigned DMG packaging;
- signed release artifacts, checksums, SBOM upload, tag, or GitHub Release evidence;
- a Draft PR, because remote publication was not explicitly authorized.

## Visual verification

The local Vite/browser-mock preview was inspected with real rendered DOM and screenshots. Native Tauri behavior is not represented by this preview.

### Theme and language matrix

- Light Chinese: Overview captured at 1440×900.
- Dark Chinese: Overview captured at 1280×720.
- Light English: Overview captured at 1280×720.
- Dark English: Preferences and Overview captured at 1280×720; File Library, Organize Files, Storage Cleanup, History, and Automation captured at 980×680.

### Responsive matrix

On the Overview render, the measured values were:

| Viewport | `scrollWidth` | `clientWidth` | `<h1>` |
| --- | ---: | ---: | --- |
| 1440×900 | 1440 | 1440 | `概览` |
| 1280×800 | 1280 | 1280 | `概览` |
| 1180×720 | 1180 | 1180 | `概览` |
| 1024×700 | 1024 | 1024 | `概览` |
| 980×680 | 980 | 980 | `概览` |

Dark English narrow renders also kept one page heading and no horizontal overflow for File Library, Organize Files, Storage Cleanup, History, Automation, and Preferences. The Preferences surface showed the section navigation and sticky settings layout without a duplicate page title.

Per-stage rendered references remain in `docs/design/UI_UX_V4_3_EXECUTION.md` for Global Search, File Library, Organize Files, Storage Cleanup, Preview/History/Restore, Automation, Content Understanding, and the PR10 Overview/Settings integration. The PR11 captures above complete the language/theme and responsive checks that were available in the browser preview.

## Hard release gates from UI_UX_V4_3_SPEC.md §24

| Gate | Evaluation |
| --- | --- |
| Storage Cleanup main navigation | Pass; visible in the App Shell and Overview/command entry contracts. |
| User-facing “Organize Files” | Pass; navigation and rendered heading use “Organize Files”. |
| Global Search distinct from File Library Search | Pass; separate command/search contracts and rendered File Library scope copy. |
| `no_source` distinct from ordinary empty | Pass; model and focused regression tests. |
| Literal punctuation and IME behavior | Pass; existing regression suites and full test suite. |
| Backend file-result order preserved | Pass; existing Global Search contract tests and full test suite. |
| Overview reads actual Global Index health | Pass; PR10 API projection and focused tests. |
| One authority per migrated workspace | Pass by authority map and stage closeouts; no second renderer ledger added. |
| Backend-authoritative plan grouping | Pass; Organization Plan group projection and performance/contract tests. |
| Group-first, exception-first Organize | Pass; rendered empty-plan and existing group interaction evidence. |
| Cleanup uses durable Analysis Run/Finding | Pass; PR6/PR10 projections and remediation tests. |
| Compact Preview summary | Pass; current shared Preview summary and updated interaction contract. |
| Automation defaults to Rule Library | Pass; rendered dark-English Rule Library and proposal separation. |
| Legacy Rule commands absent | Pass; remediation and architecture tests. |
| Dedicated Rule Proposal flow | Pass; PR8 closeout and full test suite. |
| Content Understanding outside narrow Inspector | Pass; PR9 dedicated sheet and Inspector contract. |
| Settings split into sections | Pass; 11 focused section components and Settings UI tests. |
| Watcher state separation | Pass; permission, reconciliation, partial, and retry-exhausted mappings/tests. |
| Duplicate page titles removed | Pass; one `<h1>` measured in every PR11 rendered state. |
| Shared i18n for user-visible copy | Pass for changed surfaces; final full test and i18n contracts pass. |
| Provider Registry, Model Discovery, Request Trace available | Pass; Settings advanced/developer controls remain present and bounded. |
| Filesystem safety boundary | Pass; Rust remediation/security suites and no mutation-authority changes. |
| No Schema 35/forbidden architecture | Pass by diff and architecture tests. |
| Keyboard flows | Static/behavior contracts pass; native keyboard and screen-reader execution remains unverified. |
| Light/Dark and Chinese/English | Pass in the browser preview matrix above. |
| 980×680 usable | Pass for measured no-overflow and captured narrow workspaces. |
| Repository test/performance/Rust/security/build gates | Pass; the third-round closure records five consecutive default-parallel Rust runs, ten PDF-target runs, the original Rust gate, full performance, build and security evidence. |
| CI fast/full governance | Pass by workflow inspection and existing CI contract tests; no remote run evidence. |
| Native checks honestly recorded | Pass; limitations are listed below rather than inferred. |

## Known limitations and unverified checks

- Native Tauri watcher/index lifecycle, Search Window lifecycle, window controls, drag regions, Preview/Journal behavior, restore identity behavior, and native focus restoration were not exercised in this browser preview.
- Windows 100/125/150/200% DPI, Windows High Contrast, Narrator, macOS Retina, VoiceOver, and native screen-reader announcements were not available in this session.
- Compact-density persistence was not exposed by the browser mock; default-density renders were verified and shared compact primitives remain covered by source/tests.
- Global Search standalone window, Onboarding first-run state, populated Content Understanding provider flow, native loading/permission/reconciliation/error/canceled transitions, and real cloud-consent/network flows require native or seeded fixtures beyond this preview.
- macOS compile/package, remote CI, checksum/tag/release, and publish evidence remain pending a GitHub/CI-enabled handoff.

## Release gate

Local Windows release gate: **pass** for frontend, Rust, security, performance, release compile, and NSIS packaging; the third-round default-parallel Rust matrix is green.

Cross-platform/remote release gate: **pending** macOS CI/package evidence and an authorized remote delivery workflow.
V4.3 should not be called fully released until those external and native checks are completed by a human or authorized CI run.

## Independent Review Remediation

This closeout records the six findings from the independent V4.3 review after PR11. The remediation keeps the existing durable authorities and safety boundaries; it adds no schema, second ledger, second AI queue, filesystem mutation authority, or alternate execution path.

| Review finding | Remediation and authority | Evidence |
| --- | --- | --- |
| Organize `requires-decision` could be treated like Safe Batch | Group acceptance is exposed only for backend-ready groups. Review items use the ordinary item-level Organization Plan decision mutation, show backend-projected review reasons, and require an explicit confirmation before acceptance. | `tests/organizeIndependentReview.test.tsx`; Rust `review_metadata_is_projected_and_requires_decision_uses_ordinary_mutation`; `organization.rs` projection and CAS path. |
| Cleanup rescan could reuse a request key or race | Every scan intent receives a fresh UUID request key, duplicate scan intents are guarded, and the key is cleared after completion. AI recheck cancellation also stops on unmount. | `tests/cleanupIndependentReview.test.tsx`; `StorageCleanupView.tsx`. |
| Cleanup AI recheck covered only loaded findings | Recheck first walks the durable Analysis Finding pages for active Review findings, then processes all IDs in bounded batches of 50 with processed/skipped/failed/canceled summaries. | `tests/cleanupIndependentReview.test.tsx`; `StorageCleanupView.tsx`. |
| Content Understanding could act on stale detail | Rebuild, delete, policy save, and purge refresh the authoritative File Library detail. Revision/CAS conflicts refresh before reporting the state change, and refresh failure remains an actionable operation error. Terminal runs refresh once after completion. | `tests/contentIndependentReview.test.tsx`; `ContentUnderstandingSheet.tsx`; `VaultView.tsx`. |
| Saved View active state cleared too early or remained after divergence/deletion | Active state survives the saved-query debounce, query loading, and selection changes; direct search/filter changes and deletion of the active view clear it. Saved View opening still starts a new Query V2 snapshot. | `tests/savedViewIndependentReview.test.tsx`; `VaultView.tsx`; `LibraryMetadataManagerDialog.tsx`. |
| Review reasons were renderer-derived or unlocalized | Organization Plan group/item projections now expose stable backend reason codes and available actions. The renderer maps those codes through shared i18n and never infers authoritative counts from the loaded page. | Rust organization query tests; `domain.ts`, `browserMockApi.ts`, `OrganizeSuggestionsView.tsx`, shared i18n. |

### Mounted behavior coverage

The independent-review tests mount the affected React surfaces in happy-dom with Chrome context, Zustand stores, browser-like virtualizer dimensions, and mocked Tauri API contracts. They cover ordinary versus Safe Batch decisions, full finding pagination, bounded AI batches, cancellation/fresh intent behavior, Content Understanding rebuild/delete/conflict refresh, Saved View debounce/divergence, and active-view deletion. They are not static source-presence checks.

### Final validation record

The final command results in this document are refreshed from the final remediation HEAD. The required local commands are `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run test:remediation`, `npm.cmd run test:performance`, `npm.cmd run build`, `npm.cmd run verify:rust`, `npm.cmd run verify:security`, `git diff --check`, and `npm.cmd run test:docs` with the original QA commit as `DOCS_DIFF_BASE`.

### Review-specific limits

The browser preview does not prove native Tauri lifecycle, Windows DPI/High Contrast/Narrator, macOS Retina/VoiceOver, macOS build/package, remote CI, signed artifacts, checksums, tag/release, or GitHub review results. Those remain explicitly unverified until exercised by the appropriate human or CI workflow.

## Independent Review Remediation — second-round closure

Date: 2026-08-02

This section records the second independent-review remediation pass. It preserves the accepted V4.3 baseline and the existing durable authorities; no schema 35, second ledger, second queue, alternate mutation authority, or automatic file-mutation path was added.

### Findings closed

| Finding | Closure and authority | Evidence |
| --- | --- | --- |
| Reviewed Organize items could remain in pending counts or appear actionable | Organization Plan now projects `pendingReview` and `reviewed` separately. `requires-decision` groups remain in Needs My Decision; reviewed groups are shown in Plan and are not counted as pending. Overview and App Shell consume the backend summary rather than adding loaded-page counts. | `organization.rs`; `OrganizeSuggestionsView.tsx`; `overviewModel.ts`; `AppShell.tsx`; `tests/organizeIndependentReview.test.tsx`; `tests/overviewSettingsPr10.test.ts`. |
| Renderer could accept an item that backend safety facts reject | Backend action eligibility is authoritative. Accept/edit decisions use stable unavailable-action errors, revalidate current source/proposal/managed scope/preview facts, and preserve item CAS, Preview, Dry Run, journal, and execution gates. Target collisions can enter the edited-name review path only when the backend marks that path available. | `organization.rs`; `browserMockApi.ts`; `tests/organizeIndependentReview.test.tsx`; `tests/fileLibraryV2.test.ts`. |
| Content Policy revision conflicts could leave stale detail or silently retry | Policy/content mutations refresh both File Library detail and Content Scope Policy after a CAS conflict. There is no automatic re-submit; refresh failure preserves the actionable conflict/error state. | `ContentUnderstandingSheet.tsx`; `VaultView.tsx`; `tests/contentIndependentReview.test.tsx`. |
| Review reasons could depend on unstable blocking text | Review reasons are emitted from stable backend reason codes and structured preview fields. The renderer localizes those codes through shared i18n and does not parse `blocking_detail`. | `organization.rs`; `domain.ts`; `OrganizeSuggestionsView.tsx`; `i18n.ts`; `tests/organizeIndependentReview.test.tsx`. |
| Organization projection changes could regress the 10k performance gate | Large-plan group projection and dry-run loading use bounded bulk indexed-file queries. The existing 100/1k/10k Task 06 performance profile remains green with the original timing thresholds. | `organization.rs`; `npm.cmd run test:performance`; focused ignored Task 06 test. |

### Second-round validation

- `npm.cmd run typecheck` — passed.
- `npm.cmd test` — passed: 89 files, 569 tests.
- `npm.cmd run test:remediation` — passed: 1 file, 13 tests.
- `npm.cmd run test:performance` — passed in 595.9s, including the required 100k/1M-scale profiles and Task 06 100/1k/10k Organization Plan thresholds.
- `npm.cmd run build` — passed with Vite, Windows release compile, and NSIS packaging.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime -- --test-threads=1` — passed: the full 587-test Rust suite and integration/doc test targets completed successfully.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings` — passed.
- `npm.cmd run verify:rust` — the script's parallel Rust test phase reproduced the existing timing-sensitive PDF resource-limit failure; the full suite passed single-threaded and the focused exact PDF test passed. No production code was changed to mask the timing issue.
- `npm.cmd run verify:security` — passed: npm audit clean; cargo audit reported only the existing allowed advisories.
- `git diff --check` and `npm.cmd run test:docs` — final results are recorded after this documentation update.

### Mounted and visual evidence

Mounted React tests cover reviewed/pending state closure, backend action eligibility, collision edit behavior, stable error handling, and Content Policy conflict refresh. The browser preview rendered Organize Files in Light Chinese, Dark Chinese, Light English, and Dark English; the current empty-plan state had one page heading, preserved the Preview/explicit-confirmation safety copy, and remained usable at 980×680. The preview reported no console errors. Native Tauri Content Understanding, focus restoration, DPI, high-contrast, screen-reader, macOS, and remote CI behavior remain unverified.

### Acceptance

- Organization Plan remains the only Organize review authority; no renderer global count or second ledger was added.
- Backend action eligibility remains fail-closed and item-CAS protected; no direct filesystem mutation path was introduced.
- Content Policy CAS conflicts refresh authoritative state without automatic resubmission.
- Review reasons are stable, structured, localized, and independent of blocking-detail prose.
- Existing Preview, Dry Run, journal, Safe Trash, Restore, and AI-advisory boundaries remain intact.

### Risks requiring human review

Reviewers should exercise native Organization Plan revision conflicts, source/proposal changes between review and execution, Content Policy conflict recovery, target-collision rename flows, and the platform/accessibility matrix. The parallel PDF test timing issue should be triaged separately; its stable single-threaded result is green.

## Independent Review Remediation — third-round closure (2026-08-02)

### Baseline and scope

This pass starts from `6e08ad02d6885ae74298f7bd5de347e15fb0695a` on `codex/ui-v4-3-product-integration`. It closes the three findings in the third independent-review remediation request. No schema 35, second ledger, renderer authority, second AI queue, filesystem mutation authority, or bypass of Preview, Dry Run, journal, CAS, Safe Trash, or Restore was introduced.

### Findings closed

| Finding | Root cause | Fix | Tests and status |
| --- | --- | --- | --- |
| 1. Default-parallel PDF resource-limit timing failure | A large uncompressed CMap object was repeatedly scanned under the deadline-bound structural checks. Under parallel CPU contention, the deterministic size-limit case could time out before it was classified as a resource-limit case. | Added a bounded CMap preflight before the expensive scans. Oversized uncompressed CMaps now return the stable `content_pdf_cmap_decoded_byte_limit_exceeded` resource-limit reason; timeout remains a real timeout. No ignored test, global single-thread workaround, swallowed error, or timeout relaxation was added. | Default parallel full Rust: 5/5; exact PDF target: 10/10; original `npm.cmd run verify:rust`: passed. **Closed.** |
| 2. Organization Plan readiness could be stale or page-derived | Persisted `validity` and loaded-page summaries do not alone describe current source identity, managed scope, proposal, preview, or action eligibility. Renderer summary fields could therefore diverge from current authoritative facts. | Added backend `effectiveReadiness` with only `ready`, `requires-decision`, `reviewed`, and `blocked`. Hard blocks are evaluated first from current file identity, managed-scope health/membership, live proposal, preview identity/executability, supported operation and terminal state. Full group projection derives the authoritative effective summary; persistence is unchanged until Refresh. Overview, App Shell and Organize use the backend summary. | Rust coverage includes size, move, mtime, missing, live proposal, preview mismatch, content-only change, invalid scope and Refresh convergence; existing Dry Run/Execution convergence remains covered. Full Rust, frontend, performance and build gates passed. **Closed.** |
| 3. Group Safe Batch could partially accept and repeat projection work | The previous group mutation selected only safe members and re-queried/reprojected them individually, allowing silent partial acceptance and inconsistent group facts. | Group mutation now reuses one full backend projection, requires every current member to be safe/actionable, enforces Keep/Clear for every member, and applies all item revisions plus plan revision in one transaction. Any change returns `organization_group_changed` or `organization_group_not_fully_safe` with zero updates. Browser Mock and localized UI require an explicit refresh; no optimistic update or automatic retry is used. | Rust strict atomicity test, 1k-member single-transaction performance test, mounted localized group-change/refresh test, full Vitest and Rust gates. **Closed.** |

### Third-round validation record

- Default parallel full Rust matrix: 5 consecutive runs, all exit code 0.
- PDF resource-limit target matrix: 10 consecutive exact runs, all exit code 0.
- `npm.cmd run verify:rust` — passed: format check, default parallel Rust suite, and Clippy with `-D warnings`.
- `npm.cmd run typecheck` — passed.
- `npm.cmd test` — passed: 89 files, 570 tests.
- `npm.cmd run test:remediation` — passed: 13 tests.
- `npm.cmd run test:performance` — passed: bounded frontend checks, SQLite/FTS, global search, managed scan, migration, analysis, Task 06 100/1k/10k, Task 07 and 1M-scale profiles.
- `npm.cmd run build` — passed: Vite, Windows release compile and NSIS packaging.
- `npm.cmd run verify:security` — passed: npm audit clean; cargo audit reported only the existing allowed 15 unmaintained/unsound warnings.
- `git diff --check` — passed.
- `npm.cmd run test:docs` — passed against the final remediation commit with `DOCS_DIFF_BASE=6e08ad02d6885ae74298f7bd5de347e15fb0695a`.

### Status

Third-round local Windows closure is **complete**. macOS compile/package, remote CI, signed artifacts, checksum/tag/release, native Tauri lifecycle, DPI/high-contrast/screen-reader execution, and independent GitHub review remain external or platform-specific limitations; no PR was created.

## Independent Review Remediation — fourth-round closure

Date: 2026-08-02

This fourth-round closure addresses Group Projection Fingerprint, Group Action Intersection, Plan List Projection Complexity, Open Plan Duplicate Projection, and PDF CMap Preflight. Existing durable authorities and safety boundaries remain unchanged.

| Finding | Closure evidence | Status |
| --- | --- | --- |
| Group Projection Fingerprint | `OrganizationPlanGroupSummaryDto`/TypeScript include `projectionFingerprint`; requests include expected fingerprint and item count; the backend regenerates and compares the full projection before action/CAS/update; stale fingerprint tests prove zero item updates. | Closed locally. |
| Group Action Intersection | `OrganizationPlanGroupActionsDto`/TypeScript `groupActions` use all-member intersections. Include/Keep/Clear buttons use only those fields; accepted, reviewed, Keep, and mixed groups no longer show an incorrect include action. | Closed locally. |
| Plan List Projection Complexity | Plan list no longer calls full group projection and returns `effectiveSummary: null` until loaded. The Rust counter test covers a 200-plan list and observes zero full projections. | Closed locally. |
| Open Plan Duplicate Projection | Basic plan hydration is cheap; the group page is the full projection/effective-summary authority. The Rust counter test observes zero full projections for get and one after group query. | Closed locally. |
| PDF CMap Preflight | Structured bounded stream/dictionary/raw-data/filter checks prevent ordinary, compressed, dictionary-token, and non-stream false positives. Deadline/cancellation errors propagate through the existing extraction result mapping. | Closed locally. |

### Fourth-round focused evidence

- `npm.cmd run typecheck` — passed.
- `npm.cmd test` — passed: 89 files, 572 tests.
- `npm.cmd run test:remediation` — passed: 13 tests.
- Focused Vitest: `tests/organizeIndependentReview.test.tsx`, `tests/fileLibraryV2.test.ts`, and `tests/organizationPlanTask06.test.ts` — passed: 3 files, 20 tests.
- Rust Organization test module — passed: 20 passed, 1 existing ignored Task 06 performance test.
- PDF preflight focused test and PDF resource-limit test — passed.
- Exact PDF resource-limit target — passed 10/10 consecutive runs with `-- --exact --test-threads=1`.
- `npm.cmd run test:performance` — passed, including the configured 100k/1M profiles and Task 06 thresholds.
- `npm.cmd run build` — passed with Windows release compile and NSIS packaging.
- `npm.cmd run verify:rust` — passed: format, Rust test phase, and Clippy with `-D warnings`; the Rust phase reported 583 passed, 0 failed, and 9 ignored in the primary unit target.
- `npm.cmd run verify:security` — passed: npm audit found 0 vulnerabilities; cargo audit reported the existing 15 allowed unmaintained/unsound warnings.

The required five default-parallel full Rust invocations were attempted twice after the Rust gate. Each exposed a different unrelated timing-sensitive Windows filesystem-test failure (`cleanup_restore_preview_marks_filesystem_conflicts_and_missing_sources` and `file_ops::tests::restore_moves_updates_file_record_after_move_restore`); both passed on exact single-threaded reruns. This leaves the broad default-parallel matrix unverified, while the fourth-round PDF target itself is stable at 10/10.

The local browser preview captured the dark-Chinese Organize Files empty-plan state at 1440×900 and 980×680. The five required viewport sizes (1440×900, 1280×800, 1180×720, 1024×700, 980×680) retained one page heading and measured no horizontal overflow; browser console error/warning logs were empty.

`git diff --check` and `npm.cmd run test:docs` are rerun after this documentation update. No statement of cross-platform or remote release readiness is made.

### Fourth-round safety and authority checklist

- Backend projection remains the only source of group membership, action intersection, effective readiness, and effective summary.
- Group mutation remains plan-revision/item-revision/CAS protected and commits no subset after a projection or action mismatch.
- Include, Keep, and Clear remain review decisions only; filesystem execution still requires Preview, Dry Run, journal, and execution revalidation.
- PDF CMap preflight does not bypass decompression, extraction, output, deadline, or cancellation limits.

### Fourth-round unverified items

The broad default-parallel five-run Rust matrix remains unverified because of the two unrelated Windows filesystem-test races recorded above. macOS compile, unsigned DMG, remote CI/Full Validation, Native Tauri, Windows DPI/High Contrast/Narrator, macOS Retina/VoiceOver, signed artifacts, checksums, tags, and release/publish evidence remain unverified.
