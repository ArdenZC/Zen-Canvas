# W3 — Quick Preview Experience Freeze

Status: reviewed experience freeze — activation candidate

Activation baseline: `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`

Initiative:
[`../../initiatives/W3-preview-platform.md`](../../initiatives/W3-preview-platform.md)

Implementation plan:
[`09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`](09-W3-PREVIEW-IMPLEMENTATION-PLAN.md)

This document freezes the user-facing W3 Quick Preview behavior before production implementation begins. It is a product/interaction contract, not permission to pull W4 Finder/Explorer system integration into W3.

## 1. Product intent

Quick Preview exists to answer one question with minimal interruption:

> “What is this file/folder?”

The experience must feel immediate, calm and disposable. It should preserve the browsing flow instead of becoming a document editor, media suite or secondary file manager.

W3 has two Zen hosts sharing one Preview Core:

- **Floating Quick Preview** — transient, Space-driven, centered/foreground Preview shell.
- **Pinned Preview** — persistent Context Panel Preview state inside File Library.

They are two host presentations, not two Preview engines.

## 2. Source ownership

Preview always starts from a current source-owned File Library entry.

### Library

- source is the current focused/active managed entry;
- use the managed `EntryRef`/`PreviewSourceRef` identity;
- Query V2 and `LibrarySelectionV1` remain authoritative;
- `all_matching` is never expanded into all matching IDs merely to support Preview;
- when multiple files are selected, Preview follows the current focused/active entry rather than attempting a multi-file representation.

### Browse

- source is a currently loaded, current-generation ephemeral entry;
- use its session-scoped ephemeral ref;
- BrowseService remains identity/lifetime authority;
- a display path is never submitted back as Preview authorization;
- unloaded/unseen entries are not invented for sibling navigation.

If there is no valid current entry, Space does not open a stale or guessed Preview.

## 3. Floating Quick Preview command contract

### Open / toggle

- Space toggles Floating Quick Preview when command context permits.
- If Floating Preview is closed and a valid current entry exists, Space opens the shell immediately and then starts backend Preview work.
- If Floating Preview is already open for the current workspace, Space closes it.
- Enter is not a Preview command.

### Space is ignored when

- a text input/editor owns the key;
- rename/editing is active;
- IME composition is active;
- a menu, modal dialog or other higher-priority command owner is active;
- there is no valid Preview source;
- the current keyboard event is platform/system-owned.

Windows `Alt+Space` remains OS-owned.

### Close

- Esc closes Floating Preview before lower-priority File Library dismissals.
- close button performs the same logical close path;
- closing revokes frontend publication acceptance, cancels/disposes owned Preview work and restores focus to the originating/current File Library entry when that target is still valid;
- if the original entry no longer exists, focus falls back to the owning List/Grid collection surface rather than an arbitrary page element.

## 4. Shell-first behavior

Floating shell existence must not depend on:

- source resolution;
- provider probe/load;
- materialization;
- network/provider state;
- folder analytics;
- image decode;
- syntax highlighting;
- exact counts.

The shell becomes visible first, with a truthful state such as Resolving/Preparing/Loading, and provider work proceeds afterward.

The target remains the W0 performance contract:

- Preview shell <= 100 ms p95;
- normal local Text/JSON/Markdown/Image useful representation <= 300 ms p95 where applicable.

A slow or failed provider must not produce an infinite spinner.

## 5. Live source switching

When Floating Preview remains open and the File Library active/focused entry changes:

1. current source A loses publication rights immediately;
2. the existing host shell remains mounted;
3. the Preview experience switches the backend session/source to B through the authoritative lifecycle surface;
4. shell state changes to the new truthful resolving/loading state;
5. only B's current request/sourceVersion may publish.

Do not tear down/recreate the outer shell for every arrow-key navigation unless a later reviewed implementation proves that is required for correctness.

A late A provider result must never flash inside B's Preview.

## 6. Floating host visual anatomy

The default Floating host is intentionally sparse.

```text
┌─────────────────────────────────────────────────────────┐
│  file identity/title                         Pin   Close │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                  Preview content                        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  optional prev/next     concise state/metadata   actions│
└─────────────────────────────────────────────────────────┘
```

Required regions:

- compact identity/title header;
- one dominant content region;
- loading/failure/metadata fallback state within the same content region;
- Pin action;
- Close action;
- Open/Reveal only when effective capabilities allow them;
- bounded sibling navigation only when available;
- small metadata/state footer when useful.

Do not add by default:

- permanent toolbars full of format-specific buttons;
- file-management mutation controls;
- Content Understanding/AI controls;
- editor formatting controls;
- provider diagnostics/telemetry;
- raw filesystem path authority.

Complex format-specific controls are shown only when the representation and effective capability justify them.

## 7. Floating host interaction ownership

For W3 v1, Floating Quick Preview is a lightweight foreground dialog-like host with deterministic focus/keyboard ownership.

- opening moves logical interaction ownership to the Preview host;
- the host exposes an accessible dialog/region identity and close action;
- Tab stays within actionable Preview controls while the host is open;
- Esc always closes the Floating host;
- Previous/Next or arrow navigation, when enabled, explicitly asks the owning File Library workspace to move its active/focused entry and then follows that source;
- the host does not create a hidden second selection model;
- closing restores workspace focus.

This ownership is intentionally different from Finder's implementation details; W3 preserves the Quick Preview workflow without pretending Zen is Finder/Explorer.

## 8. Pinned Preview contract

Pinned Preview is the W2 Context Panel's `Preview` state.

### Pinning

- Pin from Floating Preview hands the current source/session intent to the `zen_pinned` host through typed Preview identity, never a raw path;
- after a successful handoff, Floating Preview closes;
- W3 v1 does not keep duplicate Floating and Pinned hosts for the same source by default.

### While pinned

- the Context Panel remains non-modal;
- normal File Library List/Grid interaction remains available;
- pinned Preview follows the current active/focused entry where a valid source exists;
- switching entries uses the same stale-publication/cancellation rules as Floating Preview;
- no valid current entry produces a clear “Select an item to preview” state rather than retaining stale content from the previous source.

### Unpin / close

- closing/unpinning Preview returns the Context Panel to Inspector behavior when the current selection supports Inspector;
- otherwise Context follows the normal W2 no-selection state;
- no Preview-specific selection state survives after host disposal.

## 9. Sibling navigation

Quick Preview navigation is a projection over the current workspace collection, not a second query engine.

- Library uses a bounded navigation window supplied by the current Query V2-backed presentation/focus owner;
- Browse uses current loaded/current-generation entries and normal Browse progression through the owning surface;
- Preview never asks for one million IDs to implement Next/Previous;
- `all_matching` remains compact;
- sibling navigation updates File Library focus/active selection where required so the workspace and Preview stay coherent;
- if the collection generation changes, stale navigation windows are discarded.

## 10. Preview states and UX

The host presents explicit state rather than collapsing all failure into one error.

### Resolving / Preparing / Loading

- keep shell visible;
- show lightweight progress/state, not blocking page chrome;
- keep Close/Esc responsive;
- allow source switch to cancel/revoke old work.

### Ready

Render the current `PreviewRepresentation` family with only effective controls.

### Provider-local failure

For unsupported, provider failure, timeout or corrupt source:

- Preview Core may try the next compatible provider according to registry priority;
- if no provider succeeds, preserve the host and show Metadata fallback;
- optional concise notice may explain that rich preview is unavailable.

### Source/session terminal state

For source unavailable, materialization required, permission denied, identity changed or cancelled:

- do not try another byte-reading provider to bypass the condition;
- preserve safe Metadata-only information where allowed;
- show the specific state and safe recovery action only when an authoritative capability exists.

### Cancelled / disposed

- cancelled work must not publish later;
- disposed host/session is terminal and invisible to the UI after teardown.

## 11. Materialization UX

Preview never silently downloads provider/cloud content.

`materialization_required` is a first-class visible state.

A `Download to Preview`/equivalent action may appear only when BOTH are true:

1. effective capabilities say materialization can be requested; and
2. Zen has a separately reviewed authoritative user-initiated materialization action for that source/platform.

If such an action is not available, the host explains the state without presenting a fake or non-functional download control.

After user-authorized materialization, Preview must re-resolve the source and obtain a fresh sourceVersion/read eligibility before loading content.

## 12. Representation rendering

Hosts render typed representation families; they do not decide providers from extensions.

### Metadata

- always safe fallback when available;
- name/type/size/date/materialization/read status and safe capability-backed actions;
- no fake rich preview.

### Text / Code

- read-only;
- text selection/search only if effective capability allows;
- bounded/truncated state is visible;
- no execution.

### SafeHTML / Markdown

- sanitized output only;
- no script execution;
- no arbitrary external/network resources;
- no renderer filesystem-relative asset resolution.

### StructuredTree

- expandable read-only structure;
- bounded depth/items where required;
- explicit truncation/completeness.

### Table

- virtualized/bounded rows and columns where needed;
- no spreadsheet formula execution;
- explicit truncation/completeness.

### Image

- fit-to-view by default;
- zoom only when effective capability permits;
- backend-owned safe asset transport, not source-path conversion;
- full-resolution work can upgrade after shell/placeholder without blocking shell.

### FolderSummary

- immediate bounded summary first;
- progressive facts update while current;
- clearly Partial until complete;
- never imply a complete recursive scan from a sample.

### ArchiveTree

- metadata/index browsing only;
- no silent extraction;
- bounded entry/tree rendering;
- explicit truncation/corrupt states.

### Media / NativeOpaque

- architecture families may exist, but W3 does not promise a Zen renderer or W4 native system host merely because the enum supports them;
- controls appear only when an actual current provider/host capability exists.

## 13. Context Panel relationship

Inspector and Pinned Preview are mutually coherent Context states.

- Inspector remains the default selected-entry context;
- Pinned Preview explicitly switches Context to Preview;
- Floating Quick Preview is independent from whether Context Panel is open;
- opening Floating Preview does not automatically pin Context;
- closing Floating Preview does not mutate Context state unless it was explicitly pinned;
- W3 does not merge Inspector metadata authority into Preview Core.

## 14. Legacy preview migration

The current `FileLibraryPreviewDialog` and macOS Inspector Quick Look thumbnail path are compatibility inputs, not the new W3 architecture.

Migration rules:

- new Quick Preview commands use `fileWorkspaceApi.preview*`, not a second raw-path/detail-dialog Preview engine;
- a legacy preview-specific UI caller may be removed only after the W3 host replacement is active and focused behavioral/browser equivalence is proven;
- macOS Quick Look thumbnail may continue to serve Thumbnail/Inspector compatibility until the owning replacement is proven;
- broader Vault compatibility stays under TD-015 and is not mass-deleted in W3.

## 15. Platform adaptation

### Shared

- Space = Quick Preview toggle when eligible;
- Esc = close Floating Quick Preview;
- no implicit hydration;
- same Preview identity/cancellation/security model.

### macOS Apple Silicon

- labels/actions may use Finder terminology such as Reveal in Finder;
- existing Quick Look thumbnail capability may be reused through its existing safe adapter where it serves Thumbnail/placeholder needs;
- Finder Quick Look extension/system-host integration remains W4.

### Windows 11 x64

- labels/actions follow Explorer conventions;
- `Alt+Space` remains OS-owned;
- Windows Preview Handler/system integration remains W4;
- do not simulate unavailable native capability with unsafe path/plugin loading.

W3 host UI may differ subtly by platform where native expectations differ, but core concepts remain coherent.

## 16. Responsive behavior

W3 inherits the W2 minimum supported product window of 980×680.

### Floating

- bounded inside the current viewport with safe outer margins;
- does not force document horizontal overflow;
- content region can scroll internally when representation requires it;
- header/footer actions remain reachable;
- minimum practical content size degrades to Metadata fallback/presentation rather than overlapping controls;
- resizing does not restart provider work unless representation size itself requires a bounded re-render.

### Pinned

- uses the existing W2 Context Panel responsive model;
- large layout may be inline;
- compact layout uses the existing Context sheet/overlay behavior;
- Preview content adapts within Context rather than creating another side panel.

## 17. Accessibility

HARD behavior:

- Space command is discoverable in action labels/help where applicable;
- Floating host has an accessible name tied to the current item;
- loading/failure state changes are announced without excessive live-region spam;
- Close, Pin, Open/Reveal and sibling navigation are keyboard reachable;
- Esc is deterministic;
- focus returns to the originating/current workspace entry or collection fallback;
- no keyboard shortcut fires through text editing/IME ownership;
- representation content preserves meaningful text/structure semantics where safe.

Hosted/browser accessibility evidence is not relabeled as genuine VoiceOver/Narrator manual QA.

## 18. Security and privacy UX

The UI must never encourage a false mental model that Preview is executing a file.

- Preview is read-only;
- no macros/scripts are executed;
- no arbitrary remote assets are fetched;
- no AI/content understanding runs implicitly;
- archives are not extracted silently;
- cloud/provider content is not downloaded silently;
- provider failure does not silently open the file in another application;
- external Open is an explicit user action and only appears when capability permits.

## 19. Performance/interaction freeze

The following are W3 product gates, not optional polish:

- shell-first <=100 ms p95 target;
- normal local built-in useful representation <=300 ms p95 target where specified by W0;
- close/Esc remains responsive while provider work is active;
- 100-entry rapid switching publishes only the final current source;
- no unbounded provider/request/asset growth;
- close/dispose releases resources for immediate mutation/open;
- 100k Folder Preview remains shell-first and bounded/progressive;
- no W2 100k List/Grid or Query V2 100k/1M regression is accepted.

## 20. Frozen W3 v1 decisions

For W3 implementation, the following are treated as frozen unless independent review finds a correctness/security blocker:

1. one Preview Core, two Zen hosts (Floating and Pinned);
2. Space toggles Floating Quick Preview; Esc closes it;
3. Floating is foreground dialog-like ownership; Pinned is non-modal Context state;
4. Preview follows current focused/active entry, not entire selection materialization;
5. switching source keeps the host shell and revokes old publication;
6. Pinned Preview follows File Library focus/active entry and never retains stale hidden source content when no valid entry exists;
7. capability-driven controls only;
8. Metadata fallback always survives provider-local rich-preview failure;
9. no implicit materialization;
10. no raw path authority in renderer/provider-facing contracts;
11. no third-party Preview plugin SDK in v1;
12. no Finder/Explorer system-host integration in W3;
13. no automatic W4 activation at W3 closeout.
