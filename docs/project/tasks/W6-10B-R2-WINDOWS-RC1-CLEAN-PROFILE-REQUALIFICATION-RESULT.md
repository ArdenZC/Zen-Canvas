# W6-10B-R2 — Windows RC1 Clean-Profile Requalification — Result

Date: `2026-09-23`

Status: **WINDOWS RC1 CLEAN-PROFILE RELEASE QUALIFICATION = FAIL / BLOCKED**

Issue: [#253](https://github.com/ArdenZC/Zen-Canvas/issues/253)
PR: [#254](https://github.com/ArdenZC/Zen-Canvas/pull/254) — documentation-only result/current-truth update; awaiting Owner review.

## Authority and candidate identity

- Activation branch: `codex/w6-10b-r2-windows-clean-profile`.
- Activation commit/tree: `fba04a3220d2b2855592ff8b8d9efe3860a669c5` / `5fa80e1b005b90267816ff4b75a2d84b0da06abb`.
- At final pre-edit verification, the remote activation ref matched that commit; `origin/master` was `65c8a969de2e5f2cda1215fafd161fdd43475bb3` / tree `20ebbfcae1137cf01e70ee460d62363ebea47535`. PR #254 was **OPEN / non-draft** at that exact head and base.
- Immutable RC1 source/tree: `9c8cdee792f8a2b5078c22c517d8648899440b0c` / `3ec2158bb56ce0a734b2c894793f5fe60b8b3296`.
- Version: `0.1.40`. Installer: `Zen Canvas_0.1.40_x64-setup.exe`, `9380984` bytes, SHA-256 `c7fed4c0bbd9d065d7b9772a34d67455ad4423c16e7a85e700e0bea52a0eed98`; Authenticode status: `NotSigned`.
- Installed executable: version `0.1.40`, `32304640` bytes, SHA-256 `68EE6FDCC682462CD9B0902A83CAA675806C9F02839ACA974C36C0FC7D2488F6`.
- The frozen RC1 helper ref still matched the immutable source. Read-only GitHub checks found no `v0.1.40` tag ref and returned `404 Not Found` for both the release-by-tag and tag-ref APIs. No tag or release was created.

## Host

- Windows 11 Professional `10.0.26200`, build `26200`, x64; MECHREVO Yilong15Pro Series GM5HG0A.
- Primary display baseline: logical `1280 x 800`, physical `2560 x 1600 @ 240 Hz`, effective scale `200%`.
- Light theme enabled. Forced Colors / High Contrast was OFF at the recorded baseline. Narrator was not running.
- No display, theme, accessibility, SmartScreen, UAC, or other security setting was changed during R2.

## Gate results

| Gate | Result | Evidence / disposition |
| --- | --- | --- |
| RC1 self-state gates 1–9 | **PASS** | Exact installer installed; clean-profile first launch reached a usable Shell after the safe “稍后设置” onboarding path; RC1 created its own app data; normal close and relaunch reached a usable Shell; uninstall retained data; the exact same installer reinstalled; launch and subsequent normal relaunch using retained RC1-generated state reached a usable Shell. No blank-window failure was observed. Onboarding reappeared on relaunch and was safely dismissed each time; no location was selected and no scan was started. |
| B01 — Internet Zone provenance | **PASS — category C only** | A separate equivalent copy had `Zone.Identifier` `ZoneId=3` and matched the installer byte-for-byte, size, and SHA-256. This was not browser-acquired provenance, and the tagged copy was not used for the install flows. |
| B02 — SmartScreen / reputation | **UNVERIFIED / BLOCKING** | Read-only registry inspection at `2026-09-23 12:26:31 +08:00` found `SmartScreenEnabled=off` and policy `EnableSmartScreen=0`. The normal install flows used an installer without MOTW. No targetable SmartScreen prompt was captured. No setting was changed to force a prompt. |
| B03 — Unknown Publisher / UAC | **UNVERIFIED / BLOCKING** | At the same read-only inspection, `EnableLUA=0`, `ConsentPromptBehaviorAdmin=0`, and `PromptOnSecureDesktop=0`. The installer is unsigned, but no targetable Unknown Publisher/UAC prompt was captured. No UAC setting was changed. |
| B04–B08 — install, installed launch, restart/relaunch, uninstall, reinstall sanity | **PASS** | Exact RC1 NSIS installation completed; installed launch/relaunch was usable; uninstall completed with “Delete the application data” unchecked and retained the RC1-generated state; the identical installer reinstalled successfully. |

B02 and B03 are release-blocking rows in the frozen W6-10 matrix. Their `UNVERIFIED` state prevents a Windows release GO. Qualification therefore stopped at this security-presentation boundary. The remaining core product, release-binary Quick Preview, Explorer Preview Handler, DPI matrix, Forced Colors, keyboard/focus, Narrator, and bounded safety/recovery matrix was **not executed** and is not claimed PASS. The retained pre-release/dev profile incompatibility cannot be accepted as a non-blocking residual from this result, and no underlying historical-state root cause is claimed fixed.

## Restoration and evidence custody

- Original Roaming profile restored to `C:\Users\77588\AppData\Roaming\com.startlan.zencanvas`: 3 files, 2 directories, `12084259480` bytes.
- Original Local profile restored to `C:\Users\77588\AppData\Local\com.startlan.zencanvas`: 2630 files, 88 directories, `207534612` bytes.
- The RC1-generated profile was preserved, not deleted, under:
  - `C:\Users\77588\AppData\Roaming\com.startlan.zencanvas.w6-10b-r2-rc1-generated-quarantine-20260923-124745` — 3 files, 2 directories, `2667229272` bytes.
  - `C:\Users\77588\AppData\Local\com.startlan.zencanvas.w6-10b-r2-rc1-generated-quarantine-20260923-124745` — 285 files, 80 directories, `33498844` bytes.
- `ZenCanvasGlobalIndex` was restored to `Running / Automatic` (PID `18848`). The RC1 main UI is closed; no other `zen-canvas.exe` process remained.
- Detailed text evidence is retained under `F:\CargoTarget\w6-10b-r2-windows-rc1-clean-profile\`, including environment, original-profile inventory/quarantine, clean launch, relaunch, security provenance, uninstall/reinstall, and restoration notes. Native screenshots were not archived as files; the UI state was observed during this task. B02/B03 remain unverified regardless.

## Owner disposition required

- Keep RC1 immutable and retained. **Do not create RC2** without a separate Owner decision and authorization.
- W6-10B remains **FAIL / BLOCKED** pending Owner review/disposition of the unverified blocking security rows.
- W6-10C remains **ELIGIBLE / NOT ACTIVE**. Publication remains **DEFERRED**. Do not create `v0.1.40`, a GitHub Release, or publish.
- This result changes documentation only; no RC1 source, product code, workflow, or package version was changed.
