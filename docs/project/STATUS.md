# Zen Canvas Project Status

Last verified: 2026-09-09

## Current execution truth

- Latest production-changing baseline: `60d43db7de7f9ac598d0262a237a330ed91530d2`.
- Production tree at that baseline: `d70b52caa51ef1a60ebd016345a8f85e7455df81`.
- Current initiative: **W6 — Product Maturity Audit**.
- Current track: **W6-08 — Cross-Platform Quick Preview Experience**.
- W6-07 Phase 6 — Overview, History/Restore and Automation: **COMPLETE** through PR #234.
- Context reading-model cleanup: **COMPLETE through Issue #235 / PR #236**; this docs-only change does not replace the production baseline above.
- W6-07 Phase 7 — cross-surface consolidation: **COMPLETE / CLOSED through PR #238**.
- W6-07 merge baseline: `master@60d43db7de7f9ac598d0262a237a330ed91530d2`; tree `d70b52caa51ef1a60ebd016345a8f85e7455df81`.
- Current implementation task: [Issue #239 — W6-08 Cross-Platform Quick Preview Experience](https://github.com/ArdenZC/Zen-Canvas/issues/239).
- Current phase: **W6-08 — Cross-Platform Quick Preview Experience**.
- W6-08: **ACTIVE**; W6-09 is next after W6-08 and the residual-disposition gate.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — implementation; W6-08 Cross-Platform Quick Preview Experience**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Track authority: [Issue #239 — W6-08 Cross-Platform Quick Preview Experience](https://github.com/ArdenZC/Zen-Canvas/issues/239).

Current task authority: [GitHub Issue #239](https://github.com/ArdenZC/Zen-Canvas/issues/239).

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
- W6-05 typed/folder Quick Preview gaps are in scope for active W6-08; Global Index/native-source and Browse/native-recovery residuals remain truthful until their owning later gate or new evidence.
- W6-08 is **ACTIVE**. W6-09 is next after W6-08 and explicit residual disposition; W6-10 owns release re-entry after owner maturity acceptance.

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
- Status: **ACTIVE**.
- Authority: existing `ZenFloatingQuickPreview` / Preview Core / Preview Host /
  Read / Materialization / WorkScheduler seams; no second Preview authority.
- W6-09 remains **NEXT** after implementation, validation and explicit W6-05
  Preview residual disposition.

## Review policy

Owner review and merge decisions use direct diff inspection, repository governance checks and applicable CI evidence. Codex Review is not merge authority.
