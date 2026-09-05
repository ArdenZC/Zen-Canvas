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

No new M0 filesystem/data-loss/security implementation blocker was identified. Five M1 product-maturity areas were identified at audit time. The initial Cloud AI persistence hypothesis was retracted after source, copy and tests confirmed the intentional fail-closed credential behavior.

### W6-02 — First Value & Recovery Maturity

**COMPLETE — ACCEPTED IMPLEMENTATION CANDIDATE.** Result: [W6-02 closeout](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

Validated production head: `b01bc30f4a1a98796ca9a51b0846cb4b73b5b7b5`; tree `3946cf50b30a312dd13dd622359a4ac3439ae6b1`.

Hosted CI `33948034597`: **SUCCESS**.

W6-02 closed:

- first-run/first-value and restartable setup (`W6-M1-002`);
- root database/bootstrap and view-level recovery (`W6-M1-003`);
- blank-startup maturity debt (`W6-M2-003`);
- root failure-state consistency debt for the owned surfaces (`W6-M2-004`);
- mandatory-onboarding AI over-prominence portion of `W6-M1-005`.

Existing fail-closed cloud AI credential/enablement behavior remains unchanged.

## Current

### W6 — Product Maturity Audit

Status: **ACTIVE — specification only; W6-02 complete, W6-03 pending activation**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Latest implementation result: [W6-02 First Value & Recovery Maturity](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

No later implementation Track is active merely because W6-02 completed.

Remaining active M1 areas are:

1. Settings exposes implementation architecture too prominently (`W6-M1-004`);
2. AI remains over-prominent in persistent shell/Settings surfaces (`W6-M1-005`, remaining portion);
3. global shell/workspace hierarchy remains too fragmented (`W6-M1-006`).

## Publication disposition

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

No tag or GitHub Release may be created while this deferral is active.

The previous W5 candidate remains historical internal release evidence only. W6-02 changed production code, so any future public candidate must receive fresh exact-SHA qualification.

## Next sequencing

### W6-03 — Product Hierarchy & Progressive Disclosure

**NEXT PRIORITY — NOT YET ACTIVE.**

After separate activation, intended bounded scope is:

- simplify persistent sidebar hierarchy;
- reduce persistent AI chrome when AI is disabled/not actionable;
- reorganize Settings around user intentions instead of implementation subsystems;
- move platform diagnostics/developer/build internals behind progressive disclosure;
- preserve all existing safety/authority behavior.

### W6-04 — File Library Calm-Surface Polish

After W6-03 and conditional on fresh rendered evidence. Simplify control hierarchy without changing durable Library/Browse authorities.

### W6-05 — Public Release Experience & Native Acceptance

Only after remaining M1 implementation closes. Own fresh native/manual acceptance, current release-experience polish, fresh exact-SHA qualification and a new publication decision.

## Explicit non-goals for maturity work

Do not solve W6 maturity by adding:

- updater infrastructure;
- signing/notarization infrastructure solely for perceived completeness;
- OCR/RAG/plugin/agent modules;
- another Preview engine;
- another AI feature;
- new durable authorities;
- weaker AI consent or credential gates.

The audit says Zen already has enough subsystem breadth. The remaining work is to make the existing product simpler, clearer and calmer.
