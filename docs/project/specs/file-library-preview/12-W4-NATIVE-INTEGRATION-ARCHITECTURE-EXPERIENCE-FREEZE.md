# W4 — Native Integration Architecture / Experience Freeze

Status: **W4-00 frozen contract**

Activation baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`

This document freezes user-facing native-integration behavior and the architecture boundaries that W4 production Tracks must preserve.

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
3. the Zen host displays a native-backed representation/view with minimal host chrome;
4. switching source cancels/replaces the prior native request latest-wins;
5. closing Preview releases native view/request/file resources;
6. failure falls back to the existing Preview failure/Metadata truth where applicable.

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
2. Explorer/preview host initializes Zen's handler using the approved shell contract, preferably a stream;
3. the handler presents a lightweight read-only preview inside the host-provided rectangle;
4. resize/focus/keyboard behavior follows Explorer conventions;
5. switching selection or closing the pane causes deterministic `Unload` cleanup;
6. the source is not left locked;
7. unsupported/corrupt/blocked input fails locally without launching full Zen UI or crashing Explorer.

Zen must not add its own title bar, sidebar, toolbar or Floating Preview chrome inside Explorer Preview Pane.

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
| Audio/Video | evaluate native Quick Look-backed representation; no duplicate media suite by default |
| Unsupported/custom | truthful fallback; Finder extension only after separate ownership review |

### Windows initial evaluation matrix

W4-03/W4-04 must freeze exact associations after real Windows evaluation.

Rules:

- do not register Zen for every extension it can parse;
- prefer file types where Windows lacks adequate preview or Zen materially improves safety/quality;
- do not seize system associations merely for parity with macOS;
- script/macro-capable formats remain inert/read-only;
- initial association breadth is intentionally conservative.

## 5. HostProvided lifecycle freeze

The required native request lifecycle is:

```text
create native request ownership
→ register opaque hostToken
→ bind verified request source / stream / file descriptor
→ create/start Preview/native representation
→ publish only while request + source version/current token remain valid
→ cancel/unload/switch
→ revoke token
→ release stream/file/native renderer/assets
```

Hard requirements:

- token reuse after revoke fails;
- source switch invalidates old publication;
- no renderer component can decode token into a path;
- token registry is bounded;
- no durable token persistence;
- crash/timeout cleanup has a bounded owner;
- process-local native resources do not become app-wide durable truth.

## 6. macOS architecture freeze

### 6.1 Initial topology

The initial macOS design should prefer an app-owned native adapter/view integrated into the existing Zen Preview experience.

It may use an AppKit/Quick Look native view/controller through a reviewed Rust/Objective-C bridge, but generic React code does not receive a file URL.

### 6.2 Source boundary

A local file URL may exist only inside backend/native code after:

- source resolution;
- eligibility/materialization check;
- package/symlink/provider policy;
- identity/freshness verification appropriate to the source.

No new persistent staging path is allowed merely to feed Quick Look unless the format/OS API requires bounded staging and the lifecycle is explicitly reviewed.

### 6.3 View lifetime

The native view/controller lifetime must be tied to the Preview host/session and survive only as long as needed for the current request.

Source switching must not leave an AppKit/Quick Look view retaining the old file/request.

### 6.4 Extension boundary

If a Finder Preview Extension is later approved, do not assume the Tauri WebView/main process is available. Freeze its extension/XPC/app-group/sandbox/signing topology before implementation.

## 7. Windows architecture freeze

### 7.1 Shell topology

Default target: a Preview Handler compatible with the normal system preview host model.

Prefer an in-process COM server object that the shell hosts out-of-process through the standard preview-host architecture, preserving normal isolation.

### 7.2 Initialization

Prefer `IInitializeWithStream`.

`Initialize` captures lightweight request/source state only. Expensive parsing/rendering belongs in `DoPreview` or the bounded work it starts.

Path-based initialization is not the default fallback merely for implementation convenience.

### 7.3 Window lifecycle

The handler obeys host geometry through `SetWindow` / `SetRect` and exposes only the minimal child rendering surface needed for the preview.

No full Zen top-level window is embedded or launched as the final Preview Handler architecture.

### 7.4 Input/focus

The handler follows shell focus/accelerator contracts. W4 QA must verify keyboard traversal and host focus rather than reusing Zen Floating modal rules.

### 7.5 Unload

`Unload` is a hard cleanup boundary:

- cancel pending work;
- revoke host token;
- release stream/file resources;
- destroy native rendering surface;
- release assets/provider request state;
- leave the source rename/move/delete-capable where the platform permits.

A test that only drops the COM object without proving source unlock is insufficient.

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
- renderer raw-path authority;
- arbitrary plugin DLL/dylib loading;
- persistent shell-path history created only for Preview;
- Windows preview-host isolation opt-out by default.

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

Do not freeze artificial absolute thresholds before native baselines exist.

Required qualitative contract:

- host appears promptly;
- local supported native representation targets approximately <=1 s first useful display where reasonable;
- no unnecessary full app startup for Explorer handler;
- cancellation/unload is prompt;
- repeated cycles are steady-state;
- source is not locked after close/unload;
- bounded streams/handles/assets/process-local work;
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

## 13. Explicit non-goals

W4-00 does not authorize:

- Finder Sync features;
- universal custom PDF/Office/media renderer;
- OCR/AI/RAG;
- plugins;
- Linux;
- Intel macOS;
- global Windows Space-preview overlay;
- editor/annotation controls inside native Preview;
- shell file mutation actions;
- release publication.

## 14. Acceptance truth

W4 is successful when native integration feels native, stays bounded and preserves one Preview authority—not when macOS and Windows have the same number of features.