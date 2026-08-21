# W2 — File Library 2.0 Experience Implementation Plan

Status: reviewed implementation plan — W2-01 through W2-09 are complete; W2-09
is squash merged through PR #111 as
`master@6cf8695244298c94cd6dac1acdf02f3af61074f1`; W2-10 is NEXT and
dependency-eligible.

Planning baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`

Initiative: [`../../initiatives/W2-file-library-experience.md`](../../initiatives/W2-file-library-experience.md)

Current progress is owned by `STATUS.md` and `ROADMAP.md`. This document owns the durable W2 dependency graph, Track boundaries and implementation invariants. W2-01 through W2-09 are complete for their accepted scopes; W2-10 is the next dependency-eligible Track.

## 1. Purpose

W2 turns the completed W1 Foundation into the user-facing File Library 2.0 workspace. It must preserve the W0/W1 authority model while replacing the managed-only/List-centric surface with one calm workspace that supports both semantic Library work and familiar filesystem Browse work.

W2 is **experience integration**. It is not a backend authority rewrite, Preview Platform implementation, native system integration or release Wave.

## Reviewer-authorized W2-09 amendment — 2026-08-21

The stable Recent entry remains a future product requirement, but its W2-09
implementation is deferred because no source-owned recent-activity authority
exists in the accepted baseline. W2-09 must not synthesize Recent from
modified/created ordering or add persistence/schema solely to satisfy the
navigation label.

The current W2-09 completion gate is semantic Library navigation over the
existing Query V2 source owner, backend-confirmed managed-only Library
locations bound by `roots.scanRootIds`, backend-confirmed managed and
ephemeral/Browse-only Browse locations through the existing opaque Location
action, and platform-adaptive labels/grouping that never changes backend
identity or infers roles from paths. Recent is explicitly deferred and no
second authority is introduced.

## 2. Frozen product model

```text
File Library
│
├─ Organization mode
│  ├─ Library  -> managed/query truth (Query V2)
│  └─ Browse   -> ephemeral filesystem truth (W1 File Workspace)
│
├─ Presentation mode
│  ├─ List
│  └─ Grid
│
└─ Shared workspace shell
   ├─ Navigation
   ├─ Content
   └─ Context Panel / Inspector
```

Library/Browse and List/Grid are independent dimensions. Do not implement four separate products.

### 2.1 Navigation model

- one Back/Forward chronology across Library and Browse in the live process;
- mode switch returns to `lastLibraryTarget` / `lastBrowseTarget`;
- Library targets use semantic titles/context, not fake filesystem breadcrumbs;
- Browse targets use real breadcrumbs and W1 live opaque refs;
- cross-process restore re-admits Browse through non-authoritative restore metadata only;
- semantic target/history changes own chronology; transient search keystrokes, sort/filter edits, List/Grid toggles, Context visibility and selection do not create history entries unless explicitly committed as a semantic target.

### 2.2 Platform model

macOS and Windows share concepts, not identical chrome.

- macOS Browse navigation may expose Favorites / Locations / Providers where evidence permits;
- Windows may expose Home / Quick Access / This PC / Cloud / Network concepts where evidence permits;
- capability and provider state remain backend-owned and fail closed;
- path strings must not be used to infer platform/provider authority.

### 2.3 Context Panel / Preview boundary

W2 implements Inspector-oriented Context Panel behavior plus an architectural slot for later Preview state. W3 owns the shared Quick Preview host/provider architecture.

Existing Vault Preview/Space behavior may remain as migration compatibility. W2 must not promote it into the W3 architecture. Intentional removal/change requires focused behavior and focus-restoration tests.

### 2.4 App shell versus File Library workspace shell

- `AppShell` owns application titlebar/window controls/global Spotlight/primary product sidebar;
- `FileLibraryWorkspace` owns File Library-local mode/navigation/toolbar/content/context UI;
- W2 must not duplicate app-level titlebar/sidebar/PageHeader hierarchy inside File Library;
- minimum-layout collapse ownership is established structurally, not deferred to final polish.

## 3. Current implementation reality

W2 integrates two existing worlds:

1. Managed Library UI:
   - Query V2, `LibrarySelectionV1`, filters/sort, Inspector, saved views/tags and legacy Preview behavior exist in the Vault surface;
   - `VaultView` is already a large orchestration surface and must not absorb Browse/Grid/new shared responsibilities.

2. W1 File Workspace Foundation:
   - `WorkspaceSession` owns live mixed navigation chronology and history-scoped presentation state;
   - `FileWorkspaceController` owns process-local lifecycle handles;
   - the File Workspace API/Tauri integration exposes bounded Browse, Location, Read Gate, Thumbnail and Preview Core seams;
   - those seams are Foundation, not yet the final visible File Library UX.

Migration remains strangler-style: shell and bounded adapters first; source-specific responsibilities move incrementally; no second data authority is created for UI convenience.

## 4. Binding architecture rules

1. Query V2 remains managed Library query authority.
2. `LibrarySelectionV1` remains managed cross-page selection authority, including compact `all_matching` semantics.
3. Browse authority remains W1 session-scoped opaque refs and backend-owned resolution.
4. Common view models normalize presentation only.
5. `WorkspaceSession` remains the single live owner of history presentation state (`viewMode`, `scrollAnchor`).
6. Source stores/owners retain source query/filter/sort semantics; no shared W2 query authority.
7. Opening Browse does not implicitly add a scan root or make content managed.
8. Thumbnail work uses the accepted W1/R2 contract and remains viewport/demand bounded.
9. No implicit provider/cloud hydration for thumbnails, metadata or selection UI.
10. Context Panel gains no direct content-byte authority.
11. Target switch/history changes preserve W1 cancellation/stale-publication semantics.
12. Large collections use progressive source data + bounded virtualization; no 100k DOM assumption.
13. Virtualization mount/unmount never becomes selection or collection truth.
14. Browse search/sort completeness remains truthful; loaded pages do not masquerade as whole-folder state.
15. Existing oversized modules require maintainability review before expansion.
16. W3 rich Preview and W4 native system hosts remain out of scope.
17. Presentation render keys are not command/durable identity.
18. Renderer paths are never filesystem authority.
19. R1/R2/R3/R4 invariants remain binding through all later W2 Tracks.

## 5. Experience state and authority model

Conceptually:

```text
FileLibraryExperienceProjection
├─ mode: library | browse
├─ navigation: WorkspaceSession snapshot/reference
├─ live presentation
│  ├─ viewMode       # WorkspaceSession history state
│  └─ scrollAnchor   # WorkspaceSession history state
├─ durable presentation defaults?  # non-authoritative seed only
├─ source query/filter/sort projection
│  ├─ library -> Query V2/source stores
│  └─ browse  -> Browse source owner
├─ contextPanel projection
└─ platform navigation projection
```

A **shared selection/focus facade is intentionally not frozen here**. Library and Browse keep their existing/source-specific interaction semantics until W2-03 and W2-04 establish the concrete source owners. W2-05 is the first Track allowed to converge shared selection/focus interaction.

### 5.1 Live presentation authority

- Back/Forward restores each history entry's `viewMode`/`scrollAnchor` exactly;
- durable per-target preference may seed a newly entered target only when no live history presentation exists;
- a durable preference never overwrites Back/Forward-restored live state;
- changing List/Grid updates current `WorkspaceSession` presentation first;
- ephemeral Browse session/path/entry refs are never persistence keys or durable authority.

### 5.2 Source interaction before convergence

Library:

- Query V2 + `LibrarySelectionV1` remain authoritative;
- `all_matching` stays compact;
- no generic context-free membership helper becomes a cross-source contract.

Browse:

- interaction semantics remain source-owned and bounded by what W2-04 can truthfully expose;
- incomplete enumeration cannot imply unseen selection;
- mount/unmount cannot change source truth.

Shared List/Grid/Context code may not assume one normalized selection/focus runtime until W2-05.

## 6. Track graph

```text
W2-00 Specification / visual freeze / implementation activation
                 ↓
W2-01 Workspace Shell + Experience Controller            ✅ merged
                 ↓
R1 CI Evidence / Governance Hardening
                 ↓
R2 Browse Identity + Thumbnail Consumability
                 ↓
R3 Location Consumability
                 ↓
R4 W1 -> W2 Final Consumability Verification
                 ↓
W2-02 Shared Presentation Entry / Collection Contracts
            ┌────┴────┐
            ↓         ↓
W2-03 Library Mode   W2-04 Browse Mode
Adapter/Migration    Navigation + Content seams
            └────┬────┘
                 ↓
W2-05 Interaction Convergence + Virtualized List                    ✅ complete / PR #106
            ┌────┴────┐
            ↓         ↓
W2-06 Virtualized Grid   ✅ complete / PR #108
W2-07 Context Panel      ✅ complete / PR #109
            └────┬────┘
                 ↓
         ┌────────┴────────┐
         ↓                 ↓
W2-08 Search/Filter/   W2-09 Platform Nav /
Sort/Preferences       Managed-Unmanaged UX
COMPLETE / merged       COMPLETE / merged PR #111
         └────────┬────────┘
                  ↓
 W2-10 Interaction / Accessibility / Responsive Integration   NEXT
                  ↓
 W2-11 Experience Performance / Cross-platform QA
                  ↓
 W2-12 Closeout
```

R1 is the next authorized remediation after R0. R2 follows R1; R3 follows R2; R4 follows accepted R1/R2/R3 and is verification-only. W2-02 is not dependency-eligible before R4 PASS. W2-05 is complete through PR #106, W2-06 is complete through PR #108, and W2-07 is complete through PR #109. W2-08 and W2-09 are complete and merged through PRs #112 and #111; W2-10 is NEXT and dependency-eligible. W2-11 waits for W2-10 and W2-12 waits for W2-11.

The W2-03 and W2-04 parallel-worktree rule applied after W2-02 merged; both
source-owner Tracks are now complete and merged. W2-05 completed the shared
interaction convergence and must remain the source of the stabilized
selection/focus/interaction contract for later Tracks rather than being
reimplemented in W2-06/W2-07.

## 7. Tracks

### W2-00 — Specification / Visual Freeze / Implementation Activation

Goal: establish reviewed scope, dependency graph, authority boundaries and concrete visual/interaction references before production implementation.

Exit: reviewed plan/freeze/activation merged. Complete.

---

### W2-01 — Workspace Shell + Experience Controller

Goal: establish the visible File Library workspace owner without rewriting Library/Browse source logic.

Required shape:

- one top-level File Library route;
- lightweight Library/Browse mode control;
- workspace-local Navigation / Content / Context slots;
- experience controller binds W1 `WorkspaceSession` and mode history;
- existing Library surface initially remains a compatibility adapter;
- 980×680 shell structure is viable;
- app-level chrome is not duplicated.

Maintainability:

- do not move/expand `VaultView` wholesale;
- shell remains orchestration-only;
- shared hotspots have one integration owner.

Status: complete and merged through PR #90.

---

### R1 — CI Evidence / Governance Hardening

Goal: make validation evidence truthful about exact PR head vs merge-integration tree, define enforcement semantics and adopt the CI governance ADR.

Binding execution detail: `../../tasks/W2-R1-CI-EVIDENCE-GOVERNANCE-HARDENING-CODEX.md`.

Exit: accepted ADR, focused workflow tests, real exact-head + merge-integration evidence, enforcement audit, no coverage reduction.

---

### R2 — Browse Identity + Thumbnail Consumability Remediation

Goal: prove the public Browse identity/lifetime contract first, then establish truthful Thumbnail generation/source ownership without renderer guessing.

Binding execution detail: `../../tasks/W2-R2-THUMBNAIL-CONSUMABILITY-REMEDIATION-CODEX.md`.

Exit: real Browse producer can reach existing Thumbnail/Read Gate authority with no fabricated generation/path and with browser/native contract parity.

---

### R3 — Location Consumability Remediation

Goal: establish backend-authorized opaque Location -> Browse admission/action while keeping capability evidence truthful.

Binding execution detail: `../../tasks/W2-R3-LOCATION-CONSUMABILITY-REMEDIATION-CODEX.md`.

A non-actionable Location contract deferred to W2-04 is **not** a passing R3 result; that would be a dependency cycle and must return to architecture review.

Exit: safe opaque action -> fresh Browse refs, no renderer path, capability-vs-kind evidence reviewed.

---

### R4 — W1-to-W2 Final Consumability Verification

Goal: independently verify current public producers/consumers after R1/R2/R3 without repairing production code in the verification pass.

Binding execution detail: `../../tasks/W2-R4-W1-W2-FINAL-CONSUMABILITY-VERIFICATION-CODEX.md`.

Required matrix includes Browse, Thumbnail, Location, Read Gate, Preview Core, Query V2 selection provenance and CI evidence.

Exit: no required seam is BLOCKED; STATUS/ROADMAP may then mark W2-02 dependency-eligible.

---

### W2-02 — Shared Presentation Entry / Collection Contracts

Status: complete — independently reviewed and squash merged through PR #101 as `master@f1fd3591977142f08eac139814fecebe2e0e6d96`.

Goal: define the smallest source-discriminated rendering shape after consumer seams are proven.

Binding execution detail: `../../tasks/W2-02-SHARED-PRESENTATION-ENTRY-COLLECTION-CONTRACTS-CODEX.md`.

In scope:

- Library/Browse discriminated entry projection;
- injective render identity that is never command/durable identity;
- truthful metadata/materialization/capability projection;
- separate source collection provenance;
- pure/nearly-pure adapters;
- compact 100k structural evidence.

Explicitly out of scope:

- shared selection/focus runtime;
- selection anchor/range/select-all semantics;
- generic operation/navigation dispatcher;
- Thumbnail request construction;
- Location admission implementation;
- new runtime store/controller;
- Rust/Tauri/schema/persistence changes;
- W2-03/W2-04 behavior.

Exit: Library/Browse share presentation shape without sharing authority; entry and collection truth remain separate; no source interaction semantics are guessed.

---

### W2-03 — Library Mode Adapter / Migration

Goal: preserve existing managed Library capabilities inside the new workspace and establish the concrete Library source owner consumed by later shared interaction.

Preserve:

- Query V2 paging/search/filter/sort;
- saved views/tags;
- `LibrarySelectionV1`, including compact all-matching;
- existing Inspector/detail and established operation/reveal authorities;
- legacy Preview behavior where needed for migration parity;
- no Query V3.

Navigation:

- semantic Library target changes may enter history;
- transient query/sort/filter/selection/List/Grid changes do not spam history.

Refactor:

- progressively extract orchestration from `VaultView`;
- do not mix Browse state into Query V2 stores;
- remove compatibility paths only under `TECH_DEBT.md` exit conditions.

Exit: managed Library behavior parity through the new workspace; source-owned selection remains compact; concrete Library interaction owner is stable enough for W2-05.

---

### W2-04 — Browse Mode Navigation + Content Seams

Goal: expose W1 Browse as a Finder/Explorer-familiar current-folder source and establish the concrete Browse source/interaction owner.

Required:

- R3 location action seam drives location navigation;
- managed/unmanaged open without implicit admission;
- progressive pages;
- real breadcrumbs using live refs;
- same-session child navigation;
- Back/Forward and Library<->Browse correctness;
- change/refresh hints;
- truthful enumeration completeness;
- truthful search/filter/sort capability seams;
- unavailable/permission/provider unknown states remain visible/fail closed;
- source-scoped Browse interaction semantics are explicit enough for W2-05 but do not claim unseen selection.

Ownership:

- W2-04 owns Browse navigation/enumeration/source interaction capabilities;
- W2-08 owns final shared search/filter/sort controls and completeness messaging.

Exit: real local Browse works on Windows and macOS with lifecycle/navigation/completeness evidence; concrete Browse interaction owner is stable enough for W2-05.

---

### W2-05 — Interaction Convergence + Virtualized List

Status: complete — squash merged through PR #106 at `master@d480b7eaec6372efa69dbb28a05e40d4337187bd`. Final reviewed PR head: `162bc0ae12f19f06db61ec3f9d7e86d466c73717`; final tree: `80632c79959854b6fdba0a47f883ebd9e29377e2`; production remediation head: `059a4cb12b06cdab8bb66370e5e4eab9058295d5`; production CI `32402544692` and final-head CI `32403536086` concluded `success`. ADR-0004 final-head plan: `tree_equivalent=true`, `head_validation_required=false`, `validation_lanes=["merge_integration"]`.

Goal: after both source owners exist, define the normalized component-facing interaction facade and ship the shared high-scale List.

This is the first Track allowed to converge shared selection/focus behavior.

Required interaction contract:

- Library routes to `LibrarySelectionV1`/Query V2 context;
- Browse routes to W2-04 source-scoped semantics;
- deterministic focus independent of mounted DOM lifetime;
- Ctrl/Cmd toggle and shift-range semantics are capability/source aware;
- Library Select All preserves all-matching without materializing IDs;
- Browse Select All claims only the scope guaranteed by W2-04;
- incomplete Browse enumeration cannot imply unseen selection;
- virtualization mount/unmount never changes selection/focus truth;
- no shared durable selection database/store is created.

Required List behavior:

- bounded mounted rows;
- configurable columns where useful;
- folders/files/availability clear;
- visible rows drive priority work only when needed;
- no full 100k DOM render.

Exit: both sources use one component-facing interaction/list contract without sharing data authority; 100k logical List behavior remains bounded and correct.

---

### W2-06 — Virtualized Grid + Thumbnail Integration

Status: complete — independently reviewed, exact-head CI accepted, and squash merged through PR #108 as `master@3f745b9b894e161d7b1bdff95c16143c7de58124`.

Dependency: eligible after W2-05; may proceed in parallel with W2-07 from the post-W2-05 master.

Goal: provide Grid presentation on the W2-05 interaction contract using the accepted R2 Thumbnail seam.

Required:

- semantic thumbnail variants mapped to cell geometry/scale;
- viewport + overscan bounded request ownership;
- obsolete/offscreen work cancelled;
- unsupported/unavailable/materialization states use placeholders/fallbacks;
- no implicit hydration;
- Grid uses the W2-05 interaction facade;
- target-specific List/Grid live state stays in `WorkspaceSession`.

Exit: rapid scroll/switch does not leak/cross-publish thumbnails; large-grid rendering stays bounded; history restores live presentation correctly.

---

### W2-07 — Context Panel / Inspector

Status: complete — independently reviewed after W2-06 integration, exact-head CI accepted, and squash merged through PR #109 as `master@b5e2db658ca4e32814e84150d7ee28d8054c2f9f`.

Dependency: eligible after W2-05; may proceed in parallel with W2-06 from the post-W2-05 master.

Goal: create the shared Context Panel using stabilized source owners and W2-05 interaction semantics.

States:

- no selection -> hidden/collapsed;
- one selection -> Inspector;
- multi-selection -> bounded summary where source authority supports it;
- reserved Preview slot -> no W3 rich Preview implementation.

Rules:

- Library detail remains existing Library authority;
- all-matching summary remains compact/source-owned;
- Browse Inspector uses W1/W2 metadata/capability projection and does not open arbitrary bytes;
- narrow layouts use W2-01 collapse/overlay ownership.

Exit: selection switch/cancel/stale detail and accessibility behavior are correct across supported source cases.

---

### W2-08 — Search / Filter / Sort / Per-target Presentation Preferences

Status: complete — merged through PR #112 at `master@b918818b801edb9e44952150221b021d41a4fdb4`.

Goal: make shared controls coherent without pretending sources have identical capabilities.

Library:

- Query V2 search/filter/sort remains authoritative;
- transient edits do not become navigation chronology.

Browse:

- arbitrary unmanaged search/filter is non-recursive current-folder only;
- progressive results remain labelled partial/searching until active enumeration completes;
- count is complete only when source says complete;
- stale generations revoke old matches;
- partial-page sort cannot be labelled whole-folder sort;
- stable whole-folder sort is exposed only when source capability proves it.

Preferences:

- `WorkspaceSession` live history state wins over durable defaults;
- durable defaults are non-authoritative seeds only;
- ephemeral refs are never persistence keys;
- avoid schema changes unless separately reviewed.

Exit: mode/target/history presentation restores correctly; Browse completeness/sort claims remain truthful.

---

### W2-09 — Platform-adaptive Navigation + Managed/Unmanaged UX

Status: complete — squash merged through PR #111 as
`master@6cf8695244298c94cd6dac1acdf02f3af61074f1`; Recent explicitly deferred
by the reviewer amendment above.

Final reviewed head: `ab1f7f6e893a9c57202552fd07efe00bda66fa2a`; tree:
`8a46288bc8b53c5aff04e146c6913a32112842f4`. Hosted CI `32504671540` concluded
`success`; merge integration `1514a6c026f1b465916f0a698cfa9fd06473bf1` retained
the same tree.

Goal: complete platform-familiar navigation hierarchy using backend evidence.

Library locations are managed-only: `LocationDescriptor.ref.kind ===
"managed"` is the only admission to the Library location projection, and a
managed location activates a Query V2 `roots.scanRootIds` scope while staying
in Library. Browse may show both managed and ephemeral/Browse-only locations
when the backend confirms them.

macOS concepts: Favorites, Locations, Providers when evidence permits.

Windows concepts: Home/Quick Access, This PC, Cloud, Network when evidence permits.

Shared rules:

- explicit `Add this location to Library` routes through existing admission authority;
- managed/unmanaged status is understandable but calm;
- no provider/volume inference from path strings;
- platform changes presentation labels/grouping only; backend LocationDescriptor
  identity and capability remain authoritative;
- no Favorites/Home/provider role is exposed without backend evidence;
- Recent is not implemented by this Track because the accepted baseline has no
  source-owned recent-activity authority;
- Browse remains useful when Library is empty;
- workspace navigation remains local to File Library.

Exit: real supported-platform navigation/empty/offline states are visually reviewed; missing provider fixtures stay explicitly UNVERIFIED.

---

### W2-10 — Interaction / Accessibility / Responsive Integration

Status: NEXT — dependency-eligible after the W2-09 squash merge. Recent is a
future product requirement and explicitly deferred; it is not a W2-10
dependency.

Goal: make the integrated workspace behave as one product.

Required:

- minimum 980×680 behavior;
- navigation/content/context collapse rules;
- responsive breadcrumb collapse;
- keyboard-only navigation;
- focus restoration after dialogs/context menus/mode switch;
- screen-reader roles/labels;
- reduced motion;
- Windows DPI/macOS Retina checks;
- mouse/trackpad/keyboard context-menu affordances;
- no collision with OS-reserved shortcuts;
- migration compatibility for any remaining Vault Preview/Space behavior.

Exit: accessibility/focus/responsive QA has explicit supported-platform evidence without crossing into W3.

---

### W2-11 — Experience Performance / Cross-platform QA

Goal: prove integrated W2 viability at scale without regressing W1 authorities.

HARD evidence includes:

- 100k logical Library List/Grid where supported with bounded mounted elements;
- 100k logical Browse List/Grid where supported;
- progressive first useful content;
- compact Library all-matching with virtual windows;
- incomplete Browse selection never claims unseen entries;
- late-page Browse search/sort sentinel tests;
- rapid target/mode/query-generation switching does not publish stale state;
- Back/Forward restores live presentation and preferences do not overwrite it;
- thumbnail request ownership returns to steady state;
- Browse session/path/entry refs remain within W1 caps and return to steady state;
- Query V2 100k/1M thresholds remain unchanged;
- no unbounded React/listener/observer growth;
- deterministic keyboard/focus under virtualization;
- Windows and Apple Silicon macOS release-build evidence.

TARGET/OBSERVED evidence may include first-content latency, mounted counts, thumbnail concurrency/cache observations and RSS/handles/FD.

Provider/network/external fixtures remain UNVERIFIED unless actually exercised.

Exit: no W2 HARD correctness/accessibility/resource blocker remains.

---

### W2-12 — Closeout

Goal: converge project current truth only after integrated W2 is independently reviewed.

Update as applicable:

- STATUS;
- ROADMAP;
- initiative;
- evidence/merge records;
- TARGET MISSED / UNVERIFIED matrix;
- branch/temp hygiene inventory.

No new product behavior belongs in W2-12.

## 8. Parallelization plan

- R1 -> R2 -> R3 -> R4 are production/verification gates in order. Do not parallelize the acceptance chain.
- Historical activation rule: after W2-02 merged, W2-03 Library and W2-04 Browse ran in parallel in separate worktrees.
- W2-05 is complete and owns the stabilized shared interaction convergence plus List contract.
- W2-06 Grid and W2-07 Context proceeded in parallel from the post-W2-05 master and are complete.
- W2-08 and W2-09 are complete and merged through PRs #112 and #111 from the
  post-W2-07 integration sequence.
- W2-10 is the next dependency-eligible Track.
- W2-10 is the integration hotspot owner.
- W2-11 follows integrated product behavior.

Avoid concurrent writes to:

- `src/components/AppShell.tsx`;
- File Library workspace root/controller;
- shared presentation/interaction types;
- global navigation context;
- global CSS/design tokens;
- STATUS/ROADMAP.

Use a designated integration owner for shared hotspots.

## 9. Maintainability rules

- do not add independent responsibilities to `VaultView.tsx`;
- workspace/navigation/presentation/source interaction/Context responsibilities remain cohesive modules;
- 500–800 LOC triggers cohesion review;
- 1000+ LOC normally requires decomposition or explicit justification;
- tests follow responsibility boundaries rather than one giant W2 test file;
- do not duplicate source-specific List/Grid rendering trees;
- do not turn Zustand/global stores into dumping grounds for W1 lifecycle state;
- do not create a second live presentation/query/selection/filesystem authority.

Behavior-preserving extraction should be separated from product behavior where practical.

## 10. Test-artifact hygiene

- task-owned fixtures/cache/temp live in ignored worktree-local paths on the worktree drive;
- 100k UI/performance fixtures are bounded and cleaned;
- shared Cargo/node caches are not task cleanup targets;
- retained reusable fixtures need an explicit owner;
- every Track reports cleanup and leaves its worktree clean at handoff.

## 11. Stop / escalate conditions

Stop and request architecture review if any Track appears to require:

- Query V3;
- a second managed watcher/reconciliation authority;
- a second Read Gate or Thumbnail/WorkScheduler authority;
- a second live presentation/query/selection authority;
- durable Browse session/path/entry persistence;
- schema change only for UI convenience;
- arbitrary recursive unmanaged filesystem search;
- automatic provider hydration;
- W3 rich Preview/provider implementation;
- W4 native system extension/handler implementation;
- mutation/recovery authority changes;
- renderer-supplied filesystem path as authority;
- bypassing any accepted R1/R2/R3/R4 invariant.

Do not solve a missing capability by silently crossing a Wave or Track boundary.

## 12. Standard production Track workflow

For each production Track:

1. start from current reviewed master;
2. read `MASTER_DEVELOPMENT_PLAN.md`, active initiative, this plan, current STATUS/ROADMAP, Development Workflow, Maintainability and the current taskbook;
3. verify branch/worktree/base and unrelated changes;
4. implement only the bounded Track contract;
5. run focused checks then applicable repository gates;
6. clean task-owned artifacts;
7. push and keep PR Draft;
8. report exact-head / merge-integration evidence according to R1 policy;
9. perform independent architecture/code/UX/maintainability review;
10. fix blockers on the same PR and re-review;
11. Ready + squash merge only on the reviewed exact head;
12. update current truth only where the Track owns a state transition.

CI green alone is not approval.

## 13. W2 release criteria

W2 is complete only when:

- the Library/Browse workspace is the real File Library route;
- managed Library capabilities remain intact;
- unmanaged Browse is first-class and does not implicitly become managed;
- List/Grid/Context work across both sources where capability permits;
- shared interaction was derived from concrete Library/Browse source owners, not guessed beforehand;
- live per-history presentation remains `WorkspaceSession`-owned;
- source-owned query/selection semantics remain correct;
- Browse search/sort completeness remains truthful;
- supported-platform UX is visually and interactively validated;
- 100k Library/Browse presentation remains bounded and responsive enough for frozen targets;
- no W2 HARD correctness/accessibility/resource blocker remains;
- W1 authority/performance gates are preserved;
- TARGET MISSED / UNVERIFIED evidence remains honest;
- W2-12 current-truth closeout is independently reviewed and merged.

W2 completion does not mean W3 Preview Platform, W4 Native Integration or W5 Release is complete.
