# Zen Canvas Roadmap

The roadmap records authorized sequencing and current execution truth. It does not silently activate a later Wave merely because an earlier Wave completes. Long-horizon product direction and Wave boundaries remain owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md).

Last verified: 2026-08-22

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

Activation gate:
[`tasks/W3-00-PREVIEW-PLATFORM-ACTIVATION-CODEX.md`](tasks/W3-00-PREVIEW-PLATFORM-ACTIVATION-CODEX.md).

Activation baseline:
`master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`.

W3 turns the merged W1 Preview Core and completed W2 File Library workspace into the user-facing Zen Quick Preview platform. It does not authorize Finder/Explorer system integration.

The pre-activation audit found no need for a new durable authority, schema, supported-platform change, mutation/recovery change or cross-window permission model. W3 therefore activates without a new ADR. If a later Track would require any such move, that Track stops for architecture review/ADR before implementation.

W3 dependency graph:

```text
W3-00  Activation + Architecture/Experience Freeze             ACTIVE / activation PR
  ↓
W3-01  Preview Core Consumer-Readiness                          NEXT
       ├─ Provider Registry production composition
       ├─ truthful Zen Host / Source capabilities
       ├─ exhaustive strict Rust/TS representation wire
       ├─ safe asset-bearing representation transport
       └─ bounded progressive publication contract
  ↓
W3-02  Zen Floating Quick Preview Host
  ↓
 ┌───────────────────────────┬───────────────────────────┬───────────────────────────┐
 ↓                           ↓                           ↓                           ↓
W3-03 Pinned Preview +       W3-04 Text/Code +           W3-05 Structured +          W3-06 Image
      sibling navigation           Markdown                    Table providers             provider
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

#### W3-00 — Activation / freeze

Docs/governance only. It activates W3, records the consumer-readiness audit, freezes Quick Preview behavior and establishes the dependency graph. No production code belongs in W3-00.

#### W3-01 — Preview Core Consumer-Readiness — NEXT

The existing W1 Preview foundation is intentionally metadata-only at the production consumption boundary. W3-01 must make that foundation safe for user-facing hosts/providers before rich provider work starts.

Mandatory scope:

- one bounded Provider Registry production composition owner;
- truthful `zen_floating` / `zen_pinned` Host capability matrices;
- truthful backend source capability projection;
- exhaustive Rust/TypeScript `PreviewRepresentation` wire union;
- safe bounded asset transport with no renderer source paths;
- progressive request/sourceVersion-bound publication semantics suitable for Folder Preview;
- lifecycle/cancel/dispose/stale-publication tests.

#### W3-02 — Zen Floating Quick Preview Host

First user-facing Quick Preview host. Space/Esc, shell-first behavior, shared Library/Browse source mapping, Metadata fallback and one frontend Preview experience controller. It consumes the W1/W3 Preview lifecycle; it does not select providers or read files directly.

#### W3-03 — Pinned Preview + sibling navigation

Pinned Preview becomes the W2 Context Panel Preview state and uses the same Preview Core. Navigation remains a bounded projection over the current workspace collection, never a second query engine or all-matching materialization.

#### W3-04 — Text/Code + Markdown providers

Bounded read-only text/code and sanitized Markdown SafeHTML; no execution or arbitrary remote resources.

#### W3-05 — Structured + Table providers

JSON/YAML/XML and CSV/TSV with bounded parsing/serialization, hostile fixtures, no XML network/entity expansion and no formula execution.

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
W3-01 NEXT after W3-00 merge
 ↓
W3-02 ... W3-11
 ↓
BETWEEN INITIATIVES
 ↓
W4 requires separate authorization
 ↓
W5
```

No later Wave is implicitly active.