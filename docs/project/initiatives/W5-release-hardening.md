# W5 — Release / Hardening

Status: **ACTIVE — implementation; W5-01 and W5-02 complete; W5-03 Distribution / Update Strategy active as a bounded decision audit**

Owner: Zen Canvas

Activation merge: `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

Activation task: [`../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md`](../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).

Release baseline/gap audit: [`../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md`](../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md).

Release qualification closeout: [`../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md`](../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md).

W5-02 accepted implementation: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.

Current Track: [`../tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-CODEX.md`](../tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-CODEX.md).

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

## Current Track — W5-03

W5-03 — **Distribution / Update Strategy** — is active as a bounded evidence/product-strategy decision Track.

It owns exactly one decision:

1. first public release uses manual download/install with the existing GitHub Release + NSIS/DMG model; or
2. Zen opens a separately reviewed updater/update-channel implementation with explicit trust-key, endpoint, artifact, version, privilege and rollback contracts.

The W5-03 activation does **not** authorize updater implementation. In particular it does not authorize:

- `@tauri-apps/plugin-updater` / `tauri-plugin-updater` dependencies;
- updater plugin registration;
- updater public/private key generation or storage;
- updater endpoints/manifests;
- automatic/background network checks;
- update UI;
- version bumps, tags or releases.

Current repository evidence entering W5-03:

- no in-app updater/update-channel implementation exists;
- package version remains `0.1.40`;
- no public release/tag exists;
- W5-02 already proves the intended Windows NSIS and Apple-Silicon DMG package path;
- no real older public Zen Canvas release exists for a genuine cross-version update fixture;
- current Tauri updater behavior requires signed update artifacts and therefore would introduce a separate long-lived update-authenticity key/trust lifecycle if selected.

Tauri updater signatures are distinct from Windows Authenticode, Apple Developer ID and notarization. The W4 no-sign product decision does not silently decide W5-03 either way; W5-03 must judge whether adding a new updater trust root is justified for the first release.

## Evidence-derived later Tracks

- W5-04 — Supported-Platform Manual Release Acceptance: unsigned install/launch warnings plus selected native accessibility/display/provider evidence;
- W5-05 — Long-session / Performance Release Evidence: only if current/manual evidence makes additional measurement material;
- W5-06 — Release Candidate / Publication Decision: later explicit review; no automatic publication.

W5-04 and later Tracks remain inactive until W5-03 closes and a reviewed transition authorizes the next Track.

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
- real macOS unsigned first-launch/Gatekeeper behavior is not yet accepted;
- real Windows unsigned installer SmartScreen/Unknown Publisher behavior is not yet accepted;
- native manual display/accessibility evidence remains `UNVERIFIED` where W4 did not execute it;
- genuine iCloud/File Provider/external APFS/exFAT/SMB/network evidence remains `UNVERIFIED` where real fixtures were unavailable;
- cross-version macOS upgrade remains `DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE`;
- the historical W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED`.

Fresh Windows/macOS package evidence is no longer an open W5 blocker for the accepted W5-02 tree.

## Non-goals

W5 does not authorize:

- a new major feature wave;
- new supported platforms, Intel macOS, Universal binaries, Rosetta or Linux;
- broad authority/schema redesign;
- speculative architecture refactors;
- weakening safety/performance/identity/governance gates;
- adding dormant production signing infrastructure without a reviewed product decision;
- publishing a release/tag before W5-06's later explicit decision.

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
