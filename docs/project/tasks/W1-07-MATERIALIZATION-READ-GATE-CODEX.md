# W1-07 — Materialization / Read Gate — Codex implementation brief

## Baseline

Start from and remain scoped to:

`master@b6a2608f84c40c9609ad9ec014bb6196fbfb559c`

This is the F2-complete baseline after W1-02 through W1-06 merged.

Read first:

- `AGENTS.md`
- `docs/project/DEVELOPMENT_WORKFLOW.md`
- `docs/project/initiatives/W1-file-library-foundation.md`
- `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
- `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
- `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
- `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
- `docs/project/specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md`

## Purpose

Implement the W1-07 **Materialization / Read Gate** as a bounded facade/adaptor over Zen Canvas's existing authoritative content-read/open semantics.

This Track must make byte-reading consumers use an opaque, revalidated read boundary without creating a second eligibility engine, a second source identity, or an implicit cloud download path.

W1-07 is infrastructure only. It does not implement rich Preview providers, Thumbnail generation, File Library 2.0 UI, Finder/Explorer integration, or broad Tauri/frontend wiring.

## Existing authorities that MUST be reused

### Shared W1 contracts

`src-tauri/src/file_workspace/contracts.rs` already defines:

- `ContentReadEligibility`
- `ContentReadLeaseRef`
- `PreviewSourceRef`

Do not create competing public enums/opaque-ref formats for the same concepts unless a narrowly scoped internal implementation type is required.

### Preview injection point

`src-tauri/src/file_workspace/preview.rs` already defines:

- `BoundedContentReadRequest`
- `BoundedContentRead`
- `ContentReadAccessError`
- `ContentReadLeaseConsumer`
- `PreviewProviderEnvironmentHandle::with_content_read(...)`

W1-07 must provide the real authoritative implementation/adaptor for that existing interface. Do not change providers to receive raw filesystem paths, URLs, file descriptors, or provider identities.

### macOS byte-open authority

`src-tauri/src/platform/macos/file_semantics.rs` is already the single production macOS byte-read gate.

In particular:

- `content_read_eligibility(path)` classifies whether a source may be read without implicit materialization;
- `open_content_read(path)` re-checks eligibility at the actual open boundary, uses no-follow/close-on-exec semantics, validates the opened object identity, and revalidates File Provider coordinated URL/physical identity where applicable;
- `BoundaryReadable`-style evidence is only bounded evidence; the later byte consumer still reopens/revalidates independently.

W1-07 MUST adapt this authority. It MUST NOT copy its rules into a new parallel macOS eligibility engine.

### PR #63 semantics that remain binding

- File Provider/user-visible paths are routing hints, not provider item/domain identity.
- Provider identity must not be fabricated from path/POSIX metadata.
- Materialization is explicit and consent-bound.
- Passive Browse, Preview setup, indexing, thumbnails, metadata enrichment, and background work must not silently download cloud/provider content.
- A prior eligibility decision, operation proof, or `BoundaryReadable` proof is not durable authorization for a later read.
- Actual byte consumers re-resolve/revalidate at their own open/read boundary.
- Unknown/provider/offline states fail closed.

## Required implementation boundary

Prefer a dedicated module such as:

`src-tauri/src/file_workspace/read_gate.rs`

The exact file organization may differ if repository conventions clearly support a better minimal placement, but do not put this implementation into Query V2, watcher, or filesystem mutation modules.

The implementation should provide these responsibilities without making them new durable authorities:

### 1. Read intent / policy

Represent the reason bytes are requested. The W0 contract recognizes at least:

- Preview
- Thumbnail
- ContentAnalysis
- Hashing

Metadata-only inspection is not a byte-read intent and must not acquire a byte lease merely to inspect source state.

The exact Rust type can be internal if no cross-process wire need exists yet. Do not add frontend/Tauri serialization solely for W1-07.

### 2. Backend-only source resolution boundary

A caller may request read eligibility/access using an opaque `PreviewSourceRef` / `EntryRef`-derived source.

Resolution may produce a backend-private resolved source containing a filesystem path or native handle needed by the authoritative opener. That resolved path/handle MUST remain backend-private and MUST NOT be serialized to renderer/provider-facing contracts.

For source kinds that are not yet safely resolvable in this Track, fail closed rather than inventing identity or widening scope.

Do not persist ephemeral Browse refs across sessions. Do not convert display paths into authority.

### 3. Descriptive eligibility projection

Expose/project the existing authoritative result into the shared `ContentReadEligibility` contract.

This projection is descriptive. It is not a lease and it does not permit a later byte operation to skip revalidation.

On macOS map existing `MacContentReadEligibility` semantics conservatively into shared `ContentReadEligibility`. Preserve distinctions relevant to explicit materialization/permission/unavailable/unsupported/symlink/package/unknown behavior.

Do not change `file_semantics::content_read_eligibility()` merely to make the projection easier unless an actual correctness defect is independently demonstrated and escalated.

### 4. Opaque lease issuance

Issue a bounded, opaque `ContentReadLeaseRef` only after source resolution/policy allows the request.

A lease must be tied to at least:

- a backend-owned lease ID;
- the request ID;
- a source version / source identity proof sufficient to reject stale/replaced sources;
- the intended source;
- a bounded lifetime / ownership lifecycle.

The public lease MUST contain no raw path.

Lease storage must be bounded. No unbounded global map, no durable DB table, no generic job queue.

Provide deterministic invalidation/release/dispose semantics. Expired/released/stale leases must fail closed.

### 5. Bounded read consumer

Implement the existing `ContentReadLeaseConsumer` interface.

For every `read_bounded(...)` call:

- validate lease existence/lifecycle;
- validate request/source-version binding;
- honor cancellation/context state;
- enforce a bounded request size and safe offset arithmetic;
- reopen/revalidate through the authoritative source-open boundary rather than trusting a previous eligibility result;
- return at most the requested bounded bytes;
- classify permission/unavailable/stale/cancel/timeout/failure conservatively;
- never expose the backend path to the provider.

Do not interpret `ContentReadLeaseRef` as a cached open file descriptor that can survive arbitrary source replacement without revalidation.

### 6. Explicit materialization boundary

W1-07 must represent `MaterializationRequired` / equivalent as a policy result, not automatically download the source.

If an explicit materialization request API already exists and can be safely adapted without widening this Track, expose only the boundary needed for a future explicit user action. Otherwise keep materialization request execution deferred and report it honestly.

No Preview/Thumbnail/background call in W1-07 may automatically trigger materialization.

### 7. Preview integration seam only

Prove that the real read-gate implementation can be injected through `PreviewProviderEnvironmentHandle::with_content_read(...)` / `ContentReadLeaseConsumer`.

Do not implement a production Preview command, rich provider, React host, or Tauri registration here. W1-10 owns broad integration.

## Windows boundary

Windows 11 x64 is first-class, but this repository currently does not have a symmetric `platform/windows/` read-semantic module matching macOS.

Do NOT pretend that a generic path means OneDrive/Cloud Files content is local. Do NOT invent unsupported Windows cloud-provider identity/materialization semantics in W1-07.

For ordinary local files, reuse an existing repository-safe open/revalidation path if one exists. If the repository lacks an authoritative Windows cloud/reparse-point read policy required for a source, fail closed and report the exact unverified/unsupported boundary rather than silently reading a placeholder.

Any proposal to create a broad new Windows platform safety subsystem is a scope escalation and must stop for review.

## Required negative/security tests

Add focused tests covering the applicable implementation boundaries, including at least:

1. opaque lease contains no filesystem path;
2. unknown/released/expired lease is rejected;
3. request ID mismatch is rejected;
4. source version / identity replacement is rejected;
5. oversized bounded read is rejected or safely capped according to the explicit contract;
6. offset overflow is rejected;
7. cancellation prevents publication/read completion where applicable;
8. symlink/non-regular/unsupported source fails closed;
9. materialization-required/metadata-only/downloading source does not cause implicit byte access;
10. provider/read error maps to a conservative `ContentReadAccessError`;
11. multiple bounded reads do not convert the lease into durable source authority;
12. lease registry/resource state remains bounded and explicit release/dispose frees ownership.

On macOS, preserve existing native semantics tests and add focused adaptor tests rather than replacing them.

Where a real iCloud/File Provider/OneDrive fixture is unavailable, report `NOT VERIFIED — fixture unavailable`; do not convert absence into a pass.

## Test artifact / disk hygiene — mandatory

Follow the merged repository rule exactly.

- Local fixtures/staging/cache created by this task must use ignored worktree-local roots such as `.tmp-tests/`.
- On Windows, when the worktree is on `F:`/`D:` or another non-system drive, do not default task-owned fixture/staging data to `%TEMP%`, `%TMP%`, `std::env::temp_dir()`, or hard-coded `C:` paths.
- Every task-owned temporary path must have deterministic cleanup.
- Before closeout, inspect and remove task-owned test residue and report the cleanup result.
- If OS locks/security policy prevent cleanup, report the exact residual path as unresolved; do not claim full completion.
- Never delete shared dependency/build caches merely to satisfy cleanup.

## Protected authorities / files

Do not rewrite or bypass:

- File Library Query V2 / `LibrarySelectionV1`;
- Global Index;
- managed watcher/reconciliation;
- `src-tauri/src/platform/macos/file_semantics.rs` byte-open authority except for a separately demonstrated correctness fix;
- PR #63 File Provider/materialization/physical-identity semantics;
- filesystem mutation/recovery paths;
- Operation Preview / journals / Safe Trash / Restore;
- WorkScheduler lifecycle ownership;
- Browse's session/ref authority;
- schema/migrations.

Minimize edits to shared hotspots such as `src-tauri/src/lib.rs`; do not add Tauri command registration in this Track.

## Explicit non-goals

Do not implement:

- W1-08 Thumbnail infrastructure;
- W1-09 watcher/change refresh;
- W1-10 integration surface;
- rich Markdown/JSON/CSV/ZIP/Folder Preview providers;
- Preview UI;
- Finder Quick Look extension;
- Windows Explorer Preview integration;
- automatic cloud download;
- user-configurable smart hydration policies;
- Query V3;
- new durable read/lease/job database;
- third-party provider/plugin SDK.

## Stop / escalate conditions

Stop this Track and report rather than expanding scope if implementation appears to require:

- a schema migration or new durable authority;
- a second content eligibility engine;
- weakening PR #63 materialization/provider identity rules;
- changing filesystem mutation/recovery contracts;
- a broad Windows platform-safety subsystem;
- CI performance-threshold changes;
- renderer-authorized raw filesystem paths.

## Validation before reporting completion

Run all applicable checks for the exact head, including:

- focused W1-07 Rust tests;
- existing macOS file-semantics/read-gate tests affected by the adapter;
- full Rust tests under the repository's standard feature set;
- `cargo fmt --check`;
- repository-standard Clippy with `-D warnings`;
- release compile for applicable CI targets;
- frontend/typecheck only if TypeScript was actually touched;
- governance/docs validation where routing requires it;
- `git diff --check`;
- exact-head remote CI.

Before closing the task, verify task-owned local temporary files are cleaned.

## Completion report

Push only to `feat/w1-07-materialization-read-gate` and keep its PR Draft.

Report:

- exact head SHA;
- changed files;
- authority reused for source resolution/open on each platform;
- lease lifecycle/backpressure design;
- focused/full test results;
- exact-head CI run;
- skipped/unverified real-provider fixtures;
- local temp-artifact cleanup status and any exact residual paths;
- confirmation that W1-08/W1-10 and other later Tracks were not entered.

Do not merge or mark Ready. Wait for independent architecture/code review.