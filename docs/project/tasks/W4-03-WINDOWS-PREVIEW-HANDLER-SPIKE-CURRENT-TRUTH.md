# W4-03 — Windows Preview Handler Architecture + Lifecycle Spike — Current Truth

Recorded: 2026-08-26

Status: **IMPLEMENTED ON DRAFT PR #146 — PENDING INDEPENDENT ACCEPTANCE**

This record describes the implementation on branch
`feat/w4-windows-preview-handler-spike`. It is not a merge, release, Explorer
association, or W4-04 authorization record.

Canonical taskbook base:

`master@3cd96a798c645ef4a845c686cde9971c7d321168`

Implementation commit:

`aacc6b2b934ef896b0d98b67b10a8d03c7084f43`

Implementation tree:

`1c6654a10b3ed6e712aeca3c6f4a4526d5ff8909`

PR: #146 — `W4-03 Windows Preview Handler Architecture + Lifecycle Spike`

## Implemented topology

- `src-tauri/native/windows-preview-handler` is a dedicated Windows-only
  `cdylib`/`rlib`; the main `zen_canvas_tauri` crate remains an application
  crate and is not compiled as a COM DLL.
- `src-tauri/native/host-provided` is the shared, process-local
  `HostProvidedRegistry` and bounded source contract. The main app keeps its
  established module path as a compatibility facade; there is no second
  registry implementation.
- `IClassFactory`, `DllGetClassObject`, `DllCanUnloadNow`,
  `IInitializeWithStream`, `IObjectWithSite`, `IOleWindow`, and
  `IPreviewHandler` are split across COM, state, stream, and window modules.
- `IInitializeWithStream` captures the shell-owned `IStream` and a lightweight
  generation. `DoPreview` adapts the stream behind `HostProvidedReadSource`,
  registers one `WindowsPreviewHandler` capability, performs one bounded read,
  and renders an inert text summary in a child `STATIC` window.
- `Unload` marks the request stale, revokes HostProvided first, then destroys
  the child window and releases site/stream references. Registry post-read
  validation rejects late publication after revoke, cancellation, or expiry.
- Registration tests are an in-process idempotence/cleanup seam only. No HKCU,
  HKLM, extension association, NSIS, signing, or installer behavior was added.

## Authority and reuse boundary

The reusable W4-04 seam is the bounded shell-owned source plus the
generation-scoped lifecycle. The existing W3 provider tree remains owned by
the main runtime's ReadGate, scheduler, and provider registry. This spike does
not copy or fork that tree; any future narrow provider extraction requires a
separate review and must preserve those authorities.

The implementation does not reconstruct a path from `IStream`, accept a
renderer path, convert Managed/Ephemeral sources to HostProvided, launch the
full Tauri UI, or activate `WindowsQuickPreview`.

## Local evidence at the implementation commit

Evidence levels follow the W4-03 taskbook:

| Level | Result |
| --- | --- |
| A — Rust unit/contract evidence | PASS: shared HostProvided 2 tests; Windows handler 6 tests; main W4-01 HostProvided lifecycle 13 focused tests; main Rust full suite 919 passed, 23 ignored; frontend 1,320 tests passed. |
| B — Windows DLL artifact | PASS: `cargo build --manifest-path src-tauri/native/windows-preview-handler/Cargo.toml --release --locked` on Windows x64; `cargo fmt` and `clippy -D warnings` also passed. |
| C — executable COM harness | UNVERIFIED; no separate executable harness was run. |
| D — `prevhost.exe` | UNVERIFIED; no host-process load or low-integrity evidence was run. |
| E — Explorer Preview Pane | UNVERIFIED; no Explorer association or user-facing Preview Pane evidence was run. |

The deterministic registry tests cover bounded offset reads, invalid/stale
generation, revoke/cancellation races, expiry, lock-release behavior, and
cleanup. They do not substitute for C/D/E native-host evidence or an
executable OS-level file-lock test.

## Acceptance state

The implementation and local gates are complete for handoff. Independent
ChatGPT exact-head architecture audit, exact-head hosted CI, final PR-tree CI,
and any human decision on C/D/E evidence remain pending. W4-04 remains
dependency-gated behind independent acceptance of this spike. W4-02 remains an
independent parallel track and W5 remains inactive.

