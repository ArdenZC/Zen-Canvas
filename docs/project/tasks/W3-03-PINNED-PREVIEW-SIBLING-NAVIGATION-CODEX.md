# W3-03 — Pinned Preview + bounded sibling navigation

Status: implementation taskbook — code/review branch only

Baseline: `master@52cca2039070d26f7fabfd7f2ac53cfb315bb79a` (W3-02 current-truth closeout / PR #122)

Branch: `feat/w3-03-pinned-preview-sibling-navigation`

## Goal

Deliver the second Zen Preview host presentation by adding **Pinned Preview as the existing W2 Context Panel `Preview` state**, plus **bounded sibling navigation projected from the current source-owned File Library collection**.

W3-03 consumes the already-merged W3-01 Preview Core and W3-02 Floating Preview experience. It must extend that architecture rather than introduce a second Preview engine, second query/selection model, second Context panel, raw-path transport, rich provider implementation or W4 native system host.

Production rich Preview providers remain intentionally deferred to W3-04+; Metadata fallback is therefore a valid and expected W3-03 representation.

## Required read set

Before production edits, read:

- `AGENTS.md`
- `docs/project/MASTER_DEVELOPMENT_PLAN.md`
- `docs/project/DEVELOPMENT_WORKFLOW.md`
- `docs/project/CODE_MAINTAINABILITY.md`
- `docs/project/STATUS.md`
- `docs/project/ROADMAP.md`
- `docs/project/ARCHITECTURE_MAP.md`
- `docs/project/TECH_DEBT.md`
- `docs/project/initiatives/W3-preview-platform.md`
- `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
- `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
- `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
- `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
- `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
- `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
- `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
- `docs/project/tasks/W3-01-PREVIEW-CORE-CONSUMER-READINESS-CODEX.md`
- `docs/project/tasks/W3-02-ZEN-FLOATING-QUICK-PREVIEW-HOST-CODEX.md`

Inspect the current production seams around:

- `src/fileWorkspace/fileWorkspaceController.ts`
- `src/api/fileWorkspaceApi.ts`
- `src/api/fileWorkspaceMockApi.ts`
- `src/types/fileWorkspace.ts`
- `src/views/fileLibrary/FileLibraryWorkspace.tsx`
- `src/views/fileLibrary/preview/**`
- `src/views/fileLibrary/context/**`
- `src/views/fileLibrary/library/**`
- `src/views/fileLibrary/browse/**`
- `src/views/fileLibrary/list/**`
- W2 Context Panel responsive/sheet ownership
- Library/Browse source owners and interaction projections
- current W3-02 unit and real-browser gates.

Do not design W3-03 from screenshots or assumptions while ignoring those owners.

## Non-negotiable authority invariants

- `PreviewSession` / W3 Preview Core remains lifecycle/provider/sourceVersion/publication authority.
- The existing W3-02 `PreviewExperienceController` remains the renderer Preview experience coordination owner. W3-03 may extend it for host presentation/handoff, but must not create a parallel lifecycle authority.
- `FileWorkspaceController` remains the frontend transport/cache seam and retains the accepted per-`previewId` serialized latest-wins source-switch ordering.
- Query V2 / `LibrarySelectionV1` remain managed Library query/selection truth.
- BrowseService remains ephemeral Browse identity/lifetime truth.
- WorkspaceSession and source-owned interaction state remain navigation/focus/presentation truth.
- The W2 Context Panel remains the single Context surface. Pinned Preview is a state of it, not a new sidebar/sheet.
- MaterializationReadGate remains byte-read/materialization eligibility authority.
- WorkScheduler remains global expensive-work admission authority.
- No renderer-authoritative raw filesystem path, generic byte-read lease, implicit hydration or new file mutation authority.
- `all_matching` must remain compact; Preview navigation may never materialize all matching IDs.
- W3-03 does not close TD-015 and does not broadly remove legacy Preview/Vault compatibility.

If implementation appears to require a new global/durable Preview authority, second query engine, second Context surface, new Tauri permission/command, schema migration, raw-path transport, W4 system host or rich provider implementation, **STOP and return for architecture review**.

## Product contract

### 1. Pinned Preview is a Context Panel state

Pinned Preview is the existing W2 Context Panel's explicit `Preview` state.

The Context model must remain coherent:

- Inspector remains the default selected-entry context state.
- Pinned Preview explicitly switches Context from Inspector/no-selection into Preview.
- Pinned Preview is non-modal; normal List/Grid interaction remains available.
- Large layout uses the existing inline Context Panel.
- Compact layout uses the existing Context sheet/overlay behavior.
- Do not create another right sidebar, floating side sheet, hidden duplicate Context state or second focus trap.

The implementation should add the smallest explicit state/command seam needed for `Inspector <-> Preview`, preserving existing W2 ownership.

### 2. Pin handoff from Floating Preview

The W3 experience freeze requires a bounded typed handoff:

1. Floating Preview is open on current valid source A.
2. User invokes Pin.
3. Current source/session intent is handed to the `zen_pinned` host using typed Preview identity only.
4. No raw path, reconstructed path or renderer byte authority is transferred.
5. Pinned Context becomes the current Preview presentation.
6. After successful handoff, Floating shell closes.
7. W3 v1 does not keep duplicate Floating + Pinned hosts for the same source by default.

Prefer reusing/extending the current `PreviewExperienceController` and authoritative Preview lifecycle rather than dispose/recreate choreography that causes source flashes or duplicate sessions.

The exact implementation may switch host presentation or perform a bounded lifecycle handoff depending on the existing contract, but it must preserve one current Preview authority.

If Pin handoff fails:

- do not silently discard the current Floating Preview;
- do not leave two partially-active hosts;
- keep the state truthful and recoverable;
- do not add retry loops or hidden fallback byte reads.

### 3. Floating and Pinned are two hosts, not two engines

The accepted conceptual model is:

```text
File Library source owner / current focus
                │
                ▼
      PreviewExperienceController
        │                     │
        │ host presentation   │ source/request intent
        ▼                     ▼
 Floating host           Pinned Context host
        \                     /
         \                   /
          ▼                 ▼
          FileWorkspaceController
                  │
                  ▼
             PreviewSession
```

Do not instantiate independent Floating and Pinned lifecycle controllers that can disagree about current source/request.

Do not create a new Zustand/global durable Preview store merely to connect the two hosts.

If the current W3-02 controller cannot safely represent host kind/handoff without becoming a second authority, STOP and report the exact gap before redesigning.

### 4. While pinned, Preview follows current source-owned focus

Pinned Preview is persistent as a host presentation, **not pinned to a stale file identity**.

While Context Preview is active:

- valid current Library/Browse focused/active entry becomes current Preview source;
- moving focus A -> B -> C keeps the Pinned host mounted and switches through the same W3-02 latest-wins lifecycle/transport semantics;
- old A/B frontend publications become unacceptable immediately;
- only current request/source/sourceVersion may render;
- normal workspace selection/focus remains source-owned.

No valid current entry must produce an explicit **Select an item to preview** state.

HARD requirement: when source becomes invalid/null, do not keep showing the old file as if it were still current. Revoke/suppress stale Preview publication and render the empty/select-item state truthfully.

### 5. Unpin / close behavior

Closing or unpinning Pinned Preview:

- disposes/revokes Preview-specific host/session state according to the existing lifecycle owner;
- removes sibling-navigation state/window;
- does not leave a hidden Preview selection model;
- returns Context to Inspector when the current source-owned selection supports Inspector;
- otherwise returns to the normal W2 no-selection Context state.

Unpinning must not modify durable Library query/selection truth merely to manufacture an Inspector target.

### 6. Sibling navigation is a bounded workspace projection

Previous/Next is not a Preview query engine.

The owning source surface supplies a bounded navigation projection tied to the current collection generation.

Library:

- derive navigation from the current loaded Query V2-backed presentation/focus owner;
- never enumerate/materialize compact `all_matching` selection;
- never issue a second independent Library query merely to support Preview navigation;
- the navigation window may contain only the bounded currently available presentation neighborhood plus whatever normal owning-surface progression already supports.

Browse:

- use only loaded/current-generation authoritative entries;
- never invent unloaded/unseen siblings from paths;
- if more entries are needed, request the **owning Browse surface** to advance through its normal pagination/enumeration mechanism;
- Preview must not call a second Browse enumeration engine behind the source owner.

Every navigation window must be generation/provenance-bound. If collection/query/enumeration generation changes, discard stale navigation state rather than navigating against old ordering.

### 7. Previous / Next updates workspace focus

Sibling navigation keeps Preview and workspace coherent.

When Previous/Next is accepted:

1. ask the owning Library/Browse interaction/source owner to move the current focus/active entry;
2. preserve that owner's selection semantics rather than creating hidden Preview selection;
3. let the existing Preview source-follow behavior switch to the resulting source;
4. keep the Pinned/Floating host shell mounted where appropriate;
5. stale old navigation/source results may not publish.

Do not mutate selection through ad-hoc DOM focus or synthetic IDs outside the source owner.

If navigation is unavailable at an edge or while the source generation is stale, disable/fail closed rather than wrapping or guessing unless the existing frozen W0/W2 contract explicitly says otherwise.

### 8. Navigation window must be bounded

No W3-03 code may:

- request every ID for a 100k/1M Library result;
- expand `all_matching`;
- accumulate unbounded sibling arrays over repeated pagination;
- retain stale Browse generations;
- prefetch arbitrary Preview sources merely to make arrows feel instant.

The window should be just large enough to support current/previous/next and normal loaded-neighbor movement. If a wider bounded window is useful for UX, document its explicit limit and source owner.

### 9. Latest-wins semantics are inherited, not reimplemented

W3-02 already established:

- frontend request/source stale rejection;
- `FileWorkspaceController` Preview cache publication guard;
- per-`previewId` serialized `previewSwitchSource` mutations;
- one latest-wins pending switch slot;
- slow old `previewStart` does not block new source switch;
- stale switch/start does not dispose or overwrite the live newest session.

Pinned focus-follow and sibling navigation must use these same seams.

Do not build a second Pinned-only request sequence/queue that can diverge from Floating Preview.

Add deterministic tests proving rapid pinned A -> B -> C/D movement finishes with:

- Pinned UI source = latest;
- Preview snapshot = latest;
- `FileWorkspaceController` cache = latest;
- authoritative mock backend record = latest;
- no spurious cancel/dispose;
- one Pinned Context host.

### 10. Pin control and host controls

W3-02 deferred Pin behavior. W3-03 makes Pin real.

Floating host:

- Pin is keyboard reachable and capability/host-state truthful.
- successful Pin performs the bounded handoff and closes Floating.

Pinned host:

- Unpin/Close is keyboard reachable;
- Previous/Next appear only when the bounded navigation projection says they are available;
- Open/Reveal remain capability-driven and may not be fabricated;
- no format-specific rich controls, mutation controls, AI actions or raw paths.

Metadata fallback remains a valid Pinned content state.

### 11. Context responsiveness and interaction ownership

Pinned Preview is non-modal.

At 1600x900:

- Context Preview is inline in the existing Context Panel model;
- List/Grid remains interactable;
- focus movement updates Preview without trapping focus in Context.

At minimum 980x680:

- reuse existing compact Context sheet/overlay behavior;
- do not create a second side sheet;
- no horizontal overflow;
- no dual modal/focus trap with Floating Preview;
- if Pin is invoked from Floating while compact Context is closed, handoff may open the existing Context surface through its existing owner;
- after handoff, Floating closes and only the normal compact Context ownership remains.

### 12. Floating/Context coherence

Frozen behavior:

- opening Floating Preview does not automatically switch Context to Preview;
- closing Floating does not mutate Context unless the user explicitly pinned;
- Pin explicitly changes Context to Preview;
- Pinned Preview follows current focus independently of Floating;
- do not keep Floating and Pinned duplicates for the same current source by default.

If a higher-priority existing modal/context state makes handoff invalid, fail closed through existing ownership rather than stacking overlays.

### 13. Metadata and Inspector authority remain separate

Pinned Preview may display Metadata fallback from Preview Core.

It does not merge Inspector metadata ownership into Preview Core and does not replace W2 Inspector state/data authority.

On Unpin:

- return to the current Inspector/no-selection model;
- do not copy Preview snapshot data into Inspector as new truth.

### 14. Legacy compatibility

Do not mass-delete legacy Preview/Vault/Inspector Quick Look paths in W3-03.

A narrow preview-specific caller may only be redirected/removed if:

- the new Pinned/Floating path fully owns that caller;
- focused behavioral and real-browser equivalence is demonstrated;
- doing so does not satisfy or falsely close broader TD-015 exit conditions.

Prefer keeping W3-03 focused on Pinned host + sibling navigation.

## Required implementation boundaries

### Allowed production changes

- extend existing frontend Preview experience/controller/provider for host kind and Pin/Unpin coordination;
- existing Context Panel controller/model/components/styles needed to add the Preview state;
- a bounded sibling-navigation projection/contract owned by current source presentation;
- Library/Browse adapters/source-owner methods needed to move focus through normal ownership;
- Floating host Pin control wiring;
- Pinned Preview host component inside existing Context surface;
- narrow accessibility/i18n strings;
- mock/test/browser support and a W3-03 browser gate/package script.

### Not allowed

- second Preview engine/session authority;
- independent Pinned Preview global store;
- second Query V2 or Browse enumeration engine;
- `all_matching` materialization;
- renderer raw filesystem paths;
- new generic byte-read/materialization API;
- new Rust rich provider;
- Text/Markdown/JSON/Table/Image/Folder/ZIP provider work from W3-04+;
- W4 Finder/Explorer native system host integration;
- new file mutation/recovery actions;
- automatic provider/cloud hydration;
- schema migration;
- broad TD-015 compatibility cleanup.

## Required tests

### A. Context state ownership

- Inspector remains default selected-entry state.
- Pin explicitly changes existing Context to Preview.
- Pinned Preview uses one existing Context surface, not a second panel.
- Unpin returns Inspector where valid.
- no selection/current source returns normal no-selection Context after Unpin.
- no Preview-specific hidden selection survives disposal.

### B. Floating -> Pinned handoff

Use deterministic mocks:

- open Floating A;
- invoke Pin;
- Pinned host receives typed A source/session intent;
- no raw path is transferred;
- successful handoff closes Floating;
- exactly one current Preview lifecycle authority remains;
- no duplicate Floating/Pinned shell for A;
- failure during handoff leaves a truthful safe state and does not orphan/duplicate session work.

### C. Pinned focus-follow

- Library A -> B -> C focus changes keep Pinned Context mounted;
- Browse A -> B -> C same behavior;
- no valid current source immediately clears stale representation into select-an-item state;
- returning to a valid source starts/switches normally;
- late A/B start/switch results never flash in C.

### D. Latest-wins backend truth

Use deferred source switches, no sleeps:

- B switch in flight;
- request C then D while B pending;
- at most one backend switch is in flight;
- pending slot coalesces to D;
- resolving B does not publish B as final current state;
- D becomes the next backend mutation;
- final Pinned UI, controller cache and mock backend record are D;
- slow A start does not block B/D switching;
- no spurious cancel/dispose.

Reuse the W3-02 transport seam rather than create a Pinned-specific queue.

### E. Library sibling navigation

- bounded previous/current/next projection from current loaded Library presentation;
- Previous/Next asks source owner to move focus;
- Preview follows resulting source;
- compact `all_matching` is never expanded;
- no second Query request solely for sibling navigation;
- edge state disables unavailable direction;
- collection/query generation change invalidates old navigation window.

### F. Browse sibling navigation

- only loaded/current-generation Browse entries are eligible;
- no path-based sibling invention;
- Previous/Next moves focus through Browse source owner;
- at loaded-page edge, normal owning Browse progression may be requested;
- Preview itself does not create a second enumeration;
- stale enumeration/generation window is rejected.

### G. Selection coherence

- multi-selection remains source-owned;
- Preview follows current focused/active entry only;
- sibling navigation does not invent a hidden Preview selection set;
- moving Preview sibling leaves workspace focus/selection in a coherent source-owned state.

### H. Floating / Pinned coherence

- opening Floating alone does not auto-pin Context;
- closing Floating alone does not change Context state;
- Pin changes Context to Preview and closes Floating;
- while pinned, Space/Floating behavior must not create duplicate conflicting host ownership;
- any supported transition between Pinned and Floating remains deterministic and single-authority.

If the freeze/current product contract does not define a direct Pinned -> Floating transition, do not invent one.

### I. Responsive / accessibility

Real DOM/browser coverage:

- large Context Preview non-modal and List/Grid still interactable;
- compact Context uses existing sheet/overlay only;
- no dual focus trap after Pin handoff;
- Pin, Unpin/Close, Previous/Next keyboard reachable;
- accessible names/status semantics;
- current source/no-source state announced without live-region spam;
- no horizontal overflow at 980x680;
- no console/page errors.

### J. Resource/lifecycle stability

- repeated Pin/Unpin cycles do not grow controllers/listeners/timers monotonically;
- source switches retain one current Preview session/host authority;
- close/unpin settles Preview-specific frontend resources;
- no hidden stale sibling window survives collection generation change.

## Real browser gate

Add:

`npm run test:browser:w3-03:real`

Follow existing W2/W3 browser-runner conventions and task-scoped artifacts.

Required viewports:

- 1600x900;
- 980x680.

The gate should cover at minimum:

1. Library List Floating -> Pin -> Pinned Context;
2. Library Grid Pinned focus-follow + Previous/Next;
3. Browse List Pinned focus-follow + bounded navigation;
4. Browse Grid equivalent;
5. no-current-source select-an-item state;
6. Unpin -> Inspector/no-selection restoration;
7. rapid source change while Pinned with stale-result suppression;
8. compact Context handoff without dual overlay/focus trap;
9. overflow, console and page-error checks.

Use deterministic deferred Preview mocks where lifecycle ordering is under test. Do not prove correctness with arbitrary `sleep()` timing.

## Performance/resource expectations

W3-03 does not own final W3-10 performance qualification, but it must preserve established boundedness:

- Pin handoff must not require a second provider load merely because presentation moved hosts when the authoritative lifecycle can be reused safely;
- sibling navigation memory remains bounded to current projection/window;
- no 100k/1M ID materialization;
- source changes use the existing latest-wins switch transport;
- one current Preview experience/session authority;
- repeated Pin/Unpin does not leak observers/listeners/timers;
- existing W2 List/Grid/query performance thresholds remain unchanged.

Do not invent a new hard hosted timing threshold unless the existing harness can measure it reproducibly.

## Validation

Run focused W3-03 tests first, then current applicable repository gates. At minimum:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend
npm run test:browser:w3-03:real
npm run test:governance
git diff --check
git diff --check origin/master...HEAD
```

Run Rust/security/package lanes only when actual changed scope or repository routing requires them. W3-03 is expected to be frontend/Context/presentation work; do not touch Rust merely to make the Track look more comprehensive.

Hosted CI remains authoritative for routed platform lanes.

## Maintainability gate

Before finalizing, report and verify:

- the single Preview experience/lifecycle orchestration owner after W3-03;
- how Floating and Pinned presentations share that owner;
- the single Context state owner;
- the single Library/Browse sibling navigation source-owner seam;
- no giant state machine was pushed into `FileLibraryWorkspace`;
- no duplicated lifecycle logic appears separately in Floating/Pinned/List/Grid;
- any new bounded navigation module has an explicit responsibility and size;
- no test-only production debug store/instrumentation;
- no unbounded retained sibling arrays.

If a newly modified UI/controller file becomes materially oversized or mixes source ownership, lifecycle and rendering responsibilities, refactor within Track scope rather than normalizing the debt.

## Security gate

W3-03 should require no new Tauri command or permission.

HARD:

- Pin handoff uses typed Preview identity, never raw paths;
- sibling navigation consumes source-owned refs, never reconstructs filesystem siblings;
- no renderer byte read/materialization seam;
- no implicit hydration;
- capability-gated actions only;
- Context Preview remains read-only.

If any new backend command, permission, raw-path field or generic read endpoint appears necessary, STOP for architecture review.

## Definition of Done

- exact baseline `master@52cca2039070d26f7fabfd7f2ac53cfb315bb79a` and isolated branch/worktree recorded;
- existing PreviewExperience architecture is extended rather than duplicated;
- Pinned Preview is an explicit existing Context Panel state;
- Pin handoff is typed, bounded and single-authority;
- successful Pin closes Floating by default;
- Pinned Preview follows current valid source-owned focus;
- no current source shows explicit select-an-item state with no stale old content;
- Unpin/close returns Inspector/no-selection coherently;
- sibling navigation is bounded and generation-bound;
- no second Query/Browse engine and no `all_matching` materialization;
- Previous/Next updates source-owned workspace focus/active entry;
- Library/Browse List/Grid parity proven;
- inherited latest-wins/backend-truth guarantees retained and deterministically tested;
- responsive large/compact Context behavior proven;
- accessibility/keyboard ownership preserved;
- no rich provider, Rust/Tauri, W4, schema, raw path, generic read or mutation expansion;
- focused and applicable full tests pass;
- real-browser W3-03 gate passes at 1600x900 and 980x680;
- task-owned temporary artifacts cleaned;
- final worktree clean;
- one Draft PR created on this branch and left OPEN / DRAFT / UNMERGED for independent review.

## Stop conditions

Stop and report rather than expanding scope if W3-03 appears to require:

- a second Preview lifecycle/publication authority;
- a second global Pinned Preview store;
- a second Context Panel/sheet;
- a second Query V2/Browse enumeration engine;
- all-result materialization for sibling navigation;
- raw filesystem paths;
- a new renderer byte-read/materialization API;
- a schema migration;
- a new Tauri permission/command architecture;
- W3-04+ rich provider implementation;
- W4 Finder/Explorer native host integration;
- hidden duplicate Floating/Pinned sessions to make handoff easier.

## Final report

Return:

1. preflight branch/base/head/worktree evidence;
2. changed production/test files;
3. final PreviewExperience ownership model;
4. Context state ownership and Inspector <-> Preview transitions;
5. Floating -> Pinned handoff lifecycle;
6. Pinned source-follow behavior and no-source state;
7. Library sibling-navigation boundedness/evidence;
8. Browse sibling-navigation boundedness/evidence;
9. `all_matching` non-materialization evidence;
10. rapid-switch/backend-truth evidence;
11. responsive/accessibility behavior;
12. browser gate results;
13. local validation;
14. hosted exact-head CI / ADR-0004 lane evidence;
15. maintainability/module line-count review;
16. cleanup;
17. deferred/unverified items;
18. Draft PR URL/state.

Do not Ready, merge, start W3-04+ or perform current-truth closeout inside the implementation PR.
