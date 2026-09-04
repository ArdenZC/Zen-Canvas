# Zen Canvas Project Status

Last verified: 2026-09-04

## Current baseline

- Default branch: `master`.
- Current execution state: **W5 — Release / Hardening (ACTIVE)**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 activation merge: `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.
- TD-014 accepted maintenance baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`.
- W4 final closeout baseline: `master@f45aae1c270d827d881abf620d8f09074c8d7d7e`; tree `d2596364c544e2bcc6648fbe0ff0465f1cc512a8`.
- Package version: `0.1.40`.
- Database schema: `35`.
- Published GitHub release: none.
- Published Git tag: none.

## Current initiative

**W5 — Release / Hardening**

[Active initiative record](initiatives/W5-release-hardening.md)

Status: **ACTIVE — implementation; W5-01 audit complete; W5-02 Release Qualification & Publication Safety Gate next**

W5-01 found no current data-loss/runtime blocker, but found a real release-process blocker: `release-build.yml` accepts any successful ordinary exact-SHA CI rather than requiring explicit release-qualified full validation. Because ordinary CI intentionally supports docs-only/proportional lanes, a green docs-only run is not sufficient release evidence.

W5-01 also confirmed that the latest production-affecting TD-014 candidate passed release compilation, Rust/native and performance validation but did not run the NSIS/unsigned-DMG package lanes. Current product code therefore still needs current supported-platform package artifacts before release qualification can close.

W5-02 is the only next implementation Track authorized by W5-01. It must harden the release qualification prerequisite and obtain exact-head current NSIS/DMG package evidence without creating a tag or GitHub Release.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.

## Release policy truth

- Production Authenticode, Apple Developer ID, notarization and stapling remain **DEFERRED / NOT PLANNED IN CURRENT HORIZON** by the accepted W4 product decision.
- W5 must not assume signing credentials will become available or add dormant signing infrastructure merely for checklist symmetry.
- An intentionally unsigned public distribution still requires truthful SmartScreen/Gatekeeper warning/install/launch evidence before final publication policy closes.
- No in-app updater/update-channel implementation exists in the current repository; W5-03 will decide manual-download first-release policy versus a separately reviewed updater implementation.
- `Implemented`, `Validated`, `Packaged` and `Released` remain distinct states. Current release/tag state is still none.

## Accepted pre-W5 boundary

- W4 is complete and closed. Windows Explorer Preview Handler packaging, registration, repair and uninstall behavior are accepted within the reviewed W4 matrix; macOS engineering-DMG mount/copy/same-version replacement/remove/detach evidence is accepted for the frozen W4 artifact.
- TD-014 is complete and closed. Schema 35 cleanup identity uses explicit source-volume provenance and keeps ambiguous historical evidence fail closed without changing Safe Trash/Restore authority.
- TD-014 exact-head CI `33834541344` passed Windows/macOS release compile, Rust/native and the applicable performance matrix, but NSIS and unsigned-DMG package jobs were skipped. That evidence is **Validated**, not current **Packaged** evidence.
- Native manual display/accessibility and unavailable real provider/filesystem fixtures remain **UNVERIFIED** where W4 classified them that way.
- Cross-version macOS upgrade remains **DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE**.
- The historical W1 Scheduler pressure comparison remains a real `TARGET MISSED` observation, not a current demonstrated release regression.

## Wave status

### W4 — Native Integration

**COMPLETE / CLOSED.** Final evidence remains in the [W4 final closeout](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

### W5 — Release / Hardening

**ACTIVE — implementation.** W5-01 Release Baseline & Gap Audit is complete by the [W5-01 result](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md). W5-02 Release Qualification & Publication Safety Gate is next and is the only downstream implementation Track currently authorized.

## Durable authority pointers

- W5 scope and sequencing: [W5 initiative](initiatives/W5-release-hardening.md).
- W5 activation: [W5-00](tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).
- Release baseline/gap audit: [W5-01 result](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md).
- Next implementation Track: [W5-02 Release Qualification & Publication Safety Gate](tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-CODEX.md).
- W4 no-sign product decision: [W4-05 No-Sign disposition](tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md).
- TD-014 final scope/evidence: [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md) and [filesystem identity contract](../security/FILE_IDENTITY_SEMANTICS.md).
- Native authority remains owned by [ADR-0005](DECISIONS/0005-native-preview-host-boundary.md) and [ADR-0006](DECISIONS/0006-windows-preview-handler-bounded-capture.md).
