# W4-01 — Shared Native Host Bridge — Current-Truth Checkpoint

Recorded: 2026-08-25

Status: **ACTIVE / DRAFT / NOT CLOSEOUT**

Baseline: `master@994d93b07a2bc3434977de1e16bd1e29b2585983` (W4-00 activation / PR #142)

Implementation branch: `feat/w4-shared-native-host-bridge`

Draft PR: #143 — `W4-01: add shared native host bridge and source lifecycles`

Checkpoint implementation head before this documentation commit:
`4e1285819183b05279e133b1161667444321355b`.

This document is a branch checkpoint only. It is not W4-01 completion evidence, does not authorize W4-02/W4-03, and must not be used to mark W4-01 complete before the exact-head gates in the W4-01 taskbook are satisfied.

## Current initiative truth

W4-00 is no longer the current execution Track. It merged through PR #142 at:

`master@994d93b07a2bc3434977de1e16bd1e29b2585983`.

Therefore:

- W4 — Native Integration is **ACTIVE**;
- W4-01 — Shared Native Host Bridge + HostProvided Source Contract is the **only authorized production Track**;
- W4-02 and W4-03 remain dependency-gated behind W4-01;
- W4-04+ remain downstream-gated;
- W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE**.

The older W4-00 wording that still appears in canonical status/roadmap documents is activation-era wording and must be updated as part of W4-01 current-truth/closeout work. It must not be interpreted as re-authorizing W4-00 or as permission to start W4-02+ early.

## Implemented branch slice at this checkpoint

The current Draft PR contains the W4-01 shared boundary work only. At this checkpoint the branch includes:

- a dedicated `file_workspace::native_preview` module boundary;
- a Zen-owned Native Preview Access registry for request/session/sourceVersion/host-bound private staging and opaque access tokens;
- a separate shell-owned HostProvided registry with bounded request-scoped source ownership and opaque host tokens;
- runtime composition of both process-local registries;
- an explicit application-data root for native Preview staging rather than deriving production staging from the thumbnail cache path;
- Preview cancel/dispose/source-switch revocation of Zen-owned native staging;
- Ephemeral Browse teardown revocation for Preview-owned native staging;
- runtime-dispose cleanup for both Native Preview Access and HostProvided state;
- focused registry tests and runtime-level lifecycle tests;
- no new renderer-facing Tauri command for staging paths, native handles, HostProvided registration, or raw source byte access;
- no second Provider Registry, general ReadGate, durable native identity store, or native-preview semaphore.

This list describes code present in the Draft PR. It does **not** mean every W4-01 acceptance criterion has passed.

## Frozen boundaries that remain in force

### Zen-owned native-backed Preview

Zen-owned native Preview continues to use:

- `Managed` / `Ephemeral` source identity;
- the existing sourceVersion freshness contract;
- `ZenFloating` / `ZenPinned` host identity;
- `MaterializationReadGate` as byte/open authority;
- host-bound opaque native presentation state.

It must not create `HostProvided` merely because the final representation is native.

### Shell-owned Preview

`HostProvided` remains shell/request-owned only. The current intended first consumer is the future Windows Explorer Preview Handler Track.

A HostProvided token is process-local, opaque, bounded and request-scoped. It is not a disguised filesystem path and is not durable File Library identity.

### Native source acquisition

The hard W4-00/W4-01 acquisition sequence remains:

```text
source + expected sourceVersion
→ fresh ReadGate eligibility / identity validation
→ authoritative identity-checked open
→ bounded complete copy through that same open
→ private staging snapshot
→ final current sourceVersion revalidation
→ publishable host-bound native access token
```

A checked-once original source URL/path is not an authorized native presentation source. A normal `fs::copy` after an earlier eligibility check is not an acceptable substitute.

## Known open implementation item

The current Native Preview Access implementation at this checkpoint still requires final Codex convergence on the W4-01 single-open acquisition contract.

The existing bounded-read path is authoritative and revalidates on each read, but W4-01 requires the complete staging copy to flow through one authoritative identity-checked open rather than repeated chunk reads that reopen the source. The preferred completion shape remains the taskbook's narrow crate-private verified-copy/stream primitive inside `MaterializationReadGate`, with the staging registry owning only the destination writer and lifecycle.

This is an implementation blocker for W4-01 closeout, not a reason to weaken or reinterpret the frozen contract.

## Validation truth at this checkpoint

Hosted CI run `#957` on an earlier branch head established that source-checkout governance and change-scope routing were valid. Its Rust quality lanes stopped at two mechanical rustfmt differences before Rust tests/Clippy, so `#957` is **not** W4-01 acceptance evidence.

Those formatter differences were subsequently corrected.

Hosted CI run `#962` for implementation head
`4e1285819183b05279e133b1161667444321355b` was still **in progress** when this checkpoint was recorded. Therefore no exact-head PASS is claimed here.

The newly added runtime lifecycle tests are likewise not reclassified as accepted evidence until the corresponding current-head CI completes successfully.

## Remaining W4-01 gates

W4-01 must remain Draft until all applicable gates are satisfied on one final implementation head:

1. the single-open authoritative verified-copy staging contract is implemented and tested;
2. Native Preview Access race/capacity/expiry/partial-file cleanup behavior is fully covered;
3. HostProvided registration/read/revoke/unload/capacity/expiry behavior remains bounded and fail-closed;
4. runtime cancel/switch/dispose/Browse teardown returns native resources and files to baseline;
5. existing W3 Preview host policy remains unchanged for normal production composition;
6. `MacQuickLookExtension`, `WindowsQuickPreview` and `WindowsPreviewHandler` are not accidentally activated in the normal W3 host policy;
7. no renderer-facing raw path/native handle/HostProvided registration endpoint exists;
8. Rust format, focused tests, full Rust tests, Clippy, release compile and applicable performance/native lanes are clean;
9. change scope remains W4-01-only;
10. maintainability review reports no unresolved blocker;
11. final independent exact-head review reports no unresolved blocker;
12. current-truth documents and the PR description are synchronized with the final accepted head.

Only after those gates are met may W4-01 be marked COMPLETE and W4-02 / W4-03 become eligible for separate activation/execution according to the frozen dependency graph.

## Documentation closeout rule

Do not prematurely rewrite W4-01 as COMPLETE while implementation is still moving.

At final closeout, update the canonical W4 current truth to record:

- the final reviewed W4-01 head;
- exact-head and merge-integration CI evidence;
- the accepted Native Preview Access and HostProvided contracts;
- any explicit residual limitation or deferred native fixture;
- W4-02 and W4-03 as the next dependency-unblocked Tracks only after W4-01 closes;
- W5 still inactive.
