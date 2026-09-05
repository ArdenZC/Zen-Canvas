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

**COMPLETE.** [W6-01 result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md) concluded **PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**, with an overall source/spec maturity assessment of approximately **2.9 / 5**.

### W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.** [W6-02 result](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md). Squash merge: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`.

W6-02 closed first-value/root-recovery work and the mandatory-onboarding portion of AI over-prominence while preserving fail-closed provider/credential behavior.

### W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE — ACCEPTED IMPLEMENTATION CANDIDATE.** [W6-03 result](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

Validated production head: `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`.

Validated production tree: `9e4c93011f330e108383f7ddcf71d478974244f3`.

Hosted CI `33956098213`: **SUCCESS**.

W6-03 closes the remaining M1 hierarchy/progressive-disclosure implementation set:

- Settings progressive disclosure (`W6-M1-004`);
- persistent-shell/Settings AI positioning (`W6-M1-005`, remaining portion);
- global shell/workspace hierarchy (`W6-M1-006`);
- the coherent Settings/About portion of `W6-M2-002`.

Accepted hierarchy changes include a reduced persistent sidebar, conditional AI status chrome, eight ordinary user-intent Settings categories, progressively disclosed Global Index / Platform Diagnostics / Managed Scopes, retained deep-link compatibility and developer/build internals moved behind Advanced Settings.

W6-03 does not claim fresh native GUI acceptance and does not authorize publication.

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — implementation; W6-03 complete; next priority W6-04 after fresh rendered review**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Latest completed Track: [W6-03 Product Hierarchy & Progressive Disclosure](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

W6-04 is next in sequence but is **NOT YET ACTIVATED**. Completion of W6-03 does not silently authorize implementation breadth beyond a fresh rendered review and a bounded File Library calm-surface/polish Track.

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No tag or GitHub Release may be created while this deferral is active.

The previous W5 candidate remains historical internal release evidence only. Because W6 changed production code, any future public candidate must receive fresh exact-SHA qualification and fresh native/manual evidence appropriate to the current product state.

## Next sequencing

### W6-04 — File Library Calm-Surface Polish

**NEXT — NOT YET ACTIVATED.**

Entry condition: W6-03 merged plus a fresh rendered review of the current product hierarchy.

Intended scope:

- inspect the real current File Library surface after W6-03 hierarchy changes;
- identify the remaining `W6-M2-001` control-density/calm-default issues from observed rendered evidence;
- simplify hierarchy and default chrome only where evidence supports it;
- preserve managed Library/Browse authority, Query/selection authority, Preview authority and current safety/performance contracts;
- avoid turning a polish Track into a feature or backend rewrite.

Fresh desktop rendering may be used as review evidence, but W6-04 must not claim release acceptance merely because a native window can now be observed.

### W6-05 — Public Release Experience & Native Acceptance

Only after remaining maturity implementation closes.

W6-05 owns:

- a fresh exact current candidate;
- current-candidate Full Validation and release-installer evidence;
- real supported-host Windows/macOS manual install/copy/first-launch evidence;
- SmartScreen / Unknown Publisher / Gatekeeper observations where genuinely exercised;
- bounded Narrator / VoiceOver / keyboard-focus / display-scale smoke;
- Explorer Preview Handler native focus/keyboard smoke on Windows;
- truthful classification of unavailable iCloud / external-volume / SMB / multi-display / cross-version fixtures;
- a new evidence-backed public publication decision.

Historical W5-04 `UNVERIFIED` records must not be silently upgraded. Restored native automation capability should be used against the fresh current candidate rather than the obsolete W5 candidate if the goal is current release evidence.

## Explicit non-goals for maturity work

Do not solve W6 maturity by adding:

- updater infrastructure;
- signing/notarization infrastructure solely for perceived completeness;
- OCR/RAG/plugin/agent modules;
- another Preview engine;
- another AI feature;
- new durable authorities;
- weaker AI consent or credential gates.

The remaining work is to make the existing product simpler, clearer and calmer, then verify the current release experience truthfully on real supported hosts.
