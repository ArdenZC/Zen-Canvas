# Zero-Burden Cross-Track Audit Remediation — Result

## Disposition

**OWNER REVIEW PASSED — READY TO MERGE — LOCAL TASK HYGIENE PENDING**.

Owner disposition: **OWNER REVIEW PASSED — READY TO MERGE**. The two requested runtime blockers are closed. Repaired Production HEAD `06531c55f04cbe6a4b47d66305fcf262f74a223a` and the documentation-only successor both have successful hosted CI. PR #267 remains open for merge; no merge or release is claimed.

**LOCAL TASK HYGIENE PENDING — host policy blocked cleanup — NOT A PRODUCT OR MERGE BLOCKER**.

## Identity

- Repository: `ArdenZC/Zen-Canvas`
- Baseline master SHA: `316db9a09261dd3f6d3935aae68d261c45485cf9`
- Baseline tree: `5091a6899b5570aeb776eea503b0f1ea62dbacb9`
- Branch: `remediation/zero-burden-cross-track-audit`
- Initial production commit: `6306d6ecb82b475c1495f7ac6b25ec7d255cff29`
- Previous production HEAD: `b1040a0c9761549a055099b6d3bb8b5bf526308d`
- Repaired Production HEAD: `06531c55f04cbe6a4b47d66305fcf262f74a223a`
- Repaired production tree: `3f8f725e276647c7aeafd0139728fcecebd3032d`
- Final HEAD: the documentation-only closeout successor to Production HEAD; its exact SHA is reported in the final owner closeout because a commit cannot contain its own hash.
- PR: [#267 — Zero-Burden: cross-track audit remediation](https://github.com/ArdenZC/Zen-Canvas/pull/267)

## Owner-requested runtime repair

### Main presentation failure teardown

The newly created Main window's show/focus failure cleanup now calls the existing `ExitIntentState::begin_internal_window_teardown` before native destroy. Success completes the guard with the actual remaining WebView count; failure drops the guard and preserves the original error plus workspace/readiness retry behavior. An unmarked native/system `ExitRequested(None)` still exits, and explicit Quit takes precedence.

All three repository WebView destroy paths were inspected. Main background entry and Search teardown already use the same intent guard; no other equivalent unguarded cleanup was found. No new lifecycle authority was introduced.

Five deterministic tests exercise the production cleanup helper: intent armed before last-WebView destroy; delayed one-shot consumption; failure without stale suppression; actual remaining-WebView count; explicit Quit priority. The existing six exit-intent tests and 25 app-control tests also pass.

### macOS blocking lifetime

The observer worker now owns a default-mode `CFRunLoopSource` for its complete native wait. It has no periodic timer or polling interval. The source stays dormant until shutdown. Stop signals the source as well as calling native stop/wake, so a request between the stop-flag check and `CFRunLoopRun` entry remains deliverable. The source is shutdown/lifetime plumbing only, not product event authority; Spotlight/FSEvents behavior is unchanged.

RAII cleanup clears the retained cross-thread stop action, removes and invalidates the owned source, then unregisters NotificationCenter observers before join completes. Source creation failure or an unexpected run-loop return records a reconciliation-required diagnostic rather than claiming observer health.

Hosted native tests invoke `run_workspace_observer` itself. They cover stop before source/install, immediately after install, after the stop check but before run entry, repeated stop, normal idle, Drop, unexpected native return and exactly-once observer cleanup. The idle test observes actual `CFRunLoopIsWaiting`, keeps the worker idle for a bounded test-only interval, proves notifications remain registered during idle, then proves stop/Drop joins and later notifications no longer reach the removed observers. The production worker has no timed wait; test deadlines are hang/observation guards, not product polling or latency SLAs.

### Repair validation

- Repair paths: `src-tauri/src/app_control.rs`, `src-tauri/src/app_control_main_failure_tests.rs`, `src-tauri/src/platform/macos/lifecycle.rs`, `src-tauri/src/platform/macos/run_loop.rs`, `src-tauri/src/platform/macos/lifecycle_native_tests.rs`, and the explicit native lifecycle step in `.github/workflows/ci.yml`.
- Local Windows focused tests on the repaired source: `exit_intent` **6 PASS**; `app_control::` **30 PASS** (25 existing plus five Main cleanup tests); `platform::macos::` **30 PASS**, including lifecycle/run-loop seams. Windows seam results are not native macOS evidence.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --lib --tests -- -D warnings` and the desktop binary Clippy command: **PASS**.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` and `git diff --check`: **PASS**. Local tests use worktree `.tmp-tests` on F: and preserve shared `F:\CargoTarget`.
- Hosted [CI 36217885372](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36217885372): **SUCCESS**, bound to PR source HEAD `06531c55f04cbe6a4b47d66305fcf262f74a223a`. The existing routing selects merge integration; the Rust/native lanes checked out `c65306385f4772ee91ea5588c6858109ce80ea1d`, whose tree is exactly the production tree `3f8f725e276647c7aeafd0139728fcecebd3032d`. This distinction is explicit, not a claim that the synthetic integration SHA is the source HEAD.
- Windows Rust quality, macOS Rust quality, both release compiles, Windows Global Index qualification, native macOS checks, all six routed performance suites and both Quality aggregates: **PASS**.
- The explicit **Native macOS lifecycle blocking lifetime** step passed all three native production-path tests, also exercised by the full macOS Rust suite. This is native lifecycle evidence, not owner visual acceptance or release/performance qualification.
- The documentation-only successor records these results; pre-closeout Final HEAD `075f044ccea2613605b01fb794b428e582618c83` passed hosted CI `36218506275`. No production changes follow the repaired Production HEAD.

## Earlier implementation findings and evidence

The following records the earlier implementation and its historical validation. The owner-requested repairs above supersede its incomplete Main failure cleanup and macOS source-lifetime claims.

### Exit intent

- **Root cause:** `ExitRequested.code == None` had been treated as sufficient evidence that a WebView was intentionally closing while the process should stay resident. That conflated internal last-window teardown with native/system quit.
- **Repair:** Added process-local `ExitIntentState`. Only internal Main-to-background and Search destruction paths can arm one-shot resident suppression; successful teardown consumes it once, while failed teardown withdraws it. Explicit `quit_app` and tray Quit record Exit intent. An unmarked `ExitRequested(None)` now shuts down resident owners.
- **Evidence:** Six deterministic exit-intent tests pass for last-window one-shot behavior, native/unmarked exit, explicit exit, coded exit, teardown failure and shutdown-owner dispatch.

### Single-instance privacy

- **Root cause:** The second-instance callback logged raw argv and cwd, exposing executable/user paths and arbitrary future argument values.
- **Repair:** Classification now returns only argument count, action, background-flag presence and unsupported-argument status. The callback logs these facts and a generic activation failure code; it discards raw args/cwd and never forwards unsupported args to a renderer.
- **Evidence:** App-control tests pass for path-value omission, cwd omission, manual/background classification and fail-closed unsupported arguments.

### macOS lifecycle idle polling

- **Root cause:** The observer used `runUntilDate` at 250 ms intervals to check a stop flag while otherwise idle.
- **Repair:** Extracted the existing Global Index stop signal into a shared macOS run-loop utility. The lifecycle observer now blocks in the native run loop; stop requests issue a cross-thread stop/wake, and an RAII cleanup removes observers before worker join completes.
- **Evidence:** Platform lifecycle/run-loop seam tests pass for stop-before-install, stop-after-install, repeated stop and observer cleanup. Hosted macOS Rust quality, Clippy, and Apple Silicon native Quick Look lifecycle checks passed in run `36215942981`; this is not owner native visual acceptance or macOS release qualification.

### FileWorkspace idle polling

- **Root cause:** The change worker used a 25 ms receive timeout to check stop and queue overflow while idle.
- **Repair:** Idle receive now blocks. Bounded `Notify`/`Stop` control messages wake the worker; timeout coalescing remains only while processing an active event. Queue overflow still degrades to `Uncertain`, and disposal invalidates Browse before joining.
- **Evidence:** Thirteen focused change-worker tests pass. Four Browse integration checks pass for lazy runtime ownership, shared Browse refs, hint invalidation/refresh and filesystem mutation bursts without stale publication.

### PDF timeout/cancellation correctness tests

- **Root cause:** Correctness tests used `<500 ms` elapsed assertions as hang protection, making hosted scheduler load part of the product correctness result.
- **Repair:** Removed the 500 ms wall-clock SLA. A bounded 30 s thread/channel guard detects a hung test worker; correctness assertions still require the timeout/cancel hooks and exact error reasons, durable run/item completion, no running/cancelling residue, no artifact and no FTS row.
- **Evidence:** Three focused PDF mid-flight timeout/cancel tests pass, including durable run cancellation/timeout residue checks.

### Thumbnail lifecycle and publication

- **Root cause:** The original dispose test requested work and immediately disposed without synchronizing that the request was in flight, so renderer/scheduler completion could race the test. Source review also found that production disposal did not coordinate with a generation's disk-publication gate; a write already in progress could finish after disposal.
- **Repair:** The lifecycle test now waits for renderer entry. Disposal marks the service disposed, waits on generation publication gates, revokes owners and clears memory; a generation that wrote a new disk entry but lost publication rights removes that entry. Lease/scheduler assertions wait for worker resource release rather than treating the immediate cancellation response as worker completion.
- **Evidence:** All 25 focused Thumbnail tests pass. A new disk-write barrier test confirms disposal remains blocked while publication is held, then completes after revoking publication with no `.thumb` or pending file, no memory entry and no read lease.

## Local validation

The initial focused suite below ran on Windows against implementation commit `6306d6ecb82b475c1495f7ac6b25ec7d255cff29`. Rust temporary output was directed to the task worktree on F:, and Cargo reused the existing shared `F:\CargoTarget`.

- `exit_intent`: 6 passed.
- `app_control::tests`: 25 passed.
- `platform::macos`: 29 passed on the Windows test seam; this is not native macOS evidence.
- `file_workspace::change::tests`: 13 passed.
- `file_workspace::thumbnail::tests`: 25 passed.
- `content::tests::pdf_midflight`: 3 passed.
- Browse integration filters: 4 passed (`runtime_owner_is_lazy_single_generation_and_recreates_after_teardown`, `change_monitor_and_preview_reuse_ephemeral_browse_refs`, `change_hint_invalidates_old_page_and_refreshes_through_browse_service`, and `real_filesystem_mutation_burst_refreshes_without_publishing_stale_pages`).
- `cargo check --manifest-path src-tauri/Cargo.toml --features desktop-runtime --bin zen-canvas`: passed.
- Narrow Clippy passed for the library/tests and desktop binary with `-D warnings`.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `git diff --check`: passed.

After the hosted compiler finding, the follow-up production commit `b1040a0c9761549a055099b6d3bb8b5bf526308d` moved the Tauri `Manager` import out of the `desktop-runtime` feature gate because shared app-control commands also use it in no-desktop/native-QA builds. On that exact source head:

- `cargo check --manifest-path src-tauri/Cargo.toml --features native-qa --bin macos-native-preview-lifecycle`: passed on Windows; this checks shared code but is not native macOS proof.
- Focused `app_control::tests`: 21 passed.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` and `git diff --check`: passed.

## Hosted CI

- Historical final-head run [36216437767](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36216437767) on `58eb059b83aa8c78745199871373c0083521546d`: **SUCCESS / COMPLETED**, verified live during this repair. It is no longer queued and does not validate the later repair by itself.
- Run `36213480561` on implementation commit `6306d6ecb82b475c1495f7ac6b25ec7d255cff29` exposed a compile error: `Manager` was only imported under `desktop-runtime`, while shared app-control calls also compile without that feature and on macOS. No performance suite ran in that failed attempt.
- The import was corrected in Production HEAD `b1040a0c9761549a055099b6d3bb8b5bf526308d`.
- Run `36214511995` checked out Production HEAD `b1040a0c9761549a055099b6d3bb8b5bf526308d` and completed **SUCCESS**. Source/evidence and change-routing contracts, Windows Global Index service qualification, Windows/macOS Rust quality, Windows/macOS release compilation, native macOS Quick Look lifecycle, and the routed Search, Library/Content and Workspace Foundation CI performance suites passed.
- Run `36215942981` checked out docs-only successor `ffa3a0735ae78b2ec4e4a9f4f89d8e07d85ade4c` and completed **SUCCESS**. The Windows Global Index service qualification, Windows/macOS Rust quality and release compilation, native macOS performance, routed performance suites, governance and quality aggregates passed. This successor changed documentation only; Production HEAD remains `b1040a0c9761549a055099b6d3bb8b5bf526308d`.
- The routed CI performance suites are recorded as workflow evidence only. No Resident / Interactive Performance Qualification, release qualification, or owner native visual acceptance is claimed.

## Current-truth documentation reconciliation

The docs-only successor updates `STATUS.md`, `ROADMAP.md` and `ARCHITECTURE_MAP.md` to show the current remediation and its validated production head, the completed ZB-01 through ZB-05 sequence, Resident / Interactive Performance Qualification as next, and accurate resident/runtime ownership. The W6 initiative retains its release residuals but is no longer the active engineering initiative. W6-10B security-host blockers, W6-10C macOS unverified/deferred status and deferred publication remain intact; AI Semantic Authority stays gated. `npm run test:docs` passed for all six changed Markdown files. The published successor at `ffa3a0735ae78b2ec4e4a9f4f89d8e07d85ade4c` passed hosted CI run `36215942981` on that exact head.

## Earlier implementation changed files

Production changes are committed through Production HEAD `b1040a0c9761549a055099b6d3bb8b5bf526308d`. The docs-only successor does not change the validated production source.

- Runtime/privacy/exit intent: `src-tauri/src/app_control.rs`, `src-tauri/src/exit_intent.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`.
- macOS lifecycle and Global Index stop utility: `src-tauri/src/platform/macos/lifecycle.rs`, `src-tauri/src/platform/macos/mod.rs`, `src-tauri/src/platform/macos/run_loop.rs`, `src-tauri/src/global_index/macos/fsevents.rs`, `src-tauri/src/global_index/macos/mod.rs`, `src-tauri/src/global_index/macos/spotlight.rs`.
- FileWorkspace worker and Thumbnail lifecycle/publication: `src-tauri/src/file_workspace/change.rs`, `src-tauri/src/file_workspace/thumbnail/cache.rs`, `src-tauri/src/file_workspace/thumbnail/service.rs`, `src-tauri/src/file_workspace/thumbnail/tests/lifecycle.rs`, `src-tauri/src/file_workspace/thumbnail/tests/mod.rs`.
- PDF timeout/cancellation correctness: `src-tauri/src/content.rs`.
- Current-truth and result records: `docs/project/STATUS.md`, `docs/project/ROADMAP.md`, `docs/project/ARCHITECTURE_MAP.md`, `docs/project/initiatives/W6-product-maturity-audit.md`, `docs/project/initiatives/zero-burden-cross-track-audit-remediation.md`, and this result.

## Residual risks and limits

- Owner review is **PASSED — READY TO MERGE**. Resident / Interactive Performance Qualification and AI Semantic Authority / AI-only Organize-Cleanup have not started. PR #267 is authorized for merge but is not yet merged in this tracked snapshot.
- The repaired production CI and native lifecycle evidence are recorded above; the earlier `b1040a0c9761549a055099b6d3bb8b5bf526308d` evidence remains historical. Neither establishes owner native visual acceptance or macOS release qualification.
- No owner native visual acceptance, release qualification or performance qualification is claimed.
- PR #267 remains open for merge in this tracked snapshot. Historical docs-head runs `36215942981` and `36216437767` passed; repaired production run `36217885372` passed; pre-closeout Final HEAD run `36218506275` passed. The final truth-closeout commit is docs-only.
- `.tmp-tests` remains at `F:\Coding\Zen-Canvas-remediation-zero-burden-cross-track-audit\.tmp-tests`. The repair's read-only closeout check still finds 103 descendants. Earlier evidence found no reparse points. The earlier automatic action policy rejected recursive root removal and bounded per-path cleanup with `blocked by policy`. No removal retry or policy workaround was attempted in this repair. **LOCAL TASK HYGIENE PENDING — host policy blocked cleanup — NOT A PRODUCT OR MERGE BLOCKER**.
- Owner review approval has occurred. Merge and release have not occurred in this tracked snapshot.

## Local hygiene

The shared `F:\CargoTarget` cache is preserved. The exact unresolved temporary root and non-blocking hygiene disposition are recorded above. The final tracked tree is checked separately from this intentionally retained ignored root.
