# W2-02 — Shared Presentation Entry / Collection Contracts

Status: complete — independently reviewed and squash merged through PR #101 as `master@f1fd3591977142f08eac139814fecebe2e0e6d96`.

Activation branch: `feat/w2-02-shared-presentation-contracts`.

This is the single current W2-02 taskbook. It defines the smallest shared presentation boundary after the W1-to-W2 consumer seams are proven. It does **not** define shared selection/focus runtime behavior; that convergence waits until both source owners exist through W2-03 and W2-04.

## 0. Required reading and preflight

Before implementation, read and treat as binding:

1. `AGENTS.md`;
2. `docs/project/README.md`;
3. `docs/project/STATUS.md`;
4. `docs/project/ROADMAP.md`;
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`;
6. `docs/project/DEVELOPMENT_WORKFLOW.md`;
7. `docs/project/CODE_MAINTAINABILITY.md`;
8. `docs/project/ARCHITECTURE_MAP.md`;
9. `docs/project/initiatives/W2-file-library-experience.md`;
10. `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`;
11. accepted R1/R2/R3/R4 taskbooks and exact evidence;
12. current Query V2 summary/selection contracts;
13. current W1 File Workspace TypeScript contracts/API/controller;
14. focused identity/lifetime/performance tests relevant to presentation adapters.

The prerequisite gate is satisfied on the activation baseline: STATUS/ROADMAP record R4 PASS and W2-02 as dependency-eligible. Do not reinterpret that as authorization for W2-03/W2-04 behavior inside this Track.

Use an isolated worktree/branch. Record HEAD/base/merge-base/changed paths before editing. Stop on unrelated changes.

## 1. Goal

Define the minimal source-discriminated entry and collection projection that lets later rendering code consume either:

- managed Library summaries; or
- ephemeral Browse entries

without collapsing their authorities, lifetimes or completeness semantics.

The contract is presentation infrastructure, not a new data, query, selection, navigation, filesystem, thumbnail or persistence authority.

## 2. In scope

### Entry projection

A discriminated union such as:

```text
PresentationEntry =
  LibraryPresentationEntry
  | BrowsePresentationEntry
```

may normalize only truthful rendering facts, for example:

- source tag (`library` / `browse`);
- injective render key for the current source lifetime;
- display name;
- file/directory kind;
- extension/type/icon hint;
- size/timestamps when known;
- materialization/availability/capability projection when already supplied by an owning source;
- source-specific opaque refs needed by later source adapters, preserved without interpretation.

### Collection projection

Entry truth and collection truth remain separate.

Library collection context may retain the exact Query V2 collection provenance needed by a later Library source owner, without copying the whole query/selection model into every row.

Browse collection context must preserve the source-owned publication identity needed to reason about the presented batch/collection, including:

- `sessionId`;
- `requestId`;
- `enumerationId`;
- partial/complete state;
- `knownCount` only when the source truthfully supplies it.

Rendering one page never proves whole-folder completeness.

### Pure adapters

W2-02 may add pure or nearly pure types/adapters/facades that translate existing source output into the presentation contracts. These adapters may not acquire independent lifecycle or durable state.

## 3. Explicitly deferred to later Tracks

The following are **not W2-02 contracts**:

- generic cross-source selection authority;
- shared selection store;
- shared `isSelected` facade;
- selection anchor/range semantics;
- Select All behavior;
- focus ownership or keyboard focus model;
- source-neutral operation dispatcher;
- source-neutral navigation action;
- Thumbnail request construction/ownership;
- Browse source owner/navigation/content implementation;
- Library migration;
- List/Grid/Context UI;
- persistence/schema/Rust/Tauri changes.

Library selection remains `LibrarySelectionV1`; Browse selection semantics remain undefined until W2-04 exposes the real source owner. W2-05 is where shared interaction/selection/focus convergence may be designed using the concrete W2-03 and W2-04 owners.

W2-02 may preserve opaque source references that later owners need, but it must not define how selection/focus/actions operate through them.

## 4. Authority rules

The existing authorities remain unchanged:

- managed query truth -> File Library Query V2;
- managed cross-page selection -> `LibrarySelectionV1` + backend resolution;
- Browse session/enumeration/entry/path lifetime -> W1 Browse authority;
- content-byte eligibility/source version -> Read Gate;
- Thumbnail cache/scheduler/generation authority -> W1 Thumbnail subsystem after R2 remediation;
- Location admission/actionability -> backend seam accepted through R3;
- live navigation/history presentation -> `WorkspaceSession`;
- filesystem mutation/recovery -> existing operation/Safe Trash/restore authorities.

A presentation adapter can translate an authority; it cannot become one.

## 5. Entry identity rules

### Library

Library presentation entries derive from the existing managed summary contract (normally `FileLibrarySummary` or its current successor). Managed IDs remain managed IDs.

### Browse

Browse presentation entries must use the source-specific ephemeral identity/lifetime contract accepted in R2. They must preserve the source session relationship and must not accept a managed ref as if it were Browse.

### Render key

A render key is a UI identity only.

It must be injective even for adversarial opaque IDs containing separators or punctuation. It must never be accepted as:

- filesystem path;
- resolver input;
- operation identity;
- history identity;
- thumbnail generation/cache identity;
- durable identity;
- selection authority.

Use structural encoding/tagging rather than ambiguous delimiter concatenation where necessary.

## 6. Metadata and unknown semantics

Normalize only values supplied by the owning source.

- unknown metadata remains unknown;
- missing timestamps/sizes are not converted into authoritative zero values;
- Browse display paths remain presentation-only;
- materialization/availability/capability projections remain descriptive, not byte-read or mutation permission;
- provider/platform facts are not inferred from strings;
- W1 Preview metadata fallback is not promoted into W3 Preview architecture.

## 7. Collection provenance rules

### Library

The shared collection projection may retain an opaque/exact collection provenance object sufficient for W2-03 to prove Query V2 membership context later. It must not:

- duplicate the full query in every entry;
- compute selection membership itself;
- expose a context-free cross-source `isSelected(fileId)` contract;
- enumerate all-matching IDs.

`LibrarySelectionV1::all_matching` remains compact and source-owned.

### Browse

Preserve full W1 collection provenance from the current enumeration. A new enumeration supersedes the old publication according to W1 lifetime rules; W2-02 must not retain a presentation collection after the source has revoked it.

`completion: partial` means partial. `knownCount` is only exact when the source says it is known.

## 8. Thumbnail and Location boundaries

R2 and R3 are prerequisites precisely so W2-02 does not guess these seams.

W2-02 may carry the accepted opaque source-specific references/projections needed by later owners, but it must not:

- manufacture Thumbnail `sourceGeneration`;
- reconstruct Thumbnail requests from presentation-only data;
- infer generation from `enumerationId` unless R2 explicitly proved that contract;
- turn `LocationDescriptor` into a renderer path;
- add a new Location resolver/admission command;
- duplicate the R3 action seam.

## 9. Performance shape

The contract must remain cheap for 100k logical collections:

- no second 100k presentation copy solely for selection state;
- no per-entry copy of complete query/collection authority;
- no hidden O(total collection) transform for visible-row rendering;
- no DOM assumptions in contract tests;
- virtualization/mount state remains presentation-only.

Structural tests should prove compactness with representative large logical sets without allocating a second authoritative model.

## 10. Required tests

At minimum add focused contract tests for:

- Library vs Browse discrimination;
- managed ref cannot masquerade as Browse;
- Browse source/session provenance preservation;
- collection triple preservation (`sessionId/requestId/enumerationId`);
- partial vs complete Browse collection semantics;
- `knownCount` unknown behavior;
- metadata unknown preservation;
- adversarial opaque IDs and injective render keys;
- render key cannot be parsed/reused as authority;
- Library collection provenance remains separate from entry rows;
- no context-free selection API is introduced;
- no all-matching ID materialization;
- 100k structural/compactness evidence;
- W2-01 real Chromium regression remains green.

Tests must not fabricate a Thumbnail generation or Location path to make a presentation object convenient.

## 11. Maintainability gate

Keep the shared contract small and source-discriminated.

Do not create a giant `file.ts`/`presentation.ts` object that absorbs navigation, selection, operation, thumbnail, preview and source lifecycle. Split by cohesive responsibility only when needed; do not create dozens of one-type micro-files.

If implementation requires a new runtime store/singleton/controller, STOP: that is evidence the contract is no longer a pure presentation boundary.

## 12. Stop conditions

STOP and request architecture review if W2-02 appears to require:

- new Rust/Tauri/schema/permission/event changes;
- a source-neutral selection/focus runtime;
- Browse selection semantics before W2-04;
- a new query authority;
- a new lifecycle registry;
- raw path handling;
- Thumbnail or Location remediation;
- W2-03/W2-04 product behavior;
- W3 Preview behavior;
- weakening any R1/R2/R3/R4 invariant.

Do not solve a missing source-owner feature inside the shared presentation layer.

## 13. Exit gate

W2-02 passes only when:

- Library and Browse can be represented by a shared rendering shape without sharing authority;
- entry vs collection provenance is explicit;
- Browse lifetime identity is preserved exactly;
- metadata/capability unknown states remain truthful;
- no shared selection/focus runtime exists;
- no Thumbnail/Location request construction is guessed;
- 100k structural evidence remains compact;
- W2-01 regressions and applicable frontend/build/governance checks pass;
- exact-head evidence follows accepted R1 policy.

After W2-02 merges, W2-03 and W2-04 may proceed in parallel in separate worktrees. Shared selection/focus interaction convergence remains blocked until both source owners exist.

## 14. Final report

Return:

1. branch/worktree/head/base;
2. changed files;
3. final entry union shape;
4. final collection context shape;
5. Library provenance handling;
6. Browse lifetime/provenance handling;
7. render-key encoding and adversarial tests;
8. metadata unknown semantics;
9. explicit proof that no shared selection/focus runtime was introduced;
10. explicit proof that Thumbnail/Location remediation was not reimplemented;
11. 100k compactness evidence;
12. W2-01 regression evidence;
13. maintainability review;
14. applicable CI exact-head evidence;
15. cleanup result;
16. all unverified/deferred items;
17. PR state/head;
18. explicit statement that W2-03/W2-04 were not started.

STOP after the W2-02 Draft PR is pushed for independent review.
