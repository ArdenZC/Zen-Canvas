# Zen Canvas Project Status

Last verified: 2026-08-22

## Current baseline

- Default branch: `master`.
- Current W3 product/runtime baseline:
  `master@fb48696795e19aa5fabac5966d31665a6b95e81e`
  (PR #119 W3-01 squash merge).
- W3 activation baseline:
  `master@e54c788db637e6c6140cf618dd3d7125ea1df8e3`
  (PR #118 W3-00 squash merge).
- W3-01 final reviewed head:
  `09be79b9415d55a7e0ef5271f465b557c1ee6d57`; tree:
  `6add03115a69fe226b5c040ee8bb23d66e373704`.
- W3-01 merge-integration checkout:
  `c32739c4acb5892384767d9ecef7cd93f81049be`; tree:
  `6add03115a69fe226b5c040ee8bb23d66e373704`.
- W3-01 exact-head CI `32564728867`: `success`.
- ADR-0004 evidence: `tree_equivalent=true`,
  `head_validation_required=false`, substantive lane `merge_integration`.
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
The current authorized production Track is **W3-02 — Zen Floating Quick Preview Host**.
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

W3-01 has now closed the consumer-readiness seams that intentionally remained after W1/W2:

- production Preview uses one reviewed Provider Registry composition owner; the rich-provider set is intentionally still empty until later provider Tracks merge;
- Zen Floating/Pinned host capability matrices and backend source capability projection are explicit and source-truthful;
- Rust and TypeScript share an exhaustive strict ten-family representation and warning wire;
- Preview-specific asset transport is bounded, opaque, process-local, request/sourceVersion-bound and lifecycle-revocable;
- progressive publication is bounded, monotonic and guarded by PreviewSession request/sourceVersion publication authority;
- cancel/dispose/Browse teardown revoke lifecycle authority before asset cleanup;
- successful source switch cleans only the superseded request/sourceVersion tuple, failed switch preserves the old authority, and asset publication re-validates authority under the registry mutex before mutation;
- current File Library UI still does not yet consume the new Preview Core as a user-facing Quick Preview host; that is W3-02.

These contracts enable W3 hosts/providers; they do not create replacement filesystem, read, query or mutation authorities.

W3 dependency graph:

```text
W3-00  Activation + Architecture/Experience Freeze             ✅ PR #118
  ↓
W3-01  Preview Core Consumer-Readiness                          ✅ PR #119
  ↓
W3-02  Zen Floating Quick Preview Host                          NEXT
  ↓
 ┌───────────────────────────┬───────────────────────────┬───────────────────────────┐
 ↓                           ↓                           ↓                           ↓
W3-03 Pinned Preview +       W3-04 Text/Code +           W3-05 Structured +          W3-06 Image
      sibling navigation           Markdown                    Table providers             provider
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

## W3-02 NEXT gate

W3-02 owns the first user-facing Zen Floating Quick Preview host. It may consume the merged W3-01 lifecycle, strict wire, asset transport and progressive publication contracts, but it must not select providers or read filesystem bytes itself.

Binding product behavior remains owned by the W3 experience freeze and implementation plan. In particular:

- Space opens/toggles Floating Quick Preview only when command context permits;
- Esc closes Floating Preview before lower-priority workspace dismissal;
- the shell is visible before slow provider work completes;
- changing the focused/active source switches the current Preview session rather than creating a second Preview authority;
- Library/Browse sources map through existing managed/ephemeral identities;
- Metadata fallback is a valid W3-02 representation while rich providers remain future Tracks;
- W3-02 must not implement W3-03 pinned navigation, W3-04+ rich providers or W4 native system hosts.

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

No genuine interactive VoiceOver/Narrator, real Retina/Windows DPI, native trackpad/pointer or complete platform-keyboard manual QA was executed during W2. Browser/hosted evidence is not native-manual UX proof.

W3 will add Preview accessibility/browser evidence; genuine native manual evidence remains separately classified when not executed.

### `UNVERIFIED` — real provider/filesystem fixtures

Real iCloud/File Provider, external APFS/exFAT, SMB/network and other unavailable provider/platform fixtures remain unverified where no genuine fixture existed.

### `OBSERVED / UNVERIFIED` — queue attribution

W2-11 measured workload and overall run timing, but GitHub did not expose an authoritative queue-versus-runner-startup split.

### Historical CI-O target

CI-O historically closed with its separate `<=14 min` Full target not yet met. Later W2-11 Full Validation measured `786 s` / `13m06s`; that later observation does not rewrite the historical CI-O closeout record.

### Inherited W1 observations

W1 scheduler-interference `TARGET MISSED` observations and native provider fixture gaps remain part of the program evidence record.

## Technical debt

`TD-015` remains **open**. W3 may retire preview-specific legacy compatibility callers only after the new Preview Host path is active and focused behavioral/real-browser equivalence is proven. That narrow retirement does not by itself satisfy TD-015's broader File Library compatibility deletion exit condition.

No unrelated technical-debt item is closed because W3-01 merged.

## Governance rule

W3-02 must start from the merged W3-01 baseline on its own production branch/PR. A W3 Track that discovers it needs a new durable authority, schema migration, supported-platform change, mutation/recovery ownership change, cross-window permission change or W4 native system-host subsystem must stop and return to architecture review/ADR before continuing.
