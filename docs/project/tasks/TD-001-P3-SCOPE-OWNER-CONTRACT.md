# TD-001-P3: Library Scope Owner Contract

Status: **SAFE SLICE IDENTIFIED — IMPLEMENT IN THIS TASK — implementation complete, ready for review**
Issue: [#225](https://github.com/ArdenZC/Zen-Canvas/issues/225)
Audit date: 2026-09-07
Baseline: `master@8c51654493f9a6962add3c3c69bcd779ed6b4c38`
Baseline tree: `3052cc3c090886e51f5144a58ec551afd704f1d5`
Audit branch: `codex/w6-07-td-001-p3a-scope-owner-contract`

This is the current-state contract requested by TD-001-P3. It records one
bounded, read-only production migration that uses an existing operation
preview projection. No file under `src-tauri/` is in scope, and no durable
authority, persistence owner or lifecycle ordering was changed. W6-07 remains
active and the legacy `useFileLibraryStore.scope` field remains in place for
the callers that still require it.

## 1. Evidence boundary and counting rules

The historical W6-07 checkpoint counted 17 external store callers at an
earlier baseline. That inventory was not reused. The P0/P1/P2 predecessors
are merged on the exact starting line for this audit, so the inventory below
was rerun against `8c51654493f9a6962add3c3c69bcd779ed6b4c38`.

The counts use these definitions. “Baseline” is the exact starting line above;
“Head” is after the one Timeline migration implemented in this branch:

| Count | Definition | Baseline | Head |
| --- | --- | ---: | ---: |
| Direct store-import files | Production `.ts`/`.tsx` files under `src/` importing `useFileLibraryStore`, excluding the store’s own definition | **14** | **13** |
| Direct scope-bearing files | Direct importers that read `state.scope` / `getState().scope`, or select `setScope` / `setCurrentScanScope` | **9** | **8** |
| Indirect scope-writer files | Files that call `source.setScope(...)` through `LibrarySourceOwner` without importing the legacy store | **2** | **2** |
| Direct legacy-scope reads | External production read expressions matching the store scope selectors/getter | **10** | **9** |
| External scope-action references | Eight external `state.setScope` / `source.setScope` references plus one `setCurrentScanScope` call outside the store implementation | **9** | **9** |
| Legacy scope writer implementations | Store actions that persist and update the legacy scope state | **2** | **2** |

The 14 baseline direct store-import files are:

```text
src/components/AppRuntimeProviders.tsx
src/components/AppShell.tsx
src/store/useBackgroundIndexerStore.ts
src/store/useScanManagerStore.ts
src/store/operationQueue/cleanupRestoreController.ts
src/store/operationQueue/operationExecutionController.ts
src/store/operationQueue/operationRestoreController.ts
src/views/fileLibrary/library/librarySourceOwner.ts
src/views/rules/RuleProposalWorkspace.tsx
src/views/rules/RulesView.tsx
src/views/scanner/ScannerView.tsx
src/views/timeline/TimelineView.tsx
src/views/vault/VaultView.tsx
src/views/vault/components/FileClassificationDetails.tsx
```

The exact direct scope-bearing files are:

```text
src/components/AppShell.tsx
src/store/useScanManagerStore.ts
src/store/operationQueue/operationExecutionController.ts
src/views/fileLibrary/library/librarySourceOwner.ts
src/views/rules/RuleProposalWorkspace.tsx
src/views/rules/RulesView.tsx
src/views/scanner/ScannerView.tsx
src/views/timeline/TimelineView.tsx
src/views/vault/VaultView.tsx
```

The two additional indirect writer surfaces are
`src/views/fileLibrary/library/LibraryMode.tsx` and
`src/views/fileLibrary/library/libraryNavigationSurface.tsx`.

The only baseline importer removed at head is
`src/views/timeline/TimelineView.tsx`; its focused presentation contract is
covered by `tests/timelinePreview.test.ts`. The nine external scope-action
references and both legacy writer implementations are unchanged.

Reproducible inventory commands:

```powershell
rg -l 'useFileLibraryStore' src --glob '*.ts' --glob '*.tsx' |
  Where-Object { $_ -ne 'src\store\useFileLibraryStore.ts' }

rg -n 'useFileLibraryStore\([^\n]*scope|useFileLibraryStore\.getState\(\)\.scope' `
  src --glob '*.ts' --glob '*.tsx' |
  Where-Object { $_ -notmatch 'src\\store\\useFileLibraryStore\.ts' }

rg -n 'state\.setScope|source\.setScope|setCurrentScanScope|readPersistedLibraryScope|LIBRARY_SCOPE_STORAGE_KEY' `
  src --glob '*.ts' --glob '*.tsx'

rg -n 'LibraryScope|FileLibraryScopeV2|FileQuerySpecV2|resolveLegacyLibraryScope' `
  src src-tauri/src --glob '*.ts' --glob '*.tsx' --glob '*.rs'
```

The predecessor delta is also material: the removed constants-only/dead
consumers and the Settings selected-file migration are not present in this
baseline. The baseline list above and the head caller-zero search below are
therefore the counts used for this contract; the historical 17-file result is
not reused.

## 2. Scope authority map

The current flow is not a single-owner flow. It is a compatibility mirror
feeding a Query V2 projection, with backend scan and watcher ledgers owning
the facts that make a scope valid:

```text
User Library navigation ───────────────┐
Managed scan completion ────────────────┼─> legacy LibraryScope state
                                      │     (useFileLibraryStore.scope)
                                      │          │
                                      │          ├─ localStorage mirror
                                      │          │  key zc-library-scope, v1
                                      │          │
                                      │          └─ resolveLegacyLibraryScope
                                      │                    │
Managed-root navigation ──────────────┘                    v
        (some paths bypass mirror)              Query V2 spec.scope
                                                        │
                                                        v
                                        backend resolve_scope + health
                                        scan roots/sessions/revisions
                                                        │
                                                        v
                                  Query V2 results / exact count / inspector

Watcher and background scan outcomes ─> backend root revisions and health
                                      └> owner-aware refresh/invalidation

Operation preview creation ──────────> operationQueue.previewScope
                                      └> Timeline/operation revalidation

Search/Command navigation ───────────> LibrarySelectionV1 + ID-only mirror
                                      (does not change Library scope)
```

| Input or fact | Current writer/owner | Persistence | Query V2 projection | Current consumers |
| --- | --- | --- | --- | --- |
| User chooses **all** from File Library | `LibraryMode` or `libraryNavigationSurface` calls `source.setScope({ kind: "all" })`; navigation also calls `source.setQueryScope({ kind: "all_enabled_roots" })` | `useFileLibraryStore.setScope` writes `{ version: 1, scope }` to localStorage before updating in-memory state | `useVaultQueryController` resolves the legacy value, or the navigation surface writes V2 directly | Library surface, AppShell/Scanner/Rules/Proposal legacy readers, stats/operation compatibility paths |
| User navigates to a managed **root** | `libraryNavigationSurface` calls `source.setQueryScope({ kind: "roots", scanRootIds })`; it does **not** call legacy `setScope` | None for this navigation action | `useFileLibraryQueryStore.spec.scope` is updated directly; backend resolves IDs and health | Active File Library query and result projection |
| Persisted/current legacy scope | `useFileLibraryStore.scope` is initialized and updated by the compatibility store | Browser `localStorage` only; not SQLite product state | `resolveLegacyLibraryScope` converts path roots to backend root IDs and current-scan session IDs | Vault, source owner, AppShell, Scanner, Rules, Proposal and operation fallback |
| Managed scan roots and sessions | Rust scan database and `useScanManagerStore` projection | SQLite scan roots/sessions/runs and session-root mapping | V2 `current_scan` resolves `scan_session_roots`; `roots` resolves scan-root IDs | Scanner, Query V2, watcher reconciliation and scan recovery |
| Watcher health/revisions | Rust watcher reconciliation and scan-root revision ledger | SQLite root revisions and health state | `resolve_scope` marks roots unavailable when health/reconciliation/revision conditions fail | Query V2 `scopeHealth`, watcher status projection, Scanner and refresh coordination |
| Background indexing | Separate managed scan session in `useBackgroundIndexerStore`; it never changes the foreground current-scan selection | Durable managed scan ledger; local queue state is ephemeral | Refreshes existing projections after an accepted terminal status | Scanner background-task surface and library refresh |
| Operation preview scope | `useOperationQueueStore.setPreviewResult` captures the scope supplied by the operation preview request | Not the current Library scope; preview state is in-memory | No Query V2 ownership; operation backend preview/journal remains authoritative | Timeline and operation execution/restore controllers |
| Search/Command navigation | `AppRuntimeProviders` keeps the restricted Search Window handoff and V2 selection/inspector bridge | ID-only compatibility mirror where required; search scope is independent | `LibrarySelectionV1` and detail projection | Search Window and main-window activation; no Library scope write |

### Authority findings

1. For a normal File Library query, Query V2 is the active query authority:
   the backend owns root resolution, health, ordering, exact/deferred count and
   snapshot validity; the renderer Query V2 stores are projections and
   interaction state.
2. The legacy store is still the only cross-launch/current-session owner for
   the old `LibraryScope` shape. It is therefore operationally authoritative
   for legacy readers, but it is not a durable backend scope ledger.
3. The two owners can diverge today. Managed-root navigation writes V2 root
   IDs directly while the persisted legacy path scope remains unchanged.
   Conversely, the controller translates legacy state into V2 when the Files
   surface mounts or the legacy scope changes.
4. Scan roots, scan sessions, session-root mappings, watcher revisions and
   reconciliation health are not owned by either renderer store. They are
   durable backend facts that a scope projection must resolve and revalidate.
5. There is no evidence that a new scope store/provider/cache is needed. Adding
   one would create the prohibited second authority.

## 3. Baseline production caller matrix and implemented delta

The matrix records the exact pre-slice inventory, including direct legacy-store
importers, indirect `setScope` callers and the existing legacy-to-V2 controller
boundary. Refresh-only and selected-file-only users are retained because they
must not be mistaken for scope owners during later store deletion. The
Timeline row records the one implementation delta; the head counts and
caller-zero search are in §7.

| Exact file and symbol | Read/write/derivation and purpose | Current source of truth and legacy role | Lifecycle, scan, Query V2, persistence and stale risk | Safe replacement candidate and required evidence |
| --- | --- | --- | --- | --- |
| `src/components/AppRuntimeProviders.tsx` — `refreshCurrentQuery`, `StoreRuntimeBootstrapper`, Search Window listener | Calls legacy `refresh`; reads/writes the ID-only `selectedFileId` bridge. **No Library scope read/write.** | Refresh is a compatibility bundle; selection authority is `LibrarySelectionV1` plus the restricted Search Window boundary. | Startup invokes refresh before scan/operation listener initialization; watcher callback can request refresh. No scope/session dependency and no scope persistence. Moving this wholesale could reorder listeners or broaden Search Window permission. | Owner-aware Query V2/stat refresh and V2 selection adapter, separately. Evidence: `tests/listenerRegistration.test.ts`, `tests/appShellBehavior.test.ts`, search/IME tests and main-ready handshake tests. Not a scope slice. |
| `src/components/AppShell.tsx` — `AppShell`, `CommandLauncher` | Reads `state.stats` and `state.scope` for shell heading/description; passes legacy `setSelectedFileId` to Command Modal. | Legacy scope is the only currently available cross-page summary when Files is unmounted; Query V2 spec is not guaranteed hydrated then. | Always mounted, including Scanner/Rules/Settings and before Files mounts. No direct scan write; persistence is indirect through store initialization. Replacing with the in-memory V2 spec can show default/all or stale scope after launch. | An explicit app-wide scope projection only after startup hydration and persistence contract are approved; keep Search Window ID-only boundary. Evidence: AppShell/heading, startup and command navigation mounted tests. Not first. |
| `src/views/vault/VaultView.tsx` — `VaultView` | Reads `legacyScope`, stats and Query V2 state; selects `setScope`; passes legacy scope to the query controller and operation-preview calls; renders scope/empty-state actions. | Legacy scope is a path/session compatibility input; Query V2 owns active rows, selection, detail and health. The legacy setter remains the persistence mirror. | Legacy standalone/compatibility surface is heavily mounted by tests, while the active route uses `FileLibraryWorkspace`. Current-scan session IDs and explicit roots are resolved asynchronously; operation preview must use the same scope as the request. Persistence and stale-snapshot parity are both at risk. | Migrate only behind a source-owned scope hydration/adapter contract, then remove this direct reader. Evidence: `tests/fileLibraryTask06Handoff.test.tsx`, `tests/fileLibraryV4.test.tsx`, `tests/savedViewIndependentReview.test.tsx`, empty/snapshot/operation tests. Not first. |
| `src/views/vault/controllers/useVaultQueryController.ts` — `legacyScope` input and resolve effect | Derives legacy scope signature/empty state and asynchronously calls `resolveLegacyLibraryScope`; writes the resolved `scope` into current Query V2 spec and gates first-page loading. | Stateless compatibility adapter; it owns no durable scope, cache or results. | Runs when the Files/Vault surface mounts; cancellation protects against late root resolution. It maps path roots through `listScanRoots` and current-scan IDs through the durable session resolver. Query V2 spec can be overwritten if the legacy boundary is changed without an explicit owner contract. | Keep one explicit adapter at the caller boundary or relocate it into the source owner without creating a store. Evidence: Query mount, saved-view, empty-current-scan and snapshot-expiry tests. Not first. |
| `src/views/fileLibrary/library/librarySourceOwner.ts` — `useLibrarySourceOwner` | Reads legacy `scope`/stats and selects legacy `setScope`; exposes them to Library Mode. Separately owns the V2 query/result/selection/detail projections and a direct `setQueryScope` wrapper. | Current active Files surface is split: V2 owns query/result/selection/detail; legacy values are compatibility/persistence inputs and stats bundle. | Mounted only for the active Files workspace. `setQueryScope` can write managed-root IDs without updating the legacy mirror; `setScope` writes localStorage. The controller translates legacy scope on mount/change. Divergence and effect ordering are the main risk. | Eventual source-owned V2 scope adapter plus retained legacy persistence bridge; no second store. Evidence: Library Mode/navigation, filter/search/saved-view, selection and scope-health tests. Not first because it is the eventual convergence boundary. |
| `src/views/fileLibrary/library/LibraryMode.tsx` — indirect `source.setScope`, `source.setPreviewResult` | Calls `source.setScope({ kind: "all" })` from empty-state/all actions; reads `source.scope`; supplies `source.scope` to operation-preview refresh and direct preview result. | `source.scope` is legacy compatibility state; Query V2 rows/health are separate. Operation preview authority is the operation preview/journal path after request creation. | Active Files surface; all actions may persist, while managed-root navigation is handled elsewhere. Current-scan empty state and operation preview scope must remain aligned. Replacing only the display read can cause a preview request to carry a different scope. | Migrate with the source-owner contract and an explicit operation-preview scope parameter; preserve all/roots/current-scan behavior. Evidence: mounted Library Mode, operation callbacks, empty-state and narrow-width tests. Not first. |
| `src/views/fileLibrary/library/libraryNavigationSurface.tsx` — indirect `source.setScope` and direct `source.setQueryScope` | Writes V2 all/root scopes for navigation; writes legacy `all` mirror only on all-navigation paths; root navigation has no legacy persistence call. | V2 query spec is the active navigation projection; legacy scope remains a partial mirror. | User interaction is synchronous and feeds controller effects; root IDs come from backend-issued managed locations. Direct V2 root navigation can diverge from persisted legacy scope after unmount/relaunch. | One reviewed source-owned navigation contract, with an explicit decision whether root navigation is session-only or persisted. Evidence: W2-09 platform navigation, Library Mode keyboard/navigation and persistence tests. Not first. |
| `src/views/scanner/ScannerView.tsx` — `ScannerView` | Reads legacy `scope`/stats for overview roots and summary; reads legacy AI progress fields. **No scope write.** | Durable scan roots/sessions/runs own scan truth; managed AI queue/provider policy owns AI truth. Legacy scope is a display compatibility input. | Scanner can be mounted while Files is unmounted. Foreground `current_scan` roots may include incomplete coverage; background indexing must not replace them. Query V2 is not directly read here. | Derive roots/health from durable scan/root projections and move AI progress separately. Evidence: overview, scan-manager, background-indexer and watcher-health tests. Not first. |
| `src/views/rules/RulesView.tsx` — `reapplyRulesToCurrentScope` | Reads legacy scope for signature/context; resolves it to V2 before `executeRulesForScopeV2`; refreshes legacy stats and library after execution. | Rule Repository V2/catalog revision owns rules; backend Query V2 scope resolution owns the execution target. Legacy value is the current compatibility input. | Run generation/stale-result guards depend on a stable scope signature. A failed or partial watcher state must be reported by V2 resolution rather than silently widened. Post-run refresh must remain after execution. | Accept an explicit V2 scope projection and owner-aware refresh after a separate hydration contract. Evidence: `tests/rulesViewBehavior.test.tsx`, `tests/rulesViewUi.test.ts`, rule catalog/revision and scope-health tests. Not first. |
| `src/views/rules/RuleProposalWorkspace.tsx` — `runPreview` | Reads legacy scope; resolves to V2; supplies that scope to the Rule Proposal preview. | Rule Proposal ledger owns proposal/impact state; Query V2 resolver owns the scope passed to preview. Legacy scope is only a shape adapter. | Proposal preview is consent-bound and may be opened inside Rules without Files mounted. A stale/missing current-scan session must fail closed rather than become all roots. No localStorage write occurs here. | Pass an explicit V2 scope from a reviewed Rules owner; preserve provider/consent and stale proposal revisions. Evidence: `tests/ruleProposalTask07.test.ts`, proposal impact and scope-invalid tests. Not first. |
| `src/views/timeline/TimelineView.tsx` — scope label fallback | **Baseline:** read legacy scope only to label the operation-preview page when `previewScope` was absent; operation actions themselves came from `useOperationQueueStore`. **Head:** no legacy import/read; label uses the existing `previewScope` projection. | `previewScope` captured by the operation-preview store is the precise operation context when present; legacy scope was only a display fallback, not operation authority. | No scan/session write or persistence dependency. The risk was semantic mislabeling when a preview was absent, not filesystem mutation. | **Implemented in this task:** use `previewScope` only; when no operation preview scope exists, omit the scope line rather than implying that the user has no selected folder. Evidence: `tests/timelinePreview.test.ts` and the mounted case in `tests/organizeV421Interaction.test.tsx`, plus caller-zero search. See §7. |
| `src/store/useScanManagerStore.ts` — `persistedScanSessionId`, `scanPaths` | Reads legacy current-scan `scanSessionId` at startup; after a terminal managed session, writes `setCurrentScanScope(completedScanRoots, session.id)` and then awaits legacy `refresh`. | Rust scan roots/sessions/runs are durable authority; legacy scope is the current-scan compatibility/persistence mirror. | This is the most order-sensitive caller: wait for terminal session, project the final UI session, include `requires_reconciliation` roots, write scope/session, then refresh. Cancellation/failure deliberately does not write scope. | A scan-session/current-scope adapter can replace the mirror only after a migration contract preserves the exact sequence. Evidence: `tests/scanManager.test.ts`, `tests/libraryScope.test.ts`, managed event and reconciliation tests. Not first. |
| `src/store/useBackgroundIndexerStore.ts` — `processBackgroundQueue` | Refresh-only import after a separate managed scan; **does not read or write Library scope.** | Durable background scan ledger and watcher/root state; legacy refresh is an invalidation compatibility path. | Foreground scanner exclusion, cancellation generation and acceptance of `requires_reconciliation` are explicit. It must never call `setCurrentScanScope` or take over the user's current-scan selection. | Owner-aware invalidation after background outcomes. Evidence: `tests/backgroundIndexer.test.ts` and `tests/backgroundIndexerRuntime.test.ts`. Not a scope caller. |
| `src/store/operationQueue/operationExecutionController.ts` — stale-preview/reapply paths | Reads `previewScope ?? legacy scope` for stale preview refresh; reads legacy scope for V2 rule execution; calls legacy refresh after execution. | Authoritative operation preview/journal owns mutation target; Rule Repository V2 and Query V2 resolver own rule execution target. Legacy scope is a fallback/compatibility input. | Backend preview revalidation, materialization and post-execution refresh ordering are safety-sensitive. Removing the fallback without replacing rule scope/context can refresh or execute against the wrong target. | Split operation-preview context from Rule V2 scope and migrate refresh separately. Evidence: `tests/operationQueueCallbacks.test.ts`, rule execution and restore/recovery tests. Not first. |
| `src/store/operationQueue/operationRestoreController.ts` — `confirmOperationRestore` | Refresh-only import after restore; reads operation `previewScope` for preview refresh. **No legacy scope read/write.** | Restore/operation ledgers and identity revalidation own restore; legacy refresh is a projection invalidation. | Restore outcome must be journaled before projection refresh; missing preview scope simply skips preview refresh. | Restore-ledger outcome to Query V2/stat invalidation adapter. Evidence: restore/operation callbacks and identity tests. Not a scope slice. |
| `src/store/operationQueue/cleanupRestoreController.ts` — `confirmCleanupRestore` | Dynamic-imports the legacy store only to refresh after cleanup restore; uses operation preview scope separately. **No legacy scope read/write.** | Safe Trash/cleanup journal and restore identity checks own cleanup; dynamic import is compatibility coupling. | The dynamic import preserves a lazy path; cleanup outcome must settle before refresh and preview refresh. No scope/session persistence dependency. | Owner-aware cleanup/restore invalidation with no new queue. Evidence: cleanup restore and independent review tests. Not a scope slice. |
| `src/views/vault/components/FileClassificationDetails.tsx` — confirm/correct actions | Selects only legacy `refresh` after a classification confirmation/correction. **No legacy scope read/write.** | Content/classification authority owns the fact; legacy refresh is a compatibility invalidation bundle. | Refresh follows the mutation and must not claim content/search authority. No scope persistence dependency. | Content/classification revision refresh adapter. Evidence: content UI and classification tests. Not a scope slice. |

### Supporting V2/operation owners that are not legacy-store callers

- `src/store/useFileLibraryV2Store.ts` owns the renderer Query V2 spec/result,
  exact/deferred count, snapshot epoch, selection, detail, tags and Saved View
  projections. `legacyScopeToFileLibraryScope` and
  `resolveLegacyLibraryScope` are stateless shape/root-ID adapters; neither
  persists scope or becomes a second authority.
- `src-tauri/src/db/queries/library/mod.rs` owns the backend V2 query and
  `resolve_scope`. `current_scan` validates the durable session and resolves
  effective session roots; explicit roots resolve backend root IDs; all resolves
  enabled file-library roots. A root is available only when enabled, healthy,
  not pending reconciliation/rule recovery, and its watcher revisions match.
- `src/store/useOperationQueueStore.ts` owns the in-memory `previewScope`
  captured with an authoritative operation preview request. It is operation
  context, not the current Library selection and not persisted Library scope.
- `src-tauri/src/db/queries/scan.rs`, `src-tauri/src/scanner.rs` and
  `src-tauri/src/watcher.rs` own scan/session/root admission, terminal status,
  root revisions and reconciliation scheduling. Renderer watcher status is a
  projection and refresh hint.

## 4. Canonical questions and answers

### 1. What currently owns the user-selected Library scope for a session?

There is no single canonical owner. For legacy consumers and cross-launch
compatibility, `useFileLibraryStore.scope` is the current session value. For
the active managed-library query, `useFileLibraryQueryStore.spec.scope` is the
query projection used by Query V2. Managed-root navigation can update the V2
scope without updating the legacy value, so the two can diverge. The backend
does not persist a generic user-selected Library scope; it resolves the V2
scope against durable root/session ledgers.

### 2. What currently persists that scope across launches?

`src/store/useFileLibraryStore.ts` reads and writes browser localStorage under
`zc-library-scope`. The store initializes from that value once, and the two
scope actions persist before updating in-memory state. Query V2 spec/results
are not cross-launch persistence.

### 3. What owns `current_scan` roots and `scanSessionId` after managed scan completion?

The durable owner is the Rust scan ledger: `scan_sessions`,
`scan_session_roots`, `scan_runs` and `scan_roots`. After
`useScanManagerStore` observes a terminal session, it derives the accepted
requested roots and writes a legacy `current_scan` mirror containing those
roots plus `session.id`. That mirror is needed by current legacy consumers and
startup hydration, but it is not the durable session authority.

### 4. Which callers need durable/persisted scope versus only a Query V2 projection?

- `useScanManagerStore` needs the persisted current-scan session ID as a
  startup bridge, while the backend session ledger remains authoritative.
- AppShell, Scanner, Rules, Rule Proposal, Vault and the source owner currently
  need a cross-unmount/cross-launch compatibility value; none has a safe direct
  V2-only replacement until startup hydration and root/session equivalence are
  explicit.
- File Library navigation and active query/result/selection code need only the
  current V2 query-spec projection, with backend root/health resolution.
- Timeline needs only the scope captured in the authoritative operation
  preview; it does not need current Library persistence.
- Operation execution/restore and background/watcher paths need owner-specific
  invalidation or preview context, not a new current-scope store.

### 5. Which callers can derive scope from existing settings/scan state rather than storing another copy?

The active File Library query can derive all/explicit-root scopes from the
backend-managed root IDs and can derive current-scan membership from the
durable session ID. Scanner overview can derive root health from
`listScanRoots()` and the managed scan projection. These derivations do not
replace the user's selected scope preference across launches: settings contain
enabled scan roots, not the user's current Library mode, and a scan session is
not equivalent to an all/explicit-root preference.

### 6. Does Query V2 already have enough scope ownership to absorb legacy reads without a new store?

No. Query V2 has enough ownership for an active managed-library query and its
backend resolution, but it is not persisted/hydrated as a cross-page scope
preference. Its default is `all_enabled_roots`, while the legacy store default
is an empty `current_scan`; the controller currently reconciles that mismatch
when the Files surface mounts. Absorbing global legacy reads requires an
explicit hydration/projection contract and cannot be achieved by directly
reading the V2 store everywhere.

### 7. Which writes must remain ordered with watcher/background index/scan completion?

Foreground scan ordering is fixed: wait for the durable terminal session;
project the final UI session; include accepted
`completed`/`completed_with_warnings`/`requires_reconciliation` roots; call
`setCurrentScanScope(roots, session.id)`; then await the legacy refresh. A
watcher revision must be applied/reconciled by the backend before that root is
reported healthy. Background completion may mark its own root history and
refresh, but must not update the foreground current-scan selection. Operation
execution/restore and classification refreshes occur after their authoritative
ledger/mutation outcomes and do not write Library scope.

### 8. What stale/reconciliation scenarios break if the legacy scope is removed too early?

- Startup can lose the current-scan session ID, causing missing-session or
  empty-scope behavior, while V2 still defaults to all enabled roots.
- A scan that finished with incomplete coverage can stop refreshing accepted
  observations, leaving stale Files rows; excluding
  `requires_reconciliation` roots is explicitly incorrect.
- A cancellation/failure can accidentally publish unscanned roots if the
  scope write moves before terminal confirmation.
- Watcher revision gaps, rule-recovery failures and unavailable roots can be
  hidden if a path-shaped legacy scope bypasses backend health resolution.
- Background indexing can incorrectly take over the foreground user's
  current-scan selection.
- Operation rule execution and stale-preview fallback can lose their intended
  scope or refresh the wrong projection.
- AppShell, Scanner and Rules can read an unhydrated/default V2 spec while
  Files is unmounted.
- Managed-root navigation can lose its intentional session-only behavior if a
  persistence migration is assumed rather than decided.

### 9. Is localStorage still the intended durable owner, or compatibility debt?

It is compatibility persistence, not the product's durable scope authority.
The product's durable facts are the SQLite scan/root/session and watcher
ledgers; Query V2 resolves against them. Nevertheless, localStorage is the
current cross-launch owner for the legacy preference. Changing its key,
version, fallback, storage owner or relationship to Query V2 changes
persistence authority and requires a separately reviewed ADR/initiative and a
forward/backward migration contract. Retaining it as a bounded compatibility
mirror does not by itself require an ADR.

### 10. What is the smallest same-task production migration that removes a real legacy scope caller without changing durable authority?

The read-only `TimelineView` scope-label fallback in §7 satisfies every
implementation gate. It uses the already-captured operation `previewScope`,
removes one real legacy scope reader, and leaves localStorage, Query V2,
scan/watcher ordering, operation execution, restore and filesystem mutation
unchanged. It is implemented in this branch and its caller-zero evidence is
recorded below.

## 5. State-transition matrix

“Allowed scope writer” means the only component permitted to change the
corresponding scope representation in that transition. Other surfaces are
readers/projectors and must not infer a new scope from loaded rows, stats,
watcher notifications or search results.

| Transition | Durable/backend fact | Allowed scope writer | Readers/projectors | Ordering, stale and reconciliation rule |
| --- | --- | --- | --- | --- |
| App startup with valid persisted scope | Browser storage contains a valid legacy shape; scan/session/root ledgers may or may not still contain its referenced facts | Store initialization reads only; no transition writer. Files controller may write the V2 projection after resolving it | AppShell/Scanner/Rules may read legacy value; Files controller projects V2; backend resolves roots/session | Do not treat the V2 default as the persisted preference. A missing current-scan session must surface invalid/empty behavior, not widen to all. |
| App startup with no persisted scope | Store returns `{ kind: "current_scan", roots: [] }`; no current session is selected | No scope writer | Files controller clears results and projects an empty-current-scan state; other pages read the empty compatibility value | Preserve the distinction from V2's in-memory default `{ kind: "all_enabled_roots" }` until the controller reconciles it. |
| User switches to **all** | Backend query will resolve enabled file-library roots and their health | File Library source/navigation action may write both V2 `all_enabled_roots` and legacy `{ kind: "all" }` | Library Mode projects query/result/health; other pages may read the persisted mirror | Persist before legacy state update; query loading follows the source/controller. No loaded page count becomes authority. |
| User switches to explicit **roots** | Backend root IDs and health/revisions are authoritative | Managed-root navigation may write V2 `roots` directly; legacy writer is not currently called for this path | Active Library query/result/health project V2 | The current session-only V2 navigation may diverge from localStorage. Any future persistence change is ADR-required. |
| Managed scan starts | Rust admits session/root leases, generations and revisions | No Library scope writer at start | Scan manager projects queued/running UI; Files retains prior query/scope until terminal handoff | Do not publish requested roots before durable admission/terminal outcome. Background waits for foreground scan. |
| Managed scan completes successfully | Durable session and runs are terminal; accepted root mappings are available | `useScanManagerStore.scanPaths` calls `setCurrentScanScope(completedScanRoots, session.id)` exactly once for non-empty accepted roots | Legacy store persists/mirrors; Files controller later projects V2 current-scan; Scanner projects scan summary | Scope write follows `waitForManagedSession` and final UI projection; legacy refresh is awaited after the write. |
| Managed scan is canceled | Durable session/run status is canceled; unscanned roots are not accepted | No Library scope writer | Scan UI shows canceled; existing Library scope remains | Do not write partial requested roots or refresh as if the scan completed. |
| Managed scan fails/interrupted | Durable status is failed/interrupted with error | No Library scope writer | Scan UI shows error; existing Library scope remains | A command rejection may set scan error, but it must not publish a new current-scan scope. |
| Scan finishes `requires_reconciliation` | Observed files are durable, but root coverage/health is incomplete | Foreground scan still writes accepted roots and session ID, then refreshes; background records its own completion/history but does not write current scope | Query V2 resolves partial/unavailable root health; Scanner keeps the incomplete-health signal | Treat this as a finished scan plus an index-health axis. Excluding it from scope refresh leaves stale rows. |
| Watcher event during an active scan | Backend root revision/reconciliation ledger is authoritative; event may create a revision gap or recovery requirement | No scope writer | `useFsWatcher` projects health and schedules owner refresh; Query V2 re-resolves health | Backend mutation/reconciliation completes before healthy status. Do not mutate current scope from a watcher callback. |
| Watcher event after scan | Root revision may be healthy, partial, permission-required or retry-exhausted | No scope writer | Query V2 scope health and watcher status project the distinct state; refresh is debounced | Preserve permission, reconciliation, partial and retry-exhausted distinctions; a refresh hint is not a scope decision. |
| Background index completion | Separate managed session reaches completed, warning or reconciliation status; its root is recorded in background history | No current-scan writer; only background queue state changes | Background queue marks completion and requests legacy refresh; Files/query re-resolve backend state | `requires_reconciliation` is accepted as an indexed outcome for queue purposes. Never replace the foreground selected current-scan session. |
| Operation execution completes | Operation journal records outcome; authoritative preview may be stale and is reacquired | No Library scope writer | Operation queue refreshes preview context; legacy refresh projects file/stats changes; Timeline reads operation preview scope | Execute/revalidate/journal first, then refresh projections. Do not use operation outcome to change the user's Library scope. |
| Operation restore/cleanup restore completes | Restore/cleanup ledger and identity revalidation record outcome | No Library scope writer | Restore controller refreshes library projection and existing operation preview if present | Keep dynamic cleanup refresh and restore refresh after ledger outcome; no scope inference from affected files. |
| Files unmounted / Scanner mounted | Durable roots/sessions/watchers remain available; Query V2 in-memory spec may be last-used or default | No mount/unmount scope writer | Scanner reads legacy scope plus durable root/scan projections; AppShell remains on legacy summary | Query V2 state is not a global preference while Files is unmounted. Do not migrate AppShell/Scanner by direct V2 reads alone. |
| Search/Command navigation while Library scope is unchanged | Global Search/ID activation and V2 selection/inspector state change; Library scope does not | No Library scope writer | Search Window and main window project `LibrarySelectionV1`/ID mirror; Files keeps its query | Search scope settings are independent of Library scope. Preserve restricted Search Window permissions and IME/navigation behavior. |

## 6. Persistence contract

The exact implementation is in `src/store/useFileLibraryStore.ts`:

| Property | Contract |
| --- | --- |
| Storage key | `LIBRARY_SCOPE_STORAGE_KEY = "zc-library-scope"` |
| Written format | `JSON.stringify({ version: 1, scope })` |
| Private format version | `1` |
| Accepted legacy read format | A raw valid `LibraryScope` object is accepted for compatibility, even without a wrapper |
| Accepted current read format | Wrapper with `version === 1` and a valid `scope` |
| Valid scope kinds | `all`; `roots` with a string-array `roots`; `current_scan` with a string-array `roots` and optional string/undefined `scanSessionId` |
| Missing/unavailable storage | Returns the default `{ kind: "current_scan", roots: [] }` |
| Malformed JSON/invalid shape/unknown wrapper version | Returns the same default |
| Storage getter/setter failures | Caught; in-session Zustand state remains authoritative for that session |
| Write ordering | `setScope` and `setCurrentScanScope` call `persistLibraryScope` before `set({ scope })` |
| Durable product status | Browser compatibility persistence only; not SQLite scope/session authority |

The validator intentionally accepts extra object fields because it checks the
known discriminant/fields rather than using an unknown-field rejection. No
caller outside this store reads the key or persistence helper at the audited
baseline.

Changing any of the following is a persistence-authority change and is
ADR/governance-required: moving the value to SQLite/settings, deleting or
renaming the key, changing version/fallback semantics, making Query V2 spec
durable, or silently converting managed-root navigation from session-only to
cross-launch persistence. A presentation-only caller migration that retains
this exact mirror is not ADR-required.

## 7. Same-task bounded migration

### SAFE SLICE IDENTIFIED — IMPLEMENT IN THIS TASK

Implemented in this branch as the only production migration. The change is a
read-only operation-preview label projection and does not broaden the scope of
the task.

| Item | Contract |
| --- | --- |
| Exact production file | `src/views/timeline/TimelineView.tsx` |
| Supporting focused test | `tests/timelinePreview.test.ts` and `tests/organizeV421Interaction.test.tsx` — added caller-zero/pure-label coverage plus a mounted omission case for `all`, explicit `roots`, empty `current_scan` and absent preview scope |
| Before | `TimelineView` reads `useFileLibraryStore.scope` and uses it as `previewScope ?? scope` for the operation-preview label |
| After | `TimelineView` reads only `useOperationQueueStore.previewScope`; when it is `null`, it omits the scope line rather than borrowing the current Library preference or asserting that no folder is selected |
| New owner | Existing operation-preview context (`previewScope`) for a non-empty authoritative preview; no-preview is an explicit unavailable/empty presentation state |
| No-new-authority proof | No store/provider/cache is added; localStorage, Query V2, scan/session, watcher, operation execution, restore and mutation journals are untouched. `previewScope` is already captured by `setPreviewResult` alongside the backend preview result. |
| Rollback | Revert the one production import/read change and its focused test. No persisted data, backend schema, journal or user-file mutation is changed. |
| Fail-closed behavior | If no preview scope exists, do not claim that the current Library preference is the operation target and do not claim that the user has no selected folder; omit the scope line. Execution remains governed by operation queue preview/revalidation, not this label. |
| Required tests | Focused Timeline label cases; existing `tests/operationQueueCallbacks.test.ts` preview-scope capture/refresh coverage; mounted operation-preview/keyboard and empty-state regressions; typecheck. |
| Caller-zero evidence | At head, `rg -n 'useFileLibraryStore|state\.scope|getState\(\)\.scope' src/views/timeline/TimelineView.tsx` returns no matches. The head re-inventory is 13 direct store-import files, 8 direct scope-bearing files and 9 direct legacy-scope reads; the nine external scope-action references and two writer implementations remain unchanged. |
| ADR | **No** for this presentation-only change if the exact operation-preview contract is preserved. **Conditional/required** if the implementation needs a new durable preview scope, changes operation-preview authority, or changes persistence semantics. |

This slice was selected because it removes a real legacy scope reader without
depending on startup hydration, scan completion ordering, watcher health,
settings, Rule Proposal consent or filesystem operation authority. It is the
only production slice in this PR; Timeline refreshes, operation execution and
`useFileLibraryStore` persistence were not migrated.

### Deferred migrations (no follow-up audit issue created)

The following are future implementation boundaries, not additional audit-only
tasks or issues created by this change:

1. **Files/source-owner convergence:** define whether the legacy persisted
   preference remains a compatibility mirror and explicitly hydrate/projection
   the V2 query scope. Gate on all/current-scan/explicit-root parity,
   mounted/unmounted behavior, snapshot expiry and persistence compatibility.
2. **Scan/session handoff:** replace the legacy current-scan mirror only after
   durable session/root resolution, `requires_reconciliation`, cancellation,
   failure and the exact write-then-refresh ordering have a new owner contract.
3. **Rules/Proposal/Scanner/AppShell:** migrate only after those callers receive
   an explicit V2/durable projection appropriate to their lifecycle; do not
   substitute the last in-memory Query V2 spec while Files is unmounted.
4. **Refresh-only callers:** remove the bundled legacy refresh action only in
   owner-specific invalidation changes, preserving watcher, background,
   operation, restore and content/classification outcomes.
5. **Store deletion:** requires zero production imports/references, including
   dynamic imports and indirect compatibility paths, plus mounted flow parity
   and relevant Query/scan/watcher/AI/operation/restore evidence. It is not
   authorized by this contract or implemented in this PR.

## 8. ADR-required findings and acceptance boundary

### ADR/governance required or conditional

- Move or retire the `zc-library-scope` localStorage persistence owner.
- Make Query V2 `spec.scope` the cross-launch/user-preference authority.
- Change managed scan/session/root ownership or the terminal write/refresh
  ordering.
- Change watcher reconciliation/revision ownership or collapse its distinct
  health states.
- Add a new durable scope store/provider/cache or a second operation-preview
  scope authority.
- Change operation preview, filesystem mutation, restore or recovery authority
  while migrating scope.

### Not authorized by this artifact

- Any further production edit under `src/` or any edit under `src-tauri/`
  beyond the single Timeline presentation migration recorded in §7.
- Deleting `useFileLibraryStore.scope`, its actions, its persistence key or its
  compatibility adapter.
- Query V2 semantic changes, scan/watcher/background behavior changes, stats,
  AI, operation/restore, schema, permissions, provider, release or version
  work.
- Starting any deferred migration without a separately reviewed implementation
  decision and its own focused evidence.

### Validation boundary

Repository evidence referenced by this contract includes:

- `tests/libraryScope.test.ts` — legacy persistence, scan completion handoff,
  refresh argument propagation and all-scope switch;
- `tests/scanManager.test.ts` — terminal status, event revision gaps,
  `requires_reconciliation`, cancellation and exact write/refresh order;
- `tests/backgroundIndexer.test.ts` and
  `tests/backgroundIndexerRuntime.test.ts` — separate background lifecycle and
  incomplete-coverage acceptance;
- `tests/fsWatcherBackend.test.ts`, watcher status/presentation tests — backend
  watcher projection and revision gating;
- `tests/fileLibraryV2.test.ts`, `tests/fileLibraryTask06Handoff.test.tsx`,
  `tests/fileLibraryV4.test.tsx` — Query V2 authority, mounted controller and
  stale/selection behavior;
- `tests/operationQueueCallbacks.test.ts` — operation preview scope capture,
  stale reacquisition and post-outcome refresh;
- `tests/rulesViewBehavior.test.tsx`, `tests/ruleProposalTask07.test.ts` —
  V2 scope resolution and Rule Proposal boundaries;
- `tests/remediationContract.test.ts` — current project/debt contract;
  `tests/timelinePreview.test.ts` and `tests/organizeV421Interaction.test.tsx` —
  Timeline caller-zero, label and mounted no-preview omission contracts.

Validation for the implementation is claim-scoped:

- `npx vitest run tests/timelinePreview.test.ts tests/td007TokenCallerMigration.test.ts tests/operationQueueCallbacks.test.ts tests/organizeV421Interaction.test.tsx` — **pass**, 4 files / 66 tests;
- `npm run typecheck` — **pass**;
- `python docs/design/w6-06/07-v26/rebuild-v26.py --verify-only` — **pass**, all 4 targets;
- `npm run test:remediation` — **pass**, 14 tests;
- `npm run build:frontend` — **pass**; Vite emitted only existing CSS/chunk/dynamic-import warnings;
- `npm run verify:frontend` — **not green locally** because its `npm test` phase hits the unchanged Windows CRLF/LF string assertion in `tests/searchSpotlight.test.ts`; 143 files / 1524 of 1525 tests passed before the command stopped;
- `npm run test:performance:architecture` — architecture guard passed, but its focused `searchSpotlight.test.ts` phase hit the same unchanged CRLF/LF assertion.

Browser verification is **not run locally — no browser gate was routed for this
read-only label change**; hosted PR gates remain the review evidence. Native
verification is **not run — no native seam changed**. No production authority
change is claimed.

## 9. Review conclusion

The current scope system is understood but not yet converged: legacy
`LibraryScope` remains the persisted compatibility owner, Query V2 owns active
managed-library querying, and durable scan/watcher ledgers own root/session
validity. This task implemented exactly one safe read-only Timeline
operation-preview label migration. It removes one real caller without moving
any durable authority and leaves all lifecycle-sensitive callers gated.

**TD-001-P3 CONTRACT + SAFE MIGRATION READY FOR REVIEW**
