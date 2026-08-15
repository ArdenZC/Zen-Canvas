# M1 — macOS Mutation Correctness Remediation V2

Status: active — implementation on `fix/macos-mutation-correctness-v2`

Start baseline: `master@d814ebbc2f623fe6719e0a54028c5c4183243902`

Authority: user-authorized high-risk correctness/security remediation; ADR
[`0002-macos-mutation-correctness-v2.md`](../DECISIONS/0002-macos-mutation-correctness-v2.md)

## Objective

Close the correctness gaps in the existing Apple Silicon macOS Full Feature
Parity implementation without adding product features, redesigning UI or
creating another mutation/recovery authority.

## Scope

- P1 claim pathname rebinding and wrong-object commit/delete prevention;
- namespace/content/provider identity separation and PREPARED journal ordering;
- iCloud/File Provider materialization and operation-aware coordination;
- real LocalPortable, NetworkPortable and ProviderCoordinated strategy paths;
- source-stable Copy/Duplicate and target-first cross-volume Move;
- metadata, xattr, ACL, resource-fork and hardlink-topology policy;
- implementation-backed runtime capabilities and Preview materialization truth;
- adversarial race/fault, metadata, semantic and namespace-performance coverage;
- Windows Replace capability correction and current-truth/security-document updates.

## Authority and non-goals

The existing Rust backend, SQLite ledgers, Operation Preview, operation
journal, Safe Trash, cleanup journal, Restore, reconciliation and expected
revision/fingerprint/physical-identity checks remain authoritative. No Mac-only
journal, queue, ledger, renderer executor, Endpoint Security component,
privileged helper or schema change is in scope.

No real provider or external-volume fixture may be described as validated unless
the fixture actually ran. Native contract evidence and real-fixture evidence
must remain separate.

## Work tracks

1. Claim namespace binding and stable error/recovery states.
2. Identity split and journal preparation without content-byte gating.
3. Provider coordinator semantics and portable strategy backends.
4. Copy/source stability, target-first cross-volume retirement and metadata
   preservation.
5. Capability/Preview contract, race/fault/performance gates and documentation.

Each track uses atomic commits and focused tests before the applicable full
validation workflow.

## Acceptance and evidence

The final report must include the starting/final SHA, commits, claim safety
proof, Permanent Delete wrong-delete metrics, Copy and cross-volume semantics,
metadata preservation classification, iCloud/Generic Provider support and
fixture status, runtime capability matrix, race results, performance evidence,
Windows regression and exact-head Fast/Full CI IDs. Unverified native UI,
provider, signing and physical-erasure claims remain explicit.
