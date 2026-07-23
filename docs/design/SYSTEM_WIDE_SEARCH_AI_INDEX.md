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
- A bounded filesystem watcher is used only as the fallback change signal;
  normal changes and queue overflow both trigger a batched metadata
  reconciliation, while other volumes continue independently.
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
- Stores a native file identity built from `st_dev` and `st_ino` when the
  filesystem metadata is available, with a path fallback only for inaccessible
  metadata. Removed notifications that cannot carry that identity trigger a
  full Spotlight reconcile instead of guessing an entry ID.
- Receives metadata query notifications and uses native FSEvents as the
  reconciliation signal for changes, removals, and permission/index gaps.
- The realtime observer is filtered to the provider's own metadata query, so
  another query in the process cannot enqueue unrelated changes.
- Persists the last processed FSEvents event ID as the incremental checkpoint,
  while retaining a native reconciliation path when the cursor is unavailable
  or the provider is restarting without an established baseline.
- Uses normal `NSMetadataQuery` update notifications for ordinary file changes;
  FSEvents only escalates dropped/history-gap signals to a full Spotlight
  reconciliation, avoiding a full local-computer query for every filesystem
  event.
- The coordinator keeps the provider alive and drains Spotlight/FSEvents
  updates continuously after the initial collection instead of waiting for a
  manual restart or settings action.
- Preserves explicit permission-required and rebuild-required states instead of
  silently treating incomplete discovery as a ready index.
- Distinguishes Spotlight unavailable, realtime Spotlight update unavailable,
  Spotlight-without-indexed-local-results, partial-permission results, and
  FSEvents unavailable states in the source status/error path. External volumes
  with readable content but no Spotlight result are reported separately; known
  TCC-protected locations are classified as Full Disk Access or protected-
  directory conditions without attempting to bypass macOS privacy controls.

## Managed AI worker

The durable queue is consumed by a bounded background worker. AI jobs are
keyed by both the global entry and managed scope, so overlapping managed
scopes remain independently policy-controlled. It resets
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
managed-scope admission plus local/cloud AI policy. The aggregate status also
reports the number of processed entries and whether the initial collection is
complete. User-facing copy is localized, including Spotlight/indexing/privacy
reasons; internal provider error codes are never rendered directly. The UI
keeps global metadata-only results free of AI risk or recommendation badges.

## Verification status

- Rust schema, repository, AI isolation, platform-provider, and one-million
  entry FTS benchmark tests are included.
- Frontend type checking, targeted Spotlight/settings/permission tests, full
  frontend tests, and production frontend build are run as part of release
  verification. The dual-platform CI quality matrix packages the Windows NSIS
  installer and unsigned macOS DMG on pull requests as well as master pushes;
  tagged releases additionally exercise the optional Developer ID signing path.
- Windows code is checked on the Windows host. Native macOS compilation still
  requires a macOS toolchain; cross-compiling Objective-C dependencies from
  Windows is not treated as native verification.
- The Windows installer was rebuilt successfully with the service hooks. A
  live LocalSystem SCM run, named-pipe status/discovery, real C: MFT scan, and
  post-create USN incremental scan were also accepted manually; the interactive
  NSIS post-install/uninstall UI remains a separate acceptance step.
- The macOS CI/release workflow has an explicit unsigned-DMG path and an
  optional Developer ID certificate/keychain path with hardened-runtime
  `codesign` verification. Those macOS runner steps and native runtime checks
  remain unexecuted from this Windows development environment.
