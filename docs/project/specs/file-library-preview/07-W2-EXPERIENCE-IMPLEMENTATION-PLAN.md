# W2 — File Library 2.0 Experience Implementation Plan

Status: proposed implementation plan — specification only until reviewed/merged

Planning baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`

Initiative: [`../../initiatives/W2-file-library-experience.md`](../../initiatives/W2-file-library-experience.md)

## 1. Purpose

W2 turns the completed W1 Foundation into the user-facing File Library 2.0 workspace. It must preserve the W0/W1 authority model while replacing the current managed-only/List-centric File Library surface with one calm workspace that supports both semantic Library work and familiar filesystem Browse work.

W2 is **experience integration**, not a backend authority rewrite and not the Preview Platform Wave.

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
- Library targets use titles/context, not fake filesystem breadcrumbs;
- Browse targets use real breadcrumbs and W1 live opaque refs;
- cross-process restore re-admits Browse through non-authoritative restore locator only.

### 2.2 Platform model

macOS and Windows share concepts, not identical chrome.

macOS Browse navigation should naturally expose Favorites/Locations/Providers concepts where evidence allows. Windows should naturally expose Home/Quick Access, This PC, Cloud and Network concepts where evidence allows. Capability state remains fail-closed and must not be invented from path strings.

### 2.3 Context Panel boundary

W2 implements Inspector-oriented Context Panel behavior for selection and an architectural slot for later Preview state. W3 owns the actual pinned/floating Quick Preview host and rich providers. W2 must not implement W3 under the name of a Context Panel.

## 3. Current implementation reality

W2 starts from two separate frontend worlds:

1. Existing managed File Library UI:
   - `src/components/AppShell.tsx` routes `view === "library"` directly to `VaultView`;
   - `src/views/vault/VaultView.tsx` is a large managed-Library orchestration surface covering Query V2, selection, filters/sort, Inspector, context menu and legacy Preview dialog behavior;
   - existing `FileLibraryList`, Inspector, saved-view/tag and Query V2 stores are useful assets and must not be discarded merely to create a new shell.

2. W1 File Workspace Foundation:
   - `src/fileWorkspace/workspaceSession.ts` owns live navigation chronology/publication semantics;
   - `src/fileWorkspace/fileWorkspaceController.ts` owns W1 integration resource lifecycle;
   - `src/api/fileWorkspaceApi.ts` / Tauri integration expose bounded Browse/Location/Thumbnail/Preview-core seams;
   - these are deliberately not yet the visible File Library UX.

The migration therefore must be **strangler-style**: establish the new shell and adapters first, then move responsibilities out of `VaultView` incrementally. Do not add Browse/Grid/new navigation directly into the existing monolith.

## 4. Binding architecture rules

1. Query V2 remains managed Library query authority.
2. `LibrarySelectionV1`/existing Library selection semantics are preserved unless a reviewed adapter proves equivalent behavior.
3. Browse authority remains W1 session-scoped opaque refs; UI must not retain or fabricate raw-path authorization.
4. Common UI view models normalize presentation only; they do not become a new durable source of truth.
5. No implicit scan-root creation/indexing when Browse opens unmanaged locations.
6. Thumbnail work uses W1 ThumbnailService through the W1 integration API, with visible/viewport bounded demand.
7. No implicit cloud/provider hydration for thumbnails/metadata/selection UI.
8. Context Panel does not gain direct content-byte authority.
9. Target switch/history changes must preserve W1 cancellation/stale-publication semantics.
10. Large collections use progressive data + virtualized/bounded UI; no 100k DOM/render assumption.
11. W2 must not expand existing oversized modules without a maintainability review/decomposition plan.
12. W3 Preview UI/providers and W4 native system hosts remain out of scope.

## 5. Experience state model

W2 should introduce a small frontend-owned experience/projection state that references, rather than replaces, source authorities.

Suggested conceptual state:

```text
FileLibraryExperienceState
├─ mode: library | browse
├─ navigation: WorkspaceSession snapshot/reference
├─ activeTargetPresentation
│  ├─ presentation: list | grid
│  ├─ sortKey / display options where source permits
│  └─ contextPanel state
├─ selection projection
├─ current search/filter presentation state
└─ platform navigation projection
```

Do not persist process-local Browse session/path/entry refs. If presentation preference persists across process restart, its key must derive from a stable Library target key or a stable non-authoritative Browse presentation/restore key.

## 6. Track graph

```text
W2-00 Specification review / implementation activation
                 ↓
W2-01 Workspace Shell + Experience Controller
                 ↓
W2-02 Shared Presentation / Entry / Selection Contracts
            ┌────┴────┐
            ↓         ↓
W2-03 Library Mode   W2-04 Browse Mode
Adapter/Migration    Navigation + Content
            └────┬────┘
                 ↓
        ┌────────┼────────┐
        ↓        ↓        ↓
W2-05 List   W2-06 Grid  W2-07 Context Panel
        └────────┼────────┘
                 ↓
        ┌────────┴────────┐
        ↓                 ↓
W2-08 Search/Filter/   W2-09 Platform Nav /
Sort/Preferences       Managed-Unmanaged UX
        └────────┬────────┘
                 ↓
W2-10 Interaction / Accessibility / Responsive Integration
                 ↓
W2-11 Experience Performance / Cross-platform QA
                 ↓
W2-12 Closeout
```

Parallel Tracks require separate worktrees/branches and must not edit shared hotspots concurrently without an integration owner.

## 7. Tracks

### W2-00 — Specification review / implementation activation

Goal: finish the planning PR, independently review W2 scope/graph, then explicitly authorize production work.

Deliverables:

- reviewed W2 initiative + implementation plan;
- `STATUS.md` / `ROADMAP.md` current truth;
- implementation-activation taskbook;
- initiative transitions from `active — specification only` to `active — implementation` only after plan approval.

Non-goal: production UI changes.

Exit gate: scope, dependencies, authority boundaries and QA requirements accepted.

---

### W2-01 — Workspace Shell + Experience Controller

Goal: create the user-facing File Library workspace owner without rewriting Library or Browse source logic.

Expected shape:

- new `src/views/fileLibrary/` workspace boundary;
- `FileLibraryWorkspace` becomes the `AppShell` library route;
- lightweight Library/Browse segmented mode control;
- shared three-pane layout slots: Navigation / Content / Context;
- experience controller/adaptor binds W1 WorkspaceSession and mode history;
- existing Library UI initially mounts through a Library adapter rather than being rewritten in the same PR.

Must preserve:

- one top-level File Library route;
- global AppShell/Spotlight behavior;
- current Query V2 functionality;
- W1 in-process navigation semantics.

Maintainability gate:

- do not move the 40KB+ `VaultView` wholesale into a new larger file;
- new workspace shell must remain orchestration-only;
- shared hotspots: `AppShell.tsx`, navigation context/type definitions and File Workspace controller wiring have one integration owner.

Exit gate: empty shell can switch Library/Browse target state with deterministic Back/Forward/mode-memory tests; no new product data authority.

---

### W2-02 — Shared Presentation / Entry / Selection Contracts

Goal: define the minimal view-model boundary that lets List/Grid/Context render either managed Library summaries or Browse entries without collapsing their source authorities.

Define source-tagged presentation contracts such as:

- stable UI key valid for current source lifetime;
- display name/type/icon/size/modified metadata when known;
- folder/file kind;
- availability/capability projection;
- source-specific operation handle/reference;
- thumbnail request identity/seam;
- selection/focus projection.

Rules:

- source tag remains explicit (`library` vs `browse`);
- no fake persistent FileIdentity for ephemeral Browse;
- missing metadata remains unknown, not fabricated;
- selection actions route back to source owner;
- view model must be cheap enough for virtualized 100k logical sets.

Exit gate: adapter contract tests prove Library and Browse can share rendering primitives without sharing authority.

---

### W2-03 — Library Mode Adapter / Migration

Goal: preserve existing managed Library capabilities while fitting them into the new workspace.

Required preservation:

- Query V2 paging/search/filter/sort;
- saved views/tags;
- existing selection semantics;
- Inspector detail/selection summary;
- operation/reveal/context actions that already have established authorities;
- no Query V3.

Refactor policy:

- progressively extract orchestration from `VaultView` into Library-mode controller/components;
- do not mix Browse session state into Query V2 stores;
- existing legacy compatibility store is removed only if the TECH_DEBT deletion condition/equivalence proof is satisfied.

Exit gate: existing Library regression tests pass through the new workspace, and behavior parity is documented.

---

### W2-04 — Browse Mode Navigation + Content

Goal: expose W1 Ephemeral Browse as a Finder/Explorer-familiar current-folder experience.

Required behavior:

- location navigation sourced from W1 Location projection;
- open managed or unmanaged location without implicit admission;
- progressive current-folder pages;
- real Browse breadcrumbs with older-ancestor collapse;
- same-session child navigation with exact live path refs;
- Back/Forward and Library↔Browse history correctness;
- change/refresh hints update current target without becoming managed watcher truth;
- current-folder bounded search/filter only for arbitrary unmanaged Browse;
- unavailable/permission/provider unknown states fail closed and remain visible.

Exit gate: real local filesystem Browse works on Windows and macOS with navigation/cancellation/history tests; no unmanaged recursive search engine.

---

### W2-05 — Virtualized List Presentation

Goal: replace source-specific list rendering with shared high-scale List presentation.

Required behavior:

- virtualized/bounded mounted rows;
- deterministic keyboard focus independent from mounted DOM lifetime;
- multi-select, shift-range, Ctrl/Cmd toggle, Select All semantics appropriate to source capability;
- configurable columns where useful without exposing low-value telemetry;
- folders/files and availability states represented clearly;
- current visible rows drive thumbnail/metadata priority only when needed;
- no full 100k array-to-DOM render.

Library may adapt the existing `FileLibraryList`; Browse must use the same presentation contract rather than copy/paste another list.

Exit gate: 100k logical dataset interaction remains responsive with bounded mounted rows and stable focus/selection tests.

---

### W2-06 — Virtualized Grid + Thumbnail Integration

Goal: provide Grid presentation using shared W1 Thumbnail infrastructure.

Required behavior:

- semantic thumbnail variants mapped to cell geometry/scale;
- viewport + overscan bounded request ownership;
- cancel obsolete/offscreen work;
- placeholder/fallback for unsupported/unavailable/materialization-required sources;
- no implicit hydration;
- folder and non-thumbnailable item representation remains usable;
- Grid selection/focus semantics match List at the product level;
- target-specific List/Grid choice is remembered safely.

Exit gate: rapid scroll/switch does not leak/cross-publish thumbnails and large-grid rendering remains bounded.

---

### W2-07 — Context Panel / Inspector

Goal: turn the current Inspector behavior into a shared Context Panel that appears only when useful.

States in W2:

- no selection -> hidden/collapsed;
- one selection -> Inspector;
- multi-selection -> bounded selection summary where source authority supports it;
- reserved Preview state seam -> no W3 rich Preview implementation.

Rules:

- Library detail continues existing Library inspector authority;
- Browse Inspector uses metadata/capability projection available through W1 seams and must not open arbitrary bytes directly;
- panel should not permanently consume width when there is no useful context;
- narrow layouts may use overlay/sheet behavior rather than compressing content below usability.

Exit gate: selection switch/cancel/stale detail behavior is correct and accessible.

---

### W2-08 — Search / Filter / Sort / Per-target Presentation Preferences

Goal: make controls coherent across modes without pretending sources have identical capabilities.

Library:

- Query V2 search/filter/sort and smart/saved views remain authoritative.

Browse:

- current-folder client/bounded filtering over enumerated data is guaranteed;
- recursive current-location search is shown only when an existing managed/indexed authority can safely satisfy it;
- arbitrary unmanaged recursive search is not introduced.

Preferences:

- remember List/Grid and source-appropriate sort/display preferences by meaningful target;
- Library target keys may be durable when existing stable identifiers permit;
- Browse persistence must use stable non-authoritative presentation/restore keys, never session tokens/path refs as durable authority;
- avoid DB schema changes unless existing preference persistence cannot safely satisfy the requirement and a separate review approves the change.

Exit gate: mode/target switch restores expected presentation without leaking source-specific invalid state.

---

### W2-09 — Platform-adaptive Navigation + Managed/Unmanaged UX

Goal: complete the navigation rail and platform-specific familiarity layer.

macOS concepts:

- Favorites;
- local/external Locations;
- Providers such as iCloud only when W1/runtime evidence exposes them safely.

Windows concepts:

- Home/Quick Access-style favorites;
- This PC / drives;
- Cloud/provider entries;
- Network/mapped/UNC where runtime evidence safely supports projection.

Shared behavior:

- explicit `Add this location to Library` action routes through existing scan-root/admission authority;
- managed/unmanaged status is understandable but not visually noisy;
- no path-string guessing of provider/volume capability;
- Browse remains useful when Library is empty.

Exit gate: supported-platform navigation hierarchy and empty/offline states are visually reviewed on real Windows/macOS builds; missing provider fixtures remain UNVERIFIED.

---

### W2-10 — Interaction / Accessibility / Responsive Integration

Goal: make the whole workspace behave as one product rather than a set of individually working panels.

Required matrix:

- minimum 980×680 layout;
- sidebar/content/context collapse rules;
- breadcrumb responsive collapse;
- keyboard-only navigation;
- focus restoration after dialogs/context menus/mode switch;
- screen-reader roles/labels for mode control, lists/grids, selection count and Context Panel;
- reduced-motion behavior;
- Windows DPI and macOS Retina checks;
- mouse, trackpad and keyboard context-menu affordances;
- no collision between application hotkeys and OS-reserved shortcuts.

Space Quick Preview remains W3 unless a no-op/disabled command seam is required for future integration.

Exit gate: accessibility/focus/responsive visual QA has explicit evidence on both supported platforms.

---

### W2-11 — Experience Performance / Cross-platform QA

Goal: prove the W2 UI is viable at scale and does not regress W1 authorities.

HARD evidence:

- 100k logical Browse presentation with bounded mounted List/Grid cells;
- progressive first useful content without full enumeration/render;
- rapid target/mode switching does not publish stale results;
- thumbnail request ownership returns to steady state after scroll/target change;
- Browser/session/path/entry refs remain within W1 caps and return to steady state after disposal;
- Query V2 100k/1M thresholds remain unchanged/green;
- no unbounded React memory/listener/observer growth under repeated navigation/presentation switching;
- keyboard/focus remains deterministic under virtualization;
- Windows and Apple Silicon macOS release-build evidence.

TARGET/OBSERVED evidence:

- first-content and interaction latency;
- mounted row/cell counts;
- thumbnail request concurrency/cache observations;
- RSS/handles/FD where useful;
- Scheduler 2× idle TARGET MISSED remains visible and is not silently reclassified.

Real provider/network/external fixtures stay UNVERIFIED unless actually exercised.

Exit gate: no W2 HARD blocker remains.

---

### W2-12 — Closeout

Goal: converge current truth only after W2 implementation/QA is reviewed.

Update:

- `STATUS.md`;
- `ROADMAP.md`;
- W2 initiative;
- merge/evidence ledger;
- known TARGET MISSED / UNVERIFIED matrix;
- branch/temp hygiene inventory.

No new product behavior belongs in W2-12.

## 8. Parallelization plan

After W2-02 contracts merge:

- W2-03 Library Mode and W2-04 Browse Mode may run in parallel in separate worktrees;
- W2-05 List, W2-06 Grid and W2-07 Context Panel may run in parallel only after the shared presentation contract is stable;
- W2-08 and W2-09 may overlap after both source modes expose stable navigation/presentation seams;
- W2-10 is an integration Track and owns shared UX hotspots;
- W2-11 follows integrated W2 product behavior.

Avoid parallel writes to:

- `src/components/AppShell.tsx`;
- shared File Library workspace root/controller;
- shared presentation/selection types;
- global navigation context;
- global CSS/design tokens;
- `STATUS.md` / `ROADMAP.md`.

Use a designated integration owner for those hotspots.

## 9. Maintainability rules for W2

W2 starts with known large frontend modules, especially the existing managed File Library surface. Therefore:

- do not add independent responsibilities to `VaultView.tsx` merely because Library functionality already lives there;
- new workspace, navigation, presentation, selection and Context responsibilities require separate cohesive modules;
- 500–800 LOC triggers a cohesion check;
- 1000+ LOC normally requires decomposition or explicit justification;
- tests should follow responsibility boundaries rather than one giant W2 test file;
- do not duplicate List/Grid source-specific rendering trees when adapters can share presentation components;
- do not turn a global Zustand store into a dumping ground for ephemeral Browse state already owned by `WorkspaceSession`/controller.

Refactoring existing large modules is allowed when required for W2 migration, but behavior-preserving extraction should be separated from product behavior where practical.

## 10. Test-artifact hygiene

- task-owned fixtures/cache/temp live on the worktree/repository drive, not the system C: drive by default;
- 100k UI/performance fixtures must be ignored/task-scoped and cleaned after validation;
- do not delete shared Cargo/node caches as task cleanup;
- report any intentionally retained reusable fixture cache and owner;
- worktree must be clean at Track handoff.

## 11. Stop / escalate conditions

Stop and request architecture review if a Track appears to require:

- Query V3;
- a second managed watcher/reconciliation authority;
- a second Read Gate/content-read authority;
- a second WorkScheduler;
- new durable Browse-session/path/entry persistence;
- schema change only to simplify UI state;
- arbitrary recursive unmanaged filesystem search;
- automatic provider hydration;
- W3 rich Preview UI/provider implementation;
- W4 native system extension/handler implementation;
- mutation/recovery authority changes.

Do not solve a missing capability by silently crossing a Wave boundary.

## 12. Standard Track workflow

For every production Track:

1. start from current reviewed master;
2. read this plan + initiative + relevant W0/W1 contracts;
3. record scope/non-goals/DoD in a taskbook;
4. use isolated branch/worktree;
5. implement only the Track contract;
6. run focused tests then applicable full checks;
7. clean task-owned artifacts;
8. push and keep PR Draft;
9. report exact-head CI/evidence/unverified areas;
10. perform independent architecture/code/UX/maintainability review;
11. fix blockers on the same PR and re-review;
12. Ready + squash merge only with reviewed exact head.

CI green alone is not approval.

## 13. W2 release criteria

W2 is complete only when:

- Library/Browse workspace shell is the real File Library route;
- existing managed Library capabilities are preserved through the new architecture;
- unmanaged Browse is first-class and does not implicitly become managed;
- List/Grid/Context Panel work across both source modes where capability permits;
- per-target navigation/presentation state behaves correctly;
- supported-platform UX is visually and interactively validated;
- 100k UI presentation is bounded and responsive enough for the frozen targets;
- no W2 HARD correctness/accessibility/resource blocker remains;
- W1 authority/performance gates are preserved;
- TARGET MISSED / UNVERIFIED evidence remains honest;
- W2-12 current-truth closeout is independently reviewed and merged.

W2 completion does **not** mean W3 Preview Platform, W4 Native Integration or W5 Release is complete.
