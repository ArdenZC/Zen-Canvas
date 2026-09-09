# W6-07 Phase 7 native visual evidence

Status: `PARTIAL — 15/16 required Windows captures present`

These captures are native Windows Tauri screenshots obtained from the running
desktop app through Computer Use (`@oai/sky`), using the window-state screenshot
returned by the native binding. They are not browser screenshots or screenshots
of the installed release binary.

## Exact source and runtime

| Field | Value |
| --- | --- |
| Screenshot HEAD | `a758bc13b7630444d740df90cd4c58b84eb61bd7` |
| Screenshot tree | `f0edd0100eb35e1e42460bb8827dd3c923291ac2` |
| Production-changing focus HEAD | `d20b80d493688c19117361a84f9ab2ca4e092093` |
| Production tree | `6613c991ed924730cbb63a895f84fad748a31ffc` |
| Host | Windows 11 Pro, version `10.0.26200`, build `26200`, 64-bit |
| App mode | Tauri `desktop-runtime`, started with `npm run dev` from this worktree |
| Native process | `F:\\CargoTarget\\debug\\zen-canvas.exe` |
| Native window | `Zen Canvas`, window id `4921860` |
| Fixture root | `F:\\Coding\\Zen-Canvas-w6-07-phase7-consolidation\\.tmp-native-fixture` |
| Fixture result | 4 files indexed, 321 B, 7 visible rows including folders |
| Baseline appearance | Light/day theme, default density, Chinese UI |

The screenshot source is the exact docs-only successor `a758bc13` of the
production candidate `d20b80d4`; no production source changed between those
heads. The fixture was scanned through the native folder chooser. No file
mutation, organization decision, cleanup operation, restore operation or rule
change was performed.

## Captured Windows states

| File | Native state | Pixels | Result |
| --- | --- | ---: | --- |
| `windows/01-overview-wide.png` | Overview, light/day, default density | 1282×862 | Captured |
| `windows/02-files-library-selected-inspector.png` | Files Library with indexed fixture, selected item and Inspector | 1282×862 | Captured |
| `windows/03-files-library-selected-keyboard-focus.png` | Files selected item with keyboard/focus attempt | 1282×862 | Captured |
| `windows/04-browse-folder.png` | Files Browse Folder mode | 1282×862 | Captured |
| `windows/05-search.png` | Global Search / Spotlight query state | 1282×862 | Captured |
| `windows/06-settings.png` | Settings appearance and controls | 1282×862 | Captured |
| `windows/07-organize.png` | Organize empty/no-plan state | 1282×862 | Captured |
| `windows/08-cleanup.png` | Cleanup empty/review state | 1282×862 | Captured |
| `windows/09-history.png` | History empty state | 1282×862 | Captured |
| `windows/10-restore-empty.png` | Restore empty state on the combined History/Restore page | 1282×862 | Captured |
| `windows/11-automation.png` | Automation empty rule-library state | 1282×862 | Captured |
| `windows/12-files-dark.png` | Files Library with Inspector, dark theme | 1282×862 | Captured |
| `windows/13-files-compact.png` | Files Library, compact density | 1282×862 | Captured |
| `windows/14-files-980x680.png` | Files Library constrained viewport | 980×675 | Captured; native client capture is 980×675, not exact 980×680 |
| `windows/15-overview-primary-focus.png` | Overview primary action with keyboard focus | 1275×675 | Captured |

The first 13 captures use the native window state returned at 1282×862. The
constrained capture is the actual native screenshot size after resizing the
window; Windows non-client geometry produced 980×675. The final primary-focus
capture was taken after the same resize session at 1275×675.

## Required states not captured

| Expected file | Status | Boundary |
| --- | --- | --- |
| `windows/16-forced-colors-focus.png` | `UNVERIFIED` | Windows Forced Colors was not changed and no CSS emulation is claimed as native evidence. |

`macOS native screenshot evidence: UNVERIFIED — no macOS native host was
available.`

## Computer Use recovery record

On Windows, the working native API is the trusted `@oai/sky` binding:

```js
const { sky } = await import("@oai/sky");
const apps = await sky.list_apps();
const win = await sky.get_window({
  id: 4921860,
  app: "process:F:\\\\CargoTarget\\\\debug\\\\zen-canvas.exe",
});
const state = await win.get_window_state({
  include_screenshot: true,
  include_text: true,
});
```

The CUA convenience methods `cua.listApps()` and `cua.getApp()` are not the
Windows native binding surface; their Windows response is
`Native app bindings are unavailable for windows.` Resetting the CUA session
and importing `@oai/sky` explicitly exposed the live Windows application
inventory and allowed the exact Tauri window to be captured. The earlier
`Trusted RPC service is not configured: sky` result was therefore a binding
initialization problem, not evidence that the app failed to launch.
