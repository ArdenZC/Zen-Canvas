# W6-09 Windows native evidence

Status: `W6-09 ACTIVE — NATIVE REGRESSION IN PROGRESS`

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
| Runtime | `F:\CargoTarget\debug\zen-canvas.exe`, launched from the exact-baseline detached worktree |
| Exact native process | PID `33944`; binary SHA-256 `70AF9DBDEAFD508EE31CDEAF06C159A4E586E94A218AC8479A9E23FDDC5695B8` |
| Targetable window | `process:F:\CargoTarget\debug\zen-canvas.exe`, window `45289920`, title `Zen Canvas` |
| Observed window sizes | `1282×862` normal; `1920×1032` maximized |
| Scaling | OS scaling variants not changed; DPI result remains `PARTIAL` |
| Fixture | Not created; no mutation flow entered |
| Capture method | Direct `@oai/sky` `list_apps` / `get_window` / `get_window_state` screenshots |

No files under `windows/` are screenshots. Placeholder images are intentionally
not created.

## Required representative captures

| Expected state | Result |
| --- | --- |
| Overview | `PASS` — native shell/Overview opened |
| Files wide + adjacent Inspector | `PASS` |
| Files same-row selected + keyboard-focused | `PASS` |
| Browse Folder | `UNVERIFIED` — locations remained `状态未知`; no folder opened |
| Global Search | `PASS` — `what?` literal query, Ctrl+K and Escape observed |
| Settings | `PASS` — General and Appearance opened |
| Organize | `PASS` — empty plan state observed |
| Cleanup | `PARTIAL` — Safe Trash boundary observed; no mutation entered |
| History / Restore | `PASS` — empty state observed |
| Automation | `UNVERIFIED` — not part of this native pass |
| Quick Preview image / CSV / JSON / folder | `PARTIAL` — Presentation, Spreadsheet and Document states plus Floating/Pinned hosts observed; typed/folder seam remains open |
| Dark / Compact / narrow | `PARTIAL` — normal/maximized sizes observed; OS theme/DPI variants not changed |
| Primary focus | `PASS` — Tab focus-visible state observed |
| Forced Colors | `UNVERIFIED` |

The previous W6-07 native captures are linked from current truth as historical
evidence. They are not copied or relabeled as W6-09 exact-head evidence.

## Computer-use recovery boundary

The active config was backed up before changing only
`CUA_REPL_ENABLED_SURFACES` from `browser` to `browser,computer`:

`C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231\.mcp.json.bak-before-computer-surface-20260909`

A new CUA session check listed real Windows applications/windows. The
`cua.getApp()` wrapper still returned `Native app bindings are unavailable for
windows.`, but the direct `@oai/sky` binding required by the Computer Use
skill successfully selected Task Manager and then the exact-runtime Zen Canvas
window. All UI actions in this record use direct `@oai/sky`.

## Native/browser distinction

No browser result, static source inspection or stale executable is promoted to
Windows native PASS. The direct native binding is usable, so W6-09 is active
and in progress rather than host-blocked. The evidence is not final acceptance:
Forced Colors, Browse folder, disposable mutation fixtures, direct exit/relaunch
recovery, Automation, assistive technology and macOS remain `UNVERIFIED` or
`PARTIAL`.
