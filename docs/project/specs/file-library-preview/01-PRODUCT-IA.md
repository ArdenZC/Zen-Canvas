# W0-B — Product and Information Architecture

## 1. One File Library entry, two modes

The application keeps one top-level **File Library** entry.

Inside it:

- **Library** — semantic/query organization over managed files.
- **Browse** — physical filesystem navigation over managed or unmanaged locations.

The mode control is a lightweight segmented control, not two separate routes/modules.

## 2. Three-pane workspace

```text
+----------------+------------------------------+----------------+
| Navigation     | Content                      | Context        |
|                |                              |                |
| where/what     | current target entries       | selected item  |
+----------------+------------------------------+----------------+
```

Responsibilities:

- Navigation: where the user is and where they can go.
- Content: entries in the current target.
- Context: information or pinned preview for the current selection.

Context can be hidden when nothing is selected.

## 3. Library Mode navigation

Suggested navigation hierarchy:

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
<existing saved views>

TAGS
<existing tags>

LOCATIONS
<managed locations only>
```

Library Mode reuses Query V2. Smart views are product-level presets compiled into Query V2 semantics; they do not create a new query engine.

## 4. Browse Mode navigation

Browse Mode is familiar, platform-adaptive filesystem navigation.

### macOS

```text
FAVORITES
Desktop
Documents
Downloads
Pictures

LOCATIONS
Macintosh HD
External volumes

PROVIDERS
iCloud Drive
other available providers
```

### Windows

```text
HOME / QUICK ACCESS
Desktop
Documents
Downloads
Pictures

THIS PC
C:
D:
removable drives

CLOUD
OneDrive / providers

NETWORK
mapped / UNC locations
```

The experience should feel native to each platform without claiming to replace Finder/File Explorer.

## 5. Managed versus unmanaged

Browse can open an unmanaged location immediately.

Unmanaged browsing must not implicitly:

- create scan roots;
- start managed indexing/content analysis;
- create managed tags/classification/findings;
- schedule full-location thumbnail generation.

A low-friction explicit **Add this location to Library** action may admit a location through the existing scan-root authority.

## 6. Content presentation

Two independent dimensions:

- Organization mode: Library / Browse.
- Presentation mode: List / Grid.

All four combinations are valid.

Per-target preference should be remembered where safe, e.g. Images -> Grid, Code -> List, a photo directory -> Grid.

## 7. Navigation targets and history

Back/Forward history is unified across Library and Browse targets.

Examples of target kinds:

- Smart View
- Saved View
- Tag
- Library Search
- Browse Path

The workspace additionally remembers `lastLibraryTarget` and `lastBrowseTarget` so a direct mode switch can return to the previous place in that mode.

## 8. Breadcrumb rules

- Library targets are not fake filesystem paths; show target title and context, not fake breadcrumbs.
- Browse targets use real breadcrumbs.
- Narrow layouts collapse older ancestors first and preserve the ancestors nearest the current folder (`… > Zen-Canvas > src`).

## 9. Search ownership

Library search remains Query V2 scoped to the current Library target unless expanded to managed-library scope.

Browse search may offer:

- Current folder
- Current location
- Managed Library

Managed Library search still uses Query V2. Global Search remains a separate product authority.

## 10. Context Panel

`Context Panel` replaces the assumption of a permanently visible Inspector.

States:

- no selection -> hidden;
- selection -> Inspector;
- pinned preview -> Preview.

Floating Quick Preview remains independent from the Context Panel.

## 11. Core commands at product level

- Space -> Toggle Quick Preview when command context allows.
- Esc -> Close Quick Preview.
- Enter is not a Preview command; Browse/Library command semantics decide navigation/open behavior.
- Pin Preview is a command, but physical keyboard mapping remains platform-specific. Windows `Alt+Space` remains OS-owned.

## 12. Empty states

Library can be empty and continue to encourage managed-folder admission.

Browse must still function when Library has no managed roots. This is an intentional onboarding advantage.
