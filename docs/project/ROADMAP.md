# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate later work merely because an earlier Track completes. Long-horizon direction remains owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-09-06

## Completed

### G1 — Engineering OS

**COMPLETE.** Project-state, architecture-ownership, technical-debt, workflow and closeout rules are durable.

### M1 / M1.1 — Mutation correctness and portability closeout

**COMPLETE.** Mutation correctness, provider and portability remediation are closed at their reviewed baselines.

### W0 — File Library / Preview specification

**COMPLETE.** W0 froze the Library/Browse product model, identity contracts, Preview Core/Host boundaries, Read/Materialization and WorkScheduler ownership, performance gates and Wave sequencing.

### W1 — File Library / Preview Foundation

**COMPLETE.** Shared runtime foundation delivered.

### W2 — File Library 2.0 Experience

**COMPLETE / CLOSED.** Authority: [W2 initiative](initiatives/W2-file-library-experience.md) and [W2-12 closeout](tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md).

### W3 — Preview Platform

**COMPLETE / CLOSED.** Existing Preview Core/Host remains the authority for later experience work.

### W4 — Native Integration

**COMPLETE / CLOSED.** Final closeout: [W4 final current truth](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

### TD-014 — Cleanup Ledger Physical Identity Normalization

**COMPLETE / CLOSED.**

### W5 — Release / Hardening

**COMPLETE / CLOSED.** Technical release qualification and packaging readiness were established; historical manual/native release-path evidence remains explicitly unverified where recorded.

### W6-01 — Product Maturity Audit

**COMPLETE.** Public release was not recommended; maturity work was required.

### W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.**

### W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE / MERGED.**

### W6-04 — File Library Calm-Surface Review / Bounded Remediation

**COMPLETE / CLOSED.** Production remediation and focused native evidence closed the bounded Filter popover P2 while preserving Query/Library/Browse/Preview authority.

### W6-05 — Whole-Product Native Experience Audit

**COMPLETE / CLOSED.** Accepted result/evidence squash merge: `master@507253589c2bbc9924f643ddd38456e2716138dd` (#199).

Final product audit outcome: **DEGRADED**.

Final matrix: `PASS 45 / FAIL 6 / DEGRADED 7 / UNVERIFIED 22 / total 80`.

Finding severity: `P0=0 / P1=0 / P2=5 / P3=0`.

Final retained evidence ZIP SHA-256: `0659F2BAEF45666D9380C623B179B9513D5643281B21B0B0411824D2EC0EFDA3`.

### W6-06 — Zen Visual System & UX Redesign

**COMPLETE / CLOSED — V26 TARGET DESIGN FROZEN.**

Activation baseline: `master@507253589c2bbc9924f643ddd38456e2716138dd`.

Final owner freeze score: **93.4 / 100**; retained freeze threshold: **92 / 100**.

Final authority:

- [Final Design Freeze Audit](tasks/W6-06-FINAL-DESIGN-FREEZE-AUDIT.md)
- [Design Freeze Closeout Result](tasks/W6-06-DESIGN-FREEZE-CLOSEOUT-RESULT.md)
- [V26 Freeze Manifest](../design/w6-06/07-V26-FREEZE-MANIFEST.md)
- [W6-07 Implementation Handoff](../design/w6-06/07-W6-07-IMPLEMENTATION-HANDOFF.md)

V26 freezes one coherent Zen presentation target, including the single global Files entry, internal Library/Browse Folder modes, centered Search + Commands anchor, independent Selection/Focus/Primary grammar, no underline/bottom-bar/rail/glow focus, Space-to-Quick-Preview, truthful degraded/safety states, and platform-specific Windows/macOS shell treatment.

W6-06 changed no production `src/` / `src-tauri/` implementation and does not itself activate W6-07.

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — specification only; governance transition after W6-06 closeout; W6-07 pending separate activation**.

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

There is currently **no active production reconstruction Track**. This active parent initiative exists only to preserve current-truth continuity between the closed W6-06 design Track and the separately governed W6-07 activation.

W6-07 remains planned but inactive until a separate activation governance change merges.

W6-05 remains the accepted whole-product native evidence baseline. W6-06 browser/prototype acceptance does not convert W6-05 `FAIL`, `DEGRADED` or `UNVERIFIED` observations into PASS.

## Next planned Track — W6-07 Core Experience Reconstruction

**INACTIVE — separate activation required.**

Purpose: stage presentation-layer reconstruction/polish while preserving durable backend, filesystem, Query, Preview, restore and provider authorities.

Working rule:

> **Preserve the engine; rebuild the cockpit.**

The frozen implementation sequence is:

1. tokens / typography / shared primitives / native shell;
2. Files workspace — one global Files entry with Library and Browse Folder internal modes;
3. Inspector + Search + Command Palette;
4. Settings;
5. Organize + Cleanup;
6. Overview + History + Automation;
7. cross-surface consolidation.

W6-07 must not introduce another Preview architecture or reinterpret a presentation rewrite as backend ownership authority.

## Later planned maturity sequence

Each later Track requires its own authority.

### W6-08 — Cross-Platform Quick Preview Experience

Focused improvement of the existing first-party Preview experience using current `ZenFloatingQuickPreview` / Preview Core architecture. Explorer Preview Handler remains supplementary shell integration.

### W6-09 — Whole-Product Native Regression

Coherent supported-platform native regression after the redesign/reconstruction batch, not native certification after every small presentation PR.

### W6-10 — Release Re-entry

Only after product-owner maturity acceptance: freeze a fresh exact candidate, run release qualification and supported-platform release-path evidence, then make a new publication decision.

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No tag or GitHub Release may be created while this deferral is active.

## Explicit non-goals for maturity work

Do not solve maturity by adding updater infrastructure, OCR/RAG/plugin/agent breadth, another Preview engine, another AI feature, new durable authorities, or weaker AI/filesystem safety gates.

The objective is to make the existing product coherent, attractive, understandable and trustworthy while preserving the engineering strengths already built.
