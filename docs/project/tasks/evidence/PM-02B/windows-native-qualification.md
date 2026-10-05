# PM-02B Windows native qualification

Status: **FINAL OWNER CORE WINDOWS NATIVE QUALIFICATION PASS ON 823edc2b; OWNER-ACCEPTED UNVERIFIED EVIDENCE LIMITATIONS; PM-02B COMPLETE / MERGED / OWNER REVIEW PASSED / MERGE-AFTER MASTER CI SUCCESS.** Earlier failures and CI records remain intact. PR #317 squash-merged as `master@fc433f305aafbc2326a15a39eb93476ebd4da20d`; merge-after master CI 37265536740 is **SUCCESS**. PM-03 is NOT ACTIVE.

## Previously recorded CI result and native requalification gate

The original managed-scope-change event failure at `e91f27ed278bc80a0cc92fe79e8b83748fa8f812` remains the historical native result. The root-authority remediation was implemented at `97a42ed2df9c9e460e349a5ebe62be10cddad507`. The first remediation candidate, `b304ea91fb7c1380870629156121c032ea14bc7d` / tree `279f951113cddf3923e0d19ca4e3730d9601bb81`, failed hosted CI [36906218806](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36906218806) only at the Windows watcher-membership test's fixture teardown (OS error 32); its functional assertions had completed.

The test-only ownership repair is `a3dd9082018185891b536b9d1fb693b5ae27a3cf` / tree `1b0fd77ce8d68a041e8d003a7ee711492968def5`. The test now stores its SQLite database outside the disposable filesystem fixture using the existing module helper. No production code changed. The formerly failing Windows exact test passed three consecutive times. Fresh exact-head hosted CI [36961723813](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36961723813) completed **SUCCESS** on that exact SHA, including Windows Rust quality and aggregate Windows Quality. This CI result does not constitute native product acceptance.

That is the last hosted CI for the prior candidate. The event-delivery implementation source is `fc5e2b7be00eb29db7629a21e3c640fe1626cf34` / tree `39b229033e26d42feec48dcd3c3ce7874e1cea8a`. Its first exact-head hosted run, [36990307913](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36990307913), remains a failure: the new real-Windows regression timed out on the initial create with durable watcher/applied/library state `0/0/0`. That run had no stage tracing, so it does not establish why the default system-temp fixture received no publication. A follow-up commit `68ddd8d7bf08aa11cecc3ecc07d3bdeb3c480a71` / tree `c4951a967f64022c2fc299005edbb1712689bad4` changes only the Windows regression CI step: it enables the existing bounded `native-qa` trace and pins the disposable test root to a child of the job's `${{ runner.temp }}`. Fresh exact-head hosted CI [36991861097](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36991861097) completed **SUCCESS** on that exact head. The prior failure is preserved, not relabeled.

Fresh Owner-observed Windows native product requalification has not been performed on the repaired head. It remains the next required gate; this backend regression and hosted CI are not substitutes for the Owner's Tauri-window rows. PR #317 remains **OPEN / Draft / unmerged**; PM-02B remains **OWNER REVIEW PENDING**; Schema remains **37**; PM-03 remains **NOT ACTIVE**. The original e91 failure section below is retained verbatim as historical evidence.

## Post-remediation native event failure at `4777e87e` — root cause unproven

This separate native reproduction occurred after the event-root-authority remediation and fixture repair, at source `4777e87e6ec86e629538a806df55a7ea7bf34e1f` / tree `6bce117c739d5429cccf716a5f31cb14c3f18d4d`. It does not replace or reinterpret the original `e91f27e` failure above. The observation establishes that the required event path still failed on this head; it does not by itself identify the first failing boundary.

- Host interaction used the real Windows Tauri window. The isolated profile and disposable root were under `F:/CargoTarget/pm-02b-native-requalification-20261002-0633utc/`; the event root was `F:/CargoTarget/pm-02b-native-requalification-20261002-0633utc/test-root`.
- The event root was enabled through `default_scan_folders`, with setting ID `scan-root-f-cargotarget-pm-02b-native-requalification-20261002-0633utc-test-root-454fc51a`. Its durable File Library root ID was `scan-root-01a0fb5b-bb56-78d2-86a1-bc390c00de98`, enabled and healthy at generation 3.
- Immediately before mutation, durable state was `watcher_revision=0`, `watcher_applied_revision=0`, `library_change_revision=1`, and `watcher_last_event_at=NULL`.
- At `2026-10-02T07:16:39.9297446Z`, the qualification harness manually appended to only `event-a.txt` in that disposable root. The file changed from 32 bytes / SHA-256 `FCE636ADEAE0FC7DD3C41EA1069FDD6128316C2F375687B27D7622CD4755754E` to 63 bytes / SHA-256 `BA573DB7B90CC404453BFEB77D753FDBEDC21146190A34B3FD9B7AF1A19FE8D5`.
- After the initial two-second observation and again after the natural five-second settle interval, the durable values remained `0/0/1`, `watcher_last_event_at` remained `NULL`, the event Run count remained zero, and total Plan count remained two.
- No manual scan, watcher reload, forced retry, or repeated mutation was used. The remaining native qualification rows were not run after this STOP. The disposable-root manifest reported `Zen Canvas automatic filesystem mutations = 0`.

**STOP:** the configured, healthy, watcher-owned root still did not publish this real file mutation on the remediated head. The exact first failing boundary remains **UNPROVEN** pending bounded native-QA observability and a real-Windows watcher regression. Do not infer that notification registration succeeded merely from the configured root or its healthy scan state.

## Subsequent root-cause proof and event-delivery remediation

The preceding STOP and its owner-observed profile are preserved as recorded. A separate isolated Windows backend regression then localized and reproduced the same path failure at exact pre-remediation source `4777e87e6ec86e629538a806df55a7ea7bf34e1f` / tree `6bce117c739d5429cccf716a5f31cb14c3f18d4d`. This was a bounded local OS-watcher regression, not a rerun of the Owner's Tauri-window qualification.

The regression enrolled a fresh persistent root through enabled `default_scan_folders`, enabled backend watcher reconciliation, started the production `RecommendedWatcher`, and confirmed the `FileWatcherManager` active session owned exactly that canonical root. Bounded `native-qa` tracing showed registration succeeded and one root was active. Real Windows `Create(Any)` and `Modify(Any)` callbacks were queued as `WatcherInput::Notify` and reached `event_to_payload`; both produced payloads. The coalesced Windows payload contained an extended `\\?\` path prefix. At routing, exactly one persisted watcher-root config was available but the path matched **zero** roots. No `begin_watcher_revision` call was attempted, and the isolated test database stayed at watcher/applied/library revisions `0/0/0` with no last-event timestamp. This establishes the first failed boundary as **normalized event path → watcher-root routing**, before durable watcher batch publication or Automation settling.

The cause was a normalization mismatch: Windows `notify` supplied an extended-length path, while `watcher::normalize_path` only changed backslashes to slashes. The durable settings/root normalizer already strips `\\?\` and converts `\\?\UNC\` to the shared slash form. The earlier root-authority remediation correctly restricted routing and event eligibility to enabled persisted `default_scan_folders`; it did not normalize a native notify path before matching that authority.

The regression then passed against the narrow fix: `watcher::normalize_path` now delegates to the existing `crate::db::normalize_path_text`. On the same real OS backend and fresh isolated fixture, tracing showed `extended_prefix_count=0`, one route match to the expected root ID, and successful watcher revision starts and exact mutation publication. Create advanced watcher/applied/library revisions from `0/0/0` to `1/1/1`; append advanced them to `2/2/2`; `watcher_last_event_at` was non-null after each publication, `watcher_last_applied_at` caught up, and persisted file size matched the real file. The bounded regression performs only explicit harness `std::fs` create/append operations; Zen Canvas automatic filesystem mutations remain zero.

The new Windows regression, `windows_recommended_watcher_publishes_real_file_create_and_append`, crosses the actual `RecommendedWatcher` callback and production routing/publication path. It does not inject a synthetic notify event or call `process_backend_payload` / `begin_watcher_revision` from the test. It is gated by the existing `performance-test-tauri` mock-AppHandle feature plus Windows, uses deterministic isolated-root/database cleanup and bounded 12-second publication waits, and is wired into the PR-triggered Windows Rust CI job as a separate command. `native-qa` tracing is capped at 256 records of at most 900 characters, scopes paths to the disposable root, reports the raw path-prefix class and queue result, and distinguishes `begin_watcher_revision` results `some`, `none` and `error`; it logs no file contents or unrelated paths. Existing watcher registration failures remain errors: a failed initial/handoff install runs the existing reload-gap path, which marks enabled roots for durable reconciliation before the settings reload fails; no healthy active session is claimed by the manager.

Two older watcher unit fixtures also failed on the exact pre-remediation HEAD with the same `performance-test-tauri` feature set: their direct database-root sync omitted persisted `default_scan_folders`, so the current single watcher-root authority correctly produced no route. Those tests now persist their settings-owned roots before syncing. Production root filtering was not weakened. The updated watcher module passes **29/29**; the pre-remediation reproduction was **26/28**, with those same two fixture failures.

This repairs only Windows notify-path normalization in the existing watcher publication path. It adds no second watcher, polling or periodic rescan; does not broaden root ownership, alter fail-closed scopes or overlap/coalescing behavior, change Schema 37 or package `0.1.40`, or touch schedule, Run-now, admission, Plan execution or filesystem-mutation authority. Owner Windows UI, layout/focus, remaining product rows and suspend/resume qualification have not been run on the remediation candidate and remain required.

## Exact-head hosted Windows regression and current native gate

The source fix remains the narrow path-normalization change at `fc5e2b7be00eb29db7629a21e3c640fe1626cf34`. The first hosted run on that source, [36990307913](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36990307913), failed only in the added real-watcher regression: after the bounded 12-second create observation, state remained `(watcher_revision, watcher_applied_revision, library_change_revision) = (0, 0, 0)`. Because that run did not enable `native-qa` trace, its exact first failing callback/route boundary is unknown; its failure remains part of the record.

The trace-enabled CI follow-up at `68ddd8d7bf08aa11cecc3ecc07d3bdeb3c480a71` uses a fresh root directly under the GitHub job's temporary directory. Its exact-head run [36991861097](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36991861097) is **SUCCESS**. The Windows Rust suite reported **1,119 passed / 0 failed / 24 ignored**; the real `RecommendedWatcher` regression passed **1/1**, strict Clippy and native filesystem hardening smoke passed, and the workflow completed successfully. The trace showed one registered and active watcher-owned root; real `Create(Any)` and `Modify(Any)` callbacks with extended-length paths were queued and converted to payloads; coalescing removed the extended prefix; the normalized path matched exactly one root; `begin_watcher_revision` returned revisions 1 and 2; exact mutation publication succeeded; `library_change_revision` advanced 0→1→2; and `watcher_applied_revision` caught up to each revision. Trace paths were scoped to `<trace-root>` and no file content was logged.

The changed CI fixture location and trace setting make this a passing hosted regression run while preserving the earlier failure. They do not establish whether that first no-publication result was caused by the default temp location or by a transient hosted-runner notification miss. In either case, the repaired product-source path has now crossed the actual Windows watcher callback, route and durable publication stages in hosted CI. This remains backend regression evidence only: no repaired-head Owner Tauri-window requalification, full PM-02B row set, or suspend/resume cycle has been run. Fresh Windows Owner requalification remains **REQUIRED / NOT RUN**.

## Identity and isolation

- Repository/PR: `ArdenZC/Zen-Canvas`, PR `#317`, branch `product/pm-02b-event-schedule-triggers`.
- Qualified implementation source: `e91f27ed278bc80a0cc92fe79e8b83748fa8f812`, tree `c3a74d38380b716af6242c71f7f0f088dcd514b5`; base `91589a89974324e821b4963b062c3070949252a8`.
- Package: `0.1.40`; SQLite `PRAGMA user_version = 37` after relaunch.
- Host: Windows 11 Pro, version `10.0.26300`, build `26300`, 64-bit.
- Native binary: `F:/CargoTarget/pm-02b-native-final-20261001-e91f27ed/cargo-target/debug/zen-canvas.exe`; SHA-256 `0C87DB0C9741DD809DE770B22DB5AE73F81002B586EB56095A5F04A0D7707522`.
- Isolated profile/database: `F:/CargoTarget/pm-02b-native-final-20261001-e91f27ed/profile/zen-canvas.sqlite3`; `APPDATA`, `LOCALAPPDATA`, `TEMP`/`TMP`, Cargo target, and `ZC_NATIVE_QA_PROFILE_ROOT` were task-scoped.
- Disposable root: `F:/CargoTarget/pm-02b-native-final-20261001-e91f27ed/test-root` only. It contains the four listed fixtures; no personal folder was used.
- Control provenance: Sky controlled the real native Tauri window. The initial window reached `main_window_ready`; the Automation workspace and native Settings/close dialog were visibly operated. Native screenshots were returned in the qualification session, not saved as image files.

The first normal close was followed by a same-binary/profile launch. The standalone debug process initially displayed a WebView connection error because its Vite dev host had stopped. After starting the task-local Vite host at `127.0.0.1:5173` and reloading the native window, the app rendered normally. The database then retained the same schedule occurrence and Plan without duplication. This is recorded as a dev-host harness caveat.

## Initial native qualification at e91f27ed — FAILED

This section is the original, pre-remediation native qualification record for source `e91f27ed278bc80a0cc92fe79e8b83748fa8f812`, tree `c3a74d38380b716af6242c71f7f0f088dcd514b5`. The failure below is retained as observed and is not superseded by later remediation evidence.

### Startup, Schema 37, and safety policy

The real native app opened the isolated database at Schema 37 and loaded Automation. The Automation page showed `Review required · Automatic file changes: Never`. Both configured automatic trigger kinds were visible and enabled. No provider credential was configured. The isolated Global Index had zero volumes and zero entries; the observed Runs therefore truthfully retained `analysis_blocker_code = managed_scope_missing` and created reviewable Plans. No Plan execution or filesystem operation was invoked.

### Schedule and restart idempotence

- Intent `automation-intent-9e2e2513-79cd-491b-916f-dbf77afc85e9`, revision `1`, title `PM02B Native Schedule`; trigger `schedule`, zone `Asia/Shanghai`, local time `00:28`, weekdays `[1,2,3,4,5,6,7]`.
- Backend next due after delivery and relaunch: `2026-10-03 00:28:00 +08:00` (`1790958480`).
- The `2026-10-02 00:28` occurrence delivered exactly one Run: `automation-run-23f42ab7-74b3-4a44-9308-47d677af4063`, request key `auto:schedule:2649fe0a5e148106f6cf8de62000c637b97477e7da010a4112641b162106d361`, trigger context kind `schedule`, status `blocked`, analysis blocker `managed_scope_missing`.
- Its Plan was `organization-plan-aaa0ee8e-20ed-477c-990b-595abbe73652`, status `ready`, five requested/materialized items. The native Plan screen showed five planned, zero included, zero pending decision, and five unprocessable. The Plan remained review-gated.
- Counts immediately before normal close: `2` Intents / `1` Run / `1` Plan. After same-binary/profile relaunch: `2` / `1` / `1`; the delivered occurrence was not replayed, no duplicate Plan appeared, and next due advanced to the next daily occurrence.

### Manual Run-now regression

One native Run-now action on the schedule Intent created Run `automation-run-acbf00cb-c3af-4795-84f7-2cc4ae734ef7` with `trigger_kind = manual`, status `blocked`, and Plan `organization-plan-8dedcf91-a748-4908-aedd-b33e792b74ef`. The Intent configuration remained Schedule, revision `1`, at `00:28 Asia/Shanghai`. Counts became `2` Intents / `2` Runs / `2` Plans. The native UI did not expose request-key entry; reserved `auto:` namespace spoofing was not directly exercisable here.

### Managed-scope-change STOP reproduction

- Event Intent `automation-intent-7ccd8a78-6951-4f65-94cc-b8f76f1fd4f7`, revision `1`, enabled, trigger `managed_scope_change`, scoped to the disposable root.
- Root `scan-root-01a0f840-1d88-7eb3-b795-3af0afed40b3` was enabled. Native Settings displayed `test-root` as `已同步`; the last recorded root state was healthy, generation `4`, last successful generation `4`, with no scan error.
- Immediately before the one-file input, `library_change_revision = 1`; `watcher_revision = 0`; `watcher_applied_revision = 0`; `watcher_last_event_at = NULL`. The enabled event Intent had consumed root revision `1` and had no pending cause.
- At `2026-10-01T16:41:56.1212231Z`, the qualification harness modified only `event-a.txt` inside the named disposable root. It changed from 32 bytes / SHA-256 `81506D97AE9B6F82222E226201812C5E4791824642EC58EB27F688A25037A747` to 40 bytes / SHA-256 `D3656526DFA08250ACBA72BFE8CE447ED5038E16476BA9CE2A5335BDADC57F50`.
- After eight seconds, durable state was unchanged: root `library_change_revision = 1`, watcher revision/applied revision `0/0`, no watcher event timestamp, no pending root revisions or settle deadline, and no event Run. Counts remained `2` Runs / `2` Plans. The latest successful scan (generation `4`, `2026-10-02 00:38:48 +08:00`) predated the file edit. No manual rescan or retry was used to mask the result.

**STOP:** an enabled, UI-synchronized native root did not publish the real content/size change to the durable filesystem change clock, and the managed-scope-change Intent did not deliver a Run. This fails the required event path. No production fix or workaround was attempted. Return this reproduction to Owner.

## Disposable-root manifest and mutation boundary

Only `event-a.txt` changed, as the manually authored qualification input above. The other fixtures retained their initial size and SHA-256. No Execute Plan, Dry Run execution, Cleanup, Safe Trash, move, delete, or Zen Canvas file operation was invoked; **Zen Canvas automatic filesystem mutations observed: 0**.

| Fixture | Before size / SHA-256 | After size / SHA-256 |
| --- | --- | --- |
| `schedule-a.txt` | 35 / `1F14E6A0C5C282CC40E039F9420F813DBC89FBC0C202D02F50ED6BCA79D9F926` | 35 / `1F14E6A0C5C282CC40E039F9420F813DBC89FBC0C202D02F50ED6BCA79D9F926` |
| `event-a.txt` | 32 / `81506D97AE9B6F82222E226201812C5E4791824642EC58EB27F688A25037A747` | 40 / `D3656526DFA08250ACBA72BFE8CE447ED5038E16476BA9CE2A5335BDADC57F50` |
| `event-b.txt` | 32 / `9E99D8A9183AE25E222B127756C547CAB6E4A4017CC91564786021F718DD4385` | 32 / `9E99D8A9183AE25E222B127756C547CAB6E4A4017CC91564786021F718DD4385` |
| `metadata-a.txt` | 35 / `0B064B6492B03E630C5D2A3B76C7BDA9CBC8BD967510F949697F0566D29A8C5D` | 35 / `0B064B6492B03E630C5D2A3B76C7BDA9CBC8BD967510F949697F0566D29A8C5D` |

## Not run after the original STOP

The following remained unqualified in that original run: create/rename/remove coverage beyond the single content edit; five-second burst coalescing; metadata-only exclusion; review-pending suppression; pause/edit/re-enable debt reset; background/tray delivery; resource-admission deferral; Advanced Rules separation; keyboard/focus and narrow-layout checks; later general restart recovery; and real Windows suspend/resume. `powercfg /a` had shown S0 Low Power Idle (Network Connected) and Hibernate, with S1/S2/S3 unavailable; no suspend cycle was attempted after the event-path STOP.

## Owner-authorized root-authority remediation source — implementation commit 97a42ed

- Repaired implementation commit: `97a42ed2df9c9e460e349a5ebe62be10cddad507`; tree `8433ebfbef2eb5aceecb21dc5cce19cd0be0d958`.
- The repaired invariant uses persisted enabled `default_scan_folders` plus normalized, enabled durable File Library roots as the single watcher-owned-root authority for watcher routing and PM-02B event eligibility. Unwatched explicit/all-enabled scopes fail closed; Settings removal clears cursor/claim debt; re-enrollment baselines the current revision. Watcher ownership was not broadened; Schema remains 37.
- Local `desktop-runtime` scan/root tests passed **28/28** plus one intentional performance ignore. Windows watcher tests passed **25/25**, including case-normalized membership, an unwatched nested root and preserved genuine overlap. PM-02B trigger tests passed **20/21**; automation DB tests passed **13/15**. The three failing readiness assertions were reproduced on pristine e91 with the same feature set. Strict desktop-runtime Clippy and Rust format passed.
- Full local Rust validation reported **1,115 passed / 24 ignored / 4 failed**. The fourth failure was a PDF CMap timeout under parallel load and passed in isolation (**1/1**). At that point hosted exact-head CI was still pending; the later fixture repair and successful exact-head run are recorded above.
- No fresh native fixture has been enrolled after the remediation, and no post-repair event, schedule, restart, layout/focus, background/tray or suspend/resume row has been run. Requalification is authorized after the successful hosted CI and remains unstarted; it must use a fresh isolated profile/root, enroll the event root through native Settings, and verify the configured watcher plus durable revision movement before the file mutation.

The original native attempt did not update the PM-02B result or `STATUS.md`, nor change or push PR `#317`; the failure was later preserved in evidence checkpoint `ef0095ddc1b47d158de4aa9a73575dac034e5e14`. The Owner-authorized remediation is now committed on the existing branch. PR `#317` remains OPEN / Draft / unmerged, no auto-merge is enabled, PM-02B remains **OWNER REVIEW PENDING**, and PM-03 remains **NOT ACTIVE**. Suspend/resume remains explicitly unverified.

## c823 Owner background blocker and subsequent shared lifecycle remediation

The later original c823 Owner qualification and supplement are preserved in full at the paths recorded in the [resident-lifecycle evidence](windows-resident-lifecycle-remediation.md). Registration, append/settle/burst/create/rename/remove, natural Schedule, exact-binary restart deduplication, Run now, toggle/re-enable and edit-revision reset remain historical PASS. Automatic filesystem mutations observed remain zero. The original missed reset timing precondition is not a product failure.

The supplement stopped at **BACKGROUND DELIVERY — FAIL**: the supported native Main-background close choice destroyed Main and terminated the candidate process; the next append had no publication or automatic Run. Rows after STOP remain UNVERIFIED. A separate exact pre-fix native diagnostic reproduction then proved the stale registry-count teardown completion boundary, one ExitRequested(None), resident shutdown and normal Tauri Exit. This is a shared resident-lifecycle blocker predating PM-02B, not a watcher-routing failure; earlier ZB-04 native evidence did not exercise this scenario.

Remediation source `0c98d5c15c0e93c7513eb4f652afdfe781673acd` / tree `6dc8282a52452e39b531e0c589e81c18ed77b0ad` passed fresh exact-head hosted CI [37013892661](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37013892661), including both real Windows Tauri regression modes. Engineering proof covers zero-WebView residency, unchanged core owners, real background append/publication/automatic delivery, native show-main owner/fresh readiness, a second background cycle and explicit Quit from background/visible Main. Complete trace, local baseline-test disposition and preserved CI history are in the linked evidence.

**PM-02B BACKGROUND RESIDENT-LIFECYCLE REMEDIATION IMPLEMENTED — WINDOWS OWNER REQUALIFICATION REQUIRED — OWNER REVIEW PENDING**. Schema 37/package 0.1.40 and review-only filesystem safety remain unchanged. No old c823 binary acceptance is promoted. Fresh post-review Owner native UI qualification and the remaining UNVERIFIED rows are still required; PR #317 remains OPEN/Draft/unmerged and PM-03 remains NOT ACTIVE.

## Final Owner closeout — authoritative disposition, 2026-10-05

This section supersedes only the earlier “requalification required / not run” checkpoint statuses above. The original watcher failures, CI outcomes and native STOP history remain intact.

Final accepted production candidate: HEAD 823edc2b87c958f4bfdf7f6ba4211328140ccca2; tree 63918653f3791386cb86f7208b01deda96ea7f89; Schema 37; package 0.1.40. Exact qualification executable SHA-256: 1BF6AC7866AFD5657757B4996499E41EF382283DD7DFDF0F725F2C61400A2ED1. Full retained Owner report, including append-only corrections, is at F:/CargoTarget/pm02b-owner-final-823edc2b-20261002-01/qualification-report.md.
The disposable profile remains in its final qualification state (Schedule revision 2, Monday 02:04, Asia/Shanghai); Owner accepted it as evidence. No cosmetic restoration or retained-evidence cleanup was performed.

### Accepted native PASS rows

- Exact candidate/binary/profile/database identity; native Settings enrollment; durable root authority; real watcher registration.
- Extended-length Windows watcher delivery; one publication; five-second settling and burst coalescing; native create/rename/remove; watcher, applied and library revisions advanced through the retained event trace.
- Natural Schedule delivery while awake and while Main was absent; same-binary restart did not replay the already-delivered Schedule occurrence or consumed event revision. An awake Schedule occurrence is not resume evidence.
- Run now preserved the configured automatic trigger; toggle/re-enable and edit-revision debt reset passed.
- Main-to-zero-WebView residency; watcher and Automation delivery while Main was absent; real tray reopen; fresh Main generations/readiness with resident owners retained; repeated background lifecycle; visible-Main exit and genuine tray Quit with resident-owner shutdown.
- Same-Intent review-pending suppression: the later event cause returned automation_review_pending, reused the original live Event Plan, consumed the cause, and did not replay it. The Schedule Intent is distinct and its independent Plan was expected.
- Advanced Rules remained separate; profile state persisted across same-binary restart; no Plan execution, operation batch, Cleanup or trash action was observed.

### Owner-accepted evidence limitations

| Row | Disposition |
| --- | --- |
| Pending-event pre-settle restart recovery | **ACCEPTED UNVERIFIED — NATIVE EXIT TIMING LIMITATION.** Two attempts established pending state, but the cause settled before confirmed process exit. No recovery-failure inference and no native pending-at-exit PASS. |
| Windows suspend/resume | **ACCEPTED UNVERIFIED — HOST POWER-CONTROL LIMITATION.** S0 Modern Standby and hibernation are supported according to powercfg /a; the host never entered OS suspend. No resume notification or overdue-after-resume claim. |
| Native narrow / exact focus return | **ACCEPTED EVIDENCE LIMITATION.** Preserve the observed native control limitation; browser/mock rows are not native PASS. Not a merge blocker under Owner disposition. |
| Native metadata exclusion | **ACCEPTED DETERMINISTIC EVIDENCE.** Contract and deterministic tests cover tag/semantic metadata exclusion from the managed-file-change clock. No artificial native mutation or native PASS. |
| Native resource saturation | **ACCEPTED DETERMINISTIC RUNTIME EVIDENCE.** WorkScheduler / RuntimeResourceGovernor deterministic coverage is accepted; no native saturation test or native PASS. |

### Remediation classification

- Watcher: **HISTORICAL NATIVE FAIL → REMEDIATED → OWNER REQUALIFICATION PASS.** Windows extended-length path routing now uses the existing canonical path normalizer. CI 36990307913 remains a failure with an unknown first boundary; traced follow-up CI 36991861097 passed. Final Owner native event delivery passed on the accepted candidate.
- Resident lifecycle: **HISTORICAL NATIVE FAIL → REMEDIATED → OWNER REQUALIFICATION PASS.** The earlier asynchronous Main destruction cleared resident intent before native exit delivery. The repair retains resident intent while keeping genuine Quit authoritative; engineering CI 37013892661 and final-candidate CI 37016643626 passed, followed by Owner native requalification PASS.
- Zen Canvas automatic filesystem mutations observed: **0**. Operation and cleanup/trash ledgers remained zero; no automatic Plan execution occurred.

The two accepted UNVERIFIED rows above are evidence boundaries, not product failures. They do not reopen qualification under the Owner's final disposition. PR #317 is merged as `master@fc433f305aafbc2326a15a39eb93476ebd4da20d` / tree `f7ce37786816b1af31a43f70e351430067790f6d`; merge-after master CI 37265536740 is **SUCCESS**. PM-03 remains **NOT ACTIVE**.
