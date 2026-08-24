# W3 — Preview Platform

Status: **ACTIVE — implementation — W3-R1 bounded post-closeout remediation**

Owner: Zen Canvas

Start baseline: `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`

Final pre-remediation runtime baseline: `master@a825f5414af274ee02712b53b60d72fe59306fea`; tree `79f1ca9a9ff97b695b1fca38090d007a1723559e` (W3-10 PR #136)

Closeout attempt: PR #137; post-merge Codex review `#5009168468` / inline blocker `#3844601370` reopened W3 for W3-R1. W4 remains inactive.

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

## W3-09 completion record

**W3-09 — Failure / Materialization / Security / Accessibility Integration — COMPLETE.**

- PR: #134
- baseline: `master@7078706992d129e47ba49b65ff3fec5eff0f40ec` (post-W3-08 runtime)
- final reviewed head: `ff7ad51ebc4f02fd5871c8f76233a911a8d15f96`
- final reviewed tree: `1955b9f1041f93f1fc0ef7004f54bfb5c290a353`
- exact-head hosted CI: `32674567490` — success
- reviewer pass: `#5003742441`; code blockers = 0
- squash merge: `master@31d4bc4bcdb1ad495a1db13e7630213d4ec5d6a0`

Accepted architecture/results:

- one shared Preview integration converges recoverable failures, terminal source/session conditions, Metadata fallback and terminal presentation without creating a second Preview lifecycle, provider, read, materialization or event authority;
- `MaterializationRequired` remains truthful and no renderer download/hydration action is fabricated without an existing authoritative command;
- hostile Markdown/XML/YAML/table/archive/folder/image inputs remain bounded, inert or sanitized, with no raw-path, unauthorized network/resource, script or archive extraction authority;
- Space/Esc/IME, focus restoration, single-modal ownership, Floating/Pinned handoff and screen-reader status semantics converge across the merged provider families;
- stale, cancel, switch, close and dispose paths preserve latest-wins behavior and restore existing read/scheduler/asset/session resources, including Folder progressive observation and ZIP metadata-only bounds;
- exact-head local real-browser W3-09 coverage passed at 1600×900 and 980×680.

Hosted compile/Rust/performance/quality evidence is not interactive native UI proof. Native VoiceOver/Narrator, Retina/DPI and manual native macOS verification remain `UNVERIFIED`.

## W3-10 completion record

**W3-10 — Preview Performance / Cross-platform QA — COMPLETE.**

- PR: #136
- baseline: `master@fcc10d6fdd48e05254f07c8eae98497b2408017e`
- final reviewed head: `601f689741fc0084a50853ba26b856e251421c5b`
- final reviewed tree: `79f1ca9a9ff97b695b1fca38090d007a1723559e`
- merge-integration checkout: `219eb38fea6693bcf7826e48241492e5f7c961f2`; same tree
- exact-head hosted CI: `32706899339` — success
- reviewer PASS: `#5007633103`; acceptance blockers = 0
- squash merge/final W3 runtime: `master@a825f5414af274ee02712b53b60d72fe59306fea`

Accepted W3-10 results include Preview Platform routing through the existing performance framework on Windows/macOS, truthful bounded ZIP progress, six representative byte-provider rename/move/fresh-open cases using existing mutation authority, 100-entry latest-wins/mixed-provider switching, repeated-cycle resource steady state, bounded Folder/ZIP scale and a W3-10-owned exact-head local real-browser dual-viewport timing/interaction matrix. Frozen shell/useful p95 targets were measured and met. Post-merge W3-11 review later identified that permanent-delete remained `UNVERIFIED`, so the broader frozen close/dispose → rename/move/delete/open criterion is reopened by W3-R1.

## W3-11 closeout / W3-R1 reopening record

**W3-11 — Preview Platform Closeout — MERGED through PR #137, conclusion reopened.** The PR was docs/governance-only and the product/runtime baseline remained W3-10 `master@a825f5414af274ee02712b53b60d72fe59306fea` / tree `79f1ca9a9ff97b695b1fca38090d007a1723559e`. Post-merge Codex review `#5009168468` / inline blocker `#3844601370` identified that the frozen close/dispose → rename/move/delete/open criterion was marked `HARD PASS` while permanent-delete evidence remained `UNVERIFIED`.

**W3-R1 — Close → Mutate Evidence Remediation — ACTIVE / AUTHORIZED.** It is limited to closing that evidence defect through existing mutation/fs-safety authority. W4 is not activated.

Taskbook: [`../tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md`](../tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md).

### Track table (reopened by W3-R1)

| Track | Final state | Evidence |
|---|---|---|
| W3-00 Activation / freeze | COMPLETE | PR #118 |
| W3-01 Core consumer-readiness | COMPLETE | PR #119 |
| W3-02 Floating Quick Preview | COMPLETE | PR #121 |
| W3-03 Pinned + sibling navigation | COMPLETE | PR #123 |
| W3-04 Text/Code/Markdown | COMPLETE | PR #125 |
| W3-05 Structured/Table | COMPLETE | PR #127 |
| W3-06 Image | COMPLETE | PR #129 |
| W3-07 Folder | COMPLETE | PR #131 |
| W3-08 ZIP Archive | COMPLETE | PR #132 |
| W3-09 Integration hardening | COMPLETE | PR #134 |
| W3-10 Performance / cross-platform QA | COMPLETE | PR #136, reviewer #5007633103 |
| W3-11 Closeout | MERGED / conclusion reopened | PR #137, post-merge blocker #3844601370 |
| W3-R1 Close → Mutate evidence remediation | ACTIVE / AUTHORIZED | taskbook W3-R1 |

### Final host/provider matrix

| Area | Final W3 truth |
|---|---|
| Hosts | Zen Floating + Zen Pinned/Context; one shared PreviewExperienceController consumer; W4 native/system hosts inactive |
| Metadata | fallback representation; no content read required |
| Text/source code | `builtin.text` / `builtin.source-code`; bounded read-only text |
| Markdown | `builtin.markdown`; sanitized inert `safe_html` |
| JSON/YAML/XML | bounded strict `structured_tree`; YAML/XML hostile-resource rules enforced |
| CSV/TSV | bounded strict `table`; formula-looking values remain inert text |
| Image | `builtin.image`; PNG/JPEG only, bounded decode and opaque asset tuple |
| Folder | `builtin.folder`; direct-child-only progressive bounded summary through BrowseService |
| ZIP | `builtin.archive-zip`; bounded central-directory metadata only, no extraction/decompression |

### Final provider bounds ledger

| Provider family | Final reviewed runtime bounds / restrictions |
|---|---|
| Text / source code / Markdown | source prefix <=512 KiB; read-only text or sanitized `safe_html`; no executable/resource-bearing Markdown output |
| JSON / YAML / XML | source prefix <=512 KiB; depth 64; <=10,000 structured nodes; <=1 KiB keys/XML names; <=16 KiB scalar/text; <=128 XML attributes/element; encoded payload <=1 MiB; YAML aliases inert; XML `DOCTYPE`/unknown entities rejected with no external resolver |
| CSV / TSV | source prefix <=512 KiB; <=500 rows × 64 columns; <=16 KiB/cell; encoded payload <=1 MiB; formula-looking values inert text |
| Image PNG/JPEG | <=12 MiB total source bytes in <=1 MiB reads; source edge <=8192 px and <=24,000,000 pixels; normalized output edge <=4096 px and <=12,000,000 pixels; published asset <=12 MiB; one decoder slot through existing WorkScheduler and opaque request/sourceVersion-bound asset lifecycle |
| Folder | direct children only; <=100,000 inspected; Browse page size 256; sample <=32; extension buckets <=16; largest-observed <=10; project hints <=8; names <=512 chars; extensions <=64 chars; encoded summary <=256 KiB; <=8 progressive publications at milestones 1/1k/10k/50k/100k; 100 ms deadline return guard; one temporary Preview-owned Browse session; no recursion |
| ZIP Archive | <=20,000 inspected entries; <=2,000 tree nodes; depth <=64; entry names <=4 KiB / 2,048 chars; extra metadata <=16 KiB; archive comment <=16 KiB; central directory <=8 MiB; total source reads <=12 MiB with <=1 MiB/read; reader cache 0 bytes; encoded tree <=1 MiB; <=32 warnings; <=512 children/node; 100 ms return guard; metadata only, no extraction/body decompression/nested recursion |

### Release-criterion verdict table (W3-R1 reopening)

| Criterion | Verdict | Final evidence / qualification |
|---|---|---|
| Preview Core remains sole lifecycle/provider/publication authority | HARD PASS | `PreviewSession` + one production Provider Registry remain authoritative; no closeout production change |
| Strict Rust/TypeScript representation contract | HARD PASS | exhaustive reviewed representation/warning wire and strict versioned structured/table/folder/archive payload decoders |
| Truthful Host ∩ Provider ∩ Source capabilities | HARD PASS | Zen Floating/Pinned matrices remain source/provider-clamped; W4 hosts fail closed |
| No renderer raw path / general read-lease authority | HARD PASS | all byte providers stay behind `MaterializationReadGate`; renderer receives only typed/opaque representations/assets |
| Floating Preview from Library/Browse | HARD PASS | W3-02+ integrated coverage |
| Pinned Preview without second engine | HARD PASS | W3-03 typed staging handoff + source-owned bounded sibling projection |
| Space/Esc/focus/IME ownership | HARD PASS | W3-09 integration plus W3-10 rapid-switch/focus evidence |
| Text / source code / Markdown | HARD PASS | bounded Text/Code and sanitized inert SafeHTML |
| JSON/YAML/XML + CSV/TSV | HARD PASS | bounded parser/payload contracts; external entities/resources/formulas remain inert |
| Image PNG/JPEG | HARD PASS | bounded decode, scheduler admission, opaque asset/object-URL lifecycle |
| Folder progressive/bounded 100k | HARD PASS | 1k/10k/100k/>100k W3-10 runtime scale; direct-child-only; <=8 publications |
| ZIP bounded / no extraction | HARD PASS | 20,001 fixture truthfully inspects 20,000; no extraction/decompression; read/tree limits preserved |
| Recoverable vs terminal fallback matrix | HARD PASS | W3-09 terminal precedence and provider-local Metadata fallback remain distinct |
| No implicit materialization/network/code/macro execution | HARD PASS | no fabricated Download-to-Preview action; hostile provider fixtures remain inert/bounded |
| 100-entry rapid switching | HARD PASS | real-runtime normal + mixed-provider + deferred latest-wins suites; final source only |
| Close→dispose→mutate/open resource release | **BLOCKED / W3-R1 ACTIVE** | six representative byte-provider rename/move/fresh-open cases PASS on hosted Windows/macOS and macOS Folder rename PASS, but required permanent-delete evidence remained `UNVERIFIED`; Windows Folder directory mutation remains separately platform-limited where the existing file-only authority does not permit it |
| Repeated-cycle resource steady state | HARD PASS | sessions/read leases/assets/scheduler counters return to baseline after 100 cycles |
| Preview shell <=100 ms p95 | TARGET MET | W3-10 exact-head local real-browser, 3 warmups + 20 samples at both required viewports |
| Local useful representation <=300 ms p95 | TARGET MET | W3-10 exact-head local real-browser, 3 warmups + 20 samples at both required viewports |
| W1 Workspace Foundation / W2 / Query gates preserved | HARD PASS | routed W3-10 local/hosted performance validation; no thresholds weakened |
| W4 not pulled forward | HARD PASS | no Finder Quick Look / Explorer Preview Handler system-host implementation or activation |
| Evidence honesty for native/manual gaps | HARD PASS | W3 browser evidence remains LOCAL where applicable; native manual VoiceOver/Narrator/macOS gaps remain `UNVERIFIED` |

Historical inherited W1 `managed_scan_foreground_latency` TARGET-MISSED observations remain part of the program record; W3-10 did not redefine the threshold or convert timing variance into a structural PASS.

Evidence classification remains strict: W3 real-browser gates are **exact-head LOCAL** unless the hosted workflow actually ran that exact gate; hosted Windows/macOS Rust/release/performance evidence is not native-manual UI evidence.

### Residual / deferred ledger

- `UNVERIFIED`: native VoiceOver/Narrator/manual interactive macOS UI and unavailable genuine iCloud/File Provider/external APFS/exFAT/SMB/network fixtures.
- `BLOCKED / W3-R1`: W3-10 permanent-delete evidence must be converted from `UNVERIFIED` to a real hard assertion through existing mutation authority before W3 may close again.
- `UNVERIFIED / platform-limited`: Windows Folder directory mutation where the existing file-only authority does not expose that path; resource release remains required and macOS Folder rename remains HARD PASS.
- `DEFERRED / future reviewed scope`: Finder Quick Look and Windows Explorer Preview Handler (W4), PDF/Office/iWork/audio/video native strategy, authoritative renderer-callable materialization action if still absent, OCR/AI/RAG/plugin SDK.
- Unsupported product targets remain Intel macOS, Rosetta/universal binaries and Linux according to the current product plan.
- TD-015 remains open until its broader compatibility-retirement exit condition is independently satisfied.

Repository state after post-merge W3-11 review: **W3-R1 ACTIVE / AUTHORIZED**. W4 is next planned but remains not active/authorized.

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
