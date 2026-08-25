# W4-01 — Shared Native Host Bridge — Current-Truth Checkpoint

Recorded: 2026-08-25

Status: **IMPLEMENTATION ACCEPTED / FINAL PR-TREE SYNC PENDING / NOT CLOSEOUT**

Baseline: `master@994d93b07a2bc3434977de1e16bd1e29b2585983` (W4-00 activation / PR #142)

Implementation branch: `feat/w4-shared-native-host-bridge`

PR: #143 — `W4-01: add shared native host bridge and source lifecycles`

Final independently accepted implementation head before this checkpoint-only update:

`5e99b940ac81a78d4b129d405379a027aad489b7`

Implementation tree:

`100843c8eac51dc1bc676a20b170fbd31abbe759`

Exact-head hosted CI:

`32844897985` — **SUCCESS**

Independent exact-head review-of-record:

`#5019582519` — **PASS / blockers = 0**

This document records branch-local execution truth only. It is **not** the W4-01 merged closeout record, does not mark W4-01 COMPLETE, and does not authorize W4-02/W4-03 before the real production merge and governance closeout.

## Current initiative truth

W4-00 merged through PR #142 at:

`master@994d93b07a2bc3434977de1e16bd1e29b2585983`.

Therefore:

- W4 — Native Integration remains **ACTIVE**;
- W4-01 — Shared Native Host Bridge + HostProvided Source Contract remains the **only authorized production Track** until its merge/closeout completes;
- W4-02 and W4-03 remain dependency-gated behind a successfully merged and governed W4-01;
- W4-04+ remain downstream-gated;
- W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE**.

Canonical `STATUS.md`, `ROADMAP.md` and the W4 initiative are intentionally not marked W4-01 COMPLETE before a real merge SHA exists.

## Review-authority rule

Codex is used as the implementation agent for code/test changes only.

**Codex Review is not an acceptance or merge authority for Zen.**

Code acceptance is owned by independent ChatGPT exact-head audit plus exact-head repository CI. Automated/external review comments may provide leads, but they are advisory until ChatGPT independently verifies them against the exact code, tests and frozen contracts.

Required flow:

```text
Codex implementation
→ exact-head hosted CI
→ independent ChatGPT exact-head code audit
→ blockers = 0
→ final PR-tree CI
→ expected-head squash merge
→ docs-only governance closeout
```

## Accepted W4-01 architecture

### Zen-owned Native Preview Access

The accepted implementation:

- retains Managed/Ephemeral source identity;
- retains `ZenFloating` / `ZenPinned` host identity;
- keeps `MaterializationReadGate` as byte/open authority;
- performs one authoritative identity-checked open for complete staging;
- keeps the source path/File/handle inside ReadGate;
- revalidates fresh sourceVersion after the copy and current request authority at commit;
- publishes only an opaque request/session/sourceVersion/host-bound native-access token;
- cleans partial, cancelled, stale, timed-out, expired and revoked staging;
- bounds acquisition duration, staging TTL, per-file bytes, total bytes, record count and chunk size;
- reuses the existing process-wide `WorkScheduler` for Native Preview staging admission.

The accepted acquisition path is:

```text
source + expected sourceVersion
→ fresh ReadGate eligibility / identity validation
→ exact sourceVersion check
→ shared WorkScheduler Interactive admission
→ one authoritative identity-checked open
→ scheduler-bounded complete copy through that same open
→ private app-owned non-symlink staged snapshot
→ fresh current sourceVersion revalidation
→ current-authority commit
→ opaque host/request/sourceVersion-bound native access token
```

Native Preview Access does not become a second eligibility/read authority.

### Shell-owned HostProvided

`HostProvided` remains OS/shell-request-owned only. The accepted HostProvided registry:

- stays separate from Managed/Ephemeral identity and `WorkspacePreviewResolver`;
- issues opaque process-local host tokens;
- binds exact shell host + generation + request-scoped source;
- enforces bounded reads and TTL;
- propagates revoke/cancellation to in-flight reads;
- revalidates host/generation/cancellation/expiry after read;
- detaches native source records under the registry mutex and destroys them only after the mutex is released.

The first intended consumer remains the future W4-03 Windows Explorer Preview Handler. W4-01 does not implement COM, `IStream`, Preview Pane UI or registration.

## Final remediation closure

A later independent audit reopened W4-01 with three P2 blockers. Codex remediated them on `5e99b940…`, and ChatGPT independently re-audited the exact code rather than accepting automated review authority.

### P2-1 — ReadGate lease lifetime vs Native acquisition — CLOSED

Authoritative ReadGate default lease TTL remains 30 seconds.

Native Preview Access default acquisition is now 20 seconds, and registry construction validates:

```text
max_acquisition_duration < MaterializationReadGate::lease_ttl()
```

Incompatible custom configs fail before staging-root creation. General Preview/Thumbnail ReadGate lease policy was not lengthened or forked.

### P2-2 — Shared WorkScheduler NativePreview admission — CLOSED

Native Preview staging now reuses the existing `WorkScheduler` through a thin Native Preview resource adapter.

Each complete staging operation is admitted as `Interactive` work with:

```text
native_preview = 1
io             = 1
open_handles   = 2
```

The scheduler lease is RAII-owned across the staging operation. Queue waiting is deadline-bounded, Preview/revoke cancellation propagates into admission, and deterministic tests prove concurrent staging is constrained by the shared native-preview slot and returns scheduler resources to baseline.

No second scheduler or semaphore was created.

### P2-3 — staging-root symlink/reparse safety — CLOSED

Native staging-root initialization now uses no-follow metadata and rejects:

- final-root symlinks;
- Windows reparse-like roots;
- non-directory roots.

Only after verification may private permissions and abandoned cleanup run. Stage directories are revalidated, and cleanup only removes verified real `.native-preview-*` directories.

A normal first-run app-data parent remains available because `Database::open` creates the database parent before FileWorkspaceRuntime composition.

Focused tests cover a non-directory root, Unix symlink target preservation, and Windows reparse-attribute fail-closed classification.

## Runtime / lifecycle result

`RuntimeInner` composes Native Preview Access and HostProvided as bounded process-local owners while preserving existing durable authorities.

Production supplies an explicit app-data native staging root. No renderer-facing raw staging path, native handle or HostProvided registration/read Tauri command was added.

Preview cancel/dispose/source-switch and Ephemeral Browse teardown revoke Native Preview Access after PreviewSession authority invalidation and before Preview asset cleanup. Runtime dispose revokes Preview/native request capability before releasing ReadGate/Browse resources.

Deterministic integration evidence covers runtime disposal racing an actual in-flight multi-chunk staging copy and returns native records/inflight/staged roots/ReadGate leases to baseline.

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

## Accepted validation evidence

Implementation identity:

- head: `5e99b940ac81a78d4b129d405379a027aad489b7`;
- tree: `100843c8eac51dc1bc676a20b170fbd31abbe759`;
- base: `master@994d93b07a2bc3434977de1e16bd1e29b2585983`;
- base drift: none at audit time.

Focused/local evidence reported for this head:

- `cargo fmt -- --check`: PASS;
- `native_preview`: 45 passed;
- `host_provided`: 16 passed;
- `file_workspace::read_gate`: 28 passed;
- `file_workspace::integration`: 42 passed / 14 ignored;
- `scheduler`: 28 passed;
- full Rust verification: 919 passed / 23 ignored;
- Clippy all-targets/all-features `-D warnings`: PASS;
- TypeScript/Vitest/remediation/performance-architecture/build/security gates: PASS.

Hosted CI run `32844897985` is bound to the exact implementation head and completed **SUCCESS**.

Accepted hosted lanes include:

- source checkout / governance: PASS;
- change scope / routing: PASS;
- macOS Rust tests/Clippy/race validation: PASS;
- Windows Rust tests/Clippy/native filesystem hardening smoke: PASS;
- macOS and Windows release compile: PASS;
- Native macOS performance: PASS;
- Preview Platform performance: PASS;
- Workspace Foundation performance: PASS;
- Performance profile: PASS;
- macOS Quality aggregate: PASS;
- Windows Quality aggregate: PASS.

## Independent audit record

W4-01 did not close on early green CI.

Multiple independent ChatGPT exact-head audit rounds identified and closed lifecycle, cancellation, publication-race, capacity, deterministic-test, native-resource-drop, staging-lifetime, scheduler-admission and staging-root safety issues.

Final implementation review `#5019582519` on `5e99b940ac81a78d4b129d405379a027aad489b7` records:

**PASS — code/test blockers = 0.**

The audit also rechecked scheduler regressions, W3 native host policy, source ownership, renderer/API scope, runtime lifecycle ordering and first-run app-data-parent behavior.

## Remaining gates before W4-01 closes

Implementation is accepted, but W4-01 is not yet merged/closed.

Remaining gates are:

1. this documentation-only synchronization produces the final PR head/tree;
2. repository CI must pass on that exact final PR tree;
3. master/base must remain the W4-00 baseline without unexpected drift;
4. final changed-file scope must remain W4-01-only;
5. PR #143 may be marked Ready and squash-merged only with an expected-head guard;
6. after the real merge SHA exists, canonical STATUS / ROADMAP / W4 initiative must receive a separate docs-only governance closeout;
7. only after that governance closeout may W4-02 and W4-03 become dependency-unblocked.

No Codex Review result is required or used as acceptance evidence.

## W4-02 / W4-03 boundary

W4-02 must later bind actual macOS native presentation/view lifetime to the accepted Native Preview Access lifecycle without exposing original source paths.

W4-03 must later adapt Explorer/COM request sources into the accepted HostProvided lifecycle while preserving shell isolation and `Unload` cleanup.

W4-01 does not authorize either platform implementation before its merge/governance closeout.

W5 remains inactive.
