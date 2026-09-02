# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate a later Wave merely because an earlier Wave completes. Long-horizon product direction and Wave boundaries remain owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-09-02

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

### W3 — Preview Platform

Status: **COMPLETE / CLOSED — W3-R1 remediation merged and evidence-complete**

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

Final pre-remediation W3 runtime baseline:
`master@a825f5414af274ee02712b53b60d72fe59306fea`; tree
`79f1ca9a9ff97b695b1fca38090d007a1723559e`
(PR #136 W3-10 squash merge).

W3-10 final reviewed head:
`601f689741fc0084a50853ba26b856e251421c5b`; tree:
`79f1ca9a9ff97b695b1fca38090d007a1723559e`.

W3-10 exact-head hosted CI `32706899339`: `success`.
Reviewer pass: `#5007633103` recorded acceptance blockers = 0 at that review point.
W3-11 docs/governance closeout merged in PR #137, but its COMPLETE/CLOSED conclusion was reopened by post-merge Codex review `#5009168468` / blocker `#3844601370`.

W3-R1 activation merged through PR #138 as
`master@5f66e78f021af5d0c3a90d6c87b895c767e7527c`; tree
`78b49b3e9d822730cef6fbc37492b4bf69f43bf9`.

Issue #139 documented the macOS permanent-delete pre-journal correctness defect and is now **RESOLVED / CLOSED**.

W3-R1 production remediation merged through PR #140 as
`master@e3d7f4c36ff70f0d6def95e739ae11508508a4d1`; tree
`ae017ec23241c69f7b33cb1022da5f3a690a1e2a`.

Final reviewed W3-R1 production head:
`32d59594d00a0dc04c9d622250604731ab3b7ef4`; tree
`ae017ec23241c69f7b33cb1022da5f3a690a1e2a`.

W3-R1 exact-tree-equivalent hosted CI `32757439487`: `success`; head and merge-integration trees were identical (`tree_equivalent=true`). Apple-Silicon macOS proved close/dispose → permanent-delete → source absence → fresh Preview open as a real HARD assertion through the existing `file_ops` authority; Windows correctly classified permanent delete `NOT APPLICABLE` because `permanent_delete_available=false`, without inventing a second authority. Existing rename/move/fresh-open evidence remained PASS, macOS Folder mutation remained PASS, and Windows Folder directory mutation remains honestly platform-limited where the existing file-only seam does not permit it.

W3-R1 remediation taskbook:
[`tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md`](tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md).

W3 final governance closeout merged through PR #141 as
`master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`; tree
`50efecd2579b5d786ae059b0561b36bca79935e6`.
That closeout restored canonical `BETWEEN INITIATIVES` truth and intentionally left W4 inactive until a separate reviewed activation.

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
W3-09  Failure / Materialization / Security / Accessibility Integration   ✅ PR #134
  ↓
W3-10  Preview Performance + Cross-platform QA                         ✅ PR #136
  ↓
W3-11  W3 Closeout                                                    ✅ PR #137 (conclusion reopened)
  ↓
W3-R1  Close → Mutate Evidence Remediation                            ✅ PR #140
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

#### W3-09 — Failure / materialization / security / accessibility integration — COMPLETE

Merged through PR #134 as
`master@31d4bc4bcdb1ad495a1db13e7630213d4ec5d6a0`.

Final reviewed head:
`ff7ad51ebc4f02fd5871c8f76233a911a8d15f96`; tree:
`1955b9f1041f93f1fc0ef7004f54bfb5c290a353`.

Accepted final evidence:

- exact-head hosted CI `32674567490` passed;
- reviewer pass `#5003742441` recorded code blockers = 0;
- one shared Preview failure/terminal/fallback integration preserves the existing PreviewSession, Provider Registry, MaterializationReadGate, WorkScheduler, BrowseService, sourceVersion and latest-wins authorities;
- recoverable provider failures and terminal source/session conditions remain distinct, with truthful Metadata fallback and terminal presentation and no fabricated materialization/download action;
- hostile Markdown/XML/YAML/table/archive/folder/image inputs remain bounded, inert or sanitized, with no raw-path, unauthorized network/resource, script or archive extraction authority;
- Space/Esc/IME, focus restoration, single-modal ownership, Floating/Pinned handoff and screen-reader status semantics converge across the merged provider families;
- stale, cancel, switch, close and dispose paths restore existing read/scheduler/asset/session resources and preserve Folder progressive observation and ZIP metadata-only bounds;
- exact-head local real-browser W3-09 coverage passed at 1600×900 and 980×680.

Hosted compile/Rust/performance/quality lanes are not interactive native UI evidence; native VoiceOver/Narrator, Retina/DPI and manual native macOS verification remain `UNVERIFIED`.

#### W3-10 — Performance / cross-platform QA — COMPLETE

Merged through PR #136 as `master@a825f5414af274ee02712b53b60d72fe59306fea` / tree `79f1ca9a9ff97b695b1fca38090d007a1723559e`. Reviewer PASS `#5007633103`; exact-head hosted CI `32706899339` succeeded. Accepted evidence includes truthful bounded ZIP 20,001→20,000 inspection, six representative byte-provider rename/move/fresh-open cases on Windows/macOS, 100-entry mixed/latest-wins switching, repeated-cycle resource steady state, bounded Folder scale and preserved W1/W2/Query gates. W3-10-owned exact-head local browser timing/interaction evidence passed at 1600×900 and 980×680 with frozen shell/useful p95 targets met.

Post-merge review of W3-11 identified that permanent-delete remained `UNVERIFIED`, so the frozen aggregate close/dispose → rename/move/delete/open HARD criterion was not fully established at that point. W3-R1 subsequently closed that gap through PR #140. Apple-Silicon macOS now proves permanent delete as a real hard assertion after disposal, including source absence and subsequent fresh Preview open. Windows permanent delete is explicitly `NOT APPLICABLE` by existing product capability (`permanent_delete_available=false`), not silently downgraded. Windows Folder directory mutation remains separately platform-limited where the existing file-only seam does not permit it; native VoiceOver/Narrator and manual interactive macOS UI remain `UNVERIFIED`; historical W1 timing observations remain historical rather than being rewritten.

#### W3-11 — Preview Platform Closeout — MERGED / CONCLUSION REOPENED, THEN RESOLVED BY W3-R1

PR #137 was docs/governance-only and added no production/config/package/schema/CI authority. Post-merge Codex review `#5009168468` / blocker `#3844601370` found a real closeout evidence inconsistency. That historical closeout conclusion was reopened, and W3-R1 was activated to repair it. PR #140 now resolves the blocker without erasing that sequence.

#### W3-R1 — Close → Mutate Evidence Remediation — COMPLETE / CLOSED

Taskbook: [`tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md`](tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md).

PR #138 activated the bounded remediation. Issue #139 documented the narrow macOS pre-journal production defect. PR #140 repaired that seam and hardened the close→mutate performance gate. Exact reviewed head `32d59594d00a0dc04c9d622250604731ab3b7ef4` / tree `ae017ec23241c69f7b33cb1022da5f3a690a1e2a` passed CI `32757439487`; independent exact-head review blockers were 0 and Codex found no major issues.

The frozen close/dispose → rename/move/delete/open criterion is now **HARD PASS** under the existing product capability contract: macOS permanent delete is a hard PASS through existing mutation authority; Windows permanent delete is N/A because the runtime does not expose that capability; Windows Folder directory mutation remains platform-limited where its existing file-only seam does not permit directory mutation. No W4 scope was activated by W3 itself.

## Current

### No active initiative

Status: **BETWEEN INITIATIVES — no active initiative; W4 complete / closed; W5 eligible / inactive**

W4 — Native Integration: **COMPLETE / CLOSED**.

Final W4 closeout:
[`tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md`](tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

Final project baseline: `master@f45aae1c270d827d881abf620d8f09074c8d7d7e`; tree `d2596364c544e2bcc6648fbe0ff0465f1cc512a8`.

The completed W4 initiative record remains historical initiative evidence; this section does not designate an active initiative.

Architecture decisions:

- [`DECISIONS/0005-native-preview-host-boundary.md`](DECISIONS/0005-native-preview-host-boundary.md)
- [`DECISIONS/0006-windows-preview-handler-bounded-capture.md`](DECISIONS/0006-windows-preview-handler-bounded-capture.md)

Implementation plan:
[`specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md`](specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md).

Architecture / experience freeze:
[`specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md`](specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md).

W4-00 activation taskbook:
[`tasks/W4-00-NATIVE-INTEGRATION-ACTIVATION-CODEX.md`](tasks/W4-00-NATIVE-INTEGRATION-ACTIVATION-CODEX.md).

W4-01 current-truth closeout:
[`tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CURRENT-TRUTH.md`](tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CURRENT-TRUTH.md).

W4-02 current-truth closeout:
[`tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md`](tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md).

W4-03 v1 architecture-stop evidence:
[`tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`](tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md).

W4-03 v2 current-truth closeout:
[`tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md`](tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md).

R-FL-01 Operation Preview Confirmation Integrity remediation taskbook:
[`tasks/R-FL-01-OPERATION-PREVIEW-CONFIRMATION-INTEGRITY-CODEX.md`](tasks/R-FL-01-OPERATION-PREVIEW-CONFIRMATION-INTEGRITY-CODEX.md).

W4-00 merged through PR #142 as `master@994d93b07a2bc3434977de1e16bd1e29b2585983`. W4-01 merged through PR #143 as `master@02e88db7cf4287e0d68792b3960da503b70d6c56`; tree `135c7a30626915bdffb0e1c4e6ca4f09734c5c9f`, and is **COMPLETE / CLOSED**.

W4-02 merged through PR #145 as `master@8ea647e13882f8cb0e08b77a2953fb06765d1729`; tree `f2ab398bf87d162fa1c6ca07f1784ceca259bdda`, and is **COMPLETE / CLOSED**. Final PR head `809a2002067c315784b48a524a815be328d7c953` passed independent review `#5030646522` with blockers = 0 and final exact-head PR-tree CI `32962219486` success.

ADR-0006 and the W4-03 v1 Stop Condition #5 governance remain accepted in the current tree. PR #148's `db192a541e9bdabcf581f9dce57be8efff39c8e2` / tree `e87569d48716e791bd35b5f4013940e708cb1853` remain their provenance identities for that Windows source-model amendment, not the current master head. W4-03 v1 PR #146 is **STOPPED / CLOSED WITHOUT MERGE**.

W4-03 v2 merged through PR #151 as `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; tree `f357be042c493d0cefd98be8e02d768210ac1f6b`, and is **COMPLETE / CLOSED**. Final reviewed head `19e51d5e2eed175a0eda18a02b47d82c97cc289b` passed independent review with blockers = 0, real Explorer/prevhost acceptance passed and exact-head hosted CI `33008914117` succeeded on attempt 1. R-FL-01 remains historical remediation provenance. W4-04 Windows Explorer Preview Handler Production Integration, W4-05 signing/packaging/registration integration and W4-06 native QA are **COMPLETE / CLOSED** under the final W4 closeout; W4-07 is the docs/governance closeout record.

W4 sequencing:

```text
W4-00  Activation + Native Architecture / Experience Freeze        ✅ PR #142
  ↓
W4-01  Shared Native Host Bridge + HostProvided Source Contract    ✅ PR #143
  ↓
 ┌──────────────────────────────────┬────────────────────────────────────┐
 ↓                                  ↓
W4-02 macOS Native Quick Look     W4-03 v1 Windows Preview Handler
      Host / Strong-native              request-long IStream spike
      Format Integration                STOPPED — PR #146 closed/no merge
      ✅ COMPLETE / PR #145                    ↓
                                     ADR-0006 ✅ PR #148 provenance
                                                ↓
                                     W4-03 v2 Bounded-Capture Spike
                                           ✅ COMPLETE / PR #151
                                                ↓
                                      W4-04 Windows Explorer Handler
                                            ✅ COMPLETE / CLOSED
 └───────────────────┬───────────────────────────────────────────────────┘
                     ↓
W4-05  Signing / Packaging / Registration Integration   ✅ COMPLETE / CLOSED
  ↓
W4-06  Native Accessibility / DPI / Performance / Resource QA   ✅ COMPLETE / CLOSED
  ↓
W4-07  W4 Closeout   ✅ COMPLETE / CLOSED
```

Initial product boundary remains unchanged: the accepted macOS path is Zen-internal native Quick Look-backed strong-native format integration rather than a broad Finder Preview Extension for standard formats; Windows prioritizes Explorer Preview Handler while `WindowsQuickPreview` remains reserved/inactive unless separately justified. ADR-0006 changes only the Windows Preview Handler source lifetime: the shell stream is ingress-only, W4-03 v2 proved a 512 KiB bounded capture for architecture proof, deferred work uses Zen-owned immutable memory, and `Unload` correctness does not depend on `CoCancelCall` terminating arbitrary source work. W4-04 productizes that accepted architecture for a deliberately narrow production association matrix.

## Future Waves

### W5 — Release

Status: **ELIGIBLE / INACTIVE**.

W5 is the next eligible Wave but is not activated. It owns final release hardening, final packaging/signing/notarization/update/publication readiness and the full supported-platform release matrix. W4 completion does not automatically authorize or activate W5; publication remains W5 and requires separate activation.

## Sequencing rule

```text
W0 ✅
 ↓
W1 ✅
 ↓
W2 ✅
 ↓
W3 ✅ COMPLETE / CLOSED
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
W3-09 ✅ PR #134
 ↓
W3-10 ✅ PR #136
 ↓
W3-11 ✅ PR #137 (closeout conclusion reopened)
 ↓
W3-R1 ✅ PR #140 (blocker resolved)
 ↓
PR #141 ✅ W3 final governance closeout
 ↓
W4-00 ✅ PR #142
 ↓
W4-01 ✅ PR #143
 ↓
┌─────────────────────────────────────┬─────────────────────────────────────┐
↓                                     ↓
W4-02 ✅ PR #145                     W4-03 v1 STOPPED — PR #146 closed/no merge
                                        ↓
                                      ADR-0006 ✅ PR #148 provenance
                                        ↓
                                      W4-03 v2 ✅ PR #151
                                        ↓
                                      W4-04 ✅ COMPLETE / CLOSED
└───────────────────────┬─────────────┘
                        ↓
W4-05 / W4-06 / W4-07 ✅ COMPLETE / CLOSED
  ↓
W5 eligible for separate activation / inactive
```

No later Wave is implicitly active.
