# W2-12 File Library 2.0 Experience Closeout — Binding Taskbook

Status: **REVIEW CANDIDATE — release-gate audit complete; docs/governance review and merge remain**

Date: 2026-08-22

Base:
`master@1898c290859be204e1778b4b72fc58d22dc08b71`
(PR #116 W2-11 squash merge)

Branch: `docs/w2-12-closeout`

Canonical closeout result:
[`W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md`](W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md)

## 1. Purpose

W2-12 closes the File Library 2.0 Experience Wave after W2-11. It does not add
another File Library feature, authority, query model, filesystem capability,
Preview provider, native host, schema change, release mechanism or performance
workload family.

The Track has four jobs only:

1. converge current truth after the W2-11 merge;
2. audit every W2 release criterion against recorded evidence;
3. retain every non-PASS item honestly as `TARGET MISSED`, `OBSERVED`,
   `UNVERIFIED`, `DEFERRED` or `BLOCKED` instead of erasing it;
4. leave a clean governance state from which W3 may later be separately
   authorized.

Any newly discovered production defect requiring code changes is a STOP
condition. W2-12 must not hide product repair inside a documentation closeout.

## 2. Authoritative merged baseline

W2-11 was independently reviewed and squash merged through PR #116.

| Evidence | Accepted value |
| --- | --- |
| W2-11 validated production head | `a194580ce5be1985edb6bc99317e9a8ff54ddb32` |
| Production tree | `9ec64970ae8b8198c5f2efb9d53753f6421eff3a` |
| Docs-only successor head | `8b0415e123b22b968d2a02c9ae915a90b456f33f` |
| Docs-only successor tree | `c3c2159fed9bc500896cb2c6888a5c3cbb622e11` |
| Production PR CI | `32534065400` — success |
| Final current-head PR CI | `32535644576` — success |
| Full Validation | `32534452585` — success |
| W2-11 squash merge / runtime baseline | `1898c290859be204e1778b4b72fc58d22dc08b71` |

W2-11 accepted scale/resource evidence remains binding:

- 100k Library List/Grid + compact `LibrarySelectionV1::all_matching`: HARD PASS;
- 100k Browse progressive List/Grid + sparse/late current-folder query + stale
  query rejection: HARD PASS;
- Query V2 existing 100k/1M thresholds: HARD PASS;
- post-warm-up eight-cycle resource plateau: HARD PASS;
- durable listener growth signal: TARGET MET (`19` throughout; later deltas
  `0,0,0,0,0`);
- DOM/observer/timer/thumbnail/object-URL steady state: HARD PASS;
- comparable Full `759 s` versus final `786 s`, `+27 s / +3.6%`;
- W2-11 browser step `57 s`, not the final critical path;
- CI-O workload topology remains intact.

## 3. Scope

### In scope

- `docs/project/STATUS.md`;
- `docs/project/ROADMAP.md`;
- `docs/project/initiatives/W2-file-library-experience.md`;
- `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`;
- `docs/project/TECH_DEBT.md`;
- W2-11 current-truth taskbook closeout;
- this W2-12 taskbook;
- one canonical W2-12 closeout result/evidence matrix;
- safe task-owned cleanup evidence;
- final exact-head docs/governance CI and independent review.

### Out of scope

- `src/**` product changes;
- `src-tauri/**` runtime changes;
- Query V3 or new selection/session/filesystem authority;
- schema/migration work;
- new CI workload family or threshold relaxation;
- W3 Preview implementation;
- W4 Finder/Explorer/native host integration;
- W5 release/signing/update work;
- invented Recent activity semantics;
- mock/browser evidence relabeled as native manual QA.

## 4. Current closeout verdict

The W2 release-gate audit found **no unresolved W2 HARD correctness, authority,
scale, cancellation, resource, keyboard, responsive or CI blocker** in the
accepted merged runtime baseline.

Recommended verdict: **W2 COMPLETE**, subject only to:

1. successful exact-head docs/governance CI for this closeout;
2. independent review of the final closeout diff/evidence;
3. squash merge of the W2-12 docs/governance PR.

Until the W2-12 PR merges, current truth is **FINAL CLOSEOUT GATE**, not yet a
procedurally completed Wave.

## 5. Required release-gate matrix

The durable matrix lives in
[`W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md`](W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md).

It audits at least:

1. real shared Library/Browse route;
2. Query V2 managed capability authority;
3. first-class unmanaged Browse without implicit admission;
4. shared List/Grid/Context behavior;
5. source-owned interaction authority;
6. WorkspaceSession navigation/history/presentation ownership;
7. `LibrarySelectionV1` + compact `all_matching`;
8. truthful bounded Browse query completeness/lifetime;
9. path-independent platform navigation authority;
10. 1600×900 and 980×680 responsive contracts;
11. deterministic keyboard/focus/context-menu ownership;
12. bounded 100k Library/Browse presentation;
13. Query V2 100k/1M thresholds;
14. stale query/page/thumbnail cancellation/resource gates;
15. preservation of W1 authority/performance gates;
16. Windows and Apple Silicon hosted evidence;
17. honest residual native-manual/provider classifications;
18. no W3 Preview or W4 native host pulled into W2;
19. no remaining W2 HARD blocker;
20. independent review and merge of W2-12 itself.

All substantive HARD criteria currently pass. Criterion 20 is the remaining
procedural final gate.

## 6. Residual evidence ledger

### DEFERRED — Recent

`RECENT_AUTHORITY_MISSING` remains a reviewer-authorized product defer. W2 does
not redefine Recent as modified/created ordering and does not add persistence
solely to satisfy a label.

### UNVERIFIED — native manual accessibility/display QA

No genuine interactive VoiceOver/Narrator, real Retina/Windows DPI,
trackpad/pointer or complete native keyboard manual QA was executed. Browser DPR,
win32/darwin fixtures and hosted Apple Silicon/Windows jobs are not substitutes.

### UNVERIFIED — real provider/filesystem fixtures

Real iCloud/File Provider, external APFS/exFAT, SMB/network and other unavailable
provider/platform fixtures remain unverified where genuine fixtures were not
available.

### OBSERVED / UNVERIFIED — queue attribution

W2-11 measured overall/workload timing, but GitHub did not expose an authoritative
queue-versus-runner-startup split.

### Historical CI-O target

CI-O historically closed with its separate `<=14 min` target not yet met. Later
W2-11 Full Validation measured `786 s / 13m06s`. The later observation does not
rewrite the historical closeout.

### Inherited W1 observations

Historical W1 scheduler-interference `TARGET MISSED` observations and W1 native
provider fixture gaps remain in the program evidence record.

## 7. Technical-debt verdict

`TD-015 — File Library compatibility retirement` remains **open**.

W2-12 proved:

- the real application File Library route is `FileLibraryWorkspace`;
- W2-03 through W2-11 validate the replacement experience and authorities.

But production Library Mode still intentionally consumes bounded Vault
compatibility modules/components and `useLibraryContentCompatibility`; therefore
the deletion exit condition is not proven.

A separately reviewed post-W2 retirement task must enumerate all remaining
compatibility callers, migrate each behavior to its durable owner, prove
behavior/browser equivalence, confirm zero production callers, and only then
remove the compatibility surface.

No unrelated debt is closed merely because W2 ends.

## 8. Current-truth convergence

The closeout branch must consistently say:

```text
W2-01 … W2-11  COMPLETE / MERGED
W2-12           FINAL CLOSEOUT GATE
W2              COMPLETE only when W2-12 merges
W3              NOT STARTED / NOT AUTHORIZED
W4/W5           future Waves / not authorized
```

Current runtime product baseline remains
`master@1898c290859be204e1778b4b72fc58d22dc08b71` until this docs-only closeout
merges and creates a governance-only successor baseline.

## 9. Validation

W2-12 is docs/governance-only.

Required acceptance evidence:

```text
npm run test:governance
DOCS_DIFF_BASE=origin/master DOCS_DIFF_HEAD=HEAD npm run test:docs
git diff --check
git diff --check origin/master...HEAD
```

Hosted docs-only CI must pass at the final exact head.

Because this execution environment writes through the connected GitHub API
rather than a mounted local checkout, hosted docs/governance CI is the final
executable validation authority for this closeout. No production test lane may be
claimed merely because W2-12 is documentation-only.

## 10. Merge boundary

The W2-12 PR may be Ready/squash-merged only after:

- diff is docs/governance-only;
- current-truth docs converge;
- the release-gate matrix contains no unclassified HARD blocker;
- TD-015 and residual evidence are honest;
- hosted docs/governance CI succeeds;
- independent final review accepts the exact head.

After the merge:

- W2 — File Library 2.0 Experience is formally **COMPLETE**;
- W3 remains `NOT STARTED / NOT AUTHORIZED` until a separate activation/review
  sequence exists;
- W4/W5 remain future Waves.

No later Wave is automatically active.
