# W0-G — W1 Foundation Implementation Plan

## 1. BR0 baseline gate

W1 production branches may start only after:

1. W0 specification is reviewed and merged.
2. Current platform-hardening work is merged/closed.
3. final `master` is reconciled against W0 assumptions.
4. a separately authorized W1 implementation initiative is created.

BR0 reconciliation performed for this draft against:

`master@e09447dbf2da46e1b02e6da03bcb3345966f160b` (PR #63 merge).

PR #63 does not invalidate W0. W1 must adapt to its final File Provider, explicit materialization and layered capability semantics rather than overwrite them.

## 2. W1 scope

W1 builds Foundation only:

- contracts
- navigation/session lifecycle
- ephemeral Browse core
- Location projection/adapters
- resource scheduling
- Preview lifecycle contracts
- materialization gate
- Thumbnail infrastructure
- ephemeral change invalidation
- integration/API surface
- performance/instrumentation/QA

W1 does not ship the complete Library 2.0 visual experience, rich Preview providers or native Finder/Explorer system integration.

## 3. Dependency graph

```text
W1-00 Initiative
   |
W1-01 Contract Spine
   |
   +-- W1-02 Workspace Navigation
   +-- W1-03 Ephemeral Browse Core
   +-- W1-04 Location Core
   +-- W1-05 WorkScheduler
   +-- W1-06 Preview Contract Core
            
W1-04 -> W1-07 Materialization Gate
W1-04 + W1-05 -> W1-08 Thumbnail Infrastructure
W1-03 + W1-04 -> W1-09 Ephemeral Change/Refresh

W1-02..09 -> W1-10 Integration Surface
W1-10 -> W1-11 Performance / QA Gate
W1-11 -> W1-12 Closeout
```

## 4. Track / PR definitions

### W1-00 — Implementation initiative

Documentation/governance only. Bind W1 to the final W0 merge SHA and define production scope/DoD.

### W1-01 — Contract Spine

Freeze shared implementation-level types and serialization tests:

- EntryRef
- LocationRef
- NavigationTarget / BrowsePathRef
- availability / freshness / materialization
- WorkClass
- PreviewSourceRef / PreviewHostKind

No feature behavior or UI.

### W1-02 — Workspace Navigation

Implement WorkspaceSession/navigation history/request epoch/dispose, `lastLibraryTarget` and `lastBrowseTarget`.

Do not build the polished W2 File Library UI.

### W1-03 — Ephemeral Browse Core

Implement session-scoped progressive enumeration, opaque path refs, cursor/page semantics, cancellation and bounded temporary identity/cache.

No new scan-root/query/database authority.

### W1-04 — Location Core

Project managed scan roots into LocationDescriptor and implement ephemeral location state. Availability/freshness/capability projection only.

No new `locations` table.

Platform subtracks may implement macOS and Windows adapters after the common Location contract merges.

### W1-05 — WorkScheduler

Implement resource lease, WorkClass priority, backpressure/fairness, instrumentation and platform resource policy adapters.

No durable job persistence or ownership of scan/dedupe/analysis state.

### W1-06 — Preview Contract Core

Implement PreviewSession, resolver/provider registry interfaces, host/effective capabilities, cancellation, cleanup, fallback contract and fake-provider tests.

No rich user-facing providers and no production Quick Preview UI.

### W1-07 — Materialization Gate

Implement ReadIntent/policy boundary and safe platform adapters. Preserve PR #63 semantics: explicit materialization; provider routing hints are not identity; byte eligibility is capability/runtime dependent.

No auto-download policy.

### W1-08 — Thumbnail Infrastructure

Introduce shared ThumbnailService abstraction, variants, cache/scheduler contract and provider adapter. Wrap/reuse existing MacThumbnailService rather than rewrite it.

No Grid visual redesign.

### W1-09 — Ephemeral Change / Refresh

Add session watcher hints, invalidation and bounded re-enumeration. Project existing managed watcher/reconciliation facts into LocationFreshness.

No managed watcher rewrite.

### W1-10 — Integration Surface

Central integration PR for Tauri command registration, frontend API/store adapters and Workspace projection wiring.

Earlier tracks should minimize churn in shared registration/API hotspots.

### W1-11 — Performance / QA

Add Foundation performance/instrumentation gates and verify existing Query V2 100k/1M thresholds remain green.

Required W1 evidence includes 100k Browse, cancellation, scheduler interference, no implicit hydration, unavailable location correctness, bounded thumbnail work and resource/handle steady-state evidence.

### W1-12 — Closeout

Update current-truth docs and evidence; no new feature scope.

## 5. Parallelism

After W1-01 merges, the first parallel group is:

- W1-02 Navigation
- W1-03 Browse
- W1-04 Location
- W1-05 Scheduler
- W1-06 Preview Contract

After their contracts stabilize, second parallel group:

- W1-07 Materialization
- W1-08 Thumbnail
- W1-09 Ephemeral Change

This structure is intended to increase speed without allowing each track to invent incompatible identity/location/session models.

## 6. Integration hotspots / ownership

Treat these as protected hotspots with a single integration owner whenever possible:

- `src/types/domain.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/src/main.rs`
- frontend Tauri API registry/types
- existing File Library Query V2 store
- managed watcher implementation
- macOS platform provider/materialization/capability modules

Browse state should live in a separate Browse/Workspace store; do not contaminate Query V2 store with ephemeral filesystem state.

## 7. PR #63 compatibility rule

W1 macOS implementation begins from the merged PR #63 semantics:

- generic provider path is a routing hint, not item/domain identity;
- materialization is explicit and consent-bound;
- runtime capability and operation/read eligibility are layered;
- unknown/offline/unsupported provider/network/external cases fail closed;
- renderer does not infer platform capability from pathname or platform label.

Any proposed W1 change that weakens these contracts requires an ADR/security review rather than an ordinary feature PR.

## 8. Track Definition of Done

Every W1 PR must explicitly state:

- Scope and non-goals.
- Durable authority affected (normally none/new authority = no).
- Cancellation/lifecycle behavior.
- Platform impact.
- Performance/backpressure impact.
- Normal + failure + cancellation tests.
- Query V2/watcher/mutation-safety no-regression statement.
- Paths intentionally touched, especially shared hotspots.

If implementation discovers a need for schema change, a new durable authority, a CI threshold change or filesystem-safety rewrite, the Track stops and escalates to initiative/ADR review.

## 9. Merge strategy

Prefer short-lived feature branches and small PRs merging progressively into current `master`.

Do not create a multi-week `file-library-v2-mega` branch.

Temporary integration branches are allowed only for bounded E2E testing and must not become current truth.

## 10. Foundation gates

- **F1 Contract Spine** — shared contracts stable.
- **F2 Parallel Core** — Navigation/Browse/Location/Scheduler/Preview lifecycle merged.
- **F3 Infrastructure** — Materialization/Thumbnail/Change/Integration surface merged.
- **F4 Foundation Release** — performance, cancellation, resource cleanup, platform QA and architecture audit pass.

Only F4 authorizes opening W2 Experience implementation.

## 11. W1 explicit non-goals

- Full Library/Browse visual redesign.
- Rich Markdown/JSON/CSV/ZIP/Folder production providers.
- Finder Quick Look extension.
- Windows Explorer Space integration.
- third-party plugin SDK.
- AI/OCR/RAG.
- Query V3.
- managed watcher rewrite.
- new filesystem mutation path.
