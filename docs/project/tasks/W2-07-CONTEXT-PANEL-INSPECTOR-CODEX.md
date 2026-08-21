# W2-07 Context Panel / Inspector — Binding Taskbook

## Objective

Replace the Library-only always-on Inspector column with one shared File
Library Context Panel. Keep the content state (`none`, `inspector`, or
`selection-summary`) separate from the user-controlled visibility state
(`closed` or `open`). Selection never opens Context implicitly.

## Binding authorities

- `WorkspaceSession.presentation.contextOpen` is the bounded, non-authoritative
  visibility preference. It must validate, clone, restore, and update without
  adding navigation history.
- Library selection, detail, summary, tags, reveal, operation preview,
  content-understanding and compatibility-preview actions remain delegated to
  `LibrarySourceOwner` and the existing `FileLibraryInspector` seams.
- Browse Context may expose only the current source-owned presentation facts:
  loaded entry identity/name/kind/type, known dates/sizes, materialization,
  availability/capability state, and the current location display identity.
  It must not resolve paths, read bytes, hydrate remote entries, or add W3
  Preview behavior.
- The shared component projection is presentation-only. It owns no selection,
  detail, persistence, filesystem, or summary authority.

## Required behavior

- Add one localized Context toggle to the canonical workspace command bar.
- With no selection, hide useful Context content and remove its width while
  preserving `contextOpen`; a later valid selection restores the panel.
- Library explicit single selection uses the existing detail authority;
  explicit multi-selection and `all_matching` use `LibrarySelectionV1` plus
  `selectionSummary`, never `selectedIds.size` as the whole-selection count and
  never a materialized all-matching ID set.
- Browse selection remains loaded-only. Multi-selection reports known aggregate
  size only when complete; otherwise it says that the total is partial/unknown.
- Large workspaces (>=1120px) may show an inline panel near 296px only when the
  content floor remains valid. Medium and compact workspaces use the existing
  modal/sheet focus and Escape infrastructure.
- Closing Context retains selection. Escape closes Context before the shared
  list clears selection. Focus entry, trapping and restoration must be
  deterministic.
- Switching Library/Browse must not leak source content or stale detail.

## Scope and exclusions

Frontend/integration only, plus the narrow `FileLibraryExperienceController`
presentation seam. Do not add Rust/Tauri/schema work, a context store, a
persistent context preference, a second selection/detail authority, or W3
Preview Platform.

## Verification

Add focused contract coverage and `npm run test:browser:w2-07:real` at
1600x900 and 980x680. Keep W2-01, W2-04 and W2-05 gates green. The delivery
must remain one Draft PR titled `W2-07: Shared Context Panel and Inspector`;
do not Ready or merge it.
