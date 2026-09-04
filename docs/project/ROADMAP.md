# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate a later Wave merely because an earlier Wave completes. Long-horizon product direction and Wave boundaries remain owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-09-04

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

### TD-014 — Cleanup Ledger Physical Identity Normalization

**COMPLETE / CLOSED.** This bounded maintenance initiative normalized the Safe Trash cleanup ledger from schema 34 to 35 with an explicit macOS source-volume component, raw source/Trash/Claim file IDs and fail-closed handling for ambiguous or wholly untagged historical evidence. Restore Claim binds to the verified Trash identity; existing cross-volume Restore content-identity behavior and non-macOS optional physical-ID semantics remain intact.

Accepted implementation baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`. Final scope and validation evidence are recorded by the [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md).

## Current

### W5 — Release / Hardening

Status: **ACTIVE — implementation; W5-01 Release Baseline & Gap Audit next**

W5 is the final stabilization/release-hardening Wave defined by the Master Development Plan. It is activated from `master@377ec3b5d91597ddab82fdff821b5ac6bb3b570a` after W4 and TD-014 are independently complete/closed and current truth is between initiatives.

W5-00 is documentation/governance only. The first execution Track is W5-01, which must build a truthful release baseline and evidence-gap matrix before downstream implementation work is selected. The audit must distinguish `Implemented`, `Validated`, `Packaged` and `Released`, preserve existing `UNVERIFIED` / `DEFERRED` classifications, and rank work by actual release risk rather than by technical-debt age.

W5 focus remains bounded to:

- performance, long-session stability and resource steady state;
- cancellation/leak/handle audits;
- supported-platform behavior and real fixtures;
- accessibility, keyboard behavior and release-facing visual/interaction polish;
- security/materialization/provider hardening;
- packaging, signing/notarization, update and publication readiness;
- technical-debt deletion only where replacement/equivalence is already proven and the deletion materially reduces release risk.

No major feature expansion, new supported platform, authority redesign or speculative refactor is authorized by W5 activation.

Authority: [W5 initiative](initiatives/W5-release-hardening.md), [W5-00 activation](tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md), [W5-01 baseline/gap audit](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-CODEX.md).

## Future sequencing

W5-01 determines the downstream W5 execution Tracks from evidence. No fixed implementation queue is authorized before that audit, and no later feature Wave is implicitly created by W5 activation.

## Sequencing rule

Completed Waves and bounded maintenance initiatives remain historical outcomes. W5 is now the single active initiative in implementation phase. Release/tag/publication state does not change merely because W5 is active; publication requires explicit later evidence and action.
