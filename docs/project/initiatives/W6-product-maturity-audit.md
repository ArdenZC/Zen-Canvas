# W6 — Product Maturity Audit

Status: **ACTIVE — specification only; W6-05 whole-product native/product evidence audit**

Owner: Zen Canvas

W6 activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.

W6 activation merge: `master@85f30586447beaf08a175656e93578100835569f`.

W6-03 squash merge / W6-04 evidence baseline: `master@9fd34956c8907810fea676e643202ea735af46df`.

W6-04 evidence activation merge: `master@9895079a4ebb1e810b8c42d6a74b24ba147c6645`.

W6-04 production remediation squash merge: `master@02d0f9712e41a374d91832c6061f0a78770c8c36` (#195).

W6-04 native evidence archive squash merge / W6-05 audit baseline: `master@ee1163fbf32f23cc95150adca4e1cb5a53081654`; tree `57dc0ac45810477c8477542512c3c65a60605fb9` (#196).

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

The evidence archive also records one correction: the original full review exercised single selection only. Native multi-selection was not actually exercised and remains `UNVERIFIED`; W6-05 owns that gap.

Evidence:

- [`../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md`](../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md)
- [`../tasks/W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md`](../tasks/W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md)
- [`../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ERRATA.md`](../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ERRATA.md)
- [`../tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md`](../tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md)

## Current Track — W6-05 Whole-Product Native Experience Audit

**ACTIVE — evidence-only stage gate; production implementation not authorized.**

Authority: [`../tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md`](../tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md).

Codex/native execution brief: [`../tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md`](../tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md).

### Purpose

W6-05 asks the product question that engineering CI cannot answer:

> Which major Zen Canvas functions are genuinely usable and coherent in the real product, which are degraded, which fail, and which have never actually been verified?

The Track uses the real Windows/Tauri product and classifies each capability/state with exactly:

- `PASS`;
- `FAIL`;
- `DEGRADED`;
- `UNVERIFIED`.

### Required product coverage

The audit covers major real user journeys and important states, including:

- cold start / onboarding / first value / restart;
- Overview;
- File Library and Browse;
- Search / Filter / Sort / Saved Views;
- List / Grid / Context Panel;
- zero, single and multiple selection;
- first-party Quick Preview / pinned preview and representative formats;
- Organize Files / Organization Plan / Dry Run / safe disposable execution;
- Storage Cleanup / Safe Trash / Restore;
- History;
- Automation / Rules;
- every current Settings section;
- Global Index;
- Managed Scopes;
- Platform Diagnostics;
- AI disabled/local/cloud/error states where truthfully available within existing consent/credential gates;
- important empty/loading/error/retry/recovery states;
- Chinese / English;
- Light / Dark;
- wide / medium / narrow native windows;
- bounded Windows keyboard/native interaction.

Every core page/workflow reached must have real native screenshot evidence. The audit must retain an evidence ZIP and SHA-256 for W6-06 visual review.

Controlled file mutations are allowed only inside task-owned disposable fixture roots where needed to truthfully exercise Organize/Cleanup/Restore. Production source changes are not authorized.

### Native-stage cost rule

W6-05 is itself the stage-level native gate.

Do not rerun the whole product after every finding or after every future small implementation task. Record P2/P3 defects and continue where safe. Only a separately authorized P0/P1 safety blocker may justify immediate focused native remediation/revalidation.

Broad native regression after the redesign/reconstruction batch belongs to W6-09.

### W6-05 output

The result must contain:

- exact source/tree/environment provenance;
- complete PASS/FAIL/DEGRADED/UNVERIFIED matrix;
- screenshot manifest and evidence ZIP SHA-256;
- P0-P3 finding list;
- user-journey friction map;
- visual/UX inconsistency inventory;
- source-visible functionality that remained `UNVERIFIED` in real use;
- strengths to preserve;
- explicit W6-06 design inputs;
- explicit W6-08 Preview inputs;
- final decision: proceed to W6-06 design, or stop for separately authorized P0/P1 emergency remediation.

W6-05 completion does not silently activate W6-06.

## Planned maturity sequence

Each later Track requires a separate activation.

### W6-06 — Zen Visual System & UX Redesign

Use W6-05 evidence to define a coherent visual language and representative target screens/flows before broad implementation. Avoid piecemeal Tailwind-only cosmetic patches.

Representative design targets should include Overview, File Library, Quick Preview and Settings, with multiple coherent visual directions evaluated before implementation.

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

W6-05 is whole-product functional/UX/native evidence, **not release acceptance**.

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
