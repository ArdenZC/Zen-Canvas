# Issue #329 V2 — Native Failure Root-Cause Remediation

Last verified: 2026-10-09

## Disposition

**IMPLEMENTATION COMPLETE — EXACT-HEAD SOURCE VALIDATION LANES PASS; THREE AGGREGATE CI CHECKS FAIL ON A SEPARATE VALIDATION-PLAN INPUT DEFECT; COMPLETED REVIEW FINDINGS RESOLVED.** PR [#335](https://github.com/ArdenZC/Zen-Canvas/pull/335) remains **OPEN / Draft**. Issue #329 remains **OPEN**. Codex CLI follow-up review after the finding fix was blocked by its usage limit; the user then instructed that no further codex-review be run, so no post-fix review pass is claimed. This report does not authorize Ready, merge, native qualification, or issue closure.

The frozen Windows native failure installation was not touched. No installer build or Owner-driven native product qualification was initiated. The automated disposable Windows Global Index service gate is reported separately as hosted CI.

## Source identity

| Item | Identity |
| --- | --- |
| Starting PR head | `3b303ea54227fc4ce6711f770b0e51475d568648` |
| Starting tree | `b2a2666546309cca20ae8aa94ca505a961f10719` |
| Current master observed | `0eda3e0d232a22eba116a99567b7bdf6735c5104` |
| Source candidate | `c85257940c591035d1a5520b50df33292fd38142` |
| Source tree | `61f7a64be9bb232cb2b952177bef4464d367212f` |
| Branch | `fix/issue-329-onboarding-scan-scope-save` |
| PR | #335, OPEN / Draft |
| Documentation closeout | Docs-only commit on the same PR branch, after the source candidate |

The branch was continued from the existing PR head without rebasing for the docs-only master advance.

## Implementation and root-cause evidence

The production authority chain remains:

`OnboardingDialog.saveFolderSetup` → `setDefaultScanFolders` → `updateSettingsWithResult` → Tauri `save_settings` → versioned Settings CAS → watcher root sync → watcher restart and reconciliation scheduling → success or Settings/watcher compensation.

`save_app_settings_cas` now acquires `TransactionBehavior::Immediate` before reading the prior Settings row. This is limited to that CAS transaction. It does not change the global five-second SQLite busy timeout, add retries, or change catalog-revision, serialization, normalization, or revision-conflict rules. A process-local Settings save guard covers the previous snapshot, CAS, watcher reload, and compensation; it does not hold a SQLite transaction while runtime work runs. Lock order is the Settings save guard followed by the catalog execution guard inside the CAS transaction; the catalog guard is released before watcher-root synchronization. No reverse acquisition path was found.

The real-pool regression compares the previous deferred boundary with the repair:

- Deferred baseline: a second pooled connection holds `BEGIN IMMEDIATE`; the real CAS performs its read then fails at the read-to-write upgrade with `SQLITE_BUSY` primary/extended code `5`, before the 300 ms holder release. Persisted Settings remain unchanged.
- Repaired short contention: the real CAS waits for the holder to release inside the existing timeout, then saves exactly one revision.
- Over-timeout contention: the real CAS remains fail-closed with `SQLITE_BUSY(5)` around the existing five-second bound. The test also confirms no Settings or root mutation before acquisition; after release, one explicit save and root sync succeed.
- A stale expected revision remains `RevisionConflict`; the winning Settings row and single catalog revision increment remain authoritative.

The watcher-root synchronization path already uses `BEGIN IMMEDIATE`. Its acquisition failure happens before mutations and no retry was added. A transaction-triggered failure after root insertion is covered; transaction drop rolls back the inserted root, the Settings command persists a compensating Settings revision, and the command returns the root-sync support code. A bounded retry at the root-sync acquisition boundary could be safe before transaction/mutation begins, but it was not added: the existing five-second busy handler already bounds the wait, and a retry policy was not authorized. Errors after transaction start are not generically replayed.

Watcher runtime failure is separate from SQLite contention. A regression supplies a valid existing directory and injects a watcher-manager state-lock failure without a database operation; no watcher owner is installed. The production reload preserves the shared startup/wake behavior of attempting reconciliation scheduling even if restart fails, while keeping restart failure as the reported stage. Scheduling failure is separately classified and tested through the Settings compensation boundary. Settings compensation remains fail-closed: failure to restore runtime state yields `rollback_reconciliation_failure`, never success.

The current production-path mechanism is proven to match the deferred-CAS writer-contention mechanism investigated in #328. Therefore:

**#329 ROOT CAUSE CORRELATES WITH #328 SQLITE WRITER CONTENTION**

The exact historical Windows native event remains **INFERRED**, not PROVED: the frozen run exposed only a generic save failure and did not record its stage or SQLite lock owner. The patch proves and repairs a real Settings CAS failure mechanism on the current production path; it does not retrospectively prove that the native event reached that stage.

## Diagnostics and preserved behavior

The Settings error path now exposes only stable, non-sensitive stage strings:

- `settings_save_failure:database_failure`
- `settings_save_failure:revision_conflict`
- `settings_save_failure:watcher_root_sync_failure`
- `settings_save_failure:watcher_runtime_failure`
- `settings_save_failure:watcher_reconciliation_schedule_failure`
- `settings_save_failure:rollback_reconciliation_failure`
- `settings_save_failure:unknown_failure`

The localized user message includes the support code. Backend errors, paths, file content, credentials, and SQLite details are not included in the support code or watcher event payload. No telemetry or logging database was added.

The existing normalized-root semantic comparison, `persisted: true` requirement, `/` handling, delayed-load intent and single conflict rebase remain in place. Onboarding keeps its failure alert and cannot advance or mark completion after a failed root persistence. Settings add/enable/disable/delete continue to use the same persisted versioned Settings and watcher-root authority.

## Changed files

- `src-tauri/src/settings.rs`
- `src-tauri/src/watcher.rs`
- `src-tauri/src/global_index/lock_contention_tests.rs`
- `src/components/AppRuntimeProviders.tsx`
- `src/components/OnboardingDialog.tsx`
- `src/hooks/useAppSettings.ts`
- `src/i18n/dictionary.ts`
- `src/utils/viewHelpers.ts`
- `tests/appSettings.test.ts`
- `tests/onboardingSettingsPersistence.test.tsx`
- `tests/stableErrors.test.ts`
- `docs/project/STATUS.md`
- this report

## Validation

| Check | Result |
| --- | --- |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `git diff --check` | PASS |
| `npm run typecheck` | PASS |
| Focused Settings / delayed-load / Onboarding / error tests | 4 files, 26 tests PASS |
| Full `npm test` | 176 files, 1,810 tests PASS |
| `npm run test:remediation` | 1 file, 14 tests PASS |
| `npm run test:performance:architecture` | PASS; 3 files, 30 tests PASS |
| `npm run build:frontend` | PASS; existing CSS optimizer and PDF dynamic-import warnings remain |
| Local Rust unit tests | BLOCKED before test execution on Linux: the current crate references `keyring::Entry`, while Cargo declares `keyring` only for Windows/macOS targets. No Linux test binary ran. New snapshot assertions were corrected to compare serialized settings after the first compile exposed the absent `AppSettings: PartialEq` implementation. |
| Hosted Windows/macOS CI for source candidate | Source validation lanes PASS; overall run FAILS on three aggregate validation-plan checks; [run 37861489174](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37861489174). |
| Native qualification | Not run, by scope |

The default Cargo source cache (`/home/agent/.cargo/registry`) and npm cache (`/home/agent/.npm`) persist across work in this managed environment; those package managers keep separate formats. The previously missing Linux native build dependencies are now cached together: 127 Debian packages (61.8 MB downloaded) in `/home/agent/.cache/zen-canvas/apt/cache/archives`, extracted to a reusable 285 MB user-owned sysroot at `/home/agent/.cache/zen-canvas/sysroot`. `/home/agent/.cache/zen-canvas/prepare-linux-native-cache.sh` recreates the cache and `/home/agent/.cache/zen-canvas/native-deps.sh` activates it for builds. Running the preparation script again used **0 B** of package archives, confirming reuse. This avoids system installation privileges; `node_modules` and Cargo build output remain workspace-local. With the sysroot active, pkg-config resolves GLib, ATK, GTK and WebKit. Linux Rust test execution then reaches the existing platform-specific `keyring` compile error described above; supported Windows/macOS hosted lanes remain the validation target.

The hosted validation sequence exposed three test-only issues, each corrected on the next source candidate:

- Run `37815479031` on `dbc7ed3` found that the short-contention Windows fixture expected backslashes while production serializes normalized scan roots with forward slashes. The expected fixture now normalizes its path in `170e202`.
- Run `37820064428` on `170e202` found the existing rollback integration test still expected the old internal error text. Its assertion now checks `settings side-effect reconciliation failed` in `3ac7264`.
- Run `37821143157` on `e71f6e7` found that the over-timeout CAS test had a redundant strict eight-second ceiling. The test includes waiting for the process-wide catalog execution guard, so parallel macOS test scheduling made the observed elapsed time `9.548870375s` even though it returned the expected `SQLITE_BUSY(5)`. `c852579` removes only that redundant assertion; the test still verifies the configured 5,000 ms SQLite busy timeout, `SQLITE_BUSY`, unchanged persisted Settings/root state while locked, the shared 4.5–20 second bounded-wait guard, and successful save/root synchronization after releasing the holder. The three downstream validation-plan failures in run `37821143157` reported missing head-validation success after this Rust failure and were dependent gates.

The current exact-head run is `37861489174` on `c852579`. Its source checkout, scope and lane-plan contracts, Windows disposable Global Index service gate, Windows/macOS release compile, Rust head and merge lanes, frontend/browser head and merge lanes, and Search/Scan performance shards passed. The overall run is red because `Performance profile`, `Quality (windows-latest)`, and `Quality (macos-latest)` fail at `Verify validation plan` with `non-equivalent trees require head validation success, got missing.` Rerunning those failed jobs after head validation completed reproduced the same three failures.

The CI workflow invokes `scripts/ciValidationPlan.mjs --aggregate` in those jobs without the required `HEAD_VALIDATION_RESULT`, `INTEGRATION_VALIDATION_RESULT`, or `LANE_JOB_RESULT` inputs. For non-equivalent PR trees, the helper therefore has no head-validation result to evaluate. This is an existing workflow/helper call-contract defect, separate from the #329 source changes. The workflow and helper are outside this bounded remediation scope, so they were not modified. The aggregate failures remain a separate Owner gate; no CI green result is claimed. Earlier source-specific failures occurred only on superseded candidates and are listed above.

## Independent review history and disposition

Completed `codex review` passes were separate from implementation and focused on CAS ordering, rollback/reconciliation, semantic roots, privacy/fail-closed behavior, #328 overlap, and cross-boundary tests. The user has since prohibited any further codex-review runs; none were run after that instruction.

1. **P1 — watcher error return type broke native Rust callers.** Resolved by retaining the public `Result<bool, String>` watcher reload boundary and adding a private typed stage-returning function for the Settings command. Native startup/wake callers remain source-compatible.
2. **P2 — early return after watcher restart failure skipped reconciliation scheduling for startup/wake callers.** Resolved by preserving the existing behavior that attempts both restart and scheduling and reports the restart error first. Added a regression that ensures scheduling is attempted after restart failure.
3. **Final focused review after the serialized-settings assertion correction:** no actionable substantive defects. The serialized-settings assertions compare the full persisted contract without adding `PartialEq` to the production settings type; the review also ran the 26 focused frontend tests successfully. Rust/native execution was not independently validated by codex-review.
4. **Independent review on commit `3ac7264`: P2 — rollback absence assertion used an unnormalized Windows path, allowing a false negative.** Resolved in `e71f6e7` by normalizing the query parameter to forward slashes before checking persisted roots. This was a test-only correction; no production defect was identified by that pass.
5. **Follow-up review after `e71f6e7`:** the attempt returned a Codex CLI usage-limit error and terminated without a review result. The user then prohibited further codex-review runs, so no review was attempted after `c852579`. That source change only removes the brittle eight-second timing assertion described above; production behavior is unchanged. The earlier P2 finding is resolved in source.

Every substantive finding returned by a completed review has an explicit resolution above; none is known to remain open. The attempted follow-up produced no result, and `c852579` has no independent post-fix review signoff. The changed watcher stage does not alter Tauri command registration, IPC shape, or the public watcher reload Rust return type.

## Package, schema, IPC, #328, and remaining limits

- Package remains `0.1.40`; database schema remains `37`; IPC remains `v3`.
- The `save_settings` command and its success payload are unchanged. Its error string now uses a stable support classification; no new IPC field or command was introduced.
- #328 remains a separate issue and authority. No Global Index behavior, global SQLite mutex, timeout, or retry framework changed.
- SQLite contention codes in the authored Rust regressions are `SQLITE_BUSY` primary/extended `5`; the injected post-mutation root trigger expects primary `ConstraintViolation`, extended `1811`. Rust execution of these tests awaits hosted CI.
- Exact historical native failure attribution remains inferred. The manager runtime-fault regression is deterministic injection, not a native watcher qualification.
- Reconciliation scheduling can admit durable scan work before a later scheduling error is returned. The existing scheduler remains its authority; this patch does not add cancellation or replay. Settings still rolls back and surfaces a failure code. Owner review should consider this existing partial-admission boundary when interpreting a scheduling-stage failure.
- PR #335 remains Draft; issue #329 remains OPEN. No Ready, merge, installer build, native qualification, or closure is authorized here.
