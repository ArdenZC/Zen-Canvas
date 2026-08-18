# W2-02 — Pre-Code Release Addendum

Status: binding release/audit addendum to `W2-02-SHARED-PRESENTATION-ENTRY-SELECTION-CONTRACTS-CODEX.md`.

W2-01 product/runtime merge: `master@2c22c90f67826b255cdce2f82313aa352d61a9f3` (PR #90).

W2-01 post-merge current-truth closeout: `master@b787642ee98d46a229fd3624a2aaed1b66f4d4ab` (PR #91).

PR #91 has merged. Any older taskbook wording that says W2-02 is blocked until that closeout merges is historical and is superseded by this addendum.

This addendum also supersedes any taskbook wording that conflicts with the source-of-truth clarifications below.

## Release decision and branch gate

W2-02 is the next dependency-eligible W2 production Track, but the current PR branch was originally forked from the W2-01 merge point rather than the post-#91 governance head.

Production implementation may begin **only after the working branch has been synchronized to `master@b787642ee98d46a229fd3624a2aaed1b66f4d4ab` or a later master descendant**.

Before any production edit, Codex must report:

- current branch name;
- pre-sync branch head;
- latest `origin/master` SHA;
- post-sync branch head;
- merge-base with `origin/master`;
- confirmation that `docs/project/STATUS.md` says W2-01 merged and W2-02 is next/not started;
- confirmation that `docs/project/ROADMAP.md` has the same W2 sequencing truth;
- confirmation that no W2-03/W2-04 production work is present;
- clean `git status --short`.

Do not implement on the stale pre-#91 tree. Do not describe the current branch as already rebased/synchronized until Git history proves it.

## Source-of-truth clarifications from the second pre-code audit

### 1. Managed Library adapter input is Query V2 `FileLibrarySummary`

The primary managed-Library presentation source for W2-02/W2-03 is the current Query V2 result projection, `FileLibrarySummary[]`, owned by `useFileLibraryResultStore`.

Do **not** design the new shared presentation contract around legacy `FileRecord` as its primary managed input. `FileRecord` may remain in legacy code or narrowly scoped compatibility tests, but W2-02 must not pull its raw/path-heavy model into the new W2 presentation spine.

The Library adapter should project from `FileLibrarySummary` (plus separately supplied exact source/query context when required), preserving the existing Query V2 authority rather than creating another conversion authority.

`FileLibrarySummary.displayDirectory` is presentation metadata. It is not a filesystem operation/resolution authority.

### 2. Shared entry/facade types must remain source-discriminated

Prefer explicit discriminated unions such as the semantic shape:

```ts
type PresentationEntry = LibraryPresentationEntry | BrowsePresentationEntry;
```

with `source: "library" | "browse"` and source-specific identity/context kept in the corresponding branch.

Avoid one flat object containing many optional Library/Browse authority fields. Invalid combinations such as a Browse entry carrying a managed-query fingerprint or a Library entry carrying an ephemeral enumeration owner should be difficult or impossible to represent.

The same principle applies to selection/focus facades: source-specific mutation/intents remain explicitly tagged and route only to their source owner.

### 3. Library `all_matching` membership is collection-context-bound

`LibrarySelectionV1::all_matching` membership is valid only for a Library entry known to belong to the exact active Query V2 collection represented by that selection.

The existing source store currently exposes a generic `isSelected(fileId)` that, for `all_matching`, is effectively true for any ID not in `excludedFileIds`. W2-02 must **not** blindly re-export/delegate that generic method as a cross-source presentation contract.

The new facade must be constructed/bound with enough exact collection context to make membership truthful, including the active `queryFingerprint` and `snapshotRevision` (or equivalent proven source context).

Rules:

- `explicit`: membership may be evaluated by ID membership;
- `all_matching`: an entry may be reported selected only when the facade knows the entry comes from the same exact query fingerprint/snapshot and the file ID is not excluded;
- fingerprint/revision mismatch must fail closed and must never assert selected;
- do not enumerate the matching Query V2 result to prove membership;
- preserve the original `query`, `queryFingerprint`, `snapshotRevision`, and `excludedFileIds` source truth;
- lookup sets may be cached once per selection snapshot/facade, not rebuilt per cell.

### 4. Range/select-all semantics remain source-owned

W2-02 may define component-facing intents, but it must not implement a new generic range-selection algorithm across shared presentation entries.

Ordering, anchor interpretation, range expansion, and select-all semantics remain source-owned.

For Browse specifically, the W0/W1 contract is explicit/session-scoped selection; W2-02 must not invent an unseen-entry/all-matching Browse selection semantic before W2-04.

A shared facade may expose source capability/intent metadata (including unsupported states), but it must not require every source to implement a generic `selectAll` that claims unseen Browse entries. Tests for Browse should use a source-owned fake/adapter and prove that incomplete enumeration never implies unseen selection.

### 5. Presentation/UI keys must be injective, not just visually namespaced

Presentation keys are opaque render identity only. They are not resolver input, operation identity, history identity, durable identity, or filesystem authority.

The encoding must be collision-safe for arbitrary opaque IDs. Do not rely on ambiguous delimiter concatenation such as `browse:${sessionId}:${entryId}` unless the components are escaped/length-prefixed in a provably injective way.

Acceptable approaches include an unambiguous tuple/structured encoding. Add adversarial tests where IDs themselves contain separators so two different source identities cannot produce the same UI key.

### 6. Browse `enumerationId` is not automatically thumbnail `sourceGeneration`

`BrowsePage.enumerationId` owns enumeration/cursor publication validity. `ThumbnailRequest.sourceGeneration` is a separate optional W1 thumbnail field.

W2-02 must not infer that `enumerationId === sourceGeneration` unless an existing W1 contract explicitly proves that equivalence.

If the truthful thumbnail source generation is not available at this presentation boundary:

- preserve the ephemeral `EntryRef` and session identity;
- keep generation absent/unknown;
- let the later source/request owner supply a proven generation if required.

Do not fabricate generation metadata merely to fill a shared thumbnail descriptor.

### 7. Capability/materialization projection must fail closed

Browse already carries the W1 `MaterializationState` projection. Managed Query V2 summaries expose their own `nativeSemantics` evidence, including `contentAvailability`, when known.

Do not create heuristic equivalences between these domains.

In particular:

- do not infer read eligibility from path, extension, platform, cloud-backing label, managed/unmanaged wording, or file type;
- do not translate `not_local` into a stronger `remote_placeholder`/materialization claim unless an existing reviewed contract explicitly establishes that mapping;
- unknown or unproven capability/materialization values remain `unknown`;
- if any mapping is introduced, keep it narrow, explicit, one-way, and covered by truthfulness tests;
- W1 Read Gate remains the byte-read eligibility authority.

W2-02 does not need to invent a large generic capability framework. Minimal truthful projection is preferred.

### 8. Collection truth is separate from entry truth

Entry projection and collection completeness must remain separate contracts.

For Library, collection context may carry the existing Query V2 identity/count state needed by later presentation code, but it must not duplicate query ownership.

For Browse, collection context must preserve session/enumeration identity, `partial | complete`, and `knownCount` only when the source actually supplies it.

Do not attach `complete=true` to an individual Browse entry merely because it is rendered. Loaded count is not an exact total for a partial Browse enumeration.

### 9. 100k/virtualization tests must test structure, not materialize a second 100k model

The 100k `all_matching` test exists to prove compact source-owned selection and virtualization independence.

Do not satisfy it by projecting/storing another 100,000-entry shared selection/model merely for the test. Prefer structural assertions showing that the selection representation remains query-owned/compact while only the mounted/visible subset is projected.

Mount state must never redefine selection state.

### 10. W2-01 regression gate remains permanent

The committed Playwright Chromium W2-01 gate is permanent infrastructure. W2-02 must leave its routing, real-browser execution, scroll-owner assertions, and virtualization assertions enabled and green.

Contract-only work is not allowed to weaken it.

## Scope remains unchanged

W2-02 still does not authorize:

- W2-03 Library migration UI;
- W2-04 Browse navigation/content implementation;
- shared List/Grid/Context UI;
- Query V3;
- a new shared durable selection store;
- persistent Browse identity;
- Rust/Tauri/schema changes;
- W1 authority changes;
- `FileLibraryList` virtualizer ownership changes;
- visual redesign.

Keep PR #92 Draft through implementation and stop for fresh architecture/authority/maintainability review before Ready or merge.
