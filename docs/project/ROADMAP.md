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

Status: **ACTIVE — implementation; W5-01 complete; W5-02 next**

W5 activation merged at `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

#### W5-01 — Release Baseline & Gap Audit

**COMPLETE / CLOSED after this audit merges.** The [W5-01 result](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md) found that release readiness is currently blocked by release qualification/artifact freshness rather than by a known runtime/data-loss defect.

Key findings:

- `release-build.yml` accepts any successful ordinary exact-SHA `CI` run instead of requiring explicit full release validation;
- ordinary CI intentionally supports docs-only/proportional validation, so green ordinary CI is not sufficient release evidence;
- TD-014 exact-head validation passed release compile, Rust/native and performance lanes, but current NSIS/unsigned-DMG packaging did not run;
- W4's no-production-signing decision remains authoritative; signing/notarization is not silently reopened;
- no updater/update-channel capability exists yet;
- selected SmartScreen/Gatekeeper/native accessibility/display/provider/cross-version facts remain manual, unverified or deferred evidence rather than hidden defects.

#### W5-02 — Release Qualification & Publication Safety Gate

**AUTHORIZED / NEXT — implementation.** W5-02 must make release qualification fail closed on exact-SHA full release validation, obtain current supported-platform package evidence, preserve checksums/SBOM/version/provenance controls and retain the intentional unsigned product decision. It must not create a tag or GitHub Release.

Authority: [W5-02 brief](tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-CODEX.md).

## Evidence-derived downstream sequencing

The W5-01 audit proposes, but does not pre-complete, the following bounded sequence:

```text
W5-01  Release Baseline & Gap Audit                         COMPLETE / CLOSED
  ↓
W5-02  Release Qualification & Publication Safety Gate       NEXT / AUTHORIZED
  ↓
W5-03  Distribution / Update Strategy                       LATER
  ↓
W5-04  Supported-Platform Manual Release Acceptance          LATER
  ↓
W5-05  Long-session / Performance Release Evidence           ONLY IF CURRENT EVIDENCE REQUIRES IT
  ↓
W5-06  Release Candidate / Publication Decision              LATER REVIEW
```

Only W5-02 is currently authorized for implementation. Later Tracks require their own reviewed activation/current-truth transition.

## Sequencing rule

W5 is the single active initiative in implementation phase. Release/tag/publication state does not change merely because an installer can be built or because W5 is active. A public release requires exact release-qualified evidence plus a later explicit publication decision.
