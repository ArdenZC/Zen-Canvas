# ZB-03 — Runtime Resource Governance — Result

Disposition: **MERGED / OWNER REVIEW PASSED — LOCAL CLEANUP WAIVED BY OWNER POLICY EXCEPTION**

## Identity

- Baseline: `master@ea942b433ea7ad68297f731972f5bda49c7318b8`
- Taskbook commit: `b0f071be581cfe00e14edb2161eacc6ef375389c`
- Branch: `perf/zb-03-runtime-resource-governance`
- Integrated source HEAD: `d30b4a1433d28f03309ec2367865cb469aaf5197`
- Final branch HEAD: this Result is a documentation-only successor to production HEAD `d30b4a1433d28f03309ec2367865cb469aaf5197`; the exact pushed Result commit is the Draft PR source head and is reported in the final closeout.

The ZB-03 implementation was integrated at `a93a2a67806b59db47af82b5cbba16992746d7c0`. macOS QoS enum binding was corrected at `f41fddaab1242abecae5bbf7783b80326400810d`. The `907717169d1c7f3459d503c0f26baf22460183b6` follow-up isolates PDF timeout test seams from host power policy and synchronizes the thumbnail cancellation fixture. Production Content work continues to use the shared global WorkScheduler. Closeout production commit `d30b4a1433d28f03309ec2367865cb469aaf5197` moves Dedupe Background QoS from the lease-holding coordinator to the actual hash worker threads and adds a thread-identity seam test. The Result commit changes documentation only.

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
- Dedupe hashing derives worker bounds from shared scheduler capacity, acquires one lease per hash worker, and applies the same effective governor capacity. Background QoS is applied when each actual hash worker starts, not on the coordinating thread. Its durable run authority, lease count, worker count, hashing semantics, and cancellation contract remain unchanged. The remaining `available_parallelism()` call in Dedupe is test-only benchmark comparison code.
- Analysis detectors acquire Background leases from WorkScheduler; run cancellation signals the scheduler. Storage/Cleanup candidate analysis is already dispatched through this Analysis authority, so its non-destructive scan is covered by the same lease.
- Content extraction and Content Understanding provider requests both acquire WorkScheduler leases. Provider-network capacity is reserved before durable provider-item claim. Existing ContentRun/provider ledgers are unchanged; cancellation wakes resource waits.
- Managed AI checks shared policy and acquires a lease before claiming durable pending work. SQLite remains its only durable queue. Disabled/idle AI remains event-driven; the 5-second fallback applies only when eligible durable work is known to be blocked and native policy notifications are unavailable.
- Safe Trash, Restore, operation journals, recovery, and destructive execution were not placed behind resource admission and were not interrupted.

## Efficiency QoS

- Windows requests thread-local execution-speed throttling with `SetThreadInformation` for Background work and restores the setting at the worker boundary.
- macOS requests `QOS_CLASS_BACKGROUND` with `pthread_set_qos_class_self_np` and restores the default at the end of scoped work.
- Dedupe calls the existing Background QoS helper at the top of each spawned hash-worker closure; the coordinator does not establish a QoS scope for those workers.
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

Production and test source files:

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
- `src-tauri/src/file_workspace/thumbnail/tests/lifecycle.rs` (deterministic cancellation fixture)

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
- After Hosted CI exposed host-load-sensitive tests, the PDF midflight test seams received a local permissive WorkScheduler and the thumbnail repeated-cancellation test received an entered/release barrier. Focused checks then passed: `content::tests::pdf_midflight` (3 passed), `file_workspace::thumbnail::tests::lifecycle::repeated_request_cancel_cycles_return_to_steady_state` (1 passed), `cargo fmt --check`, and desktop-runtime all-targets Clippy with `-D warnings`.
- Dedupe QoS worker-boundary repair at production HEAD `d30b4a1433d28f03309ec2367865cb469aaf5197`: `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --lib dedupe::job_manager_tests` passed (10 passed, 1 pre-existing benchmark ignored), including `hash_worker_qos_seam_runs_once_on_each_worker_thread` and one/multi-worker hash parity.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings`: PASS.

## Final local validation

All full local validation commands were run once after the main integration against production HEAD `a93a2a67806b59db47af82b5cbba16992746d7c0`:

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

After the local full run, the macOS QoS compile repair and test-fixture isolation were validated with focused checks only. Hosted CI run `36005127859` validated source HEAD `907717169d1c7f3459d503c0f26baf22460183b6`; the closeout repair was then validated by run `36024619774` on production HEAD `d30b4a1433d28f03309ec2367865cb469aaf5197`. The extended performance suite was not repeated locally.

Security audit returned success at the repository's `high` npm threshold. `npm audit` reported two **moderate** transitive Vitest / `@vitest/mocker` advisories. Cargo audit completed with the repository's 8 allowed warnings, including unmaintained crates, one glib unsoundness advisory, and a yanked crate. No crate was added or upgraded; both Cargo lockfiles are unchanged. The existing `windows-sys` dependency only gained its `Win32_System_Power` feature.

## Hosted CI

Draft PR [#262](https://github.com/ArdenZC/Zen-Canvas/pull/262) is open and remains Draft. The initial final-source integration run [36005127859](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36005127859), bound to source HEAD `907717169d1c7f3459d503c0f26baf22460183b6`, completed successfully. After the Dedupe QoS boundary repair, Hosted CI run [36024619774](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36024619774), bound to production HEAD `d30b4a1433d28f03309ec2367865cb469aaf5197`, also completed successfully:

- Windows and macOS release compile, Rust quality, and Quality aggregates: PASS.
- Native macOS performance and all six routed performance lanes (Search, Scan & Schema, Library & Content, Intelligence, Workspace Foundation, Preview Platform): PASS.
- Source checkout, change-scope/routing, validation plan, and dependency audit: PASS.

Earlier Hosted attempts found that libc exposes Apple QoS classes as `qos_class_t` enum variants, not root constants; the follow-up now compiles on the Apple Silicon release lane. A subsequent macOS Rust-suite attempt surfaced two time-sensitive test failures under full-suite load. The PDF test was isolated from host resource policy, and the thumbnail test now synchronizes entry/cancellation. Both platform Rust quality lanes and all performance lanes passed on the latest production source. No local extended performance rerun was done.

## Local task hygiene / closeout pending

Generated validation artifacts remain because the earlier local command policy rejected the requested `Remove-Item` of task-created fixture symlinks with the response `blocked by policy`. No deletion occurred; no alternate or recursive deletion method was attempted. The following post-validation inventory was read-only; byte totals count regular files and symlink targets were not traversed:

- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests`: 3,399 files / 700,442,749 bytes; 8 symbolic links below.
- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-performance-fixtures`: 5 files / 608,470,124 bytes; no reparse points.
- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.performance-artifacts`: 20 files / 197,054,393 bytes; no reparse points.
- `F:\_codex_tmp\zb03-runtime-governance-20260924`: 114 files / 877,762,067 bytes; no reparse points.

Exact reparse points under `.tmp-tests`:

- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19424-0-1790251988514815900\link.txt` → `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19424-0-1790251988514815900\target.txt`.
- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19424-19-1790251989225107100\source-link.txt` → `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19424-19-1790251989225107100\target.txt`.
- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19424-20-1790251989232290000\linked-parent` → `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19424-20-1790251989232290000\real-parent`.
- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19424-73-1790251991522213700\protected-link` → `C:\Windows`.
- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19720-0-1790252159011182600\link.txt` → `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19720-0-1790252159011182600\target.txt`.
- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19720-19-1790252159786130700\source-link.txt` → `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19720-19-1790252159786130700\target.txt`.
- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19720-20-1790252159790113700\linked-parent` → `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19720-20-1790252159790113700\real-parent`.
- `F:\Coding\Zen-Canvas-zb-03-runtime-resource-governance\.tmp-tests\zen-canvas-file-op-test-19720-73-1790252161865103700\protected-link` → `C:\Windows`.

The two links to `C:\Windows` were not followed or modified. `node_modules` was not modified. The common checkout `F:\Coding\Zen-Canvas` remains on `master` at `9895079a4ebb1e810b8c42d6a74b24ba147c6645` with clean Git status. The shared `F:\CargoTarget` was preserved and not cleaned, but was used as `CARGO_TARGET_DIR` by the focused Rust test and Clippy commands, which wrote/reused validation build outputs there.

Owner manual cleanup remains pending for these four task-owned roots under the local safety policy. This is a **LOCAL TASK HYGIENE / CLOSEOUT BLOCKER**, not a product correctness or implementation blocker. The production and Result commits have a clean tracked working tree; no cleanup workaround was used.

## Scope and authority confirmation

- No SQLite schema/migration or durable authority changed.
- Safe Trash, Restore, operation journal/recovery, and destructive file-operation semantics are untouched.
- No STATUS, ROADMAP, release/W6/RC1 state, or dependencies changed.
- WebView lifecycle, Search Mini Runtime, Global Index 2-second redesign, MFT/USN, Spotlight/FSEvents redesign, AI semantic migration, and ZB-04 were not started.
- No merge was performed; the PR will remain Draft and not Ready.


## Final owner closeout

- Final reviewed PR HEAD: `efcec2ccbbdafe2877ea89dc43a95453d23d3b55`.
- Hosted CI on the exact final PR HEAD: run `36026398769` — success.
- PR #262 was owner-approved and rebase-merged to `master` as `d13016fd15120e6faa879bce96c5eeaf7cc5d6f1`.
- The remaining task-owned validation residue was **not tracked by Git** and was not part of the merged PR.
- Conservative cleanup re-verified all eight documented reparse points, including two `protected-link` symlinks targeting `C:\Windows`.
- Local command policy blocked even non-recursive deletion of the exact link objects. No bypass, target traversal, privilege change, alternate recursive deletion mechanism, or system-setting change was attempted.
- Owner accepted the remaining local residue as a **local task-hygiene exception**, not a product/runtime correctness blocker.
- No additional production code, schema, durable authority, STATUS, ROADMAP, release state, WebView lifecycle or Global Index provider work was added during closeout.
