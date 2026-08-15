# File Library 2.0 / Preview Platform — W0 Specification

Status: active — specification only

Owner: Product and architecture review

Start baseline: `master@ffdd71d19a97ffbea6cc5e1340f9201417d85ac5`

Branch: not yet created; a dedicated W0 specification branch follows review kickoff

This record is the bounded initiative authority for W0. It does not replace
`docs/project/STATUS.md`, and it does not authorize production implementation.

## Problem and research

File Library 2.0 and the Preview Platform are the next product-design problem
after the Engineering OS installation. The product needs a coherent
information architecture for managed files and familiar filesystem browsing,
with an explicit preview boundary that preserves existing query, identity,
mutation, recovery and platform authorities.

Research synthesis is complete for W0 input:

- W-1 Open Source Research — completed.
- Spacedrive.
- Files.
- PowerToys Peek.
- QuickLook for Windows.
- TagSpaces.
- QLMarkdown / SourceCodeSyntaxHighlight.

The research informs the W0 specification; it does not authorize copying
third-party behavior, changing runtime authorities or selecting a plugin SDK.

## Scope

- In scope:
  - File Library 2.0 information architecture;
  - Library / Browse dual modes;
  - macOS Apple Silicon and Windows x64 platform contracts;
  - Preview Core / Preview Host boundary;
  - `FileIdentity`, `Location` and `Ephemeral Browse` contracts;
  - Thumbnail, watcher and reconciliation ownership;
  - `WorkScheduler` and resource budgets;
  - preview lifecycle, cancellation and cleanup;
  - performance budget;
  - QA matrix;
  - W0 Wave/Track plan.
- Deliverables:
  - reviewed product specification and information architecture;
  - architecture-freeze contracts for browse, preview, identity, lifecycle and
    platform boundaries;
  - explicit performance/QA budgets and acceptance matrix;
  - bounded Wave/Track plan for later implementation review.
- Acceptance criteria:
  - Library and Browse ownership is explicit and does not create a second
    managed-file query authority;
  - Quick Preview Core and Preview Host responsibilities, cancellation and
    cleanup are explicit and remain read-only with respect to filesystem
    mutation;
  - the Quick Preview Platform remains distinct from the existing authoritative
    Operation Preview / journal / Safe Trash / Restore mutation chain;
  - File identity, location, ephemeral browsing, thumbnails, watcher health
    and reconciliation boundaries are fail-closed and platform-specific where
    required;
  - performance budgets and the QA matrix cover Windows x64 and supported
    macOS Apple Silicon without claiming Intel support;
  - the W0 specification is reviewed before any implementation initiative is
    proposed.

## Non-goals

- no production implementation;
- no schema change;
- no dependency or lockfile change;
- no Intel macOS support;
- no third-party Preview plugin SDK v1;
- no OCR, RAG, Agent or MCP expansion;
- no CI threshold or runtime-authority change;
- no W1 implementation authorization.

## Authority and architecture freeze

- Current durable authorities:
  - File Library Query V2 and `LibrarySelectionV1` for managed-library query and
    selection;
  - Global Index for system-wide search, separate from File Library;
  - server-authoritative Operation Preview and operation journal for file
    mutation;
  - Analysis/Finding decisions, Safe Trash and cleanup journal for cleanup;
  - operation/cleanup ledgers and identity revalidation for Restore;
  - existing macOS Apple Silicon and Windows platform adapters for filesystem
    safety.
- Preview boundary:
  - the planned Quick Preview Platform is a read-only representation/session
    system for rapidly understanding a selected file or folder;
  - Preview Core may own provider selection, representation preparation,
    cancellation, cleanup and preview capabilities once separately authorized;
  - Preview Host may own host-specific window/panel/session presentation once
    separately authorized;
  - neither Quick Preview Core nor Preview Host may authorize, revalidate or
    execute filesystem mutation;
  - any move, rename, cleanup, permanent delete or restore continues to use the
    existing Operation Preview, backend revalidation, journals, Safe Trash and
    Restore authorities.
- Frontend/projection boundaries:
  - Library and Browse are user-facing projections over explicitly documented
    scopes; Ephemeral Browse must not become managed-library truth;
  - thumbnails, watcher health and reconciliation remain bounded domain
    contracts, not a generic runtime or universal reconciliation framework.
- W0 architecture-freeze rule: Preview Core, Preview Host, `FileIdentity`,
  `Location`, `Ephemeral Browse` and `WorkScheduler` are specification
  contracts only until a separately reviewed implementation initiative.
- Authority, persistence, platform, permission or recovery changes: none.
- ADR or narrower security contract: to be identified by the reviewed W0
  specification; no new runtime contract is created by this record.

## Validation

- Focused checks: documentation scope and Markdown validation for this
  initiative record.
- Applicable full checks: `npm run test:docs`; `git diff --check`.
- Exact-head evidence: this record starts at PR #60 merge commit
  `ffdd71d19a97ffbea6cc5e1340f9201417d85ac5`.
- Visual/native/platform checks: deferred to the reviewed W0 specification and
  later implementation gates; no product behavior is implemented here.
- Known unverified areas: all W0 product behavior, native preview rendering,
  real provider fixtures and implementation-level performance remain
  unverified until separately authorized work.

## Wave/Track and PR

- Wave/Track breakdown for W0 only:
  - Wave 0 / Track A — information architecture and Library/Browse modes;
  - Wave 0 / Track B — identity, location, ephemeral browsing and platform
    contracts;
  - Wave 0 / Track C — Preview Core/Host lifecycle, cancellation and cleanup;
  - Wave 0 / Track D — thumbnails, watcher/reconciliation and WorkScheduler
    budgets;
  - Wave 0 / Track E — performance budget, QA matrix and acceptance closeout.
- No W1 or production implementation track is authorized by this record.
- PR URL/number: introduced by the G1 closeout commit; no separate W0 PR yet.
- Review owners or required reviewers: product, architecture and platform QA
  review before any implementation initiative.

## Closeout

- Merge SHA: pending W0 specification review.
- Current-truth files updated: `STATUS.md`, `ROADMAP.md` and this initiative
  record.
- Deferred/unverified items recorded: production implementation, native preview
  behavior, provider fixtures, performance execution and all W1 work.
- Source and integration branches deleted after ancestor/content-equivalence
  verification: not applicable; no W0 implementation branch exists yet.
