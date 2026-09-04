# Zen Canvas Project Status

Last verified: 2026-09-04

## Current baseline

- Default branch: `master`.
- Current execution state: **BETWEEN INITIATIVES**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **ELIGIBLE / INACTIVE**. W4 or TD-014 completion does not automatically activate W5.
- TD-014 accepted maintenance baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`.
- W4 final closeout baseline: `master@f45aae1c270d827d881abf620d8f09074c8d7d7e`; tree `d2596364c544e2bcc6648fbe0ff0465f1cc512a8`.
- Latest merged W4 production-code baseline: `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; tree `f357be042c493d0cefd98be8e02d768210ac1f6b`. This remains the accepted W4 production baseline; TD-014 is a later bounded maintenance change, not a reopening of W4.
- Package version: `0.1.40`.
- Database schema: `35`.
- Published GitHub release: none.
- Published Git tag: none.

## Current initiative

**No active initiative**

Status: **BETWEEN INITIATIVES — no active initiative**

TD-014 — Cleanup Ledger Physical Identity Normalization is **COMPLETE / CLOSED** at the accepted maintenance baseline above. Its final record is the [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md). W5 remains eligible / inactive and requires separate reviewed activation.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.

## W4 current boundary

- W4 is complete and closed. Windows Explorer Preview Handler packaging, registration, repair and uninstall behavior are accepted within the reviewed product matrix; the macOS engineering DMG lifecycle evidence is accepted for the tested same-version operations.
- The accepted native boundary preserves one Preview lifecycle/provider/read authority. Zen-owned in-app previews remain managed or ephemeral sources; OS/shell-owned requests use only an opaque, bounded, request-scoped `HostProvided` capability.
- Production signing and notarization remain deferred by product decision. Native manual display/accessibility evidence and unavailable real provider/filesystem fixtures remain **UNVERIFIED**.
- There is no active W4 product defect. Cross-version macOS upgrade evidence remains **DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE**.

## Wave status

### W4 — Native Integration

**COMPLETE / CLOSED.** The final disposition and detailed evidence are recorded in the [W4 final closeout](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md) and summarized by the [W4 initiative record](initiatives/W4-native-integration.md).

### W5 — Release / Hardening

**ELIGIBLE / INACTIVE.** W5 owns release hardening, signing/notarization, update/publication readiness and the full supported-platform release matrix. It requires separate reviewed activation.

## Durable authority pointers

- TD-014 closed the cleanup-ledger physical-identity compatibility debt without changing Safe Trash/Restore authority; its final scope and evidence are recorded by the [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md) and [filesystem identity contract](../security/FILE_IDENTITY_SEMANTICS.md).
- ADR-0005 owns the overall native Host/Adapter boundary, macOS Native Preview Access, opaque `HostProvided` ownership, shell isolation and packaging boundaries: [ADR-0005](DECISIONS/0005-native-preview-host-boundary.md).
- ADR-0006 owns the accepted Windows bounded-capture source-lifetime amendment: [ADR-0006](DECISIONS/0006-windows-preview-handler-bounded-capture.md).
- Earlier waves and their execution evidence remain under their initiative, task, result and PR records. Current-truth documents point to those records; they do not duplicate their execution ledgers.
