# ZB-02 — Idle Polling Removal — Result

**Disposition: READY FOR OWNER RE-REVIEW**

| Item | Identity |
| --- | --- |
| Branch | `perf/zb-02-idle-polling-removal` |
| Baseline | `master@f6a4785b3532b8b5e4fa9d428efdc51961e83bf7` |
| Taskbook starting HEAD | `480bb5df138293765e33c28fca778b0b896385a8` |
| Initial Track production HEAD with full local validation | `77058cded7f117164b824e262d7b4cb11eb517e7` |
| Owner-review repair production HEAD | `fcd5ad872d492b129d5d5f830b9138de5d73c5bb` |
| Pushed repair candidate validated by Hosted CI | `d1466c4512f4cbed0b0d37d8142322e07dd1ec80` |

All three scopes were integrated on this branch. The initial Track full local validation listed below applies only to `77058cded7f117164b824e262d7b4cb11eb517e7`. The owner-review repair at `fcd5ad872d492b129d5d5f830b9138de5d73c5bb` has the focused validation recorded below. [PR #260 Hosted CI run 35985044270](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35985044270) completed successfully against pushed candidate `d1466c4512f4cbed0b0d37d8142322e07dd1ec80`; this Result status update is docs-only and does not change the production source.

## Before and after

| Source and code owner | Before | After and wake mechanism | Remaining timeout |
| --- | --- | --- | --- |
| Managed AI — `src-tauri/src/global_index/managed_worker_hardened.rs` (`ManagedAiWorker` / `run_worker`), with eligibility producers in `ai/settings.rs`, `global_index/{repository,managed_scope,legacy_queue}.rs`, and `db/queries/organization/mod.rs` | Worker woke about every 250 ms, rechecked policy/settings, and probed the durable queue while idle. The first Track implementation also signaled after every committed Global Index batch. | Capacity-one in-memory wake signal coalesces eligibility changes. A shared atomic interest flag gates ordinary work wakes: after reading durable settings, the worker arms them only while AI is enabled and disarms them while disabled. Unconditional control wakes are reserved for settings/policy/lifecycle re-evaluation. Enqueue helpers report whether eligible pending work was created/reactivated; a Global Index batch sends an ordinary wake only after commit and only when at least one such job exists. No-scope, directory, blocked-policy-only, and already-current/completed cases do not wake. Startup recovery is picked up, child completion wakes refill, and shutdown explicitly wakes the worker. SQLite remains the sole durable queue authority. True idle blocks without a timeout. | 5-second bounded recheck only when eligible work is known to be pending but temporarily blocked by the macOS activity policy. It does not run in true idle. |
| Managed File Watcher — `src-tauri/src/watcher.rs` (bounded input worker and reconciliation scheduler), with scan completion signaling in `scanner.rs` | Idle receive timeouts and a one-second all-roots reconciliation loop periodically woke the worker and queried roots. | Worker blocks on its bounded channel. Filesystem events wake it and reconcile affected roots; settings/root lifecycle and scan completion explicitly schedule reload/reconciliation. Overflow and notify failures retain durable reconciliation state. Stop/lifecycle signals wake or cancel waits. | 150 ms coalescing only after a real filesystem event. Reconciliation-error retries are bounded at 250 ms, 500 ms, 1 s, and 2 s; rule recovery retries are 250 ms and 500 ms. Per-root durable retry waits are one-shot and cancellable. No idle reconciliation timer remains. |
| Overview — `src/views/scanner/ScannerView.tsx` (`refreshIfVisible` and event subscriptions) | A recurring 5-second technical-status interval refreshed the mounted Overview. | Existing event-driven refresh remains for watcher-health signature changes, terminal managed scan/analysis events, and analysis-findings-published events. Mount/visible activation refreshes immediately. A visible-only 60-second safety interval covers displayed authorities without complete event sources, including Global Index status and Content Run changes. Hidden pages schedule no safety refresh; hidden→visible refreshes immediately and rearms it; unmount clears the interval and listeners. | 60-second visible-only safety refresh, temporary until every displayed durable authority has an event source. |

## Remaining operation timers

The following adjacent timers remain operation-scoped and are not Overview or watcher idle polling:

- `useScanManagerStore.waitForManagedSession` and `useBackgroundIndexerStore.waitForManagedBackgroundSession` check every 250 ms only while a managed scan session is active, then stop at a terminal state.
- `scanner.rs` retries a managed resource lease every 25 ms only while an active scan is queued and waiting for a lease. Scan progress is batched at 200 ms while scan work is producing progress.
- Scan rule recovery uses at most two delays (250 ms and 500 ms); watcher retry bounds are listed above. These are failure-triggered retries, not recurring idle work.
- The existing Global Index coordinator 2-second runtime loop remains unchanged and out of scope for this Track. The active Content Understanding view's 2-second progress refresh is also outside the Overview status surface and was not changed.
- Overview retains a temporary 60-second visible-only safety refresh because Global Index status and Content Run changes do not yet have complete event sources for all displayed health data. It is cleared while hidden and when Overview unmounts; visible activation refreshes immediately. This fallback can be removed after the relevant event architecture is complete.

## Focused checkpoint evidence

| Scope | Focused validation |
| --- | --- |
| Managed AI | Initial Track: `cargo test --manifest-path src-tauri/Cargo.toml --lib wake` — 5 passed. The deterministic check-to-wait wake test `queued_work_wakes_idle_worker_and_child_completion_refills_queue` passed after the test-only readiness handshake was added. |
| Watcher | `cargo test --manifest-path src-tauri/Cargo.toml --lib --features performance-test-tauri watcher::tests` — 27 passed. |
| Overview | `npm test -- --run tests/overviewHealthIntegration.test.tsx` — 33 passed; `npm run typecheck` — passed. |
| Integration adjustment | After Clippy identified a scan-work argument grouping issue and watcher retry-map type complexity, `cargo test --manifest-path src-tauri/Cargo.toml --lib scanner::tests` — 15 passed, and the focused watcher suite — 27 passed. |
| Owner-review repair — Managed AI / Global Index / Managed Scope | `cargo test --manifest-path src-tauri/Cargo.toml --lib wake -- --test-threads=1` — 8 passed. Covers disabled worker ignoring 32 unrelated Global Index batches, disabled→enabled control wake processing durable pending work, work-wake gating/coalescing, only eligible new/reactivated Global Index jobs waking, and managed-scope/policy wake behavior. |
| Owner-review repair — Overview | `npm test -- --run tests/overviewHealthIntegration.test.tsx` — 34 passed using fake timers. Covers mount refresh, event refresh, visible 60-second fallback, hidden suppression, hidden→visible immediate refresh, and unmount timer/listener cleanup. `npm run typecheck` — passed. |
| Owner-review repair — Rust formatting / touched-code lint | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — passed. `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --all-features -- -D warnings` — passed. |

The AI wake integration test initially exposed a SQLite `DatabaseBusy` race in its check-to-wait setup. A test-only readiness handshake now signals at that exact boundary; the targeted test and final full suites pass. Production wake behavior is unchanged by the handshake.

## Initial Track full validation (prior production HEAD)

All commands below ran after the three scopes were integrated, against production HEAD `77058cded7f117164b824e262d7b4cb11eb517e7`. They are historical evidence for that exact production commit and were not rerun for the owner-review repair. The repair's new full integration validation is PR #260 Hosted CI after the repair push.

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

The hosted macOS lane was not executable on this Windows host during that initial run; PR #260 Hosted CI later passed the macOS lane on the owner-review repair candidate. The first standard `npm test` attempt discovered Rust-generated fixtures under the task temp root; those task-owned fixtures were sent to the Recycle Bin and the unfiltered suite was rerun successfully.

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
- PR #260 Hosted CI run `35985044270` passed the owner-review repair candidate, including Windows/macOS Rust quality, release compile, and the routed performance lanes. Packaging, dependency-audit, documentation-only, and Windows Preview Handler jobs were skipped under the selected change classification.

**READY FOR OWNER RE-REVIEW**
