# File Library 2.0 / Preview Platform — Open Source Research Synthesis

Status: W-1 research synthesis complete — architecture/product input only

## Purpose

This document records the W-1 open-source research synthesis for the File
Library 2.0 / Preview Platform W0 specification. It is evidence for product
and architecture decisions; it is not a production implementation authority,
an accepted runtime contract or a license to copy third-party code.

The reviewed projects are used as architecture and product-principle
references. Zen Canvas must re-derive any behavior from its own current
authorities, privacy rules, platform contracts and filesystem safety chain.
No restricted-license project code, asset or implementation is copied by this
research artifact.

Fixed research commit SHAs and a repository-persisted license record were not
available in the current repository snapshot. They are therefore intentionally
marked as **not yet persisted** rather than guessed. Any future code reuse
requires a separate license and provenance review before adoption.

## Projects Reviewed

| Project | Research signal used by W0 | Reference metadata |
| --- | --- | --- |
| Spacedrive | identity/location separation, indexing boundaries and multi-location product concepts | Research reference SHA not yet persisted; license record not yet persisted |
| Files | familiar filesystem browsing, managed views and calm desktop navigation | Research reference SHA not yet persisted; license record not yet persisted |
| Microsoft PowerToys Peek | fast, focused preview invocation and host lifecycle expectations | Research reference SHA not yet persisted; license record not yet persisted |
| QuickLook for Windows | reuse of native preview-handler capability instead of rebuilding every renderer | Research reference SHA not yet persisted; license record not yet persisted |
| TagSpaces | user-directed tags, browse context and metadata enrichment boundaries | Research reference SHA not yet persisted; license record not yet persisted |
| QLMarkdown | Markdown preview as a bounded provider capability | Research reference SHA not yet persisted; license record not yet persisted |
| SourceCodeSyntaxHighlight | syntax rendering as a replaceable representation provider | Research reference SHA not yet persisted; license record not yet persisted |

The table records the research lens, not a feature parity claim. No reviewed
project is an authority for Zen Canvas persistence, filesystem mutation,
recovery, platform support or security behavior.

## Adopt

### File identity is not physical path

Physical paths can be rebound, become unavailable, move across locations or
refer to a different object after a race. W0 should separate `FileIdentity`,
`Location` and the current `PhysicalPath`; paths are lookup hints and display
facts, not durable identity or mutation authorization.

**Zen implication:** File Library selections, preview requests, thumbnail keys
and navigation references must be revalidated against the owning identity and
location contract. Filesystem mutation continues to use the existing backend
Operation Preview and identity revalidation chain.

### Location is a first-class domain concept

A location has availability, capability, indexing policy and provider context
that are independent of a single path or entry. Offline external media,
network shares and cloud/provider locations must not collapse into a generic
missing-file state.

**Zen implication:** W0 specifies location health and capability states before
the UI decides whether to browse, index, preview or defer work.

### Ephemeral Browse

Browse Mode must be able to inspect a directory that has not been admitted to
the managed File Library. This supports familiar filesystem navigation without
silently expanding managed scope, indexing policy or content consent.

**Zen implication:** Ephemeral Browse is a bounded read/projection surface. It
must never become managed-library truth, selection authority, durable tag
ownership or a filesystem mutation authority.

### Ephemeral → Persistent identity promotion

When a user later admits a browsed directory to the Library, references should
be promoted where identity continuity can be proved rather than recreated from
display paths. Promotion must fail closed when continuity is ambiguous.

**Zen implication:** Tags, preview references and selection state should retain
their identity when possible; otherwise the UI must show a re-resolution state
instead of silently attaching facts to a different entry.

### Unified NavigationTarget

Library Smart Views and filesystem paths are different scopes but should enter
one navigation history model. A history item needs enough target identity and
scope context to reopen, explain unavailability and avoid confusing a saved
view with a physical directory.

**Zen implication:** `NavigationTarget` is a navigation contract, not a new
query or filesystem authority. Global Search, File Library Query V2 and
Ephemeral Browse retain their distinct domain ownership.

### Preview Provider Registry

Preview providers need explicit `priority`, `canHandle`, cancellation,
lifecycle, cleanup and capability declarations. Provider choice must be
deterministic and explainable when a representation is unavailable.

**Zen implication:** a future registry may select native or bounded providers,
but it must not load arbitrary DLL/dylib/plugin code or grant filesystem
mutation permissions. Provider output remains a read-only representation.

### PreviewSession

Preview work is a session, not a single render call. It needs request identity,
current source, navigation context, state, cancellation and disposal so rapid
selection changes cannot publish stale content or retain file handles.

**Zen implication:** W0 must define session ownership and stale-response rules
before a Preview Host is implemented. Closing a session must release resources
promptly and deterministically.

### Preview Host ≠ Preview Core

Zen App, macOS Quick Look and a Windows host/panel may expose different native
surfaces while sharing the same core contracts for source identity,
capabilities, cancellation and cleanup.

**Zen implication:** Preview Core is a representation/session contract;
Preview Host is presentation and platform integration. Neither may authorize,
revalidate or execute filesystem mutation, which remains owned by Operation
Preview, journals, Safe Trash and Restore.

### Watcher is not the source of truth

Watchers are real-time hints and can miss, duplicate, reorder or fail to
deliver events. A durable index needs reconciliation, root revisions and
rescan behavior to establish what is actually known.

**Zen implication:** watcher permission, reconciliation-required, partial and
retry-exhausted states remain distinct. A watcher event cannot by itself delete
managed truth or declare complete coverage.

### Thumbnail is infrastructure

Thumbnails serve list, grid, inspector, preview and search-adjacent surfaces;
they should not be owned by a Grid View. Caching, variants, bounded scheduling
and invalidation need one documented service boundary.

**Zen implication:** W0 specifies thumbnail infrastructure independently of a
particular layout. It must respect managed scope, location availability,
identity changes and resource budgets.

### Thumbnail identity should not be path-based

Paths change and can be rebound. A thumbnail cache keyed only by path can show
stale or wrong content after rename, replacement or location changes.

**Zen implication:** prefer file/content identity plus representation variant
and revision. A path is a fallback lookup input only when identity continuity
has been verified.

### Progressive directory loading

Large directories should reveal trustworthy entries incrementally rather than
blocking the foreground until a complete scan finishes. Progressive loading
must still communicate partial, loading, unavailable and failed states.

**Zen implication:** W0 defines bounded first-page/stream behavior without
turning a loaded sample into an authoritative total. Exact counts and managed
selection remain backend-owned Query V2 contracts.

### Batch updates

Filesystem discovery and watcher events must not trigger one React render or
one expensive enrichment transaction per entry. Batching reduces UI churn and
protects the backend from unbounded write amplification.

**Zen implication:** batch boundaries, revisions and cancellation are explicit;
the renderer remains a projection and does not become an event ledger.

### WorkScheduler / Resource Budget

Indexing, thumbnails, preview preparation, metadata enrichment and reconciliation
compete for CPU, memory, I/O, file handles and provider/network capacity. A
shared scheduler contract is safer than unrelated background loops.

**Zen implication:** W0 specifies priority, concurrency, cancellation, fairness
and resource budgets. It does not create a generic Job Runtime or a second
durable queue.

### Preview cleanup is P0

After a preview closes, the source must be immediately usable for rename, move,
delete or open. Retained handles, temporary files, provider accessors and
background tasks can make a correct filesystem operation fail or target stale
state.

**Zen implication:** session disposal and provider cleanup are acceptance gates,
with explicit tests for rapid switching, close-then-mutate and cancellation.

### Native preview fallback

Windows can reuse a system Preview Handler and macOS can reuse or integrate
Quick Look capabilities. Zen should not implement a renderer for every format
when a platform capability can provide a bounded, safe representation.

**Zen implication:** native fallback is capability-probed and read-only. An
unsupported or unavailable provider produces a clear fallback state, never an
arbitrary plugin-loading path.

### Cloud placeholder / hydration safety

Reading metadata, generating a thumbnail or asking for a preview must not
silently download cloud content. Hydration can create latency, data-usage,
privacy and offline behavior surprises.

**Zen implication:** provider materialization is explicit and operation-aware;
W0 must distinguish metadata availability, placeholder state, hydration consent
and preview readiness.

### Location availability ≠ deletion

An external disk, network share or provider domain can be offline without its
entries being deleted. Treating temporary unavailability as deletion destroys
history and creates false cleanup work.

**Zen implication:** location health and reconciliation remain separate from
entry deletion/staleness. Safe cleanup and restore authorities are not bypassed.

### Safe restore

A workspace or location that caused a crash or is currently inaccessible must
not force startup into a restore death loop. Recovery needs bounded retries,
manual review and a safe fallback state.

**Zen implication:** Preview and Browse session restoration is separate from
filesystem Restore. Startup must be idempotent, cancellation-aware and fail
closed without inventing a new recovery ledger.

## Adapt

The following product ideas are useful, but they must be re-derived within
Zen's authority and safety architecture:

| Reference idea | Zen adaptation | Guardrail |
| --- | --- | --- |
| Finder-like Browse on macOS | Native-feeling directory navigation with Apple Silicon platform capabilities | Ephemeral Browse is not managed-library truth; backend owns identity and availability |
| Explorer-like Browse on Windows | Familiar Windows navigation and shell entry points | Windows x64 is the target; no Windows ARM64 product claim; no renderer filesystem authority |
| Search scopes | Explicit managed, ephemeral and global scopes | Global Search, File Library Query V2 and Content Search remain separate |
| Per-target List/Grid preferences | Persist view preference by target/scope where identity permits | Preference state is not file truth and must not infer complete totals |
| Responsive breadcrumb | Scope-aware breadcrumb that distinguishes saved view, managed location and physical path | Breadcrumb is navigation projection, not a path authorization token |
| Folder preview analytics | Bounded folder summary/preview facts with clear partial and unavailable states | No hidden full scan, cloud hydration or paged-data fiction |
| Git/project detection | Advisory project context and safe grouping hints | No automatic move, rule mutation or deep repository walk without budget/consent |
| Windows Shell Preview integration | Capability-backed Preview Host adapter | No arbitrary DLL loading; provider remains read-only and disposable |
| macOS Quick Look extension | Capability-backed Quick Look/native host integration | Apple Silicon only; no signing or plugin SDK assumption in W0 |

Adaptation is a W0 specification activity. It is not permission to implement
any of these items in this initiative.

## Reject for v1

The following are explicitly rejected for the W0/v1 boundary:

- third-party Preview plugin SDK;
- arbitrary DLL/dylib plugin loading;
- AI Preview;
- generic workspace/sidebar customization system;
- multi-device filesystem;
- ephemeral disk snapshot cache;
- OCR;
- RAG/vector database;
- Agent/shell/MCP/tool runtime;
- massive settings surface.

These rejections protect the bounded preview, identity, privacy, platform and
resource contracts. A future reconsideration requires a separate initiative
and architecture decision.

## Failure Cases Learned

| Failure pattern | Zen prevention rule | Affected W0/W1 contract |
| --- | --- | --- |
| Background enrichment blocks foreground UI | Foreground browse/preview work has priority, bounded waits and cancellation; enrichment is disposable | WorkScheduler priority, PreviewSession cancellation, Browse loading states |
| Indexing saturates CPU | Use shared resource budgets, bounded concurrency and observable backpressure | WorkScheduler budgets, progressive loading, QA performance gates |
| Network drive blocks startup | Startup must use bounded probes and expose unavailable/deferred state rather than synchronously waiting | Location availability, startup recovery and platform capability contracts |
| Cloud placeholder causes unintended hydration | Metadata/thumbnail/preview requests must distinguish placeholder state from explicit materialization | Provider hydration consent, Preview Provider capabilities |
| Watcher permission failure is treated as an empty library | Preserve permission-required and reconciliation-required states; do not erase durable truth | Watcher health, reconciliation and Library projection contracts |
| Missed or malformed watcher events corrupt state | Watcher is a hint; validate event identity and reconcile/rescan from durable roots and revisions | Watcher/reconciliation ownership, FileIdentity and Location |
| Too many open file handles | Bound provider/session handles, dispose on cancellation and measure handle lifetime | PreviewSession cleanup, WorkScheduler resource budgets |
| Preview provider crashes the host | Isolate provider failure, surface fallback, release resources and keep the host recoverable | Preview Provider Registry, Preview Host lifecycle and fallback |
| Media preview retains file locks | Close accessors/streams on session disposal and test close-then-rename/move/delete/open | Preview cleanup P0, PreviewSession disposal |
| Space shortcut fires during rename or text input | Respect focus, composition and text-editing ownership before global shortcut activation | Navigation target, keyboard contract and existing IME invariants |
| DPI, multi-monitor or sleep/wake breaks preview | Host lifecycle must handle display/device changes, rehydrate safely and remain cancellable | Preview Host platform contract, native QA matrix |
| Git enrichment freezes large repositories | Detection is advisory, bounded and cancellable; never deep-walk on the foreground path | Git/project detection, WorkScheduler and performance budget |
| Oversized DB batches hit query/expression limits | Use bounded batch sizes and backend-owned projections; test large and deferred paths | Query V2, batch updates, performance/QA matrix |
| Rapid preview switching races or crashes | Bind every response to request/session identity; cancel and dispose the previous session before publication | PreviewSession, Provider Registry, Preview Core/Host lifecycle |

W1 is not authorized by this artifact. The failure cases are acceptance inputs
for later reviewed implementation work, not a production task list.

## Final Adopt / Adapt / Reject Matrix

| Decision | W0 principle | Boundary |
| --- | --- | --- |
| Adopt | identity/location separation, ephemeral browse, promotion, navigation targets, provider/session lifecycle, watcher reconciliation, thumbnail infrastructure, progressive/batched loading, shared budgets, cleanup and native fallback | Specify contracts first; preserve Query V2, Operation Preview, journals, Safe Trash and Restore authorities |
| Adapt | Finder/Explorer navigation, scopes, view preferences, breadcrumbs, folder summaries, project hints and native host integration | Rebuild around Zen's managed scope, consent, platform and fail-closed safety rules |
| Reject for v1 | arbitrary plugins, AI Preview, multi-device state, snapshot cache, OCR, RAG, Agent/shell/MCP runtime and massive settings | No implementation or dependency expansion without a separate approved initiative/ADR |

The next step is the reviewed W0 specification and architecture freeze. This
artifact does not start W1 or authorize File Library 2.0 / Preview Platform
production implementation.
