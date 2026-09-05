# W6-01 — Product Maturity Audit — Activation

Status: **ACTIVE / AUTHORIZED — specification-only audit**

Baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`

Initiative: [`../initiatives/W6-product-maturity-audit.md`](../initiatives/W6-product-maturity-audit.md)

## Mission

Produce an evidence-backed answer to why Zen Canvas is not yet product-mature enough for a public first release, despite W5 having established automated release qualification and package production.

The output must be decision-grade: it should tell the project what to fix, what to simplify/remove, what evidence is missing, what can wait, and which follow-up Tracks are worth authorizing.

## Scope

Audit the current product across:

- product north-star fidelity;
- first-launch / first-value path;
- global shell and navigation;
- File Library / Browse mode coherence;
- search, filter and saved-view flows;
- Preview flows and failure fallback;
- organization / cleanup / recovery confidence;
- loading / empty / error / permission / offline / provider states;
- keyboard/focus and accessibility semantics where evidence exists;
- visual hierarchy and design consistency;
- settings/preferences/about/support/debug surfaces;
- AI/provider consent and trust communication;
- perceived responsiveness and long-running work feedback;
- Windows/macOS platform fidelity;
- distribution/update/onboarding expectations for a credible public release.

## Source priority

Use current production code and executable tests as implementation truth, then accepted design/product specs and ADRs for intended behavior. Use prior closeout evidence only where it still describes the current product.

Do not claim UI behavior that cannot be observed or established from source/test evidence. Native Windows/macOS manual behavior remains `UNVERIFIED` where W5-04 left it unverified.

## Finding format

Every finding must include:

- ID;
- severity: `M0`, `M1`, `M2`, or `M3`;
- surface/journey;
- evidence;
- current behavior/current product shape;
- maturity impact;
- recommended disposition;
- whether implementation requires a later Track.

Severity meanings:

- **M0 — release blocker:** public release would be misleading, unsafe, seriously broken, or unable to complete a core journey.
- **M1 — must improve before public release:** core product credibility/coherence is materially below the intended first-release bar.
- **M2 — important polish:** noticeable maturity debt that should be prioritized but need not independently block release.
- **M3 — later opportunity:** worthwhile improvement that should not expand the pre-release scope unless evidence changes.

## Required deliverable

Create `docs/project/tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md` containing:

1. executive verdict;
2. maturity scorecard by dimension;
3. finding register;
4. release Must Fix list;
5. Simplify / Remove / Defer list;
6. missing-evidence list;
7. proposed follow-up Tracks in priority order;
8. recommended release re-entry gate.

## Guardrails

- No production code changes in W6-01.
- No schema/dependency/workflow/runtime changes.
- No new feature authorization.
- No version/tag/release creation.
- Do not execute the deferred `v0.1.40` publication action.
- Do not use Codex Review.
- Do not transform lack of native GUI evidence into PASS or FAIL.
- Do not score architectural complexity as product quality unless it produces a user-visible maturity impact.
- Prefer fewer, sharper findings over a large generic wishlist.

## Done definition

W6-01 is done when the product owner can make a concrete next-wave decision from the result without relying on the vague statement “the product still feels immature.”
