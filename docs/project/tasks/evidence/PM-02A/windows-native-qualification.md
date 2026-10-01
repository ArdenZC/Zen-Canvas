# PM-02A Windows native qualification

Status: **PASS — WINDOWS NATIVE + RESTART ACCEPTANCE COMPLETE — READY FOR OWNER FINAL REVIEW.**

The final qualification below is the current result. The earlier startup-only attempt is retained afterward as historical evidence and is superseded by the final stage.

## Final native + restart acceptance — 2026-10-01

### Source, build, and isolated environment

- Tested source SHA: `1c8b2a1a14540062871317ca4cf5e993652636c7`; source tree: `8ce5da2c284a1a1aae3fffd131fe26a97ad2e8f6`.
- Before build, `git status --short`, `git diff -- src-tauri/Cargo.toml`, and `git diff --stat` were empty. The tracked worktree was clean, and the Cargo manifest had no task marker or other difference.
- Windows: Microsoft Windows 11 Pro, version `10.0.26300`, build `26300`, x64.
- Build/run command: `npm run dev -- --features native-qa` (Tauri features `desktop-runtime,native-qa`). Binary: `F:\CargoTarget\pm-02a-windows-native-final-20261001-1c8b2a1a\cargo-target\debug\zen-canvas.exe`.
- Binary SHA-256 for the strict same-binary restart: `9F9CF9A5AE7DB95FCA254363D002AA66B8D1A37620BDA7EA539F145B79FE5499`.
- Isolated task root: `F:\CargoTarget\pm-02a-windows-native-final-20261001-1c8b2a1a`. Cargo target, temporary directories, `APPDATA`, `LOCALAPPDATA`, profile, test root, logs, and npm cache were isolated beneath it.
- Profile: `F:\CargoTarget\pm-02a-windows-native-final-20261001-1c8b2a1a\profile`; database: `F:\CargoTarget\pm-02a-windows-native-final-20261001-1c8b2a1a\profile\zen-canvas.sqlite3`; test root: `F:\CargoTarget\pm-02a-windows-native-final-20261001-1c8b2a1a\test-root`; startup log: `F:\CargoTarget\pm-02a-windows-native-final-20261001-1c8b2a1a\logs\tauri-dev.log`.
- The profile was new and empty before launch. No `DEEPSEEK_API_KEY` was present; no provider credential was added and no provider request was made.
- Startup reached `database_ready`, `setup_complete`, and `main_window_ready` on the initial launch and relaunches. The isolated database reported Schema 36.

### Real native control and fixed Automation boundary

- Native desktop visibility: **PASS**. Pointer interaction: **PASS**. Keyboard interaction: **PASS**. Real desktop screenshot capture: **PASS** (observed during the session; screenshots were not retained or committed).
- Control used the `@oai/sky` Computer Use native Windows desktop surface against the Tauri process at the binary path above, with visible real windows (including window IDs `655830`, `9570692`, and `328726`). This was not a browser, DOM, mock, or Playwright session.
- Before creating durable state, the real Automation surface was opened, the app navigated away, and Automation was reopened; the UI remained usable. A later native resize also confirmed responsive rendering.
- Automation is Intent-first. The visible fixed boundary was `仅手动触发 · 必须审核 · 不自动执行` (manual trigger, review required, no automatic execution). No schedule, watched-folder or startup trigger, Auto Apply toggle, or automatic file-execution option was available. Advanced Rules remained a separate reachable surface.
- Advanced Rules compatibility: **PASS**. The surface rendered with zero Rules, zero enabled, and zero paused. No qualification Rule was created or converted from the Intent.

### One Intent, one Run, and existing Organize handoff

- Exactly one qualification Intent was created in the native UI: `PM-02A Native Final Qualification`, workflow `organize_plan`, scoped only to the disposable test root, initially enabled. Initial revision: `1`; Intent ID: `automation-intent-dec3cb12-d9a8-4c6e-85bc-4d085f0abd96`.
- The stored scope query referenced only scan-root ID `scan-root-01a0f587-f1cf-7762-98d7-c926f2c97820`. Trigger remained `{"version":1,"kind":"manual"}`; policy remained `{"version":1,"review":"required","autoExecute":false}`.
- Native UI navigation away and back preserved the same Intent, title, test-root scope, enabled state, and fixed manual/review/no-auto policy before the Run.
- **Generate plan was invoked exactly once** through the native UI. It produced one durable Run receipt: Run ID `automation-run-4d561be8-8ebe-402d-b363-9811a60b132b`; request key `3e916bb3-f95a-4437-9608-03c5a5fff811`; status `blocked`; associated Plan ID `organization-plan-7fdc49d3-036d-440f-9b2d-84dd085f8904`; queued analysis `0`; `requires_plan_refresh=1`; sanitized blocker `managed_scope_missing`; error code `null`.
- Native result copy reported `需要处理`, explained that some files were not yet in Managed AI scope, and instructed the user to refresh the Plan in Organize after analysis. No successful AI analysis or proposal was fabricated.
- Read-only Schema 36 database inspection reported: `automation_intents=1`, `automation_runs=1`, `organization_plans=1`, `organization_plan_items=5`. The Intent was revision 1 and enabled at Run time. The Plan was `ready`, with requested/materialized counts `5/5`; all five items remained undecided, `needs_analysis`, confidence `0`, risk `Unknown`.
- No current Managed AI assessment existed for these fixtures, so current-assessment consumption without a provider was **NOT EXERCISED**. The provider was off; the retained blocked-fresh-analysis outcome was the valid qualification path.
- Native **Open plan** transitioned to the existing Organize surface and selected the exact Plan ID recorded by the Run. The existing review UI showed five files, zero included, zero decisions, and five unavailable pending analysis. No parallel Automation Plan viewer was created, and no Preview, execution, or Plan mutation was initiated.
- A separate non-test Organize scope label remained visible but was untouched; the selected PM-02A Plan and all qualification data were from the disposable test root.

### Zero-mutation, narrow layout, and keyboard/focus

- Four harmless disposable files were the only filesystem data used. The retained manifests `F:\CargoTarget\pm-02a-windows-native-final-20261001-1c8b2a1a\filesystem-before.json` and `F:\CargoTarget\pm-02a-windows-native-final-20261001-1c8b2a1a\filesystem-after.json` compare identical after Intent creation, Generate plan, Organize handoff, and the same-binary restart: file count `4`, names, sizes, and SHA-256 values unchanged. Filesystem mutations: **0**.

  | File | Size | SHA-256 |
  | --- | ---: | --- |
  | `meeting-notes.txt` | 63 bytes | `24D84E1EC06657380C4E4A658DD2E625D383B36A3898DA94BA0CF1E3C935380F` |
  | `project-brief.txt` | 90 bytes | `4AC43113B0A722AD0B79479DC99A3FF27AF6AFD077ABBC29288D9DB5724ECB5F` |
  | `reading-list.txt` | 38 bytes | `E2DBCF2ED53CA2395364E189DBF6F09C4D5C9F37889EC59F533A6DDA88D8AF88` |
  | `working-notes.txt` | 56 bytes | `0042EF76BDC836902FAB36DB25B17A3E0318C18D4CE2EF686A72859606F5000A` |

- At `969×800`, the native Intent list, editor, Run result, and Organize handoff were inspected. No page-level horizontal overflow was observed; title, scope, status, fixed policy, Generate plan reachability, result details, and handoff action remained readable/usable.
- Keyboard/focus smoke: in the editor, `Tab` moved focus from the name input to the scope query input with a visible focus indication; `Escape` canceled without saving and returned focus visibly to the Edit Intent control. Generate plan was not activated by keyboard because the one allowed Run had already been created.

### Restart and pause persistence

- The Intent was paused through the native UI. The UI changed to `已暂停`, Generate plan became disabled, and read-only inspection showed revision `2`, `enabled=0`. Navigation away and back preserved Paused.
- Counts immediately before closing: Intent `1`, Run `1`, Plan `1`, Plan items `5`. The app was closed normally through its confirmation and Direct Exit action.
- The first `npm run dev` relaunch rebuilt the dev binary. To bind the final restart check to the exact same executable, the app was then normally closed and the binary above launched directly with the same isolated profile and environment. The isolated Vite frontend server was running from this worktree; binary SHA-256 immediately before and after launch remained `9F9CF9A5AE7DB95FCA254363D002AA66B8D1A37620BDA7EA539F145B79FE5499`.
- After that exact-binary/profile restart, the real native app started normally. The same paused Intent, scope, latest Run receipt, status, and result remained visible; Open plan still selected the same Plan in Organize. No Run or Plan was added and no startup Automation executed.

  | Read-only database count | Before restart | After same-binary restart |
  | --- | ---: | ---: |
  | Automation Intents | 1 | 1 |
  | Automation Runs | 1 | 1 |
  | Organization Plans | 1 | 1 |
  | Organization Plan items | 5 | 5 |

- Pause persistence: **PASS**, revision progressed from `1` to `2`, and `enabled=0` persisted across navigation and restart.
- Duplicate request-key smoke: **NOT DIRECTLY EXERCISED IN NATIVE UI — COVERED BY BACKEND CONCURRENCY/IDEMPOTENCE TESTS**.
- Screenshots were captured and shown during native review, but were not retained or committed. No credentials or Owner file paths were included in the durable evidence.

## Historical stage 1: startup-only attempt (blocked; superseded below)

The following record preserves the initial attempt, when the available native-control endpoint had not yet been established. Its blocked findings are historical and are superseded by the final qualification above.

### Environment and isolation

- Source SHA: 8763c8735ab96cf0975d9c293aacef270f950f26; tree: ad8770f6758eeadfa92d228cddecf8bc48214ceb.
- Windows: Microsoft Windows 11 Pro, version 10.0.26300, build 26300, 64-bit.
- Run command: npm run dev -- --features native-qa; package script invoked Tauri with desktop-runtime,native-qa. The compiled binary was F:/CargoTarget/pm-02a-windows-native-20261001-01a0f3f8/cargo-target/debug/zen-canvas.exe.
- Build target, temp directories, frontend runtime dependencies, APPDATA and LOCALAPPDATA were isolated under F:/CargoTarget/pm-02a-windows-native-20261001-01a0f3f8.
- Dedicated profile override: ZC_NATIVE_QA_PROFILE_ROOT=F:/CargoTarget/pm-02a-windows-native-20261001-01a0f3f8/profile. This directory was empty before launch. Database: F:/CargoTarget/pm-02a-windows-native-20261001-01a0f3f8/profile/zen-canvas.sqlite3.
- Test root: F:/CargoTarget/pm-02a-windows-native-20261001-01a0f3f8/test-root, containing four disposable dummy text files only. No Owner working folders or production user data were used.
- AI/provider: **not configured** in the fresh profile. No provider-key environment variable was present; no credential was added and no provider request was made.

### Startup and schema evidence

- Tauri compile: **PASS**. The dev log reached database_ready, setup_complete and main_window_ready.
- Native main-window rendering: **NOT VERIFIED**. The available CUA inventory returned apps: [] before and after one session reset, with browser tabs only. Its listApps method was unavailable (cua.listApps is not a function); native computer APIs were not enabled for this session. No native accessibility tree or screenshot was available.
- Isolated database: read-only inspection reported PRAGMA user_version = 36; the automation_intents and automation_runs tables existed with row counts of 0 and 0.
- A database-ready log and read-only schema query establish startup/database facts only; they do not establish visible native UI acceptance.

### Qualification results

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Native app launch | **BLOCKED / NOT VISUALLY VERIFIED** | Tauri process reached main_window_ready, but no native window was exposed to CUA. |
| Schema 36 opens | **PASS — DATABASE ONLY** | Isolated database opened during Tauri setup; read-only PRAGMA user_version returned 36. |
| Intent creation | **NOT PERFORMED** | Native Automation UI could not be targeted. |
| Intent persistence | **NOT PERFORMED** | No Intent was created. |
| Manual Generate plan | **NOT PERFORMED** | No native action was issued. |
| Run receipt / analysis state | **NOT APPLICABLE — ZERO RUNS** | Intent count 0; Run count 0; no request key or Run ID exists. |
| Organization Plan / handoff | **NOT APPLICABLE — ZERO PLANS** | No plan was materialized; read-only counts were 0 organization_plans and 0 organization_plan_items; no Plan ID exists. |
| Current-assessment or blocked-analysis semantics | **NOT EXERCISED** | No Run was invoked. |
| Pause/resume persistence | **NOT PERFORMED** | Native UI was unavailable. |
| Duplicate request-key smoke | **NOT DIRECTLY EXERCISED IN NATIVE UI** | No deterministic native retry could be initiated. |
| Advanced Rules compatibility | **NOT ASSESSED** | No native surface was visible. |
| Narrow-window layout | **NOT ASSESSED** | No native surface was visible. |
| Keyboard/focus | **NOT ASSESSED** | No native surface was visible. |
| Restart acceptance | **NOT PERFORMED** | The UI flow was blocked before Intent creation; no restart claim is made. |
| Filesystem mutations | **0 observed** | No Generate-plan action occurred. The isolated root still contained the same four files with identical SHA-256 values before and after the app process. |

### Filesystem comparison

The before/after JSON manifests are retained under the task-owned F: directory. The four files and hashes were identical:

| File | SHA-256 |
| --- | --- |
| meeting-notes.txt | 3FB0C14C4A382A2BDECDD42A0E3E3C40A05504D3B1BB9DC97E074205188FA0C3 |
| project-brief.txt | 04EE1054C36A9A446B14CB1F1F4EA0EF962B51A32ECB0AB7E80CB421033ECB96 |
| reading-list.txt | 995EE000E9EECAB0171D453BEF741D7A4B9F99E1740D4C8187CBD4FBAA556F45 |
| working-notes.txt | 8C03391C5458A917AEC3B20F06F102F59FEA95DE6D3DE83B2771DFA42A0B16AE |

Manifest paths: F:/CargoTarget/pm-02a-windows-native-20261001-01a0f3f8/filesystem-before.json and F:/CargoTarget/pm-02a-windows-native-20261001-01a0f3f8/filesystem-after.json.

### Historical disposition at stage 1

At this initial stage only, the native checklist remained outstanding because no targetable native window was available. The later final stage above completed the checklist. PM-02A remains **OWNER REVIEW PENDING**; PM-02B and PM-03 remain **NOT ACTIVE**.
