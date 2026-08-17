# W1-08 — Thumbnail Infrastructure — Codex Implementation Brief

Status: active implementation task

Baseline: `master@bce4c0f5792ee9cb18b0475351de3303fa73639e` (W1-07 / PR #73 merged)

Branch: `feat/w1-08-thumbnail-infrastructure`

## Read first

- `AGENTS.md`
- `docs/project/DEVELOPMENT_WORKFLOW.md`
- `docs/project/initiatives/W1-file-library-foundation.md`
- `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
- `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
- `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
- `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
- `docs/project/specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md`
- `docs/project/tasks/W1-05-WORK-SCHEDULER-CODEX.md`
- `docs/project/tasks/W1-07-MATERIALIZATION-READ-GATE-CODEX.md`
- `src-tauri/src/scheduler.rs`
- `src-tauri/src/file_workspace/contracts.rs`
- `src-tauri/src/file_workspace/read_gate.rs`
- `src-tauri/src/platform/macos/quick_look.rs`
- `src-tauri/src/platform/macos/file_semantics.rs`

## Goal

Implement the W1-08 **Thumbnail Infrastructure** foundation: a shared, headless, bounded ThumbnailService with variants, lifecycle/cancellation, scheduler/backpressure integration, cache identity rules and renderer/provider adapters.

This Track is infrastructure only. It must be usable later by List, Grid, Inspector, Preview placeholder and Folder Preview, but it must not build those UI surfaces or W1-10 Tauri/frontend wiring.

## Dependencies already merged and binding

W1-08 depends on and MUST reuse:

- W1-04 Location Core;
- W1-05 WorkScheduler;
- W1-07 Materialization / Read Gate;
- W1-09 Ephemeral Change / Refresh where current-generation/session invalidation semantics are relevant.

Do not recreate any of these authorities locally inside Thumbnail.

## Existing authorities / assets that MUST be reused

### 1. Shared W1 identity/source contracts

Use the existing `EntryRef`, `PreviewSourceRef`, `WorkClass`, content-read eligibility and opaque read-lease contracts from `src-tauri/src/file_workspace/`.

Thumbnail requests originating from Zen workspace state must be authorized by an opaque backend reference such as `EntryRef`, not by renderer-supplied raw filesystem paths.

Ephemeral Browse/session refs are process/session scoped. Never persist them or treat them as durable content identity.

### 2. W1-05 WorkScheduler

`src-tauri/src/scheduler.rs` already owns global resource admission/backpressure through `WorkRequest`, `ResourceHints`, `CancellationToken`, RAII `ResourceLease`, priority/fairness and bounded queueing.

Thumbnail must acquire scheduler capacity for expensive work instead of spawning an unbounded independent executor.

Native Quick Look generation must consume an appropriate bounded native-preview/helper slot and applicable IO/open-handle/CPU resources. Exact hints may be chosen from the current scheduler API, but they must be explicit and covered by tests.

Visible thumbnail work should normally map to `WorkClass::Interactive`; non-visible/prefetch/maintenance work may be `Background`. Do not hard-code UI policy into the renderer — the request/service boundary should carry the work class/priority.

### 3. W1-07 Materialization / Read Gate

`src-tauri/src/file_workspace/read_gate.rs` already defines the authoritative W1 facade including `ReadIntent::Thumbnail`, source-version revalidation, bounded opaque leases and `ContentReadLeaseConsumer` behavior.

Every thumbnail renderer/provider that reads source bytes MUST cross this boundary. A prior eligibility check is not authorization for later generation.

Thumbnail must never silently hydrate/download File Provider, OneDrive or other provider placeholders. `MaterializationRequired`, downloading, unavailable, permission, symlink/reparse, package-unsupported, unknown and stale/identity-changed states fail closed according to the existing gate.

Do not copy W1-07's eligibility rules into Thumbnail and do not call platform/provider APIs to invent a parallel read policy.

### 4. Existing macOS native thumbnail service

`src-tauri/src/platform/macos/quick_look.rs` already contains `MacThumbnailService` and its native Quick Look adapter. Preserve and adapt it; do not replace it with a second Quick Look implementation.

Existing assets to preserve include, as applicable:

- bounded cache/staging limits;
- cancellation;
- helper timeout;
- source identity validation;
- safe cache/staging permissions;
- stale pending cleanup;
- safe `qlmanage` invocation and output handling.

The current service predates W1-07 and accepts a backend path. W1-08 must add the **narrowest safe adapter seam** needed so original source bytes are authorized/read through W1-07 before native generation. Do not simply call `MacThumbnailService::request(original_path, ...)` from the new shared service and claim the W1-07 dependency is satisfied.

If the native helper requires a path, a backend-private task-owned staging file may be created only from a valid W1-07 thumbnail read lease using bounded reads, with a strict total-byte cap, preserved safe filename/extension where required by Quick Look, and deterministic cleanup on success/failure/cancel/timeout. The staging path remains backend-private and must never become renderer authority.

If a small adapter on `MacThumbnailService` that accepts already-gated staged input or an equivalent backend-only source is cleaner, prefer that over duplicating its generation engine. Preserve its native safety behavior. If satisfying this boundary appears to require a broad redesign of W1-07 or `file_semantics`, STOP and report the architecture conflict rather than bypassing the gate.

## Required implementation boundary

Prefer a focused module such as:

`src-tauri/src/file_workspace/thumbnail.rs`

and a minimal module export from `src-tauri/src/file_workspace/mod.rs`.

Exact organization may differ if repository conventions clearly support a smaller placement. Avoid broad edits to `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`, frontend stores/API registries or shared Tauri command registration; W1-10 owns that integration surface.

## Shared ThumbnailService contract

Implement a backend/headless service abstraction with at least the following concepts. Names may follow repository style; behavior is binding.

### 1. Request

A request must identify at least:

- opaque source / `EntryRef` (or a backend-derived `PreviewSourceRef`);
- thumbnail variant;
- request ID;
- `WorkClass` / priority;
- optional session ownership needed for cancellation/publication rights.

Do not accept an arbitrary renderer-provided filesystem path as authorization.

### 2. Variants

Foundation variants are:

- small;
- medium;
- large.

Map variants to physical pixel dimensions in one backend/platform policy location. Do not scatter Retina/scaling numbers through callers. Keep the mapping bounded; no arbitrary huge dimensions.

### 3. Result / errors

Expose an internal result that can distinguish at least:

- ready cache artifact;
- unsupported renderer/source;
- materialization required;
- source unavailable;
- permission denied;
- identity/source version changed;
- scheduler backpressure/unavailable;
- cancelled;
- timeout;
- renderer/provider failure.

A backend cache path may exist internally, but do not design a renderer-authorized raw-path API in this Track. W1-10 will own serialization/wiring.

### 4. Renderer/provider adapter

Keep renderer identity explicit and stable (for example renderer/provider ID + renderer version). Cache identity must include renderer identity/version so implementation changes cannot silently reuse incompatible output.

The macOS adapter must reuse `MacThumbnailService`.

On platforms where no safe native renderer already exists, keep the shared service fully compilable/testable and return an explicit unsupported/fallback condition rather than inventing Windows shell/provider semantics in this Track. Do not add a Windows Preview Handler/Explorer integration here. A narrowly reusable existing safe renderer may be adapted only if it stays inside this brief and the W1-07 gate.

## Cache model — mandatory

Implement bounded cache behavior with two identity classes:

### Session / memory cache

Ephemeral/session-only sources may use a bounded process/session memory cache keyed by current session/source generation + source version + variant + renderer ID/version.

It must be bounded and disposed/invalidate cleanly. Session refs must never be persisted.

### Durable disk cache

Persistent cross-session cache reuse is allowed only when the backend can produce a stable, verified source/content identity suitable for that cache lifetime.

Logical durable key must include:

- stable backend-verified source/content identity;
- source version/content revision;
- variant;
- renderer/provider ID;
- renderer version.

**Path is a resolution input, not the logical cache identity.** Do not use user-visible path, `BrowsePathRef`, ephemeral `EntryRef`, Browse session ID, request ID or `LocationRef` as persistent identity.

Rename/move reuse is allowed only when the stable verified identity remains valid. If durable identity cannot be proven, fall back to session/memory cache rather than guessing.

The existing `MacThumbnailService` cache currently predates this W1 logical identity contract. Adapt its cache-key seam narrowly so W1-08 persistent reuse does not depend on the original source path. Preserve its bounded eviction, permissions and cleanup behavior rather than replacing the cache subsystem wholesale.

Never add a database table merely to persist thumbnail identity. A schema migration/new durable authority is a STOP condition.

## Pipeline and lifecycle

Implement the service so the conceptual flow is:

```text
request
 -> validate request/session/source ref
 -> resolve current source + source version through existing W1 boundaries
 -> classify cache identity (durable vs session-only)
 -> memory cache lookup
 -> eligible durable disk cache lookup
 -> acquire bounded WorkScheduler resources
 -> acquire/revalidate W1-07 ReadIntent::Thumbnail access
 -> bounded renderer/native generation
 -> revalidate cancellation + source version + publication ownership
 -> publish into the eligible cache tier
 -> return ready result
```

A cache miss must not imply unbounded synchronous work. The shared service must support bounded asynchronous/disposable work suitable for later shell-first UI integration.

### Deduplication

Concurrent requests for the same logical generation key should be coalesced/deduplicated rather than launching duplicate expensive native work.

Cancellation is owner-aware: cancelling one waiter must revoke that waiter's publication rights; shared underlying work may continue only while another live owner still needs it. When no live owner remains, expensive work should be cancelled where the underlying renderer supports cancellation.

Do not let dedupe state grow without bound.

### Staleness / publication rule

Before caching or returning generated output, confirm that:

- request/session still owns publication rights;
- cancellation has not fired;
- source version/identity is still current.

If the source changed/replaced during generation, discard the output and return an identity/stale result. Never poison the cache with output from a stale source.

W1-09 invalidation/generation semantics may be consumed where already available, but do not rewrite the watcher or Browse authority in this Track.

## Resource / disk hygiene

All task-owned staging and cache writes must be bounded and deterministic.

- Use safe worktree-local ignored roots for tests (for example `.tmp-tests/`) according to repository policy.
- Do not leave source copies, `.pending-*` directories or partial cache files after success/failure/cancel/timeout.
- Do not use `%TEMP%` / `std::env::temp_dir()` for task-owned Windows fixtures when repository policy requires same-worktree/local-disk roots.
- Cache/staging directories must reject unsafe symlink/reparse substitution according to existing platform safety conventions.
- Partial output must be committed atomically or otherwise never appear as a valid cache hit.
- Repeated runs must return scheduler/native/open-handle and temporary-file counts to steady state.

## Required deterministic tests

Add focused tests for the applicable boundaries, including at minimum:

1. small/medium/large variant mapping is bounded and stable;
2. request rejects malformed/empty opaque IDs and never treats raw renderer paths as authority;
3. visible/interactive thumbnail work is admitted through WorkScheduler with explicit bounded resources;
4. scheduler queue/backpressure/cancellation errors map conservatively;
5. concurrent identical requests deduplicate expensive generation;
6. cancelling a waiter prevents its result publication;
7. cancelling the final owner cancels/abandons underlying work and releases scheduler capacity;
8. source identity/version change during generation rejects output and does not populate cache;
9. materialization-required/downloading/unavailable/permission/unknown source never causes implicit byte access/hydration;
10. byte-reading generation demonstrably uses W1-07 `ReadIntent::Thumbnail` / read-consumer seam rather than opening the original source independently;
11. ephemeral session refs cannot create persistent disk cache identity;
12. stable verified durable identity + same source version + variant + renderer version can hit durable cache;
13. source-version change misses/rejects old durable cache;
14. rename/move does not invalidate a cache solely because a path string changed when verified durable identity remains the same;
15. renderer version change causes cache miss;
16. cache remains bounded by entry/byte limits and eviction leaves valid files only;
17. native/staging temporary artifacts are cleaned on success, failure, cancellation and timeout;
18. macOS adapter preserves `MacThumbnailService` cancellation/timeout/native safety seams;
19. non-macOS build/test behavior is explicit and does not claim a native renderer that is not implemented;
20. repeated request/cancel cycles return scheduler/resource counters and internal request/dedupe registries to steady state.

Prefer injected/fake renderer, fake scheduler pressure and deterministic cancellation hooks over flaky sleep-heavy tests. Real `qlmanage` smoke evidence is useful on macOS but must not replace deterministic unit/adapter tests.

Where real iCloud/File Provider/OneDrive fixtures are unavailable, report `NOT VERIFIED — fixture unavailable`; absence of the fixture is not a pass.

## Protected authorities / files

Do not rewrite or bypass:

- File Library Query V2 / `LibrarySelectionV1`;
- Global Index;
- managed watcher/reconciliation;
- W1-03 Browse session/ref authority;
- W1-04 Location authority;
- W1-05 WorkScheduler lifecycle/resource ownership;
- W1-07 Materialization / Read Gate;
- `src-tauri/src/platform/macos/file_semantics.rs` byte-open authority except for a separately demonstrated correctness defect;
- PR #63 provider/materialization/physical-identity semantics;
- filesystem mutation/recovery;
- Operation Preview / journal / Safe Trash / Restore;
- database schema/migrations.

Minimize edits to shared hotspots. Any change to a protected authority must be justified as a narrow adapter seam and called out explicitly in the PR report.

## Explicit non-goals

Do NOT implement:

- Grid/List/Inspector thumbnail UI;
- File Library 2.0 visual redesign;
- W1-10 Tauri command/frontend API/store wiring;
- rich Preview providers;
- Finder Quick Look extension;
- Windows Explorer Preview Handler / Space integration;
- automatic cloud/provider download;
- smart hydration policy;
- new Query authority / Query V3;
- managed watcher rewrite;
- filesystem mutation/recovery changes;
- new durable scheduler/read/cache job database;
- third-party plugin SDK;
- OCR/AI/RAG/content understanding.

## Stop / escalate conditions

STOP and report before widening scope if the implementation appears to require:

- a schema migration or new durable authority;
- bypassing or broad redesign of W1-07 to feed a renderer;
- a second content eligibility/materialization engine;
- weakening PR #63 provider identity/materialization rules;
- renderer-facing raw filesystem path authorization;
- broad rewrite of `MacThumbnailService` instead of a narrow adaptation;
- broad new Windows platform-safety/native-preview subsystem;
- filesystem mutation/recovery changes;
- CI performance-threshold changes.

## Validation before reporting completion

Run all applicable checks for the exact branch head, including:

- focused W1-08 Rust tests;
- existing W1-05 scheduler tests affected by integration;
- existing W1-07 read-gate tests affected by integration;
- existing macOS Quick Look/native/file-semantics tests affected by the adapter;
- full Rust test suite under repository-standard feature set;
- `cargo fmt --check`;
- repository-standard Clippy with `-D warnings`;
- release compile/check for applicable CI targets;
- frontend/typecheck only if TypeScript was actually touched;
- governance/docs validation where routing requires it;
- `git diff --check`;
- exact-head remote CI.

Before closeout, inspect and remove task-owned local test/staging residue. Do not delete shared dependency/build caches merely to satisfy cleanup.

## Completion report

Push implementation only to `feat/w1-08-thumbnail-infrastructure` and keep its PR Draft.

Report:

- exact head SHA;
- changed files;
- final ThumbnailService request/result/provider shape;
- exact W1-05 scheduler resources acquired by thumbnail work;
- exact W1-07 seam proving all original-source byte reads are gated;
- how `MacThumbnailService` was preserved/adapted;
- durable vs session cache identity design and why no ephemeral ref/path is persisted;
- dedupe/cancellation/publication lifecycle;
- focused/full test results;
- exact-head CI run;
- macOS native smoke result if available;
- skipped/unverified real-provider/platform fixtures;
- task-owned temp/cache cleanup status and any exact residual paths;
- confirmation that W1-10/W2/UI/native system integration and other later Tracks were not entered.

Do not merge and do not mark Ready. Wait for independent architecture/code review.