# W6 — Product Maturity Audit

Status: **ACTIVE — W6-06 Zen Visual System & UX Redesign; design/specification only**

Owner: Zen Canvas

W6 activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.

W6 activation merge: `master@85f30586447beaf08a175656e93578100835569f`.

W6-03 squash merge / W6-04 evidence baseline: `master@9fd34956c8907810fea676e643202ea735af46df`.

W6-04 evidence activation merge: `master@9895079a4ebb1e810b8c42d6a74b24ba147c6645`.

W6-04 production remediation squash merge: `master@02d0f9712e41a374d91832c6061f0a78770c8c36` (#195).

W6-04 native evidence archive squash merge / W6-05 audited production baseline: `master@ee1163fbf32f23cc95150adca4e1cb5a53081654`; tree `57dc0ac45810477c8477542512c3c65a60605fb9` (#196).

W6-05 accepted result/evidence squash merge / W6-06 activation baseline: `master@507253589c2bbc9924f643ddd38456e2716138dd` (#199).

## Why W6 exists

W5 proved technical release qualification and packaging readiness, but release-engineering readiness is not the same as product maturity. W6 turns the product-owner decision not to publish yet into evidence-backed simplification, UX review and quality work rather than another feature wave.

The governing product rule is:

> **CI GREEN is not a product-maturity claim.**

Zen Canvas requires broad real-product functional/UX/visual evidence before redesign and release re-entry.

## Product decision

- public `v0.1.40` publication remains **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT PUBLISH**;
- no `v0.1.40` tag or GitHub Release may be created while this deferral is active;
- historical W5 release evidence remains historical engineering evidence only;
- native QA is a **stage-level gate**, not a mandatory step after every small task;
- normal implementation Tracks may close on Code + Browser evidence unless specifically native/rendering-dependent or a stage-level native gate is due;
- W6 maturity work should preserve proven durable authorities and improve the product experience around them rather than restart the backend architecture.

## Completed W6 work

### W6-01 — Product Maturity Audit

**COMPLETE.** Result: [`../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

The pre-W6 implementation maturity assessment was approximately **2.9 / 5** and is not silently recalculated without another evidence-backed review.

### W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.** Result: [`../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md`](../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

### W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE / MERGED.** Result: [`../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md`](../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

### W6-04 — File Library Calm-Surface Review / Bounded Remediation

**COMPLETE / CLOSED.**

Phase A real Windows/Tauri review found no P0/P1 and one P2 at `1282×862`: File Library Filter popover occlusion / unreliable operation.

Phase B changed only bounded Filter-popover geometry/focus behavior while preserving Query V2/filter/Saved View/Library/Browse/Preview/filesystem authority.

Focused native revalidation directly observed:

- geometry/occlusion: PASS;
- internal scrolling: PASS;
- initial focus: PASS;
- Tab/Shift+Tab containment/wrap: PASS;
- Escape/Done restore: PASS;
- real File Type filter application: PASS (`1/1` → Clear `9/9`);
- narrow-window smoke: PASS;
- native above-placement observation: `UNVERIFIED`;
- P0=0, P1=0, previous Filter P2 open=0.

The evidence archive also records one correction: the original full review exercised single selection only. Native multi-selection was not actually exercised there and was carried into W6-05 rather than silently promoted to PASS.

Evidence:

- [`../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md`](../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md)
- [`../tasks/W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md`](../tasks/W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md)
- [`../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ERRATA.md`](../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ERRATA.md)
- [`../tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md`](../tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md)

### W6-05 — Whole-Product Native Experience Audit

**COMPLETE / CLOSED.**

Accepted result/evidence squash merge: `master@507253589c2bbc9924f643ddd38456e2716138dd` (#199).

Primary result: [`../tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md`](../tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md).

Closeout: [`../tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CLOSEOUT-RESULT.md`](../tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CLOSEOUT-RESULT.md).

Final product outcome: **DEGRADED**.

Final matrix:

- `PASS`: 45;
- `FAIL`: 6;
- `DEGRADED`: 7;
- `UNVERIFIED`: 22;
- total: 80.

Final finding severity:

- `P0`: 0;
- `P1`: 0;
- `P2`: 5;
- `P3`: 0.

The five consolidated P2 findings are:

- Cleanup valid Windows extended-path rejection before candidate review;
- image / CSV / JSON / folder Quick Preview generic unavailable states;
- Global Index source unavailable in the isolated audit run;
- Organization Plan suggestion / authoritative safe-preview loading degraded;
- Browse root-status / first-scan recovery friction.

Final retained evidence ZIP SHA-256:

`0659F2BAEF45666D9380C623B179B9513D5643281B21B0B0411824D2EC0EFDA3`

Evidence review repaired the archive contract without rerunning the product audit: 62 valid JPEG native screenshots remain, one invalid 13×13 capture was removed, all required-but-not-exercised states are explicit `UNVERIFIED`, and the result now contains the required journey, visual/UX, strengths, environment, W6-06 and W6-08 inputs.

Final decision:

> **W6-05 COMPLETE — PROCEED TO W6-06 DESIGN**

No P0/P1 emergency remediation gate was triggered.

## Current Track — W6-06 Zen Visual System & UX Redesign

**ACTIVE — design/specification only; production implementation not authorized.**

Authority: [`../tasks/W6-06-ZEN-VISUAL-SYSTEM-UX-REDESIGN-ACTIVATION.md`](../tasks/W6-06-ZEN-VISUAL-SYSTEM-UX-REDESIGN-ACTIVATION.md).

Activation baseline: `master@507253589c2bbc9924f643ddd38456e2716138dd`.

### Purpose

W6-06 converts the W6-05 real-product evidence into one coherent Zen Canvas visual and interaction system before broad reconstruction.

The Track asks:

> What should Zen Canvas look, feel and behave like as one calm, coherent, trustworthy native desktop product while preserving the mature engineering authorities already built?

Working rule:

> **Preserve the engine; design the cockpit before rebuilding it.**

### W6-05 evidence inputs

W6-06 must incorporate the actual W6-05 findings rather than treating the evidence archive as a screenshot mood board.

Important inputs include:

- first-value / scan / retry / recovery states need one clear readiness story;
- Library, Browse and Global Index authority distinctions need clearer user-facing language;
- Preview success, metadata fallback and generic unavailable states are materially inconsistent;
- Organization Plan suggestion/safe-preview readiness is not legible enough;
- loading/empty/error/disabled/recovery states need one cross-product grammar;
- some Settings/diagnostics states expose technical implementation vocabulary too prominently;
- wide/medium/narrow behavior works at a smoke level but lacks a deliberately defined system.

W6-05 `UNVERIFIED` states remain `UNVERIFIED`. W6-06 may design target behavior for them, but does not upgrade native acceptance.

### Strengths to preserve

W6-06 must preserve:

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot behavior;
- Preview Core cancellation/fallback/materialization boundaries;
- Organization Plan review → safe preview → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority and History ledger boundaries;
- Global Search ordering/no-source/IME semantics;
- local-first/no-upload privacy posture;
- AI local/cloud/provider consent and credential boundaries;
- exact-SHA CI/release qualification and performance gates.

### Authorized design work

W6-06 may define and retain:

- product personality and visual principles;
- color, typography, spacing, density, shape, radius, elevation and iconography tokens;
- shared shell/navigation hierarchy;
- controls, command hierarchy, cards/lists/tables/dialogs/popovers/menu/form patterns;
- selected/focus/disabled/loading/empty/error/recovery/safety-gate states;
- Light/Dark and Chinese/English behavior;
- wide/medium/narrow native desktop responsive rules;
- keyboard/focus guidance;
- static or interactive design prototypes and annotated design artifacts;
- W6-07 implementation handoff;
- W6-08 Preview handoff.

Design artifacts may live in `docs/`, `outputs/w6-06-design/`, Figma or another explicitly linked design surface.

### Required process and outputs

W6-06 must:

1. synthesize the W6-05 evidence into a design brief;
2. define the Zen visual system;
3. evaluate **exactly three** coherent comparable visual directions;
4. select one direction explicitly and record the rationale;
5. produce representative target experiences for Overview, File Library, Quick Preview and Settings plus the shared shell;
6. define one cross-product state grammar;
7. define responsive, language/theme and keyboard/focus guidance;
8. produce a W6-07 reconstruction handoff;
9. produce a W6-08 Preview-specific handoff;
10. end with `W6-06 COMPLETE — PROCEED TO W6-07 RECONSTRUCTION` or a separately authorized blocker decision.

A palette, isolated component sheet or collection of disconnected screenshots does not satisfy W6-06.

### Production boundary

W6-06 must not:

- edit production `src/` or `src-tauri/` to implement the redesign;
- perform broad Tailwind/React/Tauri reconstruction;
- create new durable authority or schema work;
- introduce another Preview architecture;
- weaken filesystem mutation or AI consent/credential boundaries;
- change release/version/tag state;
- publish `v0.1.40`;
- silently activate W6-07/W6-08/W6-09.

If code is useful to evaluate a concept, it must remain a disposable/non-production design prototype.

### Validation policy

W6-06 is a design/specification Track. Browser/rendered prototype evidence may support design comparison. W6-05 remains the accepted native evidence baseline. Broad whole-product native regression belongs to W6-09 after implementation.

## Planned maturity sequence

Each later Track requires a separate activation.

### W6-07 — Core Experience Reconstruction

Stage presentation-layer reconstruction/polish while preserving durable backend, filesystem, Query, Preview and provider authorities.

Working rule:

> **Preserve the engine; rebuild the cockpit.**

### W6-08 — Cross-Platform Quick Preview Experience

Improve the existing first-party Preview experience, especially the material Windows/macOS gap. Windows should build on existing `ZenFloatingQuickPreview` and Preview Core; Explorer Preview Handler remains supplementary shell integration rather than the flagship Zen preview experience.

### W6-09 — Whole-Product Native Regression

Run coherent real-product regression after redesign/reconstruction rather than native verification after every small PR.

### W6-10 — Release Re-entry

Only after product-owner maturity acceptance: freeze a fresh exact candidate, run release qualification/installer evidence, perform supported-platform release-path native acceptance, and make a new publication decision.

## Product maturity strengths to preserve

- managed/ephemeral Library/Browse authority separation;
- Query/selection scaling behavior;
- Preview Core cancellation/fallback/materialization boundaries;
- Organization Plan review/Dry Run/execution safety;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- Global Search ordering/no-source/IME semantics;
- exact-SHA CI/release qualification;
- large-library performance evidence;
- AI local/cloud/provider consent boundaries.

Maturity work should simplify and improve how these strengths are exposed rather than rebuild them.

## Native / release evidence boundary

W6-05 was whole-product functional/UX/native evidence, **not release acceptance**. W6-06 is design/specification and is also **not release acceptance**.

Historical W5-04 manual/native release-path acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED** and is not retroactively qualified.

Release-path items such as NSIS lifecycle, SmartScreen/Unknown Publisher, Explorer Preview Handler acceptance, macOS DMG/Gatekeeper/VoiceOver and release-artifact provenance remain deferred to W6-10 on a fresh candidate.

## Retained rules

W6 work must not:

- infer native PASS from browser-only evidence;
- convert historical `UNVERIFIED` evidence into PASS without new real-host evidence;
- lower safety/performance/release gates to make maturity look better;
- treat architecture/test completeness as proof of good product experience;
- require full native acceptance after every small task;
- solve maturity through indiscriminate feature expansion;
- weaken AI consent/credential boundaries merely to simplify presentation;
- create another Preview architecture when existing Preview Core/Host seams can support experience improvements.

## Review policy

W6 work must not use Codex Review. Codex Computer Use may be used for bounded or stage-level native QA/evidence collection. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
