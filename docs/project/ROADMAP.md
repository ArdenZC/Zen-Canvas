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

M1 was a bounded hardening initiative. Its native and Windows evidence remains
bound to its exact production head and does not authorize new product features.

### M1.1 — Provider and Portability Closeout

Status: complete — PR #63 merged as
`master@e09447dbf2da46e1b02e6da03bcb3345966f160b`.

The merge preserves explicit provider materialization, fail-closed layered
capabilities and existing mutation/recovery authorities. Those semantics are
inputs to later File Library / Preview work, not functionality to replace.

## Current

### File Library 2.0 / Preview Platform — W0 Specification

Status: active — specification only.

Review state: Draft PR #64 is under architecture review on
`docs/w0-file-library-preview-spec`.

BR0 is reconciled against
`master@e09447dbf2da46e1b02e6da03bcb3345966f160b` after PR #63 merge.

The canonical architecture-review set starts at
[`specs/file-library-preview/00-MASTER-SPEC.md`](specs/file-library-preview/00-MASTER-SPEC.md)
and contains product IA, core domain contracts, Preview architecture,
infrastructure contracts, performance/QA gates and the bounded W1 Foundation
implementation plan.

Goal: specify the next-generation File Library experience with one File
Library entry and two internal organization modes:

- **Library Mode** — managed/query organization over existing File Library Query V2;
- **Browse Mode** — familiar path/filesystem navigation that may inspect
  unmanaged locations without implicitly admitting them to the managed library.

The workspace uses shared Navigation / Content / Context structure, List/Grid
presentation, platform-adaptive macOS Finder-familiar and Windows
Explorer-familiar Browse navigation, and a read-only Quick Preview Platform
that remains separate from Operation Preview and all mutation/recovery
authorities.

W0 is a specification/architecture-freeze phase. It authorizes research
synthesis, product specification, information architecture, architecture
contracts, performance/QA budgets and Wave/Track planning only. No production
implementation, schema/dependency change, CI-threshold change or runtime
authority change is authorized by W0.

## Authorized sequence after W0 review

The following sequence is planned, but each production Wave still requires its
own initiative authorization and applicable gates.

### W1 — Foundation

Planned scope:

- shared Entry/Location/Navigation contracts;
- WorkspaceSession and Ephemeral Browse core;
- Location projections/adapters;
- WorkScheduler/resource leases plus selected adapters for existing heavy
  authorities so global foreground/background pressure can be tested honestly;
- Preview lifecycle contracts without rich user-facing providers;
- explicit Materialization/Read Gate adapting existing authoritative byte-read
  eligibility/open semantics rather than creating a second read engine;
- shared Thumbnail infrastructure that adapts rather than rewrites the current
  macOS thumbnail implementation;
- session-scoped ephemeral change invalidation with enumeration-generation
  stale-page protection;
- safe non-authoritative Browse restore locator/bookmark semantics;
- integration surface and Foundation performance/QA gates.

W1 explicitly does **not** include the polished File Library 2.0 UI, rich
Markdown/JSON/CSV/ZIP/Folder Preview providers, Finder Quick Look Extension or
Windows Explorer Space integration.

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
operation/recovery system, Query V3, a managed-watcher rewrite, third-party
Preview plugin SDK, Linux support, Intel macOS support or schema changes.

Any such expansion requires a separate product/architecture decision.
