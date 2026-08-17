# W2-00 — Visual / Interaction Freeze + Implementation Activation

Status: Draft taskbook — specification work only

Baseline: `master@e91416c83082b61a0d3042c9438d77c7b8586297` (W2 specification PR #86 squash merge)

Initiative: `docs/project/initiatives/W2-file-library-experience.md`

Canonical W2 plan: `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`

## Purpose

W2-00 closes the final pre-production design gate for File Library 2.0 Experience. It freezes the user-facing information hierarchy, shell ownership, responsive behavior and interaction semantics strongly enough that W2-01 can implement the workspace shell without inventing product decisions inside code.

This Track is still **specification only**. It does not authorize production UI changes until its reference matrix is reviewed and the W2 initiative is explicitly transitioned to `active — implementation` in a separate final activation commit/PR step.

## Required reading

Read before editing the visual/interaction freeze:

- `docs/project/MASTER_DEVELOPMENT_PLAN.md`
- `docs/project/research/file-library-preview/08-RESEARCH-ROUNDS-SYNTHESIS.md`
- `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
- `docs/project/specs/file-library-preview/01-PRODUCT-IA.md`
- `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`
- `docs/project/initiatives/W2-file-library-experience.md`
- `src/components/AppShell.tsx`
- `src/views/vault/VaultView.tsx`
- `src/views/vault/components/FileLibraryList.tsx`
- `src/fileWorkspace/workspaceSession.ts`
- `src/fileWorkspace/fileWorkspaceController.ts`

## Frozen architecture constraints

The visual design may not redefine backend authority.

- AppShell titlebar/window controls/Spotlight/product sidebar remain app-level chrome.
- File Library has one workspace-local shell; do not nest a second app shell inside it.
- Library/Browse are organization modes, not separate top-level routes.
- List/Grid are presentation modes, independent from Library/Browse.
- W1 `WorkspaceSession` owns live history `viewMode` and `scrollAnchor`.
- Query V2 remains Library search/filter/sort authority.
- `LibrarySelectionV1` remains Library selection authority, including `all_matching`.
- Browse remains W1 ephemeral/session-scoped authority.
- Context Panel in W2 is Inspector/selection context only; W3 owns new Quick Preview hosts/providers.
- No unmanaged recursive/global filesystem search.
- No implicit provider hydration, scan-root creation or indexing.

## Deliverables

### D1 — Canonical visual/interaction freeze

Create/update:

`docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`

It must define at minimum:

1. app-level versus workspace-local chrome ownership;
2. Library/Browse mode control placement;
3. workspace-local Navigation / Content / Context hierarchy;
4. toolbar/search/filter/sort/List-Grid control ownership;
5. Library target title versus Browse breadcrumb behavior;
6. Context Panel hidden/single-selection/multi-selection states;
7. wide-layout dimensions and density principles;
8. minimum 980×680 collapse rules;
9. Library List reference state;
10. Library Grid reference state;
11. Browse List reference state;
12. Browse Grid reference state;
13. empty Library / Browse onboarding state;
14. unavailable/offline/permission/provider-unknown state;
15. macOS and Windows platform adaptations;
16. keyboard/focus/context-menu interaction model;
17. progressive/current-folder search completeness messaging;
18. partial/unsupported Browse sort messaging;
19. visual treatment for managed versus unmanaged without telemetry noise;
20. explicit W3 Preview boundary.

### D2 — Reference-state matrix

Every reference state must specify:

- organization mode;
- presentation mode;
- active target;
- selection state;
- Context Panel state;
- search/sort state;
- navigation/breadcrumb state;
- platform-specific delta where applicable;
- responsive behavior at wide and 980×680 sizes;
- source authority and any capability-dependent control.

At least these reference states are mandatory:

| Ref | State |
| --- | --- |
| R1 | Library / List / no selection |
| R2 | Library / Grid / one selection + Inspector |
| R3 | Browse / List / nested folder + breadcrumb |
| R4 | Browse / Grid / image-heavy folder + viewport thumbnails |
| R5 | Multi-selection + Context summary |
| R6 | Empty Library with usable Browse onboarding |
| R7 | Browse unavailable/permission/provider-unknown failure state |
| R8 | Minimum 980×680 responsive state |

### D3 — Interaction contract

Freeze these before implementation:

- mode switching and last-target return;
- Back/Forward versus transient query/presentation edits;
- row/cell focus versus selection;
- Ctrl/Cmd toggle, Shift range and Select All semantics by source;
- double-click/Enter folder navigation versus file-open behavior;
- context menu/focus restoration;
- toolbar keyboard reachability;
- Context Panel open/close/collapse behavior;
- search partial→complete states;
- Browse sort complete/partial/unsupported states;
- no new W3 Space Quick Preview architecture.

## Visual principles

The File Library workspace should feel calm, high-quality and platform-native without becoming a Finder/Explorer clone.

- Familiar information hierarchy beats novelty.
- Main content owns visual emphasis; navigation and Context Panel are quieter.
- Avoid permanent cards, metrics and architecture telemetry in the primary browsing surface.
- Avoid excessive glass/blur layers inside the content workspace; reserve material effects for shell/chrome where they aid hierarchy.
- Controls should use compact desktop density, not oversized web-dashboard spacing.
- Selection is visible but not neon/high-saturation.
- Grid cells prioritize thumbnail/content; metadata is secondary.
- List is information-dense and column-stable.
- Empty/failure states explain the next safe action without dominating the whole app.

## Wide desktop structural target

Reference only; final pixel values may be refined by visual review.

```text
┌──────────────────────────────── AppShell titlebar / Spotlight ────────────────────────────────┐
├──────── app sidebar ────────┬──────────────────── File Library Workspace ─────────────────────┤
│ product navigation          │ ┌─ workspace toolbar: back/forward | Library/Browse | actions ┐ │
│                             │ ├──────────┬──────────────────────────────┬────────────────────┤ │
│                             │ │ local nav│ content header/search        │ Context Panel      │ │
│                             │ │          ├──────────────────────────────┤                    │ │
│                             │ │          │ virtualized List / Grid      │ Inspector/summary  │ │
│                             │ │          │                              │                    │ │
│                             │ └──────────┴──────────────────────────────┴────────────────────┘ │
└─────────────────────────────┴──────────────────────────────────────────────────────────────────┘
```

The workspace must not render another global product sidebar/titlebar/PageHeader stack inside this frame.

## Minimum 980×680 structural target

Required behavior:

- AppShell product sidebar may use its existing narrow behavior; W2 must not redefine global app chrome.
- File Library local navigation collapses to a compact drawer/rail/popover owned by W2-01.
- Context Panel becomes hidden-by-default overlay/sheet or explicit toggle; it may not squeeze the content column below usable width.
- Content toolbar remains one row where possible; secondary controls may collapse into an overflow menu.
- Browse breadcrumb preserves current folder + nearest ancestors and collapses older ancestors first.
- List/Grid controls remain directly reachable.
- selection/focus remains visible after responsive transitions.

## Platform adaptations

### macOS

- Finder-familiar local navigation grouping: Favorites / Locations / Providers when runtime evidence exists.
- Cmd-modified selection conventions.
- Retina-aware thumbnail density.
- no use of Windows-only shell vocabulary such as `This PC`.

### Windows

- Explorer-familiar grouping: Home/Quick Access style favorites / This PC / Cloud / Network when runtime evidence exists.
- Ctrl-modified selection conventions.
- DPI scaling review across common scale factors.
- `Alt+Space` remains OS-owned; do not assign it to W2 Preview behavior.

Platform familiarity changes labels/hierarchy where appropriate, not source authority.

## Review gates

### Product/UX

- Is Library/Browse distinction immediately understandable without extra explanatory chrome?
- Can Finder/Explorer-oriented users browse normally?
- Does Library still communicate semantic value without becoming a dashboard?
- Are List and Grid equally first-class?
- Is Context Panel progressive rather than permanently consuming width?

### Architecture

- No second live presentation authority.
- No second selection authority.
- No Query V3 or unmanaged recursive search.
- No raw-path authorization leakage.
- No W3 Preview architecture.

### Accessibility/responsive

- All mandatory states have a 980×680 behavior.
- Keyboard/focus semantics are explicit.
- Context Panel and local navigation collapse have deterministic focus restoration.
- controls have text/ARIA semantics independent from icons.

## Validation

For this docs/design Track:

- `npm run test:docs`
- `npm run test:governance`
- `git diff --check`
- link/reference validation
- exact-head CI

No Rust/frontend production build is evidence of visual approval.

## Stop / escalate

Stop before implementation activation if review reveals:

- unresolved Library/Browse shell hierarchy;
- unresolved 980×680 structural layout;
- unclear selection/source semantics;
- Browse search/sort completeness ambiguity;
- need for new backend authority/schema solely to satisfy the mockup;
- requirement to implement W3/W4 behavior to make the W2 design coherent.

Do not solve a visual-design problem by changing frozen authority contracts silently.

## Completion / activation

W2-00 is complete only when:

1. the visual/interaction freeze is reviewed with no blocking UX/architecture issue;
2. all required reference states exist;
3. exact-head docs/governance CI is green;
4. a separate independent review confirms the reference matrix respects W1/W2 authority boundaries;
5. only then, the W2 initiative may transition from `active — specification only` to `active — implementation` and STATUS/ROADMAP may record the activation.

Until step 5 happens, **no production W2 UI code is authorized**.