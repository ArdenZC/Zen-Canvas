# W6-10B-R1 — Windows Release Startup Remediation Result

## Final disposition

**RC1 CLEAN-PROFILE STARTUP PASS — OWNER RECONSIDERATION REQUIRED**

This result records the diagnosis-only Case A outcome. It does not accept an RC2, resume the W6-10B qualification matrix, or activate W6-10C.

## Authority and candidate identity

- R1 activation branch: `codex/w6-10b-r1-windows-startup-remediation`
- Activation source HEAD before this docs-only result: `14150918909150fc1994a17ee4a3eb680abf7d1f`
- Activation source tree before this docs-only result: `ea17ff81e502ae07d9a1e7b160e0887a11453651`
- Issue: `#251`
- PR: `#252`, open and non-draft at task start
- RC1 source: `9c8cdee792f8a2b5078c22c517d8648899440b0c`
- RC1 tree: `3ec2158bb56ce0a734b2c894793f5fe60b8b3296`
- RC1 version: `0.1.40`
- RC1 installer: `Zen Canvas_0.1.40_x64-setup.exe`, 9380984 bytes
- RC1 installer SHA-256: `c7fed4c0bbd9d065d7b9772a34d67455ad4423c16e7a85e700e0bea52a0eed98`

## RC1 failure summary

The historical retained-profile symptom was an unusable blank Zen Canvas native window, followed by disappearance after a few seconds; a resident process could remain without a usable main window.

## Clean-profile diagnostic

The exact installed RC1 binary was launched with the active identifier-owned application data quarantined. Native observation showed:

- a stable `Zen Canvas` window through the approximately 1/3/5 second checkpoints;
- first-run onboarding, which was dismissed without selecting a file or folder;
- a stable usable Overview Shell with navigation, search, settings, and overview content;
- no transient blank-window disappearance during the clean-profile observation.

## Retained-state diagnostic

The retained application data was restored to its active identifier paths and the same installed RC1 binary was launched again. Native observation showed:

- a `Zen Canvas` window appearing at approximately 1.5 seconds;
- only native title-bar/menu controls in the accessibility tree at approximately 1.5, 3.6, and 5.7 seconds;
- no Web content or Zen Canvas Shell becoming available;
- a black/blank content surface in the native screenshot;
- the target process/window absent by the subsequent evidence capture.

This reproduces the historical failure layer and establishes a strong retained-state correlation.

## Root-cause status

The specific causal DB row, persisted setting, migration state, cache entry, or other state element is **not proven**. WebView2 was present, its settings diagnostic log reported `UserPrefStore loaded: error=NONE (0)`, and no matching Application/WER event was found in the retained-profile launch interval. These observations narrow the failure to retained-state/WebView bootstrap interaction but do not authorize a speculative product fix.

## Source, tests, and RC2

- Product source files changed: none
- Product/remediation commit: none
- Regression coverage added: none
- RC2 source/tree: not created
- RC2 installer/DMG/SBOM: not built
- Full Validation: not dispatched
- Release Build: not dispatched
- Windows release matrix: not resumed
- macOS qualification: not started
- Publication/tag/release: unchanged and deferred

## CI

- R1 activation CI `35742599926`: SUCCESS before diagnosis
- W6-10B merge-after CI `35741888199`: SUCCESS before diagnosis
- A fresh PR CI for any subsequent docs-only result commit must be checked against that exact commit before owner review.

## Restoration and evidence

- The original active identifier paths were restored after the retained-profile reproduction.
- The Global Index service was restored to its pre-diagnosis Running/Auto state.
- All quarantine trees remain on disk; no app-data tree was deleted.
- Runtime startup rewrote/rotated some WebView2/runtime files; restoration is therefore recorded as path/state restoration, not a byte-for-byte cache snapshot claim.
- Detailed external evidence: `F:\CargoTarget\w6-10b-r1-startup-remediation\`

## Current truth and owner decision required

- W6-10B-R1: diagnosis complete; Case A owner reconsideration required
- W6-10B: remains blocked at the historical retained-state startup qualification boundary
- W6-10C: eligible by dependency only, not active
- RC1: clean-profile startup passes; retained-profile failure remains reproducible
- RC2: not created
- Publication: deferred

Owner review must decide whether to requalify RC1 because clean startup is valid, authorize a targeted persisted-state recovery investigation, or require another bounded diagnostic step. No such policy or product decision is made here.
