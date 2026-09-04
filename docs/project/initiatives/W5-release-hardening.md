# W5 — Release / Hardening

Status: **COMPLETE / CLOSED — publication authorized with explicit accepted residual risk**

Owner: Zen Canvas

Activation merge: `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

Final publication-decision record: [`../tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md`](../tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md).

Authorized publication action: [`../tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md`](../tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md).

## Goal and outcome

W5 stabilized, verified and prepared the supported Zen Canvas product for an explicit release decision without opening another feature wave or weakening W1-W4/TD-014 authorities.

W5 is now complete. Its final decision is:

> **AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK**

The authorized release candidate is:

- source `5f6dcc643bec099e3b011af97c046ebc53d2772a`;
- tree `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`;
- package version `0.1.40`;
- intended tag `v0.1.40`.

The later publication action is separate from W5 closeout. Until that action succeeds, Zen is not yet `Released`.

## W5-01 — Release Baseline & Gap Audit

**COMPLETE / CLOSED.** Result: [`../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md`](../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md).

W5-01 found no known filesystem/data-loss/runtime P0 release blocker. The first release-readiness blockers were release qualification and artifact freshness, while signing, update strategy and native/manual evidence remained explicit policy/evidence gaps.

## W5-02 — Release Qualification & Publication Safety Gate

**COMPLETE / CLOSED.** Result: [`../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md`](../tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md).

Accepted outcome:

- publication requires successful exact-SHA `CI Full Validation`;
- source evidence, lane plan, Windows/macOS Quality, Windows NSIS, Apple-Silicon unsigned DMG and dependency audit are required release-qualification evidence;
- ordinary docs-only/proportional CI cannot satisfy publication qualification;
- tag/version/source equality, checksums, SBOMs and final artifact verification remain in the release workflow;
- signing/notarization remains intentionally deferred / not provided.

## W5-03 — Distribution / Update Strategy

**COMPLETE / CLOSED.** Result: [`../tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md`](../tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md).

Accepted first-release model:

- GitHub Releases is the canonical distribution surface;
- Windows uses versioned x64 NSIS manual download/install;
- macOS 13+ Apple Silicon uses versioned DMG manual download/install;
- no automatic/background update check;
- no in-app updater;
- no updater key/endpoint/manifest;
- updater remains `NOT IMPLEMENTED / DEFERRED` until a separately reviewed trigger exists.

## W5-04 — Supported-Platform Manual Release Acceptance

**CLOSED BY EXPLICIT PRODUCT DEFERRAL — UNVERIFIED.** Result: [`../tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md`](../tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md).

The exact candidate obtained successful automated release-preparation evidence:

- `CI Full Validation` `33890392142`: **SUCCESS**;
- `Build Release Installers` `33893501841`: **SUCCESS**;
- Windows artifact `Zen-Canvas-Windows`, id `9945343182`, digest `sha256:6aed84148ed18d82c5cfc7bfbc2ddc4e32f5c92c4db940243c2e1962bfbd8125`;
- macOS artifact `Zen-Canvas-macOS`, id `9945180370`, digest `sha256:895bb85aa0ea44887ea817e2573c7703de71283b36e4835e0fe9f75964d1c580`.

The available Computer Use environment exposed browser interaction only (`apps: []`) and could not exercise native Windows/macOS app surfaces. Therefore the following remain `UNVERIFIED / EXPLICITLY DEFERRED`, not PASS:

- SmartScreen / Unknown Publisher / UAC path;
- real Windows installer / first launch / uninstall UI;
- Explorer Preview Handler focus smoke;
- Narrator / Windows display smoke;
- quarantine / Finder DMG / Gatekeeper path;
- real macOS first launch / normal user override / removal UI;
- VoiceOver / Retina / focus smoke;
- genuine provider/external/network/multi-display fixtures where unavailable.

Cross-version upgrade remains `DEFERRED — no real older public release fixture`.

## W5-05 — Long-session / Performance Release Evidence

**SKIPPED — NO EVIDENCE-DERIVED TRIGGER.**

No W5 evidence created a new material long-session/performance obligation. The historical W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED` and is not rewritten as PASS.

## W5-06 — Release Candidate / Publication Decision

**COMPLETE / CLOSED.** Result: [`../tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md`](../tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md).

W5-06 explicitly accepted the W5-04 residual manual/native uncertainty for the first public release and authorized a separate publication action.

Publication authorization is narrow:

- tag must be exactly `v0.1.40`;
- tag must point exactly to `5f6dcc643bec099e3b011af97c046ebc53d2772a`;
- the tag-triggered release workflow must still pass exact-SHA qualification and final artifact verification;
- no signing/notarization, SmartScreen/Gatekeeper acceptance, accessibility certification or updater capability may be claimed;
- a failed tag-triggered workflow does not count as a successful release.

## Frozen product decisions

The accepted no-sign policy remains binding:

- Windows Authenticode: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`;
- Preview Handler DLL signing: `DEFERRED`;
- Windows installer signing: `DEFERRED`;
- Apple Developer ID: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`;
- Apple notarization/stapling: `DEFERRED / NOT PLANNED IN CURRENT HORIZON`.

The first-release update policy also remains binding: manual download/install only, updater `NOT IMPLEMENTED / DEFERRED`.

## Final evidence model

W5 preserves the narrow release-state vocabulary:

- **Implemented** — code/config exists;
- **Validated** — required evidence passed for the stated matrix;
- **Packaged** — intended artifacts were produced/inspected for the stated source;
- **Released** — an actual successful tag/release/publication exists;
- **UNVERIFIED** — evidence was unavailable/not executed;
- **DEFERRED / BLOCKED** — postponed/prevented with reason;
- **TARGET MISSED** — measurement ran and missed its accepted target.

At W5 closeout the authorized candidate is **Validated / Packaged / Authorized for publication**, but not yet `Released`.

## Final closeout

W5 closeout conditions are satisfied by explicit evidence and product decisions:

- supported-platform release matrix is explicit;
- release qualification is exact-SHA bound;
- artifact freshness is established;
- update/distribution policy is explicit;
- unavailable manual/native evidence is preserved as `UNVERIFIED / EXPLICITLY DEFERRED`;
- W5-05 has an explicit evidence-derived skip disposition;
- residual W5-04 risk is explicitly accepted for publication rather than hidden;
- package/sign/update/publication truth remains distinct;
- no tag or GitHub Release is fabricated by closeout.

W5 is therefore **COMPLETE / CLOSED**. The project returns to canonical `BETWEEN INITIATIVES` state while the separately authorized `v0.1.40` operational publication action remains pending.
