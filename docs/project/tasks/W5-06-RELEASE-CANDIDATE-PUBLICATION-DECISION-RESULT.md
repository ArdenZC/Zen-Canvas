# W5-06 — Release Candidate / Publication Decision — Result

Status: **COMPLETE / CLOSED — AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK**

Decision date: 2026-09-05

## Decision

Zen Canvas accepts the remaining W5-04 manual/native acceptance uncertainty for the first public release and authorizes a **separate publication action**.

Final decision:

> **AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK**

This decision does **not** convert any W5-04 manual/native evidence to PASS. It does **not** itself create a Git tag or GitHub Release.

## Immutable release candidate

The authorized publication source is the final requalified candidate containing the #189 publication-path fix:

- source commit: `8b573772d842b4996bc1c34161236fa47025cc83`
- source tree: `67cf3da35d7556bb868746a9ae0a56725558a163`
- package version: `0.1.40`
- intended publication tag: `v0.1.40`

The publication tag must point to **exactly** `8b573772d842b4996bc1c34161236fa47025cc83`.

Later documentation-only W5 closeout commits are governance records, not a replacement release candidate. Publication must not move the tag to a later `master` commit merely because `master` advanced after the candidate was validated.

## Publication-path blocker found and fixed before authorization

During W5-06 final review, the tag-triggered release path was found to have a real SBOM publication defect: both Windows and macOS matrix jobs generated Node and Rust SBOMs, while the final release verifier requires exactly two `*.cdx.json` documents. A real tag-triggered publication would therefore have failed before GitHub Release creation.

PR #189 fixed the defect before final authorization by generating/verifying the Node + Rust SBOM pair only on the Windows matrix lane while leaving platform installer/checksum generation unchanged and retaining the fail-closed final verifier requiring exactly two SBOMs.

Because that workflow change altered the release candidate, the earlier `5f6dcc6...` evidence was treated as historical only and the new exact candidate was fully requalified.

## Accepted automated release evidence

For exact candidate `8b573772d842b4996bc1c34161236fa47025cc83` / tree `67cf3da35d7556bb868746a9ae0a56725558a163`:

- `CI Full Validation` run `33942690517`: **SUCCESS**;
- `Build Release Installers` run `33943755887`: **SUCCESS**;
- the release-installer qualification job successfully selected and verified the exact-SHA Full Validation;
- Windows NSIS build job: **SUCCESS**;
- macOS DMG build job: **SUCCESS**;
- tag-only `Publish GitHub Release` job: **SKIPPED AS EXPECTED** for workflow-dispatch evidence; actual publication remains unexecuted.

Hosted artifacts:

- Windows artifact `Zen-Canvas-Windows`, id `9962868134`, digest `sha256:dc66010f193ed3eada2025ddbca61fb2d02dd9e635f00e1cb598b782f169346b`;
- macOS artifact `Zen-Canvas-macOS`, id `9962728560`, digest `sha256:0fea6a1086cc4a4704298643b64a91b076e7a0d9aaa30f461bf3233f3337944a`.

Direct artifact inspection established:

- Windows installer `Zen Canvas_0.1.40_x64-setup.exe`, 5,259,151 bytes, SHA-256 `22e1416f39b9f2847b907419400528208422aba1d32defa99e8aed21b0827711`;
- macOS installer `Zen Canvas_0.1.40_aarch64.dmg`, 4,516,903 bytes, SHA-256 `13f519199bbdf13c6242c0719e3a0358be0a9aa4263d2cb454864bf34441926f`;
- `installers-windows.sha256` matches the Windows installer;
- `installers-macos.sha256` matches the macOS installer;
- total CycloneDX SBOM count is exactly two;
- `sbom-node.cdx.json`: valid CycloneDX 1.6;
- `sbom-rust.cdx.json`: valid CycloneDX 1.6.

These facts establish **Validated / Packaged** status for the stated candidate. They are not themselves publication.

## W5-04 residual manual/native evidence

W5-04 was closed by explicit product deferral because the available Computer Use surface exposed browser interaction only (`apps: []`) and could not truthfully exercise native Windows/macOS application surfaces.

The following therefore remain **UNVERIFIED / EXPLICITLY DEFERRED** for the first public release:

- Windows SmartScreen / reputation warning behavior;
- Windows Unknown Publisher / UAC user-visible path;
- real Windows installer UI / first launch / uninstall UI;
- Windows Explorer Preview Handler focus smoke;
- Narrator interaction smoke;
- Windows native display/DPI smoke;
- macOS quarantine propagation through the real browser/Finder path;
- Finder DMG mount/copy behavior for this exact candidate;
- Gatekeeper first-launch warning and normal user override path;
- real macOS first launch / removal UI;
- VoiceOver interaction smoke;
- macOS Retina/native focus smoke;
- genuine iCloud/File Provider/external APFS/exFAT/SMB/network/multi-display fixtures where unavailable.

Real older-public-release → newer-release cross-version upgrade remains:

`DEFERRED — no real older public release fixture`.

The product explicitly accepts this uncertainty for the first publication. No document, release copy or future status may reinterpret it as manual acceptance PASS.

## W5-05 disposition

W5-05 — Long-session / Performance Release Evidence — remains **NOT REQUIRED / SKIPPED FOR THIS DECISION PASS**.

No current W5 evidence creates a new material long-session/performance obligation. The historical W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED`; it is not rewritten as PASS.

## Frozen first-release policy

The accepted W5-03 policy remains unchanged:

- canonical public distribution surface: GitHub Releases;
- Windows: versioned x64 NSIS manual download/install;
- macOS 13+ Apple Silicon: versioned DMG manual download/install;
- no automatic/background update check;
- no in-app update download/install;
- updater: `NOT IMPLEMENTED / DEFERRED`;
- Windows Authenticode: `NOT PROVIDED` / intentionally deferred;
- Apple Developer ID: `NOT PROVIDED` / intentionally deferred;
- Apple notarization/stapling: `NOT PROVIDED` / intentionally deferred.

Publication must not claim SmartScreen acceptance, Gatekeeper acceptance, accessibility certification, signing/notarization, or updater capability.

## Authorized publication action

A separate publication action is authorized with these hard constraints:

1. create/use tag `v0.1.40` only;
2. bind `v0.1.40` exactly to `8b573772d842b4996bc1c34161236fa47025cc83`;
3. do not version-bump merely to manufacture new evidence;
4. let the accepted tag-triggered `Build Release Installers` workflow execute the W5-02 release qualification gate;
5. require the tag-triggered workflow to complete successfully before considering publication complete;
6. verify the GitHub Release contains the supported installers, both checksum manifests and exactly the Node/Rust CycloneDX SBOM pair;
7. preserve truthful unsigned/no-updater language and do not imply W5-04 manual acceptance passed.

If the tag does not point to the exact candidate, if exact-SHA qualification fails, or if final artifact verification fails, publication is not authorized to continue under this decision.

## Final W5 disposition

- W5-01: **COMPLETE / CLOSED**
- W5-02: **COMPLETE / CLOSED**
- W5-03: **COMPLETE / CLOSED**
- W5-04: **CLOSED BY EXPLICIT DEFERRAL — UNVERIFIED MANUAL/NATIVE EVIDENCE**
- W5-05: **SKIPPED — NO EVIDENCE-DERIVED TRIGGER**
- W5-06: **COMPLETE / CLOSED — PUBLICATION AUTHORIZED WITH EXPLICIT ACCEPTED RESIDUAL RISK**

W5 — Release / Hardening is therefore **COMPLETE / CLOSED** as a release-decision initiative.

## Release/tag state at W5-06 closeout

At the time of this decision record:

- Git tag `v0.1.40`: **not created**;
- GitHub Release `v0.1.40`: **not created**;
- release state: **AUTHORIZED / NOT YET EXECUTED**.

`Implemented`, `Validated`, `Packaged` and `Released` remain distinct states. Only the later successful publication action may change the release state to `Released`.
