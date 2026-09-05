# W6 — Product Maturity Audit

Status: **ACTIVE — W6-03 complete; W6-04 next after fresh rendered review**

Owner: Zen Canvas

Activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.

W6 activation merge: `master@85f30586447beaf08a175656e93578100835569f`.

W6-01 closeout merge / W6-02 implementation baseline: `master@834c40a2bd51083bf3fa8e78bc9e04de2419a75d`.

W6-02 closeout merge / W6-03 implementation baseline: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`; tree `24ba5b3622d55ad69a8bc8316e7f4bdf571acf52`.

W6-03 validated production head: `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`; tree `9e4c93011f330e108383f7ddcf71d478974244f3`; CI `33956098213` **SUCCESS**.

## Why W6 exists

W5 proved that Zen Canvas can satisfy automated release-qualification and packaging contracts, but release engineering readiness is not the same as product maturity. W6 turns the product-owner decision not to publish yet into evidence-backed simplification and quality work rather than another feature wave.

## Product decision

- public `v0.1.40` publication remains **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**;
- no `v0.1.40` tag or GitHub Release may be created while this deferral is active;
- historical W5 release evidence remains historical engineering evidence only;
- W5 remains **COMPLETE / CLOSED**.

## W6-01 — Product Maturity Audit

**COMPLETE.** Result: [`../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

The audit found no new M0 filesystem/data-loss/security implementation blocker and identified the product-maturity work required before release re-entry. The initial Cloud AI persistence finding was retracted after source/copy/tests confirmed the intentional fail-closed credential behavior.

The pre-W6 implementation maturity assessment remains approximately **2.9 / 5** and must not be silently recalculated without a later evidence-backed review.

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

## W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE — ACCEPTED IMPLEMENTATION CANDIDATE.**

Activation: [`../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md`](../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md).

Result: [`../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md`](../tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

Validated production head: `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`.

Validated production tree: `9e4c93011f330e108383f7ddcf71d478974244f3`.

Hosted CI `33956098213`: **SUCCESS**.

W6-03 closes:

- `W6-M1-004` — Settings progressive disclosure;
- the remaining persistent-shell/Settings portion of `W6-M1-005` — AI product positioning;
- `W6-M1-006` — global product hierarchy;
- the coherent Settings/About portion of `W6-M2-002`.

### Accepted W6-03 product truth

- Automation is no longer a permanent sidebar peer, while the Rules workspace remains supported through Settings and command/deep-link paths.
- Healthy disabled/transient loading AI no longer occupies permanent sidebar chrome; enabled local/cloud and actionable failure states remain visible.
- Ordinary Settings navigation is reduced from 11 peer sections to eight user-intent categories: General, Appearance, Files, Search, Automation, AI, Privacy and About.
- Global Index, Platform Diagnostics and Managed Scopes remain real technical sections but are progressively disclosed rather than ordinary navigation peers.
- Technical deep links retain truthful focus/reveal behavior while navigation maps to the canonical user-intent category.
- Developer Mode and raw build/search exclusions are no longer foregrounded in ordinary About.
- Durable filesystem/recovery/index/provider authority, database schema, package version and release policy remain unchanged.

### W6-03 evidence boundary

W6-03 has mounted UI coverage and successful W2 browser interaction/accessibility/performance gates on the exact production head.

It does **not** claim fresh Windows/macOS native GUI acceptance, SmartScreen/Gatekeeper behavior, Narrator/VoiceOver acceptance, Explorer Preview Handler focus, DPI/Retina acceptance, installer first-launch acceptance or accessibility certification.

Historical W5-04 manual/native evidence remains `UNVERIFIED / EXPLICITLY DEFERRED` and must not be silently promoted because native automation capability later becomes available.

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

## Remaining implementation sequence

### W6-04 — File Library Calm-Surface Polish

**NEXT — NOT YET ACTIVATED.**

Entry condition: W6-03 merge plus a fresh rendered review of the current hierarchy.

This Track owns `W6-M2-001` File Library calm-surface/control-density polish. Its intended scope is hierarchy/polish only, not authority rewrites.

A fresh rendered review should inspect the real current product rather than infer visual quality from source/tests. Native desktop rendering may now be useful evidence when genuinely available, but native observation does not itself equal release acceptance.

### W6-05 — Public Release Experience & Native Acceptance

Later release re-entry Track after remaining maturity implementation closes.

W6-05 owns:

- a fresh exact current candidate and fresh Full Validation;
- current-candidate Windows x64 NSIS and Apple-Silicon macOS DMG evidence;
- real supported-host install/copy/first-launch/manual lifecycle evidence;
- current-candidate SmartScreen / Unknown Publisher / Gatekeeper observations where genuinely exercised;
- bounded keyboard-focus / Narrator / VoiceOver / display-scale smoke;
- Windows Explorer Preview Handler native focus/keyboard smoke;
- truthful `UNVERIFIED` classification for unavailable provider/external-volume/SMB/multi-display/cross-version fixtures;
- a new evidence-backed public publication decision.

If native Computer Use is available at that time, it should be used against the fresh W6-05 candidate rather than the obsolete W5-04 candidate when the goal is current release acceptance.

## Release re-entry gate

A later publication decision must not open until:

- remaining active W6 maturity findings are closed or explicitly reclassified with evidence;
- first-run continues to reach useful file value without requiring knowledge of Zen architecture;
- root startup/view failures retain actionable recovery UX;
- shell/settings have a reviewed calm-default hierarchy;
- a fresh rendered review confirms the changed hierarchy;
- the product owner explicitly accepts product maturity;
- a new exact candidate receives fresh Full Validation and release-installer evidence;
- native manual gaps are either exercised on the fresh candidate or explicitly re-accepted at that later decision.

## W6 retained rules

W6 implementation must not:

- infer a native GUI PASS from browser-only evidence;
- convert W5-04 `UNVERIFIED` evidence into PASS without new real-host evidence;
- lower safety/performance/release gates to make maturity look better;
- treat architecture/test completeness as proof of good product experience;
- solve maturity through indiscriminate feature expansion;
- weaken the existing fail-closed AI consent/credential boundary merely to simplify presentation.

## Review policy

W6 work must not use Codex Review. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
