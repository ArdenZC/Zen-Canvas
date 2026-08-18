# Zen Canvas Roadmap

The roadmap records authorized sequencing, not a promise that every item will
ship unchanged. Production implementation still requires an active initiative
with explicit scope and acceptance gates.

Long-horizon product direction, architecture invariants and Wave boundaries are
owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md). This Roadmap
records current sequencing/progress and must not silently expand that plan.

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

### File Library 2.0 / Preview Platform — W1 Foundation

Status: complete — Foundation implementation, integration and F4 performance/QA
are closed through W1-12 current-truth closeout and post-closeout audit remediation.

Authority record:
[`initiatives/W1-file-library-foundation.md`](initiatives/W1-file-library-foundation.md).

Runtime baseline: `master@b4001d7c5d09686b15f74125a828b61b0e913b7f`
(PR #82 W1-11 squash merge).

Closeout/governance baseline: `master@ecde9f146e1e4e4933f6294358fe4a6523c7c0bd`
(PR #83 W1-12 squash merge).

Post-closeout evidence baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`
(PR #85).

Final independently reviewed W1-11 production head:
`70b45d787dd6b2fb9c0f7ad14c0d36e03fea22bb`.

Full Validation: run `32064210757` / #678 — success.

#### F1 — Contract Spine — complete

- W1-00 — W1 governance/authorization activation.
- W1-01 — shared implementation contracts and serialization boundaries.

#### F2 — Parallel Core — complete

- W1-02 — Workspace Navigation / WorkspaceSession.
- W1-03 — Ephemeral Browse Core.
- W1-04 — Location Core / fail-closed projections.
- W1-05 — WorkScheduler and selected real heavy-authority adapters.
- W1-06 — Preview Contract Core.

#### F3 — Infrastructure — complete

- W1-07 — Materialization / Read Gate.
- W1-08 — Thumbnail Infrastructure.
- W1-09 — Ephemeral Change / Refresh.
- W1-10 — Integration Surface.

#### F4 — Foundation Release — complete

- W1-11 — scale/performance/cancellation/resource/platform evidence.
- W1-12 — closeout/current-truth convergence.

W1 completion means the **Foundation is complete**. It does not mean the File
Library 2.0 user experience, rich Preview Platform, native Finder/Explorer
integration or release program is complete.

W1-11 retained two scheduler interference observations as **TARGET MISSED**, not
HARD failures: Windows ~`2.30x` idle and Apple Silicon macOS ~`4.19x` idle versus
the 2x target. Structural Scheduler HARD gates passed. Real iCloud/File Provider,
external APFS/exFAT, SMB/network and other unavailable native/product fixtures
remain explicitly `UNVERIFIED`.

## Current

### W2 — File Library 2.0 Experience

Status: active — implementation

Authority record:
[`initiatives/W2-file-library-experience.md`](initiatives/W2-file-library-experience.md).

Planning baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`.

Reviewed implementation-plan baseline:
`master@e91416c83082b61a0d3042c9438d77c7b8586297` (PR #86).

Reviewed visual/interaction freeze baseline:
`master@251bab36797cde4129656f57667ed203f20415e6` (PR #87).

W2-00 authorizes production implementation of the bounded dependency graph in
[`specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`](specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md),
with visual/interaction behavior constrained by
[`specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`](specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md).

W2-01 Workspace Shell + Experience Controller completed and squash merged through
PR #90 as `master@2c22c90f67826b255cdce2f82313aa352d61a9f3`. Its reviewed
production head was `48ce853cce5989749ddf19a3b880bc02446625ff`; the final
real-browser/CI closeout head was `08595005669d5346b974d11007f2d300e7b801fa`,
with CI #717 / `32137181033` successful. Packaged Windows/macOS visual parity
remains unverified.

#### Current W2 production sequence

- **W2-01 — Workspace Shell + Experience Controller:** complete; merged through PR #90.
- **W2-02 — Shared Presentation / Entry / Selection Contracts:** next dependency-eligible Track; not started.
- **W2-03 — Library Mode Adapter / Migration:** blocked on W2-02.
- **W2-04 — Browse Mode Navigation + Content:** blocked on W2-02.
- **W2-05 / W2-06 / W2-07 — List / Grid / Context:** follow the reviewed graph after source adapters/contracts are stable.
- **W2-08 / W2-09 — Search, Filter, Sort, Preferences / Platform Navigation:** follow the reviewed source-mode seams.
- **W2-10 / W2-11 / W2-12 — Integration, QA and closeout:** remain later gates.

Authorized W2 implementation scope:

- Library / Browse workspace shell;
- migration of the existing Query V2 Library surface into the shared workspace;
- W1-backed familiar Browse experience;
- shared virtualized List / Grid presentation;
- Context Panel / Inspector integration with explicit user-controlled visibility;
- per-target presentation preferences without replacing WorkspaceSession live history;
- managed Library search/filter plus bounded current-folder Browse filtering;
- truthful, spatially stable Browse sort completeness behavior;
- platform-adaptive navigation and managed/unmanaged affordances;
- 100k virtualized Library/Browse presentation and accessibility/focus/keyboard/DPI QA.

W2 explicitly does not authorize W3 rich Preview UI/providers, W4 native system
integration, Query V3, a new watcher/Scheduler/Read Gate/mutation authority,
arbitrary recursive unmanaged filesystem search or schema changes solely for UI
convenience.

## Planned after W2

### W3 — Preview Platform

Planned scope, not yet authorized:

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
real platform/provider fixture and polish closeout, including signing,
notarization and publication state.

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
- reduce browser mock concentration while preserving deterministic mock honesty;
- investigate the W1 scheduler pressure-latency target miss without weakening
  the existing target or structural fairness/cancellation gates.

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
