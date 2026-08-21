# W2-08 Search, Filter, Sort and Presentation Preferences — Binding Taskbook

Status: implementation — Draft PR only. This Track is based on the accepted
post-G0 W2-07 head `master@0c48fc9730377849fec1b3514ebda1df9eab1c4e` and must
not be marked Ready or merged as part of this task.

## Objective

Make the File Library workspace's local search surface discoverable in the
canonical command bar while preserving Query V2, LibrarySelectionV1 and the
existing Filter/Sort authorities. Keep List/Grid and Context presentation
preferences bounded to WorkspaceSession presentation state. Do not create a
second search store or a renderer-owned recursive Browse search.

## Binding authorities

- Library search, filter, sort, result ordering, counts and saved-view query
  application remain owned by the existing Query V2/source-owner seam.
- Library selection and all-matching semantics remain owned by
  LibrarySelectionV1; search/filter/sort edits do not manufacture navigation
  history entries.
- List/Grid and Context visibility remain the bounded `WorkspaceSession`
  presentation fields. They do not become a preference database or a second
  workspace authority.
- The command-bar surface is transient projection state only. It registers the
  source-owned search input with the workspace shell and owns no query data.
- Browse current-folder query execution is now implemented by the existing
  backend `EnumerationState`/cursor authority. Each backend page call inspects
  at most the fixed `RAW_DIRECTORY_SCAN_BUDGET` raw directory entries,
  independently of result `page_size`; it may publish an empty partial page
  with a live cursor and never claims exact `knownCount` before EOF.
- The renderer continues an empty partial query page only through bounded,
  cancellable asynchronous turns. Query/target generation and the existing
  session/cursor authority prevent a superseded continuation from publishing.

## Required behavior

- Library exposes exactly one local search input in the canonical workspace
  command bar; the old duplicate source-body search row is removed.
- Cmd/Ctrl+F focuses that File Library-local input, while IME composition is
  left alone and the global Spotlight surface is unchanged.
- Query edits continue through `handleLibrarySearchChange` and its existing
  debounce/Query V2 lifecycle. Filter and Sort continue through the existing
  source-owner actions and remain source-scoped.
- Filter/Sort edits and List/Grid/Context changes do not add WorkspaceSession
  history entries; target switching does not bleed a renderer-local search
  value into Browse.
- Browse search uses the accepted backend current-folder query seam without
  inferring recursive scope, whole-folder counts, ordering or file identity
  from rendered rows. Empty partial query pages are presented as still
  searching, not as an empty folder.
- Existing W2-01/W2-04/W2-05/W2-06/W2-07 List, Grid, Context, selection,
  loading, partial and unavailable behavior remains intact at 1600x900 and
  980x680.

## Scope and exclusions

Frontend/projection, backend bounded-query and browser-gate coverage only. Do
not add Query V3, a search database, schema fields, path resolution, recursive
unmanaged search, new selection authority, W2-09 navigation, W3 Preview or W4
native integration. No native macOS/Apple Silicon parity claim is made from
the Windows runner.

## Verification

Focused coverage includes the command-bar singleton, presentation-history
boundary, IME/Cmd-Ctrl+F handling, bounded Browse query pages, 100k impossible
and late-sentinel fixtures, query A→B stale-publication protection and the
truthful empty-partial UI contract. Production validation passed on
`69e86167d76dc9b1479512ed1644c2a0555c8b4b` with tree
`98e12070f8c1859b77b1676badd3f8779cfa817f`. The current docs-only successor
is `6f3da5f03b6e90657c6af47773474109fe67e516` with tree
`85e233999f700383252a3e78b71a185241e4860a`. Local Rust/frontend checks and
the real gate `npm run test:browser:w2-08:real` passed at 1600x900 and
980x680. The current docs-only successor records this evidence; its exact
head/tree are recorded in the PR body. Exact-head CI run `32488915849` passed
after its failed Workspace Foundation resource-trend job was rerun; the first
failure and successful rerun are retained as evidence, not hidden by a
threshold change. Existing W2 browser gates remain required. Keep this PR
Draft; do not Ready or merge it.

## Deferred or unverified

- Real provider/network/offline fixtures and native macOS visual/keyboard QA
  remain unverified in this Windows environment.
