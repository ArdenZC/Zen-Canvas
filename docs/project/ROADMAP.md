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

### W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE / MERGED.** [W6-03 result](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

Validated production head: `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`.

Validated production tree: `9e4c93011f330e108383f7ddcf71d478974244f3`.

Hosted production CI `33956098213`: **SUCCESS**. Final PR-head CI `33956529018`: **SUCCESS**.

Squash merge: `master@9fd34956c8907810fea676e643202ea735af46df`; tree `237d63c842a200eba1058d206c9dc89a7b0e6ebf`.

W6-03 closed the remaining M1 hierarchy/progressive-disclosure implementation set without claiming fresh native release acceptance.

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — specification only; W6-04 fresh rendered/native File Library evidence review active**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current Track: [W6-04 File Library Rendered Review Activation](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md).

Codex/native QA brief: [W6-04 File Library Rendered Review Codex Brief](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md).

W6-04 is currently **evidence/specification only**. No production UI implementation is authorized until the fresh rendered result recommends a bounded implementation scope.

## W6-04 — File Library Calm-Surface Polish

### Phase A — fresh rendered review

**ACTIVE — specification only / evidence collection.**

Baseline: `master@9fd34956c8907810fea676e643202ea735af46df`.

The review owns the evidence obligation behind `W6-M2-001` and may collect bounded current-product Windows native observations relevant to `W6-M2-005`.

Required review includes, where genuinely available:

- real Windows native File Library default hierarchy;
- Library/Browse switching;
- search/filter, selection and Preview states;
- wide/medium/narrow native window sizes;
- light/dark and Chinese/English samples;
- keyboard/focus smoke;
- Narrator smoke;
- one real display-scaling scenario.

The result must choose one of:

- `NO W6-04 IMPLEMENTATION REQUIRED`; or
- `ACTIVATE BOUNDED W6-04 IMPLEMENTATION`.

### Phase B — bounded implementation

**NOT AUTHORIZED.**

If Phase A finds material `W6-M2-001` defects, a separate activation must define the smallest hierarchy/polish change needed. It must preserve durable Library/Browse, Query/selection and Preview authorities.

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No tag or GitHub Release may be created while this deferral is active.

Historical W5 evidence remains historical. Restored native computer control does not make the obsolete W5 candidate a current release candidate.

## Next sequencing

### W6-05 — Public Release Experience & Native Acceptance

Only after remaining maturity implementation closes.

W6-05 owns a fresh exact current candidate and current-candidate release-path evidence, including where genuinely exercised:

- Full Validation and release installer evidence;
- Windows x64 NSIS installation/uninstallation;
- SmartScreen / Internet-zone / Unknown Publisher observations;
- Explorer Preview Handler native focus/keyboard acceptance;
- Apple-Silicon macOS DMG / Gatekeeper / VoiceOver acceptance;
- release-artifact provenance and hashes;
- truthful `UNVERIFIED` classification for unavailable provider/external-volume/SMB/multi-display/cross-version fixtures;
- a new evidence-backed public publication decision.

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
