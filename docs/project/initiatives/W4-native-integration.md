# W4 — Native Integration

Status: **COMPLETE / CLOSED**

Owner: Zen Canvas

Final W4 project closeout baseline: `master@f45aae1c270d827d881abf620d8f09074c8d7d7e`; tree `d2596364c544e2bcc6648fbe0ff0465f1cc512a8`.

Final W4 closeout authority/evidence: [`../tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md`](../tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

## Goal

Integrate the stable Zen Preview Platform with native macOS and Windows surfaces where native capability provides real user value, while preserving the existing PreviewSession, Provider Registry, ReadGate, WorkScheduler, identity and mutation authorities.

W4 was a native-host and packaging Wave. It did not create a second Preview engine or reopen the W3 provider architecture.

## Accepted product outcome

- Zen has a Zen-internal macOS native Quick Look-backed path for the reviewed strong-native format scope, using the existing Preview hosts and authoritative bounded staging.
- Zen has a Windows Explorer Preview Handler for the deliberately reviewed association matrix, using the accepted bounded-capture source model and normal Preview Handler isolation.
- Native lifecycle, packaging, registration, repair/uninstall and resource-cleanup behavior is accepted within the final W4 evidence scope.
- The product does not need to launch the full Zen UI solely to service a shell preview request.
- Production signing and notarization are not claimed; they remain deferred by product decision.

## Durable architecture boundaries

- `PreviewSession` remains Preview lifecycle/publication authority; the production Provider Registry remains provider-selection truth; `MaterializationReadGate` remains Zen-owned byte-read/materialization authority; `WorkScheduler` remains the expensive Preview-work scheduler.
- Managed and ephemeral source identity, the operation journal, Safe Trash, Restore and filesystem-safety mutation authorities remain unchanged and authoritative.
- Renderer paths are never filesystem authority. W4 adds no second Preview engine, provider registry, durable identity store or general byte-read/materialization authority.
- Zen-owned in-app Preview sources remain `ManagedFile` or `EphemeralBrowse`. A native macOS representation does not turn them into `HostProvided`; native access still requires authoritative actual-open/read behavior, complete bounded staging and final source-version revalidation, and cannot implicitly hydrate provider content.
- `HostProvided` is reserved for OS/shell-owned, opaque, request-scoped ownership. It is pathless, bounded and non-durable; it is not a disguised filesystem path or a replacement identity authority.
- On Windows, `IInitializeWithStream` is ingress-only. ADR-0006's capture-before-defer rule requires one strictly bounded capture in `DoPreview`, release of handler-owned shell `IStream` and file-handle state before deferred work, and deferred rendering only over Zen-owned immutable bounded memory. `Unload` correctness does not depend on `CoCancelCall` terminating arbitrary source work.
- Windows Preview Handler isolation remains low-integrity by default. The package model is not migrated to MSIX merely for convenience.
- Intel macOS and Linux are outside the product targets; Universal binaries and Rosetta are not product targets.

The durable native rationale is owned by [ADR-0005](../DECISIONS/0005-native-preview-host-boundary.md) and [ADR-0006](../DECISIONS/0006-windows-preview-handler-bounded-capture.md). This initiative record summarizes those decisions rather than reproducing their evidence or rationale.

## Final disposition

- The initiative is complete and closed. No W4 product defect is open; all W4 implementation tracks are closed.
- W4-03 v1 is retained as architecture-spike provenance only: its request-long asynchronous shell-`IStream` model is superseded and was not merged. ADR-0006 is the accepted replacement.
- Windows packaging, registration, repair and uninstall are accepted within the reviewed matrix. The tested same-version macOS engineering DMG lifecycle is accepted; cross-version upgrade remains **DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE**.
- Native manual display/accessibility evidence and unavailable real provider/filesystem fixtures remain **UNVERIFIED**. These classifications are not silently converted to PASS by this documentation slimming.
- W5 — Release / Hardening remains **ELIGIBLE / INACTIVE** and requires separate reviewed activation. W4 completion does not activate W5.

## Evidence pointers

- [Final W4 current-truth closeout](../tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md) is the canonical consolidated W4 evidence record and remains intentionally detailed.
- [ADR-0005](../DECISIONS/0005-native-preview-host-boundary.md) owns the overall native Host/Adapter, macOS Native Preview Access, opaque `HostProvided`, shell isolation and packaging boundaries.
- [ADR-0006](../DECISIONS/0006-windows-preview-handler-bounded-capture.md) owns the Windows capture-before-defer source-lifetime amendment and supersedes the rejected request-long shell-stream assumption.
- Earlier implementation, task, result and PR records remain historical evidence and are not rewritten by ES-03.
