# W4-03 — Windows Preview Handler Architecture + Lifecycle Spike — Codex / Agent Brief

Status: **ACTIVE implementation Track on branch**

Baseline: `master@3cd96a798c645ef4a845c686cde9971c7d321168` (W4-01 governance closeout / PR #144)

W4-01 production baseline: `master@02e88db7cf4287e0d68792b3960da503b70d6c56` (PR #143)

Branch: `feat/w4-windows-preview-handler-spike`

Parallel sibling Track: W4-02 on `feat/w4-macos-native-quick-look`. W4-03 must not absorb macOS native Preview scope and does not wait for W4-02.

W4-03 is a **production-shaped architecture/lifecycle spike**, not the final broad Explorer association/product integration. Its job is to prove the Windows shell artifact/process/COM/source/lifecycle model well enough that W4-04 can safely turn it into a deliberately scoped product integration.

## 0. Required read set

Before implementation or review, read completely:

1. `AGENTS.md`
2. `docs/project/README.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
6. `docs/project/ARCHITECTURE_MAP.md`
7. `docs/project/PRODUCT_MAP.md`
8. `docs/project/DEVELOPMENT_WORKFLOW.md`
9. `docs/project/CODE_MAINTAINABILITY.md`
10. `docs/project/DECISIONS/0005-native-preview-host-boundary.md`
11. `docs/project/initiatives/W4-native-integration.md`
12. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
13. `docs/project/specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md`
14. `docs/project/specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md`
15. `docs/project/tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CODEX.md`
16. `docs/project/tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CURRENT-TRUTH.md`
17. this taskbook.

Inspect current production/build owners directly before editing:

- `src-tauri/Cargo.toml`
- `src-tauri/build.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/platform/mod.rs`
- `src-tauri/src/file_workspace/contracts.rs`
- `src-tauri/src/file_workspace/preview.rs`
- `src-tauri/src/file_workspace/preview_policy.rs`
- `src-tauri/src/file_workspace/preview_providers.rs`
- `src-tauri/src/file_workspace/native_preview/host_provided.rs`
- `src-tauri/src/file_workspace/native_preview/mod.rs`
- `src-tauri/src/file_workspace/integration/runtime.rs`
- existing Windows installer hooks under `src-tauri/windows/` and any package scripts that currently own native artifacts.

## 1. Entry truth

W4-01 is **COMPLETE / CLOSED**. Canonical master is:

`master@3cd96a798c645ef4a845c686cde9971c7d321168`.

W4-02 and W4-03 are both authorized and may proceed in parallel. W4-04 is explicitly dependency-gated behind an independently accepted W4-03 result. W4-05+ remain downstream-gated; W5 remains **NOT AUTHORIZED / NOT ACTIVE**.

Current repository reality matters:

- no Windows Preview Handler/COM implementation exists;
- `src-tauri/src/platform/` currently has macOS platform code only;
- `src-tauri` is a Tauri crate with a normal Rust library + `zen-canvas` binary, not a Preview Handler DLL artifact;
- current `windows-sys` features cover filesystem/service/runtime needs, not a complete COM Preview Handler implementation;
- production NSIS exists and is per-machine, but W4-03 does **not** own broad production registration;
- W4-01 already provides the shell-owned `HostProvidedRegistry` and `HostProvidedReadSource` lifecycle that this Track must consume.

Do not convert the main Tauri app library into a COM DLL merely because it is the existing Rust crate.

## 2. W4-01 HostProvided contract is authoritative

The incoming Explorer/shell request owns its source lifetime. Preferred source is `IStream`.

Required direction:

```text
Explorer / preview host IStream
→ request-owned Windows IStream adapter
→ existing HostProvidedReadSource
→ existing HostProvidedRegistry registration
   host = WindowsPreviewHandler
   generation = exact COM preview request
→ bounded representation/render work
→ SetWindow / SetRect / DoPreview
→ Unload
→ revoke HostProvided token first
→ release source/stream/native render resources
```

Hard W4-01 facts to preserve:

- `HostProvided` is shell-owned only;
- token is opaque/non-durable and contains no path;
- registry defaults are bounded (`32` records, `1 MiB` max bounded read, `60 s` TTL);
- read results are revalidated after potentially blocking source work;
- revoke/generation-revoke/dispose signal cancellation;
- source/native object destruction happens after registry locks are released;
- only `PreviewHostKind::WindowsPreviewHandler` is activated for HostProvided registration;
- `WorkspacePreviewResolver` intentionally does not resolve HostProvided.

W4-03 MUST NOT route the shell stream through Managed/Ephemeral identity or guess a filesystem path to reuse the in-app path.

## 3. Artifact / crate topology freeze

W4-03 needs an explicit Windows native Preview Handler artifact. The exact implementation mechanism may be selected after inspecting current Rust/Windows bindings, but the responsibility boundary is frozen.

Preferred shape is a dedicated Windows-only native crate/artifact under a clear subsystem path, for example:

```text
src-tauri/native/windows-preview-handler/
  Cargo.toml
  src/
    lib.rs            # DLL exports / class factory surface
    com.rs            # COM object/interfaces/ref-count/lifecycle
    stream.rs         # IStream -> HostProvidedReadSource adapter
    window.rs         # child HWND / geometry / paint lifecycle
    state.rs          # request generation + bounded preview state if needed
    tests/            # behavior-oriented tests
```

Exact path/names may vary if review finds a materially better cohesive layout.

The artifact should normally be a Windows DLL / `cdylib`-appropriate native component with its own small dependency surface. Do **not** change `zen_canvas_tauri` crate-type to make the whole app a COM server.

If a small shared pure Rust library extraction is necessary to let the DLL reuse Preview contracts without linking the full Tauri runtime, keep that extraction narrow and authority-preserving. It may move reusable contract/provider code; it must not fork a second provider implementation tree.

### Dependency rule

Use the narrowest practical Windows bindings. The existing project uses `windows-sys`; a COM implementation may justify `windows`/`windows-core` or additional `windows-sys` features inside the Windows-only artifact if that produces safer generated interface definitions/ref-counting.

Do not add a broad cross-platform dependency to the main app merely for the shell DLL.

## 4. Required COM surface / lifecycle

The spike must be production-shaped enough to prove normal Explorer Preview Handler semantics.

At minimum prove the required object/class-factory/export topology for the chosen implementation, including applicable equivalents of:

- `DllGetClassObject`;
- `DllCanUnloadNow`;
- class factory / COM reference-count lifetime;
- `IInitializeWithStream`;
- `IPreviewHandler`;
- `IOleWindow`;
- `IObjectWithSite` where required by the final topology;
- focus/accelerator interface behavior required by Preview Handler conventions.

W4-03 may add test-only registration helpers if necessary to exercise the DLL, but broad production association ownership is W4-04/W4-05.

### Call-order contract

`Initialize`:

- validates call order;
- captures/addrefs a request-owned `IStream` and lightweight generation state only;
- creates/adapts the shell read source;
- does not eagerly parse/render the whole document;
- does not launch Zen UI;
- does not derive a guessed path.

`SetWindow` / `SetRect`:

- store/validate host parent rectangle;
- update exactly one child native rendering surface when created;
- never paint outside the host bounds;
- do not create a second top-level Zen window.

`DoPreview`:

- performs/starts the bounded preview work after initialization;
- registers or attaches the exact request to `HostProvidedRegistry` as `WindowsPreviewHandler`;
- keeps generation/token/request ownership explicit;
- publishes/paints only while request authority remains current;
- leaves expensive/provider work cancellable by `Unload`.

`Unload`:

```text
mark request/presentation invalid
→ signal/cancel outstanding work
→ revoke HostProvided token/generation
→ detach/destroy child render surface
→ release provider/render assets
→ release IStream/source/native resources
→ clear site/window/request references
→ return with no preview-owned source lock
```

`Unload` is a hard cleanup boundary. Dropping the COM object later is not an acceptable substitute.

## 5. IStream adapter contract

Implement a narrow Windows request-owned adapter behind the existing `HostProvidedReadSource` contract.

Requirements:

- holds only the COM stream/request state required for the current preview request;
- supports bounded offset + max-byte reads required by `HostProvidedReadSource`;
- preserves/repositions stream safely according to the COM stream semantics selected by the implementation;
- does not assume a filesystem path exists;
- observes shared HostProvided cancellation before/during/after blocking reads where practical;
- maps unavailable/permission/cancel/failure into the existing HostProvided source error surface;
- does not expose `IStream` through Tauri/React/general app IPC;
- releases COM resources without holding HostProvided/global coordination mutexes.

If the incoming stream cannot support the read/seek semantics needed by the selected representation path, fail locally/unsupported rather than copying it into an unbounded hidden cache or reverse-resolving a path.

## 6. Rendering scope for the spike

W4-03 is not W4-04. It must prove a real host rectangle/native child rendering lifecycle, but it does not need the final broad file-type matrix.

Minimum acceptable rendering proof:

- create one lightweight child HWND/native surface inside the host rectangle;
- render a deterministic, inert preview state derived from bounded request data or a deliberately narrow production-shaped representation path;
- resize correctly through `SetRect`;
- clear/destroy deterministically through `Unload`;
- unsupported/corrupt input fails locally without crashing Explorer/host or launching Zen.

Do not implement a parallel suite of W3 parsers inside the DLL merely to make the spike look feature-complete.

### Shared provider/representation feasibility gate

The spike MUST explicitly answer how W4-04 can reuse Zen provider/representation logic without creating two production provider truths.

Allowed outcomes:

1. a narrow pure provider/representation library seam can be reused by app and shell artifact; or
2. only a bounded subset is safely shareable now, and W4-04 receives a precise extraction plan; or
3. current provider architecture is too tightly coupled to the app runtime and would require a broad authority fork — **STOP / architecture review** before W4-04.

Do not copy provider source files into the Windows artifact as a permanent second implementation.

## 7. Shell isolation / process rules

The target is normal Windows Preview Handler hosting semantics, where the shell/preview host loads the handler and the full Zen UI is not the steady-state preview process.

W4-03 must not:

- launch `zen-canvas.exe` on every preview;
- embed the full Tauri/WebView app into Explorer;
- opt out of normal low-integrity/isolation merely for convenience;
- require writable arbitrary user/app-data state for basic preview lifecycle;
- use a durable service/database solely to bridge one shell request.

Low-integrity/real `prevhost.exe` behavior may be difficult to fully prove in hosted CI. Record real executed evidence where available; otherwise classify it `UNVERIFIED`, not PASS. The architecture itself must not depend on knowingly disabling isolation.

## 8. Registration boundary

W4-03 may create the minimum deterministic registration/unregistration **test seam** needed to load the COM class.

It MUST NOT finalize or broadly ship:

- production CLSID/file-extension association matrix;
- replacing system handlers;
- NSIS production registration lifecycle;
- install/upgrade/uninstall association policy.

Those belong to W4-04/W4-05 after the spike is accepted.

Test registration requirements:

- use a dedicated test CLSID/isolated scope where feasible;
- clean up deterministically on success/failure;
- never leave developer/CI registry junk behind;
- never register broad real user file associations just to run a test;
- record exact registry mutations if real registration is exercised.

If safe isolated registration cannot be achieved in the test environment, use a lower-level class-factory/load harness and leave Explorer registration as real-native `UNVERIFIED` rather than polluting the machine.

## 9. Locking / thread / native resource rules

COM/native calls and stream reads may block or reenter. Follow repository maintainability rule 2.3:

```text
lock → claim/snapshot current request state → unlock
→ COM/stream/provider/native work
lock → revalidate generation/current authority → short publish/update → unlock
```

No global/request coordination mutex may cover:

- `IStream::Read`/Seek/Clone/native calls;
- child-window creation/destruction;
- provider parsing;
- registry/native cleanup that may release COM objects.

All COM references/source Arcs that may perform non-trivial release/destruction must be detached under lock and dropped after unlock.

## 10. Required tests

### DLL / COM object

- DLL/class factory loads under a Windows test harness;
- unsupported CLSID/IID fails correctly;
- COM object reference count/lifetime reaches unloadable baseline;
- `DllCanUnloadNow` (or chosen equivalent) reflects live class/object state;
- invalid call order fails without leaked state;
- repeated create/release reaches steady state.

### Initialize / stream / HostProvided

- `IInitializeWithStream` accepts the controlled test stream once according to the chosen contract;
- duplicate/reinitialize misuse fails safely;
- stream adapter performs bounded reads only;
- no source path is required or encoded in host token;
- exact `WindowsPreviewHandler` host + generation registration works;
- wrong host/generation/token fails closed;
- revoke/unload racing an in-flight stream read cannot publish late bytes;
- stream/native source final destruction occurs outside HostProvided registry lock.

### DoPreview / window lifecycle

- `SetWindow` before/after `DoPreview` as supported by the frozen call model;
- `SetRect` resizes one child surface without duplicate HWNDs;
- `DoPreview` performs deferred work rather than eager Initialize parsing;
- stale generation cannot repaint after a newer request/unload;
- unsupported/corrupt input fails locally;
- focus/accelerator handling has deterministic behavior appropriate to the implemented interfaces;
- no full Zen app process is launched by the handler test path.

### Unload / lock release

- `Unload` is idempotent or otherwise safely handles repeated shell cleanup calls per contract;
- outstanding work observes cancellation;
- HostProvided token/generation is revoked before underlying source release finishes;
- child HWND/native render resources are destroyed;
- provider/assets/request state is released;
- a real temporary file-backed stream can be rename/move/delete-opened after Unload where the test harness can represent normal Explorer ownership;
- repeated Initialize→DoPreview→Unload reaches handle/stream/window/resource steady state.

A test that closes only the Rust wrapper without executing `Unload` does not satisfy the no-file-lock criterion.

### Cross-platform regression

- main Zen app continues building on Windows/macOS;
- normal W3 `WindowsPreviewHandler` host remains unavailable through regular Zen UI host policy unless the shell artifact owns the request;
- `WindowsQuickPreview` remains inactive;
- WorkspacePreviewResolver remains HostProvided-fail-closed;
- no Tauri renderer command is added for shell stream/HostProvided registration;
- W4-01 HostProvided unit/integration tests remain PASS.

## 11. Native evidence levels

Separate these claims explicitly:

### HARD / executable in normal Windows CI

Expected where practical:

- Windows-only native artifact compiles;
- exported DLL/class factory can be loaded by a controlled harness;
- COM object/interface/ref-count lifecycle tests;
- IStream adapter + HostProvided integration;
- child HWND geometry lifecycle under a controlled host window;
- Unload cleanup and file-lock-release harness.

### Real Explorer / prevhost evidence

If executable in a safe test environment, record exact Windows version, artifact SHA, registration scope, source fixture and cleanup.

If not actually run, classify Explorer Preview Pane / low-integrity prevhost interaction as **UNVERIFIED**. Hosted DLL compile is not Explorer behavioral proof.

W4-04/W4-06 will own the final real Explorer product/native QA matrix.

## 12. Validation

Focused commands depend on the final crate layout. At minimum establish an explicit Windows artifact build/test command and include it in CI/routing if production code is added.

Existing repo gates still apply, including:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:check
npm run verify:security
```

Run full Rust tests/Clippy and hosted Windows/macOS CI according to current routing. The new Windows artifact must have exact-head Windows build/test evidence; macOS main-app compile must remain unaffected.

If the artifact is a separate Cargo manifest not covered by existing scripts, W4-03 must add a deliberate CI/build validation seam rather than leaving it uncompiled in normal review. Do not disguise the production change as docs-only.

Do not lower W3/File Library/performance thresholds or add PR-number exemptions.

## 13. Maintainability gate

Before final review, explicitly report:

- artifact/crate responsibility;
- class factory responsibility;
- COM object/request lifecycle owner;
- IStream adapter owner;
- HostProvided registry remains source-token authority;
- child-window/render lifecycle owner;
- provider/representation reuse or extraction boundary;
- registration test seam owner;
- all locks and confirmation that stream/native/COM release happens outside locks;
- unusually large modules and decomposition rationale.

Do not put DLL exports, COM interfaces, stream reads, HWND rendering, registry test code and all fixtures into one `windows_preview_handler.rs` mega-file.

## 14. Explicit non-goals

W4-03 MUST NOT implement or activate:

- the final W4-04 Explorer supported extension/content-type matrix;
- broad production file associations;
- production NSIS registration/upgrade/uninstall lifecycle (W4-05);
- `WindowsQuickPreview`;
- a global Space/hotkey overlay Preview product;
- launching/embedding the full Zen Tauri UI as the handler;
- path-based initialization merely for convenience;
- durable HostProvided/source-path storage;
- a second provider registry/read authority;
- copied/forked provider implementation tree;
- low-integrity opt-out as the default solution;
- macOS W4-02 scope;
- W5 Release work.

## 15. Stop / escalate conditions

STOP before W4-04 if any of these is true:

1. the only viable handler architecture requires launching the full Zen/Tauri UI per preview;
2. `IStream` must be converted back into a guessed filesystem path to work;
3. HostProvided cannot be the bounded request-source lifecycle;
4. shared provider/representation reuse requires a permanent second provider fork or second ReadGate/source authority;
5. `Unload` cannot reliably cancel work/release stream/file locks;
6. normal Preview Handler isolation requires an unreviewed low-integrity opt-out;
7. production implementation would require broad installer/association changes before the spike is accepted;
8. the native artifact cannot be independently build/tested/reviewed without turning the main Tauri crate into a DLL.

These are architecture blockers, not reasons to weaken the frozen contract.

## 16. Definition of spike success

W4-03 may close successfully when the exact-head implementation proves:

- a clean Windows Preview Handler artifact/class-factory topology;
- real `IInitializeWithStream` request ingestion into W4-01 HostProvided ownership;
- production-shaped `IPreviewHandler` window/DoPreview/Unload lifecycle;
- deterministic cancellation/token/source cleanup;
- no source lock after Unload in an executable Windows harness;
- no full Zen app launch requirement;
- a reviewable path for W4-04 provider/representation reuse without authority fork;
- exact-head Windows build/tests + repository CI;
- honest classification of any real Explorer/low-integrity evidence not executed.

The spike does **not** need to claim final format coverage or installer registration.

## 17. PR / review / completion flow

Codex is the implementation agent only. **Codex Review is not an acceptance or merge gate for Zen.**

Required flow:

```text
exact baseline / clean scope
→ Codex implementation + focused native tests
→ exact-head Windows native artifact evidence
→ exact-head hosted CI
→ independent ChatGPT exact-head code/architecture audit
→ blockers = 0
→ final PR-tree CI
→ expected-head squash merge
→ docs-only governance/current-truth closeout if needed
→ only then W4-04 may become dependency-unblocked
```

A later production-code commit invalidates earlier exact-head evidence.

Completion report must include:

- Completed
- Authority and compatibility paths
- COM/artifact topology decision
- Provider/representation reuse feasibility result
- Files changed
- Tests and commands run
- Native Windows verification and exact environment
- Explorer/prevhost items explicitly PASS vs UNVERIFIED
- No-file-lock evidence
- Resource/temp/registry cleanup
- Acceptance checklist
- Risks requiring architecture/human review

W4-02 remains an independent parallel Track throughout W4-03. W5 remains inactive.