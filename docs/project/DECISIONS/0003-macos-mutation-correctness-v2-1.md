# ADR-0003: macOS Mutation Correctness V2.1 Provider and Portability Closeout

Status: accepted — user-authorized high-risk remediation

Date: 2026-08-15

## Context

The V2 implementation established descriptor-backed identity and recoverable
namespace transactions, but the closeout audit found four remaining places
where a platform label could be mistaken for an execution proof: Safe Trash
coordination, generic File Provider identity, explicit provider materialization,
and portable source retirement. Copy fallback also needed a bounded one-pass
policy instead of a full-hash/copy/full-hash sequence.

## Decision

1. Keep Operation Preview, the operation journal, Safe Trash, cleanup ledger
   and Restore ledgers as the only durable mutation authorities.
2. Safe Trash is a two-URL coordinated namespace move. Its coordinator uses
   the accessor-supplied source and actual Safe Trash target; only Permanent
   Delete uses the single-source `ForDeleting` accessor. Journal and cleanup
   records use the actual target returned by the operation boundary.
3. Generic File Provider paths use `CloudStorage` only as a routing hint.
   Provider identity is the provider-supplied item/domain identifier pair;
   Apple's callback domain argument is an `NSString` typedef, not an
   `NSFileProviderDomain *`. Download requests use the public
   `managerForDomain:` class factory, and a nil/inapplicable manager is a
   runtime refusal. Resource identifiers, POSIX device/inode and path text
   cannot fabricate provider identity. Third-party-provider applicability is
   decided runtime-by-runtime and remains **NOT VERIFIED — fixture unavailable**
   when no real provider fixture is supplied.
4. Materialization is an explicit, consent-bound operation. The command is
   bound to preview ID, file ID, operation fingerprint, expected revision,
   source namespace identity and provider identity. It may report progress or
   cancellation, but it never starts from a renderer-supplied path and never
   creates a mutation journal or target before completion and revalidation.
5. Source retirement selects `ExclusiveClaim`, `ProviderCoordinated` or
   `PortableNamespaceRetirement`. APFS requires writable local volume facts;
   portable paths require an implementation-backed no-replace, identity and
   durability probe. The Darwin `linkat` plus pathname `unlinkat` fallback is
   prohibited because target/source cleanup can be rebound between checks. A
   target-first copy may therefore leave source and target together with the
   unique journaled PortableSourceRetirement slot in
   `mac_source_retirement_pending`; recovery retries only after source
   identity revalidation.
6. Copy/duplicate uses `PhysicalClone`, `StreamingHash` or `FullPostVerify`.
   A streaming fallback reads the source once while writing and computing
   BLAKE3. Clone success proves physical identity, size, mode, ownership,
   timestamps and bounded xattr metadata; metadata degradation is explicit.
7. Runtime capability DTOs expose platform availability, runtime environment
   capability and operation eligibility as separate layers. Provider,
   external-volume and network-volume booleans do not claim fixture or
   runtime proof. Preview surfaces strategy, materialization, source
   retirement, cross-volume and metadata-degradation state.
8. Provider materialization cache entries are bounded (1024 items), expire
   after five minutes, and are cleared by mount/unmount and volume-change
   lifecycle events. Explicit provider download uses a full-range request but
   only a bounded first/last-range open/read proof; it never reads the entire
   file as a normal materialization proof.
9. Native evidence remains exact-head evidence. The named real fixtures are
   optional and must print `SKIPPED — REAL FIXTURE NOT PROVIDED` when absent;
   Windows or cross-compilation cannot be reported as Apple Silicon evidence.

## Non-goals

- a new mutation journal, queue, schema version or recovery authority;
- a generic File Provider identity bridge without its native API contract;
- passive provider downloads, content scans, dedupe reads, AI reads or
  thumbnail materialization;
- automatic network disconnect/reconnect simulation;
- Intel macOS, Rosetta, Universal binaries, Linux, signing or notarization.

## Acceptance gates

- Safe Trash and Permanent Delete use distinct coordinator/accessor contracts;
- provider identity is never inferred from a path, resource ID or dev/ino;
- materialization cancellation leaves the operation unexecuted and target-free;
- source retirement fails closed when exact volume guarantees are unknown;
- expanded native race evidence includes Move, Safe Trash, Restore, Replace,
  Permanent Delete, package, directory, symlink and source/target rebind cases;
- `unexpectedOverwrite`, `wrongCommit`, `wrongDelete` and `unrecoverableLoss`
  remain zero;
- clone, streaming and metadata-degradation paths have focused coverage;
- final current-truth records distinguish production-code SHA, docs-only SHA,
  native contract evidence and real-fixture evidence.

## Consequences

Some macOS paths become more visibly unavailable than their platform name
alone suggests. That is intentional: the backend now reports what the current
runtime and mounted volume can prove, while preserving the existing preview,
journal, Safe Trash and restore recovery chain.
