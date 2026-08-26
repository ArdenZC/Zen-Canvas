# Zen Canvas Project Status

Last verified: 2026-08-27

## Current baseline

- Default branch: `master`.
- Current W4 production/current-truth baseline:
  `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; tree:
  `f357be042c493d0cefd98be8e02d768210ac1f6b`
  (PR #151 W4-03 v2 Windows Preview Handler Bounded-Capture Spike squash merge).
- W4-03 v2 final independently accepted implementation head:
  `19e51d5e2eed175a0eda18a02b47d82c97cc289b`; tree:
  `f357be042c493d0cefd98be8e02d768210ac1f6b`.
- W4-03 v2 independent review record: `#5032769265`, `#5032891624`, `#5034153959`, `#5035858384`; final **PASS / blockers = 0**.
- W4-03 v2 final exact-head hosted CI run `33008914117`: `success` on attempt 1, including Windows native Preview Handler/harness, Windows/macOS Rust, native macOS Quick Look lifecycle, dependency audit of both Cargo workspaces, Preview Platform performance, frontend/release/performance and aggregate quality gates.
- W4-03 v2 real Explorer/prevhost acceptance: **PASS** on the native-equivalent handler source; isolated HKCU test registration, normal Preview Handler isolation, A/B stale protection, write/open/rename/move/delete after bounded capture and deterministic cleanup were observed. Handler DLL SHA-256: `51C89F1746E95314D6715DB296339C0A6DC44928136919E52432F65EBAC7F29A`.
- W4-02 production/runtime baseline remains:
  `master@8ea647e13882f8cb0e08b77a2953fb06765d1729`; tree:
  `f2ab398bf87d162fa1c6ca07f1784ceca259bdda`
  (PR #145 W4-02 macOS Native Quick Look Host squash merge).
- W4-02 final independently accepted implementation head:
  `809a2002067c315784b48a524a815be328d7c953`; tree:
  `f2ab398bf87d162fa1c6ca07f1784ceca259bdda`.
- W4-02 independent exact-head review `#5030646522`: **PASS / blockers = 0**.
- W4-02 exact-head/final PR-tree hosted CI run `32962219486`: `success`; the final post-audit attempt passed all required Windows/macOS Rust, clippy, macOS race, Apple Silicon native Quick Look lifecycle, native performance, frontend, release, audit and performance/quality gates on the unchanged exact final head.
- ADR-0006 and the W4-03 v1 Stop Condition #5 governance remain accepted in the current tree. PR #148's `db192a541e9bdabcf581f9dce57be8efff39c8e2` / tree `e87569d48716e791bd35b5f4013940e708cb1853` remain the provenance identities for that Windows source-model amendment, not the current `master` head.
- W4-03 v1 architecture spike PR #146 is **STOPPED / CLOSED WITHOUT MERGE** at
  `11fd3729770266f191ea7799edbc2b867693c181`; its request-long shell-`IStream`
  source model is rejected by Stop Condition #5 and retained only as spike provenance.
- W4-01 production/runtime baseline:
  `master@02e88db7cf4287e0d68792b3960da503b70d6c56`; tree:
  `135c7a30626915bdffb0e1c4e6ca4f09734c5c9f`
  (PR #143 W4-01 squash merge).
- W4-01 final independently accepted implementation head:
  `5e99b940ac81a78d4b129d405379a027aad489b7`; tree:
  `100843c8eac51dc1bc676a20b170fbd31abbe759`.
- W4-01 independent exact-head review `#5019582519`: **PASS / blockers = 0**.
- W4-01 implementation exact-head hosted CI `32844897985`: `success`.
- W4-01 final PR head `eca7a10a073b9f2728888cfd5ff3ff47ab6228bf`; final PR-tree hosted CI `32855283296`: `success` after a same-head failed-job rerun with no production code or performance-threshold change.
- W4 activation baseline / W3 final governance closeout:
  `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`; tree:
  `50efecd2579b5d786ae059b0561b36bca79935e6`
  (PR #141 W3-R1 final governance closeout squash merge).
- W4-00 activation merge:
  `master@994d93b07a2bc3434977de1e16bd1e29b2585983`; tree:
  `8477327c885319dc9146a9d6a73e370f2a74e708`
  (PR #142 W4 activation squash merge).
- W3 final remediation product/runtime baseline:
  `master@e3d7f4c36ff70f0d6def95e739ae11508508a4d1`; tree:
  `ae017ec23241c69f7b33cb1022da5f3a690a1e2a`
  (PR #140 W3-R1 production remediation squash merge).
- W3-R1 final reviewed production head:
  `32d59594d00a0dc04c9d622250604731ab3b7ef4`; tree:
  `ae017ec23241c69f7b33cb1022da5f3a690a1e2a`.
- W3-R1 exact-tree-equivalent hosted CI `32757439487`: `success`;
  source and merge-integration trees are identical (`tree_equivalent=true`).
- W3-R1 independent exact-head review: acceptance blockers = 0; final Codex review on PR #140 found no major issues.
- W3-R1 activation merge:
  `master@5f66e78f021af5d0c3a90d6c87b895c767e7527c`; tree:
  `78b49b3e9d822730cef6fbc37492b4bf69f43bf9`
  (PR #138 squash merge).
- W3-R1 architecture checkpoint issue #139: **RESOLVED / CLOSED**.
- Final pre-remediation W3 product/runtime baseline:
  `master@a825f5414af274ee02712b53b60d72fe59306fea`; tree:
  `79f1ca9a9ff97b695b1fca38090d007a1723559e`
  (PR #136 W3-10 squash merge).
- W3-11 governance closeout merge:
  `master@f4b2178f688bdf054c84a9066212d941e60b54a2`; tree:
  `842afd45e64c99b061246cb08dde6ebbdaffa85b`
  (PR #137 squash merge; its original conclusion was reopened and later resolved by W3-R1).
- W3-10 final reviewed head:
  `601f689741fc0084a50853ba26b856e251421c5b`; tree:
  `79f1ca9a9ff97b695b1fca38090d007a1723559e`.
- W3-10 exact-head hosted CI `32706899339`: `success`.
- W3-10 reviewer pass `#5007633103`: acceptance blockers = 0 at that review point.
- W3-10 merge-integration checkout:
  `219eb38fea6693bcf7826e48241492e5f7c961f2`; tree:
  `79f1ca9a9ff97b695b1fca38090d007a1723559e`; `tree_equivalent=true`.
- Post-W3-11 Codex review `#5009168468` / inline blocker `#3844601370` reopened the frozen close/dispose → rename/move/delete/open evidence criterion because permanent-delete evidence remained `UNVERIFIED`; W3-R1 now resolves that blocker.
- W3-08 final reviewed head:
  `50920b46bd118ed6f25219fb66cbe687cc9ba280`; tree:
  `5ec7dd1e694b03f7752b7fa8e1a80743cd680bab`.
- W3-08 merge-integration checkout:
  `219b167478812bfa3a2396dc7c9369e7d4b8fe24`; tree:
  `5ec7dd1e694b03f7752b7fa8e1a80743cd680bab`.
- W3-08 exact-head CI `32659742797`: `success`.
- ADR-0004 evidence: source/integration trees are identical (`tree_equivalent=true`).
- W3-07 product/runtime baseline:
  `master@ced5478abfa7ac42fa9295ad5ec7b87c5e7dbee3`
  (PR #131 W3-07 squash merge).
- W3-07 final reviewed head:
  `cf8a9edce9a07f518f443f09835047c93040030e`.
- W3-07 exact-head CI `32652108996`: `success`.
- W3-06 product/runtime baseline remains:
  `master@ebd14c4cacf9129c511e055b1b28c28f0841699e`
  (PR #129 W3-06 squash merge).
- W3-05 product/runtime baseline remains:
  `master@dde7ecb29e30a0b660fd8123b9203f5f97944a20`
  (PR #127 W3-05 squash merge).
- W3-04 product/runtime baseline remains:
  `master@48e8291f8d1f0367a24eca6329640641468b78ce`
  (PR #125 W3-04 squash merge).
- W3-03 product/runtime baseline remains:
  `master@ee841f230277ecb9c6e9d731ef90f66a34814510`
  (PR #123 W3-03 squash merge).
- W3-02 product/runtime baseline remains:
  `master@fe4cb4a7d16976f5dcc9a9dbbc4b2b47937a850e`
  (PR #121 W3-02 squash merge).
- W3-01 product/runtime baseline remains:
  `master@fb48696795e19aa5fabac5966d31665a6b95e81e`
  (PR #119 W3-01 squash merge).
- W3 activation baseline:
  `master@e54c788db637e6c6140cf618dd3d7125ea1df8e3`
  (PR #118 W3-00 squash merge).
- File Library 2.0 W2 product/runtime baseline remains:
  `master@1898c290859be204e1778b4b72fc58d22dc08b71`
  (PR #116 W2-11 squash merge).
- W2-12 governance closeout remains:
  `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`
  (PR #117 W2-12 squash merge).
- Package version: `0.1.40`.
- Database schema: `34`.
- Published GitHub release: none.
- Published Git tag: none.

Combined W3-07/W3-08 catch-up closeout evidence:
[`tasks/W3-07-W3-08-CURRENT-TRUTH-CLOSEOUT-RESULT.md`](tasks/W3-07-W3-08-CURRENT-TRUTH-CLOSEOUT-RESULT.md).

## Current initiative

**W4 — Native Integration**

Status: **ACTIVE — implementation — W4-01 complete; W4-02 complete; W4-03 v1 stopped; W4-03 v2 complete; W4-04 authorized next**

Authority record:
[`initiatives/W4-native-integration.md`](initiatives/W4-native-integration.md).

Architecture decisions:

- [`DECISIONS/0005-native-preview-host-boundary.md`](DECISIONS/0005-native-preview-host-boundary.md)
- [`DECISIONS/0006-windows-preview-handler-bounded-capture.md`](DECISIONS/0006-windows-preview-handler-bounded-capture.md)

Implementation plan:
[`specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md`](specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md).

Architecture / experience freeze:
[`specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md`](specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md).

W4-00 activation taskbook:
[`tasks/W4-00-NATIVE-INTEGRATION-ACTIVATION-CODEX.md`](tasks/W4-00-NATIVE-INTEGRATION-ACTIVATION-CODEX.md).

W4-01 current-truth closeout:
[`tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CURRENT-TRUTH.md`](tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CURRENT-TRUTH.md).

W4-02 current-truth closeout:
[`tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md`](tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md).

W4-03 v1 architecture-stop evidence:
[`tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`](tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md).

W4-03 v2 current-truth closeout:
[`tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md`](tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md).

W4-00 merged through PR #142. W4-01 merged through PR #143 at `master@02e88db7cf4287e0d68792b3960da503b70d6c56` and is **COMPLETE / CLOSED**. W4-02 merged through PR #145 at `master@8ea647e13882f8cb0e08b77a2953fb06765d1729`; tree `f2ab398bf87d162fa1c6ca07f1784ceca259bdda`, and is **COMPLETE / CLOSED** after independent exact-head review `#5030646522` recorded blockers = 0 and final PR-tree CI `32962219486` completed success. W4-03 v1 PR #146 reached Stop Condition #5 and is **STOPPED / CLOSED WITHOUT MERGE**. ADR-0006 remains the accepted Windows capture-before-defer amendment, with PR #148 identities retained as governance provenance. W4-03 v2 Bounded-Capture Spike merged through PR #151 at `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; tree `f357be042c493d0cefd98be8e02d768210ac1f6b`, and is **COMPLETE / CLOSED** after independent reviews closed blockers = 0, real Explorer/prevhost acceptance passed and exact-head CI `33008914117` completed success. W4-04 Windows Explorer Preview Handler Production Integration is **AUTHORIZED / NEXT**. W4-05+ remain downstream-gated. W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE**.

## W3 closeout context

**W3 — Preview Platform**

Status: **COMPLETE / CLOSED**

Authority record:
[`initiatives/W3-preview-platform.md`](initiatives/W3-preview-platform.md).

W3-R1 remediation taskbook:
[`tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md`](tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md).

Durable implementation plan:
[`specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`](specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md).

Experience freeze:
[`specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`](specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md).

Activation gate:
[`tasks/W3-00-PREVIEW-PLATFORM-ACTIVATION-CODEX.md`](tasks/W3-00-PREVIEW-PLATFORM-ACTIVATION-CODEX.md).

W3-00 merged through PR #118 at
`master@e54c788db637e6c6140cf618dd3d7125ea1df8e3`.
W3-01 merged through PR #119 at
`master@fb48696795e19aa5fabac5966d31665a6b95e81e`.
W3-02 merged through PR #121 at
`master@fe4cb4a7d16976f5dcc9a9dbbc4b2b47937a850e`.
W3-03 merged through PR #123 at
`master@ee841f230277ecb9c6e9d731ef90f66a34814510`.
W3-04 merged through PR #125 at
`master@48e8291f8d1f0367a24eca6329640641468b78ce`.
W3-05 merged through PR #127 at
`master@dde7ecb29e30a0b660fd8123b9203f5f97944a20`.
W3-06 merged through PR #129 at
`master@ebd14c4cacf9129c511e055b1b28c28f0841699e`.
W3-07 merged through PR #131 at
`master@ced5478abfa7ac42fa9295ad5ec7b87c5e7dbee3`.
W3-08 merged through PR #132 at
`master@7078706992d129e47ba49b65ff3fec5eff0f40ec`.
W3-09 merged through PR #134 at
`master@31d4bc4bcdb1ad495a1db13e7630213d4ec5d6a0`.
W3-10 merged through PR #136 at
`master@a825f5414af274ee02712b53b60d72fe59306fea`.
W3-11 docs/governance closeout merged through PR #137, but its COMPLETE/CLOSED conclusion was invalidated by the post-merge blocker `#3844601370`.
W3-R1 activation merged through PR #138 at
`master@5f66e78f021af5d0c3a90d6c87b895c767e7527c`.
Issue #139 recorded the narrow macOS permanent-delete pre-journal correctness defect and is closed completed.
W3-R1 production remediation merged through PR #140 at
`master@e3d7f4c36ff70f0d6def95e739ae11508508a4d1`; tree `ae017ec23241c69f7b33cb1022da5f3a690a1e2a`.
W3-R1 final governance closeout merged through PR #141 at
`master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`; tree `50efecd2579b5d786ae059b0561b36bca79935e6`.

CI `32757439487` proved the repaired close→mutate gate on supported hosted lanes. Apple-Silicon macOS recorded aggregate `HARD PASS`, permanent delete attempted/available/`HARD PASS`, source absence, subsequent fresh Preview open, Folder mutation `HARD PASS`, rename=3 and move=3. Windows recorded aggregate `HARD PASS`, rename=3 and move=3 while permanent delete was correctly `NOT APPLICABLE` because `permanent_delete_available=false`; Windows Folder directory mutation remains platform-limited where the existing file-only seam does not permit it. No second mutation authority or fs-safety/identity/source-claim/quarantine/recovery weakening was introduced.

The post-PR #137 blocker is resolved. At W3 closeout, W4 was deliberately left **NOT AUTHORIZED / NOT ACTIVE**; W4-00 then provided the separate reviewed activation. W5 Release remains future scope.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.

## Wave status

### W0 — File Library / Preview specification

**COMPLETE.** W0 froze the Library/Browse product model, authority boundaries, Entry/Location/Browse identity, Preview Core/Host boundary, Read/Materialization, Thumbnail/WorkScheduler ownership, performance contracts and Wave sequencing.

### W1 — File Library / Preview Foundation

**COMPLETE.** W1 delivered the runtime foundation used by W2 and now consumed by W3, including shared contracts, WorkspaceSession, Browse Core, Location Core, WorkScheduler, Preview Contract Core, Materialization/Read Gate, Thumbnail Infrastructure, change/refresh and scale/performance validation.

### W2 — File Library 2.0 Experience

**COMPLETE through W2-12 closeout PR #117.**

W2 product/runtime code remains closed at
`master@1898c290859be204e1778b4b72fc58d22dc08b71`; W2-12 governance closeout is
`master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`.

Final W2 sequence:

```text
W2-01  Workspace Shell + Experience Controller                ✅
R0     Consumer-boundary architecture/governance remediation  ✅
R1     CI Evidence / Governance Hardening                      ✅
R2     Browse Identity + Thumbnail Consumability               ✅
CI-O   CI Latency / Redundancy Remediation                     ✅
R3     Location Consumability                                  ✅
R4     W1→W2 Final Consumability Verification                  ✅
W2-02  Shared Presentation Entry / Collection Contracts       ✅
W2-03  Library Mode Adapter / Migration                        ✅
W2-04  Browse Mode Navigation + Content                        ✅
W2-05  Interaction Convergence + Virtualized List              ✅
W2-06  Virtualized Grid + Thumbnail Integration                ✅
W2-07  Context Panel / Inspector                               ✅
W2-08  Search / Filter / Sort                                  ✅
W2-09  Platform Navigation + Managed/Unmanaged UX              ✅
W2-10  Interaction / Accessibility / Responsive Integration    ✅
W2-11  Experience Performance / Cross-platform QA              ✅
W2-12  File Library 2.0 Experience Closeout                    ✅ PR #117
```

W2 release-gate result:
[`tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md`](tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md).

### W3 — Preview Platform

**COMPLETE / CLOSED after W3-R1.**

W3 turns the already-merged W1 Preview Core and completed W2 workspace into the user-facing Zen Quick Preview platform. W3 is an in-app Preview Platform Wave; Finder/Explorer system-host integration remains W4.

W3 final accepted evidence remains the W3-R1 closeout recorded above and in the W3 initiative/implementation-plan documents. W4 does not rewrite W3 history.

### W4 — Native Integration

**ACTIVE — implementation — W4-01 complete; W4-02 complete; W4-03 v1 stopped; W4-03 v2 complete; W4-04 authorized next.**

W4 owns native host integration on top of the closed W3 Preview Platform. The accepted macOS scope is the Zen-internal native Quick Look-backed strong-native path merged by W4-02; a broad Finder Quick Look Preview Extension remains conditional and not activated. Initial Windows system scope remains Explorer Preview Handler; `WindowsQuickPreview` remains reserved/inactive until separately justified.

Current W4 production/current-truth baseline is `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67` / tree `f357be042c493d0cefd98be8e02d768210ac1f6b` from PR #151. The current tree preserves ADR-0006 and the W4-03 v1 Stop Condition #5 governance; PR #148's `db192a541e9bdabcf581f9dce57be8efff39c8e2` / tree `e87569d48716e791bd35b5f4013940e708cb1853` remain amendment provenance rather than current master.

W4-02 is **COMPLETE / CLOSED** through PR #145. W4-03 v1 PR #146 is **STOPPED / CLOSED WITHOUT MERGE**. W4-03 v2 is **COMPLETE / CLOSED** through PR #151; final head `19e51d5e2eed175a0eda18a02b47d82c97cc289b`, exact-head CI `33008914117` success, independent blockers = 0 and real Explorer/prevhost evidence PASS. W4-04 is **AUTHORIZED / NEXT**.

W4 dependency graph:

```text
W4-00  Activation + Native Architecture / Experience Freeze        ✅ PR #142
  ↓
W4-01  Shared Native Host Bridge + HostProvided Source Contract    ✅ PR #143
  ↓
 ┌──────────────────────────────────┬────────────────────────────────────┐
 ↓                                  ↓
W4-02 macOS Native Quick Look     W4-03 v1 Windows Preview Handler
      Host / Strong-native              request-long IStream spike
      Format Integration                STOPPED — PR #146 closed/no merge
      ✅ COMPLETE / PR #145                    ↓
                                     ADR-0006 ✅ PR #148 provenance
                                                ↓
                                     W4-03 v2 Bounded-Capture Spike
                                           ✅ COMPLETE / PR #151
                                                ↓
                                     W4-04 Windows Explorer Handler
                                           AUTHORIZED / NEXT
 └───────────────────┬───────────────────────────────────────────────────┘
                     ↓
W4-05  Signing / Packaging / Registration Integration
  ↓
W4-06  Native Accessibility / DPI / Performance / Resource QA
  ↓
W4-07  W4 Closeout
```

W4-02 closeout evidence:
[`tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md`](tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md).

W4-03 v2 closeout evidence:
[`tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md`](tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md).

### W5 — Release

**NOT STARTED / NOT AUTHORIZED / NOT ACTIVE.** Signing/notarization publication, update-channel readiness and release-wide hardening remain future scope. W4 may perform native packaging/signing work needed to prove its integration is installable; final release publication remains W5.

## Residual evidence ledger

These items remain explicit after W2/W3 and throughout W4 unless separately verified; none is silently converted to PASS.

### `DEFERRED` — Recent

`RECENT_AUTHORITY_MISSING` remains the reviewed product decision. No source-owned recent-activity authority exists, so Zen does not redefine Recent as modified-time/created-time ordering or add persistence merely to satisfy a label.

### `UNVERIFIED` — native manual accessibility / display QA

No genuine complete native VoiceOver/Narrator, Retina/Windows DPI, native trackpad/pointer or full platform-keyboard manual QA has yet closed the W4-06 integration gate. W4-02 and W4-03 contain genuine platform-native lifecycle evidence for their accepted hosts, but hosted evidence is not reclassified as complete native-manual accessibility/display QA.

### `UNVERIFIED` — real provider/filesystem fixtures

Real iCloud/File Provider, external APFS/exFAT, SMB/network and other unavailable provider/platform fixtures remain unverified where no genuine fixture existed.

### `RESOLVED / HARD PASS where capability applies` — close→mutate evidence

W3-R1 closed the permanent-delete evidence gap. Apple-Silicon macOS proves close/dispose → permanent delete through existing mutation authority as a real hard assertion, including source absence and subsequent fresh Preview open. Windows permanent delete remains explicitly `NOT APPLICABLE` under current runtime capability (`permanent_delete_available=false`).

### `UNVERIFIED / platform-limited` — Windows Folder directory mutation

The existing Windows `file_ops` source-validation seam is file-only, while the W3 Folder criterion applies directory mutation/open where the platform fixture permits. W3-R1 did not broaden mutation authority merely to manufacture a PASS; resource release remains proven and macOS Folder mutation remains accepted HARD evidence.

### `OBSERVED / UNVERIFIED` — queue attribution

W2-11 measured workload and overall run timing, but GitHub did not expose an authoritative queue-versus-runner-startup split.

### Historical CI-O target

CI-O historically closed with its separate `<=14 min` Full target not yet met. Later W2-11 Full Validation measured `786 s` / `13m06s`; that later observation does not rewrite the historical CI-O closeout record.

### Inherited W1 observations

W1 scheduler-interference `TARGET MISSED` observations and native provider fixture gaps remain part of the program evidence record.

## Technical debt

`TD-015` remains **open**. Later W3/W4 work does not silently close its broader File Library compatibility deletion exit condition.

No unrelated technical-debt item is closed because W4-01, W4-02 or W4-03 completes.

## Governance rule

W4 — Native Integration is the sole active initiative. W4-00, W4-01, W4-02 and W4-03 v2 are COMPLETE. W4-02 is closed through PR #145. W4-03 v1 is STOPPED / CLOSED WITHOUT MERGE after Stop Condition #5; ADR-0006 remains accepted. W4-03 v2 is closed through PR #151 at `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67` / tree `f357be042c493d0cefd98be8e02d768210ac1f6b`, with final exact-head CI `33008914117`, independent blockers = 0 and real Explorer/prevhost acceptance PASS. W4-04 Windows Explorer Preview Handler Production Integration is the only authorized next Windows Track and must preserve the accepted capture-before-defer architecture. W4-05+ remain downstream-gated by the existing dependency graph. W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE** and requires a separate post-W4 activation.