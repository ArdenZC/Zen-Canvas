# W3 — Preview Platform

Status: active — implementation

Owner: Zen Canvas

Start baseline: `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`

Activation branch: `docs/w3-preview-platform-activation`

W3 turns the already-merged W1 Preview Contract Core and W2 File Library workspace into the user-facing Zen Quick Preview platform. This initiative is intentionally narrower than native Finder/Explorer integration: it owns the Zen application Preview experience and built-in provider platform; W4 owns operating-system shell integration.

## Problem and research

The W0/W-1 research and W1/W2 implementation provide a strong foundation, but the current production product still has a deliberate W1/W2 gap between **Preview contracts** and **Preview experience**.

Pre-activation review on `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1` confirmed:

1. W1-06 Preview Core is real production Rust code: `PreviewSession`, source snapshots/versioning, Provider Registry contracts, representation families, capability intersection, cancellation/disposal, fallback taxonomy and opaque content-read access already exist.
2. W1-10 exposes a bounded main-window-only Tauri/API lifecycle (`create/snapshot/start/cancel/dispose/switch-source`) and injects the existing MaterializationReadGate rather than exposing byte leases to React.
3. Production `start_preview()` intentionally constructs an empty `PreviewProviderRegistry`; current integration therefore proves lifecycle/metadata fallback only and does not contain a W3 rich provider.
4. Current Zen host/source capability projection is intentionally `metadata_fallback()`-bounded, so W3 must establish truthful host/source capability matrices before rich-provider controls can become effective.
5. Rust already serializes the full `PreviewRepresentationEnvelope`, but TypeScript currently models only the `metadata` representation family. Rich providers must not be introduced until the wire contract is made exhaustive and tested.
6. W1's `PreparedPreview::load()` produces one provider result. `PreviewCompleteness::Partial` exists, but a repeated/progressive publication mechanism for Folder Preview has not yet been proven. W3 must resolve that contract before claiming progressive 100k Folder Preview.
7. W2 File Library UI does not consume `fileWorkspaceApi.preview*` yet. Library currently reaches the legacy Vault `FileLibraryPreviewDialog`/Inspector compatibility path, including the existing macOS Quick Look thumbnail compatibility surface; Browse Context has no user-facing Quick Preview host.
8. No general renderer-callable materialization/download command exists. W3 must never fabricate one or bypass the existing read/materialization authority. A user-initiated `Download to Preview` action is exposed only if a separately reviewed authoritative materialization action exists; otherwise `materialization_required` remains an explicit state.

The W-1 research conclusions remain binding: Preview is a disposable session/platform, Preview Host is not Preview Core, cleanup is P0, native capability should be reused safely where appropriate, no implicit cloud hydration is allowed, and arbitrary third-party plugin loading is rejected for v1.

## Scope

### In scope

- make the W1 Preview Core/integration surface fully consumable by W3 without replacing its authority;
- Zen Floating Quick Preview host;
- Zen Pinned Preview host inside the W2 Context Panel model;
- Space / Esc / Pin command behavior with existing focus, IME, menu/dialog and keyboard ownership;
- Library and Browse `EntryRef`/`PreviewSourceRef` consumption without renderer-authoritative paths;
- host/source/provider capability intersection suitable for real Zen hosts;
- exhaustive Rust/TypeScript Preview representation wire contract;
- a bounded progressive-publication contract for representations that need it, especially Folder Preview;
- built-in providers for Metadata, Text/Code, Markdown, JSON/YAML/XML, CSV/TSV, Image, Folder and ZIP;
- bounded sibling navigation driven by the originating W2 workspace rather than a second query engine;
- explicit unsupported/corrupt/timeout/unavailable/materialization/permission/identity/cancel failure UX;
- cancellation, rapid switching, cleanup and close-then-mutate correctness;
- Preview timing, provider fixture and resource steady-state validation;
- retirement of preview-specific legacy UI compatibility callers only when equivalence is proven.

### Deliverables

- reviewed W3 architecture/experience plan and Track dependency graph;
- consumer-ready Preview Core/Tauri/TS representation contract;
- shared frontend Preview experience controller that owns only ephemeral host/command/request state;
- floating and pinned Zen Preview hosts;
- bounded built-in provider registry and provider modules;
- focused and integrated QA for 100-entry rapid switching, 100 Preview cycles and 100k Folder Preview;
- W3 closeout/current-truth evidence.

### Acceptance criteria

W3 is complete only when:

- Preview shell presentation is independent of provider latency and meets the W0 shell-first contract;
- the current session/source/request/version is the only publication authority;
- no renderer-authoritative raw path or general read lease is introduced;
- all byte-reading providers use the existing MaterializationReadGate / authoritative byte-open boundary;
- rich provider output crosses an exhaustive, strict Rust/TS representation contract;
- effective capabilities are the truthful Host ∩ Provider ∩ Source intersection;
- floating and pinned hosts work from both Library and Browse sources where capability permits;
- Space/Esc/focus/IME ownership remains deterministic and accessible;
- rapid switching cannot publish the wrong file or leak unbounded work/resources;
- provider-local failures fall through only according to the W0 fallback matrix;
- source/session terminal conditions are never bypassed by another byte reader;
- Folder Preview is bounded/progressive at 1k/10k/100k and does not wait for full analytics before shell/useful content;
- close/dispose releases resources sufficiently for immediate rename/move/delete/open through existing mutation authorities;
- W0 W3 performance and provider-fixture gates are satisfied or honestly classified;
- W4 native system integration is not pulled forward.

## Non-goals

W3 does **not** authorize:

- macOS Finder Quick Look extension/system-host integration;
- Windows Explorer Preview Handler/system integration;
- signing/notarization/release work;
- third-party Preview plugin SDKs or arbitrary DLL/dylib loading;
- OCR, AI Preview, Content Understanding side effects, RAG/vector search or Agent/tool execution;
- Query V3 or a second Browse/search authority;
- schema migration merely to simplify Preview;
- a new durable Preview job/session database;
- a second WorkScheduler, content-read engine, materialization engine, mutation authority or filesystem identity authority;
- duplicate Zen renderers for PDF/Office/iWork/audio/video merely for format-count parity when safe platform-native capability is the better long-term path;
- automatic hydration/download of cloud/provider content.

## Authority and architecture freeze

### Existing authorities remain authoritative

- `PreviewSession` / Provider Registry / representation/fallback contracts: W1 Preview Core.
- Managed source identity/query context: File Library Query V2 and managed File Library authority.
- Ephemeral source identity/lifetime: W1 BrowseService.
- Navigation/focus/presentation context: W2 WorkspaceSession and source-owned interaction state.
- Byte-read/materialization eligibility: W1 MaterializationReadGate and the existing authoritative platform/content open boundary.
- Global expensive-work admission: WorkScheduler.
- Thumbnail infrastructure: W1 ThumbnailService / existing macOS Quick Look thumbnail adapter where applicable.
- File mutation/recovery: existing Operation Preview, journal, Safe Trash and Restore authorities.

### W3 frontend ownership

A W3 `PreviewExperienceController` (exact module name may differ) may own only disposable UI/session coordination:

- visible host kind/state;
- current frontend Preview request epoch;
- mapping from current W2 presentation entry/focus to `PreviewSourceRef`;
- shell visibility and render state;
- command-context gating;
- focus restoration;
- bounded sibling navigation window supplied by the current workspace;
- cancel/dispose/switch-source calls and stale frontend publication rejection.

It must not own filesystem resolution, provider selection truth, byte-read eligibility, source version, durable selection/query truth or mutation authority.

### Provider/host rule

Providers produce representations. Hosts render representations. A provider must not import React host state, and a host must not infer byte/provider authority from file extensions or paths. Native opaque representation remains explicitly host-bound.

### Legacy compatibility rule

`FileLibraryPreviewDialog`, `InspectorQuickLookPreview` and other preview-specific Vault compatibility paths are migration inputs, not a second Preview platform. W3 may remove a preview-specific compatibility caller only after the W3 replacement path is active and focused real-browser/behavioral equivalence is proven. `TD-015` remains open until its broader exit condition is met.

### Architecture decision status

No new ADR is required for W3 activation because this initiative does not move durable authority, persistence ownership, supported platforms, mutation/recovery strategy or cross-window permission ownership.

If a later W3 Track discovers that a required solution would move one of those boundaries, that Track stops and creates a reviewed ADR before implementation continues.

## Validation

### Focused checks

- Rust Preview Core/integration contract tests;
- strict Rust/TypeScript wire-shape tests;
- frontend Preview controller/command/focus tests;
- provider fixture suites;
- rapid-switch/stale-publication/cancel/dispose tests;
- close-then-mutate regressions;
- browser interaction tests for Library and Browse;
- 1k/10k/100k Folder Preview fixtures;
- security/read-gate/materialization terminal-condition tests.

### Applicable full checks

Use the repository's current CI classifier and full validation when production Rust/frontend/performance/platform scope requires it. Existing Query V2 and W2 File Library scale thresholds are not relaxed.

### Performance targets carried from W0

- Preview shell <= 100 ms p95 target;
- normal local built-in text/JSON/Markdown/image useful representation <= 300 ms p95 target;
- native/system first useful representation <= 1 s target where applicable;
- 100-entry rapid switching: HARD no stale/wrong-file publication and bounded work;
- 100 Preview cycles: HARD no monotonic resource/handle leak;
- 100k Folder Preview: HARD shell-first and bounded/progressive analytics.

### Known unverified/deferred areas at activation

- real native Finder/Explorer host lifecycle belongs to W4;
- genuine native provider/filesystem fixtures unavailable to CI remain `UNVERIFIED` rather than fabricated;
- a user-initiated provider materialization action is not claimed until an existing/explicitly reviewed authoritative action exists;
- PDF/Office/iWork/audio/video rich coverage may remain Metadata/native-capability deferred where safe W3 in-app capability is not available.

## Wave/Track and PR

The durable dependency graph is owned by `specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`.

Activation/experience freeze is W3-00. Production Tracks are W3-01 through W3-10, followed by W3-11 closeout.

Activation PR: #118 merged at
`master@e54c788db637e6c6140cf618dd3d7125ea1df8e3`.

Current production Track: W3-01 — Preview Core Consumer-Readiness, based on
the merged W3-00 baseline. Its implementation is complete on the dedicated
Draft-review branch; W3-02 remains inactive until W3-01 is independently
reviewed and merged.

## Closeout

- Merge SHA: pending.
- Current-truth files updated: W3-01 taskbook, STATUS, ROADMAP and architecture map.
- Deferred/unverified items recorded: yes; maintained throughout W3.
- Source/integration branches deleted after ancestor/content-equivalence verification: pending.
