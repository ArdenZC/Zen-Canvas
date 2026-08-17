# File Library 2.0 / Preview Platform — W1 Foundation

Status: complete

Owner: File Library / Preview Foundation

W0 architecture baseline: `master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3` (PR #64 W0 specification merge)

Final W1 runtime baseline: `master@b4001d7c5d09686b15f74125a828b61b0e913b7f` (PR #82 W1-11 squash merge)

W1 closeout/governance baseline: `master@ecde9f146e1e4e4933f6294358fe4a6523c7c0bd` (PR #83 W1-12 squash merge)

Source specification: [`../specs/file-library-preview/00-MASTER-SPEC.md`](../specs/file-library-preview/00-MASTER-SPEC.md)

Implementation plan: [`../specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md`](../specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md)

W1 is closed. It implemented the bounded Foundation authorized by W0 without
pulling W2/W3/W4 product scope forward. A later Wave requires a separate active
initiative; W1 completion does not itself authorize W2 Experience work.

## Objective — completed

W1 established the shared File Library 2.0 / Preview foundation while preserving
existing durable authorities. The delivered Foundation includes safe identity and
session contracts, progressive Ephemeral Browse, Location projection, global
resource scheduling, Preview lifecycle contracts, authoritative
materialization/read adaptation, shared Thumbnail infrastructure, ephemeral
change invalidation, a bounded integration surface and cross-platform scale /
resource evidence.

## Preserved authorities

W1 preserved:

- File Library Query V2 as managed-library query authority;
- `LibrarySelectionV1` as managed selection authority;
- Global Index as system-wide search authority;
- scan-root/watcher revisions and reconciliation as managed-location truth;
- existing platform/content byte-read eligibility and open/revalidation paths as
  content-access authority, adapted by W1-07 rather than replaced;
- filesystem-safety identity/backend revalidation as mutation correctness
  authority;
- Operation Preview, journals, Safe Trash, cleanup and Restore authorities;
- PR #63 provider/materialization/capability semantics.

W1 created no Query V3, second managed watcher, second content-read authority,
second filesystem mutation/recovery path or generic durable job/session database.

## Completed Tracks

### F1 — Contract Spine

- **W1-00** — initiative/governance activation and W0 closeout.
- **W1-01** — implementation-level shared contracts and serialization tests.

### F2 — Parallel Core

- **W1-02** — Workspace Navigation / WorkspaceSession.
- **W1-03** — Ephemeral Browse Core.
- **W1-04** — Location Core and platform projections.
- **W1-05** — WorkScheduler plus selected real heavy-authority resource adapters.
- **W1-06** — Preview Contract Core with bounded lifecycle/fake-provider tests.

### F3 — Infrastructure

- **W1-07** — Materialization / Read Gate adapting authoritative byte-open rules.
- **W1-08** — Thumbnail Infrastructure.
- **W1-09** — Ephemeral Change / Refresh.
- **W1-10** — central Integration Surface.

### F4 — Foundation Release

- **W1-11** — Foundation scale, performance, cancellation, cleanup, Scheduler
  interference and platform QA evidence.
- **W1-12** — documentation/governance closeout and current-truth convergence.

## Canonical merge ledger

| Track | PR | master merge/squash commit |
| --- | ---: | --- |
| W1-00 Foundation activation | #65 | `3f6f8a72cbca78812ee257431bfa89a8e357f30f` |
| W1-01 Contract Spine | #66 | `3f30f12fea23961e03b4021d0ffa63c80377167b` |
| W1-02 Workspace Navigation | #67 | `68b74580a22fa8853b886185734c5b19478ce52a` |
| W1-03 Ephemeral Browse Core | #68 | `fc97dc17de098efe9d4e9ce1f29698a9e91659ca` |
| W1-04 Location Core | #69 | `0e9a73e886bffaeb660789b06dc80a74f3eb67aa` |
| W1-05 WorkScheduler | #70 | `2955bb67e3e90eef09aa69cd6b0278a8e1245b99` |
| W1-06 Preview Contract Core | #71 | `b6a2608f84c40c9609ad9ec014bb6196fbfb559c` |
| W1-07 Materialization / Read Gate | #73 | `bce4c0f5792ee9cb18b0475351de3303fa73639e` |
| W1-08 Thumbnail Infrastructure | #75 | `172e09dff51f1e9fe5367d5e886d263848c4031c` |
| W1-09 Ephemeral Change / Refresh | #74 | `272093150ffeceef044a0036954a3bfe274f3717` |
| W1-10 Integration Surface | #81 | `1920c3c254992f90335e7c57df4fab819fd6062b` |
| W1-11 Foundation Performance / QA | #82 | `b4001d7c5d09686b15f74125a828b61b0e913b7f` |
| W1-12 Foundation Closeout / Current Truth | #83 | `ecde9f146e1e4e4933f6294358fe4a6523c7c0bd` |

W1-12 is documentation/governance-only. Its merge commit records the Foundation
closeout/current-truth baseline and does not supersede the W1 runtime baseline
from PR #82.

## Final W1-11 validation evidence

Final independently reviewed production head:

`70b45d787dd6b2fb9c0f7ad14c0d36e03fea22bb`

Exact-head Full Validation:

- run ID `32064210757`;
- run number `678`;
- conclusion `success`.

The final evidence includes:

- real progressive 100k Ephemeral Browse on Windows and Apple Silicon macOS
  ordinary local filesystem fixtures;
- per-session bounds of `100,000 EntryRefs / 16,384 PathRefs` and process
  aggregate bounds of `200,000 EntryRefs / 32,768 PathRefs`;
- fail-closed capacity behavior and zeroed registry state after teardown;
- real `100,002`-entry managed-scan Scheduler pressure through
  `scanner::run_managed_session` and `ManagedScanResourceLeaseAdapter`;
- Windows committed-memory hard leak detection using
  `PROCESS_MEMORY_COUNTERS_EX::PrivateUsage`, plus an intentional-retention
  self-test proving the detector catches sustained retained committed memory;
- Apple Silicon macOS local Workspace Foundation RSS/FD/steady-state evidence;
- existing Query V2 100k/1M thresholds unchanged and green;
- no remaining final `BLOCKED` W1-11 classification.

## Known TARGET MISSED

The scheduler pressure-latency 2x-idle comparison is a W0 **TARGET**, not a HARD
correctness gate. W1 closes with the target still missed:

- Windows: idle first-page p95 `166 us`, pressure `382 us` (~`2.30x`);
- Apple Silicon macOS: idle `54 us`, pressure `226 us` (~`4.19x`).

These remain **TARGET MISSED** and are not reclassified as PASS. Scheduler HARD
gates passed: foreground was not indefinitely blocked, a real heavy authority
and real lease adapter were exercised, Background work eventually progressed,
cancellation released leases and scheduler/runtime state returned to zero.
Future work may optimize/re-measure this target but must not silently weaken it.

## Explicit UNVERIFIED boundaries

W1 completion does not claim real fixture/product evidence that was not supplied
or exercised. The following remain `UNVERIFIED` where applicable:

- real iCloud fixture;
- real generic File Provider fixture;
- external APFS fixture;
- external exFAT fixture;
- SMB/network-volume fixture;
- OneDrive/removable-drive scenarios without an exercised real fixture;
- true product-level Tauri IPC cancellation/UI interaction beyond the tested
  runtime/command boundary;
- native Quick Look user-visible lifecycle/visual QA not actually exercised;
- W2 UI/accessibility/980x680/focus/keyboard/DPI product QA;
- W3 rich Preview provider/UI matrices;
- signing/notarization/release publication.

Compile success, ordinary local filesystem tests, mocks and capability
projections are not substitutes for these fixture claims.

## Scope closeout

W1 did **not** authorize or deliver:

- the polished Library/Browse workspace experience (W2);
- rich Markdown/JSON/CSV/ZIP/Folder production Preview providers or Quick
  Preview UI (W3);
- Finder Quick Look Extension or Windows native Explorer/Quick Preview
  integration (W4);
- release signing/notarization/publication (W5);
- arbitrary unmanaged recursive/global filesystem search;
- Query V3;
- managed watcher rewrite;
- a second content-read eligibility engine;
- a new mutation/recovery authority;
- OCR/RAG/AI Preview/Agent/MCP expansion;
- Intel macOS or Linux support.

## Closeout

- W0 specification baseline: `c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3`.
- Final W1 runtime baseline: `b4001d7c5d09686b15f74125a828b61b0e913b7f`.
- Final reviewed W1 validation head: `70b45d787dd6b2fb9c0f7ad14c0d36e03fea22bb`.
- Final Full Validation: `32064210757` / #678, success.
- W1-12 closeout PR: #83 — merged as `ecde9f146e1e4e4933f6294358fe4a6523c7c0bd`.
- W1-12 merge-push governance CI: `32068976837` / #686, success.
- W1 status: complete.
- W2 status: planned only; no active W2 initiative exists at W1 closeout.
- Source/feature branch deletion remains post-closeout repository housekeeping
  after equivalence/ownership checks and is not a Foundation correctness claim.
