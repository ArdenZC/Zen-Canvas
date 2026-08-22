# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does
not silently activate a later Wave merely because an earlier Wave completes.
Long-horizon product direction and Wave boundaries remain owned by
[`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-08-22

## Completed

### G1 — Engineering OS

**COMPLETE.** Project-state, architecture-ownership, technical-debt, workflow and
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

### W2 — File Library 2.0 Experience

**COMPLETE through W2-12 closeout PR #117.**

Product/runtime baseline:
`master@1898c290859be204e1778b4b72fc58d22dc08b71`
(PR #116 W2-11 squash merge).

Governance closeout: PR #117 (`docs/w2-12-closeout`), documentation/governance
only.

Authority record:
[`initiatives/W2-file-library-experience.md`](initiatives/W2-file-library-experience.md).

Durable implementation plan:
[`specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`](specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md).

Final closeout evidence:
[`tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md`](tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md).

Final W2 graph:

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
W2-05 Interaction + Virtualized List                       ✅
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
W2-10 Interaction / Accessibility / Responsive             ✅
                 ↓
W2-11 Experience Performance / Cross-platform QA           ✅
                 ↓
W2-12 File Library 2.0 Experience Closeout                 ✅ PR #117
```

W2 delivers one File Library workspace with two organization modes:

- **Library:** managed/indexed semantic work backed by Query V2 and
  `LibrarySelectionV1`;
- **Browse:** arbitrary filesystem navigation backed by W1 BrowseService,
  opaque refs and backend admission.

The completed W2 experience includes one command bar, WorkspaceSession
Back/Forward, shared virtualized List/Grid, viewport-bounded Thumbnail demand,
shared Context/Inspector projection, Library Query V2 search/filter/sort,
bounded current-folder Browse search, platform-adaptive managed/unmanaged
location presentation, compact 980×680 behavior, deterministic keyboard/focus
ownership and integrated 100k/1M evidence.

Residual evidence remains explicit:

- `DEFERRED` — Recent / `RECENT_AUTHORITY_MISSING`;
- `UNVERIFIED` — native VoiceOver/Narrator/manual DPI/Retina/platform keyboard;
- `UNVERIFIED` — real iCloud/File Provider, external APFS/exFAT, SMB/network and
  unavailable provider fixtures;
- `OBSERVED / UNVERIFIED` — queue-versus-runner-startup attribution;
- historical W1 scheduler-interference `TARGET MISSED` observations;
- historical CI-O `<=14 min` closeout miss, while later W2-11 Full measured
  `786 s / 13m06s`;
- `TD-015` remains open until compatibility deletion conditions are actually
  proven.

## Current

### No active initiative

Status: between initiatives — no active implementation

W2 File Library 2.0 Experience is complete through the W2-12 closeout. W3
Preview Platform is the next planned architectural Wave but remains **NOT STARTED
/ NOT AUTHORIZED**. It requires its own initiative record/activation and review
before production implementation can begin.

## Future Waves

### W3 — Preview Platform

Status: not started / not authorized.

Expected scope includes Preview Host/provider/renderer architecture and Quick
Preview experience. W2 completion does not grant W3 implementation authority.

### W4 — Native integration

Status: future Wave / not authorized.

Expected concerns include Finder/Explorer/native host integration and genuinely
platform-native filesystem/product surfaces.

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
W2 ✅
 ↓
BETWEEN INITIATIVES
 ↓
W3 requires separate authorization
 ↓
W4
 ↓
W5
```

No later Wave is implicitly active.
