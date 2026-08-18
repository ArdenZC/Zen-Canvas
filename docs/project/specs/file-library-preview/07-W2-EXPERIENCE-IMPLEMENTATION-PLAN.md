# W2 — File Library 2.0 Experience Implementation Plan

Status: reviewed implementation plan — W2-01 implementation is in Draft PR #90 pending final closeout review/merge; W2-02+ not started

Planning baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`

Initiative: [`../../initiatives/W2-file-library-experience.md`](../../initiatives/W2-file-library-experience.md)

Current truth (2026-08-18): the reviewed W2 plan is active for bounded
implementation. W2-01 is present on Draft PR #90 at production exact head
`48ce853cce5989749ddf19a3b880bc02446625ff`; no W2 production code has merged to
`master`. W2-02 and later Tracks remain deferred and unstarted. The historical
status wording retained in later governance notes describes the pre-activation
record and does not change the reviewed design conclusions.

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
- cross-process restore re-admits Browse through non-authoritative restore locator only;
- semantic targets/history entries own chronology; transient search keystrokes, sort changes and filter edits do not create navigation entries unless explicitly committed as a semantic target.

### 2.2 Platform model

macOS and Windows share concepts, not identical chrome.

macOS Browse navigation should naturally expose Favorites/Locations/Providers concepts where evidence allows. Windows should naturally expose Home/Quick Access, This PC, Cloud and Network concepts where evidence allows. Capability state remains fail-closed and must not be invented from path strings.

### 2.3 Context Panel boundary

W2 implements Inspector-oriented Context Panel behavior for selection and an architectural slot for later Preview state. W3 owns the actual pinned/floating Quick Preview host and rich providers. W2 must not implement W3 under the name of a Context Panel.

The existing Vault Preview dialog/Space behavior is treated as compatibility behavior during strangler migration. It may be preserved temporarily to avoid regression, but W2 must not promote it into the new shared Quick Preview/provider architecture. Any intentional removal/change requires explicit behavior tests and migration notes.

### 2.4 App shell versus File Library workspace shell

Zen already has application-level chrome and navigation in `AppShell`.

Binding ownership:

- `AppShell` titlebar/window controls/global Spotlight and primary product sidebar remain application-level;
- `FileLibraryWorkspace` owns only File Library-local mode/navigation/toolbar/content/context UI;
- W2 must not introduce a second app-level titlebar/sidebar/PageHeader hierarchy inside File Library;
- minimum-width collapse ownership is designed in W2-01, not postponed until final accessibility polish.

## 3. Current implementation reality

W2 starts from two separate frontend worlds:

1. Existing managed File Library UI:
   - `src/components/AppShell.tsx` routes `view === "library"` directly to `VaultView`;
   - `src/views/vault/VaultView.tsx` is a large managed-Library orchestration surface covering Query V2, selection, filters/sort, Inspector, context menu and legacy Preview dialog behavior;
   - existing `FileLibraryList`, Inspector, saved-view/tag and Query V2 stores are useful assets and must not be discarded merely to create a new shell.

2. W1 File Workspace Foundation:
   - `src/fileWorkspace/workspaceSession.ts` owns live navigation chronology/publication semantics and history-scoped presentation state;
   - `src/fileWorkspace/fileWorkspaceController.ts` owns W1 integration resource lifecycle;
   - `src/api/fileWorkspaceApi.ts` / Tauri integration expose bounded Browse/Location/Thumbnail/Preview-core seams;
   - these are deliberately not yet the visible File Library UX.

The migration therefore must be **strangler-style**: establish the new shell and adapters first, then move responsibilities out of `VaultView` incrementally. Do not add Browse/Grid/new navigation directly into the existing monolith.

## 4. Binding architecture rules

1. Query V2 remains managed Library query authority.
2. `LibrarySelectionV1` remains Library selection authority, including compact `all_matching` query-fingerprint/snapshot/exclusion semantics; shared UI code must not materialize it into a giant ID list.
3. Browse authority remains W1 session-scoped opaque refs; UI must not retain or fabricate raw-path authorization.
4. Common UI view models normalize presentation only; they do not become a new durable source of truth.
5. W1 `WorkspaceSession` is the single live owner of history presentation state (`viewMode`, `scrollAnchor`). Durable per-target preferences are only non-authoritative defaults for targets without live history state.
6. Query V2/source stores own Library search/filter/sort semantics. Browse experience/source state owns Browse current-folder search/filter/sort semantics. A shared W2 store must not become a second query authority.
7. No implicit scan-root creation/indexing when Browse opens unmanaged locations.
8. Thumbnail work uses W1 ThumbnailService through the W1 integration API, with visible/viewport bounded demand.
9. No implicit cloud/provider hydration for thumbnails/metadata/selection UI.
10. Context Panel does not gain direct content-byte authority.
11. Target switch/history changes must preserve W1 cancellation/stale-publication semantics.
12. Large collections use progressive data + virtualized/bounded UI; no 100k DOM/render assumption.
13. Virtualization mount/unmount is presentation-only and must not mutate source selection authority.
14. Browse search/sort completeness must be truthful; loaded-page subsets cannot masquerade as whole-folder results/order.
15. W2 must not expand existing oversized modules without a maintainability review/decomposition plan.
16. W3 Preview UI/providers and W4 native system hosts remain out of scope.

## 5. Experience state and authority model

W2 may introduce a small frontend-owned experience/projection state, but every live field needs a named owner.

Conceptual shape:

```text
FileLibraryExperienceProjection
├─ mode: library | browse                 # W2 shell projection
├─ navigation: WorkspaceSession snapshot/reference
├─ live presentation
│  ├─ viewMode                            # WorkspaceSession history state
│  └─ scrollAnchor                        # WorkspaceSession history state
├─ durable presentation defaults?        # preference layer; non-authoritative seed only
├─ selection facade
│  ├─ library -> LibrarySelectionV1
│  └─ browse  -> Browse source-scoped selection state
├─ source query/filter/sort projection
│  ├─ library -> Query V2/source stores
│  └─ browse  -> current-folder Browse experience/source state
├─ contextPanel projection
└─ platform navigation projection
```

### 5.1 Live presentation authority

`WorkspaceSession` already owns history-scoped presentation state. W2 must not create a second live `activeTargetPresentation` authority.

Rules:

- Back/Forward restores the history entry's `viewMode`/`scrollAnchor` exactly;
- a durable per-target preference may seed a newly entered target only when no live history presentation exists;
- a durable preference must never overwrite a Back/Forward-restored live state;
- changing List/Grid in the current target updates the current `WorkspaceSession` presentation state first; persistence, if enabled, records only a non-authoritative future default;
- process-local Browse session/path/entry refs are never persistence keys/authority.

### 5.2 Selection facade

Shared List/Grid/Context components need a normalized UI facade, not a normalized data authority.

Library:

- preserve `LibrarySelectionV1` as-is;
- `all_matching` stays compact: query fingerprint + snapshot revision + exclusions;
- never expand all-matching selection into 100k IDs just to render shared UI;
- mounted rows/cells ask the Library selection authority whether each visible item is selected.

Browse:

- selection is explicitly source/enumeration scoped;
- Select All must state what scope is actually selected;
- if enumeration is incomplete and Browse has no source-level all-matching/all-current-folder contract, the UI cannot claim unseen entries are selected;
- mount/unmount/overscan changes never change selection truth.

### 5.3 Navigation-history commit policy

Not every UI change is navigation.

History commits include semantic target transitions such as:

- saved view/tag/smart-view target changes;
- Browse folder/path navigation;
- deliberate Library/Browse mode target switches;
- a search only when product design explicitly commits it as a semantic search target.

Transient edits do not push history:

- each search keystroke;
- sort direction/key changes;
- filter checkbox edits;
- List/Grid toggles;
- Context Panel open/close;
- ordinary selection changes.

These update their owning current source/presentation state without fabricating navigation chronology.

## 6. Track graph

```text
W2-00 Specification review / visual freeze / implementation activation
                 ↓
W2-01 Workspace Shell + Experience Controller
                 ↓
W2-02 Shared Presentation / Entry / Selection Contracts
            ┌────┴────┐
            ↓         ↓
W2-03 Library Mode   W2-04 Browse Mode
Adapter/Migration    Navigation + Content seams
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

### W2-00 — Specification review / visual freeze / implementation activation

Goal: finish the planning PR, independently review W2 scope/graph and interaction references, then explicitly authorize production work.

Deliverables:

- reviewed W2 initiative + implementation plan;
- `STATUS.md` / `ROADMAP.md` current truth;
- reviewed visual/interaction reference matrix;
- implementation-activation taskbook;
- initiative transitions from `active — specification only` to `active — implementation` only after plan + visual reference approval.

Required reference states before implementation activation:

- Library List;
- Library Grid;
- Browse List;
- Browse Grid;
- wide desktop layout;
- minimum 980×680 layout with defined navigation/context collapse behavior;
- single- and multi-selection with Context Panel;
- empty Library / Browse onboarding;
- unavailable/offline/permission/provider-unknown states;
- representative macOS and Windows chrome/navigation adaptations.

These may be reviewed wireframes/reference renders rather than production code, but they must be concrete enough to freeze hierarchy, control ownership, density and responsive behavior.

Non-goal: production UI changes.

Exit gate: scope, dependencies, authority boundaries, visual hierarchy and QA requirements accepted.

---

### W2-01 — Workspace Shell + Experience Controller

Goal: create the user-facing File Library workspace owner without rewriting Library or Browse source logic.

Expected shape:

- new `src/views/fileLibrary/` workspace boundary;
- `FileLibraryWorkspace` becomes the `AppShell` library route;
- lightweight Library/Browse segmented mode control;
- workspace-local Navigation / Content / Context slots;
- experience controller/adaptor binds W1 WorkspaceSession and mode history;
- existing Library UI initially mounts through a Library adapter rather than being rewritten in the same PR.

Shell ownership must be frozen here:

- existing `AppShell` titlebar/window controls/Spotlight/primary sidebar remain app-level;
- File Library navigation, mode control, content toolbar and Context Panel are workspace-local;
- do not duplicate app-level PageHeader/sidebar/titlebar hierarchy inside File Library;
- W2-01 must already render a structurally viable minimum 980×680 shell, including navigation/context collapse ownership; W2-10 polishes and validates behavior rather than rescuing a desktop-only structure.

Must preserve:

- one top-level File Library route;
- global AppShell/Spotlight behavior;
- current Query V2 functionality;
- W1 in-process navigation and live presentation semantics.

Maintainability gate:

- do not move the 40KB+ `VaultView` wholesale into a new larger file;
- new workspace shell must remain orchestration-only;
- shared hotspots: `AppShell.tsx`, navigation context/type definitions and File Workspace controller wiring have one integration owner.

Exit gate: shell can switch Library/Browse target state with deterministic Back/Forward/mode-memory tests; 980×680 hierarchy is viable; no new product data or presentation authority exists.

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
- source-owned selection/focus facade.

Rules:

- source tag remains explicit (`library` vs `browse`);
- no fake persistent FileIdentity for ephemeral Browse;
- missing metadata remains unknown, not fabricated;
- selection actions route back to source owner;
- Library `LibrarySelectionV1::all_matching` remains compact/query-owned and is never flattened into an ID set;
- visible Library cells derive selected state from `LibrarySelectionV1` membership semantics;
- Browse selection scope/completeness is explicit; no unseen-entry claim without source support;
- virtualization/mount state never becomes selection state;
- view model must be cheap enough for virtualized 100k logical sets.

Exit gate: adapter contract tests prove Library and Browse can share rendering primitives without sharing data/selection authority, including all-matching Library selection and incomplete Browse-enumeration cases.

---

### W2-03 — Library Mode Adapter / Migration

Goal: preserve existing managed Library capabilities while fitting them into the new workspace.

Required preservation:

- Query V2 paging/search/filter/sort;
- saved views/tags;
- `LibrarySelectionV1` including explicit and all-matching selection;
- Inspector detail/selection summary;
- operation/reveal/context actions that already have established authorities;
- no Query V3.

Navigation/history rule:

- semantic Library target changes such as saved view/tag/smart view may create history entries;
- transient search text, filter toggles, sort edits, selection and List/Grid changes do not spam navigation history;
- if a search becomes a deliberate semantic Library search target, that commit is explicit rather than one history entry per keystroke.

Legacy Preview compatibility:

- preserve existing Vault Preview dialog/Space behavior where needed for migration parity;
- do not refactor that compatibility behavior into a new shared Quick Preview command/provider architecture in W2;
- intentional change/removal requires focused behavior/focus-restoration tests and must preserve the W3 boundary.

Refactor policy:

- progressively extract orchestration from `VaultView` into Library-mode controller/components;
- do not mix Browse session state into Query V2 stores;
- existing legacy compatibility store is removed only if the TECH_DEBT deletion condition/equivalence proof is satisfied.

Exit gate: existing Library regression tests pass through the new workspace, all-matching selection remains compact/source-owned, navigation history is not polluted by transient query edits, and behavior parity is documented.

---

### W2-04 — Browse Mode Navigation + Content Seams

Goal: expose W1 Ephemeral Browse as a Finder/Explorer-familiar current-folder source and provide the truthful capability/completeness seams consumed by later shared controls.

Required behavior:

- location navigation sourced from W1 Location projection;
- open managed or unmanaged location without implicit admission;
- progressive current-folder pages;
- real Browse breadcrumbs with older-ancestor collapse;
- same-session child navigation with exact live path refs;
- Back/Forward and Library↔Browse history correctness;
- change/refresh hints update current target without becoming managed watcher truth;
- current-folder search/filter enumeration seam reports generation + completeness/partial state;
- sort capability seam reports whether whole-folder stable ordering is available, requires full enumeration, is partial, or unsupported;
- unavailable/permission/provider unknown states fail closed and remain visible.

Ownership boundary:

- W2-04 owns Browse source/navigation/enumeration/capability seams;
- W2-08 owns the final shared search/filter/sort controls, user-facing completeness messaging and preference behavior;
- do not implement duplicate source-specific toolbar controls in W2-04 that W2-08 later has to replace.

Exit gate: real local filesystem Browse works on Windows and macOS with navigation/cancellation/history/completeness tests; no unmanaged recursive search engine.

---

### W2-05 — Virtualized List Presentation

Goal: replace source-specific list rendering with shared high-scale List presentation.

Required behavior:

- virtualized/bounded mounted rows;
- deterministic keyboard focus independent from mounted DOM lifetime;
- multi-select, shift-range, Ctrl/Cmd toggle semantics route to the source selection authority;
- Library Select All preserves `all_matching` semantics rather than materializing all IDs;
- Browse Select All exposes only the scope guaranteed by its source contract; incomplete enumeration cannot silently imply unseen selection;
- mounted/unmounted row lifetime cannot alter selected/focused source state;
- configurable columns where useful without exposing low-value telemetry;
- folders/files and availability states represented clearly;
- current visible rows drive thumbnail/metadata priority only when needed;
- no full 100k array-to-DOM render.

Library may adapt the existing `FileLibraryList`; Browse must use the same presentation contract rather than copy/paste another list.

Exit gate: 100k logical dataset interaction remains responsive with bounded mounted rows and stable source-owned focus/selection tests, including all-matching Library selection.

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
- Grid selection/focus semantics use the same source-owned selection facade as List;
- mount/unmount does not change selection truth;
- target-specific List/Grid live state is written to `WorkspaceSession`; durable preference is only a future-target default.

Exit gate: rapid scroll/switch does not leak/cross-publish thumbnails, large-grid rendering remains bounded, and Back/Forward restores the exact live List/Grid presentation instead of being overwritten by a global preference.

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
- Library multi-selection summary consumes compact selection authority where supported rather than forcing all IDs into frontend memory;
- Browse Inspector uses metadata/capability projection available through W1 seams and must not open arbitrary bytes directly;
- panel should not permanently consume width when there is no useful context;
- narrow layouts use the W2-01-owned collapse/overlay model rather than compressing content below usability.

Exit gate: selection switch/cancel/stale detail behavior is correct and accessible for explicit and large/all-matching Library selection where applicable.

---

### W2-08 — Search / Filter / Sort / Per-target Presentation Preferences

Goal: make controls coherent across modes without pretending sources have identical capabilities.

Library:

- Query V2 search/filter/sort and smart/saved views remain authoritative;
- transient query edits stay in Query V2/source state and do not create WorkspaceSession history entries;
- only a deliberate semantic search/saved-view/tag target commit participates in navigation chronology.

Browse search/filter:

- arbitrary unmanaged Browse guarantees non-recursive **current-folder** search/filter only;
- search/filter may progressively publish matches while enumeration continues;
- UI state must expose `searching/partial` until the current-folder enumeration for the active generation completes;
- a result count is not labeled complete until enumeration completes;
- target/query generation changes revoke stale matches/publication;
- recursive current-location search is shown only when an existing managed/indexed authority can safely satisfy it;
- arbitrary unmanaged recursive search is not introduced.

Browse sort:

- sorting only the currently loaded pages must never be labeled as a globally sorted current folder;
- if source support can provide stable sorted enumeration, use that source contract;
- otherwise the UI may wait for complete current-folder enumeration before claiming global sort, expose an explicit partial/progressive ordering state, or restrict unsupported sort options;
- do not silently materialize unbounded data merely to make a toolbar sort label appear globally correct.

Preferences:

- `WorkspaceSession` remains live owner of `viewMode`/`scrollAnchor` for each history entry;
- remember durable List/Grid and source-appropriate display defaults only as non-authoritative defaults for targets entered without live history presentation;
- Back/Forward live presentation always wins over stored defaults;
- Library target keys may be durable when existing stable identifiers permit;
- Browse persistence must use stable non-authoritative presentation/restore keys, never session tokens/path refs as durable authority;
- avoid DB schema changes unless existing preference persistence cannot safely satisfy the requirement and a separate review approves the change.

Exit gate: mode/target/Back/Forward restores expected presentation without source-state leakage; Browse completeness/sort semantics remain truthful on late-page sentinel tests.

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
- Browse remains useful when Library is empty;
- File Library navigation stays workspace-local and does not compete with the app-level `AppShell` product sidebar.

Exit gate: supported-platform navigation hierarchy and empty/offline states are visually reviewed on real Windows/macOS builds; missing provider fixtures remain UNVERIFIED.

---

### W2-10 — Interaction / Accessibility / Responsive Integration

Goal: make the whole workspace behave as one product rather than a set of individually working panels.

Required matrix:

- minimum 980×680 layout using the structural ownership already established in W2-01;
- workspace navigation/content/context collapse rules without duplicating app-level chrome;
- breadcrumb responsive collapse;
- keyboard-only navigation;
- focus restoration after dialogs/context menus/mode switch;
- screen-reader roles/labels for mode control, lists/grids, selection count and Context Panel;
- reduced-motion behavior;
- Windows DPI and macOS Retina checks;
- mouse, trackpad and keyboard context-menu affordances;
- no collision between application hotkeys and OS-reserved shortcuts;
- compatibility test for any legacy Vault Space/Preview dialog behavior that still exists during migration.

Space Quick Preview's **new shared architecture** remains W3. W2 may preserve an existing compatibility behavior or provide a disabled/no-op future command seam, but must not introduce W3 providers/hosts under an interaction-polish Track.

Exit gate: accessibility/focus/responsive visual QA has explicit evidence on both supported platforms and legacy Preview compatibility has not accidentally crossed the W3 boundary.

---

### W2-11 — Experience Performance / Cross-platform QA

Goal: prove the W2 UI is viable at scale and does not regress W1 authorities.

HARD evidence:

- 100k logical **Library List and Grid** presentation where the presentation is supported, with bounded mounted rows/cells;
- 100k logical **Browse List and Grid** presentation where the presentation is supported, with bounded mounted rows/cells;
- progressive first useful content without full enumeration/render;
- Library `all_matching` selection remains compact and correct while only a virtual window is mounted;
- Browse incomplete-enumeration selection does not claim unseen entries without source support;
- Browse search regression places matches beyond early loaded pages and proves partial -> complete semantics;
- Browse sort regression places order sentinels beyond early loaded pages and proves partial-page sorting cannot masquerade as whole-folder ordering;
- rapid target/mode/search-generation switching does not publish stale results;
- Back/Forward restores live presentation state while durable preference defaults do not overwrite it;
- thumbnail request ownership returns to steady state after scroll/target change;
- Browse session/path/entry refs remain within W1 caps and return to steady state after disposal;
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
- W2-04 owns Browse source/navigation/completeness seams; W2-08 owns final shared search/filter/sort/preferences controls and completeness messaging, so those Tracks must not independently build duplicate Browse toolbars;
- W2-05 List, W2-06 Grid and W2-07 Context Panel may run in parallel only after the shared presentation/selection contract is stable;
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
- do not turn a global Zustand store into a dumping ground for ephemeral Browse state already owned by `WorkspaceSession`/controller;
- do not create a second live presentation or selection authority merely to simplify components.

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
- a second live presentation/selection authority competing with WorkspaceSession/LibrarySelectionV1;
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
- live per-history presentation and source-owned selection/query semantics behave correctly without duplicate authorities;
- Browse search/sort completeness remains truthful;
- supported-platform UX is visually and interactively validated;
- 100k Library and Browse UI presentation is bounded and responsive enough for the frozen targets;
- no W2 HARD correctness/accessibility/resource blocker remains;
- W1 authority/performance gates are preserved;
- TARGET MISSED / UNVERIFIED evidence remains honest;
- W2-12 current-truth closeout is independently reviewed and merged.

W2 completion does **not** mean W3 Preview Platform, W4 Native Integration or W5 Release is complete.
