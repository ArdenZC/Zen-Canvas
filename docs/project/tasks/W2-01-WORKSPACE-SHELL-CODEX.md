# W2-01 — Workspace Shell + Experience Controller — Codex Handoff

Status: ready for Codex implementation

Starting baseline: `master@e859578cce1c502bff309788e1ae58629251071d` (PR #88 W2-00 activation squash merge)

Implementation branch: `codex/w2-01-file-library-workspace-shell`

Discarded exploration: PR #89. **Do not use PR #89 as implementation source, evidence, or patch base.** Independently inspect the current baseline and implement from the reviewed W2 contracts below.

## Required reading before coding

- `docs/project/initiatives/W2-file-library-experience.md`
- `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`
- `docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`
- `src/components/AppShell.tsx`
- `src/views/vault/VaultView.tsx`
- `src/views/vault/components/FileLibraryList.tsx`
- `src/fileWorkspace/workspaceSession.ts`
- `src/fileWorkspace/fileWorkspaceController.ts`
- `src/types/fileWorkspace.ts`
- relevant W1 Workspace Foundation tests under `tests/`

## Goal

Create the W2 File Library workspace owner and shell without rewriting Query V2 or prematurely implementing W2-02+.

The end state of W2-01 should make File Library a new workspace boundary that can later host Library/Browse + List/Grid + Context, while the existing managed Library content continues to work through a narrow adapter during migration.

## In scope

1. Create a dedicated `src/views/fileLibrary/` W2 workspace boundary.
2. Route AppShell `view === "library"` to the new File Library workspace rather than mounting `VaultView` directly.
3. Suppress ordinary `ShellViewHeading` for File Library **only**.
4. Keep AppShell titlebar/window controls, global Spotlight, main Zen product sidebar, toast/modal hosts and all non-Library routes unchanged.
5. Establish exactly one File Library normal/wide command-bar hierarchy.
6. Include Back/Forward + Library/Browse organization-mode control + current target identity in the shell.
7. Reuse W1 `FileWorkspaceController` / `WorkspaceSession` as live navigation/history/presentation authority.
8. Adapt the existing managed `VaultView` behind a narrow `LibraryModeAdapter`/migration seam rather than moving or rewriting it.
9. Establish responsive Navigation / Content / Context slot ownership matching the W2-00 visual freeze.
10. Support a truthful first-entry Browse shell state when no admitted Browse target exists, without fabricating a `LocationRef`, `BrowsePathRef`, raw path authority or fake history target.
11. Add focused tests covering shell ownership, mode/history semantics and authority boundaries.

## Explicit non-goals

Do **not** implement these in W2-01:

- W2-02 shared entry/presentation/selection contracts;
- W2-03 semantic Query V2 Library target migration;
- W2-04 real Browse location admission, enumeration, breadcrumb or folder content;
- W2-05 shared virtualized List;
- W2-06 shared Grid/thumbnail presentation;
- W2-07 shared Context/Inspector behavior;
- W2-08 search/filter/sort/preferences work;
- W2-09 full platform navigation adaptation;
- W3 Quick Preview platform;
- W4 Finder/Explorer native integration;
- Query V3;
- a new global Zustand workspace/Browse authority;
- new schema, watcher, Scheduler, Read Gate or mutation/recovery authority.

## Binding architecture rules

### Workspace authority

`WorkspaceSession` remains the only live owner of:

- navigation history;
- current target;
- `lastLibraryTarget` / `lastBrowseTarget`;
- live `viewMode` / `scrollAnchor` presentation history;
- request generation/publication chronology.

`FileWorkspaceController` remains the coordinator for W1 Browse resource lifecycle. Do not bypass its cleanup/publication responsibilities when switching among real history/targets.

A W2 shell/controller may project UI state, but it must not create a second authoritative history or second durable workspace store.

### Library authority

During W2-01, existing `VaultView` + Query V2 stores + `LibrarySelectionV1` remain the managed Library content/selection authority.

Do not pretend the existing surface is always `All Files`. Until W2-03 maps Query V2 semantic targets, use a neutral migration representation if a WorkspaceSession Library target is required.

### Browse authority

When no valid Browse target exists, switching the shell to Browse may show an empty/unadmitted Browse state, but must not invent:

- path strings as authorization;
- opaque refs that were never issued;
- a fake Browse history entry;
- implicit indexing/admission.

W2-04 owns real Browse admission/navigation.

## Binding visual / interaction rules

From the reviewed W2-00 freeze:

- File Library owns its local header; AppShell `ShellViewHeading` is suppressed for this route only.
- Normal/wide File Library uses one command bar, not a PageHeader + toolbar stack.
- Library/Browse controls are neutral desktop chrome, not saturated primary CTA buttons.
- Content dominates chrome.
- Responsive decisions use **available File Library width after AppShell**, preferably via container-aware layout, not raw viewport assumptions.
- Large: `>=1120px` available File Library width.
- Medium: `820–1119px`.
- Compact: `<820px`.
- At compact width, local navigation and future Context are transient/overlay; content owns remaining width.
- Product minimum `980×680` should therefore naturally render a Compact File Library workspace after AppShell width is consumed.
- W2-01 defines Context slot ownership only; it does not implement W2-07 shared Inspector behavior.

## Suggested implementation shape

This is a responsibility sketch, not mandatory filenames:

```text
AppShell
└─ FileLibraryWorkspace
   ├─ small experience/controller projection
   │  └─ FileWorkspaceController
   │     └─ WorkspaceSession
   ├─ WorkspaceCommandBar
   └─ WorkspaceBody
      ├─ NavigationSlot
      ├─ ContentSlot
      │  ├─ LibraryModeAdapter -> existing VaultView
      │  └─ truthful empty/unadmitted Browse shell
      └─ ContextSlot ownership only
```

Keep modules narrow. Do not replace the existing `VaultView` monolith with a new FileLibraryWorkspace monolith.

## Required behavior/tests

At minimum prove:

1. AppShell no longer mounts `VaultView` directly for `library`.
2. AppShell mounts the W2 File Library workspace for `view === "library"`.
3. File Library is the only route that suppresses ordinary `ShellViewHeading`.
4. Initial managed Library migration state is semantically neutral and does not falsely claim a specific Query V2 scope.
5. First-entry Browse without a valid Browse target does not add a fake history target/ref/path.
6. When a real W1 Browse target/history exists, mode/history navigation remains owned by W1 controller/session semantics.
7. Back/Forward availability derives from WorkspaceSession history, not a second stack.
8. New shell/controller code does not import or duplicate Query V2 selection/query authority.
9. Responsive layout uses File Library available width and collapses local navigation before creating a three-pane squeeze.
10. Existing managed Library behavior remains available through the migration adapter.
11. W2-02+ List/Grid/Context/search/Browse content implementation has not leaked into this Track.

## Validation

Run applicable repository checks on the exact final head:

- focused W2-01 tests;
- existing WorkspaceSession tests;
- existing FileWorkspace integration tests;
- frontend test/type/build/format quality;
- project governance;
- performance architecture guards routed by CI.

No Rust/backend change is expected. If implementation unexpectedly requires one, stop and explain why before changing the backend boundary.

## Stop / escalate

Stop implementation and report before proceeding if any of these appear necessary:

- Query V2 replacement or schema change;
- a second workspace/history store;
- raw-path persistence/authorization;
- fabricated Browse refs to make the UI mode switch work;
- new watcher/Scheduler/Read Gate/mutation authority;
- W3/W4 work;
- large-scale VaultView rewrite required merely to establish the shell;
- changing the reviewed W2-00 single-command-bar or responsive ownership contract.

## PR requirements

Open W2-01 as Draft first.

Before Ready/Merge provide:

- concise implementation summary;
- changed-file/scope summary;
- exact-head CI evidence;
- focused test evidence;
- explicit statement that Query V2 / `LibrarySelectionV1` / WorkspaceSession / W1 Browse authority remain preserved;
- explicit list of anything intentionally deferred to W2-02+;
- no claim that visual polish or Browse content beyond W2-01 is complete.

The PR must receive independent Product/UX, architecture/authority and maintainability review before merge.
