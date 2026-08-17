# W1-12 — Foundation Closeout / Current Truth — Codex Implementation Brief

Status: closeout taskbook

Baseline: `master@b4001d7c5d09686b15f74125a828b61b0e913b7f` (PR #82 W1-11 squash merge)

Branch: `docs/w1-12-foundation-closeout`

W1-12 is the final **F4 closeout/current-truth Track** for the File Library 2.0 / Preview Platform W1 Foundation. W1-00..11 already implemented and validated the Foundation. This Track must converge durable project truth and evidence; it must not add, tune, refactor, or repair production behavior.

## 0. Required read set

Read completely before editing:

1. `AGENTS.md`
2. `docs/project/README.md`
3. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
4. `docs/project/DEVELOPMENT_WORKFLOW.md`
5. `docs/project/CODE_MAINTAINABILITY.md`
6. `docs/project/STATUS.md`
7. `docs/project/ROADMAP.md`
8. `docs/project/initiatives/W1-file-library-foundation.md`
9. `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
10. `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
11. `docs/project/specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md`
12. `docs/project/tasks/W1-10-INTEGRATION-SURFACE-CODEX.md`
13. `docs/project/tasks/W1-11-FOUNDATION-PERFORMANCE-QA-CODEX.md`
14. merged PR #82 review/evidence and exact-head full-validation run `32064210757`.

Do not infer current truth from old taskbook status checkboxes when merged `master` says otherwise.

## 1. Objective

Close W1 Foundation without changing runtime behavior:

```text
W1-00..11 merged implementation/evidence
        |
        v
W1-12 evidence reconciliation
        |
        +--> STATUS current truth
        +--> ROADMAP progress
        +--> W1 initiative closeout record
        +--> exact merge/evidence ledger
        +--> known TARGET MISSED / UNVERIFIED ledger
        +--> branch/temp/repository hygiene inventory
        `--> governance/docs validation
        |
        v
F4 / W1 Foundation COMPLETE
        |
        v
A separate, newly reviewed W2 Experience initiative MAY be opened later
```

W1-12 does **not** itself implement or activate W2 product work.

## 2. Absolute scope rule

This is a documentation/governance closeout.

Allowed changes are limited to project-truth/evidence documents and, only if required for truthful machine validation, the smallest governance/docs test adjustment that expresses the already-reviewed closeout state.

Do not change:

- `src/**` or `src-tauri/**` production/runtime behavior;
- schema/migrations;
- dependencies or lockfiles;
- performance thresholds;
- Query V2;
- managed watcher/reconciliation;
- W1-07 Read Gate;
- WorkScheduler policy;
- Thumbnail/Preview/Browse behavior;
- mutation/recovery authorities;
- CI routing/performance implementation merely to make closeout look green.

If closeout discovers a new production correctness blocker, STOP and report it. Do not repair it inside W1-12.

## 3. Canonical W1 merge ledger

Reconcile these merged Tracks against GitHub/master history. Do not change a SHA merely because a PR API field is blank; use merged `master` history as authority.

| Track | PR | master merge/squash commit |
|---|---:|---|
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

The merge order of W1-08/W1-09 does not redefine their dependency/Track numbering.

Where final reviewed PR heads and exact-head CI evidence are recorded in merged PR comments/status docs, preserve them accurately. Do not invent missing workflow IDs.

## 4. W1-11 evidence that closeout must preserve

The final W1-11 reviewed production head is:

`70b45d787dd6b2fb9c0f7ad14c0d36e03fea22bb`

Final full-validation:

- run ID: `32064210757`
- run number: `678`
- conclusion: `success`
- exact reviewed head matched.

Required closeout facts:

- real 100k Ephemeral Browse completed progressively on Windows and macOS local filesystem fixtures;
- per-session live-ref caps remain `100,000 EntryRefs / 16,384 PathRefs`;
- process aggregate caps remain `200,000 EntryRefs / 32,768 PathRefs`;
- capacity fails closed and teardown returns registries to zero;
- real 100,002-entry managed-scan Scheduler pressure exercised `scanner::run_managed_session` through `ManagedScanResourceLeaseAdapter`;
- Windows hard leak signal uses `PROCESS_MEMORY_COUNTERS_EX::PrivateUsage`, with RSS explicitly diagnostic after working-set trim;
- Windows intentional-retention self-test proved the PrivateUsage detector catches sustained retained committed memory;
- macOS Apple Silicon local Workspace Foundation 100k/RSS/FD/steady-state evidence passed;
- existing Query V2 100k/1M thresholds were not lowered and remained green;
- no W1-11 `BLOCKED` result remained at final review.

## 5. Preserve TARGET MISSED honestly

Do not rewrite these as PASS and do not modify Scheduler/thresholds in W1-12.

The W0-F scheduler interference rule classifies the 2x idle comparison as a **TARGET**, not a HARD gate. Final W1-11 measurements recorded:

- Windows: idle first-page p95 `166 us`, pressure `382 us` (~2.30x) — `TARGET MISSED`;
- macOS Apple Silicon: idle `54 us`, pressure `226 us` (~4.19x) — `TARGET MISSED`.

At the same time, the scheduler HARD gates passed:

- foreground remained bounded/not indefinitely blocked;
- a real heavy authority and real Scheduler lease adapter were exercised;
- Background eventually progressed;
- cancellation released leases;
- scheduler/runtime state returned to zero.

Closeout should record the target miss as a future optimization/measurement item, not a W1 correctness failure and not a hidden success.

## 6. Preserve UNVERIFIED fixture boundaries

W1 completion must not claim real fixtures that were never supplied.

Keep explicitly `UNVERIFIED` where applicable:

- real iCloud fixture;
- real generic File Provider fixture;
- external APFS fixture;
- external exFAT fixture;
- SMB/network volume fixture;
- OneDrive/removable-drive scenarios where no real fixture was exercised;
- true native Tauri IPC cancellation/UI interaction where only runtime/command-boundary evidence exists;
- native Quick Look user-visible lifecycle/visual QA not actually exercised;
- W2 UI/accessibility/980x680/focus/keyboard/DPI product QA;
- W3 rich Preview provider/UI matrices;
- signing/notarization/release publication.

Do not turn compile success, local ordinary filesystem tests, mocks, or capability projection into a fixture PASS.

## 7. Documents to converge

At minimum review/update:

### `docs/project/STATUS.md`

It is the single current project-stage/baseline/release-state authority.

After W1-12 closeout it should state truthfully:

- latest product/runtime-changing baseline is `master@b4001d7c5d09686b15f74125a828b61b0e913b7f` (W1-11 PR #82 merge);
- W1-11 reviewed head/full-validation evidence;
- F1/F2/F3/F4 Foundation work is complete once W1-12 merges;
- W1 is closed after W1-12 merge;
- no published release/tag exists unless GitHub actually says otherwise;
- W2 is **not active yet** unless a separate W2 initiative has actually been opened/merged;
- W1 completion is Foundation completion, not completion of File Library 2.0 UI, rich Preview or native integration.

A docs-only closeout must not predict its own future squash-merge SHA. Follow the repository's closeout-baseline semantics.

### `docs/project/ROADMAP.md`

Move W1 Foundation from Current to Completed after closeout, preserving F1-F4 Track structure/evidence summary.

The next planned item may remain W2 Experience, but wording must make clear that planned scope is not authorization. Do not silently activate W2.

### `docs/project/initiatives/W1-file-library-foundation.md`

Change the initiative from `active — implementation` to an appropriate completed/closed status consistent with governance rules.

Add a durable Closeout section that records:

- W0 baseline;
- final W1 runtime baseline (PR #82 merge);
- W1-11 reviewed exact head/full-validation;
- W1-00..11 PR/merge ledger or a concise canonical link to it;
- preserved authorities;
- final known TARGET MISSED;
- final UNVERIFIED boundaries;
- statement that no W2/W3/W4 scope was pulled into W1.

### Other project-truth docs

Only update `docs/project/README.md`, `MASTER_DEVELOPMENT_PLAN.md`, task index, risk/debt docs or governance tests if they are actually stale/inconsistent after W1 closeout. Do not churn stable architecture documents merely to mention W1 completion.

## 8. Risk / debt / follow-up classification

Review current `RISK_REGISTER.md` and `TECH_DEBT.md` only for entries whose truth materially changed because W1 finished.

Do not close a risk/debt item merely because W1 ended. Close only when its deletion/closure condition is proven.

Potential follow-up classes to preserve where relevant:

- Scheduler 2x-idle target optimization;
- provider/network/external-volume real-fixture matrix;
- W2 100k virtualized List/Grid and UX QA;
- W3 Preview provider timing/cleanup/hostile fixtures;
- W4 native lifecycle/integration;
- W5 signing/notarization/full release matrix;
- existing oversized legacy modules not changed by W1.

## 9. Repository hygiene / branch inventory

W1-12 must report hygiene without destructive guesswork.

- verify task-owned W1-11 performance temp/artifact roots are absent/clean on the working checkout;
- do not delete shared Cargo/Node caches merely for closeout;
- inventory merged W1 feature branches/worktrees that are safe cleanup candidates;
- do not delete a remote branch/worktree if equivalence/ownership is unclear;
- actual remote branch deletion can happen after W1-12 merge as housekeeping and is not required to claim Foundation correctness.

On Windows, any new task-owned validation fixtures must remain worktree/repository-drive local, never default large test data to system `C:` when the worktree is elsewhere.

## 10. Validation

Because W1-12 is docs/governance-only, its exact-head gate is docs/current-truth integrity, not another expensive performance rerun.

Required locally/applicably:

- `npm run test:docs`;
- project governance validation;
- `git diff --check`;
- confirm changed-file scope is documentation/governance only;
- confirm no schema/dependency/lockfile/performance-threshold/runtime-authority changes;
- verify internal links to W1 task/spec/initiative records;
- verify all PR numbers/SHAs/run IDs quoted in current-truth docs against GitHub/master history.

Required remotely:

- exact-head docs/governance CI success;
- routing should skip unrelated product/performance/package work for docs-only closeout unless repository routing legitimately requires it.

Do not rerun W1-11 full-validation merely to obtain a later docs SHA; bind W1 Foundation runtime evidence to the reviewed W1-11 production head and merge baseline.

## 11. Independent review gate

Before Ready/merge, an independent closeout review must verify:

1. no production/runtime change is present;
2. `STATUS.md`, `ROADMAP.md`, and W1 initiative agree on W1 completion/current baseline;
3. W1 merge/evidence ledger is accurate;
4. W1-11 HARD PASS evidence is not overstated;
5. Scheduler TARGET MISSED remains visible and correctly classified;
6. unavailable fixtures remain `UNVERIFIED`;
7. no W2 initiative/product work is silently authorized by this PR;
8. no schema/dependency/performance-threshold/authority drift occurred;
9. docs/governance CI is exact-head green;
10. closeout language distinguishes Foundation completion from overall File Library 2.0 / Preview Platform product completion.

Keep the PR Draft until this review passes.

## 12. Completion report

Report:

- final branch/head;
- changed files;
- W1 runtime baseline and W1-11 reviewed evidence head;
- W1-00..11 PR/merge ledger verification;
- exact TARGET MISSED items preserved;
- exact UNVERIFIED items preserved;
- current-truth docs updated;
- risk/debt items changed or deliberately left unchanged;
- branch/worktree/temp hygiene inventory;
- docs/governance validation and exact-head CI run;
- confirmation of zero production/schema/dependency/threshold changes;
- confirmation PR remains Draft and W2 was not started.

Stop after reporting. Do not Ready/merge autonomously and do not create/start W2.
