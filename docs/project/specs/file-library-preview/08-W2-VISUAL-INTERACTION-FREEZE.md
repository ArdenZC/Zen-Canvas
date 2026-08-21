# W2 — File Library 2.0 Visual / Interaction Freeze

Status: reviewed reference matrix — Product/UX + architecture PASS; W2-01 merged; current W2 execution is owned by STATUS.md and ROADMAP.md

Baseline: `master@e91416c83082b61a0d3042c9438d77c7b8586297`

Initiative: [`../../initiatives/W2-file-library-experience.md`](../../initiatives/W2-file-library-experience.md)

Implementation plan: [`07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`](07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md)

Current truth (2026-08-18): this freeze remains the binding visual and
interaction reference for W2. W2-01 is merged. R1/R2/R3 consumer-boundary
remediation and final W1-to-W2 verification gate W2-02 production; later Track
progress is owned by STATUS.md and ROADMAP.md. Historical activation wording
below records the pre-implementation state and does not alter this freeze.

## 1. Design thesis

File Library 2.0 is one calm desktop workspace with two legitimate ways to work:

- **Library** — managed semantic/query organization;
- **Browse** — familiar direct filesystem navigation.

Library/Browse changes the source and information architecture, not the overall product shell. List/Grid changes presentation only. The workspace must feel native and immediately learnable to Finder/Explorer users without becoming a clone of either product.

The visual goal is **quiet capability**:

- content receives the strongest visual emphasis;
- chrome stays compact and neutral;
- semantic power appears when useful rather than as permanent dashboard telemetry;
- Browse remains ordinary file browsing, not a funnel that forces users into indexing;
- every visible state tells the truth about the owning source authority.

## Reviewer-authorized W2-09 amendment — 2026-08-21

The stable Recent entry remains a future product requirement, but its W2-09
implementation is deferred because no source-owned recent-activity authority
exists in the accepted baseline. W2-09 must not synthesize Recent from
modified/created ordering or add persistence/schema solely to satisfy the
navigation label. The current implementation therefore omits Recent while
keeping the future slot explicit in this freeze.

Library Locations are managed-only, admitted by backend-confirmed
`LocationDescriptor.ref.kind === "managed"` and bound to Query V2
`roots.scanRootIds`. Browse may show backend-confirmed managed and
ephemeral/Browse-only locations. Windows/macOS presentation changes labels and
grouping only; it does not infer provider, role or authority from path strings.

The accepted W2-09 production implementation head is
`c172204caa61a347f3f3094e90f65a659dc267b6`; PR #111 remains Draft and the
final documentation successor records the exact PR head/tree evidence.

## 2. Current AppShell reality and route ownership freeze

The current application shell already renders:

1. native/window titlebar and global Spotlight trigger;
2. the Zen product sidebar;
3. `ShellViewHeading` before `viewStage` for ordinary routes;
4. the route content inside the existing workspace frame.

That current structure creates a specific W2 risk: adding another File Library header below `ShellViewHeading` would produce stacked page chrome.

### Binding W2 route rule

For the **File Library route only**:

- AppShell continues to own the titlebar/window controls, global Spotlight, product sidebar, toast/modal hosts and outer window frame;
- AppShell **must not render `ShellViewHeading` above `FileLibraryWorkspace`**;
- `FileLibraryWorkspace` owns its one workspace command bar and all local target identity;
- the File Library route must not be wrapped in an additional PageHeader/hero/metric-strip/card stack;
- the workspace should occupy the route stage with only the minimum outer gutter required by existing shell tokens;
- every non-File-Library route keeps its existing AppShell heading behavior unless separately reviewed.

This is an explicit route-level opt-out, not a redesign of the whole application shell.

## 3. Canonical spatial hierarchy

The normal/wide File Library layout has **one horizontal workspace command bar**, then content panes.

```text
┌──────────────────────────────────── AppShell ─────────────────────────────────────┐
│ [window]                   Global Spotlight / Search                    [window]   │
├──────────────────┬─────────────────────────────────────────────────────────────────┤
│ Zen product nav  │ [‹][›] [Library|Browse]  target / breadcrumb   search  view  ⓘ │
│                  ├──────────────┬───────────────────────────────────┬──────────────┤
│                  │ local nav    │                                   │ Context      │
│                  │              │      List / Grid content          │ Panel        │
│                  │              │                                   │ when open    │
│                  │              │                                   │              │
│                  └──────────────┴───────────────────────────────────┴──────────────┤
└──────────────────┴─────────────────────────────────────────────────────────────────┘
```

### Hierarchy rules

- There is no permanent second target/header row in normal or wide layout.
- Library semantic title and Browse breadcrumb occupy the same flexible target-identity region in the command bar.
- Search/filter/sort belong to this workspace command bar and remain visually subordinate to the global Spotlight control.
- Local navigation is quieter and narrower than the Zen product sidebar.
- Context is absent from layout unless the user has explicitly chosen to show it and useful context exists.
- Content is not placed inside a large dashboard-style card.

A second breadcrumb/target row is allowed only as a **compact-layout escape hatch** when the available width cannot keep the current target legible.

## 4. Workspace-width responsive contract

Responsive decisions are based on the measured **File Library workspace width after AppShell has consumed its own sidebar/padding**, not on raw monitor width.

The numeric thresholds are implementation targets and may move by a small amount only if visual QA proves the content-floor rules below remain satisfied.

### Large — `>= 1120 px` available File Library width

- local navigation: inline, default about `192 px`;
- Context Panel: inline when explicitly open, default about `296 px`;
- content column should remain at least about `600 px`;
- local search may render as a compact text field;
- target identity remains in the single command bar.

### Medium — `820–1119 px`

- local navigation: inline, about `176–192 px`;
- Context Panel: overlay/sheet, never a permanent width consumer;
- search may collapse from full field to an expanding search control as width tightens;
- secondary source-local actions move into overflow before mode/view controls disappear;
- content should normally retain at least about `620 px` when the local nav is inline; if not, local nav collapses early.

### Compact — `< 820 px`

- local navigation: drawer/popover/temporary rail;
- Context Panel: overlay/sheet;
- content receives effectively all remaining workspace width;
- target/breadcrumb may receive a compact second row when one-row legibility is impossible;
- old breadcrumb ancestors collapse first;
- Back/Forward, Library/Browse, List/Grid, current target and selection focus remain reachable.

With the current AppShell widths, the product minimum `980×680` window is expected to land in this compact File Library state. W2 must not assume that a 980 px application window leaves 980 px for File Library content.

## 5. Visual language

### 5.1 Surfaces

- reuse existing Zen canvas/surface/divider/focus tokens;
- favor subtle separators over nested bordered cards;
- local navigation and Context may use quiet shell surfaces;
- content canvas should remain visually clean;
- avoid repeated glass/blur layers inside the workspace body.

### 5.2 Chrome controls

Library/Browse and List/Grid are **chrome toggles, not primary actions**.

Their selected state should use a neutral/tonal selected surface, restrained inset/highlight treatment and primary text. Do not render the active segment as a saturated solid brand-primary CTA.

Brand color remains appropriate for focus, a small active indicator, or true primary actions such as the empty-Library admission CTA.

### 5.3 Typography

- item name is the strongest content text;
- current target/folder identity is clear but compact;
- metadata is secondary/tertiary;
- technical/provider state appears only when it changes what the user can safely do;
- ordinary Library browsing does not get a permanent subtitle/analytics line.

### 5.4 Density targets

These are visual targets, not a new persistence authority:

- workspace command bar visual height: about `40–44 px`;
- command-bar controls: about `30–32 px` high;
- local-nav rows: about `32–34 px` default;
- List column header: about `30–32 px`, sticky and visually quiet;
- List row: about `36 px` default and about `32 px` in the existing compact density mode;
- Context Panel: normally `280–320 px`, target `296 px`;
- local navigation: normally `176–208 px`, target `192 px`;
- Grid cell width: roughly `144–176 px` depending on density/available width;
- Grid gap: roughly `12–16 px`;
- thumbnail/content area dominates the Grid cell; title is limited to one or two lines and metadata is not rendered as a card footer by default.

Do not create a new density setting solely for W2.

## 6. Single workspace command bar

Canonical wide/normal order:

```text
[Back] [Forward]  [ Library | Browse ]  [target identity grows]  [local search] [source actions] [List|Grid] [Context]
```

Rules:

- Back/Forward use `WorkspaceSession` chronology, never browser history.
- Library/Browse remains persistently discoverable.
- the target identity region flexes before primary controls disappear;
- source actions may include Filter/Sort or mode-appropriate commands;
- List/Grid updates the existing live presentation/history state;
- Context is an explicit toggle, not an automatic side effect of clicking an item;
- disabled/unsupported controls communicate capability truth through accessible labels/tooltips when useful.

### Local versus global search

Global Spotlight remains app-level. File Library search is scoped to the active Library/Browse target.

- `Cmd+F` on macOS / `Ctrl+F` on Windows focuses the File Library local search control;
- the existing global command/search shortcut remains unchanged;
- local search uses a smaller workspace treatment than the large centered Spotlight capsule;
- placeholder/scope copy is explicit (`Search Images`, `Search this folder`) rather than generic `Search` when space permits.

## 7. Library navigation — semantic and progressively disclosed

W0's Library information architecture remains valid, but W2 does **not** show every category/group as permanent expanded chrome.

Default hierarchy:

```text
LIBRARY
  All Files
  Recent (future; omitted until source authority exists)

TYPES ▸
  Documents
  Images
  Video
  Audio
  Archives
  Code

SAVED ▸
  <existing saved views>

TAGS ▸
  <existing tags>

LOCATIONS ▸
  <managed locations only>
```

Rules:

- `All Files` is the stable primary entry; Recent remains a future slot and is
  omitted from the current W2-09 surface until a source-owned authority exists;
- Types/Saved/Tags/Locations use disclosure and may auto-expand when the restored/current target lives inside that group;
- groups with no useful entries may be omitted rather than showing empty chrome;
- counts are hidden by default and appear only when they improve a specific decision;
- transient search/filter edits do not create a navigation item per keystroke;
- Library navigation never pretends to be a filesystem tree.

This preserves W0 semantics while keeping the default workspace visibly simpler.

## 8. Browse navigation — familiar but projected, not raw

Browse local navigation uses platform-familiar grouping while runtime evidence remains authoritative.

### macOS

```text
FAVORITES
  Desktop
  Documents
  Downloads
  Pictures

LOCATIONS
  system/startup volume
  <external volumes when evidenced>

PROVIDERS
  iCloud Drive / other providers only when evidenced
```

### Windows

```text
HOME / QUICK ACCESS
  Desktop
  Documents
  Downloads
  Pictures

THIS PC
  C:\
  D:\
  <removable drives when evidenced>

CLOUD
  OneDrive / providers when evidenced

NETWORK
  mapped / UNC locations when evidenced
```

Rules:

- prefer user-facing names from the W1 Location/path projection;
- do not expose opaque authority refs or provider IDs as UI text;
- do not infer provider/volume capability from path-string heuristics;
- system vocabulary adapts by platform, but source authority does not.

## 9. Target identity

### Library

Library uses a semantic title in the command bar, not fake breadcrumbs.

Example:

```text
[‹][›] [Library|Browse]   Images   [Search Images…] [Filter] [Sort] [view] [ⓘ]
```

Ordinary browsing does **not** permanently add a second line such as `All indexed images · 12,482 items`.

Counts/status may appear when useful, for example:

- an active search/filter result count;
- selection count;
- incomplete/partial state;
- a specific unavailable/reconciling condition.

### Browse

Browse uses actual navigable breadcrumbs in the same command-bar identity region.

Prefer projected display names over raw technical segments when a safe display name exists.

Wide example:

```text
[‹][›] [Library|Browse]  Projects > Zen-Canvas > src   [Search this folder…] [Sort] [view] [ⓘ]
```

Collapsed:

```text
… > Zen-Canvas > src
```

Oldest ancestors collapse first. Current folder and nearest ancestors have priority.

## 10. List presentation

List is the high-density precision view.

- sticky quiet column header;
- default columns should remain restrained: Name plus source-appropriate Kind/Modified/Size where known;
- rows use the density targets above rather than dashboard/card padding;
- row separators are absent or very subtle;
- folder/file identity does not depend on thumbnails;
- focus and selection survive virtualization and unmount/remount;
- horizontal overflow is avoided at the minimum supported layout by dropping/contracting lower-priority metadata columns before the Name column becomes unusable.

Selection treatment:

- neutral selected surface;
- independent keyboard focus ring/outline;
- no saturated full-row brand fill.

## 11. Grid presentation

Grid is thumbnail/content-first, not a card gallery.

```text
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  thumbnail   │  │  thumbnail   │  │ placeholder  │
│              │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
 file-name.jpg      design.png        remote-file
```

Rules:

- no permanent boxed card around every item;
- selection may use a subtle cell background + thumbnail ring/inset treatment;
- filename is the main label;
- metadata belongs in List/Context unless a small piece is essential for the Grid decision;
- visible + bounded overscan entries own thumbnail demand;
- unsupported/materialization-required entries use stable useful placeholders;
- no aesthetic-driven hydration.

## 12. Context Panel — content state and visibility are separate

W2 refines the W0 Context concept into two orthogonal dimensions:

```text
content state: none | inspector | selection-summary
visibility:    closed | open
```

### Binding behavior

- no selection => no useful Context content is rendered;
- one selection => Inspector content is available;
- multi-selection => bounded selection summary is available where source authority supports it;
- **selection does not automatically open the panel**;
- user explicitly toggles Context open/closed;
- a safe session/presentation preference may remember that the user prefers Context open;
- if the preferred state is open, a later valid selection may restore the pane; this is user-driven behavior rather than selection-driven surprise;
- clearing selection hides the visible pane content without clearing selection-independent workspace state.

### Large layout

Context may render inline at about `296 px` when explicitly open and the content floor remains satisfied.

### Medium/compact

Context opens as an overlay/sheet with deterministic focus trap and restoration. Closing it never clears selection.

W2 Context is Inspector/selection context only. W3 owns the new shared pinned/floating Preview experience.

## 13. Selection and focus

Selection remains source-owned.

- click: single selection;
- `Ctrl` on Windows / `Cmd` on macOS: toggle according to source capability;
- Shift: contiguous range in the current ordered presentation/source semantics;
- arrows: move logical focus independently from DOM mount lifetime;
- focused item has a visual focus indication distinct from selection;
- selected items remain selected when scrolled out of the mounted virtualization window;
- selection changes do not create navigation history.

### Select All

- Library may use compact `LibrarySelectionV1::all_matching`; never materialize 100k IDs merely for shared UI;
- Browse selects only the scope its source can truthfully own; incomplete enumeration cannot silently imply unseen items are selected.

### Context menu

- right-click/context-menu key on an already-selected item preserves the current multi-selection;
- right-click on an unselected item makes that item the menu target/selection according to source conventions rather than executing actions against a hidden prior selection;
- closing menu/dialog restores logical focus even if virtualization replaced the exact DOM node.

## 14. Open/navigation commands

Folders:

- Enter/double-click navigates according to the active source/mode.

Files:

- Enter/open follows the existing product/open authority.

W2 does not invent a second content-read or mutation authority.

## 15. Search completeness

### Library

Library search/filter/sort remain Query V2-authoritative.

### Browse current-folder search

Progressive search is allowed because progressive matches are useful and the incompleteness can be stated truthfully.

```text
idle
  ↓ query
searching / partial
  ├─ matching entries may publish progressively
  ├─ count is omitted or explicitly "so far"
  └─ target/query-generation change revokes old publication
  ↓ enumeration complete
complete
```

Partial copy:

```text
Searching this folder… · 18 matches so far
```

Complete:

```text
18 matches
```

Never render a final-looking bare result count while only early pages have been searched.

## 16. Browse sort completeness and spatial stability

User-visible sort behavior must preserve spatial stability.

States:

- **complete** — whole-folder order is guaranteed and may be shown as active;
- **preparing** — requested whole-folder order requires more enumeration before it can be truthfully applied;
- **unsupported** — source cannot provide the requested order and the control is disabled/omitted with truthful semantics.

A source may internally know that only a partial set exists, but W2 must **not progressively re-sort the loaded subset and visually claim a global sorted folder**.

When full enumeration is required:

1. record the desired sort;
2. show a quiet `Preparing sort…` state when needed;
3. keep the current/base item order stable while preparation continues;
4. apply the requested global order coherently when completeness is sufficient;
5. restore logical focus/selection by stable UI key rather than row index.

This avoids items jumping around each time another page arrives.

## 17. Managed versus unmanaged treatment

Managed state should help decisions without becoming a badge wall.

Preferred:

- subtle location-level status when relevant;
- Library semantic features simply absent when they do not apply;
- one low-friction `Add this location to Library` action for an unmanaged Browse location.

Placement rule:

- empty Library onboarding may promote `Add location to Library` as the primary action;
- ordinary Browse keeps the action at location/command-bar/overflow level;
- do not repeat a `MANAGED`/`UNMANAGED` badge or admission button on every row/cell.

Unmanaged does not mean unsafe or second-class.

## 18. Empty, loading and failure states

### Empty Library

```text
No files in Library yet

Add a location to organize files with saved views, tags and managed search.
[Add location to Library]

Prefer to browse normally first?
[Browse files]
```

Browse remains usable without indexing.

### Progressive loading

- render workspace chrome immediately;
- Browse pages append without stealing or jumping logical focus;
- skeleton/placeholder UI represents real pending content, not decorative cards;
- thumbnail/provider/deep metadata work never blocks the shell.

### Unavailable location

```text
This location is unavailable right now.
The drive may be disconnected or access may have changed.

[Go Back] [Choose another location] [Try again]
```

Permission case:

```text
Zen needs access to browse this folder.
[Allow access]
```

Failure UI stays contextual so safe Back/Forward/navigation remains available when possible. Unavailable is not deletion.

## 19. Platform adaptation

### macOS

- Favorites / Locations / Providers vocabulary when evidenced;
- `Cmd` selection conventions;
- Retina-aware thumbnail scaling;
- projected user-facing volume/location names;
- no Windows-only vocabulary such as `This PC`.

### Windows

- Home/Quick Access / This PC / Cloud / Network vocabulary when evidenced;
- `Ctrl` selection conventions;
- DPI review across common scale factors;
- `Alt+Space` remains OS-owned.

The visual grammar stays Zen. Platform adaptation changes familiar labels, ordering, modifier keys and capability presentation; it does not fork the entire component system.

## 20. Keyboard and transient-surface priority

- `Cmd/Ctrl+F` => local File Library search;
- arrows => logical item focus;
- Enter => source-owned open/navigation;
- `Cmd/Ctrl+A` => source-owned Select All semantics;
- Shift/Cmd/Ctrl selection follows Section 13;
- Context-menu key / secondary click => source-owned context menu;
- Esc closes the highest-priority transient File Library surface first (context menu, overflow, local-nav drawer, Context sheet), then returns focus deterministically;
- W2 does not assign a new Space Quick Preview architecture.

## 21. W3 Preview boundary and legacy compatibility

W0 defines Preview as a later platform concern; W2 does not reopen that architecture.

- existing Vault Preview behavior may remain temporarily for Library compatibility while the strangler migration is in progress;
- W2 does not create the new shared Space-triggered Quick Preview host/provider UI;
- W3 owns the new floating/pinned Quick Preview hosts/providers;
- W4 owns native Finder/Explorer preview integration evaluation.

Do not make W2 shell coherence depend on W3 behavior.

## 22. Reference matrix

Every reference state below must be implemented later from the same command-bar, navigation, content and Context contracts.

### R1 — Library / List / no selection

```text
┌ Library nav ┬ [‹][›] [Library●|Browse]  Images     [Search] [Filter] [Sort] [List●|Grid] [ⓘ] ┐
│ All Files   ├───────────────────────────────────────────────────────────────────────────────────┤
│ Recent      │ Name                         Kind        Modified           Size                    │
│ TYPES ▸     │ beach-sunrise.jpg            JPEG        Today 09:41        8.2 MB                  │
│ SAVED ▸     │ design-reference.png         PNG         Yesterday          2.1 MB                  │
│ TAGS ▸      │ ... virtualized compact list ...                                                        │
└─────────────┴────────────────────────────────────────────────────────────────────────────────────┘
```

- Context closed;
- Query V2 source;
- no permanent metric/subtitle row.

### R2 — Library / Grid / one selection / Context explicitly open

```text
┌ Library nav ┬ [‹][›] [Library●|Browse] Images [Search] [Filter] [Sort] [List|Grid●] [ⓘ●] ┬ Context ┐
│ TYPES ▾     ├─────────────────────────────────────────────────────────────────────────────┤ design  │
│  Images ●   │   thumbnail      thumbnail●      thumbnail                                 │ PNG     │
│             │   beach.jpg      design.png      scan.png                                  │ Tags…   │
└─────────────┴──────────────────────────────────────────────────────────────────────────────┴─────────┘
```

The user opened Context; selecting `design.png` updates Inspector content but does not itself toggle pane visibility.

### R3 — Browse / List / nested folder

```text
┌ Browse nav ┬ [‹][›] [Library|Browse●] … > Zen-Canvas > src [Search this folder] [Sort] [List●|Grid] [ⓘ] ┐
│ Favorites  ├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Locations  │ Name                    Kind       Modified           Size                                  │
│ Providers  │ components              Folder     Today              —                                     │
│            │ main.ts                 TypeScript Today              4 KB                                  │
└────────────┴───────────────────────────────────────────────────────────────────────────────────────────────┘
```

Browse may still be progressively enumerating; no recursive unmanaged search is implied.

### R4 — Browse / Grid / image-heavy folder

```text
┌ Browse nav ┬ [‹][›] [Library|Browse●] Pictures > Trip 2026 [Search] [Sort] [List|Grid●] [ⓘ] ┐
│            ├───────────────────────────────────────────────────────────────────────────────────┤
│            │   thumbnail      thumbnail      placeholder      thumbnail                        │
│            │   IMG_001.jpg    IMG_002.jpg    remote-file      IMG_004.jpg                     │
└────────────┴───────────────────────────────────────────────────────────────────────────────────┘
```

Grid uses bounded thumbnail ownership and never hydrates solely for visual polish.

### R5 — multi-selection / Context summary

Context remains closed unless the user has chosen it open. When open:

```text
12 items selected
8 images · 3 folders · 1 PDF
Combined size / common metadata only when source authority supports it
[source-safe batch actions]
```

Library may summarize compact `all_matching` selection without ID expansion. Browse summarizes only its actual selection scope.

### R6 — empty Library with usable Browse

Uses the Section 18 empty state. `Add location to Library` is the primary managed CTA; `Browse files` remains immediately available.

### R7 — unavailable / permission / provider-unknown Browse state

Uses Section 18 user-facing copy. Current target context and safe Back/Forward remain visible. Unknown capability remains unknown.

### R8 — minimum `980×680`

Expected compact File Library state:

```text
[App nav] | [‹][›] [Lib|Browse] [local-nav] target/current     [view] [⋯]
          | [optional compact breadcrumb row only when needed]
          | ─────────────────────────────────────────────────────────
          |                 content owns remaining width
          |
          | local nav -> temporary drawer/popover
          | Context   -> temporary sheet/overlay
```

No three-permanent-pane squeeze is allowed at this size.

## 23. Implementation handoff constraints

W2-01 may implement only after this document receives a second Product/UX + architecture review and W2-00 explicitly activates implementation.

Implementation treats these as binding structural/interaction contracts:

- File Library route owns its header and suppresses AppShell `ShellViewHeading` for this route only;
- one normal/wide workspace command bar;
- Library/Browse mode model;
- existing live presentation/selection authorities;
- large/medium/compact pane ownership and content floors;
- explicit/user-controlled Context visibility;
- Browse search completeness and non-jumping sort behavior;
- W3 Preview boundary.

Visual polish may evolve inside those contracts, but changing them requires review.

## 24. Review checklist

Before implementation activation, answer PASS / CHANGE REQUIRED for:

1. Does File Library have exactly one local header/command-bar hierarchy?
2. Is Library/Browse immediately understandable without tutorial chrome?
3. Is default Library navigation calm rather than a 15-item expanded sidebar?
4. Can Finder/Explorer-oriented users browse normally?
5. Does Library communicate semantic value without dashboard metrics?
6. Is List compact and precision-oriented?
7. Is Grid thumbnail-first without card chrome?
8. Does selection avoid involuntary Context layout shifts?
9. Does 980×680 map deterministically to a usable compact state?
10. Are global Spotlight and local File Library search clearly distinct?
11. Are Browse partial search and sort states truthful and spatially stable?
12. Are managed/unmanaged states useful without stigma/noise?
13. Can focus/selection survive virtualization and transient surfaces?
14. Are macOS/Windows adaptations familiar without forking the design system?
15. Has W3 Preview architecture remained outside W2?

## 25. Current review status

- Reference matrix authored: yes.
- First Product/UX self-review: `CHANGES REQUIRED` — review `4957127793`.
- First-review corrections incorporated: yes.
- Product/UX + architecture second review: **PASS** — review `4957144656` on head `23fff9b634a49eeaad14cab4785005e4562b22c7`.
- `980×680` / responsive review: **PASS** in the same second review.
- macOS/Windows reference review: **PASS** for W2 design scope; real provider fixtures remain governed by later implementation QA.
- Reviewed-head docs/governance evidence before metadata closeout: CI #696 / run `32098186412`, success.
- Implementation activation: **not authorized until this reviewed design PR is merged and a separate activation change is reviewed**.
