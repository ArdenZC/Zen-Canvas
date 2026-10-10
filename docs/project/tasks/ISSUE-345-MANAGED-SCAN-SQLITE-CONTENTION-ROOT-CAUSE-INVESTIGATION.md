# Issue #345 — Managed-scan SQLite contention root-cause investigation

**Date:** 2026-10-09  
**Investigation branch:** `investigate/issue-345-managed-scan-sqlite-lock`  
**Source candidate:** `395d360038f841a9f64a3391f65b76b3f1408a51`  
**Source tree:** `94c952d7dfd8dde185df71d3e30e3d68a9353dc4`  
**Starting master:** `9fe67765a94998b1659edd0f41242867fa3c749b`  
**Evidence PR:** [#349](https://github.com/ArdenZC/Zen-Canvas/pull/349)  
**Observed CI:** [run 37933879292](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37933879292) (attempts 1–3)

## Disposition and evidence limits

**SQLITE CONTENTION MECHANISM PROVED — HOSTED STRUCTURAL FAILURE NOT REPRODUCED.**

Deterministic tests demonstrate that real managed-scan DB writers sharing the product SQLite pool contend for its single writer slot. When a writer remains held past the configured five-second busy timeout, `admit_managed_scan` and `persist_scan_batch` return a bounded plain `SQLITE_BUSY` (primary/extended `5/5`) without partial transaction mutation. Contention shorter than the timeout waits and succeeds.

The original hosted scan failure occurred once and the specific historical DB API, primary/extended SQLite result code, and causal relationship to foreground admission are **UNRESOLVED**. Three subsequent observations at the exact investigation source candidate show **structural HARD PASS** with no natural SQLite lock. These facts do not establish a new production defect or justify speculative production remediation.

The `pressure/idle <= 2x` target remains unchanged. Historical Windows qualifications previously missed this target; the retained residual was explicitly Owner-accepted without changing the benchmark threshold. New target misses are still reported as misses and must not be reclassified as target passes or proof of a newly introduced regression.

## Historical evidence

[Run 37877475010, attempt 1](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37877475010):

- First retained error: `Managed scan run w1-11-managed-scan-2 failed: database scan operation failed: sqlite error: database is locked`.
- Foreground wait: **35,349 ms** against the **30,000 ms** boundary; foreground admission not preserved.
- `scan_runs_settled_without_failure=false`; scheduler/runtime eventually settled.
- Idle/pressure first-page p95: **181 / 684 µs**, **3.78x target miss**.
- Historical exact DB operation: **UNVERIFIED**.
- Historical SQLite primary/extended code: **UNVERIFIED — historical log did not retain SQLite result code**.

Attempt 2 of the same run:

- No observed natural lock; foreground wait **4,844 ms**, admitted `true`.
- Background progress, scan settlements and scheduler/runtime settlement passed.
- Idle/pressure p95: **192 / 675 µs**, **3.52x target miss**.

## Managed-scan write authority and transaction map

Real path: `start_performance_managed_scan` → `admit_managed_scan` → `run_managed_session` / WorkScheduler background lease → traversal without DB transaction → durable batch/progress persistence → reconciliation, phase transitions, optional optimization/warnings → finalize/cancel → optional dedupe dispatch.

All relevant writes share the `Database` r2d2 pool and the existing WAL / `synchronous=NORMAL` / 5-second busy timeout policy.

| DB operation | Existing transaction / authority | Evidence |
| --- | --- | --- |
| `admit_managed_scan` | `BEGIN IMMEDIATE`; atomically creates session/run/root lease authority | Short-held writer waits; over-timeout writer returns BUSY fail-closed |
| `claim_queued_scan_run` | `BEGIN IMMEDIATE`; transitions run/root/session state | Plausible contention point; not assigned historical failure |
| `persist_scan_batch` | `BEGIN IMMEDIATE`; file / seen / error / counters and revisions, up to 500 entries per batch | Deterministic BUSY `5/5`, atomic rollback, then successful write after release |
| `reconcile_missing` | `BEGIN IMMEDIATE`; stale-file reconciliation/revisions | Potential competitor, no historical attribution |
| `transition_scan_run_phase` | `BEGIN IMMEDIATE`; phase/session update | No historical attribution |
| `run_search_index_optimize` / `record_scan_warning` | `PRAGMA optimize` individual statement; warning persistence via `BEGIN IMMEDIATE` | Errors remain observable; no historical attribution |
| `finalize_scan_run` | `BEGIN IMMEDIATE`; terminal state and root-lease release | Finalize itself may fail under DB error, leaving durable state unsettled |
| cancellation / recovery / dedupe | Existing subsystem `BEGIN IMMEDIATE` write paths | Possible competitors, not proven source |

Test instrumentation on the branch is restricted to test/performance-test builds. It does not alter release transaction, scheduling, resource-grant, retry, cancellation or durable authority semantics.

## Deterministic observations

Isolated temporary databases and real pool connections were used. Writer ownership/release is controlled by channel barriers, rather than opportunistic random thread scheduling.

| Test | Attempt 1 | Attempt 2 | Attempt 3 | Interpretation |
| --- | ---: | ---: | ---: | --- |
| D1: short writer lock, admission succeeds | 294 ms | 280 ms | 303 ms | Existing busy-handler wait/success |
| D2: writer exceeds timeout, admission fails atomically | 5,217 ms | 5,219 ms | 5,234 ms | SQLite primary/extended `5/5`, no partial session/root/run |
| D3: held writer, batch persistence fails atomically | 5,175 ms | 5,235 ms | 5,297 ms | SQLite `5/5`, rollback; later same write succeeds |
| D4: real concurrent managed scans | 366 ms | 454 ms | 378 ms | Competing writer waits for owner, later acquires/commits |
| D4: foreground scheduler admission | 113 ms | 206 ms | 131 ms | Foreground admitted; cancellation, run and scheduler settlement pass |

D4 establishes real managed-scan writer overlap on the existing production WorkScheduler and scanner authority. It **does not** recreate the historical natural scan failure.

## Exact-head Windows qualification

Run `37933879292`, attempts 1–3: same HEAD/tree, `windows-latest` Windows Server 2025 runner class, 100,000-entry fixture, five real scan roots (each 18,000 files + 2,000 directories), four pressure slots.

| Attempt | Idle p95 | Pressure p95 | Ratio | Foreground wait | Admission | Structural / natural SQLite lock |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| 1 | 98 µs | 658 µs | 6.71x | 1,142 ms | Yes | HARD PASS / no lock |
| 2 | 221 µs | 452 µs | 2.05x | 1,189 ms | Yes | HARD PASS / no lock |
| 3 | 191 µs | 834 µs | 4.37x | 3,669 ms | Yes | HARD PASS / no lock |

Every observation retained background progress, successful scan settlement, and scheduler/runtime settlement. All three remain **TARGET MISSED** for the unchanged 2x ratio; **0/3 natural structural SQLite locks** occurred. Six intentionally induced BUSY outcomes in D2/D3 are passing test evidence, not spontaneous qualification failures.

The three workflow attempts returned SUCCESS, including the routed relevant Workspace Foundation, performance and platform quality checks. The Windows Global Index service qualification was classifier-skipped as **not required** in this PR, not reported as PASS. Local Cargo compilation was restricted by missing `glib-2.0 >= 2.70` development files; hosted Windows/macOS Rust/performance qualification provides the actual compilation/test evidence.

## Relationship to #328

**SHARED SQLITE CONTENTION MECHANISM ONLY**.

#328 concerns startup/recovery and Global Index / Settings / watcher-related writers. #345 concerns concurrent managed scans. Both have controlled evidence for SQLite single-writer `SQLITE_BUSY=5`, but neither historical failure's exact DB operation/result code is proven. Do **not** declare shared root cause, transfer a #328 remediation to #345, or administratively merge the issues.

## Owner safety and follow-up boundaries

- No production remediation has been authorized or included; no package, Schema or IPC change.
- Preserve original failed hosted evidence and the historical accepted latency residuals.
- Do not weaken the 2x target, 30-second foreground boundary, 15-second background-progress boundary or routed CI gates.
- Do not add global SQLite mutexes, broaden busy timeout, add generic retries, modify scan/scheduler parallelism or alter durable scan authority.
- Further production change requires a **specific causally proven operation/stage**, a bounded fail-closed proposal and a separate Owner review.
- #329's Windows frozen native failure scene remains separate; Windows local does not perform development.
- Investigation evidence being merge-ready must not be represented as the historical structural failure being fixed.
- No Codex Review was used.

**Research/evidence conclusion:** the tested structural failure is **not reproduced**, the common SQLite single-writer mechanism is **proved**, and the historical exact cause remains **unresolved**.
