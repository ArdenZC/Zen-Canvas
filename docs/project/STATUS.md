# Zen Canvas Project Status

Last verified: 2026-09-05

## Current baseline

- Default branch: `master`.
- W6-02 closeout merge / W6-03 implementation baseline: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`.
- W6-03 validated production head: `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`.
- W6-03 validated production tree: `9e4c93011f330e108383f7ddcf71d478974244f3`.
- W6-03 hosted production CI `33956098213`: **SUCCESS**.
- W6-03 final PR-head CI `33956529018`: **SUCCESS**.
- W6-03 squash merge: `master@9fd34956c8907810fea676e643202ea735af46df`; tree `237d63c842a200eba1058d206c9dc89a7b0e6ebf`.
- Current execution state: **W6-04 ACTIVE — specification only / fresh rendered evidence review; production implementation not yet authorized**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **COMPLETE / CLOSED**.
- W6 — Product Maturity Audit: **ACTIVE — specification only / evidence review**.
- W6-01 — Product Maturity Audit: **COMPLETE — PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**.
- W6-02 — First Value & Recovery Maturity: **COMPLETE / MERGED**.
- W6-03 — Product Hierarchy & Progressive Disclosure: **COMPLETE / MERGED**.
- W6-04 — File Library Calm-Surface Rendered Review: **ACTIVE — specification only / evidence collection**.
- W6-01 overall maturity assessment before W6 implementation: approximately **2.9 / 5**.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`; W6 does not currently authorize a version change.
- Database schema: `35`.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — specification only; W6-04 fresh rendered/native File Library evidence review active**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current Track authority: [W6-04 File Library Rendered Review Activation](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md).

Codex/native execution brief: [W6-04 File Library Rendered Review Codex Brief](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md).

Latest completed implementation result: [W6-03 Product Hierarchy & Progressive Disclosure Result](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

Audit authority: [W6-01 Product Maturity Audit Result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

W6-04 currently authorizes observation/specification only. Its first obligation is to inspect the real current File Library after W6-03 using fresh rendered evidence. Production UI changes require a later bounded implementation activation based on that result.

## W6-03 accepted result

W6-03 closes the remaining M1 hierarchy/progressive-disclosure implementation set while preserving the safety model:

- Automation is no longer a permanent sidebar peer, while the Rules workspace remains supported through Settings and command/deep-link paths;
- healthy disabled/loading AI no longer occupies permanent sidebar chrome; enabled local/cloud and actionable failure states remain visible;
- ordinary Settings navigation is reduced from 11 peer sections to eight user-intent categories;
- Global Index, Platform Diagnostics and Managed Scopes remain real technical sections but are progressively disclosed rather than peer navigation items;
- legacy/deep-link requests reveal and focus the truthful retained technical section while mapping navigation highlight to the canonical user-intent category;
- About no longer foregrounds developer mode or raw build/search exclusions; those details remain behind Advanced Settings / developer disclosure;
- no durable filesystem/recovery/index/provider authority, schema, version, updater/signing policy or release state changed.

Exact production evidence is `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`, tree `9e4c93011f330e108383f7ddcf71d478974244f3`, CI `33956098213` **SUCCESS**. Final closeout/current-truth PR head `5df50d12c8e65e6e98315165a6b2801e39198b41` passed CI `33956529018` and was squash-merged as `master@9fd34956c8907810fea676e643202ea735af46df`.

## W6-04 evidence objective

W6-01 identified `W6-M2-001`: File Library is functionally rich but its default chrome may remain control-dense. Its disposition was **VISUALLY REVIEW, THEN SIMPLIFY**.

The native Computer Use environment is now reported capable of controlling Windows desktop applications again. W6-04 therefore uses the current master rather than historical browser mock evidence to inspect:

- the real native File Library default hierarchy;
- Library/Browse switching;
- search/filter and selection states;
- Preview entry/return;
- wide/medium/narrow native window states;
- light/dark and Chinese/English samples where practical;
- bounded keyboard/focus smoke;
- bounded Narrator smoke if genuinely available;
- one real display-scaling scenario if safely available.

This evidence may close `W6-M2-001` without code changes or may justify a later bounded W6-04 implementation activation.

It does **not** claim full accessibility certification or W6-05 release acceptance.

## Native/manual evidence boundary

Historical W5-04 manual/native acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED**. Restored native control does not retroactively qualify the historical W5 candidate.

W6-04 may collect current-product native rendered/input/accessibility/display observations relevant to File Library. W6-05 remains the owner of a fresh release candidate and release-path evidence including:

- NSIS installation/uninstallation;
- SmartScreen / Internet-zone / Unknown Publisher observations;
- Explorer Preview Handler native focus/keyboard acceptance;
- macOS DMG / Gatekeeper / VoiceOver acceptance on Apple Silicon;
- fresh release-artifact provenance/hashes;
- genuine external-volume/network/provider/multi-display/cross-version fixtures.

## Publication state

Current release state remains:

> **Validated product implementation; public publication deferred for product maturity.**

The [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains **DEFERRED / DO NOT EXECUTE**.

W6-04 rendered review does not authorize publication, signing/notarization work, a version change, a tag or a GitHub Release.

## Strengths W6 must preserve

The maturity program continues to protect:

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot handling;
- Preview cancellation/fallback;
- Organization Plan review → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- Global Search ordering/no-source/IME semantics;
- local/cloud/provider consent boundaries, including fail-closed cloud AI credential activation;
- exact-SHA release qualification;
- large-library performance gates.

The objective remains a simpler, calmer product surface over these strengths, not a subsystem rewrite.

## W6 sequencing

### W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.** Result: [W6-02 closeout](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

### W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE / MERGED.** Result: [W6-03 closeout](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md). Squash merge: `master@9fd34956c8907810fea676e643202ea735af46df`.

### W6-04 — File Library Calm-Surface Polish

**ACTIVE — specification only / rendered evidence review; implementation not yet authorized.**

Activation: [W6-04 rendered-review activation](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md).

The evidence result must choose either `NO W6-04 IMPLEMENTATION REQUIRED` or `ACTIVATE BOUNDED W6-04 IMPLEMENTATION` before production code changes begin.

### W6-05 — Public Release Experience & Native Acceptance

Later release re-entry Track after remaining maturity implementation closes. It owns fresh current-candidate native/manual acceptance, release-experience evidence, fresh exact-SHA qualification and a new publication decision.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.
- Historical W5-04 SmartScreen/Gatekeeper/manual native acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED**, not PASS.
- Browser/UI automation evidence must not be promoted into native GUI acceptance.
- Accessibility certification is not claimed.

## First-release policy truth

The W5 distribution policy remains intended if/when maturity is later accepted:

- GitHub Releases manual distribution;
- Windows x64 NSIS;
- macOS 13+ Apple-Silicon DMG;
- no automatic/background update checks;
- no in-app updater;
- updater key/endpoint/manifest deferred;
- Windows Authenticode not provided;
- Apple Developer ID/notarization/stapling not provided.

W6 explicitly recommends **not** adding updater/signing/general feature breadth as a substitute for product maturity.

## Durable authority pointers

- Active initiative: [W6 initiative](initiatives/W6-product-maturity-audit.md).
- Current Track: [W6-04 rendered review activation](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md).
- Codex/native QA brief: [W6-04 Codex brief](tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md).
- Latest implementation result: [W6-03 result](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).
- Maturity audit: [W6-01 result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).
- Historical deferred native/manual result: [W5-04 result](tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md).
- Deferred publication action: [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md).
