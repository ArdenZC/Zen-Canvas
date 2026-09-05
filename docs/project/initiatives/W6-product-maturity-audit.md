# W6 — Product Maturity Audit

Status: **ACTIVE — implementation; W6-02 First Value & Recovery Maturity active**

Owner: Zen Canvas

Activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.

W6 activation merge: `master@85f30586447beaf08a175656e93578100835569f`.

W6-01 closeout merge / W6-02 implementation baseline: `master@834c40a2bd51083bf3fa8e78bc9e04de2419a75d`.

## Why W6 exists

W5 proved that Zen Canvas can satisfy its automated release-qualification and packaging contracts, but release engineering readiness is not the same as product maturity. After W5 closeout, the product owner explicitly decided that Zen Canvas is not yet mature enough to deserve a public first release.

W6 exists to turn that product judgment into evidence-backed improvements rather than publishing merely because a release pipeline is available.

## Product decision

- public `v0.1.40` publication remains **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**;
- no `v0.1.40` tag or GitHub Release may be created while this deferral is active;
- the W5 exact-SHA release evidence remains valid historical engineering evidence for candidate `8b573772d842b4996bc1c34161236fa47025cc83`, but it does not constitute current product authorization to publish;
- W5 remains **COMPLETE / CLOSED**; W6 does not rewrite or invalidate its historical findings.

## W6-01 — Product Maturity Audit

**COMPLETE.** Result: [`../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

Final verdict:

> **PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED.**

The audit found no new M0 filesystem/data-loss/security implementation blocker and identified five active M1 product-maturity items that block public-release re-entry:

1. first-run can complete permanently with no connected file source;
2. root database/view failures are developer-style dead ends rather than recoverable product states;
3. Settings exposes Global Index / Platform Diagnostics / AI-managed-scope architecture too prominently;
4. AI is over-prominent relative to the core file-lifecycle north star;
5. the global shell still lacks a sufficiently clear primary workflow hierarchy.

An initial Cloud AI persistence finding was **retracted** after source, copy and existing tests confirmed that recording the cloud provider while keeping AI disabled until credentials exist is the intentional fail-closed onboarding contract. W6 must preserve that safety behavior.

## W6-02 — First Value & Recovery Maturity

**ACTIVE — IMPLEMENTATION AUTHORIZED.**

Authority: [`../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md`](../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md).

Implementation baseline: `master@834c40a2bd51083bf3fa8e78bc9e04de2419a75d`.

W6-02 owns:

- `W6-M1-002` — first-run / first-value / restartable setup;
- `W6-M1-003` — root database/bootstrap and view-level recovery;
- `W6-M2-003` — delayed intentional startup loading;
- `W6-M2-004` — consistent product-level failure/recovery language;
- the mandatory-onboarding portion of `W6-M1-005`, limited to removing AI configuration from first-run while preserving all existing consent/credential boundaries.

W6-02 may change onboarding, root bootstrap/error surfaces, focused i18n, tests and only the minimum shell/navigation seam required to reopen Getting Started safely.

W6-02 must not:

- redesign the persistent sidebar hierarchy;
- reorganize Settings taxonomy;
- redesign persistent AI status;
- redesign File Library default chrome;
- weaken fail-closed cloud AI behavior;
- add schema, durable authorities, updater/signing work or new feature modules.

## Product maturity assessment

W6-01 grades the pre-W6-02 product at approximately **2.9 / 5** overall: a strong engineering pre-release product with several mature deep subsystems, but not yet a polished public first release.

Key strengths to preserve:

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

### W6-03 — Product Hierarchy & Progressive Disclosure

Second priority after W6-02. Intended bounded scope:

- simplify sidebar hierarchy;
- re-evaluate persistent AI status;
- simplify Settings taxonomy;
- move platform diagnostics/developer/build internals behind disclosure.

### W6-04 — File Library Calm-Surface Polish

Third priority and conditional on a fresh rendered review. Intended scope is hierarchy/polish only, not authority rewrites.

### W6-05 — Public Release Experience & Native Acceptance

Later release re-entry Track after M1 implementation closes. It owns fresh native/manual acceptance and a new exact-SHA publication candidate decision.

## Release re-entry gate

A later publication decision must not open until:

- the active W6-01 M1 findings are closed or explicitly reclassified with evidence;
- first-run reaches useful file value without requiring knowledge of Zen architecture;
- root startup/view failures have actionable recovery UX;
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
- weaken the existing fail-closed AI consent/credential boundary merely to simplify onboarding.

## Release relationship

The prior W5 candidate remains a useful internal stable baseline and must not be publicly tagged while W6 publication deferral is active.

W6-02 changes production code, so old W5 exact-SHA qualification is historical only. Any future publication candidate must receive fresh exact-SHA evidence under the release workflow current at that time.

## Review policy

W6 work must not use Codex Review. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
