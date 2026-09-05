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

**COMPLETE / CLOSED.** W5 established technical release qualification and packaging readiness. Its historical release-qualified candidate remains `8b573772d842b4996bc1c34161236fa47025cc83`, with successful Full Validation and release-installer evidence. W5-04 manual/native evidence remains explicitly unverified.

### W6-01 — Product Maturity Audit

**COMPLETE.** [W6-01 result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md) concluded **PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**, with an overall source/spec maturity assessment of approximately **2.9 / 5**.

No new M0 filesystem/data-loss/security implementation blocker was identified. Five active M1 product-maturity items block release re-entry. The initial Cloud AI persistence hypothesis was retracted after source, copy and tests confirmed the intentional fail-closed credential behavior.

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — implementation; W6-02 First Value & Recovery Maturity active**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current Track: [W6-02 First Value & Recovery Maturity](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md).

W6-02 owns the first-value/recovery subset of the audit findings:

- restartable/discoverable Getting Started and a useful first-location path;
- removal of AI mode configuration from mandatory onboarding while preserving fail-closed cloud credential/enablement behavior;
- intentional delayed startup loading;
- localized database/bootstrap recovery with a real Retry path;
- localized view-level retry/reset/navigation recovery with technical-detail disclosure.

W6-02 does not authorize shell-wide navigation redesign, Settings taxonomy redesign, persistent AI chrome redesign or File Library control-density work.

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No tag or GitHub Release may be created while this deferral is active.

The previous W5 candidate remains historical internal release evidence only. W6-02 changes production code, so any future public candidate must receive fresh exact-SHA qualification.

## Next sequencing

### W6-03 — Product Hierarchy & Progressive Disclosure

After W6-02. Simplify sidebar hierarchy, Settings taxonomy, persistent AI status and developer/platform diagnostics disclosure. Prefer consolidation/removal to adding controls.

### W6-04 — File Library Calm-Surface Polish

After W6-03 and conditional on fresh rendered evidence. Simplify control hierarchy without changing durable Library/Browse authorities.

### W6-05 — Public Release Experience & Native Acceptance

Only after M1 implementation closes. Own fresh native/manual acceptance, current release-experience polish, fresh exact-SHA qualification and a new publication decision.

## Explicit non-goals for maturity work

Do not solve W6 maturity by adding:

- updater infrastructure;
- signing/notarization infrastructure solely for perceived completeness;
- OCR/RAG/plugin/agent modules;
- another Preview engine;
- another AI feature;
- new durable authorities;
- weaker AI consent or credential gates.

The audit says Zen already has enough subsystem breadth. The current work is to make the existing product simpler, clearer and more recoverable.
