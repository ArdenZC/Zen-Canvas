# W2 — File Library 2.0 Experience

Status: active — implementation

Owner: File Library / Experience

Start baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`

Reviewed plan baseline: `master@e91416c83082b61a0d3042c9438d77c7b8586297` (PR #86)

Reviewed visual/interaction baseline: `master@251bab36797cde4129656f57667ed203f20415e6` (PR #87)

Activation branch: `docs/w2-00-implementation-activation`

W2 starts only after W1 Foundation closeout and post-closeout audit remediation. The W2 implementation plan was independently re-reviewed and merged in PR #86, and the W2-00 visual/interaction freeze was reviewed and merged in PR #87. The implementation-activation change merged through PR #88. This initiative authorizes **W2 production implementation only within those reviewed W2 contracts**. W2-01 is merged, the R1/R2/R3/R4 consumer-boundary sequence is complete, W2-02 is complete through PR #101, W2-03 is complete through PR #103, W2-04 is complete through PR #104, and W2-05 is complete through PR #106 at `master@d480b7eaec6372efa69dbb28a05e40d4337187bd`. W2-06 is complete through PR #108 at `master@3f745b9b894e161d7b1bdff95c16143c7de58124`; W2-07 is complete through PR #109 at `master@b5e2db658ca4e32814e84150d7ee28d8054c2f9f`. Current execution and sequencing are owned by STATUS.md and ROADMAP.md. W2-08/W2-09 are the next parallel dependency-eligible Tracks.
W2-10 is blocked until both complete; W2-11/W2-12 follow the durable graph. W3 Preview Platform, W4 Native Integration, W5 Release and any authority expansion outside the reviewed W2 plan remain unauthorized.

## Problem and research

The current File Library entry still routes directly to the legacy `VaultView`, which is a managed-library/List-centric surface. W1 has separately delivered `WorkspaceSession`, `FileWorkspaceController`, Ephemeral Browse, Location, Thumbnail, Read Gate, change/refresh, scheduling and integration contracts, but those Foundation capabilities are intentionally not yet the user-facing File Library 2.0 experience.

The W-1/W0 research is binding for W2:

- one top-level File Library workspace;
- Library Mode for managed/query truth;
- Browse Mode for familiar filesystem navigation without implicit admission/indexing;
- Library/Browse is independent from List/Grid presentation;
- one shared navigation chronology across Library and Browse inside the live workspace session;
- Finder/Explorer familiarity is preserved where useful, without cloning either product wholesale;
- Context Panel/Inspector uses progressive disclosure rather than permanent telemetry-heavy UI;
- large result sets are progressive, virtualized/bounded and cancellable;
- Query V2, managed watcher/reconciliation, Read Gate and mutation/recovery authorities remain authoritative.

Primary references:

- `docs/project/MASTER_DEVELOPMENT_PLAN.md`
- `docs/project/research/file-library-preview/08-RESEARCH-ROUNDS-SYNTHESIS.md`
- `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
- `docs/project/specs/file-library-preview/01-PRODUCT-IA.md`
- `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`
- `docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`
- `docs/project/initiatives/W1-file-library-foundation.md`

## Scope

### In scope

- one File Library workspace shell with Library/Browse segmented mode control;
- migration of the existing managed Library experience into that shell without replacing Query V2;
- Browse Mode UI backed by the W1 File Workspace integration surface;
- platform-adaptive navigation for macOS and Windows;
- unified in-process Back/Forward and mode-switch behavior using W1 `WorkspaceSession` semantics;
- List and Grid presentation over shared entry/presentation contracts;
- bounded/virtualized rendering suitable for large result sets;
- W1 Thumbnail infrastructure for Grid/visible thumbnail work;
- Context Panel Inspector state for current selection;
- per-target presentation preferences using stable target/presentation keys where persistence is safe;
- Library search/filter through Query V2 and Browse current-folder bounded search/filter;
- selection, focus, keyboard, context-menu and open/navigation behavior;
- responsive breadcrumb behavior for Browse;
- explicit managed/unmanaged affordances, including a low-friction `Add this location to Library` action through existing admission authority;
- Windows/macOS visual, keyboard, accessibility, DPI and responsive QA;
- 100k UI-presentation/performance validation without full-list DOM assumptions.

### Deliverables

- reviewed W2 implementation plan and dependency graph;
- reviewed visual/interaction reference matrix before production activation;
- File Library workspace shell and mode controller;
- Library Mode adapter/migration;
- Browse Mode navigation/content experience;
- shared List/Grid presentation layer;
- source-owned selection facade/projection that preserves Library and Browse semantics;
- Context Panel/Inspector integration;
- per-target presentation/search/sort state with a single live owner;
- platform adaptation layer and failure/empty states;
- W2 performance/accessibility/visual QA evidence;
- W2 closeout/current-truth update.

### Acceptance criteria

- File Library remains one top-level application entry;
- existing `AppShell` sidebar/titlebar remain app-level chrome; File Library navigation/toolbar/context are workspace-local and do not create a second app shell;
- the reviewed W2-00 reference matrix covers Library/Browse × List/Grid, wide desktop, 980×680, selection + Context Panel, empty/unavailable states and Windows/macOS adaptations;
- File Library suppresses the ordinary `ShellViewHeading` for this route only and owns one normal/wide workspace command bar as frozen in W2-00;
- mode switch returns to `lastLibraryTarget` / `lastBrowseTarget` in the live session;
- current-process Browse Back/Forward preserves W1 live opaque-ref semantics; cross-process restore uses fresh admission only;
- live history presentation (`viewMode`, `scrollAnchor`) has one owner: W1 `WorkspaceSession`; durable per-target preferences are non-authoritative defaults used only when entering a target without live presentation state;
- transient Library search keystrokes/sort/filter edits do not manufacture navigation-history entries; semantic Library target changes may commit history deliberately;
- unmanaged Browse does not create scan roots, managed metadata or recursive indexing implicitly;
- Library Mode remains Query V2-backed and preserves `LibrarySelectionV1`, including `all_matching` query-fingerprint/snapshot/exclusion semantics; shared List/Grid code must never flatten that authority into a 100k ID set;
- Browse selection/Select All semantics remain source-scoped and must not claim unseen entries are selected while enumeration is incomplete unless the Browse source contract explicitly supports that semantic;
- List and Grid are presentation modes, not separate data or selection authorities; virtualization mount/unmount cannot change source selection truth;
- Context visibility is presentation state and does not auto-open merely because selection changes;
- Browse current-folder search may publish progressive matches but remains explicitly incomplete/searching until the current-folder enumeration completes; stale search generations cannot publish;
- sorting only loaded Browse pages must never be presented as a globally sorted current folder; when a whole-folder order requires completion, the UI keeps the existing order stable while preparing and applies the requested order coherently only when truthfully available;
- 100k logical Library **and** Browse presentation do not require 100k mounted DOM nodes or eager thumbnail work;
- target switch cancels/revokes obsolete visible work and stale results cannot publish;
- keyboard/focus selection semantics are deterministic on both supported platforms;
- the legacy Vault Preview dialog/Space behavior may remain temporarily as compatibility behavior, but W2 does not promote it into the new shared Quick Preview/provider architecture; W3 owns that replacement;
- no W3 rich Preview provider/UI or W4 native system integration is pulled into W2.

## Non-goals

- Query V3 or a replacement managed-library query engine;
- arbitrary recursive unmanaged filesystem/global search;
- Finder/File Explorer full replacement;
- W3 floating/pinned Quick Preview host or rich Preview providers;
- W4 Finder Quick Look extension / Explorer Preview Handler integration;
- OCR, RAG, AI Preview, Agent/MCP, format conversion or editing;
- automatic cloud/provider hydration;
- managed watcher/reconciliation rewrite;
- new mutation/recovery authority;
- Intel macOS, Rosetta, Universal binary or Linux support;
- schema changes merely to store UI state when an existing safe preference mechanism is sufficient.

## Authority and architecture freeze

### Current durable authorities

- managed Library: File Library Query V2 + `LibrarySelectionV1` and existing saved-view/tag authorities;
- Browse/session/navigation: W1 `WorkspaceSession` + shared `FileWorkspaceController` / `BrowseService` integration;
- Location capability: W1 Location projection, fail-closed where runtime evidence is unknown;
- thumbnails: W1 ThumbnailService + `WorkScheduler::global()`;
- content bytes: W1-07 Read Gate / existing authoritative open/revalidation path;
- managed freshness: existing watcher/reconciliation authority;
- filesystem mutation/recovery: existing identity validation, Operation Preview, journal, Safe Trash and Restore.

### Frontend/projection boundaries

W2 may create shared UI projection contracts, but it must not merge managed and ephemeral backend authority. A common `WorkspaceEntryPresentation`-style view model may normalize display fields only; source-specific operations remain routed through the owning authority.

Selection is also source-owned. A shared selection facade may normalize focused/selected UI projection and dispatch actions, but Library `all_matching` remains a compact `LibrarySelectionV1` authority and must not be expanded into a materialized ID list. Browse selection must expose its actual enumeration/scope semantics rather than pretend to have Library query-snapshot authority.

W1 `WorkspaceSession` owns live history presentation state (`viewMode` and `scrollAnchor`). W2 durable presentation preferences, if any, are only non-authoritative defaults for a newly entered target without live history state; they never overwrite Back/Forward-restored presentation state. Library query search/filter/sort remains Query V2/source state. Browse current-folder search/filter/sort remains Browse experience/source state.

The current `VaultView` is a migration source, not the future shared workspace owner. W2 should progressively extract Library-specific controllers/components instead of adding Browse/Grid/Context responsibilities to the existing monolith. Its current Preview dialog/Space behavior is a compatibility concern during migration, not authorization to build W3 Preview architecture in W2.

### Authority, persistence, platform, permission or recovery changes

W2 implementation activation authorizes the user-facing experience and reviewed frontend/integration work described in the W2 Track plan. It **does not** authorize a new durable product authority, schema, permission model, provider-hydration policy, watcher, scheduler, Read Gate, Query engine or mutation/recovery path. Any Track that discovers such a need must stop and obtain explicit architecture/security review before changing that boundary.

ADR or narrower security contract: none at activation; create one only if a Track reaches a genuinely new authority/security boundary.

## Validation

### Focused checks

- WorkspaceSession navigation/history/mode/presentation restoration tests;
- Library Query V2 parity and `LibrarySelectionV1::all_matching` preservation tests;
- Browse live-ref, search-completeness, stale-generation and sort-completeness tests;
- List/Grid selection/focus/virtualization tests that prove mount/unmount does not mutate selection authority;
- Context Panel Inspector lifecycle tests;
- per-target preference-default versus live-history-state tests;
- platform navigation/breadcrumb tests;
- stale thumbnail/result cancellation tests;
- legacy Vault Preview compatibility tests where that behavior remains during migration.

### Applicable full checks

- frontend typecheck/tests/build;
- Rust/integration tests when backend seams change;
- governance/docs;
- performance architecture guards;
- W1 Workspace Foundation regression gates when integration contracts are touched.

### Exact-head evidence

Every production Track must report exact-head CI. W2 release/QA must include dedicated 100k **Library and Browse** presentation scenarios and preserve W1/Query V2 performance thresholds. Browse search/sort QA must place sentinel matches/order keys beyond the first loaded pages so partial-page implementations cannot pass accidentally.

### Visual/native/platform checks

W2-00 visual/interaction reference states were reviewed and merged in PR #87 at `master@251bab36797cde4129656f57667ed203f20415e6`, covering:

- Library List and Grid;
- Browse List and Grid;
- wide desktop and minimum 980×680 layouts;
- single/multi-selection with Context Panel;
- empty, unavailable and permission/provider-unknown states;
- macOS and Windows chrome/navigation adaptations.

Implementation QA then covers:

- Windows 11 x64 and macOS 13+ Apple Silicon first-class;
- keyboard-only navigation, focus ring and context-menu behavior;
- Windows display/DPI scaling and macOS Retina scaling;
- empty Library with working Browse onboarding;
- unavailable/offline/provider states shown truthfully.

### Known unverified areas at activation

Real iCloud/File Provider/external APFS/exFAT/SMB/network fixtures remain unverified where no fixture is supplied. W2 must not convert these inherited gaps into PASS through mocks or local-disk tests.

## Wave/Track and PR

Implementation sequencing is defined by `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md` and visual/interaction behavior by `docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`.

PR #86 reviewed/merged the W2 plan. PR #87 reviewed/merged the W2-00 visual/interaction freeze. PR #88 merged the implementation activation, and W2-01 has since merged. W2-02 then completed through PR #101 after the R1/R2/R3/R4 prerequisite sequence; W2-03 and W2-04 subsequently completed through PRs #103 and #104; W2-05 completed through PR #106; W2-06 and W2-07 completed through PRs #108 and #109. Current execution/progress is deliberately not duplicated here: read STATUS.md and ROADMAP.md, then the current Track taskbook. W2-08 and W2-09 are now the next parallel dependency-eligible Tracks; later Tracks may not skip the dependency graph merely because the initiative is active.

Review requirements:

- product/UX review against the frozen visual/interaction matrix;
- architecture/authority review;
- maintainability review for any migration of the current large Vault/File Library components;
- independent review before Ready/Merge for production Tracks.

## Closeout

- W2 plan merge: PR #86 / `master@e91416c83082b61a0d3042c9438d77c7b8586297`.
- W2-00 visual/interaction freeze merge: PR #87 / `master@251bab36797cde4129656f57667ed203f20415e6`.
- W2 implementation activation: PR #88 / `master` governance merge; W2-01 production implementation is merged. Current W2 progress is maintained in STATUS.md and ROADMAP.md.
- W2 final closeout merge SHA: pending W2-12.
- Deferred/unverified items recorded: inherited W1 fixture gaps plus W3/W4 scope remain explicit.
- Source and integration branches deleted after ancestor/content-equivalence verification: pending per Track.
