# ZB-02 — Idle Polling Removal — Result

**Disposition: READY FOR OWNER REVIEW**

| Item | Identity |
| --- | --- |
| Branch | `perf/zb-02-idle-polling-removal` |
| Baseline | `master@f6a4785b3532b8b5e4fa9d428efdc51961e83bf7` |
| Taskbook starting HEAD | `480bb5df138293765e33c28fca778b0b896385a8` |
| Production HEAD validated | `77058cded7f117164b824e262d7b4cb11eb517e7` |

All three scopes were integrated on this branch. The production validation listed below applies to the production HEAD above; this result document is a docs-only closeout successor.

## Before and after

| Source and code owner | Before | After and wake mechanism | Remaining timeout |
| --- | --- | --- | --- |
| Managed AI — `src-tauri/src/global_index/managed_worker_hardened.rs` (`ManagedAiWorker` / `run_worker`), with eligibility producers in `ai/settings.rs`, `global_index/{repository,managed_scope,legacy_queue}.rs`, and `db/queries/organization/mod.rs` | Worker woke about every 250 ms, rechecked policy/settings, and probed the durable queue while idle. | Capacity-one in-memory wake signal coalesces eligibility changes; producers signal after durable queue/eligibility changes, startup recovery is picked up, child completion wakes refill, and shutdown explicitly wakes the worker. SQLite remains the queue authority. True idle blocks without a timeout. | 5-second bounded recheck only when eligible work is known to be pending but temporarily blocked by the macOS activity policy. It does not run in true idle. |
| Managed File Watcher — `src-tauri/src/watcher.rs` (bounded input worker and reconciliation scheduler), with scan completion signaling in `scanner.rs` | Idle receive timeouts and a one-second all-roots reconciliation loop periodically woke the worker and queried roots. | Worker blocks on its bounded channel. Filesystem events wake it and reconcile affected roots; settings/root lifecycle and scan completion explicitly schedule reload/reconciliation. Overflow and notify failures retain durable reconciliation state. Stop/lifecycle signals wake or cancel waits. | 150 ms coalescing only after a real filesystem event. Reconciliation-error retries are bounded at 250 ms, 500 ms, 1 s, and 2 s; rule recovery retries are 250 ms and 500 ms. Per-root durable retry waits are one-shot and cancellable. No idle reconciliation timer remains. |
| Overview — `src/views/scanner/ScannerView.tsx` (`refreshIfVisible` and event subscriptions) | A recurring 5-second technical-status interval refreshed the mounted Overview. | No recurring interval. Refresh occurs on visible activation/mount, watcher-health signature changes, terminal managed scan/analysis events, and analysis-findings-published events. Hidden-page events are ignored; unmount invalidates pending refreshes and unregisters listeners. | None. |

## Remaining operation timers

The following adjacent timers remain operation-scoped and are not Overview or watcher idle polling:

- `useScanManagerStore.waitForManagedSession` and `useBackgroundIndexerStore.waitForManagedBackgroundSession` check every 250 ms only while a managed scan session is active, then stop at a terminal state.
- `scanner.rs` retries a managed resource lease every 25 ms only while an active scan is queued and waiting for a lease. Scan progress is batched at 200 ms while scan work is producing progress.
- Scan rule recovery uses at most two delays (250 ms and 500 ms); watcher retry bounds are listed above. These are failure-triggered retries, not recurring idle work.
- The existing Global Index coordinator 2-second runtime loop remains unchanged and out of scope for this Track. The active Content Understanding view's 2-second progress refresh is also outside the Overview status surface and was not changed.

## Focused checkpoint evidence

| Scope | Focused validation |
| --- | --- |
| Managed AI | `cargo test --manifest-path src-tauri/Cargo.toml --lib wake` — 5 passed. The deterministic check-to-wait wake test `queued_work_wakes_idle_worker_and_child_completion_refills_queue` passed after the test-only readiness handshake was added. |
| Watcher | `cargo test --manifest-path src-tauri/Cargo.toml --lib --features performance-test-tauri watcher::tests` — 27 passed. |
| Overview | `npm test -- --run tests/overviewHealthIntegration.test.tsx` — 33 passed; `npm run typecheck` — passed. |
| Integration adjustment | After Clippy identified a scan-work argument grouping issue and watcher retry-map type complexity, `cargo test --manifest-path src-tauri/Cargo.toml --lib scanner::tests` — 15 passed, and the focused watcher suite — 27 passed. |

The AI wake integration test initially exposed a SQLite `DatabaseBusy` race in its check-to-wait setup. A test-only readiness handshake now signals at that exact boundary; the targeted test and final full suites pass. Production wake behavior is unchanged by the handshake.

## Final Track validation

All final Track commands were run after the three scopes were integrated, against production HEAD `77058cded7f117164b824e262d7b4cb11eb517e7`.

| Validation | Result |
| --- | --- |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS — library: 963 passed, 0 failed, 23 ignored; integration targets passed (including AI provider 29, classification 1, dedupe 12, cleanup/restore 62). |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS |
| `npm run verify:rust` | PASS — includes desktop-runtime tests (987 library tests) and Clippy. |
| `npm run test:performance:architecture` | PASS — architecture guard and 28 tests across 3 files. |
| `npm run verify:security` | PASS, exit 0. `npm audit --audit-level=high` reported two moderate Vitest / `@vitest/mocker` advisories below the configured failure threshold. `cargo audit` loaded 1,267 RustSec advisories and scanned both lockfiles; crates.io yanked-metadata requests timed out in the isolated audit home, but the command completed successfully. The user's existing Cargo advisory database was left untouched. |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 150 files, 1,607 tests. |
| `npm run test:remediation` | PASS — 14/14. |
| `npm run build:frontend` | PASS; emitted CSS `var(...)`, dynamic-import, and large-chunk warnings. |
| `npm run check:rust:release` | PASS |
| Repository-routed extended performance suites | PASS — Search 100k (broad query p95 about 30.426 ms against a 100 ms threshold); Managed Scan and schema 100k suites; Intelligence 100k analysis/publication plus Dedupe, Organization Plan, and Rule Proposal suites. |
| Windows native file-hardening smoke | PASS on the exact production HEAD; test reported fixture cleanup complete, no real app data access, and unchanged canary. Its temporary `C:\zen-canvas-final-hardening-...` path was verified absent afterward. |

The hosted macOS lane was not executable on this Windows host and remains for the Draft PR's hosted checks. The first standard `npm test` attempt discovered Rust-generated fixtures under the task temp root; those task-owned fixtures were sent to the Recycle Bin and the unfiltered suite was rerun successfully.

## Change boundary

- Schema changes: **NONE**.
- Durable authority changes: **NONE**. SQLite remains the Managed AI queue authority; watcher reconciliation remains backend-owned.
- New dependency or framework: **NONE**.
- `STATUS.md` / `ROADMAP.md`: **UNCHANGED**.
- ZB-03 started: **NO**.
- Global Index 2-second redesign, ResourceGovernor redesign, WebView lifecycle, Search Mini Runtime, and W6/RC1/release state: **NOT STARTED / UNCHANGED**.

## Changed files

- `src-tauri/src/ai/settings.rs`
- `src-tauri/src/db/connection.rs`
- `src-tauri/src/db/queries/organization/mod.rs`
- `src-tauri/src/global_index/legacy_queue.rs`
- `src-tauri/src/global_index/managed_scope.rs`
- `src-tauri/src/global_index/managed_worker_hardened.rs`
- `src-tauri/src/global_index/repository.rs`
- `src-tauri/src/global_index/tests.rs`
- `src-tauri/src/scanner.rs`
- `src-tauri/src/watcher.rs`
- `src/views/scanner/ScannerView.tsx`
- `tests/overviewHealthIntegration.test.tsx`
- `docs/project/tasks/ZB-02-IDLE-POLLING-REMOVAL-RESULT.md` (this result)

## Findings for owner review

- Two moderate npm advisories remain below the repository command's `high` threshold; no dependency files were changed.
- Frontend build completed with the warnings recorded above.
- Hosted macOS validation remains pending the PR CI environment.

**READY FOR OWNER REVIEW**
