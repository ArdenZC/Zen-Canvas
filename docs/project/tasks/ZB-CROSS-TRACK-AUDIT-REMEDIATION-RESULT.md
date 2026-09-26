# Zero-Burden Cross-Track Audit Remediation — Result

## Disposition

**BLOCKED — PRODUCTION IMPLEMENTATION AND HOSTED CI ARE COMPLETE, BUT THE DOCS SUCCESSOR IS NOT PUBLISHED AND TASK TEMP CLEANUP WAS BLOCKED BY POLICY.** Draft PR #267 remains open at the validated production head. No owner approval, Ready transition, merge or release is claimed.

## Identity

- Repository: `ArdenZC/Zen-Canvas`
- Baseline master SHA: `316db9a09261dd3f6d3935aae68d261c45485cf9`
- Baseline tree: `5091a6899b5570aeb776eea503b0f1ea62dbacb9`
- Branch: `remediation/zero-burden-cross-track-audit`
- Initial production commit: `6306d6ecb82b475c1495f7ac6b25ec7d255cff29`
- Production HEAD: `b1040a0c9761549a055099b6d3bb8b5bf526308d`
- Final HEAD: the documentation-only closeout successor to Production HEAD; its exact SHA is reported in the final owner closeout because a commit cannot contain its own hash.
- Draft PR: [#267 — Zero-Burden: cross-track audit remediation](https://github.com/ArdenZC/Zen-Canvas/pull/267)

## Findings and repairs

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
- **Evidence:** Platform lifecycle/run-loop seam tests pass for stop-before-install, stop-after-install, repeated stop and observer cleanup. Hosted macOS compilation, Clippy and native-target tests are pending.

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

- Run `36213480561` on implementation commit `6306d6ecb82b475c1495f7ac6b25ec7d255cff29` exposed a compile error: `Manager` was only imported under `desktop-runtime`, while shared app-control calls also compile without that feature and on macOS. No performance suite ran in that failed attempt.
- The import was corrected in Production HEAD `b1040a0c9761549a055099b6d3bb8b5bf526308d`.
- Run `36214511995` checked out Production HEAD `b1040a0c9761549a055099b6d3bb8b5bf526308d` and completed **SUCCESS**. Source/evidence and change-routing contracts, Windows Global Index service qualification, Windows/macOS Rust quality, Windows/macOS release compilation, native macOS Quick Look lifecycle, and the routed Search, Library/Content and Workspace Foundation CI performance suites passed.
- The routed CI performance suites are recorded as workflow evidence only. No Resident / Interactive Performance Qualification, release qualification, or owner native visual acceptance is claimed.

## Current-truth documentation reconciliation

The local docs-only successor updates `STATUS.md`, `ROADMAP.md` and `ARCHITECTURE_MAP.md` to show the current remediation and its validated production head, the completed ZB-01 through ZB-05 sequence, Resident / Interactive Performance Qualification as next, and accurate resident/runtime ownership. The W6 initiative retains its release residuals but is no longer the active engineering initiative. W6-10B security-host blockers, W6-10C macOS unverified/deferred status and deferred publication remain intact; AI Semantic Authority stays gated. `npm run test:docs` passed for all six changed Markdown files.

The docs-only commit is local and is not part of the remote PR head. The CI classifier evaluates the cumulative PR diff against `master`, so publishing the docs successor would queue another full Windows/macOS and routed-performance matrix. It is held to preserve the requested single final hosted integration pass.

## Changed files

Production changes are committed through Production HEAD `b1040a0c9761549a055099b6d3bb8b5bf526308d`. The docs-only successor does not change the validated production source.

- Runtime/privacy/exit intent: `src-tauri/src/app_control.rs`, `src-tauri/src/exit_intent.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`.
- macOS lifecycle and Global Index stop utility: `src-tauri/src/platform/macos/lifecycle.rs`, `src-tauri/src/platform/macos/mod.rs`, `src-tauri/src/platform/macos/run_loop.rs`, `src-tauri/src/global_index/macos/fsevents.rs`, `src-tauri/src/global_index/macos/mod.rs`, `src-tauri/src/global_index/macos/spotlight.rs`.
- FileWorkspace worker and Thumbnail lifecycle/publication: `src-tauri/src/file_workspace/change.rs`, `src-tauri/src/file_workspace/thumbnail/cache.rs`, `src-tauri/src/file_workspace/thumbnail/service.rs`, `src-tauri/src/file_workspace/thumbnail/tests/lifecycle.rs`, `src-tauri/src/file_workspace/thumbnail/tests/mod.rs`.
- PDF timeout/cancellation correctness: `src-tauri/src/content.rs`.
- Current-truth and result records: `docs/project/STATUS.md`, `docs/project/ROADMAP.md`, `docs/project/ARCHITECTURE_MAP.md`, `docs/project/initiatives/W6-product-maturity-audit.md`, `docs/project/initiatives/zero-burden-cross-track-audit-remediation.md`, and this result.

## Residual risks and limits

- Hosted macOS compilation, Clippy, native lifecycle and routed performance CI checks passed on Production HEAD `b1040a0c9761549a055099b6d3bb8b5bf526308d`. This does not establish owner native visual acceptance or macOS release qualification.
- No owner native visual acceptance, release qualification or performance qualification is claimed.
- The remote Draft PR remains at Production HEAD `b1040a0c9761549a055099b6d3bb8b5bf526308d`; the docs-only successor is local and awaits the user's decision on the additional hosted run.
- `.tmp-tests` remains at `F:\Coding\Zen-Canvas-remediation-zero-burden-cross-track-audit\.tmp-tests`. It contains 103 task-owned descendants and no reparse points. The automatic action policy rejected both a recursive root removal and a bounded per-path cleanup attempt with the response `blocked by policy`; cleanup is unresolved.
- No owner approval, Ready transition, merge or release has occurred.

## Local hygiene

The shared `F:\CargoTarget` cache is preserved. The exact unresolved temporary root and cleanup result are recorded above.
