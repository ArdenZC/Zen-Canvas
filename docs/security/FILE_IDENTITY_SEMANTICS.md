# Zen Canvas file identity semantics

This document defines the identity fields used by operation journals and Safe
Trash recovery. It prevents the legacy `quick_hash` name from being mistaken
for a complete content hash.

## Fields

| Field | Meaning | Safety role |
| --- | --- | --- |
| `size` | Byte size for files, or the deterministic recursive byte-size sum for directories | Required in every identity comparison |
| `modified_ns` | Filesystem modification time when available | Fallback metadata signal when a platform file ID is unavailable |
| `platform_volume_id` | Platform volume/device identity when available | Prevents a journal from silently crossing volumes |
| `platform_file_id` | Platform inode/file identity when available | Detects replacement at the same path |
| `quick_hash` / `sample_hash` | BLAKE3 sample hash. Small files hash all bytes; larger files hash the first and last 1 MiB with a domain and size prefix | Fast change detection; never sufficient by itself for high-risk execution |
| `full_hash` | BLAKE3 complete-content hash with a domain and size prefix | Required for journal-bound moves, Safe Trash, copy verification, and restore |

The database keeps `quick_hash` for compatibility, while Rust domain models
expose it as a sample hash. New code must use `full_hash` whenever the action
can move, restore, or otherwise commit a filesystem change.

## Directory identity

Directories use a stable recursive manifest. Entries are sorted by filename;
each manifest record includes the filename, entry type, byte-size contribution,
and child content hash. Symlinks, Windows reparse points, and unsupported
special entries are rejected instead of being followed.

## Fail-closed comparison

An expected identity field that is present must match an actual field. A missing
actual field cannot satisfy a present expected field. Missing expected optional
fields remain unconstrained for legacy/read-only callers, but legacy journal and
Safe Trash rows are marked for manual review rather than being treated as
verified.

The sample-hash regression deliberately changes the middle of a large file:
the sample hash remains equal while the full hash changes. This proves that a
sample collision cannot authorize a high-risk operation.

