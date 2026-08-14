# macOS native mutation threat model

## Scope and product boundary

This contract applies only to macOS 13 or later on Apple Silicon
(`aarch64-apple-darwin`). Intel Macs, Universal binaries, Rosetta, Linux,
signing, notarization, stapling, certificates, and signed DMGs are outside
this completion task.

macOS mutation is enabled only for the first proven surface: a regular local
APFS file or an ordinary directory on the same writable device and volume,
with no cloud or File Provider backing, package boundary, symlink, hard-link,
special-file, or mount-boundary ambiguity. Every other case is deferred or
rejected with a stable reason. A capability flag means that the adapter is
compiled and available; it does not override this per-path gate.

## Filesystem authority

The existing Operation Preview, operation journal, cleanup ledger, Safe Trash,
restore, and recovery authorities remain the only mutation authorities. The
macOS adapter adds proof to that path; it does not create a second journal,
queue, trash, or recovery store.

The mutation sequence is:

1. validate the absolute source and target-parent namespace;
2. verify local APFS, writable volume, same-device relation, ordinary file or
   directory kind, and cloud/package/link boundaries;
3. open source and parent directories with `O_NOFOLLOW | O_CLOEXEC`;
4. revalidate descriptor identity and claim the source with
   `renameatx_np(..., RENAME_EXCL)`;
5. commit into an absent target without overwrite;
6. verify post-commit identity and publish the existing journal state.

Cancellation is checked before journal preparation, before claim, and before
commit. Target collisions, parent replacement, source races, identity changes,
claim failures, commit failures, and recovery ambiguity fail closed. Safe Trash
uses Zen Canvas's existing durable Safe Trash ledger, never the system Trash.
Restore uses the same durable authority and refuses an occupied or changed
destination.

## Cloud, provider, and content-read boundary

Foundation metadata is observational only and must not request iCloud
materialization. If iCloud metadata is missing, malformed, or cannot be read,
the item is `Unknown`; it is not treated as a normal local file. An iCloud item
reported as local remains deferred until a non-materializing native read proof
exists. Generic File Provider items remain conservative and are not mutated.

Content, duplicate, analysis, cleanup, and identity hashing use the same
macOS byte-read gate. The gate applies `O_NOFOLLOW | O_CLOEXEC` and rechecks
device, inode, type, and size before bytes are consumed. File Library native
semantics are collected after the database transaction and connection are
released, so native inspection cannot extend a SQLite transaction.

## Mutation matrix

| Input or condition | Result |
| --- | --- |
| Local writable APFS, same device/volume, regular file | Supported through existing journal authority |
| Local writable APFS, same device/volume, ordinary directory | Supported only when directory proof succeeds |
| iCloud, including a local-looking item without a safe byte-read proof | Deferred/fail closed |
| Generic File Provider or provider-backed location | Fail closed |
| Package or package-internal path | Fail closed |
| Symlink, hard link, special file, mount boundary | Fail closed |
| Cross-volume, network, removable/external, non-APFS, or unknown filesystem | Fail closed |
| Read-only volume or target collision | Fail closed |
| Source/parent/target identity race or post-commit mismatch | Fail closed and recover through the existing journal |

No path-only destructive fallback, implicit cloud download, overwrite, or
unjournaled copy is permitted.

## Verification status

Windows verification covers the non-macOS stubs, shared descriptor-bound
primitives, and fail-closed regression tests. The repository contains native
Apple Silicon lifecycle, Finder, activity-policy, and Quick Look thumbnail
adapters, but this Windows host cannot execute Apple frameworks or provide a
native Apple Silicon runner. Native APFS, iCloud, File Provider, sleep/wake,
mount/unmount, Finder, Quick Look, and macOS CI results must therefore be read
from the remote Apple Silicon workflow before claiming those checks green.
