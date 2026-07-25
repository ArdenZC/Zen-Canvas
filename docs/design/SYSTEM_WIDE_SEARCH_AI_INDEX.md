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

Schema version 26 adds global volumes and entries, external trigram FTS,
managed scopes and entries, durable AI analysis/job state, terminal cancellation
guards, incremental entry counts, and narrowed FTS update triggers. The
repository layer is the selector choke point: it resolves enabled managed
scopes before creating AI work and keeps stale global entries out of managed/AI
state.

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
- Detects journal identity/cursor discontinuity, reset/truncation, malformed
  pages, non-advancing MFT cursors, rename reconciliation, and orphan/cycle
  records; untrusted native state is marked `rebuild_required` rather than
  being mislabeled as a permission failure or ready index.
- Stages MFT records in a temporary SQLite database and streams resolved entries
  in bounded batches instead of retaining every MFT record and full path in
  memory. Metadata is completed from the filesystem before AI admission.
- Uses a recursive metadata-only fallback for non-NTFS or unavailable journal
  sources.
- Persists a per-volume fallback decision so transient MFT/USN failures do not
  cause repeated expensive retries; an explicit rebuild resets that decision
  and deliberately retries native NTFS enumeration.
- A bounded filesystem watcher is used only as the fallback change signal;
  normal changes and queue overflow both trigger a batched metadata
  reconciliation, while other volumes continue independently.
- Runs the provider in the installed ZenCanvasGlobalIndex Windows service
  (LocalSystem, auto-start) through a versioned named pipe with remote-client
  rejection, interactive-session validation, executable identity validation,
  bounded frames, and a metadata-only command whitelist. Service shutdown is
  SCM-only.
- The per-machine NSIS installer stops and removes the previous service before
  upgrade, registers the installer-owned executable with `--index-service`,
  configures restart-on-failure, starts it after install, and removes it on
  uninstall. The desktop exposes start/pause/resume/rebuild/status; direct
  in-process enumeration is retained only as an explicit unavailable-service
  fallback and is surfaced in Preferences.

### macOS

- Runs native `NSMetadataQuery` over
  `NSMetadataQueryIndexedLocalComputerScope` for indexed local metadata.
- Stores a native file identity built from `st_dev` and `st_ino` when the
  filesystem metadata is available, with a path fallback only for inaccessible
  metadata. Native macOS entry IDs remain stable across parent/name changes so
  a Spotlight move or rename updates the existing row. Removed notifications
  that cannot be matched safely trigger reconciliation instead of guessing an
  entry ID.
- Receives metadata query notifications and uses native FSEvents as the
  reconciliation signal for changes, removals, and permission/index gaps.
- The implementation is a direct Rust Objective-C/Foundation bridge: its
  dedicated Spotlight and FSEvents threads own query/stream lifetimes, stop on
  pause or shutdown, and never block the Tauri main thread; no unsigned
  external Sidecar is required.
- The realtime observer is filtered to the provider's own metadata query, so
  another query in the process cannot enqueue unrelated changes.
- Persists the last processed FSEvents event ID as the incremental checkpoint,
  while retaining a native reconciliation path when the cursor is unavailable
  or the provider is restarting without an established baseline.
- Uses normal `NSMetadataQuery` update notifications for ordinary file changes;
  FSEvents only escalates dropped/history-gap, root-change, mount, and unmount
  signals to a full Spotlight reconciliation, avoiding a full local-computer
  query for every filesystem event.
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

The durable queue is consumed by a bounded background worker. When managed
scopes overlap, the most specific enabled scope is the effective policy for an
entry and fingerprint, preventing duplicate local/cloud requests. It resets
abandoned running jobs after restart, claims only enabled non-directory
entries on enabled volumes, and retries transient provider failures up to three
attempts.

The worker revalidates the volume, scope, managed-entry state, provider policy,
input fingerprint, and user-correction lock immediately before and after the
provider call. Canceled jobs remain terminal. Provider responses must satisfy a
typed business JSON schema before they can be persisted. Requests are
metadata-only; local/cloud choice is checked at claim and execution time, and
cloud processing remains disabled by default.

## UI behavior

Spotlight always queries the global index. Enter opens the selected result and
Ctrl/Cmd+Enter reveals it in the file manager. An unmanaged result can be
added to its parent managed scope through a confirmation flow, while the
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
- Fixed-fixture MFT V2/V3 parsing, malformed-page fail-closed behavior, USN
  history-error classification, FSEvents callback/checkpoint behavior,
  Spotlight notification action mapping, shared batch sizing, cancellation,
  native status mapping, and bridge lifecycle idempotence are covered by
  platform-targeted tests; the live Spotlight collection smoke test is an
  explicit ignored test because it requires a real macOS Spotlight database.
- Frontend type checking, targeted Spotlight/settings/permission tests, full
  frontend tests, and production frontend build are run as part of release
  verification. The dual-platform CI quality matrix packages the Windows NSIS
  installer and unsigned macOS DMG on pull requests as well as master pushes;
  tagged releases additionally exercise the optional Developer ID signing path.
- Windows native behavior must be validated on a Windows host and the direct
  Objective-C/Foundation bridge must compile and test on a macOS runner. A
  Windows-only build is not treated as macOS verification.
- The Windows installer was rebuilt successfully with the service hooks. A
  live LocalSystem SCM run, named-pipe status/discovery, real C: MFT scan, and
  post-create USN incremental scan were accepted manually; the interactive
  NSIS post-install/uninstall UI remains a separate acceptance step.
- macOS CI validates native compilation, unit tests, Clippy, and the unsigned
  DMG path. A live user-session Spotlight inventory and signed/notarized DMG
  remain explicit release acceptance checks.
