# W3-10 — Preview Performance / Cross-platform QA

Status: reviewer-authored taskbook — harness/fixture preparation may begin early; final acceptance is gated on W3-09 merge

Freeze baseline: `master@9950f32452d31699e5a2a70e66ab2c701d4601d1` (W3-06 current-truth closeout)

Branch: `feat/w3-10-preview-performance-qa`

## Goal

Turn the completed W3 Preview Platform into measurable release-gate evidence across latency, rapid switching, resource cleanup, provider-scale fixtures, close-then-mutate behavior and Windows/macOS runtime validation, without weakening existing W1/W2/Query performance gates or inventing a new benchmark authority.

W3-10 is QA/performance hardening, not a feature-expansion Track.

It may make the smallest production/harness fixes required to satisfy already-frozen W3 gates, but it must not:

- add a new Preview provider family;
- add W4 native Finder/Explorer hosts;
- add renderer raw-path or general byte-read authority;
- add a second scheduler/read gate/provider registry;
- weaken Query V2/W2 thresholds;
- silently raise provider limits to make benchmarks pass;
- treat timing TARGET misses as automatic permission to redefine the target;
- perform W3-11 closeout.

---

# 0. Dependency / parallel-execution contract

The reviewed W3 dependency graph places W3-10 after W3-09.

To support dependency-aware parallel development this Track has two phases.

## Phase A — may begin while W3-07/W3-08/W3-09 are still in flight

Allowed early work:

- audit/extend the existing performance harness architecture;
- define Preview performance suite/manifest integration;
- prepare deterministic fixtures and measurement helpers;
- add test-only metric collection;
- prepare browser performance harnesses that consume already-merged providers only;
- add no-regression tests for existing W1/W2/Query gates;
- add resource-count instrumentation using existing registries/scheduler snapshots;
- prepare platform matrix/routing changes where they do not claim final W3 acceptance.

Do not create a final W3-10 implementation PR from a base lacking W3-09.

## Phase B — required for production completion

After W3-09 runtime PR is reviewed and merged:

1. sync this branch to the resulting `master`;
2. resolve provider/harness conflicts without weakening prior bounds;
3. include W3-07 Folder, W3-08 ZIP and W3-09 failure/accessibility integration in the final matrix;
4. run release-build/exact-head measurements and structural gates;
5. obtain Windows 11 x64 and macOS Apple Silicon hosted/runtime evidence;
6. create exactly one Draft PR against current master;
7. keep it OPEN / DRAFT / UNMERGED for independent review.

A Phase-A run is never final W3-10 evidence.

---

# 1. Mandatory read set

Before changing production/performance code, read completely:

1. `docs/project/STATUS.md`
2. `docs/project/ROADMAP.md`
3. `docs/project/initiatives/W3-preview-platform.md`
4. `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
5. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
6. `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
7. `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
8. `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
9. merged W3-01 through W3-09 taskbooks/reviewer evidence available on final base
10. `src-tauri/src/file_workspace/preview.rs`
11. `src-tauri/src/file_workspace/read_gate.rs`
12. `src-tauri/src/file_workspace/preview_*` provider modules
13. `src-tauri/src/file_workspace/integration/`
14. `src-tauri/src/scheduler.rs`
15. `src/fileWorkspace/fileWorkspaceController.ts`
16. `src/views/fileLibrary/preview/`
17. strict provider payload decoders and asset wire
18. `scripts/performanceManifest.mjs`
19. `scripts/runPerformanceSuite.mjs`
20. `scripts/runPerformanceProfile.mjs`
21. `scripts/preparePerformanceBinaries.mjs`
22. `scripts/preparePerformanceFixtures.mjs`
23. `scripts/checkPerformanceArchitecture.mjs`
24. `scripts/classifyCiChanges.mjs`
25. `.github/workflows/ci.yml`
26. W1-11 Foundation performance taskbook/tests
27. W2-11 experience performance/browser evidence
28. existing Query V2 100k/1M performance suites and thresholds.

Use current merged runtime truth, not old planning assumptions.

---

# R0 — Performance authority preflight

Before implementation prove:

## R0.1 Existing performance framework is authoritative

Zen already has a prepared-binary/profile/CI-routing performance framework.

W3-10 MUST extend/reuse that framework rather than creating a disconnected benchmark runner.

Preferred shape:

```text
performance manifest/profile
  → prepared exact binary/fixture identity
  → Preview performance suite
  → stable machine-readable metrics
  → CI routing/aggregate validation
```

A small dedicated Preview suite/target is allowed.
A second unrelated benchmarking system is not.

## R0.2 Existing W3 target values

Freeze the W3 targets without silently changing them:

```text
Preview shell first-visible        <= 100 ms p95 TARGET
local useful Text/JSON/Markdown/
Image representation               <= 300 ms p95 TARGET
native/system useful representation <= 1 s TARGET where applicable
```

W4 native host work is not active in W3, so native/system target may remain N/A/observational for W3 hosts unless a merged provider genuinely uses an existing native internal dependency.

Timing targets are not substitutes for hard correctness gates.

If a target is unstable on shared CI:

- retain it as a TARGET;
- measure/report it honestly;
- keep structural correctness gates hard;
- do not invent a looser number merely to obtain green CI.

## R0.3 Structural hard gates

These remain HARD regardless of timing variance:

- no crash/hang/OOM;
- no stale/wrong source publication;
- bounded requests/tasks/sessions/leases/assets/object URLs;
- final stopped source is the only current representation;
- cancellation/close/dispose frees authority resources;
- no raw-path authority;
- no Query V2/W2 regression;
- no hidden full materialization for scale fixtures.

## R0.4 Measurement honesty

Fixture creation/setup time must be separated from the measured operation where appropriate.

Use release/optimized binaries for runtime timing evidence unless a metric is explicitly a dev/browser interaction metric.

Record:

- exact head SHA/tree;
- fixture identity;
- platform/arch;
- build profile;
- sample count/warmup policy;
- p50/p95 where timing gates require percentile evidence;
- structural resource counters before/peak/after.

Do not compare debug timing to release targets.

---

# 2. Preview performance suite

Add Preview as a coherent domain in the existing performance framework.

Suggested domain/target names may be `preview-platform` / `preview_performance`; exact naming should match current manifest conventions.

At minimum the suite must expose stable metrics for:

- shell first visible;
- provider first useful representation;
- final representation where meaningful;
- rapid-switch request/provider concurrency;
- resource counts/leases/assets before and after cycles;
- Folder enumeration progress/limits;
- close-then-mutate latency/correctness;
- repeated-cycle steady state.

Do not put large benchmark fixture logic into production controllers.

---

# 3. Shell latency

## Gate

Measure Floating Preview shell first-visible from accepted user command/start trigger to shell visibility.

TARGET:

```text
<= 100 ms p95
```

Required conditions:

- shell visibility does not await provider completion;
- source metadata/provider load may still be pending;
- Floating and Pinned handoff do not create duplicate hosts;
- compact Context ownership remains single-modal/focus-owner.

Measure at least:

- warm local Library source;
- warm local Browse source;
- source with slower provider work;
- rapid source switching while shell remains open.

The shell metric must not be artificially satisfied by rendering an invisible/zero-size placeholder.

---

# 4. Local useful-representation latency

TARGET for local built-ins:

```text
Text / source code / Markdown
JSON / YAML / XML
CSV / TSV
Image
<= 300 ms p95 useful representation
```

Measure representative normal local fixtures through the real Preview lifecycle/read gate/provider path.

Do not benchmark only provider parser helpers.

If a provider has intentionally progressive semantics (Folder), measure first useful publication separately rather than forcing full completion into the 300 ms target.

ZIP may have its own metadata-index latency distribution; record first useful/final index timing and reviewer can classify against platform goals.

---

# 5. Rapid switching — 100 entries HARD gate

Exercise at least 100 source changes through the production controller/session lifecycle.

Required outcomes:

- no crash;
- no unhandled rejection/panic;
- no stale/wrong-file final representation;
- bounded number of in-flight provider/start/snapshot/read/asset operations;
- stale source A cannot publish after current B/C/etc.;
- final stopped item is the only current source/representation;
- no duplicate Preview host;
- backend session/provider cleanup returns to bounded steady state.

Include a representative mixed sequence across provider families after all W3 providers are merged.

Do not materialize a 100-item `all_matching` Library selection as IDs solely for this test; use loaded/source-owned entries according to existing selection/navigation contracts.

Use deterministic deferred providers/mocks for correctness and a real runtime mixed fixture for resource/performance evidence.

---

# 6. Close → mutate/open HARD gate

For each byte-reading provider family, prove:

```text
Open Preview
→ Ready or useful representation
→ Close/Dispose
→ immediately Rename / Move / Delete / Open
```

The mutation/open must not be blocked by retained Preview resources.

W3-10 does not add a new mutation authority. Use existing reviewed mutation/filesystem test seams.

At minimum cover:

- Text/Markdown;
- structured/table;
- Image;
- ZIP after W3-08 merge if it holds source-read leases during indexing.

Folder is directory enumeration rather than byte-read; instead prove its temporary Browse session/page/enumeration/scheduler resources are gone before immediate directory mutation/open where the platform fixture permits.

Report platform-specific filesystem behavior honestly.

---

# 7. Repeated-cycle steady state

Run repeated cycles sufficient to expose monotonic leaks.

Recommended baseline:

```text
100 Preview open/start/close cycles
100 rapid source switches
repeated Floating → Pinned → Unpin cycles
```

Observe/record before, peak and after where available:

- Preview session count;
- provider work/tasks;
- scheduler running/queued and resource grants;
- MaterializationReadGate leases;
- open handle accounting;
- decoder slots;
- Preview asset registry entries;
- frontend Blob/object URLs;
- Folder temporary Browse sessions/pages/refs;
- ZIP reader/cache/lease state;
- controller-owned Preview IDs/publication queues/observers;
- process RSS/OS handle/fd count where trustworthy.

Hard requirement:

- internal authority/resource counters return to bounded steady state;
- no monotonic unbounded growth.

RSS/OS-handle absolute values are observational unless an existing spec defines a hard bound, but monotonic unexplained growth is a blocker.

Do not add a large production telemetry subsystem solely for tests.

---

# 8. Folder scale

After W3-07 merge, run real filesystem/backend evidence for:

```text
1k direct children
10k direct children
100k direct children
>100k entry-limit fixture where practical/test-owned
```

Required:

- shell remains first;
- first useful FolderSummary appears before full large traversal;
- progressive snapshots are visible through the actual frontend observation transport;
- direct-child-only semantics;
- <= reviewed publication count;
- O(1)/small bounded aggregation state relative to folder size;
- exact 100k + authoritative EOF may be Complete;
- >100k becomes truthful Partial/entry_limit;
- deadline returns Partial before outer timeout;
- visible Browse enumeration remains isolated;
- temporary Browse session/lease/page refs return baseline.

Measure:

- time to shell;
- time to first useful folder summary;
- final/limit timing as observational;
- pages/entries inspected;
- publication count;
- peak temporary resource counts.

Do not require 100k full completion within a fixed tiny wall-clock if the frozen contract only requires bounded/progressive behavior.

---

# 9. ZIP scale/security performance

After W3-08 merge, include:

- small normal ZIP;
- large entry-count ZIP near reviewed limit;
- corrupt/truncated archive;
- bomb-like declared sizes;
- traversal-like names;
- encrypted/unsupported entry metadata if in task scope;
- cancellation during indexing;
- rapid switch away.

Measure/verify:

- bounded total source bytes read;
- bounded per-read size;
- bounded reader/cache memory;
- bounded entries/tree nodes/depth/wire bytes;
- no extraction/decompression of entry bodies solely for Preview;
- cancellation releases read/scheduler resources;
- hostile metadata cannot cause unbounded seek/read loops.

No benchmark may extract archives to make indexing easier.

---

# 10. Provider fixture matrix

Every merged rich provider family must have at least:

```text
normal
large/bounded
corrupt or malformed
permission/unavailable where authoritative fixture exists
cancel during load
rapid switch away
```

Additional security fixtures remain required according to W3-09.

The final matrix should make it obvious which scenarios are:

- automated hard PASS;
- timing TARGET measured;
- platform-limited;
- native/manual UNVERIFIED.

No missing fixture may be silently called PASS.

---

# 11. W1/W2/Query no-regression gates

W3-10 MUST preserve all accepted existing gates.

At minimum rerun/route:

- Query V2 100k/1M accepted thresholds;
- W1 Workspace Foundation performance suite;
- W2 100k Library/Browse bounded UI/virtualization behavior;
- existing scheduler/read-gate/thumbnail cancellation/resource checks;
- main/search-window permission separation;
- governance/change-scope routing.

Do not:

- delete old performance suites;
- lower thresholds;
- mark failing lanes skipped;
- route Preview changes away from required existing suites merely to save CI time.

CI routing may be optimized only when correctness coverage remains equivalent and governance tests prove it.

---

# 12. Cross-platform matrix

Final W3-10 evidence requires supported-platform hosted/runtime validation for:

## Windows

- Windows 11 x64 runner/runtime evidence;
- Rust tests/clippy/release compile;
- frontend/browser gates where CI supports Chromium;
- filesystem read/close/mutate behavior;
- scheduler/resource cleanup;
- provider fixtures not requiring macOS-only native services.

## macOS

- macOS 13+ Apple Silicon hosted/runtime evidence;
- arm64 verification;
- Rust tests/clippy/release compile;
- native Workspace Foundation performance lane;
- filesystem read/close/mutate behavior;
- scheduler/resource cleanup.

Native interactive visual/accessibility evidence remains separately classified.

Do not infer:

```text
hosted compile PASS => native visual PASS
```

VoiceOver/Narrator/manual provider behavior not executed must remain `UNVERIFIED`.

---

# 13. Browser performance/interaction gate

Add a final integration gate such as:

```text
npm run test:browser:w3-10:real
```

Exact head at:

- 1600×900
- 980×680

Cover at least:

- shell-first behavior;
- multiple provider families;
- rapid switching burst;
- Floating→Pinned→Unpin;
- Folder progressive first useful/final or bounded Partial;
- ZIP normal/bounded rendering;
- terminal/fallback state from W3-09;
- no duplicate hosts;
- no horizontal overflow;
- no console/page errors;
- no unexpected resource/navigation requests;
- object URL cleanup for Image;
- focus/keyboard ownership remains correct under repeated operations.

Browser fixtures may synthesize backend timing/control for deterministic UI evidence, but real provider/runtime performance must also be measured outside the synthetic browser mock.

No correctness sleeps.

---

# 14. Performance statistics

For timing TARGETS:

- define warmup policy;
- collect enough samples for meaningful p95;
- record p50 and p95;
- avoid one-shot claims;
- keep fixture/build startup out of operation timing;
- preserve exact measurement code in repo/harness.

If sample count must be reduced in PR CI for cost, retain a fuller exact-head/local/extended profile and clearly distinguish the two.

Never label an N=1 observation as p95.

---

# 15. Resource counters / failure criteria

Hard fail on:

- leaked Preview sessions after teardown;
- leaked MaterializationReadGate leases;
- scheduler grants/running work not returning baseline;
- stale assets/object URLs accumulating;
- Folder temporary sessions growing across cycles;
- ZIP reader/cache state growing unbounded;
- stale publication/observer loops continuing after close;
- file mutation blocked because Preview retained authority resources;
- final source mismatch after rapid switching;
- OOM/hang/panic;
- new renderer raw-path authority.

A small stable cache may remain only if it is an already-reviewed bounded cache with documented ownership and steady-state bound.

---

# 16. Production-fix discipline

If QA finds a blocker, make only the smallest ownership-correct fix.

Examples of acceptable W3-10 fixes:

- missing cleanup on an existing lifecycle path;
- stale guard omission;
- bounded queue/observer leak;
- missing resource release;
- harness routing/measurement correctness;
- performance regression caused by accidental repeated parse/decode where a bounded existing-result reuse is already architecturally authorized.

Examples requiring STOP/review instead of opportunistic redesign:

- new durable cache/index;
- new Preview engine;
- raw-path IPC;
- new materialization authority;
- large provider bound increases;
- new W4 native host subsystem;
- replacement of BrowseService/Query V2/WorkScheduler.

---

# 17. Validation

During Phase A run focused harness tests plus governance/diff checks.

Final Phase B exact-head validation must include:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend
npm run test:browser:w3-10:real
npm run test:governance
npm run security:audit
npm run security:audit:rust

cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings

npm run test:performance:pr
# plus the exact extended/full Preview performance profile selected by the harness/CI routing

git diff --check
git diff --check origin/master...HEAD
```

Also run all CI-selected release/platform/native/performance lanes.

Temporary fixtures/artifacts must be task-owned and cleaned or intentionally CI-uploaded only on failure according to existing conventions.

---

# 18. Final evidence report

Report at minimum:

- branch/head/tree/base identity;
- exact changed files;
- performance harness architecture change;
- exact metric definitions;
- shell p50/p95;
- local useful representation p50/p95 per applicable family;
- 100-entry rapid-switch result and peak in-flight/resource counts;
- close-then-mutate result per byte provider family;
- repeated-cycle before/peak/after resource counts;
- Folder 1k/10k/100k first-useful/final/progress/resource evidence;
- ZIP bounded-index/security/resource evidence;
- W1/W2/Query no-regression evidence;
- Windows/macOS evidence;
- real-browser evidence classification;
- timing TARGET misses with exact numbers rather than hidden threshold changes;
- native/manual/accessibility items as PASS or `UNVERIFIED` only when actually justified.

---

# 19. PR contract

Use existing branch:

`feat/w3-10-preview-performance-qa`

Do not create final implementation PR until W3-09 runtime merge is on master and this branch is integrated onto it.

Then:

- push normally;
- create exactly one Draft PR;
- obtain fresh exact-head hosted CI;
- keep OPEN / DRAFT / UNMERGED;
- no force push;
- no Ready;
- no merge;
- no W3-11 closeout/current-truth edits;
- no W4 production work.

The final PR must be reviewable as evidence/hardening, not a hidden feature bundle.

---

# 20. Reviewer stop conditions

STOP if passing W3-10 would require:

- weakening an existing hard correctness/performance threshold;
- redefining target metrics after seeing results without reviewer approval;
- new raw-path/byte authority;
- new durable cache/index solely for benchmark performance;
- a second scheduler/read gate/Preview engine;
- hidden full-folder/archive materialization;
- archive extraction;
- implicit materialization/network hydration;
- W4 native integration;
- claiming native/manual evidence not executed.

W3-10 succeeds when Preview remains fast enough to feel immediate, but more importantly stays bounded, cancellable, stale-safe and resource-clean under real scale and repeated use on both supported platforms.