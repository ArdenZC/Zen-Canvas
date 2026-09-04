# W5 — Release / Hardening

Status: **ACTIVE — implementation; decision phase — W5-01/W5-02/W5-03 complete; W5-04 explicitly deferred/closed; W5-05 skipped; W5-06 current**

Owner: Zen Canvas

Activation merge: `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

Activation task: [`../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md`](../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).

Release baseline/gap audit: [`../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md`](../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md).

Release qualification closeout: [`../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md`](../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md).

Distribution/update strategy: [`../tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md`](../tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md).

Manual acceptance disposition: [`../tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md`](../tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md).

Current publication-decision Track: [`../tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-CODEX.md`](../tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-CODEX.md).

W5-02 accepted implementation: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.

W5-03 accepted decision: `master@567e7a35c46f3b5e8f965198fa7675412a519324`; tree `26273a82b74ff257912354722c3061354fb5e640`.

Current exact release candidate: `master@5f6dcc643bec099e3b011af97c046ebc53d2772a`; tree `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`.

## Goal

Stabilize, verify and prepare the complete supported Zen Canvas product for a truthful release decision without adding another feature wave or weakening the authorities established by W1-W4 and TD-014.

W5 owns release hardening. It does **not** mean Zen is already released, signed, notarized or publication-ready. `Implemented`, `Validated`, `Packaged` and `Released` remain distinct states throughout the initiative.

## Completed Track — W5-01

W5-01 found no current known filesystem/data-loss/runtime release blocker. Its first two release blockers were release qualification and current artifact freshness. It also preserved the W4 no-production-signing decision, identified the absence of an updater/update channel, and carried forward selected manual/native/public-warning evidence gaps without fabricating PASS claims.

## Completed Track — W5-02

W5-02 — **Release Qualification & Publication Safety Gate** — is complete and closed.

Accepted outcome:

- future publication requires successful exact-SHA `CI Full Validation`;
- required source evidence, lane plan, Windows/macOS Quality, Windows NSIS, Apple-Silicon unsigned DMG and dependency-audit jobs must each be completed/successful;
- ordinary docs-only/proportional CI cannot satisfy release qualification;
- tag/version/source binding, checksums, SBOMs and final artifact verification remain in the release path;
- the accepted tree has fresh Windows x64 NSIS and Apple-Silicon unsigned-DMG package evidence;
- platform signing/notarization remains intentionally deferred / not provided;
- no tag or GitHub Release was created.

## Completed Track — W5-03

W5-03 — **Distribution / Update Strategy** — is complete and closed.

Accepted first-release decision:

- GitHub Releases is the canonical public distribution surface after a later W5-06 publication decision;
- Windows uses versioned x64 NSIS manual download/install;
- macOS 13+ Apple Silicon uses versioned DMG manual download/install;
- Zen performs no automatic/background update check for the first release;
- no in-app update download/install exists;
- no updater public/private key, endpoint, manifest or updater artifact pipeline is introduced;
- a future updater remains `NOT IMPLEMENTED / DEFERRED` until a separately reviewed trigger is satisfied.

Updater artifact signing remains distinct from Windows Authenticode, Apple Developer ID and notarization. W5-03 does not alter the accepted W4 no-OS-signing decision and creates no updater trust root.

## Closed Track — W5-04

W5-04 — **Supported-Platform Manual Release Acceptance** — is closed by explicit product deferral.

The exact candidate still obtained the intended automated release-preparation evidence:

- source: `5f6dcc643bec099e3b011af97c046ebc53d2772a`;
- tree: `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`;
- `CI Full Validation` run `33890392142`: **SUCCESS**;
- `Build Release Installers` run `33893501841`: **SUCCESS**;
- Windows workflow artifact `Zen-Canvas-Windows`, id `9945343182`, digest `sha256:6aed84148ed18d82c5cfc7bfbc2ddc4e32f5c92c4db940243c2e1962bfbd8125`;
- macOS workflow artifact `Zen-Canvas-macOS`, id `9945180370`, digest `sha256:895bb85aa0ea44887ea817e2573c7703de71283b36e4835e0fe9f75964d1c580`.

However, the available Computer Use surface exposes browser interaction only (`apps: []`) and cannot exercise native Windows/macOS application windows. Therefore W5-04 manual evidence is explicitly classified as unresolved rather than fabricated:

- Windows SmartScreen / Unknown Publisher / UAC path: `UNVERIFIED`;
- Windows real installer / first launch / uninstall UI: `UNVERIFIED`;
- Windows Explorer Preview Handler focus, Narrator and display smoke: `UNVERIFIED`;
- macOS quarantine / Finder DMG / Gatekeeper path: `UNVERIFIED`;
- macOS native first launch / normal user override / app removal UI: `UNVERIFIED`;
- macOS VoiceOver / focus / Retina smoke: `UNVERIFIED`;
- genuine iCloud/File Provider/external APFS/exFAT/SMB/network/multi-display fixtures: `UNVERIFIED` where unavailable;
- real older-release → newer-release cross-version upgrade: `DEFERRED — no real older public release fixture`.

This closeout is an explicit product decision to defer the manual evidence. It is **not** a PASS. Any publication decision must keep this residual risk visible.

## W5-05 disposition

W5-05 — **Long-session / Performance Release Evidence** — is not required and is skipped for the current decision pass.

Reason:

- the exact candidate has successful full automated release-qualified validation;
- W5-04 did not demonstrate a new long-session/performance defect because the native manual run was not executed;
- no current evidence creates a material new measurement obligation.

The historical W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED` and is not promoted to PASS.

## Current Track — W5-06

W5-06 — **Release Candidate / Publication Decision** — is the current explicit decision Track inside the still-active `implementation` initiative state required by project governance.

It must choose exactly one policy outcome:

1. **HOLD PUBLICATION** until genuine supported-host manual acceptance becomes available; or
2. **ACCEPT RESIDUAL MANUAL-ACCEPTANCE RISK AND AUTHORIZE PUBLICATION** while explicitly preserving all W5-04 `UNVERIFIED` facts.

W5-06 does not automatically publish. A publication action, if authorized, must remain separately bound to the exact reviewed candidate and the W5-02 release qualification gate.

## Frozen product decisions and authority boundaries

All existing durable authorities remain binding, including:

- File Library Query V2 and `LibrarySelectionV1`;
- Global Index and managed scan-root/watcher/reconciliation truth;
- PreviewSession, Provider Registry, Read/Materialization Gate and WorkScheduler;
- filesystem physical-identity validation;
- Operation Preview, journals, Safe Trash, cleanup and Restore;
- Rule, Analysis, Content and Managed AI authorities;
- ADR-0005 native Host/Adapter ownership and ADR-0006 Windows capture-before-defer.

The accepted W4 no-sign product decision remains binding for OS distribution signing:

- Windows Authenticode: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`;
- Preview Handler DLL signing: `DEFERRED`;
- Windows installer signing: `DEFERRED`;
- Apple Developer ID: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`;
- Apple notarization/stapling: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`.

Unsigned distribution must be described truthfully. SmartScreen/Gatekeeper/public-reputation acceptance is not implied by package success.

## Release evidence obligations carried forward

The following remain real W5 inputs:

- no published GitHub Release or Git tag exists;
- release publication must use an actual exact-SHA `CI Full Validation`, not generic green CI;
- W5-04 real unsigned Windows/macOS first-user-path evidence remains `UNVERIFIED / EXPLICITLY DEFERRED`;
- native manual display/accessibility evidence remains `UNVERIFIED` where no genuine observation exists;
- genuine iCloud/File Provider/external APFS/exFAT/SMB/network evidence remains `UNVERIFIED` where real fixtures are unavailable;
- cross-version macOS upgrade remains `DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE`;
- the historical W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED`.

Fresh Windows/macOS package evidence and first-release update strategy are no longer unresolved W5 blockers. The remaining publication question is whether the product explicitly accepts or rejects the residual manual-acceptance uncertainty.

## Non-goals

W5 does not authorize:

- a new major feature wave;
- new supported platforms, Intel macOS, Universal binaries, Rosetta or Linux;
- broad authority/schema redesign;
- speculative architecture refactors;
- weakening safety/performance/identity/governance gates;
- adding dormant production signing infrastructure without a reviewed product decision;
- fabricated manual acceptance.

## Acceptance model

Every W5 claim must use the narrowest truthful state:

- **Implemented** — code/config exists;
- **Validated** — required evidence passed for the stated matrix;
- **Packaged** — the intended artifact was actually produced/inspected for the stated source;
- **Released** — an actual tag/release/publication occurred;
- **UNVERIFIED** — required evidence unavailable/not executed;
- **DEFERRED / BLOCKED** — postponed/prevented with owner/reason;
- **TARGET MISSED** — measurement ran and missed the accepted target.

No successful CI build alone promotes a fact to `Released`.

## Closeout requirements

W5 may close only when:

- the final supported-platform release matrix is explicit and current;
- release qualification is bound to immutable exact-SHA evidence;
- open release blockers are resolved or explicitly accepted/deferred by product decision;
- required automated/manual evidence is recorded without fabricated PASS claims;
- package/sign/update/publication state is truthful;
- any debt closed during W5 satisfies its existing exit condition;
- current truth, roadmap, risk/debt state and release/tag facts agree;
- no unresolved reviewer blocker remains on the final closeout candidate.
