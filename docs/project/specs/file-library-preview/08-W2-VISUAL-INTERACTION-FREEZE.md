# W2 — File Library 2.0 Visual / Interaction Freeze

Status: draft reference matrix — review required before implementation activation

Baseline: `master@e91416c83082b61a0d3042c9438d77c7b8586297`

Initiative: [`../../initiatives/W2-file-library-experience.md`](../../initiatives/W2-file-library-experience.md)

Implementation plan: [`07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`](07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md)

## 1. Design thesis

File Library 2.0 should feel like one calm desktop workspace with two legitimate ways to work:

- **Library** for managed, semantic/query-driven organization;
- **Browse** for familiar direct filesystem navigation.

The user should not feel that switching modes launches a different product. Navigation, content and Context Panel retain the same spatial grammar while the source authority and mode-specific controls change truthfully.

The design borrows familiarity from Finder/Explorer without cloning either shell and preserves Zen's quieter visual language.

## 2. Shell ownership

### App-level chrome — unchanged by W2

Owned by existing `AppShell`:

- native/window titlebar controls;
- global Spotlight/search trigger;
- primary Zen product sidebar;
- global modal/toast surfaces.

### File Library workspace-local chrome

Owned by W2:

- Back / Forward;
- Library / Browse segmented mode control;
- local navigation rail/pane;
- target title or Browse breadcrumb;
- source-appropriate search/filter/sort controls;
- List / Grid toggle;
- Context Panel toggle/state;
- content viewport.

W2 must not introduce a second application titlebar, second product sidebar or duplicate global PageHeader stack.

## 3. Spatial hierarchy

### Wide desktop

```text
┌──────────────────────────────────────── AppShell ──────────────────────────────────────────────┐
│ [window]                       Global Search / Spotlight                          [window]       │
├───────────────────┬─────────────────────────────────────────────────────────────────────────────┤
│ Zen product nav   │ File Library workspace toolbar                                                     │
│                   │ [‹] [›]  [ Library | Browse ]                         [List|Grid] [Context] │
│                   ├─────────────────┬─────────────────────────────────────┬────────────────────┤
│                   │ local nav       │ target / breadcrumb + local tools  │ Context Panel      │
│                   │                 ├─────────────────────────────────────┤                    │
│                   │                 │                                     │                    │
│                   │                 │      virtualized content viewport   │ Inspector/summary  │
│                   │                 │                                     │                    │
│                   │                 │                                     │                    │
│                   └─────────────────┴─────────────────────────────────────┴────────────────────┤
└───────────────────┴─────────────────────────────────────────────────────────────────────────────┘
```

Hierarchy rules:

- Content is the visual focus.
- Local navigation is quieter than content and narrower than the application sidebar.
- Context Panel appears only when selection/context warrants it.
- The workspace toolbar is compact desktop chrome, not a large web page header.

Reference sizing direction, not immutable pixels:

- workspace local navigation: approximately 180–220 px wide;
- Context Panel: approximately 280–340 px when shown;
- toolbar/control height: compact desktop scale, roughly 32–36 px controls inside the existing AppShell frame;
- List row density should support information-rich browsing without dashboard-sized padding;
- Grid cell density should prioritize thumbnail/content rather than metadata cards.

## 4. Responsive ownership — minimum 980×680

At the minimum supported product layout:

1. application-level AppShell behavior stays owned by AppShell;
2. W2 local navigation collapses before the content viewport becomes unusable;
3. Context Panel stops consuming permanent width and becomes an explicit overlay/sheet/toggle surface;
4. local secondary actions collapse into an overflow menu before primary mode/view controls disappear;
5. Browse breadcrumb collapses oldest ancestors first;
6. current target/folder, Back/Forward, Library/Browse, List/Grid and selection focus remain reachable;
7. responsive transitions preserve selection and keyboard focus.

Reference structure:

```text
┌────────────────────────────── AppShell ──────────────────────────────┐
│             Global Search                                            │
├──────────────┬────────────────────────────────────────────────────────┤
│ app nav      │ [‹][›] [Library|Browse] [local-nav] [List|Grid] [⋯]  │
│              ├────────────────────────────────────────────────────────┤
│              │ target / … > nearest ancestor > current               │
│              ├────────────────────────────────────────────────────────┤
│              │                                                        │
│              │               content viewport                         │
│              │                                                        │
│              │                         [Context opens as overlay]      │
└──────────────┴────────────────────────────────────────────────────────┘
```

## 5. Shared visual language

### Surfaces

- use the existing Zen canvas/surface/divider tokens;
- avoid stacking multiple translucent cards inside the content viewport;
- local nav and Context Panel may use subtle shell materials, but the content area should remain visually clean;
- separators carry hierarchy more often than boxed cards.

### Selection

- selected items use the existing selected-surface family rather than saturated neon fills;
- keyboard focus is independently visible from selection;
- multi-selection does not visually convert every item into a heavy card;
- unavailable items remain selectable when meaningful, but actions reflect capability/availability.

### Typography

- target/folder name is primary;
- item names are the strongest text inside content;
- metadata is secondary/tertiary;
- source/provider/technical state is shown only when it helps the user decide an action.

### Icons and thumbnails

- folders/files remain identifiable without thumbnails;
- thumbnail failure or unsupported status never leaves an empty/broken-image-looking card;
- no provider hydration is triggered merely to improve aesthetics.

## 6. Shared workspace toolbar

Canonical control priority:

```text
[Back] [Forward]   [ Library | Browse ]        [source-local actions]      [List][Grid] [Context]
```

Rules:

- Back/Forward refer to `WorkspaceSession` chronology, not browser history.
- Mode control is persistent and compact.
- Search/filter/sort appear in the source-local content header/toolbar region, not as a second global search.
- List/Grid updates live history presentation state.
- Context toggles Inspector/summary visibility where context exists.
- disabled controls explain capability truth through accessible labels/tooltips where useful.

## 7. Library navigation

Library local navigation is semantic, not a fake filesystem tree.

Suggested hierarchy:

```text
LIBRARY
  All Files
  Recent
  Documents
  Images
  Video
  Audio
  Archives
  Code

SAVED
  <saved views>

TAGS
  <tags>

LOCATIONS
  <managed locations only>
```

Rules:

- active semantic target receives one clear selected state;
- category counts are optional and should not become noisy telemetry;
- saved view/tag changes may become navigation targets;
- transient filters/search text do not create one navigation history entry per edit.

## 8. Browse navigation

Browse local navigation uses platform-familiar group concepts while runtime evidence remains authoritative.

### macOS

```text
FAVORITES
  Desktop
  Documents
  Downloads
  Pictures

LOCATIONS
  Macintosh HD
  <external volumes when evidenced>

PROVIDERS
  iCloud Drive / providers only when evidenced
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
  OneDrive / provider entries when evidenced

NETWORK
  mapped / UNC entries when evidenced
```

No platform label may fabricate provider/volume capability from pathname heuristics.

## 9. Library target header

Library targets show semantic identity, not breadcrumbs.

Example:

```text
Images                                      [Search Images…] [Filter] [Sort]
All indexed images · 12,482 items
```

For a saved view:

```text
Receipts 2026                                [Search…] [Filter] [Sort]
Saved view · managed Library
```

Avoid strings that imitate filesystem paths such as `Library > Images` when no such path authority exists.

## 10. Browse target header / breadcrumb

Browse uses actual breadcrumbs:

```text
Macintosh HD > Users > arden > Projects > Zen-Canvas
```

Narrow collapse:

```text
… > Projects > Zen-Canvas
```

Rules:

- preserve current folder and nearest ancestors;
- breadcrumb elements navigate using W1 live path/session semantics;
- do not expose raw authority/path tokens as technical text;
- unavailable/stale target state appears adjacent to target context rather than replacing the whole workspace with a generic error page when safe navigation remains possible.

## 11. Reference R1 — Library / List / no selection

```text
┌ local Library nav ┬ Images                                      [Search][Filter][Sort] [List●][Grid] ┐
│ All Files         ├───────────────────────────────────────────────────────────────────────────────────┤
│ Recent            │ Name                         Kind        Modified           Size                  │
│ Documents         │ ───────────────────────────────────────────────────────────────────────────────── │
│ Images  ●         │ beach-sunrise.jpg            JPEG        Today 09:41        8.2 MB                │
│ Video             │ design-reference.png         PNG         Yesterday          2.1 MB                │
│ ...               │ screenshots                  Folder      Aug 16             —                     │
│                   │ ... virtualized list ...                                                        │
└───────────────────┴───────────────────────────────────────────────────────────────────────────────────┘
```

State:

- mode: Library;
- presentation: List;
- no selection;
- Context Panel: hidden;
- source: Query V2;
- list rows virtualized;
- no permanent metrics strip above content.

## 12. Reference R2 — Library / Grid / one selection + Inspector

```text
┌ Library nav ┬ Images                           [Search][Filter][Sort] [List][Grid●] ┬ Context          ┐
│             ├───────────────────────────────────────────────────────────────────────┤ Inspector        │
│ Images ●    │  ┌──────────┐ ┌──────────┐ ┌──────────┐                              │ design-ref.png  │
│             │  │ thumbnail│ │ thumbnail│ │ thumbnail│                              │ PNG · 2.1 MB    │
│             │  │ beach…   │ │ design…● │ │ scan…    │                              │ Modified ...    │
│             │  └──────────┘ └──────────┘ └──────────┘                              │ Tags ...        │
│             │  ... viewport + bounded overscan ...                                 │ [Reveal] ...    │
└─────────────┴────────────────────────────────────────────────────────────────────────┴────────────────┘
```

State:

- one selection;
- Inspector visible;
- thumbnail demand only for viewport + bounded overscan;
- Inspector uses existing Library detail authority;
- Grid selection uses Library selection facade; virtualization does not own selection.

## 13. Reference R3 — Browse / List / nested folder

```text
┌ Browse nav ┬ … > Projects > Zen-Canvas                [Search folder…] [Sort] [List●][Grid] ┐
│ Favorites  ├─────────────────────────────────────────────────────────────────────────────────┤
│ Locations  │ Name                    Kind       Modified           Size                      │
│ Providers  │ src                     Folder     Today              —                         │
│            │ docs                    Folder     Today              —                         │
│            │ package.json            JSON       Yesterday          4 KB                      │
│            │ ... progressive pages ...                                                      │
└────────────┴─────────────────────────────────────────────────────────────────────────────────┘
```

State:

- source: W1 Browse;
- breadcrumbs use live refs;
- current-folder enumeration may still be in progress;
- unmanaged location is usable without admission;
- no implicit recursive search/indexing.

## 14. Reference R4 — Browse / Grid / image-heavy folder

```text
┌ Browse nav ┬ Pictures > Trip 2026                          [Search][Sort] [List][Grid●] ┐
│            ├───────────────────────────────────────────────────────────────────────────┤
│            │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                      │
│            │ │ thumbnail│ │ thumbnail│ │ placeholder│ thumbnail│                      │
│            │ │ IMG_...  │ │ IMG_...  │ │ remote…  │ │ IMG_...  │                      │
│            │ └──────────┘ └──────────┘ └──────────┘ └──────────┘                      │
│            │               ... virtualized grid ...                                   │
└────────────┴───────────────────────────────────────────────────────────────────────────┘
```

Rules:

- visible + overscan thumbnail ownership only;
- unsupported/materialization-required item receives a useful placeholder;
- no implicit hydration;
- scroll-away cancels/releases obsolete ownership according to W1 integration contracts.

## 15. Reference R5 — multi-selection + Context summary

```text
Content: 12 selected                                              Context Panel
                                                                  12 items selected
                                                                  8 images · 3 folders · 1 PDF
                                                                  Combined size: when authority supports
                                                                  Common tags: when authority supports
                                                                  [source-safe batch actions]
```

Library:

- summary may consume `LibrarySelectionV1::all_matching`/selection-summary authority without materializing all IDs.

Browse:

- summary covers only the selection scope Browse actually owns;
- UI must not imply unseen/incomplete-enumeration items are selected.

## 16. Reference R6 — empty Library with usable Browse onboarding

Library state:

```text
No files in Library yet
Add a location to enable semantic organization, saved views and managed search.

[Add location to Library]

You can also switch to Browse to work with files immediately without indexing them.
[Browse files]
```

Rules:

- Browse is not disabled when Library is empty;
- no coercive onboarding that requires indexing before ordinary browsing;
- Add location routes through existing admission/scan-root authority.

## 17. Reference R7 — Browse unavailable / permission / provider unknown

Failure is contextual and truthful.

Example:

```text
… > External Drive > Project

This location is currently unavailable.
The drive may be disconnected or access may have changed.

[Go Back] [Choose another location] [Retry metadata access]
```

Permission case:

```text
Access is required to browse this folder.
[Review access]
```

Rules:

- unavailable is not deletion;
- unknown provider capability remains unknown;
- no automatic hydration or recursive retry storm;
- preserve safe Back/Forward/navigation where possible.

## 18. Reference R8 — 980×680 state

```text
[App nav] | [‹][›] [Lib|Browse] [local-nav]   [List|Grid] [Context] [⋯]
          | … > Projects > Zen-Canvas
          | ──────────────────────────────────────────────────────
          | content viewport owns almost all remaining width
          |
          | Context -> overlay/sheet when opened
          | local nav -> drawer/compact popover when opened
```

Primary content may not be squeezed between three permanently visible navigation panels at this size.

## 19. Search completeness states

### Library

Search/filter/sort remain Query V2-driven. UI follows Query V2 result/count semantics.

### Browse — current folder

State machine:

```text
idle
  ↓ query
searching / partial
  ├─ progressive matching entries may appear
  ├─ count shown as partial/so-far if shown at all
  └─ target/query generation change revokes old publication
  ↓ folder enumeration complete
complete
```

Example partial copy:

```text
Searching current folder… · 18 matches so far
```

Complete:

```text
18 matches
```

Never show a bare final-looking `18 results` while only early pages have been searched.

## 20. Browse sort completeness states

Controls reflect source capability:

- **complete** — whole-folder stable order is guaranteed;
- **preparing** — full current-folder enumeration is required before the requested global order can be claimed;
- **partial** — only a progressive subset is currently ordered and UI says so explicitly;
- **unsupported** — option disabled/omitted with truthful capability semantics.

Never sort loaded pages locally and label the folder globally sorted without qualification.

## 21. Managed versus unmanaged treatment

Managed state should help action decisions without becoming a badge wall.

Preferred:

- navigation/location-level subtle status;
- one explicit `Add this location to Library` action for unmanaged Browse locations;
- Library-only semantic features simply absent/disabled where inapplicable.

Avoid:

- bright `MANAGED`/`UNMANAGED` badge on every row;
- exposing scan revision/provider IDs;
- implying unmanaged files are unsafe or second-class.

## 22. Selection and focus interaction

Selection authority stays source-owned.

- click: single selection;
- Ctrl on Windows / Cmd on macOS: toggle according to source capability;
- Shift: contiguous range within current ordered presentation/source semantics;
- keyboard arrows: move focus deterministically even under virtualization;
- selection persists when selected cells scroll out of mount range;
- focused item receives a focus indication distinct from selection;
- selection changes do not create navigation history.

Select All:

- Library: may use compact `LibrarySelectionV1::all_matching` semantics;
- Browse: must state the actual supported scope; incomplete enumeration cannot silently mean unseen entries are selected.

## 23. Open/navigation interaction

Folders:

- Enter/double-click opens/navigates according to current mode/source semantics.

Files:

- Enter/open action follows existing product/open authority.

Preview:

- W2 may preserve current Vault Preview compatibility behavior where needed;
- W2 does not define the new shared Space Quick Preview architecture;
- W3 owns floating/pinned Quick Preview hosts/providers.

## 24. Context menu and focus restoration

- right-click/context-menu key opens menu for focused/selected item using source-owned actions;
- closing menu restores focus to a valid item/content target;
- if virtualization unmounted the exact element, focus falls back to logical list/grid focus rather than `document.body`;
- dialogs opened from a context menu restore logical focus after close;
- unavailable actions are omitted/disabled according to capability, not guessed.

## 25. Responsive Context Panel

Wide:

- Context Panel is a right-side pane when selection warrants it.

Narrow/minimum layout:

- explicit Context button opens overlay/sheet;
- overlay has deterministic focus trap/restore;
- close does not clear selection;
- returning to wide layout may restore pane visibility according to current W2 presentation state without changing selection authority.

## 26. Responsive local navigation

Wide:

- local navigation pane may remain visible.

Narrow:

- local navigation becomes a drawer/popover/compact rail owned by W2;
- current target remains visible in the header/breadcrumb after the pane closes;
- choosing a target closes transient navigation chrome and restores focus into the workspace content/header deliberately.

## 27. Empty/loading/progressive principles

- show shell immediately;
- never block workspace chrome on thumbnail/provider/deep metadata work;
- progressive Browse pages append without jumping focus;
- skeletons/placeholders should represent actual pending content, not decorative dashboard cards;
- unsupported/unavailable items get stable fallback representations.

## 28. Visual review checklist

Before implementation activation, reviewers must answer PASS/CHANGE REQUIRED for:

1. Is the difference between Library and Browse understandable without a tutorial?
2. Does the workspace remain one product rather than two separate screens?
3. Is app-level versus File Library-local navigation unambiguous?
4. Is List information-dense enough for Finder/Explorer-oriented users?
5. Does Grid prioritize content rather than card chrome?
6. Is Context Panel absent when it has no value?
7. Does 980×680 remain genuinely usable?
8. Are platform differences explicit but coherent?
9. Are search/sort completeness states truthful?
10. Are managed/unmanaged states useful without visual stigma/noise?
11. Can keyboard/focus/selection semantics survive virtualization?
12. Has W3 Preview architecture remained outside W2?

## 29. Implementation handoff constraints

W2-01 may implement only after this document is independently reviewed and W2-00 activation is approved.

Implementation must treat these references as structural/interaction contracts, not pixel-perfect immutable art. Visual polish can evolve within the frozen hierarchy, but changing any of the following requires review:

- app/workspace chrome ownership;
- Library/Browse mode model;
- live presentation/selection authority;
- 980×680 collapse ownership;
- search/sort completeness semantics;
- W3 Preview boundary.

## 30. Current review status

- Reference matrix authored: yes.
- Product/UX independent review: pending.
- Architecture/authority independent review: pending.
- 980×680 review: pending.
- macOS/Windows reference review: pending.
- Implementation activation: **not authorized**.