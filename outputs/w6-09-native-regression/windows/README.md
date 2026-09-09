# W6-09 Windows native evidence

Status: `W6-09 BLOCKED — NATIVE HOST UNAVAILABLE`

## Exact source and runtime

| Field | Value |
| --- | --- |
| Source SHA | `20781c8dc4dc8f24f0ed7d2ce860f5fd62d35ec9` |
| Source tree | `2535499a23be61786543bab19c71e35ee7a1d36f` |
| OS | Microsoft Windows 11 Professional, `10.0.26200`, build `26200` |
| Active unified-computer-use plugin | `C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231` |
| Active config | `C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231\.mcp.json` |
| Enabled surfaces | `browser` before correction; `browser,computer` after correction |
| Architecture | x64-based PC |
| Runtime | Not launched; no targetable native window |
| Exact native process | Not established |
| Scaling | Not observed |
| Fixture | Not created; no mutation flow entered |
| Capture method | `@oai/sky` discovery attempted twice; both returned `Trusted RPC service is not configured: sky` |

No files under `windows/` are screenshots. Placeholder images are intentionally
not created.

## Required representative captures

| Expected state | Result |
| --- | --- |
| Overview | `UNVERIFIED` |
| Files wide + adjacent Inspector | `UNVERIFIED` |
| Files same-row selected + keyboard-focused | `UNVERIFIED` |
| Browse Folder | `UNVERIFIED` |
| Global Search | `UNVERIFIED` |
| Settings | `UNVERIFIED` |
| Organize | `UNVERIFIED` |
| Cleanup | `UNVERIFIED` |
| History / Restore | `UNVERIFIED` |
| Automation | `UNVERIFIED` |
| Quick Preview image / CSV / JSON / folder | `UNVERIFIED` |
| Dark / Compact / narrow | `UNVERIFIED` |
| Primary focus | `UNVERIFIED` |
| Forced Colors | `UNVERIFIED` |

The previous W6-07 native captures are linked from current truth as historical
evidence. They are not copied or relabeled as W6-09 exact-head evidence.

## Computer-use recovery boundary

The active config was backed up before changing only
`CUA_REPL_ENABLED_SURFACES` from `browser` to `browser,computer`:

`C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231\.mcp.json.bak-before-computer-surface-20260909`

A new CUA session check listed real Windows applications/windows, but direct
lookup of the Task Manager by display name and full executable path returned
`Native app bindings are unavailable for windows.` No native window was
targetable, so this is partial discovery rather than recovery.

## Native/browser distinction

No browser result, static source inspection or stale executable is promoted to
Windows native PASS. W6-09 remains BLOCKED until the native binding is usable
and a real Tauri desktop runtime has a targetable window selected from it.
Until that exists,
window chrome, DPI, Forced Colors, Quick Preview, lifecycle, keyboard/focus and
mutation/recovery UI remain `UNVERIFIED`.
