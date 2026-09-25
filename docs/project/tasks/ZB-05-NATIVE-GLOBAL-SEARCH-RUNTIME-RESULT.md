# ZB-05 — Native Global Search Runtime Result

## Disposition

**BLOCKED — local task-owned artifact cleanup only.** Product implementation, exact-candidate Windows service qualification, and Hosted CI now pass. Local validation previously left task-owned temporary artifacts because the local command policy rejected cleanup; exact remaining paths are listed below.

The earlier local bounded smoke remains diagnostic only: the isolated candidate was correctly rejected by the installed metadata service, and its direct MFT/USN path reached `ready` with zero baseline entries. The subsequent exact-candidate Hosted qualification below establishes a complete non-empty MFT baseline through the actual Windows service on an isolated task-owned NTFS/USN volume. The installed local service and production profile were left unchanged.

## Identity

- Branch: `perf/zb-05-native-global-search-runtime`
- Baseline: `master@e4ef09fb27bae97081fba0fa850f5ad62a9b1b50`
- Taskbook HEAD: `a5a9a957c706d05f0820a474c46041899c390c75`
- Production HEAD: `336aaea93f9190a7f4b81f93c0d634440e3c4c58`
- Final HEAD: the documentation-only closeout commit containing this Result update, directly after the Hosted-validated qualification harness head `8ede12c2375559cae1c9f8e847b9ce69c0f6ce64`; the exact branch/PR head SHA is reported in the closeout.
- Draft PR: [#266](https://github.com/ArdenZC/Zen-Canvas/pull/266)

## Changed files

- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/src/global_index/coordinator.rs`
- `src-tauri/src/global_index/macos/fsevents.rs`
- `src-tauri/src/global_index/macos/mod.rs`
- `src-tauri/src/global_index/macos/run_loop.rs`
- `src-tauri/src/global_index/macos/spotlight.rs`
- `src-tauri/src/global_index/mod.rs`
- `src-tauri/src/global_index/models.rs`
- `src-tauri/src/global_index/repository.rs`
- `src-tauri/src/global_index/tests.rs`
- `src-tauri/src/global_index/wake.rs`
- `src-tauri/src/global_index/windows/fallback.rs`
- `src-tauri/src/global_index/windows/mod.rs`
- `src-tauri/src/global_index/windows/service.rs`
- `src-tauri/src/global_index/windows/service_host.rs`
- `src-tauri/src/global_index/windows/volumes.rs`
- `src-tauri/src/main.rs`
- `docs/project/tasks/ZB-05-NATIVE-GLOBAL-SEARCH-RUNTIME-RESULT.md`
- Follow-up qualification-cost optimization (no production runtime or persistence changes): `.github/workflows/ci.yml`, `scripts/qualifyWindowsGlobalIndexService.ps1`, `src-tauri/native-qa/global_index_probe.rs`, and `tests/ciFastPathContract.test.ts`.

No `STATUS.md`, `ROADMAP`, schema, Search request/ranking contract, command permission, or durable authority was changed. AI semantic migration and onboarding work were not started. The Cargo change makes the already locked Core Foundation crate a direct macOS dependency; it did not update package versions.

## Runtime changes

### Shared wake and coordinator

- Added one bounded `GlobalIndexWakeSlot` carrying only a coalesced reason, not file events or durable payloads.
- The coordinator performs its immediate catch-up and then blocks. Provider callbacks, startup/resume, source settings, rebuild, recovery, and shutdown wake it directly.
- Lost-wake handling is preserved across cycle completion and the idle wait. Windows uses a five-minute topology-only safety audit; it discovers descriptors only and does not index or churn SQLite when topology is unchanged.
- The prior approximately one-cycle-per-two-seconds coordinator loop and 100 ms coordinator waits are removed. In true idle there are no periodic reconcile cycles or repeated source/status writes.
- Existing SQLite Global Index tables, MFT/USN checkpoints, Spotlight-derived rows, and Search V2 remain the durable authorities. Native notifications are wake hints only.

### Windows

- Fixed NTFS remains MFT baseline plus USN incremental authority. Desktop filesystem notifications wake the coordinator; they do not write durable rows.
- The installed metadata service protocol remains v3 and metadata-only. Same-executable and local-session validation, service routing, SCM shutdown behavior, and request frames are unchanged.
- A native MFT/USN error now preserves truthful permission/rebuild/error state and does not switch fixed NTFS to a recursive whole-volume crawl. Unsupported fixed filesystems are unavailable and disabled on discovery; removable and network volumes remain disabled by default.
- The five-minute source-topology safety audit is separate from incremental work. It uses cheap volume descriptors and only triggers a normal cycle when the topology signature changes.
- Initial MFT, explicit rebuild, and full reconciliation use the existing `WorkScheduler` Background admission and existing QoS helper. No scheduler was added to the Windows service.

### macOS

- Spotlight update notifications append to the existing bounded pending state and wake the coordinator. FSEvents remains a reconciliation/checkpoint signal and also wakes it.
- Pending updates remain bounded and coalesced; overflow still promotes to full reconciliation. Spotlight remains metadata row authority.
- Spotlight and FSEvents worker loops now block on their native run loops and have an explicit cross-thread stop/wake path used by pause and shutdown.
- Remaining timeout: Spotlight's active baseline collection still calls `runUntilDate` with a 200 ms deadline to observe cancellation while the collection is processing. This is active-work cancellation polling, not idle coordinator/source polling. FSEvents retains its 250 ms native event coalescing latency.
- Heavy initial/rebuild/full-reconcile work participates in existing Background scheduler admission where applicable. No generic event bus or second queue was added.

## Tests and measurements

- Focused Global Index suite: 52 passed, 3 ignored. The added explicit-command coordinator test passed separately and covers immediate rebuild, enable/disable durable state and catch-up, pause/shutdown prompt joins, resume catch-up, and provider operation counts.
- The test suite also covers true idle, wake coalescing and boundedness, the cycle-to-wait lost-wake boundary, Windows service protocol v3 frame shape, Windows recursive-fallback policy, and macOS callback/pending behavior.
- Before: settled coordinator work repeated at about one cycle every two seconds, including repeated discovery/provider probes.
- After: the startup idle test observed one discovery and then a blocking wait with no repeated cycle; the native smoke recorded a five-second idle window with zero additional coordinator cycles/waits.
- Routed Windows Search extended performance at `8cae1ea04edcf8536ef1ead69f7d0c026d46df1e`: SQLite/FTS 100k p95 `2.054 ms`; Global Search 100k p95 `32.035 ms` against the existing `100 ms` threshold. Subsequent production fixes removed one unused macOS import (`b41209219b15c3ce375bb2e988a30dbc25c4847c`) and corrected Windows MFT baseline handling through Production HEAD `336aaea93f9190a7f4b81f93c0d634440e3c4c58`; later exact-head Hosted evidence is recorded below. No ranking/query contract changed.

### Bounded Windows native smoke

- Candidate database/profile lived under the ZB-05 worktree and was isolated from the production SQLite profile.
- The candidate reached `ready` after `11,155 ms`, but had `0` indexed baseline entries. This is insufficient evidence that a complete NTFS baseline was captured.
- The test binary's service request was rejected with `index_service_client_executable_mismatch`; the installed service only accepts the installed product image. The successful bounded run used the direct MFT/USN test path and the same wake-only filesystem watcher.
- Create-to-search freshness: `28 ms`; rename-to-search: `28 ms`; delete-to-search: `11 ms`. Settled idle window: `5,000 ms`, `idle_wait_delta=0`.
- The production service remained installed/running with the same process identity and startup configuration before and after. Only task-owned disposable smoke files were created and removed.
- Therefore this smoke is diagnostic evidence for the wake/freshness/idle path, not a PASS for complete native baseline qualification.

### Exact-candidate Hosted Windows service qualification

- The earlier whole-run qualification `36159205805` checked out `f8b90add036b9842f0910a2fe4356e4db4051c28`. It completed the C: MFT baseline (1,368,120 entries in `1,627,533 ms`) and the pre-existing-file/freshness checks, but failed only at the final settled-idle assertion (`cycles=8511`, `waits=8510`). The qualification job ran for `35m11s`; the baseline alone took `27m08s`.
- The follow-up harness creates an expandable, task-owned 512 MB VHDX under the hosted runner's `RUNNER_TEMP`, formats it as fixed NTFS, creates a USN journal on that disposable volume when needed, and seeds the isolated profile through the existing durable Global Volume setting so exactly that one source is enabled. It does not change production defaults or disable any user source in a production profile.
- Exact Hosted run `36166201310` checked out harness head `8ede12c2375559cae1c9f8e847b9ce69c0f6ce64` and passed. Evidence confirms the exact service and desktop client ran the same candidate image; exactly one source remained enabled before indexing and after discovery; provider `windows_mft_usn` indexed `Z:\` to `ready` with 4 entries in `52 ms`; the pre-existing fixture was searchable; create/rename/delete freshness measured `15/123/121 ms`; and the successful service route was observed.
- The final 10-second idle window had zero additional coordinator cycles and waits. The qualification created and detached its own VHD, removed the task profile/fixture, stopped/deleted the task service, and terminated candidate processes; every cleanup field passed and the artifact reported no failure.
- The isolated baseline wait fell from `27m08s` to `52 ms`; the disposable-service qualification step fell from the prior 27m45s run to `30s`. The complete Hosted workflow fell from `35m50s` to `9m41s` (about 73% less elapsed time). The 5-minute baseline timeout applies only after source isolation; `ready`, non-null `lastFullIndexAt`, a positive entry count, exact source identity, fixture lookup, event freshness, and idle assertions remain required.
- This qualifies the native Windows service/provider path on an isolated hosted Windows runner. It does not claim local owner-host UI acceptance.

### Local validation

The taskbook's final local validation was run once after implementation stabilization, before the one-line macOS unused-import repair. The full suite passed on the source tree committed as `8cae1ea04edcf8536ef1ead69f7d0c026d46df1e`. After the repair committed as `b41209219b15c3ce375bb2e988a30dbc25c4847c`, focused Global Index tests (53 passed, 3 ignored), formatter, and narrow Clippy passed. Later Windows MFT fixes brought Production HEAD to `336aaea93f9190a7f4b81f93c0d634440e3c4c58`; full local validation was not repeated, while subsequent exact-head Hosted CI covered those changes. For the qualification-cost harness at `8ede12c2375559cae1c9f8e847b9ce69c0f6ce64`, focused checks passed: PowerShell parser checks for the qualification script and workflow cleanup, 39 targeted CI contract tests, native QA probe `cargo check`, narrow Clippy, `cargo fmt --check`, and `git diff --check`.

| Gate | Result |
| --- | --- |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS; 999 library tests passed, 24 ignored; integration binaries passed |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS; 152 files, 1,616 tests |
| `npm run verify:rust` | PASS; 1,003 library tests passed, 24 ignored under `desktop-runtime`; integration binaries and Clippy passed |
| `npm run test:performance:architecture` | PASS; 28 tests |
| `npm run verify:security` | PASS under current thresholds |
| `npm run build:frontend` | PASS |
| `npm run check:rust:release` | PASS |
| Routed `search / extended` performance suite | PASS; metrics above |

The local run was on Windows. No owner Apple Silicon GUI host was available, so local results do not claim manual macOS qualification. The exact-head Hosted CI macOS compile, Rust quality, and Apple Silicon native performance lanes are recorded below; those automated lanes do not replace owner native qualification of the Windows MFT baseline.

## Hosted CI

- PR #266 is Draft and open.
- First run `36121168229` checked out `8cae1ea04edcf8536ef1ead69f7d0c026d46df1e`; it failed macOS Rust Clippy because `GlobalIndexWakeReason` was unused in `macos/mod.rs`. Windows Rust quality, both release compiles, dependency audit, Search performance, and native macOS performance passed.
- The unused import was removed in Production HEAD `b41209219b15c3ce375bb2e988a30dbc25c4847c`. New exact-head Hosted CI run `36122740556` checked out that SHA and completed successfully.
- Exact-head routed lanes passed: Windows and macOS release compile; Windows and macOS Rust quality; Apple Silicon native performance; Search performance; dependency audit; source/evidence and change-routing contracts; and the validation lane plan.
- The exact-head Search performance lane measured SQLite/FTS 100k search p95 `2.217 ms` (configured threshold `1,000 ms`) and Global Search 100k p95 `41.128 ms` (configured threshold `100 ms`).
- The workflow's package, Preview Handler, and unrelated performance lanes were skipped by routing; they were not required for this change class. Overall run conclusion: `success`.
- The first hosted Windows service qualification attempt on `f8b90add036b9842f0910a2fe4356e4db4051c28` is recorded above as run `36159205805`; its final idle assertion failed after indexing all 1.36 million entries on C:.
- After isolating qualification to the owned NTFS/USN test volume, Hosted run `36166201310` checked out harness head `8ede12c2375559cae1c9f8e847b9ce69c0f6ce64` and completed `success` in `9m41s`. The Windows Global Index qualification job completed in `8m25s` (including the exact candidate build); its MFT baseline wait was `52 ms`, and its end-to-end service qualification step was `30s`. Windows/macOS quality, native macOS performance, all routed performance shards, release compiles, dependency audit, source/routing contracts, and validation planning passed.
- The qualification optimization changes only hosted/local QA harnessing and its contract tests. Production HEAD remains `336aaea93f9190a7f4b81f93c0d634440e3c4c58`; no Global Index production code, schema, durable authority, Search contract, or user source defaults changed in this optimization.

## Unexpected findings and closeout

- Native test-binary identity is intentionally stricter than a generic test harness, preventing the isolated test from impersonating the installed service. Do not change service identity, SCM configuration, or the production profile to bypass it; owner review/native qualification is required.
- `npm audit --audit-level=high` reported two moderate `@vitest/mocker` advisories but exited successfully at the configured high threshold. Rust audit reported eight existing allowed advisories and exited successfully. No dependency upgrades were made.
- Frontend build completed with existing CSS optimizer and mixed static/dynamic PDF import warnings; neither prevented the build.
- Local task-owned artifacts could not be cleaned because local command policy rejected both safe PowerShell removal commands before process launch. No files were removed by either attempt. No alternate deletion method was attempted.
  - The two retained validation roots are `src-tauri/.tmp-tests/zb05-final-validation` and `.tmp-tests/zb05-final-validation` within this worktree.
  - The only reparse points found under those roots were eight test symlinks: each root contains `link.txt` and `source-link.txt` targeting its fixture's `target.txt`, `linked-parent` targeting its fixture's `real-parent`, and `protected-link` targeting `C:\Windows`.
  - Exact remaining symlink paths:
    - `F:\Coding\Zen-Canvas-zb-05-native-global-search-runtime\src-tauri\.tmp-tests\zb05-final-validation\temp\zen-canvas-file-op-test-39148-0-1790329379585672200\link.txt`
    - `F:\Coding\Zen-Canvas-zb-05-native-global-search-runtime\src-tauri\.tmp-tests\zb05-final-validation\temp\zen-canvas-file-op-test-39148-19-1790329380525478100\source-link.txt`
    - `F:\Coding\Zen-Canvas-zb-05-native-global-search-runtime\src-tauri\.tmp-tests\zb05-final-validation\temp\zen-canvas-file-op-test-39148-20-1790329380530394300\linked-parent`
    - `F:\Coding\Zen-Canvas-zb-05-native-global-search-runtime\src-tauri\.tmp-tests\zb05-final-validation\temp\zen-canvas-file-op-test-39148-73-1790329382463278700\protected-link` → `C:\Windows`
    - `F:\Coding\Zen-Canvas-zb-05-native-global-search-runtime\.tmp-tests\zb05-final-validation\temp\zen-canvas-file-op-test-32108-0-1790329600434645400\link.txt`
    - `F:\Coding\Zen-Canvas-zb-05-native-global-search-runtime\.tmp-tests\zb05-final-validation\temp\zen-canvas-file-op-test-32108-19-1790329600981599600\source-link.txt`
    - `F:\Coding\Zen-Canvas-zb-05-native-global-search-runtime\.tmp-tests\zb05-final-validation\temp\zen-canvas-file-op-test-32108-20-1790329601000592600\linked-parent`
    - `F:\Coding\Zen-Canvas-zb-05-native-global-search-runtime\.tmp-tests\zb05-final-validation\temp\zen-canvas-file-op-test-32108-73-1790329602984408500\protected-link` → `C:\Windows`
  - The retained task-created non-reparse outputs include `.performance-artifacts`, `.performance-cache`, `node_modules`, `dist`, and the other test subdirectories under `.tmp-tests` and `src-tauri/.tmp-tests`.
  - Read-only verification on 2026-09-26 confirmed these roots still exist: `F:\_codex_tmp\zb05-run-36159205805-evidence`, `F:\_codex_tmp\zb05-mft-focused-20260925`, `src-tauri\.tmp-tests\zb05-final-validation`, `.tmp-tests\zb05-final-validation`, `.performance-artifacts`, and `.performance-cache`. The new successful Hosted artifact was streamed and inspected in memory and did not create another local artifact directory.
  - The first rejected command used `Remove-Item -LiteralPath $link.FullName -Force` without recursion for the validated links. The second used `Remove-Item -LiteralPath $path -Recurse -Force` only for exact task-owned roots previously checked to contain no reparse points. The policy rejection means local cleanup remains unresolved; this is a task-hygiene blocker, not a product correctness finding.
  - Shared `F:\CargoTarget`, the main checkout `F:\Coding\Zen-Canvas`, and their dependency data were not cleanup targets.

**Current disposition: BLOCKED — local task-artifact cleanup only.** Exact-candidate hosted Windows baseline/service qualification and full Hosted CI are green; the former Windows-baseline product-evidence blocker is resolved. The retained local roots remain a task-hygiene closeout item because cleanup was rejected by command policy. No alternate cleanup method was attempted.
