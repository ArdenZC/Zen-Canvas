# W3-06 — Image provider

Status: COMPLETE — merged through PR #129

Baseline: `master@aac6b06710f204f501bb2bf7d2e81af30edd31c7` (W3-05 current-truth closeout / PR #128)

Branch: `feat/w3-06-image-provider`

## Closeout record

W3-06 is closed as the accepted bounded raster Image Preview provider slice.

- PR: #129
- final reviewed head: `d80f9d4d117bb6a2ab58c7b6349e9e026f19d201`
- final reviewed tree: `e805364045eca968227031308a9d5a1fa6b131e4`
- merge-integration checkout: `7cb7970e0a6864727fe6b2c2483323baabd4ebb1`
- integration tree: `e805364045eca968227031308a9d5a1fa6b131e4`
- exact-head hosted CI: `32630836668` — success
- source/integration trees: equivalent (`tree_equivalent=true`)
- reviewer pass: #5002180141; code blockers = 0
- squash merge: `master@ebd14c4cacf9129c511e055b1b28c28f0841699e`
- frontend suite: `125 files / 1291 tests`
- focused W3-06 frontend tests: `12 passed`
- remediation tests: `14 passed`
- performance architecture tests: `25 passed`
- Rust desktop-runtime suite: `833 passed / 15 ignored / 0 failed`
- exact-head local real-browser gate: `1600×900` and `980×680`
- npm security audit: passed
- Rust audit: success with existing allowed dependency warnings retained

Accepted outcomes:

- `builtin.image` is the single reviewed Image provider and W3-06 production format scope is PNG plus JPEG/JPG only;
- source bytes remain behind `PreviewReadGateAdapter → MaterializationReadGate`; total source consumption is capped at 12 MiB and each <=1 MiB chunk performs a fresh request/sourceVersion-bound lease issue, authoritative resolve/revalidation/read and lease release;
- decode admission uses exactly one decoder resource slot from the existing runtime `WorkScheduler`; no second queue, semaphore, worker pool, scheduler or durable decode service was introduced;
- W3-06 freezes source/decode/output ceilings at 8192 px source width/height, 24,000,000 source pixels, 4096 px normalized output edge, 12,000,000 normalized output pixels, 12 MiB published image asset and one full image asset/request;
- PNG/JPEG format/dimension/header truth is validated before/through decode where supported, including malformed, truncated, mismatched and oversized-header/decompression-bomb fixtures that fail bounded before unsafe full allocation;
- `Complete` requires a fully consumed supported static source that was not reduced because of W3-06 limits; source truncation or downscale remains truthfully `Partial`;
- final bytes publish only through the existing opaque Preview asset registry and exact session/request/sourceVersion asset authority; stale/cancel/switch/dispose completion cannot become current;
- the shared Floating/Pinned renderer retrieves only the exact asset tuple, validates the returned reviewed media type, uses safe display-name alt text and creates/revokes renderer-local object URLs without a filesystem path, `file:` URL, data URL, local file server or renderer read lease;
- deterministic lifecycle coverage proves stale Image A cannot publish/render after switching to B and decoder capacity, Preview read leases, asset registry state and object URLs return to bounded baseline on success/failure/cancel/stale paths;
- the exact-head local real-browser gate passed Library/Browse, Floating/Pinned, Partial/fallback/latest-wins/no-source/sibling-navigation/compact ownership scenarios with no unexpected external requests;
- full local and hosted validation passed on the reviewed exact head; native interactive macOS visual verification was not executed and remains `UNVERIFIED`;
- no W3-07 Folder, W3-08 Archive, W4 system host, implicit hydration, schema migration, raw-path renderer authority or second Preview/read/materialization/scheduler authority was pulled forward.

Next authorized Track: **W3-07 — Folder Preview**.

This file remains the historical W3-06 implementation contract; closeout does not reopen its production scope.

## Goal

Deliver the bounded built-in raster Image Preview provider while preserving the existing W3 Preview Core, read/materialization, asset, scheduler and host authorities.

W3-06 must:

- render safe raster image Preview through the existing `image { assetToken, mediaType }` representation family;
- read source bytes only through the existing backend Preview read seam / `MaterializationReadGate`;
- perform bounded decode under the existing `WorkScheduler` decoder resource budget;
- publish only bounded opaque Preview assets through the existing W3-01 Preview asset registry/transport;
- render those retrieved asset bytes in the shared Floating/Pinned Preview path;
- remain shell-first, sourceVersion-bound, latest-wins, cancellable and disposable;
- never convert a source path into a WebView URL;
- never implicitly hydrate/download unavailable provider content.

W3-06 does **not** authorize W3-07 Folder Preview, W3-08 Archive Preview, W4 Finder/Explorer system-host integration, a new file server/protocol, renderer raw paths, renderer read leases, a second scheduler or a second decode/read/materialization authority.

---

# 0. Mandatory read set

Before production edits, read at minimum:

1. `docs/project/STATUS.md`
2. `docs/project/ROADMAP.md`
3. `docs/project/initiatives/W3-preview-platform.md`
4. `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
5. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
6. `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
7. `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
8. `docs/project/tasks/W3-01-PREVIEW-CORE-CONSUMER-READINESS-CODEX.md`
9. `docs/project/tasks/W3-02-ZEN-FLOATING-QUICK-PREVIEW-HOST-CODEX.md`
10. `docs/project/tasks/W3-03-PINNED-PREVIEW-SIBLING-NAVIGATION-CODEX.md`
11. `docs/project/tasks/W3-04-TEXT-CODE-MARKDOWN-PROVIDERS-CODEX.md`
12. `docs/project/tasks/W3-05-STRUCTURED-TABLE-PROVIDERS-CODEX.md`
13. `src-tauri/src/file_workspace/preview.rs`
14. `src-tauri/src/file_workspace/preview_asset.rs`
15. `src-tauri/src/file_workspace/preview_providers.rs`
16. `src-tauri/src/file_workspace/read_gate.rs`
17. `src-tauri/src/file_workspace/integration/preview.rs`
18. `src-tauri/src/scheduler.rs`
19. existing Thumbnail scheduler/service seams under `src-tauri/src/file_workspace/thumbnail/**`
20. `src/types/fileWorkspace.ts`
21. `src/api/fileWorkspacePreviewWire.ts`
22. `src/api/fileWorkspaceApi.ts`
23. `src/views/fileLibrary/preview/PreviewContent.tsx`
24. W3-01 asset lifecycle tests and W3-04/W3-05 read-gate lifecycle tests.

Do not begin by adding `<img src={path}>`, a renderer file protocol, a data URL bridge or a new image-specific file reader.

---

# R0 — Consumer / authority preflight

Before implementation, prove the exact current seams on the merged baseline.

## R0.1 Existing representation / asset transport

Confirm:

- Rust and TypeScript already carry `Image { asset_token/assetToken, media_type/mediaType }` in the exhaustive Preview representation wire;
- `PreviewAssetRegistry` remains the one Preview-specific process-local asset owner;
- asset publication is exact `sessionId + requestId + sourceVersion` bound and returns an opaque token;
- asset retrieval requires the exact `sessionId + requestId + sourceVersion + assetToken` tuple;
- current registry hard bounds remain authoritative: 64 records, 16 MiB per asset, 32 MiB total, 30 second TTL;
- `fileWorkspaceApi.previewAssetRequest()` is the renderer-facing asset-byte retrieval seam;
- lifecycle revocation on switch/cancel/dispose already removes superseded Preview assets.

Do not replace or weaken this contract.

## R0.2 Existing byte-read seam

Confirm W3-06 can read image source bytes only through `PreviewContentReadAccess` / `PreviewReadGateAdapter` and `MaterializationReadGate`.

The shared read gate currently bounds each individual read to <= 1 MiB. If W3-06 needs more than one chunk, implement only a bounded backend helper that performs repeated offset reads through the **same** Preview read seam with:

- one explicit total-source-byte budget;
- sourceVersion / eligibility revalidation on every authoritative read;
- cancellation/deadline checks between chunks;
- no whole-file path/open bypass;
- no reusable renderer-visible lease.

Do not raise the global read-gate per-read limit merely to simplify image decoding.

## R0.3 WorkScheduler decoder admission

The frozen W3 plan requires image decode/resource slots through the existing `WorkScheduler`. Confirm how a Preview provider can acquire/release a decoder resource admission using the existing scheduler and Preview cancellation authority.

`WorkScheduler` is already the global expensive-work admission authority and its default resource budget includes decoder slots.

If the exact provider-consumable scheduler seam is missing, W3-06 MAY add only the smallest backend-only adapter/handle at the existing integration/runtime boundary that:

- delegates admission to the existing `WorkScheduler`;
- requests a bounded interactive Preview work item with one decoder slot;
- observes the existing Preview cancellation/deadline signal;
- releases the scheduler lease deterministically by RAII;
- adds no second queue, semaphore, worker pool, scheduler or retry authority.

If a correct implementation would require moving scheduler authority, introducing a durable decode service, or adding an independent worker subsystem: **STOP and report**.

---

# 1. Provider composition / probe

Register the Image provider only through the existing production Preview Provider Registry owner.

Use stable provider identity:

```text
builtin.image
```

Choose a deterministic priority that does not disturb existing Markdown / Structured / Table / SourceCode / Text precedence for their own exact hints. A reasonable v1 priority is `280`, below Markdown `300` and above structured providers, because image hints are disjoint; nearby changes require deterministic registry/probe tests.

Provider contract:

- supports `zen_floating` and `zen_pinned` only;
- `reads_content = true`;
- cheap probe based only on reviewed extension/media-type hints and source capability truth;
- extension/media type is selection hint only, never byte-read authority;
- actual decoder must sniff/validate source format rather than trusting extension alone;
- directory/ineligible/unsupported-host source fails closed through existing policy;
- W4 native host kinds remain unsupported.

---

# 2. W3-06 v1 format scope

Required v1 raster formats:

- PNG;
- JPEG/JPG.

Optional only if the chosen reviewed local decoder supports them safely under identical bounds and tests:

- WebP;
- GIF **first frame only**.

Animated playback is not W3-06 scope. If GIF/WebP animation is accepted, publish one static first-frame raster representation only; do not add timers, playback state or `media` representation semantics.

Explicitly defer unless separately proven in-scope without native/W4 expansion:

- SVG/SVGZ — active XML/resource-bearing format requiring a separate sanitization/security contract;
- HEIC/HEIF;
- RAW camera formats;
- PSD;
- PDF;
- TIFF or other large/multipage raster containers where the selected decoder path is not already safely bounded/reviewed.

Unsupported formats fall through provider-locally to Metadata. Do not use a native shell Quick Look/Explorer host merely to increase format count in W3-06.

---

# 3. Decoder dependency policy

The current Rust dependency set does not include a general raster decoder. A mature local Rust image decoder dependency is allowed if needed.

Any new dependency must:

- be narrowly feature-gated to the reviewed raster formats;
- be pinned through `Cargo.lock`;
- work on Windows and macOS Apple Silicon;
- perform no runtime network access;
- avoid SVG/vector/script/resource loading unless explicitly out of scope;
- pass RustSec/audit;
- not introduce a native helper process or downloaded codec bundle;
- not create its own unbounded thread pool.

Do not add a frontend image parser package. Decode/validation/resource-bounding belongs to the backend provider.

---

# 4. Hard source / decode / output bounds

Use named constants and freeze them with tests. Lower limits are acceptable; higher limits require reviewer justification.

Recommended W3-06 v1 ceilings:

```text
max total source bytes consumed     <= 12 MiB
max read chunk                      <= existing ReadGate per-read limit (1 MiB)
max source width                    <= 8192 px
max source height                   <= 8192 px
max decoded source pixels           <= 24,000,000
max normalized output edge          <= 4096 px
max normalized output pixels        <= 12,000,000
max published Preview asset bytes   <= 12 MiB
max full image Preview assets/request = 1
scheduler decoder slots/request     = 1
```

The provider must reject or provider-locally fail before allocating attacker-controlled decoded memory whenever the decoder offers a dimension/header probe.

A tiny compressed image declaring enormous dimensions is a decompression-bomb fixture, not a reason to allocate the declared raster.

No path may hold both an unbounded original decode and a second unbounded converted raster in memory.

The existing Preview asset registry limits (16 MiB single / 32 MiB total / 64 records / 30s TTL) remain upper global safety ceilings. W3-06's provider-local output cap should remain below the registry single-asset ceiling.

---

# 5. Decode / normalized representation policy

The backend must validate/decode the raster before publishing an Image representation. Do not simply forward arbitrary source bytes to `<img>` based on extension.

Recommended safe v1 flow:

1. read bounded source bytes through the Preview read seam;
2. sniff/validate raster format;
3. inspect dimensions before full decode where supported;
4. acquire one `WorkScheduler` decoder slot;
5. check Preview cancellation/deadline;
6. decode under the frozen pixel/dimension bounds;
7. normalize to a bounded static raster suitable for Preview asset publication;
8. strip/ignore metadata that is not needed for rendering;
9. publish the bounded bytes through `PreviewAssetPublisher` using the current operation context;
10. return `PreviewRepresentation::Image { asset_token, media_type }`.

A normalized PNG or JPEG output is acceptable. Prefer a representation that does not retain arbitrary EXIF/XMP/resource metadata or external profile references.

Do not follow embedded URLs, paths, EXIF references or external ICC/profile resources. Local color-profile support is optional; external profile loading is forbidden.

Orientation must be visually truthful. If the decoder does not apply EXIF orientation automatically, either apply the reviewed orientation transform locally or strip/normalize only after producing the correctly oriented raster. Do not expose raw EXIF path/data authority to React.

---

# 6. Completeness / downscale truth

Preview `Complete` means the published image representation is not silently missing source content because of W3-06 source/decode/output bounds.

Rules:

- source bytes not fully consumed because the total source budget was hit => never `Complete`;
- decode dimension/pixel/output limits forcing a reduced rendition => publish `Partial`;
- any crop/frame omission => `Partial`;
- first-frame-only handling of an animated image => `Partial`;
- `Complete` is allowed only when the full supported static source was consumed/decoded and the published representation was not reduced because of W3-06 limits;
- a Thumbnail placeholder must never be mislabeled as a complete Image representation.

The outer Image wire has no width/height/truncation DTO. Do not silently add fields to the strict outer wire in W3-06 merely for convenience. If the existing wire proves fundamentally insufficient to express a required correctness fact, **STOP and return for contract review**.

---

# 7. Thumbnail placeholder / shell-first behavior

The Preview shell remains host-owned and must not wait for decode.

Reusing existing Thumbnail infrastructure for a warm placeholder is optional.

If used:

- reuse the existing Thumbnail authority/cache/scheduler path;
- do not copy Thumbnail bytes into a second durable Preview cache;
- do not consume a Preview asset slot merely to mirror an existing thumbnail unless there is a reviewed reason;
- clearly treat the thumbnail as transient presentation/placeholder, not the final Image representation;
- stale thumbnail work must obey existing Thumbnail generation/source ownership.

A simple shell/loading state followed directly by the bounded full Image representation is acceptable for W3-06 v1.

---

# 8. Asset publication / retrieval truth

Publish image bytes only through the existing `PreviewAssetPublisher` / `PreviewAssetRegistry`.

Required invariants:

- asset token is opaque and process-local;
- representation `mediaType` equals the published artifact media type;
- asset publication is current request/sourceVersion-bound;
- stale/cancelled publication fails;
- source switch revokes superseded request/sourceVersion assets;
- dispose revokes session assets;
- old token cannot be read with a new requestId/sourceVersion;
- asset capacity/output-too-large errors are provider-local failures and must not bypass source terminal conditions;
- no asset token or blob URL is persisted.

Do not add:

- source path in the representation;
- `file://` renderer URLs;
- a custom renderer file server;
- generic local HTTP server;
- base64/data-URL source transport;
- renderer-visible filesystem handles;
- reusable renderer read leases.

---

# 9. Frontend Image renderer

Extend the existing shared `PreviewContent` path. Do not create separate Floating/Pinned image renderers.

The renderer must:

1. receive the current Image representation plus current exact Preview snapshot identity;
2. retrieve asset bytes only with existing `previewAssetRequest({ sessionId, requestId, sourceVersion, assetToken })`;
3. reject/ignore any response that is stale relative to the current Preview snapshot/epoch before it can replace a newer image;
4. verify returned media type is a reviewed W3-06 image media type and matches the representation's `mediaType`;
5. create a renderer-local `Blob` / `URL.createObjectURL()` from the **retrieved opaque Preview asset bytes**, never from a source path;
6. revoke the object URL on source/representation change, unmount, close and disposal;
7. render with `object-fit: contain` / fit-to-view by default;
8. use source display name for safe alt text, never a filesystem path;
9. keep page-level horizontal overflow impossible.

Controlled `blob:` URLs created from Preview asset bytes are allowed. Arbitrary `blob:` / `data:` / `file:` / HTTP(S) image sources are not.

Instrument browser tests so each created object URL is eventually revoked and rapid switching does not leave an unbounded blob-URL count.

Do not refetch the same current asset on every React re-render. Retrieval should be keyed to the exact Preview tuple/token and remain bounded.

---

# 10. Zoom capability

Fit-to-view is required.

Zoom is optional in W3-06 v1, but capability truth is mandatory:

- if no image zoom UI is implemented, provider effective `canZoom` must remain false;
- if zoom is implemented, `canZoom` may be true only when Host ∩ Provider ∩ Source supports it;
- zoom state is renderer-local disposable UI, not Preview source/navigation authority;
- use a bounded reviewed zoom range/step set;
- zoom must not trigger additional source reads or unbounded re-decodes;
- reset fit/zoom on source change;
- keyboard/focus controls must remain accessible and must not conflict with File Library Space/Esc ownership.

Do not claim zoom capability merely because `<img>` can be CSS-scaled.

---

# 11. Failure / terminal semantics

W3-04/W3-05 terminal truth remains binding.

Provider-local recoverable image failures include:

- unsupported raster format;
- malformed/corrupt image;
- decoder failure;
- decode timeout/deadline;
- source/image dimension/pixel/output bound exceeded;
- asset registry capacity/output-too-large.

These may fall through according to the existing provider/fallback matrix and ultimately Metadata.

Terminal source/session conditions do not fall through to another byte reader:

- SourceUnavailable / AvailabilityUnknown;
- MaterializationRequired / Downloading;
- PermissionDenied;
- IdentityChanged;
- Cancelled/stale publication.

`MetadataOnly` remains non-terminal Metadata fallback.

No implicit hydration/download action is introduced.

---

# 12. Lifecycle / stale publication / cleanup

Use deterministic barriers/channels/test-owned coordination; no sleeps for correctness.

Required cases:

- Image A read/decode pending -> switch B -> late A decode/publish cannot become current;
- A asset publish paused -> switch B -> old publication fails/stale and no old asset survives as current;
- asset retrieved for A -> UI switches B before response commit -> A blob/object URL cannot replace B;
- close/dispose during decode -> decoder scheduler lease, read lease, temporary decode buffers and Preview assets are released/revoked;
- corrupt/decode-failure path restores read lease and decoder scheduler capacity to baseline;
- asset registry capacity/output-too-large path leaks neither registry bytes nor scheduler/read leases;
- Pinned A -> B -> C/D continues to converge latest-wins through the existing W3-02/W3-03 transport;
- terminal drift after actual read lease issue retains W3-04 exact terminal semantics;
- no provider-global current source, retry queue or durable decode cache.

If the chosen decoder call cannot be interrupted mid-call:

- the source/dimension/pixel bounds and WorkScheduler decoder slot are mandatory;
- check cancellation/deadline immediately before and after decode and before asset publication;
- existing PreviewSession publication authority must reject stale completion;
- do not create detached/unbounded decoder threads to simulate cancellation.

---

# 13. Real backend / security fixtures

At minimum add deterministic Rust coverage for:

## Registry / probe

- `builtin.image` appears exactly once at reviewed priority;
- PNG/JPEG intended hints are compatible;
- mismatched/unsupported hints do not bypass decoder validation;
- Zen Floating/Pinned supported;
- W4 hosts fail closed.

## Valid images

- small PNG;
- small JPEG;
- alpha PNG;
- orientation-sensitive JPEG if orientation handling is implemented/required;
- optional WebP/GIF only if enabled.

## Hostile / bounds

- truncated PNG;
- truncated JPEG;
- malformed headers;
- extension/media-type mismatch;
- tiny compressed fixture declaring dimensions above width/height/pixel caps;
- image near and over source-byte total cap;
- decoded pixel cap exceeded;
- normalized output cap exceeded;
- asset output cap exceeded;
- suspicious metadata/profile content remains inert and causes no resource access;
- SVG input remains unsupported/fallback, not rendered as active Image.

## Asset transport

- exact tuple retrieval succeeds;
- wrong requestId/sourceVersion/token fails;
- switch/cancel/dispose revokes the superseded asset;
- registry records/bytes return to baseline;
- one request cannot publish an unbounded number of full image assets.

## WorkScheduler

Use a test-owned scheduler configuration where practical to prove:

- one image decode holds exactly one decoder resource lease;
- capacity is respected;
- cancellation while waiting exits without consuming a slot;
- completion/failure/cancel returns decoder capacity to baseline;
- no independent semaphore/queue exists in the Image provider.

## Read authority

Exercise the real W3 Preview read adapter / MaterializationReadGate path, including chunked reads if used:

- read lease observed active;
- success/failure/cancel/stale switch returns lease count to baseline;
- post-lease terminal drift remains exact;
- no second reader/path bypass.

---

# 14. Frontend tests

Add focused tests that prove:

- `image` representation enters the normal `content` phase;
- asset request uses the exact current Preview tuple/token;
- media-type mismatch fails closed;
- valid opaque bytes render through a controlled object URL;
- source name is escaped/safe alt text;
- stale asset response cannot replace a newer source;
- object URLs are revoked on source change/unmount;
- repeated re-render does not duplicate asset fetch/object URL creation;
- fit-to-view is the default;
- Partial state is visible when the provider returns Partial;
- optional zoom controls only appear when effective `canZoom=true`.

Floating and Pinned must consume this one shared renderer path.

---

# 15. Real-browser W3-06 gate

Add:

`npm run test:browser:w3-06:real`

Run exact-head at:

- `1600×900`;
- `980×680`.

Cover at minimum:

- Library PNG Floating;
- Library JPEG Floating;
- Floating -> Pinned Image;
- Browse PNG/JPEG Floating/Pinned;
- fit-to-view;
- optional zoom if implemented;
- source-follow and bounded Previous/Next;
- corrupt/oversized/unsupported image -> truthful Metadata fallback;
- Partial disclosure for a bounded/reduced rendition when applicable;
- rapid A->B rich Image switching with no stale image flash;
- no-source and Unpin;
- compact Context single modal/focus owner;
- one Preview host only;
- no page-level horizontal overflow;
- no console/page errors.

Instrument request/navigation and object-URL lifecycle:

- no HTTP(S) resource/navigation caused by image source data;
- no `file:` source access;
- no arbitrary `data:` URL;
- controlled `blob:` URL is allowed only when created from bytes returned by `previewAssetRequest`;
- created object URLs are revoked after source replacement/unmount;
- final live object-URL count remains bounded (ideally zero after close/unpin teardown).

Browser mocks validate renderer/host integration; decoder/security/resource guarantees remain Rust-test-owned.

---

# 16. Performance evidence

Preserve all existing W0/W2/W3 thresholds.

W3 plan target for local built-in image useful representation is <= 300 ms p95; do not claim PASS unless measured by the applicable reviewed performance harness/fixture.

Add focused bounded evidence where practical for:

- near-limit PNG/JPEG source/decode;
- repeated image Preview cycles;
- 100-entry rapid source switching;
- decoder scheduler slot steady state;
- asset registry records/bytes steady state;
- renderer blob/object-URL steady state.

Shell-first remains host-owned and must not wait on image decode.

Do not lower existing Query V2, File Library or Workspace Foundation performance gates.

---

# 17. Expected implementation areas

Likely production scope:

- one bounded backend image provider module under `src-tauri/src/file_workspace/`;
- existing `preview_providers.rs` / `preview_policy.rs` registry composition;
- existing Preview read adapter / read-gate helper only if bounded multi-chunk source reads need a shared backend helper;
- existing Preview environment/integration seam only if the R0 WorkScheduler adapter is genuinely missing;
- `Cargo.toml` / `Cargo.lock` only for the reviewed local raster decoder dependency;
- shared `PreviewContent.tsx` image representation path or one small shared disposable image-asset component;
- shared Preview styles/i18n;
- browser/mock fixtures and focused Rust/TS tests;
- `package.json` + W3-06 real-browser gate.

Do not modify current-truth `STATUS.md`, `ROADMAP.md`, W3 initiative closeout records or frozen W3 specs inside the implementation PR.

---

# 18. Stop / architecture-review conditions

STOP and report instead of implementing if W3-06 appears to require:

- renderer-visible source filesystem path;
- `file://` or arbitrary local HTTP source URL;
- generic new Tauri byte-read command;
- renderer-issued/reusable read lease;
- second `MaterializationReadGate` / read authority;
- second Preview asset registry/file server;
- second WorkScheduler/semaphore/thread-pool authority;
- durable image Preview database/cache/schema migration;
- automatic cloud/provider hydration;
- external codec download/service;
- active SVG/script/resource rendering;
- unbounded decode worker threads;
- W3-07 Folder provider;
- W3-08 Archive provider;
- W4 Finder/Explorer system-host work;
- supported-platform or mutation/recovery ownership change.

If the existing Image representation or Preview asset transport is fundamentally insufficient for truthful W3-06 behavior, stop for contract/ADR review rather than silently widening the wire.

---

# 19. Validation

Run focused image provider/asset/read/scheduler/renderer tests first.

Then at minimum:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend
npm run test:browser:w3-06:real
npm run test:governance

cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings

npm run security:audit
npm run security:audit:rust

git diff --check
git diff --check origin/master...HEAD
```

If CI routing marks additional Windows/macOS release, native, dependency, package or performance lanes applicable, they must pass on the final exact head.

Clean task-owned temporary artifacts and leave the worktree clean.

---

# 20. PR / evidence contract

Implement directly on the existing branch:

`feat/w3-06-image-provider`

Do not create another implementation branch.

When implementation/local validation is complete:

1. commit normally;
2. no force push;
3. push this existing branch;
4. create exactly one **Draft PR** against `master`;
5. keep it `OPEN / DRAFT / UNMERGED`;
6. obtain fresh exact-head hosted CI;
7. report final HEAD/tree and source/integration checkout evidence;
8. report exact changed files;
9. report provider ID/priority and exact supported format set;
10. report exact source/read/dimension/pixel/output/asset/scheduler bounds;
11. report decoder dependency/features and RustSec/audit evidence;
12. report WorkScheduler decoder-slot admission evidence;
13. report real `PreviewReadGateAdapter`/MaterializationReadGate evidence;
14. report Preview asset exact-tuple publication/retrieval/revocation evidence;
15. report hostile/corrupt/oversized/decompression-bomb fixtures;
16. report image completeness/downscale policy evidence;
17. report stale switch/cancel/close/dispose cleanup evidence;
18. report renderer object-URL stale/revocation/bounded-fetch evidence;
19. report Floating/Pinned/browser evidence;
20. classify all deferred/unverified native/manual evidence honestly.

Do not Ready.
Do not merge.
Do not start W3-07+.
Do not perform current-truth closeout inside the implementation PR.

Return implementation evidence only after the Draft PR exists.