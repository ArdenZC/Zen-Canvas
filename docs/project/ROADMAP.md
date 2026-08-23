# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate a later Wave merely because an earlier Wave completes. Long-horizon product direction and Wave boundaries remain owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-08-24

## Completed

### G1 — Engineering OS

**COMPLETE.** Project-state, architecture-ownership, technical-debt, workflow and closeout rules are durable.

### M1 / M1.1 — Mutation correctness and portability closeout

**COMPLETE.** Mutation correctness, provider and portability remediation are closed at their reviewed baselines.

### W0 — File Library / Preview specification

**COMPLETE.** W0 froze Library/Browse product IA, identity contracts, Preview Core/Host boundaries, Read/Materialization, Thumbnail/WorkScheduler ownership, performance gates and Wave sequencing.

### W1 — File Library / Preview Foundation

**COMPLETE.** W1 delivered the shared runtime foundation: WorkspaceSession, Browse Core, Location Core, WorkScheduler, Preview Contract Core, Materialization/Read Gate, Thumbnail Infrastructure, change/refresh and scale/performance validation.

W1 residual scheduler/provider evidence remains part of the program record and is not rewritten by later Waves.

### W2 — File Library 2.0 Experience

**COMPLETE through W2-12 closeout PR #117.**

Product/runtime baseline:
`master@1898c290859be204e1778b4b72fc58d22dc08b71`
(PR #116 W2-11 squash merge).

Governance/closeout baseline:
`master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`
(PR #117 W2-12 squash merge).

Authority record:
[`initiatives/W2-file-library-experience.md`](initiatives/W2-file-library-experience.md).

Final closeout evidence:
[`tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md`](tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md).

W2 delivers one File Library workspace with Library/Browse modes, shared virtualized List/Grid, Context/Inspector, platform-adaptive navigation, managed Query V2 semantics, bounded Browse search, deterministic interaction ownership and integrated 100k/1M evidence.

Residual evidence remains explicit, including Recent `DEFERRED`, unavailable native/provider fixtures `UNVERIFIED`, native manual accessibility/display evidence `UNVERIFIED`, historical W1 scheduler `TARGET MISSED` observations and open TD-015 compatibility retirement.

## Current

### W3 — Preview Platform

Status: active — implementation

Authority record:
[`initiatives/W3-preview-platform.md`](initiatives/W3-preview-platform.md).

Durable implementation plan:
[`specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`](specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md).

Quick Preview experience freeze:
[`specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`](specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md).

Activation baseline:
`master@e54c788db637e6c6140cf618dd3d7125ea1df8e3`
(PR #118 W3-00 squash merge).

W3-01 runtime baseline:
`master@fb48696795e19aa5fabac5966d31665a6b95e81e`
(PR #119 W3-01 squash merge).

W3-02 runtime baseline:
`master@fe4cb4a7d16976f5dcc9a9dbbc4b2b47937a850e`
(PR #121 W3-02 squash merge).

W3-03 runtime baseline:
`master@ee841f230277ecb9c6e9d731ef90f66a34814510`
(PR #123 W3-03 squash merge).

W3-04 runtime baseline:
`master@48e8291f8d1f0367a24eca6329640641468b78ce`
(PR #125 W3-04 squash merge).

W3-05 runtime baseline:
`master@dde7ecb29e30a0b660fd8123b9203f5f97944a20`
(PR #127 W3-05 squash merge).

W3-06 runtime baseline:
`master@ebd14c4cacf9129c511e055b1b28c28f0841699e`
(PR #129 W3-06 squash merge).

W3-07 runtime baseline:
`master@ced5478abfa7ac42fa9295ad5ec7b87c5e7dbee3`
(PR #131 W3-07 squash merge).

Current W3 runtime baseline:
`master@7078706992d129e47ba49b65ff3fec5eff0f40ec`
(PR #132 W3-08 squash merge).

W3-07 / W3-08 parallel-integration closeout evidence:
[`tasks/W3-07-W3-08-CURRENT-TRUTH-CLOSEOUT-RESULT.md`](tasks/W3-07-W3-08-CURRENT-TRUTH-CLOSEOUT-RESULT.md).

W3 turns the merged W1 Preview Core and completed W2 File Library workspace into the user-facing Zen Quick Preview platform. It does not authorize Finder/Explorer system integration.

W3 dependency graph:

```text
W3-00  Activation + Architecture/Experience Freeze             ✅ PR #118
  ↓
W3-01  Preview Core Consumer-Readiness                          ✅ PR #119
       ├─ production registry composition
       ├─ truthful Zen Host / Source capabilities
       ├─ exhaustive strict Rust/TS representation wire
       ├─ bounded Preview-specific asset transport
       └─ bounded progressive publication contract
  ↓
W3-02  Zen Floating Quick Preview Host                          ✅ PR #121
       ├─ one renderer-owned PreviewExperienceController
       ├─ Space/Esc + focus/command ownership
       ├─ shell-first Library/Browse Floating Preview
       ├─ request/source-bound stale publication rejection
       └─ serialized latest-wins source-switch transport
  ↓
 ┌───────────────────────────┬───────────────────────────┬───────────────────────────┐
 ↓                           ↓                           ↓                           ↓
W3-03 Pinned Preview +       W3-04 Text/Code +           W3-05 Structured +          W3-06 Image
      sibling navigation           Markdown                    Table providers             provider
      ✅ PR #123                   ✅ PR #125                   ✅ PR #127                   ✅ PR #129
 └───────────────┬───────────┴───────────────┬───────────┴───────────────┬───────────┘
                                   ↓
                         ┌─────────┴─────────┐
                         ↓                   ↓
                    W3-07 Folder        W3-08 ZIP
                    Preview provider     Archive provider
                    ✅ PR #131           ✅ PR #132
                         └─────────┬─────────┘
                                   ↓
W3-09  Failure / Materialization / Security / Accessibility Integration   NEXT
  ↓
W3-10  Preview Performance + Cross-platform QA
  ↓
W3-11  W3 Closeout
```

#### W3-00 — Activation / freeze — COMPLETE

Docs/governance-only activation merged through PR #118. It activated W3, recorded the consumer-readiness audit, froze Quick Preview behavior and established the dependency graph.

#### W3-01 — Preview Core Consumer-Readiness — COMPLETE

Merged through PR #119 as
`master@fb48696795e19aa5fabac5966d31665a6b95e81e`.

Final accepted outcomes:

- one bounded Provider Registry production composition owner;
- truthful `zen_floating` / `zen_pinned` Host capability matrices;
- truthful backend source capability projection;
- exhaustive Rust/TypeScript `PreviewRepresentation` + warning wire;
- bounded opaque Preview asset transport with no renderer source paths;
- progressive request/sourceVersion-bound publication semantics;
- lifecycle ordering and TOCTOU protection for cancel/switch/dispose/Browse teardown;
- deterministic switch cleanup that preserves concurrently valid new-request assets;
- no rich provider, user-facing Preview host, W4 native host, schema or second read/materialization authority.

Exact-head CI `32564728867` passed on reviewed head
`09be79b9415d55a7e0ef5271f465b557c1ee6d57` / tree
`6add03115a69fe226b5c040ee8bb23d66e373704`.

#### W3-02 — Zen Floating Quick Preview Host — COMPLETE

Merged through PR #121 as
`master@fe4cb4a7d16976f5dcc9a9dbbc4b2b47937a850e`.

Final accepted outcomes:

- one renderer-owned `PreviewExperienceController` and one Zen Floating Quick Preview shell;
- Library managed and Browse ephemeral source projection through existing opaque identities;
- Space opens/toggles only with a valid source-owned logical focus and preserves input/IME/menu/system ownership;
- Esc/Close/Space toggle-close share deterministic close/dispose/focus-restoration behavior;
- shell-first behavior is deterministic and the shell remains mounted while source work is pending or switching;
- Metadata fallback remains the truthful normal production representation while the rich-provider registry remains intentionally empty;
- stale starts/switches cannot overwrite current Preview cache/UI state;
- `FileWorkspaceController` serializes source-switch mutations per `previewId` and coalesces pending requests latest-wins, so frontend state, cache and backend session converge on the newest source;
- no Rust/Tauri, pinned Preview, sibling navigation, rich provider, schema, raw-path or W4 expansion.

Exact-head hosted CI `32585239510` passed on reviewed head
`3adc8ef015cf772933dc5d966289b330d40cc71c` / tree
`37eb86d4993616024ca4101955304722a27e16a1`; merge-integration checkout
`aa9469b21ce9486a7f9cf2d819c948ec682d69fe` had the same tree, with
`tree_equivalent=true` and `head_validation_required=false`.

#### W3-03 — Pinned Preview + sibling navigation — COMPLETE

Merged through PR #123 as
`master@ee841f230277ecb9c6e9d731ef90f66a34814510`.

Final accepted outcomes:

- Pinned Preview is the existing W2 Context Panel `Preview` state and reuses the single W3 `PreviewExperienceController` rather than creating another Preview surface/authority;
- Floating→Pinned uses a typed bounded staged handoff: a truthful `zen_pinned` backend session is created before Context commit, rejected/stale handoffs clean staging and preserve Floating, and successful commit disposes the superseded Floating session;
- exactly one visible/current Preview host remains after handoff;
- Pinned no-source clears stale content and later source recovery creates a new truthful `zen_pinned` session;
- Library/Browse source-owned focus remains authoritative while Pinned follows the current source;
- sibling navigation is a bounded projection over the current source-owned collection, never a second Query/Browse engine and never materializes `all_matching`;
- Browse active-query Next reuses the existing owner enumeration and bounded `QUERY_SCAN_PAGE_BATCH = 8` progression to cross empty intermediary pages while generation/session/enumeration drift fails closed;
- Pinned rapid A→B→C/D switching continues to use the W3-02 latest-wins transport and deterministic tests prove PreviewExperience, controller cache and backend record converge on D with `hostKind: zen_pinned`;
- Metadata fallback remains truthful and no W3-04+ provider, Rust/Tauri command, raw-path authority or W4 system integration was pulled forward.

Exact-head hosted CI `32593460617` passed on reviewed head
`9bdc5f7c80d393bfefcf6ee7b5cdc89653c34fa6` / tree
`f4325b7ab8ea099ab781ac48824f2ae3d7e92fb0`; merge-integration checkout
`7c36076ab2bacb4d07d9241d63ee9769f4172ee1` had the same tree, with
`tree_equivalent=true` and `head_validation_required=false`.

Native macOS manual visual verification was not executed and remains `UNVERIFIED`; hosted macOS release compile is not reclassified as native visual proof.

#### W3-04 — Text/Code + Markdown providers — COMPLETE

Merged through PR #125 as
`master@48e8291f8d1f0367a24eca6329640641468b78ce`.

Final accepted outcomes:

- production Preview now has one static bounded provider set through the existing registry owner: `builtin.markdown` priority 300, `builtin.source-code` priority 200 and `builtin.text` priority 100;
- the existing `MaterializationReadGate` remains the single source/lease/open/bounded-read authority; W3-04 added only a backend Preview adapter and one shared authoritative `read_bounded_with_mapping` path, not a renderer byte API or second read authority;
- provider reads are request/sourceVersion-bound, short-lived and capped to a 512 KiB source prefix; truncated output is truthfully `Partial`, invalid UTF-8/binary-looking input falls through safely and huge lines keep one bounded DOM/text shape;
- Text/Code publishes read-only typed `text` with a presentation-only language hint and no execution/tool/language-server authority;
- Markdown uses `pulldown-cmark` plus `ammonia` to emit sanitized `safe_html`; executable/resource-bearing tags/attributes, remote/file/relative resources and automatic navigation are removed or inert;
- Floating and Pinned render the same typed Text/SafeHTML representation through the existing shared Preview content path;
- provider-local failure retains Metadata fallback while source/session terminal truth remains exact, including fresh MaterializationRequired/Downloading, PermissionDenied, IdentityChanged, SourceUnavailable/AvailabilityUnknown and MetadataOnly semantics at lease issue and post-lease revalidation;
- deterministic barrier tests prove active Preview lease count returns to baseline after success, post-read provider failure and stale/source-switch/terminal drift after an actual lease is issued;
- real-browser hostile Markdown produced no unexpected HTTP(S), `file:`, relative, data/blob or equivalent resource request/navigation at 1600×900 and 980×680;
- no W3-05+ provider, W4 system host, raw path, schema, implicit hydration, second Preview/query/read authority or renderer lease API was pulled forward.

Exact-head hosted CI `32617793286` passed on reviewed head
`bb0fa0ac9a46fb5a4c17ddfa1c634c20d2f3bce7` / tree
`62049ff892d17ceb9c28255c97780f4613248b27`; merge-integration checkout
`ba2f743138b718710d22aaeab66396c26304d400` had the same tree, with
`tree_equivalent=true`.

Rust desktop-runtime tests closed at `805 passed / 15 ignored`; frontend tests closed at `123 files / 1284 tests`; remediation, performance architecture, build, governance, npm audit, Rust audit, Windows/macOS Rust/release and Workspace Foundation performance lanes passed. Rust audit retains the existing allowed advisory warnings rather than reclassifying them.

#### W3-05 — Structured + Table providers — COMPLETE

Merged through PR #127 as
`master@dde7ecb29e30a0b660fd8123b9203f5f97944a20`.

Final accepted outcomes:

- the single production registry now adds `builtin.structured-json` (260), `builtin.structured-yaml` (250), `builtin.structured-xml` (240), `builtin.table-csv` (230) and `builtin.table-tsv` (220) without creating another provider selector or read authority;
- `structured_tree` and `table` keep the existing outer Preview wire while Rust produces strict versioned `StructuredTreePayloadV1` / `TablePayloadV1` JSON payloads and one shared frontend decoder validates schema, fields, counts and string lengths before rendering;
- structured/table source reads remain request/sourceVersion-bound behind the W3-04 Preview adapter and `MaterializationReadGate`, capped to a 512 KiB prefix, with truthful `Complete`/`Partial` and provider-local Metadata fallback;
- v1 representation limits are frozen at depth 64, 10,000 structured nodes, 1 KiB keys/XML names, 16 KiB scalar/text/cell values, 128 XML attributes per element, 500 table rows, 64 columns and 1 MiB encoded payload ceilings;
- JSON uses bounded visitor construction with deterministic duplicate-key preservation and fails provider-locally before unsafe recursive parser depth;
- YAML consumes `yaml-rust2` events iteratively through `next_token()`, never expands aliases, rejects custom tags/multi-document input, and deterministic hostile 900-level nesting / node-budget fixtures remain bounded and truthfully Partial;
- XML is event-parsed in memory, rejects `DOCTYPE` and unknown general entities, has no external resolver, and hostile HTTP/file/relative DTD/entity or internal-entity fixtures cannot trigger resource resolution;
- CSV/TSV reuse the Rust CSV parser, bound rows/columns/cells, preserve ragged rows and render formula-looking `=`, `+`, `-`, `@` values as inert text rather than executable spreadsheet semantics;
- incomplete structured prefixes no longer fabricate empty objects/elements; an honestly parsed prefix may remain Partial, otherwise the provider falls back through Metadata;
- deterministic W3-05 lifecycle tests run through the real `PreviewReadGateAdapter → MaterializationReadGate` path and prove an actually issued lease returns to baseline after success, parser failure, stale source switch, cancel and post-lease terminal drift, with no stale publication;
- the shared Floating/Pinned renderer keeps XML/cell content escaped/inert and the exact-head browser gate passed Library/Browse provider scenarios at 1600×900 and 980×680 with no unexpected external/resource navigation, focus-owner duplication or page-level horizontal overflow;
- no W3-06+ provider, W4 system host, raw-path renderer authority, generic Tauri byte-read API, implicit hydration, schema migration or second Preview/read/query/materialization authority entered the Track.

Exact-head hosted CI `32624221341` passed on reviewed head
`3d94c5e1399230bff0aa8ffbae5b01bd8d775a2a` / tree
`2c708e3ec83c6cd27efd91de89c41c9685a48735`; synthetic merge-integration checkout
`1da89e6cd942b9e415fe7c718441f73a433d4bee` had the same tree, with
`tree_equivalent=true`.

Frontend tests closed at `123 files / 1288 tests`; Rust library tests closed at `822 passed`; formatting, Clippy `-D warnings`, remediation, performance architecture, build, governance, npm/Rust audits, Windows/macOS Rust/release, native macOS and Workspace Foundation performance lanes passed. Rust audit retains the existing 15 allowed advisory warnings rather than reclassifying them. Native macOS manual visual verification remains `UNVERIFIED`.

#### W3-06 — Image provider — COMPLETE

Merged through PR #129 as
`master@ebd14c4cacf9129c511e055b1b28c28f0841699e`.

Final accepted outcomes:

- the single production provider registry adds `builtin.image` for PNG and JPEG/JPG only; unsupported and mismatched formats fail provider-locally rather than turning source paths into renderer image URLs;
- all source bytes stay behind `PreviewReadGateAdapter → MaterializationReadGate`; image input is read in at most 1 MiB chunks and every chunk obtains a fresh request/sourceVersion-bound lease, performs authoritative resolve/revalidation/read and releases that lease before continuing;
- image work consumes exactly one decoder resource slot from the existing runtime `WorkScheduler`; no provider-local scheduler, semaphore, worker pool or durable decode authority was introduced;
- W3-06 freezes provider-local ceilings at 12 MiB total source bytes, 8192 px source width/height, 24,000,000 decoded source pixels, 4096 px normalized output edge, 12,000,000 normalized output pixels, 12 MiB published image asset bytes and one full image asset/request;
- PNG/JPEG format and dimensions are validated before full decode where supported, including hostile oversized-header/decompression-bomb fixtures; corrupt/truncated/format-mismatched input remains bounded and falls back safely;
- `Complete` requires a fully consumed supported source with no W3-06 representation reduction; source truncation or downscale is truthfully `Partial`;
- image bytes publish only through the existing opaque Preview asset registry under the exact session/request/sourceVersion tuple, and stale/cancelled/superseded publication cannot become current;
- the shared Floating/Pinned renderer retrieves only the exact opaque asset tuple, validates returned media type, creates renderer-local object URLs and revokes them on source change/unmount/error without exposing a filesystem path, renderer read lease, data URL or local file server;
- stale Image A cannot publish/render after switching to B, while scheduler/read/asset/object-URL resources return to their bounded lifecycle baseline on success, failure, cancel and stale switch;
- exact-head local real-browser coverage passed Library/Browse, Floating/Pinned, Partial/fallback/latest-wins/no-source/sibling-navigation/compact ownership at 1600×900 and 980×680 with no unexpected external requests;
- no W3-07+ Folder/Archive provider, W4 system host, implicit hydration, schema migration, raw-path renderer authority or second Preview/read/materialization/scheduler authority entered the Track.

Reviewer pass #5002180141 recorded code blockers = 0.

Exact-head hosted CI `32630836668` passed on reviewed head
`d80f9d4d117bb6a2ab58c7b6349e9e026f19d201` / tree
`e805364045eca968227031308a9d5a1fa6b131e4`; synthetic merge-integration checkout
`7cb7970e0a6864727fe6b2c2483323baabd4ebb1` had the same tree, with
`tree_equivalent=true`.

Frontend tests closed at `125 files / 1291 tests`; W3-06 focused frontend tests closed at `12 passed`; Rust desktop-runtime tests closed at `833 passed / 15 ignored / 0 failed`; formatting, Clippy `-D warnings`, remediation, performance architecture, build, governance, npm/Rust audits, Windows/macOS Rust/release and applicable performance/quality lanes passed. Rust audit retains the existing allowed dependency warnings rather than reclassifying them. Native interactive macOS visual verification remains `UNVERIFIED`.

#### W3-07 — Folder Preview — COMPLETE

Merged through PR #131 as
`master@ced5478abfa7ac42fa9295ad5ec7b87c5e7dbee3`.

Final accepted outcomes:

- `builtin.folder` reuses the existing Preview Core, production Provider Registry, source-owned Library/Browse identities, `BrowseService`, bounded progressive-publication contract and runtime `WorkScheduler` rather than creating another directory/query/Preview authority;
- Folder Preview is direct-children-only, uses one temporary Preview-owned Browse session per request, releases pages/session resources deterministically and leaves visible Browse session/request/enumeration/cursor/history authority unchanged;
- aggregation is bounded at the reviewed 100,000 direct-child ceiling with bounded sample, extension, largest-observed and project-hint state rather than materializing the full child set;
- first useful Folder facts can become visible while `previewStart()` remains pending through a bounded single-in-flight epoch/source/previewId snapshot observation path shared by Floating/Pinned;
- progressive `FolderSummaryPayloadV1` keeps inner/outer Partial truth aligned, ordinary in-progress Partial may have no stop reason, exact authoritative EOF can become Complete, and entry/deadline limits remain explicit Partial outcomes;
- the provider reserves deadline return headroom so useful Partial state returns before the outer Preview timeout rather than being erased by fallback;
- no direct provider `read_dir`, raw path, recursion, symlink/package/archive traversal, implicit hydration or second Browse/query engine was introduced.

Final reviewed head:
`cf8a9edce9a07f518f443f09835047c93040030e`.

Exact-head hosted CI `32652108996` passed. The final narrow CI remediation only made the existing W3-06 ReadGate lifecycle-test baseline ordering deterministic and did not change Folder production behavior.

Exact-head local real-browser coverage passed at 1600×900 and 980×680. Native interactive macOS visual/accessibility verification remains `UNVERIFIED`.

#### W3-08 — ZIP Archive Preview — COMPLETE

Merged through PR #132 as
`master@7078706992d129e47ba49b65ff3fec5eff0f40ec`.

Final accepted outcomes:

- the production registry adds `builtin.archive-zip` at priority 270 for Zen Floating/Pinned through the existing Preview lifecycle/provider ownership;
- ZIP Preview is central-directory/archive metadata only: no extraction, entry-payload decompression/read, nested archive recursion, output path or executable archive-content rendering;
- source access is a bounded backend `Read + Seek` adapter over `PreviewReadGateAdapter → MaterializationReadGate`; no raw path, `File::open`, `ZipArchive<File>` or renderer byte-read API is introduced;
- every underlying read remains <=1 MiB and the request-level charged source-read budget remains <=12 MiB, including many-small-seek behavior;
- provider bounds include 20,000 inspected entries, 2,000 tree nodes, depth 64, 4 KiB / 2,048-char names, 16 KiB entry extra metadata, 16 KiB archive comment, 8 MiB central-directory bytes and 1 MiB encoded `ArchiveTreePayloadV1`;
- the existing runtime WorkScheduler remains CPU/I/O admission authority through a narrow archive resource adapter; real tests prove ReadGate/scheduler resources return to baseline on success, terminal drift, cancel, switch and dispose;
- valid nested logical directory names remain inert virtual-tree data while traversal/absolute/dot/drive/UNC/control/normalization-sensitive names fail closed and never become host paths;
- `ZIP_DEADLINE_RETURN_GUARD = 100 ms` preserves outer-timeout headroom, but pre-validation deadline remains provider-local Timeout/Metadata fallback; only after bounded ZIP structure validation may deadline pressure produce truthful `ArchiveTree Partial / deadline`;
- corrupt ZIP hints near deadline cannot fabricate ArchiveTree, and strict frontend decoding/rendering keeps names escaped/inert and DOM/tree shape bounded;
- ordered post-W3-07 integration preserved Folder progressive observation, FolderSummary, latest-wins and shared scheduler/read-gate authority.

Final reviewed head:
`50920b46bd118ed6f25219fb66cbe687cc9ba280`; tree:
`5ec7dd1e694b03f7752b7fa8e1a80743cd680bab`.

Final reviewer pass `#5003079985` recorded code blockers = 0.

Exact-head hosted CI `32659742797` passed; source and merge-integration trees were equivalent. Exact-head local W3-07/W3-08 real-browser gates passed at 1600×900 and 980×680. Native interactive macOS visual/accessibility verification remains `UNVERIFIED`.

#### W3-09 — Failure / materialization / security / accessibility integration — NEXT

W3-09 converges fallback/terminal-state behavior, no-implicit-materialization policy, safe rendering, Space/Esc/IME/focus ownership and accessibility semantics across every merged host/provider family. Phase A preparation may be reused only after synchronizing to the post-W3-08 current-truth baseline; Folder and ZIP convergence belongs to the final W3-09 integration, not to separate replacement authorities.

#### W3-10 — Performance / cross-platform QA

Measures W0 Preview targets, 100-entry rapid switching, 100 Preview cycles/steady state, close-then-mutate resource release, 100k Folder Preview and provider fixture matrices while preserving W2/Query performance gates. Phase A preparation does not equal final acceptance.

#### W3-11 — Closeout

Final W3 current-truth/evidence/debt closeout. W3 closeout does not activate W4 automatically.

## Future Waves

### W4 — Native integration

Status: not started / not authorized.

Owns system/native Preview host integration such as macOS Finder Quick Look extension/lifecycle and Windows Explorer Preview Handler/Quick Preview integration. W3 may remain architecture-ready for these hosts but cannot implement them.

### W5 — Release

Status: not started / not authorized.

Owns final release hardening, packaging/signing/notarization/update/publication and full supported-platform release matrix.

## Sequencing rule

```text
W0 ✅
 ↓
W1 ✅
 ↓
W2 ✅
 ↓
W3 ACTIVE
 ↓
W3-00 ✅
 ↓
W3-01 ✅
 ↓
W3-02 ✅
 ↓
W3-03 ✅
 ↓
W3-04 ✅
 ↓
W3-05 ✅
 ↓
W3-06 ✅
 ↓
W3-07 ✅
 ↓
W3-08 ✅
 ↓
W3-09 NEXT
 ↓
W3-10
 ↓
W3-11
 ↓
BETWEEN INITIATIVES
 ↓
W4 requires separate authorization
 ↓
W5
```

No later Wave is implicitly active.
