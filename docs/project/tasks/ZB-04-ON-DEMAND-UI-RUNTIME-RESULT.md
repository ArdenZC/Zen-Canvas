# ZB-04 — On-demand UI Runtime — Result

Disposition: **READY FOR OWNER RE-REVIEW — LOCAL TASK HYGIENE PENDING**

## Identity

- Baseline: `master@20def056aa5e6a3c5ae089d11033ddc2030bf041`
- Taskbook commit: `c3839c83063dd26f192ab31a5e3e8a108f85ba5d`
- Branch: `perf/zb-04-on-demand-ui-runtime`
- Production HEAD: `a6d0e5aacbf0c20a354448746b9a198d82106282` — resident `ExitRequested` repair and lifecycle diagnostics; tree `e079074721b1544b4998783966661efb209f411e`.
- Validation/configuration HEAD: `d39cbdf655b2f8262c4365cf89567b330e8d1fce` (test/config-only successor; production sources are unchanged)
- Repair source parent: `a119f2caf97236e5f64c25259c356baa54ffec86`.
- Final branch HEAD: this Result is a documentation-only status successor to Hosted CI-validated source HEAD `1be6ed66c7cc5a64667f36f0a0fc8f503b4d384b`; no production source changed after Production HEAD `a6d0e5aacbf0c20a354448746b9a198d82106282`. The exact pushed Result commit is the Draft PR source head and is reported in the final closeout.

## Main lifecycle

The static Main window was removed from `tauri.conf.json`. `ensure_main_window` now creates at most one Main under the lifecycle lock, restores the last top-level view from a small process-local session, starts a fresh generation, and resets readiness before showing/focusing it. The native title, size/minimum size, transparency and undecorated contract are retained. Native close requests are prevented and forwarded to the existing frontend close-choice flow; an actual minimize remains a normal minimize.

Choosing background now stores the top-level view, marks that generation not ready, disposes its FileWorkspace runtime, then destroys Main. A teardown/destroy error is returned and leaves the owner/readiness retryable; it is not reported as a successful background transition. Quit still exits the process. Reopen creates a new Main generation.

## Search lifecycle and mini runtime

Search is no longer created during setup. Hotkey/show creates one Search window on demand with the existing label, native sizing, transparency, always-on-top/taskbar behavior and restricted Search capability. Dismissal destroys the window; the next show creates a fresh session. Creation/destroy failures remain retryable through the existing Search lifecycle state/CAS.

`src/main.tsx` selects the Search path by dynamically importing `SearchApp`; the Main path dynamically imports `App`. Search uses the narrow `searchRuntimeApi` module and its own `search.css`. Its startup does not import `AppRuntimeProviders`, `DatabaseBootstrapper`, File Library/runtime stores, rules hydration, watcher/scan bridges, operation queue or unrelated AI workflows. Structural tests guard the separation. No bundle-size reduction claim is made.

Search-to-Main activation retains the generation/nonce/ack handshake. Main is ensured before the request is sent, frontend readiness is acknowledged for that generation, navigation is emitted only after the acknowledgement, and Search is destroyed only after a successful handoff. A failed Main create/readiness path leaves Search available for recovery.

## Background startup and single instance

- Manual launch without `--background` ensures Main; Search remains absent.
- Autostart registers the explicit `--background` argument. That mode reaches resident setup without creating Main or Search.
- The existing `--index-service` entry remains separate.
- The official Tauri single-instance plugin is registered first. A second manual launch activates/creates Main in the resident process; an exact background second launch is ignored; other untrusted arguments are ignored and are not passed to the renderer.

## FileWorkspace lazy owner and teardown

`FileWorkspaceRuntimeOwner` retains only factory inputs (Database clone, existing MacThumbnailService clone and cache/root paths) plus generation state. It starts Dormant, activates with each Main generation without constructing a runtime, and constructs exactly one runtime on the first eligible FileWorkspace command. Cancellation/dispose-only paths query the current initialized runtime and do not create one. Active/Closing/Dormant transitions reject stale generations; a runtime held by an in-flight command is still governed by the existing `FileWorkspaceRuntime::dispose()` behavior and cannot be reused by a later generation.

Main teardown revokes change monitors and preview publications, releases the native preview host/access and host-provided records, cancels thumbnail tasks, disposes browse sessions, then disposes thumbnail/read-gate/preview-asset owners. The existing PreviewSession, ReadGate, BrowseService and native-preview authorities are unchanged. Legacy `MacThumbnailService` remains shared for legacy file-operation thumbnails and is not duplicated or forced into the lazy owner.

Resident state still contains the native process/core, tray and hotkey, Database, Global Index/search and watcher/scheduler/governor owners, durable job managers, lifecycle/session/readiness state, and the lightweight FileWorkspace owner/factory. These are required process-level authorities; the FileWorkspace runtime and both WebViews are absent in background idle. Explicitly started durable jobs continue under their existing semantics; pending user review is not auto-confirmed.

## WebView/process and latency evidence

The native candidate was built from source tree `e079074721b1544b4998783966661efb209f411e`, now committed as Production HEAD `a6d0e5a`. Candidate identity:

- Executable: `D:\_codex_tmp\zb04-native-repair\target\debug\zen-canvas.exe`
- SHA-256: `B1D7EA39D402280EEF21FA3A8809651DD0FB701E6B2BDDDC3F76BE2456458845`
- Isolated identifier: `com.startlan.zencanvas.zb04native`
- Isolated profile paths: `C:\Users\77588\AppData\Roaming\com.startlan.zencanvas.zb04native` and `C:\Users\77588\AppData\Local\com.startlan.zencanvas.zb04native`; these are distinct from the installed product identifier `com.startlan.zencanvas`.

Native evidence recorded for this task-local debug candidate (diagnostic measurements, with no frozen performance threshold):

| Scenario | Native observation |
| --- | --- |
| Background resident startup | `startup_mode=background`, Main 0, Search 0, WebView windows 0. |
| Search lifecycle | Resident → Search cold create/ready → Escape → Search destroy; the resident PID remained alive and WebView-window count returned to 0. First Search cold create was about 503 ms; a second create was about 461 ms. |
| Last Search window destruction | `ExitRequested code=None` was prevented; the resident remained alive. |
| Manual second instance | First resident logged raw args `args=["D:\\_codex_tmp\\zb04-native-repair\\target\\debug\\zen-canvas.exe"]`, selected `ActivateMain`, created Main generation 1 with one WebView, and reached ready. Main create-to-ready was 634.2647 ms. The second PID had exited at 1 s, 5 s and 15 s. |

The candidate log additionally records startup mode/window counts, single-instance received args/action/result, Main generation/WebView count, Search activation stages and readiness request/ack stages. Diagnostics do not log user file paths, API keys, file contents or sensitive navigation payloads. The native resident and single-instance evidence came from the isolated candidate; the only remaining `zen-canvas.exe --index-service` process observed was the installed Global Index service and it was not modified.

The allowed native UI tool did not enumerate the candidate Main window. Therefore these scenarios remain **NOT DIRECTLY NATIVE-AUTOMATED ON THIS HOST**, not PASS or FAIL:

- Search → Main activation performed through Search UI by click or keyboard;
- Main close-to-background and tray reopen;
- explicit Quit click;
- background second launch after a Main-close cycle;
- Main reopen latency.

Owner accepts the current evidence boundary: the automated lifecycle contracts below combined with the directly observed native resident/Search/single-instance/Main-ready evidence. The unavailable UI automation is a **NATIVE QA TOOL LIMITATION**, not a proven product lifecycle defect. No alternate UI-control route or click-specific product code was added.

Routed extended performance evidence was run once at production HEAD `1ad81469d18c24aebb4ddb35a2e4b32cbea4ceb8`:

| Measurement | Result |
| --- | --- |
| 100k browse first page | 5 ms |
| 100k full browse | 4.135 s |
| Peak RSS | 113,823,744 bytes |
| Browse teardown | sessions, entry refs, path refs and active enumerations returned to zero |
| Managed Scan pressure foreground wait | **soft target missed**: 5,051 ms; idle browse p95 262 µs, pressure p95 1,276 µs |

The managed-scan pressure test itself passed its hard admission/cancellation/release assertions and the suite exited successfully. The soft target miss is recorded for owner review; no threshold was changed.

## Changed files

### Rust / Tauri / permissions

- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock` (official single-instance plugin)
- `src-tauri/build.rs`
- `src-tauri/capabilities/default.json`
- `src-tauri/src/app_control.rs`
- `src-tauri/src/file_workspace/integration/commands.rs`
- `src-tauri/src/file_workspace/integration/mod.rs`
- `src-tauri/src/file_workspace/integration/runtime.rs`
- `src-tauri/src/file_workspace/integration/runtime_owner.rs`
- `src-tauri/src/file_workspace/integration/tests.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/main.rs`
- `src-tauri/tauri.conf.json`
- `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md`

### Frontend

- `src/App.tsx`
- `src/SearchApp.tsx`
- `src/api/searchRuntimeApi.ts`
- `src/api/types.ts`
- `src/api/windowApi.ts`
- `src/components/AppRuntimeProviders.tsx`
- `src/components/AppShell.tsx`
- `src/components/CommandModal.tsx`
- `src/hooks/useWindowBehavior.ts`
- `src/main.tsx`
- `src/search.css`
- `src/store/useAppStore.ts`
- `src/utils/mainWindowReadiness.ts`
- `src/utils/uiPreferences.ts`
- `src/utils/viewHelpers.ts`

### Tests and validation configuration

- `tests/appSettings.test.ts`
- `tests/commandModalIme.test.tsx`
- `tests/mainWindowReadiness.test.ts`
- `tests/onDemandUiRuntime.test.ts`
- `tests/searchSpotlight.test.ts`
- `tests/tauriCommandPermissions.test.ts`
- `tests/windowBehavior.test.ts`
- `vite.config.ts` (exclude generated fixture roots; allow only workspace and resolved dependency root for the linked `node_modules` worker asset)

### Task records

- `docs/project/tasks/ZB-04-ON-DEMAND-UI-RUNTIME-CODEX.md`
- `docs/project/tasks/ZB-04-ON-DEMAND-UI-RUNTIME-RESULT.md`

No STATUS/ROADMAP, SQLite schema/migration, durable authority, release/W6/RC1 state or Global Index provider/runtime redesign was changed.

## Focused checkpoint validation

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS.
- `cargo test --features desktop-runtime --lib app_control::tests`: PASS, 21 tests.
- `cargo test --features desktop-runtime --lib file_workspace::integration::tests::runtime_owner`: PASS, 3 tests.
- `cargo clippy --features desktop-runtime --lib -- -D warnings`: PASS.
- `cargo check --features desktop-runtime --bin zen-canvas`: PASS.
- Focused Search/Main/window/frontend tests: PASS, 49 tests.
- `npm run typecheck`: PASS.
- The Search graph/lifecycle, Search IME/navigation, window lifecycle, command permission and FileWorkspace teardown-race tests passed at their checkpoints.

## Final local validation

The integrated production implementation was validated once. Subsequent `d39cbdf6` changes only update validation assertions/configuration; full frontend tests and typecheck were rerun after them. Routed extended performance evidence remains bound to production HEAD `1ad81469...` because no production Rust/frontend source changed afterward.

| Validation | Result |
| --- | --- |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS — library: 987 passed, 23 ignored; integration test binaries passed |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS |
| `npm run typecheck` | PASS, including after validation-config repair |
| `npm test` | PASS — 152 files, 1,616 tests; generated fixture roots excluded by Vite config |
| `npm run verify:rust` | PASS — 990 passed, 23 ignored; desktop-runtime Clippy passed |
| `npm run test:performance:architecture` | PASS — architecture guard and 28 tests |
| `npm run verify:security` | PASS at configured thresholds; findings below |
| `npm run build:frontend` | PASS; existing CSS optimizer and PDF dynamic/static-import warnings |
| `npm run check:rust:release` | PASS — optimized desktop-runtime check |
| Routed Workspace Foundation extended performance | PASS hard gates; one managed-scan pressure soft target miss above |

Security audit findings: `npm audit --audit-level=high` reported two moderate transitive Vitest / `@vitest/mocker` advisories and exited successfully at the configured high threshold. Cargo audit exited successfully with the repository's allowed warnings, including unmaintained crates, one `glib` unsoundness advisory and a yanked crate. No dependency remediation was included in this Track.

The full frontend suite first encountered generated Rust fixture files under `.tmp-tests` and Vite's linked `pdfjs-dist` worker outside the checkout. The committed validation config now excludes task fixture roots and permits the real path of this worktree's `node_modules` dependency root in the Vite dev-server file allowlist. This kept the tested workspace/dependency boundary narrow and the full suite passed.

## Hosted CI

Draft PR [#264](https://github.com/ArdenZC/Zen-Canvas/pull/264) is open and remains Draft. Post-repair Hosted CI run [36106019776](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36106019776) completed **SUCCESS** on exact PR source HEAD `1be6ed66c7cc5a64667f36f0a0fc8f503b4d384b`:

- Windows and macOS Rust quality, including tests/Clippy: PASS.
- Frontend tests, format/build and browser quality: PASS.
- Routed Search and Workspace Foundation performance lanes: PASS.
- Native Apple Silicon macOS performance: PASS.
- Windows/macOS release compile, package metadata smoke, dependency audit, source evidence, scope/routing and validation-plan contracts: PASS.
- Unrouted package/native Preview Handler and unrelated performance lanes were skipped by the current validation plan.

This Result is a documentation-only successor to that full integration-validated source head; production sources are unchanged. The prior pre-repair runs were `36051507555` on `a119f2caf97236e5f64c25259c356baa54ffec86` and `36049624697` on `e93ffc7f5d34e55115f7eedf28a2b3f9390cbaa4`; they are historical and do not replace the post-repair run above.

The repair received the focused checks below; no local full suite, extended performance or full security validation was repeated. Hosted CI is the final Windows/macOS integration proof for the repair source tree. CI does not substitute for the native UI evidence boundary described above.

## Local task hygiene / closeout pending

The local safety policy previously rejected direct `Remove-Item` cleanup attempts for the task-created `.tmp-tests` symlinks and worktree `node_modules` Junction. No alternate deletion method or recursive cleanup was used. Read-only inspection confirms:

- Worktree `.tmp-tests` remains and contains four SymbolicLink reparse points:
  - `F:\Coding\Zen-Canvas-zb-04-on-demand-ui-runtime\.tmp-tests\zen-canvas-file-op-test-1488-0-1790277246586077900\link.txt` → its fixture `target.txt`.
  - `F:\Coding\Zen-Canvas-zb-04-on-demand-ui-runtime\.tmp-tests\zen-canvas-file-op-test-1488-19-1790277247394605400\source-link.txt` → its fixture `target.txt`.
  - `F:\Coding\Zen-Canvas-zb-04-on-demand-ui-runtime\.tmp-tests\zen-canvas-file-op-test-1488-20-1790277247399933600\linked-parent` → its fixture `real-parent`.
  - `F:\Coding\Zen-Canvas-zb-04-on-demand-ui-runtime\.tmp-tests\zen-canvas-file-op-test-1488-72-1790277249255392500\protected-link` → `C:\Windows`.
- The F: task temp root `F:\_codex_tmp\zb04-npm-temp` contains another four test-owned links with the same four link types; its `protected-link` also targets `C:\Windows`. None of these targets was followed or modified.
- `F:\Coding\Zen-Canvas-zb-04-on-demand-ui-runtime\node_modules` remains a Junction to task-owned `F:\_codex_tmp\zb04-validation-deps\node_modules`.
- `.performance-artifacts`, `.performance-cache`, `.performance-temp`, and build output `dist` remain. Read-only recursive scans found no reparse points in those roots.

These are retained task-owned local artifacts and are **LOCAL TASK HYGIENE PENDING**, not a product implementation blocker. Per owner direction, no further cleanup attempt or alternate deletion path was used. The D: candidate build/log root `D:\_codex_tmp\zb04-native-repair` and isolated profile directories listed above are retained pending owner-approved local cleanup. The shared `F:\CargoTarget` remains intact. The common checkout `F:\Coding\Zen-Canvas` was not modified. No operation traversed or changed `C:\Windows`.

## Owner-review repair

The repair commit `a6d0e5aacbf0c20a354448746b9a198d82106282` changes only `src-tauri/src/app_control.rs` and `src-tauri/src/main.rs`:

- `ExitRequested { code: None }` maps to `StayResident` and calls `api.prevent_exit()`; it does not run resident shutdown. An explicit exit code maps to normal shutdown and permits exit.
- Narrow diagnostics remain for single-instance raw args/action/result, Main generation and WebView count, Search activation stages, and readiness request/ack. No telemetry framework was added.
- Focused automated contracts already cover Search activation command/readiness-listener ordering/generation nonce acknowledgement/stale and current nonce/navigation payload/renderer navigation; teardown session save → readiness false → FileWorkspace dispose → window destroy; Main reopen generation increment/small-session restore/stale-generation rejection; and single-instance ActivateMain/IgnoreBackground/unsupported-args fail-closed behavior.
- The repair focused validation passed: Managed app-control tests 24 passed (992 filtered); frontend readiness/on-demand tests 8 passed; `cargo fmt --check`; narrow desktop-runtime Clippy with warnings denied; and `git diff --check`. These checks apply to the repair source tree `e079074...` / Production HEAD `a6d0e5aacbf0c20a354448746b9a198d82106282`. No source changed after those checks.
- No full local test suite, extended performance, or full security suite was rerun for this repair.

## Scope confirmation and disposition

- No schema, durable authority, PreviewSession/ReadGate/BrowseService semantics, filesystem mutation/recovery behavior, STATUS or ROADMAP changes.
- No Global Index provider/runtime redesign, AI-only migration, ResourceGovernor, WebView lifecycle follow-on or ZB-05 work started.
- No merge or Ready transition.
- The current native evidence boundary is owner-accepted; unavailable UI interactions remain `NOT DIRECTLY NATIVE-AUTOMATED ON THIS HOST`.
- **READY FOR OWNER RE-REVIEW — LOCAL TASK HYGIENE PENDING**. The native QA boundary is accepted, Hosted CI run `36106019776` passed on source HEAD `1be6ed66c7cc5a64667f36f0a0fc8f503b4d384b`, and local cleanup remains owner-handled rather than a product blocker.
