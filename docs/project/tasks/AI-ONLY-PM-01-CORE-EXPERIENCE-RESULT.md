# AI-only Product Migration — PM-01 Core Experience Result

Last verified: 2026-09-28

**COMPLETE / MERGED — OWNER REVIEW PASSED**

PR #287 passed direct Owner Review, left Draft, and was squash-merged to `master@ee3347dbc9963067851378da2acd0fd0d85d114c`. Merge-after master CI [36447256280](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36447256280) / run #1623 is **SUCCESS**. PM-01 is closed as an implementation stage; issue #273 remains open because it owns the wider AI-only Product Migration sequence.

## Activation and candidate

- Initiative: [#273 — AI-only Product Migration](https://github.com/ArdenZC/Zen-Canvas/issues/273).
- Activation baseline: master@189c0fd522579d643216e313d6fcb6bcc8467ab7.
- Implementation branch: product/pm-01-ai-only-core-experience.
- Previous head before this Owner Review remediation: d1f190abd7139a8133280a2f568e15f2ac3d4562.
- Remediation source candidate: cbb1d44820d1fe3186fde83a03bb5f40a0f3c818; tree b06ff4c1ce9cd384547370a28df78317bb268159.
- Exact source-candidate CI: [36435526936](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36435526936) — SUCCESS on cbb1d448.
- Final reviewed PR head: `3d91c6689bb62d10eddf343419f00c4abaea9fee`.
- PR #287 squash merge: `master@ee3347dbc9963067851378da2acd0fd0d85d114c`.
- Merge-after master CI: [36447256280](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36447256280) / run #1623 — **SUCCESS**.

## Delivered product scope

The implementation uses the existing Managed AI, SemanticAssessmentV1, Global Index, Cleanup/Analysis and Organization Plan authorities. This remediation changes onboarding presentation/flow and browser presentation fixtures plus focused tests; it adds no backend or schema changes.

### Organize semantic authority

- New and refreshed proposal semantics require a current Managed AI assessment. NotManaged and Pending produce a pending proposal without semantic explanation; missing, malformed, stale, or non-current bindings remain unavailable or blocked.
- Current semantic explanation and proposal fingerprints come from SemanticAssessmentV1. A changed current assessment invalidates the accepted proposal; changing legacy suggested/classification fields alone does not.
- No files.suggested_name, suggested_action, or classification field was restored as execution authority. No rules/classification fallback was added.
- Existing reviewed plans, exact Operation Preview, confirmation, journal and Restore checks continue to be resolved by their deterministic authorities.

### Cleanup and readiness

- New or refreshed AI Cleanup work consumes the existing backend provider/feature readiness and separate Cleanup sharing consent.
- Provider/settings currentness remains bound to the existing backend predicate. A changed provider/settings binding invalidates the old assessment. Deterministic findings and a still-current assessment remain reviewable after a later request failure, but execution remains subject to authoritative Preview revalidation.
- Current assessment evidence does not grant executability or reduce deterministic risk. Cleanup Preview, confirmation, Safe Trash, operation journal and Restore boundaries remain in force.
- Rules, Automation and Preference Memory copy does not claim that those systems are current Organize/Cleanup semantic authority or an active Managed AI worker input.

## Owner Review remediation

### Onboarding first value and restartability

The reviewed flow let Skip AI and Escape complete onboarding before a useful folder was configured. Re-entry also reset an unsaved folder selection. That violated the accepted W6-02 file-first first-value contract.

The remediation separates skipping AI setup from completing first-run setup. Skip AI bypasses provider, Managed AI permission and Cleanup AI setup while preserving the useful-folder step. A completion marker is written only after at least one useful enabled folder is already configured or has been saved through the existing settings path. Escape is a temporary dismissal and does not write the marker. Reopening Getting Started preserves the current step and an unsaved selected folder. After folder completion, background indexing enabled routes to File Library; disabled routes to Overview/manual scan.

The frontend suite covers no-folder Escape and re-entry, no-folder AI skip, unsaved-folder retention across Skip AI/Escape/re-entry, saved-folder completion with both indexing routes, the full five-step flow, Local/Cloud Settings routing, keyboard/focus and narrow layout.

### Cleanup provider request failure semantics

The prior mounted test changed provider readiness to provider_disabled and previewed a different Safe finding. It therefore proved neither a transient request failure with unchanged assessment binding nor Preview for the same Review finding.

The replacement mounted test keeps one current-assessment Review finding and the same ready provider/settings binding. A later AI request fails with provider_request_unavailable; the existing evidence remains visible, the same finding is manually acknowledged, and Preview receives that same finding ID, finding revision and review decision revision. It does not invent an offline readiness state or use provider_disabled to simulate connectivity failure.

The mounted test exercises UI behavior with mocked APIs; it is not backend authority evidence. Existing Rust authority coverage was retained and run: current_assessment_rejects_changed_provider_settings verifies an unchanged binding remains current before a settings change makes it non-current; cleanup_selection_requires_finding_revision_and_review_decision_cas verifies a missing current assessment fails closed even after review acknowledgement. Exact-head Windows/macOS Rust CI passed. No duplicate currentness authority or weaker Preview gate was introduced.

## Earlier CI fixture repairs

No production semantic fallback was added to repair CI.

- The initial Organization failures came from legacy-only test fixtures that no longer met the PM-01 authority contract. Those fixtures were rebuilt with a current SemanticAssessmentV1 binding, including Global Index entry, managed entry/scope, metadata fingerprint, provider/model settings, completed AI state/job/job item and valid assessment.
- The remaining Organization fixture failures were corrected by synchronizing the semantic proposal fingerprint before stale-projection CAS assertions and restoring the original semantic reason before content-only mutation assertions.
- The Intelligence Task 06 benchmark now seeds the current managed assessment chain and uses global_index::models::normalize_path for Windows path identity. It does not relax a performance gate.
- These fixture repairs and the current onboarding/Cleanup remediation preserve fail-closed behavior, do not permit legacy semantic fallback, and do not skip failures or lower performance thresholds.

## Browser evidence and limits

Owner-review evidence is packaged outside the repository at:

F:/CargoTarget/pm01-287-owner-review-evidence-cbb1d448.zip

The ZIP contains manifest.json, README.md and exactly 12 screenshots. It binds the captures to source cbb1d448, successful CI run 36435526936 and Chromium 151.0.7922.34. The scenario map covers explicit AI skip; no-folder Escape and Getting Started re-entry; synthetic useful-folder setup and both completion routes; AI Settings; narrow layout; current-assessment presentation; later provider request failure; and Preview for the same Cleanup finding ID.

Browser evidence is presentation-only. The folder is a synthetic preconfigured display setting, not evidence of the native folder picker or durable folder persistence. Cleanup readiness, assessment evidence, request failure and Preview are browserMockApi fixtures, not proof of backend currentness, provider connectivity or filesystem authority. The Preview panel is shown but its confirmation button was not activated; no Safe Trash, journal or Restore operation ran.

Evidence categories are separate:

- Browser screenshots: presentation state only.
- Mounted React tests: UI behavior with mocked APIs.
- Rust tests and exact-head hosted CI: backend/provider-settings currentness and fail-closed Cleanup Preview contracts.
- Native evidence: none was collected in this remediation; Windows/macOS hosted Rust and release compile are not native UI acceptance.

Console errors: 0. Console warnings: 0. Page errors: 0 across all 12 browser captures.

## Validation

### Local validation

- Focused frontend suites: 69/69 tests passed across onboardingDialog, cleanupIndependentReview, pm01ProductTruth and pm01BrowserPresentationFixtures.
- npm run verify:frontend: PASS on the remediation source candidate; typecheck passed, 155 test files / 1,646 tests passed, remediation 14/14, performance architecture 28/28, and frontend build succeeded.
- cargo fmt --manifest-path src-tauri/Cargo.toml -- --check: PASS.
- Affected Rust currentness test: 1/1 passed.
- Affected Rust fail-closed Cleanup Preview test: 1/1 passed.
- npm run verify:rust: PASS on the remediation source candidate; 1,079 unit tests passed, 24 ignored, integration suites passed, and Clippy passed with -D warnings. One initial full run had a transient failure in the unrelated coordinator scheduling test; its isolated rerun and the complete Rust gate rerun both passed. No unrelated Rust change was made.
- git diff --check: PASS before source commit.
- Browser runtime console errors/warnings and page errors: 0. The frontend build emitted the existing Tailwind CSS optimizer and pdfjs-dist dynamic-import warnings; the build succeeded.

### Exact source-candidate hosted CI

Run [36435526936](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36435526936) completed successfully on cbb1d44820d1fe3186fde83a03bb5f40a0f3c818.

| Required lane | Result |
| --- | --- |
| Source checkout / evidence contract | PASS |
| Change scope / routing contract | PASS |
| Validation lane plan | PASS |
| Windows Global Index service qualification | PASS |
| Frontend and format quality | PASS |
| Rust quality — Windows | PASS |
| Rust quality — macOS | PASS |
| Release compile — Windows | PASS |
| Release compile — macOS | PASS |
| Performance / Prepare | PASS |
| Performance / Intelligence | PASS |
| Performance profile | PASS |
| Quality aggregate — Windows | PASS |
| Quality aggregate — macOS | PASS |

Packaging, dependency audit, native Preview Handler, native macOS performance and unrelated performance lanes were skipped by the validated lane plan. Those skips are not reported as passes.

## Authority, schema and scope disposition

- Database schema remains version 35; no migration or durable authority was added.
- Organize remains AI-only for semantic authority. Legacy suggestion/classification fields are not execution fallback.
- Operation Preview, confirmation, Safe Trash, journal and Restore remain deterministic and fail closed.
- PM-02 is **NOT ACTIVE**. #283 research remains separate and authorized as the next eligible research lane; no #283 implementation was part of PM-01. #270 remains separate. Preference Memory production, autonomous execution and release publication remain out of scope.
- F:\pm01-287-temp still contains 1,142 task-generated local Rust test files (about 0.29 GiB). The prior cleanup attempt was blocked by tool policy; no files were removed and this pass did not retry it. This is a local hygiene residual, not a source-tree or hosted-CI blocker.
- No PM-01 implementation, evidence, Owner Review, merge, or merge-after CI blocker remains. PR #287 is merged and PM-01 is complete.

## Merge closeout

- Owner Review evidence package SHA-256: `2cb24b85d624a6aced3c0615fb5690c4d12ab2649b7fb28d65f8b7fd6c5867a0`.
- Direct Owner Review inspected the PR diff, CI, manifest, and all 12 browser presentation screenshots.
- Owner disposition: **PASS**.
- Final PR head: `3d91c6689bb62d10eddf343419f00c4abaea9fee`.
- Squash merge: `ee3347dbc9963067851378da2acd0fd0d85d114c`.
- Merge-after master CI: [36447256280](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36447256280) / run #1623 — **SUCCESS**.
- Database schema remains 35.
- PM-02 was not activated by this merge. #283 research remains separate from production authority.

## Final disposition

**PM-01 COMPLETE / MERGED — OWNER REVIEW PASSED — MERGE-AFTER MASTER CI SUCCESS**

The wider AI-only Product Migration initiative (#273) remains open for later stages. No active production implementation is implied by this PM-01 closeout.
