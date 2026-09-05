# Zen Canvas Project Status

Last verified: 2026-09-05

## Current baseline

- Default branch: `master`.
- W6-03 squash merge / W6-04 baseline: `master@9fd34956c8907810fea676e643202ea735af46df`; tree `237d63c842a200eba1058d206c9dc89a7b0e6ebf`.
- W6-04 evidence activation merge: `master@9895079a4ebb1e810b8c42d6a74b24ba147c6645`.
- W6-04 bounded implementation candidate: `1aab52bb63f6c16e28ea9880c4a4afe52594c0c8`; tree `73f2868aef6e2bd03d44104866652f9c88056d13`.
- W6-04 implementation squash merge: `master@02d0f9712e41a374d91832c6061f0a78770c8c36` (#195).
- W6-04 native evidence archive squash merge: `master@ee1163fbf32f23cc95150adca4e1cb5a53081654`; tree `57dc0ac45810477c8477542512c3c65a60605fb9` (#196).
- W6-04 hosted implementation CI `33959447388`: **SUCCESS**.
- W6-04 evidence archive CI `33967116596`: **SUCCESS**.
- W6-04 focused native revalidation: **PASS — Filter P2 closed; P0=0, P1=0, P2 open=0**.
- W6-04 evidence errata: native multi-selection was not exercised in the original full review and remains **UNVERIFIED**; that gap is owned by W6-05.
- Current execution state: **W6-05 ACTIVE — specification/evidence only; whole-product native experience audit**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **COMPLETE / CLOSED**.
- W6 — Product Maturity Audit: **ACTIVE — W6-05 whole-product native/product audit**.
- W6-01 — Product Maturity Audit: **COMPLETE — PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**.
- W6-02 — First Value & Recovery Maturity: **COMPLETE / MERGED**.
- W6-03 — Product Hierarchy & Progressive Disclosure: **COMPLETE / MERGED**.
- W6-04 — File Library Calm-Surface Review / Bounded Remediation: **COMPLETE / CLOSED**.
- W6-05 — Whole-Product Native Experience Audit: **ACTIVE — evidence-only stage gate; production implementation not authorized**.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT PUBLISH**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`.
- Database schema: `35`.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — specification only; W6-05 whole-product native experience audit**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current Track authority: [W6-05 Whole-Product Native Experience Audit Activation](tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md).

Codex/native execution brief: [W6-05 Whole-Product Native Experience Audit Codex Brief](tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md).

## W6-04 closeout truth

W6-04 is closed.

The original real Windows/Tauri File Library review found no P0/P1 and one material P2 at `1282×862`: the Filter popover was substantially occluded and could not be operated reliably.

The bounded implementation preserved Query V2/filter/Saved View/Library/Browse/Preview/filesystem authority while changing only Filter-popover presentation/focus behavior. Focused native revalidation directly observed:

- geometry/occlusion: PASS;
- internal scrolling: PASS;
- initial focus: PASS;
- Tab/Shift+Tab containment and wrap: PASS;
- Escape restore: PASS;
- Done restore: PASS;
- real File Type filtering: PASS (`1/1`, Clear restored `9/9`);
- narrow-window smoke: PASS;
- real above-placement observation: UNVERIFIED.

The evidence archive also corrects one historical scope gap: the original full review directly exercised single selection only. Native multi-selection action hierarchy/control density was not exercised and must not be cited as PASS.

Evidence:

- [W6-04 File Library Rendered Review Result](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md)
- [W6-04 Filter Popover Native Revalidation Result](tasks/W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md)
- [W6-04 File Library Rendered Review Errata](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ERRATA.md)
- [W6-04 Calm-Surface Closeout Result](tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md)

## W6-05 execution truth

W6-05 is a **stage-level native/product audit**, not release acceptance and not a requirement to run full native QA after every future task.

The audit must use the real Windows/Tauri product and classify every exercised capability/state with exactly:

- `PASS`;
- `FAIL`;
- `DEGRADED`;
- `UNVERIFIED`.

It must cover major user journeys and states including onboarding/first value, Overview, File Library/Browse/Search/Filter/Sort/Saved Views/List/Grid/Context Panel, single and multi-selection, first-party Quick Preview and representative formats, Organize/Organization Plan/Dry Run/execution, Cleanup/Safe Trash/Restore, History, Automation/Rules, every current Settings section, Global Index, Managed Scopes, Platform Diagnostics, AI states where truthfully available, empty/loading/error/recovery states, Chinese/English, Light/Dark, wide/medium/narrow native windows and bounded Windows keyboard/native interaction.

Every core page/workflow reached must have real native screenshot evidence. A retained audit evidence ZIP and SHA-256 must be produced for W6-06 visual review.

W6-05 authorizes controlled mutations only inside task-owned disposable fixture roots where needed to truthfully exercise Organize/Cleanup/Restore. Production source changes are not authorized.

## Product maturity direction after W6-05

The product owner has explicitly rejected the assumption that green CI implies a mature product.

The intended sequence remains:

1. **W6-05 — Whole-Product Native Experience Audit** — current.
2. **W6-06 — Zen Visual System & UX Redesign** — define coherent visual language and representative target screens before broad implementation.
3. **W6-07 — Core Experience Reconstruction** — reconstruct/polish the presentation layer while preserving durable backend/authority contracts.
4. **W6-08 — Cross-Platform Quick Preview Experience** — improve the existing first-party Preview experience, especially the Windows/macOS experience gap, using existing `ZenFloatingQuickPreview` / Preview Core rather than another Preview architecture.
5. **W6-09 — Whole-Product Native Regression** — coherent stage-level native regression after redesign/reconstruction.
6. **W6-10 — Release Re-entry** — only after product-owner maturity acceptance.

No later Track is silently activated by completion of W6-05.

## Native QA policy

Native QA is a **stage-level gate**, not a per-task gate.

Normal implementation Tracks may rely on Code + Browser evidence unless:

- the task is specifically native/rendering-dependent;
- a coherent batch has reached its planned native gate;
- a P0/P1 safety issue requires focused native remediation evidence;
- release re-entry requires a fresh supported-platform release-path acceptance run.

The broad native regression after redesign belongs to W6-09.

## Preview experience finding

The current File Library already contains `ZenFloatingQuickPreview`; Windows does not need a second Preview architecture.

The product-owner finding is that the experienced Windows Quick Preview quality is materially below macOS Quick Look despite the existing Preview Core/Host architecture. W6-05 should document the real experienced gap; W6-08 owns the later focused redesign/experience work.

Explorer Preview Handler remains supplementary shell integration, not the flagship Zen preview experience.

## Native/manual release evidence boundary

W6-05 is product/UX evidence, **not release acceptance**.

Historical W5-04 release-path acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED** and is not retroactively upgraded by W6-04 or W6-05.

Future W6-10 release re-entry still owns, on a fresh exact candidate:

- NSIS install/uninstall;
- SmartScreen / Internet-zone / Unknown Publisher;
- Explorer Preview Handler native focus/keyboard acceptance;
- Apple-Silicon macOS DMG / Gatekeeper / VoiceOver;
- release artifact provenance/hashes;
- truthful handling of unavailable external-volume/provider/network/multi-display/cross-version fixtures.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.
- Browser/UI automation evidence must not be promoted into native GUI acceptance.
- Accessibility certification is not claimed.

## Publication state

Current release state remains:

> **Product implementation under maturity work; public publication deferred.**

The [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains **DEFERRED / DO NOT EXECUTE**.

No W6-05 result authorizes a version change, tag, GitHub Release, signing/notarization work or publication.

## Strengths maturity work must preserve

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot behavior;
- Preview Core cancellation/fallback/materialization boundaries;
- Organization Plan review → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- Global Search ordering/no-source/IME semantics;
- AI local/cloud/provider consent boundaries;
- exact-SHA CI/release qualification;
- large-library performance gates.

The objective is to make the existing product coherent, attractive and trustworthy without throwing away these durable engineering strengths.

## Review policy

W6 work must not use Codex Review. Codex Computer Use may be used for bounded or stage-level native QA/evidence collection. Merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
