# W6-10B-R1 — Windows Release Startup Remediation / RC2 — Activation

Status: **ACTIVE — implementation**

Issue: #251

## Trigger

W6-10B RC1 Windows release qualification is complete with:

> **WINDOWS RC1 RELEASE QUALIFICATION = FAIL / BLOCKED**

RC1 installation and uninstall succeed, but both first installed launch and
reinstall sanity fail before a usable Shell appears.

Observed release-only symptom:

- the installed `Zen Canvas` native window appears briefly;
- content is blank white;
- the main window disappears after roughly a few seconds;
- `zen-canvas.exe` may remain resident with `MainWindowHandle = 0`;
- the app owns a tray lifecycle, so resident process != usable main window.

W6-10B result authority:

- `docs/project/tasks/W6-10B-WINDOWS-RELEASE-QUALIFICATION-RESULT.md`
- PR #249 — merged
- Issue #248 — closed/completed

## Current merged baseline

- `master@71b66954e60b480c121ea8b3f89099450337403e`
- tree `fe25314d1ec4b1a26031ae51c0f753a6051eabdd`
- merge-after CI `35741888199` — SUCCESS

## RC1 historical failed candidate

RC1 remains immutable:

- source: `9c8cdee792f8a2b5078c22c517d8648899440b0c`
- tree: `3ec2158bb56ce0a734b2c894793f5fe60b8b3296`
- version: `0.1.40`
- Windows installer SHA-256:
  `c7fed4c0bbd9d065d7b9772a34d67455ad4423c16e7a85e700e0bea52a0eed98`

RC1 is **REJECTED FOR FURTHER RELEASE QUALIFICATION**.

Do not move or patch `rc/w6-10-0.1.40-rc1`.

## Owner sequencing decision

Do **not** start W6-10C macOS qualification against RC1.

Reason:

- a source/config/package correction is expected;
- such a correction invalidates RC1;
- macOS acceptance on RC1 would likely need partial or full replay on RC2.

The next task is a bounded Windows release-startup diagnosis/remediation, then a
new RC2 freeze.

## Phase 1 — diagnose unchanged RC1 first

No source change is allowed until release-startup evidence narrows the failure
layer.

Required diagnostic order:

1. Reinstall the exact RC1 Windows installer and verify its SHA-256 again.
2. Record the currently retained Zen Canvas app-data locations and make a
   byte-preserving backup before any isolation.
3. Test a **clean-profile launch** by temporarily moving/renaming the retained
   Zen Canvas app-data directory out of the active path. Do not delete it.
4. If clean-profile launch succeeds:
   - classify the problem as persisted-state / migration / startup recovery;
   - compare old vs newly-created state read-only;
   - restore the original state after evidence capture;
   - do not claim the release candidate fixed.
5. If clean-profile launch still fails:
   - collect Windows Application / Windows Error Reporting evidence;
   - record WebView2 Runtime version/process state;
   - inspect whether installed frontend/resources are present;
   - use supported local WebView2 diagnostic overrides where useful;
   - inspect main-window/tray lifecycle evidence;
   - determine whether the WebView process fails, the main window is closed,
     or startup code exits/hides it.

Microsoft-supported local diagnostic seams may include:

- `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`
- `WEBVIEW2_USER_DATA_FOLDER`

Use diagnostic environment overrides only for evidence. Do not ship them.

Do not weaken SmartScreen/UAC/security policy.

## Phase 2 — bounded remediation

Only after Phase 1 establishes a concrete failure layer:

- implement the smallest source/config/package correction;
- add regression coverage that would have caught this release-only startup
  failure;
- preserve existing product architecture and Solid / Calm presentation;
- do not redesign startup or unrelated UI;
- do not broaden feature scope.

Version remains `0.1.40` unless Owner explicitly changes it because no public
`v0.1.40` release exists.

## Phase 3 — RC2 freeze

After the minimal remediation is reviewed and hosted CI is green:

- create a new exact RC2 source/tree;
- create a new immutable helper ref
  `rc/w6-10-0.1.40-rc2`;
- run fresh exact-SHA Full Validation;
- run fresh exact-SHA Release Build;
- record new Windows installer and macOS DMG identities/checksums/SBOMs;
- confirm tag/release remain absent;
- perform an installed Windows **first-launch smoke** on the new RC2 installer.

RC2 may be accepted for resumed W6-10B qualification only if the installed
first-launch smoke reaches a usable Shell.

Do not resume the entire DPI/Forced Colors/Narrator matrix during the
remediation task.

## Evidence directory

Use external storage, for example:

`F:\CargoTarget\w6-10b-r1-startup-remediation\`

Do not commit crash dumps, installers, user databases or screenshots containing
private filenames.

## Safety

Before isolating app data:

- record exact active path;
- record directory/file count and relevant hashes where practical;
- create a backup/copy or safe rename;
- never delete the only copy.

After the diagnostic launch:

- restore the user's original app-data state unless the Owner explicitly
  authorizes keeping the clean state;
- record the restoration result.

Use disposable fixtures only.

## Stop conditions

Stop for Owner / ChatGPT if:

- diagnosis remains ambiguous and proposed changes would be speculative;
- remediation requires broad architecture/product redesign;
- data migration may risk user data;
- the release failure is caused by an external runtime prerequisite that
  requires a new distribution policy;
- fixing Windows would materially change macOS release behavior beyond ordinary
  shared-code regression.

## Exit

Allowed successful outcome:

> **RC2 STARTUP REMEDIATION READY FOR OWNER REVIEW**

It must include:

- demonstrated RC1 root cause;
- exact minimal fix;
- regression coverage;
- new candidate SHA/tree;
- fresh hosted CI;
- fresh Full Validation and Release Build;
- RC2 Windows installer and macOS DMG hashes;
- exact-two-SBOM result;
- Windows installed first-launch smoke PASS;
- tag/release still absent;
- W6-10C still not activated.

Do not publish.
