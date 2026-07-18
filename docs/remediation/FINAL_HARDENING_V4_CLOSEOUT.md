# Final Hardening v4 closeout

Branch: `codex/final-hardening-v4`
Base: `master`
Release: none; installer signing and publication are outside this task.

The implementation is intentionally fail-closed. A row without the complete
identity required by its operation is marked `manual_review` or
`legacy_unverified`; it is not silently upgraded.

## Remediation matrix

| ID | Problem | Implementation | Behavioral test/evidence | Windows | macOS | Linux | Conclusion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 | Atomic no-overwrite | `fs_safety::atomic_move` uses platform exclusive rename and copy-commit for cross-volume moves | Existing-target and cancellation tests; copy/identity tests | Local pass | CI required | CI required | Implemented; local gate complete; cross-platform gate pending |
| I-01 | Parent creation race | `fs_safety::path_guard` uses `openat`/`mkdirat` with no-follow checks on Unix and reparse checks on Windows | Directory-chain and symlink-component tests | Local pass | CI required | CI required | Implemented; local gate complete; cross-platform gate pending |
| I-02 | Journal identity binding | Operation and Safe Trash execution re-capture source/target identity and require full hashes | Replacement, restore, full-hash, and migration tests | Local pass | CI required | CI required | Implemented; local gate complete; cross-platform gate pending |
| I-03 | Watcher event loss | Per-path retry queue with generation invalidation, bounded backoff, and permanent-failure reporting | `fsWatcher.test.ts` real queue/hook tests | Local pass | CI required | CI required | Implemented; final platform gates pending |
| I-04 | Background cancel race | Generation token invalidates stale completion and preserves active state on cancel RPC failure | `backgroundIndexerRuntime.test.ts` | Local pass | CI required | CI required | Implemented; final platform gates pending |
| I-05 | Cleanup cancel truthfulness | UI waits for authoritative terminal status; RPC failure and timeout retain truthful running state | `storageCleanupStore.test.ts` | Local pass | CI required | CI required | Implemented; final platform gates pending |
| I-06 | Settings load race | Load gate, load/write epochs, serialized save queue, one CAS rebase, and fail-closed second conflict | Unit and happy-dom runtime tests | Local pass | CI required | CI required | Implemented; final platform gates pending |
| I-07 | Tauri command ACL | Build manifest enumerates commands; main/search capabilities are separated; mutating commands require main window | Command manifest/capability contract tests and desktop-runtime check | Local pass | CI required | CI required | Implemented; final platform gates pending |
| I-08 | Credential transaction race | Global transaction mutex covers credential read/write/readback/database persistence/rollback | Concurrent credential-store test | Local pass | CI required | CI required | Implemented; final platform gates pending |
| I-09 | Platform path identity | Central path identity keeps Windows case-insensitive and Unix/macOS case-sensitive semantics | Rust and frontend platform tests | Local pass | CI required | CI required | Implemented; final platform gates pending |
| M-01 | Redirect policy | OpenAI-compatible client disables redirects and rejects 3xx without forwarding credentials | Local redirect listener test | Local pass | CI required | CI required | Implemented; final platform gates pending |
| M-02 | Full hash semantics | Sample/full naming, deterministic directory manifest, full-hash copy verification, and legacy migration flags | Identity and schema migration tests | Local pass | CI required | CI required | Implemented; local gate complete; cross-platform gate pending |
| M-03 | i18n errors | Stable safety/error codes map through the active locale; new store/provider surfaces avoid mixed-language messages | `stableErrors.test.ts` plus store tests | Local pass | CI required | CI required | Implemented; final platform gates pending |
| M-04 | Module responsibility | Atomic primitive, path guard, identity, watcher queue, settings controller, and window authorization are isolated | Typecheck, Rust build, contract tests | Local pass | CI required | CI required | Implemented; final platform gates pending |
| M-05 | Complete verify | `verify:frontend`, `verify:rust`, `verify:security`, and aggregate `verify` scripts are defined | `npm run verify` exit 0; evidence log | Local pass | CI required | CI required | Implemented; local evidence complete |
| M-06 | Linux CI | Ubuntu quality path installs Tauri dependencies and runs frontend, Rust, clippy, build, and audits | Workflow review; remote run required | Existing gate retained | Existing gate retained | New gate | Implemented; remote run required |

“Implemented” in this matrix means code and a relevant deterministic test are
present. It does not claim cross-platform completion until the final commit is
covered by Windows, macOS, Linux, and dependency-audit CI.

## Schema and legacy data

- Current schema: `21`.
- Schema 21 adds `source_full_hash`, `target_full_hash`,
  `cleanup_trash_items.source_full_hash`, and
  `cleanup_trash_items.trash_full_hash`.
- Schema 20/21 migration tests cover invalid historical rule domains, complete
  identity columns, legacy `manual_review`/`legacy_unverified` status, and
  idempotent reopen.
- The migration rollback test drops a required table and verifies that the
  transaction returns to schema 16 with legacy data intact.

## Desktop evidence

The isolated Windows fixture QA pass is recorded in
`FINAL_HARDENING_V4_TEST_EVIDENCE.md`. It verified custom-root scanning,
settings persistence, preview-only organize suggestions, cleanup caution
boundaries, and the standalone Spotlight search window. The search capability
ACL regression found during QA was fixed without widening search permissions.
The automated suites cover the destructive-path contracts, including
no-overwrite moves, restore conflicts, Safe Trash identity checks,
cancellation, watcher retry, credential transactions, and restart journals.

## Remaining gates

The closeout is not a release claim. The local command log and isolated desktop
QA evidence are complete. The final status becomes cross-platform complete
only after the final head has remote Windows/macOS/Linux/dependency-audit
results recorded in `FINAL_HARDENING_V4_TEST_EVIDENCE.md`.
