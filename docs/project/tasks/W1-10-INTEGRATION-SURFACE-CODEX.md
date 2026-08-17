# W1-10 — Integration Surface — Codex Implementation Brief

Status: implementation taskbook

Baseline: `master@172e09dff51f1e9fe5367d5e886d263848c4031c` (W1-08 merge)

Branch: `feat/w1-10-integration-surface`

This Track is the **central W1 Foundation integration surface**. It connects the already-merged W1-02..09 contracts/services to bounded Tauri/frontend adapters. It must **not** invent a new product layer or pull W2/W3/W4 feature scope forward.

## 0. Required read set — before changing production code

Read completely:

1. `AGENTS.md`
2. `docs/project/README.md`
3. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
4. `docs/project/DEVELOPMENT_WORKFLOW.md`
5. `docs/project/CODE_MAINTAINABILITY.md`
6. `docs/project/initiatives/W1-file-library-foundation.md`
7. `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
8. `docs/project/specs/file-library-preview/01-PRODUCT-IA.md`
9. `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
10. `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
11. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
12. `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
13. `docs/project/specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md`

Then inspect current implementations before designing the bridge:

- `src/fileWorkspace/workspaceSession.ts`
- `src/types/fileWorkspace.ts`
- `src/api/core.ts`
- `src/api/libraryApi.ts`
- `src/api/browserMockApi.ts`
- `src-tauri/src/file_workspace/mod.rs`
- `src-tauri/src/file_workspace/contracts.rs`
- `src-tauri/src/file_workspace/browse/mod.rs`
- `src-tauri/src/file_workspace/location.rs`
- `src-tauri/src/file_workspace/change.rs`
- `src-tauri/src/file_workspace/preview.rs`
- `src-tauri/src/file_workspace/read_gate.rs`
- `src-tauri/src/file_workspace/thumbnail/`
- `src-tauri/src/scheduler.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/window_auth.rs`
- existing File Library Query V2 store/API and watcher/content-read/mutation authorities touched by any proposed adapter.

Do not infer old behavior from the taskbook where current `master` says otherwise.

## 1. Objective

Provide the smallest coherent production integration layer required for W1 Foundation so W2/W3 can consume stable workspace services later without reaching directly into private Rust internals.

The target shape is:

```text
frontend headless Workspace integration
        |
        | typed File Workspace API / events
        v
bounded Tauri command surface
        |
        v
process-local File Workspace integration owners
        |
        +--> W1-03 BrowseService
        +--> W1-04 Location projections
        +--> W1-05 WorkScheduler (existing authority)
        +--> W1-06 Preview lifecycle contracts
        +--> W1-07 MaterializationReadGate
        +--> W1-08 ThumbnailService
        `--> W1-09 EphemeralChangeMonitor
```

W1-10 is **wiring and projection**, not another source of truth.

## 2. Preflight facts that must be preserved

The repository already contains intentional W1-10 seams:

- `WorkspaceContentSourceResolver` in W1-07 is explicitly the wiring adapter for the existing managed Library + Ephemeral Browse authorities.
- `WorkScheduler::global()` is the existing process-local resource authority. Do not create another scheduler.
- `BrowseService` is the existing owner of opaque Browse session/path/entry refs.
- `EphemeralChangeMonitor` must reuse the same `BrowseService`; it may invalidate/re-enumerate but never become managed watcher truth.
- `MaterializationReadGate` must reuse the same `BrowseService` so ephemeral source refs resolve against the session that issued them.
- `ThumbnailService` must reuse W1-07 and W1-05; no path-authorized renderer seam is permitted.
- `PreviewSession` is a lifecycle/provider contract. W1-10 may add a scheduler-backed integration adapter and metadata/lifecycle wiring, but **must not implement W3 rich providers or user-facing Quick Preview UI**.
- `main.rs` still registers the legacy `request_macos_thumbnail` / `cancel_macos_thumbnail` path. Do not delete or silently repurpose it unless current callers and behavioral equivalence are proven. W1-10 may add the new shared File Workspace Thumbnail surface alongside it.

## 3. Hard authority invariants

These are merge-blocking:

### 3.1 Managed Library remains Query V2

- Do not put Browse state, cursors, pages or ephemeral selection into the Query V2 store.
- Do not create Query V3.
- Library navigation/search continues compiling to existing managed authorities.

### 3.2 Browse remains ephemeral

- `BrowsePathRef`, Ephemeral `LocationRef` and Ephemeral `EntryRef` are process/session scoped.
- Do not persist them as cross-process authority.
- Do not implicitly create scan roots or managed rows when opening an unmanaged folder.
- Cross-process restore accepts only the non-authoritative `WorkspaceRestoreLocator`/routing metadata, then resolves a **fresh** Browse session and fresh opaque refs.

### 3.3 Read Gate stays backend-only authority

- Do not expose a Tauri command that lets the renderer issue arbitrary `ContentReadLeaseRef` or read bytes by lease.
- Frontend may receive `ContentReadEligibility` projection where useful, but actual byte consumers remain backend services.
- Thumbnail/Preview byte access still revalidates at W1-07's actual open boundary.
- No implicit provider hydration/materialization.

### 3.4 WorkScheduler remains resource admission authority

- Reuse `WorkScheduler::global()` or the already-approved shared scheduler seam.
- Do not add another policy scheduler in the integration layer.
- If Preview needs an integration execution adapter, it may implement `PreviewExecution` using W1-05 while preserving bounded lanes/lifecycle; it must not own durable work or duplicate global fairness/resource policy.

### 3.5 Watcher/reconciliation and mutation authorities remain untouched

- W1-09 events are ephemeral Browse hints only.
- Do not write managed watcher revisions from File Workspace integration.
- Do not add move/delete/rename/trash authority to Browse/Preview/Thumbnail integration.
- Existing mutation/preflight/journal/Safe Trash/Restore remains authoritative.

## 4. Backend integration architecture

Create a bounded, maintainable integration subsystem rather than adding hundreds of lines to `main.rs`, `lib.rs`, or one `integration.rs`.

A reasonable shape is:

```text
src-tauri/src/file_workspace/integration/
├── mod.rs
├── runtime.rs
├── types.rs
├── browse.rs
├── change.rs
├── thumbnail.rs
├── preview.rs      # only if needed for W1 lifecycle/metadata integration
└── tests/...
```

This layout is guidance, not a requirement. Use the smallest coherent decomposition that satisfies `CODE_MAINTAINABILITY.md`.

### 4.1 Runtime ownership

The integration runtime should be process-local and non-durable. Compose existing services; do not replace them.

Expected shared ownership includes, where required by the final API:

- one shared `Arc<BrowseService>`;
- existing `Arc<WorkScheduler>` resource authority;
- one W1-07 `MaterializationReadGate` built from the existing `Database` + the same Browse service;
- one W1-08 Thumbnail service using that Read Gate and Scheduler;
- bounded session/task/monitor registries only where a Tauri command needs cancellation/disposal ownership;
- Preview lifecycle integration only to the extent required by W1 contracts.

If a registry is needed, it must be bounded, process-local, disposable, and must not become durable job/session truth.

### 4.2 macOS Thumbnail reuse

Reuse/adapt the existing managed `MacThumbnailService` / `MacQuickLookThumbnailRenderer` path. Do not create a second native Quick Look generation engine.

Non-macOS behavior must fail explicitly as unsupported where no renderer exists; do not fake parity.

A shared Thumbnail command must return a bounded frontend-safe representation of the artifact. **Never return a cache/staging filesystem path as renderer authority.**

### 4.3 Backend-resolved Browse admission

Browse UI eventually needs to open user-selected/restore locations, but after admission normal navigation must use opaque refs.

If the integration accepts a user-intent path/routing hint at the dedicated Browse-open/restore boundary:

- treat it only as admission/routing input;
- validate/re-resolve it in the backend;
- immediately convert it to fresh Browse session/location/path refs;
- never let that path become `NavigationTarget` authority;
- never accept such raw path input on Thumbnail/Preview/Read Gate commands;
- a persisted restore locator is never direct authorization and must be revalidated into fresh refs.

Do not introduce a generic `resolve_any_path` command.

### 4.4 Window authorization

New File Workspace Tauri commands must use the existing main-window authorization policy where equivalent current commands do. The search/auxiliary window must not gain File Workspace authority accidentally.

## 5. Minimum coherent command/API surface

Derive exact command names from repository conventions, but the integration must cover the W1 lifecycle needed by later UI without exposing internal authority.

### 5.1 Browse lifecycle

Provide typed integration for the equivalent of:

- open/admit a Browse location -> fresh session/location/root opaque path ref;
- start enumeration;
- next page;
- explicit enumeration cancel;
- release published page ownership;
- release navigation path-ref ownership where required;
- dispose Browse session.

Returned pages must retain `sessionId + requestId + enumerationId` and opaque refs. Stale cursor/page/publication errors must survive the wire boundary as distinguishable fail-closed results.

Do not return backend filesystem paths as authority. Existing `displayPath` is presentation-only and must never be accepted later as resolver input.

### 5.2 Location projection

Expose the W1 `LocationDescriptor` projection needed by Workspace integration without inventing a new location database.

- Managed descriptors project from existing scan-root truth + real runtime evidence.
- Ephemeral descriptors project from the active Browse session + real runtime evidence.
- If current integration has no trustworthy runtime evidence for a capability, fail closed rather than infer capability from pathname/platform label.
- Never lift per-entry materialization/read eligibility into Location-level truth.

If the current W1-04 implementation lacks a required production platform-evidence seam, do **not** silently invent broad probing logic. Implement the minimal trustworthy adapter or stop/report the missing contract if it would require a new authority/cross-Track redesign.

### 5.3 Ephemeral change/refresh

Integrate W1-09 as a disposable Browse-owned monitor:

- start/attach monitor only for an existing opaque Browse target;
- publish/coalesce only bounded refresh hints, never raw notify paths/events as truth;
- consuming a refresh uses the existing BrowseService and returns a newly generation-bound page;
- dispose monitor on target/session teardown;
- no managed watcher writes.

Event-based or command/poll integration is acceptable if it preserves deterministic ownership and bounded cleanup. Prefer existing Tauri event conventions when they reduce polling without creating a new event authority.

### 5.4 Read eligibility

It is acceptable to expose current `ContentReadEligibility` projection for a valid opaque source ref.

Do **not** expose byte-read leases/read operations to the renderer.

### 5.5 Thumbnail

Provide shared W1 Thumbnail request/cancel integration using:

- opaque `EntryRef`;
- `ThumbnailVariant` small/medium/large;
- caller `WorkClass`/session metadata;
- existing source version/read gate/cache/scheduler rules.

Cancellation must revoke only the requesting owner as W1-08 defines; deduplicated work and owner-aware cancellation must remain intact.

Do not expose native cache/staging paths. Do not route the new shared API back through the legacy path-authorized `request_macos_thumbnail` command.

### 5.6 Preview lifecycle

W1-10 may expose the **headless W1 Preview lifecycle / metadata fallback integration** needed for W1-11 QA and later W3 consumption, but only if it can be wired from existing W1 contracts without inventing a rich provider.

Allowed:

- Preview session creation/snapshot/cancel/dispose/switch-source boundaries;
- backend source snapshot resolution using existing managed/Browse authorities;
- W1-07 read environment injection;
- scheduler-backed bounded `PreviewExecution` adapter;
- metadata fallback and capability projection.

Not allowed:

- Markdown/JSON/CSV/ZIP/Folder/Image rich production providers;
- floating/pinned user-facing Preview UI;
- Finder Quick Look extension;
- Windows Explorer Preview Handler/System Space integration.

If a production Preview resolver/provider seam is insufficient for a safe minimal integration, keep the bridge narrower and report the exact missing dependency rather than inventing W3 behavior.

## 6. Frontend integration

### 6.1 Typed API

Create a dedicated typed adapter such as:

`src/api/fileWorkspaceApi.ts`

Use `invokeCommand` / `listenTo` conventions rather than direct scattered `invoke()` calls.

Extend `src/types/fileWorkspace.ts` only with wire DTOs actually required by W1-10. Rust/TypeScript serialized shapes must remain aligned and strict.

Do not move managed Query V2 domain types into File Workspace merely for convenience.

### 6.2 Headless Workspace adapter/store

W1-02 `WorkspaceSession` remains navigation/request-epoch authority on the frontend.

Add only the headless adapter/store/controller needed to coordinate:

- current `WorkspaceSession` target/token;
- Browse page/request ownership;
- API cancellation/dispose;
- change invalidation/refresh publication;
- typed location/thumbnail/preview projections where W1-10 exposes them.

It must reject late API results by the W1-02 request token/epoch in addition to backend session/enumeration checks.

Do **not** build the W2 three-pane UI, List/Grid components, breadcrumbs, Context Panel, polished mode switch, or visual Preview host.

Browse state must remain separate from the existing Query V2 store.

### 6.3 Browser mock maintainability

`src/api/browserMockApi.ts` is already extremely large. Do not append a large File Workspace mock implementation into that file.

Prefer a bounded module such as:

`src/api/fileWorkspaceMockApi.ts`

and make only the smallest routing/delegation change needed in the existing browser-mock entrypoint/core.

Mock behavior must preserve opaque-ref/stale-generation/cancellation honesty; it must not return raw filesystem paths and call them authority.

## 7. Wire contract requirements

Rust/TypeScript integration DTOs must be deterministic and strict.

At minimum verify:

- opaque `EntryRef`, `LocationRef`, `BrowsePathRef` round-trip without extra fields;
- Browse page `sessionId/requestId/enumerationId` identity;
- Location descriptor shape;
- materialization/read eligibility values;
- Thumbnail variants/errors/results;
- change hint/refresh identity where exposed;
- Preview snapshot/envelope shape where exposed.

Do not serialize:

- backend-only filesystem paths as authority;
- native handles/security-scoped URLs/provider objects;
- `ContentReadLeaseRef` as a general frontend read capability;
- scheduler leases;
- internal watcher events.

## 8. Required deterministic tests

Implement focused tests for the final surface. The exact file layout may differ, but the behaviors are required where that surface exists.

### Backend integration

1. Browse open returns fresh opaque session/location/root refs and no authoritative raw path field.
2. Start enumeration returns a generation-bound first page.
3. Old cursor/page is rejected after invalidation/re-enumeration.
4. Explicit cancel revokes current enumeration publication.
5. Session dispose invalidates old path/entry refs and releases attached change monitor/task state.
6. Restore locator re-resolution creates fresh session refs; old serialized ephemeral refs are never revived.
7. Change hint invalidates old enumeration and bounded refresh returns the new generation only.
8. Change event/DTO contains no raw notify path authority.
9. Read-eligibility projection works for valid managed/ephemeral sources and no frontend byte-read command exists.
10. Thumbnail command uses shared W1-08 service, preserves owner-aware cancellation/dedupe, and returns no cache path.
11. Non-macOS shared Thumbnail behavior is explicitly unsupported rather than silently successful when no renderer exists.
12. Integration uses the same BrowseService for Browse refs, W1-07 ephemeral resolution and W1-09 change monitoring.
13. Runtime/task/monitor registries are bounded and return to steady state after repeated start/cancel/dispose cycles.
14. Main-window authorization prevents auxiliary windows from gaining the new command authority, using the repository's existing test seam/pattern where practical.
15. Preview integration tests shell/lifecycle/cancel/dispose/stale publication and metadata fallback if Preview is exposed in W1-10.
16. Scheduler-backed Preview adapter, if introduced, proves it uses W1-05 rather than an independent unbounded scheduler.

### Frontend

17. API request/response DTOs match Rust wire shapes.
18. `WorkspaceSession` request-token rejection prevents late Browse/change/thumbnail/preview results from publishing after navigation/dispose.
19. Browse state does not mutate or become stored in the Query V2 store.
20. Browser mock File Workspace path uses opaque refs and generation-aware stale behavior.
21. No W2 UI components are introduced.

Add focused tests for every failure/cancellation path you materially implement. Do not write tests whose names claim cancellation/cleanup while never executing the relevant action.

## 9. Maintainability gate

This Track touches integration hotspots and is therefore at high risk of becoming a mega-file.

Before expanding any existing large file, follow `CODE_MAINTAINABILITY.md`.

Hard rules:

- do not turn `main.rs` into File Workspace orchestration; keep registration/setup changes thin;
- do not turn `lib.rs` into implementation logic;
- do not build one all-knowing `FileWorkspaceRuntime` file containing Browse + monitor + Thumbnail + Preview + Tauri DTO implementation details;
- do not append a large File Workspace mock into `browserMockApi.ts`;
- do not place slow filesystem/native/helper I/O under a global integration coordination mutex;
- registries own lifecycle only; services keep their existing domain authority;
- platform-native code remains under platform adapters.

If any hand-written production file crosses ~1000 lines after this Track, the completion report must explain why the file remains one coherent responsibility. If it gains another independent lifecycle/resource owner, split it before review.

## 10. Shared-hotspot discipline

W1-10 is authorized to touch integration hotspots, but only minimally:

- `src-tauri/src/main.rs` — setup/manage/register only;
- `src-tauri/src/lib.rs` — module/re-export surface only;
- frontend API registry/core — minimal routing only;
- `src/types/fileWorkspace.ts` — File Workspace wire contracts only;
- `src/fileWorkspace/` — headless Workspace coordination only.

Do not refactor unrelated command registries, Query V2, managed watcher, file operations, AI/content systems, or platform architecture merely because the files are already open.

## 11. Explicit non-goals / forbidden scope

Do not implement in W1-10:

- polished File Library 2.0 UI / three-pane workspace;
- List/Grid visual redesign;
- Context Panel/Inspector UI;
- rich Preview providers;
- floating/pinned user-facing Quick Preview;
- Finder Quick Look extension;
- Windows Explorer Preview Handler/Space integration;
- Query V3;
- unmanaged recursive/global filesystem search;
- managed watcher rewrite;
- second Read Gate/materialization engine;
- second WorkScheduler;
- new filesystem mutation/recovery path;
- auto cloud hydration;
- OCR/RAG/AI Preview/Agent/MCP;
- Intel macOS/Linux;
- schema migration/new durable authority;
- broad cleanup/refactor unrelated to the integration surface.

## 12. Stop / escalate conditions

STOP and report instead of broadening the Track if implementation appears to require:

- schema migration;
- new durable database/session/job authority;
- a new filesystem mutation/recovery contract;
- a second recursive search/index engine;
- weakening W1-07 revalidation/materialization semantics;
- exposing raw path/native handle authority to the renderer;
- replacing managed watcher/reconciliation;
- lowering existing CI/performance thresholds;
- implementing W2/W3/W4 product scope;
- changing supported platforms;
- a broad rewrite of `main.rs`, Query V2 store or browser mock infrastructure merely to make W1-10 convenient.

If an existing W1 service lacks a safe integration seam, identify the smallest seam change and explain why it belongs to that service's existing responsibility. Do not duplicate the service inside integration.

## 13. Validation

Run focused tests first, then all applicable exact-head gates.

Expected minimum local validation:

```text
frontend File Workspace focused tests
existing WorkspaceSession tests
Rust File Workspace integration focused tests
Browse / Location / Change / Read Gate / Thumbnail affected focused tests
Preview focused tests if Preview wiring changes
WorkScheduler focused tests if Preview execution adapter changes
npm run typecheck
npm test (or the repository-approved full frontend suite)
npm run verify:rust
npm run check:rust:release
npm run test:docs / governance checks where applicable
git diff --check
```

Use the repository's exact current commands rather than guessing if scripts differ.

Remote CI must be successful on the final exact head. Do not reuse an earlier head's CI after production code changes.

Platform/native tests that cannot run locally must be reported as unverified locally and covered by the applicable exact-head CI/native fixture evidence where available.

## 14. Test artifact hygiene

Follow repository rules:

- use task/worktree-local ignored temp roots on the worktree drive where practical;
- on Windows do not default large task-owned fixtures/caches to system `C:` when the worktree is on another drive;
- remove task-owned File Workspace integration fixtures/temp/staging before completion;
- do not delete shared Cargo/node/dependency caches merely to claim cleanup;
- report exact residual paths if cleanup is blocked.

## 15. Completion report

When implementation is complete, report exactly:

1. final exact head SHA;
2. branch and PR number;
3. module/file structure with approximate line counts for new/expanded integration files;
4. changed files;
5. exact Tauri command/event surface added;
6. runtime ownership diagram: which object owns Browse, change monitors, Read Gate, Thumbnail, Preview integration and Scheduler references;
7. proof that no new durable authority/schema/query/watcher/read/mutation system was created;
8. frontend API/store/mock structure and proof Browse state remains separate from Query V2;
9. focused/full test results;
10. exact-head CI run and result;
11. platform/fixture items not actually verified;
12. task-owned temp cleanup result and exact residual paths if any;
13. maintainability review: files over ~1000 LOC and rationale or decomposition performed.

Keep the PR Draft. Do not mark Ready, merge, rebase/force-push, or start W1-11. Wait for independent architecture/code/maintainability review.