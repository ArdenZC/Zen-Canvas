# PM-03 Windows Native Owner Qualification — Progress Record

**Current disposition (2026-10-06): HISTORICAL NATIVE FAIL → REMEDIATED → OWNER REQUALIFICATION REQUIRED.** The 2026-10-05 checkpoint immediately below is retained as historical evidence; its no-failure/privacy-prompt status is superseded by the Owner-confirmed standalone handoff FAIL recorded at the end. New source/CI/package evidence cannot confer native Owner PASS.

Date: 2026-10-05 (Asia/Shanghai)
Status: **PAUSED — OWNER QUALIFICATION INCOMPLETE.** No product failure has been observed. Native Spotlight entry is blocked by a Windows input-method privacy prompt that requires the user to choose.

This is an append-only record of the work performed so far. It does not establish PM-03 Owner acceptance or readiness for final closeout.

## Candidate identity

| Field | Evidence |
| --- | --- |
| PR | #322, OPEN / Draft; base `master`; live head `10f638cf8f100f5aad182c670ee451749d898055` |
| Required source tree | `e120f83d252c93b205272208a62b2492c3b401a5` |
| Exact-head CI | Run `37304166487`, completed SUCCESS on `10f638cf8f100f5aad182c670ee451749d898055` |
| Candidate worktree | `E:\CargoTarget\pm03-product-hierarchy-migration-closeout-c72bbce` |
| Candidate branch / HEAD / tree | `product/pm-03-product-hierarchy-migration-closeout` / `10f638cf8f100f5aad182c670ee451749d898055` / `e120f83d252c93b205272208a62b2492c3b401a5` |
| Worktree state | Only the three pre-existing untracked directories `cargo-target/`, `npm-cache/`, `tmp/`; preserved |
| Installer | `E:\CargoTarget\pm03-product-hierarchy-migration-closeout-c72bbce\src-tauri\target\pm03-owner-remediation-build\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe` |
| Installer size / SHA-256 | `9,820,637` bytes / `332DF1543C4286B72DAF61D596ACBD74749095B3E590505E65E47DBF35FFBD71` — independently checked again immediately before launch; matches the required artifact |
| Installed app version / destination | `0.1.40`; installer showed default destination `C:\Program Files\Zen Canvas` |
| Executable SHA-256 | Not separately captured |

The normal checkout `F:\Coding\Zen-Canvas` is on `master` and is not the candidate worktree. Qualification and this record are bound to the exact PM-03 candidate worktree above; no branch switch or source edit was made.

## Isolation and baseline

- Environment: fresh Windows Sandbox guest; `.wsb` configuration disabled networking, mapped the installer source read-only, and mapped the task-owned share writable.
- Guest OS: Windows 11 Enterprise, version 24H2, OS build `26100.9550` (read from Settings → System → About). The host Windows build is 26300.
- User/profile: `C:\Users\WDAGUtilityAccount`.
- Database: `C:\Users\WDAGUtilityAccount\AppData\Roaming\com.startlan.zencanvas\zen-canvas.sqlite3`.
- Task Manager showed `zen-canvas.exe` PID `7192` under `WDAGUtilityAccount` while Main was open, and another `zen-canvas.exe` PID `8056` under `SYSTEM`. The active user-session Main PID is recorded as `7192`; the second process role was not independently established.
- The installer destination implies executable path `C:\Program Files\Zen Canvas\zen-canvas.exe`; the process image path was not separately opened.
- Fixture root: `E:\CargoTarget\pm03-native-owner-qualification-10f638cf\share\fixture-root`.
- Fixture manifest: `E:\CargoTarget\pm03-native-owner-qualification-10f638cf\share\fixture-manifest.json`.
- Fixture file: `pm03-sentinel.txt`, 48 bytes, SHA-256 `BD56661516663E43D199822225725F5AC4AF39BD8BDFAD50FC75B169C2B65ED4`. The hash was rechecked after the Spotlight attempt and remained unchanged.
- Before native route actions, the live profile database and its `-wal` / `-shm` sidecars were copied to the task share (84.1 MB total). A read-only SQLite 3.49.1 query returned `PRAGMA user_version = 37` and these baseline counts:

| Authority | Baseline |
| --- | ---: |
| `automation_intents` | 0 |
| `rules` | 0 |
| Rule catalog revision | 1 |
| `operation_batches` / `operation_logs` | 0 / 0 |
| `cleanup_trash_batches` / `cleanup_trash_items` | 0 / 0 |
| `organization_plans` | 0 |
| Zen Canvas automatic fixture filesystem mutations | 0 at baseline; final comparison pending |

No scan folder was selected during the first-run screen. The optional AI setup was dismissed with Escape; no AI permission choice or folder selection was made. No fixture file was opened or changed by Zen Canvas.

## Row results

| Row | Status | Evidence / boundary |
| --- | --- | --- |
| 0. Exact candidate identity | PASS | Live PR, exact worktree HEAD/tree, exact-head CI SHA, installer size and SHA-256 all match the brief. |
| 1. Isolation | PASS | Fresh network-disabled Sandbox profile, database, fixture root, guest build, user-session PID, and installer identity recorded above. Executable SHA-256 remains unavailable. |
| 2. Safety baseline | PASS | Schema 37; initial Intent, Rule, Operation, Trash, and Plan counts recorded; fixture manifest and sentinel hash recorded. Final mutation comparison remains pending. |
| 3. Normal startup | PASS | Exact installer completed; Zen Canvas Main rendered the Overview and became usable. No startup error was visible. The isolated database opened at schema 37. No native console/log stream was exposed by this GUI launch, so log absence is not claimed. |
| 4. Native Spotlight → Automation | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | `Ctrl+K` opened the native Spotlight/search window. Clicking its query field displayed a Windows input-method privacy prompt asking whether to enable Bing suggestions and send input suggestions to Microsoft. No query was submitted and no Automation route was invoked. The prompt remains untouched pending the user’s choice. |
| 5. Settings → Automation | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Not reached while the system privacy prompt owns the desktop interaction boundary. |
| 6. Existing Intents readability | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Baseline Intent count is 0, so no existing Intent content is available to qualify; the Intents surface was not reached. |
| 7. Explicit Advanced Policies | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Rules baseline is 0; surface not reached. No Rule was created or deleted. |
| 8. Return to Intents | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Not reached. |
| 9. Native background transport | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Main was not moved to background from Automation. |
| 10. Tray reopen | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | No background/tray transition was attempted. |
| 11. Repeat Spotlight after tray reopen | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Not reached. |
| 12. Legacy `view=rules` compatibility | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Optional row remains unadjudicated; no native method or deterministic test evidence was exercised in this run. |
| 13. Genuine quit and restart | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Not attempted. |
| 14. Final mutation safety | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Initial counts are recorded and the sentinel hash is unchanged so far; final DB and fixture comparison is pending. |
| 15. PM-02B matrix | PASS | No PM-02B event/schedule/suspend-resume matrix was run. |
| 16. Evidence record | PASS | This record is under the existing PM-03 evidence directory. No production source, PR, or issue was changed. |
| 17. Final stop state | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Neither Owner qualification PASS/READY nor a product FAIL has been established. Continue only after the user handles the Windows privacy prompt. |

## Current stop boundary

The Windows prompt is a system privacy permission request. The `computer-use` skill prohibits the agent from acting on it. The user was asked to handle it in the Sandbox, preferably selecting **“现在不启用”** (“Not now”), and then reply **“继续”**. Until that response, do not interact with the prompt, retry the Spotlight query, or treat this row as a product failure.

No PR merge, Ready-for-review transition, issue closure, PM-02B requalification, production-source modification, commit, or push was performed.

## Continuation — 2026-10-05

The Owner reported that the Windows input-method prompt's **“现在不启用”** control was not visible. On restoring the Sandbox window, the prompt was no longer present; no choice was made and no text was entered. The previous stop note that the prompt remained visible is superseded by this observation. I continued only through product UI paths that did not require the prompt.

### Additional native observations

| Row | Status | Evidence / boundary |
| --- | --- | --- |
| 4. Native Spotlight → Automation | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | The native Spotlight window had opened earlier, but focusing its query field raised the Windows IME privacy prompt. The prompt is now absent; no query was submitted, no Automation route was invoked, and no prompt choice was made. This is not a product failure. |
| 5. Settings → Automation | PASS | From Settings → **智能整理** → **自动化**, the app opened canonical Automation. The default **自动化意图** surface and empty state were visible; **高级策略** was not selected automatically. No Intent, Rule, Plan, or filesystem change was observed. |
| 6. Existing Intents readability | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | The Intents list loaded its empty state. Baseline count is 0, so there is no existing Intent record to read; creating one solely for this row is outside the approved procedure. |
| 7. Explicit Advanced Policies | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | **高级策略** opened only after an explicit click. Rule Repository V2 loaded and displayed total/enabled/paused counts `0/0/0` and its empty state. There are no existing Rule records whose content can be inspected; no Rule or Intent was created or mutated. |
| 8. Return to Intents | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Returning to **自动化意图** succeeded and the empty state was visible. The computer-use accessibility state exposed focus on the outer Windows Sandbox window only, so exact app keyboard focus/usability could not be established. |
| 9. Critical native background transport | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | From Automation → Intents, the normal app close control opened the choice dialog. **最小化到后台** was selected; the Main window disappeared to the Sandbox desktop. Task Manager Details then showed the same user-session `zen-canvas.exe` PID `7192` under `WDAGUtilityAccount` and system PID `8056` still running. This proves resident process survival and no visible shutdown/error, but no native trace was exposed to confirm the exact `lastView` argument or internal owner health. |
| 10. Tray reopen after Automation backgrounding | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | The captured Sandbox desktop exposes no notification-area/hidden-icons control or Zen Canvas tray icon through the available control surface. Per the task brief, no desktop shortcut or alternate launch method was used. Stop here for one manual reopen from the real Windows tray. |

No configuration was changed in the close dialog; **“以后不再提醒”** remained unchecked. Task Manager was closed after the PID observation. Rows 11–14 remain pending the real tray reopen and normal product lifecycle continuation. No fixture or app database final comparison has been claimed yet.

## Continuation — 2026-10-05 (tray reopen, restart, and final comparison)

This addendum supersedes the earlier continuation's pending notes for rows 10 and 13–14. The qualification remains INCOMPLETE; no product FAIL is established. The Windows IME privacy prompt has no recorded Owner choice and was not acted on.

### Updated row results

| Row | Status | Evidence / boundary |
| --- | --- | --- |
| 4. Native Spotlight → Automation | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | After the manual tray reopen, Ctrl+K opened native Spotlight. No query was entered or submitted because the earlier query-field interaction had raised the Windows IME privacy prompt and no Owner choice was recorded. No product failure or mutation was observed. |
| 6. Existing Intents readability | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | The isolated database has zero Intent rows; no existing record is available to inspect, and none was created for qualification. |
| 7. Existing Rule readability | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | The isolated database has zero Rule rows. Advanced Policies was reached only after an explicit click and showed Rule totals enabled/paused = 0/0/0; no Rule was created. |
| 8. Return to Intents / keyboard usability | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Returning to Intents rendered the empty state. The CUA accessibility tree exposes focus only on the outer Windows Sandbox wrapper, so exact app keyboard focus was not independently established. |
| 9. Critical native background transport | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | From Automation → Intents, the normal close dialog's Minimize to tray action hid Main. Task Manager showed the same user-session zen-canvas.exe PID 7192 under WDAGUtilityAccount plus PID 8056 under SYSTEM. No visible shutdown or route error occurred, and the user later reopened from the real tray. The release GUI exposed no native trace proving enter_background(lastView="automation"), WebView destruction, resident-owner identity/activity, or absence of internal route errors. |
| 10. Tray reopen after backgrounding | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | The Owner reopened from the real system tray. The same PID 7192 remained, Main returned to Automation → Intents, and Advanced Policies was not restored as the default. No generation or owner-identity trace was exposed, so duplicate internal owner initialization could not be ruled out. |
| 11. Repeat native Spotlight after tray reopen | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Ctrl+K opened Spotlight after tray reopen, but the Automation query/activation was not exercised; no text was submitted. |
| 12. Legacy view=rules compatibility | ACCEPTED DETERMINISTIC EVIDENCE | No safe native invocation was used. Existing exact-head evidence covers frontend normalization in tests/viewRoutes.test.ts and Rust serde aliasing in src-tauri/src/app_control.rs (SearchView alias at line 79; test search_view_uses_automation_canonically_and_accepts_legacy_rules around line 2221). Exact-head CI run 37304166487 is recorded above. This is deterministic compatibility evidence, not native PASS. No tests were run during this continuation. |
| 13. Genuine quit and restart | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | Direct normal quit removed the user-session PID 7192; the complete name-descending Task Manager list showed only zen-canvas.exe PID 8056 under SYSTEM, whose role remains unestablished. The exact installed candidate was restarted from its installer-created shortcut under the same WDAGUtilityAccount profile. Startup rendered Overview after the unchanged first-run overlay was dismissed with Escape. Settings → 智能整理 → 自动化 opened canonical Intents by default; Advanced Policies appeared only after explicit selection, showed 0/0/0, and returning to Intents restored the empty default. No obsolete Rules-first state appeared. Existing Intent/Rule readability cannot be tested because both tables are empty. |
| 14. Mutation safety | PASS | Read-only SQLite 3.49.1 comparison of the initial snapshot and final post-quit snapshot retained schema version 37. Required counts stayed unchanged: automation_intents 0→0; rules 0→0; organization_plans and organization_plan_items 0→0; operation_batches and operation_logs 0→0; cleanup_trash_batches and cleanup_trash_items 0→0; automation_runs 0→0. The fixture manifest contains one 48-byte sentinel; final tree still contains only that file with SHA-256 BD56661516663E43D199822225725F5AC4AF39BD8BDFAD50FC75B169C2B65ED4, so automatic fixture filesystem mutations = 0. Separately, Global Index rows increased from 44,989 to 257,866 (global_entries and matching FTS rows); the other changed row counts were the corresponding Global Index FTS data/docsize/index tables. Cause was not isolated. This index growth is recorded separately and is not counted as a fixture filesystem mutation or an Operation/Plan/Cleanup/Trash record. Main DB size grew from 82,087,936 to 463,851,520 bytes; final main/WAL/SHM snapshot is preserved under the task share's 新建文件夹 directory. |
| 15. PM-02B matrix | PASS | No PM-02B event/schedule/suspend-resume qualification was run. |
| 16. Evidence record | PASS | This append-only continuation is the only candidate-worktree change. No production source, PR, issue, commit, or push was changed. Pre-existing cargo-target/, npm-cache/, and tmp/ remain preserved. |
| 17. Final stop state | UNVERIFIED — TOOL/HOST CONTROL LIMITATION | PM-03 Windows Native Owner Qualification is not PASS/READY. Required Spotlight activation and direct resident-owner/internal-route evidence remain unverified. No product FAIL has been established. |

### Final snapshot detail

The final read-only snapshot was copied after normal quit so the main DB and its WAL/SHM sidecars could be compared without changing the Owner profile. Initial and final DB snapshots and the unchanged fixture remain in the task-owned Sandbox share. The final comparison found no change to the required Intent, Rule, Plan, Operation, Cleanup, or Trash counts; the Global Index growth above remains a separate unexplained database delta.

No PR merge, Ready-for-review transition, issue closure, PM-02B requalification, production-source modification, commit, or push was performed.

## Same-candidate Global Index restart recovery diagnostic — 2026-10-06

**GLOBAL INDEX STARTUP RECOVERY FAILURE — OWNER REVIEW REQUIRED**

This is a separate Global Index disposition gate, not an established PM-03 regression. Native Spotlight/Automation qualification remains stopped. The recovery PASS disposition and READY FOR FINAL OWNER CLOSEOUT are not claimed.

### Candidate and execution

- HEAD/tree reverified: `10f638cf8f100f5aad182c670ee451749d898055` / `e120f83d252c93b205272208a62b2492c3b401a5`.
- Installer SHA-256 reverified: `332DF1543C4286B72DAF61D596ACBD74749095B3E590505E65E47DBF35FFBD71`; existing 0.1.40 installation/profile retained.
- The same running Sandbox guest/profile/database was used. Before launch, Task Manager's name-descending Details list showed only the previously recorded SYSTEM `zen-canvas.exe` PID 8056; the user-session candidate had exited.
- Before launch, Explorer copied the exact guest profile's DB/WAL/SHM to a fresh task-share snapshot. No original database files were edited.
- Normal launch: double-clicked the existing `C:\Program Files\Zen Canvas\zen-canvas.exe` at **2026-10-06 02:54:44 +08:00**. The normal Main/Overview and existing first-run overlay appeared. No Settings, index command, onboarding choice or privacy prompt was used. New user-session PID **1560** was visible in Task Manager; SYSTEM PID 8056 remained alive.
- Stopped, startup and later-observation copies were queried using Python SQLite `mode=ro` and `PRAGMA query_only=ON`. `PRAGMA quick_check` returned `ok` for all three preserved copies. Live copies were ordinary sequential Explorer copies, not an atomic SQLite backup; internal transition traces were unavailable. The repeated consistent committed state and valid copies support the observed disposition, but unobserved intermediate transitions are not claimed.

### Read-only snapshots

Snapshot directories below are under `E:\CargoTarget\pm03-native-owner-qualification-10f638cf\share`; each contains the copied DB/WAL/SHM and `read-only-results.json` with the full requested SQL results.

| Field | Stopped state | Shortly after startup | Later observation |
| --- | --- | --- | --- |
| Directory | recovery-20261006-stopped | recovery-20261006-startup | recovery-20261006-observe |
| Read/query time (+08:00) | 02:54:13 | 02:56:15 | 02:57:27 |
| Schema | 37 | 37 | 37 |
| index_status | error | permission_required | permission_required |
| last_error | provider error: indexing paused | provider error: provider error: USN Journal cursor is no longer readable | provider error: provider error: USN Journal cursor is no longer readable |
| journal_id | 134352498615956060 | 134352498615956060 | 134352498615956060 |
| journal_cursor | 128255904 | 128255904 | 128255904 |
| last_full_index_at | 1791205933 | 1791205933 | 1791205933 |
| last_incremental_sync_at | 1791214387 | 1791214387 | 1791214387 |
| entry_count / active_rows | 18,183 / 18,183 | 18,183 / 18,183 | 18,183 / 18,183 |
| total_rows / COUNT(global_entries) | 257,866 | 257,866 | 257,866 |
| stale_rows | 239,683 | 239,683 | 239,683 |
| Main DB bytes | 463,851,520 | 463,851,520 | 463,851,520 |

All snapshots contain exactly one volume, ID `gv_ecfd1aa5e359ad55ca294ca48173d2d13b2dea68ecb3790a6271433e7ec773e7`, `mount_path=C:\`, fixed NTFS, enabled=1, provider=`windows_mft_usn`. All entries belong to this volume. No unexpected source was enabled. Full captured fields are in the JSON results.

### Recovery disposition and source evidence

Startup automatically left the stale shutdown error and attempted USN recovery, but the observed outcome was persistent `permission_required` with an unreadable saved cursor. No valid admitted MFT rebuild/progress or `ready` outcome was established. This is not a timeout requiring a full C:\ index to finish: it is a degraded recovery classification with unchanged checkpoint/counts across subsequent observations.

Read-only inspection of the exact candidate shows:

- `windows/usn.rs` sets `rebuild_required` when the saved cursor lies outside available USN history, then returns `USN Journal cursor is no longer readable`.
- `windows/mod.rs` preserves errors containing `rebuild required`, but maps other USN errors to `permission_required`. The unreadable-cursor message takes that latter branch, which can overwrite the rebuild state.
- `coordinator.rs` admits a rebuild only when the volume state is `rebuild_required`; its immediate RecoveryRequired wake also depends on that state. This is consistent with the captured degraded outcome. No native trace proves every internal event.
- `service_response_error()` reconstructs service errors as `GlobalIndexError::Provider`, matching the Owner-identified shutdown status-mapping defect. That issue was not fixed. The conditional NON-BLOCKING disposition is not available because automatic recovery did not satisfy this diagnostic.
- These three inspected production files have no diff from the authorized PM-03 base `c72bbce173d53660a68d797b3e0ac2a32cfeb7c5` to this candidate. The observed recovery problem requires separate Global Index Owner review; no PM-03 regression attribution or repair is claimed.

### Safety and stop state

Intent/Rule/Plan/Operation/Cleanup/Trash counts remained 0 in all three snapshots: `automation_intents`, `rules`, `organization_plans`, `operation_batches`, `operation_logs`, `cleanup_trash_batches`, `cleanup_trash_items`.

Fixture still contains exactly one 48-byte `pm03-sentinel.txt`, SHA-256 `BD56661516663E43D199822225725F5AC4AF39BD8BDFAD50FC75B169C2B65ED4`, matching the original manifest. **Qualification fixture automatic mutations = 0.** Internal DB row/file-size growth during these snapshots was zero; legitimate SQLite state/WAL writes still occurred and are not user-file mutations.

Candidate remains running after the diagnostic. No retry, manual Rebuild/Resume/Pause, enabled-state change, Rules/Intents/Plan/Cleanup execution, reinstall/rebuild, source/test edit, PR merge, issue closure, commit or push occurred. Only this explicitly requested append to the existing native evidence record and external diagnostic artifacts were written; earlier evidence and unrelated worktree state were preserved. Owner must decide the separate Global Index remediation/merge-blocking disposition before native route qualification resumes.

## Owner disposition and superseded handoff candidate (2026-10-06)

Owner-confirmed outcome for `10f638cf8f100f5aad182c670ee451749d898055` / tree `e120f83d252c93b205272208a62b2492c3b401a5`: **FAIL — Spotlight Automation command closed Search but did not navigate Main.** Main remained Overview instead of Automation → Intents. This genuine native failure is retained independently of the Global Index #323 observations above.

Installer SHA-256 `332DF1543C4286B72DAF61D596ACBD74749095B3E590505E65E47DBF35FFBD71` is superseded; do not retry qualification or use it for Owner PASS. The separately authorized repair proceeds on the same branch and Draft PR #322. No repaired binary has Owner native PASS: **HISTORICAL NATIVE FAIL → REMEDIATED → OWNER REQUALIFICATION REQUIRED**. Deterministic tests, hosted CI, browser evidence and a new installer are separate engineering evidence. Fresh Owner native evidence is still required. No #273/#323 closure or merge is authorized.
