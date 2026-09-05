# Zen Canvas Project Status

Last verified: 2026-09-05

## Current baseline

- Default branch: `master`.
- W6-01 closeout merge: `master@834c40a2bd51083bf3fa8e78bc9e04de2419a75d`.
- W6-02 validated production head: `b01bc30f4a1a98796ca9a51b0846cb4b73b5b7b5`; tree `3946cf50b30a312dd13dd622359a4ac3439ae6b1`.
- W6-02 hosted CI `33948034597`: **SUCCESS**.
- Current execution state: **ACTIVE — specification only; W6-02 complete, W6-03 pending activation**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **COMPLETE / CLOSED**.
- W6 — Product Maturity Audit: **ACTIVE — specification only**.
- W6-01 — Product Maturity Audit: **COMPLETE — PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**.
- W6-02 — First Value & Recovery Maturity: **COMPLETE — accepted implementation candidate**.
- W6-01 overall maturity assessment before W6 implementation: approximately **2.9 / 5**.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`; W6-02 did not authorize a version change.
- Database schema: `35`.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — specification only; W6-02 complete, W6-03 pending activation**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Latest implementation result: [W6-02 First Value & Recovery Maturity Result](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

Audit authority: [W6-01 Product Maturity Audit Result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

No later implementation Track is active merely because W6-02 closed. W6-03 requires a separate reviewed activation.

## W6-02 accepted result

W6-02 closes the first-value and foundational recovery subset of the W6-01 findings.

Accepted behavior at production head `b01bc30f...`:

- mandatory first-run is now privacy/local-first → useful folder, not privacy → folder → AI;
- normal onboarding completion requires a useful file folder and routes directly to File Library;
- choosing “later” without a folder does not permanently write the onboarding-complete marker;
- Getting Started is reopenable from Overview, including after a previous completion;
- mandatory onboarding no longer reads or persists AI provider/settings state;
- existing cloud credential/consent fail-closed behavior is preserved unchanged;
- database initialization gets delayed intentional startup feedback rather than an unexplained blank state;
- database failure exposes localized primary copy, authoritative Retry, troubleshooting guidance and separately disclosed technical details;
- view-level React errors expose localized Retry, Back to Overview and separately disclosed technical details.

W6-02 did not change backend/database schema, filesystem mutation/recovery authority, provider authority, update/signing policy or release state.

## Remaining active W6 maturity blockers

Public-release re-entry is still blocked by three active M1 areas from W6-01:

1. **Settings progressive disclosure** — implementation architecture remains too prominent (`W6-M1-004`).
2. **AI product positioning outside first-run** — persistent sidebar/Settings prominence remains too high (`W6-M1-005`, remaining portion).
3. **Global product hierarchy** — shell/workspace navigation remains too fragmented (`W6-M1-006`).

Important M2 work also remains:

- File Library calm-surface/control-density polish (`W6-M2-001`);
- About/developer content polish (`W6-M2-002`);
- fresh native visual/accessibility evidence (`W6-M2-005`).

Therefore W6-02 completion is **not** a publication decision and does not change the W6 deferral.

## W6-01 audit correction retained

The original Cloud AI persistence hypothesis remains **RETRACTED**. Current behavior intentionally keeps cloud AI disabled until credentials are configured. W6-02 preserved this by removing AI configuration from mandatory onboarding rather than auto-enabling or rewriting the provider contract.

## Publication state

Current release state remains:

> **Validated / Packaged historical candidate; public publication deferred for product maturity.**

Historical W5 engineering evidence remains:

- source `8b573772d842b4996bc1c34161236fa47025cc83`;
- tree `67cf3da35d7556bb868746a9ae0a56725558a163`;
- `CI Full Validation` run `33942690517`: **SUCCESS**;
- `Build Release Installers` run `33943755887`: **SUCCESS**;
- Windows installer SHA-256 `22e1416f39b9f2847b907419400528208422aba1d32defa99e8aed21b0827711`;
- macOS installer SHA-256 `13f519199bbdf13c6242c0719e3a0358be0a9aa4263d2cb454864bf34441926f`;
- both checksum manifests verified;
- exactly two valid CycloneDX 1.6 SBOMs verified.

Those facts are historical technical readiness only. The [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains **DEFERRED / DO NOT EXECUTE**.

Because W6-02 changed production code, the historical W5 exact-SHA evidence cannot qualify the changed product state. A future publication candidate must receive fresh exact-SHA release evidence.

## Strengths W6 must preserve

The maturity program continues to protect:

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot handling;
- Preview cancellation/fallback;
- Organization Plan review → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- Global Search ordering/no-source/IME semantics;
- local/cloud/provider consent boundaries, including fail-closed cloud AI credential activation;
- exact-SHA release qualification;
- large-library performance gates.

The objective remains a simpler, calmer product surface over these strengths, not a subsystem rewrite.

## W6 sequencing

### W6-02 — First Value & Recovery Maturity

**COMPLETE.** Result: [W6-02 closeout](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

### W6-03 — Product Hierarchy & Progressive Disclosure

**NEXT PRIORITY — NOT YET ACTIVE.**

Intended bounded scope after separate activation:

- simplify persistent sidebar hierarchy;
- reduce persistent AI chrome when AI is disabled/not actionable;
- reorganize Settings around user intentions rather than implementation subsystems;
- move platform diagnostics/developer/build internals behind progressive disclosure;
- preserve all current authorities and safety boundaries.

### W6-04 — File Library Calm-Surface Polish

Later and conditional on fresh rendered review after global hierarchy changes.

### W6-05 — Public Release Experience & Native Acceptance

Later release re-entry Track after remaining M1 implementation closes.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.
- SmartScreen/Gatekeeper/manual native acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED**, not PASS.
- Accessibility certification is not claimed.

## First-release policy truth

The W5 distribution policy remains intended if/when maturity is later accepted:

- GitHub Releases manual distribution;
- Windows x64 NSIS;
- macOS 13+ Apple-Silicon DMG;
- no automatic/background update checks;
- no in-app updater;
- updater key/endpoint/manifest deferred;
- Windows Authenticode not provided;
- Apple Developer ID/notarization/stapling not provided.

W6 explicitly recommends **not** adding updater/signing/general feature breadth as a substitute for product maturity.

## Durable authority pointers

- Active initiative: [W6 initiative](initiatives/W6-product-maturity-audit.md).
- Latest implementation result: [W6-02 result](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).
- Maturity audit: [W6-01 result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).
- Deferred publication action: [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md).
- W5 publication-decision history: [W5-06 result](tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md).
- W5 initiative history: [W5 initiative](initiatives/W5-release-hardening.md).
