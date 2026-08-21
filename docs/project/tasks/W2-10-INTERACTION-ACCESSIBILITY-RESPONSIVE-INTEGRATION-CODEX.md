# W2-10 Interaction, Accessibility and Responsive Integration — Binding Taskbook

Status: COMPLETE — final reviewed head
`bf4e0dca0169f712c601b8ef34d1f5d64a8d8666` passed hosted CI
`32520767825` `SUCCESS` and was squash merged through PR #114 as
`master@2488706f7b0aff086f00d9499eca28173b247876`.

Base: `origin/master@478517e58c6273d1aea4e6140dff803fabb1f069`.

Implementation production head: `0ebecc75ebb0db701c1efd0c3850028e6c480eb2`.

Implementation production tree: `37a3d455eeb886f312a092bfb63093b2d590c47e`.

The implementation identity above is the blocker-remediation production
commit. This taskbook update is a docs-only successor in the same Draft PR;
the final PR head/tree and hosted run identifiers are reported separately in
the PR body. The distinction keeps the production identity independently
verifiable.

W2-10 is an integration Track only. It does not add a new File Library
feature, query authority, selection authority, navigation/session authority,
filesystem authority, schema, W3 Preview host, or native provider API.

Recent remains `RECENT_AUTHORITY_MISSING` and explicitly deferred. It is not a
W2-10 dependency and this Track does not change that decision.

## Final merge evidence — 2026-08-22

- Final reviewed PR head: `bf4e0dca0169f712c601b8ef34d1f5d64a8d8666`.
- Final reviewed tree: `a0ebc6622be542474fa7c41f0df026b37eb65e08`.
- Hosted CI: `32520767825`, conclusion `SUCCESS`.
- Merge integration: `7dd3488ff83320bdfa31c614a1255bfc28614591` with tree
  `a0ebc6622be542474fa7c41f0df026b37eb65e08`.
- ADR-0004 evidence: `tree_equivalent=true`,
  `head_validation_required=false`, `validation_lanes=["merge_integration"]`.
- Squash merge: PR #114 as
  `master@2488706f7b0aff086f00d9499eca28173b247876`.
- Native Windows/macOS screen-reader, native DPI/Retina and manual
  platform-keyboard evidence remains `UNVERIFIED`; browser DPR evidence is
  browser-only.
- Recent remains `RECENT_AUTHORITY_MISSING` and explicitly deferred. W2-11 is
  next and dependency-eligible; W2-12 is blocked on W2-11. W3/W4/W5 remain
  unauthorized.

## Audit-first ownership matrix

| Surface | Keyboard owner | Focus owner | ARIA owner | Responsive owner | Dismissal owner | Shortcut owner |
| --- | --- | --- | --- | --- | --- | --- |
| Workspace command bar | `WorkspaceCommandBar` native buttons/tabs | invoker remains mounted; `SideSheet` restores drawer focus | command bar, tabs, pressed/expanded controls | `FileLibraryWorkspace` + workspace CSS | command bar actions and existing modal stack | local File Library search owns Cmd/Ctrl+F after target guard; Spotlight remains app-owned |
| Navigation | native buttons/disclosures in `FileLibraryNavigation` | existing `SideSheet` / navigation toggle | navigation landmark, current location, disclosure state | inline at large; existing drawer at medium/compact | `SideSheet` Escape/outside pointer | none |
| Library/Browse source | `SharedFileList` / `SharedFileGrid` source interaction projection | source-owned focused id/index and mounted active descendant | listbox/grid projection and selection state | shared list/grid CSS and workspace layout | source mode Escape chain | source-local actions only; Browse query text/kind is restored through existing `WorkspaceSession.presentation` |
| Context panel | content controls plus existing `SideSheet` | existing `SideSheet` restore target | `ContextPanel` inline/`SideSheet` semantics | inline at large; overlay at medium/compact | `ContextPanel` + existing modal stack | none |
| Filter/sort | native select/menu controls | Library invoker refs; filter already owns Escape | popover/menu roles and expanded state | Library command actions may wrap/overflow | Library control owner | none |
| Item context menu | shared list/grid ContextMenu/Shift+F10 callbacks | context-menu owner restores captured list/grid focus | menu/menuitem semantics | bounded viewport-fixed menu | source menu hook/document dismissal | ContextMenu key/Shift+F10 only |
| Legacy Preview/content dialogs | existing Vault leaf components | `ModalPortal` / compatibility wrapper | existing dialog contracts | existing dialog/sheet CSS | existing modal owners | legacy Space/Enter behavior remains source-specific |
| Browse breadcrumbs | `BrowseMode` native buttons | browser focus on current/parent ref button | breadcrumb landmark/current page | Browse toolbar overflow projection | native button flow | none |

## Audit findings that authorize implementation

- `FileLibraryWorkspace` installed a window-level Cmd/Ctrl+F handler without
  excluding input, textarea, select, contenteditable, or dialog-owned controls.
- Navigation and Context state were independently togglable at medium/compact
  widths, so two File Library overlays could compete for modal/focus ownership
  after resize or sequential activation.
- Library Preview close used a two-frame local focus chain, and the embedded
  content compatibility wrapper used the same delayed two-frame pattern. The
  existing `ModalPortal` remains the single modal focus owner; local wrappers
  must not add delayed focus theft.
- Shared List/Grid already expose source-owned ContextMenu/Shift+F10 entry
  points, but Browse did not pass callbacks or provide a Browse-safe menu.
- Library and Browse expose multiple live regions for closely related result,
  enumeration and selection changes; W2-10 will keep one concise status surface
  per source and avoid adding announcement noise.
- Existing list/grid active-descendant and source selection contracts are
  already bounded and truthful; W2-10 strengthens labels and tests without
  replacing them with a new roving/selection store.

## Binding behavior

- At 1600×900, Navigation and Context may be inline, with one command bar and
  useful content width.
- At 980×680, Navigation and Context are bounded overlays, all primary command
  groups remain reachable, and document horizontal overflow is absent.
- At medium/compact widths, opening one File Library overlay closes the other
  without clearing selection, changing source, or adding WorkspaceSession
  history.
- Cmd/Ctrl+F focuses the mounted File Library local Search only when the event
  is not composing, not already prevented, and did not originate in an editing
  or dialog-owned control. Spotlight remains app-owned.
- Right-click, Shift+F10, and ContextMenu act on source-confirmed focused or
  selected entries. Browse menus expose only Browse-safe actions and fail closed
  for unavailable capability; no raw path becomes an operation authority.
- Close paths restore a still-mounted logical invoker/source list target. A
  stale or unmounted target falls back to the source-owned list/grid.
- Browse query text and entry-kind are presentation state on the current
  `WorkspaceSession` history entry. Back/Forward restores that intent with the
  target; it is not a second query store or search authority.
- Library-to-Browse, child-folder, Back/Forward, List/Grid and query changes
  keep source generation, selection and history ownership in their existing
  controllers. W2-10 only composes their interaction surfaces.
- `prefers-reduced-motion: reduce` removes nonessential workspace/list/grid
  motion while preserving state communication.
- Browser scale-factor evidence is reported as browser evidence only; native
  Windows/macOS manual accessibility and DPI QA remains UNVERIFIED.

## Scope and exclusions

In scope: the existing File Library workspace, command bar, source projections,
shared list/grid, navigation, context panel/menu integration, focus and
keyboard conflict resolution, responsive CSS, deterministic contract tests and
the real Chromium W2-10 gate.

Out of scope: Recent semantics, Query V3, new durable stores, W3 Preview
architecture, native Finder/Explorer integration, provider inference,
filesystem mutation changes, Rust/Tauri/schema changes, W2-11, W2-12 and later
Waves.

## Validation contract

Focused W2-10 tests run first, followed by typecheck, full frontend tests,
remediation, performance architecture, frontend build, all existing W2 real
browser gates, and `test:browser:w2-10:real` at 1600×900 and 980×680 with
representative browser scale factors where available. Governance, docs and
diff checks run at the exact PR head. The interactive and full hosted frontend
lanes run the W2-10 browser gate with an explicit expected checkout SHA and
report the actual checkout tree. Rust validation is only applicable if
Rust/Tauri scope changes; an unexpected native/schema change is a stop
condition.

## Implementation boundary before hosted exact-head CI

- Added only interaction, accessibility and responsive integration helpers,
  Browse-safe context-menu projection, truthful partial Browse ARIA, and
  `WorkspaceSession` presentation restoration for Browse query intent.
- Preserved Query V2, LibrarySelectionV1, Browse session/path refs, Navigation,
  List/Grid, Context, legacy Vault Preview/Space behavior and existing modal
  ownership. No new store, service, filesystem authority, schema or W3 host
  was added.
- Added `npm run test:browser:w2-10:real` for the 1600×900 / 980×680 matrix at
  DPR 1 / 1.25 / 2, and wired it into the existing hosted frontend lanes.
- Recent remains `RECENT_AUTHORITY_MISSING` and deferred.

## Reviewer blocker remediation

- Keyboard ContextMenu target resolution is shared by List, Grid, Library and
  Browse. It prefers a source-owned focused loaded entry, then an explicitly
  selected loaded entry; it fails closed when neither exists. Library
  `all_matching` never manufactures a loaded row target, and Shift+F10 does
  not mutate selection.
- `FileLibraryContextMenu` remains the sole keyboard owner for menu Escape,
  Arrow/Home/End, Tab, Enter and Space. Library/Browse hooks retain state,
  outside-pointer dismissal and one-frame focus restoration without
  document-level Escape listeners.
- Focused Vitest coverage now exercises Library/Browse and List/Grid target
  parity, fail-closed empty-target behavior, explicit selected fallback,
  `all_matching` behavior, single Escape restoration and Search focus
  preservation. The real W2-10 Chromium gate exercises the same behavior at
  1600x900 and 980x680 with DPR 1, 1.25 and 2.

The implementation head/tree and hosted exact-head run identifiers were
reported in the Draft PR body. Older hosted runs did not validate the
post-review production change. Before merge, PR #114 was OPEN/DRAFT/UNMERGED;
that historical review state was superseded by the exact-head acceptance and
squash merge recorded above. W2-11 follows this integrated Track; W2-12/W3/W4/W5
were not started by W2-10.
