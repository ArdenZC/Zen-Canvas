# W4-01 — Shared Native Host Bridge — Current-Truth Checkpoint

Recorded: 2026-08-25

Status: **REOPENED — CODE REMEDIATION REQUIRED / NOT CLOSEOUT**

Baseline: `master@994d93b07a2bc3434977de1e16bd1e29b2585983` (W4-00 activation / PR #142)

Implementation branch: `feat/w4-shared-native-host-bridge`

PR: #143 — `W4-01: add shared native host bridge and source lifecycles`

Current independently audited PR head before this checkpoint-only update:

`00d673b748f7f3828fca1652955f2fc73b08238c`

This document records branch-local execution truth only. It is **not** a W4-01 closeout record, does not mark W4-01 COMPLETE, and does not authorize W4-02/W4-03.

## Current initiative truth

W4-00 merged through PR #142 at:

`master@994d93b07a2bc3434977de1e16bd1e29b2585983`.

Therefore:

- W4 — Native Integration remains **ACTIVE**;
- W4-01 — Shared Native Host Bridge + HostProvided Source Contract remains the **only authorized production Track**;
- PR #143 is **Open / Draft**;
- W4-02 and W4-03 remain dependency-gated behind a successfully merged and governed W4-01;
- W4-04+ remain downstream-gated;
- W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE**.

Canonical `STATUS.md`, `ROADMAP.md` and the W4 initiative are intentionally not marked W4-01 COMPLETE before a real merge SHA exists.

## Review-authority rule

Codex is used as the implementation agent for code/test remediation only.

**Codex Review is not an acceptance or merge authority for Zen.**

Code acceptance is owned by independent ChatGPT exact-head audit plus exact-head repository CI. Automated/external review comments may provide leads, but they are not accepted as blockers until ChatGPT independently verifies them against the code, tests and frozen contracts.

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

## Previously accepted implementation work

The W4-01 implementation had previously reached an independent PASS on code head:

`12b732f14d1c669879fe6f22823945b0a004f321`

tree:

`29ba0db831739b12fe38bb81a6260d919b199e2d`.

That implementation established the intended two source-ownership lifecycles:

### Zen-owned Native Preview Access

- retains Managed/Ephemeral source identity;
- retains `ZenFloating` / `ZenPinned` host identity;
- keeps `MaterializationReadGate` as byte/open authority;
- performs one authoritative identity-checked open for complete private staging;
- final sourceVersion/current-authority checks gate publication;
- returns only an opaque request/session/sourceVersion/host-bound native-access token;
- cleans partial, cancelled, stale, timed-out and revoked staging.

### Shell-owned HostProvided

- remains OS/shell-request-owned only;
- stays separate from Managed/Ephemeral identity and `WorkspacePreviewResolver`;
- uses opaque process-local host tokens;
- binds host + generation + request-scoped source;
- propagates revoke/cancellation to in-flight reads;
- revalidates host/generation/cancellation/expiry after read;
- drops detached native sources outside the registry coordination mutex.

Runtime lifecycle wiring also exists for Preview cancel/dispose/source-switch, Ephemeral Browse teardown and runtime dispose.

Those architectural results remain valid and are not being redesigned by the current remediation.

## Reopened independent audit — 3 P2 blockers

After the documentation-only checkpoint produced PR head `00d673b748f7f3828fca1652955f2fc73b08238c`, a fresh independent ChatGPT audit re-read the exact production code and W4-01 frozen taskbook. It found three additional P2 blockers.

Independent review-of-record: `#5018273351`.

### P2-1 — Native acquisition duration exceeds authoritative ReadGate lease lifetime

Current defaults are inconsistent:

```text
ReadGate lease TTL                     30 seconds
NativePreviewAccess max acquisition    60 seconds
```

The verified-copy loop checks the ReadGate lease on every chunk. A request can therefore remain valid under Native Preview Access while the authoritative ReadGate lease expires first, producing `LeaseInvalid` during the second half of the advertised staging window.

Required correction must preserve ReadGate authority. Preferred minimal shape is to make Native Preview Access acquisition duration explicitly fit inside the authoritative ReadGate lease lifetime rather than silently extending general renderer leases. Any alternative must remain narrowly scoped to verified-copy authority and be independently reviewed.

### P2-2 — Native staging bypasses global WorkScheduler NativePreview admission

W4-01 freezes `WorkScheduler` as the sole process-wide expensive/native work admission authority and explicitly requires bounded native-preview concurrency.

Current Native Preview Access staging is composed with ReadGate but not the existing global scheduler. Its full filesystem copy can therefore run outside the `NativePreview` capacity even though the scheduler already provides a one-slot native-preview resource class.

Required correction:

- reuse the existing `WorkScheduler`;
- no second semaphore/scheduler;
- stage work must hold a bounded Interactive scheduler lease while expensive staging work runs;
- at minimum request `native_preview=1`, with I/O/open-handle hints reflecting the actual copy resource shape where appropriate;
- cancellation/revoke must propagate into scheduler admission/lease lifetime;
- every success/error/cancel path must release the scheduler lease and return scheduler resources to baseline.

### P2-3 — Native staging root does not fail closed on an existing symlink/reparse-like root

Current root initialization performs `create_dir_all(root)` and then applies private permissions/abandoned cleanup. If the final staging root already exists as a symlink, this can follow the link before ownership is established.

Consequences may include:

- applying permissions to a non-Zen target;
- scanning a non-Zen target for `.native-preview-*` children;
- deleting stale-looking directories outside the intended staging root.

Required correction:

- initialization must verify the final root with no-follow metadata before chmod/cleanup;
- an existing final symlink/reparse-like root must fail closed;
- a valid root must be a real directory;
- Windows reparse/junction behavior must use the repository's existing no-follow/reparse safety conventions where applicable;
- abandoned cleanup must remain bounded to verified Zen-owned staging state.

## Current merge gate

W4-01 is currently **BLOCKED** until Codex remediates only the three independently accepted P2 items above.

After Codex pushes a new implementation head:

1. applicable focused/local tests must pass;
2. new exact-head hosted CI must complete successfully;
3. ChatGPT performs another independent exact-head code audit;
4. the three ChatGPT review threads must be resolved only after code evidence proves closure;
5. final code-review blockers must equal 0;
6. any final documentation-only synchronization must receive its own PR-tree CI;
7. PR #143 may then be marked Ready and merged only with an expected-head guard.

No Codex Review result is required or used as acceptance evidence.

## W4-02 / W4-03 boundary

W4-02 and W4-03 remain blocked.

W4-02 must later bind actual macOS native presentation/view lifetime to the accepted Native Preview Access lifecycle without exposing original source paths.

W4-03 must later adapt Explorer/COM request sources into the accepted HostProvided lifecycle while preserving shell isolation and `Unload` cleanup.

W4-01 does not authorize either platform implementation yet.

W5 remains inactive.
