# System-wide Search and Managed AI Index

## Purpose

Zen Canvas now treats system-wide search and AI-managed analysis as two related
but independent domains:

- `global_*` tables contain filesystem metadata discovered from enabled local
  volumes or indexed providers.
- `managed_*` and `ai_*` tables contain only files explicitly admitted to a
  managed scope.

Every global search result remains searchable even when it is outside the File
Library scope. A global entry is not eligible for hashing, content extraction,
cloud analysis, recommendations, or AI jobs until a managed scope admits it.

## Storage and API boundary

Schema version 25 adds global volumes and entries, external trigram FTS,
managed scopes and entries, and durable AI analysis/job state. The repository
layer is the selector choke point: it resolves enabled managed scopes before
creating AI work and keeps stale global entries out of managed/AI state.

Tauri commands cover global search, aggregate status, source status and
lifecycle, opening/revealing a global result, managed-scope policy, and AI
queue status. Search commands do not depend on `LibraryScope`; the File Library
scope continues to control File Library views only.

## Platform providers

### Windows

- Enumerates local volumes with `GetLogicalDrives`, drive type, volume label,
  filesystem type, stable volume GUID/serial, and mount path.
- Uses NTFS MFT enumeration and USN journal reads when available, with FRN,
  parent FRN, name, and path reconstruction.
- Detects journal identity/cursor discontinuity, reset/truncation, rename
  reconciliation, and orphan/cycle records; those states require a rebuild or
  safe fallback scan.
- Uses a recursive metadata-only fallback for non-NTFS or unavailable journal
  sources.
- Includes a versioned named-pipe service contract with local-user ACLs and
  framed request validation for least-privilege integration. The current
  release keeps the provider in-process and uses this contract as the service
  seam; installed-service registration, upgrade/uninstall hooks, and live
  provider transport remain a follow-up for a formal service-mode build.

### macOS

- Runs native `NSMetadataQuery` over
  `NSMetadataQueryIndexedLocalComputerScope` for indexed local metadata.
- Receives metadata query notifications and uses native FSEvents as the
  reconciliation signal for changes, removals, and permission/index gaps.
- Preserves explicit permission-required and rebuild-required states instead of
  silently treating incomplete discovery as a ready index.

## UI behavior

Spotlight always queries the global index. Enter opens the selected result and
Ctrl/Cmd+Enter reveals it in the file manager. The index-management link is a
low-priority control that opens Preferences; it does not make management a
prerequisite for search.

Preferences exposes global source status/lifecycle and separately exposes
managed-scope admission plus local/cloud AI policy. User-facing copy is
localized and the UI keeps global metadata-only results free of AI risk or
recommendation badges.

## Verification status

- Rust schema, repository, AI isolation, platform-provider, and one-million
  entry FTS benchmark tests are included.
- Frontend type checking, targeted Spotlight/settings/permission tests, full
  frontend tests, and production frontend build are run as part of release
  verification.
- Windows code is checked on the Windows host. Native macOS compilation still
  requires a macOS toolchain; cross-compiling Objective-C dependencies from
  Windows is not treated as native verification.
