# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate later work merely because an earlier Track completes. Long-horizon product direction remains owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

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

**COMPLETE / CLOSED.** Accepted implementation baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`.

### W5 — Release / Hardening

**COMPLETE / CLOSED.** W5 established technical release qualification and packaging readiness. Its historical release-qualified candidate remains historical evidence only; W5-04 manual/native evidence remains explicitly unverified.

### W6-01 — Product Maturity Audit

**COMPLETE.** [W6-01 result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md) concluded **PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**.

### W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.** [W6-02 result](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

### W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE / MERGED.** [W6-03 result](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — implementation; W6-04 bounded remediation validated, merge/closeout pending**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current implementation authority: [W6-04 Bounded Implementation Activation](tasks/W6-04-FILE-LIBRARY-BOUNDED-IMPLEMENTATION-ACTIVATION.md).

Current closeout candidate: [W6-04 Calm-Surface Closeout Result](tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md).

## W6-04 — File Library Calm-Surface Polish

### Phase A — fresh rendered review

**COMPLETE.**

Real Windows/Tauri review found no P0/P1 and one P2: at `1282×862`, the File Library Filter popover was substantially occluded and not reliably operable.

Evidence branch: `docs/w6-04-file-library-rendered-review-result`.

Original result commit: `1aab5bb414ccbf94fc1afd9760072153fb2331da`.

Decision: **ACTIVATE BOUNDED W6-04 IMPLEMENTATION**.

### Phase B — bounded implementation

**IMPLEMENTATION VALIDATED — merge/closeout pending.**

Candidate: `1aab52bb63f6c16e28ea9880c4a4afe52594c0c8`; tree `73f2868aef6e2bd03d44104866652f9c88056d13`.

CI `33959447388`: **SUCCESS** across frontend/browser/routed Library & Content performance and final platform-quality aggregation.

Focused native revalidation commit `4c6075a1dd1f3c7e5bfe4c86324a23be16150287` observed:

- `1282×862` geometry/occlusion: PASS;
- focus containment/restore: PASS;
- real File Type filter application: PASS (`1/1` → Clear `9/9`);
- narrow-window smoke: PASS;
- native above-placement observation: UNVERIFIED;
- P0=0, P1=0, P2 open=0.

Final native decision: **PASS — W6-04 P2 CLOSED / NO FURTHER W6-04 IMPLEMENTATION REQUIRED**.

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No tag or GitHub Release may be created while this deferral is active.

## Re-planned maturity sequencing after W6-04

The product owner has explicitly determined that Zen Canvas is still visually and experientially immature at the whole-product level and that substantial functionality remains insufficiently exercised in real use.

Native QA is therefore a **stage-level gate**, not a per-task requirement.

The next maturity program is intended to proceed as follows, each through separate activation:

### W6-05 — Whole-Product Native Experience Audit

**NEXT PRIORITY — NOT YET ACTIVE.**

Evidence-first audit across major user journeys and important empty/loading/error/recovery states. The purpose is to discover actual product/UX defects and untested functionality before redesign, not to run a release installer matrix.

### W6-06 — Zen Visual System & UX Redesign

Define a coherent visual language and target experience for representative surfaces before broad implementation. Avoid piecemeal Tailwind-only cosmetic patches.

### W6-07 — Core Experience Reconstruction

Stage presentation-layer changes across the shell and major workflows while preserving proven backend/durable authority contracts.

### W6-08 — Cross-Platform Quick Preview Experience

Improve the existing first-party Preview experience, especially the material Windows/macOS experience gap. Windows work should build on existing `ZenFloatingQuickPreview` / Preview Core rather than introduce a second Preview architecture. Explorer Preview Handler remains system-integration bonus capability, not the flagship Zen preview experience.

### W6-09 — Whole-Product Native Regression

After the redesign batch, perform a coherent stage-level native regression rather than per-task native testing.

### W6-10 — Release Re-entry

Only after product-owner maturity acceptance: fresh exact candidate, installer/SmartScreen/Gatekeeper/Explorer Preview Handler/release-path evidence and a new publication decision.

## Explicit non-goals for maturity work

Do not solve maturity by adding:

- updater infrastructure;
- signing/notarization solely for perceived completeness;
- OCR/RAG/plugin/agent breadth;
- another Preview engine;
- another AI feature;
- new durable authorities;
- weaker AI consent or credential gates.

The objective is to make the existing product coherent, attractive, understandable and trustworthy while preserving the engineering strengths already built.
