# File Library 2.0 / Preview Platform — W1 Foundation

Status: active — implementation

Owner: File Library / Preview Foundation

Baseline: `master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3` (PR #64 W0 specification merge)

Source specification: [`../specs/file-library-preview/00-MASTER-SPEC.md`](../specs/file-library-preview/00-MASTER-SPEC.md)

Implementation plan: [`../specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md`](../specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md)

This initiative is the bounded production authorization for W1 Foundation. It
implements the contracts frozen by W0 and does not authorize W2/W3/W4 feature
scope.

## Objective

Build the shared File Library 2.0 / Preview foundation without replacing
existing durable authorities. W1 must establish safe identity/session contracts,
progressive Ephemeral Browse, Location projection, global resource scheduling,
Preview lifecycle contracts, authoritative materialization/read adaptation,
shared Thumbnail infrastructure, ephemeral invalidation and the integration /
performance surface required before W2 Experience work can begin.

## Preserved authorities

W1 must preserve:

- File Library Query V2 as managed-library query authority;
- `LibrarySelectionV1` as managed selection authority;
- Global Index as system-wide search authority;
- scan-root/watcher revisions and reconciliation as managed-location truth;
- existing platform/content byte-read eligibility and open/revalidation paths as
  content-access authority;
- filesystem-safety identity/backend revalidation as mutation correctness
  authority;
- Operation Preview, journals, Safe Trash, cleanup and Restore authorities;
- PR #63 provider/materialization/capability semantics.

No Track may silently create a replacement authority for any of the above.

## Authorized Tracks and gates

### F1 — Contract Spine

- **W1-00** — initiative/governance activation and W0 closeout.
- **W1-01** — implementation-level shared contracts and serialization tests:
  EntryRef, LocationRef, NavigationTarget/BrowsePathRef,
  Browse enumeration generation identity, non-authoritative Workspace restore
  locator, availability/freshness/entry content state, ContentReadEligibility,
  WorkClass, PreviewSourceRef/PreviewHostKind and opaque content-read lease
  boundary.

F1 must merge before parallel core work starts.

### F2 — Parallel Core

After W1-01:

- **W1-02** Workspace Navigation / WorkspaceSession;
- **W1-03** Ephemeral Browse Core;
- **W1-04** Location Core and platform adapters;
- **W1-05** WorkScheduler plus selected resource-lease adapters for existing
  heavy authorities;
- **W1-06** Preview Contract Core with fake-provider lifecycle tests.

### F3 — Infrastructure

After required F2 dependencies:

- **W1-07** Materialization / Read Gate adapting the existing authoritative
  byte-read path;
- **W1-08** Thumbnail Infrastructure, explicitly dependent on W1-07 for any
  byte-reading generation path;
- **W1-09** Ephemeral Change / Refresh with enumeration-generation invalidation;
- **W1-10** central Integration Surface.

### F4 — Foundation Release

- **W1-11** Foundation performance, cancellation, resource cleanup, scheduler
  interference and platform QA evidence;
- **W1-12** closeout/current-truth update.

Only F4 completion authorizes opening a separately reviewed W2 Experience
initiative.

## Track rules

Every production Track must state:

- scope and explicit non-goals;
- durable authority affected (normally none/new authority = no);
- cancellation/lifecycle behavior;
- identity/session/enumeration publication rules where relevant;
- platform impact;
- materialization/read-boundary impact where relevant;
- performance/backpressure impact;
- normal + failure + cancellation tests;
- Query V2/watcher/mutation-safety no-regression statement;
- intended integration-hotspot paths.

If implementation discovers a need for a schema change, new durable authority,
CI performance-threshold change or filesystem-safety rewrite, that Track stops
and escalates to architecture/initiative review rather than expanding scope in
place.

## Integration hotspots

Treat these as protected/shared integration surfaces:

- `src/types/domain.ts`;
- `src-tauri/src/lib.rs` / `src-tauri/src/main.rs`;
- frontend Tauri API registry/types;
- existing Query V2 store;
- managed watcher implementation;
- existing content/platform byte-read eligibility/open authority;
- macOS provider/materialization/capability modules.

W1 Tracks should prefer new bounded modules and defer broad registry/API wiring
to W1-10 where practical.

## Performance / correctness gates

W1 must preserve existing Query V2 100k/1M gates and add evidence for:

- progressive 100k Ephemeral Browse without full-scan-first/OOM/freeze;
- session/request/enumeration stale-page rejection;
- target/session cancellation and publication-right revocation;
- scheduler interference using selected real heavy-authority resource adapters;
- no implicit provider hydration;
- byte-open boundary revalidation;
- unavailable/disconnected Location correctness without false mass deletion;
- safe cross-process Browse restore-locator resolution into fresh refs;
- bounded/deduplicated Thumbnail work;
- Preview/handle/resource steady-state behavior required by the W0 QA contract.

Absolute RSS/FD/concurrency ceilings remain observational until W1 establishes
release-build platform baselines, as specified by W0.

## Explicit non-goals

W1 does not authorize:

- full Library/Browse visual redesign (W2);
- rich Markdown/JSON/CSV/ZIP/Folder production Preview providers (W3);
- Finder Quick Look Extension or Windows Explorer Space integration (W4);
- arbitrary unmanaged recursive filesystem/global search engine;
- Query V3;
- managed watcher rewrite;
- a second content-read eligibility engine;
- new filesystem mutation/recovery path;
- generic durable job runtime;
- third-party Preview plugins;
- OCR/RAG/AI Preview/Agent/MCP expansion;
- Intel macOS or Linux support.

## W1-00 governance note

The prior governance checker encoded the W0-specific assumption that every
current initiative must be `active — specification only`. W1-00 may generalize
that checker so current initiatives can be either active specification or active
implementation work while preserving cross-file title/status consistency and
requiring W0 Specification itself to remain specification-only.

This governance adaptation does not change product runtime behavior or
performance thresholds.

## Closeout

W1 remains active until F1-F4 evidence is complete and W1-12 updates current
truth. The final closeout must bind validation evidence to exact production
heads and must not self-invent pass claims for unavailable native fixtures.
