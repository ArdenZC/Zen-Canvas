# Zen Canvas Final Hardening v4.1.5 Closeout

## 1. Scope and provenance

- Starting `origin/master` SHA: `5188a9caeb422311254041cf044ff38b966f18d1`.
- Working branch: `codex/final-hardening-v4-1-5`.
- Prior v4.1.4 product commit: `885f0bccf85e4981eb18c0a0fa8aa1973119a8b0`.
- Application/package version remains `0.1.40`.
- Platform scope is Windows-first with the repository's macOS CI regression coverage. Ubuntu/Linux is explicitly out of scope for this hardening pass.
- At this document revision, the code head before the documentation commit is `c1e09b6f0625e04d4ef00ebfb4f83408f986d1fd`; the final documentation commit and final remote SHA are recorded after remote CI completes.

## 2. Commit list

1. `a413dc0` — `fix(recovery): finalize safe trash reconciliation states`
2. `5a9d030` — `fix(index): reconcile restore watcher index races`
3. `c1e09b6` — `test(recovery): cover restore identity and batch consistency`
4. Documentation commit — this closeout record; SHA to be recorded after CI.

## 3. Modified files and responsibilities

- `src-tauri/src/recovery.rs`: typed recovery error codes and stable message formatting.
- `src-tauri/src/storage_analyzer.rs`: Safe Trash reconciliation, old-phase A-state recovery, unified Item+Batch finalization, exact affected-row checks, and fail-closed outcome handling.
- `src-tauri/src/file_ops.rs`: four-state ordinary-restore reconciliation, watcher race handling, claim preservation, path reappearance guard, platform identity capture, and final-boundary revalidation.
- `src-tauri/src/db/queries/files.rs`: ordinary restore source/target row resolution, exact source-row merge, metadata preservation, FTS-safe transaction, and final journal/index atomicity.
- `src-tauri/src/db/queries/operations.rs`: operation journal volume identity persistence and exact restore-log updates.
- `src-tauri/src/db/schema.rs`: schema v24 migration for source/target/claim volume identity fields.
- `src-tauri/src/db/tests/*` and `src-tauri/tests/*`: restore matrix, migration, transaction rollback, Native Smoke expectation, and identity regression coverage.
- No frontend behavior, release workflow, tag, release, signing, or publishing workflow was changed.

## 4. Safe Trash A–G reconciliation matrix

| Case | Filesystem state | Result | Claim / movement boundary |
|---|---|---|---|
| A | original Matches; trash Missing; claim Missing | `restored / completed / verified` | Claim cleared; no move or retry; Batch finalized. Covered for `target_committed` and `source_cleanup_pending`. |
| B | original Missing; trash Matches; claim Missing | `moved / rolled_back / verified` | Claim cleared; source remains available; no auto-retry. |
| C | original Missing; trash Missing; claim Matches | `manual_review / source_claimed` | Claim preserved; no move or delete. |
| D | original Missing; trash Matches; claim Matches | `manual_review / source_cleanup_pending` | Claim preserved; source cleanup requires review. |
| E | original Matches; trash Missing; claim Matches | `manual_review / source_cleanup_pending` | Claim preserved; duplicate source claim is never deleted automatically. |
| F | original Missing; trash Missing; claim Missing | `manual_review / target_committed` with `target_committed_durability_unknown` | Claim boundary remains fail-closed; no retry. |
| G | mismatch, unreadable, or otherwise ambiguous state | `manual_review` with stable mismatch/unreadable/reconciliation code | Claim preserved; no broad cleanup or automatic retry. |

Every item-bound Safe Trash terminal outcome now goes through `finalize_cleanup_restore_outcome(item)`. Item and Batch updates share one SQLite transaction, child-state precedence is centralized, and both updates require exactly one affected row. Injected Batch failure rolls back the Item and Batch together.

## 5. Ordinary Restore index merge strategy

The finalizer resolves `target_row_id` from `path_before` and `source_row_id` from `path_after`, `target_path`, and legacy `source_path` candidates without `LIMIT 1` ambiguity. It supports:

- source row only: update the source row to the canonical target;
- target row only: validate target identity and retain the target row;
- one row serving both roles: update it atomically;
- distinct source and target rows: validate ownership and delete only the exact old source row, retaining the target row as canonical.

The finalizer rejects a reappeared `path_after` with `restore_source_path_reappeared`, preserves the claim and replacement index row, and never performs a broad path-based delete. Watcher/user metadata such as `suggested_action` and `requires_confirmation` is preserved. SQLite triggers leave exactly one valid FTS row after a successful merge.

## 6. Final identity revalidation

Immediately before operation journal/index finalization, the real target is revalidated using full content hash and size, plus platform file ID and volume when available. Symlink/reparse and unsupported entries are rejected. Cross-volume restores use full hash/size without incorrectly requiring the source volume's file ID on the destination volume. Failures are manual review in `target_committed`, with `can_restore=false`, `can_undo=false`, preserved claim, and no index/journal finalization.

Safe Trash restore similarly verifies full hash, size, quick hash, and available platform identity before and after movement. No restore path overwrites an existing target.

## 7. Mismatch / Unreadable separation and structured codes

Recovery business logic no longer parses human-readable messages. It uses `RecoveryErrorCode`, including:

- `claim_identity_mismatch` / `claim_identity_unreadable`;
- `target_committed_identity_mismatch` / `target_committed_identity_unreadable`;
- `restore_source_identity_mismatch` / `restore_source_identity_unreadable`;
- `restore_source_path_reappeared`;
- `target_committed_durability_unknown`;
- `target_committed_source_cleanup_pending` and `restore_pending_reconciliation`.

## 8. Local verification evidence

All commands below completed with exit code `0` on Windows:

- `npm run verify`: frontend typecheck, 67 Vitest files / 470 tests, remediation 1 file / 13 tests, SQLite/FTS performance benchmark, Tauri production build, Rust format/tests/clippy, npm audit, and RustSec audit.
- `npm run verify:rust`: 338 feature-enabled library tests passed; clippy passed with `-D warnings`.
- `npm run verify:security`: npm audit found 0 vulnerabilities; cargo-audit found 0 denied advisories and reported the existing 15 allowed unmaintained/unsound dependency warnings.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`: passed.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: passed.
- Targeted integration tests: `storage_analyzer` 63/63, `migrations` 5/5, `settings` 12/12, `dedupe` 5/5, and `classification_status` 1/1.
- `git diff --check`: passed.

## 9. Native Smoke evidence

The single Windows Native Smoke run passed. Its manifest reported:

- `operation_move_restore: passed`;
- `ordinary_restore: passed`;
- `safe_trash: passed`;
- `cross_volume_exercised: true`;
- `canary_unchanged: true`;
- `real_app_data_accessed: false`;
- `fixture_cleaned: true`;
- SQLite `integrity_check: ok`.

## 10. Remote CI and delivery boundary

PR #11 is open and ready, with base `master` and head `codex/final-hardening-v4-1-5`. Remote CI was still pending when this revision was written; the final Run ID and the `Quality (windows-latest)`, `Quality (macos-latest)`, and `Dependency audit` job results must be added here only after the final Head completes. No Linux job is expected or requested.

The local Windows build produced an NSIS artifact for verification only. No installer was uploaded or published. No tag, GitHub Release, signature, or automatic merge was created. Browser QA, install/upgrade/uninstall, SmartScreen, signing, real AI Provider, and manual macOS UI QA were not run in this pass.

## 11. Final acceptance checklist

The closeout is complete only when the final remote Head is green, the final local and remote SHA match, the worktree is clean, and PR #11 remains OPEN and unmerged. The release workflow remains untouched, version remains `0.1.40`, and no tag/release/publication is performed.
