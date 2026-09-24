# ZB-04 — On-demand UI Runtime — Result

Disposition: **BLOCKED — OWNER REVIEW EVIDENCE / LOCAL TASK HYGIENE PENDING**

## Identity

- Baseline: `master@20def056aa5e6a3c5ae089d11033ddc2030bf041`
- Taskbook commit: `c3839c83063dd26f192ab31a5e3e8a108f85ba5d`
- Branch: `perf/zb-04-on-demand-ui-runtime`
- Production HEAD: `1ad81469d18c24aebb4ddb35a2e4b32cbea4ceb8`
- Validation/configuration HEAD: `d39cbdf655b2f8262c4365cf89567b330e8d1fce` (test/config-only successor; production sources are unchanged)
- Final branch HEAD: this Result is a documentation-only successor to validation HEAD `d39cbdf655b2f8262c4365cf89567b330e8d1fce`; the exact pushed Result commit is the Draft PR source head and is reported in the final closeout.

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

The implementation logs startup mode/window labels and WebView-window counts, Main/Search creation/destruction counts, and create-to-ready latency when each frontend marks its generation/session ready. These are measurement seams, not evidence that a native candidate was exercised.

Native candidate process/WebView counts and Search cold-create, Main cold-create and reopen latency were **not measured** on this host. Preflight found the installed `zen-canvas.exe --index-service` resident and no candidate Main UI process. The installed service and candidate use the same fixed Global Index IPC pipe/database authority; starting the development candidate could communicate with the installed service. The candidate was therefore not started, and no before/after or latency number is claimed. Hosted CI status is recorded below; CI compile/test results do not substitute for native interactive latency evidence.

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

Pending Draft PR creation and Hosted CI dispatch. The PR must remain Draft. Hosted Windows/macOS integration is still required; no native UI measurement is inferred from local builds/tests.

## Local task hygiene / closeout blocker

The local safety policy previously rejected direct `Remove-Item` cleanup attempts for the task-created `.tmp-tests` symlinks and worktree `node_modules` Junction. No alternate deletion method or recursive cleanup was used. Read-only inspection confirms:

- Worktree `.tmp-tests` remains and contains four SymbolicLink reparse points:
  - `F:\Coding\Zen-Canvas-zb-04-on-demand-ui-runtime\.tmp-tests\zen-canvas-file-op-test-1488-0-1790277246586077900\link.txt` → its fixture `target.txt`.
  - `F:\Coding\Zen-Canvas-zb-04-on-demand-ui-runtime\.tmp-tests\zen-canvas-file-op-test-1488-19-1790277247394605400\source-link.txt` → its fixture `target.txt`.
  - `F:\Coding\Zen-Canvas-zb-04-on-demand-ui-runtime\.tmp-tests\zen-canvas-file-op-test-1488-20-1790277247399933600\linked-parent` → its fixture `real-parent`.
  - `F:\Coding\Zen-Canvas-zb-04-on-demand-ui-runtime\.tmp-tests\zen-canvas-file-op-test-1488-72-1790277249255392500\protected-link` → `C:\Windows`.
- The F: task temp root `F:\_codex_tmp\zb04-npm-temp` contains another four test-owned links with the same four link types; its `protected-link` also targets `C:\Windows`. None of these targets was followed or modified.
- `F:\Coding\Zen-Canvas-zb-04-on-demand-ui-runtime\node_modules` remains a Junction to task-owned `F:\_codex_tmp\zb04-validation-deps\node_modules`.
- `.performance-artifacts`, `.performance-cache`, `.performance-temp`, and build output `dist` remain. Read-only recursive scans found no reparse points in those roots.

This is a **LOCAL TASK HYGIENE / CLOSEOUT BLOCKER**, not a product implementation failure. The shared `F:\CargoTarget` was used for builds and remains intact. The common checkout `F:\Coding\Zen-Canvas` was not modified. No operation traversed or changed `C:\Windows`.

## Scope confirmation and disposition

- No schema, durable authority, PreviewSession/ReadGate/BrowseService semantics, filesystem mutation/recovery behavior, STATUS or ROADMAP changes.
- No Global Index provider/runtime redesign, AI-only migration, ResourceGovernor, WebView lifecycle follow-on or ZB-05 work started.
- No merge or Ready transition.
- **BLOCKED** until owner review has Windows/macOS Hosted CI and the missing native cold-create/process evidence is resolved or explicitly waived, and local task-owned artifacts are handled under the host's approved cleanup policy.
