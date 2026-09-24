# ZB-03 — Runtime Resource Governance — Result

Disposition: **BLOCKED**

## Identity

- Baseline: `master@ea942b433ea7ad68297f731972f5bda49c7318b8`
- Taskbook commit: `b0f071be581cfe00e14edb2161eacc6ef375389c`
- Branch: `perf/zb-03-runtime-resource-governance`
- Production HEAD: `a93a2a67806b59db47af82b5cbba16992746d7c0`
- Final branch HEAD: this Result is a documentation-only successor to the production HEAD; its exact SHA is reported in the final closeout and is visible as the Draft PR source head.

The production commit contains the full ZB-03 implementation. The Result commit changes no production code.

## Architecture

`RuntimeResourceGovernor` is a transient, injectable implementation of the existing `PlatformResourcePolicy`. It reads current platform facts on scheduler decisions and returns background admission, effective capacity, and efficiency-QoS intent. It owns no queue, executor, durable state, persistence, frontend state, or sampling timer.

`WorkScheduler` remains the only process-local admission, capacity, and fairness authority. Existing durable owners create `WorkRequest`s and hold `ResourceLease`s. Scheduler release, cancellation, superseding work, and policy-change notifications signal waiters. No second scheduler or durable queue was added.

## Platform policy

### Windows 10+

- Reads `SYSTEM_POWER_STATUS` using `GetSystemPowerStatus`; no power polling thread was added.
- Battery Saver defers new nonessential Background admission.
- On-battery or unavailable/unknown power facts conservatively cap Background CPU, IO, and provider-network capacity at 2.
- Foreground and Interactive classes remain admissible and are not assigned background QoS.
- Windows has no policy-change notification wired in this Track. A 5-second recheck is limited to known policy-blocked work.

### macOS Apple Silicon

- Reuses `NSProcessInfo` thermal and Low Power facts through the existing macOS activity policy.
- Low Power and ordinary Background work remain bounded to at most 2-way parallelism, subject to configured capacity.
- Serious/Critical thermal states deny new nonessential Background work; Interactive/Foreground remain available under conservative capacity.
- Power and thermal notifications wake WorkScheduler policy waiters. No activity sampling timer was added.

Unknown pressure remains bounded and does not affect durable truth.

## WorkScheduler and worker integration

- Removed the unconditional 50 ms scheduler wait loop. Waits now use condition-variable notifications, caller deadlines, or documented slow rechecks for known policy-blocked work and unobservable external cancellation.
- Managed Scan uses its existing scheduler adapter and blocks for admission rather than retrying every 25 ms.
- Dedupe hashing derives worker bounds from shared scheduler capacity, acquires one lease per hash worker, and applies the same effective governor capacity. Its durable run authority and cancellation contract remain unchanged. The remaining `available_parallelism()` call in Dedupe is test-only benchmark comparison code.
- Analysis detectors acquire Background leases from WorkScheduler; run cancellation signals the scheduler. Storage/Cleanup candidate analysis is already dispatched through this Analysis authority, so its non-destructive scan is covered by the same lease.
- Content extraction and Content Understanding provider requests both acquire WorkScheduler leases. Provider-network capacity is reserved before durable provider-item claim. Existing ContentRun/provider ledgers are unchanged; cancellation wakes resource waits.
- Managed AI checks shared policy and acquires a lease before claiming durable pending work. SQLite remains its only durable queue. Disabled/idle AI remains event-driven; the 5-second fallback applies only when eligible durable work is known to be blocked and native policy notifications are unavailable.
- Safe Trash, Restore, operation journals, recovery, and destructive execution were not placed behind resource admission and were not interrupted.

## Efficiency QoS

- Windows requests thread-local execution-speed throttling with `SetThreadInformation` for Background work and restores the setting at the worker boundary.
- macOS requests `QOS_CLASS_BACKGROUND` with `pthread_set_qos_class_self_np` and restores the default at the end of scoped work.
- QoS is best-effort and non-fatal. It is limited to Background workers; no process-wide QoS change was added.

## Removed polling and remaining timers

Removed resource-policy polling from the 50 ms scheduler wait, the 25 ms scan admission retry, and the 250 ms Analysis/Content policy waits. Dedupe and Managed AI no longer independently poll macOS activity state. Resource release and native macOS policy events wake blocked work.

Remaining timeouts in this scope:

- **5 seconds — WorkScheduler:** only when a queued Background request is known to be blocked by a reduced policy/capacity on a platform without native policy notifications.
- **5 seconds — Managed AI:** only when its durable query confirms eligible pending work and policy denies it on a platform without native policy notifications. True idle continues to block on the wake channel.
- **1 second — external cancellation:** only for a cancellation token backed by an atomic source that cannot signal the condition variable. Integrated worker managers also call `cancel_session` to wake their own waits promptly.
- **250 ms — macOS lifecycle run loop:** checks only the controller stop flag while native notifications deliver lifecycle and resource-policy changes; it does not sample power or thermal state.
- Caller-provided scheduler deadlines remain exact and are not governor sampling.

There is no true-idle governor or scheduler timer in this Track.

## Changed files

Production files:

- `src-tauri/Cargo.toml`
- `src-tauri/src/analysis.rs`
- `src-tauri/src/content.rs`
- `src-tauri/src/content/commands.rs`
- `src-tauri/src/dedupe.rs`
- `src-tauri/src/file_workspace/integration/performance/preview.rs`
- `src-tauri/src/global_index/managed_worker_hardened.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/platform/macos/lifecycle.rs`
- `src-tauri/src/platform/macos/mod.rs`
- `src-tauri/src/platform/macos/qos.rs`
- `src-tauri/src/platform/mod.rs`
- `src-tauri/src/platform/windows/mod.rs`
- `src-tauri/src/platform/windows/power.rs`
- `src-tauri/src/platform/windows/qos.rs`
- `src-tauri/src/resource_governor.rs`
- `src-tauri/src/scanner.rs`
- `src-tauri/src/scheduler.rs`

Documentation:

- `docs/project/tasks/ZB-03-RUNTIME-RESOURCE-GOVERNANCE-RESULT.md`

No frontend, schema, lockfile, STATUS, or ROADMAP changes were made.

## Focused checkpoint validation

- Governor decision/QoS unit tests: 5 passed.
- Scheduler suite: 18 passed, including event-driven release/policy wake, no periodic 50 ms wake, bounded policy fallback, and no duplicate grant.
- Managed AI focused worker tests: 6 passed, including idle behavior, settings control wake, durable pending work after policy change, and eligible-work gating.
- Analysis, Content extraction/provider, Managed Scan, and Dedupe focused admission/cancellation tests passed.
- macOS lifecycle policy-event state test passed; this Windows host does not provide native macOS execution evidence.
- `cargo fmt --check`, desktop-runtime binary `cargo check`, and narrow desktop-runtime Clippy passed.

## Final local validation

All full local validation commands were run once after integration against production HEAD `a93a2a67806b59db47af82b5cbba16992746d7c0`:

| Validation | Result |
| --- | --- |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS — library: 980 passed, 23 ignored; all integration suites passed |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS |
| `npm run verify:rust` | PASS — desktop-runtime tests and Clippy |
| `npm run test:performance:architecture` | PASS — architecture guard and 28 behavior tests |
| `npm run verify:security` | PASS at configured thresholds; findings below |
| `npm run typecheck` | PASS |
| `npm test -- --exclude '**/.tmp-tests/**'` | PASS — 150 files, 1608 tests |
| `npm run test:performance:extended` | PASS — all 6 routed suites, 288.627 seconds |

The linked worktree initially had no `node_modules`; `npm ci` restored the committed lockfile dependencies without changing manifests or lockfiles. Vitest's default discovery followed test-created symlinks under `.tmp-tests` into copied third-party `bcrypt/test` files, so the successful full frontend run explicitly excluded that generated fixture root and used an F: temporary directory.

The extended profile passed Search, Scan/Schema, Library/Content, Intelligence, Workspace Foundation, and Preview Platform suites. The managed-scan pressure benchmark reported a soft target miss for foreground first-page wait (`2594 ms`, exceeding its `2x idle` target); its test passed, and the same run's hard pressure/admission/cancellation/release checks passed. This is recorded for owner review without broadening ZB-03.

Security audit returned success at the repository's `high` npm threshold. `npm audit` reported two **moderate** transitive Vitest / `@vitest/mocker` advisories. Cargo audit completed with the repository's 8 allowed warnings, including unmaintained crates, one glib unsoundness advisory, and a yanked crate. No crate was added or upgraded; both Cargo lockfiles are unchanged. The existing `windows-sys` dependency only gained its `Win32_System_Power` feature.

## Hosted CI

Pending Draft PR creation. Hosted Windows/macOS integration proof is not claimed by this local Windows run.

## Temporary-artifact closeout blocker

Generated validation artifacts remain because the local command policy rejected the requested `Remove-Item` of task-created fixture symlinks with the response `blocked by policy`. No deletion occurred. Read-only inspection classified the remaining paths as task-owned:

- Worktree `.tmp-tests`: approximately 700 MB, including 8 symlink fixtures created by the file-operation tests. One fixture symlink targets `C:\Windows`; the link itself is test data and the target was not modified.
- Worktree `.tmp-performance-fixtures`: approximately 608 MB, generated by the extended profile.
- Worktree `.performance-artifacts`: approximately 197 MB, generated by the extended profile.
- `F:\_codex_tmp\zb03-runtime-governance-20260924`: approximately 878 MB of task-scoped test temporary data.

The shared `F:\CargoTarget`, worktree `node_modules`, and common checkout were preserved. Project closeout requires these task-owned temporary artifacts to be removed; the local policy rejection leaves that requirement unresolved and keeps this Result **BLOCKED** pending an allowed cleanup path. No alternate deletion route was used.

## Scope and authority confirmation

- No SQLite schema/migration or durable authority changed.
- Safe Trash, Restore, operation journal/recovery, and destructive file-operation semantics are untouched.
- No STATUS, ROADMAP, release/W6/RC1 state, or dependencies changed.
- WebView lifecycle, Search Mini Runtime, Global Index 2-second redesign, MFT/USN, Spotlight/FSEvents redesign, AI semantic migration, and ZB-04 were not started.
- No merge was performed; the PR will remain Draft and not Ready.
