# PM-02B Windows resident-lifecycle remediation evidence

Status: **HISTORICAL BACKGROUND RESIDENT-LIFECYCLE NATIVE FAIL REMEDIATED; FINAL WINDOWS OWNER REQUALIFICATION PASS ON 823edc2b; PM-02B COMPLETE / MERGED / OWNER REVIEW PASSED / MERGE-AFTER MASTER CI SUCCESS.** PR #317 squash-merged as `master@fc433f305aafbc2326a15a39eb93476ebd4da20d`; merge-after master CI 37265536740 is **SUCCESS**. PM-03 is NOT ACTIVE.

## Exact identities and preserved qualification

Start: `c82356c9347a5fe009a1db67f39db51efd891a31`, tree `b849317416302c78288e3d5b3b0c6dc375fe61fb`, existing Draft PR #317 / `product/pm-02b-event-schedule-triggers`.

Remediation source: `0c98d5c15c0e93c7513eb4f652afdfe781673acd`, tree `6dc8282a52452e39b531e0c589e81c18ed77b0ad`. Schema 37 and package 0.1.40. A subsequent documentation-only closeout does not change this production/native-QA source; its final Git identity and exact-head CI are reported separately in the handoff.

The original Owner report at `F:/CargoTarget/pm02b-owner-requal-20261002-c82356c9-fresh/qualification-report.md` and supplement at `F:/CargoTarget/pm02b-owner-supplement-20261002-c82356c9-01/qualification-supplement.md` were read completely and preserved. Historical PASS remains: native watcher registration, single append/full chain, five-second settle, burst coalescing, create/rename/remove, natural Schedule delivery, exact-binary restart deduplication, Run now, toggle/re-enable debt reset and edit-revision debt reset. Observed Zen Canvas automatic filesystem mutations remain zero. The original reset attempt missed its timing precondition; it is not relabeled a product failure. The supplement's first genuine blocker is **BACKGROUND DELIVERY — FAIL**; rows after that STOP remain **UNVERIFIED**. No old binary acceptance is promoted to this changed lifecycle source.

## Native pre-fix reproduction and first incorrect boundary

The isolated diagnostic binary was built from exact c823 source plus only the frozen diagnostic patch. Fresh native Main was closed through its supported close-choice dialog and the right-hand minimize/background button. No synthetic ExitRequested or state-machine invocation was used as reproduction. PID 30816 exited; the trace contains exactly **one ExitRequested, code=None**, followed by the genuine Tauri Exit event. Pre-fix binary SHA-256: `AC525B812F837B57C0AC8F0CC31843A8E64C065620DD2E9E15D3E57AC6D7EBA5`. Diagnostic patch/binary/log/profile are preserved under `F:/CargoTarget/pm02b-resident-lifecycle-20261002/pre-fix/`.

Complete stderr lifecycle/startup trace (display whitespace trimmed; original raw log preserved):

```text
native_qa startup_checkpoint=process_main_entered
native_qa startup_checkpoint=tauri_setup_entered
native_qa startup_checkpoint=database_ready
native_qa startup_checkpoint=core_runtime_owners_ready
native_qa startup_checkpoint=tray_ready
native_qa startup_checkpoint=autostart_sync_complete
native_qa startup_checkpoint=hotkey_setup_complete
native_qa startup_checkpoint=watcher_setup_complete
ui_runtime main_window_created generation=1 webview_count=1
ui_runtime startup_mode=manual webview_count=1 labels=main
native_qa startup_checkpoint=setup_complete
ui_runtime main_window_ready generation=1 create_to_ready_ms=582.8672 webview_count=1
native_qa lifecycle seq=0 pid=30816 stage=enter_background in_flight=0 stay_resident=false explicit_exit=false generation=1 webviews=1 labels=main
native_qa lifecycle seq=1 pid=30816 stage=teardown_begin in_flight=1 stay_resident=true explicit_exit=false generation=1 webviews=1 labels=main predicted_last=true_if_webviews_le_in_flight
native_qa lifecycle seq=2 pid=30816 stage=destroy_start in_flight=1 stay_resident=true explicit_exit=false generation=1 webviews=1 labels=main
native_qa lifecycle seq=3 pid=30816 stage=destroy_result in_flight=1 stay_resident=true explicit_exit=false generation=1 webviews=1 labels=main result=ok
native_qa lifecycle seq=4 pid=30816 stage=teardown_complete in_flight=0 stay_resident=false explicit_exit=false generation=1 webviews=1 labels=main
ui_runtime main_window_destroyed generation=1 webview_count=1
native_qa lifecycle seq=5 pid=30816 stage=exit_requested in_flight=0 stay_resident=false explicit_exit=false generation=1 webviews=0 labels= request_seq=1 code=None
native_qa lifecycle seq=6 pid=30816 stage=exit_action in_flight=0 stay_resident=false explicit_exit=false generation=1 webviews=0 labels= action=Exit prevent_exit=false shutdown=true
native_qa lifecycle seq=7 pid=30816 stage=run_event_exit in_flight=0 stay_resident=false explicit_exit=false generation=1 webviews=0 labels=
```

The first incorrect decision is teardown completion: `destroy()` succeeded while Tauri still registered one Main WebView; `finish_internal_teardown(remaining_webviews=1)` cleared `stay_resident_pending`. Native removal subsequently generated ExitRequested(None) with zero WebViews and an unmarked ledger. Dispatch selected Exit, did not prevent exit, invoked resident shutdown and reached RunEvent::Exit. This proves an asynchronous destroy/registry ordering defect, not repeated exit requests, a coded exit, or a watcher-routing failure.

The app-control and exit-intent blobs at master `d76bc1f54892bb3e48ac095ea590dcb170f3aa4e` and c823 are identical (`d357f5ec452834286553bab09f2e49110b00c65f` and `df5d8896ecbc4034c63f12af34c822cc2741d5a2`). Classification: **shared resident-lifecycle blocker exposed by PM-02B Owner qualification**. PM-02B's Automation shutdown joins the existing genuine-exit branch; it did not define the faulty teardown intent. Earlier ZB-04 native evidence explicitly did not execute Main close-to-background plus tray reopen; its deterministic tests assumed zero registered WebViews at synchronous completion and one-shot suppression. Those narrower results remain historical evidence.

## Lifecycle contract and regression

A successful destroy request completes the guard without consulting the not-yet-updated registry count. Resident intent survives delayed and repeated uncoded requests until a new on-demand window is created or genuine exit is recorded. Failure drops the guard and withdraws the batch prediction in either concurrent completion order. Explicit Quit and every coded exit/restart take precedence and remain sticky; resident shutdown is dispatched once. Main and Search retain destroy-on-demand, generation/readiness ownership and failure rollback.

Local host: Windows 11 Pro 10.0.26300, 64-bit; Rust 1.97.1. Lifecycle diagnostics are limited to 256 records and 900 detail characters per record, and contain no personal paths, contents or secrets.

The native-QA-only probe runs the real product Tauri runtime, existing Database/watcher/Automation/Global Index/WorkScheduler owners, backend enter_background command, tray's shared show_main_window owner, frontend readiness acknowledgement, native quit_app and tray's shared exit_app owner. It never fabricates an exit event or readiness acknowledgement. Notification-driven condition-variable waits have bounded failure deadlines; there is no timed polling, heartbeat, second resident process/tray/watcher or production telemetry. The Windows Rust-quality job builds real embedded frontend assets and executes both modes through `scripts/runWindowsResidentLifecycleQa.ps1`.

Final local native candidate: SHA-256 `8FE3894E60622F619A514B876628BB33030FF56BC0C022C8C6FAABD75254B4AA`; preserved at `F:/CargoTarget/pm02b-resident-lifecycle-20261002/final-source-candidate.exe`. Logs and isolated profiles are at `native-regression-final-source/` under that task root.

| Engineering regression | Result |
| --- | --- |
| Main last WebView, background cycle 1 | PASS: PID 13112, generation 1, real ExitRequested #1 code=None prevented, zero WebViews, FileWorkspace disposed, no resident shutdown |
| Real append while backgrounded | PASS: watcher 0→1, applied 1, library 1→2; automatic one Run/one Plan after 5.190 seconds; no manual rescan or UI reopening before publication |
| Tray show-Main owner | PASS: same PID, generation 2, real frontend readiness, unchanged resident owner addresses; no duplicate owners |
| Background cycle 2 | PASS: real ExitRequested #2 code=None prevented; zero WebViews and no shutdown |
| Explicit Quit from background | PASS: ExitRequested #3 code=Some(0); Automation, Global Index and Managed AI shutdown each invoked once; normal Tauri Exit and process termination |
| Native quit_app from visible Main | PASS: separate sequential fresh-profile PID 30988, ExitRequested #1 code=Some(0), each resident shutdown once, normal Exit/process termination |
| Fixture/safety manifest | PASS: one file, one test-authored append, expected final bytes, zero operation logs/trash items; automatic filesystem mutations=0 |
| Actual database/package identity | PASS: both mode databases Schema 37; Cargo/package version 0.1.40 |

Tray menu mouse interaction and the complete post-review Owner matrix are not claimed by this engineering probe. They remain part of fresh exact-binary Windows Owner requalification.

## Validation and hosted CI

- Exit-intent tests: **9/9**; app-control lifecycle/readiness/single-instance/background/tray ownership tests: **30/30**; watcher tests: **25/25**; lifecycle architecture/source contract: **6/6**.
- PM-02B trigger suite: **20/21**, with unchanged known local baseline failure `automatic_current_and_stale_semantics_reuse_shared_admission_without_mutation` (completed instead of blocked). The same failure was reproduced on untouched c823, and was already recorded from pristine e91f27e. No trigger/provider/admission source or threshold was changed to conceal it.
- Strict Rust format, strict Clippy with desktop-runtime/native-qa and all targets, documentation/governance validation, and diff checks passed. Frontend production source is unchanged; only the directly affected lifecycle source-contract test was updated and strengthened.
- First hosted run [37012699480](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37012699480) is preserved: its frontend source-contract test failed on the obsolete two count-based completion assertion; the overall run was subsequently cancelled by existing CI concurrency when superseded. The targeted correction requires failed teardown rollback, exactly one accepted completion, ordering, recreation, and the real hosted regression; no assertion was simply removed. Intermediate run [37013226026](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37013226026) is retained as cancelled/superseded history; neither superseded run is claimed green.
- Fresh exact-head hosted CI [37013892661](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37013892661) is **SUCCESS** on `0c98d5c15c0e93c7513eb4f652afdfe781673acd`. Windows Rust unit tests passed **1,122 / 1,122**, with 24 intentional ignores; the existing real watcher regression and native filesystem hardening smoke each passed **1/1**. Both new real Tauri modes passed: hosted background PID 7000, watcher/applied 0→1/1, library 1→2, one automatic Run/Plan at **5.177 seconds**, generation 2 readiness and unchanged owners, second background, zero automatic filesystem mutations, and normal Quit with each shutdown once. The complete Windows/macOS aggregate Quality and performance gates passed. Old run 36993795735 is historical c823 evidence only and is not reused for the remediation claim.

Production scope excludes watcher routing, trigger state/calendar, Schema/migrations, Plan/provider/admission policy, cleanup/trash/execution, Preference research and PM-03. No permanent hidden Main, polling, second process/tray/watcher, new command/capability, or automatic filesystem execution change was introduced.

## Changed paths

Lifecycle source/wiring: `src-tauri/src/exit_intent.rs`, `src-tauri/src/app_control.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`.

Direct regression/diagnostic gate: `src-tauri/src/app_control_main_failure_tests.rs`, `src-tauri/src/native_resident_lifecycle_qa.rs`, `tests/onDemandUiRuntime.test.ts`, `scripts/runWindowsResidentLifecycleQa.ps1`, `.github/workflows/ci.yml`.

Documentation-only closeout: `docs/project/STATUS.md`, `docs/project/tasks/AI-ONLY-PM-02B-EVENT-SCHEDULE-TRIGGER-RESULT.md`, `docs/project/tasks/evidence/PM-02B/windows-native-qualification.md`, `docs/project/tasks/evidence/PM-02B/windows-resident-lifecycle-remediation.md`.

## Historical Owner handoff — superseded by final closeout below

After code/CI review, build a fresh exact candidate binary and requalify identity, Main background/PID/zero WebViews, background append/publication/automatic delivery, tray menu reopen/new generation/readiness, background again, natural resident Schedule delivery, same-binary restart idempotence, explicit Quit and final mutation manifest. Then continue the previously unverified review-suppression completion, Advanced Rules separation, focus/narrow layout, pending-event restart recovery, resource-admission/metadata-exclusion dispositions and real Windows suspend/resume where supported. Prior filesystem variants/debt-reset PASS remains historical unless affected owners change. PR #317 stays OPEN/Draft/unmerged; PM-02B stays Owner Review Pending; PM-03 stays NOT ACTIVE.

## Final Owner requalification disposition — 2026-10-05

The historical c823 background-delivery failure remains preserved and is classified **HISTORICAL NATIVE FAIL → REMEDIATED → OWNER REQUALIFICATION PASS**. The lifecycle repair at 0c98d5c15c0e93c7513eb4f652afdfe781673acd keeps resident intent across accepted asynchronous Main destruction while genuine Quit remains authoritative. Engineering exact-head CI [37013892661](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37013892661) passed; the final accepted candidate 823edc2b87c958f4bfdf7f6ba4211328140ccca2 / tree 63918653f3791386cb86f7208b01deda96ea7f89 passed exact-candidate CI [37016643626](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37016643626).

Owner native requalification then passed Main-to-zero-WebView residency, delivery without Main, tray reopen and fresh Main readiness with resident owners retained, repeated background lifecycle, natural resident Schedule delivery, same-binary persistence/no replay of delivered causes, visible-Main exit and genuine tray Quit with resident-owner shutdown. Zen Canvas automatic filesystem mutations remained zero.

Pending-event pre-settle restart recovery remains **ACCEPTED UNVERIFIED — NATIVE EXIT TIMING LIMITATION**; suspend/resume remains **ACCEPTED UNVERIFIED — HOST POWER-CONTROL LIMITATION**. Native narrow/focus, metadata exclusion and resource-saturation limitations retain the evidence dispositions recorded in the [final Windows qualification record](windows-native-qualification.md). The earlier Required Owner handoff below is historical and superseded. PR #317 is merged as `master@fc433f305aafbc2326a15a39eb93476ebd4da20d` / tree `f7ce37786816b1af31a43f70e351430067790f6d`; merge-after master CI 37265536740 is **SUCCESS**. PM-03 remains **NOT ACTIVE**.
