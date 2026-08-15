# Apple Silicon native completion evidence

## Target

The native target is macOS 13 or later on an Apple Silicon runner:
`aarch64-apple-darwin`. Intel Macs, Rosetta, Universal binaries, Linux,
signing, notarization, stapling, certificates, and signed DMGs are outside the
parity implementation.

## V2 validation status

The macOS Mutation Correctness Remediation V2 implementation is complete at
production head `c802397930ce276de7902ee37d5927083f2912ed`. Exact-head Fast and
Full Validation both passed on Apple Silicon-capable runners. Windows-local
checks remain separate evidence and are not substitutes for the native checks.

The V2.1 Provider/Portability closeout is delivered through PR #63 from
starting remote SHA `7b1dac7`, with original implementation commits `e9d75ba`
and `17cb2c9`. Its Apple Silicon evidence must be bound to the final PR head
before the protected merge; the older V2 production SHA above is not reused as
V2.1 production evidence.

## Baseline implementation and V2 remediation scope

The macOS path now includes:

- unified `MacPhysicalIdentity` for descriptor, namespace, claim, copy, Safe
  Trash, restore, and delete checks;
- Level B recoverable source claims and exclusive namespace publication;
- descriptor-relative copy/clone staging with `fclonefileat`, `fcopyfile`,
  streaming fallback, metadata, package-tree, symlink, and destination
  verification;
- Copy, Duplicate, same-volume Move/Rename, cross-volume Move, Replace with a
  retained backup, Safe Trash, Restore, and quarantine-based Permanent Delete;
- strategy routing for local APFS, portable local filesystems, external and
  network filesystems, cross-volume staging, iCloud, and conservatively
  detected provider domains;
- operation-aware `NSFileCoordinator` accessors, including distinct
  read-source/write-target, write-source/write-target, replacement, and
  delete contracts;
- Decision B generic File Provider client route using `NSFileCoordinator`, the
  provider/user-visible URL, physical identity and operation-scoped
  revalidation; explicit coordinated content access records a bounded
  `BoundaryReadable` proof and non-local content is never silently downloaded;
- read-only Preview capability observation, execution-time portable namespace
  probing with mount-aware invalidation, and copy proofs that bind staged and
  committed physical identity to the requested content identity;
- asynchronous Quick Look thumbnail joining on a worker pool rather than the
  Tauri command thread;
- fine-grained runtime capability reporting and File Library/Operation Preview
  entry points, including explicit permanent-delete review;
- restart reconciliation for pending replacement restore and existing journal,
  cleanup, and Safe Trash authorities.

No second mutation journal, queue, recovery ledger, Rule authority, or schema
35 was introduced. Windows keeps its existing handle-bound primitives.

## Canonical validation record

The V2 validation record below is bound to the exact pushed production head.
Later documentation-only closeout commits do not change that evidence.

- Production validation head: `c802397930ce276de7902ee37d5927083f2912ed`.
- Fast CI: [run 31878915359](https://github.com/ArdenZC/Zen-Canvas/actions/runs/31878915359) — success, exact head `c802397930ce276de7902ee37d5927083f2912ed`.
- Full Validation: [run 31878365268](https://github.com/ArdenZC/Zen-Canvas/actions/runs/31878365268) — success, exact head `c802397930ce276de7902ee37d5927083f2912ed`.
- Apple Silicon Rust quality: 569 passed and 11 ignored in the full suite; the
  focused mutation matrix passed, including 100,000 race iterations with
  `wrong_overwrite=0`, `wrong_commit=0`, `wrong_delete=0`, and
  `unrecoverable_loss=0`.
- Native performance: the 10,000-entry mixed package corpus and 1,000,000-op
  identity bookkeeping profile passed; the split performance shards also passed.

## V2 validated coverage

- Apple Silicon Rust formatting, tests, and Clippy;
- configured native mutation and recovery coverage, including the supported
  filesystem and Safe Trash/Restore paths;
- exact-head path/temp policy regression and Windows native hardening smoke;
- macOS release compilation and unsigned DMG packaging;
- Windows configured quality and release-compile gates;
- configured dependency/security and performance gates.

## Evidence boundary

The Windows host cannot execute Apple frameworks or produce an Apple Silicon
binary. The remote runs above are therefore the canonical native evidence;
Windows-local checks and cross-compilation are not substitutes for them.

For the V2.1 closeout, missing iCloud, generic File Provider, external APFS, exFAT or
network-volume fixtures are **NOT VERIFIED — fixture unavailable**. A contract
test line stating `SKIPPED — REAL FIXTURE NOT PROVIDED` remains an explicit
fixture boundary, not a successful real-fixture validation. The public bridge
and fail-closed paths still require exact-head native-runner evidence; no local
Windows or cross-compiled result can substitute for a real provider fixture.

## Still unverified / deferred

- real iCloud and File Provider fixtures;
- real external and network-volume fixtures;
- the named 100 GB sparse and 100k-entry mutation benchmarks;
- native rendered visual and accessibility verification;
- signing, notarization, stapling, certificates, and signed DMGs;
- Endpoint Security/System Extension hardened mode;
- advanced `QLPreviewPanel` integration;
- physical SSD secure-erase guarantee.

These are evidence boundaries, not a claim that the corresponding product
capability is permanently disabled. Provider and external-volume operations
remain runtime-dependent and fail closed when identity, materialization,
coordination or durability cannot be proven. No real provider or
external-volume fixture is described as validated here.

Historical implementation starting baseline: `master@4c9a005b81bf86a6c91d8acf78c3bc4f277c5d28`.
