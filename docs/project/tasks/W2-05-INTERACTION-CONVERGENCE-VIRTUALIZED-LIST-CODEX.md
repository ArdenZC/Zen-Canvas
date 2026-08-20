# W2-05 — Interaction Convergence + Virtualized List

Status: active implementation — this taskbook and production implementation are on the same branch and Draft PR #106. Base `master@28a54e21eb3c5449f25cc4d3b100ca3f20eb8ff0`. The current production remediation head is `059a4cb12b06cdab8bb66370e5e4eab9058295d5` with tree `a45c0b4f8bb25b96052a66e5036823e4e5c2de2d`; exact-head hosted CI `32402544692` passed. W2-05 must stop at one Draft PR; it is not Ready and must not be merged in this Track.

Activation branch: `feat/w2-05-interaction-convergence-virtualized-list`.

This Track replaces the provisional Library and Browse list surfaces with one bounded, source-aware virtualized List. It converges component-facing interaction semantics without creating a shared durable selection store, a new query authority, or a renderer filesystem authority.

## 0. Required reading and preflight

Treat these as binding before implementation and review:

1. `AGENTS.md`;
2. `docs/project/README.md`, `STATUS.md`, `ROADMAP.md` and `PRODUCT_MAP.md`;
3. `docs/project/MASTER_DEVELOPMENT_PLAN.md`;
4. `docs/project/ARCHITECTURE_MAP.md` and `CODE_MAINTAINABILITY.md`;
5. `docs/project/DEVELOPMENT_WORKFLOW.md`;
6. `docs/project/initiatives/W2-file-library-experience.md`;
7. `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`;
8. `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`;
9. `docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`;
10. merged W2-02 presentation contracts, W2-03 Library source owner and W2-04 Browse source owner;
11. existing W2-01 and W2-04 browser gates, current browser mock and frontend test conventions.

Preflight must record the isolated worktree, branch, `HEAD`, `origin/master`, merge-base, status and changed paths. Expected base is exactly `master@28a54e21eb3c5449f25cc4d3b100ca3f20eb8ff0`.

## 1. Goal and user-visible exit

At exit, both first-class File Library sources consume the same virtualized List and the user can:

- click to replace selection, Ctrl/Cmd-click to toggle, and Shift-click to range-select;
- move logical focus with ArrowUp/Down, Home, End, PageUp/PageDown, with Shift range extension;
- use Ctrl/Cmd+A through the correct source-owned Select All behavior;
- retain selection and focus while rows mount/unmount during virtualization;
- activate a Library item through the existing preview seam or navigate a Browse directory through the existing `BrowsePathRef` seam;
- load more through the source owner without the List claiming source completeness;
- switch Library/Browse without transferring selection across source/provenance boundaries;
- use the listbox/option semantics and visible focus state at 1600×900 and 980×680.

The final W2-08/W2-09 controls, thumbnails/grid, context-panel redesign and platform-navigation chrome are out of scope.

## 2. Durable authorities and hard boundaries

The following authorities remain unchanged:

| Concern | Authority | W2-05 responsibility |
| --- | --- | --- |
| Library query/order/count | Query V2 and Library source owner | project indexed rows and delegate paging |
| Library selection | `LibrarySelectionV1` through existing selection store/owner | delegate replace/toggle/range and compact `all_matching` |
| Browse session/enumeration | File Workspace controller/session and Browse source owner | project loaded rows and delegate lifecycle/paging |
| Browse selection/focus | Browse source owner, process-local | delegate loaded-only actions |
| filesystem/path/operation | existing backend previews, journals and activation seams | emit activation intent only |
| presentation row identity | W2-02 `PresentationEntry.renderKey` | use only as a React key/presentation identity |

Hard forbids:

- no shared selection store, Zustand store or global `Set` containing Library and Browse IDs;
- no source-neutral `isSelected(id)` without current source/provenance and entry binding;
- no relocation of `LibrarySelectionV1` or Browse lifecycle ownership;
- no materialization of an `all_matching` ID list or 100k renderer selection set;
- no parsing or resolving `renderKey` for selection, focus, activation, operation, filesystem, history or thumbnails;
- no renderer-supplied path authority, Rust/Tauri/schema/migration change, Query V3, OCR/VLM, RAG/vector runtime or new durable runtime;
- no thumbnails/grid/context-panel redesign and no W2-06/W2-07/W2-08/W2-09 implementation.

If any boundary requires a change, stop and report the architecture conflict for ADR/review.

## 3. One discriminated component-facing interaction contract

Introduce one stateless/source-bound projection with a discriminant:

- `source: "library" | "browse"`;
- source/provenance-bound `collection`;
- indexed `rowCount`, `loadedRowCount`, and `entryAt(index)`;
- `focusedIndex`, `isSelected(entry)` and `isFocused(entry)` bound to the current source entry;
- actions for `select(entry,index,intent)`, `selectAll`, `clearSelection`, `focus` and delegated `loadMore`;
- capabilities that state Library `all_matching` versus Browse `loaded` Select All.

The adapter may derive loaded IDs/order needed by existing source-owner methods for bounded click/range behavior. It must never create durable state or a second authority. Library `rowCount` may use the exact Query V2 total while `entryAt` adapts only loaded/mounted source rows. Browse may publish an exact count only when the source collection is complete.

The shared List must ask whether **this current `PresentationEntry`** is selected. It must not accept arbitrary context-free ID membership.

## 4. Shared virtualized List behavior

Use the existing `@tanstack/react-virtual` dependency with bounded overscan and mounted rows. The List must:

- be the only final List consumed by both `LibraryMode` and `BrowseMode`;
- call `entryAt` only for virtual/mounted indexes and render bounded unloaded placeholders when an exact logical count exceeds the loaded window;
- keep row mounting/unmounting free of selection/focus truth mutations;
- delegate near-end paging to the source owner and retain owner-owned `hasMore`/loading/completeness facts;
- provide common Name, file/folder kind, Modified and Size columns;
- render missing metadata as unknown, never invented zero/path facts;
- emit activation intent only; Library keeps preview/Inspector/context/operations compatibility and Browse keeps `navigateInto`/breadcrumb/lifecycle compatibility;
- preserve the existing W2-01 list selector/scroll ownership marker while making the List source explicit.

`renderKey` is allowed only in the row `key`/presentation identity. DOM IDs and data attributes are UI-only and must not become resolvers.

## 5. Interaction and accessibility contract

- Click replaces; Ctrl/Cmd-click toggles; Shift-click ranges in the current source order.
- ArrowUp/Down, Home/End and PageUp/PageDown move source focus; Shift extends the source-owned range.
- Library Ctrl/Cmd+A delegates `selectAllMatching`, retains compact `LibrarySelectionV1`, and never loops over loaded/logical rows.
- Browse Ctrl/Cmd+A delegates `selectAllLoaded`, selects only current loaded entries, and never claims unseen entries.
- Escape first yields to the existing context-menu/preview transient hierarchy, then clears the current source selection.
- Enter/Space and Browse folder affordances delegate activation; the List never resolves paths or previews itself.
- The parent uses `role=listbox`, `aria-multiselectable`, mounted `role=option`, `aria-selected` and source-bound focus indication. `aria-activedescendant` is omitted when its focused row is not mounted.
- Keyboard focus remains owned by the list container, so virtual row unmount does not destroy logical focus.
- Verify reduced motion, forced colors/high contrast, focus-visible behavior, and no narrow-width horizontal overflow.

## 6. Compatibility leaves that must remain

Library must retain the existing source owner and all compatibility leaves: Inspector, preview, context menu, saved views, tags, operation previews, snapshot-expired handling and existing W2-03 authority markers. Browse must retain location admission, breadcrumbs, Back/Forward navigation, progressive enumeration, change monitoring, loading/partial/complete/failed states and source-local selection. Do not absorb W2-06 search, W2-07 controls, W2-08 presentation redesign or W3 preview/content authority.

The standalone legacy Vault surface may retain its compatibility `FileLibraryList`; W2-05's final shared List requirement applies to the W2 File Library Library/Browse modes. It must not be reintroduced as the Library mode's final renderer.

## 7. Required regression coverage

Add focused real behavior/contract tests covering all of the following:

1. Library/Browse source discrimination and source-bound membership;
2. Library Ctrl/Cmd+A produces compact `all_matching` through the owner with a 100k logical count and no ID materialization;
3. Browse Ctrl/Cmd+A selects exactly the loaded page/window;
4. replace, toggle and source-owned range routing;
5. focus survives virtual row unmount/remount and does not depend on `renderKey` parsing;
6. virtualization mounts a bounded row count for a 100k logical collection;
7. near-end load-more calls are delegated and bounded;
8. source switch does not transfer selection or collection provenance;
9. common metadata and unknown values remain truthful;
10. existing W2-01/W2-04 contract behavior remains covered after the shared List replacement.

## 8. Real browser gate

Add one W2-05 real browser gate using the repository's Playwright/Vite pattern. It must run at both `1600×900` and `980×680`, use a deterministic browser-mock fixture, scope task temp/runtime/artifacts under ignored `.tmp-tests/` paths on the worktree volume, and clean them in `finally`.

The gate must prove, on the actual checked-out head:

- one shared List is mounted for Library and Browse;
- Library has an exact 100,000 logical count with bounded mounted rows;
- Library Ctrl/Cmd+A reports/marks `all_matching` without selecting a rendered-row sample;
- keyboard navigation/scroll remains bounded and focused rows are not required to stay mounted;
- Browse selection is loaded-only, paging remains delegated, directory navigation uses the existing UI seam, and source switching keeps source state separate;
- no horizontal overflow or broken primary interaction at both viewports;
- no console/page errors.

The gate must not replace the existing W2-01 or W2-04 gates.

## 9. Validation and evidence

Run focused checks first, then applicable full frontend/docs gates from the current package scripts. At minimum record exact command/result for:

- typecheck, focused W2-05 tests and full `npm test`;
- `npm run test:remediation` and `npm run test:performance:architecture`;
- `npm run build:frontend`;
- existing W2-01 contract/real gate, existing W2-04 real gate, and new W2-05 contract/real gate;
- `npm run test:governance`, `npm run test:docs`, `git diff --check` and the base/head diff check.

Do not claim native Rust, Windows release or Apple Silicon evidence from this local browser lane. Hosted CI evidence must be bound to the exact Draft PR head. Report validation lanes separately under ADR-0004: exact head/tree, integration SHA/tree if any, `tree_equivalent`, `head_validation_required`, and completed/unverified lanes.

### Current remediation evidence

- Production head: `059a4cb12b06cdab8bb66370e5e4eab9058295d5`; tree:
  `a45c0b4f8bb25b96052a66e5036823e4e5c2de2d`.
- Hosted CI: run `32402544692` / [PR #106](https://github.com/ArdenZC/Zen-Canvas/pull/106),
  conclusion `success`.
- ADR-0004 integration checkout: `69406d90a233026d45fcfc0f05407ea9b2cce696`;
  integration tree `a45c0b4f8bb25b96052a66e5036823e4e5c2de2d`;
  `tree_equivalent=true`; `head_validation_required=false`;
  `validation_lanes=["merge_integration"]`.
- The PR remains Draft and W2-06/W2-07/W2-08/W2-09 remain out of scope for this
  Track.

## 10. PR and stop conditions

The same branch contains this taskbook and production implementation. Create exactly one Draft PR after the coherent implementation and focused tests are ready. Push it, wait for exact-head CI, record the PR URL/head/tree and stop.

Do not mark Ready, squash merge, start W2-06/W2-07/W2-08/W2-09, or claim W2-05 complete. A later reviewer may decide whether the Draft PR is architecturally acceptable. Any new authority, backend/Tauri/schema/platform permission, filesystem strategy, materialized all-matching set, or broad visual redesign is a hard stop for architecture review.
