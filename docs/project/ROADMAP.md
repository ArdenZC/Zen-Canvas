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

Evidence errata records that the original full review exercised single selection only; native multi-selection remains `UNVERIFIED` and is carried into W6-05.

Evidence:

- [Rendered Review Result](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md)
- [Filter Popover Revalidation Result](tasks/W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md)
- [Rendered Review Errata](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ERRATA.md)
- [Calm-Surface Closeout Result](tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md)

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — specification only; W6-05 whole-product native/product evidence audit**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

#### Current Track — W6-05 Whole-Product Native Experience Audit

**ACTIVE — evidence-only stage gate; production implementation not authorized.**

Baseline: `master@ee1163fbf32f23cc95150adca4e1cb5a53081654`; tree `57dc0ac45810477c8477542512c3c65a60605fb9`.

Authority: [W6-05 activation](tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md).

Codex/native execution brief: [W6-05 Codex brief](tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md).

W6-05 owns one coherent real Windows/Tauri whole-product audit before redesign. It must classify each capability/state using exactly:

- `PASS`;
- `FAIL`;
- `DEGRADED`;
- `UNVERIFIED`.

It must capture real native screenshots for every core page/workflow reached and retain an evidence ZIP + SHA-256 for W6-06 visual review.

Required coverage includes major onboarding/first-value, Overview, File Library/Browse/Search/Filter/Sort/Saved Views/List/Grid/Context Panel, single and multi-selection, first-party Preview and representative formats, Organize/Organization Plan/Dry Run/execution, Cleanup/Safe Trash/Restore, History, Automation/Rules, every Settings section, Global Index, Managed Scopes, Platform Diagnostics, AI states where truthfully available, important empty/loading/error/recovery states, Chinese/English, Light/Dark, wide/medium/narrow native windows and bounded Windows keyboard/native interaction.

W6-05 may execute controlled file mutations only inside task-owned disposable fixture roots when needed to truthfully verify Organize/Cleanup/Restore. It must not change production source.

Native QA remains a **stage-level gate**, not a per-task gate. Do not rerun the whole product after every finding; broad native regression belongs to W6-09 after redesign/reconstruction.

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No tag or GitHub Release may be created while this deferral is active.

## Planned maturity sequence after W6-05

Each later Track requires a separate activation.

### W6-06 — Zen Visual System & UX Redesign

**NOT YET ACTIVE.**

Use W6-05 screenshots/findings to define a coherent Zen visual language and representative target experience before broad implementation. Avoid piecemeal Tailwind-only cosmetic patches.

Representative design targets should include at minimum Overview, File Library, Quick Preview and Settings, with multiple coherent visual directions evaluated before implementation.

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
