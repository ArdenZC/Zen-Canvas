# macOS native mutation threat model

## Current decision

Zen Canvas uses macOS-native metadata for read-only classification only. File
mutation, cleanup execution, Safe Trash mutation, and restore remain
fail-closed with `macos_file_mutation_source_binding_unsupported` until the
same-volume proof described below is implemented and exercised on a native
Apple Silicon runner.

The existing operation preview, operation journal, cleanup ledger, Safe Trash,
and restore authorities remain unchanged. This document does not authorize a
new mutation path.

## Source and target threat model

The future proof must bind the source object, source parent, target parent,
volume relation, and target absence through descriptors or equivalent native
handles. A path string is never an authority. The proof must reject:

- source replacement after claim;
- source rename or parent replacement after validation;
- target creation or replacement races;
- symlink, hard-link, mount-point, package-internal, or reparse-style escapes;
- cross-volume operations without an explicit, durable copy protocol;
- overwrite and target collision;
- cancellation at every pre-commit and post-commit boundary;
- journal, durability, or database publication failure;
- partial copy, interrupted copy, and restart ambiguity.

## Cloud and package boundaries

Foundation resource values may classify packages, ubiquitous items, volume
identity, filesystem type, read-only status, logical size, and allocated size.
Those calls must not request an iCloud/File Provider download. A not-local cloud
item is deferred and must not be hashed, extracted, or moved implicitly.

Packages are logical entities for traversal and cleanup review. Recursive
package-internal cleanup is not allowed by this milestone.

## Failure and recovery policy

If native semantics are unavailable, inconsistent, or ambiguous, the product
reports a review/deferred state and does not fall back to `std::fs::rename`,
path-only deletion, or an unjournaled copy. Any later mutation implementation
must add fault-injection coverage for claim, preview, target creation, copy,
commit, source cleanup, journal persistence, database publication, restart,
and restore reconciliation.

## Verification status

The Windows host can verify the fail-closed contracts and non-macOS stubs. The
Foundation implementation, macOS 13 minimum deployment, Apple Silicon runner
architecture, APFS behavior, iCloud placeholder fixtures, FSEvents overflow,
and Finder adapter require native Apple Silicon CI or hardware verification.
