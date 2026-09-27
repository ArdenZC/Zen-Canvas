# Zen Canvas Project Status

Last verified: 2026-09-27

## Current execution truth

- Latest merged production baseline: `master@a62c30f037956c3838244e113da881d9c77b7be1`, the squash merge for Pre-PM AI Readiness + Consent Contract / PR #279. Accepted Production HEAD `dc144b6efaa6ae101f7c624ad32228cb85b91d65` passed exact-head CI [36324852969](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36324852969); docs-only Final HEAD `a8bc3284bdf98fa697ad49c318eeeab59f224a99` passed CI [36327475054](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36327475054); owner-approved pre-merge HEAD `e362368abd6409063b0ef0be0b5292f621928e9d` passed CI [36328365116](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36328365116); merge-after master CI [36329213184](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36329213184) is **SUCCESS**.
- Current engineering initiative: **ACTIVE — implementation — READY FOR OWNER REVIEW — Pre-PM Cleanup AI Data-Sharing Consent Gate** on `hardening/cleanup-ai-consent`, issue [#284](https://github.com/ArdenZC/Zen-Canvas/issues/284), Draft PR [#285](https://github.com/ArdenZC/Zen-Canvas/pull/285). Accepted Production HEAD candidate: `1ec24f49bf2e2c777bcc8206e9a286d9b396685a`; exact-head CI [36332783985](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36332783985) is **SUCCESS**. PM-01 remains NOT ACTIVE until owner review and merge close this Track.
- PM-01 is **NOT ACTIVE**. Post-Pre-PM Sequencing Review / PR #282 is **COMPLETE / MERGED** at `master@2aaeb7599a6f4e8520c92dd8b3726138b0395d9a`, and old Draft PR #274 is **CLOSED / superseded**. The final narrow consent prerequisite is **IMPLEMENTED / EXACT-HEAD CI PASS / OWNER REVIEW PENDING** in #284/#285; if owner review passes and #285 merges, the PM-01 design hold is released. macOS resident compatibility remains separately open as [#270](https://github.com/ArdenZC/Zen-Canvas/issues/270).
- Release truth remains separate and unchanged: W6-10A / RC1 is frozen; W6-10B remains **BLOCKED** on valid SmartScreen/UAC evidence; W6-10C remains **DEFERRED / UNVERIFIED** without a supported Apple Silicon host; full supported-platform release PASS is **NOT CLAIMED**; publication remains **DEFERRED**.
- Accepted production functional baseline inside PR #242: `88fc663392371049fda2d71b85bd4815d073bfe0`; tree `5ca511f055b02bb511bc0873ffc5c2a2d26efadf`.
- Evidence/docs successor before the Solid / Calm freeze: `057a74af5838108354651df84b7184f81ac94ad0`; tree `69e4649185b0cfd936bd986b6c0b0f5fd85ac1f5`.
- Functional / authority disposition: **ACCEPTED**. First-entry Browse, admitted ephemeral-session truth, Preview Core/Read Gate, PDF range/lazy/continuous rendering, Markdown, image transport, provider ordering, pinned-source semantics, Details and cancellation behavior are frozen against presentation-only migration.
- Windows native functional evidence: **CAPTURED / ACCEPTED** at production source `88fc6633...` through the legal native Folder Picker -> existing `openBrowse()` route.
- Visual authority amendment (2026-09-21): **Solid / Calm Demo V2 is the current material/presentation canonical**. V26 remains authority for structure, navigation hierarchy, information architecture and unsuperseded interaction contracts. **Liquid Glass material direction is revoked**.
- The `88fc6633...` Windows screenshots remain valid functional/native regression evidence but are **HISTORICAL for final visual parity** because the visual authority changed afterward.
- Production-head hosted CI: [35608830144](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35608830144) — **SUCCESS**. Evidence/docs-head CI: [35611907483](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35611907483) — **SUCCESS**.
- Solid / Calm presentation migration is **IMPLEMENTED / MERGED through PR #242**; accepted presentation production source `8fd246476e025636d4606a44d23688865ab89cc2` / tree `475a8d0e0295abbe37b3afa115738fa3602785e7` has hosted CI [35685110417](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35685110417) — **SUCCESS**. Owner Windows exact-head native product and Solid / Calm visual acceptance are **PASS**; W6-09 is **COMPLETE / CLOSED / MERGED**.
- Full supported-platform native PASS is **NOT CLAIMED**. Windows DPI/scaling, Forced Colors, real macOS GUI/Retina, release-path/release-binary acceptance, accessibility qualification and remaining lifecycle/mutation residuals are explicitly accepted for W6-10; see the [W6-09 closeout result](tasks/W6-09-WHOLE-PRODUCT-NATIVE-REGRESSION-CLOSEOUT-RESULT.md).

## Current visual authority

- Freeze manifest: [Solid / Calm Demo V2 Freeze Manifest](../design/w6-09/SOLID-CALM-V2-FREEZE-MANIFEST.md).
- Current task record: [W6-09 Solid / Calm V2 Presentation Migration](tasks/W6-09-SOLID-CALM-V2-PRESENTATION-MIGRATION-ACTIVATION.md).
- Final closeout result: [W6-09 Whole-Product Native Regression — Closeout Result](tasks/W6-09-WHOLE-PRODUCT-NATIVE-REGRESSION-CLOSEOUT-RESULT.md).
- Presentation migration must preserve the accepted functional baseline; it is not authorization to reopen backend/Preview/Browse architecture.

## Current initiative

**Pre-PM Cleanup AI Data-Sharing Consent Gate**

Status: **ACTIVE — implementation — READY FOR OWNER REVIEW. Production HEAD `1ec24f49bf2e2c777bcc8206e9a286d9b396685a`; exact-head CI `36332783985` SUCCESS; PM-01 remains NOT ACTIVE until merge.**

Authority: [Pre-PM Cleanup AI Data-Sharing Consent Gate](initiatives/pre-pm-cleanup-ai-consent-gate.md). Result: [Pre-PM Cleanup AI Data-Sharing Consent Gate — Result](tasks/PRE-PM-CLEANUP-AI-CONSENT-GATE-RESULT.md). Issue: [#284](https://github.com/ArdenZC/Zen-Canvas/issues/284). Draft PR: [#285](https://github.com/ArdenZC/Zen-Canvas/pull/285). Branch: `hardening/cleanup-ai-consent`. Baseline: `master@2aaeb7599a6f4e8520c92dd8b3726138b0395d9a`.

Implemented truth:

- existing versioned `AISettings` now owns distinct `cleanupLocalAiAllowed` / `cleanupCloudAiAllowed` policy, both fail-closed by default;
- legacy saved settings lacking those fields deserialize to false without a database schema migration;
- `crate::ai::readiness` derives Cleanup readiness from current provider/settings/credential truth plus Cleanup feature enablement, provider mode, matching Cleanup consent and current path-disclosure settings;
- the configured Cleanup provider path enforces that readiness before provider construction/work;
- candidate name/metadata disclosure is explicit; parent/full-path disclosure still follows the existing privacy settings; Cleanup sends no file content;
- Managed Scope and Content Understanding consent remain separate and cannot satisfy Cleanup consent;
- Settings exposes explicit local/cloud Cleanup permission but the renderer owns no authority.

Cleanup Finding, current-assessment CAS/currentness, Operation Preview, confirmation, Safe Trash, journal and Restore are unchanged. This Track does not make Cleanup AI mandatory for execution; PM-01 owns that product behavior.

Post-Pre-PM Sequencing Review / #282 remains **COMPLETE / MERGED**. Research issue #283 remains research-only and non-blocking. Old #274 remains closed/superseded. #270 remains separate.

## Release, schema and platform truth

- W6-10A result: [Release Candidate Freeze — Result](tasks/W6-10A-RELEASE-CANDIDATE-FREEZE-RESULT.md).
- Package version: `0.1.40`.
- W6-10A RC1: **FROZEN / ACCEPTED FOR RELEASE QUALIFICATION** at source `9c8cdee792f8a2b5078c22c517d8648899440b0c` / tree `3ec2158bb56ce0a734b2c894793f5fe60b8b3296`; Full Validation `35702434460` and Release Build `35704683429` are **SUCCESS**. PR #246 is **MERGED** and merge-after CI [35709481851](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35709481851) is **SUCCESS**.
- Database schema: `35`.
- Public publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT PUBLISH**.
- No published GitHub release or tag.
- Supported product targets: Windows and macOS 13 or later on Apple Silicon.
- Intel Macs are not product targets. Universal binaries are not product targets. Rosetta is not a product target. Linux is not a product target.

## Residuals and next gates

- W6-05 native evidence remains the historical degraded baseline; it must not be upgraded to PASS by W6-07 presentation work.
- Historical Organization Plan exact-head native authoritative-preview evidence remains owner/native verification required unless new evidence closes it.
- Cleanup Windows extended-path rejection: **CLOSED / FIXED**; W6-09 performs regression coverage only unless a supported-native reproduction reopens it.
- Typed/folder Quick Preview residual: **ACCEPTED DEFER**. W6-08 repository/browser evidence closes the known presentation/support gap; Windows exact-head native Quick Preview visual acceptance is **PASS**. Real macOS GUI verification is explicitly carried to W6-10 release qualification. Browser PASS != Native PASS.
- Organization Plan authoritative safe-preview degradation: **ENVIRONMENT-SPECIFIC**; supported-native fixture reproduction remains required and must stay fail-closed.
- Global Index unavailable / zero-source state: **ACCEPTED DEFER**; exact-head native source/state truth remains to be re-evaluated.
- Browse first-scan / recovery friction: **ACCEPTED DEFER**; exact-head native first-launch/restart recovery remains to be re-evaluated.
- W6-09 status: **COMPLETE / CLOSED — OWNER WINDOWS NATIVE PRODUCT ACCEPTANCE PASS; SOLID / CALM WINDOWS VISUAL ACCEPTANCE PASS; FULL SUPPORTED-PLATFORM NATIVE PASS NOT CLAIMED**. Production source `8fd246476e025636d4606a44d23688865ab89cc2` / tree `475a8d0e0295abbe37b3afa115738fa3602785e7` has fresh hosted CI [35685110417](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35685110417) — **SUCCESS**. The accepted production baseline `88fc663392371049fda2d71b85bd4815d073bfe0` (tree `5ca511f055b02bb511bc0873ffc5c2a2d26efadf`) and its functional/native evidence remain unchanged. The exact Windows visual evidence is retained externally at `F:\CargoTarget\w6-09-solid-calm-owner-review-00787888\windows\` with package `F:\CargoTarget\w6-09-solid-calm-owner-review-00787888.zip`.
- Final closeout authority: [W6-09 Whole-Product Native Regression — Closeout Result](tasks/W6-09-WHOLE-PRODUCT-NATIVE-REGRESSION-CLOSEOUT-RESULT.md). Evidence package SHA-256 is `43236C3E82ACF409261436E598EBE191EA048715CCCB2832C84795C705F0BEF8`. W6-10A is **COMPLETE / CLOSED / MERGED**. W6-10B historical RC1 qualification is **FAIL / BLOCKED**, while R1 diagnosis proves **RC1 clean-profile startup PASS**. Owner has retained RC1 for a separate clean-profile requalification and has not authorized RC2. W6-10C remains **ELIGIBLE / NOT ACTIVE**; publication remains deferred.

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
- W6-09 was the subsequent track after the explicit residual disposition gate; its accepted closeout is recorded below.
- W6-05 typed/folder Quick Preview disposition: **ACCEPTED DEFER**. The W6-08
  implementation and browser/integration evidence close the known
  presentation/support gap at repository level. Exact-head Windows/macOS
  native Quick Preview UI re-verification is carried into W6-09 Whole-Product
  Native Regression; a reproduced Preview defect may receive bounded native
  correction and re-verification there. Browser PASS != Native PASS.

## W6-09 execution record

- Activation baseline: `master@20781c8dc4dc8f24f0ed7d2ce860f5fd62d35ec9`; tree `2535499a23be61786543bab19c71e35ee7a1d36f`.
- Completed track: [Issue #241](https://github.com/ArdenZC/Zen-Canvas/issues/241) — **CLOSED / completed**; PR [#242](https://github.com/ArdenZC/Zen-Canvas/pull/242) — **squash-merged** to `master@164608f90b8233303fefcf9660822daea0ecb857`.
- Status: **COMPLETE / CLOSED — OWNER WINDOWS NATIVE PRODUCT ACCEPTANCE PASS; SOLID / CALM WINDOWS VISUAL ACCEPTANCE PASS; FULL SUPPORTED-PLATFORM NATIVE PASS NOT CLAIMED**.
- Accepted production functional baseline: `88fc663392371049fda2d71b85bd4815d073bfe0`; tree `5ca511f055b02bb511bc0873ffc5c2a2d26efadf`.
- Exact Windows native functional evidence covers first-entry Browse plus PDF pages 1/2/3, Markdown, image, loading/failed, Details, pinned/background selection, dark/compact and titlebar/focus states. This remains valid functional evidence.
- Visual acceptance was re-baselined after capture. Solid / Calm Demo V2 now owns material/presentation; Liquid Glass is revoked. Prior Windows captures are therefore historical for final visual parity.
- Solid / Calm authority is checksum-bound in `docs/design/w6-09/SOLID-CALM-V2-FREEZE-MANIFEST.md`.
- Production-head hosted CI 35608830144 is **SUCCESS**; evidence/docs-head CI 35611907483 is **SUCCESS**; presentation source CI [35685110417](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35685110417) is **SUCCESS**.
- Production source is `8fd246476e025636d4606a44d23688865ab89cc2`; tree `475a8d0e0295abbe37b3afa115738fa3602785e7`. Owner Windows exact-head native product and Solid / Calm visual acceptance are **PASS**. Full supported-platform native PASS is **NOT CLAIMED**; Windows DPI/scaling, Forced Colors, real macOS GUI/Retina and release-path/release-binary acceptance are accepted residuals for W6-10. Final authority: [W6-09 Whole-Product Native Regression — Closeout Result](tasks/W6-09-WHOLE-PRODUCT-NATIVE-REGRESSION-CLOSEOUT-RESULT.md).
- Merge-after hosted CI [35697239225](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35697239225) is **SUCCESS** on `master@164608f90b8233303fefcf9660822daea0ecb857`.
- W6-10 Release Re-entry has **no active implementation task**. W6-10B is blocked on missing valid SmartScreen/UAC evidence host. W6-10C is **DEFERRED / UNVERIFIED — OWNER SKIPPED** because no real supported Mac host is available. Full supported-platform GO cannot be claimed under the current support policy. Publication remains deferred.

## Review policy

Owner review and merge decisions use direct diff inspection, repository governance checks and applicable CI evidence. Codex Review is not merge authority.
