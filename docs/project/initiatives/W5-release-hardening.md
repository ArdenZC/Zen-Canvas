# W5 — Release / Hardening

Status: **ACTIVE — implementation; W5-01 and W5-02 complete; W5-03 Distribution / Update Strategy next / eligible, not yet active**

Owner: Zen Canvas

Activation merge: `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

Activation task: [`../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md`](../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).

Release baseline/gap audit: [`../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md`](../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md).

Release qualification closeout: [`../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md`](../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md).

W5-02 accepted implementation: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.

## Goal

Stabilize, verify and prepare the complete supported Zen Canvas product for a truthful release decision without adding another feature wave or weakening the authorities established by W1-W4 and TD-014.

W5 owns release hardening. It does **not** mean Zen is already released, signed, notarized or publication-ready. `Implemented`, `Validated`, `Packaged` and `Released` remain distinct states throughout the initiative.

## W5-01 release-baseline conclusion

W5-01 found no current known filesystem/data-loss/runtime release blocker. Its first two release blockers were release qualification and current artifact freshness. It also preserved the W4 no-production-signing decision, identified the absence of an updater/update channel, and carried forward selected manual/native/public-warning evidence gaps without fabricating PASS claims.

## Completed Track — W5-02

W5-02 — **Release Qualification & Publication Safety Gate** — is complete and closed.

Accepted outcome:

- `release-build.yml` no longer accepts arbitrary successful ordinary CI as release qualification;
- future publication requires successful exact-SHA `CI Full Validation`;
- the selected Full Validation must itself be completed/successful and exact-SHA bound;
- required source evidence, lane plan, Windows/macOS Quality, Windows NSIS, Apple-Silicon unsigned DMG and dependency-audit jobs must each be completed/successful;
- docs-only/proportional ordinary CI cannot satisfy release qualification;
- tag/version/source binding, installer checks, checksums, SBOMs and final downloaded-artifact verification remain in the release path;
- public release copy now states `NOT PROVIDED` / intentional deferral for platform signing/notarization instead of overstating release trust;
- the transitive Browserslist vulnerability found by full validation was fixed by npm-generated lock refresh rather than by weakening the audit gate;
- no tag or GitHub Release was created.

Current package evidence for the accepted tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`:

- CI `33880988509`: **SUCCESS**;
- Windows NSIS job `101049497151`: `Zen Canvas_0.1.40_x64-setup.exe` — **Packaged / Validated**;
- Apple-Silicon unsigned DMG job `101049497171`: `Zen Canvas_0.1.40_aarch64.dmg` — **Packaged / Validated**;
- Windows/macOS Quality and dependency audit: **Validated**.

The reviewed PR head `82dcfe47239c2bbf4854965275a6da71073d3979`, GitHub merge-integration commit `47e5c9f710236f7b64d7230dfeb6aec373c22d37`, and final squash merge `f99b3a538cd1608fbf590bae6d4fc66f0cd53809` all resolve to the same tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.

## Next eligible Track — W5-03

W5-03 — **Distribution / Update Strategy** — is next / eligible but is **not yet active**.

Its bounded decision is to choose between:

1. a manual-download/install update lifecycle for the first public release, with truthful version/distribution guidance; or
2. a separately reviewed updater/update-channel implementation with explicit trust, version, rollback and security contracts.

W5-03 must receive its own reviewed scope/current-truth activation before implementation. W5-02 does not silently authorize updater work.

## Evidence-derived later Tracks

- W5-04 — Supported-Platform Manual Release Acceptance: unsigned install/launch warnings plus selected native accessibility/display/provider evidence;
- W5-05 — Long-session / Performance Release Evidence: only if current/manual evidence makes additional measurement material;
- W5-06 — Release Candidate / Publication Decision: later explicit review; no automatic publication.

Each later Track requires its own reviewed transition after the current Track closes.

## Frozen product decisions and authority boundaries

All existing durable authorities remain binding, including:

- File Library Query V2 and `LibrarySelectionV1`;
- Global Index and managed scan-root/watcher/reconciliation truth;
- PreviewSession, Provider Registry, Read/Materialization Gate and WorkScheduler;
- filesystem physical-identity validation;
- Operation Preview, journals, Safe Trash, cleanup and Restore;
- Rule, Analysis, Content and Managed AI authorities;
- ADR-0005 native Host/Adapter ownership and ADR-0006 Windows capture-before-defer.

W5 must not create a second Preview/query/read/mutation/identity/recovery authority merely to harden release behavior.

The accepted W4 no-sign product decision remains binding:

- Windows Authenticode: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`;
- Preview Handler DLL signing: `DEFERRED`;
- Windows installer signing: `DEFERRED`;
- Apple Developer ID: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`;
- Apple notarization/stapling: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`.

Unsigned distribution must be described truthfully. SmartScreen/Gatekeeper/public-reputation acceptance is not implied by package success.

## Release evidence obligations carried forward

The following remain real W5 inputs after W5-02:

- no published GitHub Release or Git tag exists;
- release publication must use an actual exact-SHA `CI Full Validation`, not generic green CI;
- real macOS unsigned first-launch/Gatekeeper behavior is not yet accepted;
- real Windows unsigned installer SmartScreen/Unknown Publisher behavior is not yet accepted;
- native manual display/accessibility evidence remains `UNVERIFIED` where W4 did not execute it;
- genuine iCloud/File Provider/external APFS/exFAT/SMB/network evidence remains `UNVERIFIED` where real fixtures were unavailable;
- cross-version macOS upgrade remains `DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE`;
- the historical W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED`;
- no in-app updater/update-channel implementation exists until W5-03 makes a reviewed decision.

Fresh Windows/macOS package evidence is no longer an open W5 blocker for the accepted W5-02 tree.

## Non-goals

W5 does not authorize:

- a new major feature wave;
- new supported platforms, Intel macOS, Universal binaries, Rosetta or Linux;
- broad authority/schema redesign for cleanup;
- speculative architecture refactors;
- deleting compatibility code before its debt exit condition is proven;
- silently hydrating provider/cloud content;
- weakening safety/performance/identity/governance gates;
- adding dormant production signing infrastructure without a new product decision;
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
