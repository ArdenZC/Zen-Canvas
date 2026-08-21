# W2-09 Platform Navigation and Managed/Unmanaged UX — Binding Taskbook

Status: COMPLETE — independently reviewed, exact-head CI accepted and squash
merged through PR #111 as
`master@6cf8695244298c94cd6dac1acdf02f3af61074f1`.

W2-09 integrated W2-08 at `b918818b801edb9e44952150221b021d41a4fdb4`.
Recent remains `RECENT_AUTHORITY_MISSING` and explicitly deferred because no
source-owned recent-activity authority exists; no fake authority was added.

## Execution gate — 2026-08-21 (historical pre-amendment audit)

The required Recent authority audit was run against the current repository
and the current PR production head `4f0afad40559e9db4f4b5804313853eb69719d15`.
The search covered `smart_view recent`, Recent/Query V2 query bindings,
Vault Recent behavior, saved system views and the existing `recent-files`
fixtures. It found no canonical source-owned Recent semantic or Query V2
operation. The `recent-files` occurrences are restore/contract test data, not
a Recent authority.

At that audit point, this correctly recorded `RECENT_AUTHORITY_MISSING` and
stopped work pending reviewer direction. The amendment below authorizes the
bounded W2-09 implementation with Recent explicitly deferred; it does not
invent a modified-time projection, renderer-only Recent target or new authority.

## Reviewer-authorized W2-09 amendment — 2026-08-21

The stable Recent entry remains a future product requirement, but its W2-09
implementation is deferred because no source-owned recent-activity authority
exists in the accepted baseline. W2-09 must not synthesize Recent from
modified/created ordering or add persistence/schema solely to satisfy the
navigation label.

The current W2-09 completion gate is: semantic Library navigation is truthful;
Library locations show only backend-confirmed managed refs and bind
`location:<scanRootId>` to Query V2 `roots.scanRootIds`; Browse may show
backend-confirmed managed and ephemeral/Browse-only locations through the
existing opaque Location action; platform-adaptive labels/grouping are a pure
projection over `LocationDescriptor.kind`; Recent is explicitly deferred; and
no fake authority is introduced.

## Historical post-W2-08 integration evidence — 2026-08-21

- Integrated merge commit: `cfc1a9ecd8a2e36aeb37c719997db835a8152025`.
- Integrated merge tree: `1f4817f6b9bc02d8f116d4cbf017a9f5f06c1814`.
- Production implementation head: `c172204caa61a347f3f3094e90f65a659dc267b6`.
- Production implementation tree: `ee2f40b7dacc9bec7ebde22e56edc391ac9de9e6`.
- The final PR head also carries the current-truth documentation successor;
  the PR body records that exact head and its tree separately.

## Final merge evidence — 2026-08-22

- Final reviewed PR head: `ab1f7f6e893a9c57202552fd07efe00bda66fa2a`.
- Final reviewed tree: `8a46288bc8b53c5aff04e146c6913a32112842f4`.
- Hosted CI: `32504671540`, conclusion `success`.
- Merge integration: `1514a6c026f1b465916f0a698cfa9fd06473bf1`.
- Integration tree: `8a46288bc8b53c5aff04e146c6913a32112842f4`.
- ADR-0004 evidence: `tree_equivalent=true`,
  `head_validation_required=false`,
  `validation_lanes=["merge_integration"]`.
- Squash merge: PR #111 as
  `master@6cf8695244298c94cd6dac1acdf02f3af61074f1`.

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
  Query V2 file types, saved views, user tags and backend-confirmed managed
  locations. Managed location activation stays in Library and binds the
  existing Query V2 scope to `roots.scanRootIds`; Back/Forward re-applies the
  same semantic target through the source owner. It does not render a
  filesystem tree or Library breadcrumbs. Recent is explicitly deferred and
  no Recent target is emitted.
- Browse locations are grouped only by explicit `LocationDescriptor.kind`
  evidence. The UI shows calm status for managed and Browse-only locations,
  and disables unavailable/permission-like rows without guessing a path or
  platform. Windows/macOS vocabulary changes labels/grouping only; no
  Favorites/Home/provider role is exposed without backend evidence.
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
active state and the command-bar accessibility contract. The real gate was
`npm run test:browser:w2-09:real` at 1600x900 and 980x680; the existing W2
browser gates remained required. The original W2-09 execution boundary
required PR #111 to remain Draft and unmerged while that task was under
review; that boundary is historical and was superseded by the accepted
exact-head CI and PR #111 squash merge recorded above.

## Deferred or unverified

- Native Windows/macOS platform-specific navigation chrome and real external,
  network, cloud-provider and permission fixtures remain unverified in this
  Windows environment.
- `RECENT_AUTHORITY_MISSING`: no canonical Recent Query V2 operation is
  exposed by this baseline. Per the reviewer amendment, Recent is explicitly
  deferred from W2-09 and remains a future product requirement; no fake
  authority or persistence/schema was added.
- Add this location to Library remains deferred until an existing authoritative
  admission action is available through the workspace integration surface.
