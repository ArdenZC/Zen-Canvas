# macOS native mutation threat model

## Scope and product boundary

This contract applies only to macOS 13 or later on Apple Silicon
(`aarch64-apple-darwin`). Intel Macs, Universal binaries, Rosetta, Linux,
signing, notarization, stapling, certificates, and signed DMGs are outside
this completion task.

macOS destructive mutation is currently not enabled. Even for a regular local
APFS file or an ordinary directory, the implementation rejects the mutation
before source claim because the available macOS namespace APIs do not bind the
source name to the already-validated source file descriptor. Every other case
is also deferred or rejected with a stable reason. A capability flag means
that an adapter is compiled and available; it does not override this safety
gate.

## Runtime capability contract

The runtime capability response is an explicit safety contract, not a build
feature probe. macOS reports file mutation, same-volume mutation, rename, Safe
Trash, restore, cloud/File Provider/package mutation, and cross-volume
mutation as unavailable. The stable renderer/backend reason is
`macos_file_mutation_source_binding_unsupported`. Windows is the only platform
that reports the destructive mutation authority as available.

## Filesystem authority

The existing Operation Preview, operation journal, cleanup ledger, Safe Trash,
restore, and recovery authorities remain the only mutation authorities. The
macOS adapter adds proof to that path; it does not create a second journal,
queue, trash, or recovery store.

The intended mutation sequence is documented here so the authority boundary
is explicit, but the current macOS implementation stops at the platform gate:

1. validate the absolute source and target-parent namespace;
2. verify local APFS, writable volume, same-device relation, ordinary file or
   directory kind, and cloud/package/link boundaries;
3. open source and parent directories with `O_NOFOLLOW | O_CLOEXEC` when the
   mutation primitive is available;
4. bind the source descriptor at claim and commit time using a kernel-backed
   source-handle operation;
5. commit into an absent target without overwrite;
6. verify post-commit identity and publish the existing journal state.

The current implementation cannot perform step 4 safely with
`renameatx_np(parent_fd, name, ...)` or `unlinkat(parent_fd, name, ...)`.
Those name-based fallbacks are deliberately absent. A replacement can acquire
the old name between identity validation and a name-based call, so the result
would not be a safe mutation of the validated handle.

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

Quick Look is read-only but still identity-bound: it captures the source
handle before staging, keys the cache with physical/content identity, enforces
a 256 MiB source budget and free-space headroom, streams bytes through a
bounded private staging directory, and removes pending staging through RAII or
bounded startup cleanup. The renderer receives only a Tauri asset-protocol URL
for the backend-owned app-data cache.

## Mutation matrix

| Input or condition | Result |
| --- | --- |
| Local writable APFS, same device/volume, regular file | Fail closed until descriptor-bound source mutation exists |
| Local writable APFS, same device/volume, ordinary directory | Fail closed until descriptor-bound source mutation exists |
| iCloud, including a local-looking item without a safe byte-read proof | Deferred/fail closed |
| Generic File Provider or provider-backed location | Fail closed |
| Package or package-internal path | Fail closed |
| Symlink, hard link, special file, mount boundary | Fail closed |
| Cross-volume, network, removable/external, non-APFS, or unknown filesystem | Fail closed |
| Read-only volume or target collision | Fail closed |
| Source/parent/target identity race or post-commit mismatch | Fail closed and recover through the existing journal |

No path-only destructive fallback, implicit cloud download, overwrite, or
unjournaled copy is permitted. Safe Trash and restore continue to use their
existing durable authorities, but their macOS filesystem mutation step is
blocked by the same gate.

Sleep, wake, mount, unmount, and volume-change handling uses the existing
MacLifecycleController. It pauses the Global Index, stops watcher input,
requests cancellation from active durable workers, recovers interrupted
ledgers, and re-enters the existing watcher reconciliation path. It does not
create a second scheduler or renderer-side authority.

## Verification status

Windows verification covers the non-macOS stubs, shared descriptor-bound
primitives, and fail-closed regression tests. The repository contains native
Apple Silicon lifecycle, Finder, activity-policy, and Quick Look thumbnail
adapters, but this Windows host cannot execute Apple frameworks or provide a
native Apple Silicon runner. Native APFS, iCloud, File Provider, sleep/wake,
mount/unmount, Finder, Quick Look, and macOS CI results must therefore be read
from the remote Apple Silicon workflow before claiming those checks green. A
green fail-closed test does not constitute completion of the deferred
destructive mutation capability.
