# W2-03 — Library Mode Adapter / Migration

Status: active — W2-02 is merged through PR #101; implementation is authorized from `master@f1fd3591977142f08eac139814fecebe2e0e6d96`.

Activation branch: `feat/w2-03-library-mode-migration`.

This is one complete W2-03 Track. It establishes the concrete managed-Library source owner inside the File Library 2.0 workspace and removes the current top-level `LegacyVaultView` compatibility embedding without changing the managed authority model. It does **not** implement the shared W2-05 selection/focus/List runtime.

## 0. Required reading and preflight

Before implementation read and treat as binding:

1. `AGENTS.md`;
2. `docs/project/STATUS.md` and `ROADMAP.md`;
3. `docs/project/MASTER_DEVELOPMENT_PLAN.md`;
4. `docs/project/ARCHITECTURE_MAP.md`;
5. `docs/project/CODE_MAINTAINABILITY.md`;
6. `docs/project/DEVELOPMENT_WORKFLOW.md`;
7. `docs/project/initiatives/W2-file-library-experience.md`;
8. `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`;
9. `docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`;
10. `docs/project/tasks/W2-02-SHARED-PRESENTATION-ENTRY-COLLECTION-CONTRACTS-CODEX.md` and merged W2-02 implementation;
11. current Query V2, `LibrarySelectionV1`, saved-view/tag, Inspector/detail and operation/reveal owners;
12. current `VaultView`, `useVaultQueryController`, File Library V2 stores and existing focused tests.

Use a new isolated worktree attached to the existing branch. Record worktree, branch, HEAD, `origin/master`, merge-base, status and changed paths before editing. Expected base is exactly `master@f1fd3591977142f08eac139814fecebe2e0e6d96`. Stop on unrelated changes.

## 1. Goal and user-visible exit

Today Library mode in `FileLibraryWorkspace` delegates the whole content area to `LegacyVaultView presentation="embedded"`. W2-03 replaces that top-level compatibility handoff with a File-Library-owned Library source surface.

At exit:

- `FileLibraryWorkspace` no longer renders the whole `LegacyVaultView` as its Library mode implementation;
- managed Library data flows from the existing Query V2/source owners into the W2-02 `LibraryPresentationEntry` / collection contracts;
- Query V2 paging/search/filter/sort, saved views/tags, `LibrarySelectionV1`, Inspector/detail and existing safe operation/reveal/legacy-preview behavior remain available or intentionally preserved through a bounded compatibility leaf;
- the visible workspace is materially calmer than the current embedded Vault chrome and does not add a second page/header/dashboard stack;
- the concrete Library interaction owner is explicit enough for W2-05 to adapt later without guessing Query V2 or selection semantics.

This is migration/strangler work, not a rewrite of Query V2.

## 2. Authority invariants

The following remain authoritative and may not be replaced:

- managed query/collection truth -> File Library Query V2;
- managed cross-page selection -> `LibrarySelectionV1` plus backend resolution;
- saved views/tags -> existing repositories/stores;
- details/Inspector -> existing Library detail/selection-summary authority;
- operation/reveal/mutation -> existing operation and filesystem safety authorities;
- navigation/history presentation -> `WorkspaceSession` / `FileLibraryExperienceController`;
- shared rendering facts -> merged W2-02 presentation contracts only.

Do not create Query V3, another selection database/store, a second result cache, renderer-authoritative totals, or a new operation dispatcher.

## 3. Concrete Library source owner

Establish one cohesive source owner/controller/hook for Library mode. It may compose existing V2 stores/controllers, but it must not become a second data authority.

Its projection should make the source boundary explicit, for example:

- current semantic Library target;
- current canonical Query V2 spec;
- current Query V2 collection provenance;
- current source result window/pages and truthful count/result state;
- W2-02 `LibraryPresentationEntry[]` for the currently supplied rendering window;
- source-owned query/filter/sort actions;
- source-owned `LibrarySelectionV1` interaction surface (not a shared facade);
- saved-view/tag data/actions required for parity;
- source-specific error/loading/empty/partial state.

Prefer extracting/coalescing existing `VaultView` orchestration rather than copying the same orchestration into another giant component.

If this requires a new global singleton/store to duplicate existing state, STOP.

## 4. W2-02 contract use is mandatory

Library content must consume the merged W2-02 presentation contract rather than creating a parallel `LibraryRowModel` that duplicates the same facts.

Preserve:

- managed `EntryRef` as source identity;
- `queryFingerprint` and `snapshotRevision` at collection scope;
- canonical Query V2 spec only at collection/source scope when required;
- render key as UI-only identity;
- unknown/materialization metadata semantics.

Do not parse render keys or use them for commands, selection, history, thumbnails or persistence.

## 5. Selection remains Library-owned

W2-03 is **not** allowed to create the shared W2-05 interaction facade.

Preserve `LibrarySelectionV1`, including compact `all_matching` behavior. Source-specific Library interactions may continue to use the current Library selection store/controller.

Do not introduce:

- `useSharedSelectionStore`;
- source-neutral `isSelected(entry)`;
- shared focus manager;
- generic Select All semantics;
- cross-source range/anchor behavior.

The existing context-free Library helper must remain source-local and must not be exported through W2-02 presentation contracts.

## 6. Navigation semantics

Library target identity is semantic, not a filesystem breadcrumb.

Semantic targets may include the existing reviewed concepts such as All Files, Recent, Types, Saved Views, Tags and managed Locations where current source evidence supports them.

Rules:

- committing a new semantic target may create a WorkspaceSession history entry;
- transient search text, filter edits, sort changes, selection, and temporary popovers do not spam history;
- switching Library/Browse continues through `FileLibraryExperienceController` / `WorkspaceSession`;
- no fake path/breadcrumb is created for Library targets;
- do not persist ephemeral Browse refs inside Library state.

Final platform-adaptive navigation polish remains W2-09. W2-03 may expose the semantic Library navigation needed to make Library mode usable, but must not absorb Browse/platform navigation.

## 7. Visual migration rules

The binding visual freeze applies.

Library mode must move away from the current large embedded Vault chrome. Preserve capabilities while reducing duplicate chrome.

Required direction:

- one File Library workspace command bar only;
- no inner PageHeader/hero/metric-strip/dashboard stack merely because legacy Vault had one;
- content receives strongest emphasis;
- semantic target identity lives in the File Library command bar/Library surface rather than a fake second page header;
- source-local controls remain compact and subordinate;
- no new permanent analytics/status strip for ordinary browsing;
- minimum 980×680 layout remains usable.

Reuse existing leaf components where doing so preserves behavior and reduces risk. Do not copy the entire `VaultView` into a new file under another name.

## 8. Legacy compatibility / strangler policy

`VaultView` is currently oversized and is a compatibility source. W2-03 should extract source ownership and reusable leaf behavior incrementally.

Allowed:

- reuse `FileLibraryList` as a Library-only compatibility presentation until W2-05 replaces it with the shared List;
- reuse existing filter/sort popovers, metadata manager, Inspector/detail, context-menu or legacy preview leaves where necessary for parity;
- add narrow Library-mode composition components/controllers.

Not allowed:

- keep `LegacyVaultView` as the top-level Library implementation and call W2-03 complete;
- move the entire `VaultView` body into a renamed component;
- add Browse state to Library V2 stores;
- delete compatibility paths without proving `TECH_DEBT.md` exit conditions.

Any compatibility leaf retained must have a clear owner and later deletion/replacement point.

## 9. Search/filter/sort and saved metadata

Preserve current Query V2 behavior and correctness:

- debounced Library search;
- filters and sort;
- exact/known count semantics;
- saved views;
- tags;
- scope health/result states;
- paging and stale-publication handling.

Do not create another query cache or silently turn a visible loaded count into an exact total.

W2-08 owns final shared command-bar controls/preferences. W2-03 only needs the Library source actions and migration UI required for parity and a calm usable Library mode.

## 10. Inspector / preview / operations boundary

Existing managed Inspector/detail and established operation/reveal authorities must remain reachable.

However:

- W2-07 owns the final shared Context Panel behavior;
- W3 owns the new shared Quick Preview platform;
- W2-03 must not promote the legacy Vault preview dialog/Space behavior into W3 architecture;
- no new direct content-byte/path authority is added to UI;
- operation commands continue to use existing managed IDs and existing backend authorities, never W2-02 render keys.

If a legacy Inspector/preview compatibility leaf must remain temporarily embedded to preserve behavior, record it explicitly and do not treat it as the final W2-07/W3 solution.

## 11. Shared hotspot ownership for parallel W2-04

W2-03 and W2-04 run in parallel from the same W2-02 merge baseline.

To minimize integration conflict:

- W2-03 owns only the **Library** source seam/components;
- W2-04 owns only the **Browse** source seam/components;
- do not redesign `WorkspaceCommandBar`, shared mode switching, shared List/Grid contracts, or shared selection/focus;
- keep changes to `FileLibraryWorkspace.tsx` minimal and limited to replacing the Library compatibility branch with a dedicated Library component;
- prefer Library-specific CSS/module files instead of broad rewrites of `fileLibraryWorkspace.css`;
- do not edit W2-04 taskbook/branch/files.

If a genuinely shared shell change is unavoidable, STOP and report it for integration-owner review rather than independently refactoring the hotspot.

## 12. Performance and scale

W2-03 must preserve Query V2 100k/1M behavior and avoid a new O(total collection) presentation transform.

Required evidence:

- rendering window adapts only supplied/visible rows via W2-02 adapters;
- no per-row copy of complete query provenance;
- no materialization of `all_matching` IDs;
- current paging/virtualization remains bounded;
- no new 100k DOM assumption;
- target/search/filter changes reject stale publication according to existing Query V2/store semantics.

W2-05/W2-11 own final shared List and final 100k UI gates; W2-03 must not regress the existing Library baseline.

## 13. Required tests

At minimum cover:

- Library mode no longer top-level renders `LegacyVaultView`;
- Query V2 source owner publishes W2-02 Library presentation entries + collection provenance;
- `queryFingerprint`/`snapshotRevision` remain source-owned and current;
- paging/partial/count behavior remains truthful;
- search/filter/sort do not create navigation history spam;
- semantic target changes produce the intended history behavior;
- `LibrarySelectionV1` explicit and `all_matching` semantics remain compact;
- selection is not tied to mounted DOM lifetime;
- saved view/tag behavior needed for parity remains functional;
- Inspector/detail and established operation/reveal actions continue to route through existing authorities;
- stale query/results cannot publish after target/query epoch changes;
- no render key is accepted as operation/selection/navigation identity;
- 980×680 and wide Library real-browser scenes remain structurally valid;
- no new shared selection/focus runtime exists;
- W2-02 contract tests remain green.

Use existing focused tests and add bounded new tests; do not rely only on source-string assertions for behavioral parity.

## 14. Maintainability gate

Before expanding an existing file above its current responsibility, review whether the behavior belongs in a new cohesive Library source module.

The preferred result is:

- a focused Library source owner/controller;
- a focused Library mode composition surface;
- reused source-specific leaf components;
- a smaller or at least less authoritative `VaultView` compatibility role.

Do not create another monolith comparable to `VaultView`.

## 15. Stop conditions

STOP and request architecture review if W2-03 appears to require:

- Rust/Tauri/schema/permission changes;
- Query V3 or a second query authority;
- shared/cross-source selection or focus runtime;
- Browse source/navigation implementation;
- Thumbnail/Location/Read Gate remediation;
- W3 Preview architecture;
- raw-path authority in renderer;
- broad shared-shell redesign conflicting with parallel W2-04.

## 16. Validation

Run focused Library/source tests first, then all applicable frontend gates. At minimum:

- `npm run typecheck`;
- full `npm test`;
- remediation tests;
- performance-architecture tests;
- governance/docs checks;
- frontend build;
- existing W2-01 real Chromium gate plus new W2-03 Library scenes/behavior where supported;
- `git diff --check`.

No Rust/native PASS claim if Rust is untouched. Hosted CI evidence must follow ADR-0004 and report exact head/tree vs merge-integration tree truthfully.

## 17. Exit gate

W2-03 passes only when:

- the File Library route no longer delegates Library mode to the whole `LegacyVaultView`;
- managed Query V2 source ownership is explicit in the new workspace;
- W2-02 presentation contracts are used rather than duplicated;
- managed Library behavioral parity is preserved at the source/interaction level;
- `LibrarySelectionV1` remains source authority, including compact all-matching;
- no shared W2-05 selection/focus runtime is introduced;
- no Query/Rust/schema/authority rewrite occurs;
- the migration materially reduces legacy top-level chrome/orchestration;
- real-browser and applicable frontend/CI gates pass;
- the resulting Library owner is stable enough for W2-05.

After W2-03 passes, it remains independent of W2-04. W2-05 stays blocked until **both** W2-03 and W2-04 are independently reviewed and merged.

## 18. Final report

Return one consolidated report including:

1. branch/worktree/head/base;
2. changed files;
3. final Library source-owner shape;
4. how Query V2 provenance/paging/count truth is preserved;
5. how W2-02 presentation contracts are consumed;
6. semantic navigation/history behavior;
7. LibrarySelectionV1 / all-matching preservation;
8. saved views/tags parity;
9. Inspector/operation/reveal/legacy-preview compatibility retained and what remains temporary;
10. exact proof the top-level LegacyVaultView embedding is removed;
11. maintainability/refactor result and remaining compatibility debt;
12. 100k/1M structural/performance non-regression evidence;
13. real-browser visual/interaction evidence;
14. local and hosted CI exact-head evidence;
15. cleanup result;
16. UNVERIFIED/DEFERRED items;
17. Draft PR state/head;
18. explicit confirmation W2-04/W2-05 were not implemented in this branch.

Create one Draft PR and STOP. Do not Ready/merge. Independent architecture review owns closeout.