# W5-04 — Supported-Platform Manual Release Acceptance — Result

Status: **CLOSED BY EXPLICIT PRODUCT DEFERRAL — MANUAL NATIVE GUI ACCEPTANCE UNVERIFIED**

Date: 2026-09-05

## Decision

W5-04 manual/native GUI acceptance is intentionally skipped for the current release-hardening pass because the available Computer Use environment does not expose native application windows (`apps: []`) and only exposes browser interaction. The current environment therefore cannot truthfully exercise the required Windows/macOS native GUI paths.

This is an explicit product decision to defer the evidence. It is **not** a PASS and does not convert any unobserved SmartScreen, Unknown Publisher, Gatekeeper, Narrator, VoiceOver, Explorer Preview Handler focus, Finder/DMG UI, or native Zen Canvas interaction into validated release evidence.

## Frozen release candidate and automated evidence

The final W5-04 candidate used for release-preparation evidence is:

- source: `master@5f6dcc643bec099e3b011af97c046ebc53d2772a`
- tree: `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`
- package version: `0.1.40`
- published Git tag: none
- published GitHub Release: none

Hosted exact-SHA evidence:

- `CI Full Validation` run `33890392142`: **SUCCESS**
- `Build Release Installers` run `33893501841`: **SUCCESS**
- Windows artifact `Zen-Canvas-Windows`, artifact id `9945343182`, workflow-artifact digest `sha256:6aed84148ed18d82c5cfc7bfbc2ddc4e32f5c92c4db940243c2e1962bfbd8125`
- macOS artifact `Zen-Canvas-macOS`, artifact id `9945180370`, workflow-artifact digest `sha256:895bb85aa0ea44887ea817e2573c7703de71283b36e4835e0fe9f75964d1c580`

These facts prove the exact candidate passed the automated release-qualified validation and produced the intended supported-platform installer artifacts. They do **not** prove real-user native GUI acceptance.

## W5-04 evidence disposition

### Tier A — required manual first-release path

Windows x64 NSIS:

- browser download / Internet Zone behavior: **UNVERIFIED — native/manual acceptance environment unavailable**
- SmartScreen: **UNVERIFIED — native/manual acceptance environment unavailable**
- Unknown Publisher / UAC user-visible path: **UNVERIFIED — native/manual acceptance environment unavailable**
- real installer UI: **UNVERIFIED — native/manual acceptance environment unavailable**
- installed-app first launch/basic interaction: **UNVERIFIED — native/manual acceptance environment unavailable**
- real uninstall/cleanup lifecycle: **UNVERIFIED — native/manual acceptance environment unavailable**

macOS 13+ Apple Silicon DMG:

- browser acquisition/quarantine propagation: **UNVERIFIED — native/manual acceptance environment unavailable**
- Finder DMG mount/copy path: **UNVERIFIED — native/manual acceptance environment unavailable**
- first GUI launch / Gatekeeper result: **UNVERIFIED — native/manual acceptance environment unavailable**
- normal user-visible override/open path: **UNVERIFIED — native/manual acceptance environment unavailable**
- installed-app launch/basic interaction: **UNVERIFIED — native/manual acceptance environment unavailable**
- app removal / DMG detach: **UNVERIFIED — native/manual acceptance environment unavailable**

### Tier B — selected native/manual smoke

- Windows keyboard/focus: **UNVERIFIED — native application surface unavailable**
- Windows Narrator: **UNVERIFIED — native application surface unavailable**
- Windows Explorer Preview Handler focus/keyboard: **UNVERIFIED — native application surface unavailable**
- Windows real display/DPI smoke: **UNVERIFIED — native application surface unavailable**
- macOS keyboard/focus: **UNVERIFIED — native application surface unavailable**
- macOS VoiceOver: **UNVERIFIED — native application surface unavailable**
- macOS Retina/display smoke: **UNVERIFIED — native application surface unavailable**

### Tier C — genuine-fixture-only evidence

Remains unchanged:

- iCloud / generic File Provider: **UNVERIFIED — fixture unavailable**
- external APFS: **UNVERIFIED — fixture unavailable**
- external exFAT: **UNVERIFIED — fixture unavailable**
- SMB/network volume: **UNVERIFIED — fixture unavailable**
- genuine multi-display when unavailable: **UNVERIFIED — fixture unavailable**
- real older-release → newer-release cross-version upgrade: **DEFERRED — no real older public release fixture**

## Residual release risk

The following release-facing uncertainty is explicitly accepted/deferred rather than resolved:

- actual SmartScreen/reputation experience of the unsigned Windows installer;
- actual Unknown Publisher/UAC presentation on a supported Windows host;
- actual Gatekeeper/quarantine behavior of the unsigned/not-notarized macOS app;
- actual user-visible native install/copy/first-launch flow on both supported platforms;
- bounded Narrator/VoiceOver/focus/display smoke.

Any later publication decision must preserve this truth. It must not say or imply that these paths passed manual acceptance.

## W5-05 disposition

W5-05 — Long-session / Performance Release Evidence — is **NOT REQUIRED / SKIPPED FOR THE CURRENT DECISION PASS**.

Reason:

- the exact candidate already has successful full release-qualified automated validation;
- no new W5-04 measurement or demonstrated performance/long-session defect exists because manual native acceptance was not executed;
- there is therefore no evidence-derived trigger for additional W5-05 work at this time.

This does not convert the historical W1 Scheduler pressure `TARGET MISSED` observation into PASS and does not prevent future targeted performance work if new evidence appears.

## Downstream authorization

W5-06 — Release Candidate / Publication Decision — may now be activated as an explicit decision Track.

W5-06 must decide with the residual manual-acceptance uncertainty visible. It may not silently promote W5-04 to PASS and must not publish automatically.

No tag or GitHub Release is created by this closeout.
