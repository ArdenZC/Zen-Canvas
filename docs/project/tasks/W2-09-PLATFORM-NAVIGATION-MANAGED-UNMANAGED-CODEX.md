# W2-09 Platform Navigation and Managed/Unmanaged UX — Binding Taskbook

Status: implementation — Draft PR only. This Track is based on the accepted
post-G0 W2-07 head `master@0c48fc9730377849fec1b3514ebda1df9eab1c4e` and must
not be marked Ready or merged as part of this task.

## Objective

Add a File Library-local semantic navigation region for Library entry points
and backend-confirmed Browse locations. Make managed versus Browse-only
locations understandable without implying admission, indexing, path access or
platform parity that the backend has not explicitly published.

## Binding authorities

- Library semantic entries are registered by the mounted Library source owner
  and delegate to the existing File Library Query V2 operations. The
  navigation projection owns no query, tag, saved-view or file authority.
  Each clickable semantic entry also commits a `custom` `WorkspaceSession`
  `NavigationTarget`; Back/Forward re-applies that target through the same
  source-owner adapter.
- Browse location rows use only backend-issued `LocationDescriptor` values,
  `LocationRef` identity and `FileLibraryExperienceController.browseLocation`.
  Fresh Browse session/path refs come from the backend response.
- Availability, kind, freshness and capabilities are displayed as supplied;
  the renderer does not infer platform, provider, managed state or safety from
  a path string.
- `LocationDescriptor.ref.kind` is the only managed/Browse-only distinction
  used by this surface. `canAddToLibrary` is not turned into a button because
  this baseline exposes no existing admission command through the workspace
  controller.

## Required behavior

- The workspace command bar exposes one accessible Navigation toggle. Large
  layouts may keep the semantic navigation region inline; medium/compact
  layouts use a bounded drawer/popover that fits the 980x680 verification
  size.
- Library navigation includes All files plus disclosure groups for the real
  Query V2 file types, saved views and user tags. It does not render a
  filesystem tree or Library breadcrumbs. Recently used is intentionally
  omitted because this baseline exposes no canonical Recent Query V2
  operation; no fake target is emitted.
- Browse locations are grouped only by explicit `LocationDescriptor.kind`
  evidence. The UI shows calm status for managed and Browse-only locations,
  and disables unavailable/permission-like rows without guessing a path or
  platform.
- Opening a Browse location calls the existing opaque `LocationRef` action;
  opening Browse never admits a location into the Library.
- Escape closes the drawer through the existing `SideSheet` focus boundary
  and restores focus to the Navigation toggle; mounted interactive
  descendants remain absent when the drawer is closed.
- No Add-to-Library CTA is invented. If a future baseline exposes an
  admission authority, it must be wired through that authority and re-reviewed
  before this surface claims admission.
- Existing Back/Forward, Library/Browse mode, List/Grid, Context, selection,
  loading and unavailable behavior remains intact at 1600x900 and 980x680.

## Scope and exclusions

Frontend/projection, deterministic browser fixture and browser-gate coverage
only. Do not add a Location registry, database/schema, native API, path
resolver, filesystem tree, recursive search, W2-08 query logic, W3 Preview or
W4 native integration. The deterministic mock's unmanaged descriptor is test
evidence only; it is not native macOS/Windows provider evidence.

## Verification

Focused coverage proves explicit kind grouping, opaque location identity,
managed/Browse-only status, Query V2 semantic targets, target/query-aligned
active state and the command-bar accessibility contract. The real gate is
`npm run test:browser:w2-09:real` at 1600x900 and 980x680; the existing W2
browser gates remain required. Exact-head CI must be attached to this Draft
PR before review; do not Ready or merge it.

## Deferred or unverified

- Native Windows/macOS platform-specific navigation chrome and real external,
  network, cloud-provider and permission fixtures remain unverified in this
  Windows environment.
- A canonical Recent Query V2 operation is not exposed by this baseline, so
  Recently used remains deferred rather than becoming a renderer-only target.
- Add this location to Library remains deferred until an existing authoritative
  admission action is available through the workspace integration surface.
