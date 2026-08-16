# M1 — macOS Mutation Correctness Remediation V2

Historical record: this V2 record is superseded by
[`M1.1 — macOS Mutation Correctness V2.1`](M1-macos-mutation-correctness-v2-1.md)
for current provider, Safe Trash, portability and evidence truth. Its original
validation claims remain historical evidence only.

Status: complete — production implementation and exact-head validation landed on `master`

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

## Closeout

- Starting SHA: `d814ebbc2f623fe6719e0a54028c5c4183243902`.
- Final production SHA: `c802397930ce276de7902ee37d5927083f2912ed`.
- Exact-head Fast CI: [31878915359](https://github.com/ArdenZC/Zen-Canvas/actions/runs/31878915359).
- Exact-head Full Validation: [31878365268](https://github.com/ArdenZC/Zen-Canvas/actions/runs/31878365268).
- The production head was delivered to `master` with a normal fast-forward push;
  this documentation closeout is a successor commit and does not change the
  production SHA to which native evidence is bound.

### Commit sequence

`220cb5a`, `91e6570`, `8643ef6`, `7d4ca78`, `a3cd3c1`, `1d46bfe`, `6a4f81f`,
`0e48c1f`, `35825b6`, `55387e5`, `6608f31`, `57cc891`, `c802397`.

### Feature and capability matrix

| Capability | Windows | macOS | Evidence boundary |
| --- | --- | --- | --- |
| Copy / Duplicate | implemented | implemented | Native copy/source-presence tests passed |
| Rename / Move | implemented | implemented | Namespace claim and target publication gates passed |
| Replace | implemented | implemented | Replacement backup/restore parity passed; Windows capability contract passed |
| Safe Trash / Restore | implemented | implemented | Journal-backed native recovery tests passed |
| Permanent Delete | implemented | implemented | Quarantine/rebind safety tests passed; physical erase is not claimed |
| Cross-volume Move | implemented | implemented | Target-first native path and package/copy tests passed |
| Package mutation | implemented | implemented | Whole-package namespace and mixed corpus tests passed |
| iCloud | runtime-dependent | runtime-dependent | Awareness/strategy contract tested; no real fixture executed |
| Generic File Provider | runtime-dependent | runtime-dependent | Detection/coordination contract tested; no real fixture executed |
| External / network volumes | runtime-dependent | runtime-dependent | Capability probes and contract tests passed; no real fixture executed |

### Safety and race evidence

- Level A uses retained object identity for read/copy operations.
- Level B uses verified parent identity, current namespace-entry identity and
  retained object identity before destructive publication, retirement or delete.
- Level C uses operation-aware provider coordination and preserves the existing
  journal/reconciliation authority; provider item identity is not fabricated
  from a CloudStorage path hint.
- The Apple Silicon race gate ran 100,000 iterations. It reported
  `wrong_overwrite=0`, `wrong_commit=0`, `wrong_delete=0`, and
  `unrecoverable_loss=0`; no claim/stage artifacts remained. The low-level race
  harness does not emit separate rollback/manual-review counters, so those are
  not inferred as zero.
- Native restore fault injection after target commit reconciled to a completed
  restore; broader real-provider and external-volume recovery fixtures were not
  executed.

### Metadata and provider classification

- Mode, timestamps, package-tree metadata and supported xattrs are preserved by
  the native copy path or reported as an explicit degradation/error when the
  filesystem cannot preserve them.
- ACLs, resource forks, Finder metadata and hardlink topology are
  capability-dependent; the implementation does not silently claim parity when
  the native operation cannot prove preservation.
- iCloud and Generic File Provider operations use runtime materialization and
  coordination preconditions. The CI provider test confirmed ordinary local
  behavior and that cloud/provider fixtures are not implicitly materialized; it
  did not validate a real third-party provider account.

### Deferred or unverified

Real iCloud/File Provider, external APFS, exFAT and network-volume fixtures;
the named 100 GB sparse and 100k-entry mutation benchmarks; native rendered
visual/accessibility QA; signing/notarization; advanced Quick Look panel
integration; Endpoint Security/System Extension hardened mode; and a physical
SSD secure-erase guarantee remain unverified or outside scope. These evidence
limits do not restore a blanket macOS unsupported state.
