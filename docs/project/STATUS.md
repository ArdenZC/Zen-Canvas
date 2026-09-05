# Zen Canvas Project Status

Last verified: 2026-09-05

## Current baseline

- Default branch: `master`.
- W6-03 squash merge / W6-04 baseline: `master@9fd34956c8907810fea676e643202ea735af46df`; tree `237d63c842a200eba1058d206c9dc89a7b0e6ebf`.
- W6-04 evidence-only activation merge: `master@9895079a4ebb1e810b8c42d6a74b24ba147c6645`.
- W6-04 bounded implementation candidate: `1aab52bb63f6c16e28ea9880c4a4afe52594c0c8`; tree `73f2868aef6e2bd03d44104866652f9c88056d13`.
- W6-04 implementation PR: `#195` — `fix(w6-04): bound File Library filter popover`.
- W6-04 hosted CI `33959447388`: **SUCCESS** across source/governance, frontend tests/architecture, build, W2-01, W2-10, W2-11, routed Library & Content performance, Performance profile, Windows quality and macOS quality.
- W6-04 native revalidation: **PASS — previous P2 closed; P0=0, P1=0, P2 open=0**.
- Current execution state: **ACTIVE — implementation; W6-04 bounded remediation validated, merge/closeout pending**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **COMPLETE / CLOSED**.
- W6 — Product Maturity Audit: **ACTIVE — implementation; W6-04 bounded remediation closeout in progress**.
- W6-01 — Product Maturity Audit: **COMPLETE — PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**.
- W6-02 — First Value & Recovery Maturity: **COMPLETE / MERGED**.
- W6-03 — Product Hierarchy & Progressive Disclosure: **COMPLETE / MERGED**.
- W6-04 — File Library Calm-Surface Review / Bounded Remediation: **IMPLEMENTATION VALIDATED — merge/closeout pending**.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`.
- Database schema: `35`.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — implementation; W6-04 bounded remediation validated, merge/closeout pending**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current implementation authority: [W6-04 Bounded Implementation Activation](tasks/W6-04-FILE-LIBRARY-BOUNDED-IMPLEMENTATION-ACTIVATION.md).

Original native rendered review: [W6-04 File Library Rendered Review Result](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md) — durably archived on `docs/w6-04-file-library-rendered-review-result` at `1aab5bb414ccbf94fc1afd9760072153fb2331da`.

Focused native revalidation: [W6-04 Filter Popover Native Revalidation Result](tasks/W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md) — durably archived on the same evidence branch at `4c6075a1dd1f3c7e5bfe4c86324a23be16150287`.

## W6-04 evidence and implementation result

The first full Windows/Tauri rendered review found no P0/P1 issue and exactly one material P2: at a `1282×862` native window the File Library Filter popover was substantially occluded by the left workspace region and could not be operated reliably.

The bounded implementation candidate `1aab52bb...` changes only Filter-popover presentation/focus behavior:

- workspace-aware fixed positioning rather than raw `absolute right-0` placement;
- horizontal clamping to the measured `.file-library-workspace` safe bounds;
- vertical available-space handling with above-placement support;
- bounded internal scrolling;
- preserved Query V2/filter authority and Saved View semantics;
- focus enters the first control;
- Tab/Shift+Tab remain contained;
- Escape/Done return focus to the Filter trigger.

Focused native revalidation on real Windows/Tauri at `1282×862` observed:

- geometry/occlusion: **PASS**;
- internal scrolling: **PASS**;
- initial focus: **PASS**;
- Tab/Shift+Tab containment and wrap: **PASS**;
- Escape restore: **PASS**;
- Done restore: **PASS**;
- real File Type filtering: **PASS** (`1/1`, then Clear restored `9/9`);
- narrow-window smoke at approximately `1041×862`: **PASS**;
- native above-placement/vertical-flip observation: **UNVERIFIED** because a safe real trigger-near-bottom condition was not available; unit coverage remains supporting evidence only.

Final native decision: **PASS — W6-04 P2 CLOSED / NO FURTHER W6-04 IMPLEMENTATION REQUIRED**.

## Product maturity direction after W6-04

The product owner has explicitly rejected the assumption that green CI implies a mature product. Zen Canvas still needs broader real-product UX/visual validation before release re-entry.

Native Computer Use should be used as a **stage gate**, not after every small task. Normal implementation Tracks continue to rely on Code + Browser evidence; native/product evidence is collected after coherent batches or when a defect is specifically native/rendering-dependent.

The next maturity sequence will be re-planned around:

1. whole-product native experience audit across major user flows;
2. a coherent Zen visual/design system and UX redesign target;
3. staged reconstruction of the presentation layer while preserving durable backend/authority contracts;
4. a dedicated cross-platform Quick Preview experience Track, with particular focus on the current Windows/macOS experience gap;
5. whole-product native regression after the redesign batch;
6. release re-entry only after the product owner accepts product maturity.

This sequencing is not publication authorization and does not make every later subtask require native revalidation.

## Preview experience finding

The current File Library already contains `ZenFloatingQuickPreview`; Windows therefore does not need a second Preview architecture. The product-owner finding is that the **experienced Windows Quick Preview quality is materially below macOS Quick Look**, despite the existing Preview Core/Host architecture.

A later dedicated experience Track should improve the existing Windows first-party floating Quick Preview presentation/interaction/capability integration rather than replace Preview Core or treat Explorer Preview Handler as the flagship Zen preview experience.

## Native/manual evidence boundary

The W6-04 native evidence is current-product rendered/interaction evidence for File Library only. It is not release acceptance.

Historical W5-04 release-path acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED** and is not retroactively upgraded by W6-04.

Future release-path acceptance still owns, on a fresh exact candidate:

- NSIS install/uninstall;
- SmartScreen / Internet-zone / Unknown Publisher;
- Explorer Preview Handler native focus/keyboard acceptance;
- Apple-Silicon macOS DMG / Gatekeeper / VoiceOver;
- release artifact provenance/hashes;
- truthful handling of unavailable external-volume/provider/network/multi-display/cross-version fixtures.

## Publication state

Current release state remains:

> **Product implementation under maturity work; public publication deferred.**

The [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains **DEFERRED / DO NOT EXECUTE**.

No W6-04 result authorizes a version change, tag, GitHub Release, signing/notarization work or publication.

## Strengths maturity work must preserve

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot behavior;
- Preview Core cancellation/fallback/materialization boundaries;
- Organization Plan review → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- Global Search ordering/no-source/IME semantics;
- AI local/cloud/provider consent boundaries;
- exact-SHA CI/release qualification;
- large-library performance gates.

The objective is now to make the existing product coherent, attractive and trustworthy without throwing away these durable engineering strengths.

## Review policy

W6 work must not use Codex Review. Codex Computer Use may be used for bounded or stage-level native QA/evidence collection. Merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
