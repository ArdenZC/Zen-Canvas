# Resident / Interactive Performance Qualification

Status: **ACTIVE — implementation: qualification harness/evidence only; BASELINE MEASUREMENT FIRST; NO PRODUCT TUNING AUTHORIZED BEFORE A REPRODUCIBLE MISS**

Issue: [#268 — Resident / Interactive Performance Qualification](https://github.com/ArdenZC/Zen-Canvas/issues/268)

Branch: `perf/resident-interactive-qualification`

Activation baseline: `master@6d38208741d186988468ec92b632dd3669a03aa5` (Zero-Burden Cross-Track Audit Remediation / PR #267).

## Purpose

Close the final Zero-Burden performance gate before AI Semantic Authority. The Track must establish attributable resident-process evidence and credible interactive foreground evidence. Existing routed CI performance suites are supporting evidence, not a substitute for this qualification.

## Qualification principles

- Qualification first; optimization only after a reproducible miss and root-cause diagnosis.
- Measure the actual Zen resident process. Test-process RSS/PrivateUsage is not attributable evidence for the application.
- On Windows, measure the resident UI process and the exact-candidate Global Index service separately when the service is part of the qualification fixture.
- Record RSS / Windows PrivateUsage / handle count or macOS fd count / CPU observations without inventing a single cross-platform absolute RSS cap. Existing authority says no universal RSS limit; the HARD requirement is no unbounded monotonic resource-growth pattern.
- Background resident qualification must prove Main/Search/WebViews are absent and the process remains alive in its intended resident state.
- Interactive qualification retains existing File Library / Preview performance authority.
- Managed-scan pressure must use the real managed scanner and production WorkScheduler adapter. Foreground first-page p95 under pressure retains the existing <= 2x idle-baseline TARGET. TARGET MISS evidence must remain visible and may not be averaged away or reclassified as PASS.
- No schema, durable-authority, provider, filesystem-safety or product-scope redesign is authorized by this Track.

## Required evidence

1. Exact candidate identity and isolated profile.
2. True-process resident background measurements on Windows and hosted macOS where the platform can legally execute the background candidate.
3. Resource settlement / no-unbounded-growth evidence.
4. Existing Search / Browse / Preview HARD/TARGET performance gates on the exact candidate.
5. Dedicated repeated managed-scan foreground-pressure observations with raw idle/pressure p95 values and classifications.
6. Hosted Windows/macOS validation of any qualification harness.
7. A result document that distinguishes HARD PASS, TARGET MET, TARGET MISSED, OBSERVATIONAL, BLOCKED and UNVERIFIED.

## Gate to AI

AI Semantic Authority / AI-only Organize-Cleanup remains **GATED / NOT ACTIVE** until owner review accepts this Track. A reproducible interactive TARGET MISS or missing attributable resident evidence keeps the gate closed.

## Non-goals

Release publication, SmartScreen/UAC evidence, macOS release qualification, visual redesign, Rules migration, onboarding, AI semantic implementation, new Search architecture, new durable authorities, or relaxed performance thresholds are out of scope.
