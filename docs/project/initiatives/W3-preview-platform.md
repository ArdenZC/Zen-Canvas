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

W3-01 closed items 3–6 at the Preview Core consumer boundary. W3-02 closed item 7 by delivering the first user-facing Floating Quick Preview host without replacing backend/source/workspace authority. W3-03 extended that same host/controller architecture into truthful Pinned Preview plus bounded source-owned sibling navigation. W3-04 activated the first production rich-provider slice and proved that Text/Code/Markdown can consume the existing MaterializationReadGate through a narrow backend-only adapter while preserving bounded reads, sanitization, fallback and fresh terminal-condition truth. W3-05 extended that same seam to bounded JSON/YAML/XML and CSV/TSV providers with strict versioned payloads, parser-stage resource bounds, inert XML/table rendering and real post-lease lifecycle evidence. W3-06 extended the same authority model to PNG/JPEG Image Preview with bounded chunked reads, existing WorkScheduler decoder admission, opaque request/sourceVersion-bound asset publication and shared renderer-local object-URL lifecycle. W3-07 proved bounded progressive direct-child Folder Preview through the existing BrowseService and Preview publication authorities, including user-visible Partial progression without a second directory/query engine. W3-08 added bounded ZIP central-directory metadata Preview through a ReadGate-backed seek adapter without raw-path/extraction authority and preserved W3-07 through ordered parallel integration. Item 8 remains a standing authority rule for W3-09 and every later Track.

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

W3-06 preserved those same authorities while adding bounded raster Image Preview. PNG/JPEG source bytes remain behind repeated authoritative `PreviewReadGateAdapter → MaterializationReadGate` reads; every <=1 MiB chunk gets a fresh request/sourceVersion-bound lease and revalidation. Decode admission is delegated to the existing runtime `WorkScheduler` with one decoder slot, final bytes publish only through the existing Preview asset registry, and React receives only opaque asset bytes from the exact tuple before creating disposable local object URLs.

W3-07 preserved the same Preview lifecycle while adding Folder Preview. The provider receives only bounded presentation facts through a backend adapter over the existing BrowseService, uses a temporary Preview-owned Browse session rather than visible Browse enumeration, and publishes progressive FolderSummary through the existing Preview publication/snapshot authority. The frontend observes those snapshots through one bounded single-in-flight current-epoch loop rather than a new event bus/controller.

W3-08 preserved the same source/read/scheduler authority while adding archive metadata Preview. ZIP random access is translated into bounded ReadGate calls with one request-level byte budget; the provider never receives a host filesystem path or reads/decompresses entry payloads. Existing WorkScheduler admission remains authoritative, and the shared renderer consumes only strict inert ArchiveTree payloads.

### Provider/host rule

Providers produce representations. Hosts render representations. A provider must not import React host state, and a host must not infer byte/provider authority from file extensions or paths. Native opaque representation remains explicitly host-bound.

### Legacy compatibility rule

`FileLibraryPreviewDialog`, `InspectorQuickLookPreview` and other preview-specific Vault compatibility paths remain migration inputs, not a second Preview platform. W3-02 through W3-08 prove the new Floating/Pinned Preview path is active across the reviewed rich-provider families and behaviorally/browser tested, but broad compatibility retirement still requires the later TD-015 exit conditions.

### Architecture decision status

No new ADR was required for W3 activation or W3-01 through W3-08 because none moved durable authority, persistence ownership, supported platforms, mutation/recovery strategy or cross-window permission ownership.

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

## W3-06 completion record

W3-06 — Image provider is **COMPLETE**.

- PR: #129
- baseline: `master@aac6b06710f204f501bb2bf7d2e81af30edd31c7` (W3-05 current-truth closeout / PR #128)
- final reviewed head: `d80f9d4d117bb6a2ab58c7b6349e9e026f19d201`
- final reviewed tree: `e805364045eca968227031308a9d5a1fa6b131e4`
- merge-integration checkout: `7cb7970e0a6864727fe6b2c2483323baabd4ebb1`
- integration tree: `e805364045eca968227031308a9d5a1fa6b131e4`
- exact-head hosted CI: `32630836668` — success
- source/integration trees: equivalent (`tree_equivalent=true`)
- reviewer pass: #5002180141; code blockers = 0
- squash merge: `master@ebd14c4cacf9129c511e055b1b28c28f0841699e`

Accepted architecture/results:

- one existing production registry adds `builtin.image` for PNG and JPEG/JPG only, preserving the same provider composition owner and strict `image { assetToken, mediaType }` outer representation family;
- source bytes remain behind `PreviewReadGateAdapter → MaterializationReadGate`; input is capped at 12 MiB total and <=1 MiB/chunk, with every chunk issuing a fresh request/sourceVersion-bound lease, authoritative resolve/revalidation/read and deterministic release;
- decode admission uses exactly one decoder slot from the existing runtime `WorkScheduler`, with capacity accounting/release proven on success, failure, cancel and stale switch and no provider-local queue, semaphore or worker pool;
- source/decode/output bounds are frozen at 8192 px per source edge, 24,000,000 source pixels, 4096 px normalized output edge, 12,000,000 output pixels, 12 MiB published image asset and one full image asset/request;
- PNG/JPEG headers, dimensions and actual decoded format are validated before/through decode; corrupt, truncated, mismatched and oversized-header/decompression-bomb fixtures fail provider-locally without unsafe full allocation;
- full supported static sources may be `Complete` only when fully consumed and not reduced because of W3-06 limits; source truncation or downscale is truthfully `Partial`;
- final image bytes publish only through the existing opaque Preview asset registry using current operation context, and stale/cancel/switch/dispose publication authority rejects obsolete assets;
- the shared Floating/Pinned renderer requests the exact session/request/sourceVersion/assetToken tuple, validates returned media type, creates only renderer-local object URLs from returned bytes and revokes them on source change/unmount/error;
- deterministic backend/frontend tests prove stale A cannot publish/render after B and read leases, decoder capacity, asset registry state and object URLs return to their lifecycle baseline;
- exact-head local browser gate passed at 1600×900 and 980×680 across Library/Browse, Floating/Pinned, Partial/fallback/latest-wins/no-source/sibling-navigation/compact ownership, with no unexpected external requests;
- frontend tests closed at 125 files / 1291 tests; Rust desktop-runtime tests at 833 passed / 15 ignored / 0 failed; fmt, Clippy, build, governance, audits, Windows/macOS Rust/release and applicable quality/performance lanes passed;
- no W3-07+ provider, W4 system host, raw-path renderer authority, generic Tauri byte-read API, implicit hydration, schema migration or second Preview/read/materialization/scheduler authority entered the Track.

Native interactive macOS visual verification was not executed and remains `UNVERIFIED`; hosted macOS compile/Rust/performance/quality evidence is not manual UI proof.

## W3-07 completion record

W3-07 — Folder Preview is **COMPLETE**.

- PR: #131
- baseline: `master@9950f32452d31699e5a2a70e66ab2c701d4601d1` (W3-06 current-truth closeout / PR #130)
- final reviewed head: `cf8a9edce9a07f518f443f09835047c93040030e`
- exact-head hosted CI: `32652108996` — success
- squash merge: `master@ced5478abfa7ac42fa9295ad5ec7b87c5e7dbee3`

Accepted architecture/results:

- `builtin.folder` reuses the single Preview registry/session/publication authority and the existing `BrowseService`; the provider receives bounded presentation facts rather than raw paths or directory handles;
- each Preview request gets one temporary Preview-owned Browse session in the same BrowseService and does not supersede visible Browse request/enumeration/cursor/history authority;
- Folder Preview is direct-children-only with the reviewed 100,000-entry ceiling and fixed-size aggregation state; it does not recurse, traverse symlinks/packages/archives/`.git`, hydrate provider content or create a second directory/query engine;
- existing `PreviewPublicationSink` remains progressive-publication authority, while one bounded single-in-flight frontend snapshot observer makes first-page and later Partial snapshots user-visible before final start settles;
- `FolderSummaryPayloadV1` keeps Partial/Complete truth aligned: ordinary in-progress Partial may have no stop reason, exact EOF is Complete, and entry/deadline limits remain explicit Partial results;
- the provider preserves return headroom before outer timeout so useful Partial content is not erased by fallback;
- deterministic tests prove source switch/cancel/dispose reject stale Folder publication and restore temporary Browse/page/scheduler baselines;
- exact-head local browser coverage passed at 1600×900 and 980×680;
- the final W3-07 CI remediation only fixed deterministic ReadGate test ordering and changed no Folder production semantics.

## W3-08 completion record

W3-08 — ZIP Archive Preview is **COMPLETE**.

- PR: #132
- baseline: `master@ced5478abfa7ac42fa9295ad5ec7b87c5e7dbee3` (post-W3-07 runtime)
- final reviewed head: `50920b46bd118ed6f25219fb66cbe687cc9ba280`
- final reviewed tree: `5ec7dd1e694b03f7752b7fa8e1a80743cd680bab`
- merge-integration checkout: `219b167478812bfa3a2396dc7c9369e7d4b8fe24`
- integration tree: `5ec7dd1e694b03f7752b7fa8e1a80743cd680bab`
- exact-head hosted CI: `32659742797` — success
- reviewer pass: #5003079985; code blockers = 0
- squash merge: `master@7078706992d129e47ba49b65ff3fec5eff0f40ec`

Accepted architecture/results:

- the single production registry adds `builtin.archive-zip` priority 270 for bounded ZIP metadata Preview without creating another provider selector/lifecycle authority;
- archive bytes are consumed only through a bounded `Read + Seek` adapter over `PreviewReadGateAdapter → MaterializationReadGate`; there is no raw path, `File::open`, `ZipArchive<File>` or renderer-visible read lease/API;
- every read remains <=1 MiB and total charged source reads remain <=12 MiB/request, including repeated seeks;
- ZIP Preview is metadata-only and never extracts or decompresses entry payloads, creates output files or recursively parses nested archives;
- reviewed ceilings bound 20,000 inspected entries, 2,000 tree nodes, depth 64, names, extra/comment metadata, central-directory bytes and encoded ArchiveTree before unbounded representation growth;
- a narrow archive resource adapter uses the existing runtime WorkScheduler for CPU/I/O admission; real post-lease tests preserve terminal taxonomy and restore ReadGate/scheduler baselines after success, drift, cancel, switch and dispose;
- safe nested logical directory entries remain inert virtual-tree data while traversal/absolute/dot/drive/UNC/control/normalization-sensitive names fail closed and never become host paths;
- the 100 ms return guard reserves time before outer timeout; pre-validation deadline remains provider-local Timeout/Metadata fallback, while structurally validated ZIP metadata may truthfully return `ArchiveTree Partial / deadline`;
- corrupt ZIP hints near deadline cannot fabricate ArchiveTree;
- ordered post-W3-07 integration preserves Folder progressive observation, FolderSummary, latest-wins and shared Preview/read/scheduler authority;
- exact-head local W3-07/W3-08 browser gates passed at 1600×900 and 980×680.

Native interactive macOS visual/accessibility verification remains `UNVERIFIED` and hosted platform CI is not reclassified as manual UI proof.

## Current production Track

**W3-09 — Failure / Materialization / Security / Accessibility Integration — NEXT.**

W3-09 starts from the merged W3-08 runtime baseline plus the W3-07/W3-08 current-truth catch-up closeout. The already-prepared Phase A branch is reusable only after synchronizing to that post-W3-08 current truth.

W3-09 owns cross-provider fallback/terminal convergence, no-implicit-materialization truth, hostile-input/resource behavior and shared Floating/Pinned keyboard/focus/IME/accessibility semantics across Text/Markdown/Structured/Table/Image/Folder/ZIP. It must preserve all existing PreviewSession, Provider Registry, MaterializationReadGate, WorkScheduler, BrowseService, sourceVersion, latest-wins and bounded-resource authorities and must not pull W3-10 final acceptance or W4 system hosts forward.

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
- ZIP hostile metadata/index fixtures;
- security/read-gate/materialization terminal-condition tests.

### Applicable full checks

Use the repository's current CI classifier and full validation when production Rust/frontend/performance/platform scope requires it. Existing Query V2 and W2 File Library scale thresholds are not relaxed.
