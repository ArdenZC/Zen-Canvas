# W1-01 — Contract Spine — Codex Implementation Brief

Status: active implementation task

Baseline: `master@3f6f8a72cbca78812ee257431bfa89a8e357f30f` (W1-00 PR #65 merge)

Branch: `feat/w1-01-file-workspace-contract-spine`

Canonical architecture inputs:

- `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
- `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
- `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
- `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
- `docs/project/specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md`
- `docs/project/initiatives/W1-file-library-foundation.md`

## Goal

Finish the smallest shared wire-contract spine required before W1 parallel Tracks begin.

This PR is contract-only. It must not implement Browse behavior, WorkspaceSession behavior, scheduling, Preview providers/UI, materialization/download behavior, thumbnail generation, watcher changes or new Tauri commands.

## Existing seed

The branch already contains:

- `src-tauri/src/file_workspace/mod.rs`
- `src-tauri/src/file_workspace/contracts.rs`

Treat these as a seed, not as unquestionable final code. Review them against the merged W0 specs and fix inconsistencies before adding more code.

Known seed defect: `NavigationTarget::Library` currently uses the Rust field name `pub_source`; the wire field must be `source` and the TypeScript mirror must match exactly.

## Required implementation

1. **Rust module integration**
   - expose `file_workspace` from `src-tauri/src/lib.rs`;
   - keep `file_workspace` a pure contract module with no database, Tauri command, filesystem or platform behavior;
   - keep it separate from existing filesystem-safety identity types and Query V2 DB types.

2. **Contract set**
   Implement/finalize only the W1-01 shared types needed by later Tracks:
   - `EntryRef`;
   - `LocationRef`;
   - `BrowsePathRef`;
   - `LibraryNavigationSource` + `NavigationTarget`;
   - `BrowseEnumerationRef` (session/request/enumeration generation identity);
   - non-authoritative `WorkspaceRestoreLocator` / platform discriminator;
   - `LocationKind`, `LocationAvailability`, `LocationFreshness`;
   - entry/source-scoped `MaterializationState`;
   - `ContentReadEligibility` as a projection/facade over the existing authoritative read/open boundary, not a new eligibility engine;
   - `WorkClass`;
   - `PreviewSourceRef`, `PreviewHostKind`;
   - opaque `ContentReadLeaseRef` that contains no filesystem path;
   - `LocationCapabilities`.

   Do not add runtime methods that resolve paths, open bytes, query the database, materialize providers or perform mutations.

3. **TypeScript mirror**
   - add `src/types/fileWorkspace.ts`;
   - mirror the public serialized Rust shapes exactly;
   - do not add these types into the large existing `src/types/domain.ts` unless a tiny re-export is proven necessary; prefer the dedicated module;
   - use discriminated unions and snake_case enum string values matching serde output;
   - do not expose raw authoritative filesystem paths in `EntryRef`, `LocationRef`, `BrowsePathRef`, `PreviewSourceRef` or `ContentReadLeaseRef`.

4. **Serialization/shape tests**
   Rust tests must lock the public JSON shapes, including at minimum:
   - managed and ephemeral `EntryRef`;
   - managed and ephemeral `LocationRef`;
   - Library and Browse `NavigationTarget`, including the exact `source` field name;
   - `BrowseEnumerationRef`;
   - `WorkspaceRestoreLocator` proving it does not serialize prior-process session/path/entry refs;
   - distinct `MaterializationState` vs `ContentReadEligibility` values;
   - `ContentReadLeaseRef` proving no `path` is serialized;
   - representative Preview source/host shapes;
   - strict rejection of unknown fields where the contract is intended to be strict.

   Add a focused frontend contract test (for example `tests/fileWorkspaceContracts.test.ts`) with representative objects typed using `satisfies` so TypeScript field names/discriminants remain aligned with the Rust wire contract. Keep the test deterministic and free of Tauri/browser mocks.

5. **Naming and authority rules**
   - do **not** create a generic `FileIdentity` type: existing `ExpectedFileIdentity` / namespace/content verification identities remain filesystem-safety evidence;
   - managed entry identity reuses existing `fileId`;
   - managed location identity reuses existing `scanRootId`;
   - ephemeral refs are session-scoped and non-durable;
   - restore locator is persistent routing metadata only and must be re-resolved/revalidated by later work;
   - `MaterializationState` is file/entry/source scoped, never a Location-level truth;
   - `ContentReadEligibility` does not authorize a read by itself; later byte consumers must use the existing read/open authority and source revalidation;
   - `ContentReadLeaseRef` is opaque and session/request/source-version bound.

## Protected authorities / do not modify

Do not rewrite or bypass:

- File Library Query V2 or `LibrarySelectionV1`;
- Global Index;
- managed watcher/reconciliation;
- `ExpectedFileIdentity` / filesystem-safety identity and backend revalidation;
- existing `content::eligibility` / platform read-open authority;
- PR #63 provider/materialization semantics;
- Operation Preview, journals, Safe Trash or Restore;
- database schema or migrations.

## Explicit non-goals

Do not implement:

- W1-02 WorkspaceSession/history behavior;
- W1-03 Ephemeral Browse enumeration;
- W1-04 Location adapters;
- W1-05 WorkScheduler runtime;
- W1-06 PreviewSession/provider registry runtime;
- W1-07 Materialization/Read Gate runtime;
- W1-08 Thumbnail service;
- W1-09 watcher/invalidation behavior;
- Tauri commands or frontend stores;
- polished Library/Browse UI;
- rich Preview providers;
- Finder/Explorer native integration;
- Query V3, schema/dependency changes, AI/OCR/RAG/plugins.

## Validation

Run and report at least:

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` (or format then verify clean);
- focused Rust tests for `file_workspace` contracts;
- `cargo test --manifest-path src-tauri/Cargo.toml` if feasible in the environment;
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` if the repository's normal environment supports it;
- focused frontend contract test;
- `npm test -- --run` / repository-equivalent focused test command as appropriate;
- `npm run test:governance`;
- `git diff --check`.

If a platform/toolchain limitation prevents a command, report it explicitly; do not convert skipped validation into a pass claim.

## Definition of Done

W1-01 is done only when:

- Rust and TypeScript public contract shapes are explicit and aligned;
- serialization tests lock the wire format;
- no raw path authority leaks into opaque workspace/preview refs;
- no new durable authority, database state, runtime behavior or platform behavior is introduced;
- existing Query V2/read/mutation/watcher authorities remain untouched;
- all available focused validation is green;
- PR diff stays bounded to Contract Spine files/tests/docs plus the minimal `lib.rs` module export.

Stop and request architecture review if implementation appears to require schema changes, a new durable authority, a new byte-read eligibility engine, Query V3, watcher rewrite, or any W1-02+ runtime behavior.
