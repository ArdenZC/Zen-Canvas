# Zen Canvas Project Status

Last verified: 2026-09-05

## Current baseline

- Default branch: `master`.
- Current execution state: **BETWEEN INITIATIVES**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **COMPLETE / CLOSED**.
- W5-01 — Release Baseline & Gap Audit: **COMPLETE / CLOSED**.
- W5-02 — Release Qualification & Publication Safety Gate: **COMPLETE / CLOSED**.
- W5-03 — Distribution / Update Strategy: **COMPLETE / CLOSED**.
- W5-04 — Supported-Platform Manual Release Acceptance: **CLOSED BY EXPLICIT PRODUCT DEFERRAL — native/manual GUI evidence remains UNVERIFIED**.
- W5-05 — Long-session / Performance Release Evidence: **SKIPPED — no evidence-derived trigger**.
- W5-06 — Release Candidate / Publication Decision: **COMPLETE / CLOSED — AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK**.
- Authorized v0.1.40 release candidate: `8b573772d842b4996bc1c34161236fa47025cc83`; tree `67cf3da35d7556bb868746a9ae0a56725558a163`.
- `CI Full Validation` run `33942690517`: **SUCCESS**.
- `Build Release Installers` run `33943755887`: **SUCCESS**.
- Windows hosted artifact: `Zen-Canvas-Windows`, id `9962868134`, digest `sha256:dc66010f193ed3eada2025ddbca61fb2d02dd9e635f00e1cb598b782f169346b`.
- macOS hosted artifact: `Zen-Canvas-macOS`, id `9962728560`, digest `sha256:0fea6a1086cc4a4704298643b64a91b076e7a0d9aaa30f461bf3233f3337944a`.
- Windows installer: `Zen Canvas_0.1.40_x64-setup.exe`, 5,259,151 bytes, SHA-256 `22e1416f39b9f2847b907419400528208422aba1d32defa99e8aed21b0827711`.
- macOS installer: `Zen Canvas_0.1.40_aarch64.dmg`, 4,516,903 bytes, SHA-256 `13f519199bbdf13c6242c0719e3a0358be0a9aa4263d2cb454864bf34441926f`.
- Both platform checksum manifests were verified against those installers.
- Release artifact set contains exactly two valid CycloneDX 1.6 SBOMs: one Node and one Rust document.
- Publication action: **AUTHORIZED / NOT YET EXECUTED**.
- Intended publication tag: `v0.1.40`, which must bind exactly to the authorized candidate above.
- Package version: `0.1.40`.
- Database schema: `35`.
- Published GitHub release: none.
- Published Git tag: none.

## Current initiative

**No active initiative**

Status: **BETWEEN INITIATIVES — no active initiative**

W5 — Release / Hardening is complete and closed. The separate `v0.1.40` publication action is authorized but is an operational release action, not an active product initiative. A future initiative requires separate reviewed activation.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.

## First-release policy truth

- Canonical public distribution surface after successful publication: GitHub Releases.
- Windows: versioned x64 NSIS manual download/install.
- macOS 13+ Apple Silicon: versioned DMG manual download/install.
- Automatic/background update checks: not implemented.
- In-app update download/install: not implemented.
- Updater key/endpoint/manifest: not implemented / deferred.
- Windows Authenticode: `NOT PROVIDED` / intentionally deferred.
- Apple Developer ID: `NOT PROVIDED` / intentionally deferred.
- Apple notarization/stapling: `NOT PROVIDED` / intentionally deferred.
- SmartScreen/Gatekeeper/manual native acceptance is **UNVERIFIED / EXPLICITLY DEFERRED**, not PASS.
- Accessibility certification is not claimed.

## W5 final release-decision truth

W5-06 accepted the remaining W5-04 manual/native uncertainty and authorized a separate publication action for the exact release-qualified candidate.

The decision is:

> **AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK**

The authorized source is fixed at `8b573772d842b4996bc1c34161236fa47025cc83`. The publication tag `v0.1.40` must point exactly to that commit so the W5-02 exact-SHA qualification gate remains meaningful.

The final candidate includes #189, which fixed the duplicate-SBOM publication-path defect before requalification. Fresh release-installer evidence confirms one Windows NSIS installer, one Apple-Silicon DMG, two matching checksum manifests and exactly two CycloneDX SBOMs. The tag-only `Publish GitHub Release` job was correctly skipped during the workflow-dispatch evidence run and remains a required part of the later real publication action.

W5-04 still has no real SmartScreen/Unknown Publisher/Gatekeeper/native installer/first-launch/Narrator/VoiceOver/display PASS. Genuine provider/external/network/multi-display fixtures remain `UNVERIFIED` where unavailable. Real older-release → newer-release upgrade remains `DEFERRED — no real older public release fixture`.

W5-05 remains skipped because no current evidence creates a material new long-session/performance obligation. The historical W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED`.

## Release state

Current release state remains **Validated / Packaged / Authorized for publication**, not `Released`.

Publication becomes `Released` only after the separately authorized tag-triggered release action succeeds and final GitHub Release assets are verified. A tag alone or a failed release workflow is not sufficient.

## Wave status

### W4 — Native Integration

**COMPLETE / CLOSED.** Final evidence remains in the [W4 final closeout](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

### W5 — Release / Hardening

**COMPLETE / CLOSED.** W5 established release qualification, current package evidence, the manual-download/install distribution policy, a truthful deferral of unavailable native/manual acceptance, and the final explicit decision to authorize publication with accepted residual risk.

## Durable authority pointers

- W5 final publication decision: [W5-06 result](tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md).
- Authorized operational publication action: [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md).
- W5 initiative history: [W5 initiative](initiatives/W5-release-hardening.md).
- W5 activation: [W5-00](tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).
- Release baseline/gap audit: [W5-01 result](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md).
- Release qualification closeout: [W5-02 result](tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md).
- Distribution/update decision: [W5-03 result](tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md).
- W5-04 explicit deferral closeout: [W5-04 result](tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md).
- W4 no-sign product decision: [W4-05 No-Sign disposition](tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md).
- TD-014 final scope/evidence: [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md) and [filesystem identity contract](../security/FILE_IDENTITY_SEMANTICS.md).
- Native authority remains owned by [ADR-0005](DECISIONS/0005-native-preview-host-boundary.md) and [ADR-0006](DECISIONS/0006-windows-preview-handler-bounded-capture.md).
