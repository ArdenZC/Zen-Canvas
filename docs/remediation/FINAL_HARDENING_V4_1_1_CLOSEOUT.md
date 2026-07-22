# Zen Canvas Final Hardening v4.1.1 closeout

Branch: `codex/final-hardening-v4`
Base: `master`
Version: `0.1.40` (unchanged)
Delivery: existing PR #10 only; no merge, tag, release, installer publication,
or auto-merge

## Platform capability decision

Windows and macOS remain the supported desktop platforms. Ubuntu/Linux is not
in product, CI, build, release, or QA scope.

The official macOS rename interface accepts a source directory descriptor and
source name. It cannot prove that the final mutation applies to the already
opened source object after a hostile name replacement. Therefore v4.1.1 keeps
macOS read/analysis capabilities available and fails closed for every mutation
entry with `macos_file_mutation_source_binding_unsupported`. Frontend mutation
buttons are disabled and the API client rejects before sending a Tauri execute
command; backend entry points independently enforce the same boundary.

Primary API evidence:

- Apple XNU declares `renameat`, `renamex_np`, and `renameatx_np` in
  [`bsd/sys/stdio.h`](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/bsd/sys/stdio.h).
- Apple's implementation and manual define `renameatx_np` as source dirfd plus
  source name, not source file descriptor:
  [`libsyscall/wrappers/renamex.c`](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/libsyscall/wrappers/renamex.c) and
  [`rename(2)`](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/bsd/man/man2/rename.2).
- Microsoft documents relative native opens through
  [`NtCreateFile` and `OBJECT_ATTRIBUTES.RootDirectory`](https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntcreatefile),
  and relative rename through
  [`FILE_RENAME_INFORMATION.RootDirectory`](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_file_rename_information).

## Windows object binding

- Source claims retain an open source handle from identity verification through
  final commit or cleanup.
- Native `NtSetInformationFile(FileRenameInformation)` receives the verified
  target directory handle in `RootDirectory` and only a relative target name.
- Cross-volume staging is created with `NtCreateFile` relative to that same
  verified target directory handle.
- A `StagingFile` owns the parent handle, relative name, path, file handle,
  verified identity, and commit state. Copy, hashing, sync, final rename, and
  post-commit identity checks reuse that one handle without reopening by path.
- A staging-path replacement is detected as `staging_identity_changed`; the
  replacement object is never committed or deleted by Zen Canvas.
- System Recycle Bin mutation is path-only and therefore fails closed as
  `system_trash_source_binding_unsupported`; Windows Safe Trash remains active.

## Commit-state and recovery model

Operation logs and cleanup items persist phase changes through the production
database update paths: `prepared`, `source_claimed`, `target_committed`,
`source_cleanup_pending`, and `completed`. Restore persists each item as it
finishes instead of waiting for the full batch.

Errors after target commit are never represented as rollback:

| Stable code | Persisted interpretation |
| --- | --- |
| `target_committed_durability_unknown` | target exists; manual durability review |
| `target_committed_identity_mismatch` | target exists; manual identity review |
| `target_committed_source_cleanup_pending` | target exists; source claim cleanup pending |

Restart reconciliation compares source paths with source identity and committed
targets with target identity. This distinction is required for cross-volume
moves because the committed target has a different platform file ID.

## Native filesystem smoke

The ignored, feature-gated integration harness is
`src-tauri/tests/native_file_hardening_smoke.rs`. It uses isolated UUID paths,
an isolated SQLite database and app-data directory, production operation,
Safe Trash, restore, and reconciliation functions, plus an untouched canary.
It never uses the real Zen Canvas database or application data and does not use
mouse automation or `GetCursorPos`.

Run it with:

```text
cargo test --manifest-path src-tauri/Cargo.toml --features "desktop-runtime native-qa" --test native_file_hardening_smoke -- --ignored --nocapture --test-threads=1
```

The harness writes
`%TEMP%\zen-canvas-native-qa-artifacts\native-file-hardening-smoke.json`, emits
the same manifest as one-line JSON, and removes its fixture directories. The
Windows CI quality job runs this exact command. The manifest records whether a
second writable volume was available and whether cross-volume execution was
exercised.

## Verification evidence

Local verification was completed on Windows using the supported-platform
matrix. Ubuntu/Linux commands were intentionally not run because Linux is not a
supported product or CI platform for this task.

| Command | Result |
| --- | --- |
| `npm ci` | exit 0; 307 packages installed; 0 vulnerabilities |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0; 67 files, 470 tests |
| `npm run test:remediation` | exit 0; 13 tests |
| `npm run test:performance` | exit 0; 9 behavior tests; 100,000-row FTS search p95 1.473 ms |
| `npm run security:audit` | exit 0; 0 vulnerabilities |
| `npm run security:audit:rust` | exit 0; 0 vulnerabilities; 15 pre-existing allowed warnings |
| `npm run build` | exit 0; production application and local NSIS bundle built |
| `npm run verify` | exit 0; frontend, Rust desktop-runtime, build, and security aggregate passed |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | exit 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml --jobs 1` | exit 0; 431 passed, 1 ignored |
| `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --jobs 1` | exit 0; 432 passed, 1 ignored |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | exit 0 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings` | exit 0 |
| `cargo build --release --manifest-path src-tauri/Cargo.toml --features desktop-runtime --jobs 1` | exit 0 |
| Native filesystem hardening smoke command above | exit 0; 1 passed |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --features "desktop-runtime native-qa" -- -D warnings` | exit 0 |
| `git diff --check` | exit 0 |

The final Native Smoke used a process-unique fixture rooted at
`%TEMP%\zen-canvas-final-hardening-v411-<uuid>` and a second writable volume.
It passed persisted Move/Restore, Rename, target conflict, source replacement,
target-parent replacement, handle-bound cross-volume staging, cross-volume
directory rejection, injected post-commit durability failure, Operation and
Safe Trash restart reconciliation, and Safe Trash restore. SQLite
`integrity_check` returned `ok`; the canary SHA-256 was identical before and
after; `real_app_data_accessed` was `false`; and `fixture_cleaned` was `true`.
The machine-readable manifest is written outside the repository at
`%TEMP%\zen-canvas-native-qa-artifacts\native-file-hardening-smoke.json`.

Graphical in-app UI QA remains blocked by the host's `GetCursorPos` runtime
limitation. This does not replace or invalidate the completed native filesystem
smoke; it is retained as an explicit UI-only evidence limitation.

The final branch SHA and final Head CI run/job links are recorded in the PR body
and Final Verification comment after push. They are intentionally not committed
back into this document, because doing so would create a new unverified Head.
