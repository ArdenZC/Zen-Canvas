# ZB-01 — Database Resident Footprint — Codex / Agent Brief

Status: **OWNER-DIRECTED PRE-INTEGRATION IMPLEMENTATION — do not merge autonomously**

Baseline: `docs/zb-00-runtime-resource-lifecycle-freeze` after the ZB-00 freeze and Master Development Plan refinement.

Intended implementation branch: `perf/zb-01-database-resident-footprint`

ZB-01 is the first deliberately narrow implementation Track under the Zero-Burden direction.

It exists to validate the Zero-Burden workflow with one small, measurable runtime change:

> **reduce SQLite connection-pool resident footprint without reducing reviewed burst capacity or changing any durable database/query authority.**

This Track MUST NOT absorb ZB-02 polling removal, ZB-03 ResourceGovernor, WebView lifecycle, Global Search provider work, AI lifecycle, schema work or product redesign.

Because ZB-00 has not yet been merged into current project truth, this branch is owner-directed pre-integration work only. It may be implemented and validated on its own branch, but it must not update `STATUS.md` / `ROADMAP.md`, Ready/merge itself or claim the project initiative changed.

---

## 0. Required read set

Read completely before editing:

1. `AGENTS.md`
2. `docs/project/README.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
6. `docs/project/ARCHITECTURE_MAP.md`
7. `docs/project/DEVELOPMENT_WORKFLOW.md`
8. `docs/project/CODE_MAINTAINABILITY.md`
9. `docs/project/tasks/ZB-00-RUNTIME-RESOURCE-LIFECYCLE-FREEZE.md`
10. this taskbook.

Inspect current production/test owners directly:

- `src-tauri/src/db/connection.rs`
- `src-tauri/src/db/mod.rs`
- `src-tauri/src/db/tests.rs`
- relevant DB/query tests that repeatedly open or clone `Database`
- `src-tauri/Cargo.toml`
- current runtime composition in `src-tauri/src/main.rs` only to understand ownership; do not change it in ZB-01.

Before changing code, verify the actual r2d2 version and current builder semantics from the locked dependency/source. The current manifest uses r2d2 0.8. Do not rely on a remembered API if the local dependency source says otherwise.

---

## 1. Current production fact

Current `Database::open()` contains:

```rust
let manager = SqliteConnectionManager::file(&path).with_init(configure_connection);
let pool = Pool::builder().max_size(8).build(manager)?;
```

There is no explicit `min_idle`.

For r2d2 0.8, `min_idle = None` is treated as the configured `max_size` when establishing the initial/minimum pool population.

Therefore the current configuration can establish/maintain up to the full configured pool population even when Zen is otherwise idle.

This is a resident-footprint issue, not a query-correctness defect.

---

## 2. Objective

Change only the pool's idle-residency policy while preserving its bounded burst capacity.

Target semantic shape:

```text
Resident / idle:
minimal idle SQLite connections

Interactive:
connections may grow on demand

Heavy bounded work:
connections may grow up to the existing reviewed max

Settled again:
pool may return toward the configured idle minimum
```

The initial implementation candidate is:

```text
max_size = 8
min_idle = 1
```

Do not treat those numbers as a reason to touch any other DB tuning.

If direct tests reveal that `min_idle = 1` is incompatible with current startup/migration correctness, STOP and report the evidence instead of compensating with unrelated architectural changes.

---

## 3. Hard scope

### Allowed production change

Prefer the smallest cohesive change in:

- `src-tauri/src/db/connection.rs`

Expected shape:

```rust
Pool::builder()
    .max_size(8)
    .min_idle(Some(1))
    .build(manager)?
```

Exact constants/helper naming may improve if it makes tests clearer, but do not create a general database configuration subsystem.

### Allowed test/diagnostic seams

ZB-01 may add narrowly scoped DB-pool inspection needed to prove the change, for example:

- a `#[cfg(test)]` or crate-private pool-state snapshot helper;
- constants for max/min pool size that tests can assert;
- deterministic tests using `Pool::state()`;
- a bounded test-only contention fixture proving the pool can grow above the idle minimum and return connections to idle after leases drop.

Prefer test-only/crate-private seams.

Do not add a renderer-facing/Tauri diagnostics API merely for this Track.

### Allowed documentation/evidence

A ZB-01 result/evidence note on the implementation branch is allowed.

Do not update project-level current truth yet:

- no `STATUS.md`;
- no `ROADMAP.md`;
- no initiative activation;
- no release/current-stage claims.

---

## 4. Explicit non-goals

ZB-01 MUST NOT change:

- SQLite schema or migrations;
- `files.id` or any durable identifier;
- query semantics;
- transaction semantics;
- WAL mode;
- `synchronous`;
- `foreign_keys`;
- `temp_store`;
- `mmap_size`;
- busy timeout;
- connection manager type;
- SQLite/r2d2/rusqlite versions;
- Cargo dependencies/lockfile merely for this task;
- Global Index DB ownership;
- File Library Query V2;
- Content/Analysis/Dedupe/Organization/Rule authorities;
- startup sequencing;
- retention prune behavior;
- AI worker lifecycle;
- watcher polling;
- Global Index polling;
- Overview polling;
- Main/Search WebView lifecycle;
- WorkScheduler policy;
- supported-platform truth;
- installer/service behavior;
- W6/RC1/release/publication state.

Do not opportunistically “improve” unrelated PRAGMAs or connection timeout values.

---

## 5. Required correctness tests

Add focused tests that prove at least the following.

### 5.1 Configuration contract

After opening a fresh test database:

- pool max size remains `8`;
- configured minimum idle is exactly `Some(1)`;
- opening the DB and running migrations succeeds.

### 5.2 Idle initialization

After pool initialization settles:

- the pool does not require eight established idle connections merely because `max_size=8`;
- the observed state is compatible with the new `min_idle=1` contract.

Avoid brittle sleep-heavy timing if r2d2's initialization guarantees make a deterministic assertion possible.

### 5.3 Elastic growth

Prove the pool is not accidentally capped at one connection:

- obtain/hold multiple pooled connections concurrently;
- confirm the pool grows above one while demand exists;
- do not exceed the existing maximum.

This can use a small number such as 2–3 concurrent leases; the test is about elasticity, not load testing.

### 5.4 Lease return

After pooled connections drop:

- the pool remains usable;
- connection leases are returned correctly;
- ordinary subsequent DB work succeeds.

ZB-01 does not need to wait for or tune idle reaping beyond the current library semantics.

### 5.5 Existing DB behavior

Existing migration/query/transaction tests remain green.

No existing DB test should need semantic expectation changes merely because fewer idle connections are pre-created.

---

## 6. Measurement / evidence requirement

ZB-01 is the first Zero-Burden measurement Track, so it must produce evidence rather than only a code diff.

At minimum capture:

### A. Logical pool evidence

Before:

```text
max_size = 8
min_idle = None
effective initial/minimum target = max_size
```

After:

```text
max_size = 8
min_idle = Some(1)
```

Record observed `Pool::state()` values from deterministic tests or a narrowly scoped test harness.

### B. Process evidence where practical

On the available Windows development host, compare a clean, settled run before/after if reproducible:

- process Private Working Set / PrivateUsage if existing repository tooling supports it;
- thread count;
- handle count;
- DB connection count from the internal test/diagnostic seam.

Do **not** invent a numeric memory win if OS/WebView/background variability prevents attribution.

If process-level delta is too noisy, report it as inconclusive and keep the deterministic pool-state proof.

### C. No-regression evidence

Record exact commands, result and implementation head.

---

## 7. Validation order

Run focused validation first.

At minimum:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml db::
```

If the repository's test module names make `db::` filtering incomplete, run the smallest relevant focused filters plus the full Rust unit suite needed to cover DB consumers.

Then run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```

Then applicable repository gates selected by current project workflow/routing. At minimum review whether the change requires:

```bash
npm run test:performance:architecture
npm run verify:rust
npm run verify:security
```

Do not rerun native GUI/release qualification merely for a DB pool configuration change unless repository routing legitimately requires it.

Do not weaken or update existing performance thresholds to make ZB-01 green.

---

## 8. Maintainability gate

Before completion, review:

1. Is the production change local to existing DB connection ownership?
2. Did the Track avoid creating a generic configuration framework?
3. Is any pool-state seam test-only or appropriately crate-private?
4. Did no renderer/Tauri API gain internal pool details?
5. Did no schema/query/durable authority change?
6. Is the burst maximum still preserved?
7. Are tests deterministic rather than timing/flakiness driven?
8. Is the task still understandable as “resident DB footprint” and nothing broader?

If any answer fails, shrink the change.

---

## 9. Stop conditions

STOP and report instead of broadening the task if:

- `min_idle(Some(1))` causes a correctness failure that appears to require query/schema/startup redesign;
- implementation needs a new scheduler;
- implementation needs a new DB abstraction;
- implementation appears to require changing SQLite PRAGMAs;
- implementation requires schema/migration changes;
- implementation needs renderer-visible diagnostics;
- tests reveal a separate connection leak/resource leak;
- existing tests rely on eight simultaneous DB connections in a way that represents a genuine product requirement;
- resolving the issue requires ZB-02 polling work or ZB-03 ResourceGovernor;
- production diff expands materially outside DB connection ownership;
- any W0–W6 safety authority would change.

A newly discovered separate defect should be recorded as a follow-up finding, not repaired opportunistically.

---

## 10. Deliverables

Required branch output:

1. minimal production patch;
2. focused deterministic tests;
3. `docs/project/tasks/ZB-01-DATABASE-RESIDENT-FOOTPRINT-RESULT.md`.

The result must record:

- baseline;
- final branch/head;
- changed files;
- exact pool config before/after;
- focused/full validation;
- observed pool state;
- process-level evidence or explicit “inconclusive/not measured”;
- regressions/findings;
- confirmation of zero schema/query/authority changes;
- recommendation: `READY FOR OWNER REVIEW` or `BLOCKED`.

Do not update `STATUS.md` or `ROADMAP.md`.

---

## 11. Git / PR discipline

Create/use:

```text
perf/zb-01-database-resident-footprint
```

Base it on the exact owner-provided ZB documentation head, not an older master that lacks ZB-00.

Keep the branch focused.

Do not:

- merge;
- mark a PR Ready;
- delete branches;
- start ZB-02;
- change publication/release truth.

If a PR is opened, keep it Draft until owner review.

---

## 12. Definition of Done

ZB-01 is complete for owner review only when:

1. pool burst maximum remains 8 unless the owner explicitly re-opens that decision;
2. explicit idle minimum is 1;
3. DB open/migration remains correct;
4. deterministic tests prove configuration and elastic growth;
5. existing DB/Rust validation is green;
6. no schema/query/PRAGMA/dependency/authority change occurred;
7. evidence/result document exists;
8. process-level resource evidence is honest about attribution/measurement limits;
9. diff contains no ZB-02+ work;
10. final review blockers are zero;
11. Codex stops and reports instead of merging or starting the next Track.
