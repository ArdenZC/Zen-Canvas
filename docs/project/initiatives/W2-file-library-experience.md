# W2 — File Library 2.0 Experience

Status: active — specification only

Owner: File Library / Experience

Start baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`

Branch: `docs/w2-file-library-experience-init`

W2 starts only after W1 Foundation closeout and post-closeout audit remediation. This initiative authorizes **W2 specification/planning only** until the reviewed implementation plan is merged and a W2 implementation-activation Track explicitly changes this record to `active — implementation`.

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
- File Library workspace shell and mode controller;
- Library Mode adapter/migration;
- Browse Mode navigation/content experience;
- shared List/Grid presentation layer;
- Context Panel/Inspector integration;
- per-target presentation/search/sort state;
- platform adaptation layer and failure/empty states;
- W2 performance/accessibility/visual QA evidence;
- W2 closeout/current-truth update.

### Acceptance criteria

- File Library remains one top-level application entry;
- mode switch returns to `lastLibraryTarget` / `lastBrowseTarget` in the live session;
- current-process Browse Back/Forward preserves W1 live opaque-ref semantics; cross-process restore uses fresh admission only;
- unmanaged Browse does not create scan roots, managed metadata or recursive indexing implicitly;
- Library Mode remains Query V2-backed and preserves existing selection/filter/saved-view semantics unless a reviewed migration explicitly proves equivalence;
- List and Grid are presentation modes, not separate data authorities;
- 100k logical result sets do not require 100k mounted DOM nodes or eager thumbnail work;
- target switch cancels/revokes obsolete visible work and stale results cannot publish;
- keyboard/focus selection semantics are deterministic on both supported platforms;
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

The current `VaultView` is a migration source, not the future shared workspace owner. W2 should progressively extract Library-specific controllers/components instead of adding Browse/Grid/Context responsibilities to the existing monolith.

### Authority, persistence, platform, permission or recovery changes

None are authorized by this specification-only activation. Any new durable preference persistence, permission surface or authority change requires explicit review in the relevant W2 Track.

ADR or narrower security contract: none at activation; create one only if a Track reaches a genuinely new authority/security boundary.

## Validation

### Focused checks

- WorkspaceSession navigation/history/mode tests;
- Library Query V2 parity tests;
- Browse live-ref and current-folder filtering tests;
- List/Grid selection/focus/virtualization tests;
- Context Panel Inspector lifecycle tests;
- per-target preference-key tests;
- platform navigation/breadcrumb tests;
- stale thumbnail/result cancellation tests.

### Applicable full checks

- frontend typecheck/tests/build;
- Rust/integration tests when backend seams change;
- governance/docs;
- performance architecture guards;
- W1 Workspace Foundation regression gates when integration contracts are touched.

### Exact-head evidence

Every production Track must report exact-head CI. W2 release/QA must include a dedicated 100k presentation scenario and preserve W1/Query V2 performance thresholds.

### Visual/native/platform checks

- Windows 11 x64 and macOS 13+ Apple Silicon first-class;
- 980×680 minimum-layout QA;
- keyboard-only navigation, focus ring and context-menu behavior;
- Windows display/DPI scaling and macOS Retina scaling;
- empty Library with working Browse onboarding;
- unavailable/offline/provider states shown truthfully.

### Known unverified areas at activation

Real iCloud/File Provider/external APFS/exFAT/SMB/network fixtures remain unverified where no fixture is supplied. W2 must not convert these inherited gaps into PASS through mocks or local-disk tests.

## Wave/Track and PR

Implementation sequencing is defined by `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`.

The planning PR is specification-only. Production implementation begins only after independent plan review and an explicit W2-00 implementation activation.

Review requirements:

- product/UX review;
- architecture/authority review;
- maintainability review for any migration of the current large Vault/File Library components;
- independent review before Ready/Merge for production Tracks.

## Closeout

- Merge SHA: pending.
- Current-truth files updated: pending planning PR.
- Deferred/unverified items recorded: inherited W1 fixture gaps plus W3/W4 scope remain explicit.
- Source and integration branches deleted after ancestor/content-equivalence verification: pending.
