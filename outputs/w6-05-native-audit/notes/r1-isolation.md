# W6-05 R1 Isolation and Safety Boundary

## Runtime

- Audited production: `ee1163fbf32f23cc95150adca4e1cb5a53081654`
- Production tree: `57dc0ac45810477c8477542512c3c65a60605fb9`
- Executable: `F:\CargoTarget\w6-05-production\debug\zen-canvas.exe`
- Fresh isolated profile: `com.startlan.zencanvas.w605qa2`
- Isolated profile locations:
  - `C:\Users\77588\AppData\Roaming\com.startlan.zencanvas.w605qa2`
  - `C:\Users\77588\AppData\Local\com.startlan.zencanvas.w605qa2`

## Fixture

All content-understanding, preview, Organize and Cleanup checks used only:

`F:\Coding\Zen-Canvas-w6-05-production\.tmp-tests\w6-05-native-audit-fixture-20260905`

The exact file list and SHA-256 values are in `manifests/fixture-before-state.json`. The fixture contains 21 indexed items: 12 files and 9 directories. Duplicate files were intentionally identical; no personal or sensitive content was used.

## Mutation boundary

The fixture was selected through the real Windows folder picker. No normal user root was scanned or opened in the audited profile. Organize created only a disposable plan. Cleanup failed before candidate review because of the path validation error, so no Safe Trash, filesystem deletion, restore, or other file mutation was reached.

One preliminary app launch used a separate throwaway profile and displayed the user's Documents root in onboarding; it was not opened, scanned, indexed, or mutated. That temporary profile was removed before closeout. The audited run used the fresh `w605qa2` profile and the fixture root only.
