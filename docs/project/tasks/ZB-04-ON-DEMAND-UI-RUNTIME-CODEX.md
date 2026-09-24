# ZB-04 — On-demand UI Runtime — Codex / Agent Brief

Status: **OWNER-DIRECTED IMPLEMENTATION — do not merge autonomously**

Baseline: `master@20def056aa5e6a3c5ae089d11033ddc2030bf041`

Implementation branch: `perf/zb-04-on-demand-ui-runtime`

Parent direction:

- `docs/project/MASTER_DEVELOPMENT_PLAN.md`
- `docs/project/tasks/ZB-00-RUNTIME-RESOURCE-LIFECYCLE-FREEZE.md`
- `docs/project/tasks/ZB-01-DATABASE-RESIDENT-FOOTPRINT-RESULT.md`
- `docs/project/tasks/ZB-02-IDLE-POLLING-REMOVAL-RESULT.md`
- `docs/project/tasks/ZB-03-RUNTIME-RESOURCE-GOVERNANCE-RESULT.md`

This is one **medium-granularity Track**.

Do not split Search/Main/Workspace lifecycle into separate PRs unless a stop condition is hit.

The Track goal is:

> **Zen should keep only the native resident core alive when the UI is not in use. Main/Search WebViews and FileWorkspace resources must become demand-owned and disposable.**

This Track owns UI/runtime lifetime only.

It does **not** redesign Global Index providers, AI semantic authority, durable file truth, Preview safety authority, filesystem mutation/recovery, or ZB-03 resource policy.

---

## 1. Required read set

Read completely before editing:

1. `AGENTS.md`
2. `docs/project/STATUS.md`
3. `docs/project/ROADMAP.md`
4. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
5. `docs/project/ARCHITECTURE_MAP.md`
6. `docs/project/DEVELOPMENT_WORKFLOW.md`
7. `docs/project/CODE_MAINTAINABILITY.md`
8. `docs/project/tasks/ZB-00-RUNTIME-RESOURCE-LIFECYCLE-FREEZE.md`
9. `docs/project/tasks/ZB-01-DATABASE-RESIDENT-FOOTPRINT-RESULT.md`
10. `docs/project/tasks/ZB-02-IDLE-POLLING-REMOVAL-RESULT.md`
11. `docs/project/tasks/ZB-03-RUNTIME-RESOURCE-GOVERNANCE-RESULT.md`
12. this taskbook.

Then inspect real owners/tests:

### Rust / Tauri

- `src-tauri/src/main.rs`
- `src-tauri/src/app_control.rs`
- `src-tauri/src/window_auth.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/capabilities/default.json`
- `src-tauri/capabilities/search.json`
- `src-tauri/src/file_workspace/integration/runtime.rs`
- `src-tauri/src/file_workspace/integration/commands.rs`
- `src-tauri/src/platform/macos/quick_look.rs`
- any native-preview lifecycle owner used by FileWorkspaceRuntime.

### Frontend

- `src/main.tsx`
- `src/App.tsx`
- `src/components/AppRuntimeProviders.tsx`
- `src/components/AppShell.tsx`
- `src/components/CommandModal.tsx`
- `src/components/DatabaseBootstrapper.tsx`
- `src/hooks/useWindowBehavior.ts`
- `src/hooks/useAppChrome.ts`
- `src/store/useAppStore.ts`
- Tauri/window API bindings
- search-navigation utilities.

### Tests

At minimum audit:

- `tests/searchSpotlight.test.ts`
- `tests/tauriCommandPermissions.test.ts`
- `tests/windowBehavior.test.ts`
- `tests/appArchitecture.test.ts`
- Search IME / CommandModal tests
- FileWorkspace lifecycle / Preview lifecycle / native-preview cleanup tests
- relevant release/config contract tests.

---

## 2. Current runtime facts

At baseline:

### Main

`tauri.conf.json` statically declares the Main window.

Therefore process startup always creates Main WebView.

Close-to-background currently hides the Main window from the frontend.

Hidden Main retains its WebView/React runtime.

### Search

`main.rs::setup()` calls:

`setup_search_window(app)`

which creates Search WebView at process startup with:

`visible(false)`.

Search uses:

`index.html?mode=search`

but `src/main.tsx` still statically imports/renderers the full `App`.

The full `AppRuntimeProviders` graph is therefore still part of Search bootstrap/bundle ownership, even though some effects are conditionally disabled.

### FileWorkspaceRuntime

`main.rs` eagerly constructs and manages:

- BrowseService;
- MaterializationReadGate;
- ThumbnailService;
- Preview resolver/provider registry;
- native-preview access/host;
- Preview assets/sessions;
- browse/change-monitor registries.

The runtime already has authoritative `dispose()` behavior.

All integration commands currently accept:

`State<'_, FileWorkspaceRuntime>`.

This Track must change lifecycle ownership without replacing those authorities.

---

## 3. End-state contract

### 3.1 Resident/background state

When Zen is running in the background with no UI open:

```text
Main WebView = absent
Search WebView = absent
FileWorkspaceRuntime = absent/disposed
```

Resident native/core authorities may remain:

- tray/menu;
- hotkey;
- DB/search authority;
- scheduler/governor;
- watcher;
- Global Index;
- lightweight registries;
- platform lifecycle.

### 3.2 Search-active state

Hotkey:

```text
resident
→ create Search WebView on demand
→ load Search mini runtime only
→ search interaction
→ hide/close
→ destroy Search WebView
→ resident
```

No permanent warm Search WebView in ZB-04.

Do not add a TTL timer merely to keep Search warm.

A later measured optimization may add a bounded warm policy if cold-create latency proves unacceptable.

### 3.3 Main-active state

Manual interactive launch / tray show / Search activation:

```text
ensure Main WebView
→ create on demand if absent
→ hydrate small UI session
→ full Main runtime becomes available
```

Close-to-background:

```text
persist/capture small transient UI session
→ mark Main not ready
→ dispose FileWorkspaceRuntime
→ destroy Main WebView
→ resident core remains
```

Quit still exits the process.

### 3.4 FileWorkspaceRuntime

```text
no Browse/Preview/FileWorkspace demand
→ runtime absent

first FileWorkspace command
→ lazy create one current runtime generation

Main closes/destroys
→ dispose current runtime
→ revoke/cancel its bounded resources

Main reopens
→ later FileWorkspace command creates a fresh runtime generation
```

No second Preview/Browse/ReadGate authority.

---

## 4. Programmatic window ownership

Move Main/Search native window construction into reviewed Rust lifecycle owners.

### 4.1 Main

Remove the static Main window from `tauri.conf.json`.

Replicate the current native contract programmatically:

- label `main`;
- title;
- initial/minimum size;
- decorations;
- transparency;
- other existing native flags.

Do not silently change visual/window behavior while moving ownership.

Implement an idempotent:

`ensure_main_window(...)`

or equivalent owner.

Requirements:

- if Main already exists, show/unminimize/focus;
- if absent, create exactly one;
- concurrent ensure requests must not produce duplicate Main windows;
- creation failure must leave state retryable;
- Main readiness state resets for a new generation.

### 4.2 Search

Remove eager `setup_search_window(app)` from startup.

Replace it with an idempotent on-demand creator used by hotkey/show lifecycle.

Requirements:

- no Search WebView immediately after resident startup;
- first show creates Search;
- native size/decorations/transparency/taskbar/always-on-top contract remains;
- Search lifecycle CAS/session semantics remain authoritative;
- close/hide path destroys the Search window rather than keeping an invisible WebView resident;
- native destroy failure is surfaced/retryable and must not leave lifecycle stuck.

Do not weaken Search capability restrictions.

---

## 5. Search mini runtime

Current search URL may remain `index.html?mode=search`, but the frontend module graph must be split.

### Required bootstrap shape

Do not keep:

```ts
import { App } from "./App";
...
<App />
```

as the unconditional Search entry path.

Use conditional/dynamic bootstrap so Search does not statically pull the full Main App graph.

Acceptable conceptual shape:

```text
main.tsx
  if search mode:
    dynamic import SearchApp
  else:
    dynamic import MainApp
```

Exact file names may differ.

### SearchApp allowed responsibilities

SearchApp may load only what Search actually needs, such as:

- Search-window root styling/theme primitives;
- language/theme preference projection;
- CommandLauncher / query/results;
- Search window lifecycle state;
- keyboard/IME behavior;
- Global Search IPC;
- Open / Reveal;
- restricted Search→Main activation;
- Global Index/source health needed by Search.

SearchApp must not initialize merely by existing:

- Rules persistence;
- File watcher frontend bridge;
- background scan/index enqueue store;
- Operation queue;
- File Library full workspace/store hydration;
- Organize/Cleanup stores;
- AI settings/workflows unrelated to search;
- Main window close behavior;
- DatabaseBootstrapper mutation/init path.

Existing Search capability and backend authorization remain the hard security boundary.

### Bundle/module evidence

Add a deterministic structural/build assertion proving the Search bootstrap is separated from the full Main provider graph.

Do not claim an exact KB saving unless measured reproducibly.

---

## 6. Manual launch vs background launch

Normal user launch must still open Main.

Background/autostart launch should enter resident state without creating Main/Search WebViews.

The existing Tauri autostart plugin supports fixed application arguments; use an explicit reviewed background-launch argument such as:

`--background`

for autostart registration.

Requirements:

- manual launch without background arg → ensure Main;
- autostart/background arg → no Main/Search;
- index-service mode remains separate and unchanged;
- no new persistent user setting solely to represent process launch mode.

Do not infer background launch from timing, parent process name or fragile OS heuristics.

---

## 7. Single-instance requirement

Once background autostart can run with no Main WebView, a later manual app launch must focus/create Main in the already-running process rather than creating a second Zen process.

Use the official Tauri single-instance plugin unless the exact locked/runtime environment demonstrates a blocker.

Requirements:

- single-instance plugin must be registered in the required ordering for Tauri;
- background second-launch must not unexpectedly pop Main;
- normal manual second-launch must `ensure_main_window` in the existing process;
- ignore untrusted arbitrary CLI payloads except the narrowly reviewed launch-mode signal;
- do not expose CLI arguments to renderer;
- do not add shell/process execution capability.

This is a justified dependency addition for lifecycle correctness.

Do not add the JS single-instance package unless a frontend API is genuinely needed; prefer Rust-only ownership.

---

## 8. Main close/background lifecycle

The current semantic options remain:

- ask;
- minimize/background;
- quit.

Do not silently rename persisted values/schema in this Track.

### Background/minimize choice

The existing user-facing “minimize/background” close behavior now means:

> keep resident core alive, destroy Main UI runtime.

It should no longer be implemented as only `window.hide()`.

Create a backend-owned background transition command/owner.

Required sequence:

1. validate Main window authority;
2. capture/persist the allowed small transient UI session;
3. mark Main readiness false;
4. dispose current FileWorkspaceRuntime generation;
5. destroy Main WebView/window;
6. leave process/tray/hotkey/search core alive.

If FileWorkspace disposal cannot complete safely, do not report a successful background transition.

### Actual window minimize button

A real minimize action remains ordinary window minimization.

Do not reinterpret the minimize titlebar button as destroy-to-background.

### Native CloseRequested

Programmatic Main creation must preserve close semantics for OS/native close requests such as Alt+F4 / native close.

Do not allow native close to bypass the app's ask/minimize/quit behavior.

A narrow backend→frontend close-request event is acceptable.

Do not build a generic event bus.

---

## 9. Minimal Main UI session

Destroying Main must not require keeping React alive.

Keep only a small session needed for continuity.

Allowed examples:

- last top-level `View`;
- window position/size where available;
- maximized state if straightforward;
- existing language/theme/density continue using their current preference authority;
- pending Search→Main activation handshake metadata.

Do not preserve as resident in-memory UI truth:

- loaded file rows;
- browse pages;
- Preview artifacts;
- selection object graphs;
- thumbnails;
- AI result payloads;
- Cleanup/Organize working datasets;
- toasts;
- arbitrary React component state.

Durable backend state remains authoritative.

Do not create a new SQLite schema/table solely for transient UI session.

A process-local Rust session owner is acceptable.

Existing localStorage preference behavior for theme/language/density may remain.

---

## 10. Search → Main activation

Current Search navigation uses Main readiness nonce/ack.

Preserve this correctness model while allowing Main to be absent.

Required flow:

```text
Search result activation
→ ensure/create Main
→ wait until Main frontend reports ready
→ emit ready request / ack as currently required
→ emit SearchNavigate payload
→ close/destroy Search
```

Do not emit navigation into a Main window before its runtime is ready.

If Main creation/readiness fails:

- Search remains recoverable;
- do not silently discard the requested activation;
- do not leave lifecycle state stuck.

---

## 11. FileWorkspaceRuntime lazy owner

Do not try to mutate Tauri-managed `State<FileWorkspaceRuntime>` in place.

Introduce a narrow process-local owner, e.g. conceptually:

`FileWorkspaceRuntimeOwner`

Exact symbol may differ.

Responsibilities only:

- hold immutable factory inputs;
- lazy-create the current `FileWorkspaceRuntime`;
- clone current runtime for a command;
- dispose/take current runtime on Main teardown;
- expose generation/state for tests.

It must not become a new Browse/Preview authority.

### Factory inputs

It may retain:

- Database clone;
- current MacThumbnailService clone;
- thumbnail cache path;
- native-preview root;
- existing global WorkScheduler through the runtime factory.

Do not duplicate those services.

### Command migration

FileWorkspace integration commands currently accept:

`State<'_, FileWorkspaceRuntime>`.

Migrate them to the lazy owner.

Operation commands:

- validate Main window first;
- acquire current runtime lazily;
- perform existing operation.

Cancellation/dispose-only commands should avoid creating a brand-new runtime merely to cancel a resource that cannot exist.

Prefer:

- `current_if_initialized()` for cancellation/dispose paths;
- no-op/current semantics consistent with existing API contracts.

### Teardown races

A command may already hold a clone while Main teardown begins.

Required behavior:

- owner takes/disposes the current generation;
- `FileWorkspaceRuntime::dispose()` remains cancellation/publication authority;
- old in-flight clones observe disposed/cancelled behavior;
- a future Main generation cannot accidentally reuse stale sessions/Preview state;
- no stale native-preview attachment can cross into the new Main window generation.

Add race tests.

---

## 12. Legacy MacThumbnailService

The existing app-managed `MacThumbnailService` is also used by legacy file-op thumbnail commands outside FileWorkspaceRuntime.

Do not force it into the new lazy owner unless evidence shows that can be done without expanding scope.

ZB-04 may leave this lightweight shared service resident.

Do not duplicate it.

---

## 13. Resident startup contract

After full setup reaches resident idle in background mode:

```text
get_webview_window("main") = None
get_webview_window("search") = None
FileWorkspaceRuntimeOwner.current = None
```

The following must still work:

- tray;
- global search shortcut;
- Global Index/search backend;
- watcher/scheduler/governor;
- background user-started work according to existing semantics;
- safety/recovery authorities.

Normal manual launch is allowed to create Main immediately because the user explicitly invoked the app.

---

## 14. Runtime/background task semantics

Destroying Main does **not** mean cancelling every durable user task.

Preserve ZB-00 distinction:

### Continue where product semantics allow

Examples may include explicitly started:

- scan;
- analysis;
- content run;
- Managed AI work;
- dedupe.

ZB-03 governs their background resource budget.

### Must remain waiting for user

If a workflow requires approval/review:

- do not auto-confirm because Main closed;
- persist existing durable review state;
- reopen Main later to continue.

### UI-only work

Preview/Browse/Thumbnail/FileWorkspace ephemeral work should be disposed with Main.

---

## 15. Capabilities/security

Programmatic window creation must preserve existing capability assignments.

Search remains restricted by:

- `search.json`;
- Search label;
- lifecycle CAS;
- ID-only activation;
- backend revalidation.

Main retains existing default capability.

Do not broaden Search permission because Main may be absent.

Do not expose FileWorkspace commands to Search.

Do not add arbitrary path activation.

If dynamically-created windows do not automatically receive the current capability mapping, solve it through supported Tauri capability configuration, not by weakening command guards.

---

## 16. Tests required

Use focused deterministic tests during development.

### 16.1 Main lifecycle

Prove:

- normal launch mode requests Main;
- background launch mode does not;
- ensure Main is idempotent/concurrency-safe;
- background transition marks readiness false;
- background transition disposes FileWorkspace owner then destroys Main;
- reopening creates a new Main generation;
- small session state restores;
- quit remains process exit.

### 16.2 Single instance

Prove callback policy:

- manual second launch → ensure/focus Main;
- background second launch → does not unexpectedly show Main;
- arbitrary args do not expand capability.

Use injected policy/helper tests; do not require two real OS app processes for unit coverage.

### 16.3 Search window

Prove:

- startup does not create Search;
- hotkey show lazily creates one;
- repeated concurrent show does not create duplicates;
- close/hide destroys Search;
- lifecycle returns to Hidden;
- second show creates a fresh window/session;
- resize/CAS stale protections remain;
- failed create/destroy is retryable.

### 16.4 Search mini runtime

Prove Search bootstrap does not initialize/import the full Main runtime ownership path.

At minimum assert Search mode avoids:

- AppRuntimeProviders;
- DatabaseBootstrapper;
- rules hydration;
- File watcher frontend bridge;
- scan bootstrap;
- operation queue.

Existing Search IME/navigation/security tests remain green.

### 16.5 FileWorkspace lazy owner

Prove:

- owner begins empty;
- first operation creates one runtime;
- concurrent acquire creates one generation;
- cancellation-only no-op does not create runtime when absent;
- teardown calls dispose exactly once;
- stale generation cannot be reused;
- reopen/acquire creates a new generation;
- existing PreviewSession/native access/read-gate teardown assertions still pass.

### 16.6 Search→Main

Prove absent Main is created before readiness/navigation handshake and Search closes only after successful handoff.

### 16.7 Resident state

Add a source/integration contract proving background startup has no statically configured Main/Search window.

---

## 17. Measurement/evidence

This Track must produce evidence beyond “tests pass”.

Record before/after:

| State | Before | After |
| --- | --- | --- |
| process startup | Main + hidden Search WebViews | manual: Main only; background: no WebViews |
| background after Main close | hidden Main + hidden Search | no Main/Search WebViews |
| Search idle | hidden Search WebView resident | Search absent |
| FileWorkspace idle | runtime eagerly resident | runtime absent until first use |
| Main close | hide only | FileWorkspace dispose + Main destroy |

Where practical measure on Windows:

- WebView child process count;
- Zen process/private working set before/after close;
- FileWorkspace owner generation/resource counts.

Do not invent a claimed MB saving if attribution is noisy.

Hosted/native evidence may provide stronger process-count proof.

---

## 18. Performance guard

On-demand creation must not make basic interaction unusable.

Measure at least:

- Search cold create → ready latency;
- Main cold create → ready latency;
- Main reopen latency.

Do not freeze arbitrary new product thresholds unless existing performance guidance provides one.

Report measurements honestly.

Do not introduce permanent warm windows merely to improve the benchmark.

---

## 19. Internal checkpoints / validation cadence

This remains one branch and one PR.

Suggested checkpoints:

1. window lifecycle owners + programmatic Main/Search;
2. Search mini runtime;
3. FileWorkspace lazy owner;
4. close/background + session restore + Search→Main;
5. autostart/single-instance;
6. final performance/evidence.

At each checkpoint run only:

- focused tests;
- formatter;
- narrow type/Clippy checks.

Do not run full repository validation after each checkpoint.

---

## 20. Final validation

After all scopes are integrated, run the expensive local validation once:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
npm run typecheck
npm test
npm run verify:rust
npm run test:performance:architecture
npm run verify:security
npm run build:frontend
npm run check:rust:release
```

Run routed extended performance/native checks once where current workflow requires.

Create one Draft PR.

Use Hosted CI for final Windows/macOS integration.

Avoid repeating the entire local full suite after small owner-review repair commits; use focused repair tests then Hosted CI.

---

## 21. Result document

Create:

`docs/project/tasks/ZB-04-ON-DEMAND-UI-RUNTIME-RESULT.md`

Record:

- baseline;
- production HEAD;
- final HEAD;
- changed files;
- Main ownership/lifecycle;
- Search ownership/lifecycle;
- Search mini-runtime dependency split;
- autostart/background launch behavior;
- single-instance behavior;
- FileWorkspace lazy owner design;
- Main session state;
- Search→Main handshake;
- exact disposed resources;
- WebView/process-count evidence;
- cold/reopen latency evidence;
- remaining resident UI/runtime objects and justification;
- focused checkpoint validation;
- final local validation;
- Hosted CI;
- unexpected findings;
- confirmation durable authorities/schema unchanged;
- confirmation Native Global Search provider redesign was not started.

Disposition:

`READY FOR OWNER REVIEW`

or

`BLOCKED`.

---

## 22. Explicit non-goals

Do NOT include:

- Global Index coordinator 2-second event-runtime redesign;
- MFT/USN provider redesign;
- Spotlight/FSEvents provider redesign;
- Global Search ranking/schema redesign;
- AI semantic migration;
- Rules/Preference Memory;
- onboarding redesign;
- updater;
- crash telemetry;
- SQLite schema;
- durable UI-session table;
- FileWorkspace authority rewrite;
- PreviewSession/ReadGate/provider semantics changes;
- filesystem mutation/recovery changes;
- STATUS/ROADMAP;
- W6/RC1/publication state.

---

## 23. Stop conditions

STOP and report rather than broadening scope if:

- Search mini runtime requires broadening Search permissions;
- dynamic windows cannot safely preserve capability assignments;
- Main teardown requires changing durable operation/recovery semantics;
- FileWorkspace lazy ownership would require replacing PreviewSession/ReadGate authority;
- single-instance support requires a custom OS daemon/lock implementation instead of the supported official plugin;
- autostart background mode cannot be represented by explicit supported CLI args;
- schema changes appear necessary;
- a generic application event bus is proposed;
- Native Global Search provider work becomes necessary;
- production behavior would silently auto-confirm pending review work.

Record unrelated findings instead of absorbing them.

---

## 24. Git discipline

Work only on:

`perf/zb-04-on-demand-ui-runtime`

Allowed:

- implementation commits;
- focused checkpoint validation;
- one Result document;
- one Draft PR.

Forbidden:

- merge;
- mark Ready;
- update STATUS/ROADMAP;
- start Native Global Search provider/runtime Track;
- start AI-only migration.

---

## 25. Definition of Done

ZB-04 is ready for owner review only when:

1. background/resident startup has no Main/Search WebView;
2. normal manual launch still opens Main;
3. Search WebView is created on demand and destroyed when dismissed;
4. Search uses a real mini runtime rather than the full Main App ownership graph;
5. close-to-background destroys Main rather than only hiding it;
6. FileWorkspaceRuntime is lazy and disposed with Main;
7. Main reopen creates clean UI/FileWorkspace generations;
8. Search→Main handoff remains readiness-safe;
9. launch-at-login uses explicit background mode;
10. a manual second launch activates Main in the resident process through single-instance ownership;
11. existing Search/Main capability boundaries remain unchanged;
12. durable background jobs continue according to existing ZB-03 policy;
13. Preview/Browse/UI-only resources are released on Main teardown;
14. no schema/durable authority/security fallback changed;
15. full validation is run once at Track end and green;
16. Result document is complete;
17. Native Global Search provider redesign has not started.
