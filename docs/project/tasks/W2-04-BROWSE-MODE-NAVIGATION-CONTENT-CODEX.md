# W2-04 — Browse Mode Navigation + Content Seams

Status: active — W2-02 is merged through PR #101; implementation is authorized from `master@f1fd3591977142f08eac139814fecebe2e0e6d96`.

Activation branch: `feat/w2-04-browse-mode-navigation-content`.

This is one complete W2-04 Track. It turns the current Browse placeholder into a real current-folder experience backed entirely by the accepted W1/R2/R3 File Workspace authorities and establishes the concrete Browse source/interaction owner required by W2-05. It does **not** implement the shared W2-05 selection/focus/List facade or the final W2-09 platform-navigation chrome.

## 0. Required reading and preflight

Before implementation read and treat as binding:

1. `AGENTS.md`;
2. `docs/project/STATUS.md` and `ROADMAP.md`;
3. `docs/project/MASTER_DEVELOPMENT_PLAN.md`;
4. `docs/project/ARCHITECTURE_MAP.md`;
5. `docs/project/CODE_MAINTAINABILITY.md`;
6. `docs/project/DEVELOPMENT_WORKFLOW.md`;
7. `docs/project/initiatives/W2-file-library-experience.md`;
8. `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`;
9. `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`;
10. `docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`;
11. merged W2-02 presentation contracts;
12. accepted R2 Browse identity/Thumbnail remediation and R3 Location admission implementation;
13. current `FileWorkspaceController`, `WorkspaceSession`, File Workspace API/mock and integration tests.

Use a new isolated worktree attached to the existing branch. Record worktree, branch, HEAD, `origin/master`, merge-base, status and changed paths before editing. Expected base is exactly `master@f1fd3591977142f08eac139814fecebe2e0e6d96`. Stop on unrelated changes.

## 1. Goal and user-visible exit

Today Browse mode in `FileLibraryWorkspace` is a `StateBlock` placeholder. W2-04 must make ordinary local Browse genuinely usable.

At exit a user can:

- enter Browse and see backend-published locations or a truthful empty/unavailable state;
- activate a Location through the R3 opaque `LocationRef -> Browse` seam;
- see the current folder identity/breadcrumb projection;
- enumerate the current folder progressively;
- see real file/directory rows derived through W2-02 `BrowsePresentationEntry`;
- navigate into a directory using live `BrowsePathRef` authority, never a display path;
- use WorkspaceSession Back/Forward and Library<->Browse switching correctly;
- request/load additional pages without pretending the loaded rows are the whole folder;
- refresh/re-enumerate after change hints while rejecting stale publication;
- observe unavailable/permission/provider-unknown states truthfully.

This is a current-folder Browse source, not a new recursive filesystem/global search engine.

## 2. Authority invariants

The following remain authoritative:

- Browse session/path/entry/enumeration lifetime -> backend `BrowseService` + `FileWorkspaceController`;
- live mixed navigation/history -> `WorkspaceSession` / `FileLibraryExperienceController`;
- location discovery/capabilities -> backend `LocationDescriptor` projection;
- Location activation -> accepted R3 opaque `LocationBrowseRequest` seam;
- byte-read eligibility -> Read Gate;
- thumbnail generation/cache -> Thumbnail subsystem;
- mutation/reveal/open safety -> existing operation/platform authorities;
- rendering facts -> merged W2-02 presentation contracts.

Do not create a renderer filesystem resolver, path authority, second Browse registry or durable Browse database.

## 3. Concrete Browse source owner

Establish one cohesive Browse source owner/controller/hook responsible for process-local Browse interaction state and projections.

It may own replaceable UI/source state such as:

- current live Browse admission/session projection;
- available `LocationDescriptor[]`;
- current live target/path ref;
- current breadcrumb **presentation chain** built only from backend-issued live refs and safe display labels;
- current enumeration identity;
- currently retained progressive entries/pages for the active enumeration;
- W2-02 `BrowsePresentationEntry[]` and Browse collection context;
- loading/error/unavailable/partial/complete state;
- bounded explicit Browse selection/focus semantics required to define the source owner for W2-05;
- refresh/change-hint state;
- source capability facts for later search/filter/sort UI.

This owner is replaceable interaction/projection state, not authority. It must be torn down/reset on session/target/enumeration invalidation.

Do not create a global durable store or persist ephemeral refs.

## 4. Location entry and admission

First-entry Browse must use backend evidence.

Required flow:

```text
loadLocations()
  -> LocationDescriptor[]
  -> user activates descriptor.ref only
  -> FileLibraryExperienceController.browseLocation(ref)
  -> backend R3 admission
  -> fresh BrowseOpenResponse
  -> fresh session/location/rootPathRef
```

Rules:

- never send `displayName`, display path, provider label or renderer-constructed path as admission authority;
- never turn `scanRootId` into a renderer filesystem path;
- unavailable/offline/disconnected/permission/authentication states remain visible and fail closed;
- opening an unmanaged Browse location must not implicitly add it as a scan root or make entries managed;
- managed and ephemeral LocationRefs remain distinct.

Final Finder/Explorer-like grouping (Favorites/This PC/Providers/Network) is W2-09. W2-04 only needs a calm, usable location entry surface grounded in current descriptors.

## 5. Current-folder enumeration

Use existing controller/API seams:

- `startEnumeration(...)`;
- `nextPage(...)`;
- existing page release/lifecycle behavior;
- `refreshChange(...)` / change-monitor seams where appropriate.

Preserve full publication identity:

- `sessionId`;
- `requestId`;
- `enumerationId`;
- `completion`;
- exact `knownCount` only when source truthfully proves it.

Rules:

- stale/superseded pages never merge into the new enumeration;
- loaded count is not exact folder total unless completeness/count truth proves it;
- cursors are opaque;
- page data cannot outlive the owning session/enumeration authority;
- progressive paging must remain bounded and cancellable.

The source owner may accumulate a presentation window across pages, but it must key/reset by the exact active enumeration and avoid unbounded duplicate data/lifecycle retention. Final 100k shared virtualization belongs to W2-05/W2-11.

## 6. W2-02 presentation contract is mandatory

Browse rows/content must use the merged W2-02 `BrowsePresentationEntry` and Browse collection context.

Preserve:

- `BrowseEntryRef` unchanged;
- optional live `BrowsePathRef` for directory/navigation use;
- render key as presentation-only;
- materialization/unknown metadata truth;
- collection provenance at collection scope, not copied to every row.

Do not create a parallel Browse row identity model and do not parse render keys.

## 7. Directory navigation and breadcrumbs

Folders are navigated using backend-issued `BrowsePathRef`, not `displayPath`.

Same-session child navigation may use the current live `LocationRef` plus the directory's live `BrowsePathRef` through the existing workspace navigation/controller seam.

Breadcrumb UI is a presentation chain, not a filesystem resolver.

A breadcrumb node may retain:

- safe display label;
- the exact live `BrowsePathRef` needed for same-session navigation;
- source/session association needed to reject stale nodes.

It must not derive authority by splitting a display path string.

Rules:

- current folder and nearest ancestors are prioritized;
- stale/disposed-session breadcrumbs become non-actionable/fail closed;
- Back/Forward chronology remains WorkspaceSession-owned;
- navigation to a child/ancestor resets or re-enumerates through current source authority;
- cross-process restore uses existing non-authoritative restore locator and fresh admission, never persisted Browse refs.

If current public APIs cannot support safe breadcrumb navigation without raw-path reconstruction, STOP and report the precise missing seam rather than bypassing it.

## 8. Source-scoped Browse interaction owner

W2-04 must make Browse interaction semantics explicit enough for W2-05, but must **not** create the shared cross-source facade.

The W0 baseline permits explicit ephemeral selection only. A source-specific owner may maintain:

- current session-bound explicit selected `BrowseEntryRef`s;
- one logical focused `BrowseEntryRef`;
- source-local toggle/range behavior only over entries whose current ordered presentation is actually known;
- clear/reset on session/enumeration invalidation as required by source truth.

Hard rules:

- no `all_matching` Browse selection;
- incomplete enumeration cannot imply unseen selection;
- selection/focus refs must belong to the current live Browse session;
- mount/unmount is not selection truth;
- no shared `usePresentationSelectionStore` or source-neutral `isSelected` contract;
- W2-05 owns normalized cross-source click/Ctrl-Cmd/Shift/Select-All/focus facade.

It is acceptable for W2-04's provisional Browse content UI to expose only a bounded subset of these interactions as long as the source owner contract is concrete and tested.

## 9. Provisional Browse content presentation

W2-04 must replace the placeholder with a usable source-specific current-folder presentation, but it must not preempt W2-05's final shared virtualized List.

Preferred characteristics:

- simple, calm file/folder rows using W2-02 presentation entries;
- directory/file distinction clear without thumbnails;
- unknown size/timestamps remain blank/unknown rather than zero;
- partial/loading/load-more state is truthful;
- row count/mounting remains bounded for the progressive page/window used in this Track;
- no dashboard card stack;
- no final shared column/keyboard/selection architecture duplicated prematurely.

The provisional Browse row surface should be easy for W2-05 to delete/replace once the shared List arrives.

## 10. Search/filter/sort capability seams

W2-04 owns only truthful Browse source capability/semantics; W2-08 owns final shared controls and UX.

For this Track:

- current-folder client-side filtering/sorting may operate only over the explicitly loaded/known scope and must say so through source state;
- do not claim whole-folder search/sort completeness while enumeration is partial;
- do not implement arbitrary unmanaged recursive current-location/global filesystem search;
- do not create Query V3 or reuse managed Query V2 as if Browse entries were managed;
- stable full-folder sort may require completion; while partial, preserve source enumeration order or expose an incomplete/buffering capability rather than lying.

The source owner should expose capability facts sufficient for W2-08 to build controls later.

## 11. Change / refresh behavior

Use existing W1 change-monitor/refresh seams where they fit the current folder.

Required principles:

- watcher/change hints are hints, not row-level truth;
- refresh creates/accepts a current enumeration publication and invalidates prior stale publication;
- target/session switch cancels or makes prior monitor/enumeration publication non-publishable;
- overflow/uncertain/unavailable state resolves toward bounded refresh/re-enumeration rather than fabricated completeness;
- no polling loop or unbounded background executor is introduced in the renderer.

A manual refresh path is acceptable for W2-04 if automatic refresh would require broader W2-08/10 UX, provided the source owner correctly consumes change hints and lifecycle cleanup is proven.

## 12. Failure states

Explicitly handle at least:

- no locations available;
- location unavailable/offline/disconnected;
- permission denied/authentication required;
- admission failure;
- enumeration failure;
- stale/superseded publication;
- current location disappears during the session;
- provider/materialization state unknown;
- empty folder;
- partial enumeration with more pages.

Do not collapse these into fake empty-folder success or generic raw backend errors where a reviewed state already exists.

## 13. Shared hotspot ownership for parallel W2-03

W2-03 and W2-04 run in parallel from the same W2-02 merge baseline.

To minimize integration conflict:

- W2-04 owns only the **Browse** source seam/components;
- W2-03 owns only the **Library** source seam/components;
- do not redesign shared `WorkspaceCommandBar`, shared mode switching, shared List/Grid, or shared selection/focus;
- keep `FileLibraryWorkspace.tsx` changes minimal and limited to replacing the Browse placeholder branch with a dedicated Browse component;
- prefer Browse-specific CSS/module files rather than broad rewrites of `fileLibraryWorkspace.css`;
- do not edit W2-03 taskbook/branch/files.

If a genuinely shared shell change is unavoidable, STOP and report it for integration-owner review rather than independently refactoring the hotspot.

## 14. Performance/resource shape

Required:

- first useful page appears without full-folder enumeration;
- page size is bounded;
- no full 100k React render assumption;
- stale pages are released/ignored;
- session/target switch releases disposable page/change work;
- source owner does not retain prior enumerations indefinitely;
- repeated enter/leave/refresh cycles return to bounded steady state;
- no new scheduler/executor is created.

W2-11 owns final 100k Browse List/Grid performance certification; W2-04 must preserve W1 100k Browse foundation behavior and provide structural evidence that the UI/source owner does not force full enumeration.

## 15. Required tests

At minimum cover:

- Browse mode no longer renders only the detached/target placeholder when source actions are available;
- location list -> opaque LocationRef admission -> fresh Browse session;
- unavailable/permission/auth/offline descriptor cannot be treated as successful content;
- root enumeration -> W2-02 entries + exact Browse collection provenance;
- partial vs complete and knownCount truth;
- load next page remains in the same live enumeration and stale page is rejected;
- new enumeration/refresh clears superseded presentation pages;
- directory navigation uses `BrowsePathRef`, never parses `displayPath`;
- breadcrumb nodes are session/ref-bound and stale nodes fail closed;
- Back/Forward and Library<->Browse restore correct live target behavior;
- explicit Browse selection/focus remains current-session/source-owned and never implies unseen selection;
- target/session disposal clears selection/focus/source projection as required;
- change/refresh hint path cannot publish after target switch;
- no implicit scan-root admission occurs;
- no renderer path authority exists;
- no shared W2-05 selection/focus runtime exists;
- 980×680 and wide real-browser Browse scenes are usable;
- W2-01 and W2-02 regressions remain green.

Tests must include behavioral/controller tests, not only source-string checks.

## 16. Native/platform evidence

W2-04 claims a real local Browse experience on supported Windows and macOS only when hosted/native evidence supports the touched seams.

Do not fabricate iCloud/File Provider, APFS/exFAT, OneDrive, SMB/network or removable-drive fixture evidence. Keep unavailable real fixtures `UNVERIFIED`.

The Browser mock must preserve the same opaque Location/Browse/lifecycle contracts; mock-only success does not substitute for native authority tests already owned by W1/R2/R3.

## 17. Maintainability gate

Prefer:

- one focused Browse source owner/controller;
- one focused Browse mode composition surface;
- small provisional Browse row/breadcrumb/location chooser components;
- existing FileWorkspaceController as lifecycle coordinator.

Do not build another monolithic `BrowseView.tsx` containing API calls, lifecycle registries, navigation, selection, rendering and platform logic all in one file.

Do not duplicate `FileWorkspaceController` lifecycle ownership in React state.

## 18. Stop conditions

STOP and request architecture review if W2-04 appears to require:

- renderer raw-path reconstruction/resolution;
- new Rust/Tauri/schema/permission changes for behavior supposedly already proven by R2/R3;
- a second Browse/session/path registry;
- persistence of ephemeral refs;
- shared Library/Browse selection/focus runtime;
- Query V3 or recursive unmanaged filesystem search;
- Thumbnail/Read Gate/Location remediation;
- W3 Preview architecture;
- broad shared-shell redesign conflicting with parallel W2-03.

A real missing backend seam must be reported, not bypassed.

## 19. Validation

Run focused Browse/source/controller tests first, then all applicable gates. At minimum:

- `npm run typecheck`;
- full `npm test`;
- remediation tests;
- performance-architecture tests;
- governance/docs checks;
- frontend build;
- focused FileWorkspace mock/integration contracts;
- existing W2-01 real Chromium gate plus new Browse real-browser scenes;
- Rust tests only if Rust is legitimately touched after architecture review;
- `git diff --check`.

Hosted evidence must follow ADR-0004 and distinguish exact head from merge integration truthfully.

## 20. Exit gate

W2-04 passes only when:

- Browse placeholder is replaced by a real current-folder source experience;
- R3 LocationRef admission drives entry into Browse with no renderer path;
- progressive enumeration and page/completeness semantics remain truthful;
- real directory navigation uses live BrowsePathRefs;
- breadcrumb/history semantics preserve WorkspaceSession authority;
- change/refresh and target switch reject stale publication and clean resources;
- a concrete source-owned explicit Browse interaction owner exists for W2-05 without unseen/all-matching claims;
- W2-02 presentation contracts are consumed rather than duplicated;
- no shared selection/focus runtime, new query authority, schema or second Browse registry exists;
- real-browser/applicable native/frontend CI evidence passes;
- the result is stable enough for W2-05 to replace provisional rows with the shared virtualized List.

W2-05 remains blocked until **both** W2-03 and W2-04 are independently reviewed and merged.

## 21. Final report

Return one consolidated report including:

1. branch/worktree/head/base;
2. changed files;
3. final Browse source-owner shape;
4. Location entry/admission flow;
5. enumeration/page accumulation and provenance handling;
6. W2-02 presentation contract use;
7. directory navigation and breadcrumb ref ownership;
8. WorkspaceSession Back/Forward/mode-switch behavior;
9. explicit Browse selection/focus source semantics and unseen-selection proof;
10. change/refresh/stale-publication behavior;
11. search/filter/sort capability truth and deferred W2-08 items;
12. failure/unavailable/provider state behavior;
13. maintainability/resource cleanup result;
14. structural/100k non-regression evidence;
15. real-browser/native/local/hosted CI exact-head evidence;
16. UNVERIFIED/DEFERRED external fixtures;
17. Draft PR state/head;
18. explicit confirmation W2-03/W2-05 were not implemented in this branch.

Create one Draft PR and STOP. Do not Ready/merge. Independent architecture review owns closeout.