# W6-04 — File Library Calm-Surface — Closeout Result

Status: **COMPLETE CANDIDATE — MERGE PENDING**

Implementation baseline: `master@9895079a4ebb1e810b8c42d6a74b24ba147c6645`.

Validated implementation candidate: `1aab52bb63f6c16e28ea9880c4a4afe52594c0c8`.

Validated tree: `73f2868aef6e2bd03d44104866652f9c88056d13`.

Implementation PR: `#195` — `fix(w6-04): bound File Library filter popover`.

Hosted CI: `33959447388` — **SUCCESS**.

## Evidence chain

Phase A native rendered review:

- branch `docs/w6-04-file-library-rendered-review-result`;
- commit `1aab5bb414ccbf94fc1afd9760072153fb2331da`;
- result `W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md`;
- no P0/P1;
- one P2 at a real `1282×862` Windows/Tauri window: Filter popover occlusion/unreliable operation;
- decision: **ACTIVATE BOUNDED W6-04 IMPLEMENTATION**.

Focused native revalidation:

- same evidence branch;
- commit `4c6075a1dd1f3c7e5bfe4c86324a23be16150287`;
- result `W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md`;
- tested exact implementation SHA/tree `1aab52bb...` / `73f2868a...`;
- result: **PASS — W6-04 P2 CLOSED**;
- P0 `0`, P1 `0`, P2 open `0`, P3 `0`;
- final implementation recommendation: **NONE**.

## Accepted production change

The only production surface changed by W6-04 Phase B is `FileLibraryFilterPopover` presentation/focus behavior.

Accepted behavior:

- panel placement is bounded to the measured File Library workspace rather than raw viewport assumptions;
- medium/narrow windows clamp safely without left-workspace occlusion;
- constrained height retains internal scrolling and reachable lower controls;
- above-placement is supported by implementation/unit coverage when lower vertical space is insufficient;
- opening focuses the first filter control;
- Tab/Shift+Tab stay inside the dialog and wrap;
- Escape and Done return focus to the Filter trigger;
- real filter changes continue through the existing Query V2 path;
- no filter semantics, Saved View, Library/Browse, Preview or filesystem authority changed.

## Automated evidence

CI `33959447388` passed:

- source checkout / evidence contract;
- change scope / routing contract;
- project governance;
- frontend tests and architecture checks;
- frontend build;
- W2-01 real browser regression;
- W2-10 interaction/accessibility/responsive browser gate;
- W2-11 integrated experience/performance browser gate;
- routed Library & Content performance;
- Performance profile;
- Windows quality aggregation;
- macOS quality aggregation.

## Native evidence

Real Windows/Tauri focused revalidation observed:

- `1282×862` geometry and occlusion: PASS;
- internal scrolling / lower controls reachable: PASS;
- initial focus: PASS;
- Tab/Shift+Tab containment and wrap: PASS;
- Escape focus restoration: PASS;
- Done focus restoration: PASS;
- real File Type filter application: PASS (`1/1`);
- Clear recovery: PASS (`9/9`);
- narrow-window smoke at approximately `1041×862`: PASS;
- real above-placement/vertical-flip condition: **UNVERIFIED** because it could not be manufactured safely on the native host.

The `UNVERIFIED` vertical-flip observation is not promoted to PASS by unit coverage.

## Broader W6-04 review truth retained

The earlier full File Library rendered review also retained several `UNVERIFIED` items that W6-04 did not need to force into this focused revalidation, including bounded Narrator/display-scaling and some non-filter scenarios. They remain truthful evidence gaps, not failures and not release acceptance.

W6-04 does not claim:

- accessibility certification;
- NSIS/SmartScreen/Unknown Publisher acceptance;
- Explorer Preview Handler acceptance;
- macOS Gatekeeper/VoiceOver acceptance;
- public-release readiness.

## Final W6-04 decision

> **W6-04 File Library calm-surface review/remediation is complete after merge of #195. No further W6-04 implementation is required.**

The product owner has separately determined that Zen Canvas remains visually/product-experience immature at the whole-product level. Therefore W6-04 closeout does **not** advance directly to release acceptance.

## Next maturity direction

Native QA becomes a **stage-level gate**, not a per-task requirement.

The next maturity program must cover, before release re-entry:

1. whole-product native experience audit across major user journeys and states;
2. a coherent Zen visual/design system and UX target;
3. staged reconstruction/polish of the presentation layer while preserving proven backend authorities;
4. a dedicated cross-platform Quick Preview experience Track, improving the existing Windows `ZenFloatingQuickPreview` rather than creating a second Preview architecture;
5. whole-product native regression after the redesign batch;
6. release re-entry only after product-owner maturity acceptance.

`v0.1.40` remains **DEFERRED / DO NOT PUBLISH**.
