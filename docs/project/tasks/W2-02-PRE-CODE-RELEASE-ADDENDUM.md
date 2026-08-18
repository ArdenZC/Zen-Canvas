# W2-02 — Pre-Code Release Addendum

Status: binding release addendum to `W2-02-SHARED-PRESENTATION-ENTRY-SELECTION-CONTRACTS-CODEX.md`.

W2-01 product/runtime merge: `master@2c22c90f67826b255cdce2f82313aa352d61a9f3` (PR #90).

W2-01 post-merge current-truth closeout: `master@b787642ee98d46a229fd3624a2aaed1b66f4d4ab` (PR #91).

PR #91 has merged. The old taskbook wording saying W2-02 is blocked until that closeout merges is now historical and is superseded by this addendum.

## Release decision

W2-02 is now the next dependency-eligible W2 production Track.

Production implementation may begin **only after the working branch has been synchronized to `master@b787642ee98d46a229fd3624a2aaed1b66f4d4ab` or a later master descendant**.

Before any production edit, Codex must report:

- current branch name;
- pre-sync branch head;
- latest `origin/master` SHA;
- post-sync branch head / merge-base;
- confirmation that `docs/project/STATUS.md` says W2-01 merged and W2-02 is next/not started;
- confirmation that no W2-03/W2-04 production work is present.

Do not implement on the stale pre-#91 tree.

## Clarifications from pre-code audit

### Library all-matching membership

`LibrarySelectionV1::all_matching` membership is valid only for a Library entry that the source adapter knows belongs to the exact active query/snapshot represented by that selection.

Do not expose a generic `isSelected(fileId)` that silently assumes any arbitrary managed file belongs to an all-matching query.

The facade must retain or be constructed with enough source/query context to make visible-row membership honest. `queryFingerprint` and `snapshotRevision` remain source-owned truth.

### Browse selection

W2-02 defines the component-facing Browse selection/focus contract only. It must not create the final Browse selection store/authority before W2-04.

Tests may use a fake/source-owned Browse selection owner to prove intent routing, session/enumeration scope and incomplete-enumeration truthfulness.

### Collection completeness

Entry projection and collection completeness are separate contracts. Do not attach a `complete=true` implication to an individual Browse entry merely because that entry is rendered.

### Presentation keys

Presentation/UI keys are opaque render identity only. They are not resolver input, operation identity, history identity, durable identity or filesystem authority.

### W2-01 regression gate

The committed Playwright Chromium W2-01 gate is now permanent infrastructure. W2-02 must leave it enabled and green. Contract-only work is not allowed to weaken its routing, assertions or real-browser execution.

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
- visual redesign.

Keep PR #92 Draft through implementation and stop for fresh architecture/authority/maintainability review before Ready or merge.