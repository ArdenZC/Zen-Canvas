# File Library 2.0 / Preview Platform — W0 Specification

Status: active — specification only

Review state: Draft PR #64 under architecture review

Owner: Product and architecture review

Original research/start baseline: `master@37a3d03285c2f9d7f2b30ba1e18c6d640bc7f5d4`

BR0 reconciled baseline: `master@e09447dbf2da46e1b02e6da03bcb3345966f160b` (PR #63 merge)

Branch: `docs/w0-file-library-preview-spec`

This record is the bounded initiative authority for W0. It does not replace
`docs/project/STATUS.md`, and it does not authorize production implementation.

## Problem and research

File Library 2.0 and the Preview Platform are the next product-design problem
after the Engineering OS and macOS correctness hardening. The product needs a
coherent information architecture for managed files and familiar filesystem
browsing, with an explicit preview boundary that preserves existing query,
identity, mutation, recovery and platform authorities.

Research synthesis is complete for W0 input and is persisted in the canonical
[W-1 Open Source Research Synthesis](../research/file-library-preview/OPEN_SOURCE_SYNTHESIS.md).
The research covered Spacedrive, Files, PowerToys Peek, QuickLook for Windows,
TagSpaces, QLMarkdown / SourceCodeSyntaxHighlight and representative failure
reports. It is evidence input, not implementation authorization and not a
license to copy third-party code.

BR0 was repeated after PR #63 merged. The merged provider/portability semantics
strengthen rather than invalidate W0: generic provider paths remain routing
hints rather than provider identity, materialization remains explicit and
consent-bound, capability is layered/runtime-dependent, and byte-dependent
work must independently resolve/revalidate its source.

The first PR #64 architecture-review pass tightened several contracts without
changing W0 product direction: materialization/read state is entry/source scoped,
read eligibility remains an adapter over existing authoritative byte-open rules,
PreviewSession is host/shell-first with bounded opaque content access, Browse
paging is generation-bound, cross-process Browse restoration uses a
non-authoritative locator/bookmark, Scheduler gates require real heavy-authority
resource adapters, and Thumbnail depends on the Materialization/Read Gate.

## Canonical W0 specification set

The review set is:

- [00 — Master Specification](../specs/file-library-preview/00-MASTER-SPEC.md)
- [01 — Product and Information Architecture](../specs/file-library-preview/01-PRODUCT-IA.md)
- [02 — Core Domain Contracts](../specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md)
- [03 — Preview Architecture](../specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md)
- [04 — Infrastructure Contracts](../specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md)
- [05 — Performance Budget and QA Matrix](../specs/file-library-preview/05-PERFORMANCE-QA.md)
- [06 — W1 Foundation Implementation Plan](../specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md)

The numbered set is the architecture-review input. This initiative record
summarizes governance and authorization boundaries; it is not a second copy of
the detailed contracts.

## Scope

In scope:

- File Library 2.0 information architecture;
- Library / Browse dual modes inside one File Library workspace;
- macOS Apple Silicon and Windows x64 platform contracts;
- `EntryRef`, `Location`, NavigationTarget and Ephemeral Browse contracts;
- Preview Core / Preview Host boundary;
- Thumbnail, watcher and reconciliation ownership;
- `WorkScheduler`, materialization/read and resource-budget boundaries;
- preview lifecycle, cancellation and deterministic cleanup;
- performance budget and QA matrix;
- bounded W1 Foundation Track/PR plan.

Acceptance criteria:

- Library and Browse ownership is explicit and does not create a second
  managed-file query authority;
- Query V2 and `LibrarySelectionV1` remain managed-library authorities;
- Quick Preview Core and Preview Host are read-only with respect to filesystem
  mutation and remain separate from Operation Preview / journals / Safe Trash /
  Restore;
- managed watcher/reconciliation authority is preserved rather than rewritten;
- Ephemeral Browse remains session-scoped and cannot become managed-library
  truth implicitly;
- Browse pages/cursors are generation-bound so invalidation cannot stale-publish
  old enumeration results;
- cross-process Browse recovery never revives prior-process ephemeral refs;
- provider/cloud materialization/read eligibility is explicit, entry/source
  scoped and cannot be inferred from path, Location or platform label alone;
- byte consumers continue to use/revalidate through the existing authoritative
  read/open boundary rather than a second eligibility engine;
- performance and QA gates cover Windows 11 x64 and supported macOS Apple
  Silicon without claiming Intel support;
- W1 implementation remains separately authorized after W0 review/merge.

## Non-goals

- no production implementation;
- no schema change;
- no dependency or lockfile change;
- no Intel macOS support;
- no third-party Preview plugin SDK v1;
- no OCR, RAG, AI Preview, Agent or MCP expansion;
- no CI threshold or runtime-authority change;
- no Query V3;
- no unmanaged recursive/global filesystem search engine;
- no managed-watcher rewrite;
- no new filesystem mutation/recovery path;
- no W1 production implementation authorization from this record alone.

## Authority and architecture freeze

Current durable authorities remain:

- File Library Query V2 and `LibrarySelectionV1` for managed-library query and
  selection;
- Global Index for system-wide search, separate from File Library;
- scan-root/watcher revisions and reconciliation for managed-location truth;
- existing filesystem-safety identity and backend revalidation for mutation;
- existing platform/content byte-read eligibility and open/revalidation paths
  for content access;
- server-authoritative Operation Preview and operation journal for file
  mutation;
- Analysis/Finding decisions, Safe Trash and cleanup journal for cleanup;
- operation/cleanup ledgers and identity revalidation for Restore;
- merged macOS Apple Silicon and Windows platform adapters for filesystem
  safety and capability evidence.

Preview boundary:

- Quick Preview is a read-only representation/session system for rapidly
  understanding a selected file or folder;
- Preview Host/Session is created before slow source/provider work so shell,
  cancellation and timeout semantics always exist;
- Preview Core may later own source resolution contracts, provider selection,
  representation preparation, cancellation, cleanup and preview capabilities;
- byte-reading providers use bounded backend/native content access backed by the
  existing authoritative read/open boundary rather than renderer-supplied raw
  paths;
- Preview Host may later own host-specific presentation/session mechanics;
- neither may authorize, revalidate or execute filesystem mutation;
- Metadata fallback must remain available when rich/native preview fails.

Infrastructure boundary:

- `WorkScheduler` is a resource coordination layer, not a durable job runtime;
- selected existing heavy authorities must eventually acquire resource leases
  so scheduler-interference tests exercise real load without transferring
  lifecycle ownership;
- Thumbnail is shared infrastructure and the existing `MacThumbnailService`
  is adapted rather than rewritten;
- byte-reading Thumbnail flows depend on the Materialization/Read Gate;
- managed watcher/reconciliation remains authoritative; Ephemeral Browse
  watcher events are invalidation hints only;
- listing/indexing/thumbnail/analytics/preview must not implicitly hydrate
  provider-backed content;
- Workspace recovery is UI/session recovery and is distinct from filesystem
  Restore; persisted Browse restore locators are non-authoritative and are
  re-resolved into fresh sessions.

## Validation

This branch is documentation/specification only.

Focused validation expected for the W0 PR:

- `npm run test:governance`
- `npm run test:docs`
- `git diff --check`
- review that no production/schema/dependency/CI-threshold/runtime-authority
  change is present.

PR #63 merge baseline is
`e09447dbf2da46e1b02e6da03bcb3345966f160b`. Its real iCloud/File Provider,
external APFS/exFAT and network-volume fixture gaps remain unverified where
fixtures were unavailable; W0 does not convert skipped native fixtures into a
pass claim.

Visual/native/platform behavior, provider fixtures and implementation-level
performance remain unverified until the corresponding later implementation
Wave.

## Wave/Track closeout

W0 design work is represented by the canonical spec set:

- W0-B — Product / information architecture;
- W0-C — Core domain contracts;
- W0-D — Preview architecture;
- W0-E — Infrastructure contracts;
- W0-F — Performance / QA budget;
- W0-G — W1 Foundation implementation plan.

The W1 plan is sequencing only. Production W1 work requires a separately
reviewed W1 initiative after this W0 specification is merged and rebound to the
final W0 merge SHA.

## Closeout

- W0 specification PR: #64 — Draft, architecture review in progress.
- Merge SHA: pending W0 specification review and merge.
- Current-truth files updated on this branch: `STATUS.md`, `ROADMAP.md` and this
  initiative record.
- Deferred/unverified: all production implementation, native Preview behavior,
  provider fixtures, performance execution and W1 work.
- Source branch deletion is a post-merge closeout action after ancestry/content
  equivalence verification.
