# W6-09 whole-product native regression evidence

Status: `W6-09 BLOCKED — NATIVE HOST UNAVAILABLE`

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
correction inferred from this run. The current-truth updates in
`docs/project/STATUS.md`, `docs/project/ROADMAP.md` and the W6 initiative are
the only intended repository changes at this stage.

## Host and capture availability

| Field | Value |
| --- | --- |
| Host OS | Microsoft Windows 11 Professional, `10.0.26200`, build `26200` |
| Architecture | x64-based PC |
| Computer-use binding | `@oai/sky` |
| Active plugin | `C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231` |
| Active plugin version | `26.901.51231` |
| Active config | `C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231\.mcp.json` |
| Enabled surfaces before correction | `browser` |
| Enabled surfaces after correction | `browser,computer` |
| Attempted native discovery | `sky.list_apps()` twice before correction |
| Discovery result | `Trusted RPC service is not configured: sky` |
| Post-correction session discovery | `cua.getState()` listed native apps/windows; direct native binding lookup failed |
| Post-correction binding result | `Native app bindings are unavailable for windows.` |
| Targetable live Tauri window | None |
| Exact-head native executable | Not established |
| Disposable fixture | Not created; no mutation flow was entered |
| Capture method | No capture; no native window was targetable |

The known `F:\CargoTarget\debug\zen-canvas.exe` was not used as evidence. Its
source identity was not established for the W6-09 baseline, and a stale binary
cannot prove this branch or its native UI. The historical W6-07 screenshots
remain historical evidence and are not upgraded by this record.

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

On the retry in a new CUA session, `cua.getState()` listed real Windows
applications and windows, but both `cua.getApp("任务管理器")` and the full
`C:\Windows\System32\Taskmgr.exe` path returned
`Native app bindings are unavailable for windows.` This is partial discovery,
not native control or recovery.

Recovery is proven only when native applications/windows are returned through
a usable binding and a real disposable/native window can be targeted. The
result therefore remains `W6-09 BLOCKED — NATIVE HOST UNAVAILABLE`.

To restore the pre-correction config if required, first stop the owning Codex
session, then copy the adjacent backup over the active path and restart Codex:

```powershell
Copy-Item -LiteralPath "C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231\.mcp.json.bak-before-computer-surface-20260909" -Destination "C:\Users\77588\.codex\plugins\cache\openai-bundled\unified-computer-use\26.901.51231\.mcp.json"
```

## Native/browser boundary

The status in this package is intentionally `W6-09 BLOCKED — NATIVE HOST
UNAVAILABLE`, not PASS. Browser
automation, source inspection and hosted logic checks can support debugging,
but `Browser PASS != Native PASS`. The missing Windows native discovery also
means DPI, titlebar, Forced Colors, first-launch/recovery and native Preview
claims are not made here. macOS has no GUI host in this environment and is
likewise `UNVERIFIED`.

## Entry residual dispositions

These dispositions come from the Issue #241 entry gate and are not release
waivers:

| Residual | Entry disposition | W6-09 result in this environment |
| --- | --- | --- |
| Cleanup Windows extended-path rejection | `CLOSED / FIXED` | Native regression not run; no reproduction asserted |
| Typed/folder Quick Preview gap | `ACCEPTED DEFER` | Exact-head Windows/macOS native re-verification remains open |
| Organization Plan authoritative safe-preview degradation | `ENVIRONMENT-SPECIFIC` | Supported-native fixture reproduction remains open; fail-closed behavior is not weakened |
| Global Index unavailable / zero-source state | `ACCEPTED DEFER` | Exact-head native source/state re-evaluation remains open |
| Browse first-scan / recovery friction | `ACCEPTED DEFER` | Exact-head native first-launch/restart re-evaluation remains open |

## Native acceptance matrix

The machine-readable form is [`matrices/native-regression.json`](matrices/native-regression.json).

| Area | Result | Evidence boundary |
| --- | --- | --- |
| Windows native UI / shell / Files | `UNVERIFIED` | No targetable live Tauri window |
| Windows window chrome / caption controls / drag region | `UNVERIFIED` | No native window; no browser substitution |
| Windows DPI 100% / 125% / 150% | `UNVERIFIED` | No native window; OS scaling not changed |
| Windows Forced Colors | `UNVERIFIED` | No native window; OS setting was not changed |
| Windows Quick Preview | `UNVERIFIED` | W6-08 browser/integration evidence is not native evidence |
| Windows Organize / Cleanup / Restore | `UNVERIFIED` | No disposable fixture or mutation flow entered |
| Windows first launch / scan / restart recovery | `UNVERIFIED` | No native runtime launched through the available binding |
| macOS native UI / Retina / titlebar | `UNVERIFIED` | No real macOS GUI host |
| macOS Quick Preview / Quick Look seam | `UNVERIFIED` | No real macOS GUI host |
| Keyboard / focus / selection distinction | `UNVERIFIED` | No native interaction session |
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
