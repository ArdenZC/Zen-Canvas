# Issue #366 — macOS managed-scan admission busy-timeout investigation

**Status:** Root cause qualified for Owner review; no production fix is proposed.
**Baseline:** `origin/master` at `58062c5c356969f332f19c7458028bf2e097595e` (2026-10-10).
**Investigation branch:** `investigate/issue-366-macos-managed-scan-busy-timeout`.
**Draft PR:** [#367](https://github.com/ArdenZC/Zen-Canvas/pull/367).
**Issue:** [#366](https://github.com/ArdenZC/Zen-Canvas/issues/366).

## Scope and guardrails

This is an independent P0 investigation of the repeated macOS Native Performance failure in the ignored, explicitly selected test `db::queries::scan::tests::managed_scan_admission_fails_closed_after_busy_timeout_without_partial_authority`. It does not change production behavior, SQLite policy, scheduler behavior, timeout thresholds, search, schema, IPC, AI, or other tracks. Source changes are limited to test-only (`cfg(test, feature = "performance-test-tauri")`) diagnostic markers and failure-path test diagnostics for Issue #366, plus a narrow CI routing correction and contract test so edits to the Rust file containing this test select the existing Native macOS Performance lane. The routing correction adds coverage; it does not relax a gate. The investigation report records the resulting all-domain 100k routing behavior, with no Full Validation / 1m profile selected.

The historical failed GitHub runs remain intact. A later pass is treated as a separate observation and does not replace either failure.

## Source baseline and execution path

At baseline SHA `58062c5c356969f332f19c7458028bf2e097595e`:

- `src-tauri/src/db/connection.rs::configure_connection` sets WAL, `synchronous=NORMAL`, foreign keys, temp store and mmap size, then calls `conn.busy_timeout(Duration::from_secs(5))`.
- `Database::open` creates an r2d2 SQLite pool with max size 8 and min idle 1. The `HeldManagedScanWriter` consumes one pooled connection and holds `BEGIN IMMEDIATE` until the test releases it; the fixture has a 20-second safety release.
- `src-tauri/src/db/queries/scan.rs::Database::admit_managed_scan` resolves and hashes the request, gets a pooled connection, and starts `transaction_with_behavior(TransactionBehavior::Immediate)` through `begin_managed_scan_write_transaction!`. This path does not call `WorkScheduler`; admission is a synchronous database operation.
- The test sends its `started` signal immediately before calling `admit_managed_scan`, then waits up to 10 seconds on a capacity-one result channel. Therefore the existing panic text identifies the **test result-channel receive timeout**, not a SQLite error code or a production timeout result.
- Before the diagnostic change, neither the test nor the caller logged whether the contender had acquired a pool connection, entered `BEGIN IMMEDIATE`, returned `SQLITE_BUSY`, or was delayed before running. The two failure logs alone cannot distinguish those states.
- `scripts/performanceManifest.mjs` selects this ignored test as the `workspace_foundation_sqlite_admission_timeout` scenario; `scripts/runPreparedPerformanceBinary.mjs` invokes the prepared binary with `--exact --ignored --nocapture --test-threads=1`.

The #345/#349 investigation report, `docs/project/tasks/ISSUE-345-MANAGED-SCAN-SQLITE-CONTENTION-ROOT-CAUSE-INVESTIGATION.md`, proved controlled single-writer SQLite contention and atomic fail-closed behavior, while leaving the earlier natural hosted failure's exact operation and SQLite code unresolved. That historical finding is context, not proof of #366's cause.

## Hosted macOS evidence and timeline

| Run / source | Native macOS evidence | Interpretation |
|---|---|---|
| [38026682784](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38026682784), PR head `b7ff5bda49bf45a13f526bb6e241502adbad1091`; job [114138992324](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38026682784/job/114138992324) | D1 short writer-lock control passed (`elapsed_ms=408`). D2 began at `05:28:06.608Z`, then at `05:28:16.788Z` panicked at `scan.rs:3626` with `timed out waiting on channel`; test duration 10.16 s. | Recurrent receive timeout. No SQLite primary/extended code or admission stage was logged. Downloaded job-log SHA-256: `c8ee58d00da4d3a8c34910210b65d322322c65f42075c68163b9c0cbef9823e9`. |
| [38056013797](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38056013797), PR head `50c95b42227b479f6ed3f3746d2fce26ad8d3a17`; job [114224702884](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38056013797/job/114224702884) | D1 passed (`elapsed_ms=439`). D2 returned the expected plain `SQLITE_BUSY` (`primary=5`, `extended=5`), no partial authority; measured elapsed was `9,219 ms` and the test passed in 9.28 s. Overall run passed. | Confirms the fixture can produce a real `SQLITE_BUSY` result on macOS Hosted. The observation is close to the test's 10 s receive deadline and does not explain why two other observations exceeded it. Downloaded job-log SHA-256: `105a4d825a294620db1916dfba58a18c8e52a584527d31867b8e55756f242180`. |
| [38064775222](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38064775222), master head `58062c5c356969f332f19c7458028bf2e097595e`; job [114250183816](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38064775222/job/114250183816) | D1 passed (`elapsed_ms=399`). D2 began at `15:52:17.650Z`, then at `15:52:27.845Z` emitted the same channel-timeout panic; test duration 10.21 s. The overall master run failed and the macOS Quality lane failed closed after Native Performance failed. | The newest exact-source failure, still without an underlying SQLite result or stage marker. Downloaded job-log SHA-256: `bee0ca31c6d550e7e913282e60b06e97b3f29910d1ec7115cbc51c06a27014b4`. |
| [38068879734](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38068879734), PR head `40b5b7f95880b3fc5981cbeba0b97155edf25302`; Native macOS job [114262149859](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38068879734/job/114262149859), attempt 1 | macOS arm64 Hosted. D2 observed holder and contender barriers, `admission_entered`, `pool_connection_acquired elapsed_ms=0 busy_timeout_ms=5000`, then `before_begin_immediate`. The real transaction returned plain SQLite `BUSY 5/5` at `16:54:17.350Z`, 8.807 s elapsed, with `partial_authority=false`; test passed. D3 independently returned `BUSY 5/5` after 9.409 s and later succeeded after release. Native job and overall run succeeded. | This falsifies pool acquisition delay for this sample and proves the held writer causes the observed BUSY result inside the transaction. It leaves only about 1.2 s between this D2 observation and the unchanged 10 s receive deadline. It does not reproduce the timeout panic or establish why historical samples exceeded the deadline. Downloaded Native job-log SHA-256: `bfba60e956ef8b6ecd29cb98c8a8e6690356dd177f9aea6b31ca83800a80f910`. |
| [38068879734](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38068879734), attempt 2, targeted Native job [114264864189](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38068879734/job/114264864189) | Same PR HEAD and macOS arm64 Hosted runner class. Pool acquisition again logged `0 ms`, `busy_timeout_ms=5000`, and immediate entry to `BEGIN IMMEDIATE`. D2 returned plain `BUSY 5/5` after `9,751 ms`, with no partial authority, and passed in 9.82 s. D3 returned `BUSY 5/5` after 8.889 s, rolled back atomically and succeeded after release. Native job and workflow attempt 2 succeeded. | This second, separate process reproduces a D2 wall duration within 249 ms of the test's 10 s channel deadline. Together with retained failures at 10.16/10.21 s, it qualifies the deadline-crossing mechanism. It still does not identify why a 5,000 ms SQLite busy setting takes nearly 10 s of hosted wall time. Downloaded Native job-log SHA-256: `9f06e5e51e34800ccf7a56b9e9268c274f54e39d4e5f402844dd14b8651c3bd1`. |

The two retained failing runs and the separate passing run are all macOS arm64 Hosted observations. The successful observation is evidence that the controlled fixture and admission path can reach the expected SQLite error; it does **not** erase either failure or prove that the failures were scheduling-only.

## PR reproduction routing observation

The first Draft PR CI run, [38067423702](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38067423702) at PR head `332525f23695b07d06ae36b6d6cf69db55efc3b5`, passed Source checkout, Change scope, and Validation lane plan, but the Native macOS Performance job was **skipped**. This was not a test pass and provided no reproduction evidence. The route classifier selected Scan/Schema performance for `src-tauri/src/db/queries/scan.rs`, but its Native Performance path list omitted that source file even though the `workspace-foundation` suite runs the Issue #345 admission test.

That first PR run completed **SUCCESS** after the required selected checks completed: Windows and macOS Rust quality, Windows and macOS release compile, Scan/Schema performance shard, and Performance profile all passed. The Native macOS Performance job `114257910490` remained **SKIPPED**, as did unrelated routed lanes; the successful aggregate therefore contains no evidence about the failing test.

The branch now adds the exact scan-query source path to the Native macOS performance classifier and a routing contract test. This tightens CI selection for the source containing the regression test; it does not relax a gate. Because changes to the routing classifier intentionally select the existing all-domain **100k** validation set, the follow-up CI executed those 100k suites. It did not select Full Validation or its 1m profile. The first run remains recorded as a skipped Native lane.

Follow-up run [38068879734](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38068879734) completed SUCCESS at PR head `40b5b7f95880b3fc5981cbeba0b97155edf25302`. Attempt 1's routed Native macOS job `114262149859` and targeted attempt 2 job `114264864189` both completed SUCCESS. Windows and macOS Rust quality and release compile, all six 100k shards, Windows Global Index service qualification, and the Quality aggregates completed successfully. The targeted rerun is a separately retained attempt 2; attempt 1 and both original master failures remain intact.

## Falsifiable hypotheses

| Hypothesis | Evidence that would support it | Evidence that would falsify or leave it unresolved |
|---|---|---|
| SQLite lock wait exceeds the test's 10 s receive deadline | Two diagnostic samples entered `BEGIN IMMEDIATE` immediately and returned real `SQLITE_BUSY 5/5` after 8.807 s and 9.751 s with `PRAGMA busy_timeout=5000`. The second sample passed only 249 ms inside the channel deadline. | The two new diagnostic samples returned just before 10 s; the old failed logs did not record SQLite error codes. |
| Pool/connection initialization delay consumes most of the deadline | A delayed `pool_connection_acquired` stage would support this. | Falsified in both diagnostic attempts: pool acquisition was 0 ms and `BEGIN IMMEDIATE` entry followed immediately. |
| Channel/worker synchronization race | A stage marker arriving only after the test deadline, or a delayed/missing worker result after lock release, would support this. | Not observed in either diagnostic attempt: both contenders entered admission immediately and delivered the actual SQLite BUSY result via the result channel. |
| Production admission fails to return boundedly or leaves partial authority | A diagnostic attempt remaining in `BEGIN IMMEDIATE` past 10 s, or any persisted root/session/run after BUSY, would support this. | Not observed: both diagnostic attempts returned `BUSY 5/5` before the deadline and reported `partial_authority=false`; deterministic #345 evidence also established rollback. |
| Hosted runner scheduling / SQLite busy-handler wall-time variance | Original channel failures ended at 10.16/10.21 s. Current transaction wall time varied from 8.807 to 9.751 s despite the same 5,000 ms connection setting. The second sample leaves only 249 ms. | The exact split between SQLite busy-handler timing and OS scheduling was not measured; neither is proven as the source of the wall-time spread. |

The failure trigger is qualified: the fixture holds a real SQLite writer lock, `admit_managed_scan` blocks in `BEGIN IMMEDIATE`, and its `SQLITE_BUSY` response can arrive within only 249 ms of the test's independent 10 s result-channel deadline. The retained failures at 10.16/10.21 s terminate with exactly `timed out waiting on channel`; their original logs predate stage instrumentation, so they do not independently identify the in-flight stage. The near-deadline controlled samples provide direct evidence for the lock-wait/result-channel deadline race as the CI failure mechanism. They rule out connection-pool delay and a WorkScheduler/channel deadlock in the instrumented reproductions. No evidence shows a production admission or partial-authority defect.

The reason the nominal 5,000 ms SQLite busy setting maps to 8.807–9.751 s of Hosted wall time remains unresolved between SQLite busy-handler timing and OS/runner scheduling. This residual does not change the qualified explanation for why the test's 10 s channel watchdog intermittently wins the race.

## Diagnostic reproduction

The bounded reproduction keeps the existing 5 s SQLite timeout, 10 s result-channel deadline, 20 s lock-holder safety release, and all existing assertions unchanged on the passing path. Test-only instrumentation is restricted to request keys beginning `issue366-` and records:

1. The writer's `BEGIN IMMEDIATE` barrier and contender call-boundary barrier.
2. Admission entry, pooled-connection acquisition time, actual connection `PRAGMA busy_timeout`, and entry/success of `BEGIN IMMEDIATE`.
3. On a channel timeout only, an explicit release of the fixture writer followed by one result wait bounded to 3 s; the test still fails and reports whether the contender then returned and joined.

This distinguishes connection-pool delay from a transaction-lock wait and tests whether the held writer release unblocks the contender, without adding retries or changing production policy. The targeted test could not be run in this Cloud Linux container because `glib-2.0 >= 2.70` development files are missing and the environment denies writes to the apt package index. This Linux limitation is not macOS evidence; the required reproduction is the Native macOS Hosted job.

**Hosted diagnostic result:** two instrumented macOS arm64 attempts passed with `SQLITE_BUSY 5/5`; D2 elapsed 8.807 s and 9.751 s. Neither changed the deadline or connection policy.
**Windows applicability:** no Windows-specific production code is changed. Windows Hosted CI remains useful for compiling and running the test-only build, but cannot qualify the macOS arm64 failure mechanism.
**macOS result:** Native job passed in workflow attempts 1 and 2; the exact panic did not recur, but attempt 2 observed only 249 ms margin to the receiver timeout. The original master failures remain preserved and are not overwritten by these passes.
**Production fix:** none authorized or included.

**Codex Review:** not run, per the standing instruction.

## Current disposition

**ROOT CAUSE QUALIFIED — READY FOR OWNER REVIEW.** The macOS CI failure mechanism is a race between the test's 10 s result-channel watchdog and a real SQLite `BUSY` wait in `BEGIN IMMEDIATE`: the observed Hosted wait reached 9.751 s, and the retained failures terminate just after the channel deadline. The original failure logs lack stage instrumentation, so the exact internal stage for those two runs cannot be recovered. The instrumented reproductions rule out pool acquisition delay and a WorkScheduler/channel deadlock for the reproduced path; no production admission or partial-authority defect was observed. Why a 5,000 ms SQLite busy setting takes 8.807–9.751 s of Hosted wall time remains unverified. No timeout was raised, no assertion or gate was relaxed, no retry was added, no production fix was attempted, and no historical failure was overwritten. The test-level remedy, if any, needs Owner review because the task forbids increasing the timeout threshold.
