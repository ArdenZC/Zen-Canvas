# Apple Silicon Native Completion

## Completion status

This task is not release-complete for macOS destructive mutation. The
mutation boundary is intentionally fail-closed until the implementation has a
real descriptor-bound source namespace primitive.

macOS `renameatx_np` and `unlinkat` accept a source parent descriptor plus a
source name; they do not commit against the already-validated source file
descriptor. Calling either after identity validation could therefore mutate a
replacement object that acquired the same name. Zen Canvas now rejects the
macOS destructive mutation path before claim, target commit, Safe Trash, or
restore mutation rather than reintroducing that TOCTOU window.

## Starting SHA

`03e5b9d36069a68c02aa9fb8a1f4e65b2ecce93d`

## Final SHA

Recorded in the final task handoff after the last logical commit is pushed.

## Commits

This completion is being delivered as logical commits on `master`. The first
three commits in the sequence are:

- `bc9f722` — close macOS cloud read-safety gaps;
- `6bd6f50` — release native File Library enrichment from database
  transactions;
- `4b767f3` — format the content-eligibility mapping.

The remaining mutation, lifecycle, Finder, Quick Look, capability, CI, and
documentation commits are recorded in the final task handoff.

## macOS platform contract

The supported native target is macOS 13+ on Apple Silicon
(`aarch64-apple-darwin`). Intel, Universal, Rosetta, and Linux are not product
targets for this task. Unsigned DMG packaging may remain in scope; signing,
notarization, stapling, certificates, and signed DMGs are explicitly out of
scope.

## Cloud safety

iCloud metadata failure is `Unknown`, never an implicit local item. Local-looking
iCloud content remains deferred until a non-materializing read proof exists.
Generic File Provider content remains conservative. No `HOME` environment
variable is used for native macOS home discovery, and no adapter requests
cloud materialization.

Content, duplicate, analysis, cleanup, and identity hashing share the macOS
byte-read gate with `O_NOFOLLOW | O_CLOEXEC` and post-open identity checks.

## Mutation Matrix

Read, identity, and preview operations: local writable APFS regular files when
the opened-handle and path-binding proofs succeed.

Destructive mutation on macOS: fail closed with
`macos_file_mutation_source_binding_unsupported` until a kernel-bound source
rename/delete primitive is available.

Fail closed: iCloud, File Provider, packages, symlinks, hard links, special
files, mount boundaries, cross-volume/network/external paths, non-APFS or
unknown filesystems, read-only volumes, target collisions, and source/parent/
target identity races.

## Filesystem authority

The existing Operation Preview, operation journal, Organization execution,
Safe Trash ledger, restore ledger, and recovery reconciliation remain the only
authorities. The macOS mutation gate currently stops before source claim and
namespace mutation; there is no name-based `renameatx_np` or `unlinkat`
fallback. No second journal, queue, trash, or recovery system was introduced.

## Security tests

Coverage includes cancellation before claim and commit, source and target
races, target-parent replacement, target collision, symlink, hard-link,
package, cloud/provider, unknown-boundary, and macOS mutation fail-closed
paths. Quick Look coverage includes identity-keyed cache keys and rejection of
a path replacement after the source handle is opened. Native Apple Silicon
execution remains a remote CI/hardware gate because this task ran from
Windows.

## Lifecycle

The AppKit workspace observer handles sleep, wake, mount, unmount, and volume
change notifications. Sleep/unmount pause existing Global Index coordination;
wake/mount/unmount/volume change resume through that same coordinator. Failed
reconciliation remains visible instead of silently resuming stale work.

## Finder/Quick Look

Finder open/reveal uses one macOS adapter and retains the existing main-window
authorization. Quick Look delivery is limited to safe, bounded thumbnails for
managed files: the adapter opens and validates a source handle, includes the
physical/content identity in the cache key, copies bytes from that handle into
a private 0600 staging file, and invokes `qlmanage` only on the staged file.
It supports cancellation, enforces an eight-second helper limit, and caps
cache size at 128 entries/64 MiB. Full `QLPreviewPanel` integration remains
deferred until a stable AppKit view-lifetime bridge is available.

## Accessibility

No new user-facing mutation bypass or local copy dictionary was added. New
platform diagnostics use the shared settings primitives and i18n system. Full
keyboard, IME, screen-reader, reduced-motion, high-contrast, and native-window
visual verification must be performed on the supported desktop targets before
the release is called visually complete.

## Performance

File Library native enrichment is performed after transaction/connection
release. The Apple Silicon activity policy is wired to durable dedupe
full-hash work: low-power/serious thermal states cap background workers, and
critical thermal state pauses that nonessential hashing path. Existing
performance cache, identity, split-suite, and scale architecture is preserved.

## CI architecture

The existing fast/full workflow split, cache keys, cache identity, runner
pinning, risk classification, and performance suites are preserved. macOS
quality and native performance remain Apple Silicon jobs; no Linux or Intel
job is added. High-risk macOS code continues to route through the full path.

## Windows regression

Windows remains the existing supported mutation platform and keeps its current
descriptor and verified-directory authority. macOS additions compile to
fail-closed Windows stubs where appropriate and do not replace Windows
behavior.

## GitHub Actions

The final handoff records the pushed `master` SHA, workflow run URLs, exact
head SHA, and conclusions for fast CI and explicitly dispatched full
validation. A pending, canceled, or unavailable native job is not reported as
green.

## Deferred

- native Apple Silicon compile/test execution from this Windows host;
- descriptor-bound macOS namespace mutation for move, rename, Safe Trash, and
  restore; this is the P1 release blocker;
- reliable generic File Provider identity/materialization proof;
- non-materializing iCloud local-content read proof;
- cross-volume mutation/copy protocol;
- package-internal mutation;
- full `QLPreviewPanel` integration;
- signed distribution, notarization, stapling, certificates, and signed DMG.
