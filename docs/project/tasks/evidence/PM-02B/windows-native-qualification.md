# PM-02B Windows native qualification

Status: **ORIGINAL QUALIFICATION FAILED at e91f27e; root-authority remediation and test-fixture repair are committed; exact-head CI is SUCCESS on `a3dd9082018185891b536b9d1fb693b5ae27a3cf`; fresh Windows native requalification is AUTHORIZED / NOT STARTED.** The original failure record below remains intact and is not superseded. No repaired native PASS is claimed.

## Current CI result and native requalification gate

The original managed-scope-change event failure at `e91f27ed278bc80a0cc92fe79e8b83748fa8f812` remains the historical native result. The root-authority remediation was implemented at `97a42ed2df9c9e460e349a5ebe62be10cddad507`. The first remediation candidate, `b304ea91fb7c1380870629156121c032ea14bc7d` / tree `279f951113cddf3923e0d19ca4e3730d9601bb81`, failed hosted CI [36906218806](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36906218806) only at the Windows watcher-membership test's fixture teardown (OS error 32); its functional assertions had completed.

The test-only ownership repair is `a3dd9082018185891b536b9d1fb693b5ae27a3cf` / tree `1b0fd77ce8d68a041e8d003a7ee711492968def5`. The test now stores its SQLite database outside the disposable filesystem fixture using the existing module helper. No production code changed. The formerly failing Windows exact test passed three consecutive times. Fresh exact-head hosted CI [36961723813](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36961723813) completed **SUCCESS** on that exact SHA, including Windows Rust quality and aggregate Windows Quality. This CI result does not constitute native product acceptance.

No repaired-head Windows native requalification has been performed. It is now authorized as the next gate but was explicitly not started in this closeout. PR #317 remains **OPEN / Draft / unmerged**; PM-02B remains **OWNER REVIEW PENDING**; Schema remains **37**; PM-03 remains **NOT ACTIVE**. The original e91 failure section below is retained verbatim as historical evidence.

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
