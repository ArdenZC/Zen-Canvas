# ADR-0002: macOS Mutation Correctness Remediation V2

Status: accepted — user-authorized high-risk remediation

Date: 2026-08-15

## Context

The Apple Silicon macOS parity implementation preserves the existing Operation
Preview, operation journal, Safe Trash and Restore authorities, but its first
correctness review identified several implementation gaps: a retained source
descriptor can be valid while its claim pathname has been rebound, journal
preparation can require a complete byte hash before provider materialization,
provider identity is inferred from a path namespace, coordination always uses
`ForMoving` and ignores accessor URLs, portable strategies share an APFS-only
claim path, Copy temporarily removes the source pathname, and cross-volume
source retirement is not target-first in every path.

The existing `FILE_IDENTITY_SEMANTICS.md` contract also conflated namespace
identity with content verification by requiring `full_hash` for all
journal-bound moves. That prevents safe metadata-only namespace operations and
blocks provider operations before their explicit materialization boundary.

## Decision

1. Keep Rust and SQLite as the only mutation/recovery authority. The existing
   Operation Preview, backend revalidation, operation journal, Safe Trash,
   cleanup journal and Restore ledgers remain unchanged as the durable chain.
2. Split operation identity into `NamespaceIdentity`, optional
   `ContentVerificationIdentity`, and `ProviderIdentity`. Prepared namespace
   operations require physical identity, namespace metadata and provider
   identity when truly available; complete content verification is required
   only when byte equivalence is part of the operation policy.
3. Require every macOS name-based destructive boundary to prove the verified
   parent, the current leaf entry obtained through the retained parent
   descriptor, and the retained object identity. Rebinding, disappearance,
   unreadability and identity mismatch become stable manual-review outcomes.
4. Make provider coordination operation-aware. The coordinator selects reading
   and writing options per operation and all filesystem work uses the URLs
   supplied by the accessor callback. Generic provider detection is never
   promoted to native item identity without a real native bridge.
5. Give LocalPortable, NetworkPortable and ProviderCoordinated distinct
   backends. A strategy is available only when its capability probe and minimum
   no-overwrite/recovery guarantees are implementation-backed; otherwise the
   specific runtime operation fails closed.
6. Keep Copy and Duplicate source namespaces stable. Cross-volume Move is
   target-first: stage, copy, preserve metadata, verify and publish the target
   before source retirement begins.
7. Make metadata preservation explicit. Unsupported xattrs, ACLs, resource
   forks, Finder metadata or hardlink topology produce a degradation warning,
   never silent parity claims.
8. Add exact-head Apple Silicon adversarial, fault, metadata and performance
   gates. Provider fixtures are reported separately as contract-tested,
   fixture-validated or not real-fixture verified.

## Non-goals

- Endpoint Security, System Extension or privileged helper;
- schema 35 or a new mutation/recovery database;
- renderer filesystem authority or a second operation queue;
- signing, notarization, advanced Quick Look or physical SSD erasure;
- Intel macOS, Rosetta, Universal binaries or Linux support;
- new macOS product features or UI redesign.

## Acceptance gates

- claim pathname replacement cannot commit, trash, restore, replace or delete
  the replacement object;
- Permanent Delete wrong-delete, wrong-commit, unexpected-overwrite and
  unrecoverable-loss metrics are zero;
- same-volume namespace operations do not read full file content;
- Copy keeps the source pathname present throughout the operation;
- cross-volume Move publishes and verifies the target before source retirement;
- provider PREPARED journaling does not require content bytes;
- coordination is operation-aware and consumes accessor URLs;
- portable strategy capability is probe-backed;
- Windows Replace capability is true when the existing backend is available;
- the PR/full race gate executes at least 10,000 iterations;
- final native evidence is bound to the exact pushed commit and current-truth
  records distinguish implementation, native contract and real fixture status.

## Consequences

The operation journal retains compatibility fields for existing rows, while
new preparation and recovery code no longer treats a missing content hash as a
namespace failure. Provider and non-native filesystems may refuse individual
operations when their runtime contract is insufficient, but macOS core local
Apple Silicon operations remain enabled after their real backend proofs pass.
