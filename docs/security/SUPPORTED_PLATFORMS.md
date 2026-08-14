# Supported platforms

## Product targets

Zen Canvas supports:

- Windows, with the existing source-handle and verified-directory mutation
  authority;
- macOS 13 or later on Apple Silicon (`aarch64-apple-darwin`), with the
  recoverable namespace and provider-coordination strategies described in
  `MACOS_MUTATION_THREAT_MODEL.md`.

Intel Macs, Universal binaries, Rosetta, and Linux are not product targets.

## macOS operation support

macOS runtime capability is intentionally fine-grained. Copy, duplicate,
rename, same-volume move, cross-volume move, replacement, Safe Trash, restore,
package-root mutation, external-volume mutation, network-volume mutation,
iCloud coordination, File Provider coordination, and permanent delete are
available when the current source, target, volume, provider, and permission
facts pass backend preflight. Secure physical SSD erasure is not available.

The backend chooses the strategy; the renderer does not infer it from a path.
Operation Preview shows the chosen strategy and conflict policy, and the
backend resolves it again after confirmation. Read-only volumes, offline or
ambiguous providers, permission failures, identity races, and target collisions
are runtime refusals, not platform-wide feature deferrals.

Symlinks are operated on as link objects and are never followed. A hardlink
directory entry can be moved or renamed; permanent deletion removes only that
entry and does not claim to erase all links. Package roots move as whole logical
objects. Package-internal mutation is rejected.

## Recovery and cleanup

macOS Safe Trash is Zen Canvas's durable recoverable namespace, recorded by the
existing cleanup ledger and restored through History. Replacement retains the
old target in a private backup and restores both source and destination only
after identity verification. Permanent delete first uses a private quarantine;
failed verification or deletion retains that object for manual review. No
operation bypasses Operation Preview, journals, Safe Trash, or restore
revalidation.

## Cloud and provider behavior

iCloud content is not implicitly downloaded during indexing or preview. An
explicit confirmed mutation may request materialization through
`NSFileManager`, waits for local availability with cancellation, and then uses
the coordinated operation boundary. File Provider domains use
`NSFileCoordinator`; offline, unknown, or unavailable items produce stable
user-facing errors and preserve the recovery object.

## Windows and Linux

Windows behavior remains unchanged: its source-handle and verified-directory
primitives remain the filesystem authority. The legacy system Recycle Bin path
continues to fail closed where source binding cannot be proven; Safe Trash is
the durable cleanup route.

Linux is not a supported product platform. It is outside product support,
build, release, and mutation-safety scope.
The fact that shared Rust code can be parsed on Linux is not a support or
security guarantee.

## Verification boundary

The supported-platform gate is Windows Quality, macOS Apple Silicon Quality,
and Dependency Audit. A macOS feature is not reported as release-verified from
Windows cross-compilation: native Apple Silicon compile/test, provider and
external-volume fixtures, race stress, and packaging evidence must come from
the remote macOS workflow at the exact pushed commit.
