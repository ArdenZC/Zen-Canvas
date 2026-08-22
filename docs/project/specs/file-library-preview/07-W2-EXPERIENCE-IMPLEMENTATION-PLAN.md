# W2 — File Library 2.0 Experience Implementation Plan

Status: **reviewed implementation plan — W2-01 through W2-11 complete; W2-12 is the final closeout gate**

Planning baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`

Current W2 product/runtime baseline:
`master@1898c290859be204e1778b4b72fc58d22dc08b71`
(PR #116 W2-11 squash merge)

Initiative:
[`../../initiatives/W2-file-library-experience.md`](../../initiatives/W2-file-library-experience.md)

Visual/interaction freeze:
[`08-W2-VISUAL-INTERACTION-FREEZE.md`](08-W2-VISUAL-INTERACTION-FREEZE.md)

Current execution truth is owned by `STATUS.md` and `ROADMAP.md`. This document
owns the durable W2 dependency graph, Track boundaries and implementation
invariants. W2-01 through W2-11 are complete for their accepted scopes. W2-12 is
documentation/governance-only closeout and is the final gate before the Wave may
be declared complete.

## Reviewer-authorized W2-09 amendment — 2026-08-21

The stable Recent entry remains a future product requirement, but its W2-09
implementation is deferred because no source-owned recent-activity authority
exists in the accepted baseline. W2 must not synthesize Recent from
modified/created ordering or add persistence/schema solely to satisfy the
navigation label.

Classification: `DEFERRED / RECENT_AUTHORITY_MISSING`.

## 1. Purpose

W2 turns the completed W1 Foundation into the user-facing File Library 2.0
workspace. It preserves the W0/W1 authority model while replacing the previous
managed-only/List-centric experience with one calm workspace supporting both
semantic Library work and familiar filesystem Browse work.

W2 is **experience integration**. It is not:

- a backend authority rewrite;
- Query V3;
- Preview Platform implementation;
- Finder/Explorer native host integration;
- schema migration;
- signing/release/update work.

## 2. Product model

File Library 2.0 has two organization modes inside one workspace.

### Library

Library owns managed/indexed semantic work:

- Query V2;
- `LibrarySelectionV1`;
- Saved Views / Tags;
- managed roots scope;
- semantic search/filter/sort;
- Inspector/Context projection.

### Browse

Browse owns arbitrary filesystem navigation:

- W1 BrowseService;
- session/request/enumeration identity;
- opaque `BrowsePathRef` / `BrowseEntryRef` / `LocationRef` contracts;
- progressive paging;
- loaded-only selection;
- bounded current-folder search;
- backend admission and lifecycle.

Library and Browse share presentation and interaction where safe. They do not
share authority merely for implementation convenience.

## 3. Non-negotiable authority invariants

1. Query V2 remains Library query authority.
2. `LibrarySelectionV1` remains Library selection authority.
3. Compact `all_matching` must never become a renderer-side list of all IDs.
4. BrowseService remains Browse session/enumeration/lifetime authority.
5. WorkspaceSession remains navigation/history/presentation authority.
6. Renderer code does not reconstruct filesystem authority from display paths.
7. Thumbnail source generation is backend-derived.
8. Location presentation is not Location admission.
9. Managed Library locations bind to Query V2 roots scope; Browse locations bind
   to opaque backend Location admission.
10. Shared List/Grid/Context adapters remain projections, not new stores.
11. W2 does not create Preview Host/provider authority.
12. W2 does not weaken W1/W2 scale/performance thresholds to obtain acceptance.

## 4. Completed dependency graph

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
W2-05 Interaction + List                                  ✅
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
W2-12 File Library 2.0 Experience Closeout                 FINAL GATE
```

W2-12 does not add a new production node to the graph. It only verifies and
records that the completed graph satisfies release criteria.

## 5. Track boundaries and accepted outcomes

### W2-00 — Visual / Interaction Freeze

Reviewed and froze the product IA, responsive model, platform adaptation,
interaction expectations and minimum 980×680 scene.

### W2-01 — Workspace Shell + Experience Controller

Established the real shared File Library route/workspace, organization-mode
switch, command-bar/history structure and experience controller.

### R0 / R1 / R2 / CI-O / R3 / R4 — prerequisite remediation chain

The remediation chain resolved or verified consumer-boundary risks before the
rest of W2:

- R0 audited W1→W2 consumer seams;
- R1 established accepted CI evidence governance and ADR-0004;
- R2 fixed Browse/Thumbnail consumability and generation ownership;
- CI-O reduced redundant CI execution without reducing accepted gates;
- R3 made Location admission backend-owned and consumable;
- R4 independently verified the final W1→W2 consumer boundary.

### W2-02 — Shared Presentation Entry / Collection Contracts

Created source-discriminated presentation contracts while preserving Library
query/snapshot provenance and Browse session/request/enumeration provenance.

### W2-03 — Library Mode Adapter / Migration

Moved the managed Library source into the shared workspace while retaining Query
V2, `LibrarySelectionV1`, Saved Views, Tags and existing managed capabilities.

### W2-04 — Browse Mode Navigation + Content

Delivered progressive Browse navigation/content, breadcrumbs, paging,
Back/Forward integration, source-local selection/focus and change/refresh truth.

### W2-05 — Interaction Convergence + Virtualized List

Created shared presentation interaction and bounded virtualized List behavior
without creating a second source authority.

### W2-06 — Virtualized Grid + Thumbnail Integration

Added shared virtualized Grid and viewport/overscan-bounded Thumbnail demand.
Logical large counts remain distinct from loaded source authority.

### W2-07 — Context Panel / Inspector

Added shared Context projection: rich managed Library Inspector semantics and
truthful Browse metadata/capability projection without pulling W3 Preview into
W2.

### W2-08 — Search / Filter / Sort

Library continues to use Query V2. Browse gained backend-owned, non-recursive,
current-folder text/type query through the existing Browse enumeration lifetime.
The final implementation preserves `RAW_DIRECTORY_SCAN_BUDGET = 1024`, allowing
empty/short partial pages and yielding between bounded turns.

### W2-09 — Platform Navigation + Managed/Unmanaged UX

Library navigation binds real Query V2 semantics and managed roots. Browse uses
opaque LocationRef admission and may show backend-confirmed Browse-only
locations. Platform changes presentation grouping/labels only; no path heuristic
becomes authority. Recent is explicitly deferred under the reviewer amendment.

### W2-10 — Interaction / Accessibility / Responsive Integration

Integrated keyboard/focus/ARIA/responsive ownership across Search, Navigation,
List/Grid, Context and context menus. Compact Navigation/Context overlays have
deterministic ownership. Real browser gates cover 1600×900, 980×680 and DPR
1/1.25/2. Native manual accessibility/display evidence remains separate.

### W2-11 — Experience Performance / Cross-platform QA

Proved the integrated experience at scale and under repeated lifecycle stress:

- 100k logical Library List/Grid bounded;
- compact Library `all_matching` preserved;
- 100k logical Browse progressive/bounded;
- Query V2 accepted 100k/1M thresholds preserved;
- sparse impossible-query and late-sentinel Browse search;
- query A→B stale rejection;
- rapid source/mode/presentation switching;
- thumbnail cancellation and steady state;
- object URL, timer, observer and DOM cleanup;
- post-warm-up eight-cycle durable-listener plateau;
- Windows and Apple Silicon hosted evidence;
- PR CI and Full Validation success.

Final accepted W2-11 evidence includes Full Validation `32534452585` and current
W2 product/runtime baseline
`master@1898c290859be204e1778b4b72fc58d22dc08b71`.

### W2-12 — File Library 2.0 Experience Closeout

W2-12 is documentation/governance/cleanup only. It owns:

- current-truth convergence;
- final release-gate matrix;
- residual evidence ledger;
- technical-debt audit;
- safe task-owned cleanup evidence;
- final docs/governance CI and independent review.

Any newly discovered production blocker is a STOP condition. W2-12 does not
repair it inside a closeout PR.

## 6. Shared presentation contract

The shared presentation layer may normalize display information but preserves
source identity:

- managed entries retain managed `EntryRef` identity;
- Browse entries retain ephemeral session-scoped `BrowseEntryRef` identity;
- collection context retains source provenance;
- render keys are UI identity only and are never parsed into authority;
- unknown metadata stays unknown rather than being fabricated.

## 7. Selection and focus contract

Library:

- `LibrarySelectionV1` authoritative;
- explicit selection and compact `all_matching` supported;
- query fingerprint/snapshot revision preserved.

Browse:

- loaded-only selection;
- source/session lifetime authoritative;
- incomplete enumeration never claims unseen selection.

Shared List/Grid interaction may project focus/selection state but cannot own a
second selection store.

## 8. Search / navigation / history contract

- Cmd/Ctrl+F focuses the File Library local Search surface.
- Global Spotlight remains separate app-owned search.
- Library semantic navigation must change real Query V2 state.
- Browse current-folder query is non-recursive, bounded and cancellation-safe.
- WorkspaceSession owns Back/Forward and live presentation restoration.
- Transient UI changes do not become filesystem or query authority.

## 9. Responsive / accessibility contract

Reviewed W2 product scenes include 1600×900 normal layout and 980×680 compact
layout.

At compact width:

- Navigation is a bounded drawer/sheet;
- Context is a bounded overlay/sheet;
- one File Library modal overlay owns focus at a time;
- Search, Back/Forward, organization mode, List/Grid, Navigation and Context
  remain reachable;
- no horizontal document overflow is accepted.

Focus restoration is one-shot and tied to the dismissal owner. Delayed repeated
focus-stealing chains are not accepted.

## 10. Scale / performance contract

W2 inherits W1 performance architecture and may add integrated evidence without
weakening existing thresholds.

Accepted final evidence includes:

- 100k Library/Browse bounded virtualization;
- existing Query V2 100k/1M gates;
- progressive first useful Browse content;
- bounded sparse search turns;
- stale publication rejection;
- viewport-bounded thumbnail demand;
- resource steady-state after repeated cycles;
- CI-O no-duplicate-workload principles.

W2-11 final comparable Full Validation was `786 s` versus `759 s` baseline; the
W2-11 browser step was `57 s` and not the final critical path.

## 11. Residual evidence policy

W2 closeout must preserve non-PASS evidence rather than erase it.

Current residual ledger:

- `DEFERRED`: Recent / `RECENT_AUTHORITY_MISSING`;
- `UNVERIFIED`: genuine native VoiceOver/Narrator/manual DPI/Retina/platform
  keyboard QA;
- `UNVERIFIED`: real iCloud/File Provider, external APFS/exFAT, SMB/network and
  unavailable provider fixtures;
- `OBSERVED / UNVERIFIED`: queue-versus-runner-startup attribution;
- historical W1 scheduler-interference `TARGET MISSED` observations;
- historical CI-O `<=14 min` target not-yet-met closeout, while later W2-11 Full
  measured `13m06s`;
- `TD-015` remains open until its compatibility deletion exit condition is
  actually proven.

None of these may be silently renamed PASS.

## 12. Out-of-scope future Waves

W2 does not authorize:

- W3 Preview Host/provider/renderer implementation;
- W4 Finder/Explorer/native host integration;
- W5 signing/notarization/release/update work.

W3 remains `NOT STARTED / NOT AUTHORIZED` until separately activated after W2
closeout.

## 13. W2 release criteria

W2 may be declared complete only when all HARD criteria are satisfied and all
non-PASS evidence is classified honestly.

| Release criterion | Required verdict at closeout |
| --- | --- |
| Shared File Library route is the real Library/Browse workspace | HARD PASS |
| Managed Library capabilities remain Query V2-backed | HARD PASS |
| Browse is first-class and unmanaged Browse does not implicitly become managed | HARD PASS |
| Shared List/Grid/Context work across source types where capability permits | HARD PASS |
| Shared interaction derives from real source owners | HARD PASS |
| WorkspaceSession remains navigation/history/presentation authority | HARD PASS |
| Library Query V2 / `LibrarySelectionV1` authority including compact `all_matching` | HARD PASS |
| Browse query completeness/lifetime/boundedness truthful | HARD PASS |
| Platform navigation does not infer authority from raw paths | HARD PASS |
| 980×680 and normal responsive contracts validated | HARD PASS |
| Keyboard/focus/context-menu ownership deterministic | HARD PASS |
| 100k Library/Browse rendering bounded | HARD PASS |
| Query V2 accepted 100k/1M thresholds preserved | HARD PASS |
| stale page/query/thumbnail cancellation/resource gates pass | HARD PASS |
| W1 authority/performance gates remain preserved | HARD PASS |
| supported Windows/macOS hosted build/performance evidence present | HARD PASS |
| residual native-manual/provider gaps classified honestly | PASS if explicitly non-HARD |
| no W3 Preview / W4 native host pulled into W2 | HARD PASS |
| no unresolved W2 HARD correctness/accessibility/resource blocker | HARD PASS |
| W2-12 current-truth closeout independently reviewed and merged | FINAL GATE |

The durable W2-12 evidence matrix is:

[`../../tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md`](../../tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md).

The current audit verdict is PASS for every HARD criterion except the procedural
final gate that this documentation/governance closeout itself must be
independently reviewed and merged. No new production blocker was found during
W2-12 audit.
