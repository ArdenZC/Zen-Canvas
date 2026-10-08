# ADR-0012 — Files Authority and Compatibility Retirement Boundary

Status: **Proposed — Owner freeze candidate under #332; no product implementation authorized by this ADR draft.**

Parent governance gate: [#330](https://github.com/ArdenZC/Zen-Canvas/issues/330)  
Tracking issue: [#332](https://github.com/ArdenZC/Zen-Canvas/issues/332)

Baseline:

- `master@7a2e1b31bb4ac49aa8e8d2378fc9adb6bb64034f`
- tree `79bb2dad6d13a0b579b70b78972ab0d5f7736b47`
- Schema 37 / package 0.1.40 / IPC v3

## Context

Zen Canvas is preparing a Post-AI-only Product / Architecture Rebaseline in which Files becomes the primary daily workspace. The repository already has strong canonical authorities, but the production renderer still carries compatibility surfaces from earlier File Library/Vault generations.

Current canonical ownership remains:

- managed file querying: **File Library Query V2**;
- cross-page managed selection: **LibrarySelectionV1 + backend resolution**;
- ephemeral filesystem browsing: **BrowseService** session/request/enumeration/opaque refs;
- workspace navigation/presentation: **WorkspaceSession**, which is disposable presentation/navigation state and not a durable file authority;
- scan roots/sessions/watcher health: existing backend durable scan/watcher ledgers;
- Preview: existing W1/W3 Preview authority and host lifecycle;
- file mutation: Operation Preview/revalidation/journal, Safe Trash/Restore and existing platform safety.

Current compatibility debt remains material:

- TD-001: `useFileLibraryStore` is still a broad compatibility umbrella for scope/stats/scan/AI/legacy list facts;
- TD-015: Library Mode still consumes Vault/File Library compatibility code including `useLibraryContentCompatibility`; `VaultView` remains in the production tree/export surface;
- current exact-master production search still finds external `useFileLibraryStore` imports in AppShell/runtime, scan/background-indexing, Rules/Rule Proposal, operation execution/restore, Search handoff, Library source ownership and Vault/classification compatibility surfaces.

The existence of these adapters does not mean they are durable authorities. The risk is that a new File Workspace generation could accidentally build new features on them and make retirement harder.

## Exact reviewed compatibility inventory at baseline

Repository search on the baseline found **14 external production files** importing `useFileLibraryStore` (store definition excluded):

```text
src/components/AppRuntimeProviders.tsx
src/components/AppShell.tsx
src/hooks/useSearchNavigationHandoff.ts
src/store/operationQueue/cleanupRestoreController.ts
src/store/operationQueue/operationExecutionController.ts
src/store/operationQueue/operationRestoreController.ts
src/store/useBackgroundIndexerStore.ts
src/store/useScanManagerStore.ts
src/views/fileLibrary/library/librarySourceOwner.ts
src/views/rules/RuleProposalWorkspace.tsx
src/views/rules/RulesView.tsx
src/views/scanner/ScannerView.tsx
src/views/vault/VaultView.tsx
src/views/vault/components/FileClassificationDetails.tsx
```

This list is a baseline caller inventory, not a statement that every caller consumes the same legacy fact. The reviewed baseline already supports the following coarse migration classes:

| Caller | Current compatibility use | Owning replacement direction |
| --- | --- | --- |
| `AppRuntimeProviders.tsx` | legacy library refresh coordination after runtime events | Query V2/source-owner refresh projection; no new library authority |
| `AppShell.tsx` | legacy stats + scope presentation | backend/query health/count projections + presentation-only scope label |
| `useSearchNavigationHandoff.ts` | legacy selected-file mirror/setter during Search → Main handoff | LibrarySelectionV1 / File Library activation handoff |
| `cleanupRestoreController.ts` | post-restore legacy refresh | canonical Library query invalidation/refresh |
| `operationExecutionController.ts` | legacy scope fallback + post-operation refresh | authoritative operation preview scope + canonical query projection |
| `operationRestoreController.ts` | post-restore legacy refresh | canonical Library query invalidation/refresh |
| `useBackgroundIndexerStore.ts` | refresh after accepted background-index terminal state | canonical query/root revision invalidation |
| `useScanManagerStore.ts` | current-scan compatibility scope + refresh | durable scan session/root identity + Query V2 scope |
| `librarySourceOwner.ts` | legacy scope/stats/setScope compatibility beside Query V2 | Query V2 + backend health/count; source owner remains projection coordinator |
| `RuleProposalWorkspace.tsx` | legacy Library scope resolved before proposal preview | canonical durable Query V2/managed-scope resolution for the requested review scope |
| `RulesView.tsx` | legacy scope + legacy needs-confirmation stats | canonical review/query projection; Rules remain policy domain |
| `ScannerView.tsx` | legacy scope/stats/AI progress presentation | scan ledger + query/count/Managed AI progress projections |
| `VaultView.tsx` | legacy scope/stats/setScope beside Query V2 | FileLibraryWorkspace/Query V2/Selection owners; staged TD-015 retirement |
| `FileClassificationDetails.tsx` | legacy refresh after confirm/correction | canonical query/detail invalidation after authoritative classification mutation |

This table is a migration map, not implementation authorization. A future retirement task must recheck exact field/action usage at its own baseline because callers may disappear or change before that task starts.

Additional current compatibility surfaces:

- `src/views/fileLibrary/library/LibraryMode.tsx` consumes `useLibraryContentCompatibility`;
- `src/views/vault/VaultView.tsx` remains in the production tree and export surface;
- `FileLibraryInspector` / `FileLibraryPreviewDialog` still represent Vault/File Library compatibility behavior on current paths.

The older TD-001-P3 inventory is useful history but is not substituted for this exact-baseline inventory.

## Decision

### 1. One durable owner per file-domain fact

New File Workspace implementation must consume the canonical owner for each fact:

| Fact / capability | Canonical owner |
| --- | --- |
| Managed query membership/order/paging/count | File Library Query V2 backend |
| Managed selection identity | LibrarySelectionV1 + backend resolution |
| Managed root/scan/watcher truth | backend scan roots/sessions/revisions/health |
| Ephemeral filesystem enumeration | BrowseService |
| Workspace back/forward/layout/presentation | WorkspaceSession / frontend presentation controller only |
| Preview source/read/provider truth | existing Preview Core + MaterializationReadGate + source owner |
| File mutation | Operation Preview/revalidation/journal + Safe Trash/Restore |
| Search | Global Index / Global Search repository |
| Settings | versioned persisted settings |

Renderer stores may project or coordinate these facts but may not become an additional durable owner.

### 2. Freeze new dependency on TD-001 compatibility

Effective once this ADR is accepted:

- no new production module may import `useFileLibraryStore` for a new File Workspace feature;
- no new durable fact may be added to `useFileLibraryStore`;
- no new localStorage field may be introduced as File Library authority;
- existing callers may remain temporarily only while carrying documented compatibility behavior;
- migrations must move a caller to its owning authority, not to another renderer compatibility store.

The current store is therefore **compatibility-only / no-growth**.

### 3. Freeze new dependency on TD-015 Vault compatibility

Effective once accepted:

- new File Workspace features must not import new behavior from `views/vault/*`, `VaultView`, `useLibraryContentCompatibility` or legacy Vault preview/inspector components;
- remaining compatibility behavior must be classified by owning domain before removal;
- shared Preview functionality must use the accepted Preview Core/host path rather than copy Vault preview behavior;
- deletion is forbidden until caller-zero and behavioral equivalence are proven.

TD-015 is not closed by accepting this ADR.

### 4. File Workspace may start before total compatibility deletion — but only on canonical APIs

This ADR does **not** require deleting every TD-001/TD-015 caller before the next product phase.

It requires that:

1. the new File Workspace shell and new capabilities are built only on canonical authority APIs;
2. compatibility callers are not expanded;
3. when a new feature replaces an old compatibility caller, the old caller can be retired in the same bounded track only after focused equivalence evidence;
4. unrelated compatibility cleanup is never bundled merely for cosmetic repository cleanliness.

This allows forward development without deepening legacy debt.

### 5. Legacy Library scope is projection, not authority

The legacy `useFileLibraryStore.scope` / localStorage mirror may continue temporarily for existing compatibility callers. It must not be treated as the source of truth for:

- managed-root existence;
- root health;
- scan generation;
- Query V2 membership;
- watcher revisions;
- operation mutation scope.

Any migration from the legacy scope must resolve through current backend-owned identifiers and health rather than copying path strings into a new authority.

### 6. Browse and Managed Library remain intentionally distinct

The future Files workspace may visually unify managed and ephemeral file work, but it must not merge their authorities.

- Query V2 owns managed-library query truth.
- BrowseService owns ephemeral filesystem enumeration and opaque session refs.
- WorkspaceSession may coordinate presentation/navigation across them.
- A UI tab/pane is never itself a durable source authority.

A future unification layer must carry source identity explicitly and preserve source-specific stale/revalidation rules.

### 7. Selection remains independent from scope

LibrarySelectionV1 identifies selected managed files. It does not silently redefine Query V2 scope.

Search handoff, Preview, Inspector and operation flows may carry selection intent, but scope/query ownership remains separate.

### 8. Compatibility retirement is staged

#### Stage F0 — no-growth freeze
- enforce no new imports/dependencies on TD-001/TD-015 compatibility from new File Workspace work;
- record exact current production caller inventory.

#### Stage F1 — caller classification
Classify every remaining caller as one of:
- managed query/scope compatibility;
- scan/watcher projection;
- selection/navigation compatibility;
- operation/restore compatibility;
- Rules/Rule Proposal compatibility;
- legacy Vault/Inspector/Preview compatibility;
- dead/export-only candidate.

Each caller must name its replacement owner.

#### Stage F2 — migrate canonical facts
Move scope/query/selection/scan consumers to existing canonical APIs with focused tests.

#### Stage F3 — retire Vault compatibility by owning domain
Migrate remaining inspector/preview/presentation behavior to owning W2/W3/current workspace components. Do not create a new generic compatibility layer.

#### Stage F4 — caller-zero proof
TD-001/TD-015 may close only when:
- no production caller depends on the targeted legacy facts/surfaces;
- repository-wide production search is caller-zero except the retirement record itself;
- mounted/real-browser equivalence for affected flows passes;
- Query V2, LibrarySelectionV1, BrowseService, Preview and mutation authority regressions pass.

### 9. New product features forbidden from using compatibility as convenience API

Tabs, Split, Shelf, Notes, Related, Context Panel, workspace restore or future Files actions may not use a legacy compatibility store simply because it already exposes convenient data.

If a canonical API is awkward, improve the canonical projection/adapter at its owning boundary rather than promoting the compatibility surface.

### 10. Notes/context do not become file authority

Future Notes / Explicit User Context may bind to authoritative file identity, but Notes do not redefine:

- file existence;
- managed membership;
- Query V2 results;
- mutation authority.

Explicit User Truth, Preference evidence, Rule/Policy and AI inference remain separate domains.

## Rejected alternatives

### Build the new File Workspace directly on `useFileLibraryStore`
Rejected: it would deepen TD-001 and turn a compatibility umbrella into permanent architecture.

### Delete the store/Vault compatibility immediately
Rejected: current production callers remain. Deletion without replacement/equivalence proof would risk scope, Rules, scan, operation and preview regressions.

### Merge BrowseService and Query V2 into one source now
Rejected: the two sources have different authority/lifetime/stale semantics. Visual unification does not require authority merger.

### Let WorkspaceSession become durable file truth
Rejected: WorkspaceSession is disposable navigation/presentation state.

## Implementation gate

No implementation task may claim this ADR authorizes broad File Workspace coding until Owner accepts the ADR.

After acceptance, this ADR freezes the allowed architecture but **still does not authorize product code by itself**. A separate Owner-reviewed implementation activation is required for each bounded caller-retirement or File Workspace track.

Any later implementation activation must:

- use only the canonical owners frozen here;
- keep Windows local as frozen-candidate native acceptance only;
- return for a new ADR/Owner review before adding a durable file authority or merging source authorities.

## Exit / review evidence

Before this ADR can be marked Accepted, Owner review must verify:

- current caller inventory is materially accurate at the reviewed baseline;
- the no-growth rule does not block required existing safety paths;
- Query V2 / BrowseService / Selection / Preview / Operation authority separation is consistent with ARCHITECTURE_MAP;
- no hidden new durable store is introduced by the ADR itself.

This ADR changes architecture constraints only; it changes no product behavior, Schema, IPC, package, queue or mutation authority.
