# W6 — Product Maturity Audit

Status: **ACTIVE — specification only; W6-02 complete, W6-03 pending activation**

Owner: Zen Canvas

Activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.

W6 activation merge: `master@85f30586447beaf08a175656e93578100835569f`.

W6-01 closeout merge / W6-02 implementation baseline: `master@834c40a2bd51083bf3fa8e78bc9e04de2419a75d`.

W6-02 validated production head: `b01bc30f4a1a98796ca9a51b0846cb4b73b5b7b5`; tree `3946cf50b30a312dd13dd622359a4ac3439ae6b1`; CI `33948034597` **SUCCESS**.

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

The audit found no new M0 filesystem/data-loss/security implementation blocker and originally identified five active M1 product-maturity areas for release re-entry:

1. first-run can complete permanently with no connected file source;
2. root database/view failures are developer-style dead ends rather than recoverable product states;
3. Settings exposes Global Index / Platform Diagnostics / AI-managed-scope architecture too prominently;
4. AI is over-prominent relative to the core file-lifecycle north star;
5. the global shell still lacks a sufficiently clear primary workflow hierarchy.

An initial Cloud AI persistence finding was **retracted** after source, copy and existing tests confirmed that recording the cloud provider while keeping AI disabled until credentials exist is the intentional fail-closed onboarding contract. W6 must preserve that safety behavior.

## W6-02 — First Value & Recovery Maturity

**COMPLETE — ACCEPTED IMPLEMENTATION CANDIDATE.**

Activation: [`../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md`](../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md).

Result: [`../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md`](../tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

Validated production head: `b01bc30f4a1a98796ca9a51b0846cb4b73b5b7b5`.

Hosted CI `33948034597`: **SUCCESS**.

W6-02 closes:

- `W6-M1-002` — first-run / first-value / restartable setup;
- `W6-M1-003` — root database/bootstrap and view-level recovery;
- `W6-M2-003` — delayed intentional startup loading;
- `W6-M2-004` — root failure-state consistency for the owned surfaces;
- the mandatory-first-run portion of `W6-M1-005` by removing AI configuration from onboarding while preserving all existing consent/credential boundaries.

Accepted product changes:

- mandatory first-run is privacy/local-first → useful folder;
- useful completion routes directly to File Library;
- no-folder “later” dismissal does not permanently mark onboarding complete;
- Getting Started remains reopenable from Overview;
- onboarding no longer reads/saves AI provider settings;
- slow database startup receives delayed intentional feedback;
- database failure receives authoritative Retry, troubleshooting and technical-detail disclosure;
- view errors receive Retry/reset, Back to Overview and technical-detail disclosure.

No backend/schema/filesystem/provider/release authority changed.

## Remaining active M1 work

Three product-maturity areas remain active after W6-02:

1. `W6-M1-004` — Settings exposes implementation architecture too prominently;
2. `W6-M1-005` remaining portion — AI is still too prominent in persistent shell/Settings surfaces;
3. `W6-M1-006` — global shell/workspace hierarchy remains too fragmented.

Important M2 work remains around File Library calm-surface polish, About/developer content and fresh native visual/accessibility evidence.

## Product maturity assessment

W6-01's approximately **2.9 / 5** score describes the pre-W6-02 product and must not be silently recalculated without another evidence-backed review.

W6-02 materially improves first value and recovery, but the project must not convert that improvement into a new maturity score or publication authorization without closing the remaining hierarchy/progressive-disclosure work and completing the later evidence gates.

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

### W6-03 — Product Hierarchy & Progressive Disclosure

**NEXT PRIORITY — NOT YET ACTIVE.**

Intended bounded scope after separate reviewed activation:

- simplify sidebar hierarchy;
- reduce persistent AI status when AI is disabled/not actionable;
- simplify Settings taxonomy around user intentions;
- move platform diagnostics/developer/build internals behind disclosure;
- preserve all current authority/safety behavior.

### W6-04 — File Library Calm-Surface Polish

Third priority and conditional on a fresh rendered review. Intended scope is hierarchy/polish only, not authority rewrites.

### W6-05 — Public Release Experience & Native Acceptance

Later release re-entry Track after remaining M1 implementation closes. It owns fresh native/manual acceptance and a new exact-SHA publication candidate decision.

## Release re-entry gate

A later publication decision must not open until:

- the remaining active W6-01 M1 findings are closed or explicitly reclassified with evidence;
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
- weaken the existing fail-closed AI consent/credential boundary merely to simplify onboarding.

## Release relationship

The prior W5 candidate remains a useful internal stable baseline and must not be publicly tagged while W6 publication deferral is active.

W6-02 changed production code, so old W5 exact-SHA qualification is historical only. Any future publication candidate must receive fresh exact-SHA evidence under the release workflow current at that time.

## Review policy

W6 work must not use Codex Review. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
