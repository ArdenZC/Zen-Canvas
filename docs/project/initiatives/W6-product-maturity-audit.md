# W6 — Product Maturity Audit

Status: **ACTIVE — specification only; W6-01 product maturity audit authorized**

Owner: Zen Canvas

Activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`; tree `c360b6b1df19e039093f5bba0595ec7d34e78975`.

## Why W6 exists

W5 proved that Zen Canvas can satisfy its automated release-qualification and packaging contracts, but release engineering readiness is not the same as product maturity. After W5 closeout, the product owner explicitly decided that Zen Canvas is not yet mature enough to deserve a public first release.

W6 exists to turn that product judgment into evidence-backed current truth rather than publishing merely because a release pipeline is available.

## Product decision at activation

- public `v0.1.40` publication is **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**;
- no `v0.1.40` tag or GitHub Release may be created while this deferral is active;
- the W5 exact-SHA release evidence remains valid historical engineering evidence for candidate `8b573772d842b4996bc1c34161236fa47025cc83`, but it no longer constitutes current product authorization to publish;
- W5 remains **COMPLETE / CLOSED**; W6 does not rewrite or invalidate its historical findings;
- W6 starts as **specification only**. No production implementation is authorized by activation alone.

## W6-01 — Product Maturity Audit

W6-01 is the only authorized current Track.

It must inspect the actual repository/product evidence and produce a maturity matrix covering at least:

1. **North-star fidelity** — whether the current product still feels like a calm, local-first file lifecycle / governance workspace rather than a collection of implemented subsystems.
2. **Core user journeys** — first launch, adding/understanding a location, Library/Browse navigation, search/filter, Preview, organization/cleanup/recovery, and returning to prior work.
3. **Information architecture and coherence** — navigation, naming, hierarchy, mode boundaries, discoverability and duplication.
4. **Interaction maturity** — keyboard/focus semantics, loading/empty/error states, cancellation, confirmation, feedback and recovery affordances.
5. **Visual maturity** — spacing, density, typography, iconography, state hierarchy, polish and cross-surface consistency against the accepted design direction.
6. **Feature completeness** — incomplete, placeholder, dead-end, weakly integrated or technically present-but-product-incomplete capabilities.
7. **Failure-state quality** — permissions, offline/unavailable/provider/materialization/stale/corrupt/unsupported states and whether users can understand what to do next.
8. **Performance as experienced by users** — perceived responsiveness, shell-first behavior, progressive results and obvious long-running/background-work friction. Existing automated performance evidence remains evidence, not a substitute for UX judgment.
9. **Settings / preferences / lifecycle** — configuration discoverability, persistence, reset/recovery, startup behavior and whether the product exposes only controls users can understand.
10. **Platform fidelity** — Windows/macOS differences, native integration expectations and any product claims that exceed available evidence.
11. **Trust / safety / privacy communication** — destructive-action clarity, recovery confidence, local/cloud boundaries, AI/provider consent and explicit unsupported/deferred capability.
12. **Release experience** — onboarding/help, version/about surfaces, update expectations, unsigned distribution implications, support/debug affordances and documentation needed for a credible public first release.

## Audit evidence rules

The audit may use:

- production code and executable tests;
- accepted product/design specifications and ADRs;
- current screenshots or UI evidence when genuinely available;
- build/package/current release evidence;
- bounded source inspection of existing product surfaces;
- prior closeout evidence where still relevant.

The audit must not:

- infer a native GUI PASS from browser-only Computer Use;
- convert W5-04 `UNVERIFIED` evidence into PASS;
- create new features while auditing;
- lower safety/performance/release gates to make maturity look better;
- treat test coverage or architectural completeness as proof of good product experience;
- invent user research or usage data that does not exist.

## Maturity classification

Each finding must receive:

- **Severity**: `M0 release blocker`, `M1 must improve before public release`, `M2 important polish`, or `M3 later opportunity`;
- **Evidence type**: code/test/spec/UI observation/inference;
- **Affected journey/surface**;
- **Why it matters to product maturity**;
- **Recommended disposition**: fix, redesign, simplify/remove, defer explicitly, or obtain missing evidence;
- **Implementation authorization**: none until a later reviewed Track is activated.

The audit should distinguish:

- technically implemented vs genuinely usable;
- feature breadth vs coherent workflow;
- correctness bugs vs maturity problems;
- missing evidence vs observed failure;
- release blockers vs desirable future features.

## W6-01 required outputs

W6-01 must produce:

1. a concise executive maturity verdict;
2. a scored/graded maturity matrix by product dimension;
3. a prioritized finding register with M0-M3 severity;
4. a list of public-release **Must Fix** items;
5. a list of **Simplify / Remove / Defer** candidates so maturity work does not become feature sprawl;
6. proposed follow-up implementation Tracks, each bounded to one coherent problem area;
7. an explicit recommendation for whether a future public release should reuse version `0.1.40` or choose a new candidate/version only after implementation changes are known.

## W6-01 exit gate

W6-01 closes only when the repository has enough evidence to answer:

> What specifically makes Zen Canvas feel not yet mature, what must change before public release, and what should deliberately *not* be built yet?

No implementation Track becomes active merely because the audit identifies work. Follow-up Tracks require separate reviewed activation.

## Release relationship

The prior W5 candidate remains a useful internal stable baseline. It must not be publicly tagged while W6 publication deferral is active.

If W6 later changes production code, the old W5 exact-SHA qualification cannot qualify the new product state. Any later publication candidate must receive fresh exact-SHA release evidence under the release workflow current at that time.

## Review policy

W6 work must not use Codex Review. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
