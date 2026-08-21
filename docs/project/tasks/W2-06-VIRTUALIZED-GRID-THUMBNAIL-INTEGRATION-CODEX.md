# W2-06 Virtualized Grid and Thumbnail Integration

Status: complete — independently reviewed, exact-head CI accepted, and squash merged through PR #108 as `master@3f745b9b894e161d7b1bdff95c16143c7de58124`.

Binding base: `master@c251252531f0763f01f46c4e153772cc62bb70f4` (post-G0 W2-05 current-truth closeout).

## Authority and scope

This task extends the W2-05 presentation facade. `LibrarySourceOwner` and
`BrowseSourceOwner` remain the selection, focus, paging and collection
authorities. `SharedFileGrid` is a presentation projection alongside
`SharedFileList`; it owns no selection set, count, completeness state, path
resolver or filesystem mutation behavior.

Workspace view mode remains the bounded `WorkspaceSession` presentation field
`viewMode: "list" | "grid"`. The command-bar toggle changes the current
presentation entry without navigation history. No preference store, database
field or second authority is introduced.

Thumbnail requests use the existing `FileWorkspaceController.requestThumbnail`
and public `ThumbnailRequest` seam. Requests contain only the current managed
or Browse `EntryRef`, a semantic `small`/`medium`/`large` variant and the
interactive work class. Browse source generation is derived only by the
backend. Presentation-owned requests are canceled through the narrow existing
thumbnail cancel seam when a cell leaves the demand window, changes variant or
source, or unmounts. Late artifacts are ignored by a local request lifetime
guard, and current object URLs are revoked on replacement/unmount.

Grid rows are virtualized with `@tanstack/react-virtual`. The logical row count
is derived from the source projection and bounded responsive columns; only the
viewport plus bounded overscan can mount cells. Grid paging delegates to the
source owner's existing `loadMore` action.

Unsupported, remote, metadata-only, hydrating, unavailable, permission-like,
unknown and renderer-failure states remain stable placeholders. Grid opening
does not hydrate or read arbitrary filesystem paths. Browser-only deterministic
thumbnail bytes are a mock presentation fixture and are not native renderer
evidence.

## Required acceptance

- Library and Browse both consume the single `SharedFileGrid`.
- List/Grid changes preserve target identity and do not add history entries;
  target-specific presentation is restored by Back/Forward and source switch.
- A 100k logical Library collection mounts only a bounded number of Grid cells.
- Selection, focus, range/toggle/replace, Select All, activation and directory
  navigation remain delegated to the W2-05 source projection.
- Thumbnail demand is limited to mounted cells; semantic variant changes and
  source/target changes cancel or ignore obsolete work; object URLs are
  revoked; no raw path, display path, render key or source generation is sent.
- Placeholder and deterministic browser mock states are truthful and do not
  imply native macOS/Windows renderer verification.
- W2-01, W2-04 and W2-05 browser gates remain green.

## Validation record

Focused unit/type checks and the real W2-06 browser gate are run on the exact
branch head and recorded in the PR. Native platform verification is not claimed
from this Windows environment.

## Historical implementation stop boundary

The original implementation task was one Draft PR:
`W2-06: Virtualized Grid and Thumbnail Integration`. Its instruction not to mark
the PR Ready or merge it applied before independent review and acceptance and is
historical. W2-07 was the independent Track; W2-08/W2-09 are now the next
parallel dependency-eligible Tracks.
