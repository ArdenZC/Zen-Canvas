# W6 — Product Maturity Audit

Status: **ACTIVE — implementation; W6-03 Product Hierarchy & Progressive Disclosure active**

Owner: Zen Canvas

Activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.

W6 activation merge: `master@85f30586447beaf08a175656e93578100835569f`.

W6-01 closeout merge / W6-02 implementation baseline: `master@834c40a2bd51083bf3fa8e78bc9e04de2419a75d`.

W6-02 closeout merge / W6-03 implementation baseline: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`; tree `24ba5b3622d55ad69a8bc8316e7f4bdf571acf52`.

## Why W6 exists

W5 proved that Zen Canvas can satisfy its automated release-qualification and packaging contracts, but release engineering readiness is not the same as product maturity. W6 turns the product-owner decision not to publish yet into evidence-backed simplification and quality work rather than another feature wave.

## Product decision

- public `v0.1.40` publication remains **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**;
- no `v0.1.40` tag or GitHub Release may be created while this deferral is active;
- historical W5 release evidence remains historical engineering evidence only;
- W5 remains **COMPLETE / CLOSED**.

## W6-01 — Product Maturity Audit

**COMPLETE.** Result: [`../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

The audit found no new M0 filesystem/data-loss/security implementation blocker and identified the product-maturity work required before release re-entry. The initial Cloud AI persistence finding was retracted after source/copy/tests confirmed the intentional fail-closed credential behavior.

## W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.**

Activation: [`../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md`](../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md).

Result: [`../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md`](../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

Squash merge: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`.

W6-02 closed:

- `W6-M1-002` — first-run / first-value / restartable setup;
- `W6-M1-003` — root database/bootstrap and view-level recovery;
- `W6-M2-003` — delayed intentional startup loading;
- `W6-M2-004` — root failure-state consistency for the owned surfaces;
- the mandatory-first-run portion of `W6-M1-005`.

Its exact validated production head before closeout was `78962d8a5fcdeb1df5cfb5b402efd116359ffae8`, with CI `33948599460` **SUCCESS**; final PR-head integration CI `33949133453` also completed **SUCCESS**.

## W6-03 — Product Hierarchy & Progressive Disclosure

**ACTIVE — IMPLEMENTATION AUTHORIZED.**

Authority: [`../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md`](../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md).

Implementation baseline: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`.

W6-03 owns:

- `W6-M1-004` — Settings progressive disclosure;
- the remaining persistent-shell/Settings portion of `W6-M1-005` — AI product positioning;
- `W6-M1-006` — global product hierarchy;
- the coherent Settings/About portion of `W6-M2-002` where it can be closed without expanding scope.

### Authorized direction

- reduce persistent sidebar peer destinations while preserving truthful secondary/contextual/command entry paths;
- hide healthy disabled/transient loading AI sidebar chrome; keep enabled or actionable-failure status visible;
- reduce the ordinary Settings 11-peer-section architecture into user-intent categories;
- subordinate Global Index/provider health, Platform Diagnostics and managed-scope architecture behind troubleshooting/developer/contextual disclosure;
- move developer/build exclusions out of normal About;
- preserve deep-link/section-request compatibility rather than silently targeting hidden DOM sections.

### Hard boundaries

W6-03 must not:

- redesign File Library default chrome (`W6-04`);
- change durable filesystem/recovery/index/provider authority;
- change database schema;
- weaken AI consent/credential fail-closed behavior;
- add updater/signing/new feature breadth;
- change package version or publish a release.

## Product maturity assessment

W6-01's approximately **2.9 / 5** score describes the pre-W6 implementation product and must not be silently recalculated without a later evidence-backed review.

Key strengths to preserve remain:

- managed/ephemeral Library/Browse authority separation;
- Preview cancellation/fallback architecture;
- Organization Plan review/Dry Run/execution safety;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- exact-SHA CI/release qualification;
- large-library performance evidence;
- local/cloud/provider consent boundaries.

Maturity work should simplify how these strengths are exposed rather than rebuild them.

## Remaining implementation sequence

### W6-04 — File Library Calm-Surface Polish

After W6-03 and conditional on a fresh rendered review. Intended scope is hierarchy/polish only, not authority rewrites.

### W6-05 — Public Release Experience & Native Acceptance

Later release re-entry Track after remaining maturity implementation closes. It owns fresh native/manual acceptance and a new exact-SHA publication candidate decision.

## Release re-entry gate

A later publication decision must not open until:

- the remaining active W6 maturity findings are closed or explicitly reclassified with evidence;
- first-run continues to reach useful file value without requiring knowledge of Zen architecture;
- root startup/view failures retain actionable recovery UX;
- shell/settings have a reviewed calm-default hierarchy;
- a fresh rendered review confirms the changed hierarchy;
- the product owner explicitly accepts product maturity;
- a new exact candidate receives fresh Full Validation and release-installer evidence;
- native manual gaps are either exercised or explicitly re-accepted at that later decision.

## W6 retained rules

W6 implementation must not:

- infer a native GUI PASS from browser-only evidence;
- convert W5-04 `UNVERIFIED` evidence into PASS;
- lower safety/performance/release gates to make maturity look better;
- treat architecture/test completeness as proof of good product experience;
- solve maturity through indiscriminate feature expansion;
- weaken the existing fail-closed AI consent/credential boundary merely to simplify presentation.

## Review policy

W6 work must not use Codex Review. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
