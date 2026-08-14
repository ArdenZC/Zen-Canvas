# Apple Silicon native completion record

## Target

The native target is macOS 13 or later on an Apple Silicon runner:
`aarch64-apple-darwin`. Intel Macs, Rosetta, Universal binaries, Linux,
signing, notarization, stapling, certificates, and signed DMGs are outside the
parity implementation.

## Implementation delivered

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
  network volumes, iCloud, and known File Provider domains;
- `NSFileManager` materialization and `NSFileCoordinator` provider boundaries;
- fine-grained runtime capability reporting and File Library/Operation Preview
  entry points, including explicit permanent-delete review;
- restart reconciliation for pending replacement restore and existing journal,
  cleanup, and Safe Trash authorities.

No second mutation journal, queue, recovery ledger, Rule authority, or schema
35 was introduced. Windows keeps its existing handle-bound primitives.

## Required native evidence

The Windows host cannot execute Apple frameworks or produce an Apple Silicon
binary. The following must be recorded from the exact pushed head before the
task is called release-complete:

- native `cargo fmt`, tests, Clippy, release compile, and configured package
  checks on the Apple Silicon runner;
- macOS mutation parity tests for move, copy, duplicate, rename, replace, Safe
  Trash, restore, permanent delete, package roots, symlinks, hardlinks,
  cross-volume fallback, and target races;
- iCloud and File Provider mocked-contract tests plus any configured real
  fixtures;
- restart/crash reconciliation and the configured adversarial race profile;
- rendered light/dark Chinese and English File Library, Operation Preview,
  History/Restore, Cleanup, and Settings states at the repository's required
  viewport sizes.

## Current local evidence

On the Windows host, the implementation has passed Rust formatting, Windows
library compilation, TypeScript type checking, and focused `fs_safety` tests.
Cross-compiling with the installed Apple target is not a native proof because
the host linker/toolchain lacks Apple SDK support. Those results remain
explicitly unverified until the remote macOS workflow completes.

## Explicit deferrals

- Endpoint Security/System Extension hardened mode;
- signing and notarization;
- advanced `QLPreviewPanel` integration;
- physical SSD secure-erase guarantee.

## Handoff fields

- Starting baseline: `master@4c9a005b81bf86a6c91d8acf78c3bc4f277c5d28`.
- Final pushed head: record after the last logical commit.
- Fast workflow run: record URL, exact head, and conclusion.
- Full validation run: record URL, exact head, and conclusion.
- Native macOS fixture/race evidence: record artifact or explicit unverified
  result; do not infer it from Windows checks.
