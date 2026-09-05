# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate later work merely because an earlier Track completes. Long-horizon product direction remains owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md); W6 begins as a specification-only post-W5 maturity audit and does not yet authorize a new production feature wave.

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

**COMPLETE / CLOSED.** Final closeout: [W4 final current truth](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

### TD-014 — Cleanup Ledger Physical Identity Normalization

**COMPLETE / CLOSED.** Accepted implementation baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`.

### W5 — Release / Hardening

**COMPLETE / CLOSED.** W5 established technical release qualification and packaging readiness. Final historical decision: **AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK**. Authority: [W5-06 result](tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md).

Historical W5 release-qualified candidate:

- commit `8b573772d842b4996bc1c34161236fa47025cc83`;
- tree `67cf3da35d7556bb868746a9ae0a56725558a163`;
- version `0.1.40`;
- `CI Full Validation` `33942690517`: **SUCCESS**;
- `Build Release Installers` `33943755887`: **SUCCESS**;
- Windows and Apple-Silicon macOS installers produced with verified checksums;
- exactly two valid CycloneDX 1.6 SBOMs verified.

W5-04 manual/native SmartScreen/Gatekeeper/accessibility/focus/display evidence remains `UNVERIFIED / EXPLICITLY DEFERRED`, not PASS.

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — specification only; W6-01 product maturity audit authorized**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current Track: [W6-01 Product Maturity Audit](tasks/W6-01-PRODUCT-MATURITY-AUDIT-ACTIVATION.md).

Purpose: determine why the current product is not yet mature enough for a public first release, despite W5 technical release readiness, and turn that judgment into a bounded release Must Fix / Simplify / Remove / Defer plan.

W6-01 is audit-only. It does not authorize production code changes.

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) is now:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No `v0.1.40` tag or GitHub Release may be created while W6 publication deferral is active.

The prior W5 candidate remains historical internal release evidence, not current product authorization to publish.

If later W6 work changes production code, a future release candidate must receive fresh exact-SHA Full Validation and release-installer evidence; the old W5 evidence cannot qualify a changed product tree.

## W6-01 required output

W6-01 must produce an evidence-backed maturity result covering:

- north-star fidelity and core workflow coherence;
- first-launch / first-value experience;
- Library/Browse/search/Preview/cleanup/recovery journeys;
- information architecture, discoverability and interaction quality;
- loading/empty/error/permission/offline/provider states;
- visual consistency and product polish;
- settings/lifecycle/support surfaces;
- platform fidelity and missing native evidence;
- perceived performance and background-work feedback;
- trust/privacy/AI/provider communication;
- release/onboarding/update expectations.

Every finding must be classified `M0`, `M1`, `M2` or `M3`, and the result must separate release Must Fix from later opportunities.

## Next sequencing

No implementation Track is pre-authorized.

After W6-01 closes, the project may activate a small number of evidence-derived implementation Tracks. Preference order:

1. core-journey blockers and product-coherence problems;
2. simplification/removal of weak or confusing surfaces;
3. failure-state and trust/recovery maturity;
4. visual/interaction polish with measurable user-flow impact;
5. only then optional feature expansion, if the audit demonstrates it is actually needed.

A future publication decision occurs only after the audit-derived Must Fix set is closed and a new candidate is release-qualified.
