# W6 — Product Maturity Audit

Status: **ACTIVE — specification only; W6-01 complete, implementation follow-up pending activation**

Owner: Zen Canvas

Activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.

W6 activation merge: `master@85f30586447beaf08a175656e93578100835569f`.

## Why W6 exists

W5 proved that Zen Canvas can satisfy its automated release-qualification and packaging contracts, but release engineering readiness is not the same as product maturity. After W5 closeout, the product owner explicitly decided that Zen Canvas is not yet mature enough to deserve a public first release.

W6 exists to turn that product judgment into evidence-backed current truth rather than publishing merely because a release pipeline is available.

## Product decision

- public `v0.1.40` publication remains **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**;
- no `v0.1.40` tag or GitHub Release may be created while this deferral is active;
- the W5 exact-SHA release evidence remains valid historical engineering evidence for candidate `8b573772d842b4996bc1c34161236fa47025cc83`, but it does not constitute current product authorization to publish;
- W5 remains **COMPLETE / CLOSED**; W6 does not rewrite or invalidate its historical findings.

## W6-01 — Product Maturity Audit

**COMPLETE.** Result: [`../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

Final verdict:

> **PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED.**

The audit found no new M0 filesystem/data-loss/security implementation blocker, but identified six M1 product-maturity items that should block public-release re-entry:

1. Cloud AI choice in onboarding persists as AI disabled;
2. first-run can complete permanently with no connected file source;
3. root database/view failures are developer-style dead ends rather than recoverable product states;
4. Settings exposes Global Index / Platform Diagnostics / AI-managed-scope architecture too prominently;
5. AI is over-prominent relative to the core file-lifecycle north star;
6. the global shell still lacks a sufficiently clear primary workflow hierarchy.

The audit also records M2 polish/evidence debt around File Library control density, About/developer content, startup loading, cross-product failure-state consistency and unavailable native visual/accessibility evidence.

## Product maturity assessment

W6-01 grades the current product at approximately **2.9 / 5** overall: a strong engineering pre-release product with several mature deep subsystems, but not yet a polished public first release.

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

## Required implementation sequence from audit

No implementation Track is activated merely by this result.

The audit recommends the following reviewed sequence:

### W6-02 — First Value & Recovery Maturity

Highest priority. Intended bounded scope:

- fix onboarding Cloud AI persistence;
- redesign onboarding completion/restart and first-location path;
- move AI configuration out of mandatory first-run;
- add intentional startup/loading state;
- replace database/view dead ends with localized recovery/troubleshooting surfaces.

### W6-03 — Product Hierarchy & Progressive Disclosure

Second priority. Intended bounded scope:

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

- the six W6-01 M1 findings are closed or explicitly reclassified with evidence;
- first-run reaches useful file value without requiring knowledge of Zen architecture;
- root startup/view failures have actionable recovery UX;
- shell/settings have a reviewed calm-default hierarchy;
- a fresh rendered review confirms the changed hierarchy;
- the product owner explicitly accepts product maturity;
- a new exact candidate receives fresh Full Validation and release-installer evidence;
- native manual gaps are either exercised or explicitly re-accepted at that later decision.

## Audit evidence rules retained for W6

W6 follow-up must not:

- infer a native GUI PASS from browser-only Computer Use;
- convert W5-04 `UNVERIFIED` evidence into PASS;
- lower safety/performance/release gates to make maturity look better;
- treat architecture/test completeness as proof of good product experience;
- solve maturity through indiscriminate feature expansion.

## Release relationship

The prior W5 candidate remains a useful internal stable baseline and must not be publicly tagged while W6 publication deferral is active.

Once W6 changes production code, old W5 exact-SHA qualification is historical only. Any future publication candidate must receive fresh exact-SHA evidence under the release workflow current at that time.

## Review policy

W6 work must not use Codex Review. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
