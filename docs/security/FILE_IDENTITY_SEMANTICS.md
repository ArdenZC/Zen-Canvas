# Zen Canvas file identity semantics

This document defines the separate identity facts used by operation journals,
filesystem mutation and Safe Trash recovery. It prevents the legacy
`quick_hash` name from being mistaken for a complete content hash and prevents
content verification from being confused with namespace rebinding proof.

## Identity layers

| Layer | Meaning | Safety role |
| --- | --- | --- |
| `NamespaceIdentity` | Physical identity plus type, size and modification time; provider URL evidence is an additional operation-scoped fact when a generic provider path is involved | Prepared journal, same-volume rename/move, Safe Trash, Restore, Replace and namespace delete/rebind checks |
| `ContentVerificationIdentity` | Optional bounded sample hash or complete BLAKE3 content hash | Copy, Duplicate, cross-volume copy verification and recovery where byte equivalence is required |
| `ProviderIdentityEvidence` | Decision B coordinated user-visible URL fingerprint plus physical identity; native item/domain identity is extension-scoped diagnostic data only | Provider-aware revalidation; a CloudStorage path, resource ID or dev/ino tuple alone is only a routing hint |

## Fields

| Field | Meaning | Safety role |
| --- | --- | --- |
| `size` | Byte size for files, or the deterministic recursive byte-size sum for directories | Required in every identity comparison |
| `modified_ns` | Filesystem modification time when available | Fallback metadata signal when a platform file ID is unavailable |
| `platform_volume_id` | Platform volume/device identity when available | Prevents a journal from silently crossing volumes |
| `platform_file_id` | Platform inode/file identity when available | Detects replacement at the same path |
| `quick_hash` / `sample_hash` | BLAKE3 sample hash. Small files hash all bytes; larger files hash the first and last 1 MiB with a domain and size prefix | Fast change detection; never sufficient by itself for high-risk execution |
| `full_hash` | BLAKE3 complete-content hash with a domain and size prefix | Required where the operation policy promises byte equivalence, including Copy/Duplicate, cross-volume verification and recovery that needs content proof; not required for same-volume namespace mutation |

The database keeps `quick_hash` for compatibility, while Rust domain models
expose it as a sample hash. New code requests `full_hash` only when the
operation promises byte equivalence (Copy, Duplicate, cross-volume staging or
content-dependent recovery). Same-volume Rename/Move, Safe Trash and
namespace-only Restore/Delete bind the retained physical object without a
content read.

The schema-34 cleanup ledger predates a separate source-volume column. On
macOS, new Safe Trash source and claim rows therefore encode the physical
`dev`/`ino` pair in the existing compatibility field as
`macos-dev-ino:<volume>:<file>`. Legacy untagged macOS rows fail closed when a
physical source identity is required; the compatibility encoding is tracked
for removal after a separately authorized cleanup-ledger migration (TD-014).

## Directory identity

Directories use a stable recursive manifest when content verification is part
of the operation policy. Entries are sorted by filename; each manifest record
includes the filename, entry type, byte-size contribution and child content
hash. Same-volume directory namespace operations use the root namespace
identity and do not recursively hash the tree. Symlinks, Windows reparse
points and unsupported special entries are rejected instead of being followed.

## Fail-closed comparison

An expected identity field that is present must match an actual field. A missing
actual field cannot satisfy a present expected field. Missing expected optional
content fields are valid for namespace-only operations; missing physical
identity remains a manual-review condition. Legacy rows without the physical
identity required by their operation policy are never treated as verified.

The sample-hash regression deliberately changes the middle of a large file:
the sample hash remains equal while the full hash changes. This proves that a
sample collision cannot authorize a high-risk operation.
