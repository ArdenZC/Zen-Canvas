# Windows Global Index Recovery Remediation

Status: **ACTIVE / IMPLEMENTATION COMPLETE / OWNER CODE AND CI REVIEW PENDING.** Current disposition is owned by [STATUS](../STATUS.md).

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

- #323 is a reproduced Windows product-correctness defect with a known state-machine/transport root cause;
- #270 blocks future macOS resident/release qualification but does not block the current Windows product path;
- #283 is research-only and explicitly paused at `INCONCLUSIVE_LOW_DELTA`;
- open technical-debt items retain their own exit conditions and are not feature blockers by existence alone.

Therefore #323 is the next production remediation initiative.

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

Activation PR #325 is merged as `master@dbf05d3c503a1b79695186b9a8376143b8748305` / tree `1e9914c5c2d5567d6413cd35ee720b877469a405`; merge-after CI 37569675862 is **SUCCESS**. Implementation is ACTIVE and must start from the post-activation reconciliation master.

Implementation result: [issue #323 result](../tasks/WINDOWS-GLOBAL-INDEX-RECOVERY-323-RESULT.md). The candidate starts at post-activation reconciliation `e41fda178c6e6c8af48f8af63cc06453e8339c48` / tree `bb74979786955592473f01e76b74d62a3d4ed9b5`. Hosted code/CI review and separately authorized native Owner qualification remain distinct; #323 stays open.
