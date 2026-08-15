# macOS mutation threat model

## Scope

This contract covers macOS 13 or later on Apple Silicon
(`aarch64-apple-darwin`). Intel Macs, Rosetta, Linux, signing, notarization,
stapling, certificates, and Endpoint Security hardened mode are outside this
mutation implementation.

The macOS filesystem adapter is enabled through the existing Operation Preview,
operation journal, Safe Trash, restore, and recovery authorities. It does not
create a second journal, queue, trash namespace authority, or recovery store.

## Safety levels

macOS does not provide the Windows source-handle rename primitive used by the
existing Windows path. Zen Canvas therefore distinguishes the guarantees:

- Level A, descriptor-bound copy/clone: implemented for regular files and
  directory staging; descriptor-bound destructive rename/delete is not claimed
  because Darwin has no portable source-FD rename primitive.
- Level B, recoverable namespace transaction: implemented for supported local,
  external/removable, network, package-root, symlink, hardlink, cross-volume,
  Safe Trash, restore, replacement, and permanent-delete operations. The
  portable paths remain capability-probed and fail closed when the mounted
  filesystem cannot provide the required no-overwrite or metadata guarantees.
- Level C, coordinated provider transaction: iCloud and generic File Provider
  coordination use native accessors. Non-local content is a materialization
  precondition and is never downloaded implicitly; offline, ambiguous, or
  unavailable provider items fail closed.

Level B never silently upgrades itself to Level A. The source is claimed under a
private exclusive name, verified again, and only then published to an exclusive
destination. A race or rollback conflict retains the object and the durable
journal enters recovery; it never falls back to an unverified overwrite or
unlink of the original user pathname.

## Unified identity

`MacPhysicalIdentity` is the platform physical identity used by claims, copy,
move, Safe Trash, restore, delete, and post-commit checks. It captures device,
inode, object type, link count, size, timestamps, and an optional generation
field from `fstat`, `lstat`, or `fstatat(..., AT_SYMLINK_NOFOLLOW)`.

Physical identity and content identity remain separate facts. Content hashes are
used for copy and recovery verification; physical identity is used to prove that
the namespace entry still refers to the claimed object. A symlink is mutated as
the symlink object and is never followed. A hardlink entry is a namespace
operation; permanently deleting one entry only decrements its link count. A
package root is one logical object and is never partially mutated.

## Transaction boundary

The backend sequence is:

1. Validate absolute paths, protected locations, volume writability, package
   boundaries, object kind, and provider state.
2. Open source and verified parent directories with `O_NOFOLLOW | O_CLOEXEC`.
3. Capture `MacPhysicalIdentity` and only the content identity requested by the
   operation policy.
4. Move the source into a private claim using exclusive `renameatx_np` namespace
   publication, then verify both physical and optional content identity.
5. For copy or cross-volume work, stage with `fclonefileat` when available,
   `fcopyfile`/descriptor streaming as fallback, preserve metadata and symlinks,
   verify the complete destination, and publish with exclusive rename.
6. For replacement, claim the old target into a deterministic private backup,
   publish the new source, and retain the old target for restore.
7. For Safe Trash, move into the existing durable Safe Trash ledger. For
   permanent delete, quarantine first, recheck identity, and delete only the
   quarantined object. Physical SSD erasure is not claimed.
8. Persist the existing journal phase and revalidate after restart.

The macOS name-based primitive is a known Level B boundary: Darwin has no
portable source-FD rename equivalent. The high-entropy private claim,
exclusive destination, immediate identity checks, and manual recovery state
bound the residual namespace race without presenting it as a kernel guarantee.

## Strategy matrix

| Observed source/target | Backend strategy | User outcome |
| --- | --- | --- |
| Local writable APFS | `local_apfs` | Same-volume namespace transaction |
| Local writable non-APFS | `local_portable` | Recoverable namespace transaction |
| Writable external/removable volume | `local_portable` or `cross_volume_copy_verify` | Portable target-first transaction; metadata/volume limitations fail closed |
| Different devices/volumes | `cross_volume_copy_verify` | Copy, verify, then retire source |
| Network volume | `network_portable` | Target-first portable copy/verify; runtime refusal when the mount cannot provide the contract |
| iCloud item | `icloud_coordinated` | Coordinate metadata operations; copy/duplicate requires explicit materialization |
| Known File Provider domain | `file_provider_coordinated` | Coordinate through native accessor URLs; local items can proceed, placeholders require explicit materialization |
| Read-only, offline, unknown, or ambiguous provider | runtime refusal | Stable error; object and journal remain recoverable |

Known File Provider domains are observed conservatively from the macOS
`~/Library/CloudStorage` namespace. This is a routing hint only and does not
fabricate provider identity. Native NSURL resource identifiers and
materialization values are provider evidence only; POSIX physical identity
continues to bind every mutation. Real provider and external-volume fixture
results remain separate from the platform capability advertisement.

## Race and recovery guarantees

The operation journal records `source_claimed`, `copying`,
`target_committed`, `source_cleanup_pending`, and `completed`. On restart the
existing reconciliation code distinguishes pre-commit rollback, completed
publication, source-cleanup pending, replacement restore, and ambiguous states.
Ambiguous identity, source reappearance, target replacement, unreadable
provider content, or failed rollback becomes manual review with the claim or
backup retained.

The permanent-delete invariant is especially strict: after quarantine, the
original source pathname is irrelevant. Delete is attempted only against the
revalidated private quarantine object. If that object cannot be revalidated or
removed, it is retained for manual recovery.

## Capability and UI contract

Runtime capabilities are fine-grained: copy, duplicate, rename, same-volume
move, cross-volume move, replace, Safe Trash, restore, permanent delete,
secure removal, package, iCloud, File Provider, external-volume, and
network-volume mutation. A capability means the backend has a strategy;
current volume/provider eligibility is still resolved during Preview and again
at confirmation. File Provider, removable/external-volume, and network-volume
operations can return stable runtime refusals when their mounted filesystem or
provider cannot satisfy the operation contract.

File Library exposes the existing Operation Preview route for file operations,
including an explicit permanent-delete review. Preview displays the backend
strategy, conflict policy, and whether copy, move, download, replacement, or
recovery retention is expected. Normal History/Restore remains the recovery UI;
internal claim paths and error details stay behind technical disclosures.

## Verification status

Windows checks in this task preserve the existing handle-bound implementation.
The Windows host has run formatting, type checking, Rust library compilation,
and focused `fs_safety` tests. Native Apple Silicon compile, provider fixtures,
real external/network volumes, sleep/wake, mount/unmount, and the configured
10k/100k race stress remain remote Apple Silicon evidence gates. The V2
initiative must not be called release-complete until the macOS workflow reports
the exact pushed head green.

## Explicitly deferred

- Endpoint Security/System Extension hardened mode;
- signing, notarization, stapling, certificates, and signed DMG delivery;
- advanced `QLPreviewPanel` integration;
- physical SSD secure erase guarantees.
