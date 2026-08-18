# Zen Canvas Current Architecture Map

This document records the current architecture and ownership model. It is intentionally shorter than historical remediation/design taskbooks and should change only when real architecture ownership changes.

## System shape

```text
React / TypeScript UI
        │
        ├─ App Shell and workspace components
        ├─ Zustand projection / interaction stores
        └─ domain API facades
                 │
              Tauri IPC
                 │
             Rust backend
        ┌────────┼─────────┐
        │        │         │
      SQLite   domain    platform
      ledgers  engines    adapters
        │        │         │
        └──── durable authorities ────┘
```

The normal direction is **durable backend authority → API → replaceable frontend projection**. UI state may own interaction state, request epochs, local selection presentation, focus and dialogs; it must not become a second durable fact source.

## Durable authority table

| Domain | Current authority | Frontend role |
| --- | --- | --- |
| Global Search | Global Index / Global Search repository and backend ordering | Query interaction, command grouping, result presentation |
| Managed file browsing | File Library Query V2 | Query projection, cursor/snapshot handling, inspector and interaction |
| Cross-page selection | `LibrarySelectionV1` plus backend resolution | Selection intent/projection |
| Scan | durable scan roots/sessions/runs | Scan controls and durable event projection |
| Watcher health | backend watcher reconciliation and root revisions | Health projection and refresh coordination |
| Duplicate detection | durable Dedupe runs/groups/members | Run/group projection |
| Storage analysis | durable Analysis Run/Finding/Evidence/Decision | Review, local selection interaction and preview requests |
| Organization | durable Organization Plan/Plan Item ledger | Review projection, pagination and revision-aware interaction |
| Rules | Rule Repository V2 and catalog revision | Replaceable rule-library projection |
| Natural-language rules | durable Rule Proposal | Proposal/review projection |
| Content | Content Scope Policy, Content Run and Content Artifact | Policy/run/artifact projection and interaction |
| File operations | authoritative Operation Preview and operation journal | Preview selection and progress projection |
| Cleanup mutation | Safe Trash and cleanup journal | Selection/confirmation/progress projection |
| Restore | operation/cleanup ledgers plus identity revalidation | Restore intent, confirmation and outcome projection |
| App settings | persisted versioned settings | Editing/reconciliation projection |
| Managed AI | existing durable managed-AI queue and provider policy | Configuration/progress projection |

## W1-to-W2 consumer boundary

W1 runtime contracts are not consumer-ready merely because a type or backend
command exists. Before W2 shared presentation work, each public producer and
consumer must prove that it can carry the owning authority and lifetime:

- Thumbnail requests need a truthful Browse source-generation seam plus the
  existing session, stale and Read Gate checks;
- LocationDescriptor is a projection until a backend-owned admission/navigation
  action is proven; it is not a renderer path or resolver input;
- Library all_matching membership needs exact Query V2 collection context;
- Browse presentation must preserve sessionId, requestId and enumerationId, and
  keep BrowsePathRef source-specific and session-paired;
- CI evidence must bind checked-out source, diff head and reported artifact
  identity to the exact validated commit.

This is a consumer contract gate, not a new durable authority. R1, R2 and R3
are bounded remediation taskbooks before W2-02; their future work must preserve
the authorities in the table above.

## Runtime ownership

`App.tsx` is a small composition boundary. `AppRuntimeProviders` currently coordinates several lifecycle concerns including settings, capabilities, scan/watcher/background indexing, search-window integration and other startup/runtime effects.

That concentration is a **hardening target**, not evidence of a second durable authority. Future work may split runtime ownership into focused providers/controllers while keeping one application composition root.

## Compatibility bridges

Compatibility code is allowed only when it translates into a single current authority and has a deletion condition.

Current known bridges include:

- `src/store/useFileLibraryStore.ts` — legacy scope/stats/scan/AI compatibility umbrella while Query V2 is the managed-library query authority.
- renderer watcher legacy adapter — fallback when backend watcher reconciliation capability is unavailable.
- `src/store/useOrganizeDecisionStore.ts` — edited-name continuity bridge in older operation-preview wiring; not Organization Plan authority.
- `src-tauri/src/global_index/legacy_queue.rs` — compatibility adapter into the existing managed-AI durable queue.
- legacy design-token aliases — migration layer for older production surfaces.

Detailed exit conditions remain recorded in `docs/remediation/LEGACY_RETIREMENT_PLAN.md` until migrated into an accepted debt-retirement change.

`useOperationQueueStore.syncPreviews(files)` has no known production caller at the G0 audit baseline and is a retirement candidate; removal still requires a focused change and regression proof.

## Platform boundary

Platform filesystem strategy is backend-owned.

- Windows retains its existing source-handle and verified-directory authority.
- macOS 13+ Apple Silicon uses the dedicated macOS identity, mutation, provider, Finder, lifecycle, copy/package and Quick Look adapters. Mutation correctness is split into namespace identity, optional content-verification identity and coordinated provider-URL evidence; a provider path hint and provider-internal item/domain ID are not generic provider authority.
- macOS name-based mutation requires verified parent identity, current leaf-entry identity obtained through the retained parent descriptor, and retained object identity. Same-volume namespace operations do not require complete content hashing; copy/cross-volume/recovery policies may require it.
- Provider coordination is operation-aware and treats accessor-supplied URLs as authoritative. Safe Trash uses a source/actual-target pair while Permanent Delete uses a single deleting source. Under ADR-0003 Decision B, generic File Provider paths use `NSFileCoordinator` plus user-visible URL and physical-identity revalidation; the public item/domain manager APIs remain extension-scoped diagnostics, not a prerequisite for arbitrary third-party providers.
- Source retirement is an explicit capability decision (`ExclusiveClaim`, `ProviderCoordinated` or `PortableNamespaceRetirement`). Portable claims use the Zen-owned mode-0700 `.zen-canvas-retirement/<session>/` namespace; unknown/read-only/disconnect-unverified volumes fail closed and target-first cleanup remains recoverable through the existing journal and History actions.
- Linux is not a product target.

Shared product code must depend on capability/strategy results rather than reimplement platform safety in the renderer.

## Non-negotiable invariants

Do not create:

- a second Global Index;
- a second managed File Library query authority;
- a second durable AI queue;
- a second Organization Plan ledger;
- a second Rule repository or Rule execution authority;
- a second operation journal, Safe Trash or restore ledger;
- renderer-authoritative filesystem paths, totals or completion facts;
- a generic Agent/shell/MCP/tool runtime without a separately approved architecture decision;
- schema changes merely to simplify UI implementation.

Global Index, managed File Library and managed Content Search remain separate data domains.

## Architecture-change rule

A change that moves durable authority, persistence ownership, command permission ownership, platform mutation ownership or recovery ownership requires:

1. an accepted initiative scope;
2. an ADR under `docs/project/DECISIONS/`;
3. updates to this map and `STATUS.md`;
4. focused contract tests and applicable full validation.
