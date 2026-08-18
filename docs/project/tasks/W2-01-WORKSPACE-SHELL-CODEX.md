# W2-01 — Workspace Shell + Experience Controller — Codex Handoff

Status: ready for Codex implementation **only after this pre-code audit revision**

Starting baseline: `master@e859578cce1c502bff309788e1ae58629251071d` (PR #88 W2-00 implementation-activation squash merge)

Implementation branch: `codex/w2-01-file-library-workspace-shell`

Discarded exploration: PR #89. **Do not use PR #89 as implementation source, evidence, patch base, or design precedent.** Independently inspect the clean activation baseline and implement from the reviewed W2 contracts plus the audit clarifications in this taskbook.

## 0. Pre-code audit reconciliation

A post-activation audit was performed before Codex implementation began.

Authoritative merge facts:

- PR #86 W2 implementation plan merged as `master@e91416c83082b61a0d3042c9438d77c7b8586297`;
- PR #87 W2 visual/interaction freeze merged as `master@251bab36797cde4129656f57667ed203f20415e6`;
- PR #88 W2 implementation activation merged as `master@e859578cce1c502bff309788e1ae58629251071d`;
- PR #89 is closed/unmerged discarded exploration and is not evidence.

Some canonical W2 documents still contain stale **status metadata** such as `specification only`, `merge pending`, `activation proposed`, or `not authorized until ...`. Those phrases describe their pre-merge state and must not be interpreted as blocking the already-merged PR #88 activation. Their substantive architecture/product contracts remain binding. Do not edit those canonical documents as part of W2-01 production work merely to clean metadata; report the stale metadata separately if it remains on the final branch.

This audit also found implementation ambiguities that are now binding W2-01 constraints below. If an older sentence elsewhere conflicts with these explicit pre-code audit clarifications, stop and report rather than guessing.

## 1. Required reading before coding

Read fully before changing production code:

- `docs/project/initiatives/W2-file-library-experience.md`
- `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`
- `docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`
- `docs/project/specs/file-library-preview/01-PRODUCT-IA.md`
- `src/components/AppShell.tsx`
- `src/views/vault/VaultView.tsx`
- `src/views/vault/components/FileLibraryList.tsx`
- `src/fileWorkspace/workspaceSession.ts`
- `src/fileWorkspace/fileWorkspaceController.ts`
- `src/types/fileWorkspace.ts`
- relevant W1 WorkspaceSession/FileWorkspace integration tests under `tests/`

Do not read PR #89 as an implementation reference.

## 2. Goal

Create the W2 File Library workspace owner and shell without rewriting Query V2 or prematurely implementing W2-02+.

The end state of W2-01 establishes the durable **UI ownership boundary** for later Library/Browse + List/Grid + Context work while the existing managed Library remains functional through a narrow compatibility adapter.

W2-01 is not the final polished Library experience. It is the migration shell that makes later Tracks possible without creating a second data/navigation authority.

## 3. In scope

1. Create a dedicated `src/views/fileLibrary/` W2 workspace boundary.
2. Route AppShell `view === "library"` to the new File Library workspace rather than mounting `VaultView` directly.
3. Suppress ordinary `ShellViewHeading` for File Library **only**.
4. Keep AppShell titlebar/window controls, global Spotlight, main Zen product sidebar, toast/modal hosts and all non-Library routes unchanged.
5. Establish the W2 workspace command-bar owner with Back/Forward, Library/Browse organization-mode control and current target identity.
6. Reuse W1 `FileWorkspaceController` / `WorkspaceSession` as live target/history/presentation authority.
7. Adapt the existing managed `VaultView` behind a narrow Library migration adapter rather than moving or rewriting it.
8. Establish responsive Navigation / Content / Context slot ownership matching the W2-00 freeze.
9. Support a truthful first-entry Browse shell state when no admitted Browse target exists, without fabricating a `LocationRef`, `BrowsePathRef`, raw path authority or fake history target.
10. Preserve the File Library live workspace session across temporary switches to other top-level Zen views during the same AppShell/window lifetime.
11. Add focused lifecycle, authority, route-ownership and responsive-shell tests.

## 4. Explicit non-goals

Do **not** implement these in W2-01:

- W2-02 shared entry/presentation/selection contracts;
- W2-03 semantic Query V2 Library target migration;
- W2-04 real Browse location admission, enumeration, breadcrumb or folder content;
- W2-05 shared virtualized List;
- W2-06 shared Grid/thumbnail presentation;
- W2-07 shared Context/Inspector behavior;
- W2-08 final search/filter/sort/preferences work;
- W2-09 full platform navigation adaptation;
- W3 Quick Preview platform;
- W4 Finder/Explorer native integration;
- Query V3;
- a new global Zustand workspace/Browse authority;
- new schema, watcher, Scheduler, Read Gate or mutation/recovery authority;
- replacing/refactoring the large legacy `VaultView` beyond the minimum migration seam needed for shell ownership.

## 5. Binding architecture rules

### 5.1 Workspace authority

`WorkspaceSession` remains the only live owner of:

- navigation history;
- current authority-bearing target;
- `lastLibraryTarget` / `lastBrowseTarget`;
- live `viewMode` / `scrollAnchor` presentation history;
- request generation/publication chronology.

`FileWorkspaceController` remains the coordinator for W1 Browse resource lifecycle. W2 UI must not bypass its cleanup/publication responsibilities when switching real targets/history.

A W2 experience controller may project UI state, but it must not create a second authoritative history, target registry, Browse-ref registry, or durable workspace store.

### 5.2 App/window lifetime owner — NEW HARD REQUIREMENT

Do **not** create the authority-owning `FileWorkspaceController` / `WorkspaceSession` only inside a route component that is destroyed whenever the user visits Scanner/Organize/Settings/etc.

The live File Library experience owner must have **AppShell/window-session lifetime** (or an equivalent reviewed owner above transient route content) so that leaving File Library for another top-level Zen view and returning during the same app/window session does not silently erase:

- Back/Forward chronology;
- `lastLibraryTarget` / `lastBrowseTarget`;
- live Browse history refs that W1 intentionally retains for the current process/session;
- live presentation history.

At the same time, it must not become an immortal unowned singleton. It must have a deterministic disposal path when the owning AppShell/window session is actually torn down.

Required test: File Library -> another top-level app view -> File Library preserves the same live workspace-session state, while final owner disposal invokes W1 cleanup exactly once/idempotently.

If preserving session lifetime safely requires a new global durable authority, stop and report. A React/AppShell-scoped owner/provider is acceptable; a second Zustand authority is not.

### 5.3 Lifecycle-safe mode switching — NEW HARD REQUIREMENT

Do not call `WorkspaceSession.switchMode()` directly from React/UI code if doing so bypasses `FileWorkspaceController` target-work teardown, stale-publication cleanup or Browse ownership reconciliation.

Preferred shape: add a **small frontend-only lifecycle-safe mode-switch seam** to `FileWorkspaceController`, or use existing controller methods in an equivalently safe way with tests. The seam may delegate chronology to `WorkspaceSession.switchMode()` but must perform the same disposable-work cleanup/publication steps required by `navigate/back/forward`.

No backend/Tauri/Rust authority change is expected or authorized.

Required regression with a real mocked W1 Browse session:

1. Library target exists;
2. real Browse target is admitted;
3. switch Browse -> Library -> Browse;
4. chronology/presentation comes from `WorkspaceSession`;
5. current-target disposable work is cancelled/released;
6. history-owned Browse refs remain valid where W1 requires them;
7. no second history stack or leaked Browse session appears.

### 5.4 Detached first-entry Browse state — NEW HARD REQUIREMENT

Before W2-04 admits a real Browse target, the shell may display Browse mode as a **transient, non-authoritative UI intent**.

That detached state:

- is not a `NavigationTarget`;
- does not enter `WorkspaceSession.history`;
- does not become `lastBrowseTarget`;
- is not serialized/persisted/restored across process restart;
- cannot authorize data reads, Browse enumeration or filesystem operations;
- contains no fabricated LocationRef/PathRef/raw path;
- may exist only inside the live W2 experience projection and is cleared/replaced once a real Browse target is admitted or the experience owner is disposed.

It may remain visible when the user temporarily leaves/re-enters the File Library route within the same live AppShell owner, but it is still presentation intent, not navigation authority.

### 5.5 Library migration target

During W2-01, existing `VaultView` + Query V2 stores + `LibrarySelectionV1` remain the managed Library content/selection authority.

Do not pretend the existing surface is always `All Files` or any other semantic Query V2 target. If an initial WorkspaceSession Library target is required, use an explicitly temporary neutral migration target such as:

```ts
{ kind: "library", source: "custom", key: "legacy_library" }
```

Treat it as W2-01 migration chronology only; W2-03 owns replacing it with truthful semantic Library targets. Do not derive Query V2 scope from this placeholder.

### 5.6 Browse authority

When no valid Browse target exists, switching the shell to Browse may show the detached state described above, but must not invent authority or trigger implicit indexing/admission. W2-04 owns real Browse admission/navigation.

## 6. Legacy Vault control-bar migration exception — NEW REVIEWED TRANSITION RULE

The reviewed W2 end state has one normal/wide File Library command bar. However, the current `VaultView` is **not a pure content component**: it already contains its own legacy scope/search/filter/sort control surface.

W2-01 must not create duplicate copies of those source controls.

Therefore, for W2-01 only:

- the new W2 workspace command bar owns **Back/Forward + Library/Browse + target identity**;
- do **not** add a second W2 search/filter/sort/List/Grid/Context control set merely to make the final reference image look complete;
- the existing Vault scope/search/filter/sort controls may remain temporarily inside the Library adapter as explicit migration debt so current Library behavior does not regress;
- do not visually promote that legacy panel into another page header/hero;
- W2-03/W2-08 are responsible for migrating/consolidating the relevant Library controls into the canonical command-bar/source model;
- the W2-01 PR description and visual review must explicitly call out this temporary exception and must not claim final one-row command-bar convergence is complete.

This is a bounded strangler-migration exception, not permission to keep two permanent W2 toolbars.

## 7. Binding visual / layout rules

From the reviewed W2-00 freeze:

- File Library owns its local header; AppShell `ShellViewHeading` is suppressed for this route only.
- AppShell global titlebar/Spotlight/product sidebar remain unchanged.
- Do not create PageHeader + W2 toolbar + target-header stacking.
- Library/Browse controls are neutral desktop chrome, not saturated primary CTA buttons.
- Content dominates chrome.
- Responsive decisions use **available File Library width after AppShell**, preferably via container-aware layout, not raw viewport assumptions.
- Large: `>=1120px` available File Library width.
- Medium: `820–1119px`.
- Compact: `<820px`.
- At compact width, local navigation and future Context are transient/overlay; content owns remaining width.
- Product minimum `980×680` must map to a viable Compact File Library workspace after AppShell width is consumed.
- W2-01 defines Context slot ownership only; it does not implement W2-07 Inspector behavior.

### 7.1 Route padding/gutter ownership — NEW HARD REQUIREMENT

Current AppShell ordinary routes include their own heading/stage padding. File Library's route-level heading opt-out must not leave a hidden extra vertical/panel gutter that effectively recreates stacked chrome.

W2-01 may introduce a **library-route-specific AppShell content/stage class** or equivalent minimal seam so FileLibraryWorkspace receives the intended usable area. Other routes must retain their existing layout behavior.

Do not redesign AppShell globally to solve this local route problem.

### 7.2 No dead future controls

Do not render nonfunctional List/Grid, Context, Browse-location, search or sort controls as decorative placeholders. If a later Track owns the behavior, omit/disable it only when the disabled state is truthful and useful. Prefer omission in W2-01.

### 7.3 i18n and accessibility

New user-visible copy must follow the existing i18n system rather than hardcoding English/Chinese strings in production components.

W2-01 controls must have deterministic keyboard focus, accessible names and correct disabled states. `Back`/`Forward` availability comes from `WorkspaceSession`, not DOM history.

## 8. Suggested implementation shape

Responsibility sketch only:

```text
AppShell / app-window owner
└─ FileLibraryExperience owner (long-lived for AppShell/window session)
   └─ FileWorkspaceController
      └─ WorkspaceSession

File Library route
└─ FileLibraryWorkspace (render/subscription boundary)
   ├─ WorkspaceCommandBar
   │  ├─ Back / Forward
   │  ├─ Library / Browse
   │  └─ target identity
   └─ WorkspaceBody
      ├─ NavigationSlot ownership
      ├─ ContentSlot
      │  ├─ LibraryModeAdapter -> existing VaultView
      │  └─ truthful detached Browse empty shell until W2-04
      └─ ContextSlot ownership only
```

Keep modules narrow. Do not replace the existing `VaultView` monolith with a new FileLibraryWorkspace monolith.

## 9. Required behavior/tests

At minimum prove all of the following:

1. AppShell no longer mounts `VaultView` directly for `library`.
2. AppShell mounts the W2 File Library workspace for `view === "library"`.
3. File Library is the only route that suppresses ordinary `ShellViewHeading`.
4. Other top-level Zen routes keep their existing header/stage behavior.
5. File Library -> another top-level app view -> File Library preserves the same live W1 workspace session/history owner.
6. Final AppShell/window owner teardown disposes W1 FileWorkspace resources deterministically and idempotently.
7. Initial managed Library migration state is semantically neutral and does not falsely claim a Query V2 scope.
8. First-entry detached Browse changes shell projection only and adds no fake Browse history/refs/path/persistence.
9. After a real W1 Browse target exists, Library<->Browse uses lifecycle-safe controller switching and W1 chronological history/mode memory.
10. Back/Forward availability derives from WorkspaceSession history, not a second stack.
11. Mode switching tears down current-target disposable work without destroying history-owned Browse refs/session authority required for in-process return.
12. New shell/controller code does not import or duplicate Query V2 selection/query authority.
13. Responsive layout uses File Library available width and collapses local navigation before creating a three-pane squeeze.
14. Existing managed Library behavior remains available through the migration adapter.
15. W2 shell does not duplicate legacy Library search/filter/sort controls in W2-01.
16. No nonfunctional W2-02+ List/Grid/Context/search/Browse controls are rendered merely as placeholders.
17. W2-02+ implementation has not leaked into this Track.

## 10. Required visual evidence before Ready

Because W2 is an Experience wave, source tests alone are insufficient.

Attach or otherwise provide reviewable rendered evidence from the exact implementation head for at least:

- a wide/large File Library Library-mode shell;
- a medium-width shell;
- the product-minimum `980×680` compact state;
- detached first-entry Browse state;
- another ordinary AppShell route proving its heading/layout did not regress.

The review must verify:

- no stacked `ShellViewHeading` + W2 header;
- no accidental double-padding/hero shell;
- command bar uses quiet desktop chrome;
- legacy Vault controls are visibly a temporary content migration surface, not duplicated by W2 controls;
- compact layout does not squeeze permanent Navigation + Content + Context panes together;
- focus/labels/disabled states are sane.

If native macOS/Windows visual evidence is unavailable in the implementation environment, clearly classify it `UNVERIFIED`; do not claim parity from browser/mock screenshots alone. Later W2 platform Tracks still own full cross-platform visual QA.

## 11. Validation

Run applicable repository checks on the exact final production head:

- focused W2-01 controller/lifecycle tests;
- existing WorkspaceSession tests;
- existing FileWorkspace integration tests;
- frontend test/type/build/format quality;
- project governance;
- performance architecture guards routed by CI;
- `git diff --check`;
- visual evidence listed above.

No Rust/backend change is expected. If implementation unexpectedly requires one, stop and explain why before changing the backend boundary.

## 12. Maintainability gate

- New workspace shell remains orchestration-focused.
- Do not add Browse/Grid/Context responsibilities to `VaultView`.
- Do not turn AppShell into a File-Library-specific state monolith.
- Prefer a small File Library owner/provider/controller boundary with explicit lifetime.
- New files approaching 500-800 lines require cohesion review; 1000+ requires explicit decomposition justification under repository maintainability rules.
- Shared hotspots (`AppShell.tsx`, FileWorkspaceController, navigation context) receive the minimum seam needed and must be called out in review.

### 12.1 Legacy embedded-layout migration contract

Legacy page-level components mounted through W2 compatibility adapters must
define an explicit embedded layout contract; adapter ancestors must not steal
virtualization scroll ownership.

For the W2-01 Library adapter, this means:

- standalone `VaultView` retains its existing page-level layout semantics;
- the adapter mounts `VaultView` through an explicit embedded presentation
  seam, with bounded legacy controls and a bounded result region;
- `FileLibraryList` remains the TanStack virtualizer scroll element through
  `getScrollElement: () => parentRef.current`;
- adapter-level `overflow: auto` is not a substitute for the listbox scroll
  owner;
- Compact `980×680` browser evidence must prove bounded geometry, real
  listbox scrolling, changed virtual range, progressive/load-more behavior,
  and no document/body vertical scroll.

Happy-dom/Vitest can cover DOM and authority contracts, but not flex/grid
geometry, clipping or trustworthy `scrollHeight`; those claims require the
repeatable real-browser gate. Do not patch an ancestor based only on the next
revealed clipping layer, use brittle descendant overrides or `!important`, or
change Query/selection authority to satisfy this migration contract.

## 13. Stop / escalate

Stop implementation and report before proceeding if any of these appear necessary:

- Query V2 replacement or schema change;
- a second workspace/history store;
- inability to preserve File Library session lifetime without a new durable/global authority;
- raw-path persistence/authorization;
- fabricated Browse refs to make the UI mode switch work;
- direct UI calls into `WorkspaceSession.switchMode()` that bypass required FileWorkspace lifecycle cleanup;
- new watcher/Scheduler/Read Gate/mutation authority;
- W3/W4 work;
- large-scale VaultView rewrite required merely to establish the shell;
- duplicating Vault search/filter/sort into the W2 command bar in this Track;
- changing the reviewed W2-00 structural responsive model beyond the audited migration exception above.

## 14. PR requirements

Use the existing branch `codex/w2-01-file-library-workspace-shell` and open/continue one Draft PR. Do not create a second production PR for the same Track.

Before Ready/Merge provide:

- exact production head SHA;
- concise implementation summary;
- changed-file/scope summary;
- exact-head CI evidence;
- focused lifecycle/history/authority test evidence;
- rendered visual evidence from Section 10;
- explicit statement that Query V2 / `LibrarySelectionV1` / WorkspaceSession / W1 Browse authority remain preserved;
- explicit statement of File Library session owner/lifetime and disposal behavior;
- explicit statement of detached Browse-state semantics;
- explicit list of the temporary legacy Vault control-panel exception and what W2-03/W2-08 still own;
- explicit list of anything intentionally deferred to W2-02+;
- no claim that final visual polish, final one-row Library source controls, real Browse content or W3 Preview are complete.

The PR must receive a **separate post-implementation Product/UX, architecture/authority and maintainability review** before Ready/Merge. CI success alone is not review approval.
