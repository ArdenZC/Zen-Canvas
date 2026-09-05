# Zen Canvas Project Status

Last verified: 2026-09-06

## Current baseline

- Default branch: `master`.
- W6-03 squash merge / W6-04 baseline: `master@9fd34956c8907810fea676e643202ea735af46df`; tree `237d63c842a200eba1058d206c9dc89a7b0e6ebf`.
- W6-04 evidence activation merge: `master@9895079a4ebb1e810b8c42d6a74b24ba147c6645`.
- W6-04 bounded implementation candidate: `1aab52bb63f6c16e28ea9880c4a4afe52594c0c8`; tree `73f2868aef6e2bd03d44104866652f9c88056d13`.
- W6-04 implementation squash merge: `master@02d0f9712e41a374d91832c6061f0a78770c8c36` (#195).
- W6-04 native evidence archive squash merge / W6-05 audited production baseline: `master@ee1163fbf32f23cc95150adca4e1cb5a53081654`; tree `57dc0ac45810477c8477542512c3c65a60605fb9` (#196).
- W6-05 governance/native-control amendment baseline: `master@78eac408c4bd812848db0bb0dad73575e8251bb7` (#198).
- W6-05 accepted result/evidence squash merge / W6-06 activation baseline: `master@507253589c2bbc9924f643ddd38456e2716138dd` (#199).
- W6-05 final result branch head before squash: `db09aaf9b09d7eb2edc4940b1c8495c7522c4d02`; tree `a1e025b557140df65b37e76b7b66bd457a653465`.
- W6-05 final evidence ZIP SHA-256: `0659F2BAEF45666D9380C623B179B9513D5643281B21B0B0411824D2EC0EFDA3`.
- W6-05 final matrix: `PASS 45 / FAIL 6 / DEGRADED 7 / UNVERIFIED 22 / total 80`.
- W6-05 finding severity: `P0=0 / P1=0 / P2=5 / P3=0`.
- W6-05 result PR CI `33975986685`: **SUCCESS**.
- Current execution state: **W6-06 ACTIVE — design/specification only; production implementation not authorized**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **COMPLETE / CLOSED**.
- W6 — Product Maturity Audit: **ACTIVE — W6-06 Zen Visual System & UX Redesign**.
- W6-01 — Product Maturity Audit: **COMPLETE — PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**.
- W6-02 — First Value & Recovery Maturity: **COMPLETE / MERGED**.
- W6-03 — Product Hierarchy & Progressive Disclosure: **COMPLETE / MERGED**.
- W6-04 — File Library Calm-Surface Review / Bounded Remediation: **COMPLETE / CLOSED**.
- W6-05 — Whole-Product Native Experience Audit: **COMPLETE / CLOSED**.
- W6-06 — Zen Visual System & UX Redesign: **ACTIVE — design/specification only; no production implementation**.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT PUBLISH**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`.
- Database schema: `35`.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — W6-06 Zen Visual System & UX Redesign**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current Track authority: [W6-06 Zen Visual System & UX Redesign Activation](tasks/W6-06-ZEN-VISUAL-SYSTEM-UX-REDESIGN-ACTIVATION.md).

W6-05 closeout: [W6-05 Whole-Product Native Experience Audit Closeout Result](tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CLOSEOUT-RESULT.md).

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

The evidence archive also corrected one historical scope gap: the original full review directly exercised single selection only. Native multi-selection was not exercised there and was carried into W6-05 rather than silently promoted to PASS.

Evidence:

- [W6-04 File Library Rendered Review Result](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md)
- [W6-04 Filter Popover Native Revalidation Result](tasks/W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md)
- [W6-04 File Library Rendered Review Errata](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ERRATA.md)
- [W6-04 Calm-Surface Closeout Result](tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md)

## W6-05 closeout truth

W6-05 is **COMPLETE / CLOSED**.

The amended stage-level audit used the real Windows/Tauri Zen Canvas product on the exact audited production baseline `ee1163fbf32f23cc95150adca4e1cb5a53081654`, with the generic Windows `computer` surface accepted as native-control proof under the W6-05 amendment.

The accepted result/evidence archive was squash-merged at `master@507253589c2bbc9924f643ddd38456e2716138dd` (#199).

Final audit outcome: **DEGRADED**.

Final matrix:

- `PASS`: 45;
- `FAIL`: 6;
- `DEGRADED`: 7;
- `UNVERIFIED`: 22;
- total: 80.

Severity:

- `P0`: 0;
- `P1`: 0;
- `P2`: 5;
- `P3`: 0.

The five P2 findings are the Cleanup Windows extended-path rejection, unavailable image/CSV/JSON/folder Quick Preview, unavailable Global Index source in the isolated run, degraded Organization Plan safe-preview/suggestion loading, and Browse/first-scan recovery friction.

Evidence review repaired archive quality without rerunning the product audit: 62 valid JPEG native screenshots remain, one invalid 13×13 capture was removed, omitted required states were added as explicit `UNVERIFIED`, repository-relative evidence links were fixed, and the final ZIP was rebuilt.

Final retained evidence ZIP SHA-256:

`0659F2BAEF45666D9380C623B179B9513D5643281B21B0B0411824D2EC0EFDA3`

The pre-review archive hash `ADA10467710564EAFCC734F6C66502D7EEDD8715A47D56BBD46E4C5D0326280B` is superseded.

Primary authority:

- [W6-05 audit result](tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md)
- [W6-05 closeout result](tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CLOSEOUT-RESULT.md)

Final decision:

> **W6-05 COMPLETE — PROCEED TO W6-06 DESIGN**

No W6-05 result authorizes production remediation, W6-07 reconstruction, release publication or a new Preview architecture.

## W6-06 execution truth

W6-06 is **ACTIVE — design/specification only; production implementation not authorized**.

Activation baseline:

`master@507253589c2bbc9924f643ddd38456e2716138dd`

Authority:

[W6-06 Zen Visual System & UX Redesign Activation](tasks/W6-06-ZEN-VISUAL-SYSTEM-UX-REDESIGN-ACTIVATION.md)

W6-06 must use the accepted W6-05 real-product evidence to define one coherent Zen visual and interaction language before broad implementation.

Required design outputs include:

- W6-05 evidence synthesis/design brief;
- visual principles and design tokens;
- shell/navigation specification;
- exactly three coherent comparable visual directions;
- explicit selected direction/rationale;
- representative target designs for Overview, File Library, Quick Preview and Settings;
- shared empty/loading/degraded/unavailable/error/safety/disabled/selected/focus state grammar;
- wide/medium/narrow responsive rules;
- Chinese/English and Light/Dark guidance;
- keyboard/focus/accessibility design guidance without certification claims;
- W6-07 implementation handoff;
- W6-08 Preview-specific handoff.

The working rule is:

> **Preserve the engine; design the cockpit before rebuilding it.**

W6-06 may use static/interactive design artifacts, prototypes, Figma or repository-retained design outputs. It must not edit production `src/`/`src-tauri/`, perform broad Tailwind/React/Tauri reconstruction, change schema/release/version state, weaken safety/AI authority boundaries or silently activate W6-07.

W6-05 `UNVERIFIED` states remain `UNVERIFIED`; W6-06 can specify target behavior but cannot upgrade native acceptance without new native evidence.

## Product maturity direction after W6-06

The intended sequence is now:

1. **W6-06 — Zen Visual System & UX Redesign** — current design/specification Track.
2. **W6-07 — Core Experience Reconstruction** — reconstruct/polish the presentation layer while preserving durable backend/authority contracts.
3. **W6-08 — Cross-Platform Quick Preview Experience** — improve the existing first-party Preview experience, especially the Windows/macOS experience gap, using existing `ZenFloatingQuickPreview` / Preview Core rather than another Preview architecture.
4. **W6-09 — Whole-Product Native Regression** — coherent stage-level native regression after redesign/reconstruction.
5. **W6-10 — Release Re-entry** — only after product-owner maturity acceptance.

No later Track is silently activated by completion of W6-06.

## Native QA policy

Native QA is a **stage-level gate**, not a per-task gate.

Normal implementation Tracks may rely on Code + Browser evidence unless:

- the task is specifically native/rendering-dependent;
- a coherent batch has reached its planned native gate;
- a P0/P1 safety issue requires focused native remediation evidence;
- release re-entry requires a fresh supported-platform release-path acceptance run.

W6-05 remains the accepted whole-product native evidence baseline for design work. The broad native regression after redesign/reconstruction belongs to W6-09.

## Preview experience finding

The current File Library already contains `ZenFloatingQuickPreview`; Windows does not need a second Preview architecture.

W6-05 directly observed that Markdown/code/plain-text Preview can work, PDF uses metadata fallback, while image/CSV/JSON/folder Preview returned generic unavailable states. Previous/next/loading/pinned Preview behavior remained `UNVERIFIED` in the completed audit.

W6-06 must define the coherent target Preview language; W6-08 owns later focused cross-platform Preview experience implementation on the existing Preview Core/Host architecture.

Explorer Preview Handler remains supplementary shell integration, not the flagship Zen preview experience.

## Native/manual release evidence boundary

W6-05 was product/UX evidence, **not release acceptance**. W6-06 is design/specification and is also **not release acceptance**.

Historical W5-04 release-path acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED** and is not retroactively upgraded.

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

No W6-05/W6-06 result authorizes a version change, tag, GitHub Release, signing/notarization work or publication.

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
