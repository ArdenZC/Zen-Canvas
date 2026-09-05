# Zen Canvas Project Status

Last verified: 2026-09-05

## Current baseline

- Default branch: `master`.
- W6 activation merge: `master@85f30586447beaf08a175656e93578100835569f`.
- Current execution state: **ACTIVE — specification only; maturity audit complete, implementation follow-up pending activation**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **COMPLETE / CLOSED**.
- W6 — Product Maturity Audit: **ACTIVE**.
- W6-01 — Product Maturity Audit: **COMPLETE — PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**.
- W6-01 overall maturity assessment: approximately **2.9 / 5**.
- Next recommended Track: **W6-02 — First Value & Recovery Maturity**, not yet activated by this closeout.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`; W6-01 does not authorize a version change.
- Database schema: `35`.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — specification only; W6-01 complete, implementation follow-up pending activation**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Latest result: [W6-01 Product Maturity Audit Result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

W6-01 converted the product-owner judgment “Zen is not mature enough to publish” into a concrete evidence-backed release gate. No production implementation becomes active merely because the audit found work.

## W6-01 maturity verdict

> **DO NOT PUBLISH NOW.**

The audit did not find a new M0 filesystem/data-loss/security blocker. It did find six M1 product-maturity blockers for public-release re-entry:

1. onboarding Cloud AI choice persists as AI disabled;
2. first-run can complete permanently with no connected file source;
3. root database/view failures remain developer-style dead ends;
4. Settings exposes implementation architecture too prominently;
5. AI is over-prominent relative to the file-lifecycle north star;
6. the main shell still lacks a sufficiently clear primary workflow hierarchy.

The audit also records M2 debt around File Library control density, About/developer content, startup loading, failure-state consistency and unavailable native visual/accessibility evidence.

## Publication state

Current release state is:

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

Those facts are historical technical readiness, not current product authorization. The [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains **DEFERRED / DO NOT EXECUTE**.

If W6 changes production code, the historical W5 exact-SHA evidence cannot qualify the changed product state.

## Strengths W6 must preserve

The maturity audit explicitly protects:

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot handling;
- Preview cancellation/fallback;
- Organization Plan review → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- Global Search ordering/no-source/IME semantics;
- local/cloud/provider consent boundaries;
- exact-SHA release qualification;
- large-library performance gates.

The objective is a simpler, calmer product surface over these strengths, not a subsystem rewrite.

## Recommended W6 sequencing

### W6-02 — First Value & Recovery Maturity

**NEXT RECOMMENDED / NOT YET ACTIVE.**

Audit-derived scope: onboarding correctness and first value, restartable setup, AI removal from mandatory first-run, startup loading, database/view recovery UX.

### W6-03 — Product Hierarchy & Progressive Disclosure

Later. Simplify shell hierarchy, Settings taxonomy, persistent AI chrome and developer/platform diagnostics disclosure.

### W6-04 — File Library Calm-Surface Polish

Later and conditional on fresh rendered review after global hierarchy changes.

### W6-05 — Public Release Experience & Native Acceptance

Later release re-entry Track after M1 implementation closes.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs, Universal binaries, Rosetta and Linux are not current product targets.
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

W6-01 explicitly recommends **not** adding updater/signing/general feature breadth as a substitute for product maturity.

## Durable authority pointers

- Active initiative: [W6 initiative](initiatives/W6-product-maturity-audit.md).
- Latest maturity result: [W6-01 result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).
- W6-01 activation history: [W6-01 activation](tasks/W6-01-PRODUCT-MATURITY-AUDIT-ACTIVATION.md).
- Deferred publication action: [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md).
- W5 publication-decision history: [W5-06 result](tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md).
- W5 initiative history: [W5 initiative](initiatives/W5-release-hardening.md).
