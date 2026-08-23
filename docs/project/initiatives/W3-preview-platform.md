# W3 — Preview Platform

Status: active — implementation

Owner: Zen Canvas

Start baseline: `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`

Activation branch: `docs/w3-preview-platform-activation`

W3 turns the already-merged W1 Preview Contract Core and W2 File Library workspace into the user-facing Zen Quick Preview platform. This initiative is intentionally narrower than native Finder/Explorer integration: it owns the Zen application Preview experience and built-in provider platform; W4 owns operating-system shell integration.

## Problem and research

The W0/W-1 research and W1/W2 implementation provide a strong foundation, but the product intentionally entered W3 with a gap between **Preview contracts** and **Preview experience**.

Pre-activation review on `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1` confirmed:

1. W1-06 Preview Core is real production Rust code: `PreviewSession`, source snapshots/versioning, Provider Registry contracts, representation families, capability intersection, cancellation/disposal, fallback taxonomy and opaque content-read access already exist.
2. W1-10 exposes a bounded main-window-only Tauri/API lifecycle (`create/snapshot/start/cancel/dispose/switch-source`) and injects the existing MaterializationReadGate rather than exposing byte leases to React.
3. Production Preview began W3 with an intentionally empty rich-provider composition and metadata fallback only.
4. Zen host/source capability projection began W3 metadata-fallback-clamped and required truthful matrices before rich-provider controls could become effective.
5. Rust already serialized the full `PreviewRepresentationEnvelope`, while TypeScript modeled only Metadata at W3 activation.
6. `PreviewCompleteness::Partial` existed before W3, but a repeated/progressive publication mechanism for Folder Preview had not yet been proven.
7. W2 File Library UI did not consume `fileWorkspaceApi.preview*`; Library still used preview-specific Vault compatibility and Browse had no user-facing Quick Preview host.
8. No general renderer-callable materialization/download command existed, and W3 must not fabricate one or bypass the existing read/materialization authority.

W3-01 closed items 3–6 at the Preview Core consumer boundary. W3-02 closed item 7 by delivering the first user-facing Floating Quick Preview host without replacing backend/source/workspace authority. W3-03 extended that same host/controller architecture into truthful Pinned Preview plus bounded source-owned sibling navigation. W3-04 activated the first production rich-provider slice and proved that Text/Code/Markdown can consume the existing MaterializationReadGate through a narrow backend-only adapter while preserving bounded reads, sanitization, fallback and fresh terminal-condition truth. W3-05 extended that same seam to bounded JSON/YAML/XML and CSV/TSV providers with strict versioned payloads, parser-stage resource bounds, inert XML/table rendering and real post-lease lifecycle evidence. Item 8 remains a standing authority rule for W3-06 and every later provider Track.

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

- `PreviewSession` / Provider Registry / representation/fallback contracts: W1/W3 Preview Core.
- Managed source identity/query context: File Library Query V2 and managed File Library authority.
- Ephemeral source identity/lifetime: W1 BrowseService.
- Navigation/focus/presentation context: W2 WorkspaceSession and source-owned interaction state.
- Byte-read/materialization eligibility: W1 MaterializationReadGate and the existing authoritative platform/content open boundary.
- Global expensive-work admission: WorkScheduler.
- Thumbnail infrastructure: W1 ThumbnailService / existing macOS Quick Look thumbnail adapter where applicable.
- File mutation/recovery: existing Operation Preview, journal, Safe Trash and Restore authorities.

### W3 frontend ownership

The W3 `PreviewExperienceController` exists as the single renderer-owned disposable Preview experience coordinator. It owns only:

- visible host kind/state;
- current frontend Preview request epoch;
- mapping from current W2 presentation entry/focus to `PreviewSourceRef`;
- shell visibility and render state;
- command-context gating;
- focus restoration;
- bounded sibling navigation projection supplied by the current workspace/source owner;
- cancel/dispose/switch-source calls and stale frontend publication rejection.

It does not own filesystem resolution, provider selection truth, byte-read eligibility, source version, durable selection/query truth or mutation authority.

W3-02 established a per-`previewId` serialized latest-wins source-switch transport inside `FileWorkspaceController`. That queue is transport ordering only: it prevents overlapping switch mutations from leaving backend session truth behind frontend intent, while `PreviewSession` remains lifecycle/sourceVersion/publication authority.

W3-03 preserved that ownership while adding Pinned host presentation. Floating→Pinned uses a bounded staged create/commit/dispose handoff so the accepted renderer host and authoritative backend `PreviewHostKind` remain truthful without adding a backend host-switch command or second Preview lifecycle owner.

W3-04 preserved the same ownership while adding byte-reading providers. Providers receive only a backend `PreviewContentReadAccess` adapter over the existing `MaterializationReadGate`; the shared authoritative bounded-read implementation re-resolves and re-validates source identity/eligibility after lease issue and exposes Preview-specific terminal semantics without adding another resolver, opener, lease registry or renderer API.

W3-05 preserved that same byte-read and lifecycle authority while adding structured/table parsing. Parser selection remains provider-owned backend logic, but source/read/materialization truth remains `MaterializationReadGate`-owned; strict versioned payloads cross the existing representation families and React validates/renders those payloads rather than parsing original source bytes. YAML aliases, XML entities/resources and CSV formula-looking strings are inert data, not execution/navigation authority.

### Provider/host rule

Providers produce representations. Hosts render representations. A provider must not import React host state, and a host must not infer byte/provider authority from file extensions or paths. Native opaque representation remains explicitly host-bound.

### Legacy compatibility rule

`FileLibraryPreviewDialog`, `InspectorQuickLookPreview` and other preview-specific Vault compatibility paths remain migration inputs, not a second Preview platform. W3-02/W3-03/W3-04/W3-05 prove the new Floating/Pinned Preview path is active, rich-provider-capable and behaviorally/browser tested, but broad compatibility retirement still requires the later TD-015 exit conditions.

### Architecture decision status

No new ADR was required for W3 activation, W3-01, W3-02, W3-03, W3-04 or W3-05 because none moved durable authority, persistence ownership, supported platforms, mutation/recovery strategy or cross-window permission ownership.

If a later W3 Track discovers that a required solution would move one of those boundaries, that Track stops and creates a reviewed ADR before implementation continues.

## W3-01 completion record

W3-01 — Preview Core Consumer-Readiness is **COMPLETE**.

- PR: #119
- baseline: `master@e54c788db637e6c6140cf618dd3d7125ea1df8e3`
- final reviewed head: `09be79b9415d55a7e0ef5271f465b557c1ee6d57`
- final reviewed tree: `6add03115a69fe226b5c040ee8bb23d66e373704`
- exact-head CI: `32564728867` — success
- squash merge: `master@fb48696795e19aa5fabac5966d31665a6b95e81e`

Accepted architecture/results:

- one production Provider Registry composition owner;
- explicit activated Zen Floating/Pinned host policies with W4 host kinds fail-closed;
- backend source capability projection without extension/path inference;
- exhaustive strict ten-family Rust/TypeScript representation and warning wire;
- bounded opaque Preview-specific asset transport bound to preview/request/sourceVersion;
- bounded monotonic progressive publication with stale/out-of-order/cancel/dispose protection;
- lifecycle authority revoked before asset cleanup;
- asset publication authority revalidated under the registry mutex before mutation;
- successful source switch cleans only the superseded request/sourceVersion tuple while failed switch preserves the old authority;
- progressive publication responsibility decomposed without creating a second lifecycle/publication authority;
- no rich provider, W3-02 UI, W4 native host, schema, generic byte-read command, raw-path authority or implicit hydration.

The initial Windows Thumbnail lifecycle failure is retained as an `OBSERVED` timing flake: reviewer rerun succeeded and the final exact-head Windows CI did not reproduce it; no unrelated Thumbnail behavior was changed.

## W3-02 completion record

W3-02 — Zen Floating Quick Preview Host is **COMPLETE**.

- PR: #121
- baseline: `master@82734890887ccccf368bec1966b7d55bb7c89385` (W3-01 current-truth closeout / PR #120)
- final reviewed head: `3adc8ef015cf772933dc5d966289b330d40cc71c`
- final reviewed tree: `37eb86d4993616024ca4101955304722a27e16a1`
- merge-integration checkout: `aa9469b21ce9486a7f9cf2d819c948ec682d69fe`
- integration tree: `37eb86d4993616024ca4101955304722a27e16a1`
- exact-head hosted CI: `32585239510` — success
- ADR-0004: `tree_equivalent=true`, `head_validation_required=false`, substantive lane `merge_integration`
- squash merge: `master@fe4cb4a7d16976f5dcc9a9dbbc4b2b47937a850e`

Accepted architecture/results:

- one renderer-owned `PreviewExperienceController` and one floating Quick Preview shell;
- Library and Browse Preview sources remain opaque managed/ephemeral identities with no raw-path reconstruction;
- Space/Esc behavior is integrated into existing File Library keyboard/focus/modal ownership; no-focus Space is a true no-op and repeated Space is ignored;
- shell-first behavior is deterministic, including close/switch while old start work is still pending;
- the shell remains mounted across rapid source changes and only current frontend epoch/source results may render;
- `FileWorkspaceController` Preview cache publication is request/source guarded;
- per-`previewId` source-switch mutations are serialized with one latest-wins pending slot, preventing backend Preview session truth from regressing behind newer frontend intent;
- deterministic tests assert PreviewExperience state, controller cache and mock backend truth converge on the newest B/C/D source, including late A start and no-spurious-cancel/dispose cases;
- real-browser gate passed Library/Browse List/Grid at 1600×900 and 980×680;
- production rich-provider registry remains intentionally empty, so Metadata fallback remains truthful;
- no Rust/Tauri command, schema, rich provider, pinned Preview, sibling navigation, W4 native host, raw-path or second read/materialization authority entered the Track.

## W3-03 completion record

W3-03 — Pinned Preview + sibling navigation is **COMPLETE**.

- PR: #123
- baseline: `master@52cca2039070d26f7fabfd7f2ac53cfb315bb79a` (W3-02 current-truth closeout / PR #122)
- final reviewed head: `9bdc5f7c80d393bfefcf6ee7b5cdc89653c34fa6`
- final reviewed tree: `f4325b7ab8ea099ab781ac48824f2ae3d7e92fb0`
- merge-integration checkout: `7c36076ab2bacb4d07d9241d63ee9769f4172ee1`
- integration tree: `f4325b7ab8ea099ab781ac48824f2ae3d7e92fb0`
- exact-head hosted CI: `32593460617` — success
- ADR-0004: `tree_equivalent=true`, `head_validation_required=false`, substantive lane `merge_integration`
- squash merge: `master@ee841f230277ecb9c6e9d731ef90f66a34814510`

Accepted architecture/results:

- one existing W2 Context Panel owns the Pinned Preview presentation; no second Context surface exists;
- one existing `PreviewExperienceController` owns Floating/Pinned renderer state; no second Preview lifecycle authority or Pinned-specific switch queue was introduced;
- Floating→Pinned stages a truthful `zen_pinned` session through existing Preview create/start/dispose seams and commits only after typed Context handoff acceptance;
- stale/rejected staging is cleaned while Floating remains current, repeated Pin shares one bounded pending operation, and successful handoff leaves one visible/current Preview host;
- Pinned no-source clears stale content and valid-source recovery creates a new `zen_pinned` backend session;
- Library/Browse source-owned focus remains authoritative; no hidden Preview selection model was added;
- sibling navigation is generation/provenance-bound and bounded to the current loaded/source-owned workspace collection;
- Browse active-query Next reuses the existing enumeration with bounded empty-page scanning and fails closed on generation/session/enumeration drift;
- compact `all_matching` is never materialized for Preview navigation;
- deterministic deferred Pinned A→B→C/D coverage proves final PreviewExperience source/snapshot, controller cache and authoritative backend record converge on D with truthful Pinned host identity;
- browser gate passed required large/compact viewports with one Context/modal owner and no horizontal overflow;
- no Rust/Tauri command, schema, rich provider, second Query/Browse engine, raw-path authority, implicit hydration or W4 system-host scope entered the Track.

Native macOS manual visual verification was not executed and remains `UNVERIFIED`.

## W3-04 completion record

W3-04 — Text/Code + Markdown providers is **COMPLETE**.

- PR: #125
- baseline: `master@763bff90aa62e73f3089f32a340dad3cbd497261` (W3-03 current-truth closeout / PR #124)
- final reviewed head: `bb0fa0ac9a46fb5a4c17ddfa1c634c20d2f3bce7`
- final reviewed tree: `62049ff892d17ceb9c28255c97780f4613248b27`
- merge-integration checkout: `ba2f743138b718710d22aaeab66396c26304d400`
- integration tree: `62049ff892d17ceb9c28255c97780f4613248b27`
- exact-head hosted CI: `32617793286` — success
- source/integration trees: equivalent (`tree_equivalent=true`)
- squash merge: `master@48e8291f8d1f0367a24eca6329640641468b78ce`

Accepted architecture/results:

- one existing production Provider Registry owner now composes the stable providers `builtin.markdown` (300), `builtin.source-code` (200) and `builtin.text` (100);
- provider byte access remains behind the existing `MaterializationReadGate`; W3-04 added only a process-local backend Preview read adapter and no renderer-visible lease/path capability;
- one shared `MaterializationReadGate::read_bounded_with_mapping` implementation owns the authoritative post-lease resolve/open/identity/cancel path while Preview-specific mapping preserves fresh terminal truth without duplicating read authority;
- provider reads are bounded to a 512 KiB prefix, truncated input is `Partial`, malformed UTF-8/obvious binary input falls back safely and huge-line rendering stays bounded;
- Text/Code output is read-only typed `text` with a presentation-only language hint and no code/tool/language-server execution;
- Markdown is parsed with `pulldown-cmark`, sanitized with `ammonia` and emitted as `safe_html` with scripts/event handlers/active embeds, arbitrary remote resources, `file:` resources, relative filesystem resources and automatic navigation removed;
- Floating and Pinned render the same typed representation path;
- provider-local failure retains Metadata fallback, while MaterializationRequired/Downloading, PermissionDenied, IdentityChanged and SourceUnavailable/AvailabilityUnknown remain terminal at both lease issue and post-lease revalidation; MetadataOnly falls through non-terminally to Metadata;
- deterministic barrier tests prove post-lease terminal drift, stale/source-switch rejection, provider-processing failure cleanup and active Preview lease count returning to baseline after an actual lease is issued;
- browser evidence at 1600×900 and 980×680 proves rich Text/Markdown rendering, Partial disclosure, Floating/Pinned reuse and hostile Markdown no-network/no-file/no-relative-resource behavior;
- desktop-runtime Rust tests closed at 805 passed / 15 ignored; frontend tests closed at 123 files / 1284 tests; all required quality, build, governance, security/audit, release and applicable performance lanes passed;
- no W3-05+ provider, W4 system host, raw-path renderer authority, generic Tauri byte-read command, implicit hydration, schema or second Preview/read/query authority entered the Track.

## W3-05 completion record

W3-05 — Structured + Table providers is **COMPLETE**.

- PR: #127
- baseline: `master@a3f5d3d3bb467d845762462e1567f6687e40206d` (W3-04 current-truth closeout / PR #126)
- final reviewed head: `3d94c5e1399230bff0aa8ffbae5b01bd8d775a2a`
- final reviewed tree: `2c708e3ec83c6cd27efd91de89c41c9685a48735`
- merge-integration checkout: `1da89e6cd942b9e415fe7c718441f73a433d4bee`
- integration tree: `2c708e3ec83c6cd27efd91de89c41c9685a48735`
- exact-head hosted CI: `32624221341` — success
- source/integration trees: equivalent (`tree_equivalent=true`)
- squash merge: `master@dde7ecb29e30a0b660fd8123b9203f5f97944a20`

Accepted architecture/results:

- one existing production registry now adds `builtin.structured-json` (260), `builtin.structured-yaml` (250), `builtin.structured-xml` (240), `builtin.table-csv` (230) and `builtin.table-tsv` (220) without replacing the W3-04 providers or composition owner;
- Rust freezes `StructuredTreePayloadV1` / `TablePayloadV1` inside the existing `structured_tree` / `table` outer representation wire, while one shared TypeScript decoder rejects unknown schema versions/fields and hostile oversized shapes before the shared renderer consumes them;
- source reads remain behind `PreviewReadGateAdapter → MaterializationReadGate`, capped to a 512 KiB prefix with authoritative second revalidation, truthful terminal/fallback semantics and short-lived request/sourceVersion-bound leases;
- structured bounds are depth 64, 10,000 nodes, 1 KiB keys/XML names, 16 KiB scalar/text, 128 XML attributes and 1 MiB encoded payload; table bounds are 500 rows, 64 columns, 16 KiB cell strings and 1 MiB encoded payload;
- JSON uses bounded visitor construction and deterministic duplicate-key preservation; YAML consumes `yaml-rust2` events iteratively through `next_token()` so deep nesting is not recursively walked through `Parser::load()`, aliases stay inert and node/depth exhaustion publishes Partial rather than false corruption;
- XML is event-parsed in memory, rejects `DOCTYPE` and unknown entities, has no external resolver and cannot fetch HTTP/file/relative DTD/entity resources;
- CSV/TSV reuse the Rust CSV parser with deterministic header presentation, bounded rows/columns/cells and inert formula-looking values;
- incomplete structured prefixes never fabricate source nodes; parseable real prefixes may be Partial while unsafe/incomplete parses fail provider-locally to Metadata fallback;
- deterministic W3-05 tests exercise real issued leases through `PreviewReadGateAdapter` and prove lease baseline restoration after structured success, table parser failure, stale source switch, cancel and MaterializationRequired/AvailabilityUnknown/MetadataOnly drift with no stale representation;
- the shared Floating/Pinned renderer escapes XML/text/table values, and exact-head browser coverage passed required Library/Browse provider, Partial/fallback/latest-wins/no-source/compact ownership scenarios with no external/resource navigation or horizontal overflow;
- frontend tests closed at 123 files / 1288 tests and Rust library tests at 822 passed; fmt, Clippy, build, governance, audits, Windows/macOS Rust/release and applicable performance lanes passed;
- no W3-06+ provider, W4 system host, raw-path renderer authority, generic Tauri byte-read API, implicit hydration, schema migration or second Preview/read/query/materialization authority entered the Track.

Native macOS manual visual verification was not executed and remains `UNVERIFIED`.

## Current production Track

**W3-06 — Image provider — NEXT.**

W3-06 starts from the merged W3-05 runtime baseline plus this current-truth closeout. It owns the bounded built-in Image Preview provider through the existing production Provider Registry, Preview Core/session lifecycle, W3-04/W3-05 backend read seam, W3-01 opaque Preview asset transport and existing Floating/Pinned hosts.

W3-06 must keep image source reads, decode dimensions/pixels, encoded/publication asset bytes, publication slots and cleanup explicitly bounded. Image payloads remain request/sourceVersion-bound and renderer-visible content must use opaque Preview assets rather than raw filesystem paths or reusable renderer leases. Provider-local failure may fall back through the existing matrix, terminal read conditions remain terminal, no implicit cloud hydration is allowed, and W3-06 must not pull W3-07+ Folder/ZIP providers or W4 system-host integration forward.

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