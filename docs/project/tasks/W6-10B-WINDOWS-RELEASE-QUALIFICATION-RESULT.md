# W6-10B — Windows Release Qualification — Result

Status: **FAIL / BLOCKED**

Verified: 2026-09-22

## Final disposition

> **WINDOWS RC1 RELEASE QUALIFICATION = FAIL / BLOCKED**

The exact frozen RC1 installer completed installation and uninstallation, but
the installed release binary did not reach a usable product shell on first
launch or after reinstall. This is a hard blocker. The downstream installed-
release gates were not executed because the required native product window was
not usable.

No RC1 source, product code, workflow, version, release policy, registry or
security-policy change was made.

## Activation baseline

| Item | Exact value |
| --- | --- |
| Activation branch | `codex/w6-10b-windows-release-qualification` |
| Activation HEAD | `7db7f8e745b1e0c1400ec5b5f002a55888f0548d` |
| Activation tree | `f92e20185f7a6fe469110bd47cebaf05d1a8b73e` |
| Origin activation | same HEAD |
| `origin/master` | `26c8f83115247c706be294d473b23844ffa4e724` |
| `origin/master` tree | `0f5d6c1b3f0d92f0be905792bb4165623d8d2b12` |
| RC helper | `9c8cdee792f8a2b5078c22c517d8648899440b0c` |
| Activation hosted CI | `35720131675` — SUCCESS |
| Worktree before docs | clean |

## Frozen RC1 identity

| Item | Exact value |
| --- | --- |
| RC1 source | `9c8cdee792f8a2b5078c22c517d8648899440b0c` |
| RC1 tree | `3ec2158bb56ce0a734b2c894793f5fe60b8b3296` |
| Version | `0.1.40` |
| Full Validation | `35702434460` — SUCCESS |
| Release Build | `35704683429` — SUCCESS |
| Windows artifact ID | `10684476661` |
| Artifact digest | `sha256:3df681a8d261f864df00008d160951cd8f15eb07fea1a0e9c2383d36672f1a5e` |
| Installer | `Zen Canvas_0.1.40_x64-setup.exe` |
| Installer size | `9380984` bytes |
| Installer SHA-256 | `c7fed4c0bbd9d065d7b9772a34d67455ad4423c16e7a85e700e0bea52a0eed98` |
| `v0.1.40` tag | ABSENT |
| GitHub Release | ABSENT |
| Publication | DEFERRED |

## Windows environment

- Microsoft Windows 11 Professional, version `10.0.26200`, build `26200`.
- x64; machine `MECHREVO Yilong15Pro Series GM5HG0A`.
- Original and restored primary display: `2560 x 1600 @ 240 Hz`.
- Original and restored Windows scale: `200%` (`DPI 192` observed from
  targetable Explorer).
- Original and restored High Contrast / Forced Colors: OFF.
- Original and restored Narrator: not running.
- Original and restored theme: light / user's `Custom.theme`.
- Original Zen Canvas installation: none.
- Final Zen Canvas installation: absent; application data was not selected for
  deletion during either uninstall.

The original host record is retained at the external evidence directory.

## B01-B08 matrix

| ID | Qualification | Result | Evidence / disposition |
| --- | --- | --- | --- |
| B01 | Installer acquisition / MOTW truth | **C** | The original artifact had no `Zone.Identifier`; a byte-identical copy with `ZoneId=3` was used solely for equivalent Internet Zone path testing. This is not browser-acquired evidence. |
| B02 | SmartScreen / reputation | **UNVERIFIED** | The equivalent-path launch timed out without a targetable SmartScreen prompt. A `smartscreen.exe` process was observed, but no visible warning was captured. |
| B03 | Unknown Publisher / UAC | **UNVERIFIED** | No targetable UAC / publisher presentation was captured. The normal NSIS controls were completable. |
| B04 | NSIS install | **PASS** | Exact installer completed twice at `C:\Program Files\Zen Canvas`. Installed executable and Preview Handler files were observed. |
| B05 | Installed first launch | **FAIL / BLOCKED** | A transient native `Zen Canvas` window showed only a blank white surface and window chrome, then disappeared before a usable shell appeared. |
| B06 | Close / relaunch | **UNVERIFIED** | A usable first-launch state was never reached, so normal close/relaunch preservation could not be tested. |
| B07 | Uninstall | **PASS** | Native uninstaller reported successful completion twice; Explorer was not killed or restarted; application-data deletion remained unchecked. |
| B08 | Reinstall sanity | **FAIL / BLOCKED** | The exact installer completed again, but the installed application again failed to reach a usable product shell. |

## Native launch blocker

The approved native `node_repl + @oai/sky` path was used against the installed
release binary. Direct launch through the installed app ID returned a unique
window:

`process:C:\Program Files\Zen Canvas\zen-canvas.exe`, title `Zen Canvas`.

Immediate native observation exposed only window chrome and a blank white
content surface. After approximately 2.5 seconds the window disappeared and
the native API reported `foreground window did not report a process id`.
A read-only process probe observed a responding `zen-canvas.exe` with
`MainWindowHandle = 0` and an empty `MainWindowTitle`.

This is an installed-release launch failure, not a dev-build or browser
claim. It prevents truthful execution of the downstream release-binary gates.

## Core product smoke

| Area | Result | Reason |
| --- | --- | --- |
| Overview / Files / Library | **UNVERIFIED** | No usable installed product shell. |
| Browse / native Choose Folder | **UNVERIFIED** | No usable installed product shell. |
| Settings / Global Search | **UNVERIFIED** | No usable installed product shell. |
| Organize / Operation Preview | **UNVERIFIED** | No usable installed product shell; no personal files mutated. |
| History / Restore | **UNVERIFIED** | No disposable-fixture product flow reached. |
| Error / recovery navigation | **UNVERIFIED** | No usable installed product shell. |

## Quick Preview and Explorer Preview Handler

| Area | Result | Reason |
| --- | --- | --- |
| Release-binary Quick Preview matrix | **UNVERIFIED** | B05 blocks access to the installed product surface. |
| Explorer Preview Handler | **UNVERIFIED** | The original Explorer Preview Pane was observed, but RC1 handler rendering/lifecycle was not claimed without a usable installed app qualification path. |

## DPI and accessibility matrices

| Area | Result | Reason |
| --- | --- | --- |
| DPI 100% | **UNVERIFIED** | No installed product window available for inspection. |
| DPI 125% | **UNVERIFIED** | No installed product window available for inspection. |
| DPI 150% | **UNVERIFIED** | No installed product window available for inspection. |
| Forced Colors / High Contrast | **UNVERIFIED** | Original OFF state was preserved; no product inspection was attempted. |
| Keyboard-only / focus | **UNVERIFIED** | Required installed product controls were unavailable. |
| Narrator smoke | **UNVERIFIED** | Narrator remained off; required product smoke could not execute. |

No display, theme, Forced Colors or Narrator setting was changed during the
qualification attempt.

## Safety / recovery

Disposition: **UNVERIFIED**. No product shell was available for the bounded
disposable-fixture flows. No personal-file mutation was attempted.

## Uninstall / reinstall final state

The first install and the B08 reinstall both completed through the exact NSIS
installer. Both uninstall runs completed through the native uninstaller with
`Delete the application data` left unchecked. Final read-only checks found:

- `C:\Program Files\Zen Canvas`: absent;
- `zen-canvas.exe`: no running process;
- temporary `Un.exe` uninstaller: no running process.

The external evidence directory is:

`F:\CargoTarget\w6-10b-windows-rc1-9c8cdee\`

No evidence ZIP was created. Raw installer and evidence remain outside the
repository. Evidence filenames are enumerated in the external `manifest.json`.

## Blockers and Owner disposition

1. **B05 FAIL / BLOCKED:** the installed RC1 binary does not reach a usable
   product shell; the native window is blank/transient and then disappears.
2. **B08 FAIL / BLOCKED:** the same behavior reproduces after reinstall.
3. All downstream installed-release rows remain **UNVERIFIED**.

If remediation requires any source, configuration, workflow or package change,
the required disposition is:

> **RC1 REQUIRES OWNER RC2 DISPOSITION**

No RC2 was created and no fix was attempted in W6-10B.

## Current truth

- W6-10A: **COMPLETE / CLOSED / MERGED**; RC1 remains frozen.
- W6-10B: **BLOCKED — WINDOWS RC1 RELEASE QUALIFICATION FAIL / BLOCKED**.
- W6-10C: **ELIGIBLE / NOT ACTIVE**; not activated automatically.
- W6-10D/E/F: **DEPENDENCY-GATED / NOT ACTIVE**.
- `v0.1.40` tag and GitHub Release: **ABSENT**.
- Publication: **DEFERRED**.

## Validation and delivery boundary

This result is documentation-only. No product, test, workflow, version or
release files were changed. Governance/docs checks and the exact docs-only
commit/PR CI result are recorded after this document is added to the activation
branch.
