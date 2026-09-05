# W6 — Product Maturity Audit

Status: **ACTIVE — implementation; W6-04 bounded remediation validated, merge/closeout pending**

Owner: Zen Canvas

Activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.

W6 activation merge: `master@85f30586447beaf08a175656e93578100835569f`.

W6-02 closeout merge / W6-03 implementation baseline: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`.

W6-03 squash merge / W6-04 evidence baseline: `master@9fd34956c8907810fea676e643202ea735af46df`.

W6-04 evidence activation merge: `master@9895079a4ebb1e810b8c42d6a74b24ba147c6645`.

W6-04 bounded implementation candidate: `1aab52bb63f6c16e28ea9880c4a4afe52594c0c8`; tree `73f2868aef6e2bd03d44104866652f9c88056d13`; CI `33959447388` **SUCCESS**.

## Why W6 exists

W5 proved technical release qualification and packaging readiness, but release engineering readiness is not the same as product maturity. W6 turns the product-owner decision not to publish yet into evidence-backed simplification, UX review and quality work rather than another feature wave.

The product owner has since reinforced an additional rule:

> **CI GREEN is not a product-maturity claim.**

Zen Canvas still requires broad real-product UX/visual evaluation before release re-entry.

## Product decision

- public `v0.1.40` publication remains **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**;
- no `v0.1.40` tag or GitHub Release may be created while this deferral is active;
- historical W5 release evidence remains historical engineering evidence only;
- native QA is a **stage-level gate**, not a mandatory step after every small task;
- normal implementation Tracks may close on Code + Browser evidence unless the Track is specifically native/rendering-dependent or a stage-level native gate is due.

## Completed W6 work

### W6-01 — Product Maturity Audit

**COMPLETE.** Result: [`../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

The pre-W6 implementation maturity assessment was approximately **2.9 / 5** and is not silently recalculated without another evidence-backed review.

### W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.** Result: [`../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md`](../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

### W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE / MERGED.** Result: [`../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md`](../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

## W6-04 — File Library Calm-Surface Review / Bounded Remediation

### Phase A — rendered/native evidence review

**COMPLETE.**

Authority: [`../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md`](../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md).

Original native result is durably archived on `docs/w6-04-file-library-rendered-review-result` at `1aab5bb414ccbf94fc1afd9760072153fb2331da`.

The real Windows/Tauri review found:

- P0: none;
- P1: none;
- one P2 at a real `1282×862` window: File Library Filter popover occlusion / unreliable operation;
- decision: **ACTIVATE BOUNDED W6-04 IMPLEMENTATION**.

### Phase B — bounded implementation

**IMPLEMENTATION VALIDATED — merge/closeout pending.**

Authority: [`../tasks/W6-04-FILE-LIBRARY-BOUNDED-IMPLEMENTATION-ACTIVATION.md`](../tasks/W6-04-FILE-LIBRARY-BOUNDED-IMPLEMENTATION-ACTIVATION.md).

Closeout candidate: [`../tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md`](../tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md).

Accepted scope is only Filter-popover geometry/focus behavior. Query V2/filter/Saved View/Library/Browse/Preview/filesystem authority is unchanged.

Exact production candidate `1aab52bb...` passed CI `33959447388`, including frontend/architecture, build, W2-01, W2-10, W2-11, routed Library & Content performance and final Windows/macOS quality aggregation.

Focused real Windows/Tauri revalidation is archived at `4c6075a1dd1f3c7e5bfe4c86324a23be16150287` and observed:

- `1282×862` geometry/occlusion: PASS;
- internal scrolling: PASS;
- initial focus: PASS;
- Tab/Shift+Tab containment and wrap: PASS;
- Escape/Done focus restoration: PASS;
- real File Type filter application: PASS (`1/1` → Clear `9/9`);
- narrow-window smoke: PASS;
- native above-placement observation: UNVERIFIED;
- P0=0, P1=0, P2 open=0.

Final native decision: **PASS — W6-04 P2 CLOSED / NO FURTHER W6-04 IMPLEMENTATION REQUIRED**.

## Whole-product maturity direction

The W6-04 native review confirmed that individual bounded issues can be fixed and revalidated, but the product owner still considers the whole frontend visually immature and insufficiently exercised across many features.

The next work therefore does **not** jump directly to release acceptance.

The intended sequence, each requiring separate activation, is:

### W6-05 — Whole-Product Native Experience Audit

Evidence-first audit of major user journeys, key product states and insufficiently tested functionality. This is a stage-level native/product gate, not a per-task QA policy.

### W6-06 — Zen Visual System & UX Redesign

Define a coherent visual language and representative target screens/flows before broad implementation.

### W6-07 — Core Experience Reconstruction

Stage presentation-layer reconstruction/polish while preserving durable backend, filesystem, Query, Preview and provider authorities.

### W6-08 — Cross-Platform Quick Preview Experience

Improve the existing first-party Preview experience, especially the material Windows/macOS gap. Windows should build on existing `ZenFloatingQuickPreview` and Preview Core; Explorer Preview Handler remains supplementary shell integration rather than the flagship Zen preview experience.

### W6-09 — Whole-Product Native Regression

Run coherent real-product regression after the redesign batch rather than native verification after every small PR.

### W6-10 — Release Re-entry

Only after product-owner maturity acceptance: freeze a fresh exact candidate, run release qualification/installer evidence, perform supported-platform release-path native acceptance, and make a new publication decision.

## Product maturity strengths to preserve

- managed/ephemeral Library/Browse authority separation;
- Query/selection scaling behavior;
- Preview Core cancellation/fallback/materialization boundaries;
- Organization Plan review/Dry Run/execution safety;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- exact-SHA CI/release qualification;
- large-library performance evidence;
- AI local/cloud/provider consent boundaries.

Maturity work should simplify and improve how these strengths are exposed rather than rebuild them.

## Native evidence boundary

W6-04 is File Library product/rendered evidence, **not release acceptance**.

Historical W5-04 manual/native release-path acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED** and is not retroactively qualified.

Release-path items such as NSIS lifecycle, SmartScreen/Unknown Publisher, Explorer Preview Handler acceptance, macOS DMG/Gatekeeper/VoiceOver and release-artifact provenance stay deferred to W6-10 on a fresh candidate.

## Retained rules

W6 work must not:

- infer native PASS from browser-only evidence;
- convert historical `UNVERIFIED` release evidence into PASS without new real-host evidence;
- lower safety/performance/release gates to make maturity look better;
- treat architecture/test completeness as proof of good product experience;
- require full native acceptance after every small task;
- solve maturity through indiscriminate feature expansion;
- weaken AI consent/credential boundaries merely to simplify presentation;
- create another Preview architecture when existing Preview Core/Host seams can support experience improvements.

## Review policy

W6 work must not use Codex Review. Codex Computer Use may be used for bounded or stage-level native QA/evidence collection. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
