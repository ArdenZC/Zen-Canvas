# W2-01 — Workspace Shell + Experience Controller

Status: active — implementation

Starting baseline: `master@e859578cce1c502bff309788e1ae58629251071d` (PR #88 W2-00 activation squash merge)

Branch: `feat/w2-01-file-library-workspace-shell`

## Goal

Create the user-facing File Library workspace owner without rewriting managed Library query/content behavior or prematurely implementing W2-02+ presentation contracts.

## In scope

- create `src/views/fileLibrary/` as the W2 workspace boundary;
- route AppShell `library` to `FileLibraryWorkspace`;
- suppress ordinary `ShellViewHeading` for File Library only;
- keep AppShell titlebar, global Spotlight, primary product sidebar, toast/modal surfaces and all non-Library routes unchanged;
- add one compact workspace command bar with Back/Forward, Library/Browse mode control and target identity;
- introduce a small experience controller that projects mode while delegating live target/history/presentation truth to W1 `FileWorkspaceController` / `WorkspaceSession`;
- initialize the existing managed Library surface through a `LibraryModeAdapter` rather than moving/rebuilding `VaultView`;
- define Navigation / Content / Context shell slots with responsive ownership matching the reviewed W2-00 contract;
- allow an authority-free first-entry Browse shell state when no admitted Browse target exists; do not fabricate a `LocationRef` or `BrowsePathRef` merely to switch the UI mode;
- add focused tests for mode memory/history ownership and AppShell route/header ownership.

## Non-goals

- shared List/Grid entry or selection contracts (W2-02);
- migrating/refactoring Query V2 behavior out of `VaultView` beyond the adapter boundary (W2-03);
- Browse location admission, folder enumeration, breadcrumbs or real Browse content (W2-04);
- shared virtualized List or Grid implementation (W2-05/W2-06);
- shared Context/Inspector behavior (W2-07);
- W2 search/filter/sort/preferences or platform navigation implementation (W2-08/W2-09);
- W3 Quick Preview or W4 native integration;
- new durable store/schema, Query authority, watcher, Scheduler, Read Gate or mutation/recovery path.

## Authority rules

- `WorkspaceSession` remains the only live navigation-history and `viewMode`/`scrollAnchor` authority.
- `FileWorkspaceController` remains the lifecycle coordinator for W1 Browse resources.
- W2 shell mode is a projection. When a remembered target exists, switching mode must use W1 session/controller chronology. When no target exists for the requested mode, the shell may show that mode without inventing an authority-bearing target or history entry.
- Existing `VaultView` / Query V2 stores remain the managed Library content authority during W2-01.
- W2-01 must not introduce a global Zustand store for session-scoped Browse/workspace state.

## Visual / responsive contract

From the reviewed W2-00 freeze:

- File Library opts out of AppShell `ShellViewHeading` only for this route;
- normal/wide File Library has one workspace command bar;
- responsive behavior is based on available File Library width after AppShell;
- Large `>=1120px`: workspace-local navigation may be inline; Context inline only when explicitly useful/open;
- Medium `820–1119px`: Context is overlay; local navigation may collapse early to preserve content floor;
- Compact `<820px`: local navigation and Context are transient/overlay and content owns remaining width;
- minimum application size 980×680 therefore maps to a compact File Library workspace rather than a squeezed three-pane desktop layout.

W2-01 establishes slot ownership and shell geometry only. It does not invent final W2-05/06/07 content inside those slots.

## Expected implementation shape

```text
AppShell
└─ FileLibraryWorkspace
   ├─ FileLibraryExperienceController
   │  └─ FileWorkspaceController
   │     └─ WorkspaceSession
   ├─ WorkspaceCommandBar
   └─ WorkspaceBody
      ├─ NavigationSlot
      ├─ ContentSlot
      │  ├─ LibraryModeAdapter -> existing VaultView
      │  └─ authority-free Browse empty shell until W2-04 admission
      └─ ContextSlot (closed/reserved in W2-01)
```

## Focused acceptance tests

- initial File Library target is the stable semantic Library `all_files` target and preserves `WorkspaceSession` as history owner;
- requesting Browse with no remembered Browse target changes shell projection only and does not add a fake Browse history target;
- after a real Browse target is present, Library↔Browse mode switching uses W1 chronological history/mode memory;
- Back/Forward state is derived from `WorkspaceSession.historyIndex/history`, not a second history stack;
- AppShell no longer mounts `VaultView` directly;
- AppShell renders `FileLibraryWorkspace` for `view === "library"`;
- File Library suppresses `ShellViewHeading` while other routes keep it;
- new shell/controller modules do not import Query V2 stores as a second authority;
- 980×680 ownership is represented by deterministic shell breakpoints, not a three-pane squeeze.

## Validation

Focused:

- new W2-01 controller tests;
- architecture/source ownership tests;
- existing WorkspaceSession and FileWorkspace integration tests.

Applicable full checks:

- frontend typecheck/test/build/format quality;
- project governance;
- performance architecture guards if routed by CI;
- Rust tests only if a backend seam unexpectedly changes (not planned).

## Review gate

Before Ready/Merge:

- exact-head CI green;
- architecture review verifies no second navigation/presentation/data authority;
- Product/UX review verifies one File Library header hierarchy and viable compact shell;
- maintainability review verifies `VaultView` was adapted, not expanded/moved into a larger monolith;
- W2-02+ scope has not leaked into this PR.
