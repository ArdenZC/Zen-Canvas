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
- Persists a per-volume fallback decision so transient MFT/USN failures do not
  cause repeated expensive retries; an explicit rebuild resets that decision
  and deliberately retries native NTFS enumeration.
- Runs the provider in the installed ZenCanvasGlobalIndex Windows service
  (LocalSystem, auto-start) through a versioned named pipe with explicit
  LocalSystem/interactive-user ACLs and remote-client rejection. The service
  validates every source snapshot against fresh native volume discovery,
  streams bounded metadata batches, and performs parent/identity lookups
  through the desktop process without receiving arbitrary file-operation
  paths.
- The per-machine NSIS installer stops and removes the previous service before
  upgrade, registers the installer-owned executable with --index-service,
  configures restart-on-failure, starts it after install, and removes it on
  uninstall. The desktop exposes start/pause/resume/rebuild/status; direct
  in-process enumeration is retained only as an explicit unavailable-service
  fallback and is surfaced in Preferences.

### macOS

- Runs native `NSMetadataQuery` over
  `NSMetadataQueryIndexedLocalComputerScope` for indexed local metadata.
- Receives metadata query notifications and uses native FSEvents as the
  reconciliation signal for changes, removals, and permission/index gaps.
- Persists the last processed FSEvents event ID as the incremental checkpoint,
  while retaining a native reconciliation path when the cursor is unavailable.
- Preserves explicit permission-required and rebuild-required states instead of
  silently treating incomplete discovery as a ready index.
- Distinguishes Spotlight unavailable, realtime Spotlight update unavailable,
  and FSEvents unavailable states in the source status/error path.

## Managed AI worker

The durable queue is consumed by a bounded background worker. It resets
abandoned running jobs after restart, claims only enabled non-directory
entries in enabled managed scopes, retries transient provider failures up to
three attempts, and records terminal or policy-blocked states. Requests are
metadata-only and results stay in ai_analysis_state; legacy files rows are
not copied or mutated. Local/cloud provider choice is checked again at claim
and execution time, and cloud processing remains disabled by default.

## UI behavior

Spotlight always queries the global index. Enter opens the selected result and
Ctrl/Cmd+Enter reveals it in the file manager. An unmanaged result can be
added to its parent managed scope with a low-priority action, while the
index-management link opens Preferences; neither makes management a
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
- The Windows installer was rebuilt successfully with the service hooks. The
  current development machine does not have ZenCanvasGlobalIndex installed,
  so live SCM start/stop and a real post-install service scan still require
  an elevated installer acceptance run.
