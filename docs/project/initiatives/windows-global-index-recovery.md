# Windows Global Index Recovery Remediation

Status: **COMPLETE / MERGED / CLOSED — SCOPED WINDOWS NATIVE RECOVERY OWNER ACCEPTED WITH EVIDENCE EXCEPTIONS; MERGE-AFTER MASTER CI SUCCESS.** Current disposition is owned by [STATUS](../STATUS.md).

Issue: [#323 — Windows Global Index recovery loses paused/rebuild state across service transport](https://github.com/ArdenZC/Zen-Canvas/issues/323)

Activation taskbook: [Windows Global Index Recovery Remediation — Activation](../tasks/WINDOWS-GLOBAL-INDEX-RECOVERY-323-ACTIVATION.md)

Baseline:

- `master@cfdde76db2e339f1572e889fa586170361e2d796`
- tree `d9dbf3f65ccacf4ab0201fab59ed36eb7825b53b`
- merge-after CI `37563539120 — SUCCESS`
- Schema 37
- package 0.1.40

## Why this is next

AI-only Product Migration #273 is complete and closed.

The remaining open work is intentionally separated:

- #323 is CLOSED / completed through PR #327 with scoped Owner acceptance and explicit evidence exceptions;
- #328 tracks transient SQLite-lock/unavailable degradation observed during #323 native qualification;
- #329 tracks clean-install Onboarding scan-scope save failure observed during the same qualification;
- #270 blocks future macOS resident/release qualification but does not block the current Windows product path;
- #283 is research-only and explicitly paused at `INCONCLUSIVE_LOW_DELTA`;
- open technical-debt items retain their own exit conditions and are being reconciled under #330 rather than treated as automatic feature blockers.

Post-#323 sequencing is owned by #330; this initiative is no longer active.

## Scope

Repair only the Windows Global Index recovery-state loss:

- preserve typed Paused semantics across desktop/service IPC;
- preserve durable rebuild-required semantics for USN history discontinuity;
- remove correctness-critical diagnostic-string matching;
- automatically reach the existing admitted MFT rebuild path;
- keep permission-required for genuine permission/provider failure.

## Preserved architecture

- one Windows Global Index service;
- one desktop coordinator;
- current named-pipe protocol authority;
- current WorkScheduler / RuntimeResourceGovernor admission;
- `global_volumes` durable recovery truth;
- read-only metadata indexing;
- no user filesystem mutation authority.

## Exclusions

This initiative does not activate:

- #270 macOS runtime remediation;
- #283 further Preference research;
- generic technical-debt retirement;
- release publication;
- Preference Memory production;
- System One/Laya/Jev;
- Cleanup automation;
- autonomous filesystem mutation.

Activation PR #325 merged as `master@dbf05d3c503a1b79695186b9a8376143b8748305` / tree `1e9914c5c2d5567d6413cd35ee720b877469a405`; merge-after CI 37569675862 is **SUCCESS**. Implementation later completed and PR #327 squash-merged as `master@1619e335468c432da5a5b3a6e246e1ea1c7db32c` / tree `70c1e97eb68a01506a796140277af640a5e0fe60`; merge-after master CI 37722150775 is **SUCCESS**. Issue #323 is CLOSED / completed.

Implementation result: [issue #323 result](../tasks/WINDOWS-GLOBAL-INDEX-RECOVERY-323-RESULT.md). Hosted deterministic/service evidence and scoped native Owner acceptance remain distinct; the historical native qualification report remains INCOMPLETE with its explicit evidence exceptions.
