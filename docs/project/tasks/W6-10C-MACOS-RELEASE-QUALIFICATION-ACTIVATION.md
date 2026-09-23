# W6-10C — macOS Release Qualification — Activation

Status: **ACTIVE — implementation**

Issue: #255

## Activation baseline

- `master@7df0841bfb8dab1cd62d96650659f103355f0211`
- tree `a4531ef6a519f670bcfbc365b1cb8ae060b8f48e`
- merge-after CI `35837244510` — SUCCESS
- W6-10B Windows lane: **BLOCKED — SECURITY PRESENTATION EVIDENCE HOST REQUIRED**
- W6-10C: **ACTIVE**
- publication: **DEFERRED**

## Qualification authority

The authoritative release contract is:

- [W6-10 Release Re-entry Qualification Matrix](W6-10-RELEASE-REENTRY-QUALIFICATION-MATRIX.md)
- [W6-10A RC1 Freeze Result](W6-10A-RELEASE-CANDIDATE-FREEZE-RESULT.md)
- [W4-02 macOS Native Quick Look Current Truth](W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md)

This activation may add stricter sequencing but must not weaken those authorities.

Every applicable macOS row must end in:

- PASS
- FAIL
- UNVERIFIED
- or an explicitly Owner-authorized non-blocking residual where the frozen matrix permits one.

Any release-blocking macOS row left FAIL or UNVERIFIED prevents a macOS GO.

## Frozen RC1

RC1 remains immutable:

- source: `9c8cdee792f8a2b5078c22c517d8648899440b0c`
- tree: `3ec2158bb56ce0a734b2c894793f5fe60b8b3296`
- version: `0.1.40`
- Full Validation: `35702434460` — SUCCESS
- Release Build: `35704683429` — SUCCESS
- artifact ID: `10684705483`
- artifact digest: `sha256:3e3d94212fe1a3f8e559f6b4f694f6df9ac097f560d4fb041fbfeff3d6c38e24`
- DMG: `Zen Canvas_0.1.40_aarch64.dmg`
- DMG size: `13292198` bytes
- DMG SHA-256: `0216b4c16e85f1b77aa6ff1b1c6090ea591f729fba4bff46e09faa6e73085c4f`

Do not rebuild or replace the DMG.

Do not move the RC1 helper ref.

## Required host

A real supported Apple Silicon macOS 13+ GUI host is mandatory.

Hosted macOS compile/test evidence does not substitute for this lane.

The host must be able to provide:

- real Finder / DMG interaction;
- real Gatekeeper first-launch behavior;
- real WKWebView app rendering;
- real macOS native Quick Look lifecycle;
- real Retina display evidence;
- real trackpad/keyboard behavior;
- real VoiceOver / motion / contrast settings where available.

If the Mac host is not available:

STOP.

Do not infer macOS PASS from CI.

## Clean-host execution rule

This macOS qualification host is intentionally a **clean user machine**, not a
development workstation.

At task start it is expected to have:

- no Zen Canvas repository clone;
- no project worktree;
- no Node/npm environment installed for this task;
- no Rust/Cargo toolchain installed for this task;
- no Homebrew/dev-tool bootstrap performed for this task;
- no local Zen Canvas build output.

Therefore:

- do **not** clone the Zen Canvas repository onto the Mac;
- do **not** install Git/Node/npm/Rust/Cargo/Homebrew merely to run acceptance;
- do **not** build Zen Canvas locally;
- do **not** run repository tests on the Mac;
- use only the frozen RC1 DMG plus built-in macOS tools and native GUI control;
- collect evidence outside any repository;
- export/copy the final evidence package off the Mac before cleanup;
- repository result/current-truth docs and PR #256 follow-up commits must be
  produced later from an existing development machine or GitHub-capable
  environment, using the Mac evidence package as source authority.

The clean-host state is a feature of the qualification: it approximates a
first-time user's Mac rather than a developer machine.

## Mandatory post-qualification cleanup

After evidence has been safely exported off the Mac, restore the Mac to its
pre-test user state and remove **all Zen Canvas/test artifacts created by this
task**.

Required cleanup includes, where created:

- `/Applications/Zen Canvas.app`;
- mounted Zen Canvas DMG volume;
- downloaded RC1 DMG and duplicate/equivalent-quarantine copies;
- temporary test fixtures and disposable folders;
- Zen Canvas user app-data created by RC1 during qualification;
- Zen Canvas caches/preferences/logs created by RC1 where they are clearly
  app-owned and task-created;
- temporary quarantine/backup directories created solely for this task;
- native Quick Look staged artifacts owned by Zen Canvas when identifiable;
- temporary screenshots/log extracts/manifests remaining on the Mac after the
  evidence package has been transferred;
- the local evidence root itself after successful transfer and verification.

Do **not** install cleanup utilities. Do **not** delete or rewrite unrelated
browser history, Finder recents, macOS unified logs, security/audit records, or
other OS-managed history merely to hide that testing occurred. Do not delete
any pre-existing user data.

Before deleting the local evidence root, verify the exported copy by size/hash
(or archive SHA-256 when zipped). Record cleanup/restoration results in the
exported evidence package.

Final host disposition must state one of:

- **CLEAN HOST RESTORED — PASS**
- **CLEAN HOST RESTORATION INCOMPLETE — BLOCKING**

An incomplete restoration prevents final macOS PASS until resolved.

## Pre-release profile rule

Before the release path counts:

1. inventory any existing Zen Canvas pre-release/dev application data on the Mac;
2. preserve it without deletion;
3. quarantine/rename it safely if present;
4. qualify RC1 from a true clean normal macOS profile;
5. do not use diagnostic user-data overrides for the PASS path.

After qualification, restore the original pre-release/dev state unless Owner explicitly authorizes otherwise.

## C1 — DMG / first-launch path

Required blocking rows:

### C01 — quarantine provenance

Prefer a real browser-acquired DMG.

Record:

- `com.apple.quarantine` xattr when available;
- exact DMG filename, size and SHA-256;
- acquisition method.

If GitHub artifact download/copy does not preserve quarantine provenance, an equivalent quarantine-marked byte-identical copy may be used only if clearly labeled as equivalent provenance.

Do not call an equivalent xattr copy "browser acquired".

### C02 — Finder DMG mount

Open the exact DMG through Finder and record the real mounted volume.

### C03 — copy to Applications

Use the real Finder copy/install flow to `/Applications`.

Do not qualify an app launched directly from the mounted DMG as installed-release acceptance.

### C04 — Gatekeeper first launch

Record actual unsigned/unnotarized behavior.

Current release policy does not provide Apple Developer ID/notarization.

Warning presence is therefore not itself a failure.

Do not:

- run `spctl --master-disable`;
- disable Gatekeeper globally;
- remove quarantine with `xattr -d` merely to obtain a PASS;
- weaken macOS security policy.

### C05 — OS-approved open/override

If Gatekeeper blocks initial launch, use the normal documented macOS user-approved route available on the host.

If automation cannot target the system security sheet, Owner-observed manual evidence is permitted:

- exact wording;
- timestamp;
- action;
- final result.

### C06 — installed first launch

The installed `/Applications/Zen Canvas.app` must reach a stable usable Shell.

### C07 — relaunch

Normal close and relaunch must remain usable with RC1-generated state.

### C08 — removal / detach

At the end, app removal and DMG detach must complete cleanly.

## C2 — whole-product GUI smoke

Using only the installed release app, inspect:

- Overview;
- Files;
- Library;
- Browse;
- Settings;
- Organize;
- Cleanup / Operation Preview with disposable fixtures;
- History / Restore;
- Automation;
- Global Search;
- Dark;
- Compact;
- restored window;
- resize;
- fullscreen;
- traffic-light controls.

Look specifically for WKWebView/macOS differences in:

- font metrics;
- line-height;
- borders;
- shadows;
- popovers;
- focus;
- scrolling;
- titlebar geometry.

## C3 — Zen Quick Preview

Hard release scope:

- Floating Preview;
- Pinned Preview;
- Markdown document mode;
- image Preview;
- PDF >1 MiB;
- PDF continuous pages 1/2/3;
- later-page rendering;
- fast scrolling;
- trackpad two-finger scrolling;
- momentum/inertial PDF scrolling;
- resize while Preview is open;
- close while rendering;
- source switch while loading;
- pinned source freeze;
- Loading;
- Failed/unsupported;
- Details closed/open;
- Dark;
- Compact.

The W6-09 Windows evidence is historical context only and does not prove macOS.

## C4 — native Quick Look representation

The W4-02 architecture remains authoritative.

Minimum blocking scope:

- native Quick Look PDF representation opens from Zen Preview;
- source is the bounded Zen-owned staged snapshot, not the original managed/provider URL;
- open/close lifecycle;
- source switch;
- cancellation;
- rapid A -> B switching;
- close/dispose cleanup;
- native failure produces truthful fallback/unavailable behavior;
- no stuck native Quick Look view after Preview close;
- no stale representation publishes over a newer source.

Office/iWork/media are not unconditional strong-native release blockers unless real runtime capability and fixtures exist.

Do not expand provider claims by file extension alone.

## C5 — display / input / accessibility

### Retina — blocking

On a real Retina display inspect:

- text;
- icons;
- 1px borders/dividers;
- Preview PDF/image;
- titlebar/traffic lights;
- popovers;
- resize/fullscreen.

### Keyboard/input

Required:

- Space Preview;
- Escape;
- Tab / Shift+Tab;
- relevant Command shortcuts;
- focus restoration after Preview/native Quick Look closes;
- trackpad two-finger scrolling;
- inertial scrolling.

### VoiceOver

Required bounded smoke:

- sidebar/navigation;
- Files selection;
- Settings controls;
- Preview controls;
- modal/dialog exit.

A P0/P1 core-flow accessibility failure blocks release.

### Reduce Motion / Increase Contrast / Reduce Transparency

Execute a bounded native smoke where the setting exists.

Do not require pixel identity with Windows.

Require semantic clarity, readable focus/selection and no unusable motion/material behavior.

Restore all original macOS accessibility/display settings afterward.

## Clean-profile / existing-state handling

If an existing pre-release/dev Zen Canvas profile is present on the Mac:

- inventory it first;
- quarantine it safely;
- qualify the release app from clean state;
- preserve the original;
- restore it after evidence capture.

Do not delete the only copy.

If RC1-generated state is used for relaunch/reinstall checks, preserve that evidence separately.

## Evidence root

Use an external Mac evidence root, for example:

`~/Desktop/w6-10c-macos-rc1-9c8cdee/`

or another non-repository folder.

Suggested structure:

- `00-environment/`
- `01-dmg-gatekeeper/`
- `02-first-launch/`
- `03-core-product/`
- `04-quick-preview/`
- `05-native-quick-look/`
- `06-retina-windowing/`
- `07-input-trackpad/`
- `08-voiceover/`
- `09-motion-contrast/`
- `10-removal-restoration/`
- `manifest.json`

Do not commit screenshots, DMGs, private app data or dumps.

The manifest must bind:

- RC1 source/tree/version;
- artifact ID/digest;
- DMG filename/size/SHA-256;
- Mac model;
- Apple Silicon architecture;
- macOS version/build;
- display/Retina state;
- original accessibility settings;
- exact PASS/FAIL/UNVERIFIED per matrix row;
- evidence filenames/paths.

## Product defect rule

If qualification finds a product/config/package defect that requires any source change:

STOP.

Do not fix it in W6-10C.

Return:

`RC1 REQUIRES OWNER RC2 DISPOSITION`

Include exact reproduction, severity, affected matrix row and evidence.

Do not create RC2 automatically.

## Final decision

Allowed final outcomes:

### PASS

`MACOS RC1 RELEASE QUALIFICATION = PASS`

Only when every hard release-blocking macOS row passes and required accessibility/motion smoke has no unresolved P0/P1 core-flow issue.

### FAIL / BLOCKED

Use when any hard blocker is FAIL or UNVERIFIED.

Do not convert missing real-GUI evidence into a residual.

## Result document

Create:

`docs/project/tasks/W6-10C-MACOS-RELEASE-QUALIFICATION-RESULT.md`

Include:

- activation baseline;
- RC1 identity;
- Mac hardware / Apple Silicon;
- macOS version/build;
- DMG identity;
- quarantine/Gatekeeper path;
- first launch/relaunch;
- whole-product GUI;
- Quick Preview;
- native Quick Look;
- Retina/windowing;
- input/trackpad;
- VoiceOver;
- motion/contrast/transparency;
- app removal/DMG detach;
- original-state restoration;
- evidence root / ZIP if created;
- final macOS disposition.

## Current-truth update

If PASS:

- W6-10C = COMPLETE / CLOSED — macOS RC1 RELEASE QUALIFICATION PASS
- W6-10B remains BLOCKED — SECURITY PRESENTATION EVIDENCE HOST REQUIRED
- W6-10D/E/F remain dependency-gated
- publication remains DEFERRED

If FAIL/BLOCKED:

- W6-10C = BLOCKED
- preserve exact blocker
- W6-10B state unchanged
- publication remains DEFERRED

Do not activate later lanes automatically.

## Repository boundary

Expected repository changes after qualification are documentation-only.

Run:

- `npm run test:governance`
- `DOCS_DIFF_BASE=origin/master DOCS_DIFF_HEAD=HEAD npm run test:docs`
- `git diff --check`

No product changes are authorized in this task.

## Exit

Return:

`W6-10C MACOS RC1 RELEASE QUALIFICATION READY FOR OWNER REVIEW`

Then STOP.

Do not merge the qualification PR.

Do not create RC2.

Do not create a tag or GitHub Release.

Do not publish.
