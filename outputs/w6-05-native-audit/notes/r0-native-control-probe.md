# W6-05 R0 Native Control Probe

Date: 2026-09-05

## Verdict

`R0 native-control = PASS`.

The generic Windows `computer` surface displayed the real Windows desktop and a real Zen Canvas Tauri window launched from:

`F:\CargoTarget\w6-05-production\debug\zen-canvas.exe`

The window was brought to the foreground and controlled with real native input. The probe observed state changes after both pointer and keyboard actions and captured native screenshots.

## Observed controls

- Desktop visibility: PASS — the returned surface was a Windows desktop/Tauri window, not a browser or in-app browser page.
- Zen Canvas foreground control: PASS — the exact production executable window was targetable and brought forward.
- Pointer input: PASS — clicking the onboarding Continue control advanced the real UI to the next step.
- Keyboard input: PASS — Tab moved focus to a visible onboarding control.
- Screenshot capture: PASS — native screenshots were saved in the evidence set.

Evidence:

- `screenshots/R0-before-onboarding.png`
- `screenshots/R0-pointer-onboarding-step2.png`
- `screenshots/R0-keyboard-focus.png`

The optional helper binding was separately recorded as `getApp/native-app binding: unavailable`. Per `W6-05-WINDOWS-COMPUTER-SURFACE-CONTROL-AMENDMENT.md`, that helper limitation is not an R0 stop condition.
