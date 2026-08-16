# W1-03 — Ephemeral Browse Core — Codex Implementation Brief

Status: active implementation task

Baseline: `master@3f30f12fea23961e03b4021d0ffa63c80377167b` (W1-01 / F1 merge)

Branch: `feat/w1-03-ephemeral-browse-core`

## Goal

Implement the backend Ephemeral Browse core: session-scoped, progressive filesystem enumeration with opaque path/entry refs, cancellation, bounded temporary state and stale-page rejection. Browse must work without admitting the directory to the managed Library.

## Required behavior

- Reuse W1-01 `LocationRef`, `BrowsePathRef`, `EntryRef`, and `BrowseEnumerationRef`; do not invent alternate wire identities.
- Keep physical paths backend-internal. Public/session-facing operations use opaque refs; renderer-authorized raw paths are not an authority boundary.
- Implement a Browse session/service core that can enumerate a trusted backend-resolved directory progressively.
- Return bounded pages/batches; never require full directory enumeration before first useful results.
- Every page/cursor is bound to `{sessionId, requestId, enumerationId}`. Cursor tokens are opaque.
- Starting/restarting/invalidation rotates enumeration identity and revokes all prior cursor/page publication rights. Stale cursor/page usage fails closed.
- Ephemeral entry IDs are session-scoped and non-durable. Do not persist them.
- Temporary cache/registry state must be bounded and cleared on session disposal.
- Cancellation must stop or revoke publication from superseded enumeration work. Slow/late work must not publish into a newer generation.
- Enumeration errors (permission denied, disappearing directory/file, unsupported entry) are bounded/fail-closed and do not create managed DB state.
- Use existing filesystem/path safety helpers where applicable; do not weaken symlink/provider/platform rules.

## Suggested implementation boundary

Prefer new modules under `src-tauri/src/file_workspace/browse/` (or equivalent) with pure/internal service APIs and focused tests. Avoid Tauri command registration; W1-10 owns public integration.

## Required tests

At minimum:

- normal directory enumeration with multiple pages;
- first page available before complete enumeration semantics are required;
- cursor is valid only for its issuing session/request/enumeration;
- re-enumeration invalidates old cursor/page publication;
- cancellation/supersession prevents stale publish;
- session dispose clears temporary refs/state;
- permission-denied / disappearing entry failure is bounded;
- opaque wire-facing refs never expose raw filesystem paths;
- a large fixture demonstrates bounded paging (do not add an expensive 100k PR test here; W1-11 owns full performance gate).

## Protected authorities / non-goals

Do not create scan roots, write Query V2/managed DB truth, add schema/migrations, implement managed watcher logic, recursive unmanaged global search, filesystem mutation, polished UI, Tauri/frontend integration, or W1-09 watcher refresh.

No durable Ephemeral snapshot/cache in v1.

## Definition of Done

- Progressive/cancellable backend Browse core exists behind opaque refs.
- No managed authority or Query V3 created.
- Enumeration generation/cursor publication rules are explicit and tested.
- Resource/cache state is bounded and disposable.
- Rust fmt/tests/clippy and available cross-platform compile gates pass; report skipped fixture/platform checks honestly.
- Leave PR Draft for independent architecture/code review.