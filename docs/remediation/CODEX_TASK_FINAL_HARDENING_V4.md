# Zen Canvas Final Hardening v4

## Scope and baseline

This remediation is based on `origin/master` at `2846daa10fcc6e61f0f61e0a38820bd234d38352`, on branch
`codex/final-hardening-v4`. The work preserves the UI v4 page structure, visual system, keyboard behavior,
accessibility semantics, Preview/final-confirmation/Safe Trash/History/Restore boundaries, and fail-closed
behavior. It does not change the product version or enter a new product stage.

## Current problem list and root causes

| ID | Current problem | Root cause |
| --- | --- | --- |
| C-01 | No-overwrite is check-then-act and cross-volume fallback is not an atomic commit | `file_ops.rs` and `storage_analyzer.rs` each implement `exists`/`rename`/copy logic independently |
| I-01 | Target parent creation can follow a replaced link | full untrusted paths are passed to `create_dir_all` after only nearest-ancestor validation |
| I-02 | Journal identity is recorded but is not the exact identity consumed by execution | the persistence and execution layers recalculate or reduce identity independently |
| I-03 | Failed watcher RPC batches can disappear | event draining has no durable pending/processing/retry state |
| I-04 | A cancelled background scan can publish stale completion | lifecycle is represented by transient booleans and does not invalidate generation/job identity |
| I-05 | Cleanup cancel state can claim cancellation before authoritative confirmation | cancel RPC success and backend terminal state are conflated |
| I-06 | Delayed settings load/save can overwrite newer optimistic state | load and save do not share an epoch and CAS retry does not rebase a partial intent |
| I-07 | Search-window command exposure is broader than its read-only role | invoke registration, manifest, and capability policy are not generated from one complete command inventory |
| I-08 | AI credential changes can interleave across credential store and SQLite | only part of the persistence flow is serialized |
| I-09 | Path/root identity is normalized too uniformly across platforms | lowercasing and lexical normalization are used where filesystem identity is authoritative |
| M-01 | Redirects can be followed without an explicit same-origin policy | the HTTP client relies on the default redirect behavior |
| M-02 | High-risk identity is described as quick hash | sampled hashes are used where complete BLAKE3 identity is required |
| M-03 | User-facing errors mix hard-coded languages and unstable text | backend strings are used directly instead of stable error codes plus i18n |
| M-04 | Safety responsibilities are duplicated across large modules | atomic move, identity, directory guards, queue state, and authorization have no focused ownership |
| M-05 | `verify` does not cover every requested frontend, Rust, security, and audit gate | package scripts and CI omit parts of the final hardening contract |
| M-06 | Linux quality coverage is incomplete | the CI workflow does not run the full Tauri Linux dependency/build/audit gate |

## Planned modules and modifications

* `src-tauri/src/fs_safety/`: one atomic no-replace primitive, path-chain guard, identity model, and copy-commit implementation.
* `file_ops.rs` and `storage_analyzer.rs`: thin adapters that pass the authoritative expected identity and use the shared primitive for Move, Rename, Restore, Safe Trash, and staging commits.
* `db/schema.rs` and query/types modules: additive identity columns and journal status fields with transactional migrations and legacy-unverified mapping.
* `watcher.rs`/frontend watcher queue: explicit pending, processing, retry-wait, and permanently-failed states with merge rules and disposal-safe callbacks.
* background indexer, cleanup store, settings controller, command authorization, and AI settings: generation/job/epoch/lock based lifecycle control.
* platform path identity and HTTP provider modules: filesystem-aware comparison and explicit redirect policy.
* `build.rs`, command registry/capabilities, `package.json`, CI, regression tests, and closeout evidence documents.

Public APIs will change only where the expected identity, stable error code, generation, or test hook must cross a
layer boundary. UI behavior and safety confirmation boundaries remain unchanged.

## Migration strategy

Schema changes are additive and transactional. The latest schema will add full-hash fields and any required journal
state fields without deleting legacy columns. Existing quick-hash values remain readable as `sample_hash` for
compatibility but are mapped to `legacy_unverified` for high-risk recovery until a new complete identity is captured.
Tests will cover empty databases, current schema, every supported historical fixture including 16-to-latest and
20-to-latest, duplicate migration, rollback, and identity-less legacy rows.

## Test strategy

Behavior tests will exercise real temporary fixtures or deterministic injected filesystem/credential/network
backends. Fixtures are process-unique and never use personal directories or real API keys. Coverage includes
no-replace races, copy-commit verification/cancellation/failure states, symlink/junction/reparse rejection,
journal replacement between persistence and commit, recovery state classification, watcher retries and merging,
stale async completions, cancellation truthfulness, settings delayed-load/CAS rebase, command authorization,
credential transaction interleavings, redirect isolation, complete-hash semantics, and platform path identity.
Source-contract tests may supplement behavior tests but cannot be the only evidence for a security conclusion.

## Platform differences

Windows uses a Win32 exclusive move/handle identity path with long-path support and rejects reparse points.
Linux uses `renameat2(..., RENAME_NOREPLACE)` and fails closed when it cannot prove that primitive is available.
macOS uses `renamex_np(..., RENAME_EXCL)` and fails closed when exclusive rename is unavailable. Cross-device
operations enter copy-commit only on an explicit cross-device error. Other platforms return
`UnsupportedAtomicNoReplace`.

Path comparison preserves case on case-sensitive filesystems and uses canonical path plus volume/file identity
when an existing directory can be opened. Nonexistent paths retain their spelling and are never globally lowercased.

## Completion standard

The implementation is complete only when all in-scope behavior tests, typecheck, frontend tests, remediation and
performance tests, Rust format/tests/Clippy, desktop-runtime tests/build, npm and Rust audits, production build,
`git diff --check`, Windows desktop QA, and Windows/macOS/Linux/Dependency Audit CI checks pass for the final head.
Every closeout row must cite its behavior test and platform evidence; unproven platform claims remain fail-closed.
The final branch is pushed without amend/rebase/force-push and a PR is opened against `master` for human review.

## Explicitly out of scope

* UI v4 redesign, visual copy changes, new product stages, or unrelated feature work.
* Product version bumps, tags, releases, signing, notarization, SmartScreen work, or public publication.
* Permanent deletion, automatic cleanup, bypassing Preview/final confirmation/Safe Trash/Restore, or AI-authorized file movement.
* Scanning personal directories, using real user data, real providers, or real API keys.
* Relaxing RustSec, Clippy, audit, CI, or accessibility gates; deleting existing safety tests; or using allow/skip/threshold changes to obtain a green result.
