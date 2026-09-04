# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate later work merely because an earlier Track completes. Long-horizon product direction and Wave boundaries remain owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-09-04

## Completed

### G1 — Engineering OS

**COMPLETE.** Project-state, architecture-ownership, technical-debt, workflow and closeout rules are durable.

### M1 / M1.1 — Mutation correctness and portability closeout

**COMPLETE.** Mutation correctness, provider and portability remediation are closed at their reviewed baselines.

### W0 — File Library / Preview specification

**COMPLETE.** W0 froze the Library/Browse product model, identity contracts, Preview Core/Host boundaries, Read/Materialization and WorkScheduler ownership, performance gates and Wave sequencing.

### W1 — File Library / Preview Foundation

**COMPLETE.** W1 delivered the shared runtime foundation used by later Waves.

### W2 — File Library 2.0 Experience

**COMPLETE / CLOSED.** Authority and final closeout evidence: [W2 initiative](initiatives/W2-file-library-experience.md) and [W2-12 closeout](tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md).

### W3 — Preview Platform

**COMPLETE / CLOSED.** Authority and final remediation pointers: [W3 initiative](initiatives/W3-preview-platform.md), [W3-11 closeout](tasks/W3-11-PREVIEW-PLATFORM-CLOSEOUT-CODEX.md) and [W3-R1 remediation](tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md).

### W4 — Native Integration

**COMPLETE / CLOSED.** W4 added the accepted Zen-internal macOS native Quick Look-backed path and Windows Explorer Preview Handler boundary. Final closeout: [W4 final current truth](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

### TD-014 — Cleanup Ledger Physical Identity Normalization

**COMPLETE / CLOSED.** Accepted implementation baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`. Final evidence: [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md).

## Current

### W5 — Release / Hardening

Status: **ACTIVE — implementation; W5-01 and W5-02 complete; W5-03 next / eligible, not yet active**

W5 activation merged at `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

#### W5-01 — Release Baseline & Gap Audit

**COMPLETE / CLOSED.** The [W5-01 result](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md) found that release readiness was blocked first by release qualification/artifact freshness rather than by a known runtime/data-loss defect.

#### W5-02 — Release Qualification & Publication Safety Gate

**COMPLETE / CLOSED.** Accepted implementation: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.

The [W5-02 result](tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md) closes both W5-01 release blockers:

- a future publication now requires successful exact-SHA `CI Full Validation` plus successful required source/platform/package/dependency jobs; ordinary docs-only/proportional CI cannot qualify a release;
- the accepted W5-02 tree has fresh Windows x64 NSIS and Apple-Silicon unsigned-DMG package evidence from CI `33880988509`;
- the PR head, package merge-integration commit and final squash merge share tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`;
- release/tag state remains none;
- Authenticode, Developer ID, notarization and stapling remain intentionally deferred/not provided by product decision.

#### W5-03 — Distribution / Update Strategy

**NEXT / ELIGIBLE — NOT YET ACTIVE.** W5-03 must make one explicit bounded product/engineering decision: first-release manual-download/update lifecycle versus a separately reviewed updater/update-channel implementation. It must not be treated as active until its own reviewed scope/transition is recorded.

## Evidence-derived downstream sequencing

```text
W5-01  Release Baseline & Gap Audit                         COMPLETE / CLOSED
  ↓
W5-02  Release Qualification & Publication Safety Gate      COMPLETE / CLOSED
  ↓
W5-03  Distribution / Update Strategy                       NEXT / ELIGIBLE — NOT YET ACTIVE
  ↓
W5-04  Supported-Platform Manual Release Acceptance         LATER
  ↓
W5-05  Long-session / Performance Release Evidence          ONLY IF CURRENT EVIDENCE REQUIRES IT
  ↓
W5-06  Release Candidate / Publication Decision             LATER REVIEW
```

W5-03 is the next eligible Track. It requires a separate reviewed activation/current-truth transition before implementation. W5-04 through W5-06 remain later Tracks and are not silently activated.

## Sequencing rule

W5 is the single active initiative in implementation phase. Release/tag/publication state does not change merely because installer artifacts have been validated or because W5-02 is closed. A public release still requires the remaining W5 decisions/evidence and a later explicit publication decision.
