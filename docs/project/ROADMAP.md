# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate later work merely because an earlier Track completes. Long-horizon product direction and Wave boundaries remain owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-09-05

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

Status: **ACTIVE — decision; W5-01/W5-02/W5-03 complete; W5-04 explicitly deferred/closed; W5-05 skipped; W5-06 current**

W5 activation merged at `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

#### W5-01 — Release Baseline & Gap Audit

**COMPLETE / CLOSED.** The [W5-01 result](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md) found that release readiness was blocked first by release qualification/artifact freshness rather than by a known runtime/data-loss defect.

#### W5-02 — Release Qualification & Publication Safety Gate

**COMPLETE / CLOSED.** Accepted implementation: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`. The [W5-02 result](tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md) records exact-SHA release qualification and fresh supported-platform package evidence.

#### W5-03 — Distribution / Update Strategy

**COMPLETE / CLOSED.** The [W5-03 result](tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md) selects manual first-release distribution through GitHub Releases + versioned Windows NSIS/macOS DMG, with no in-app updater/key/endpoint/manifest.

#### W5-04 — Supported-Platform Manual Release Acceptance

**CLOSED BY EXPLICIT PRODUCT DEFERRAL — MANUAL NATIVE GUI ACCEPTANCE UNVERIFIED.** Result: [W5-04 result](tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md).

The exact candidate `master@5f6dcc643bec099e3b011af97c046ebc53d2772a` / tree `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f` has successful automated release evidence:

- `CI Full Validation` run `33890392142`: **SUCCESS**;
- `Build Release Installers` run `33893501841`: **SUCCESS**;
- Windows artifact `Zen-Canvas-Windows`, id `9945343182`;
- macOS artifact `Zen-Canvas-macOS`, id `9945180370`.

The available Computer Use environment exposes browser only (`apps: []`) and cannot truthfully exercise native Windows/macOS app surfaces. Therefore SmartScreen/Unknown Publisher, Gatekeeper/quarantine, real native install/copy/first-launch, Narrator/VoiceOver, Explorer Preview Handler focus and native display smoke remain `UNVERIFIED`. This is an accepted deferral, not a PASS.

#### W5-05 — Long-session / Performance Release Evidence

**NOT REQUIRED / SKIPPED FOR THE CURRENT DECISION PASS.** No W5-04 observation or current automated evidence produces a material new long-session/performance trigger. The historical W1 Scheduler pressure `TARGET MISSED` remains truthful and is not rewritten as PASS.

#### W5-06 — Release Candidate / Publication Decision

**AUTHORIZED / CURRENT — DECISION ONLY / NO AUTO-PUBLISH.** Authority: [W5-06 task](tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-CODEX.md).

W5-06 must choose explicitly between:

- holding publication until real supported-host manual acceptance is available; or
- accepting the residual manual-acceptance risk and authorizing publication with that gap stated truthfully.

It may not describe W5-04 as PASS and does not automatically create a tag or GitHub Release.

## Evidence-derived downstream sequencing

```text
W5-01  Release Baseline & Gap Audit                         COMPLETE / CLOSED
  ↓
W5-02  Release Qualification & Publication Safety Gate      COMPLETE / CLOSED
  ↓
W5-03  Distribution / Update Strategy                       COMPLETE / CLOSED
  ↓
W5-04  Supported-Platform Manual Release Acceptance         CLOSED — EXPLICIT DEFERRAL / UNVERIFIED
  ↓
W5-05  Long-session / Performance Release Evidence          SKIPPED — NO EVIDENCE-DERIVED TRIGGER
  ↓
W5-06  Release Candidate / Publication Decision             ACTIVE — EXPLICIT DECISION
```

## Sequencing rule

W5 is the single active initiative. W5-06 is the only current Track. Publication remains an explicit product decision and must preserve the W5-04 manual-acceptance gap as residual risk.

Release/tag/publication state remains none.
