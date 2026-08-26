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

W3-01 closed the Preview Core consumer-readiness seams that intentionally remained after W1/W2:

- production Preview uses one reviewed Provider Registry composition owner;
- Zen Floating/Pinned host capability matrices and backend source capability projection are explicit and source-truthful;
- Rust and TypeScript share an exhaustive strict ten-family representation and warning wire;
- Preview-specific asset transport is bounded, opaque, process-local, request/sourceVersion-bound and lifecycle-revocable;
- progressive publication is bounded, monotonic and guarded by PreviewSession request/sourceVersion publication authority;
- cancel/dispose/Browse teardown revoke lifecycle authority before asset cleanup;
- successful source switch cleans only the superseded request/sourceVersion tuple, failed switch preserves the old authority, and asset publication re-validates authority under the registry mutex before mutation.

W3-02 then activated that backend lifecycle as the first real user-facing Zen Floating Quick Preview host:

- one renderer-owned `PreviewExperienceController` coordinates disposable floating-host state without replacing PreviewSession, WorkspaceSession, Library or Browse authority;
- Space/Esc behavior is integrated with existing command/focus ownership, including true no-op when no source-owned logical focus exists and repeat/IME/input/Alt+Space guards;
- Library managed and Browse ephemeral entries map to opaque Preview sources without renderer-authoritative raw paths;
- the floating shell is shell-first, remains mounted across source switches and truthfully renders Metadata fallback while rich providers remain deferred;
- `FileWorkspaceController` guards Preview publication by request/source tuple and serializes `previewSwitchSource` mutations per `previewId` with a single latest-wins pending slot;
- rapid A→B→C/D changes converge frontend state, controller cache and backend Preview session on the newest source without stale overwrite or spurious dispose;
- close/cancel/dispose and focus restoration remain deterministic.

W3-03 extended that same Preview experience into the existing W2 Context Panel as Pinned Preview and added bounded sibling navigation:

- Floating→Pinned uses one bounded typed staging operation with a truthful `zen_pinned` backend Preview session before Context commit;
- rejected/stale staging is disposed while the current Floating session remains authoritative, and successful handoff leaves one visible/current Preview host;
- Pinned no-source clears stale content and source recovery creates `zen_pinned`, not `zen_floating`;
- Library/Browse source-owned focus remains authoritative and Pinned follows that source rather than keeping hidden selection state;
- sibling navigation is only a bounded projection of the current collection and never becomes a second Query/Browse engine or expands compact `all_matching`;
- Browse active-query navigation reuses the existing owner enumeration and bounded `QUERY_SCAN_PAGE_BATCH = 8` scan to cross empty intermediary pages with generation/session/enumeration fail-closed guards;
- deterministic deferred A→B→C/D coverage proves Pinned UI/snapshot, `FileWorkspaceController` cache and backend record converge on the newest source while preserving truthful `zen_pinned` host identity;
- no Rust/Tauri command, schema, rich provider, raw-path authority, implicit hydration or W4 system-host scope was pulled forward.

W3-04 activated the first production rich-provider slice while preserving those same authorities:

- one production registry owner now composes `builtin.markdown`, `builtin.source-code` and `builtin.text` deterministically;
- all provider byte access remains behind `MaterializationReadGate`; the backend-only Preview adapter issues short-lived request/sourceVersion-bound Preview leases and `read_bounded_with_mapping` preserves one authoritative second resolve/open/identity/cancel path;
- provider reads are bounded to a 512 KiB prefix and use `Complete`/`Partial` truthfully; malformed UTF-8 and obvious binary input fail provider-locally instead of fabricating text;
- Text/Code is read-only and carries only a bounded language presentation hint; no execution/tool/language-server path was added;
- Markdown uses `pulldown-cmark` + `ammonia` and publishes sanitized `safe_html` with executable/resource-bearing tags, event handlers, remote/file/relative resources and implicit navigation removed;
- Floating and Pinned consume the same typed representation path;
- provider-local failures preserve Metadata fallback while MaterializationRequired/Downloading, PermissionDenied, IdentityChanged and SourceUnavailable/AvailabilityUnknown stay terminal across both lease issue and post-lease read revalidation; MetadataOnly falls back non-terminally;
- deterministic post-lease barrier tests prove terminal truth, stale publication rejection and lease cleanup after actual lease issue, while browser tests prove hostile Markdown causes no external resource load/navigation.

W3-05 extended the same provider/read/host architecture to structured and table representations:

- the single production registry adds bounded JSON, YAML, XML, CSV and TSV providers with deterministic priorities ahead of generic Text for their exact hints;
- the existing outer `structured_tree` / `table` wire now carries strict versioned `StructuredTreePayloadV1` / `TablePayloadV1` JSON payloads generated by Rust and validated by one shared frontend decoder before rendering;
- all structured/table byte reads remain behind the W3-04 Preview adapter and `MaterializationReadGate`, capped to a 512 KiB source prefix and preserving fresh terminal truth before and after lease issue;
- structured limits are depth 64, 10,000 nodes, 1 KiB keys/XML names, 16 KiB scalar/text, 128 XML attributes and 1 MiB encoded payload; table limits are 500 rows, 64 columns, 16 KiB cells and 1 MiB encoded payload;
- JSON uses bounded visitor construction; YAML uses iterative `yaml-rust2::Parser::next_token()` event consumption with inert non-expanded aliases; XML uses in-memory event parsing with `DOCTYPE`/unknown entities rejected and no external resolver;
- CSV/TSV reuse the Rust CSV parser while formula-looking cell values remain inert strings with no macro/spreadsheet execution semantics;
- incomplete structured input never fabricates source nodes: truthfully parsed prefixes may be Partial, otherwise provider-local failure returns to Metadata fallback;
- deterministic W3-05 tests run through the real PreviewReadGateAdapter/MaterializationReadGate seam and prove actual issued leases return to baseline after success, parser failure, stale switch, cancel and post-lease terminal drift with no stale representation publication;
- Floating and Pinned consume the same escaped/inert structured/table renderer, and the exact-head browser gate passed required large/compact Library/Browse scenarios with no external/resource navigation or page-level overflow.

W3-06 extended the same architecture to bounded raster Image Preview:

- the single production registry adds `builtin.image` for PNG and JPEG/JPG without replacing provider selection or creating a second image/read authority;
- source input is bounded to 12 MiB total and consumed through <=1 MiB `PreviewReadGateAdapter → MaterializationReadGate` reads, with a fresh request/sourceVersion-bound lease, authoritative resolve/revalidation/read and release for every chunk;
- decode admission uses exactly one decoder slot from the existing runtime `WorkScheduler`, with deterministic release on success/failure/cancel/stale paths and no provider-local queue/semaphore/worker pool;
- source dimensions/pixels and normalized output are bounded before/through decode at 8192 px per source edge, 24,000,000 source pixels, 4096 px output edge, 12,000,000 output pixels, 12 MiB image asset and one full image asset/request;
- malformed/truncated/mismatched and oversized/decompression-bomb headers fail provider-locally without unsafe allocation, while `Complete` is reserved for fully consumed non-reduced sources and bounded reductions remain `Partial`;
- final raster bytes publish only through the existing request/sourceVersion-bound opaque Preview asset registry, and the renderer retrieves the exact tuple, validates media type and uses renderer-local Blob/object URLs with deterministic revocation;
- rapid source switching prevents stale Image A from publishing/rendering after B, while read leases, decoder capacity, Preview assets and object URLs return to lifecycle baseline;
- exact-head local real-browser evidence passed required Library/Browse Floating/Pinned image/fallback/Partial/latest-wins/no-source/compact scenarios at 1600×900 and 980×680 without unexpected external requests.

W3-07 extended the shared host/core into bounded progressive Folder Preview:

- `builtin.folder` uses a backend-only adapter over the existing `BrowseService`; no provider-owned `read_dir`, raw path or second directory/query engine exists;
- one temporary Preview-owned Browse session per request isolates Preview enumeration from the user's visible Browse session/request/enumeration/cursor/history state;
- direct-child aggregation is bounded at 100,000 inspected entries and fixed-size sample/extension/largest/project-hint state rather than materializing the folder;
- existing Preview progressive publication remains request/sourceVersion authority, while a bounded single-in-flight frontend snapshot observer makes first-page/later Partial updates user-visible before final `previewStart()` resolution;
- normal in-progress Partial, exact EOF Complete, entry-limit Partial and deadline Partial are represented truthfully and stale A cannot replace B;
- deadline guard returns useful Partial before the outer timeout and temporary Browse/page/scheduler resources return to baseline on success/cancel/stale/dispose.

W3-08 extended the same platform to bounded ZIP metadata Preview:

- `builtin.archive-zip` uses a bounded `Read + Seek` adapter over `PreviewReadGateAdapter → MaterializationReadGate`; there is no raw path, `File::open`, `ZipArchive<File>` or renderer byte API;
- every read stays <=1 MiB and total charged ZIP source reads stay <=12 MiB, including repeated seek patterns;
- ZIP Preview never extracts or decompresses entry payloads and never recursively opens nested archives;
- central-directory, entry, tree, depth, name, metadata and encoded representation limits are validated before unbounded allocation/tree growth;
- archive names remain inert virtual-tree presentation data; nested directory names remain valid while traversal/absolute/drive/UNC/dot/control/normalization-sensitive names fail closed;
- existing WorkScheduler CPU/I/O admission and real MaterializationReadGate lifecycle tests prove terminal truth and resource baseline restoration;
- the 100 ms return guard preserves deadline headroom, but pre-validation timeout remains provider-local Metadata fallback; only validated ZIP structure can become truthful `ArchiveTree Partial / deadline`;
- post-W3-07 integration preserved Folder progressive observation, FolderSummary, latest-wins and all existing shared Preview authorities.

These contracts enable W3-09 integration; they do not create replacement filesystem, read, query, scheduler or mutation authorities.

W3 dependency graph:

```text
W3-00  Activation + Architecture/Experience Freeze             ✅ PR #118
  ↓
W3-01  Preview Core Consumer-Readiness                          ✅ PR #119
  ↓
W3-02  Zen Floating Quick Preview Host                          ✅ PR #121
  ↓
 ┌───────────────────────────┬───────────────────────────┬───────────────────────────┐
 ↓                           ↓                           ↓                           ↓
W3-03 Pinned Preview +       W3-04 Text/Code +           W3-05 Structured +          W3-06 Image
      sibling navigation           Markdown                    Table providers             provider
      ✅ PR #123                   ✅ PR #125                   ✅ PR #127                   ✅ PR #129
 └───────────────┬───────────┴───────────────┬───────────┴───────────────┬───────────┘
                                   ↓
                         ┌─────────┴─────────┐
                         ↓                   ↓
                    W3-07 Folder        W3-08 ZIP
                    Preview provider     Archive provider
                    ✅ PR #131           ✅ PR #132
                         └─────────┬─────────┘
                                   ↓
W3-09  Failure / Materialization / Security / Accessibility Integration   ✅ PR #134
  ↓
W3-10  Preview Performance + Cross-platform QA                         ✅ PR #136
  ↓
W3-11  W3 Closeout                                                    ✅ PR #137 (conclusion reopened)
  ↓
W3-R1  Close → Mutate Evidence Remediation                            ✅ PR #140
```

### W4 — Native Integration

**ACTIVE — implementation — W4-01 complete; W4-02 complete; W4-03 v1 stopped; W4-03 v2 complete; W4-04 authorized next.**

W4 owns native host integration on top of the closed W3 Preview Platform. The accepted macOS scope is the Zen-internal native Quick Look-backed strong-native path merged by W4-02; a broad Finder Quick Look Preview Extension remains conditional and not activated. Initial Windows system scope remains Explorer Preview Handler; `WindowsQuickPreview` remains reserved/inactive until separately justified.

Current W4 production/current-truth baseline is `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67` / tree `f357be042c493d0cefd98be8e02d768210ac1f6b` from PR #151. The current tree also preserves ADR-0006 and the W4-03 v1 Stop Condition #5 governance; PR #148's `db192a541e9bdabcf581f9dce57be8efff39c8e2` / tree `e87569d48716e791bd35b5f4013940e708cb1853` remain their provenance identities rather than the current master head.

W4-02 is **COMPLETE / CLOSED**. Its accepted final PR head is `809a2002067c315784b48a524a815be328d7c953`, independent review `#5030646522` records blockers = 0, final exact-head PR-tree CI `32962219486` is successful, and the production squash merge is `8ea647e13882f8cb0e08b77a2953fb06765d1729` / tree `f2ab398bf87d162fa1c6ca07f1784ceca259bdda`.

W4-03 v1 PR #146 is **STOPPED / CLOSED WITHOUT MERGE**. ADR-0006 replaces the rejected request-long shell-`IStream` lifetime model with bounded capture-before-defer. W4-03 v2 is **COMPLETE / CLOSED** through PR #151; final reviewed head `19e51d5e2eed175a0eda18a02b47d82c97cc289b`, exact-head CI `33008914117` success, real Explorer/prevhost acceptance PASS and final independent blockers = 0. W4-04 is **AUTHORIZED / NEXT** and must productize the accepted architecture rather than reopen it.

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

## W3 architecture invariants

- W1/W3 Preview Core remains Preview lifecycle/provider/publication authority.
- Query V2 / `LibrarySelectionV1` remain managed Library authority.
- BrowseService remains ephemeral Browse identity/lifetime authority.
- WorkspaceSession remains File Library navigation/presentation context owner.
- MaterializationReadGate / existing platform content-open boundary remains byte-read authority.
- WorkScheduler remains global expensive-work admission authority.
- Preview is read-only and gains no file mutation/recovery authority.
- providers produce typed representations; hosts render them.
- no renderer-authoritative raw filesystem path or general byte-read lease is introduced.
- no implicit materialization/cloud hydration.
- no third-party Preview plugin/DLL/dylib loading in v1.
- W3 does not pull W4 system integration forward.
- existing W2/Query V2 performance thresholds are not weakened.

## W3-01 completion record

W3-01 is **COMPLETE** and merged through PR #119 as
`master@fb48696795e19aa5fabac5966d31665a6b95e81e`.

Taskbook:
[`tasks/W3-01-PREVIEW-CORE-CONSUMER-READINESS-CODEX.md`](tasks/W3-01-PREVIEW-CORE-CONSUMER-READINESS-CODEX.md).

Accepted final evidence:

1. final reviewed head `09be79b9415d55a7e0ef5271f465b557c1ee6d57`;
2. final reviewed tree `6add03115a69fe226b5c040ee8bb23d66e373704`;
3. exact-head CI `32564728867` success;
4. one production Provider Registry composition owner;
5. truthful Zen Floating/Pinned host and backend source capability policy;
6. exhaustive strict Rust/TypeScript representation/warning wire;
7. bounded Preview-specific asset transport with exact tuple validation;
8. bounded progressive publication with stale/out-of-order/cancel/dispose protection;
9. deterministic tests for lifecycle-before-cleanup, post-active-check TOCTOU, switch-vs-new-request cleanup and failed-switch preservation;
10. no rich provider, W3-02 UI, W4 native host, schema, raw-path authority or second read/materialization authority.

The earlier Windows Thumbnail lifecycle failure is retained as `OBSERVED` timing flake: reviewer rerun succeeded and the final W3-01 exact-head Windows CI did not reproduce it. No unrelated Thumbnail semantics were changed.

## W3-02 completion record

W3-02 is **COMPLETE** and merged through PR #121 as
`master@fe4cb4a7d16976f5dcc9a9dbbc4b2b47937a850e`.

Taskbook:
[`tasks/W3-02-ZEN-FLOATING-QUICK-PREVIEW-HOST-CODEX.md`](tasks/W3-02-ZEN-FLOATING-QUICK-PREVIEW-HOST-CODEX.md).

Accepted final evidence:

1. final reviewed head `3adc8ef015cf772933dc5d966289b330d40cc71c`;
2. final reviewed tree `37eb86d4993616024ca4101955304722a27e16a1`;
3. merge-integration checkout `aa9469b21ce9486a7f9cf2d819c948ec682d69fe` with the same tree;
4. exact-head hosted CI `32585239510` success;
5. `tree_equivalent=true`, `head_validation_required=false`, substantive lane `merge_integration`;
6. focused W3-02 tests `11/11`, full frontend test suite `121 files / 1272 tests`, remediation `14/14`, performance architecture `25/25`;
7. real-browser W3-02 gate passed at `1600×900` and `980×680`;
8. one floating Preview shell/controller owner with Library/Browse List/Grid parity and shell-first behavior;
9. no-focus/repeat Space correctness and deterministic close/focus restoration;
10. serialized latest-wins source switch transport with deterministic backend-truth, stale-start and no-spurious-dispose coverage;
11. no Rust/Tauri, rich-provider, pinned-preview, sibling-navigation, schema, raw-path or W4 expansion.

## W3-03 completion record

W3-03 is **COMPLETE** and merged through PR #123 as
`master@ee841f230277ecb9c6e9d731ef90f66a34814510`.

Taskbook:
[`tasks/W3-03-PINNED-PREVIEW-SIBLING-NAVIGATION-CODEX.md`](tasks/W3-03-PINNED-PREVIEW-SIBLING-NAVIGATION-CODEX.md).

Accepted final evidence:

1. final reviewed head `9bdc5f7c80d393bfefcf6ee7b5cdc89653c34fa6`;
2. final reviewed tree `f4325b7ab8ea099ab781ac48824f2ae3d7e92fb0`;
3. merge-integration checkout `7c36076ab2bacb4d07d9241d63ee9769f4172ee1` with the same tree;
4. exact-head hosted CI `32593460617` success;
5. `tree_equivalent=true`, `head_validation_required=false`, substantive lane `merge_integration`;
6. full frontend test suite `122 files / 1281 tests`, remediation `14/14`, performance architecture and frontend build passed;
7. real-browser W3-03 gate passed at `1600×900` and `980×680`, including Library/Browse List/Grid, Floating→Pinned, source-follow, bounded Previous/Next, active-query empty-page gap, no-source, Unpin, rapid latest-wins and compact single-Context ownership;
8. truthful `zen_pinned` backend host identity with bounded staged handoff, failure/stale cleanup and repeated-Pin boundedness;
9. Browse query sibling navigation reuses the owner enumeration and fails closed on generation/session/enumeration drift;
10. deterministic deferred Pinned A→B→C/D coverage proves PreviewExperience, controller cache and backend record converge on D with no stale overwrite or spurious lifecycle cleanup;
11. no Rust/Tauri, rich-provider, second Preview/Query/Browse authority, raw-path, `all_matching` materialization or W4 expansion.

Native macOS manual visual verification was not executed and remains `UNVERIFIED`; hosted macOS release compile is not native visual proof.

## W3-04 completion record

W3-04 is **COMPLETE** and merged through PR #125 as
`master@48e8291f8d1f0367a24eca6329640641468b78ce`.

Taskbook:
[`tasks/W3-04-TEXT-CODE-MARKDOWN-PROVIDERS-CODEX.md`](tasks/W3-04-TEXT-CODE-MARKDOWN-PROVIDERS-CODEX.md).

Accepted final evidence:

1. final reviewed head `bb0fa0ac9a46fb5a4c17ddfa1c634c20d2f3bce7`;
2. final reviewed tree `62049ff892d17ceb9c28255c97780f4613248b27`;
3. merge-integration checkout `ba2f743138b718710d22aaeab66396c26304d400` with the same tree;
4. exact-head hosted CI `32617793286` success;
5. source/integration trees are equal (`tree_equivalent=true`);
6. full frontend suite `123 files / 1284 tests`, remediation `14/14`, performance architecture `25/25`, frontend build, governance and both diff checks passed;
7. desktop-runtime Rust suite `805 passed / 15 ignored`, Rust fmt and Clippy `-D warnings` passed;
8. npm audit returned zero vulnerabilities; Rust audit exited successfully with the existing allowed advisory warnings retained;
9. provider registry contains deterministic Markdown/SourceCode/Text providers, with a shared 512 KiB bounded prefix and truthful `Complete`/`Partial` output;
10. the backend-only Preview read adapter and shared `read_bounded_with_mapping` keep `MaterializationReadGate` as one authority and preserve fresh terminal truth at both lease issue and post-lease authoritative revalidation;
11. deterministic barriers prove post-lease MaterializationRequired, MetadataOnly and AvailabilityUnknown semantics, source-switch stale rejection, provider-processing failure cleanup and active lease count returning to baseline;
12. Markdown `safe_html` is produced through `pulldown-cmark` + `ammonia`, and the real-browser gate at `1600×900` and `980×680` observed no hostile external/resource navigation or loading;
13. Floating/Pinned share the same typed representation renderer and no W3-05+, W4, raw-path, renderer lease, implicit hydration or second Preview/read/query authority was introduced.

## W3-05 completion record

W3-05 is **COMPLETE** and merged through PR #127 as
`master@dde7ecb29e30a0b660fd8123b9203f5f97944a20`.

Taskbook:
[`tasks/W3-05-STRUCTURED-TABLE-PROVIDERS-CODEX.md`](tasks/W3-05-STRUCTURED-TABLE-PROVIDERS-CODEX.md).

Accepted final evidence:

1. final reviewed head `3d94c5e1399230bff0aa8ffbae5b01bd8d775a2a`;
2. final reviewed tree `2c708e3ec83c6cd27efd91de89c41c9685a48735`;
3. merge-integration checkout `1da89e6cd942b9e415fe7c718441f73a433d4bee` with the same tree;
4. exact-head hosted CI `32624221341` success;
5. source/integration trees are equal (`tree_equivalent=true`);
6. frontend suite `123 files / 1288 tests`, remediation, performance architecture, frontend build, governance and diff checks passed;
7. Rust library suite `822 passed`; desktop-runtime validation, Rust fmt and Clippy `-D warnings` passed;
8. npm audit returned zero vulnerabilities; Rust audit exited successfully with the existing 15 allowed advisory warnings retained;
9. one production registry deterministically composes the five W3-05 providers with the existing Markdown/SourceCode/Text set, and strict versioned StructuredTree/Table payload schemas are decoded by one shared bounded frontend helper;
10. source/representation limits are enforced at parser-to-representation construction time, including 512 KiB source prefix, depth/node/string/XML-attribute/table-row/column/cell/1 MiB encoded ceilings with truthful Partial/fallback semantics;
11. YAML parsing is iterative through `next_token()`, alias expansion is not performed, hostile 900-level nesting remains bounded and node-budget exhaustion publishes Partial rather than false corruption;
12. XML rejects DTD/DOCTYPE and unknown entities and has no external resource resolver; hostile HTTP/file/relative/entity fixtures cannot trigger resource access;
13. CSV/TSV formula-looking cells remain inert strings, with bounded rows/columns/cells and no spreadsheet or macro execution semantics;
14. incomplete structured input never fabricates source nodes; unparseable incomplete prefixes fail provider-locally to Metadata fallback;
15. real W3-05 provider tests exercise `PreviewReadGateAdapter → MaterializationReadGate` after an actual lease issue and prove success, parser failure, stale switch, cancel and post-lease terminal drift all restore the lease baseline with no stale publication;
16. real-browser W3-05 gate passed at `1600×900` and `980×680` across Library/Browse, Floating/Pinned, Partial/fallback/latest-wins/no-source/compact ownership, with no unexpected external/resource navigation or horizontal overflow;
17. no W3-06+, W4 system host, raw-path renderer authority, generic byte-read API, implicit hydration, schema migration or second Preview/read/query/materialization authority was introduced.

Native macOS manual visual verification was not executed and remains `UNVERIFIED`; hosted native macOS CI/performance evidence is not reclassified as manual visual proof.

## W3-06 completion record

W3-06 is **COMPLETE** and merged through PR #129 as
`master@ebd14c4cacf9129c511e055b1b28c28f0841699e`.

Taskbook:
[`tasks/W3-06-IMAGE-PROVIDER-CODEX.md`](tasks/W3-06-IMAGE-PROVIDER-CODEX.md).

Accepted final evidence:

1. final reviewed head `d80f9d4d117bb6a2ab58c7b6349e9e026f19d201`;
2. final reviewed tree `e805364045eca968227031308a9d5a1fa6b131e4`;
3. merge-integration checkout `7cb7970e0a6864727fe6b2c2483323baabd4ebb1` with the same tree;
4. exact-head hosted CI `32630836668` success;
5. source/integration trees are equal (`tree_equivalent=true`);
6. reviewer pass #5002180141 recorded code blockers = 0;
7. frontend suite `125 files / 1291 tests`, W3-06 focused frontend tests `12 passed`, remediation `14 passed`, performance architecture `25 passed`, frontend build, governance and diff checks passed;
8. Rust desktop-runtime suite `833 passed / 15 ignored / 0 failed`, Rust fmt and Clippy `-D warnings` passed;
9. npm security audit passed; Rust audit exited successfully with the existing allowed dependency warnings retained;
10. one production `builtin.image` provider supports the reviewed PNG/JPEG scope without exposing raw filesystem paths or creating another representation/provider authority;
11. source reads are capped at 12 MiB total and <=1 MiB/chunk, with every chunk issuing and releasing a fresh request/sourceVersion-bound Preview lease through `PreviewReadGateAdapter → MaterializationReadGate` and revalidating authoritative source truth;
12. image decode uses one existing runtime WorkScheduler decoder slot, with capacity/accounting and release proven on success, failure, cancel and stale switch and no second queue/semaphore/worker pool;
13. source/decode/output limits are frozen at 8192 px per source edge, 24,000,000 source pixels, 4096 px output edge, 12,000,000 output pixels, 12 MiB published image asset and one full image asset/request;
14. corrupt/truncated/format-mismatch and oversized-header/decompression-bomb fixtures fail bounded before unsafe full decode, while source truncation/downscale is truthfully `Partial` and `Complete` requires a fully consumed non-reduced supported source;
15. image assets publish/retrieve only through the exact session/request/sourceVersion/assetToken tuple and stale/cancel/switch/dispose authority revokes obsolete publication/asset state;
16. the shared Floating/Pinned frontend path validates returned media type, uses safe display-name alt text and creates/revokes renderer-local object URLs without source-path, file URL, data URL or generic byte-read authority;
17. exact-head local real-browser W3-06 gate passed at `1600×900` and `980×680` across Library/Browse, Floating/Pinned, Partial/fallback/latest-wins/no-source/sibling-navigation/compact ownership with no unexpected external requests;
18. no W3-07+, W4 system host, implicit hydration, schema migration, raw-path renderer authority or second Preview/read/materialization/scheduler authority was introduced.

Native interactive macOS visual verification was not executed and remains `UNVERIFIED`; hosted macOS compile/Rust/performance/quality evidence is not reclassified as manual UI proof.

## W3-07 completion record

W3-07 is **COMPLETE** and merged through PR #131 as
`master@ced5478abfa7ac42fa9295ad5ec7b87c5e7dbee3`.

Taskbook:
[`tasks/W3-07-FOLDER-PREVIEW-CODEX.md`](tasks/W3-07-FOLDER-PREVIEW-CODEX.md).

Accepted final evidence:

1. final reviewed head `cf8a9edce9a07f518f443f09835047c93040030e`;
2. exact-head hosted CI `32652108996` success;
3. `builtin.folder` reuses Preview Core, the production registry, source-owned Library/Browse identities, existing BrowseService and WorkScheduler rather than creating a second directory/query/Preview authority;
4. one temporary Preview-owned Browse session per request isolates Folder enumeration from the visible Browse request/enumeration/cursor/history authority and page/session resources are deterministically released;
5. direct-child aggregation is bounded to 100,000 inspected entries with fixed-size sample/extension/largest/project-hint state and no recursive subtree scan/materialization;
6. existing Preview progressive publication remains backend authority while the bounded single-in-flight frontend snapshot observer makes first useful Partial updates visible before final start resolution;
7. ordinary in-progress Partial may carry no limit reason, authoritative EOF can become Complete, exact 100,000 + EOF is Complete and entry/deadline limits remain truthful Partial results;
8. source switch/cancel/dispose reject stale Folder publication and restore temporary Browse/page/scheduler resources;
9. exact-head local real-browser W3-07 coverage passed at 1600×900 and 980×680;
10. final narrow CI remediation only fixed deterministic W3-06 ReadGate test ordering and did not change Folder production behavior.

## W3-08 completion record

W3-08 is **COMPLETE** and merged through PR #132 as
`master@7078706992d129e47ba49b65ff3fec5eff0f40ec`.

Taskbook:
[`tasks/W3-08-ZIP-ARCHIVE-PREVIEW-CODEX.md`](tasks/W3-08-ZIP-ARCHIVE-PREVIEW-CODEX.md).

Accepted final evidence:

1. final reviewed head `50920b46bd118ed6f25219fb66cbe687cc9ba280`;
2. final reviewed tree `5ec7dd1e694b03f7752b7fa8e1a80743cd680bab`;
3. merge-integration checkout `219b167478812bfa3a2396dc7c9369e7d4b8fe24` with the same tree;
4. exact-head hosted CI `32659742797` success and source/integration trees are equivalent;
5. final reviewer pass `#5003079985` recorded code blockers = 0;
6. `builtin.archive-zip` priority 270 previews bounded ZIP central-directory metadata only and never extracts/decompresses entry payloads or recursively opens nested archives;
7. bounded `Read + Seek` is implemented over `PreviewReadGateAdapter → MaterializationReadGate`, with no raw path/File opener/renderer byte authority, <=1 MiB per underlying read and <=12 MiB charged reads/request;
8. reviewed entry/tree/depth/name/extra/comment/central-directory/encoded-tree ceilings prevent attacker-declared metadata from driving unbounded allocation or DOM/tree growth;
9. the existing WorkScheduler remains archive CPU/I/O admission authority, and real post-lease tests prove terminal truth plus ReadGate/scheduler baseline restoration on success, drift, cancel, switch and dispose;
10. safe nested directory names remain inert virtual-tree data while traversal/absolute/dot/drive/UNC/control/normalization-sensitive names fail closed and never become filesystem paths;
11. the 100 ms deadline guard returns pre-validation deadline as provider-local Timeout/Metadata fallback, and only structurally validated ZIP metadata may become truthful `ArchiveTree Partial / deadline`;
12. corrupt ZIP hints near deadline cannot fabricate ArchiveTree;
13. post-W3-07 integration preserved Folder progressive observation, FolderSummary, latest-wins and shared scheduler/read-gate authority;
14. exact-head local W3-07/W3-08 real-browser gates passed at 1600×900 and 980×680.

Native interactive macOS visual/accessibility verification for W3-07/W3-08 remains `UNVERIFIED`; hosted compile/Rust/performance/quality evidence is not reclassified as manual UI proof.

## W3-09 completion record

W3-09 is **COMPLETE** and merged through PR #134 as
`master@31d4bc4bcdb1ad495a1db13e7630213d4ec5d6a0`.

Taskbook:
[`tasks/W3-09-PREVIEW-INTEGRATION-HARDENING-CODEX.md`](tasks/W3-09-PREVIEW-INTEGRATION-HARDENING-CODEX.md).

Accepted final evidence:

1. final reviewed head `ff7ad51ebc4f02fd5871c8f76233a911a8d15f96`;
2. final reviewed tree `1955b9f1041f93f1fc0ef7004f54bfb5c290a353`;
3. exact-head hosted CI `32674567490` success;
4. reviewer pass `#5003742441` recorded code blockers = 0;
5. one shared Preview integration converges recoverable failures, terminal source/session conditions, Metadata fallback and terminal presentation without a second Preview/read/materialization authority;
6. the no-implicit-materialization rule remains truthful: `MaterializationRequired` is represented without fabricating a renderer download/hydration action;
7. hostile rich-provider inputs remain bounded, inert or sanitized, with no raw-path, unauthorized network/resource, script or archive extraction authority;
8. Space/Esc/IME, focus restoration, single-modal ownership, Floating/Pinned handoff and screen-reader status semantics are integrated across the merged provider families;
9. stale, cancel, switch, close and dispose paths preserve existing resource-baseline and latest-wins contracts, including Folder progressive observation and ZIP metadata-only bounds;
10. exact-head local real-browser W3-09 coverage passed at 1600×900 and 980×680.

Hosted compile/Rust/performance/quality evidence is not interactive native UI proof. Native VoiceOver/Narrator, Retina/DPI and manual native macOS verification remain `UNVERIFIED`.

## W3-09 preserved constraints

The completed W3-09 Track owned **Failure / Materialization / Security / Accessibility Integration** across every merged W3 host/provider family.

Binding constraints include:

- synchronize the accepted W3-09 Phase A preparation onto the post-W3-08 current-truth baseline before final production integration;
- preserve the existing recoverable-provider vs terminal-source/session taxonomy rather than inventing a second error authority;
- preserve the no-implicit-materialization rule: `MaterializationRequired` may be represented truthfully, but no renderer download/hydration action may be fabricated without an existing authoritative command;
- converge Markdown/XML/YAML/Table/Image/Folder/ZIP hostile-input/resource behavior and shared Floating/Pinned fallback/terminal UX;
- converge Space/Esc/IME/focus restoration/modal ownership and accessibility semantics across rich providers without creating provider-specific command/focus owners;
- keep Folder/ZIP source/resource lifecycles and all existing ReadGate/WorkScheduler/Browse isolation bounds intact;
- do not pull W3-10 final acceptance, W4 system hosts, durable schema, mutation/recovery ownership or a second Preview/read/query/scheduler/materialization authority forward.

## W3-10 completion record

W3-10 — Preview Performance / Cross-platform QA is **COMPLETE** and merged through PR #136 as
`master@a825f5414af274ee02712b53b60d72fe59306fea`; runtime tree
`79f1ca9a9ff97b695b1fca38090d007a1723559e`.

Accepted final evidence:

1. final reviewed head `601f689741fc0084a50853ba26b856e251421c5b`; tree `79f1ca9a9ff97b695b1fca38090d007a1723559e`;
2. independent reviewer PASS `#5007633103` with acceptance blockers = 0 at that review point;
3. exact-head hosted CI `32706899339` succeeded; source checkout and merge-integration trees were equivalent;
4. Preview Platform performance is integrated into the existing prepared-binary framework on hosted Windows and Apple-Silicon macOS, not a second benchmark authority;
5. the 20,001-entry ZIP fixture truthfully reports 20,000 inspected entries, bounded `Partial / entry_limit`, a 316-byte encoded tree, no extraction/decompression and preserved <=1 MiB/read plus <=12 MiB total-read bounds;
6. close → dispose → rename/move/fresh-open evidence was HARD PASS for six representative byte-provider fixtures on hosted Windows and macOS using the existing `crate::file_ops::execute_moves_with_persistence` authority, and macOS Folder rename was HARD PASS after temporary Folder resources settled. Permanent delete remained `UNVERIFIED` at W3-10, so the aggregate frozen close/dispose → rename/move/delete/open criterion was reopened by W3-R1; PR #140 now resolves that gap with applicable macOS delete HARD evidence and explicit Windows N/A capability classification;
7. 100-entry rapid switching, mixed-provider switching, deferred latest-wins correctness and repeated-cycle resource steady state are HARD PASS, with final source truth preserved and internal sessions/leases/assets/scheduler resources returning to baseline;
8. Folder 1k/10k/100k/>100k remains bounded/direct-child-only and ZIP large/hostile behavior remains metadata-only and bounded;
9. exact-head **local** W3-10 real-browser evidence runs its own 1600×900 and 980×680 matrix with 3 warmups/20 measured samples, actual DOM visibility, shell/useful p95 targets met, deterministic rapid-switch latest-wins, one host, object-URL cleanup, focus restoration, no overflow and no unexpected network/page/console errors; hosted frontend CI is not mislabeled as hosted W3 browser evidence;
10. W1/W2/Query structural/performance gates remain routed and preserved. Historical W1 `managed_scan_foreground_latency` TARGET-MISSED observations remain in the ledger and were not rewritten or used to weaken structural gates.

Native VoiceOver/Narrator/manual interactive macOS UI remain `UNVERIFIED`. Real iCloud/File Provider, external APFS/exFAT, SMB/network fixtures remain `UNVERIFIED` where no genuine fixture existed.

## W3-11 closeout / W3-R1 resolution

W3-11 is the docs/governance closeout merged in PR #137. It changed no production/config/package/schema/CI code. A post-merge Codex review then identified blocker `#3844601370`: permanent-delete evidence was still `UNVERIFIED` although the frozen aggregate close/dispose → rename/move/delete/open criterion had been recorded `HARD PASS`.

W3-R1 was activated through PR #138 as the unique bounded remediation. Issue #139 then documented the narrow macOS pre-journal defect exposed by the authoritative delete path. PR #140 fixed only that narrow production seam plus the Preview performance evidence harness and squash-merged as `master@e3d7f4c36ff70f0d6def95e739ae11508508a4d1`, tree `ae017ec23241c69f7b33cb1022da5f3a690a1e2a`.

Final CI `32757439487` proved the close→mutate gate: Apple-Silicon macOS permanent delete is a real HARD assertion through existing mutation authority with source absence and subsequent fresh Preview open; Windows permanent delete is `NOT APPLICABLE` because the runtime does not expose the capability; Windows Folder directory mutation remains separately platform-limited. Independent review blockers were 0 and Codex found no major issues. The PR #137 blocker is therefore resolved and W3 is COMPLETE / CLOSED. W4 remained **NOT AUTHORIZED / NOT ACTIVE** until the separate W4-00 activation.

## W2 accepted product/runtime truth retained

- The File Library route is the shared `FileLibraryWorkspace` for Library and Browse organization modes.
- Library remains Query V2 / `LibrarySelectionV1` authoritative. Compact `all_matching` remains non-materialized.
- Browse remains W1 BrowseService/session/enumeration/opaque-ref authoritative. Unmanaged Browse never implicitly becomes managed Library content.
- Shared List/Grid/Context presentation does not replace source-owned selection, query, navigation or filesystem authority.
- WorkspaceSession remains the navigation/history/presentation owner.
- Browse current-folder search remains backend-owned, non-recursive, progressive and bounded.
- Thumbnail generation identity remains backend-derived.
- W2-10 established integrated keyboard/focus/context-menu/responsive ownership.
- W2-11 proved integrated 100k Library/Browse bounded behavior and retained Query V2 100k/1M thresholds.

## Residual evidence ledger

These items remain explicit after W2 and throughout W3 unless separately verified; none is silently converted to PASS.

### `DEFERRED` — Recent

`RECENT_AUTHORITY_MISSING` remains the reviewed product decision. No source-owned recent-activity authority exists, so Zen does not redefine Recent as modified-time/created-time ordering or add persistence merely to satisfy a label.

### `UNVERIFIED` — native manual accessibility / display QA

No genuine interactive VoiceOver/Narrator, real Retina/Windows DPI, native trackpad/pointer or complete platform-keyboard manual QA was executed during W2 or the W3 provider Tracks through W3-08. Browser/hosted evidence is not native-manual UX proof.

W3 adds Preview accessibility/browser evidence; genuine native manual evidence remains separately classified when not executed. W4-06 is the first Wave that can close native Preview accessibility/display evidence for the native hosts it actually implements.

### `UNVERIFIED` — real provider/filesystem fixtures

Real iCloud/File Provider, external APFS/exFAT, SMB/network and other unavailable provider/platform fixtures remain unverified where no genuine fixture existed.

### `RESOLVED / HARD PASS where capability applies` — close→mutate evidence

W3-R1 closed the permanent-delete evidence gap. Apple-Silicon macOS now proves close/dispose → permanent delete through existing mutation authority as a real hard assertion, including source absence and a subsequent fresh Preview open. Windows permanent delete is explicitly `NOT APPLICABLE` under current runtime capability (`permanent_delete_available=false`), rather than being mislabeled `UNVERIFIED`. The aggregate frozen close/dispose → rename/move/delete/open criterion is therefore HARD PASS under the existing product capability contract.

### `UNVERIFIED / platform-limited` — Windows Folder directory mutation

The existing Windows `file_ops` source-validation seam is file-only, while the W3 Folder criterion applies directory mutation/open where the platform fixture permits. W3-R1 did not broaden mutation authority merely to manufacture a PASS; resource release remains proven and macOS Folder mutation remains accepted HARD evidence.

### `OBSERVED / UNVERIFIED` — queue attribution

W2-11 measured workload and overall run timing, but GitHub did not expose an authoritative queue-versus-runner-startup split.

### Historical CI-O target

CI-O historically closed with its separate `<=14 min` Full target not yet met. Later W2-11 Full Validation measured `786 s` / `13m06s`; that later observation does not rewrite the historical CI-O closeout record.

### Inherited W1 observations

W1 scheduler-interference `TARGET MISSED` observations and native provider fixture gaps remain part of the program evidence record.

## Technical debt

`TD-015` remains **open**. W3 may retire preview-specific legacy compatibility callers only after the new Preview Host path is active and focused behavioral/real-browser equivalence is proven. W3-07/W3-08 extend the replacement proof across Folder and ZIP in addition to Floating/Pinned plus Text/Markdown/structured/table/image providers, but they do not satisfy TD-015's broader File Library compatibility deletion exit condition.

No unrelated technical-debt item is closed because W4-01, W4-02 or W4-03 completes.

## Governance rule

W4 — Native Integration is the sole active initiative. W4-00, W4-01, W4-02 and W4-03 v2 are COMPLETE. W4-02 is closed at PR #145 merge `8ea647e13882f8cb0e08b77a2953fb06765d1729` / tree `f2ab398bf87d162fa1c6ca07f1784ceca259bdda` with independent review blockers = 0 and final PR-tree CI success. W4-03 v1 is STOPPED / CLOSED WITHOUT MERGE after Stop Condition #5; ADR-0006 remains accepted, with PR #148 identities retained as governance provenance. W4-03 v2 is closed through PR #151 at `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67` / tree `f357be042c493d0cefd98be8e02d768210ac1f6b`, with final exact-head CI `33008914117`, independent blockers = 0 and real Explorer/prevhost acceptance PASS. W4-04 Windows Explorer Preview Handler Production Integration is the only authorized next Windows Track and must preserve the accepted capture-before-defer architecture. W4-05+ remain downstream-gated by the existing dependency graph. W4 must preserve the W3 Preview/provider/read/identity/mutation authorities frozen by ADR-0005, the W4-01 Native Preview Access / HostProvided source-ownership boundaries, W4-02's accepted Zen-internal native Quick Look lifecycle, and ADR-0006's capture-before-defer Windows source-lifetime amendment. W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE** and requires a separate post-W4 activation.