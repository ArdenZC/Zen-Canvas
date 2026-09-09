# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. Long-horizon direction remains owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-09-09

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

Final freeze squash merge / W6-07 activation baseline: `master@6b435dbf49c609a95a4d95935090825f003e7a5d` (#206).

Final owner freeze score: **93.4 / 100**; retained freeze threshold: **92 / 100**.

Final authority:

- [Final Design Freeze Audit](tasks/W6-06-FINAL-DESIGN-FREEZE-AUDIT.md)
- [Design Freeze Closeout Result](tasks/W6-06-DESIGN-FREEZE-CLOSEOUT-RESULT.md)
- [V26 Freeze Manifest](../design/w6-06/07-V26-FREEZE-MANIFEST.md)
- [W6-07 Implementation Handoff](../design/w6-06/07-W6-07-IMPLEMENTATION-HANDOFF.md)

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — implementation; W6-09 NATIVE REGRESSION IN PROGRESS**.

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current Track authority: [Issue #241 — W6-09 Whole-Product Native Regression](https://github.com/ArdenZC/Zen-Canvas/issues/241).

**Current Track: W6-09 — Whole-Product Native Regression**

Status: **ACTIVE — NATIVE REGRESSION IN PROGRESS; W6-08 is COMPLETE through PR #240 and W6-07 is COMPLETE / CLOSED through PR #238.**

Phase 6 — Overview, History/Restore and Automation: **COMPLETE** through PR #234.
Issue #235 / PR #236 completes the docs-only required-reading model cleanup.
W6-08 Cross-Platform Quick Preview Experience: **COMPLETE through PR #240**.
Current implementation task: [Issue #241 — W6-09 Whole-Product Native Regression](https://github.com/ArdenZC/Zen-Canvas/issues/241).
W6-07 Phase 7 cross-surface consolidation merged through PR #238.

W6-08 activation baseline: `master@60d43db7de7f9ac598d0262a237a330ed91530d2`;
tree `d70b52caa51ef1a60ebd016345a8f85e7455df81`.

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

W6-07 Phases 1–7 and W6-08 are complete on the merged baseline. W6-09 is the
active whole-product native regression.

W6-07 may modify `src/` presentation code and only the `src-tauri/` presentation/native-shell integration needed for window chrome or existing presentation seams. It does not authorize a schema migration, new durable backend authority, mutation-safety rewrite, provider ownership change or second Preview architecture.

Fresh implementation checkouts must verify the checksum-bound V26 target before side-by-side review:

```bash
python docs/design/w6-06/07-v26/rebuild-v26.py --verify-only
```

W6-05 remains the accepted whole-product native evidence baseline. W6-07 must not silently convert its `FAIL`, `DEGRADED` or `UNVERIFIED` states into PASS.

## Later planned maturity sequence

Each later Track requires its own authority.

### W6-08 — Cross-Platform Quick Preview Experience

**ACTIVE — Issue #239; implementation on the exact W6-07 merge baseline.**

Focused improvement of the existing first-party Preview experience using current `ZenFloatingQuickPreview` / Preview Core architecture. Explorer Preview Handler remains supplementary shell integration. W6-08 must close or disposition its Preview-specific W6-05 residual before W6-09.

### Residual Product Defect Closure Gate — before W6-09

Before W6-09 starts, each retained W6-05 residual area must have one explicit
owner-reviewed disposition. The gate is a closure/disposition requirement,
not a new remediation Track or an invitation to reopen every historical bug.

| Retained residual area | Required disposition before W6-09 |
| --- | --- |
| Cleanup extended-path rejection | **CLOSED / FIXED** |
| Typed/folder Quick Preview gaps | **ACCEPTED DEFER** — W6-08 implementation and browser/integration evidence close the known presentation/support gap at repository level; exact-head Windows/macOS native Quick Preview UI re-verification is carried into W6-09 Whole-Product Native Regression, where a reproduced Preview defect may receive bounded native correction and re-verification |
| Global Index unavailable/zero-source state | **ACCEPTED DEFER** — exact-head native source/state re-evaluation remains open |
| Organization Plan safe-preview degradation | **ENVIRONMENT-SPECIFIC** — reproduce on supported native fixtures and preserve fail-closed behavior |
| Browse / first-scan recovery friction | **ACCEPTED DEFER** — exact-head native first-launch/restart recovery re-evaluation remains open |

The disposition must link to the evidence and owner decision that supports it;
rediscovery without disposition does not satisfy the gate. The entry
dispositions above are not release waivers. W6-08 is complete through PR #240;
the typed/folder Preview residual remains **ACCEPTED DEFER** for exact-head
native verification: Browser PASS != Native PASS.

### W6-09 — Whole-Product Native Regression

**ACTIVE — NATIVE REGRESSION IN PROGRESS — Issue #241.** Coherent
supported-platform native regression after the redesign/reconstruction and
Preview batch, not native certification after every small presentation PR. The
direct `@oai/sky` API selected the exact-baseline Windows Tauri runtime and
recorded 17 exact-runtime screenshots, including Automation and Floating/Pinned
Quick Preview states. Windows Forced Colors, Browse folder, disposable
mutation fixtures, direct exit/relaunch recovery and assistive technology
remain unverified; the typed/folder Preview seam and macOS remain unverified.
Browser PASS != Native PASS, and W6-10 remains inactive pending owner maturity
acceptance.

W6-09 activation baseline: `master@20781c8dc4dc8f24f0ed7d2ce860f5fd62d35ec9`;
tree `2535499a23be61786543bab19c71e35ee7a1d36f`.

### W6-10 — Release Re-entry

**INACTIVE.** Only after product-owner maturity acceptance: freeze a fresh exact candidate, run release qualification and supported-platform release-path evidence, then make a new publication decision.

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No tag or GitHub Release may be created while this deferral is active.

## Explicit non-goals for maturity work

Do not solve maturity by adding updater infrastructure, OCR/RAG/plugin/agent breadth, another Preview engine, another AI feature, new durable authorities, or weaker AI/filesystem safety gates.

The objective is to make the existing product coherent, attractive, understandable and trustworthy while preserving the engineering strengths already built.

## W6 execution principle

> **Product reconstruction is the mainline. Technical debt blocks W6 only when it threatens correctness, authority, supported-platform evidence, or release gates.**
