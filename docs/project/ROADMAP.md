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

Status: **ACTIVE — implementation; W5-01/W5-02/W5-03 complete; W5-04 active — manual real-platform acceptance**

W5 activation merged at `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

#### W5-01 — Release Baseline & Gap Audit

**COMPLETE / CLOSED.** The [W5-01 result](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md) found that release readiness was blocked first by release qualification/artifact freshness rather than by a known runtime/data-loss defect.

#### W5-02 — Release Qualification & Publication Safety Gate

**COMPLETE / CLOSED.** Accepted implementation: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`. The [W5-02 result](tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md) records exact-SHA release qualification and fresh supported-platform package evidence.

#### W5-03 — Distribution / Update Strategy

**COMPLETE / CLOSED.** The [W5-03 result](tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md) selects manual first-release distribution through GitHub Releases + versioned Windows NSIS/macOS DMG, with no in-app updater/key/endpoint/manifest.

#### W5-04 — Supported-Platform Manual Release Acceptance

**ACTIVE — MANUAL / REAL-PLATFORM EVIDENCE.** Authority: [W5-04 task](tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-CODEX.md).

W5-04 must establish the actual first-release user path rather than infer it from package success:

- Windows Tier A: real unsigned x64 NSIS acquisition/install/first-launch warning path, launch sanity and uninstall sanity;
- macOS Tier A: real Apple-Silicon DMG acquisition/quarantine/mount/copy/first-launch Gatekeeper path, launch sanity and cleanup;
- Tier B: bounded genuine focus/keyboard/screen-reader/display smoke on supported hosts where available;
- Tier C: iCloud/File Provider/external APFS/exFAT/SMB/network/multi-display/cross-version evidence only with genuine fixtures; unavailable fixtures remain `UNVERIFIED`.

W5-04 does not authorize signing/notarization, updater work, version bumps, tags or releases.

## Evidence-derived downstream sequencing

```text
W5-01  Release Baseline & Gap Audit                         COMPLETE / CLOSED
  ↓
W5-02  Release Qualification & Publication Safety Gate      COMPLETE / CLOSED
  ↓
W5-03  Distribution / Update Strategy                       COMPLETE / CLOSED
  ↓
W5-04  Supported-Platform Manual Release Acceptance         ACTIVE — REAL-PLATFORM EVIDENCE
  ↓
W5-05  Long-session / Performance Release Evidence          ONLY IF W5-04/CURRENT EVIDENCE REQUIRES IT
  ↓
W5-06  Release Candidate / Publication Decision             LATER REVIEW
```

## Sequencing rule

W5 is the single active initiative. W5-04 is the only current Track. W5-05 remains conditional and may be skipped if current evidence shows no material additional performance/long-session obligation. W5-06 remains a later explicit publication decision.

Release/tag/publication state remains none.
