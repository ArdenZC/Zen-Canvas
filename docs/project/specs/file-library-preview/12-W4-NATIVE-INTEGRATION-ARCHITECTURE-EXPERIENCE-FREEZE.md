# W4 — Native Integration Architecture / Experience Freeze

Status: **W4-00 frozen contract + ADR-0006 Windows source-model amendment**

Activation baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`

Architecture decisions:

- [`../../DECISIONS/0005-native-preview-host-boundary.md`](../../DECISIONS/0005-native-preview-host-boundary.md)
- [`../../DECISIONS/0006-windows-preview-handler-bounded-capture.md`](../../DECISIONS/0006-windows-preview-handler-bounded-capture.md)

This document freezes user-facing native-integration behavior and the architecture boundaries that W4 production Tracks must preserve. ADR-0006 revises the Windows Preview Handler stream lifetime after W4-03 v1 confirmed Stop Condition #5; macOS and the broader ADR-0005 Host/Adapter boundaries remain unchanged.

## 1. Experience north star

Native integration should make Zen feel more at home on each supported operating system without turning Zen into a Finder/Explorer replacement or creating platform-specific copies of Preview truth.

The user should experience:

- native preview quality where the OS already excels;
- immediate, read-only, low-friction preview behavior;
- truthful unsupported/materialization/permission states;
- no surprising full-app launch from shell preview surfaces;
- no file remaining locked after preview closes;
- platform-appropriate keyboard/focus/display behavior;
- installation and removal that leaves no broken shell registrations.

## 2. Product surfaces frozen for W4

### 2.1 Existing Zen Floating / Pinned Preview

Unchanged from W3.

W4 does not redesign Space/toggle behavior, Floating Preview chrome, Pinned Preview or sibling navigation merely because native hosts are added.

### 2.2 macOS native surface

Initial W4 macOS surface: **native Quick Look-backed preview inside Zen** for strong-native standard formats where duplicating a renderer is lower value than using the platform.

Expected user behavior:

1. user invokes the existing Zen Quick Preview from Library/Browse;
2. Preview Core determines that no stronger Zen built-in representation owns the selected strong-native format and that native macOS capability is eligible;
3. Zen acquires a request/sourceVersion-bound native-access snapshot through the existing authoritative read boundary;
4. the Zen host displays a native-backed representation/view with minimal host chrome;
5. switching source cancels/replaces the prior native request latest-wins;
6. closing Preview releases native view/request/staging resources;
7. failure falls back to the existing Preview failure/Metadata truth where applicable.

The user should not need a separate “Open in Quick Look” mode merely to use the stronger native representation inside the normal Zen Preview flow.

### 2.3 Finder Quick Look Preview Extension

**Not part of initial W4 production scope.**

It becomes eligible only if:

- Zen owns a custom UTI/document format; or
- a reviewed system-preview gap provides material user value and does not require broadly overriding Apple-owned standard-format behavior.

A future extension must receive its own file-type ownership and process/sandbox/signing review before activation.

### 2.4 Windows Explorer Preview Handler

W4 adds a real Explorer Preview Pane integration for an evidence-backed supported-content matrix.

Expected user behavior:

1. user selects a supported file in Explorer and enables the normal Preview Pane;
2. Explorer/preview host initializes Zen's handler using `IInitializeWithStream` where available;
3. `Initialize` stores only lightweight request/stream state and performs no content read;
4. `DoPreview` performs one strictly bounded ingress capture, releases every handler-owned shell stream reference, then begins deferred representation/render work from Zen-owned immutable memory;
5. the handler presents a lightweight read-only preview inside the host-provided rectangle;
6. resize/focus/keyboard behavior follows Explorer conventions;
7. switching selection or closing the pane causes deterministic `Unload` cleanup of Zen-owned request/render state;
8. the source is not left locked by Zen after successful capture/close;
9. unsupported/corrupt/blocked input fails locally without launching full Zen UI or crashing Explorer.

Zen must not add its own title bar, sidebar, toolbar or Floating Preview chrome inside Explorer Preview Pane.

The product contract does not claim that Zen can forcibly terminate every possible adversarial custom `IStream` implementation whose synchronous `Read` never returns. W4-04 association eligibility is instead grounded in real Explorer/prevhost evidence for the deliberately supported matrix.

### 2.5 WindowsQuickPreview

`PreviewHostKind::WindowsQuickPreview` remains a reserved contract only.

No global hotkey/overlay/Explorer-adjacent second preview product is authorized by W4-00. Any future activation must prove a distinct user need beyond the existing Zen Floating Preview and Explorer Preview Handler.

## 3. Provider/native selection freeze

Provider choice remains backend/capability driven.

The selection model is conceptually:

```text
source/request truth
× host capability
× Zen provider registry
× native renderer capability
× eligibility/materialization state
→ representation or truthful failure/fallback
```

Rules:

- no extension-only guessing in UI/native host;
- existing W3 providers keep their reviewed priority/ownership;
- native rendering may cover strong-native formats W3 intentionally deferred;
- a native host may not silently override a stronger/safe Zen representation without a reviewed matrix rule;
- native failure does not grant a second attempt that bypasses permission/materialization/identity truth.

For Windows shell reuse, the approved extraction target is pure `bounded bytes + completeness + inert metadata hints → safe representation` logic. PreviewSession, production Provider Registry composition, MaterializationReadGate, WorkScheduler and app source identity do not move into the COM DLL.

## 4. Strong-native format strategy

### macOS initial evaluation matrix

| Family | Initial W4 stance |
|---|---|
| Text/Code/Markdown | keep W3 Zen provider |
| JSON/YAML/XML | keep W3 Zen provider |
| CSV/TSV | keep W3 Zen provider |
| Image PNG/JPEG | keep W3 Zen provider unless later evidence shows a native benefit |
| Folder | keep W3 Zen provider |
| ZIP | keep W3 Zen provider |
| PDF | prefer native Quick Look-backed evaluation |
| Office | prefer native Quick Look-backed evaluation where system support exists |
| iWork | prefer native Quick Look-backed evaluation where system support exists |
| Audio/Video | evaluate native Quick Look-backed representation only within reviewed staging/performance bounds; no duplicate media suite by default |
| Unsupported/custom | truthful fallback; Finder extension only after separate ownership review |

### Windows initial evaluation matrix

W4-03 v2 does not freeze production associations. It proves the bounded-capture architecture using representation families that naturally fit W3's bounded-prefix semantics.

Initial spike emphasis:

| Family | W4-03 v2 stance |
|---|---|
| Text / source code / Markdown | primary bounded-capture feasibility set |
| Structured/table formats | evaluate only after the shared representation seam is proven; no duplicated parser tree |
| Image | not required for v2 architecture proof |
| PDF / Office / media | not initial v2 targets; prefer existing stronger system/native handlers unless W4-04 evidence shows material Zen value |
| Folder / ZIP | not part of shell stream v2 proof |

W4-04 freezes exact associations only after real Windows evaluation.

Rules:

- do not register Zen for every extension it can parse;
- prefer file types where Windows lacks adequate preview or Zen materially improves safety/quality;
- do not seize system associations merely for parity with macOS;
- script/macro-capable formats remain inert/read-only;
- initial association breadth is intentionally conservative;
- formats that need unbounded, whole-file or request-long source ownership are not automatically eligible for the first Windows matrix.

## 5. Native source / lifecycle freeze

W4 has **two distinct source-ownership lifecycles**. They may share low-level native resource helpers, but they must not be collapsed into one token model.

### 5.1 Zen-owned in-app native-backed Preview

This is the initial W4-02 macOS path.

The source remains the existing W3 `ManagedFile` / `EphemeralBrowse` authority and the host remains `ZenFloating` / `ZenPinned`:

```text
existing Zen Preview request
→ ManagedFile / EphemeralBrowse source + sourceVersion
→ existing PreviewSession / provider selection
→ acquire Native Preview Access lease through authoritative Read Gate
→ complete private staging snapshot + final sourceVersion revalidation
→ NativeOpaque representation bound to ZenFloating / ZenPinned
→ native presentation adapter/view opens staged snapshot
→ switch/cancel/dispose through existing Preview lifecycle
→ revoke native representation/access token/resources
```

Hard requirements:

- do **not** create a `HostProvided` token for this path merely because the final renderer is native;
- do **not** reclassify the host as `MacQuickLookExtension`;
- the `NativeOpaque` token, if backed by a native registry, is representation-scoped and bound to the matching host plus current Preview session/request/sourceVersion;
- Quick Look must not receive the original managed/provider-backed source URL after only a preflight eligibility/identity check;
- stale sourceVersion/request publication fails closed through existing Preview authority;
- source switch/cancel/dispose revokes native representation/access/view/staging resources;
- no native presentation token becomes durable identity or a renderer-decodable filesystem path.

### 5.2 OS/shell-owned HostProvided Preview

This lifecycle applies only when the operating system/native shell owns the incoming request/source lifetime—for W4, concretely the Windows Explorer Preview Handler; it also applies to a future Finder Preview Extension only if that extension is separately authorized.

For Windows Preview Handler, ADR-0006 freezes a two-phase lifecycle:

```text
OS/shell creates native request and supplies IStream
→ Initialize retains the shell stream only; no content read
→ DoPreview performs one bounded ingress capture
→ bytes copied into Zen-owned immutable memory
→ original handler-owned shell IStream references released
→ register/use opaque HostProvided hostToken over captured memory
→ create/start shared pure representation/native rendering work
→ publish only while hostToken/request/generation remain valid
→ cancel/unload/source replacement
→ revoke hostToken
→ release captured memory/native renderer/assets
```

Hard requirements:

- token reuse after revoke fails;
- no renderer component can decode `hostToken` into a path;
- the HostProvided registry is bounded and non-durable;
- the shell stream is not retained into deferred representation/render work;
- no deferred worker owns a shell stream/file HANDLE;
- Windows v2 HostProvided is backed by an immutable bounded memory source after ingress;
- shell request cancellation/unload revokes the request before Zen-owned resource cleanup completes;
- crash/timeout cleanup has a bounded owner for Zen-owned post-capture state;
- process-local native resources do not become app-wide durable truth;
- `Unload` correctness must not depend on `CoCancelCall` terminating the original source.

### 5.3 Shared-helper rule

The two lifecycles may share:

- native representation/resource cleanup helpers;
- pure provider/representation logic where process topology permits;
- bounded native renderer admission/resource accounting;
- cancellation primitives for resources Zen actually controls.

They must **not** share by converting Zen-owned Managed/Ephemeral sources into `HostProvided` requests. Source ownership remains truthful at the boundary that created the request.

Windows may share bytes-to-representation logic after bounded capture; it must not import app source/read/session authority into the shell DLL.

## 6. macOS architecture freeze

### 6.1 Initial topology

The initial macOS design should prefer an app-owned native adapter/view integrated into the existing Zen Preview experience.

It may use an AppKit/Quick Look native view/controller through a reviewed Rust/Objective-C bridge, but generic React code does not receive a file URL.

### 6.2 Authoritative native-access boundary

A prior eligibility/path/identity check is **not** durable authorization for Quick Look's later asynchronous open.

The initial W4-02 mechanism is therefore a request/sourceVersion-bound **Native Preview Access lease** that produces a complete Zen-owned ephemeral staging snapshot before publishing the native representation.

Required sequence:

```text
source + expected sourceVersion
→ ensure Preview request is current
→ fresh authoritative eligibility/source resolve
→ identity-checked authoritative open/read
→ write complete private staging snapshot
→ fresh final sourceVersion/identity revalidation
→ publish NativeOpaque only if still current
→ native bridge receives staging URL
```

Rules:

- no original managed/provider-backed source URL is handed to Quick Look in the initial architecture;
- staging bytes must come from an authoritative identity-checked open/read path; `copy(originalPath, tempPath)` after an earlier check is not an acceptable substitute;
- provider/cloud states `MaterializationRequired`, `Downloading`, `MetadataOnly`, permission failure, unavailable/unknown or identity-changed must remain truthful and must never be converted into native-framework hydration;
- staging must be complete; no truncated/partial native file is published to Quick Look;
- sourceVersion/freshness is checked again after staging and immediately before publication; drift deletes/discards the staged artifact and publishes no native representation;
- the staging namespace is Zen-owned, process-local/private, non-durable and unrelated to managed Library identity;
- staged filenames may preserve only a backend-derived safe leaf/extension needed for native type recognition; the source path never crosses the generic renderer wire or appears in the opaque token;
- W4-02 freezes explicit per-request/per-process staging byte, disk, deadline and concurrency budgets before activating formats; an over-budget source falls back truthfully rather than bypassing the Read Gate;
- the staging lease is bound to Preview session/request/sourceVersion/host and remains alive only while the native view may open/use it;
- source switch, cancel, dispose, native failure and bounded expiry revoke the lease and cleanup its staging artifact;
- a bounded stale-staging startup cleanup policy is required if crash residue is possible.

A later platform-native direct-access mechanism may replace staging only after architecture review proves it performs equivalent identity-bound authorization at the framework's actual open boundary and cannot trigger implicit hydration. A checked-once original URL is explicitly insufficient.

### 6.3 View lifetime

The native view/controller lifetime must be tied to the Preview host/session and survive only as long as needed for the current request.

Source switching must not leave an AppKit/Quick Look view retaining the old native-access lease or staged file.

The native view must release its staging lease before cleanup is considered complete.

### 6.4 Extension boundary

If a Finder Quick Look Preview Extension is later approved, do not assume the Tauri WebView/main process is available. Freeze its extension/XPC/app-group/sandbox/signing topology before implementation.

A future Finder extension is an OS/shell-owned source path and is not automatically permitted to reuse the in-app staging contract without a separate review of extension sandbox/source ownership.

## 7. Windows architecture freeze

### 7.1 Shell topology

Default target: a Preview Handler compatible with the normal system preview host model.

Prefer an in-process COM server object that the shell hosts out-of-process through the standard preview-host architecture, preserving normal isolation.

PR #146 is retained only as v1 spike provenance. W4-03 v2 starts from canonical master after the ADR-0006 governance amendment and must not use the v1 request-long shell-stream architecture as its production base.

### 7.2 Initialization

Prefer `IInitializeWithStream`.

`Initialize` captures lightweight request/source state and retains the `IStream` reference only. It performs **zero content reads**, does not marshal the stream to a worker, and does not begin provider/render work.

Path-based initialization is not the default fallback merely for implementation convenience.

A shell-supplied `IStream` is the authoritative ingress source. The Preview Handler must not turn it back into a guessed/original filesystem path.

### 7.3 Bounded ingress capture

`DoPreview` owns source ingestion.

For W4-03 v2:

- capture occurs on the handler's owning apartment;
- the spike reads at most **512 KiB** from the source;
- capture produces an immutable Zen-owned memory snapshot;
- Complete/Partial must reflect observed stream truth and must not invent completeness from extension or guessed size;
- no hidden whole-file copy/staging is permitted;
- every handler-owned shell `IStream` reference is released before deferred provider/representation/render work is admitted;
- after this phase, no worker/renderer may own an `IStream`, shell file HANDLE or decoded source path.

The 512 KiB ceiling is a W4-03 v2 spike contract aligned with existing W3 Text/Code/Markdown prefix semantics. W4-04 may revise the total/per-format capture ceiling only through reviewed real-host evidence plus explicit memory/latency/resource budgeting. Every HostProvided read remains subject to the W4-01 per-read `max_read_bytes` ceiling; that per-read value does not itself define the total capture budget. No future change may introduce a second read authority or whole-file hidden staging without separate architecture review.

### 7.4 Deferred representation/rendering

After successful ingress capture:

```text
Zen-owned immutable bounded bytes
→ memory-backed HostProvided request source
→ pure shared bytes-to-representation logic where applicable
→ native child presentation
```

Deferred work may own:

- immutable captured bytes;
- generation/token/request state;
- pure representation state;
- native child/render resources.

Deferred work may not own:

- the original shell `IStream` or proxy/clone;
- shell source file HANDLE;
- renderer-decodable raw filesystem path;
- PreviewSession / app Provider Registry composition / MaterializationReadGate / WorkScheduler authority merely for code reuse.

### 7.5 Window lifecycle

The handler obeys host geometry through `SetWindow` / `SetRect` and exposes only the minimal child rendering surface needed for the preview.

No full Zen top-level window is embedded or launched as the final Preview Handler architecture.

The accepted v1 one-`DoPreview` owner-STA publication, stale-generation suppression and single-child lifecycle may be reused only after they are revalidated under the v2 source model.

### 7.6 Input/focus

The handler follows shell focus/accelerator contracts. W4 QA must verify keyboard traversal and host focus rather than reusing Zen Floating modal rules.

Accepted raw ABI findings from the v1 spike may be reused after v2 regression coverage proves they remain unchanged.

### 7.7 Unload

`Unload` remains a hard cleanup boundary for resources Zen owns in the accepted post-capture phase:

- invalidate publication/generation authority;
- revoke HostProvided token;
- cancel/release deferred Zen-owned provider/representation work;
- destroy native rendering surface;
- release captured memory/assets/site/frame/request state;
- return to the resource baseline.

The original shell `IStream` must already be absent before deferred work starts, so `Unload` MUST NOT rely on `CoCancelCall`, worker termination or an arbitrary timeout to release the original source.

A test that only drops the COM object without executing `Unload` remains insufficient for post-capture resource cleanup.

### 7.8 Stream-support truth

W4 does not claim that Windows gives Zen a universal mechanism for forcing every adversarial/non-cooperative synchronous `IStream::Read` to return.

The v1 non-cooperative fixture remains a negative regression proving that request-long asynchronous shell-stream ownership is forbidden.

Production association acceptance is instead scoped to real Explorer/preview-host streams for the reviewed W4-04 matrix. Before an association is enabled, real-host evidence must prove:

- bounded ingress capture completes within the reviewed responsiveness budget on representative fixtures;
- the handler releases its shell-stream ownership before deferred rendering;
- the source is not left write/rename/move/delete locked by Zen after capture;
- normal Preview Handler isolation remains compatible;
- unsupported/capture-failure input fails locally and truthfully.

## 8. Failure presentation freeze

Use existing Preview failure concepts whenever Preview Core participates.

Native-specific diagnostics may distinguish internal causes but user-facing behavior should map to bounded states such as:

- unsupported;
- source unavailable;
- permission denied;
- materialization required/downloading;
- identity changed;
- corrupt/provider failure;
- timeout;
- native staging/capture budget exceeded/provider fallback;
- host cancelled/unloaded.

Do not expose raw HRESULT/NSError strings as the normal UX.

Explorer host failures should fail the handler locally without opening the main Zen app just to show an error dialog.

## 9. Security freeze

Native preview is always read-only.

Prohibited:

- scripts/macros;
- executable document actions;
- hidden remote-resource loading;
- implicit archive extraction;
- implicit cloud hydration;
- direct native opening of an original managed/provider-backed source after only a prior eligibility check;
- renderer raw-path authority;
- arbitrary plugin DLL/dylib loading;
- persistent shell/source-path history created only for Preview;
- Windows preview-host isolation opt-out by default;
- request-long shell `IStream`/file-HANDLE ownership in deferred Windows rendering;
- unsafe worker/thread termination as a source-release mechanism.

## 10. Accessibility / display freeze

### macOS

- native keyboard/focus follows the host's semantics;
- VoiceOver evidence only when actually executed;
- Retina and multiple display scale transitions are part of W4-06.

### Windows

- Explorer focus/accelerators respected;
- Narrator evidence only when actually executed;
- 100%/125%/150%+ DPI and resize behavior included where test environment permits;
- child HWND does not overflow or paint outside host rectangle.

## 11. Performance / resource freeze

Do not freeze artificial absolute final thresholds before native baselines exist.

Required qualitative contract:

- host appears promptly;
- local supported native representation targets approximately <=1 s first useful display where reasonable, including staging/capture cost;
- macOS staging work is bounded and cancellation-aware and does not silently bypass its budget to hit latency targets;
- Windows W4-03 v2 ingress capture is capped at 512 KiB and must be measured under real Explorer/prevhost before W4-04 production association;
- Windows deferred work begins only after shell-stream release;
- no unnecessary full app startup for Explorer handler;
- cancellation/unload is prompt for Zen-owned post-capture resources;
- repeated cycles are steady-state;
- original source is not locked by Zen after successful Windows capture/close or macOS native-view cleanup;
- staging/captured-memory artifacts are cleaned after their owning native view/request releases them;
- bounded streams/handles/assets/staging/capture/process-local work;
- native preview does not regress W3/File Library performance gates.

W4-06 freezes/accepts measured thresholds only after representative real fixtures exist.

## 12. Packaging / installation experience freeze

### Windows

Current per-machine NSIS remains the default product installer.

Preview Handler registration must be transactional enough that failed native registration does not leave a “successful” partially configured install. Upgrade/uninstall must remove obsolete CLSID/association state.

Do not replace the current installer solely for preview registration convenience.

### macOS

Current DMG/hardened-runtime baseline remains.

Any nested native component must be embedded and signed in the correct bundle order. An eventual Finder extension must not be treated as a loose copied binary.

Zen-owned native staging is runtime-ephemeral content, not an installed resource and not part of bundle signing.

## 13. Explicit non-goals

W4-00 / ADR-0006 do not authorize:

- Finder Sync features;
- universal custom PDF/Office/media renderer;
- OCR/AI/RAG;
- plugins;
- Linux;
- Intel macOS;
- global Windows Space-preview overlay;
- editor/annotation controls inside native Preview;
- shell file mutation actions;
- native source access that bypasses the authoritative actual-open/read boundary;
- request-long asynchronous shell-IStream ownership in Windows deferred work;
- release publication.

## 14. Acceptance truth

W4 is successful when native integration feels native, stays bounded and preserves one Preview/read authority—not when macOS and Windows have the same number of features.

For Windows specifically, W4-03 v2 succeeds only if the shell source lifetime ends at the bounded capture boundary before deferred work, real Explorer/prevhost evidence supports the conservative matrix, and no second provider/read/source authority is created.
