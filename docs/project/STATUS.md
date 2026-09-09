# Zen Canvas Project Status

Last verified: 2026-09-09

## Current execution truth

- Latest production-changing baseline: `20781c8dc4dc8f24f0ed7d2ce860f5fd62d35ec9`.
- Production tree at that baseline: `2535499a23be61786543bab19c71e35ee7a1d36f`.
- Current initiative: **W6 — Product Maturity Audit**.
- Current track: **W6-09 — Whole-Product Native Regression**.
- W6-07 Phase 6 — Overview, History/Restore and Automation: **COMPLETE** through PR #234.
- Context reading-model cleanup: **COMPLETE through Issue #235 / PR #236**; this docs-only change does not replace the production baseline above.
- W6-07 Phase 7 — cross-surface consolidation: **COMPLETE / CLOSED through PR #238**.
- W6-07 merge baseline: `master@60d43db7de7f9ac598d0262a237a330ed91530d2`; tree `d70b52caa51ef1a60ebd016345a8f85e7455df81`.
- W6-08 — Cross-Platform Quick Preview Experience: **COMPLETE through PR #240**.
- Current implementation task: [Issue #241 — W6-09 Whole-Product Native Regression](https://github.com/ArdenZC/Zen-Canvas/issues/241).
- Current phase: **W6-09 — Whole-Product Native Regression**.
- W6-09: **ACTIVE / BLOCKED — NATIVE HOST UNAVAILABLE**; W6-10 remains inactive pending owner maturity acceptance.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — implementation; W6-09 BLOCKED — NATIVE HOST UNAVAILABLE**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Track authority: [Issue #241 — W6-09 Whole-Product Native Regression](https://github.com/ArdenZC/Zen-Canvas/issues/241).

Current task authority: [GitHub Issue #241](https://github.com/ArdenZC/Zen-Canvas/issues/241).

## Release, schema and platform truth

- Package version: `0.1.40`.
- Database schema: `35`.
- Public publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT PUBLISH**.
- No published GitHub release or tag.
- Supported product targets: Windows and macOS 13 or later on Apple Silicon.
- Intel Macs are not product targets. Universal binaries are not product targets. Rosetta is not a product target. Linux is not a product target.

## Residuals and next gates

- W6-05 native evidence remains the historical degraded baseline; it must not be upgraded to PASS by W6-07 presentation work.
- Historical Organization Plan exact-head native authoritative-preview evidence remains owner/native verification required unless new evidence closes it.
- Cleanup Windows extended-path rejection: **CLOSED / FIXED**; W6-09 performs regression coverage only unless a supported-native reproduction reopens it.
- Typed/folder Quick Preview residual: **ACCEPTED DEFER**. W6-08 repository/browser evidence closes the known presentation/support gap; exact-head Windows/macOS native Quick Preview UI remains a W6-09 verification gate. Browser PASS != Native PASS.
- Organization Plan authoritative safe-preview degradation: **ENVIRONMENT-SPECIFIC**; supported-native fixture reproduction remains required and must stay fail-closed.
- Global Index unavailable / zero-source state: **ACCEPTED DEFER**; exact-head native source/state truth remains to be re-evaluated.
- Browse first-scan / recovery friction: **ACCEPTED DEFER**; exact-head native first-launch/restart recovery remains to be re-evaluated.
- W6-09 status: **BLOCKED — NATIVE HOST UNAVAILABLE**. The post-correction session can list native apps/windows, but direct native app binding lookup returns `Native app bindings are unavailable for windows.` No targetable native window could be selected. The bounded record and configuration recovery are in [`outputs/w6-09-native-regression/README.md`](../../outputs/w6-09-native-regression/README.md). No browser screenshot or stale executable is promoted to native evidence.
- W6-09 remains **ACTIVE / BLOCKED** until the native binding is usable and a disposable native window is targetable. W6-10 owns release re-entry after owner maturity acceptance and remains inactive.

## W6-07 closeout record

- Scope: cross-surface presentation/state-grammar consolidation across the
  existing shell, Files, Settings, Organize, Cleanup, History/Restore,
  Automation, Overview and Vault projections; no durable authority, schema,
  filesystem-safety, provider, native-permission or release-state change.
- Production candidate exact head: `d20b80d493688c19117361a84f9ab2ca4e092093`;
  tree: `6613c991ed924730cbb63a895f84fad748a31ffc`.
- Validation: exact V26 freeze verification PASS; local typecheck, full frontend
  test suite, remediation, performance-architecture check and frontend build
  PASS on the candidate head.
- Browser evidence: default and 980×680 browser rendering reached Overview,
  Files, Organize, Cleanup, History, Preferences, Automation and the global
  search modal; browser console error/warning output was empty.
- Native/platform evidence: **PARTIAL** — 15 required Windows native visual
  captures were obtained from the exact docs-only successor `a758bc13`; the
  required Windows Forced Colors state remains `UNVERIFIED`, and macOS native
  evidence remains `UNVERIFIED`. W6-05 remains the accepted native baseline
  for broader product acceptance and W6-09 owns coherent whole-product native
  regression. The exact-head capture record is in
  [`outputs/w6-07-phase7-native-review/README.md`](../../outputs/w6-07-phase7-native-review/README.md).
- Owner review, hosted CI and merge: **COMPLETE / MERGED through PR #238**.

## W6-08 execution record

- Activation baseline: `master@60d43db7de7f9ac598d0262a237a330ed91530d2`;
  tree: `d70b52caa51ef1a60ebd016345a8f85e7455df81`.
- Current task: [Issue #239 — W6-08 Cross-Platform Quick Preview Experience](https://github.com/ArdenZC/Zen-Canvas/issues/239).
- Status: **COMPLETE through PR #240**.
- Authority: existing `ZenFloatingQuickPreview` / Preview Core / Preview Host /
  Read / Materialization / WorkScheduler seams; no second Preview authority.
- W6-09 is the active next track after the explicit residual disposition gate.
- W6-05 typed/folder Quick Preview disposition: **ACCEPTED DEFER**. The W6-08
  implementation and browser/integration evidence close the known
  presentation/support gap at repository level. Exact-head Windows/macOS
  native Quick Preview UI re-verification is carried into W6-09 Whole-Product
  Native Regression; a reproduced Preview defect may receive bounded native
  correction and re-verification there. Browser PASS != Native PASS.

## W6-09 execution record

- Activation baseline: `master@20781c8dc4dc8f24f0ed7d2ce860f5fd62d35ec9`;
  tree `2535499a23be61786543bab19c71e35ee7a1d36f`.
- Current task: [Issue #241 — W6-09 Whole-Product Native Regression](https://github.com/ArdenZC/Zen-Canvas/issues/241).
- Status: **ACTIVE / BLOCKED — NATIVE HOST UNAVAILABLE**.
- W6-08 completion: **COMPLETE through PR #240**.
- Native evidence: **BLOCKED — NATIVE HOST UNAVAILABLE**. The Windows
  computer-use config was narrowly corrected from `browser` to
  `browser,computer`. On the retry, native apps/windows were listed, but
  direct binding lookup returned `Native app bindings are unavailable for
  windows.` No live native Tauri window was targetable. No native correction
  was inferred or made from browser/static evidence.
- Evidence index: [`outputs/w6-09-native-regression/README.md`](../../outputs/w6-09-native-regression/README.md).
- macOS GUI, Retina/titlebar, native Preview seam, Forced Colors, Narrator and
  VoiceOver remain **UNVERIFIED** until their real hosts/tools are available.
- W6-10 Release Re-entry remains **INACTIVE**; publication remains deferred.

## Review policy

Owner review and merge decisions use direct diff inspection, repository governance checks and applicable CI evidence. Codex Review is not merge authority.
