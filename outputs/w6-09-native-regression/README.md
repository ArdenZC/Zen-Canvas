# W6-09 whole-product native regression evidence

Status: `W6-09 ACTIVE — NATIVE REGRESSION IN PROGRESS`

This is the bounded W6-09 evidence index for Issue #241. The exact activation
baseline was verified before any edit. The evidence package deliberately does
not contain placeholder screenshots: no native screenshot is evidence unless
it comes from a targetable live Tauri window at the recorded source identity.

## Exact source and task state

| Field | Value |
| --- | --- |
| Activation baseline | `master@20781c8dc4dc8f24f0ed7d2ce860f5fd62d35ec9` |
| Baseline tree | `2535499a23be61786543bab19c71e35ee7a1d36f` |
| W6-09 branch | `codex/w6-09-native-regression` |
| Task authority | [Issue #241 — W6-09 Whole-Product Native Regression](https://github.com/ArdenZC/Zen-Canvas/issues/241) |
| Previous track | W6-08 complete through PR #240 |
| Native evidence package | This directory |

The branch started at the exact baseline and has no production/native
correction inferred from this run. The evidence-package updates, the 17
exact-runtime screenshots below and the current-truth updates in
`docs/project/STATUS.md`, `docs/project/ROADMAP.md` and the W6 initiative are
the only intended repository changes at this stage.

## Host and capture availability

| Field | Value |
| --- | --- |
| Host OS | Microsoft Windows 11 Professional, `10.0.26200`, build `26200` |
| Architecture | x64-based PC |
| Computer-use binding | `@oai/sky` direct native API |
| Active plugin | `C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231` |
| Active plugin version | `26.901.51231` |
| Active config | `C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231\.mcp.json` |
| Enabled surfaces before correction | `browser` |
| Enabled surfaces after correction | `browser,computer` |
| Attempted native discovery | `sky.list_apps()` twice before correction |
| Discovery result | `Trusted RPC service is not configured: sky` |
| Post-correction session discovery | `sky.list_apps()` returned native apps and an exact-runtime Zen Canvas window |
| Post-correction binding result | `sky.get_window()` / `activate_window()` / `get_window_state()` PASS |
| Targetable live Tauri window | `process:F:\CargoTarget\debug\zen-canvas.exe`, window `45289920`, title `Zen Canvas` |
| Exact-head native executable | `F:\CargoTarget\debug\zen-canvas.exe`, PID `33944` |
| Exact-head binary SHA-256 | `70AF9DBDEAFD508EE31CDEAF06C159A4E586E94A218AC8479A9E23FDDC5695B8` |
| Observed window sizes | `1282×862` normal; `1920×1032` maximized |
| Disposable fixture | Not created; no mutation flow was entered |
| Capture method | Direct `@oai/sky` `list_apps` / `get_window` / `get_window_state` screenshots |

The exact-runtime `F:\CargoTarget\debug\zen-canvas.exe` was built from the
detached worktree at the recorded activation SHA/tree. The separately
installed `C:\Program Files\Zen Canvas\zen-canvas.exe` was not used. The
historical W6-07 screenshots remain historical evidence and are not upgraded
by this record.

## Exact-runtime screenshot inventory

Every file below was captured from the targetable window and runtime recorded
above. The SHA-256 values are the evidence identities; no placeholder or
browser screenshot is included.

| File | State observed | SHA-256 |
| --- | --- | --- |
| [`01-overview.png`](windows/01-overview.png) | Overview shell | `C66DC3E2D0B978F891AE50F14DD7DE2CF3673B0D02234306B23B7CFEE72AA5BB` |
| [`02-files-wide.png`](windows/02-files-wide.png) | Files Library wide list | `419900C7D6625ADC2F0B6CDE1CDD8476049F13EBEBB80E105CED9FED75E13825` |
| [`02-files-wide-adjacent-inspector.png`](windows/02-files-wide-adjacent-inspector.png) | Files Library with adjacent Inspector | `576D08BCE8722050B2AC9D3102EA35240BC5E3B5B9287485958D7668DB81C875` |
| [`03-files-same-row-selected-focus.png`](windows/03-files-same-row-selected-focus.png) | Same-row selected and keyboard-focused | `925D1419072606E8F4526E8E367E50A8F9DB83E1B0CD98E35898A616D33CDDD3` |
| [`05-global-search.png`](windows/05-global-search.png) | Global Search with literal `what?` query | `3F7FD17A6AAD39EAC202C92BB3324DBE0F8D65C1356A1663EC68DDCA8266C90A` |
| [`06-settings.png`](windows/06-settings.png) | Settings / Appearance | `9CACC832846CF1A695D84562C2419F116B95476A73354F62D60C87F5A2CC09A6` |
| [`07-organize.png`](windows/07-organize.png) | Empty Organization Plan | `3ABE2F14209D21702FD7602A3340E4E50832BEABD4E1E8A86D218CF8E54C9845` |
| [`08-cleanup.png`](windows/08-cleanup.png) | Cleanup Safe Trash boundary | `0E30A72C2C120762C81854FAEC35A352EE123FB200A434DEA53830E2093B2D86` |
| [`09-history-restore.png`](windows/09-history-restore.png) | Empty History / Restore | `D953F131622FB6A2209293CA5FD82AFDC1124359FC38F3837C7DF0B71721BF01` |
| [`10-automation.png`](windows/10-automation.png) | Automation surface observed natively | `750BD3E93674412550F836C276610E944F7D766F1A28961DA33D861737130D9D` |
| [`11-preview-loading.png`](windows/11-preview-loading.png) | Floating Quick Preview loading | `1CC06214CF9F0506A736976E0E1308E062442A9BF4D579062B7C8504AE92FBE9` |
| [`12-preview-unsupported.png`](windows/12-preview-unsupported.png) | Presentation preview unsupported | `BB9481CA8A365DF29871BA0402D2A83EF4E7A7D9391C6746941C1A1BAC3433F2` |
| [`13-preview-failed.png`](windows/13-preview-failed.png) | PNG content preview failed state | `6110F13C44E979422FBB47CAB816F30769F78E3821E49BE320CF401EED18DBF3` |
| [`14-preview-ready.png`](windows/14-preview-ready.png) | TXT content preview ready | `A17D12B9A8FBC16412AC4978B84EEC00C480B6D8BD5171CD1489379493EBAF77` |
| [`15-dark-theme.png`](windows/15-dark-theme.png) | Dark theme | `6B1715250C7C7C1E4A085EAAB66ED8ECBFA60C804C74C2C84F075FE0AA1772A8` |
| [`16-dark-compact.png`](windows/16-dark-compact.png) | Dark theme with compact density | `62D9424E6EE5B249510078BB5FBEDD474C535B2F687D1F9E47A57BCDEEB2CFD8` |
| [`17-preview-pinned.png`](windows/17-preview-pinned.png) | Pinned Preview with TXT content ready | `768863A1FF631906DE5E7C9C6E8BC6730C994C1CEE84E8AA812679022523E27E` |

## Computer-use configuration diagnosis and correction

The active Codex process was using the only discovered unified-computer-use
cache version, `26.901.51231`. Its `launch.mjs` derives
`NODE_REPL_TRUSTED_SERVICES` from `CUA_REPL_ENABLED_SURFACES`; with only
`browser`, the native `sky` service was not registered even though the config
contained a `sky` value. No second unified-computer-use cache version was found.

The user-authorized, narrowly scoped correction changed only
`mcpServers.cua_repl.env.CUA_REPL_ENABLED_SURFACES`:

```text
browser  →  browser,computer
```

Before editing, the exact active file was backed up to:

`C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231\.mcp.json.bak-before-computer-surface-20260909`

The backup SHA-256 matched the pre-edit active config:
`3531D5638CDC2A72E20DEEA6D5875DD359BE877F638154376817A0592885BCC6`.
No other field or permission was changed.

`CODEX RESTART REQUIRED`: the existing `launch.mjs`/Codex app-server was
started before this correction, so this session has not proved recovery. After
a full Codex restart, initialize the CUA session and run:

```js
const { sky } = await import("@oai/sky");
const apps = await sky.list_apps();
apps;
```

On the retry in a new CUA session, the `cua.getApp()` wrapper still returned
`Native app bindings are unavailable for windows.` The direct computer-use
entry required by the skill was then initialized with `@oai/sky`:
`sky.list_apps()` returned the native inventory, and a fresh
`sky.list_windows()` / `sky.get_window()` selection for Task Manager produced
a matching screenshot. The exact-baseline Zen Canvas runtime was then
selected uniquely by its returned process-backed window and produced matching
native screenshots through `sky.get_window_state()`.

This proves the direct native binding is usable. All W6-09 Windows UI actions
below use only direct `@oai/sky`; the `cua.getApp()` wrapper failure is not
used as the native evidence path.

To restore the pre-correction config if required, first stop the owning Codex
session, then copy the adjacent backup over the active path and restart Codex:

```powershell
Copy-Item -LiteralPath "C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231\.mcp.json.bak-before-computer-surface-20260909" -Destination "C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231\.mcp.json"
```

## Native/browser boundary

The status in this package is intentionally `W6-09 ACTIVE — NATIVE REGRESSION
IN PROGRESS`, not final release acceptance. Browser automation, source
inspection and hosted logic checks can support debugging, but `Browser PASS !=
Native PASS`. The direct native run covers only the states listed below;
Forced Colors, Narrator, macOS and the uncompleted recovery/fixture paths
remain `UNVERIFIED` or `PARTIAL`.

## Entry residual dispositions

These dispositions come from the Issue #241 entry gate and are not release
waivers:

| Residual | Entry disposition | W6-09 result in this environment |
| --- | --- | --- |
| Cleanup Windows extended-path rejection | `CLOSED / FIXED` | Cleanup safety boundary observed; extended-path mutation reproduction not entered |
| Typed/folder Quick Preview gap | `ACCEPTED DEFER` | Exact-head Windows Preview host observed for supported metadata states; typed/folder seam remains open |
| Organization Plan authoritative safe-preview degradation | `ENVIRONMENT-SPECIFIC` | Supported-native fixture reproduction remains open; fail-closed behavior is not weakened |
| Global Index unavailable / zero-source state | `ACCEPTED DEFER` | Exact-head native source/state re-evaluation remains open |
| Browse first-scan / recovery friction | `ACCEPTED DEFER` | Browse cards remained `状态未知`; first-scan/restart recovery remains open |

## Native acceptance matrix

The machine-readable form is [`matrices/native-regression.json`](matrices/native-regression.json).

| Area | Result | Evidence boundary |
| --- | --- | --- |
| Windows native UI / shell / Files | `PASS` | Exact-baseline Zen Canvas window selected through direct `@oai/sky`; live screenshots matched the returned process-backed window |
| Windows window chrome / caption controls / drag region | `PASS` | Native titlebar visible; maximize/restore and close-confirmation seam observed |
| Windows DPI 100% / 125% / 150% | `PARTIAL` | Normal `1282×862` and maximized `1920×1032` observed; OS scaling variants were not changed |
| Windows Forced Colors | `UNVERIFIED` | OS setting was not changed |
| Windows Quick Preview host / observed states | `PASS` | Loading, Presentation unsupported, PNG failed, TXT ready, Floating and Pinned Preview states observed; typed/folder and unexercised-format seams remain open |
| Windows Files / Inspector / selected+focus row | `PASS` | Full index, same-row checkmark/focus highlight and adjacent Inspector observed |
| Windows Browse Folder | `UNVERIFIED` | Browse locations remained `状态未知`; no folder was opened |
| Windows Settings | `PASS` | Settings and Appearance sections opened natively; dark and compact states captured and restored |
| Windows dark / compact states | `PASS` | Exact-runtime dark and compact screenshots captured and the settings were restored; narrow/DPI variants remain outside this PASS |
| Windows Organize / Cleanup / Restore | `PARTIAL` | Empty Organize plan, Cleanup Safe Trash boundary and empty History/Restore observed; no mutation or disposable fixture entered |
| Windows Automation | `PASS` | Automation surface opened and captured in the exact native session |
| Windows first launch / scan / restart recovery | `PARTIAL` | Close-confirmation/recovery seam observed; direct exit/relaunch was not confirmed |
| Keyboard / focus / selection distinction | `PASS` | Ctrl+K, Escape, Tab focus and Files same-row selected+focus observed |
| macOS native UI / Retina / titlebar | `UNVERIFIED` | No real macOS GUI host |
| macOS Quick Preview / Quick Look seam | `UNVERIFIED` | No real macOS GUI host |
| Reduced Motion | `UNVERIFIED` | No native interaction session |
| Narrator | `UNVERIFIED` | Not run |
| VoiceOver | `UNVERIFIED` | No macOS host; not run |

## Source-seam inspection

The following owners were inspected symbol-first to establish the bounded
surface without changing architecture:

- `src/components/AppShell.tsx` and `src/components/ShellChrome.tsx` — native
  platform control branches, drag-safe titlebar and global Search placement;
- `src/views/fileLibrary/preview/` — existing Preview Core/controller,
  Floating/Pinned hosts and W6-08 content presentation;
- Files workspace, Inspector, Settings, Organize, Cleanup, History/Restore and
  Automation owners — existing projections and interaction seams;
- existing accessibility, architecture, remediation, Preview, cleanup,
  recovery and native hardening tests.

This inspection is not a native acceptance result. No new durable authority,
schema, permission, provider, mutation or recovery design was introduced.

## Local validation

Run from the W6-09 worktree with the existing shared dependency directory
temporarily linked into this worktree; no dependency installation was
performed:

- `python docs/design/w6-06/07-v26/rebuild-v26.py --verify-only` — PASS, 4/4
  checksum-bound V26 assets;
- `npm run typecheck` — PASS;
- `npm test` — PASS, 148 test files / 1573 tests;
- `npm run test:remediation` — PASS, 14 tests;
- `npm run test:performance:architecture` — PASS, 3 files / 28 tests;
- `npm run build:frontend` — PASS;
- `npm run check:rust:release` — PASS.

These are code/build checks on the exact production baseline plus this
documentation-only candidate. They do not change the native matrix above.

## Re-entry condition

Re-run the W6-09 matrix only after a full Codex restart and when the trusted
computer-use binding can expose one
exactly selected live Windows Tauri window (and, for macOS claims, a real
supported macOS GUI host). Record the exact source SHA/tree, runtime, window
size/scaling, disposable fixture and captures before changing any product
code. A concrete native defect may receive a bounded same-PR correction; no
correction is justified by this unavailable-evidence run.
