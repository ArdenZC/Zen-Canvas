# W0-E — Infrastructure Contracts

## 1. WorkspaceSession

`WorkspaceSession` owns disposable async work associated with the current File Library target:

- Browse enumeration
- query/search request publication
- visible metadata enrichment
- visible thumbnail requests
- Preview session
- ephemeral watcher subscriptions
- bounded folder enrichment

Target switch/dispose revokes publication rights, cancels disposable work and disposes subscriptions.

Durable managed jobs (scan, dedupe, analysis, reconciliation) are not cancelled merely because the workspace changes.

## 2. WorkScheduler

`WorkScheduler` is a resource coordination layer, not a new durable job runtime.

Work classes:

- Foreground — user is directly waiting (first Browse page, first Preview representation, search first page).
- Interactive — visible enrichment (visible thumbnail, folder preview enrichment, full-resolution upgrade).
- Background — indexing/reconciliation/non-visible enrichment/maintenance.

Foreground has priority, but background receives bounded fairness and cannot starve forever.

## 3. Resource budgets

Scheduler must be able to bound/observe at least:

- CPU concurrency
- filesystem IO concurrency
- open handles/file descriptors
- decoder slots
- native preview/helper slots
- provider/network request capacity

No subsystem may silently create its own unbounded executor and ignore global pressure.

## 4. Platform resource policy

Existing macOS activity/thermal/Low Power policy becomes an input to Scheduler; it is not rewritten.

Windows receives an equivalent platform adapter later. Core consumes a platform resource policy rather than scattered `isMac` branches.

## 5. Durable authority boundary and adapters

Scheduler answers “may this work run now and with what resource lease?”

It does not own durable completion/retry/recovery state for scan, dedupe, analysis or filesystem mutation. No `generic_jobs_v2` or scheduler job table is created by W1.

To make the global resource budget real, W1 must add bounded **resource-lease adapters** at selected existing heavy authorities (for example scan/index/reconciliation and other approved high-cost paths). Those authorities keep their own lifecycle, cancellation, recovery and durable state; they only acquire/release scheduler capacity around expensive work.

The F4 scheduler-interference gate is not satisfied if legacy heavy work can completely bypass the resource budget.

## 6. ThumbnailService

Thumbnail is shared infrastructure serving List, Grid, Inspector, Preview placeholder and Folder Preview.

Request shape includes EntryRef, variant, work priority and session ownership.

Variants in v1 foundation:

- small
- medium
- large

Physical pixels are platform scaling/Retina policy, not UI constants scattered through components.

## 7. Thumbnail cache identity

Logical cache key moves toward:

- stable backend-verified source/content identity where available
- source version
- variant
- renderer/provider ID
- renderer version

Path is a resolution input, not the logical identity.

Rename/move reuse is allowed only when stable verified identity survives the operation. Ephemeral session-only identity does not justify persistent cross-session disk-cache reuse; it may use session/memory cache instead.

Existing `MacThumbnailService` is preserved and adapted, not rewritten; its cancellation, timeout, identity revalidation, bounded staging and bounded cache behavior remain assets.

## 8. Thumbnail pipeline

```text
request
 -> source/materialization/read eligibility
 -> memory cache?
 -> disk cache?
 -> immediate placeholder/system icon
 -> bounded generation through WorkScheduler
 -> cache
 -> visible update if session/entry is still current
```

Thumbnail cache miss never blocks initial entry presentation.

Visible viewport requests receive higher priority than offscreen requests. Requests are bounded, deduplicated, cancellable and backpressured.

A byte-reading thumbnail provider must pass the same authoritative read/materialization gate as other byte consumers; it cannot silently hydrate a provider placeholder.

## 9. Managed watcher

Existing managed watcher/reconciliation remains authoritative.

File Library 2.0 only consumes managed health/revision/reconciliation state to project `LocationFreshness`.

No W1 watcher rewrite.

## 10. Ephemeral Browse change tracking

Ephemeral watcher is session-scoped and emits invalidation/change hints only. It cannot write managed DB state, create scan roots, start dedupe/analysis or alter Query V2 truth.

Hint handling should invalidate/re-enumerate affected entries/pages. Any refresh creates a new Browse enumeration generation; pages/cursors from the previous enumeration lose publication rights. Overflow triggers bounded current-target refresh rather than false completeness.

## 11. Materialization / Read Gate

`MaterializationGate` is a facade/adaptor over existing platform/content byte-read authorities. It is **not** a second eligibility engine.

Every byte-dependent read path (Preview, Thumbnail, content extraction, hashing, deep folder enrichment) evaluates the authoritative read gate before opening provider-backed content.

Read intents may include:

- metadata
- thumbnail
- preview
- content_analysis
- hashing

Materialization/content state is entry/source scoped. Listing/metadata operations should remain metadata-only where possible.

v1 policy remains `never_implicit` / `user_initiated_only`.

PR #63 capability layers must be respected: platform implementation, runtime environment and operation/read eligibility are distinct. A previous eligibility result is not durable authorization; the byte consumer revalidates at its own open boundary.

Where the Preview/provider architecture needs bytes without exposing raw paths to generic UI/provider code, infrastructure may issue a bounded opaque content-read lease tied to the current request/source version and backed by the authoritative open/revalidation path.

## 12. Workspace events

Platform/filesystem-specific events are normalized before frontend publication.

Workspace events are batched/scope-aware and may include:

- entries changed
- location state changed
- thumbnail ready
- Browse invalidated
- managed snapshot invalidated

Backend event count must not map one-to-one to React renders.

## 13. WorkspaceRecoveryPolicy

May persist presentation/session preferences such as:

- last mode
- last safe Library target/target key
- a non-authoritative Browse restore locator/bookmark
- List/Grid preference keyed by stable presentation identity
- Context Panel state
- safe scroll anchor

Must not persist/revive live handles, provider instances, Browse session IDs, `BrowsePathRef`, ephemeral `LocationRef`, `EphemeralEntryRef` or in-flight requests.

A persisted Browse restore locator is routing/presentation data only. On restart it must be resolved into a fresh Browse session/location/path reference and current capability/availability must be revalidated before use.

After abnormal exit:

- shell comes up first;
- Preview is not automatically reopened;
- unsafe/offline/network/provider targets are not allowed to create startup death loops;
- bounded restore failure falls back to a safe File Library state with explicit retry.

## 14. Startup invariant

Interactive shell must not wait for network probes, external volumes, indexing, reconciliation, thumbnail generation, Git/project enrichment or Preview restoration before appearing.
