# Zen Canvas Project Status

Last verified: 2026-08-23

## Current baseline

- Default branch: `master`.
- Current W3 product/runtime baseline:
  `master@fe4cb4a7d16976f5dcc9a9dbbc4b2b47937a850e`
  (PR #121 W3-02 squash merge).
- W3-02 final reviewed head:
  `3adc8ef015cf772933dc5d966289b330d40cc71c`; tree:
  `37eb86d4993616024ca4101955304722a27e16a1`.
- W3-02 merge-integration checkout:
  `aa9469b21ce9486a7f9cf2d819c948ec682d69fe`; tree:
  `37eb86d4993616024ca4101955304722a27e16a1`.
- W3-02 exact-head CI `32585239510`: `success`.
- ADR-0004 evidence: `tree_equivalent=true`,
  `head_validation_required=false`, substantive lane `merge_integration`.
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

## Current initiative

**W3 — Preview Platform**

Status: active — implementation

Authority record:
[`initiatives/W3-preview-platform.md`](initiatives/W3-preview-platform.md).

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
The current authorized production Track is **W3-03 — Pinned Preview + sibling navigation**.
W4 native Finder/Explorer integration and W5 Release remain not authorized.

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

**ACTIVE — implementation.**

W3 turns the already-merged W1 Preview Core and completed W2 workspace into the user-facing Zen Quick Preview platform. W3 is an in-app Preview Platform Wave; Finder/Explorer system-host integration remains W4.

W3-01 closed the Preview Core consumer-readiness seams that intentionally remained after W1/W2:

- production Preview uses one reviewed Provider Registry composition owner; the rich-provider set remains intentionally empty until later provider Tracks merge;
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
- `FileWorkspaceController` now guards Preview publication by request/source tuple and serializes `previewSwitchSource` mutations per `previewId` with a single latest-wins pending slot;
- rapid A→B→C/D changes converge frontend state, controller cache and backend Preview session on the newest source without stale overwrite or spurious dispose;
- close/cancel/dispose and focus restoration remain deterministic;
- no Rust/Tauri command, schema, rich provider, pinned Preview, sibling navigation or W4 system-host scope was pulled forward.

These contracts enable later W3 hosts/providers; they do not create replacement filesystem, read, query or mutation authorities.

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
      NEXT
 └───────────────┬───────────┴───────────────┬───────────┴───────────────┬───────────┘
                                   ↓
                         ┌─────────┴─────────┐
                         ↓                   ↓
                    W3-07 Folder        W3-08 ZIP
                    Preview provider     Archive provider
                         └─────────┬─────────┘
                                   ↓
W3-09  Failure / Materialization / Security / Accessibility Integration
  ↓
W3-10  Preview Performance + Cross-platform QA
  ↓
W3-11  W3 Closeout
```

### W4 — Native integration

**NOT STARTED / NOT AUTHORIZED.** Finder Quick Look extension/system-host integration, Windows Explorer Preview Handler/system integration and native host lifecycle belong here, not W3.

### W5 — Release

**NOT STARTED / NOT AUTHORIZED.** Signing/notarization, publication/update and final release hardening remain future scope.

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

## W3-03 NEXT gate

W3-03 owns Pinned Preview + sibling navigation. It may consume the merged W3-01 core contracts and W3-02 frontend Preview experience/host wiring, but it must preserve the same authority boundaries.

Binding constraints include:

- Pinned Preview becomes a state of the existing W2 Context Panel model rather than a second global Preview surface;
- Floating and Pinned hosts use the same authoritative Preview Core and do not duplicate provider/lifecycle authority;
- sibling navigation is a bounded projection of the current loaded/source-owned workspace collection, never a second Query/Browse engine and never materializes compact `all_matching` selection;
- switching sibling source must preserve latest-wins request/sourceVersion semantics and stale-result rejection established by W3-02;
- W3-03 must not implement W3-04+ rich providers, W4 native system hosts or new read/materialization authority.

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

No genuine interactive VoiceOver/Narrator, real Retina/Windows DPI, native trackpad/pointer or complete platform-keyboard manual QA was executed during W2 or W3-02. Browser/hosted evidence is not native-manual UX proof.

W3 adds Preview accessibility/browser evidence; genuine native manual evidence remains separately classified when not executed.

### `UNVERIFIED` — real provider/filesystem fixtures

Real iCloud/File Provider, external APFS/exFAT, SMB/network and other unavailable provider/platform fixtures remain unverified where no genuine fixture existed.

### `OBSERVED / UNVERIFIED` — queue attribution

W2-11 measured workload and overall run timing, but GitHub did not expose an authoritative queue-versus-runner-startup split.

### Historical CI-O target

CI-O historically closed with its separate `<=14 min` Full target not yet met. Later W2-11 Full Validation measured `786 s` / `13m06s`; that later observation does not rewrite the historical CI-O closeout record.

### Inherited W1 observations

W1 scheduler-interference `TARGET MISSED` observations and native provider fixture gaps remain part of the program evidence record.

## Technical debt

`TD-015` remains **open**. W3 may retire preview-specific legacy compatibility callers only after the new Preview Host path is active and focused behavioral/real-browser equivalence is proven. W3-02 satisfies the Floating Preview replacement proof needed for later narrow retirement decisions, but it does not satisfy TD-015's broader File Library compatibility deletion exit condition.

No unrelated technical-debt item is closed because W3-02 merged.

## Governance rule

W3-03 must start from the merged W3-02 baseline plus this current-truth closeout on its own production branch/PR. A W3 Track that discovers it needs a new durable authority, schema migration, supported-platform change, mutation/recovery ownership change, cross-window permission change or W4 native system-host subsystem must stop and return to architecture review/ADR before continuing.
