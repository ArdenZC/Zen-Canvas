# W5 — Release / Hardening

Status: **ACTIVE — implementation; W5-01 complete; W5-02 Release Qualification & Publication Safety Gate next**

Owner: Zen Canvas

Activation merge: `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

Activation task: [`../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md`](../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).

Release baseline/gap audit: [`../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md`](../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md).

Next authorized implementation Track: [`../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-CODEX.md`](../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-CODEX.md).

## Goal

Stabilize, verify and prepare the complete supported Zen Canvas product for a truthful release decision without adding another feature wave or weakening the authorities established by W1-W4 and TD-014.

W5 owns release hardening. It does **not** mean Zen is already released, signed, notarized or publication-ready. `Implemented`, `Validated`, `Packaged` and `Released` remain distinct states throughout the initiative.

## W5-01 release-baseline conclusion

W5-01 is complete after its result merges. It found no current known filesystem/data-loss/runtime release blocker. The first release blockers are release-process and artifact-freshness issues:

1. `release-build.yml` accepts any successful ordinary exact-SHA `CI` run rather than requiring explicit release-qualified full validation;
2. the latest production-affecting TD-014 candidate passed release compilation, Rust/native and performance validation, but its NSIS and unsigned-DMG package lanes were skipped, so accepted package artifacts still predate TD-014.

W5-01 also confirmed:

- production Authenticode, Developer ID, notarization and stapling remain intentionally deferred/not planned in the current product horizon;
- W5 must not assume signing credentials will become available;
- the current public-release body already identifies distribution as unsigned, but its positive security/release claims must be guaranteed by release-qualified evidence;
- there is no in-app updater/update-channel implementation in the current repository;
- native display/accessibility/provider/external-volume and cross-version gaps remain manual, `UNVERIFIED`, `DEFERRED` or external-fixture evidence rather than fabricated PASS claims;
- current automated performance evidence shows no demonstrated release regression, while the historical Scheduler 2x-idle comparison remains `TARGET MISSED` rather than a hard correctness failure;
- no remaining technical-debt item preempts the release blockers.

## Current Track — W5-02

W5-02 — **Release Qualification & Publication Safety Gate** — is the only downstream implementation Track authorized by W5-01.

It must:

- require explicit exact-SHA release-qualified full validation before a tag-triggered publication can proceed;
- ensure docs-only/proportional ordinary CI cannot satisfy release qualification;
- preserve immutable source/tag/version binding;
- make required security/full-validation evidence part of release qualification;
- produce/verify current Windows NSIS and Apple-Silicon unsigned DMG artifacts;
- preserve checksums, SBOMs, version and architecture verification;
- preserve W4's intentional no-production-signing policy unless a separate product decision changes it;
- correct any release-body claim not guaranteed by required evidence;
- add focused workflow-contract tests;
- create **no** tag or GitHub Release.

## Evidence-derived later Tracks

W5-01 proposes these later boundaries, but they are not yet active:

- W5-03 — Distribution / Update Strategy: decide manual-download first-release lifecycle versus a separately reviewed updater implementation;
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

The accepted W4 no-sign product decision also remains binding:

- Windows Authenticode: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`;
- Preview Handler DLL signing: `DEFERRED`;
- Windows installer signing: `DEFERRED`;
- Apple Developer ID: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`;
- Apple notarization/stapling: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`.

Unsigned distribution must be described truthfully. SmartScreen/Gatekeeper/public-reputation acceptance is not implied by package success.

## Release evidence obligations carried forward

The following remain real W5 inputs:

- no published GitHub Release or Git tag exists at the current baseline;
- current product code needs fresh exact-SHA NSIS/DMG package evidence;
- release qualification must use full release evidence, not generic green CI;
- real macOS unsigned first-launch/Gatekeeper behavior is not yet accepted;
- real Windows unsigned installer SmartScreen/Unknown Publisher behavior is not yet accepted;
- native manual display/accessibility evidence remains `UNVERIFIED` where W4 did not execute it;
- genuine iCloud/File Provider/external APFS/exFAT/SMB/network evidence remains `UNVERIFIED` where real fixtures were unavailable;
- cross-version macOS upgrade remains `DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE`;
- the historical W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED`.

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
- publishing a release/tag from W5-02.

## Acceptance model

Every W5 claim must use the narrowest truthful state:

- **Implemented** — code/config exists;
- **Validated** — required evidence passed for the stated matrix;
- **Packaged** — the intended artifact was actually produced/inspected for the stated source;
- **Released** — an actual tag/release/publication occurred;
- **UNVERIFIED** — required evidence unavailable/not executed;
- **DEFERRED / BLOCKED** — postponed/prevented with owner/reason;
- **TARGET MISSED** — measurement ran and missed the accepted target.

No successful CI build alone promotes a fact to `Released` or, without an actual artifact, to `Packaged`.

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
