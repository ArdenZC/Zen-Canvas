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

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — specification only; W6-01 complete, implementation follow-up pending activation**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Latest result: [W6-01 Product Maturity Audit Result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

W6-01 final verdict:

> **PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED.**

Overall source/spec maturity assessment: approximately **2.9 / 5**.

No new M0 filesystem/data-loss/security implementation blocker was identified. Five active M1 product-maturity items block release re-entry:

1. first-run/first-value path and restartable setup;
2. root startup/view error recovery;
3. Settings progressive disclosure of implementation architecture;
4. AI prominence relative to the core file-lifecycle story;
5. global shell hierarchy / workspace fragmentation.

The initial Cloud AI persistence finding is retracted: copy and regression tests confirm that recording the cloud provider while keeping AI disabled until credentials exist is the intentional fail-closed behavior and must be preserved.

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No tag or GitHub Release may be created while this deferral is active.

The previous W5 candidate remains historical internal release evidence only. Once production code changes under W6, a future public candidate must receive fresh exact-SHA qualification.

## Next recommended Track

### W6-02 — First Value & Recovery Maturity

Status: **NEXT RECOMMENDED — NOT YET ACTIVE**

Audit-derived intended scope:

- make setup/first-value flow restartable and useful without architecture knowledge;
- remove AI configuration from mandatory first-run while preserving fail-closed cloud credential/enablement behavior;
- add intentional startup loading;
- create localized recovery/troubleshooting states for database/bootstrap and view-level failures.

No shell-wide Settings/navigation redesign belongs in W6-02.

## Later sequencing

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

The audit says Zen already has enough subsystem breadth. The next work is to make the existing product simpler, clearer and more recoverable.
