# Zen Canvas Project Status

Last verified: 2026-09-05

## Current baseline

- Default branch: `master`.
- W6 activation entry baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.
- Current execution state: **ACTIVE — specification only**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **COMPLETE / CLOSED**.
- W5-06 historical decision: **AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK** for candidate `8b573772d842b4996bc1c34161236fa47025cc83`.
- W6 — Product Maturity Audit: **ACTIVE — specification only**.
- W6-01 — Product Maturity Audit: **ACTIVE / AUTHORIZED**.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`; no version change is authorized by W6-01.
- Database schema: `35`.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — specification only; W6-01 product maturity audit authorized**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current task: [W6-01 Product Maturity Audit](tasks/W6-01-PRODUCT-MATURITY-AUDIT-ACTIVATION.md).

W6 starts from a product-owner decision made after W5 closeout: automated release qualification and successful packaging are not sufficient evidence that Zen Canvas is mature enough for a public first release. W6-01 must convert that judgment into a concrete, prioritized maturity assessment before any new production implementation Track is authorized.

## Publication state

Current release state is:

> **Validated / Packaged historical candidate; public publication deferred for product maturity.**

The W5 candidate remains useful internal engineering evidence:

- source `8b573772d842b4996bc1c34161236fa47025cc83`;
- tree `67cf3da35d7556bb868746a9ae0a56725558a163`;
- `CI Full Validation` run `33942690517`: **SUCCESS**;
- `Build Release Installers` run `33943755887`: **SUCCESS**;
- Windows installer SHA-256 `22e1416f39b9f2847b907419400528208422aba1d32defa99e8aed21b0827711`;
- macOS installer SHA-256 `13f519199bbdf13c6242c0719e3a0358be0a9aa4263d2cb454864bf34441926f`;
- both checksum manifests verified;
- exactly two valid CycloneDX 1.6 SBOMs verified.

Those facts are not current authorization to publish. The separate [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) is now **DEFERRED / DO NOT EXECUTE WHILE W6 MATURITY DEFERRAL IS ACTIVE**.

No `v0.1.40` tag or GitHub Release may be created from the historical candidate under the current product decision.

If later W6 implementation changes production code, the historical W5 exact-SHA evidence cannot qualify the new product state; a future publication candidate must obtain fresh exact-SHA release evidence.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.

## First-release policy truth

The W5 distribution policy remains the current intended first-release model if/when product maturity is accepted:

- canonical public distribution surface: GitHub Releases;
- Windows: versioned x64 NSIS manual download/install;
- macOS 13+ Apple Silicon: versioned DMG manual download/install;
- automatic/background update checks: not implemented;
- in-app update download/install: not implemented;
- updater key/endpoint/manifest: not implemented / deferred;
- Windows Authenticode: `NOT PROVIDED` / intentionally deferred;
- Apple Developer ID: `NOT PROVIDED` / intentionally deferred;
- Apple notarization/stapling: `NOT PROVIDED` / intentionally deferred;
- SmartScreen/Gatekeeper/manual native acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED**, not PASS;
- accessibility certification is not claimed.

## W5 historical release-decision truth

W5-06 legitimately concluded that the candidate was technically qualified for a bounded publication action under explicit residual risk. That historical result remains intact.

After W5 closeout, the product owner made a stricter product-level decision: Zen Canvas does not yet feel mature enough to deserve public release. W6 supersedes the *execution authorization* of the publication action without rewriting W5 history.

## W6 audit rule

W6-01 is audit/specification only. It may inspect current production code, tests, product/design specs, accepted ADRs and genuine available UI evidence, but it may not modify production code, schema, dependencies, workflows, version, tag or release state.

The audit must classify findings as `M0 release blocker`, `M1 must improve before public release`, `M2 important polish`, or `M3 later opportunity`, and must explicitly identify Simplify / Remove / Defer candidates so maturity work does not become uncontrolled feature expansion.

## Wave status

### W4 — Native Integration

**COMPLETE / CLOSED.** Final evidence remains in the [W4 final closeout](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

### W5 — Release / Hardening

**COMPLETE / CLOSED.** W5 established exact-SHA release qualification, packaging evidence, distribution/update policy and a truthful record of unavailable manual/native evidence.

### W6 — Product Maturity Audit

**ACTIVE — specification only.** W6-01 is the only authorized current Track. No follow-up implementation Track becomes active until the audit result is reviewed.

## Durable authority pointers

- Current active initiative: [W6 initiative](initiatives/W6-product-maturity-audit.md).
- Current audit activation: [W6-01](tasks/W6-01-PRODUCT-MATURITY-AUDIT-ACTIVATION.md).
- Deferred operational publication action: [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md).
- W5 final publication decision history: [W5-06 result](tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md).
- W5 initiative history: [W5 initiative](initiatives/W5-release-hardening.md).
- W4 no-sign product decision: [W4-05 No-Sign disposition](tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md).
- TD-014 final scope/evidence: [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md) and [filesystem identity contract](../security/FILE_IDENTITY_SEMANTICS.md).
