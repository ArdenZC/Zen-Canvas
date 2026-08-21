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
- Browse has no safe recursive/current-folder search execution seam in this
  Track. Its command-bar search affordance is therefore explicitly disabled;
  no loaded-page renderer filtering is presented as whole-folder search.

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
- Browse communicates that search is unavailable until an authoritative
  backend current-folder search seam exists. It does not infer recursive
  scope, whole-folder counts, ordering or file identity from rendered rows.
- Existing W2-01/W2-04/W2-05/W2-06/W2-07 List, Grid, Context, selection,
  loading, partial and unavailable behavior remains intact at 1600x900 and
  980x680.

## Scope and exclusions

Frontend/projection and browser-gate coverage only. Do not add Query V3, a
search database, schema fields, path resolution, recursive unmanaged search,
new selection authority, W2-09 navigation, W3 Preview or W4 native
integration. No native macOS/Apple Silicon parity claim is made from the
Windows runner.

## Verification

Focused coverage includes the command-bar singleton, presentation-history
boundary, IME/Cmd-Ctrl+F handling and the explicit Browse-unavailable contract.
The real gate is `npm run test:browser:w2-08:real` at 1600x900 and 980x680;
the existing W2 browser gates remain required. Exact-head CI must be attached
to this Draft PR before review; do not Ready or merge it.

## Deferred or unverified

- Truthful Browse current-folder search/filter/sort remains deferred until a
  backend-authoritative seam can publish completion, stale-generation and
  exact/deferred count semantics.
- Real provider/network/offline fixtures and native macOS visual/keyboard QA
  remain unverified in this Windows environment.
