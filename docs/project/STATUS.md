# Zen Canvas Project Status

Last verified: 2026-09-04

## Current baseline

- Default branch: `master`.
- Current execution state: **W5 — Release / Hardening (ACTIVE)**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5-01 — Release Baseline & Gap Audit: **COMPLETE / CLOSED**.
- W5-02 — Release Qualification & Publication Safety Gate: **COMPLETE / CLOSED**.
- W5-03 — Distribution / Update Strategy: **COMPLETE / CLOSED — manual-download/install first-release policy selected**.
- W5-04 — Supported-Platform Manual Release Acceptance: **ACTIVE after activation — real-platform QA/evidence**.
- W5 activation merge: `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.
- W5-02 accepted implementation baseline: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.
- W5-02 closeout baseline: `master@86939e7301135bf05e991356376bc77f296236c4`; tree `c8d19ccf9f082efa93e678677a272f4f9db96cb0`.
- W5-03 activation baseline: `master@3001c7b0a5224d3d2555d89f8eeb95e4335236fa`; tree `29a672b8746584003e3d28ce0691c603e1f9d367`.
- W5-03 accepted decision baseline: `master@567e7a35c46f3b5e8f965198fa7675412a519324`; tree `26273a82b74ff257912354722c3061354fb5e640`.
- TD-014 accepted maintenance baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`.
- W4 final closeout baseline: `master@f45aae1c270d827d881abf620d8f09074c8d7d7e`; tree `d2596364c544e2bcc6648fbe0ff0465f1cc512a8`.
- Package version: `0.1.40`.
- Database schema: `35`.
- Published GitHub release: none.
- Published Git tag: none.

## Current initiative

**W5 — Release / Hardening**

[Active initiative record](initiatives/W5-release-hardening.md)

Status: **ACTIVE — implementation; W5-01/W5-02/W5-03 complete; W5-04 Supported-Platform Manual Release Acceptance active as a real-platform evidence Track**

W5-02 closed release qualification and artifact freshness. W5-03 selected a manual-download/install policy for the first public release instead of adding an in-app updater before a real installed population and real older-release fixture exist.

First-release distribution policy remains:

- canonical public distribution surface after later W5-06 authorization: GitHub Releases;
- Windows: versioned x64 NSIS manual download/install;
- macOS 13+ Apple Silicon: versioned DMG manual download/install;
- no automatic/background update check;
- no in-app update download/install;
- no updater key, endpoint or manifest;
- future updater remains `NOT IMPLEMENTED / DEFERRED` until a separately reviewed trigger is satisfied.

W5-04 now owns the remaining real-user manual release evidence. Required first-release evidence is the actual unsigned Windows install/launch warning path and actual unsigned Apple-Silicon DMG first-launch/Gatekeeper path on supported hosts. Selected accessibility/focus/display smoke is attempted where genuine supported hosts are available. Provider/external/network/multi-display/cross-version facts remain `UNVERIFIED` when genuine fixtures do not exist; they must not be fabricated.

No release or tag exists. W5-05 and W5-06 remain inactive.

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
- W5-02 release copy describes those facilities as `NOT PROVIDED` / intentionally deferred and forbids fabricated PASS claims.
- An intentionally unsigned public distribution still requires truthful SmartScreen/Gatekeeper warning/install/launch evidence before final publication policy closes; W5-04 owns that evidence.
- W5-03 intentionally does not add Tauri updater artifact signing. Any future updater key would be a separate long-lived update-authenticity trust root, not Authenticode/Developer ID, and requires separate review.
- `Implemented`, `Validated`, `Packaged` and `Released` remain distinct states. Current release/tag state is still none.

## Accepted pre-W5 boundary

- W4 is complete and closed. Windows Explorer Preview Handler packaging, registration, repair and uninstall behavior are accepted within the reviewed W4 matrix; macOS engineering-DMG mount/copy/same-version replacement/remove/detach evidence is accepted for the frozen W4 artifact.
- TD-014 is complete and closed. Schema 35 cleanup identity uses explicit source-volume provenance and keeps ambiguous historical evidence fail closed without changing Safe Trash/Restore authority.
- Native manual display/accessibility and unavailable real provider/filesystem fixtures remain **UNVERIFIED** where W4 classified them that way until W5-04 records genuine evidence.
- Cross-version macOS upgrade remains **DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE**.
- The historical W1 Scheduler pressure comparison remains a real `TARGET MISSED` observation, not a current demonstrated release regression.

## Accepted W5 release-hardening evidence

- W5-02 implementation merge: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.
- Final W5-02 PR head: `82dcfe47239c2bbf4854965275a6da71073d3979`; source-evidence checkout tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.
- PR CI `33880988509`: **SUCCESS**.
- Windows NSIS package job `101049497151`: **SUCCESS**; artifact identity `Zen Canvas_0.1.40_x64-setup.exe`.
- Apple-Silicon unsigned DMG package job `101049497171`: **SUCCESS**; artifact identity `Zen Canvas_0.1.40_aarch64.dmg`.
- Windows/macOS Quality gates and dependency audit passed on the accepted tree.
- These validation artifacts are **Packaged / Validated** evidence for the accepted tree, not published GitHub Release assets.

## Wave status

### W4 — Native Integration

**COMPLETE / CLOSED.** Final evidence remains in the [W4 final closeout](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

### W5 — Release / Hardening

**ACTIVE — implementation.** W5-01, W5-02 and W5-03 are complete. W5-04 Supported-Platform Manual Release Acceptance is the current bounded QA/evidence Track. W5-05 remains conditional and inactive; W5-06 remains the later explicit publication decision.

## Durable authority pointers

- W5 scope and sequencing: [W5 initiative](initiatives/W5-release-hardening.md).
- W5 activation: [W5-00](tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).
- Release baseline/gap audit: [W5-01 result](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md).
- Release qualification closeout: [W5-02 result](tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md).
- Distribution/update decision: [W5-03 result](tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md).
- Current manual acceptance Track: [W5-04](tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-CODEX.md).
- W4 no-sign product decision: [W4-05 No-Sign disposition](tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md).
- TD-014 final scope/evidence: [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md) and [filesystem identity contract](../security/FILE_IDENTITY_SEMANTICS.md).
- Native authority remains owned by [ADR-0005](DECISIONS/0005-native-preview-host-boundary.md) and [ADR-0006](DECISIONS/0006-windows-preview-handler-bounded-capture.md).
