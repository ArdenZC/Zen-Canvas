# W5 — Release / Hardening

Status: **ACTIVE — implementation; W5-01/W5-02/W5-03 complete; W5-04 Supported-Platform Manual Release Acceptance active**

Owner: Zen Canvas

Activation merge: `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

Activation task: [`../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md`](../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).

Release baseline/gap audit: [`../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md`](../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md).

Release qualification closeout: [`../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md`](../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md).

Distribution/update strategy: [`../tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md`](../tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md).

Current manual acceptance Track: [`../tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-CODEX.md`](../tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-CODEX.md).

W5-02 accepted implementation: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.

W5-03 accepted decision: `master@567e7a35c46f3b5e8f965198fa7675412a519324`; tree `26273a82b74ff257912354722c3061354fb5e640`.

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

## Current Track — W5-04

W5-04 — **Supported-Platform Manual Release Acceptance** — is active as a real-platform QA/evidence Track.

It exists because successful packaging is not the same as real unsigned distribution acceptance. W5-04 must record the actual user-visible manual path on supported hosts.

### Required Tier A release-facing evidence

- Windows x64: exact candidate/artifact identity; acquisition path; SmartScreen observation if exercised; Unknown Publisher/unsigned warning truth; normal install path; successful app launch/basic interaction; uninstall/cleanup sanity.
- macOS 13+ Apple Silicon: exact candidate/artifact identity; acquisition/quarantine evidence; DMG mount/copy; first GUI launch; exact Gatekeeper/user-visible result; normal user override/open path if needed; successful app launch/basic interaction; app removal and DMG detach sanity.

Absence of SmartScreen/Gatekeeper on a local/non-quarantined artifact is recorded as `NOT OBSERVED`, not transformed into a reputation PASS.

### Selected Tier B manual/native smoke

Where genuine supported hosts are available, exercise bounded:

- keyboard/focus behavior;
- Narrator or VoiceOver primary-shell/Preview smoke;
- one real DPI/Retina/display-scale scenario;
- multi-display only when genuine second-display hardware exists.

This is release-facing smoke, not accessibility certification.

### Tier C genuine-fixture-only evidence

Remain `UNVERIFIED` when the real fixture is unavailable:

- iCloud / generic File Provider;
- external APFS/exFAT;
- SMB/network volume;
- provider/network native Preview;
- genuine multi-display when unavailable;
- real older-release → newer-release cross-version update/upgrade.

Synthetic local folders or renamed paths must not be relabelled as these fixtures.

### Candidate artifact preparation

Preferred manual evidence uses one frozen exact W5-04 candidate:

1. successful exact-SHA `CI Full Validation`;
2. `Build Release Installers` via `workflow_dispatch` on the same candidate/ref;
3. normal browser/UI artifact download;
4. record run/artifact IDs, filenames, sizes and hashes;
5. execute manual supported-host QA.

`Build Release Installers` via workflow dispatch does not publish a GitHub Release because publication is tag-only. W5-04 itself must not create a tag/release.

## Evidence-derived later Tracks

- W5-05 — Long-session / Performance Release Evidence: only if W5-04/current evidence makes additional measurement material;
- W5-06 — Release Candidate / Publication Decision: later explicit review; no automatic publication.

W5-05 is not automatically required merely because it exists in the roadmap. Evidence decides whether it activates.

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
- W5-04 still needs real unsigned Windows/macOS first-user-path evidence;
- native manual display/accessibility evidence remains `UNVERIFIED` where no genuine W5-04 observation exists;
- genuine iCloud/File Provider/external APFS/exFAT/SMB/network evidence remains `UNVERIFIED` where real fixtures are unavailable;
- cross-version macOS upgrade remains `DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE`;
- the historical W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED`.

Fresh Windows/macOS package evidence and first-release update strategy are no longer unresolved W5 blockers.

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
