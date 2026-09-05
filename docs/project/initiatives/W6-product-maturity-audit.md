# W6 — Product Maturity Audit

Status: **ACTIVE — specification only; W6-04 fresh rendered/native File Library evidence review active**

Owner: Zen Canvas

Activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.

W6 activation merge: `master@85f30586447beaf08a175656e93578100835569f`.

W6-01 closeout merge / W6-02 implementation baseline: `master@834c40a2bd51083bf3fa8e78bc9e04de2419a75d`.

W6-02 closeout merge / W6-03 implementation baseline: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`; tree `24ba5b3622d55ad69a8bc8316e7f4bdf571acf52`.

W6-03 validated production head: `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`; tree `9e4c93011f330e108383f7ddcf71d478974244f3`; CI `33956098213` **SUCCESS**.

W6-03 final PR-head CI: `33956529018` **SUCCESS**.

W6-03 squash merge / W6-04 rendered-review baseline: `master@9fd34956c8907810fea676e643202ea735af46df`; tree `237d63c842a200eba1058d206c9dc89a7b0e6ebf`.

## Why W6 exists

W5 proved that Zen Canvas can satisfy automated release-qualification and packaging contracts, but release engineering readiness is not the same as product maturity. W6 turns the product-owner decision not to publish yet into evidence-backed simplification and quality work rather than another feature wave.

## Product decision

- public `v0.1.40` publication remains **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**;
- no `v0.1.40` tag or GitHub Release may be created while this deferral is active;
- historical W5 release evidence remains historical engineering evidence only;
- W5 remains **COMPLETE / CLOSED**.

## W6-01 — Product Maturity Audit

**COMPLETE.** Result: [`../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

The pre-W6 implementation maturity assessment remains approximately **2.9 / 5** and must not be silently recalculated without a later evidence-backed review.

## W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.** Result: [`../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md`](../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

Squash merge: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`.

W6-02 closed first-value/root-recovery work while preserving the existing fail-closed AI consent/credential boundary.

## W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE / MERGED.**

Activation: [`../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md`](../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md).

Result: [`../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md`](../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

Squash merge: `master@9fd34956c8907810fea676e643202ea735af46df`.

W6-03 closed:

- `W6-M1-004` — Settings progressive disclosure;
- remaining persistent-shell/Settings `W6-M1-005` — AI product positioning;
- `W6-M1-006` — global product hierarchy;
- coherent Settings/About portion of `W6-M2-002`.

It did not claim fresh native release acceptance.

## W6-04 — File Library Calm-Surface Polish

### Phase A — rendered/native evidence review

**ACTIVE — specification only / evidence collection; production implementation not yet authorized.**

Authority: [`../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md`](../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md).

Codex/native QA brief: [`../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md`](../tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md).

### Why Phase A exists

W6-01 classified `W6-M2-001` as **VISUALLY REVIEW, THEN SIMPLIFY**. Source evidence shows a rich command/scope surface, but it does not establish which controls actually compete in the rendered product.

W6-03 changed the global hierarchy and is now merged. Native Windows computer control is reported available again, so this Track can collect fresh evidence against the current master rather than relying on historical browser-only renders.

### Phase A authorized evidence

Where genuinely available, inspect on the real current Windows native application:

- File Library default hierarchy;
- Library/Browse switching;
- search/filter states;
- selection states;
- one ordinary Preview entry/return;
- wide/medium/narrow native window widths;
- light/dark and Chinese/English samples;
- bounded keyboard/focus smoke;
- bounded Narrator smoke;
- one real display-scaling scenario.

This evidence may also improve current truth for the bounded File Library portion of `W6-M2-005`, but it must not be promoted into full accessibility or release acceptance.

### Phase A decision gate

The result must conclude one of:

- `NO W6-04 IMPLEMENTATION REQUIRED`; or
- `ACTIVATE BOUNDED W6-04 IMPLEMENTATION`.

No production File Library code may change before that decision is recorded in a reviewed implementation activation.

### Phase B — bounded implementation

**NOT AUTHORIZED.**

If fresh evidence confirms material `W6-M2-001` defects, Phase B may simplify hierarchy/default chrome only. It must preserve:

- managed Library/Browse authority separation;
- Query/selection ownership and scaling behavior;
- Preview ownership/cancellation/fallback;
- existing filesystem safety/recovery paths;
- current performance contracts.

W6-04 is not a feature-addition or backend-authority Track.

## Native evidence boundary

Historical W5-04 manual/native acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED**. Restored native control does not retroactively qualify the historical W5 release candidate.

W6-04 may truthfully record current-product File Library native rendered/input/accessibility/display observations.

W6-05 remains the owner of fresh **release-path** acceptance on a new exact current candidate, including:

- NSIS installation/uninstallation;
- SmartScreen / Internet-zone / Unknown Publisher observations;
- Explorer Preview Handler native focus/keyboard acceptance;
- Apple-Silicon macOS DMG / Gatekeeper / VoiceOver acceptance;
- fresh release artifact identity/provenance;
- genuine provider/external-volume/SMB/multi-display/cross-version fixtures;
- a new publication decision.

Browser-only evidence must never be labeled native PASS.

## Product maturity strengths to preserve

Key strengths remain:

- managed/ephemeral Library/Browse authority separation;
- Preview cancellation/fallback architecture;
- Organization Plan review/Dry Run/execution safety;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- exact-SHA CI/release qualification;
- large-library performance evidence;
- local/cloud/provider consent boundaries.

Maturity work should simplify how these strengths are exposed rather than rebuild them.

## Release re-entry gate

A later publication decision must not open until:

- remaining active W6 maturity findings are closed or explicitly reclassified with evidence;
- shell/settings and File Library have an evidence-backed calm-default hierarchy;
- fresh native/manual release evidence is collected or explicitly re-accepted at W6-05;
- a new exact candidate receives fresh Full Validation and release-installer evidence;
- the product owner explicitly accepts product maturity.

## W6 retained rules

W6 work must not:

- infer a native GUI PASS from browser-only evidence;
- convert W5-04 `UNVERIFIED` evidence into PASS without new real-host evidence;
- lower safety/performance/release gates to make maturity look better;
- treat architecture/test completeness as proof of good product experience;
- solve maturity through indiscriminate feature expansion;
- weaken the existing fail-closed AI consent/credential boundary merely to simplify presentation.

## Review policy

W6 work must not use Codex Review. Codex Computer Use may be used for bounded native QA/evidence collection. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
