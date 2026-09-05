# Zen Canvas v0.1.40 — Publication Action

Status: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT EXECUTE**

This operational action was authorized by W5-06, but a later product-owner decision deferred public publication before any tag or GitHub Release was created.

W5 remains complete/closed; this file records the newer execution truth.

## Historical qualified candidate

- intended tag: `v0.1.40`
- exact source commit: `8b573772d842b4996bc1c34161236fa47025cc83`
- source tree: `67cf3da35d7556bb868746a9ae0a56725558a163`
- package version: `0.1.40`
- `CI Full Validation` run `33942690517`: **SUCCESS**
- `Build Release Installers` run `33943755887`: **SUCCESS**
- Windows installer SHA-256: `22e1416f39b9f2847b907419400528208422aba1d32defa99e8aed21b0827711`
- macOS installer SHA-256: `13f519199bbdf13c6242c0719e3a0358be0a9aa4263d2cb454864bf34441926f`
- both checksum manifests verified
- exactly two valid CycloneDX 1.6 SBOMs verified

This evidence proves that the historical candidate was technically validated/packaged under the W5 release workflow. It does **not** override the current product-maturity deferral.

## Current stop condition

Do not create or push tag `v0.1.40`.

Do not create a GitHub Release from the historical W5 candidate.

Do not rerun release workflows merely to preserve an authorization that the product owner has withdrawn.

Current reason:

> Zen Canvas is not yet considered product-mature enough for a public first release.

The active [W6 — Product Maturity Audit](../initiatives/W6-product-maturity-audit.md) must first determine the release Must Fix set and the appropriate release re-entry gate.

## What remains true from W5

The following engineering facts remain historical evidence:

- exact-SHA release qualification works;
- Windows x64 NSIS packaging works;
- macOS 13+ Apple-Silicon unsigned DMG packaging works;
- checksum and exactly-two-SBOM final verification works;
- current first-release distribution policy is manual GitHub Releases download/install;
- updater remains `NOT IMPLEMENTED / DEFERRED`;
- Windows Authenticode is `NOT PROVIDED`;
- Apple Developer ID/notarization/stapling are `NOT PROVIDED`;
- W5-04 native/manual SmartScreen/Gatekeeper/accessibility/focus/display evidence remains `UNVERIFIED / EXPLICITLY DEFERRED`.

None of those facts require the product to publish now.

## Resume criteria

This action may be reconsidered only after all of the following are true:

1. W6-01 Product Maturity Audit is complete;
2. the audit-derived public-release Must Fix set has an explicit disposition;
3. the product owner explicitly accepts product maturity for public release;
4. current production source/version is identified as a new publication candidate;
5. that exact candidate receives fresh release qualification appropriate to the source/workflow at that time;
6. current manual/native evidence gaps are either tested or explicitly re-accepted as residual risk;
7. no tag/release already exists for the intended version.

## Candidate/version rule

Do not assume `v0.1.40` must remain the eventual public version.

If W6 causes production changes, `8b573772...` becomes a historical internal candidate only. The future release decision must choose a version/candidate deliberately and must not force-move an existing tag or reuse stale exact-SHA evidence.

## Release-state vocabulary

Until a later explicit publication decision succeeds:

- historical candidate: **Validated / Packaged**;
- public publication: **DEFERRED**;
- Git tag: **none**;
- GitHub Release: **none**;
- `Released`: **false**.

A technically successful installer build is not a public-release obligation.
