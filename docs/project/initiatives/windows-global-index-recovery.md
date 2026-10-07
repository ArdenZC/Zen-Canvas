# Windows Global Index Recovery Remediation

Status: **ACTIVATION PR #325 UNDER OWNER REVIEW / IMPLEMENTATION NOT ACTIVE**

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

Implementation begins only after the activation is merged.
