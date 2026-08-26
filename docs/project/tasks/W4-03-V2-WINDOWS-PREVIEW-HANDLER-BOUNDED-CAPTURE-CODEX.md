# W4-03 v2 — Windows Preview Handler Bounded-Capture Spike — Codex / Agent Brief

Status: **AUTHORIZED / NEXT — canonical implementation brief once this taskbook merges**

Taskbook PR base: `master@bc91e7745ba121be4abee66505158ee9ce059fdd` / tree `fd3d95f65c2d6cfa696d442762d7dd781a7f7564` (PR #149 current-truth closeout)

Implementation branch: `feat/w4-windows-preview-handler-bounded-capture-spike`

Implementation baseline: **the exact squash-merge commit produced by this taskbook PR (#150)**. That SHA is intentionally not guessed or prewritten before merge. Immediately after #150 merges, the governance owner creates the implementation branch above directly from the exact #150 merge commit; that pre-created branch HEAD becomes the frozen W4-03 v2 execution baseline.

Parallel sibling Track: W4-02 macOS Native Quick Look remains independently authorized. W4-03 v2 must not absorb macOS scope and does not wait for W4-02.

W4-03 v1 PR #146 is **STOPPED / CLOSED WITHOUT MERGE** and remains read-only architecture provenance. W4-03 v2 MUST start from the pre-created exact PR #150 merge baseline, not from PR #146 and not from an arbitrarily newer `master`. Do not rebase, cherry-pick or merge PR #146 history into the v2 branch.

W4-03 v2 is a **production-shaped architecture/lifecycle spike**, not the final broad Explorer association/product integration. Its purpose is to prove ADR-0006's capture-before-defer source model, the Windows COM/native host lifecycle, a single shared representation implementation seam and real Explorer/prevhost viability strongly enough that W4-04 can make a deliberate product-association decision.

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
11. `docs/project/DECISIONS/0006-windows-preview-handler-bounded-capture.md`
12. `docs/project/initiatives/W4-native-integration.md`
13. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
14. `docs/project/specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md`
15. `docs/project/specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md`
16. `docs/project/tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CODEX.md`
17. `docs/project/tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CURRENT-TRUTH.md`
18. `docs/project/tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`
19. this taskbook.

Inspect current production owners directly before editing:

- `src-tauri/Cargo.toml`
- `src-tauri/build.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/file_workspace/contracts.rs`
- `src-tauri/src/file_workspace/preview.rs`
- `src-tauri/src/file_workspace/preview_policy.rs`
- `src-tauri/src/file_workspace/preview_providers.rs`
- `src-tauri/src/file_workspace/native_preview/mod.rs`
- `src-tauri/src/file_workspace/native_preview/host_provided.rs`
- `src-tauri/src/file_workspace/native_preview/tests/host_provided_lifecycle.rs`
- `src-tauri/src/file_workspace/integration/native_preview_tests.rs`
- `src-tauri/src/file_workspace/integration/runtime.rs`
- current Windows installer/package owners under `src-tauri/windows/` and `src-tauri/tauri.conf.json`, for boundary awareness only.

PR #146 may be inspected as **read-only evidence** for already-proven COM/artifact/window/harness findings. It is not a source branch for v2 implementation history.

## 1. R0 — fail-closed preflight

The governance owner creates `feat/w4-windows-preview-handler-bounded-capture-spike` immediately after PR #150 merges, using the exact #150 squash-merge SHA as its starting commit.

Before creating/editing production files, Codex must prove all of the following:

```text
current branch == feat/w4-windows-preview-handler-bounded-capture-spike
starting HEAD == exact PR #150 squash-merge commit
that commit contains this merged taskbook
working tree is clean before v2 work begins
PR #146 evidence head 11fd3729770266f191ea7799edbc2b867693c181 is NOT an ancestor of the v2 branch
no unexpected W4-02/macOS or unrelated production changes are present in the v2 branch
```

Record the resolved v2 baseline commit SHA and tree SHA in the implementation PR/evidence. Do not substitute the older PR #149 base SHA merely because it appears in this document.

`origin/master` may advance after the implementation branch is created because W4-02 is independently authorized in parallel. That does **not** authorize silently rebasing W4-03 v2 onto sibling production work. If `origin/master` has moved, record the drift; keep the v2 branch on its frozen baseline unless a later integration/current-truth decision explicitly authorizes rebasing or merging the sibling changes.

If the current worktree contains conflicts, unrelated production changes, a different task branch, PR #146 ancestry, or cannot establish the exact pre-created baseline, **STOP / fail closed**. Do not repair an ambiguous worktree by carrying unrelated state forward.

The implementation PR must remain independently reviewable from PR #146 and from W4-02.

## 2. Entry truth

The governance/current-truth baseline entering this taskbook PR is:

`master@bc91e7745ba121be4abee66505158ee9ce059fdd` / tree `fd3d95f65c2d6cfa696d442762d7dd781a7f7564`.

The W4-03 v2 **execution baseline** is the exact PR #150 squash-merge commit from which the governance owner pre-creates the implementation branch after this docs PR merges. The implementation PR must record that resolved SHA/tree explicitly.

Current governance truth:

- W4-01 is COMPLETE / CLOSED;
- W4-02 remains independently AUTHORIZED / NEXT;
- W4-03 v1 is STOPPED / CLOSED WITHOUT MERGE;
- ADR-0006 is accepted and supersedes ADR-0005 only for Windows Preview Handler stream lifetime;
- W4-03 v2 is the only authorized Windows implementation Track;
- W4-04 remains BLOCKED until v2 is independently accepted, including real Explorer/prevhost evidence;
- W4-05+ remain downstream-gated;
- W5 remains NOT AUTHORIZED / NOT ACTIVE.

W4-03 v2 must not broaden these gates by implementation convenience.

## 3. Why v1 stopped

The rejected v1 topology was:

```text
shell IStream
→ standard marshal to detached worker
→ request-long IStream-backed HostProvidedReadSource
→ asynchronous Seek / Read
→ Unload attempts CoCancelCall
```

At PR #146 evidence head `11fd3729770266f191ea7799edbc2b867693c181`, deterministic standard-marshaled non-cooperative stream evidence proved:

```text
CoCancelCall returned S_OK
publication/client authority quiesced
BUT server-side Read remained active
AND the real source file lock remained held
```

Therefore:

```text
publication revocation != source release
client worker quiescence != source release
successful cancellation request != forced server-side termination
```

Do not attempt to make v1 green by adding more cancellation checks, a fixed Unload timeout, thread termination, a stream clone/proxy, or another worker topology.

## 4. Frozen v2 source lifecycle

The only authorized Windows source lifecycle is:

```text
Explorer / preview host
→ IInitializeWithStream::Initialize
   → retain shell IStream only
   → zero content reads
   → no provider/render work

→ SetWindow

→ IPreviewHandler::DoPreview
   → prepare one child preview surface
   → on the owning apartment, capture at most 512 KiB of source bytes
   → determine truthful ingress Complete / Partial from observed stream facts
   → copy bytes into Zen-owned immutable bounded memory
   → release every handler-owned shell IStream reference
   → prove no shell IStream call remains in flight
   → only then create/register memory-backed HostProvided request state
   → only then dispatch deferred representation/render work

→ deferred work
   → Zen-owned memory + generation/token + representation/native resources only
   → no IStream/proxy/clone
   → no shell source HANDLE
   → no decoded/raw source path

→ Unload
   → revoke current generation/publication
   → revoke HostProvided
   → cancel/finish only Zen-owned deferred work
   → destroy child HWND/native resources
   → release representation/snapshot/site/frame state
```

Hard phase invariant:

```text
before deferred work is admitted:
  handler-owned shell IStream refs == 0
  shell-source HANDLEs owned by Zen == 0
  shell IStream COM calls in flight == 0
```

`Unload` correctness must therefore not depend on terminating an original shell-stream call.

## 5. Capture contract

### 5.1 Fixed spike ceiling

W4-03 v2 total source-prefix ingress capture is **512 KiB maximum per request**.

This is a total v2 capture budget, not a per-call recommendation.

W4-01 `HostProvidedConfig::max_read_bytes = 1 MiB` is a separate **per HostProvided read** ceiling. Do not infer a future total capture budget from the W4-01 per-read limit.

W4-03 v2 may use smaller internal `IStream::Read` chunks, but the sum of content bytes accepted from the shell source must never exceed 512 KiB.

Do not read a 512 KiB prefix plus an extra probe byte merely to distinguish EOF.

### 5.2 Truthful Complete / Partial

`Complete` may be published only from observed source truth, for example:

- the bounded read encounters EOF/short-read semantics that prove no additional source bytes remain; or
- trustworthy stream metadata observed during the capture phase proves the entire source size is within and fully represented by the captured bytes, with no contradictory read fact.

If 512 KiB is captured and no authoritative fact proves EOF, classify ingress as `Partial`.

Do not infer completeness from extension, display name, a guessed filesystem size or a reconstructed path.

### 5.3 Seek/read behavior

The capture path may use the minimum `IStream` operations needed to read a source prefix on the owning apartment.

Requirements:

- no COM marshal to a detached worker;
- no stream clone retained for deferred work;
- no path reconstruction;
- no hidden temp-file/whole-file staging;
- source failures remain local and bounded;
- if required prefix seek/read semantics are unavailable, fail locally rather than widening authority.

### 5.4 Blocking-stream truth

ADR-0006 does not claim Zen can forcibly terminate every adversarial custom synchronous `IStream::Read` that never returns.

Keep the v1 non-cooperative fixture as a permanent negative regression demonstrating why the shell stream may never enter deferred work. If the fixture needs manual test unblocking, record that truthfully; do not relabel it as a supported hostile-stream guarantee.

Production viability is scoped to real Explorer/prevhost behavior for the deliberately conservative W4-04 matrix.

## 6. HostProvided ownership after capture

Current master already provides one app-side implementation of:

- `HostProvidedConfig`;
- `HostProvidedReadSource`;
- `HostProvidedRegistration`;
- `HostProvidedRegistry`;
- bounded read/revoke/generation/dispose behavior.

Current defaults include:

```text
max_records = 32
max_read_bytes = 1 MiB per read
ttl = 60 s
```

and only `PreviewHostKind::WindowsPreviewHandler` is activated for shell registration.

For v2, the backing source after capture must be a Zen-owned immutable memory source.

Required properties:

- process-local;
- bounded;
- immutable after successful capture;
- pathless;
- no COM/file-handle ownership;
- request/generation scoped;
- revoked/destroyed with request lifecycle.

### 6.1 One implementation, not two authorities

The shell DLL cannot depend on the full Tauri app runtime merely to use HostProvided semantics.

If process topology requires moving/extracting W4-01 HostProvided logic into a narrow pure shared crate, do so with **one shared implementation** consumed by the app and shell artifact. The app-side module may become a thin adapter/re-export if necessary.

Forbidden:

- keeping the current app registry and independently copying a second Windows registry implementation;
- creating a durable broker/service/database to share request state between processes;
- importing PreviewSession/WorkspacePreviewResolver/MaterializationReadGate/Tauri runtime into the shell DLL.

Separate process-local registry instances are expected; duplicated contract/logic authorities are not.

All existing W4-01 HostProvided tests must continue to pass after any extraction.

## 7. Pure Text / Code / Markdown representation seam

The initial v2 feasibility family is Text / Source Code / Markdown because it naturally matches the W3 512 KiB prefix model.

Current `preview_providers.rs` combines two concerns:

1. app provider/source/read ownership;
2. pure bounded representation logic such as UTF-8 decoding, binary rejection, safe Markdown rendering and language presentation hints.

W4-03 v2 must extract only the pure second concern into one reusable kernel.

Conceptual seam:

```text
bounded captured bytes
+ truthful ingress Complete / Partial
+ inert extension/media-type hint
→ safe representation
```

Minimum reusable behavior:

- BOM handling;
- valid UTF-8 decoding;
- partial trailing UTF-8 behavior consistent with W3;
- obvious-binary/control rejection;
- source-code language presentation hint mapping;
- Markdown parsing with current bounded output behavior;
- Markdown sanitization with no scripts, event handlers, resources or navigation;
- truthful Complete / Partial propagation.

### 7.1 Preferred extraction shape

A narrow pure crate/module may be introduced under the native/shared subsystem, for example:

```text
src-tauri/native/preview-representation/
```

or another cohesive location justified by the implementation.

The exact type names are not frozen, but the shared kernel must not own/import:

- `PreviewSession`;
- production Provider Registry composition;
- `PreviewSourceRef` resolution;
- `ManagedFile` / `EphemeralBrowse` authority;
- `MaterializationReadGate`;
- `WorkScheduler`;
- Tauri commands/runtime;
- SQLite/app state;
- COM/HWND lifecycle;
- filesystem path authority.

The existing Zen app provider path must call the same extracted pure logic after its existing authoritative ReadGate read. The shell path calls it only after bounded capture and shell-stream release.

Do not copy `preview_providers.rs` or maintain a Windows-only parser/provider tree.

### 7.2 Spike rendering scope

The v2 native child surface must render a real deterministic representation from captured source data, but W4-03 is not required to implement the final rich W4-04 renderer.

At minimum:

- real Text/source-code representation reaches the child surface;
- Markdown pure-kernel output is exercised and safety-equivalent in deterministic tests;
- unsupported/corrupt input fails locally;
- one child HWND remains bounded by the host rectangle;
- no full Zen UI/WebView is launched.

If adding a heavyweight final renderer is necessary merely to make Markdown visually rich, defer that renderer choice to W4-04 rather than pulling a new runtime into the spike.

## 8. Artifact / crate topology

PR #146 proved that a dedicated Windows-only DLL/class-factory artifact and controlled harness shape is viable. v2 may reuse that **design finding**, but starts from canonical master.

Preferred responsibility layout:

```text
src-tauri/native/
  Cargo.toml                         # narrow native workspace if needed
  host-provided/                     # shared pure HostProvided implementation if extraction is needed
  preview-representation/            # shared pure Text/Code/Markdown representation kernel
  windows-preview-handler/
    Cargo.toml
    src/
      lib.rs                         # DLL exports / class factory
      com.rs                         # COM object/interfaces/ref-count/lifecycle
      capture.rs                     # owner-apartment bounded IStream ingress only
      state.rs                       # generation + Zen-owned post-capture state
      completion.rs                  # owner-STA deferred completion publication
      window.rs                      # child HWND / SetWindow / SetRect / focus
      test_registration.rs           # isolated test-only load/registration seam
  windows-preview-handler-harness/
```

Exact paths/names may vary if review finds a more cohesive layout.

Do not restore a `read_worker.rs` or equivalent whose job is to carry the shell `IStream` into deferred work.

The handler should remain a dedicated Windows DLL / `cdylib`-appropriate native artifact. Do not change the whole `zen_canvas_tauri` crate into a COM server.

Use the narrowest practical Windows bindings and keep Windows-only dependencies out of unrelated cross-platform app code.

## 9. Required COM surface and ABI behavior

Preserve/re-prove the accepted v1 findings where they remain compatible with ADR-0006:

- `DllGetClassObject`;
- `DllCanUnloadNow`;
- class factory / COM ref-count lifetime;
- `IInitializeWithStream`;
- `IPreviewHandler`;
- `IOleWindow`;
- `IObjectWithSite`;
- required focus/accelerator behavior;
- one child HWND;
- `SetWindow` / `SetRect` geometry;
- owner-STA deferred completion publication;
- generation-scoped stale-publication rejection.

Raw ABI behavior must remain exact, including:

- `IOleWindow::GetWindow` failure when no active child exists and success with the current child;
- `QueryFocus` reflecting the current thread focus contract;
- `IPreviewHandlerFrame::TranslateAccelerator` HRESULT propagation, including preserving `S_FALSE` rather than collapsing it into success/failure;
- `DllCanUnloadNow` remains non-unloadable while live COM objects, class-factory locks or detached Zen-owned deferred work can still execute DLL code.

Do not use the old request-long stream worker merely because its completion path already passed these tests.

## 10. Call-order contract

### Initialize

`IInitializeWithStream::Initialize`:

- validates call order;
- retains exactly the shell stream/reference needed for ingress;
- records lightweight generation/request state;
- performs **zero content reads**;
- does not register a request-long stream-backed HostProvided source;
- does not marshal the stream to a worker;
- does not parse/render;
- does not derive a source path;
- does not launch Zen UI.

Duplicate/reinitialize misuse fails safely without leaked old state.

### SetWindow / SetRect

- validate/store host parent + rectangle;
- create/update exactly one child surface when appropriate;
- never create a second top-level Zen window;
- never paint outside the host rectangle;
- resize remains generation/current-window safe.

### DoPreview

`DoPreview` must preserve one-call semantics for the active generation.

Required ordering:

```text
validate generation/call order
→ prepare child surface
→ bounded owner-apartment capture <= 512 KiB
→ create immutable snapshot
→ release every handler-owned shell stream ref
→ assert/establish no shell call in flight
→ create/register memory-backed HostProvided source
→ dispatch only Zen-owned representation/render work
→ owner-STA completion notification
→ revalidate generation/token/child before publication
```

No deferred task may be queued before the source-release phase boundary is complete.

### Unload

`Unload` is a hard cleanup boundary for Zen-owned **post-capture** state:

```text
invalidate generation/publication
→ revoke HostProvided token/generation
→ cancel/detach Zen-owned deferred work
→ destroy/detach child render state
→ release representation/snapshot/site/frame/request state
→ return with no Zen-owned source lock
```

If `Unload` is entered after a successful capture, the original shell stream must already be absent from the deferred state.

Do not call `CoCancelCall` as a correctness requirement for source release. Diagnostic use in isolated negative experiments must not become the product lifecycle mechanism.

## 11. Threading / lock / destruction rules

COM/native calls and object destruction may block or reenter.

Use the repository pattern:

```text
lock → snapshot/claim short current state → unlock
→ COM/native/representation work
lock → revalidate generation/current authority → short publish/update → unlock
```

No coordination mutex may cover:

- `IStream::Seek` / `Read` / `Stat`;
- COM release/destruction that may reenter;
- child-window creation/destruction;
- representation parsing/sanitization;
- long renderer/native work.

Any COM/source/native object that may perform non-trivial destruction must be detached under lock and dropped/released after unlock.

Owner-apartment rules must be explicit in types/state or documented invariants; do not silently send apartment-bound COM interfaces across threads.

## 12. Registration and real-host evidence boundary

W4-03 v2 may add the minimum deterministic registration/unregistration **test seam** needed to load the handler and gather real Explorer/prevhost evidence.

It MUST NOT ship/finalize:

- broad production CLSID/extension association matrix;
- replacement of strong existing system handlers;
- final NSIS registration lifecycle;
- install/upgrade/uninstall product association policy.

Those belong to W4-04/W4-05.

### 12.1 Test registration

Requirements:

- dedicated test CLSID;
- deliberately isolated test extension/content fixture;
- deterministic cleanup on success/failure;
- no registry junk left after tests;
- no broad real-user file associations;
- exact registry mutations recorded when real registration is exercised;
- normal Preview Handler isolation remains enabled; do not set `DisableLowILProcessIsolation` merely to pass the spike.

### 12.2 Real Explorer / prevhost acceptance evidence

Unlike hosted compile evidence, W4-03 v2 acceptance for W4-04 requires an actually executed real Windows host check.

Record at minimum:

- Windows version/build;
- exact handler artifact SHA / source head;
- test CLSID and isolated association scope;
- whether `prevhost.exe`/normal Preview Handler host actually loaded the DLL;
- source fixture identity/size/type;
- capture bytes and Complete/Partial result;
- capture start/end timing;
- shell-stream release observation before deferred rendering;
- source write/rename/move/delete behavior after successful capture;
- useful child-surface publication timing;
- `SetRect`, focus and selection-switch behavior;
- cleanup/unregistration result.

Do not invent a numerical latency threshold that is not frozen in ADR-0006. Preserve raw timing samples/distribution. If real Explorer/prevhost behavior shows synchronous capture is not viable for the conservative initial matrix, **STOP / ADR revisit** rather than weakening evidence or widening a timeout.

If real Explorer/prevhost evidence cannot actually be executed, classify it `UNVERIFIED` and do **not** declare W4-03 v2 complete or unblock W4-04.

## 13. Required deterministic tests

### A. DLL / COM lifecycle

- Windows DLL/class factory loads under controlled harness;
- unsupported CLSID/IID fails correctly;
- COM object reference/lifetime reaches unloadable baseline;
- `DllCanUnloadNow` reflects class/object/deferred-work lifetime;
- invalid call order fails without leaked state;
- repeated create/release reaches steady state.

### B. Initialize zero-read proof

Use an instrumented stream fixture that counts every content read.

Prove:

```text
Initialize returns
content_read_count == 0
```

Also prove no provider/representation task and no HostProvided source read occurs during Initialize.

### C. Bounded capture proof

Instrument shell stream operations and prove:

- accepted source bytes <= 512 KiB/request;
- no +1-byte completeness probe;
- capture stays on the owning apartment;
- no marshal/clone/proxy is retained for deferred work;
- short/EOF source can become Complete;
- exact-cap source without authoritative EOF remains Partial unless trustworthy metadata proves completeness;
- larger source is Partial;
- seek/read failure is local and bounded;
- corrupt/binary content does not crash or launch Zen.

### D. Source-release-before-defer barrier

Use deterministic barriers/observability to prove the strict order:

```text
capture finishes
→ every handler-owned IStream ref released
→ source lock released in controlled file-backed fixture
→ no shell call in flight
→ deferred representation work admitted
```

The test must fail if a worker receives an `IStream`, clone/proxy or shell HANDLE.

For a controlled file-backed stream modeling normal Explorer ownership, prove write/rename/move/delete is no longer blocked by Zen **before** deferred rendering completes and before `Unload` is required.

### E. Memory-backed HostProvided

- register matching `WindowsPreviewHandler` generation over immutable captured bytes;
- reads obey W4-01 per-read maximum independently of the 512 KiB total capture;
- unknown/wrong-host/wrong-generation/revoked token fails closed;
- source is pathless and owns no COM/file handle;
- revoke/unload destroys request memory after detached users finish;
- repeated create/revoke reaches steady state;
- existing W4-01 app HostProvided tests remain PASS.

### F. Shared representation kernel

- app Text provider and shell kernel path produce equivalent decoded text for reviewed fixtures;
- BOM, CRLF, Unicode, empty, partial trailing UTF-8 and obvious-binary fixtures preserve W3 semantics;
- source-code language hint mapping remains equivalent for reviewed extension/media hints;
- Markdown output remains bounded and sanitized;
- hostile Markdown cannot retain script/event/resource/navigation authority;
- the shell artifact does not import production Provider Registry/ReadGate/Tauri/SQLite/app identity merely to call the kernel.

### G. Window / publication / ABI

- one `DoPreview` only for the active request contract;
- `SetWindow`/`SetRect` maintain exactly one child HWND;
- owner-STA completion delivery remains deterministic;
- stale generation cannot repaint after selection change/Unload/new request;
- `GetWindow`, focus and accelerator HRESULT behavior is exact;
- unsupported/corrupt input fails locally;
- no full Zen process is launched.

### H. Unload / steady state

- `Unload` revokes generation/publication first;
- memory-backed HostProvided token is revoked;
- Zen-owned deferred work cannot publish late;
- child HWND/native resources are destroyed;
- no original shell stream is present in steady-state deferred cleanup;
- no `CoCancelCall` dependency exists for original-source release;
- repeated `Initialize → DoPreview → Unload` reaches stable COM/window/memory/resource counts.

### I. Permanent negative regression from v1

Retain a deterministic standard-marshaled non-cooperative stream fixture or equivalent architecture test proving:

- successful COM cancellation request is not treated as universal source-release proof;
- v2 never sends that stream into deferred work;
- test-only manual unblock, if required, occurs only after the negative observation is recorded.

Do not turn the negative fixture into a fake PASS by giving the server a private cancellation callback that production arbitrary streams do not have.

### J. Cross-platform/app regression

- main Zen app continues to build/test on Windows and supported Apple-Silicon macOS lanes;
- production Provider Registry order/capability remains unchanged unless the pure helper extraction intentionally relocates implementation without changing policy;
- WorkspacePreviewResolver remains HostProvided-fail-closed;
- `WindowsQuickPreview` remains inactive;
- `MacQuickLookExtension` remains inactive;
- no Tauri renderer command exposes shell registration/read/path/COM objects;
- no W4-02 macOS behavior is changed by the v2 Track.

## 14. CI / validation

Focused first on Windows:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime native_preview
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime preview_providers
```

For any native workspace introduced by v2, add deterministic Windows-native validation such as:

```bash
cargo fmt --manifest-path src-tauri/native/Cargo.toml -- --check
cargo test --manifest-path src-tauri/native/Cargo.toml
cargo build --release --manifest-path src-tauri/native/windows-preview-handler/Cargo.toml
```

Exact command names may follow the final workspace layout.

Then run all applicable repository gates, including:

```bash
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:check
npm run verify:rust
npm run verify:security
```

A narrow CI workflow/routing update is authorized only if needed to build/test the new Windows-native workspace on exact PR head. It must not weaken, skip or raise existing quality/performance/security thresholds.

Hosted Windows DLL/harness success is not real Explorer Preview Pane proof. Record real-host evidence separately as required in section 12.

## 15. Evidence identity

Final acceptance evidence must bind to one exact reviewed head/tree.

Record:

- execution baseline SHA/tree resolved from the pre-created PR #150 merge branch;
- source head SHA;
- source tree SHA;
- merge-integration tree equivalence status where applicable;
- exact CI run id;
- Windows native jobs/harness result;
- representation-kernel regression result;
- real Explorer/prevhost evidence identity;
- controlled source-lock mutation result;
- resource steady-state result;
- any `UNVERIFIED` or platform-limited evidence without relabeling it PASS.

If production code changes after evidence is collected, the old exact-head evidence is stale unless the repository's accepted tree-equivalence rules prove otherwise.

## 16. Maintainability / architecture review gate

Independent review must answer at minimum:

1. Is the shell `IStream` provably ingress-only and absent before deferred work?
2. Can any hidden Arc/proxy/clone/HANDLE keep source ownership alive after capture?
3. Is HostProvided still one shared contract/implementation rather than an app copy plus shell copy?
4. Does the memory source own only bounded immutable bytes?
5. Did the pure representation extraction preserve one provider representation truth without moving Provider Registry/source/read authority into the shell DLL?
6. Are COM apartment/thread rules explicit and safe?
7. Are locks released before COM/native/destructor/parser work?
8. Does `DllCanUnloadNow` account for all code that can still execute in the DLL?
9. Can stale completion repaint a new generation?
10. Are test registration changes isolated and fully cleaned?
11. Did CI additions remain narrow and non-weakening?
12. Did W4-03 stay a spike rather than pulling W4-04 association/package scope forward?
13. Did the implementation remain on the frozen PR #150 execution baseline rather than silently ingesting later parallel W4-02 work?

Acceptance blockers must be zero before closeout.

## 17. Stop conditions

STOP before merging/declaring W4-03 v2 complete if implementation:

- carries `IStream`, marshaled proxy, clone or shell source HANDLE into deferred work;
- queues deferred work before all handler-owned shell-stream references are released;
- reads more than 512 KiB of source content for a v2 request;
- uses a +1-byte probe or hidden whole-file staging to infer completeness;
- reconstructs/decodes a filesystem path from the shell stream/token;
- uses `IInitializeWithFile` as a convenience escape hatch;
- depends on `CoCancelCall`, thread termination or fixed Unload timeout for original-source release;
- maintains separate app and shell HostProvided implementations that can drift;
- copies/forks a second Text/Code/Markdown provider tree;
- imports PreviewSession, production Provider Registry composition, MaterializationReadGate, WorkScheduler, Tauri runtime, SQLite or app source identity into the shell DLL merely for reuse;
- launches/embeds full Zen UI for Explorer preview;
- disables normal Preview Handler low-integrity/isolation to make the design work;
- creates durable broker/database/path/token authority for shell requests;
- leaves a controlled source file locked by Zen after successful capture;
- cannot prove source-release-before-defer ordering;
- real Explorer/prevhost evidence disproves bounded-capture viability for the conservative matrix;
- broadens production file associations, NSIS registration or W4-04 product scope;
- changes W4-02/macOS product behavior;
- activates W5;
- weakens existing security/performance/governance gates;
- silently rebases/merges later parallel W4-02 or unrelated master changes into the frozen v2 branch without a reviewed integration decision;
- cannot produce real Explorer/prevhost evidence but attempts to mark W4-03 v2 COMPLETE or unblock W4-04.

A Stop Condition result is valid architecture evidence. Do not keep patching a disproven architecture merely to make the PR green.

## 18. Definition of Done

W4-03 v2 is complete only when all of the following are true:

1. implementation branch was pre-created by the governance owner from the exact PR #150 squash-merge commit, that exact baseline SHA/tree is recorded, and no PR #146 implementation history is present;
2. dedicated Windows Preview Handler DLL/class factory and deterministic harness compile/run on Windows;
3. `Initialize` zero-read behavior is proven;
4. owner-apartment ingress capture never exceeds 512 KiB and Complete/Partial remains truthful;
5. every handler-owned shell stream reference/call is gone before deferred work admission;
6. controlled file-backed evidence proves Zen no longer blocks write/rename/move/delete after successful capture, before deferred rendering/Unload;
7. deferred HostProvided source is immutable bounded memory, request/generation scoped and pathless;
8. HostProvided uses one shared implementation/contract and all W4-01 tests remain PASS;
9. Text/Code/Markdown pure representation logic is shared rather than forked, with app equivalence + hostile Markdown safety tests;
10. one-child window, `SetWindow`/`SetRect`, one-DoPreview, owner-STA completion, stale-generation, `GetWindow`, focus and accelerator contracts pass;
11. `Unload` cleans Zen-owned post-capture state without relying on COM cancellation for original-source release;
12. repeated lifecycle reaches stable COM/window/memory/resource baseline;
13. negative non-cooperative COM regression remains truthful and cannot reintroduce request-long stream ownership;
14. real Explorer/prevhost test has actually executed with isolated registration and demonstrates viable capture/source-release/child-publication behavior for representative conservative fixtures;
15. exact-head applicable CI/security/build/regression gates pass without threshold weakening;
16. independent maintainability/architecture review reports blockers = 0;
17. residual evidence is explicitly PASS / FAIL / UNVERIFIED / platform-limited as appropriate;
18. closeout records W4-03 v2 result and only then may governance consider W4-04 authorization.

W4-03 v2 completion does not automatically activate W4-04. W4-04 remains a separate governance/product-integration decision with a deliberately frozen association/content matrix. W4-05+ and W5 remain gated.