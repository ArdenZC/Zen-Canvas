# W4-01 — Shared Native Host Bridge — Current-Truth Closeout

Recorded: 2026-08-25

Status: **COMPLETE / CLOSED — MERGED / GOVERNED**

W4-00 baseline:

`master@994d93b07a2bc3434977de1e16bd1e29b2585983` (PR #142)

W4-01 production merge:

`master@02e88db7cf4287e0d68792b3960da503b70d6c56`

tree:

`135c7a30626915bdffb0e1c4e6ca4f09734c5c9f`

PR: #143 — `W4-01: add shared native host bridge and source lifecycles`

Final PR head before squash merge:

`eca7a10a073b9f2728888cfd5ff3ff47ab6228bf`

Final independently accepted implementation head:

`5e99b940ac81a78d4b129d405379a027aad489b7`

Accepted implementation tree:

`100843c8eac51dc1bc676a20b170fbd31abbe759`

Independent exact-head review-of-record:

`#5019582519` — **PASS / blockers = 0**

Implementation exact-head hosted CI:

`32844897985` — **SUCCESS**

Final PR-tree hosted CI:

`32855283296` — **SUCCESS** on exact final PR head after a same-head failed-job rerun; no production code, threshold or benchmark rule changed between attempts.

## Initiative truth after closeout

W4 — Native Integration remains **ACTIVE**. W4 itself is not closed by W4-01.

W4-01 — Shared Native Host Bridge + HostProvided Source Contract is now **COMPLETE / CLOSED**.

The accepted dependency transition is:

- W4-02 — macOS Native Quick Look Host / Strong-native Format Integration: **AUTHORIZED / NEXT**;
- W4-03 — Windows Preview Handler Architecture + Lifecycle Spike: **AUTHORIZED / NEXT**;
- W4-02 and W4-03 may proceed in parallel;
- W4-04 — Windows Explorer Preview Handler Production Integration remains dependency-gated behind an accepted W4-03 result;
- W4-05+ remain downstream-gated by the existing W4 dependency graph;
- W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE**.

No later Track inherits authority merely from this closeout beyond those explicit dependency transitions.

## Review-authority rule

Codex is used as an implementation agent for code/test changes only.

**Codex Review is not an acceptance or merge authority for Zen.**

Code acceptance is owned by independent ChatGPT exact-head audit plus exact-head repository CI. Automated/external review comments may provide leads, but they remain advisory until ChatGPT independently verifies them against the exact code, tests and frozen contracts.

This rule supersedes older W4-00/W4-01 taskbook wording that names a final Codex review as a Definition-of-Done or merge gate. Those lines are historical workflow text, not current authorization.

The accepted W4-01 flow was:

```text
Codex implementation
→ exact-head hosted CI
→ independent ChatGPT exact-head code audit
→ blockers = 0
→ final PR-tree CI
→ expected-head squash merge
→ docs-only governance closeout
```

PR #143 was squash-merged only after the exact final PR head was fixed, final-tree CI was successful, master had not drifted, changed-file scope remained W4-01-only and the expected-head guard matched.

## Accepted W4-01 architecture

### Zen-owned Native Preview Access

The merged implementation:

- retains Managed/Ephemeral source identity;
- retains `ZenFloating` / `ZenPinned` host identity;
- keeps `MaterializationReadGate` as byte/open authority;
- performs one authoritative identity-checked open for complete staging;
- keeps the source path/File/handle inside ReadGate;
- revalidates fresh sourceVersion after copy and current request authority at commit;
- publishes only an opaque request/session/sourceVersion/host-bound native-access token;
- cleans partial, cancelled, stale, timed-out, expired and revoked staging;
- bounds acquisition duration, staging TTL, per-file bytes, total bytes, record count and chunk size;
- reuses the existing process-wide `WorkScheduler` for Native Preview admission.

Accepted acquisition path:

```text
source + expected sourceVersion
→ fresh ReadGate eligibility / identity validation
→ exact sourceVersion check
→ shared WorkScheduler Interactive admission
→ one authoritative identity-checked open
→ bounded complete copy through that same open
→ private app-owned non-symlink staged snapshot
→ fresh current sourceVersion revalidation
→ current-authority commit
→ opaque host/request/sourceVersion-bound native access token
```

Native Preview Access is disposable native-presentation state, not a second eligibility/read/materialization authority.

### Shell-owned HostProvided

`HostProvided` remains OS/shell-request-owned only. The merged registry:

- stays separate from Managed/Ephemeral identity and `WorkspacePreviewResolver`;
- issues opaque process-local host tokens;
- binds exact shell host + generation + request-scoped source;
- enforces bounded reads and TTL;
- propagates revoke/cancellation to in-flight reads;
- revalidates host/generation/cancellation/expiry after read;
- detaches native source records under the registry mutex and destroys them only after the mutex is released.

The first intended consumer is W4-03. W4-01 itself does not implement COM, `IStream`, Preview Pane UI or registration.

## Final remediation closure

The final independent audit confirmed closure of all accepted W4-01 code/test blockers, including the last three P2 findings.

### ReadGate lease lifetime vs Native acquisition — CLOSED

Authoritative ReadGate default lease TTL remains 30 seconds. Native Preview Access default acquisition is 20 seconds, and registry construction rejects a configured acquisition duration that is not strictly covered by `MaterializationReadGate::lease_ttl()`.

General Preview/Thumbnail lease policy was not extended or forked.

### Shared WorkScheduler NativePreview admission — CLOSED

Native Preview staging reuses the existing process-wide `WorkScheduler` through bounded `Interactive` admission with:

```text
native_preview = 1
io             = 1
open_handles   = 2
```

The scheduler lease is RAII-owned across staging. Queue waiting is deadline-bounded, cancellation/revoke propagates through admission/lifetime, and deterministic tests prove resources return to baseline.

No second scheduler or native-preview semaphore exists.

### Staging-root symlink/reparse safety — CLOSED

Native staging-root initialization uses no-follow metadata and rejects final-root symlinks, Windows reparse-like roots and non-directory roots before permission changes or abandoned cleanup.

Cleanup removes only verified real `.native-preview-*` directories inside verified Zen-owned staging state.

Focused tests cover non-directory roots, Unix symlink target preservation and Windows reparse classification.

## Runtime / lifecycle result

`RuntimeInner` composes Native Preview Access and HostProvided as bounded process-local owners while preserving existing durable authorities.

Production supplies an explicit app-data native staging root. No renderer-facing raw staging path, native handle or HostProvided registration/read Tauri command was added.

Preview cancel/dispose/source-switch and Ephemeral Browse teardown revoke Native Preview Access after PreviewSession authority invalidation and before underlying resource cleanup. Runtime dispose revokes Preview/native request capability before releasing ReadGate/Browse resources.

Deterministic integration evidence covers runtime disposal racing an in-flight multi-chunk staging copy and returns native records/inflight/staged roots/ReadGate leases to baseline.

## Security / architecture invariants preserved

The merged W4-01 implementation does **not**:

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
- implement W4-02 macOS native presentation UI;
- implement W4-03 Windows COM Preview Handler;
- modify installer/file-association/signing scope;
- activate W5.

## Accepted validation evidence

Focused/local evidence for accepted implementation head `5e99b940…` included:

- `cargo fmt -- --check`: PASS;
- `native_preview`: 45 passed;
- `host_provided`: 16 passed;
- `file_workspace::read_gate`: 28 passed;
- `file_workspace::integration`: 42 passed / 14 ignored;
- `scheduler`: 28 passed;
- full Rust verification: 919 passed / 23 ignored;
- Clippy all-targets/all-features `-D warnings`: PASS;
- TypeScript/Vitest/remediation/performance-architecture/build/security gates: PASS.

Hosted implementation CI `32844897985` completed **SUCCESS**.

The final documentation-synchronized PR head `eca7a10a…` then ran CI `32855283296`. Its first Workspace Foundation attempt hit the existing Windows `PrivateUsage` strict-monotonic detector with all internal registries, handles and RSS lifecycle state otherwise settled. Independent comparison showed the same prepared binary/build identity had already passed under the same runner image and the difference was hosted allocator/sample trajectory, not a code/tree change.

The workflow's failed jobs were rerun on the **same exact PR head** with no code change and no performance-threshold relaxation. Workspace Foundation, Performance profile, macOS Quality and Windows Quality all completed **SUCCESS**, and the overall final PR-tree run concluded **SUCCESS**.

## Independent audit record

W4-01 did not close merely because CI was green.

Multiple independent ChatGPT exact-head audit rounds identified and closed lifecycle, cancellation, publication-race, capacity, deterministic-test, native-resource-drop, staging-lifetime, scheduler-admission and staging-root-safety issues.

Final implementation review `#5019582519` on `5e99b940ac81a78d4b129d405379a027aad489b7` records:

**PASS — code/test blockers = 0.**

The final audit also rechecked scheduler regressions, W3 native-host policy, source ownership, renderer/API scope, runtime lifecycle ordering and first-run app-data-parent behavior.

## Production merge record

PR #143 was marked Ready only because GitHub refuses to merge a Draft PR. No new review was requested or awaited; Ready was a mechanical GitHub state transition after all independent acceptance gates were already satisfied.

Expected-head squash merge succeeded with:

```text
expected head: eca7a10a073b9f2728888cfd5ff3ff47ab6228bf
merge SHA:    02e88db7cf4287e0d68792b3960da503b70d6c56
merge tree:   135c7a30626915bdffb0e1c4e6ca4f09734c5c9f
```

`master` therefore contains the accepted W4-01 production result and W4-01 is **COMPLETE / CLOSED**.

## W4-02 / W4-03 boundary

W4-02 must bind actual macOS native presentation/view lifetime to the accepted Native Preview Access lifecycle without exposing original source paths. Its format activation and staging budgets remain W4-02-owned work.

W4-03 must adapt Explorer/COM request sources into the accepted HostProvided lifecycle while preserving shell isolation, `IInitializeWithStream`-style request ownership and `Unload` cleanup. It remains a bounded architecture/lifecycle spike before W4-04 production integration.

W4-02 and W4-03 are now dependency-unblocked and may proceed in parallel. W4-04 remains gated behind W4-03. W5 remains inactive.
