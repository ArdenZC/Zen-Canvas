# Zen Canvas Roadmap

The roadmap records authorized sequencing, not a promise that every item will
ship unchanged. Production implementation still requires an active initiative
with explicit scope and acceptance gates.

## Completed

### G1 — Engineering OS

Goal: make project state, architecture ownership, technical debt, risk,
workflow and closeout rules explicit and durable.

- **G1A — Current Truth and workflow foundation:** complete; merged through PR #57.
- **G1B — Public docs and evidence convergence:** complete; merged through PR #60.

G1 does not change product runtime behavior.

### M1 — macOS Mutation Correctness Remediation V2

Status: complete — production implementation and exact-head validation landed
at `master@c802397930ce276de7902ee37d5927083f2912ed`.

### M1.1 — Provider and Portability Closeout

Status: complete — PR #63 merged as
`master@e09447dbf2da46e1b02e6da03bcb3345966f160b`.

### File Library 2.0 / Preview Platform — W0 Specification

Status: complete — PR #64 squash merged as
`master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3`.

The merged W0 architecture set starts at
[`specs/file-library-preview/00-MASTER-SPEC.md`](specs/file-library-preview/00-MASTER-SPEC.md).
It freezes Library/Browse product IA, Entry/Location/Browse identity contracts,
Preview Core/Host boundaries, Materialization/Read semantics, WorkScheduler /
Thumbnail / watcher ownership, performance gates and the W1 dependency plan.

## Current

### File Library 2.0 / Preview Platform — W1 Foundation

Status: active — implementation.

Authority:
[`initiatives/W1-file-library-foundation.md`](initiatives/W1-file-library-foundation.md).

Baseline: `master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3` (W0 PR #64 merge).

Goal: implement the W0 foundation contracts without replacing existing durable
authorities or pulling W2/W3/W4 scope forward.

#### F1 — Contract Spine

- W1-00 — activate W1 governance/current truth and close W0.
- W1-01 — shared implementation contracts and serialization tests for
  EntryRef/LocationRef/NavigationTarget, Browse generation identity,
  non-authoritative restore locator, availability/freshness/content state,
  ContentReadEligibility, WorkClass, Preview source/host and opaque content-read
  lease boundaries.

F1 must merge before the parallel core Tracks start.

#### F2 — Parallel Core

After W1-01:

- W1-02 Workspace Navigation / WorkspaceSession;
- W1-03 Ephemeral Browse Core;
- W1-04 Location Core / platform adapters;
- W1-05 WorkScheduler / selected heavy-authority resource adapters;
- W1-06 Preview Contract Core.

#### F3 — Infrastructure

After required F2 dependencies:

- W1-07 Materialization / Read Gate;
- W1-08 Thumbnail Infrastructure (depends on W1-07 for byte reads);
- W1-09 Ephemeral Change / Refresh;
- W1-10 Integration Surface.

#### F4 — Foundation Release

- W1-11 performance/instrumentation/platform QA;
- W1-12 closeout/current-truth update.

Only F4 completion authorizes a separate W2 Experience initiative.

## Planned after W1

### W2 — File Library 2.0 Experience

Planned scope:

- Library / Browse workspace shell;
- platform-adaptive navigation;
- List / Grid presentation;
- Context Panel / Inspector integration;
- per-target presentation preferences;
- managed/unmanaged search and navigation experience.

### W3 — Preview Platform

Planned scope:

- Quick Preview UI;
- rich built-in providers such as Text/Code, Markdown, structured data,
  CSV/TSV, Folder, ZIP and Images;
- rapid-switch, cleanup, corrupt-source and 100k Folder Preview gates.

### W4 — Native Integration

Planned scope after core Preview is stable:

- macOS Apple Silicon Quick Look extension/host integration;
- Windows Quick Preview/system integration, with Preview Handler support
  evaluated separately;
- native lifecycle, DPI/display/provider failure QA.

### W5 — Release Gate

No feature expansion. Full performance, stability, security, accessibility,
platform-fixture and polish closeout.

## Architecture hardening lane

These are not independent product modules. They are executed only when a
product initiative naturally reaches the relevant boundary or an explicit
hardening initiative is approved.

- split `AppRuntimeProviders` ownership without creating duplicate runtime
  authorities;
- converge Windows platform boundaries toward the explicit macOS
  platform-adapter shape where useful;
- reduce oversized Rust domain modules without changing behavior or persistence
  authority;
- converge Tauri command/permission registries where it can be proven safe;
- reduce browser mock concentration while preserving deterministic mock
  honesty.

## Technical-debt retirement lane

Retire only when the deletion condition in `TECH_DEBT.md` is satisfied. Priority
candidates include:

- legacy File Library compatibility store;
- legacy watcher adapter;
- legacy operation preview callback paths;
- `useOrganizeDecisionStore` compatibility bridge;
- `global_index/legacy_queue.rs`;
- legacy design-token aliases;
- dead Tauri command/permission surface confirmed to have no caller;
- obsolete packaging/build assets after real package verification;
- merged/superseded remote branches after equivalence proof.

## Not authorized by this roadmap

This roadmap does not authorize OCR, RAG/vector database, AI Preview, a generic
Agent runtime, shell/MCP/tool execution, Rule AST V2, a second AI queue, a new
operation/recovery system, Query V3, a managed-watcher rewrite, a second
content-read eligibility engine, arbitrary unmanaged recursive/global filesystem
search, third-party Preview plugin SDK, Linux support, Intel macOS support or
schema changes.

Any such expansion requires a separate product/architecture decision.
