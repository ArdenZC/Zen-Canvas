# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does
not silently activate a later Wave merely because an earlier Wave completes.
Long-horizon product direction and Wave boundaries remain owned by
[`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-08-22

## Completed foundations

### G1 — Engineering OS

**COMPLETE.** Project state, architecture ownership, technical debt, workflow and
closeout rules are durable.

### M1 / M1.1 — Mutation correctness and portability closeout

**COMPLETE.** Mutation correctness, provider and portability remediation are
closed at their reviewed baselines.

### W0 — File Library / Preview specification

**COMPLETE.** W0 froze Library/Browse product IA, identity contracts, Preview
Core/Host boundaries, Read/Materialization, Thumbnail/WorkScheduler ownership,
performance gates and the W1/W2 dependency plan.

### W1 — File Library / Preview Foundation

**COMPLETE.** W1 delivered the runtime foundation used by W2: shared contracts,
WorkspaceSession, Browse Core, Location Core, WorkScheduler, Preview Contract
Core, Read Gate, Thumbnail Infrastructure, change/refresh and scale/performance
validation.

W1 residual evidence remains part of the program record, including retained
scheduler-interference `TARGET MISSED` observations and unavailable native
provider/filesystem fixtures marked `UNVERIFIED`.

## W2 — File Library 2.0 Experience

Status: **FINAL CLOSEOUT GATE**

Current product/runtime baseline:
`master@1898c290859be204e1778b4b72fc58d22dc08b71`
(PR #116 W2-11 squash merge).

Authority record:
[`initiatives/W2-file-library-experience.md`](initiatives/W2-file-library-experience.md).

Durable implementation plan:
[`specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`](specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md).

Final closeout evidence:
[`tasks/W2-12-FILE-LIBRARY-2-0-EXPERIENCE-CLOSEOUT-RESULT.md`](tasks/W2-12-FILE-LIBRARY-2-0-EXPERIENCE-CLOSEOUT-RESULT.md).

### W2 completed dependency graph

```text
W2-00  Visual / Interaction Freeze                         ✅
  ↓
W2-01  Workspace Shell + Experience Controller             ✅
  ↓
R0     Consumer-boundary architecture/governance           ✅
R1     CI Evidence / Governance Hardening                   ✅
R2     Browse Identity + Thumbnail Consumability            ✅
CI-O   CI Latency / Redundancy Remediation                  ✅
R3     Location Consumability                               ✅
R4     W1→W2 Final Consumability Verification               ✅
  ↓
W2-02  Shared Presentation Entry / Collection Contracts    ✅
 ┌───────────────┴───────────────┐
 ↓                               ↓
W2-03 Library Mode               W2-04 Browse Mode           ✅
 └───────────────┬───────────────┘
                 ↓
W2-05  Interaction + Virtualized List                       ✅
 ┌───────────────┴───────────────┐
 ↓                               ↓
W2-06 Grid + Thumbnail           W2-07 Context / Inspector   ✅
 └───────────────┬───────────────┘
                 ↓
 ┌───────────────┴───────────────┐
 ↓                               ↓
W2-08 Search/Filter/Sort         W2-09 Navigation/Locations  ✅
 └───────────────┬───────────────┘
                 ↓
W2-10  Interaction / Accessibility / Responsive             ✅
                 ↓
W2-11  Experience Performance / Cross-platform QA           ✅
                 ↓
W2-12  File Library 2.0 Experience Closeout                 FINAL GATE
```

W2-01 through W2-11 are complete and merged. W2-12 is documentation/governance
only. Its release-gate audit found no unresolved W2 HARD correctness,
accessibility, authority, performance, lifecycle or resource blocker. W2 becomes
formally **COMPLETE** when W2-12 is independently reviewed and merged.

### W2 accepted outcome

W2 delivers one File Library workspace with two organization modes:

- **Library:** managed/indexed semantic work backed by Query V2 and
  `LibrarySelectionV1`;
- **Browse:** arbitrary filesystem navigation backed by W1 BrowseService,
  opaque refs and backend admission.

The shared workspace provides:

- one command bar and one Library/Browse switch;
- Back/Forward through WorkspaceSession;
- shared virtualized List and Grid presentation;
- viewport-bounded Thumbnail demand;
- shared Context/Inspector presentation without moving Preview Platform work
  into W2;
- Library Query V2 search/filter/sort;
- backend-owned bounded current-folder Browse search;
- platform-adaptive managed/unmanaged location presentation without raw-path
  authority inference;
- compact responsive behavior at the reviewed 980×680 minimum scene;
- deterministic keyboard/focus/context-menu ownership;
- integrated 100k Library/Browse and existing Query V2 100k/1M evidence.

### W2 residual ledger

The following do not disappear at closeout:

- **DEFERRED — Recent:** `RECENT_AUTHORITY_MISSING`; no source-owned
  recent-activity authority exists, so W2 does not fake Recent from timestamps.
- **UNVERIFIED — native manual accessibility/display QA:** VoiceOver, Narrator,
  real Retina/Windows DPI, native trackpad/pointer and complete native keyboard
  manual evidence were not executed.
- **UNVERIFIED — provider/filesystem fixtures:** real iCloud/File Provider,
  external APFS/exFAT, SMB/network and unavailable provider scenarios remain
  unverified where no genuine fixture was supplied.
- **OBSERVED / UNVERIFIED — queue attribution:** workload timing was measured,
  but GitHub did not provide an authoritative queue-versus-runner-startup split.
- **Historical CI-O target:** CI-O originally closed with the separate `<=14 min`
  target not yet met; later W2-11 Full Validation measured `786 s` / `13m06s`.
  The later observation does not rewrite the historical closeout.
- **TD-015:** remains open because bounded Vault compatibility consumers still
  exist in production Library Mode even though the real route is now the new
  workspace.

## Current

### W2-12 — File Library 2.0 Experience Closeout

**ACTIVE — FINAL GATE.**

Scope is documentation/governance/cleanup only:

- converge STATUS/ROADMAP/initiative/current plan truth;
- publish the final release-gate evidence matrix;
- retain all `DEFERRED`, `UNVERIFIED`, `OBSERVED` and historical
  `TARGET MISSED` evidence honestly;
- audit technical debt by exit condition;
- perform only safe task-owned cleanup;
- obtain exact-head docs/governance CI and independent review.

No `src/**`, `src-tauri/**`, schema, performance-threshold, Preview, native-host
or release implementation is authorized by W2-12.

If a new genuine W2 production blocker is discovered, W2-12 stops rather than
repairing it inside a closeout PR.

## Next Waves

### W3 — Preview Platform

Status: **NOT STARTED / NOT AUTHORIZED**.

W3 is the next architectural Wave only after W2 closeout is merged and a
separate W3 activation/review sequence explicitly authorizes work. Expected
scope includes Preview Host/provider/renderer architecture and Quick Preview
experience; W2 closeout does not grant that authority.

### W4 — Native integration

Status: future Wave / not authorized.

Expected concerns include Finder/Explorer/native host integration and genuinely
platform-native filesystem/product surfaces. W2 does not pull these concerns
forward.

### W5 — Release

Status: future Wave / not authorized.

Expected concerns include packaging, signing/notarization, update/release QA and
public distribution.

## Sequencing rule

```text
W0 ✅
 ↓
W1 ✅
 ↓
W2-01 … W2-11 ✅
 ↓
W2-12 FINAL GATE
 ↓
W2 COMPLETE
 ↓
W3 requires separate authorization
 ↓
W4
 ↓
W5
```

No later Wave is implicitly active.
