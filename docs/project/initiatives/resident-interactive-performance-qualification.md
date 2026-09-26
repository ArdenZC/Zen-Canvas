# Resident / Interactive Performance Qualification

Status: **ACTIVE / BLOCKED — PERFORMANCE REVIEW REQUIRED; implementation: one bounded managed-scan traversal/QoS repair plus qualification evidence**

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

## Qualification execution

Baseline observations on Windows repeatedly missed the unchanged managed-scan pressure first-page p95 target; macOS also recorded a miss. Source inspection confirmed that a one-CPU scan lease creates a new one-thread Rayon pool, moving traversal away from the scanner worker carrying background QoS. This continuation authorized only mapping a one-CPU lease to serial traversal and retaining a lease-bounded Rayon pool for grants above one CPU. It did not alter the 2x target, scheduler admission, durable scan authority or platform capacity. Exact code-head measurements at `28ffd3db` show that Windows still misses its full Workspace Foundation observation and all three independent observations; each structural gate and post-release progress check passes. The three macOS managed-scan observations meet target and structural gates, but its exact resident app still aborts before `tray_ready`.

A Windows background-progress HARD failure, macOS background-process abort and four historical browser Preview misses remain blocking. All observations, including subsequent successful observations, remain evidence. The test-only 1–4 effective-slot causal matrix completed on exact `28ffd3db`: its 3-slot row missed 2x, the other rows met, and there was no monotonic increase with slot count; no production tuning is justified by this result. On the same exact source, five browser-only repeats per OS met mock Preview/Browse targets with raw samples retained, but native UI remains unverified and the four historical Preview misses remain. The exact macOS resident run aborts at `-6` before `tray_ready`; the latest bounded LLDB rerun timed out without a backtrace, while an earlier raw trace from the same binary SHA shows the tray-icon encoding/setup path without identifying whether Zen input, the dependency or Apple runtime is causal. The exact Windows resident app and separate service pass their observational-memory checks; managed-scan latency still misses on all four Windows qualification observations. The Track is not complete and owner review has not passed. See the [qualification result](../tasks/ZB-RESIDENT-INTERACTIVE-PERFORMANCE-QUALIFICATION-RESULT.md) for exact source identities, resident limitations, raw artifacts, harness repair history and CI disposition. PR #269 remains Draft. AI Semantic Authority remains gated.

## Non-goals

Release publication, SmartScreen/UAC evidence, macOS release qualification, visual redesign, Rules migration, onboarding, AI semantic implementation, new Search architecture, new durable authorities, or relaxed performance thresholds are out of scope.
