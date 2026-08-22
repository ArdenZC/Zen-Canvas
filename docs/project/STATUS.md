# Zen Canvas Project Status

Last verified: 2026-08-22

## Current baseline

- Default branch: `master`.
- W3 activation start / current governance baseline:
  `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`
  (PR #117 W2-12 squash merge).
- File Library 2.0 W2 product/runtime baseline remains:
  `master@1898c290859be204e1778b4b72fc58d22dc08b71`
  (PR #116 W2-11 squash merge).
- W2-11 validated production head:
  `a194580ce5be1985edb6bc99317e9a8ff54ddb32`; tree:
  `9ec64970ae8b8198c5f2efb9d53753f6421eff3a`.
- W2-11 docs-only successor before merge:
  `8b0415e123b22b968d2a02c9ae915a90b456f33f`; tree:
  `c3c2159fed9bc500896cb2c6888a5c3cbb622e11`.
- W2-11 PR CI `32534065400`: `success`.
- W2-11 final current-head PR CI `32535644576`: `success`.
- W2-11 Full Validation `32534452585`: `success`.
- W2-12 closeout PR #117 merged as
  `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`.
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

W3-00 was documentation/governance-only activation and merged as PR #118 at
`master@e54c788db637e6c6140cf618dd3d7125ea1df8e3`. The current authorized
production Track is **W3-01 — Preview Core Consumer-Readiness**. W4 native
Finder/Explorer integration and W5 Release remain not authorized.

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

Pre-activation review confirmed the starting architecture is deliberately split between mature foundation and intentionally deferred W3 consumption:

- Rust `PreviewSession`, source snapshots/versioning, Provider Registry contracts, representation families, capability intersection, cancellation/disposal and opaque read access already exist;
- W1-10 already exposes bounded main-window-only Preview lifecycle commands and injects the existing MaterializationReadGate;
- production Preview now receives its intentionally empty rich-provider set from the single W3-01 composition owner, so current runtime Preview remains metadata fallback only;
- Zen host matrices and backend source capability projection are now separate explicit policies; rich controls remain unavailable until a provider supplies the representation;
- Rust and TypeScript now share an exhaustive strict representation/warning wire contract;
- current W2 File Library UI does not yet consume `fileWorkspaceApi.preview*`; Library still uses preview-specific Vault compatibility and Browse has no user-facing Quick Preview host;
- progressive multi-publication is now a bounded session callback with request/sourceVersion/stale ordering protection; 100k Folder Preview performance is not claimed by W3-01;
- no general renderer-authorized materialization/download action is assumed or fabricated.

These are the explicit W3 consumer-readiness seams, not a license to create replacement authorities.

W3 dependency graph:

```text
W3-00  Activation + Architecture/Experience Freeze             COMPLETE / PR #118
  ↓
W3-01  Preview Core Consumer-Readiness                          IMPLEMENTATION COMPLETE / DRAFT REVIEW
  ↓
W3-02  Zen Floating Quick Preview Host                          NOT ACTIVE / waits for W3-01 merge
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

- W1 Preview Core remains Preview lifecycle/provider/publication authority.
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

## W3-01 current gate

W3-01 makes the existing Preview foundation consumer-ready before rich provider Tracks start.

Taskbook:
[`tasks/W3-01-PREVIEW-CORE-CONSUMER-READINESS-CODEX.md`](tasks/W3-01-PREVIEW-CORE-CONSUMER-READINESS-CODEX.md).

Mandatory W3-01 outcomes:

1. one production Provider Registry composition owner/factory;
2. truthful `zen_floating` and `zen_pinned` Host capability matrices;
3. truthful backend Source capability projection;
4. exhaustive strict Rust/TypeScript Preview representation wire contract;
5. safe bounded transport for asset-bearing representations;
6. bounded request/sourceVersion-bound progressive publication semantics;
7. lifecycle transport compatible with shell-first UI, cancellation/disposal and stale rejection;
8. focused contract tests and maintainability review.

W3-01 is not authorized to bundle every rich provider or W4 native host work.

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

No unrelated technical-debt item is closed merely because W3 starts.

## Governance rule

W3 production work begins only after the W3-00 docs/governance activation PR is independently reviewed and merged. W3-01 must start from that merged baseline on its own production branch/PR.

A W3 Track that discovers it needs a new durable authority, schema migration, supported-platform change, mutation/recovery ownership change, cross-window permission change or W4 native system-host subsystem must stop and return to architecture review/ADR before continuing.
