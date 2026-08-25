# W4-02 — macOS Native Quick Look Host / Strong-native Format Integration — Codex / Agent Brief

Status: **ACTIVE implementation Track on branch**

Baseline: `master@3cd96a798c645ef4a845c686cde9971c7d321168` (W4-01 governance closeout / PR #144)

W4-01 production baseline: `master@02e88db7cf4287e0d68792b3960da503b70d6c56` (PR #143)

Branch: `feat/w4-macos-native-quick-look`

Parallel sibling Track: W4-03 on `feat/w4-windows-preview-handler-spike`. W4-02 must not absorb Windows Preview Handler scope and does not wait for W4-03.

W4-02 activates the already-reviewed Zen-owned Native Preview Access seam for **native Quick Look-backed preview inside the existing Zen Floating/Pinned Preview experience on Apple Silicon macOS 13+**. It does not build a Finder Quick Look Preview Extension, does not create a second Preview product, and does not bypass W4-01 staging/read authority.

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

Inspect current production owners directly before editing:

- `src-tauri/src/file_workspace/preview.rs`
- `src-tauri/src/file_workspace/preview_policy.rs`
- `src-tauri/src/file_workspace/preview_providers.rs`
- `src-tauri/src/file_workspace/native_preview/access.rs`
- `src-tauri/src/file_workspace/native_preview/mod.rs`
- `src-tauri/src/file_workspace/integration/preview.rs`
- `src-tauri/src/file_workspace/integration/runtime.rs`
- `src-tauri/src/file_workspace/integration/types.rs`
- `src-tauri/src/file_workspace/integration/commands.rs`
- `src-tauri/src/platform/macos/quick_look.rs`
- `src-tauri/src/platform/macos/mod.rs`
- `src-tauri/src/runtime_capabilities.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/build.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/*.json`
- `src/api/fileWorkspacePreviewWire.ts`
- `src/types/fileWorkspace.ts`
- the shared Preview renderer/components that currently handle `PreviewRepresentation`.

## 1. Entry truth

W4-01 is **COMPLETE / CLOSED**. Canonical master is:

`master@3cd96a798c645ef4a845c686cde9971c7d321168`.

W4-02 and W4-03 are both authorized and may proceed in parallel. W4-04 remains gated behind W4-03; W4-05+ remain downstream-gated; W5 remains **NOT AUTHORIZED / NOT ACTIVE**.

W4-01 already proved the security-sensitive byte/staging lifecycle. W4-02 MUST consume that contract rather than reimplement it:

```text
Managed/Ephemeral source + sourceVersion
→ existing PreviewSession / Provider Registry
→ W4-01 Native Preview Access stage()
→ authoritative ReadGate/open + complete private copy
→ final sourceVersion/current-authority revalidation
→ opaque host/request/sourceVersion-bound access token
→ macOS native presentation resolves token backend-side
```

Hard W4-01 facts to preserve:

- Native Preview Access defaults are bounded (`8` records, `256 MiB` per file, `512 MiB` total, `20 s` acquisition, `60 s` TTL, `512 KiB` copy chunks).
- Native staging already reuses global `WorkScheduler` NativePreview/I/O/open-handle admission.
- token resolution is crate-private/backend-native only and returns a staged path only inside backend/native code.
- cancel/dispose/source-switch/runtime dispose already revoke Native Preview Access.
- Managed/Ephemeral stays Managed/Ephemeral; this path must never become `HostProvided`.

Do not enlarge W4-01 limits merely to make a format work. If real fixtures do not fit a safe/practical activation profile, leave that family deferred or truthfully unsupported.

## 2. Current production audit / constraints

### 2.1 Existing Quick Look module is thumbnail authority, not full Preview host

`src-tauri/src/platform/macos/quick_look.rs` currently owns the bounded Quick Look **thumbnail** adapter and `MacThumbnailService`. Its own header says `QLPreviewPanel` was deliberately deferred because a full Preview needs stable AppKit view lifetime. `PREVIEW_AVAILABLE` is currently false.

W4-02 MUST NOT turn this already substantial thumbnail module into a second independent full-Preview lifecycle owner.

Preferred shape is a separate cohesive macOS native-preview subsystem, for example:

```text
src-tauri/src/platform/macos/native_preview/
  mod.rs          # narrow stable platform API
  view.rs         # QLPreviewView/AppKit presentation object + geometry
  lifecycle.rs    # token/view/request ownership if non-trivial
  tests/          # behavior-oriented tests when substantial
```

Exact names may vary after direct code inspection, but Quick Look thumbnail cache/job ownership and full native Preview view ownership remain separate.

### 2.2 Existing Preview wire is already sufficient for opaque identity

`PreviewRepresentation::NativeOpaque { host, token }` already exists and Preview Core enforces exact host matching.

The TypeScript wire already parses `native_opaque`, validates the host, bounds the token and rejects path separators.

Do not add a replacement representation family just to carry a path/view id.

### 2.3 Existing W3 providers retain ownership

W4-02 does not replace these reviewed provider families:

- Text/Code/Markdown;
- JSON/YAML/XML;
- CSV/TSV;
- PNG/JPEG Image;
- Folder;
- ZIP.

Native Preview is for **strong-native families W3 intentionally deferred**, initially PDF, then Office/iWork where the real macOS runtime has usable Quick Look coverage, and media only if bounded staging/performance evidence supports it.

### 2.4 No existing full native-view seam

The repository currently has no established `QLPreviewView`/`NSView` Preview host implementation. W4-02 must therefore make native view lifetime explicit rather than hiding it inside generic frontend code.

If the current Tauri/objc2 versions cannot provide a stable, reviewable native-view lifetime tied to the existing Zen Preview host, STOP and return an architecture blocker. Do **not** substitute any of the following merely to claim completion:

- `/usr/bin/qlmanage -p` as the product Preview host;
- `open`/Finder/system app launch;
- a checked-once original source URL;
- returning the staged path to React;
- a separate user-facing Quick Look mode/window that bypasses the frozen Zen Preview flow;
- activating a Finder Quick Look extension.

## 3. Product behavior freeze

The user continues to invoke normal Zen Floating/Pinned Quick Preview. Native content is a representation inside that same experience.

Required behavior:

1. existing Zen Preview opens shell-first as today;
2. existing W3 providers keep first ownership of their supported families;
3. an eligible strong-native file may select the macOS native provider;
4. the provider acquires a W4-01 Native Preview Access token only while the exact Preview request is current;
5. the native AppKit/Quick Look adapter resolves that token backend-side and opens only the private staged snapshot;
6. the native view is attached/presented inside the existing Zen host bounds with minimal content chrome;
7. source switch is latest-wins and releases the old native view/access capability;
8. close/cancel/dispose detaches/releases native view state before staging cleanup is considered complete;
9. native failure maps to existing Preview fallback/terminal truth and never triggers hidden hydration/network/script behavior.

W4-02 does not redesign Space/Esc, Floating chrome, Pinned behavior, sibling navigation or Context ownership.

## 4. Provider / selection contract

Add the smallest coherent provider/selection adapter for macOS native strong-format preview. Prefer a dedicated provider module instead of expanding `preview_providers.rs` into a mixed generic/native mega-file.

Conceptual descriptor requirements:

- supported hosts: `ZenFloating`, `ZenPinned` only;
- platform capability: Apple Silicon macOS 13+ runtime with the native view bridge actually available;
- source: Managed/Ephemeral only;
- local/read eligibility remains truthful through W4-01 stage acquisition;
- priority must preserve all existing stronger W3 provider ownership.

### Initial activation matrix

Minimum W4-02 success requires real PDF coverage on supported macOS unless the framework itself proves unavailable and the Track is explicitly blocked rather than falsely completed.

Evaluate:

1. **PDF — required evaluation / preferred first activation**;
2. Office — activate only where genuine local fixtures + system Quick Look prove usable;
3. iWork — activate only where genuine local fixtures + system Quick Look prove usable;
4. audio/video/media — optional/deferred unless staging and useful-render behavior remain practical.

Do not claim a family because its extension exists. Probe may use bounded metadata hints for routing, but actual native capability/load remains runtime-truthful and provider failure must fall back safely.

Record any family as `DEFERRED` / `UNVERIFIED` rather than widening W4-01 byte/time limits or inventing unsafe parity.

## 5. Native Preview Access consumer contract

W4-02 should add a narrow backend-only consumer seam rather than expose `NativePreviewAccessRegistry` directly throughout providers/UI.

A suitable internal contract should be able to:

- stage the current exact Preview tuple;
- produce an opaque `NativeOpaque` token bound to the exact Zen host;
- resolve the token only inside the macOS native adapter for presentation;
- release/revoke representation/access ownership deterministically.

If `PreviewProviderEnvironmentHandle` needs a new native-access adapter, keep it narrow and backend-only. It may return opaque tokens; it must not return a filesystem path to provider-generic or renderer code.

Do not:

- make `WorkspacePreviewResolver` return a source path to the provider;
- issue a generic renderer read/path lease;
- stage via `MacThumbnailService`;
- call `fs::copy(original, stage)` after a preflight;
- create a second native scheduler/semaphore.

## 6. Native AppKit / Quick Look view contract

Preferred product topology is a stable `QLPreviewView`-style native view/controller owned by a dedicated macOS adapter and tied to the existing Zen Preview request/session.

The adapter owns:

- native view/controller creation;
- backend-only token → staged URL resolution;
- setting/replacing the staged preview item;
- native subview attachment/detachment;
- geometry updates if the WebView host region changes;
- view/request cancellation/release;
- current-token/current-request validation before changing visible native content.

It does **not** own:

- provider selection;
- source identity;
- ReadGate eligibility;
- staging lifetime authority;
- Zen keyboard command ownership;
- durable persistence.

### View lifetime ordering

Required release order for source switch/cancel/dispose/native failure:

```text
invalidate current native presentation authority
→ stop/detach/release QLPreviewView/native item
→ ensure no native object retains the staged URL
→ revoke/release Native Preview Access token/staging
→ complete Preview cleanup
```

The implementation may use RAII/guards, but native objects must not outlive the access capability they may asynchronously open.

No coordination lock may remain held across AppKit/Quick Look calls or other potentially blocking native work.

## 7. Renderer / Tauri boundary

Prefer existing Preview representation flow. React may know only:

- representation family `native_opaque`;
- opaque token;
- existing Preview/session/request/sourceVersion/host tuple already represented by current state;
- bounded geometry/presentation intent if a native-view bridge requires it.

React/WebView must never receive:

- original source path;
- staged path;
- `NSURL` string for staged content;
- native pointer/handle.

If new Tauri commands are required for attach/update/detach/geometry, they MUST:

- be main-window-only or otherwise no broader than the existing Preview permission boundary;
- accept only opaque token + exact Preview tuple + bounded geometry/intent;
- resolve/revalidate authority backend-side on every operation;
- be synchronized across `main.rs`/handler registration, `src-tauri/build.rs`, `src-tauri/capabilities/*.json`, `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md`, frontend API facade/browser mock and contract tests as applicable;
- never return paths/native handles.

A renderer command must not become a second lifecycle authority. PreviewSession/native adapter remains authoritative.

## 8. Capability truth

`runtime_capabilities.macos_quick_look_preview_available` currently derives from `platform::macos::quick_look::PREVIEW_AVAILABLE = false`.

W4-02 may change capability reporting only after the real native Preview bridge is implemented.

The capability must be false on unsupported platforms and must not become true merely from `cfg!(target_os = "macos")`. Prefer a narrow runtime/native-bridge availability check when feasible.

Do not relabel hosted compile as real native presentation evidence.

## 9. Bounds / resource policy

W4-01 hard bounds remain upper safety ceilings and are not automatically the W4-02 product activation profile.

Before activating a format, record a conservative W4-02 policy using representative fixtures for:

- maximum practical staged source size;
- maximum useful acquisition/presentation latency;
- concurrent native presentations (normally bounded by the existing scheduler/native resource model);
- native view count per visible Preview host;
- cleanup/steady-state behavior.

Rules:

- no partial staged file may reach Quick Look;
- over-budget is truthful provider fallback/unsupported, never direct-source bypass;
- no new persistent native cache;
- staging remains request-scoped disposable content;
- do not weaken W3/File Library/Query performance thresholds.

## 10. Required tests

### Provider / representation

- existing W3 provider families retain their current selection/priority;
- supported PDF on eligible macOS path can produce host-matched `NativeOpaque`;
- ZenFloating and ZenPinned both preserve exact host identity;
- Managed and Ephemeral sources remain their original source kinds;
- HostProvided input is rejected for this provider;
- non-macOS/native-unavailable path is unsupported/fallback, not false NativeOpaque;
- NativeOpaque token contains no source/staged path and rejects host mismatch;
- stale/superseded request cannot publish native representation.

### Staging / terminal truth

Prove through the actual W4-01 staging consumer boundary:

- MaterializationRequired;
- Downloading;
- MetadataOnly;
- PermissionDenied;
- SourceUnavailable/AvailabilityUnknown as mapped by current authority;
- source identity/sourceVersion drift before/during/after staging;
- cancellation/timeout;
- file/total capacity failure.

Each must publish no usable native representation and leave no leaked stage/native view.

### Native view lifecycle

Use deterministic native-adapter fakes where needed for cross-platform unit coverage and real AppKit coverage on macOS where executable:

- attach one current token;
- replace A→B and ensure A is detached/released before its access cleanup completes;
- cancel during attach/load;
- close/dispose;
- repeated open/switch/close reaches steady state;
- geometry resize does not create duplicate views;
- stale A completion cannot replace visible B;
- no native/provider/global mutex covers slow AppKit/Quick Look work.

### Runtime / renderer regression

- cancel/dispose/source switch continue revoking Native Preview Access;
- existing image/object URL asset path unaffected;
- existing Preview wire strict parser still rejects malformed NativeOpaque;
- no renderer/source-path endpoint appears;
- browser mock remains deterministic and does not pretend native rendering occurred;
- current Quick Look thumbnail behavior remains PASS and ownership remains separate.

## 11. Native evidence / fixtures

Any claim that native Quick Look actually renders must be bound to **Apple Silicon macOS** on the exact implementation head.

Required minimum real-native evidence before W4-02 may close as implemented:

- real local PDF fixture through the actual native view path;
- visible native content inside the Zen Preview host or an accepted native integration harness that exercises the same view lifecycle;
- source switch / close cleanup;
- staged artifact removed after native view release;
- no original source URL handed to the native view;
- no crash/hang during repeated cycles.

Where executable, also record resize/Retina behavior. VoiceOver/manual accessibility remains `UNVERIFIED` unless actually run; W4-06 owns final native accessibility/display acceptance.

Office/iWork/media require genuine fixtures/runtime support to claim PASS. Otherwise record them explicitly as `DEFERRED` / `UNVERIFIED`.

## 12. Validation

Focused first, adjusted to actual module names introduced by the implementation:

```bash
cargo test --manifest-path src-tauri/Cargo.toml native_preview
cargo test --manifest-path src-tauri/Cargo.toml macos_native_preview
cargo test --manifest-path src-tauri/Cargo.toml file_workspace::integration
cargo test --manifest-path src-tauri/Cargo.toml preview
```

Then repository gates appropriate to a production macOS-native Track, including at least:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:check
npm run verify:security
```

Run full Rust tests/Clippy and exact-head hosted macOS/Windows CI according to current routing. Windows must continue compiling and W3 cross-platform behavior must remain intact even though W4-02 native presentation is macOS-only.

Do not lower performance thresholds or add W4-02-specific CI exemptions.

## 13. Maintainability gate

Before final review, explicitly report:

- responsibility of each new/expanded module;
- native view lifecycle owner;
- staging/access lifecycle owner;
- provider-selection owner;
- Tauri command owner if commands were added;
- all locks that guard native presentation state and confirmation that slow AppKit/Quick Look calls occur outside coordination locks;
- any file above repository review-size signals and why it remains cohesive or how it was decomposed.

Do not append full native view, provider, staging and test infrastructure into `quick_look.rs`, `preview.rs`, `integration/preview.rs` or another generic mega-file.

## 14. Explicit non-goals

W4-02 MUST NOT implement or activate:

- Finder Quick Look Preview Extension;
- `MacQuickLookExtension` as the host for normal Zen Preview;
- `HostProvided` for Zen-owned native-backed Preview;
- Windows Preview Handler / W4-03 or W4-04;
- broad file association changes;
- signing/notarization/package integration beyond build necessities (W4-05);
- a duplicate PDF/Office/media parser suite;
- a separate global Quick Look product/hotkey;
- original-source direct URL handoff;
- implicit File Provider hydration;
- renderer raw paths/native pointers;
- new durable persistence/schema;
- W5 Release work.

## 15. Stop / escalate conditions

STOP before expanding scope if any of these becomes necessary:

1. QLPreviewView/native presentation cannot be safely tied to existing Zen Preview host lifetime with current Tauri/objc2 topology;
2. implementation would require exposing source/staged paths or native pointers to React;
3. implementation would require bypassing W4-01 staging or actual-open revalidation;
4. a second scheduler, provider registry, ReadGate/source resolver or durable native identity store appears necessary;
5. broad Tauri window permission or macOS private API changes beyond the reviewed native-view seam are required;
6. Finder extension/sandbox/XPC/app-group/signing topology becomes necessary for the initial product;
7. PDF cannot be presented without unsafe workaround; classify the Track blocked instead of silently replacing the product contract.

Architecture changes crossing those boundaries require independent review/ADR as applicable.

## 16. PR / review / completion flow

Codex is the implementation agent only. **Codex Review is not an acceptance or merge gate for Zen.**

Required flow:

```text
exact baseline / clean scope
→ Codex implementation + focused tests
→ exact-head local/applicable native evidence
→ exact-head hosted CI
→ independent ChatGPT exact-head code/architecture audit
→ blockers = 0
→ final PR-tree CI
→ expected-head squash merge
→ docs-only governance/current-truth closeout if needed
```

A later production-code commit invalidates earlier exact-head evidence.

Before merge, update current truth only for facts actually established by the final implementation. Do not mark W4-02 COMPLETE or advance W4-05 merely because code exists.

Completion report must include:

- Completed
- Authority and compatibility paths
- Important product/architecture decisions
- Files changed
- Tests and commands run
- Native verification and exact fixtures/environment
- Acceptance checklist
- Deferred / UNVERIFIED format families
- Resource/temp-artifact cleanup
- Risks requiring human/architecture review

W4-03 remains an independent parallel Track throughout W4-02. W5 remains inactive.