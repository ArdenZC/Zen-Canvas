# W2-00 — Visual / Interaction Freeze + Implementation Activation

Status: Design freeze merged — implementation activation proposed by this governance change

Baseline: `master@e91416c83082b61a0d3042c9438d77c7b8586297` (W2 specification PR #86 squash merge)

Reviewed visual/interaction baseline: `master@251bab36797cde4129656f57667ed203f20415e6` (PR #87 squash merge)

Initiative: `docs/project/initiatives/W2-file-library-experience.md`

Canonical W2 plan: `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`

Canonical visual freeze: `docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`

## Purpose

W2-00 closes the final pre-production product-design gate for File Library 2.0 Experience. It freezes shell ownership, visual hierarchy, responsive behavior and interaction semantics strongly enough that W2-01 can implement the workspace without inventing product decisions inside code.

The design-freeze portion is complete and merged through PR #87. This separate governance change proposes the final transition from `active — specification only` to `active — implementation`. Production W2 work remains blocked until this activation change itself is reviewed and merged.

## Required reading

Read before approving this activation:

- `docs/project/MASTER_DEVELOPMENT_PLAN.md`
- `docs/project/research/file-library-preview/08-RESEARCH-ROUNDS-SYNTHESIS.md`
- `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
- `docs/project/specs/file-library-preview/01-PRODUCT-IA.md`
- `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`
- `docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`
- `docs/project/initiatives/W2-file-library-experience.md`
- `src/components/AppShell.tsx`
- `src/views/vault/VaultView.tsx`
- `src/views/vault/components/FileLibraryList.tsx`
- `src/fileWorkspace/workspaceSession.ts`
- `src/fileWorkspace/fileWorkspaceController.ts`

## Frozen architecture constraints

Implementation activation does not redefine backend authority.

- one top-level File Library entry;
- Library/Browse are organization modes, not separate app routes;
- List/Grid are presentation modes, independent from Library/Browse;
- Query V2 remains Library query authority;
- `LibrarySelectionV1` remains Library selection authority including compact `all_matching`;
- W1 `WorkspaceSession` remains live navigation/presentation-history authority;
- Browse remains W1 ephemeral/session-scoped authority;
- no raw-path authorization persistence;
- no unmanaged recursive/global filesystem search;
- no implicit provider hydration, indexing or scan-root creation;
- no second Scheduler, Read Gate, watcher or mutation/recovery authority;
- W3 owns the new shared Quick Preview host/provider experience.

Any production Track that discovers a need to cross one of these boundaries must stop for explicit architecture/security review rather than treating `active — implementation` as blanket authority.

## First Product/UX review result

Review `4957127793` recorded **CHANGES REQUIRED** on the first draft.

The first draft was not implementation-ready because it left these issues ambiguous:

1. current `AppShell` still renders `ShellViewHeading` above every ordinary route, creating a likely stacked-header bug for File Library;
2. the design used both a W2 workspace toolbar and a target/header row, producing too much vertical chrome;
3. Context visibility was too closely coupled to selection and could cause involuntary 280–340 px layout shifts;
4. Browse `partial` sort could encourage progressive reordering and spatial instability;
5. responsive behavior described the 980×680 endpoint but not deterministic intermediate workspace-width behavior;
6. Library navigation showed too much IA by default;
7. mode/view controls risked looking like primary brand actions rather than quiet desktop chrome;
8. local search needed stronger visual/shortcut separation from global Spotlight;
9. List/Grid density and card treatment were underspecified;
10. some failure/location copy exposed implementation language rather than user language.

Those issues were corrected in the canonical visual freeze before second review.

## Second Product/UX + architecture review result

Review `4957144656` recorded **PASS** on design head `23fff9b634a49eeaad14cab4785005e4562b22c7`.

The review confirmed:

- the File Library-specific `ShellViewHeading` opt-out closes the stacked-header risk without redesigning other routes;
- one normal/wide command bar is sufficient;
- Large/Medium/Compact thresholds are coherent with current AppShell sidebar widths;
- the 980×680 product minimum correctly maps to Compact File Library layout;
- Context visibility is presentation state, not a second selection authority;
- Browse sort remains spatially stable while completeness is prepared;
- W0 Library/Browse IA, Query V2, `LibrarySelectionV1`, WorkspaceSession, Browse opaque refs and W3/W4 boundaries remain intact;
- only the two W2-00 docs changed from the reviewed W2 baseline.

Final design-head docs/governance evidence: CI #698 / run `32098392854`, success on head `8c5dd35fae6a4da911a51200aa6f39a20caecd10` before PR #87 squash merge.

PR #87 then squash merged as `master@251bab36797cde4129656f57667ed203f20415e6`.

## Binding corrected design decisions

### D1 — File Library route-level shell ownership

The File Library route is the only W2-owned exception to the current ordinary-page heading stack:

- AppShell keeps native/window titlebar, global Spotlight, product sidebar and global surfaces;
- AppShell suppresses `ShellViewHeading` for the File Library route only;
- `FileLibraryWorkspace` owns the single local command bar/target identity;
- other product routes keep their current AppShell heading behavior;
- no extra PageHeader/hero/metrics wrapper may be added inside File Library.

### D2 — One normal/wide command bar

Normal/wide layout uses one canonical row:

```text
[Back][Forward] [Library|Browse] [target/breadcrumb grows] [local search/actions] [List|Grid] [Context]
```

A second target/breadcrumb row is allowed only in compact layout when legibility requires it.

### D3 — Responsive workspace-width model

Use **available File Library width after AppShell**, not raw window width:

- Large: `>=1120 px` — local nav inline; Context may be inline when user-open;
- Medium: `820–1119 px` — local nav normally inline; Context overlay; nav collapses early if the content floor would be violated;
- Compact: `<820 px` — local nav and Context both transient/overlay; content owns remaining width.

Current `980×680` minimum is expected to enter Compact because AppShell itself consumes width.

### D4 — Explicit Context visibility

Selection updates available Context content but **does not auto-open the panel**. Context visibility is user-controlled presentation state. Compact/medium layouts use a sheet/overlay. Clearing selection never silently mutates selection authority.

### D5 — Stable Browse sort

If a global folder sort requires complete enumeration, show `Preparing sort…`, keep the current/base order stable, then apply the requested order coherently when completeness is sufficient. Never progressively re-sort loaded pages while presenting the folder as globally sorted.

### D6 — Progressive Library navigation

Keep W0 IA but reduce default noise:

- `All Files` / `Recent` primary;
- Types / Saved / Tags / Locations disclosed on demand;
- omit empty groups;
- no permanent count badges by default.

### D7 — Quiet desktop controls

Library/Browse and List/Grid use neutral/tonal selected chrome rather than solid brand-primary CTA styling. Grid is thumbnail-first without permanent card boxes. List uses compact rows and quiet sticky headers.

### D8 — Search separation

- existing global Spotlight remains app-level;
- `Cmd+F` / `Ctrl+F` focuses File Library local search;
- local search is visually smaller and scope-labeled (`Search Images`, `Search this folder`).

## Mandatory reference states

The canonical visual freeze retains at least:

| Ref | State |
| --- | --- |
| R1 | Library / List / no selection |
| R2 | Library / Grid / one selection / Context explicitly open |
| R3 | Browse / List / nested folder + breadcrumb |
| R4 | Browse / Grid / image-heavy folder + bounded thumbnails |
| R5 | Multi-selection + optional Context summary |
| R6 | Empty Library with usable Browse onboarding |
| R7 | Browse unavailable/permission/provider-unknown failure state |
| R8 | Minimum 980×680 compact state |

Every state identifies:

- organization mode;
- presentation mode;
- active target;
- source authority;
- selection/focus state;
- Context content + visibility state;
- search/sort completeness state;
- navigation/breadcrumb state;
- responsive pane ownership;
- platform delta where applicable.

## Visual quality gates

### Product hierarchy

- exactly one File Library local command/header hierarchy;
- content dominates chrome;
- Library/Browse distinction understandable without tutorial panels;
- Library semantic value visible without dashboard metrics;
- Browse familiar enough for Finder/Explorer users without forced admission.

### Density and polish

- desktop-scale controls, not web-dashboard spacing;
- List rows approximately 36 px default / 32 px compact;
- Grid cells roughly 144–176 px and thumbnail-first;
- local nav approximately 176–208 px, target ~192 px;
- Context approximately 280–320 px, target ~296 px;
- mode/view selection neutral and restrained;
- no permanent badge wall for managed/unmanaged/provider state.

### Interaction

- focus distinct from selection;
- virtualization never owns selection authority;
- context-menu focus restores logically;
- Context visibility is explicit;
- Browse search partial→complete copy is truthful;
- Browse sort never creates progressive visual jumping under a global-sort claim.

### Accessibility/responsive

- all mandatory states define Large/Medium/Compact behavior where applicable;
- minimum 980×680 remains usable;
- local nav and Context overlays trap/restore focus deterministically;
- controls have accessible text/ARIA semantics independent from icons;
- macOS and Windows modifier/vocabulary differences are explicit.

## W3 boundary

W2 may retain legacy Vault Preview behavior as migration compatibility, but it may not use W2-00 to create the new shared Space-triggered Quick Preview host/provider architecture. W3 owns that new experience; W4 owns native Finder/Explorer integration evaluation.

## Activation scope

After this governance change is independently reviewed and merged:

- W2 becomes `active — implementation`;
- **W2-01 — Workspace Shell + Experience Controller** is the first authorized production Track;
- W2-02 and later Tracks remain blocked until their reviewed prerequisites are satisfied;
- production Tracks must use exact-head CI/evidence and independent architecture/code/UX/maintainability review as applicable;
- the latest runtime baseline remains W1 until the first reviewed W2 production Track actually merges.

This activation does not authorize any W3/W4 behavior or any new durable authority, schema, permission model, provider-hydration policy, watcher, Scheduler, Read Gate, Query engine or mutation/recovery path.

## Validation for this activation Track

Required on the latest activation exact head:

- project governance validation;
- documentation-only validation;
- `git diff --check` through CI/docs gate;
- link/reference validation;
- confirm changed files are governance/current-truth docs only;
- confirm no `src/**`, `src-tauri/**`, schema, dependency or runtime-authority change;
- independent-style governance/architecture review of the activation diff.

## Stop / escalate

Do not merge activation if a later change reintroduces any of these:

- File Library stacks `ShellViewHeading` plus W2 header chrome;
- more than one normal/wide local header row is required;
- responsive pane ownership becomes ambiguous;
- Context auto-opens simply because selection changed;
- Browse sort visually jumps as new pages arrive under a claimed global sort;
- selection authority is flattened into a large ID set;
- a mockup requires Query V3, new schema or another backend authority;
- W3/W4 work is required merely to make the W2 shell coherent;
- current-truth docs claim a W2 product/runtime baseline before a W2 production Track merges.

## Completion / activation gate

1. corrected canonical visual freeze — **PASS**;
2. mandatory reference states internally consistent — **PASS**;
3. final design exact-head docs/governance CI — **PASS**, CI #698 / `32098392854`;
4. second Product/UX review — **PASS**, review `4957144656`;
5. second architecture/authority review — **PASS**, same review;
6. reviewed design PR merged — **PASS**, PR #87 / `master@251bab36797cde4129656f57667ed203f20415e6`;
7. separate implementation-activation current-truth change — **this change, review/merge pending**.

Until step 7 merges, **no production W2 UI code is authorized**. The activation merge SHA becomes the governance starting baseline for W2-01; it does not itself become a product/runtime-changing baseline.
