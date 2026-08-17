# W1-11 — Foundation Performance / QA — Codex Implementation Brief

Status: implementation taskbook

Baseline: `master@1920c3c254992f90335e7c57df4fab819fd6062b` (PR #81 W1-10 merge)

Branch: `feat/w1-11-foundation-performance-qa`

W1-11 is the **F4 evidence and hardening Track** for File Library 2.0 / Preview Foundation. W1-02..10 already established the contracts and integration surface. This Track must prove that those foundations remain progressive, cancellable, bounded, fail-closed and usable under realistic scale/pressure.

W1-11 is not a feature-expansion Track. It may make the smallest implementation/harness changes required to satisfy frozen W0/W1 performance and correctness gates, but it must not pull W2/W3/W4 product scope forward.

## 0. Required read set — before changing production code

Read completely:

1. `AGENTS.md`
2. `docs/project/README.md`
3. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
4. `docs/project/DEVELOPMENT_WORKFLOW.md`
5. `docs/project/CODE_MAINTAINABILITY.md`
6. `docs/project/STATUS.md`
7. `docs/project/initiatives/W1-file-library-foundation.md`
8. `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
9. `docs/project/specs/file-library-preview/01-PRODUCT-IA.md`
10. `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
11. `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
12. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
13. `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
14. `docs/project/specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md`
15. `docs/project/tasks/W1-10-INTEGRATION-SURFACE-CODEX.md`

Then inspect current implementation/harness before designing changes:

- `src-tauri/src/file_workspace/browse/mod.rs`
- `src-tauri/src/file_workspace/change.rs`
- `src-tauri/src/file_workspace/integration/`
- `src-tauri/src/file_workspace/preview.rs`
- `src-tauri/src/file_workspace/read_gate.rs`
- `src-tauri/src/file_workspace/thumbnail/`
- `src-tauri/src/scheduler.rs`
- `src-tauri/src/scanner.rs`
- `src/fileWorkspace/workspaceSession.ts`
- `src/fileWorkspace/fileWorkspaceController.ts`
- `src/api/fileWorkspaceApi.ts`
- `src/api/fileWorkspaceMockApi.ts`
- `src/types/fileWorkspace.ts`
- `tests/fileWorkspaceIntegration.test.ts`
- `scripts/performanceManifest.mjs`
- `scripts/runPerformanceSuite.mjs`
- `scripts/runPerformanceProfile.mjs`
- `scripts/preparePerformanceBinaries.mjs`
- `scripts/preparePerformanceFixtures.mjs`
- `scripts/checkPerformanceArchitecture.mjs`
- `scripts/classifyCiChanges.mjs`
- `.github/workflows/ci.yml`
- existing Query V2 performance tests and thresholds.

Do not infer W1-10 behavior from old review comments when current `master` says otherwise.

## 1. Track objective

Produce exact-head, repeatable evidence for the W1 Foundation release gates:

```text
real filesystem / existing authorities
        |
        v
W1 Foundation services
Browse / Change / Scheduler / Read Gate / Thumbnail / Preview lifecycle
        |
        v
W1-10 Integration Surface
        |
        v
bounded performance + correctness harness
        |
        +--> 100k progressive Browse
        +--> stale/cancel/history/restore correctness
        +--> scheduler interference with real heavy authority
        +--> read/materialization fail-closed evidence
        +--> resource/handle/memory steady-state observations
        +--> Windows/macOS platform QA evidence
        `--> existing Query V2 100k/1M no-regression gates
```

The result should make W1-12 a closeout/current-truth Track, not the first place where Foundation performance problems are discovered.

## 2. Preflight facts that must be preserved

### 2.1 Current integration baseline

W1-10 merged as PR #81 at `master@1920c3c254992f90335e7c57df4fab819fd6062b`.

The reviewed W1-10 surface already preserves:

- one shared `BrowseService` for Browse / W1-09 Change / W1-07 ephemeral resolution;
- backend-only W1-07 Read Gate authority;
- shared W1-08 `ThumbnailService`;
- `WorkScheduler::global()` for already-integrated scheduler-aware work;
- async/spawn-blocking Tauri boundaries and short cancellation paths;
- atomic Thumbnail request reservation;
- binary Thumbnail IPC;
- process-local Browse history/session ownership with fresh cross-process restore;
- strict Browse cancel identity;
- fail-closed Preview identity and Location unknown-evidence behavior;
- existing Query V2 / watcher / mutation / schema authorities.

Do not regress these while adding measurements or scale hardening.

### 2.2 Existing performance harness does not yet include File Workspace

The current performance manifest has Search, Scan & Schema, Library & Content and Intelligence suites. W1-11 must add a coherent File Workspace/Foundation performance domain rather than pretending existing database suites prove Ephemeral Browse behavior.

Prefer a dedicated suite/target such as `workspace-foundation` / `file_workspace_performance` if that fits current harness architecture. Naming may differ, but the new suite must use the existing prepared-binary/profile/CI routing conventions instead of inventing an unrelated benchmark runner.

### 2.3 Current Browse limits are a known 100k pressure point

Current `BrowseLimits::default()` is bounded at approximately:

- 32 sessions;
- page size 256;
- 1,024 live path refs;
- 4,096 live entry refs.

W1-10 intentionally fixed progressive page ownership by retaining previously published page batches until supersede/target teardown/session disposal. That is correct for reference validity, but it means a naïve 100k enumeration can hit the current live-ref ceiling long before 100k.

W1-11 must solve/prove this honestly.

Do **not** simply change `4_096` to `100_000` or a huge value and call the gate complete. If bounds/retention/windowing must change, first measure the pressure, then implement the smallest bounded strategy that preserves:

- opaque-ref validity for entries the workspace still owns;
- progressive enumeration;
- Back/Forward path ownership;
- stale-generation safety;
- bounded memory/resource growth;
- no W2 UI assumptions.

A larger fixed bound is acceptable only if evidence shows it is a deliberate bounded working-set design with acceptable release-build resource behavior. A page/window eviction strategy is acceptable only if it does not invalidate entries that the current workspace contract still claims to own. If neither can be done safely without changing the product contract, STOP and report the contract gap.

### 2.4 Existing Query V2 gates are not negotiable

W1-11 must preserve all existing managed-library 100k/1M thresholds. Do not lower, delete, skip, relabel or weaken an existing performance threshold to make the Track pass.

### 2.5 `fileWorkspaceController.ts` is already in the active-review size band

Do not append performance implementation, UI behavior or benchmark fixture logic into the controller. Small lifecycle seams are acceptable only if they belong to the controller's existing ownership responsibility. Put benchmark/harness code in test/performance modules.

## 3. Hard authority invariants

These remain merge-blocking throughout W1-11.

### 3.1 Managed Library remains Query V2

- no Query V3;
- no renderer-side full-library snapshot;
- no Browse state/cursors/pages in Query V2 store;
- existing 100k/1M Query V2 thresholds remain unchanged.

### 3.2 Browse remains ephemeral and process scoped

- no persistence of `BrowseSessionId`, `BrowsePathRef`, Ephemeral `LocationRef` or Ephemeral `EntryRef` as cross-process authority;
- benchmark fixtures may contain physical paths internally, but production/wire APIs must continue using opaque refs after admission;
- performance code must not add a generic raw-path resolver command.

### 3.3 Read Gate remains authoritative

- no benchmark-only bypass of W1-07 to make Thumbnail/Preview faster;
- prior eligibility never authorizes later byte open without revalidation;
- no implicit cloud/provider hydration;
- materialization/permission/identity terminal failures remain fail-closed.

### 3.4 Scheduler remains one process-local admission authority

- no second performance-only scheduler;
- do not duplicate fairness/resource policy in a benchmark harness;
- existing heavy authorities retain job lifecycle; scheduler adapters only lease capacity.

### 3.5 Watcher/reconciliation and mutation authorities remain untouched

- W1-09 remains ephemeral refresh hints;
- do not write managed watcher truth from File Workspace QA;
- no new rename/move/delete/trash authority;
- no schema migration/new durable job/session authority.

## 4. Work decomposition

Use one W1-11 branch/PR, but organize implementation into reviewable sub-phases. Parallel subagents/worktrees are allowed where files do not overlap; shared performance manifest/CI routing has one integration owner.

Recommended order:

### P0 — Harness and evidence plumbing

- add the File Workspace/Foundation performance target/suite to existing performance manifest conventions;
- add CI routing for the new domain;
- add/change-scope tests so File Workspace Foundation changes select the new performance domain;
- preserve prepared-binary identity and exact-head validation semantics;
- ensure performance temp/fixture roots are repository/worktree-local, not system `C:` when worktree is on another drive;
- add a concise machine-readable or log-stable metric format for W1-11 measurements.

Do not duplicate the entire CI performance job. Extend/reuse current patterns cleanly. If `.github/workflows/ci.yml` becomes repetitive or hard to review, make the smallest maintainability refactor needed, but do not rewrite CI wholesale.

### P1 — 100k Ephemeral Browse scale/backpressure

Build a real filesystem benchmark/QA fixture that exercises the actual W1 Browse path, not only a synthetic vector.

Required evidence:

1. backend admission succeeds on the real fixture;
2. first useful page is returned before full enumeration completes;
3. enumeration can progress through the entire 100k logical directory workload without OOM/hang/full-scan-first;
4. page/cursor generation identity remains correct;
5. live ref/page/path ownership remains bounded by a documented strategy;
6. all owned refs/session state return to steady state after teardown;
7. no raw path becomes renderer/frontend authority;
8. no Query V2 store is involved.

Fixture guidance:

- use zero/small-byte entries so the benchmark measures enumeration/ownership rather than disk payload generation;
- include enough directories to exercise `BrowsePathRef` pressure, not only 100k files;
- if a full 100k mixed-directory fixture is too expensive for every local run, separate fast focused fixtures from the exact-head extended/full performance fixture;
- fixture creation/setup time must be excluded from Browse latency measurements;
- fixture creation may be cached/prepared if integrated cleanly with current performance fixture infrastructure.

Metrics to record at minimum:

- fixture entry count;
- requested/effective page size;
- time to first useful page;
- total enumeration wall-clock (observational/diagnostic unless a stable threshold is explicitly approved);
- pages/batches emitted;
- peak live entry refs/path refs/page batches where observable;
- final live refs/sessions after dispose;
- failure/backpressure count/retries if the bounded design uses them.

W0 target values such as first useful local batch <= 250 ms p95 remain targets. Do not silently redefine them. Shared CI runner variance may make a target unsuitable as a hard wall-clock gate on the first baseline; if so, record the measurement and keep the structural hard gates (progressive, bounded, no hang/OOM) deterministic. Do not turn a flaky timing number into false confidence.

#### Controller/integration honesty

The 100k evidence must not bypass W1-10 by benchmarking only a private low-level helper if the integration ownership model would still fail at 4,096 refs.

At minimum prove both:

- real Rust `FileWorkspaceRuntime` / shared `BrowseService` filesystem scale;
- headless frontend/controller page/history cleanup semantics at scale using deterministic mocks or an equivalent integration seam.

The controller test does not need 100k DOM/UI nodes; W2 virtualization is out of scope. It does need to prove that the ownership strategy used by production integration can advance through the logical workload without unbounded registry growth.

### P2 — Generation invalidation / cancellation / restore correctness

Add deterministic failure-path QA around the integrated surface.

Required:

- stale cursor/page rejected after invalidation/re-enumeration;
- rename/delete/create burst while paging cannot append stale generation into the current view;
- pending Browse start can be cancelled promptly;
- published enumeration can be cancelled by exact identity;
- rapid target switches do not leak sessions/pages/monitors/previews/thumbnails;
- root -> nested -> deeper -> Back -> Forward preserves live in-process opaque refs;
- history truncation releases unreachable pins;
- controller/runtime dispose returns resources to steady state;
- cross-process restore locator always creates fresh session/location/path refs;
- old process-scoped refs fail after dispose/restore.

#### Tauri cancellation boundary

W1-10 moved blocking work behind async/spawn-blocking commands. W1-11 should strengthen this with a real command/IPC-level cancellation harness if the current Tauri test seam can do so without building W2 UI.

Preferred evidence:

```text
request command still pending
        +
cancel command enters independently
        -> backend task observes cancellation
        -> request returns cancelled/stale
        -> registries return to steady state
```

If a true Tauri IPC harness requires broad unrelated app/window infrastructure, do not fake it. Keep the existing runtime concurrency regressions, add the smallest command-boundary proof available, and explicitly report the remaining native IPC QA item.

### P3 — Scheduler interference with real heavy authority

This is a W0 hard gate.

The test must exercise at least one **existing real heavy authority through its real scheduler adapter/lease path**. A scheduler-only synthetic queue is insufficient.

Use current authorities rather than inventing a dummy durable job system. The existing managed scan/reconciliation adapter is an expected candidate. W1-08 ThumbnailService already uses Scheduler admission where its renderer is available.

Required scenarios should establish:

- sustained/background heavy work is admitted through the real adapter;
- foreground/Interactive File Workspace work remains usable and is not indefinitely blocked;
- Background work also eventually progresses (no starvation);
- cancellation releases leases promptly;
- scheduler queue/lease counts return to steady state;
- platform policy does not accidentally admit forbidden background work under a deny state.

Cross-platform evidence may differ:

- Windows: use real managed scan pressure plus foreground Browse/integration activity and scheduler diagnostics; do not pretend unsupported native Thumbnail exists.
- macOS Apple Silicon: additionally exercise native/scheduler-sensitive Thumbnail or another existing native heavy path where practical.

The W0 target that foreground latency under background pressure should generally remain within 2x idle is a measurement target. Establish idle vs pressured release-build measurements and report them. Promote to a hard threshold only if the harness is stable enough; do not weaken the target to hide a regression.

### P4 — Read/materialization/location failure matrix

Required automated evidence where fixtures are trustworthy:

- valid local source eligibility and actual byte consumer revalidation;
- source disappears/replaces between earlier eligibility and open -> fail closed;
- stale identity -> `identity_changed`/terminal equivalent, not fallback byte read;
- permission/unavailable path fails closed;
- Thumbnail/Preview does not implicitly hydrate provider placeholders;
- disconnected/unavailable Browse target can be cancelled/left promptly;
- change overflow/uncertainty leads to refresh/reconciliation behavior, not false completeness;
- no false managed mass deletion semantics are introduced by ephemeral Browse failure.

Location capabilities currently remain `unknown()` where W1-04 lacks trustworthy runtime evidence. W1-11 must test that this fail-closed behavior is honest. It may add the smallest trustworthy evidence adapter only if it already has a real platform authority to project. Do not infer `canBrowse`, provider identity or materialization from pathname/platform labels.

### P5 — Resource / memory / handle steady-state evidence

W0 requires W1 observational release-build baselines.

Record, separately per supported platform where the runner/fixture can provide trustworthy values:

- idle process RSS;
- 10k Browse RSS;
- 100k Browse peak/settled RSS;
- before/after 100 Preview lifecycle cycles;
- before/after repeated target-switch cycles;
- file descriptor/handle count before/after relevant cycles;
- internal File Workspace registry counts before/after.

Internal registry/lease/page/ref counts are hard correctness evidence and must return to bounded steady state.

RSS/OS handle absolute ceilings remain observational unless W0 already defines a hard value. However **unbounded monotonic growth is a hard failure**.

Do not add a large production monitoring subsystem just to collect test metrics. Prefer test/performance-only platform helpers or existing native facilities. If trustworthy current-RSS/handle collection cannot be implemented without a new dependency/broad platform subsystem, STOP and report that specific measurement gap rather than fabricate numbers. A small test-only native helper is acceptable if maintainable and reviewed.

### P6 — Existing managed-library regression matrix

Final W1-11 exact-head validation must re-run existing performance architecture and Query V2 performance gates, including the full profile where current harness supports it.

Required:

- existing Query V2 100k common/complex thresholds remain green;
- existing 1M Query V2 gates remain green under full validation;
- existing search/scan/schema/intelligence performance suites selected by full validation remain green;
- no threshold is relaxed.

The final PR head should use the repository's `full-validation` routing/label mechanism if available so the evidence includes the full performance profile rather than only a change-scoped subset. If label/application is unavailable, report that and run the equivalent approved full profile explicitly.

## 5. Performance suite / CI routing requirements

W1-11 should leave a reusable regression path for future File Workspace changes.

Expected properties:

- File Workspace source/harness changes route to a dedicated File Workspace/Foundation performance domain;
- changing generic performance workflow/manifest still runs all required domains as current governance expects;
- prepared binary manifests remain commit/profile/build-identity bound;
- consumer shards refuse mismatched binaries/fixtures;
- exact-head CI evidence is unambiguous;
- docs-only successors do not masquerade as production performance validation;
- task-owned fixture/cache paths follow repository cleanup rules.

If adding a new performance suite requires fixture manifest generalization, do it coherently. Do not special-case one absolute developer path or encode `F:\`/`C:\` in the harness.

Add/update tests for:

- performance manifest selection;
- CI change classification/routing;
- prepared target identity if a new target exists;
- architecture guard so the File Workspace performance gate cannot silently disappear later.

## 6. 100k Browse bounds / retention decision protocol

This is a deliberate review point.

Before changing production bounds, capture the current failure/pressure mode on a representative large fixture.

Then choose the smallest design that satisfies the frozen contracts. Possible classes include, but are not limited to:

- evidence-backed larger fixed live-ref bounds;
- bounded page/ref working-set management with safe ownership transitions;
- another bounded scheme consistent with opaque refs and future virtualization.

Whichever design is chosen, document in code/tests/PR:

1. why the current 4,096/1,024 limits were insufficient for the W0 100k gate;
2. what the new bound/window is;
3. why it remains bounded;
4. how page/EntryRef validity is preserved for frontend-owned items;
5. how Back/Forward directory path refs remain valid;
6. what happens when the bound is reached;
7. memory/resource measurements supporting the choice;
8. teardown proof.

Do not introduce a durable directory snapshot/cache authority merely to pass the benchmark.

## 7. Platform QA matrix

Supported product matrix remains:

### Windows 11 x64

Automate what can be made deterministic and record what remains human/native fixture work:

- local NTFS path;
- long/Unicode names;
- directory disappearance/rename while paging;
- permission/unavailable failure where CI can reproduce it safely;
- cancellation under slow/blocking fixture;
- resource/handle steady state;
- Scheduler pressure with managed scan;
- no unsupported native Thumbnail success claim.

Real removable-drive unplug/replug, SMB offline/reconnect and OneDrive placeholder behavior require real fixtures if CI does not provide them. Mark them verified/unverified individually; do not infer success.

### macOS Apple Silicon

- local APFS path;
- long/Unicode/package/symlink cases where safe;
- directory disappearance/rename while paging;
- cancellation and resource steady state;
- macOS Activity/Thermal scheduler policy tests;
- native Quick Look Thumbnail lifecycle where current fixture permits;
- provider/read-gate fail-closed regressions.

Intel macOS remains out of scope.

Real external APFS/exFAT, SMB and iCloud/File Provider placeholder behavior require real fixtures if CI does not provide them. Mark them verified/unverified individually.

## 8. Evidence classification

Every reported result must be one of:

- **HARD PASS** — deterministic required gate passed on exact head;
- **TARGET MET** / **TARGET MISSED** — measured target, with actual values;
- **OBSERVED** — baseline measurement without approved hard ceiling;
- **UNVERIFIED** — fixture/platform evidence was not actually available;
- **BLOCKED** — required hard evidence cannot be produced safely with current architecture/fixture.

Never convert `UNVERIFIED` into `PASS` because compilation or a unit test succeeded.

## 9. Required deterministic tests

At minimum, add focused coverage for the final implementation:

### Browse scale/ownership

1. first page publishes before full large-directory enumeration;
2. 100k logical filesystem enumeration progresses to completion or to the explicitly reviewed bounded paging model without hidden full-scan-first;
3. prior live page refs remain valid while still owned;
4. bounded ref/page/path strategy does not grow monotonically without limit;
5. release/teardown invalidates released refs;
6. directory-heavy fixture exercises path-ref pressure;
7. final session/ref counts return to steady state.

### Generation/cancellation/history

8. stale cursor rejected after re-enumeration/invalidation;
9. stale late page cannot publish into a new generation;
10. pending request-id cancellation works;
11. published enumeration-id cancellation works;
12. rapid switch cancels current-target disposable work;
13. nested Back/Forward retains live exact path refs;
14. history truncation releases unreachable refs;
15. cross-process restore creates fresh refs and old refs fail.

### Scheduler/resource

16. real managed scan/resource adapter participates in interference test;
17. foreground work is not indefinitely blocked by sustained background work;
18. background work eventually progresses;
19. cancellation releases lease/resources;
20. queue/lease counts settle.

### Read/location

21. eligibility/open race revalidates and fails closed on replacement/disappearance;
22. no implicit hydration path is introduced;
23. unavailable/unknown Location capability remains fail closed without trustworthy evidence.

### Preview/Thumbnail lifecycle

24. repeated Preview create/start/cancel/dispose returns registry/handle state to baseline;
25. Thumbnail queue/request/cache temp state returns to steady state after repeated cancel/switch cycles;
26. native/platform unsupported paths remain explicit.

### Harness/governance

27. File Workspace changes select the new performance suite;
28. performance suite cannot silently disappear from manifest/architecture guard;
29. exact-head prepared binaries/fixtures reject mismatched identity;
30. existing Query V2 performance thresholds remain unchanged.

## 10. Maintainability gate

Do not solve W1-11 by creating:

- a multi-thousand-line `file_workspace_performance.rs`;
- a giant new `performance.rs` inside production File Workspace code;
- another huge branch in `ci.yml` copied four times;
- benchmark logic inside `fileWorkspaceController.ts`;
- a second scheduler/read/location authority hidden behind QA terminology.

Use responsibility-driven decomposition. A reasonable test-only shape could be:

```text
src-tauri/tests/
  file_workspace_performance.rs
  support/file_workspace_perf/
    fixture.rs
    metrics.rs
    browse.rs
    interference.rs
    lifecycle.rs
```

This is guidance, not a mandatory layout.

If a production file crosses the repository maintainability review signals, explain why or decompose before adding another independent responsibility.

## 11. Explicit non-goals / forbidden scope

Do not implement in W1-11:

- W2 File Library three-pane UI;
- List/Grid visual design or 100k DOM rendering;
- breadcrumbs/Context Panel/Inspector product UI;
- W3 rich Preview providers;
- floating/pinned Preview host UI;
- Finder Quick Look extension;
- Windows Explorer Preview Handler/Space integration;
- Query V3;
- unmanaged recursive/global filesystem search;
- managed watcher rewrite;
- second Read Gate/materialization engine;
- new filesystem mutation/recovery authority;
- auto cloud hydration;
- OCR/RAG/AI Preview/Agent/MCP;
- Intel macOS/Linux;
- schema migration/new durable authority;
- broad unrelated performance refactors;
- lowering existing performance thresholds.

## 12. Stop / escalate conditions

STOP and report instead of broadening W1-11 if any required gate appears to need:

- schema migration;
- new durable database/session/job authority;
- a different filesystem mutation/recovery contract;
- Query V3 or a second indexing/search engine;
- weakening W1-07 revalidation/materialization semantics;
- renderer raw-path/native-handle authority;
- managed watcher/reconciliation replacement;
- lowering Query V2 or other existing CI performance thresholds;
- a broad scheduler redesign rather than a focused bug fix;
- a product-visible W2/W3/W4 feature;
- a new supported platform;
- a fake/synthetic 100k test that bypasses the failing production ownership layer;
- fabricated RSS/handle/provider evidence when a trustworthy fixture is unavailable.

If 100k Browse cannot satisfy the frozen contract within a bounded process-local model, stop and present the measured failure plus design options for architecture review.

## 13. Suggested subagent/worktree parallelism

After P0 establishes the shared performance manifest/routing contract, disjoint work may proceed in parallel:

- Track A: 100k Browse fixture/scale/backpressure;
- Track B: cancellation/history/restore failure matrix;
- Track C: scheduler interference with real managed-scan authority;
- Track D: resource/handle metrics + platform-specific QA seams.

Rules:

- each subagent uses a separate worktree;
- only one owner edits shared `performanceManifest.mjs`, `classifyCiChanges.mjs`, `ci.yml` and common fixture manifests at a time;
- subagents do not independently change production bounds in conflicting ways;
- all results integrate into the single W1-11 branch/PR;
- no subagent may mark the PR Ready or merge.

## 14. Validation sequence

Run focused checks first, then full exact-head gates.

Expected minimum local validation, adapted to actual changed files:

```text
focused File Workspace performance tests
focused Browse/integration/controller lifecycle tests
focused WorkScheduler + managed-scan adapter tests
focused Read Gate / Thumbnail / Preview lifecycle tests
performance manifest/routing/architecture tests
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run verify:rust
npm run build:check
npm run verify:security
npm run test:docs
npm run test:governance
git diff --check
```

Run the new File Workspace/Foundation performance suite in release mode.

Before final review, run the repository-approved **full performance profile** on the exact production head (prefer the existing `full-validation` PR routing/label so existing 1M gates also execute). Record all run IDs and exact SHAs.

If a docs-only successor is added after production validation, clearly distinguish:

- production-validation head;
- docs-only final head;
- CI for each.

## 15. Test artifact hygiene

Follow repository rules strictly:

- use ignored task/worktree-local temp roots;
- on Windows do not default large 10k/100k fixtures to system `C:` if worktree is on another drive;
- performance fixtures should live under repository-local `.tmp-performance-fixtures` / task-specific equivalent unless the existing harness requires another approved path;
- clean task-owned working copies, temp caches, generated reports and fixture trees at completion unless they are intentional reusable ignored caches documented by the harness;
- never delete unrelated shared Cargo/node caches merely to claim cleanup;
- report exact residual paths if cleanup is blocked.

Do not time fixture deletion/creation as Browse performance.

## 16. Completion report

When implementation is complete, report exactly:

1. production exact-head SHA and final head SHA if docs-only successor exists;
2. branch and PR number;
3. W1-11 sub-phases completed and any parallel worktrees used;
4. changed files and module structure with approximate LOC for new/expanded files;
5. new performance target/suite names and CI routing behavior;
6. 100k Browse fixture shape and why it is representative;
7. current vs final Browse live-ref/page/path bound/retention design;
8. first-page / total enumeration / peak live ownership measurements;
9. idle vs pressured scheduler-interference measurements and real heavy authority exercised;
10. cancellation/history/restore evidence;
11. Read Gate/materialization/location failure evidence;
12. resource/RSS/FD/handle observations by platform;
13. existing Query V2 100k/1M performance results with unchanged thresholds;
14. exact-head CI/full-validation run IDs;
15. HARD PASS / TARGET / OBSERVED / UNVERIFIED matrix;
16. platform/native fixtures actually tested vs not tested;
17. task-owned temp cleanup and residual paths;
18. maintainability review and files crossing active-review line-count bands;
19. proof no schema/new durable authority/Query V3/watcher/read/mutation system was created;
20. explicit recommendation whether F4 may proceed to W1-12 or remains blocked by hard evidence.

Keep the PR Draft. Do not mark Ready, merge or start W1-12. Wait for independent architecture/performance/correctness/maintainability review.
