# W2-02 — Shared Presentation / Entry / Selection Contracts — Codex Taskbook

Status: pre-implementation handoff; production implementation is blocked until the W2-01 post-merge current-truth closeout merges.

Production baseline: `master@2c22c90f67826b255cdce2f82313aa352d61a9f3` (PR #90 W2-01 squash merge).

Track: **W2-02 — Shared Presentation / Entry / Selection Contracts**.

This taskbook is the binding implementation handoff for Codex after the post-merge closeout gate is cleared. It does not authorize W2-03/W2-04 or any visual redesign.

## 1. Goal

Define the smallest source-tagged presentation/view-model contract that later W2 List, Grid and Context components can consume for either:

- managed File Library entries backed by Query V2 / `LibrarySelectionV1`; or
- ephemeral Browse entries backed by W1 session-scoped refs.

The shared presentation layer must **share rendering shape without sharing source authority**.

W2-02 is primarily a TypeScript contract/adaptor Track. It must not implement the later Library migration, Browse navigation/content UI, shared List/Grid, Context Panel or final search/filter/sort controls.

## 2. Required reading before production edits

Read all of these completely before changing code:

1. `AGENTS.md`
2. `docs/project/STATUS.md`
3. `docs/project/ROADMAP.md`
4. `docs/project/initiatives/W2-file-library-experience.md`
5. `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
6. `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`
   - especially W2-02, W2-03, W2-04, W2-05/06/07 boundaries
7. `docs/project/specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`
8. `docs/project/tasks/W2-01-WORKSPACE-SHELL-CODEX.md`
9. `docs/project/tasks/W2-01-PRE-CODE-AUDIT-ADDENDUM.md`
10. `src/types/fileWorkspace.ts`
11. `src/types/domain.ts`
12. `src/store/useFileLibraryV2Store.ts`
13. `src/views/vault/fileLibraryModel.ts`
14. `src/views/vault/components/FileLibraryList.tsx`
15. W2-01 File Library experience/controller modules under `src/views/fileLibrary/`
16. relevant existing Query V2 / selection tests, including `tests/fileLibraryV2.test.ts`
17. W2-01 real-browser gate and contract tests, so the existing permanent regression gate is not weakened.

Before implementation, write a short architecture note in the PR describing the existing source authorities and the proposed one-way projection boundary.

## 3. Existing authorities that must remain authoritative

### Managed Library

`LibrarySelectionV1` remains authoritative and currently has two modes:

```ts
export type LibrarySelectionV1 =
  | { kind: "explicit"; fileIds: string[] }
  | {
      kind: "all_matching";
      query: FileQuerySpecV2;
      queryFingerprint: string;
      snapshotRevision: number;
      excludedFileIds: string[];
    };
```

W2-02 must not replace, flatten or reinterpret this source authority.

In particular, `all_matching` is a compact query-owned selection. It must **never** be expanded into all matching file IDs merely to satisfy a shared UI component.

### Ephemeral Browse

W1 provides source/session-scoped identities:

- managed `EntryRef { kind: "managed", fileId }`;
- ephemeral `EntryRef { kind: "ephemeral", browseSessionId, entryId }`;
- opaque `BrowsePathRef`;
- `BrowseEntry` metadata;
- `BrowsePage.completion = partial | complete`;
- session/enumeration refs and source generations.

Ephemeral refs are non-durable. W2-02 must not manufacture a persistent `FileIdentity` or path authority for Browse.

### Thumbnail / content

Existing W1 seams remain authoritative:

- `ThumbnailRequest.source: EntryRef`;
- optional Browse `sessionId` / `sourceGeneration`;
- content/read eligibility and Preview source refs remain W1-owned.

The shared presentation contract may carry **identity needed to request** these services, but must not create a second thumbnail/read authority.

## 4. Expected module shape

Prefer a small dedicated module boundary under File Library, for example:

```text
src/views/fileLibrary/presentation/
  types.ts
  libraryAdapter.ts
  browseAdapter.ts
  selection.ts
  index.ts
```

Equivalent names are acceptable after inspecting the repository, but responsibilities must remain split.

Do not create a 700–1000 line `presentation.ts` mega-file.

Do not move existing Query V2 or Browse state into this module.

The module should be pure or nearly pure: cheap projections, source-tagged intents/facades and contract helpers. No new Zustand store unless a separately reviewed need is proven; a new shared durable/long-lived selection store is not authorized.

## 5. Shared entry contract

Define a discriminated, source-tagged presentation entry. Exact names may vary, but the semantics must include:

- explicit source: `library | browse`;
- stable UI key valid for the current source lifetime;
- display name;
- file/folder kind where known;
- extension/type/icon hint when known;
- size when known;
- modified time when known;
- availability/materialization/capability projection with unknown represented honestly;
- source-specific operation handle/reference;
- W1 thumbnail request identity/seam;
- no raw path as operation authority;
- no fake metadata.

### Stable UI key

The key must be source namespaced and collision-safe.

Examples of acceptable semantics:

- Library key derives from managed file ID;
- Browse key derives from the session-scoped ephemeral identity, including the Browse session dimension.

The UI key is presentation identity only. It must not become a resolver, filesystem path, durable database identity or mutation authority.

### Unknown metadata

If Browse or Library does not know a value, preserve `null`/explicit unknown semantics.

Do not fabricate:

- file type from a name when the source contract does not support it;
- availability from platform labels;
- modified timestamps;
- content-read eligibility;
- persistent identity for Browse.

Extension/name-based icon hints are acceptable only as presentation hints and must be named/documented as such.

### Operation handle

Shared rendering may expose a source-tagged operation reference such as the existing `EntryRef` or a thin wrapper around it.

Do not expose raw filesystem paths from managed `FileRecord.path` as the shared operation handle.

A display-only path/subtitle, if retained, must be explicitly non-authoritative and must never be sent back to a resolver.

## 6. Capability projection

Capabilities must support honest unknown state. Avoid a shape where absence of evidence silently becomes `false` if the distinction matters to UX.

Prefer an explicit tri-state/enum or another type-safe representation for fields such as:

- preview availability;
- reveal/open eligibility;
- request materialization;
- destructive/mutation eligibility if exposed at all.

W2-02 should stay minimal. Do not invent a large generic capability framework.

Do not infer capabilities from:

- pathname;
- extension alone when operation eligibility requires source/runtime evidence;
- `process.platform` labels;
- managed/unmanaged wording.

## 7. Thumbnail seam

The presentation entry may provide a cheap W1-compatible thumbnail identity, but it must not allocate request IDs or schedule work during projection.

Expected semantics:

- managed entry projects managed `EntryRef`;
- Browse entry projects ephemeral `EntryRef` plus source/session generation metadata when required by the W1 thumbnail request;
- renderer/request owner later supplies `requestId`, variant and `WorkClass`.

Projection itself must perform no thumbnail request, file read or materialization.

## 8. Selection/focus facade — source authority must remain explicit

Define the shared component-facing selection/focus contract as a **facade/intents boundary**, not a shared selection database.

A shared cell/list/grid should be able to ask things like:

- is this visible entry selected?
- is this entry focused?
- what is the current selection scope/completeness?
- request focus/toggle/range/select-only/select-all intent through the owning source.

Exact method names are flexible, but every mutation must route back to the source owner.

### Library membership

For visible Library entries:

- `explicit`: membership comes from `fileIds`;
- `all_matching`: a visible row belonging to the active query is selected unless its file ID is in `excludedFileIds`.

Do not enumerate the entire matching Query V2 result.

Preserve `query`, `queryFingerprint` and `snapshotRevision` as source-owned selection context.

If a membership helper builds lookup sets, build them once per selection snapshot/facade, not once per rendered cell.

### Browse selection

W2-02 must **not** prematurely create the final W2-04 Browse selection store.

Define the contract and prove it with a source-owned test/fake adapter if real Browse UI selection ownership does not yet exist.

Browse selection scope must be explicit about source/session/enumeration and completeness. A partial enumeration cannot claim selection of unseen entries unless the Browse source later provides such semantics.

Do not reuse `LibrarySelectionV1::all_matching` to represent Browse select-all.

### Focus

Focus is source/UI state, not file identity. The facade may represent focused presentation key/ref, but focus must not become persistent selection authority.

## 9. Virtualization invariant

Virtualization/mount state must never become selection state.

Required tests must prove:

- an unmounted selected Library item remains selected according to the source selection facade;
- mounting only 20 visible rows does not truncate `LibrarySelectionV1`;
- `all_matching` stays compact even for a logical 100k result set;
- Browse partial-page mount state does not imply unseen selection;
- presentation adapters operate per visible/source entry and do not require projecting a whole 100k logical set.

Avoid fragile microsecond thresholds. Use structural/allocation/count assertions where possible.

## 10. Library adapter requirements

Create a pure adapter from the existing managed Library record/projection into the shared presentation entry.

Requirements:

- managed source tag remains explicit;
- managed operation identity remains managed file ID / `EntryRef`;
- do not duplicate Query V2 data ownership;
- do not move query/filter/sort into W2-02;
- invalid/unknown metadata maps to unknown/null rather than fabricated values;
- existing Library selection semantics are consumed, not replaced;
- adapter must be cheap enough to map only currently needed rows.

Do not rewrite `VaultView` in this Track.

## 11. Browse adapter requirements

Create a pure adapter from W1 `BrowseEntry` into the same shared presentation contract.

Requirements:

- `source: browse` remains explicit;
- ephemeral key includes source lifetime/session identity;
- do not persist or convert ephemeral refs into managed IDs;
- `displayPath` remains presentation-only if surfaced;
- `size`, `modifiedAt`, extension and materialization retain unknown semantics;
- folder/file kind remains truthful;
- adapter accepts/retains source-generation/session identity needed for later thumbnail requests without starting work;
- incomplete enumeration state remains source/page context, not silently promoted to a complete collection.

W2-02 must not open directories or start Browse enumeration.

## 12. Completeness / collection context

Shared presentation primitives must be able to distinguish entry projection from collection truth.

Define the smallest collection/source context needed to express:

- Library query-backed logical collection;
- Browse enumeration/session identity;
- Browse `partial | complete` state;
- known count only when source supplies one;
- selection completeness/scope.

Do not put pagination cursors or W1 resource ownership directly into visual cells unless required as opaque source context.

Do not make partial Browse results look globally complete.

## 13. No UI redesign in W2-02

This Track is a contract spine for later W2 rendering.

Do not implement:

- shared List UI (W2-05);
- Grid UI (W2-06);
- Context Panel (W2-07);
- Library source migration UI (W2-03);
- Browse navigation/content UI (W2-04);
- final search/filter/sort/prefs controls (W2-08);
- platform navigation UX (W2-09).

Production visual diff should ideally be zero. If a tiny compile/integration seam is required, explain why and prove no user-facing behavior change.

Do not weaken or delete the W2-01 real-browser regression gate.

## 14. Authority prohibitions

W2-02 must not add or replace:

- Query V3;
- Query V2 authority;
- `LibrarySelectionV1` authority;
- a durable/shared cross-source selection store;
- Browse filesystem/session authority;
- managed watcher/reconciliation authority;
- Read Gate/content eligibility authority;
- WorkScheduler;
- thumbnail scheduler/cache authority;
- mutation/recovery authority;
- schema/database tables;
- Tauri commands/permissions/events.

No Rust/backend changes are expected. If implementation appears to require one, stop and report before proceeding.

## 15. Required tests

At minimum add focused contract tests for:

### Entry identity

- Library and Browse with similar names/IDs cannot collide in UI key space;
- Browse keys differ across sessions even if `entryId` repeats;
- UI keys cannot be used as raw paths/resolver inputs by the contract.

### Metadata truthfulness

- known values map correctly;
- missing Browse metadata remains null/unknown;
- invalid Library date/value does not fabricate a plausible timestamp;
- capability unknown remains unknown.

### Thumbnail identity

- managed entry yields correct managed W1 source identity;
- Browse entry preserves ephemeral/session/source-generation context;
- projection allocates no request ID and invokes no API.

### Library selection

- explicit membership;
- all-matching membership with exclusions;
- query fingerprint/snapshot revision remain intact;
- all-matching selection is not flattened to IDs;
- visible-cell membership works without enumerating unseen rows.

### Browse selection contract

- source/session scope is explicit;
- incomplete enumeration cannot claim unseen-entry selection;
- selection intents call the provided Browse owner/fake instead of mutating a shared store.

### Virtualization independence

- mounted subset does not redefine selection;
- 100k logical Library all-matching fixture remains compact;
- Browse partial pages remain honest.

### Source separation

- Library intents never invoke Browse owner;
- Browse intents never invoke Library owner;
- operation handles remain correctly tagged.

## 16. Existing regression suites

Run and preserve at least:

- W2-01 experience/lifecycle tests;
- File Workspace contract/session tests;
- File Library V2/selection tests;
- File Library virtualized list tests relevant to selection;
- W2-01 real-browser contract + real Chromium gate;
- typecheck;
- remediation;
- performance architecture;
- frontend build;
- docs/governance;
- `git diff --check`.

Because this is frontend contract work, repository CI routing should run applicable frontend/browser quality automatically.

## 17. Maintainability gate

- no mega-file;
- source adapters separate from shared types/facade logic;
- avoid generic abstraction for abstraction's sake;
- no duplicated selection logic in List/Grid candidates;
- new contracts must be narrow enough that W2-03 and W2-04 can adapt independently;
- document invariants near the types that enforce them;
- preserve repository rule: task-owned test/temp artifacts must be cleaned, and tests must not use `C:\` for task fixtures/cache.

## 18. Stop conditions

Stop and report instead of expanding scope if any of these becomes necessary:

- flattening `LibrarySelectionV1::all_matching` into IDs;
- creating a persistent Browse identity;
- creating the final Browse selection store before W2-04;
- adding Query V3;
- changing schema/Rust/Tauri commands;
- changing W1 authority;
- modifying File Library UI/visual design to make the contract compile;
- changing FileLibraryList virtualization ownership;
- weakening the W2-01 Chromium regression gate;
- beginning W2-03 or W2-04.

## 19. Delivery workflow

After the W2-01 post-merge current-truth PR merges and implementation is explicitly released:

1. use this existing branch;
2. do not create another branch/PR;
3. implement only W2-02;
4. add focused tests first;
5. run applicable full frontend/browser checks;
6. commit and push;
7. create or update one Draft W2-02 PR;
8. report exact production head and CI;
9. keep PR Draft;
10. do not mark Ready or merge;
11. stop for fresh architecture/authority/maintainability review.

## 20. Final report format

Report:

- exact head SHA;
- changed files and LOC;
- final shared entry contract;
- final collection/completeness contract;
- final Library selection facade semantics;
- Browse selection contract semantics and what remains deferred to W2-04;
- thumbnail/source identity mapping;
- 100k/all-matching structural evidence;
- tests and exact-head CI;
- W2-01 Chromium gate result;
- authority invariants preserved;
- temporary artifact cleanup;
- `UNVERIFIED` / `DEFERRED` / `BLOCKED` items.

Final classification must distinguish `HARD PASS`, `OBSERVED`, `UNVERIFIED`, `DEFERRED`, and `BLOCKED` honestly.

Keep W2-02 Draft until independent review. Do not start W2-03/W2-04.