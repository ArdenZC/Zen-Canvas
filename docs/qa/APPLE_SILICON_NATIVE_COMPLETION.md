# Apple Silicon native completion evidence

## Target

The native target is macOS 13 or later on an Apple Silicon runner:
`aarch64-apple-darwin`. Intel Macs, Rosetta, Universal binaries, Linux,
signing, notarization, stapling, certificates, and signed DMGs are outside the
parity implementation.

## V2 validation status

The macOS Mutation Correctness Remediation V2 initiative is active. The Windows
host has validated formatting, TypeScript type checking, focused Rust safety
tests, runtime-capability tests, and the storage-analyzer regression suite.
Those checks do not constitute Apple Silicon evidence. The required native
compile, Clippy, 10,000-iteration PR race gate, 100,000-iteration scheduled or
manual race gate, provider/external/network runtime-contract checks, and real
fixture classification must be bound to the final pushed
`aarch64-apple-darwin` head.

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
- operation-aware `NSFileCoordinator` accessors; iCloud and File Provider
  non-local content is a materialization precondition and is never silently
  downloaded;
- fine-grained runtime capability reporting and File Library/Operation Preview
  entry points, including explicit permanent-delete review;
- restart reconciliation for pending replacement restore and existing journal,
  cleanup, and Safe Trash authorities.

No second mutation journal, queue, recovery ledger, Rule authority, or schema
35 was introduced. Windows keeps its existing handle-bound primitives.

## Canonical validation record

This document retains the prior parity baseline record. It is not V2
completion evidence. The V2 validation record must be added only after the
native workflow succeeds at the exact pushed production head; later
documentation or governance commits do not change that evidence.

- Production validation head: `d99bbdb594556ffbd194fe92871c600000b61a91`.
- Fast CI: [run 31843452631](https://github.com/ArdenZC/Zen-Canvas/actions/runs/31843452631) — success, exact head `d99bbdb594556ffbd194fe92871c600000b61a91`.
- Full Validation: [run 31843459483](https://github.com/ArdenZC/Zen-Canvas/actions/runs/31843459483) — success, exact head `d99bbdb594556ffbd194fe92871c600000b61a91`.

## Prior baseline validated coverage

- Apple Silicon Rust formatting, tests, and Clippy;
- configured native mutation and recovery coverage, including the supported
  filesystem and Safe Trash/Restore paths;
- macOS release compilation and unsigned DMG packaging;
- Windows configured quality and release-compile gates;
- configured dependency/security and performance gates.

## Evidence boundary

The Windows host cannot execute Apple frameworks or produce an Apple Silicon
binary. The remote runs above are therefore the canonical native evidence;
Windows-local checks and cross-compilation are not substitutes for them.

## Still unverified / deferred

- broader real iCloud and File Provider fixtures;
- broader external and network-volume fixtures;
- broader adversarial race fixtures;
- native rendered visual and accessibility verification;
- signing, notarization, stapling, certificates, and signed DMGs;
- Endpoint Security/System Extension hardened mode;
- advanced `QLPreviewPanel` integration;
- physical SSD secure-erase guarantee.

The deferred items do not invalidate the recorded prior parity validation, but
they must not be described as completed V2 Apple Silicon coverage or release
signing. In particular, no provider, external-volume, network-volume, or
100k-race result is recorded for V2 until the native fixture/gate actually
runs.

Historical implementation starting baseline: `master@4c9a005b81bf86a6c91d8acf78c3bc4f277c5d28`.
