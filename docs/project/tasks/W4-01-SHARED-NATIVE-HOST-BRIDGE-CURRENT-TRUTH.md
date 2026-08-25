# W4-01 — Shared Native Host Bridge — Current-Truth Checkpoint

Recorded: 2026-08-25

Status: **IMPLEMENTATION ACCEPTED / FINAL REVIEW PENDING / NOT CLOSEOUT**

Baseline: `master@994d93b07a2bc3434977de1e16bd1e29b2585983` (W4-00 activation / PR #142)

Implementation branch: `feat/w4-shared-native-host-bridge`

Draft PR: #143 — `W4-01: add shared native host bridge and source lifecycles`

Final independently accepted implementation head before this documentation-only checkpoint update:

`12b732f14d1c669879fe6f22823945b0a004f321`

Implementation tree:

`29ba0db831739b12fe38bb81a6260d919b199e2d`

This document records the accepted W4-01 implementation checkpoint. It is **not** the W4-01 merged closeout record, does not authorize W4-02/W4-03, and must not be used to mark W4-01 COMPLETE before PR #143 is finally reviewed and merged and the post-merge governance closeout is recorded.

## Current initiative truth

W4-00 merged through PR #142 at:

`master@994d93b07a2bc3434977de1e16bd1e29b2585983`.

Therefore:

- W4 — Native Integration is **ACTIVE**;
- W4-01 — Shared Native Host Bridge + HostProvided Source Contract remains the **only authorized production Track** until its merge/closeout completes;
- W4-02 and W4-03 remain dependency-gated behind W4-01;
- W4-04+ remain downstream-gated;
- W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE**.

The W4-00 wording still present in canonical STATUS/ROADMAP/initiative documents is activation-era truth. Those canonical documents must be synchronized after the W4-01 production merge so the real merge SHA can be recorded without inventing future evidence.

## Accepted W4-01 implementation

The reviewed implementation preserves two separate native-source ownership lifecycles.

### Zen-owned Native Preview Access

Zen-owned native-backed Preview keeps the existing:

- `Managed` / `Ephemeral` source identity;
- sourceVersion freshness contract;
- `ZenFloating` / `ZenPinned` host identity;
- `MaterializationReadGate` byte/open authority;
- existing PreviewSession / Provider Registry publication ownership.

W4-01 adds a bounded Native Preview Access registry that owns only private disposable staging and opaque host/request/sourceVersion-bound access tokens.

The accepted acquisition path is:

```text
source + expected sourceVersion
→ fresh MaterializationReadGate eligibility / identity validation
→ exact sourceVersion check
→ one authoritative identity-checked open
→ bounded complete copy through that same open
→ private staged snapshot
→ fresh current sourceVersion revalidation
→ atomic request/current-authority commit
→ publishable opaque host-bound native access token
```

The source path/File/handle never leaves ReadGate. Partial/over-budget/cancelled/timed-out/stale staging is not publishable and is cleaned up.

Native Preview Access is bounded by record count, per-file bytes, total staged bytes, read chunk size, acquisition duration and TTL. Config validation requires the checked sum of acquisition duration plus TTL to remain below the bounded abandoned-staging cleanup threshold.

### Shell-owned HostProvided

`HostProvided` remains OS/shell-request-owned only. W4-01 does not retokenize Zen Managed/Ephemeral sources and does not make `WorkspacePreviewResolver` a shell-token resolver.

The accepted HostProvided registry provides:

- opaque process-local host tokens;
- exact activated shell host + generation binding;
- bounded read size;
- request-scoped cancellation/revocation state;
- TTL/expiry rejection;
- generation revoke and registry dispose;
- post-read host/generation/cancellation/expiry revalidation;
- native source records detached under the registry mutex and destroyed only after the mutex is released.

The first intended consumer remains the future W4-03 Windows Explorer Preview Handler. W4-01 does not implement COM, `IStream`, Preview Pane UI or installer registration.

## Runtime / lifecycle result

`RuntimeInner` now composes the two bounded process-local native registries while preserving existing durable authorities.

Production supplies an explicit app-data native staging root. No renderer-facing raw staging path, native handle or HostProvided registration/read Tauri command was added.

Native Preview Access is revoked after PreviewSession authority is cancelled/disposed/superseded and before existing Preview asset cleanup. Ephemeral Browse teardown follows the same authority-first ordering. Runtime dispose revokes Preview/native request capability before releasing underlying ReadGate/Browse resources.

A deterministic integration test proves runtime dispose racing a real in-flight multi-chunk staging copy: the copy is paused after its first chunk, runtime disposal revokes native/read authority, the worker resumes fail-closed, and native records/inflight/staged roots/ReadGate leases return to baseline.

## Security / architecture invariants preserved

The accepted implementation does **not**:

- create a second Provider Registry;
- create a second general ReadGate/materialization authority;
- create a second native scheduler/semaphore;
- persist native/HostProvided tokens;
- expose raw source or staging paths to React/WebView;
- add renderer-facing HostProvided registration/read capability;
- make Managed/Ephemeral sources HostProvided;
- make `WorkspacePreviewResolver` resolve HostProvided;
- activate `MacQuickLookExtension`;
- activate `WindowsQuickPreview`;
- activate `WindowsPreviewHandler` through normal W3 production host policy;
- implement W4-02 macOS native UI;
- implement W4-03 Windows COM Preview Handler;
- modify installer/file-association/signing scope;
- activate W5.

## Exact implementation validation

Accepted implementation identity:

- head: `12b732f14d1c669879fe6f22823945b0a004f321`;
- tree: `29ba0db831739b12fe38bb81a6260d919b199e2d`;
- base: `master@994d93b07a2bc3434977de1e16bd1e29b2585983`;
- master had not drifted at the final implementation audit.

Focused local evidence reported for that head:

- `cargo fmt -- --check`: PASS;
- `native_preview`: 36 passed;
- `host_provided`: 16 passed;
- `file_workspace::read_gate`: 28 passed;
- `file_workspace::integration`: 42 passed / 14 ignored;
- Clippy `-D warnings`: PASS.

Hosted CI run `32835522328` is bound to the same implementation head and completed `success`.

Accepted hosted lanes include:

- source checkout / governance: PASS;
- change scope / routing: PASS;
- macOS Rust format/tests/Clippy/race validation: PASS;
- Windows Rust format/tests/Clippy/native filesystem smoke: PASS;
- macOS and Windows release compile: PASS;
- Apple-Silicon native macOS performance: PASS;
- Performance Prepare: PASS;
- Preview Platform performance: PASS;
- Workspace Foundation performance: PASS;
- Performance profile: PASS;
- macOS Quality aggregate: PASS;
- Windows Quality aggregate: PASS.

Unrelated Library/Search/Intelligence/Scan performance shards were correctly not selected by routing.

## Independent code-audit record

W4-01 did not close on the first green CI result. Three independent review rounds were used.

### First audit

The first audit found lifecycle blockers including HostProvided in-flight revoke/expiry behavior, Native Preview Access final-check→commit cancellation race, incomplete deterministic concurrency evidence, acquisition-duration bounds and test maintainability. Those issues were returned to Codex and remediated.

### Second audit

The second audit confirmed the first blockers were closed, then found additional P2s: HostProvided native source destruction could occur under the registry mutex, staging lifetime needed an acquisition+TTL invariant, terminal-state staging needed direct consumer-boundary evidence, runtime dispose needed a real in-flight composition test, and two race tests still depended on scheduler timing. Those issues were returned to Codex and remediated.

### Third exact-head audit

Independent review `#5018017579` on implementation head `12b732f14d1c669879fe6f22823945b0a004f321` records:

**PASS — code/test blockers = 0.**

The third audit revalidated all earlier fixes, scope, lifecycle ordering, ReadGate authority, HostProvided ownership, deterministic tests and exact-head CI. No unresolved P1/P2 code or test blocker remains on that implementation tree.

## Remaining gates before W4-01 closes

The implementation is accepted, but W4-01 is not yet merged/closed.

Remaining gates are:

1. synchronize this documentation-only checkpoint with the PR head and let repository CI validate the resulting final PR tree;
2. perform final PR/Codex review with no unresolved blocker;
3. ensure PR #143 remains based on the same W4-00 master baseline with no unexpected scope drift;
4. merge #143 only with an expected-head guard;
5. after the real merge SHA exists, create/update canonical STATUS / ROADMAP / W4 initiative closeout truth;
6. only after that governance closeout may W4-02 and W4-03 become dependency-unblocked for separate execution.

## W4-02 / W4-03 boundary after W4-01

W4-01 prepares lifecycle primitives only.

W4-02 must still bind the actual macOS native presentation/view lifetime to Preview cancellation/release after Native Preview Access resolution. It must not solve that problem by exposing raw source paths to the renderer.

W4-03 must adapt the real Explorer/COM request source into the accepted HostProvided cancellation/read lifecycle while preserving shell isolation and `Unload` cleanup. W4-01 does not pre-approve a COM implementation strategy beyond the frozen bridge contract.

W5 remains inactive.
