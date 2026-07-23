# Zen Canvas Final Hardening v4.1.5.1 — Cross-volume Restore & CI Acceleration Closeout

## 1. Scope and provenance

- Starting `origin/master` SHA: `5188a9caeb422311254041cf044ff38b966f18d1`.
- Working branch: `codex/final-hardening-v4-1-5`.
- Prior v4.1.4 product commit: `885f0bccf85e4981eb18c0a0fa8aa1973119a8b0`.
- Application/package version remains `0.1.40`.
- Platform scope is Windows-first with the repository's macOS CI regression coverage. Ubuntu/Linux is explicitly out of scope for this hardening pass; no Ubuntu/Linux runner or validation was added.
- Implementation head before this closeout documentation commit: `9c8b56074e547925747dc8f94161297357ab0e7f`.

## 2. Commit list

1. `a413dc0` — `fix(recovery): finalize safe trash reconciliation states`
2. `5a9d030` — `fix(index): reconcile restore watcher index races`
3. `c1e09b6` — `test(recovery): cover restore identity and batch consistency`
4. `7231eaf` — `fix(recovery): harden cross-volume restore identity`
5. `7616493` — `fix(index): preserve source metadata during restore merge`
6. `fb838e4` — `ci: cache Rust builds and isolate audit packaging`
7. `9c8b560` — `ci: use rust cache target input`
8. Closeout documentation commit — this record, immediately following the implementation head above.

## 3. Modified files and responsibilities

- `src-tauri/src/recovery.rs`: typed recovery error codes and stable message formatting.
- `src-tauri/src/storage_analyzer.rs`: Safe Trash reconciliation, separate source/target/claim identity matchers, cross-volume content-identity rules, old-phase A-state recovery, unified Item+Batch finalization, exact affected-row checks, and fail-closed outcome handling.
- `src-tauri/src/file_ops.rs`: three-state volume relation (`SameVolume`, `CrossVolume`, `Unknown`), ordinary-restore identity fallback, watcher race handling, claim preservation, path reappearance guard, platform identity capture, and final-boundary revalidation.
- `src-tauri/src/db/queries/files.rs`: ordinary-restore source/target row resolution, source-canonical merge, exact watcher-row deletion, metadata preservation, FTS-safe transaction, and final journal/index atomicity.
- `src-tauri/src/db/queries/operations.rs`: operation journal volume identity persistence and exact restore-log updates.
- `src-tauri/src/db/schema.rs`: schema v24 migration for source/target/claim volume identity fields.
- `src-tauri/src/db/tests/*` and `src-tauri/tests/*`: restore matrix, migration, transaction rollback, cross-volume identity, matcher separation, and Native Smoke coverage.
- `.github/workflows/ci.yml`: immutable Rust/Cargo cache configuration using `Swatinem/rust-cache@c19371144df3bb44fab255c43d04cbc2ab54d1c4` (`v2.9.1`), valid `cache-targets: true`, audit separation, and PR-safe NSIS gating. The matrix remains Windows/macOS only.
- No frontend behavior, `.github/workflows/release.yml`, tag, release, signing, or publishing workflow was changed.

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
- distinct source and target rows: make the source row the canonical current row, delete only the exact watcher target row by ID, then update the source row with filesystem fields while preserving business/user/classification metadata.

The finalizer rejects a reappeared `path_after` with `restore_source_path_reappeared`, preserves the claim and replacement index row, and never performs a broad path-based delete. Watcher/user metadata such as `suggested_action` and `requires_confirmation` is preserved. SQLite triggers leave exactly one valid FTS row after a successful merge.

## 6. Final identity revalidation

Ordinary Restore uses a three-state volume relation:

- `SameVolume`: both platform volume IDs are known and equal, so a file ID may participate in identity validation;
- `CrossVolume`: both IDs are known and different, so the source file ID is never required to match the destination file ID;
- `Unknown`: one or both IDs are unavailable, so validation falls back to content identity.

Immediately before operation journal/index finalization, the real target is revalidated using full content hash and size, plus destination-side platform identity when valid for the volume relation. Symlink/reparse and unsupported entries are rejected. Failures are manual review in `target_committed`, with `can_restore=false`, `can_undo=false`, preserved claim, and no index/journal finalization.

Safe Trash restore validates the Trash source before movement and the restored original target after movement. Size and object type are always checked; full hash is required; quick hash is checked when it was recorded. The Trash File ID is compared only when Trash and restored target are known to be on the same volume. Cross-volume and unknown-volume restores use content identity without incorrectly comparing source and destination file IDs. No restore path overwrites an existing target.

## 7. Mismatch / Unreadable separation and structured codes

Recovery business logic no longer parses human-readable messages. It uses `RecoveryErrorCode`, including:

- `claim_identity_mismatch` / `claim_identity_unreadable`;
- `target_committed_identity_mismatch` / `target_committed_identity_unreadable`;
- `restore_source_identity_mismatch` / `restore_source_identity_unreadable`;
- `restore_source_path_reappeared`;
- `target_committed_durability_unknown`;
- `target_committed_source_cleanup_pending` and `restore_pending_reconciliation`.

Identity mismatch, unreadable identity, claim uncertainty, and source reappearance remain distinct manual-review outcomes. They preserve claims where applicable, perform no automatic retry, and perform no automatic delete or broad cleanup.

## 8. Local verification evidence

The following current-pass commands completed with exit code `0` on Windows:

- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`.
- `cargo check --manifest-path src-tauri/Cargo.toml --features desktop-runtime --lib`.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings`.
- `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --lib -- --test-threads=1`: 342 passed, 0 failed.
- Targeted Safe Trash identity tests: 16 passed, 0 failed.
- Targeted `db::tests::ordinary_restore` tests: 5 passed, 0 failed, including source/target merge, reappeared source/claim preservation, matrix, and rollback coverage.
- `git diff --check`.

The earlier v4.1.5 frontend baseline recorded `npm run verify` with 67 Vitest files / 470 tests, remediation tests, production build, and security checks. The current v4.1.5.1 frontend typecheck/tests and dependency audits are additionally covered by remote Run `29997418619` below; the full frontend verify command was not claimed as rerun locally in this pass.

## 9. Native Smoke evidence

The Windows Native Smoke command below passed cleanly after the restore-identity and reconciliation fixes:

```text
cargo test --manifest-path src-tauri/Cargo.toml --features "desktop-runtime native-qa" --test native_file_hardening_smoke -- --ignored --nocapture --test-threads=1
```

Its manifest reported:

- `schema: zen-canvas-native-file-hardening-smoke/v2`;
- `operation_move_restore: passed`;
- `ordinary_restore: passed`;
- `safe_trash: passed`;
- `cross_volume_exercised: true`;
- `canary_unchanged: true`;
- `real_app_data_accessed: false`;
- `fixture_cleaned: true`;
- SQLite `integrity_check: ok`.

## 10. Remote CI and delivery boundary

PR #11 is open, ready, based on `master`, and remains unmerged. The remote evidence is:

- Historical Run `29989223077` on head `44aa66e...`: Dependency audit and macOS Quality succeeded; Windows Quality was cancelled during Rust tests. It was not a never-triggered run.
- Superseded validation Run `29995870677` on head `fb838e4...`: all three jobs succeeded, but the cache action emitted the invalid-input warning for `cache-target`; this was corrected in `9c8b560` to the valid `cache-targets` input.
- Final implementation validation Run `29997418619` on head `9c8b560...`: Dependency audit, `Quality (windows-latest)`, and `Quality (macos-latest)` all succeeded. Windows Rust tests, clippy, 100k search, and Native Smoke passed; macOS path/temp regression passed. PR-only NSIS packaging was skipped by design because production packaging remains gated to `push` on `master`.
- The final run emitted only the existing GitHub Actions Node 20 deprecation annotation for pinned checkout/setup-node actions; no invalid cache-input warning remained.

No Linux job was added or run. The local Windows build/NSIS path is release-gated and was not run as a publication step in this PR. No installer was uploaded or published. No tag, GitHub Release, signature, automatic merge, force push, rebase, or amend was created. Browser QA, install/upgrade/uninstall, SmartScreen, signing, real AI Provider, and manual macOS UI QA remain outside this pass.

## 11. Final acceptance checklist

The closeout is complete only when the documentation commit is pushed, its remote CI is green, the final local and remote SHA match, the worktree is clean, and PR #11 remains OPEN and unmerged. The release workflow remains untouched, version remains `0.1.40`, and no tag/release/publication is performed.
