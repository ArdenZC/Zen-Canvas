# W6-10B — Windows Release Qualification — Activation

Status: **ACTIVE — implementation**

Issue: #248

Qualification authority:

- [W6-10 Release Re-entry Qualification Matrix](W6-10-RELEASE-REENTRY-QUALIFICATION-MATRIX.md)
- [W6-10A RC1 Freeze Result](W6-10A-RELEASE-CANDIDATE-FREEZE-RESULT.md)

## Activation baseline

Current project/docs baseline:

- `master@26c8f83115247c706be294d473b23844ffa4e724`
- tree `0f5d6c1b3f0d92f0be905792bb4165623d8d2b12`
- W6-10A: **COMPLETE / CLOSED / MERGED**
- W6-10C: **ELIGIBLE / NOT ACTIVE**
- publication: **DEFERRED**

Frozen RC1 remains:

- source `9c8cdee792f8a2b5078c22c517d8648899440b0c`
- tree `3ec2158bb56ce0a734b2c894793f5fe60b8b3296`
- version `0.1.40`
- Full Validation `35702434460` — **SUCCESS**
- Release Build `35704683429` — **SUCCESS**
- Windows artifact ID `10684476661`
- artifact digest `sha256:3df681a8d261f864df00008d160951cd8f15eb07fea1a0e9c2383d36672f1a5e`
- installer `Zen Canvas_0.1.40_x64-setup.exe`
- installer size `9380984` bytes
- installer SHA-256 `c7fed4c0bbd9d065d7b9772a34d67455ad4423c16e7a85e700e0bea52a0eed98`
- tag `v0.1.40`: **ABSENT**
- GitHub Release `v0.1.40`: **ABSENT**

The RC1 source and artifact identities are immutable during W6-10B.

## Scope

W6-10B performs real Windows **release-artifact** qualification.

This is not another development/redesign pass.

Authorized qualification areas:

1. installer provenance/checksum;
2. SmartScreen / unsigned-publisher / UAC presentation;
3. NSIS install;
4. installed first launch;
5. restart/relaunch;
6. uninstall;
7. reinstall sanity;
8. release-binary core product smoke;
9. release-binary Zen Quick Preview;
10. Explorer Preview Handler;
11. Windows DPI 100/125/150;
12. Forced Colors / High Contrast;
13. Narrator / keyboard / focus smoke;
14. bounded recovery and disposable-fixture mutation/restore evidence;
15. evidence manifest and Windows qualification result.

## Hard boundary

Do NOT change:

- RC1 source;
- RC helper ref;
- release artifact;
- product/UI code;
- workflows;
- version files;
- Preview architecture;
- Browse architecture;
- schema;
- release policy.

If a defect requires production/config/workflow change:

> **STOP — RC1 REQUIRES OWNER RC2 DISPOSITION**

Do not patch RC1 or silently build a replacement.

## Evidence source

Primary installer should be the exact artifact frozen by W6-10A.

Preferred external evidence location:

`F:\CargoTarget\w6-10b-windows-rc1-9c8cdee\`

Before install, recompute SHA-256 and require exact match:

`c7fed4c0bbd9d065d7b9772a34d67455ad4423c16e7a85e700e0bea52a0eed98`

If the frozen installer is unavailable locally, download artifact ID
`10684476661` from Release Build run `35704683429`.

Do not use a local rebuild as release evidence.

## B1 — install / launch / removal

Run the real release installer.

Capture the actual observed path truthfully.

### B01 — browser-acquired / Internet Zone provenance

The release matrix asks for browser-acquired installer / MOTW or equivalent
Internet Zone provenance.

If the GitHub artifact ZIP was obtained through a path that preserves MOTW,
record it.

If not, create the closest truthful equivalent only when Windows can preserve
the same Internet Zone/Mark-of-the-Web semantics without changing installer
bytes. Record exactly what was done.

Do not claim browser-download evidence when there was none.

### B02 — SmartScreen / reputation

Record the actual UI:

- SmartScreen warning shown;
- reputation warning absent;
- unavailable/unverifiable.

Do not treat absence of a warning as signed/reputed PASS.

Current release policy is unsigned.

### B03 — Unknown Publisher / UAC

Record the actual unsigned installer/UAC presentation.

The warning itself is not a defect under current policy.

The install path must remain understandable and completable through normal
Windows controls.

### B04-B08

Require:

- NSIS install completes;
- installed Zen Canvas launches;
- close/relaunch succeeds;
- uninstall completes without killing/restarting Explorer for PASS;
- reinstall succeeds;
- installed app still launches after reinstall.

Record install directory and executable identity where available.

## B2 — core product smoke

Use the installed release binary, not dev/Tauri CLI.

Required states:

- Overview;
- Files;
- Library;
- Browse using native Choose Folder;
- Settings;
- Global Search;
- one safe Organize / Operation Preview path;
- History;
- Restore with disposable fixtures;
- error/recovery navigation.

Do not run destructive mutation against personal files.

Create a bounded disposable fixture directory outside the repository if
needed.

Preserve all accepted W6-09 behavior.

## B3 — release-binary Zen Quick Preview

Required:

- Floating Quick Preview;
- Pinned Quick Preview;
- PDF >1 MiB;
- PDF continuous pages 1/2/3;
- one late PDF page;
- Markdown rendered document mode;
- image Preview;
- Loading;
- Failed/unsupported;
- Details closed;
- Details open;
- pinned source remains frozen while background selection changes;
- source switch while loading;
- close/cancel smoke;
- Dark;
- Compact.

This must come from the installed release binary.

Do not reuse W6-09 dev-build screenshots as RC1 release-binary PASS evidence.

## B4 — Explorer Preview Handler

Use real Windows Explorer Preview Pane.

Do not expand extension ownership.

Test at least one already-owned representative text/code extension.

Require:

- Preview Pane renders;
- Explorer remains responsive;
- keyboard/focus does not become trapped in the handler;
- navigating to another file replaces/unloads the prior preview;
- closing/navigating away does not leave a visible stale handler.

If unregister/uninstall is tested, Explorer must not need to be killed or
manually restarted for PASS.

## B5 — DPI 100 / 125 / 150

This matrix is release-blocking.

Test all three actual Windows display scale settings:

- 100%;
- 125%;
- 150%.

At each scale inspect at minimum:

- native titlebar / window controls;
- shell/navigation;
- Files list/grid;
- Settings;
- dialogs/popovers;
- Quick Preview;
- text clipping;
- hit targets;
- focus indication.

Capture a bounded evidence set.

If changing scale requires sign-out/restart in the host environment, record the
actual system behavior and perform the required supported transition if
feasible.

Restore the user's original display scale after qualification.

Do not claim a scale was tested if only browser zoom or CSS zoom changed.

## B6 — Forced Colors / High Contrast

This matrix is release-blocking.

Enable real Windows Forced Colors / High Contrast.

Inspect:

- navigation selected state;
- keyboard focus;
- buttons;
- Files selection;
- Settings;
- Quick Preview;
- destructive/recovery actions.

Require readable content and distinguishable focus/selection/controls.

Record the exact theme/state used.

Restore the user's original accessibility/theme setting after qualification.

## B7 — Narrator / keyboard / focus

Perform a bounded real Narrator smoke.

At minimum:

- navigation controls receive meaningful announcements;
- Files selection is understandable;
- Settings controls expose meaningful names/state;
- Preview controls are reachable and understandable;
- modal/dialog has a usable exit path.

Also execute keyboard-only smoke:

- Tab / Shift+Tab;
- Enter/Space where applicable;
- Escape;
- Space Quick Preview;
- no focus trap;
- visible focus.

A P0/P1 accessibility failure in a core flow blocks release.

Minor non-core polish issues may be recorded as residuals with severity.

Restore Narrator state after qualification.

## B8 — bounded safety / recovery

Use disposable fixtures only.

Required bounded smoke:

- Operation Preview exists before mutation;
- one representative safe mutation path;
- Safe Trash / Restore representative path where current product exposes it;
- cancellation/recovery;
- restart/relaunch after representative operation;
- Browse recovery if a prior residual is reproducible;
- Organization Plan remains fail-closed when unavailable;
- Global Index remains truthful when no usable source exists.

Do not broaden filesystem mutation scope.

## Native control

Use the working Windows native-control path.

If `cua_repl` exposes only browser surface, the previously proven fallback:

`node_repl + @oai/sky`

may be used for the real Zen Canvas native window.

Evidence must correspond to the installed release binary.

If native control cannot target the installed app truthfully:

STOP and report the evidence limitation.

## Evidence package

Create a bounded external package, for example:

`F:\CargoTarget\w6-10b-windows-rc1-9c8cdee\`

Include:

- `manifest.json`;
- install/provenance evidence;
- first launch;
- relaunch;
- core product;
- Quick Preview;
- Explorer Preview Handler;
- DPI 100/125/150;
- Forced Colors;
- accessibility/focus;
- uninstall/reinstall;
- relevant logs/checklists.

Manifest must record:

- RC1 source/tree/version;
- installer filename/size/SHA-256;
- Windows version/build;
- machine architecture;
- initial/original display scale;
- each tested display scale;
- accessibility/theme states;
- exact evidence filenames;
- PASS/FAIL/UNVERIFIED per qualification ID.

Do not commit native screenshots/artifacts unless existing project routing
explicitly requires it. Keep the raw evidence external and commit only durable
result/current-truth documentation.

## PASS / FAIL rule

Allowed lane result:

### WINDOWS RELEASE QUALIFICATION PASS

Only if every hard blocker is PASS:

- install/first-launch/restart/uninstall/reinstall;
- core installed-app flows;
- Quick Preview critical formats;
- Explorer Preview Handler;
- DPI 100/125/150;
- Forced Colors.

Required Narrator/accessibility smoke must execute with no unresolved P0/P1
core-flow defect.

### WINDOWS RELEASE QUALIFICATION FAIL / BLOCKED

Any hard-blocking FAIL or UNVERIFIED item prevents PASS.

Do not hide missing evidence as a residual.

If a production defect requires code change:

stop and return to Owner for RC2 disposition.

## Result document

Create:

`docs/project/tasks/W6-10B-WINDOWS-RELEASE-QUALIFICATION-RESULT.md`

Record:

- activation baseline;
- RC1/artifact identity;
- OS/hardware;
- B01-B08 disposition;
- DPI matrix;
- Forced Colors;
- Narrator/keyboard;
- release-binary Quick Preview;
- Explorer Preview Handler;
- uninstall/reinstall;
- evidence directory/ZIP SHA-256 if zipped;
- concrete failures/residuals;
- final lane disposition.

## Completion boundary

If Windows qualification PASS:

- W6-10B = **COMPLETE / CLOSED — WINDOWS RELEASE QUALIFICATION PASS**;
- W6-10C remains **ELIGIBLE / NOT ACTIVE**;
- W6-10D/E/F remain dependency-gated;
- publication remains **DEFERRED**.

If FAIL/BLOCKED:

- W6-10B remains blocked;
- do not activate W6-10C automatically;
- Owner decides whether macOS qualification may proceed in parallel or whether
  RC2 remediation comes first.

## Not authorized

Do NOT:

- modify RC1;
- create RC2;
- change product code;
- change workflows;
- create tag;
- create GitHub Release;
- publish;
- start W6-10C/D/E/F;
- perform broad personal-file mutation.

Stop for Owner / ChatGPT after producing the result/evidence.
