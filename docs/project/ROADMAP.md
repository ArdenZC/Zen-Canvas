# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate a later Wave merely because an earlier Wave completes. Long-horizon product direction and Wave boundaries remain owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-09-02

## Completed

### G1 — Engineering OS

**COMPLETE.** Project-state, architecture-ownership, technical-debt, workflow and closeout rules are durable.

### M1 / M1.1 — Mutation correctness and portability closeout

**COMPLETE.** Mutation correctness, provider and portability remediation are closed at their reviewed baselines.

### W0 — File Library / Preview specification

**COMPLETE.** W0 froze the Library/Browse product model, identity contracts, Preview Core/Host boundaries, Read/Materialization and WorkScheduler ownership, performance gates and Wave sequencing.

### W1 — File Library / Preview Foundation

**COMPLETE.** W1 delivered the shared runtime foundation used by later Waves: WorkspaceSession, Browse Core, Location Core, WorkScheduler, Preview Contract Core, Materialization/Read Gate, Thumbnail Infrastructure, change/refresh and scale/performance validation.

### W2 — File Library 2.0 Experience

**COMPLETE / CLOSED.** W2 delivered one File Library workspace with Library/Browse modes, shared virtualized presentation, Context/Inspector, platform-adaptive navigation, managed Query V2 semantics, bounded Browse search and deterministic interaction ownership.

Authority and final closeout evidence: [W2 initiative](initiatives/W2-file-library-experience.md) and [W2-12 closeout](tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md). Relevant deferred or unverified constraints remain recorded there, including Recent authority, unavailable native/provider fixtures, native manual accessibility/display evidence and TD-015 compatibility retirement.

### W3 — Preview Platform

**COMPLETE / CLOSED.** W3 turned the W1 Preview Core and W2 File Library workspace into the user-facing Zen Quick Preview platform while preserving the existing Preview/provider/read/materialization/scheduler and mutation authorities. W3 remains an in-app platform and does not authorize Finder or Explorer system integration.

Authority and final remediation pointers: [W3 initiative](initiatives/W3-preview-platform.md), [W3-11 closeout](tasks/W3-11-PREVIEW-PLATFORM-CLOSEOUT-CODEX.md) and [W3-R1 remediation](tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md). Native manual VoiceOver/Narrator, Retina/DPI and related native UI evidence remains separately classified where not executed.

### W4 — Native Integration

**COMPLETE / CLOSED.** W4 added the accepted Zen-internal macOS native Quick Look-backed path and the reviewed Windows Explorer Preview Handler boundary without creating a second Preview engine or provider/read authority. Windows deferred work uses ADR-0006 capture-before-defer; native package/release limitations remain explicit.

Final closeout baseline: `master@f45aae1c270d827d881abf620d8f09074c8d7d7e`; tree `d2596364c544e2bcc6648fbe0ff0465f1cc512a8`.

Authority pointers: [W4 final closeout](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md), [W4 initiative](initiatives/W4-native-integration.md), [ADR-0005](DECISIONS/0005-native-preview-host-boundary.md) and [ADR-0006](DECISIONS/0006-windows-preview-handler-bounded-capture.md). Production signing/notarization, cross-version older-DMG evidence, native manual display/accessibility evidence and unavailable provider fixtures remain deferred or **UNVERIFIED** as classified by the final closeout.

## Current

### No active initiative

Status: **BETWEEN INITIATIVES — no active initiative; W4 complete / closed; W5 eligible / inactive**

No initiative is active. W4 completion does not automatically activate W5.

## Future Waves

### W5 — Release / Hardening

**ELIGIBLE / INACTIVE.** W5 owns final release hardening, signing/notarization, update-channel and publication readiness, and the full supported-platform release matrix. W5 requires separate reviewed activation; no W5 taskbook or implementation is activated by this roadmap.

## Sequencing rule

Completed waves remain historical outcomes. The project is currently between initiatives; W5 is the next eligible Wave but remains inactive until separately authorized and activated.
