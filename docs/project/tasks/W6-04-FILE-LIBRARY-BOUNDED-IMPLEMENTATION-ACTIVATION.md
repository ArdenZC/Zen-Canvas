# W6-04 — File Library Calm-Surface Bounded Implementation — Activation

Status: **IMPLEMENTATION VALIDATED — merge/closeout pending**

Implementation baseline: `master@9895079a4ebb1e810b8c42d6a74b24ba147c6645`.

Validated implementation candidate: `1aab52bb63f6c16e28ea9880c4a4afe52594c0c8`; tree `73f2868aef6e2bd03d44104866652f9c88056d13`.

Hosted CI: `33959447388` — **SUCCESS**.

Parent evidence Track: [`W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md`](W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md)

Native QA brief: [`W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md`](W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md)

Original rendered-review result: [`W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md`](W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md) — archived on `docs/w6-04-file-library-rendered-review-result` at `1aab5bb414ccbf94fc1afd9760072153fb2331da`.

Focused revalidation result: [`W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md`](W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md) — archived on the same evidence branch at `4c6075a1dd1f3c7e5bfe4c86324a23be16150287`.

## Authorization basis

The real Windows/Tauri rendered review reported:

- P0/P1: none;
- one reproducible P2 at a `1282×862` native window: the File Library Filter popover was obscured/overlapped by the left-side workspace region and could not be operated reliably;
- bounded implementation decision: **ACTIVATE BOUNDED W6-04 IMPLEMENTATION**;
- requested remediation scope: filter-popover positioning, workspace/viewport boundary handling and keyboard focus, followed by corresponding rendered re-verification.

The full Phase-A result and focused revalidation are now durably available on the remote evidence branch. Final W6-04 closeout may therefore cite the native observations directly; it must still preserve any `UNVERIFIED` item exactly as recorded.

## Problem statement

The original filter surface was rendered as an absolutely positioned child of the command-bar action container:

`FileLibraryFilterPopover → absolute right-0 top-[calc(100%+8px)]`

That placement was aware of the trigger container but not the measured File Library workspace boundary. In medium/narrow native windows the panel could cross the File Library's safe left edge or compete with higher workspace overlay layers even though it technically remained within raw `vw` width.

This violated the W2 visual contract that responsive decisions are based on **measured File Library workspace width after AppShell consumes its sidebar/padding**, not raw monitor/window width.

## Authorized production change

Only the following changes were authorized:

1. Anchor the existing Filter popover to its existing trigger using measured geometry.
2. Bound horizontal placement to the current `.file-library-workspace` rectangle plus a small safe gutter.
3. Bound vertical placement to the usable workspace/viewport rectangle; flip above the trigger when lower space is insufficient.
4. Preserve bounded internal scrolling when vertical space is constrained.
5. Keep the panel above temporary local workspace overlays without creating a new persistent overlay authority.
6. Preserve existing filter/query semantics and saved-view authority unchanged.
7. Preserve open focus into the first filter control, Escape/Done return-to-trigger behavior, and keep Tab traversal within the open filter dialog.
8. Add focused regression coverage including the observed `1282×862` geometry.

## Validation result

All required automated evidence passed on candidate `1aab52bb...`:

- typecheck / frontend tests / architecture checks;
- frontend build;
- W2-01 browser regression;
- W2-10 responsive/accessibility browser gate;
- W2-11 integrated browser/performance gate;
- routed Library & Content performance;
- Performance profile;
- Windows quality aggregation;
- macOS quality aggregation.

Focused real Windows/Tauri revalidation observed:

- `1282×862` panel geometry/occlusion: **PASS**;
- internal scroll and control reachability: **PASS**;
- initial focus: **PASS**;
- Tab/Shift+Tab containment and wrap: **PASS**;
- Escape restore: **PASS**;
- Done restore: **PASS**;
- real File Type filter application and Clear recovery: **PASS** (`1/1` → `9/9`);
- approximately `1041×862` narrow-window smoke: **PASS**;
- real above-placement observation: **UNVERIFIED** because a safe trigger-near-bottom native condition was not available.

Final native decision: **PASS — W6-04 P2 CLOSED / NO FURTHER W6-04 IMPLEMENTATION REQUIRED**.

## Explicit non-goals retained

This Track did not:

- redesign the File Library command bar;
- change filter fields, filter semantics or Query V2 authority;
- change Saved Views;
- change Library/Browse mode authority;
- modify Preview behavior;
- modify navigation/context SideSheet ownership;
- add a new overlay manager or durable UI store;
- start Windows Quick Preview experience work;
- execute release-path installer/SmartScreen/Explorer Preview Handler acceptance;
- create a tag or GitHub Release;
- use Codex Review.

## Release relationship

This bounded W6-04 remediation does not authorize publication. `v0.1.40` remains **DEFERRED / DO NOT PUBLISH**.

The product owner has additionally directed that the project not proceed directly from W6-04 into release acceptance. The next maturity work must first address whole-product native experience coverage, visual-system coherence and the material Windows/macOS Quick Preview experience gap. Native QA will be used as a stage-level gate rather than after every small implementation task.
