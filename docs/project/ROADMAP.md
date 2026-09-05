# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate later work merely because an earlier Track completes. Long-horizon product direction remains owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-09-06

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

**COMPLETE / CLOSED.** W5 established technical release qualification and packaging readiness. Historical W5-04 native/manual release-path evidence remains explicitly unverified.

### W6-01 — Product Maturity Audit

**COMPLETE.** [W6-01 result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md) concluded **PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**.

### W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.** [W6-02 result](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

### W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE / MERGED.** [W6-03 result](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

### W6-04 — File Library Calm-Surface Review / Bounded Remediation

**COMPLETE / CLOSED.**

Production remediation squash merge: `master@02d0f9712e41a374d91832c6061f0a78770c8c36` (#195).

Native evidence archive squash merge: `master@ee1163fbf32f23cc95150adca4e1cb5a53081654`; tree `57dc0ac45810477c8477542512c3c65a60605fb9` (#196).

Focused native result: previous Filter popover P2 closed; P0=0, P1=0, P2 open=0. Native above-placement remains `UNVERIFIED`.

Evidence errata records that the original full review exercised single selection only; native multi-selection was `UNVERIFIED` in W6-04 and was carried into W6-05, where W6-05 directly exercised multi-selection as `PASS`.

Evidence:

- [Rendered Review Result](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md)
- [Filter Popover Revalidation Result](tasks/W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md)
- [Rendered Review Errata](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ERRATA.md)
- [Calm-Surface Closeout Result](tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md)

### W6-05 — Whole-Product Native Experience Audit

**COMPLETE / CLOSED.**

Accepted result/evidence squash merge: `master@507253589c2bbc9924f643ddd38456e2716138dd` (#199).

Final product audit outcome: **DEGRADED**.

Final matrix: `PASS 45 / FAIL 6 / DEGRADED 7 / UNVERIFIED 22 / total 80`.

Finding severity: `P0=0 / P1=0 / P2=5 / P3=0`.

Final retained evidence ZIP SHA-256: `0659F2BAEF45666D9380C623B179B9513D5643281B21B0B0411824D2EC0EFDA3`.

The evidence contract was repaired without rerunning the product audit: 62 valid native JPEG screenshots are retained, one invalid 13×13 capture was removed, and omitted required states are explicitly recorded as `UNVERIFIED` rather than inferred as PASS.

Evidence and closeout:

- [W6-05 audit result](tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md)
- [W6-05 closeout result](tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CLOSEOUT-RESULT.md)

Final decision: **W6-05 COMPLETE — PROCEED TO W6-06 DESIGN**.

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — W6-06 design/specification only**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

#### Current Track — W6-06 Zen Visual System & UX Redesign

**ACTIVE — design/specification only; production implementation not authorized.**

Activation baseline: `master@507253589c2bbc9924f643ddd38456e2716138dd`.

Authority: [W6-06 activation](tasks/W6-06-ZEN-VISUAL-SYSTEM-UX-REDESIGN-ACTIVATION.md).

W6-06 uses the accepted W6-05 native screenshots/findings to define one coherent Zen Canvas visual language and representative target experiences before broad reconstruction.

Required work includes:

- evidence synthesis from W6-05;
- visual principles and design tokens;
- shell/navigation and cross-product state grammar;
- cross-surface coherence and craftsmanship audit;
- one canonical UI grammar with explicit token, metric and primitive authority before page reconstruction;
- representative target experiences for Overview, File Library, Quick Preview and Settings;
- wide/medium/narrow, Light/Dark and Chinese/English guidance;
- keyboard/focus/accessibility design guidance without claiming certification;
- W6-07 implementation handoff;
- W6-08 Preview handoff.

The merged [coherence amendment](tasks/W6-06-COHERENCE-CRAFTSMANSHIP-AMENDMENT.md) supersedes the earlier mandatory three-theme method. The bounded [coherence audit result](tasks/W6-06-UI-COHERENCE-CRAFTSMANSHIP-AUDIT-RESULT.md) prepares unified-system design only; it does not close W6-06 or authorize new page designs in the audit task. Representative targets and quality-bar acceptance remain later W6-06 work.

W6-06 must not modify `src/` or `src-tauri/`, perform broad production reconstruction, create another Preview architecture, weaken safety/AI authority boundaries, change release/version state or silently activate W6-07.

Native QA remains a **stage-level gate**, not a per-task gate. W6-05 remains the current whole-product native evidence baseline; broad native regression belongs to W6-09 after redesign/reconstruction.

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No tag or GitHub Release may be created while this deferral is active.

## Planned maturity sequence after W6-06

Each later Track requires a separate activation.

### W6-07 — Core Experience Reconstruction

Stage presentation-layer reconstruction across the shell and major workflows while preserving proven backend/durable authority contracts.

The working rule is: **preserve the engine, rebuild the cockpit.**

### W6-08 — Cross-Platform Quick Preview Experience

Improve the existing first-party Preview experience, especially the material Windows/macOS experience gap. Windows work should build on existing `ZenFloatingQuickPreview` / Preview Core rather than introduce a second Preview architecture. Explorer Preview Handler remains system-integration bonus capability, not the flagship Zen preview experience.

### W6-09 — Whole-Product Native Regression

After the redesign/reconstruction batch, perform a coherent stage-level native regression rather than native verification after every small PR.

### W6-10 — Release Re-entry

Only after product-owner maturity acceptance: fresh exact candidate, release qualification, installer/SmartScreen/Gatekeeper/Explorer Preview Handler/release-path evidence and a new publication decision.

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
