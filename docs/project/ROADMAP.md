# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate later work merely because an earlier Track completes. Long-horizon product direction and Wave boundaries remain owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-09-05

## Completed

### G1 — Engineering OS

**COMPLETE.** Project-state, architecture-ownership, technical-debt, workflow and closeout rules are durable.

### M1 / M1.1 — Mutation correctness and portability closeout

**COMPLETE.** Mutation correctness, provider and portability remediation are closed at their reviewed baselines.

### W0 — File Library / Preview specification

**COMPLETE.** W0 froze the Library/Browse product model, identity contracts, Preview Core/Host boundaries, Read/Materialization and WorkScheduler ownership, performance gates and Wave sequencing.

### W1 — File Library / Preview Foundation

**COMPLETE.** W1 delivered the shared runtime foundation used by later Waves.

### W2 — File Library 2.0 Experience

**COMPLETE / CLOSED.** Authority and final closeout evidence: [W2 initiative](initiatives/W2-file-library-experience.md) and [W2-12 closeout](tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md).

### W3 — Preview Platform

**COMPLETE / CLOSED.** Authority and final remediation pointers: [W3 initiative](initiatives/W3-preview-platform.md), [W3-11 closeout](tasks/W3-11-PREVIEW-PLATFORM-CLOSEOUT-CODEX.md) and [W3-R1 remediation](tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md).

### W4 — Native Integration

**COMPLETE / CLOSED.** W4 added the accepted Zen-internal macOS native Quick Look-backed path and Windows Explorer Preview Handler boundary. Final closeout: [W4 final current truth](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

### TD-014 — Cleanup Ledger Physical Identity Normalization

**COMPLETE / CLOSED.** Accepted implementation baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`. Final evidence: [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md).

### W5 — Release / Hardening

**COMPLETE / CLOSED.** Final decision: **AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK**. Authority: [W5-06 result](tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md).

W5 final dispositions:

- W5-01 Release Baseline & Gap Audit: **COMPLETE / CLOSED**;
- W5-02 Release Qualification & Publication Safety Gate: **COMPLETE / CLOSED**;
- W5-03 Distribution / Update Strategy: **COMPLETE / CLOSED**;
- W5-04 Supported-Platform Manual Release Acceptance: **CLOSED BY EXPLICIT DEFERRAL — UNVERIFIED**;
- W5-05 Long-session / Performance Release Evidence: **SKIPPED — NO EVIDENCE-DERIVED TRIGGER**;
- W5-06 Release Candidate / Publication Decision: **COMPLETE / CLOSED — PUBLICATION AUTHORIZED WITH EXPLICIT ACCEPTED RESIDUAL RISK**.

Authorized release source:

- commit `8b573772d842b4996bc1c34161236fa47025cc83`;
- tree `67cf3da35d7556bb868746a9ae0a56725558a163`;
- version `0.1.40`;
- intended tag `v0.1.40`.

Automated release evidence on that exact candidate:

- `CI Full Validation` `33942690517`: **SUCCESS**;
- `Build Release Installers` `33943755887`: **SUCCESS**;
- Windows artifact `Zen-Canvas-Windows`, id `9962868134`;
- macOS artifact `Zen-Canvas-macOS`, id `9962728560`;
- Windows installer `Zen Canvas_0.1.40_x64-setup.exe`, SHA-256 `22e1416f39b9f2847b907419400528208422aba1d32defa99e8aed21b0827711`;
- macOS installer `Zen Canvas_0.1.40_aarch64.dmg`, SHA-256 `13f519199bbdf13c6242c0719e3a0358be0a9aa4263d2cb454864bf34441926f`;
- both checksum manifests match the produced installers;
- exactly two valid CycloneDX 1.6 SBOMs are present: Node and Rust.

The real SmartScreen/Unknown Publisher/Gatekeeper/native accessibility/focus/display path remains `UNVERIFIED / EXPLICITLY DEFERRED`. This is accepted residual publication risk, not PASS.

## Current

### No active initiative

Status: **BETWEEN INITIATIVES — no active initiative**

W5 is complete and closed. No later product initiative is implicitly active.

A separate operational publication action for `v0.1.40` is authorized but not yet executed. That action must bind the tag exactly to the accepted release candidate and pass the existing tag-triggered release workflow. It does not itself constitute a new initiative.

## Authorized operational action

[v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) is **AUTHORIZED / NOT EXECUTED**.

Publication constraints:

- `v0.1.40` must resolve exactly to `8b573772d842b4996bc1c34161236fa47025cc83`;
- no version bump is required or authorized merely to manufacture new evidence;
- the tag-triggered release workflow must satisfy exact-SHA qualification and final artifact verification;
- unsigned/no-updater/manual-acceptance truth must remain explicit;
- publication is not `Released` until the GitHub Release and its required assets are actually verified.

## Sequencing rule

The project is between initiatives. A future product initiative requires separate reviewed activation. The authorized `v0.1.40` publication action may be executed independently as a bounded operational release action; its success or failure must then be reflected in current truth without fabricating a release state.
