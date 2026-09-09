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

Every file under `windows/` is an exact-runtime native screenshot captured by
the direct `@oai/sky` session. Placeholder images are not included.

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
| Automation | `PASS` — Automation surface opened and captured in the exact native session |
| Quick Preview host / observed states | `PASS` — Loading, Presentation unsupported, PNG failed, TXT ready, and Floating/Pinned hosts observed; typed/folder and unexercised-format seams remain open |
| Dark / Compact | `PASS` — dark and compact states captured and restored |
| Narrow / DPI | `PARTIAL` — normal/maximized sizes observed; OS theme/DPI variants not changed |
| Primary focus | `PASS` — Tab focus-visible state observed |
| Forced Colors | `UNVERIFIED` |

The previous W6-07 native captures are linked from current truth as historical
evidence. They are not copied or relabeled as W6-09 exact-head evidence.

## Exact-runtime screenshot inventory

| File | State observed | SHA-256 |
| --- | --- | --- |
| [`01-overview.png`](01-overview.png) | Overview shell | `C66DC3E2D0B978F891AE50F14DD7DE2CF3673B0D02234306B23B7CFEE72AA5BB` |
| [`02-files-wide.png`](02-files-wide.png) | Files Library wide list | `419900C7D6625ADC2F0B6CDE1CDD8476049F13EBEBB80E105CED9FED75E13825` |
| [`02-files-wide-adjacent-inspector.png`](02-files-wide-adjacent-inspector.png) | Files Library with adjacent Inspector | `576D08BCE8722050B2AC9D3102EA35240BC5E3B5B9287485958D7668DB81C875` |
| [`03-files-same-row-selected-focus.png`](03-files-same-row-selected-focus.png) | Same-row selected and keyboard-focused | `925D1419072606E8F4526E8E367E50A8F9DB83E1B0CD98E35898A616D33CDDD3` |
| [`05-global-search.png`](05-global-search.png) | Global Search with literal `what?` query | `3F7FD17A6AAD39EAC202C92BB3324DBE0F8D65C1356A1663EC68DDCA8266C90A` |
| [`06-settings.png`](06-settings.png) | Settings / Appearance | `9CACC832846CF1A695D84562C2419F116B95476A73354F62D60C87F5A2CC09A6` |
| [`07-organize.png`](07-organize.png) | Empty Organization Plan | `3ABE2F14209D21702FD7602A3340E4E50832BEABD4E1E8A86D218CF8E54C9845` |
| [`08-cleanup.png`](08-cleanup.png) | Cleanup Safe Trash boundary | `0E30A72C2C120762C81854FAEC35A352EE123FB200A434DEA53830E2093B2D86` |
| [`09-history-restore.png`](09-history-restore.png) | Empty History / Restore | `D953F131622FB6A2209293CA5FD82AFDC1124359FC38F3837C7DF0B71721BF01` |
| [`10-automation.png`](10-automation.png) | Automation surface observed natively | `750BD3E93674412550F836C276610E944F7D766F1A28961DA33D861737130D9D` |
| [`11-preview-loading.png`](11-preview-loading.png) | Floating Quick Preview loading | `1CC06214CF9F0506A736976E0E1308E062442A9BF4D579062B7C8504AE92FBE9` |
| [`12-preview-unsupported.png`](12-preview-unsupported.png) | Presentation preview unsupported | `BB9481CA8A365DF29871BA0402D2A83EF4E7A7D9391C6746941C1A1BAC3433F2` |
| [`13-preview-failed.png`](13-preview-failed.png) | PNG content preview failed state | `6110F13C44E979422FBB47CAB816F30769F78E3821E49BE320CF401EED18DBF3` |
| [`14-preview-ready.png`](14-preview-ready.png) | TXT content preview ready | `A17D12B9A8FBC16412AC4978B84EEC00C480B6D8BD5171CD1489379493EBAF77` |
| [`15-dark-theme.png`](15-dark-theme.png) | Dark theme | `6B1715250C7C7C1E4A085EAAB66ED8ECBFA60C804C74C2C84F075FE0AA1772A8` |
| [`16-dark-compact.png`](16-dark-compact.png) | Dark theme with compact density | `62D9424E6EE5B249510078BB5FBEDD474C535B2F687D1F9E47A57BCDEEB2CFD8` |
| [`17-preview-pinned.png`](17-preview-pinned.png) | Pinned Preview with TXT content ready | `768863A1FF631906DE5E7C9C6E8BC6730C994C1CEE84E8AA812679022523E27E` |

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
recovery, assistive technology and macOS remain `UNVERIFIED` or `PARTIAL`;
Automation is covered only by the exact captured surface state above.
