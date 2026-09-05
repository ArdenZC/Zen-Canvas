# W6-04 — File Library Calm-Surface Bounded Implementation — Activation

Status: **ACTIVE — implementation; bounded P2 remediation only**

Implementation baseline: `master@9895079a4ebb1e810b8c42d6a74b24ba147c6645`.

Parent evidence Track: [`W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md`](W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md)

Native QA brief: [`W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md`](W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md)

## Authorization basis

The real Windows/Tauri rendered review completed on the dedicated result branch and reported:

- P0/P1: none;
- one reproducible P2 at a `1282×862` native window: the File Library Filter popover is obscured/overlapped by the left-side workspace region and cannot be operated reliably;
- bounded implementation decision: **ACTIVATE BOUNDED W6-04 IMPLEMENTATION**;
- requested remediation scope: filter-popover positioning, workspace/viewport boundary handling and keyboard focus, followed by corresponding rendered re-verification.

The product owner supplied the native result summary and explicitly continued the project from that result.

The Codex-reported local result commit `1aab5bb4` is not currently visible on the GitHub remote. Therefore this activation may authorize the bounded P2 repair, but final W6-04 closeout must **not** claim the full Phase-A native result is durably archived until the result document/commit is pushed or equivalent native evidence is reproduced and recorded.

## Problem statement

The current filter surface is rendered as an absolutely positioned child of the command-bar action container:

`FileLibraryFilterPopover → absolute right-0 top-[calc(100%+8px)]`

That placement is aware of the trigger container but not the measured File Library workspace boundary. In medium/narrow native windows the panel can cross the File Library's safe left edge or compete with higher workspace overlay layers even though it technically remains within raw `vw` width.

This violates the W2 visual contract that responsive decisions are based on **measured File Library workspace width after AppShell consumes its sidebar/padding**, not raw monitor/window width.

## Authorized production change

Only the following changes are authorized:

1. Anchor the existing Filter popover to its existing trigger using measured geometry.
2. Bound horizontal placement to the current `.file-library-workspace` rectangle plus a small safe gutter.
3. Bound vertical placement to the usable workspace/viewport rectangle; flip above the trigger when lower space is insufficient.
4. Preserve bounded internal scrolling when vertical space is constrained.
5. Keep the panel above temporary local workspace overlays without creating a new persistent overlay authority.
6. Preserve existing filter/query semantics and saved-view authority unchanged.
7. Preserve open focus into the first filter control, Escape/Done return-to-trigger behavior, and keep Tab traversal within the open filter dialog.
8. Add focused regression coverage including the observed `1282×862` geometry.

## Explicit non-goals

Do not:

- redesign the File Library command bar;
- change filter fields, filter semantics or Query V2 authority;
- change Saved Views;
- change Library/Browse mode authority;
- modify Preview behavior;
- modify navigation/context SideSheet ownership;
- add a new overlay manager or durable UI store;
- start the Windows Quick Preview parity work discussed after the native review;
- execute W6-05 installer/SmartScreen/Explorer Preview Handler release acceptance;
- create a tag or GitHub Release;
- use Codex Review.

## Required regression evidence

Before closeout require:

- `npm run typecheck`;
- focused Vitest coverage for workspace-bound positioning;
- existing frontend/architecture suite;
- W2-01 browser regression;
- W2-10 responsive/accessibility browser gate;
- W2-11 integrated browser/performance gate;
- fresh native Windows re-verification at or near `1282×862` confirming the popover is fully reachable and keyboard-operable.

The browser gates do not replace the final native rendered re-verification.

## Acceptance criteria

The P2 closes only if all are true:

- at the observed medium native window the filter panel stays within the File Library workspace safe bounds;
- the panel is not obscured by the left workspace region;
- lower-space exhaustion flips/limits the panel without clipping controls;
- the panel remains internally scrollable when height is constrained;
- opening moves focus into the filter controls;
- Tab/Shift+Tab remain inside the open dialog;
- Escape and Done close and return focus to the existing Filter trigger;
- filter values continue to update through the existing Query V2 path;
- no unrelated File Library chrome or authority changes are introduced.

## Release relationship

This bounded W6-04 remediation does not authorize publication. `v0.1.40` remains **DEFERRED / DO NOT PUBLISH**.

A separate Windows Quick Preview experience Track is expected before W6-05 because the product owner identified a material Windows/macOS Preview-experience parity gap. That work is explicitly outside this P2 repair.
