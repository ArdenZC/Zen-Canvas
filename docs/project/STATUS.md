# Zen Canvas Project Status

Last verified: 2026-09-04

## Current baseline

- Default branch: `master`.
- Current execution state: **W5 — Release / Hardening (ACTIVE)**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 activation entry baseline: `master@377ec3b5d91597ddab82fdff821b5ac6bb3b570a`; tree `70bec2d7640a63b6420493c8d80a1eae34573bd7`.
- TD-014 accepted maintenance baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`.
- W4 final closeout baseline: `master@f45aae1c270d827d881abf620d8f09074c8d7d7e`; tree `d2596364c544e2bcc6648fbe0ff0465f1cc512a8`.
- Latest merged W4 production-code baseline: `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; tree `f357be042c493d0cefd98be8e02d768210ac1f6b`.
- Package version: `0.1.40`.
- Database schema: `35`.
- Published GitHub release: none.
- Published Git tag: none.

## Current initiative

**W5 — Release / Hardening**

[Active initiative record](initiatives/W5-release-hardening.md)

Status: **ACTIVE — implementation; W5-01 Release Baseline & Gap Audit next**

W5 is the final stabilization/release-hardening Wave defined by the Master Development Plan. Activation does not claim that Zen is released, signed, notarized or publication-ready. The first authorized execution Track is W5-01, which must establish the exact supported-platform release matrix, evidence gaps and prioritized downstream work before any broad hardening or publication change begins.

The post-TD-014 debt reprioritization found no remaining technical-debt item that must preempt W5 activation. Debt retirement inside W5 is allowed only when replacement/equivalence is already provable and the change directly reduces release risk; W5 is not a general refactor wave.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.

## Accepted pre-W5 boundary

- W4 is complete and closed. Windows Explorer Preview Handler packaging, registration, repair and uninstall behavior are accepted within the reviewed product matrix; the macOS engineering DMG lifecycle evidence is accepted for the tested same-version operations.
- TD-014 is complete and closed. Schema 35 cleanup identity uses explicit source-volume provenance and keeps ambiguous historical evidence fail closed without changing Safe Trash/Restore authority.
- Production signing and notarization are not yet claimed. Native manual display/accessibility evidence and unavailable real provider/filesystem fixtures remain **UNVERIFIED** where the existing records classify them that way.
- Cross-version macOS upgrade evidence remains **DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE** until W5 obtains a real older release fixture or truthfully records the external blocker.
- No current document may treat a successful package build as a published release. `Implemented`, `Validated`, `Packaged` and `Released` remain distinct states.

## Wave status

### W4 — Native Integration

**COMPLETE / CLOSED.** The final disposition and detailed evidence are recorded in the [W4 final closeout](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md) and summarized by the [W4 initiative record](initiatives/W4-native-integration.md).

### W5 — Release / Hardening

**ACTIVE — implementation.** W5 owns final release hardening, long-session/performance/resource steady-state, accessibility/keyboard/visual quality, security/materialization/provider hardening, supported-platform packaging/signing/update/publication readiness and the final release matrix. W5-01 is the first execution Track and must perform a release baseline/gap audit before implementation work is prioritized.

## Durable authority pointers

- W5 scope and sequencing are owned by the [W5 initiative](initiatives/W5-release-hardening.md) and [W5-00 activation task](tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).
- The first authorized W5 execution Track is [W5-01 Release Baseline & Gap Audit](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-CODEX.md).
- TD-014 closed the cleanup-ledger physical-identity compatibility debt without changing Safe Trash/Restore authority; its final scope and evidence are recorded by the [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md) and [filesystem identity contract](../security/FILE_IDENTITY_SEMANTICS.md).
- ADR-0005 owns the overall native Host/Adapter boundary, macOS Native Preview Access, opaque `HostProvided` ownership, shell isolation and packaging boundaries: [ADR-0005](DECISIONS/0005-native-preview-host-boundary.md).
- ADR-0006 owns the accepted Windows bounded-capture source-lifetime amendment: [ADR-0006](DECISIONS/0006-windows-preview-handler-bounded-capture.md).
- Earlier waves and their execution evidence remain under their initiative, task, result and PR records. Current-truth documents point to those records; they do not duplicate their execution ledgers.
