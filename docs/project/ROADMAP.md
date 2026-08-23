# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate a later Wave merely because an earlier Wave completes. Long-horizon product direction and Wave boundaries remain owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-08-23

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

Current W3 runtime baseline:
`master@48e8291f8d1f0367a24eca6329640641468b78ce`
(PR #125 W3-04 squash merge).

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
      ✅ PR #123                   ✅ PR #125                   NEXT
 └───────────────┬───────────┴───────────────┬───────────┴───────────────┬───────────┘
                                   ↓
                         ┌─────────┴─────────┐
                         ↓                   ↓
                    W3-07 Folder        W3-08 ZIP
                    Preview provider     Archive provider
                         └─────────┬─────────┘
                                   ↓
W3-09  Failure / Materialization / Security / Accessibility Integration
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

#### W3-05 — Structured + Table providers — NEXT

W3-05 owns JSON/YAML/XML and CSV/TSV Preview through the existing provider/read/fallback/host architecture. Parsing and serialization must remain bounded, hostile fixtures must fail safely, XML may not resolve network/external entities and table/cell content may not execute formulas or code.

W3-05 must not create a second parser/read authority, renderer raw-path access, implicit hydration, W3-06+ provider pull-forward or W4 system-host integration.

#### W3-06 — Image provider

Backend-owned safe asset transport, sourceVersion-bound identity, bounded decode/resource slots and no raw source-path WebView loading or implicit hydration.

#### W3-07 — Folder Preview

Bounded/progressive 1k/10k/100k Folder Preview. Shell and useful initial facts appear before full analytics; optional enrichment remains cancellable and truthfully Partial.

#### W3-08 — ZIP Archive Preview

Bounded archive metadata/index Preview only. No silent extraction, path traversal, unbounded nested recursion or archive-bomb behavior.

#### W3-09 — Failure / materialization / security / accessibility integration

Converges fallback/terminal-state behavior, no-implicit-materialization policy, safe rendering, Space/Esc/IME/focus ownership and accessibility semantics across hosts/providers.

#### W3-10 — Performance / cross-platform QA

Measures W0 Preview targets, 100-entry rapid switching, 100 Preview cycles/steady state, close-then-mutate resource release, 100k Folder Preview and provider fixture matrices while preserving W2/Query performance gates.

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
W3-05 NEXT
 ↓
W3-06 ... W3-11
 ↓
BETWEEN INITIATIVES
 ↓
W4 requires separate authorization
 ↓
W5
```

No later Wave is implicitly active.
