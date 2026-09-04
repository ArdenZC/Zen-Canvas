# W5-06 — Release Candidate / Publication Decision — Result

Status: **COMPLETE / CLOSED — AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK**

Decision date: 2026-09-05

## Decision

Zen Canvas accepts the remaining W5-04 manual/native acceptance uncertainty for the first public release and authorizes a **separate publication action**.

Final decision:

> **AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK**

This decision does **not** convert any W5-04 manual/native evidence to PASS. It does **not** itself create a Git tag or GitHub Release.

## Immutable release candidate

The authorized publication source is the already release-qualified exact candidate:

- source commit: `5f6dcc643bec099e3b011af97c046ebc53d2772a`
- source tree: `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`
- package version: `0.1.40`
- intended publication tag: `v0.1.40`

The publication tag must point to **exactly** `5f6dcc643bec099e3b011af97c046ebc53d2772a`.

Later documentation-only W5 closeout commits are governance records, not a replacement release candidate. Publication must not move the tag to a later `master` commit merely because `master` advanced after the candidate was validated.

## Accepted automated release evidence

For the exact candidate above:

- `CI Full Validation` run `33890392142`: **SUCCESS**;
- `Build Release Installers` run `33893501841`: **SUCCESS**;
- Windows workflow artifact `Zen-Canvas-Windows`, id `9945343182`, digest `sha256:6aed84148ed18d82c5cfc7bfbc2ddc4e32f5c92c4db940243c2e1962bfbd8125`;
- macOS workflow artifact `Zen-Canvas-macOS`, id `9945180370`, digest `sha256:895bb85aa0ea44887ea817e2573c7703de71283b36e4835e0fe9f75964d1c580`;
- release qualification is bound to exact-SHA `CI Full Validation`;
- supported package outputs are Windows x64 NSIS and macOS 13+ Apple-Silicon DMG;
- release workflow verifies tag/version/source equality, installer presence/version, checksum coverage and CycloneDX SBOM outputs.

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

A separate publication action is now authorized with these hard constraints:

1. create/use tag `v0.1.40` only;
2. bind `v0.1.40` exactly to `5f6dcc643bec099e3b011af97c046ebc53d2772a`;
3. do not version-bump merely to manufacture new evidence;
4. let the accepted tag-triggered `Build Release Installers` workflow execute the W5-02 release qualification gate;
5. require the tag-triggered workflow to complete successfully before considering publication complete;
6. verify the GitHub Release contains the supported installers, checksum manifests and SBOMs;
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
