# Zen Canvas Project Status

Last verified: 2026-09-05

## Current baseline

- Default branch: `master`.
- Current execution state: **W5 — Release / Hardening (ACTIVE — implementation; decision phase)**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5-01 — Release Baseline & Gap Audit: **COMPLETE / CLOSED**.
- W5-02 — Release Qualification & Publication Safety Gate: **COMPLETE / CLOSED**.
- W5-03 — Distribution / Update Strategy: **COMPLETE / CLOSED — manual-download/install first-release policy selected**.
- W5-04 — Supported-Platform Manual Release Acceptance: **CLOSED BY EXPLICIT PRODUCT DEFERRAL — native/manual GUI acceptance remains UNVERIFIED because the available Computer Use environment exposes browser only (`apps: []`)**.
- W5-05 — Long-session / Performance Release Evidence: **NOT REQUIRED / SKIPPED FOR THE CURRENT DECISION PASS — no evidence-derived trigger**.
- W5-06 — Release Candidate / Publication Decision: **AUTHORIZED / CURRENT — explicit decision only; no automatic publication**.
- W5 activation merge: `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.
- W5-02 accepted implementation baseline: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.
- W5-02 closeout baseline: `master@86939e7301135bf05e991356376bc77f296236c4`; tree `c8d19ccf9f082efa93e678677a272f4f9db96cb0`.
- W5-03 activation baseline: `master@3001c7b0a5224d3d2555d89f8eeb95e4335236fa`; tree `29a672b8746584003e3d28ce0691c603e1f9d367`.
- W5-03 accepted decision baseline: `master@567e7a35c46f3b5e8f965198fa7675412a519324`; tree `26273a82b74ff257912354722c3061354fb5e640`.
- Current release-candidate evidence baseline: `master@5f6dcc643bec099e3b011af97c046ebc53d2772a`; tree `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`.
- TD-014 accepted maintenance baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`.
- W4 final closeout baseline: `master@f45aae1c270d827d881abf620d8f09074c8d7d7e`; tree `d2596364c544e2bcc6648fbe0ff0465f1cc512a8`.
- Package version: `0.1.40`.
- Database schema: `35`.
- Published GitHub release: none.
- Published Git tag: none.

## Current initiative

**W5 — Release / Hardening**

[Active initiative record](initiatives/W5-release-hardening.md)

Status: **ACTIVE — implementation; decision phase — W5-01/W5-02/W5-03 complete; W5-04 explicitly deferred/closed; W5-05 skipped; W5-06 current**

W5-02 closed release qualification and artifact freshness. W5-03 selected a manual-download/install policy for the first public release instead of adding an in-app updater before a real installed population and real older-release fixture exist.

First-release distribution policy remains:

- canonical public distribution surface after W5-06 authorization: GitHub Releases;
- Windows: versioned x64 NSIS manual download/install;
- macOS 13+ Apple Silicon: versioned DMG manual download/install;
- no automatic/background update check;
- no in-app update download/install;
- no updater key, endpoint or manifest;
- future updater remains `NOT IMPLEMENTED / DEFERRED` until a separately reviewed trigger is satisfied.

W5-04 did not obtain real native/manual GUI acceptance. The available Computer Use surface exposed browser interaction only (`apps: []`), so SmartScreen/Unknown Publisher, Gatekeeper/quarantine, native install/copy/first-launch, Narrator/VoiceOver, Explorer Preview Handler focus and native display smoke remain `UNVERIFIED`. This gap is explicitly accepted/deferred by product decision; it is not a PASS.

The exact candidate nevertheless has successful automated release evidence: `CI Full Validation` run `33890392142` and `Build Release Installers` run `33893501841` both succeeded for `master@5f6dcc643bec099e3b011af97c046ebc53d2772a`. The workflow produced `Zen-Canvas-Windows` artifact id `9945343182` and `Zen-Canvas-macOS` artifact id `9945180370`.

W5-05 is skipped for this decision pass because no current evidence triggers additional long-session/performance work. W5-06 is now the explicit release-candidate/publication decision Track and must preserve the unresolved W5-04 manual-acceptance truth.

No release or tag exists.

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
- The real SmartScreen/Gatekeeper/native manual acceptance path is **UNVERIFIED / EXPLICITLY DEFERRED** for the current decision pass because the available environment cannot exercise native app surfaces.
- W5-06 must make any publication decision with that residual risk visible and must not imply manual acceptance passed.
- W5-03 intentionally does not add Tauri updater artifact signing. Any future updater key would be a separate long-lived update-authenticity trust root, not Authenticode/Developer ID, and requires separate review.
- `Implemented`, `Validated`, `Packaged` and `Released` remain distinct states. Current release/tag state is still none.

## Accepted pre-W5 boundary

- W4 is complete and closed. Windows Explorer Preview Handler packaging, registration, repair and uninstall behavior are accepted within the reviewed W4 matrix; macOS engineering-DMG mount/copy/same-version replacement/remove/detach evidence is accepted for the frozen W4 artifact.
- TD-014 is complete and closed. Schema 35 cleanup identity uses explicit source-volume provenance and keeps ambiguous historical evidence fail closed without changing Safe Trash/Restore authority.
- Native manual display/accessibility and unavailable real provider/filesystem fixtures remain **UNVERIFIED** where W4/W5-04 could not record genuine evidence.
- Cross-version macOS upgrade remains **DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE**.
- The historical W1 Scheduler pressure comparison remains a real `TARGET MISSED` observation, not a current demonstrated release regression.

## Accepted W5 release-hardening evidence

- W5-02 implementation merge: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.
- Final W5-02 PR head: `82dcfe47239c2bbf4854965275a6da71073d3979`; source-evidence checkout tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.
- PR CI `33880988509`: **SUCCESS**.
- Windows NSIS package job `101049497151`: **SUCCESS**; artifact identity `Zen Canvas_0.1.40_x64-setup.exe`.
- Apple-Silicon unsigned DMG package job `101049497171`: **SUCCESS**; artifact identity `Zen Canvas_0.1.40_aarch64.dmg`.
- Windows/macOS Quality gates and dependency audit passed on the accepted tree.
- Current exact candidate `master@5f6dcc643bec099e3b011af97c046ebc53d2772a`; tree `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`.
- `CI Full Validation` `33890392142`: **SUCCESS**.
- `Build Release Installers` `33893501841`: **SUCCESS**.
- Windows hosted artifact `Zen-Canvas-Windows`, id `9945343182`, workflow-artifact digest `sha256:6aed84148ed18d82c5cfc7bfbc2ddc4e32f5c92c4db940243c2e1962bfbd8125`.
- macOS hosted artifact `Zen-Canvas-macOS`, id `9945180370`, workflow-artifact digest `sha256:895bb85aa0ea44887ea817e2573c7703de71283b36e4835e0fe9f75964d1c580`.
- These are **Validated / Packaged** facts. Native/manual GUI release acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED**.

## Wave status

### W4 — Native Integration

**COMPLETE / CLOSED.** Final evidence remains in the [W4 final closeout](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

### W5 — Release / Hardening

**ACTIVE — implementation; decision phase.** W5-01, W5-02 and W5-03 are complete. W5-04 is closed by explicit deferral without a manual-acceptance PASS. W5-05 is skipped for the current decision pass. W5-06 Release Candidate / Publication Decision is the current bounded Track.

## Durable authority pointers

- W5 scope and sequencing: [W5 initiative](initiatives/W5-release-hardening.md).
- W5 activation: [W5-00](tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).
- Release baseline/gap audit: [W5-01 result](tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md).
- Release qualification closeout: [W5-02 result](tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md).
- Distribution/update decision: [W5-03 result](tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md).
- W5-04 explicit deferral closeout: [W5-04 result](tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md).
- Current publication-decision Track: [W5-06](tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-CODEX.md).
- W4 no-sign product decision: [W4-05 No-Sign disposition](tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md).
- TD-014 final scope/evidence: [TD-014 initiative](initiatives/TD-014-cleanup-ledger-physical-identity.md) and [filesystem identity contract](../security/FILE_IDENTITY_SEMANTICS.md).
- Native authority remains owned by [ADR-0005](DECISIONS/0005-native-preview-host-boundary.md) and [ADR-0006](DECISIONS/0006-windows-preview-handler-bounded-capture.md).
