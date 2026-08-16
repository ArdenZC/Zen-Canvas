# File Library 2.0 / Preview Platform — Research Rounds Synthesis

This document preserves how the external-project research converged into the W0/W1 architecture. It is intentionally chronological so future contributors can understand not only the final rules, but the sequence of problems that produced them.

## Round 1 — Reference architecture and product-model discovery

Primary references:

- Spacedrive v2;
- Files;
- PowerToys Peek;
- QuickLook for Windows;
- TagSpaces;
- QLMarkdown;
- SourceCodeSyntaxHighlight.

### Questions

- Should File Library remain a pile of indexed files, or become a richer workspace?
- Can Zen support users who prefer Finder/Explorer without forcing them into Library semantics?
- How should logical file identity relate to path/location?
- Should Preview be a UI component or a reusable platform?
- What belongs to native system preview versus Zen's own preview host?

### Conclusions adopted

#### Entry / Location / path separation

Spacedrive strongly reinforced:

```text
File / Entry identity != PhysicalPath
```

Zen should model `Entry` and `Location` explicitly, with path remaining a resolution/routing fact.

This later became W0-C / W1-01.

#### Library + Browse as two first-class modes

Files and the user's existing Finder/Explorer habits reinforced that semantic Library should not replace direct filesystem browsing.

Zen therefore chose:

```text
one File Library workspace
├─ Library Mode  -> managed/query truth
└─ Browse Mode   -> ephemeral filesystem truth
```

The UI can share a shell while the underlying authorities remain separate.

#### PreviewProvider registry

QuickLook for Windows reinforced stable provider identity, ordering/priority, fallback and lifecycle.

Zen adopted an internal provider registry but rejected arbitrary third-party Preview plugins for v1.

#### Preview lifecycle / cleanup

PowerToys Peek made cancellation, deterministic cleanup and native-resource lifetime first-class concerns rather than implementation details.

#### Native Quick Look as a host, not the architecture

QLMarkdown / SourceCodeSyntaxHighlight reinforced that macOS Quick Look extensions are constrained native hosts with UTType/sandbox/type-registration behavior.

Zen therefore separated Preview Core from Preview Host.

#### Thumbnail as infrastructure

TagSpaces reinforced that thumbnails serve multiple perspectives/surfaces and deserve a shared bounded service rather than Grid-specific image loading.

### Explicit rejections after Round 1

- distributed-filesystem/cloud-drive scope;
- forcing Browse users into managed Library indexing;
- third-party Preview plugin SDK in v1;
- copying GPL/AGPL implementation code;
- one giant generic Preview renderer;
- full Explorer/Finder clone scope.

---

## Round 2 — Navigation, presentation and host semantics

The second round focused less on “which projects exist?” and more on the interaction contracts that emerged when their strengths were compared.

### Shared `NavigationTarget`

Library saved views and Browse paths should participate in one Back/Forward history even though they use different authorities.

This became:

```text
NavigationTarget
├─ Library target
└─ Browse target
```

The shell owns navigation chronology; the data source owns truth.

### Per-target presentation memory

List/Grid, sort and similar presentation state should not be one global setting.

The research favored remembering presentation by meaningful navigation target/history state so a user can naturally keep Grid in an image-heavy target and List elsewhere.

### Responsive breadcrumb collapse

The Files/Explorer-style research favored keeping the current location and nearest ancestors visible while collapsing older ancestors first in narrow layouts.

### `HostCapabilities`

Once Preview Core and Preview Host were separated, the UI needed a way to know what a specific host can actually do.

The conclusion was to intersect:

- provider capability;
- source capability;
- host capability;

into effective Preview capabilities.

### Windows Quick Preview Host != Explorer Preview Handler

This was a major Round-2 clarification.

Zen should not equate:

- an in-app/Zen Space-triggered preview host;
- a Windows Explorer Preview Handler integration.

They are separate native capability paths. The Zen host is the priority product experience; system handler integration belongs to later native-integration evaluation.

---

## Round 3 — Ephemeral sources, change flow and scale

The third round focused on what happens when Zen browses locations that are not already managed/indexed.

### `EphemeralBrowseSource`

Browse must work without first creating a scan root or managed Library entry.

That required session-scoped opaque references, progressive enumeration and explicit disposal.

### Persistent / ephemeral identity promotion

When the user intentionally promotes a browsed location/item into managed Library state, Zen may connect ephemeral and persistent identities only when continuity can be proven.

Path equality alone is not enough for durable identity attachment.

### Discovery -> Batch -> Processing pipeline

Large-directory work should be staged:

```text
Discovery
-> bounded batch/page
-> optional processing/enrichment
```

rather than “discover everything, enrich everything, then render”.

### Watcher + reconciliation

Watcher events are hints. They may invalidate current Browse enumeration or managed freshness, but they are not perfectly ordered row-level truth.

Overflow/ambiguity must degrade toward bounded refresh/reconciliation.

### Content-identity thumbnail keys

Thumbnail cache keys should represent source/content identity, source version, variant and renderer version rather than simply path.

For ephemeral sources without durable identity, use bounded session/memory cache instead of inventing persistent identity.

### Batched UI publication

Backend events/pages should be published in bounded batches. A 100k logical result set must not cause 100k synchronous UI events or DOM rows.

### `WorkspaceSession` cancellation

Navigation/target switch must revoke publication rights for work owned by the old workspace target.

This became the session/request/generation stale-publication model used throughout W1.

### Rich location availability states

Location state must distinguish concepts such as:

- current/available;
- unavailable/offline;
- stale/reconciling;
- provider/network/external conditions.

Availability is not deletion.

### Explicit rejection: ephemeral disk snapshots in v1

The research considered persisting ephemeral Browse snapshots for faster restore/reopen, but rejected this for the initial architecture because it would create another durable truth/lifecycle problem.

Cross-process restore instead uses a non-authoritative locator/bookmark that must be re-resolved into fresh session refs.

---

## Round 4 — Resource policy, cloud/provider behavior and final W-1 freeze

Round 4 tested whether the architecture remained safe under real desktop constraints rather than only clean domain diagrams.

### Global `WorkScheduler`

A common resource scheduler was adopted so Thumbnail, Preview, Browse enrichment, scan/reconciliation adapters and other heavy work cannot each create independent unlimited concurrency.

The scheduler governs resource leases/backpressure, not durable job lifecycle.

### Cloud placeholder / hydration policy

The research froze:

- metadata-first behavior;
- no implicit hydration for Thumbnail/Preview/indexing/enrichment;
- explicit user materialization where bytes are required;
- re-resolve/revalidate after materialization.

This later became W1-07 Read Gate.

### Recovery / safe restore

Workspace restoration must not automatically resurrect problematic Preview/network/provider state into a startup loop.

Persisted restore hints are non-authoritative and must be revalidated.

### Freshness, isolation and cancellation

The final infrastructure contract distinguished:

- availability;
- freshness/reconciliation;
- session ownership;
- cancellation/publication rights;
- resource ownership.

These dimensions must not collapse into one boolean “loaded” state.

### Regression matrix as architecture evidence

The research concluded that platform correctness needs explicit fixtures and failure-state matrices, including:

- local/external/network locations;
- cloud placeholders;
- permission failures;
- watcher overflow;
- rapid target switching;
- Preview provider timeout/crash;
- repeated open/close cleanup;
- large 100k/1M data sets where applicable.

### Adapted / deferred rather than rejected forever

Round 4 kept several ideas but assigned them to later Waves:

- native Preview fallback/hosts -> W3/W4;
- bounded search scopes -> W2;
- folder analytics/Git detection -> W3 enrichment;
- system integration -> W4.

### Explicitly rejected/deferred from the current program

- third-party Preview plugins;
- workspace/Space customization becoming a new product layer during Foundation;
- ephemeral disk snapshots as durable Browse truth;
- AI Preview / automatic content understanding;
- OCR/RAG/Agent/MCP expansion;
- automatic cloud hydration;
- managed watcher rewrite;
- Query V3 simply to support the new UI.

---

## Final W-1 conclusion

After the four research rounds, the initiative was considered sufficiently researched to freeze architecture.

The final mapping became:

```text
W-1  Research / references          COMPLETE
  ↓
W0   Product + architecture freeze
  ↓
W1   Foundation contracts/services
  ↓
W2   File Library 2.0 Experience
  ↓
W3   Preview Platform
  ↓
W4   Native Integration
  ↓
W5   Release / Hardening
```

The most important meta-conclusion was:

> External projects are useful because they expose good product patterns and real failure modes. Zen should synthesize those lessons into its own authority/safety model rather than choosing one project to clone.

## Traceability into canonical Zen documents

The research conclusions were subsequently frozen into:

- `docs/project/MASTER_DEVELOPMENT_PLAN.md`;
- `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`;
- `01-PRODUCT-IA.md`;
- `02-CORE-DOMAIN-CONTRACTS.md`;
- `03-PREVIEW-ARCHITECTURE.md`;
- `04-INFRASTRUCTURE-CONTRACTS.md`;
- `05-PERFORMANCE-QA.md`;
- `06-W1-IMPLEMENTATION-PLAN.md`.

When this historical research note and a later reviewed specification differ, the later reviewed specification is the current implementation contract. This document explains the rationale; it does not reopen frozen decisions by itself.