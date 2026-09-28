# AI-only Product Migration — PM-01 Core Experience Result

Last verified: 2026-09-28

**IMPLEMENTATION COMPLETE — READY FOR OWNER REVIEW**

PR [#287](https://github.com/ArdenZC/Zen-Canvas/pull/287) remains **OPEN / Draft**. This result records implementation and validation evidence; Owner Review, any Draft-state change, and merge remain owner decisions.

## Activation and candidate

- Initiative: [#273 — AI-only Product Migration](https://github.com/ArdenZC/Zen-Canvas/issues/273).
- Activation baseline: master@189c0fd522579d643216e313d6fcb6bcc8467ab7.
- Implementation branch: product/pm-01-ai-only-core-experience.
- User-provided continuation snapshot: 9f9a666078e3756f03975e6484c2b06fa7d6930a; exact CI 36384506120 was successful.
- Previous source candidate before the final browser-harness repair: 0e964f6785220fc79b827c7796225fc5918f744b; exact CI 36404469034 was successful.
- Final product source candidate: 213d0aba201b2b52ee63c8ff9264eba1d076dcf5; tree 8a6266f52e867c73e9ce5f78aebc3101e8c481ed.
- Exact source-candidate CI: [36410571076](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36410571076) — **SUCCESS** on 213d0aba.
- PR base remains 189c0fd522579d643216e313d6fcb6bcc8467ab7; the PR is not merged and was not changed to Ready for Review.

## Delivered scope

The implementation uses the existing Managed AI, SemanticAssessmentV1, Global Index, Cleanup/Analysis and Organization Plan authorities. The PR spans backend gates and projections, frontend readiness and onboarding, product copy, permission/build registration, and focused Rust/frontend tests. The final source repair changed only src/views/cleanup/StorageCleanupView.tsx and tests/cleanupIndependentReview.test.tsx.

### Organize semantic authority

- New and refreshed proposal semantics require a current Managed AI assessment. NotManaged and Pending produce a pending proposal without semantic explanation; missing, malformed, stale, or non-current bindings remain unavailable or blocked.
- Current semantic explanation and proposal fingerprints come from SemanticAssessmentV1. A changed current assessment invalidates the accepted proposal; changing legacy suggested/classification fields alone does not.
- No files.suggested_name, suggested_action, or classification field was restored as execution authority. No Rules/classification fallback was added.
- Existing reviewed plans, exact Operation Preview, confirmation, journal and Restore checks continue to be resolved by their deterministic authorities.

### Cleanup and readiness

- New or refreshed AI Cleanup work consumes the existing backend provider/feature readiness and separate Cleanup sharing consent. Existing deterministic findings and already-current evidence remain inspectable if the provider later becomes unavailable.
- Current assessment evidence does not itself grant executability or reduce deterministic risk. Cleanup Preview, confirmation, Safe Trash, operation journal and Restore boundaries remain in force.
- Organize and Cleanup explain their own readiness states and recovery actions. Onboarding presents all five steps, distinguishes Managed AI scope permission from Cleanup data-sharing consent, and allows users to skip or configure AI.
- Rules, Automation and Preference Memory copy no longer claims that those systems are current Organize/Cleanup semantic authority or an active Managed AI worker input.

### Final browser-harness repair

Browser PM-01 Cleanup scenarios previously could not select a quick scope because that control called the native Tauri path plugin. The final patch supplies synthetic paths only when browser mocks are enabled and an explicit pm01-cleanup presentation fixture is selected. The native path remains OS-owned. A mounted regression test verifies that fixture scope selection works without invoking the native path plugin and does not start analysis merely by selecting a scope.

## CI failure diagnosis and repair history

No production semantic fallback was added to repair CI.

- The first Rust runs reported nine Organization test failures on Windows/macOS. Those tests had legacy-only fixtures that no longer met the PM-01 authority contract. The test fixtures were rebuilt with a real current SemanticAssessmentV1 binding: Global Index entry, managed entry/scope, current metadata fingerprint, provider/model settings, completed AI state/job/job item, and a valid assessment. This let the tests exercise current semantic authority instead of relying on legacy classification.
- After that fixture conversion, the intermediate remaining failures were effective_readiness_revalidates_live_facts_without_mutating_validity and the member-join/member-migration projection-fingerprint tests. The group tests now synchronize their starting semantic proposal fingerprint before testing the stale-projection CAS. The readiness fixture now restores the original semantic reason as well as the original target, so its semantic fingerprint is truly restored before the content-only mutation assertion. The test still asserts that a real Managed assessment change yields proposal_changed.
- The Intelligence Task 06 benchmark had no current managed semantic execution chain and its Windows global-entry normalized path could differ from the source identity. The benchmark now seeds the current managed assessment chain and uses global_index::models::normalize_path for path_normalized. It does not relax a performance gate.
- The browser-only scope-path gap was repaired in the final two-file source patch described above; it did not change production path selection or backend authority.

The changes therefore correct test and presentation fixture construction. They do not change fail-closed behavior, permit legacy semantic fallback, skip failures, or weaken performance thresholds.

## Validation

### Local validation

- npm run verify:frontend — **PASS** at source candidate 213d0aba: TypeScript, 155 frontend test files / 1,641 tests, 14 remediation tests, 28 performance-architecture checks, and frontend build.
- npx vitest run tests/cleanupIndependentReview.test.tsx — **PASS**, 51/51 tests, including the mounted browser-scope regression.
- cargo fmt --manifest-path src-tauri/Cargo.toml -- --check — **PASS** at 213d0aba.
- npm run verify:rust — **PASS** at 0e964f: 1,079 Rust tests passed, 24 ignored, integration tests passed, and Clippy passed with -D warnings. The final 213d0aba patch did not modify Rust; Windows/macOS Rust quality also passed at the exact final source candidate in hosted CI.
- Local Intelligence Task 06 performance test — **PASS** on Windows at 0e964f; exact-source-candidate hosted Intelligence performance also passed.
- git diff --check — **PASS** on the source candidate.
- The frontend build emitted existing Tailwind CSS optimizer and pdfjs-dist dynamic-import warnings; the build succeeded. Browser runtime console/page errors and warnings were zero in the evidence capture below.

### Exact source-candidate hosted CI

Run [36410571076](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36410571076) completed successfully on 213d0aba201b2b52ee63c8ff9264eba1d076dcf5.

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

Packaging, dependency-audit, native Preview Handler, native macOS performance, unrelated performance lanes and documentation-only lanes were **SKIPPED by the validated lane plan**. Their skips are not reported as passes and did not mask the required PM-01 lanes.

### Browser evidence

Retained outside the repository at F:\CargoTarget\pm01-287-browser-evidence-213d0aba\formal-evidence\:

- manifest.json binds all captures to source 213d0aba, CI 36410571076, and Chromium 151.0.7922.34.
- screenshots\ contains 31 captures: Organize disconnected / needs-analysis / ready-current / review / managed-scope-missing / managed-consent-missing / Settings recovery; Cleanup disconnected / local and cloud consent missing / feature disabled / analysis failure / current assessment while provider is offline / Preview while offline / ready Preview; and onboarding steps, local/cloud choices, skip/configure routes, Escape and narrow layout.
- Console errors, console warnings and page errors: **0 across 31 captures**.
- Key screenshots were visually inspected. Browser fixtures are explicitly presentation-only; this is not backend readiness, native acceptance, or filesystem-operation evidence. No Preview confirmation or Safe Trash mutation was invoked. The browser cannot exercise the native OS folder picker; the onboarding folder/consent UI was captured without selecting a real native folder.

## Authority and scope disposition

- Database schema remains version 35; no migration or durable authority was added.
- Operation Preview, confirmation, Safe Trash, journal and Restore remain deterministic and fail closed.
- PM-02, #283 production adoption, #270, Preference Memory persistence, autonomous execution and release publication remain outside this work. PM-02 stays **NOT ACTIVE** pending PM-01 Owner Review/merge.
- F:\pm01-287-temp still contains task-generated local Rust test artifacts (about 0.29 GiB). A cleanup attempt was blocked by the tool policy before deletion; no files were removed. This is a local hygiene residual, not a source-tree or hosted-CI blocker.
- No PM-01 implementation or required hosted-CI blocker remains. Owner Review itself is pending; PR #287 remains Draft by instruction.

## Final disposition

**IMPLEMENTATION COMPLETE — READY FOR OWNER REVIEW**

Owner review must inspect the PR diff and evidence directly. This disposition does not authorize a Ready transition or merge.
