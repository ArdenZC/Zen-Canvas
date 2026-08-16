# W1-09 — Ephemeral Change / Refresh — Codex implementation brief

## Baseline

Start from and remain scoped to:

`master@b6a2608f84c40c9609ad9ec014bb6196fbfb559c`

This is the F2-complete baseline after W1-02 through W1-06 merged.

Read first:

- `AGENTS.md`
- `docs/project/DEVELOPMENT_WORKFLOW.md`
- `docs/project/initiatives/W1-file-library-foundation.md`
- `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
- `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
- `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
- `docs/project/specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md`
- `src-tauri/src/file_workspace/browse/mod.rs`
- `src-tauri/src/file_workspace/location.rs`
- `src-tauri/src/watcher.rs`

## Purpose

Implement W1-09 **Ephemeral Change / Refresh** for Browse Mode.

The Track adds a session-scoped filesystem change-hint layer that can invalidate the currently viewed ephemeral Browse directory, revoke stale enumeration/page/cursor publication rights, and support bounded re-enumeration by the later integration layer.

It must also preserve/reuse the existing managed watcher/reconciliation facts already projected through Location Core. It must NOT create a second managed watcher authority or write ephemeral Browse events into managed Library truth.

This Track is infrastructure only. It does not implement the polished W2 Browse UI or broad Tauri/frontend integration.

## Existing authorities that MUST be reused

### Ephemeral Browse authority

`src-tauri/src/file_workspace/browse/mod.rs` already owns:

- session-scoped `BrowseService`;
- `BrowseEnumerationRef` identity;
- progressive pages/cursors bound to session/request/enumeration;
- `validate_page(...)` stale-publication checks;
- `invalidate(session_id)` which cancels/removes the active enumeration and invalidates its entry refs;
- explicit page/path-ref release and session disposal;
- bounded entry/path/session temporary state.

W1-09 must use these semantics rather than add a competing Browse generation/ref registry.

A filesystem change hint invalidates knowledge. It is not authoritative proof that an individual row should be inserted/deleted in the UI.

### Managed watcher/reconciliation authority

`src-tauri/src/watcher.rs` already owns the managed watcher pipeline, including bounded queue/batch/coalescing, watcher revisions, overflow/retry/reconciliation behavior, managed DB mutation and managed watcher lifecycle.

Do NOT rewrite, share-mutate, or replace `FileWatcherManager` for Ephemeral Browse.

### Managed Location freshness projection

`src-tauri/src/file_workspace/location.rs` already projects `ScanRootDto` watcher/reconciliation facts into `LocationFreshness`.

In particular, revision gaps, active reconciliation/scan, `needs_reconciliation`, watcher recovery requirements and relevant health states already yield `Reconciling`/`Stale`/`Current` conservatively.

W1-09 should reuse/test this projection. Do not build another `ManagedFreshness` authority.

## Required architecture

Prefer a dedicated ephemeral module such as:

- `src-tauri/src/file_workspace/change.rs`, or
- `src-tauri/src/file_workspace/browse/change.rs`

Choose the smallest placement consistent with existing module visibility. Do not place Ephemeral Browse watcher behavior into `src-tauri/src/watcher.rs` merely to reuse code.

The ephemeral monitor is disposable session infrastructure, not durable authority.

## Required responsibilities

### 1. Session-scoped change monitor

Provide an ephemeral watcher/monitor bound to a current Browse session/path target.

It must:

- own only its own watch registration/thread/channel resources;
- be explicitly cancellable/disposable;
- never outlive its owning Browse/session lifecycle;
- watch only the bounded current target required by v1 (normally the current directory, non-recursive unless a narrower existing contract requires otherwise);
- avoid turning an arbitrary unmanaged volume into a recursive index/search watcher;
- avoid any managed DB/scan-root mutation.

Use the existing `notify` dependency if appropriate. Do not introduce a new dependency without an explicit need and review.

### 2. Domain-level change hints

Translate raw platform/`notify` events into a small, platform-neutral ephemeral hint model. The exact type may be crate-internal in W1-09.

At minimum distinguish enough to express:

- content changed / refresh needed;
- rename/move affecting the current directory;
- current target unavailable/removed where reliably detectable;
- watcher overflow/error / state uncertain.

Do not expose raw `notify::EventKind`, Win32/FSEvents-specific codes, or raw filesystem paths as frontend authority.

Paths may exist inside backend-private watcher state only to determine whether the current target is affected.

### 3. Invalidation before refresh

A relevant hint MUST invalidate the current Browse enumeration through `BrowseService` before any refreshed page is allowed to publish.

Required invariant:

`change hint -> invalidate current enumeration -> old page/cursor loses publication rights -> later bounded re-enumeration creates a new enumeration identity`

Do not mutate an already-published page array from watcher events as if events were complete truth.

W1-09 may provide an explicit refresh request/result seam for W1-10, but broad Tauri/store integration remains out of scope.

### 4. Burst/coalescing/backpressure

Filesystem events can arrive in bursts. The ephemeral change layer must be bounded and coalesced/debounced enough that 1,000 file changes do not cause 1,000 synchronous UI/publication refresh cycles.

Requirements:

- bounded queue/state;
- deduplicate/coalesce multiple hints into a bounded refresh-needed state where possible;
- overflow or uncertainty must degrade to `refresh/re-enumerate current directory`, not false completeness;
- cancellation/dispose must stop further publication;
- no unbounded thread-per-event or task-per-event design.

Exact constants should be evidence-based and local to this ephemeral infrastructure; do not change managed watcher thresholds merely for consistency.

### 5. Stale publication rejection

Tests must prove that when a change arrives during or after a page read:

- the prior enumeration is invalidated;
- its existing cursor is rejected;
- a page that attempts to publish after invalidation is rejected as stale;
- a subsequent enumeration receives a new `enumeration_id`;
- old `EntryRef`/un-pinned path refs from the invalidated enumeration do not silently remain authoritative.

Do not bypass the existing Browse ref-release/capacity rules added in W1-03.

### 6. Bounded refresh seam

W1-09 should expose enough backend behavior for W1-10 to request/restart a bounded enumeration after an invalidation.

Do not create a second enumerator. Refresh must call back into `BrowseService::start_enumeration` / existing Browse semantics (or a minimal wrapper around them).

The change monitor itself does not need to automatically fetch/render pages if doing so would mix watcher lifetime with presentation/API ownership.

### 7. Managed Location freshness — reuse only

Add focused regression tests if needed to prove that existing managed watcher/reconciliation facts continue to map correctly through `project_managed_scan_root(...)`.

Expected examples:

- watcher revision gap -> `Reconciling`;
- `needs_reconciliation` -> `Reconciling`;
- recovery-required -> `Reconciling`;
- healthy/applied/no-active-run -> `Current`;
- missing/permission/degraded -> availability/freshness remain independent and fail closed.

Do NOT alter watcher revisions or reconciliation state from the ephemeral monitor.

## Strong isolation rules

An Ephemeral Browse change hint MUST NEVER by itself:

- create/admit a scan root;
- write/update managed file rows;
- advance managed watcher revisions;
- trigger dedupe/content analysis/findings;
- schedule a managed reconciliation job;
- change Query V2 snapshot truth;
- mutate files;
- persist ephemeral session/path/entry identity across processes.

If a path is both visible in Browse and independently belongs to a managed scan root, the two authorities still remain separate: managed watcher truth is handled by the existing managed pipeline; the ephemeral session may independently invalidate/re-enumerate its current view.

## Required tests

Add focused deterministic tests covering at least:

1. create/change hint invalidates current enumeration;
2. delete/rename hint invalidates current enumeration;
3. burst of many events coalesces to bounded refresh work/state;
4. overflow/watcher error produces uncertain/refresh-needed behavior rather than false row-level truth;
5. old cursor is rejected after invalidation;
6. old delayed page cannot publish after invalidation;
7. refreshed enumeration has a new enumeration ID;
8. cancel/dispose stops later ephemeral hint publication;
9. monitor resources/threads/channels are deterministically released;
10. no managed DB/scan-root/watcher-revision side effect occurs;
11. managed LocationFreshness projection continues to use existing `ScanRootDto` watcher facts;
12. unavailable/removed current target is handled without crash or mass deletion semantics.

Do not write timing-fragile tests that depend only on arbitrary `sleep` values if a deterministic synchronization hook/channel can be used.

Real external/network/provider fixture absence must be reported as unverified, not passed.

## Test artifact / disk hygiene — mandatory

Follow the merged repository rule exactly.

- Test directories/files must live under an ignored worktree-local root such as `.tmp-tests/ephemeral-change/`.
- On Windows, when the worktree is on `F:`/`D:` or another non-system drive, do not use `%TEMP%`, `%TMP%`, `std::env::temp_dir()`, or hard-coded `C:` for task-owned fixtures/staging.
- Use unique bounded subdirectories per test/run.
- Implement deterministic cleanup; Drop guards are appropriate where reliable.
- Before task closeout, remove and inspect task-owned residue.
- If a lock/security policy blocks deletion, report the exact remaining path as unresolved.
- Do not delete shared Cargo/npm/build caches.

## Protected hotspots / authority boundaries

Do NOT broadly modify:

- `src-tauri/src/watcher.rs` managed watcher implementation;
- managed watcher queue/retry/coalescing thresholds;
- scanner reconciliation lifecycle/persistence;
- Query V2 / `LibrarySelectionV1`;
- filesystem mutation/recovery contracts;
- schema/migrations;
- W1-07 read/materialization gate;
- W1-08 Thumbnail;
- Preview provider/runtime code;
- `src-tauri/src/lib.rs` Tauri command registration.

A tiny extraction of a pure helper from managed watcher code is allowed only if it has no lifecycle/authority behavior and clearly reduces duplication; default preference is no managed watcher change.

## Explicit non-goals

Do not implement:

- W1-07 Materialization / Read Gate;
- W1-08 Thumbnail infrastructure;
- W1-10 frontend/Tauri integration;
- W2 Browse visual UI;
- recursive unmanaged filesystem/global search;
- durable watcher state for ephemeral directories;
- Finder/Explorer integration;
- cloud hydration;
- new database tables;
- managed watcher rewrite.

## Stop / escalate conditions

Stop and report rather than expanding scope if the Track appears to require:

- schema or durable state;
- changes to managed watcher correctness/thresholds/lifecycle;
- a second Browse enumeration/ref authority;
- recursive watch/index of arbitrary unmanaged locations;
- filesystem mutation authority;
- CI performance-threshold changes.

## Validation before reporting completion

Run all applicable exact-head checks, including:

- focused W1-09 tests;
- W1-03 Browse tests;
- W1-04 Location tests affected by freshness projections;
- existing managed watcher tests if any shared/pure code was touched;
- full Rust tests under standard repository features;
- `cargo fmt --check`;
- repository-standard Clippy with `-D warnings`;
- release compile for applicable CI targets;
- governance/docs validation if routing requires it;
- `git diff --check`;
- exact-head remote CI.

Before closeout, verify task-owned local temporary artifacts are cleaned.

## Completion report

Push only to `feat/w1-09-ephemeral-change-refresh` and keep its PR Draft.

Report:

- exact head SHA;
- changed files;
- watcher/session lifetime design;
- event coalescing/backpressure design;
- how Browse invalidation/enumeration rotation is enforced;
- focused/full test results;
- exact-head CI run;
- unverified real external/network/provider fixtures;
- local temp-artifact cleanup status and exact residue if any;
- confirmation that managed watcher authority and W1-07/W1-08/W1-10 were not entered.

Do not merge or mark Ready. Wait for independent architecture/code review.