# Zen Canvas Final Hardening v4.1.2 closeout

Branch: `codex/final-hardening-v4`
Base: `master`
Version: `0.1.40` (unchanged)
Delivery: PR #10 only; no merge, tag, release, installer publication, or
auto-merge

## Scope

This hardening pass is Windows/macOS-only. Ubuntu/Linux is intentionally out
of product, CI, build, release, and QA scope. `.github/workflows/release.yml`
was not changed.

## Recovery-state contract

Filesystem mutations now expose structured commit states and Safe Trash keeps
the state in the journal instead of inferring it from error text.

| Stable code | Persisted interpretation |
| --- | --- |
| `target_committed_durability_unknown` | target may have committed; manual review; do not retry automatically |
| `target_committed_identity_mismatch` | target committed but identity differs; manual review |
| `target_committed_source_cleanup_pending` | target committed; source cleanup remains pending |
| `target_committed_source_delete_failed` | target committed; source deletion failed; manual review |
| `claim_identity_mismatch` | the claimed object no longer matches; manual review |
| `restore_pending_reconciliation` | restore was interrupted and needs startup reconciliation |

Move and restore journals persist `prepared`, `source_claimed`,
`target_committed`, `source_cleanup_pending`, and `completed` at the mutation
boundaries. A post-commit error is never rewritten as `rolled_back` or
`failed`. Restore persists `restore_pending` before mutation and preserves
`source_claimed`, `target_committed`, or `source_cleanup_pending` during an
interruption. Startup reconciliation distinguishes absent, identity mismatch,
and unreadable paths before choosing success, rollback, pending cleanup, or
manual review.

The final operation success boundary is also durable: the completed callback
only reports filesystem completion. The operation remains pending until target
identity/path, undo/result/index synchronization, and the final operation log
transaction are durable. The deterministic
`after_completed_phase_before_final_log_persist` hook proves that a crash at
that boundary reconciles an already-committed target without a duplicate move
or rollback.

## Windows filesystem hardening

- Parent directories are opened and verified through retained handles; nested
  relative opens use `NtCreateFile` and `RootDirectory`.
- Reparse points, junctions, replacement parents, protected paths, Unicode,
  long paths, cross-volume staging, and cross-volume directory rejection are
  covered by tests and native smoke.
- Source claims use minimized read-only/restrictive handle rights. Namespace
  durability is provided by the retained verified parent handles; source
  handles are not granted unnecessary write-data or write-attributes rights.
- Duplicate directory-chain validation was removed.
- System Trash remains visible in preview but is not executable, with
  `blocking_reason=system_trash_source_binding_unsupported`; Safe Trash remains
  supported.

## UI and localization

Cleanup/recovery/AI/cancel/manual-review outcomes use stable error codes and
localized messages in Chinese and English. The UI never reports a committed
target as “rolled back” or “no change”, and manual-review history entries are
distinguished from ordinary failed or canceled work. Storage Cleanup uses
fine-grained Zustand selectors with shallow action selection.

## Verification evidence

All commands below were run on Windows. No Ubuntu/Linux command or job was
added or run.

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0; 67 files, 470 tests |
| `npm run test:remediation` | exit 0; 13/13 |
| `npm run test:performance` | exit 0; architecture/bounded behavior checks and 100,000-row SQLite FTS benchmark passed; query p95 2.004 ms, threshold 1,000 ms |
| `cargo fmt --all -- --check` | exit 0 |
| `cargo clippy --features desktop-runtime --all-targets -- -D warnings` | exit 0 |
| `cargo test --features desktop-runtime --lib -- --test-threads=1` | exit 0; 329/329 |
| `cargo test --features desktop-runtime --lib` | exit 0; 329/329 on final rerun |
| `cargo test --features desktop-runtime --jobs 1` | exit 0; 433 passed, 1 ignored |
| `cargo test --features desktop-runtime --test storage_analyzer` | exit 0; 55/55 |
| `cargo test --features "desktop-runtime native-qa" --test native_file_hardening_smoke -- --ignored --nocapture` | exit 0; 1/1 |
| `npm run security:audit` | exit 0; 0 vulnerabilities; `fast-uri` locked at 3.1.4 |
| `npm run security:audit:rust` | exit 0; 15 existing allowed warnings |
| `npm run build` | exit 0; Windows release binary and NSIS bundle generated |
| `git diff --check` | exit 0 |

The Windows native smoke manifest was written to:

`C:\Users\77588\AppData\Local\Temp\zen-canvas-native-qa-artifacts\native-file-hardening-smoke.json`

It passed all added scenarios: Safe Trash durability/identity/source-cleanup
post-commit recovery; restore source-claimed/target-committed/source-cleanup
recovery; final-log persistence boundary; claim identity reconciliation;
nested Unicode/long-path handle-relative mutation; cross-volume copy and
directory rejection; and system-trash non-executable preview. The manifest
reported `cross_volume_exercised=true`, SQLite `integrity_check=ok`, an
unchanged canary SHA-256 (`a3edcd1c6cd60262bc0d8016a598f8a7418ee856ca4adeb3b7ffbbab902c1e4e`),
`real_app_data_accessed=false`, and `fixture_cleaned=true`.

The local unsigned Windows installer is:

`F:\Coding\Zen-Canvas-final-hardening-v4\src-tauri\target\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe`

- Size: `5,644,531` bytes
- SHA-256: `170078CCBEB07F5EF02AB688961EFCAE60E1A94B3A3E3C7B4449881B0AD88A08`
- Authenticode: `NotSigned`
- Publication: none

Remote Windows/macOS CI for the final pushed head remains a post-push gate;
the PR is not considered merged or released by this document.
