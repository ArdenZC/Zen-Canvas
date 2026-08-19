# CI-O — Full & PR CI Latency / Redundancy Remediation

Status: active infrastructure remediation — starts from the R2-merged baseline and must complete before R3 begins.

Base/master at activation:

`c3ee881c2580b1bfe2268e0c0e907e10b1949eb8` (PR #96 R2 squash merge)

Branch:

`fix/ci-latency-redundancy-optimization`

This is one remediation, one branch, one Draft PR and one final acceptance review. Independent implementation streams may be worked in parallel, but they converge into this single CI-O result. Do not split the work into separate optimization Tracks or PRs unless an unexpected authority/security boundary makes a split mandatory.

## 0. Goal and non-negotiable rule

Reduce CI feedback latency and redundant runner work without weakening evidence, coverage or release confidence.

The governing rule is:

> remove duplicate work and unnecessary cache invalidation; do not remove validation.

The following remain unchanged unless an explicit architecture decision is approved:

- 100k race coverage;
- 100k/1M performance coverage;
- 10 GiB native streaming coverage;
- existing performance thresholds and HARD/TARGET classifications;
- Windows and Apple Silicon macOS gates;
- package/release/security checks;
- existing required status contexts and Ruleset enforcement;
- ADR-0004 exact-head / merge-integration evidence semantics;
- fail-closed behavior for missing/invalid evidence;
- fork PR least-privilege behavior.

CI-O is infrastructure/test orchestration work. It must not change product runtime behavior.

## 1. Required reading and preflight

Read and treat as binding before editing:

1. `AGENTS.md`;
2. `docs/project/README.md`;
3. `docs/project/STATUS.md`;
4. `docs/project/ROADMAP.md`;
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`;
6. `docs/project/DEVELOPMENT_WORKFLOW.md`;
7. `docs/project/CODE_MAINTAINABILITY.md`;
8. `docs/project/ARCHITECTURE_MAP.md`;
9. `docs/project/DECISIONS/0004-ci-source-and-merge-evidence.md`;
10. this taskbook;
11. `.github/workflows/ci.yml`;
12. `.github/workflows/ci-full.yml`;
13. `.github/workflows/release-build.yml`;
14. `scripts/ciEvidence.mjs`;
15. `scripts/ciValidationPlan.mjs`;
16. `scripts/classifyCiChanges.mjs`;
17. `scripts/performanceBuildIdentity.mjs`;
18. `scripts/performanceFixtureIdentity.mjs`;
19. `scripts/preparePerformanceBinaries.mjs`;
20. `scripts/preparePerformanceFixtures.mjs`;
21. `scripts/runPerformanceSuite.mjs`;
22. current CI/workflow/performance contract tests;
23. relevant macOS race/native performance tests and environment-variable consumers.

Use an isolated worktree. Record branch, HEAD, current `origin/master`, merge-base, changed paths and current PR state before editing. Stop on unrelated changes.

Do not assume `STATUS.md` or `ROADMAP.md` text predating the R2 squash merge changes the activation truth above. The architecture reviewer will update live current-truth prose in this same CI-O PR before merge; do not independently rewrite project governance unless specifically requested.

## 2. Baseline evidence to preserve

### R2 product baseline

R2 merged through PR #96 at:

`master@c3ee881c2580b1bfe2268e0c0e907e10b1949eb8`.

R2 final pre-merge CI run:

`32183587403` / #742 — success.

CI-O must not regress R2 Browse/Thumbnail contracts.

### Full CI latency baseline

Manual Full Validation baseline:

- run: `32180670898` / #74;
- source: `master@e5b5bd699939739c944cee5d37cc83963a6b560c`;
- conclusion: success;
- end-to-end wall time: approximately 22 minutes 11 seconds.

Observed major costs from the real run:

1. `Rust quality (macos-latest)` was the critical path at roughly 21 minutes;
2. `Native macOS performance (arm64)` ran roughly 18 minutes;
3. the expensive macOS mutation race suite was effectively executed three times through overlapping broad/filter/explicit commands, with individual executions around 346 s, 344 s and 404 s;
4. native macOS performance restored a large Rust cache, then switched to a separate `.performance-cache/target` and performed another cold release compile of roughly 262 s;
5. Full performance binary caching already demonstrated semantic-cache reuse on Windows;
6. first cold-ish Full fixture generation for 100k/1M data cost roughly 318 s and produced a large reusable fixture cache;
7. dependency audit spent roughly 3 minutes compiling/installing `cargo-audit`, while the actual RustSec audit was only a few seconds;
8. package jobs and separate release-compile jobs appear to overlap in compilation responsibility and require proof before any consolidation;
9. 1M benchmark execution itself is not the primary wall-time problem; repeated fixture working-copy restoration contributes materially;
10. a Windows-local full frontend test exposed CRLF/LF sensitivity in a workflow-contract test while Linux CI passed.

These numbers are diagnostic baselines, not permission to lower test scale.

## 3. One remediation, parallel internal work

Implement all safely provable improvements in this single CI-O remediation. Independent streams may be developed in parallel, but they must share one authority model, one branch and one PR.

The required workstreams are below. A workstream that cannot be safely proven may remain unchanged with an explicit `DEFERRED`/`UNVERIFIED` result; do not create another Track merely to avoid making a decision.

## 4. macOS validation de-duplication

Audit every consumer of:

- `ZEN_CANVAS_MACOS_RACE_ITERATIONS`;
- `ZEN_CANVAS_MACOS_EXPANDED_RACE_ITERATIONS`.

Prove exactly which tests consume them.

The Full/PR macOS validation must execute the authoritative 100k race coverage exactly once per validation lane, not through overlapping:

- broad `cargo test`;
- `macos_` filtering;
- explicit `macos_mutation_fail_closed` execution.

Preserve:

- 100,000 race iterations;
- expanded 100,000 race iterations where currently required;
- serial execution where required by the race contract;
- all non-race macOS tests currently covered;
- `native-qa` coverage;
- clippy/format behavior.

Prefer workflow-level de-duplication (`--skip`, precise filters or equivalent) when it is robust and readable. Test-only annotations/helpers inside `src-tauri` are allowed only if workflow filtering cannot reliably express the contract; no production runtime semantics may change.

Also audit the repeated `macos_`, `platform::macos`, `content::eligibility`, native integration and `temp_safety_tests` commands. Remove repeated execution only when the broad test command already proves the same tests under the same feature/environment contract.

Required evidence:

- before: expensive 100k race executions = 3 in the observed Full baseline;
- after: authoritative expensive 100k race execution = 1 per required validation lane;
- coverage remains present and test names/results are inspectable;
- no test is silently lost because a substring filter changed.

## 5. Semantic performance cache unification

Separate two concepts that must not be conflated:

### Content/cache identity

Derived only from inputs that can change the cached artifact/fixture, such as:

- platform/architecture;
- Rust/toolchain inputs when relevant;
- Cargo manifests/lockfile;
- relevant Rust source/build inputs;
- performance suite/profile;
- fixture schema/builder/query/migration inputs;
- other proven semantic inputs.

### Evidence/provenance identity

Includes:

- PR head SHA;
- merge-integration SHA/tree;
- validation lane;
- run/job identity;
- event/ref metadata.

Commit/tree/lane provenance must remain observable under ADR-0004, but must not invalidate a reusable content cache unless it is itself a semantic build/fixture input.

Audit and fix ordinary `.github/workflows/ci.yml` performance binary and fixture cache keys so unrelated tree/lane changes do not force cold regeneration. Align the reusable-cache model with the semantic identities already used successfully by Full Validation.

Do not remove artifact/evidence validation between producer and consumer jobs.

### Fork/untrusted cache safety

Audit GitHub cache behavior for same-repository vs fork/untrusted PR lanes.

Do not allow untrusted PR code to publish a reusable cache that a trusted lane later treats as authoritative unless the cache scope and verification model prove that safe.

A conservative acceptable design is:

- untrusted source may consume safe immutable/reusable caches when allowed;
- untrusted source does not publish into a trusted reusable namespace;
- merge/trusted lane remains the writer where necessary.

Do not introduce `pull_request_target`, privileged secrets or write permissions to improve cache hit rate.

## 6. Native macOS prepared-binary reuse

The Full baseline proved that `Native macOS performance (arm64)` restores a large Rust cache but later changes to a separate performance target directory and performs a new release compile.

Implement a semantic prepared-binary cache/reuse path for the native macOS Workspace Foundation performance suite, analogous in principle to the proven Windows performance prepare architecture.

Requirements:

- key by semantic build identity, platform, arch, suite/profile and other true inputs;
- do not key content reuse on arbitrary PR number/tree/lane;
- on cache hit, skip unnecessary compilation;
- on cache miss, reuse restored Cargo dependency/target state rather than starting a disconnected cold target universe where safely possible;
- preserve binary identity/provenance checks before executing prepared binaries;
- preserve Apple Silicon runner verification;
- preserve 10 GiB stream profile, 100k directory/corpus profile and Workspace Foundation performance coverage;
- no threshold reductions.

Audit repeated Cargo feature/target transitions inside native performance. If a superset feature build or a single preparation step can be proven semantically equivalent, consolidate it in this same remediation. If equivalence is not proven, keep the current execution rather than guessing.

## 7. `cargo-audit` tool startup cost

The security gate must remain complete.

Optimize tool startup by:

- pinning an explicit `cargo-audit` version;
- reusing/caching the installed tool or equivalent trusted binary installation result keyed by OS/arch/Rust/tool version as appropriate;
- keeping the advisory database/audit result fresh according to the current security semantics;
- continuing to report network/advisory-database failures as `UNVERIFIED`/failure according to existing policy, never as success.

Do not pin an old vulnerable version merely for cache convenience.

The actual RustSec audit must still run.

## 8. Release compile vs package-build overlap

Audit Windows and macOS separately.

Determine whether:

- `Release compile (windows-latest)` is strictly subsumed by the NSIS package build under the same source/profile/features/target;
- `Release compile (macos-latest)` is strictly subsumed by the unsigned DMG package build under the same source/profile/features/target.

If strict equivalence is proven, Full Validation may reuse the compile result or allow package success to subsume a duplicate compile obligation while preserving required aggregate semantics.

If equivalence is not proven, keep both jobs. Do not weaken package or release validation merely to improve the timing chart.

For ordinary PR routing where package jobs are intentionally skipped, release-compile coverage must remain available when required.

## 9. Opportunistic fixture/shard improvements

Within this same remediation, audit:

- repeated 1M fixture working-copy restoration;
- unnecessary fixture copies between phases;
- Windows performance shard topology and runner startup/queue overhead;
- independent native profiles that might safely run concurrently.

Apply a change only when it is local, maintainable and demonstrably preserves the same benchmark semantics.

Do not redesign the full benchmark framework solely to chase a timing target. If a larger redesign would be required, record it as `DEFERRED` and leave behavior unchanged.

## 10. Cross-platform EOL robustness

Fix the Windows-local CRLF/LF workflow-contract fragility exposed during R2 validation.

The test must assert workflow semantics rather than fail because the checkout uses CRLF instead of LF.

Preferred approaches:

- normalize line endings in the test before semantic/string assertions; or
- define an explicit repository EOL policy in `.gitattributes` if that is genuinely the intended repository-wide authority.

Do not weaken the actual workflow assertions. The relevant test must pass on Windows and Linux/macOS checkouts.

## 11. Timing and cache evidence

Keep/add only the instrumentation necessary to compare before/after behavior:

- job/phase timing where useful;
- cache hit/miss;
- semantic cache identity;
- race execution count/proof;
- prepared-binary compile time;
- fixture preparation/restoration time.

Do not build a new telemetry platform.

## 12. Allowed scope

Expected implementation surfaces include:

- `.github/workflows/ci.yml`;
- `.github/workflows/ci-full.yml`;
- `.github/workflows/release-build.yml` only when necessary;
- focused CI/performance scripts under `scripts/**`;
- focused CI/performance contract tests under `tests/**`;
- `package.json` only when a focused script entry is genuinely needed;
- `.gitattributes` only if an explicit repository EOL policy is chosen;
- test-only Rust annotations/helpers only when required to express single-execution expensive-test semantics.

Do not modify application/runtime behavior in:

- `src/**`;
- non-test `src-tauri/src/**`;
- database/schema;
- File Workspace authority/runtime contracts;
- R3 Location contracts;
- W2-02 or later product code.

If a proposed CI optimization requires product runtime changes, leave that optimization undone and report it.

## 13. ADR-0004 remains binding

Do not edit or weaken ADR-0004.

Every final PR run must continue to distinguish:

### Head Validation

- expected PR head SHA;
- actual checkout SHA;
- head tree SHA.

### Merge Integration

- base SHA;
- PR head SHA;
- integration commit SHA;
- integration tree SHA.

### Validation plan

- `tree_equivalent`;
- `head_validation_required`;
- `validation_lanes`.

If head and integration trees differ, both required substantive validation lanes must still pass.

Cache reuse must never be used as evidence that a different source tree was validated. Cached binaries/fixtures require their own semantic identity/provenance verification.

Do not change repository Rulesets/settings in this task.

## 14. Required tests

Add/adjust deterministic contract coverage for at least:

1. macOS expensive 100k race gate executes once per required lane;
2. broad macOS test coverage remains present;
3. 100k iteration values remain unchanged;
4. semantic performance binary cache does not depend on irrelevant commit/tree/lane identity;
5. fixture cache does not depend on irrelevant commit/tree/lane identity;
6. changing a true build input invalidates binary cache identity;
7. changing a true fixture input invalidates fixture identity;
8. fork/untrusted cache behavior cannot poison trusted reusable cache authority;
9. macOS native prepared-binary cache hit skips compile;
10. macOS native prepared-binary miss still uses correct source/toolchain identity;
11. 10 GiB and 100k native profile commands/coverage remain present;
12. `cargo-audit` remains executed and tool version is pinned;
13. package/release obligations remain correct for PR and Full routing;
14. ADR-0004 head/merge/equivalence contracts remain unchanged;
15. required Windows/macOS/Performance aggregates remain fail closed;
16. docs-only routing remains docs-only;
17. representative frontend/Rust/native/performance/package routing remains correct;
18. workflow-contract tests are CRLF/LF portable without weakening assertions;
19. pinned GitHub Action policy remains intact;
20. no new privileged fork execution is introduced.

Prefer behavioral/helper tests over brittle text-count checks where practical. Text-level workflow tests are acceptable for stable policy invariants but must be EOL-robust.

## 15. Validation strategy

Develop independent substreams in parallel when safe, then validate the combined final tree.

Run focused tests continuously, but do not trigger a costly Full Validation after every small edit.

Before final push/report, run all applicable local gates, including current equivalents of:

- focused CI/workflow/performance contract tests;
- `npm test`;
- `npm run typecheck`;
- `npm run test:governance`;
- `npm run test:docs`;
- `npm run test:remediation`;
- `npm run test:performance:architecture`;
- workflow YAML parsing/validation;
- `npm run build:check` where applicable;
- `npm audit --audit-level=high`;
- Rust format/clippy/tests only where Rust test-only code is touched;
- `git diff --check`;
- `git diff --check origin/master...HEAD`.

Then inspect REAL GitHub Actions for the final PR head under ADR-0004.

### Full A/B validation

After the implementation has stabilized on one final PR head:

1. run the normal PR CI and verify required contexts;
2. trigger one manual `CI Full Validation` on that exact source commit;
3. if new semantic cache keys make the first final-head Full run cold, trigger a second Full run on the same exact source commit to measure warm steady-state behavior;
4. do not run redundant additional Full validations when the first run demonstrably exercises warm caches.

Compare against baseline Full run `32180670898`.

Record at least:

- total wall time;
- macOS Rust quality duration;
- Native macOS performance duration;
- Performance Prepare duration;
- Dependency audit duration;
- race gate execution count;
- binary/fixture/audit-tool cache hit state;
- package/release job behavior;
- all required aggregate conclusions.

Timing objectives are optimization targets, not permission to weaken correctness:

- warm Full objective: <= 14 minutes;
- stretch goal: approximately 10–12 minutes;
- warm high-risk PR objective: approximately 6–7 minutes where runner scheduling permits.

External hosted-runner queue variance does not by itself fail CI-O. Structural duplicate-work removal and preserved evidence are the hard acceptance criteria.

## 16. Maintainability

Do not solve CI latency by creating one giant orchestration script.

Keep responsibilities separated:

- change/risk classification;
- ADR-0004 source/evidence planning;
- semantic build identity;
- fixture identity;
- prepared-binary production;
- benchmark execution;
- aggregate gate validation.

Reuse existing helpers when they already own the concept. Extract a new helper only when it has one coherent reusable responsibility.

Report material LOC/responsibility changes and why the final layout is easier to maintain than duplicated YAML/scripts.

## 17. Stop conditions

Stop the affected optimization and report instead of improvising if:

- it requires lowering a test iteration count, fixture scale or performance threshold;
- it requires removing 1M/10 GiB/native/security coverage;
- it requires weakening a required check or aggregate dependency;
- it requires changing ADR-0004 semantics;
- safe fork behavior would require `pull_request_target`, secrets or write privilege;
- cross-trust cache publication cannot be proven safe;
- release/package equivalence cannot be proven (keep both and continue other work);
- race de-duplication cannot be proven without hiding tests (keep safe behavior and continue other independent work);
- it requires a product/runtime authority change;
- it requires repository Ruleset/settings mutation;
- unrelated worktree changes are present.

A blocked sub-optimization does not automatically block independent safe CI-O improvements. Record it explicitly and continue the rest of the single remediation when boundaries allow.

## 18. Draft PR and merge boundary

Use the existing branch:

`fix/ci-latency-redundancy-optimization`

Use one Draft PR only.

Title:

`CI: eliminate redundant validation and improve cache reuse`

The PR must remain Draft until independent architecture review and final real-run evidence are complete.

Do not start R3 from this branch.

The architecture reviewer will update `STATUS.md` / `ROADMAP.md` and any final current-truth text in this same PR after implementation acceptance, so no separate closeout PR is required.

## 19. Exit gate

CI-O passes only when all of the following are true:

- the expensive macOS race coverage is not redundantly executed while its 100k contract remains intact;
- reusable binary/fixture caches use semantic content identity rather than arbitrary tree/lane identity;
- native macOS prepared-binary work no longer performs an avoidable disconnected cold compile when reusable state is valid;
- RustSec remains a real executed gate and its tool startup is reasonably reusable;
- release/package overlap is either safely consolidated or explicitly retained because equivalence was not proven;
- CRLF/LF workflow contract tests are cross-platform robust;
- 100k/1M/10 GiB/native/package/security coverage and thresholds remain unchanged;
- ADR-0004 head/merge/equivalence evidence remains intact;
- final required aggregates pass;
- one real optimized Full run exists, plus a same-head warm run when needed to measure new cache steady state;
- no product/runtime behavior changed;
- R3 was not started.

Classify each final conclusion as `HARD PASS`, `OBSERVED`, `UNVERIFIED`, `DEFERRED` or `BLOCKED`.

## 20. Final report

Return one consolidated report containing:

1. worktree, branch, starting/final HEAD, master and merge-base;
2. Draft PR number/state/head;
3. changed files grouped by workflow/scripts/tests/test-only Rust/docs;
4. macOS race de-dup design and exact before/after execution count;
5. proof 100k iteration values and coverage remain intact;
6. ordinary PR binary/fixture cache identity before/after;
7. true semantic cache inputs and invalidation tests;
8. fork/untrusted cache publication/consumption model;
9. macOS native prepared-binary cache design;
10. cache-hit vs cache-miss compile behavior;
11. 10 GiB/100k native coverage preservation;
12. `cargo-audit` version/cache strategy and real audit result;
13. release-compile/package equivalence findings and final behavior for each platform;
14. any fixture/shard/native invocation optimization completed or deferred;
15. CRLF/LF robustness fix and Windows/Linux evidence;
16. focused/local test results;
17. full applicable local validation results;
18. final PR CI run ID and ADR-0004 head/merge/tree/lane evidence;
19. required aggregate results;
20. optimized Full Validation run ID(s);
21. baseline vs optimized timing table for total, macOS Rust, native macOS, Performance Prepare and Dependency audit;
22. cache hit/miss table for baseline/cold/warm where available;
23. performance thresholds/fixture scales before vs after;
24. package/security/native coverage preservation;
25. maintainability/LOC review;
26. task-owned artifact/cache cleanup;
27. `git diff --check` results;
28. HARD PASS / OBSERVED / UNVERIFIED / DEFERRED / BLOCKED classifications;
29. explicit confirmation that repository Rulesets were not modified;
30. explicit confirmation that product runtime behavior was not modified;
31. explicit confirmation that R3/R4/W2-02 were not started.

STOP after pushing the complete CI-O implementation and final evidence to the single Draft PR. Do not begin R3.