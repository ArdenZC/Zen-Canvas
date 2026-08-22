# W2 — File Library 2.0 Experience

Status: **FINAL CLOSEOUT GATE**

Owner: File Library / Experience

Start baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`

Reviewed implementation-plan baseline:
`master@e91416c83082b61a0d3042c9438d77c7b8586297` (PR #86)

Reviewed visual/interaction baseline:
`master@251bab36797cde4129656f57667ed203f20415e6` (PR #87)

Current product/runtime baseline:
`master@1898c290859be204e1778b4b72fc58d22dc08b71`
(PR #116 W2-11 squash merge)

W2-12 closeout branch: `docs/w2-12-closeout`

## 1. Objective

W2 turns the completed W1 Foundation into the user-facing File Library 2.0
workspace while preserving the accepted W0/W1 authority model.

The completed experience is one calm workspace with two organization modes:

- **Library** for managed/indexed semantic work through Query V2 and
  `LibrarySelectionV1`;
- **Browse** for arbitrary filesystem navigation through W1 BrowseService,
  session/enumeration lifetime and opaque backend-owned refs.

W2 is experience integration. It does not own Preview Platform implementation,
native Finder/Explorer host integration or public release work.

## 2. Binding authority rules

The following remain non-negotiable after W2:

1. Query V2 remains the managed Library query authority.
2. `LibrarySelectionV1` remains the managed selection authority, including
   compact `all_matching` without ID materialization.
3. BrowseService remains the ephemeral Browse session/enumeration/lifetime
   authority.
4. WorkspaceSession remains the live navigation/history/presentation owner.
5. Renderer code does not reconstruct raw filesystem authority from display
   paths, labels, provider names or presentation projections.
6. Thumbnail generation identity is backend-derived; callers do not fabricate
   source generation.
7. Managed Library locations bind to Query V2 roots scope; Browse locations bind
   to opaque LocationRef admission.
8. Shared List/Grid/Context presentation does not become a second query,
   selection, filesystem or session authority.
9. W2 does not implement W3 Preview Host/provider architecture.
10. W2 closeout cannot weaken W1/W2 performance or correctness thresholds.

## 3. Completed execution sequence

| Track | Status | Durable outcome |
| --- | --- | --- |
| W2-00 | COMPLETE | reviewed visual/interaction freeze and activation |
| W2-01 | COMPLETE | shared workspace shell + experience controller |
| R0 | COMPLETE | consumer-boundary audit/governance remediation |
| R1 | COMPLETE | CI evidence governance; ADR-0004 accepted |
| R2 | COMPLETE | Browse identity + Thumbnail consumability |
| CI-O | COMPLETE | CI latency/redundancy remediation without reducing gates |
| R3 | COMPLETE | Location consumability / backend admission |
| R4 | COMPLETE | final W1→W2 consumability verification |
| W2-02 | COMPLETE | shared presentation entry/collection contracts |
| W2-03 | COMPLETE | Library source-owner migration |
| W2-04 | COMPLETE | Browse navigation/content source owner |
| W2-05 | COMPLETE | shared interaction + virtualized List |
| W2-06 | COMPLETE | virtualized Grid + Thumbnail integration |
| W2-07 | COMPLETE | Context Panel / Inspector projection |
| W2-08 | COMPLETE | Search/Filter/Sort + bounded Browse current-folder query |
| W2-09 | COMPLETE | platform navigation + managed/unmanaged UX |
| W2-10 | COMPLETE | interaction/accessibility/responsive integration |
| W2-11 | COMPLETE | experience performance/cross-platform QA |
| W2-12 | FINAL GATE | documentation/governance closeout only |

W2-01 through W2-11 are merged. W2-12 is the final release-governance gate.
The W2-12 audit found no unresolved W2 HARD correctness, accessibility,
authority, performance, lifecycle or resource blocker. W2 becomes formally
**COMPLETE** when W2-12 is independently reviewed and merged.

## 4. Final product scope delivered by W2

### Shared workspace

- one File Library route and workspace;
- Library/Browse organization switch;
- Back/Forward through WorkspaceSession;
- source-owned target identity;
- responsive Navigation and Context surfaces;
- shared virtualized List/Grid presentation.

### Library

- Query V2 source owner;
- search/filter/sort;
- tags and Saved Views;
- compact `all_matching` selection;
- managed-location roots scope;
- Inspector/Context projection;
- shared interaction without a second selection store.

### Browse

- backend-owned LocationRef admission;
- progressive enumeration and breadcrumbs;
- live session/request/enumeration identity;
- loaded-only selection;
- bounded current-folder non-recursive search;
- partial/complete truth;
- change/refresh integration;
- platform-adaptive location presentation without path heuristics.

### Interaction / accessibility / responsiveness

- one command bar;
- keyboard List/Grid interaction;
- deterministic context-menu target/focus ownership;
- compact Navigation/Context overlay ownership;
- local Cmd/Ctrl+F ownership;
- 980×680 compact contract and 1600×900 normal scenes;
- browser DPR evidence at 1 / 1.25 / 2;
- reduced-motion and ARIA contract coverage.

### Scale / resource QA

W2-11 retained and integrated the accepted performance architecture:

- 100k Library List/Grid bounded rendering;
- 100k Browse progressive List/Grid;
- Query V2 accepted 100k/1M thresholds;
- sparse impossible-query and late-sentinel Browse search;
- query replacement/stale publication rejection;
- thumbnail cancellation and object-URL cleanup;
- timer/observer/resource steady state;
- post-warm-up eight-cycle durable-listener plateau;
- Windows and Apple Silicon hosted evidence;
- final Full Validation `32534452585` success.

## 5. Residual evidence retained at closeout

### DEFERRED — Recent

`RECENT_AUTHORITY_MISSING` is reviewer-authorized. A stable Recent concept remains
a future product requirement, but W2 does not synthesize it from modified or
created timestamps and does not add persistence merely to satisfy the label.

### UNVERIFIED — native manual accessibility/display QA

No genuine interactive VoiceOver/Narrator, real Retina/Windows DPI, native
trackpad/pointer or complete native keyboard manual QA was executed during W2.
Browser DPR, deterministic platform fixtures and hosted native compile/performance
are not substitutes for that manual evidence.

### UNVERIFIED — real provider/filesystem fixtures

Real iCloud/File Provider, external APFS/exFAT, SMB/network and unavailable
provider/platform fixtures remain unverified where genuine fixtures were not
available.

### OBSERVED / UNVERIFIED — queue attribution

W2-11 measured overall/workload timing but GitHub did not expose an authoritative
queue-versus-runner-startup split.

### Historical CI-O target

CI-O historically closed with its separate `<=14 min` target not yet met. Later
W2-11 Full Validation measured `786 s` / `13m06s`; this later observation does
not rewrite the historical CI-O closeout.

### Open technical debt

`TD-015` remains open. The real File Library route is the new workspace and the
replacement experience is validated, but Library Mode still consumes bounded
Vault compatibility modules, so the deletion exit condition is not yet proven.

## 6. W2 release-gate verdict

The binding W2-12 matrix is stored in:

[`../tasks/W2-12-FILE-LIBRARY-2-0-EXPERIENCE-CLOSEOUT-RESULT.md`](../tasks/W2-12-FILE-LIBRARY-2-0-EXPERIENCE-CLOSEOUT-RESULT.md).

Current verdict:

- no W2 HARD authority blocker: **PASS**;
- no W2 HARD correctness blocker: **PASS**;
- no W2 HARD accessibility/focus blocker: **PASS**;
- integrated 100k/1M/performance gates: **PASS**;
- stale/cancellation/resource steady-state gates: **PASS**;
- residual non-HARD evidence: explicitly retained;
- final remaining gate: independent review and merge of W2-12.

## 7. Exit condition

W2 is complete only when the W2-12 documentation/governance closeout is reviewed
and merged. W2-12 may not repair product/runtime code. A genuine newly discovered
production blocker must stop closeout for independent handling.

After W2 completion:

- W3 Preview Platform remains `NOT STARTED / NOT AUTHORIZED` until separately
  activated;
- W4 native integration remains a later Wave;
- W5 release/signing/update remains a later Wave.

Completion of W2 does not automatically authorize any of them.
