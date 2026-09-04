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

Status: **ACTIVE — implementation; W5-01/W5-02/W5-03 complete; W5-04 next / eligible, not yet active**

W5 activation merged at `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

#### W5-01 — Release Baseline & Gap Audit

**COMPLETE / CLOSED.** The [W5-01 result](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md) found that release readiness was blocked first by release qualification/artifact freshness rather than by a known runtime/data-loss defect.

#### W5-02 — Release Qualification & Publication Safety Gate

**COMPLETE / CLOSED.** Accepted implementation: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`. The [W5-02 result](tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md) records exact-SHA release qualification and fresh supported-platform package evidence.

#### W5-03 — Distribution / Update Strategy

**COMPLETE / CLOSED.** The [W5-03 result](tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md) selects a manual-download/install first-release policy:

- canonical publication surface after later W5-06 authorization: GitHub Releases;
- Windows: versioned x64 NSIS manual download/install;
- macOS: versioned Apple-Silicon DMG manual download/install;
- no automatic/background update check;
- no in-app updater/download/install;
- no updater key, endpoint or manifest;
- a future updater requires a separate reviewed initiative/Track after concrete product need and a real older-release fixture exist.

The decision preserves the distinction between updater artifact signing and OS code signing; neither an updater trust root nor Authenticode/Developer ID/notarization infrastructure is added by W5-03.

#### W5-04 — Supported-Platform Manual Release Acceptance

**NEXT / ELIGIBLE — NOT YET ACTIVE.** W5-04 must collect truthful real-platform evidence for the manual first-release path: unsigned Windows install/launch warnings, unsigned Apple-Silicon DMG first-launch/Gatekeeper behavior, and the selected native/manual evidence that remains material to release acceptance. It requires its own reviewed activation/current-truth transition.

## Evidence-derived downstream sequencing

```text
W5-01  Release Baseline & Gap Audit                         COMPLETE / CLOSED
  ↓
W5-02  Release Qualification & Publication Safety Gate      COMPLETE / CLOSED
  ↓
W5-03  Distribution / Update Strategy                       COMPLETE / CLOSED
  ↓
W5-04  Supported-Platform Manual Release Acceptance         NEXT / ELIGIBLE — NOT YET ACTIVE
  ↓
W5-05  Long-session / Performance Release Evidence          ONLY IF CURRENT EVIDENCE REQUIRES IT
  ↓
W5-06  Release Candidate / Publication Decision             LATER REVIEW
```

## Sequencing rule

W5 is the single active initiative. W5-04 is the next eligible Track but remains inactive until its own reviewed scope/transition is recorded. W5-05 remains conditional, and W5-06 remains the later explicit publication decision.

Release/tag/publication state remains none.
