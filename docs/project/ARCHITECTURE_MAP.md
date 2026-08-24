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

The normal direction is **durable backend authority → API → replaceable frontend projection**. UI state may own interaction state, request epochs, local selection presentation, focus, dialogs and disposable Preview host presentation; it must not become a second durable fact source.

## Durable authority table

| Domain | Current authority | Frontend role |
| --- | --- | --- |
| Global Search | Global Index / Global Search repository and backend ordering | Query interaction, command grouping, result presentation |
| Managed file browsing | File Library Query V2 | Query projection, cursor/snapshot handling, inspector and interaction |
| Cross-page selection | `LibrarySelectionV1` plus backend resolution | Selection intent/projection |
| Ephemeral filesystem browsing | W1 `BrowseService` session/request/enumeration/opaque refs | Current target/page presentation, loaded-entry interaction and cancellation projection |
| Workspace navigation/presentation | `WorkspaceSession` disposable navigation/history/presentation contract plus source owners | Back/Forward, organization/presentation mode, focus and transient workspace interaction |
| Preview lifecycle / provider publication | W1 Rust `PreviewSession`, SourceResolver/sourceVersion, Provider Registry/fallback and typed `PreviewRepresentation` contracts | Floating/Pinned host presentation, command context, request epoch/focus restoration and representation rendering only |
| Preview byte-read eligibility/access | W1 `MaterializationReadGate` plus existing authoritative platform/content open/revalidation boundary | Eligibility/materialization state projection; no general renderer byte-read lease/path authority |
| Expensive Preview/Thumbnail/Foundation work | existing global `WorkScheduler` resource admission | Work priority/request intent projection only |
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

Preview in the table means **content Quick Preview**, not Operation Preview. File-operation planning remains owned by the existing mutation/operation authorities and is not merged into W3 Preview Platform.

## W1-to-W2 consumer boundary

W1 runtime contracts are not consumer-ready merely because a type or backend command exists. Before W2 shared presentation work, each public producer and consumer proved that it could carry the owning authority and lifetime:

- Thumbnail requests carry truthful Browse source-generation/session/stale/Read Gate checks;
- LocationDescriptor remains a projection and backend-owned admission/navigation owns live Browse authority;
- Library all-matching membership retains exact Query V2 collection context;
- Browse presentation preserves sessionId, requestId and enumerationId and keeps BrowsePathRef source-specific/session-paired;
- CI evidence binds checked-out source, diff head and reported artifact identity to the exact validated commit.

R1/R2/R3/R4 closed these consumer-boundary prerequisites before the completed W2 experience.

## W3 Preview consumer boundary

W3 starts from a real W1 Preview foundation, but the product-facing consumption seam is intentionally incomplete and must be made consumer-ready before rich providers are added.

### Existing authoritative foundation

- `src-tauri/src/file_workspace/preview.rs` owns PreviewSession lifecycle, sourceVersion stale protection, provider contracts/priority/fallback, representation families, capability intersection and deterministic cancellation/disposal semantics.
- `src-tauri/src/file_workspace/integration/preview.rs` resolves managed sources through existing managed File Library detail authority and ephemeral sources through the same BrowseService that issued their refs.
- the integration uses MaterializationReadGate for read eligibility/source version and injects its opaque bounded content-read consumer into Preview providers.
- Preview Tauri commands are main-window-authorized and expose create/snapshot/start/cancel/dispose/switch-source lifecycle without exposing arbitrary paths or general byte-read leases to React.
- WorkScheduler remains the global expensive-work admission authority.

### W3-01 consumer-readiness record

W3-01 closes the previously intentional production-consumption seams without
moving durable authority:

- `preview_policy::production_preview_provider_registry()` is the single
  production composition owner. Its bounded rich-provider set is intentionally
  empty until later built-in provider Tracks are reviewed; Metadata fallback
  remains the truthful integrated behavior.
- `preview_policy` owns explicit activated Zen Floating/Pinned host matrices
  and backend source capability projection. Native W4 host kinds remain
  contract-only and fail closed.
- Rust and TypeScript use the same exhaustive strict representation and warning
  wire. Unknown families/fields, host-mismatched native opaque values and
  path-like asset tokens fail closed at the consumer boundary.
- Preview Core owns a direct bounded progressive publication callback. Each
  update is bound to the session/request/sourceVersion token, ordered by a
  monotonic sequence, and rejected after switch/cancel/dispose or provider
  timeout. The callback retains only the current projection; it is not an
  app-wide event bus or an unbounded queue.
- `preview_asset::PreviewAssetRegistry` owns ephemeral bounded asset bytes.
  Tokens are process-local, request/sourceVersion-bound, TTL-limited and
  revoked with Preview lifecycle; the only retrieval command is
  main-window-authorized and Preview-specific.
- No general renderer-callable materialization/download action is assumed.
  `materialization_required` remains an explicit state unless an authoritative
  user-initiated materialization action is separately reviewed.

### W3 host/projection rule

W3 frontend code may own only disposable host/interaction coordination:

- Floating/Pinned visibility;
- frontend request epochs;
- mapping current W2 entry identity into PreviewSourceRef;
- command-context gating;
- shell/render state;
- focus restoration;
- bounded sibling-navigation projection;
- cancel/dispose/switch-source orchestration and frontend late-result rejection.

It must not own:

- provider selection truth;
- sourceVersion;
- filesystem resolution;
- byte-read/materialization authorization;
- durable query/selection truth;
- file mutation/recovery authority.

Providers produce typed representations; Hosts render them. A Host does not infer provider/read capability from a filename/path, and a Provider does not import React host state.

## W4 native-host boundary

W4 adds native host adapters without moving the durable Preview authorities above. ADR-0005 is the binding architecture decision.

### Native request ownership

`PreviewSourceRef::HostProvided { hostToken }` is the reserved seam for an OS-owned/native request. W4-01 may make that seam usable through one bounded backend/native request registry, but the token remains opaque, request-scoped, non-durable and revocable. It must never be a disguised filesystem path.

A platform-supplied stream/file handle may back one native request for its bounded lifetime. That request-scoped authority does not become a second generic renderer ReadGate or durable file identity source.

### Platform host ownership

- macOS initial W4 scope is a Zen-internal native Quick Look-backed host/fallback for strong-native standard formats. Existing Quick Look thumbnail infrastructure remains separate. A Finder Quick Look Preview Extension is conditional on a separately reviewed custom-UTI/native-gap ownership case rather than being broadly registered for standard formats.
- Windows W4 system scope prioritizes `WindowsPreviewHandler` / Explorer Preview Pane integration. `WindowsQuickPreview` remains a reserved inactive contract unless a separate product review proves distinct value beyond W3 Floating Preview.
- native host selection, provider selection and source eligibility remain backend/capability-driven; native code must not infer authority from extension/path alone.

### Cross-process/process-local work

A native extension/COM preview host may need process-local handles, streams, rendering resources and admission limits because it is a real OS process boundary. Those resources may be locally owned for lifecycle correctness, but they are not a second product-level Provider Registry, MaterializationReadGate, WorkScheduler policy or mutation authority.

If sharing W3 provider/representation code across a native process requires extraction, the result must preserve one provider contract and one authoritative composition policy rather than fork platform copies.

### Native cleanup boundary

Native cancel/unload/close must revoke host request ownership and release platform streams/handles/renderers/assets. In particular, Windows Preview Handler `Unload` is a hard cleanup boundary and the source must not remain locked after unload where the platform permits subsequent mutation.

## Runtime ownership

`App.tsx` is a small composition boundary. `AppRuntimeProviders` currently coordinates several lifecycle concerns including settings, capabilities, scan/watcher/background indexing, search-window integration and other startup/runtime effects.

That concentration is a **hardening target**, not evidence of a second durable authority. Future work may split runtime ownership into focused providers/controllers while keeping one application composition root.

W3 Preview frontend orchestration should be a bounded `PreviewExperienceController`/provider rather than another responsibility appended independently to LibraryMode, BrowseMode, List, Grid and Context Panel. The exact file/module name may differ, but one consumer-facing Preview lifecycle coordinator is the preferred ownership shape.

## Compatibility bridges

Compatibility code is allowed only when it translates into a single current authority and has a deletion condition.

Current known bridges include:

- `src/store/useFileLibraryStore.ts` — legacy scope/stats/scan/AI compatibility umbrella while Query V2 is the managed-library query authority.
- renderer watcher legacy adapter — fallback when backend watcher reconciliation capability is unavailable.
- `src/store/useOrganizeDecisionStore.ts` — edited-name continuity bridge in older operation-preview wiring; not Organization Plan authority.
- `src-tauri/src/global_index/legacy_queue.rs` — compatibility adapter into the existing managed-AI durable queue.
- legacy design-token aliases — migration layer for older production surfaces.
- File Library Preview compatibility — current Library Mode still reaches `FileLibraryPreviewDialog` / Vault Inspector compatibility, and the Inspector may use the existing macOS Quick Look thumbnail path. These are migration inputs while W3 activates the shared Preview Core/Host path; they are not a second W3 Preview authority.

Detailed exit conditions remain recorded in `docs/remediation/LEGACY_RETIREMENT_PLAN.md` and `TECH_DEBT.md` until migrated into accepted debt-retirement changes.

`useOperationQueueStore.syncPreviews(files)` has no known production caller at the G0 audit baseline and remains a retirement candidate; Operation Preview is unrelated to W3 Quick Preview despite the shared word “preview.”

For TD-015, W3 may retire a preview-specific compatibility caller only after the owning W3 replacement is active and behavioral/real-browser equivalence is proven. Broader Vault/File Library compatibility retirement remains independently gated.

## Platform boundary

Platform filesystem strategy is backend-owned.

- Windows retains its existing source-handle and verified-directory authority.
- macOS 13+ Apple Silicon uses the dedicated macOS identity, mutation, provider, Finder, lifecycle, copy/package and Quick Look adapters. Mutation correctness is split into namespace identity, optional content-verification identity and coordinated provider-URL evidence; a provider path hint and provider-internal item/domain ID are not generic provider authority.
- macOS name-based mutation requires verified parent identity, current leaf-entry identity obtained through the retained parent descriptor, and retained object identity. Same-volume namespace operations do not require complete content hashing; copy/cross-volume/recovery policies may require it.
- Provider coordination is operation-aware and treats accessor-supplied URLs as authoritative. Safe Trash uses a source/actual-target pair while Permanent Delete uses a single deleting source. Under ADR-0003 Decision B, generic File Provider paths use `NSFileCoordinator` plus user-visible URL and physical-identity revalidation; the public item/domain manager APIs remain extension-scoped diagnostics, not a prerequisite for arbitrary third-party providers.
- Source retirement is an explicit capability decision (`ExclusiveClaim`, `ProviderCoordinated` or `PortableNamespaceRetirement`). Portable claims use the Zen-owned mode-0700 `.zen-canvas-retirement/<session>/` namespace; unknown/read-only/disconnect-unverified volumes fail closed and target-first cleanup remains recoverable through the existing journal and History actions.
- existing macOS Quick Look thumbnail capability is a Thumbnail/placeholder asset that may be adapted safely; W3 does not reinterpret it as Finder Quick Look extension authority.
- W4 owns reviewed native Preview host integration while preserving the existing identity/read/mutation boundaries; it does not make native shell ownership a second filesystem authority.
- Linux is not a product target.

Shared product code must depend on capability/strategy results rather than reimplement platform safety in the renderer.

## Non-negotiable invariants

Do not create:

- a second Global Index;
- a second managed File Library query authority;
- a second Browse identity/session authority;
- a second Preview lifecycle/provider/publication authority;
- a second Materialization/Read Gate or renderer byte-read engine;
- a second global WorkScheduler/resource-policy executor;
- a second durable AI queue;
- a second Organization Plan ledger;
- a second Rule repository or Rule execution authority;
- a second operation journal, Safe Trash or restore ledger;
- renderer-authoritative filesystem paths, totals or completion facts;
- a generic Agent/shell/MCP/tool runtime without a separately approved architecture decision;
- arbitrary third-party Preview DLL/dylib/plugin loading in W3/W4;
- schema changes merely to simplify UI/Preview implementation;
- native platform integration that bypasses ADR-0005 host/source lifecycle ownership.

Global Index, managed File Library and managed Content Search remain separate data domains.

## Architecture-change rule

A change that moves durable authority, persistence ownership, command permission ownership, platform mutation ownership, supported-platform truth or recovery ownership requires:

1. an accepted initiative scope;
2. an ADR under `docs/project/DECISIONS/`;
3. updates to this map and `STATUS.md`;
4. focused contract tests and applicable full validation.

W4 activation records the native host/process boundary in ADR-0005 without moving existing durable Preview/read/identity/mutation ownership. If a W4 implementation Track discovers that its proposed solution would move one of those authorities, it must stop and return to architecture review before coding further.