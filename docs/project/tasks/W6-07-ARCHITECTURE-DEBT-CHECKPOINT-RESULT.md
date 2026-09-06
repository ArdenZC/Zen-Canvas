# W6-07 Architecture Debt Checkpoint Result

## W6-07 ARCHITECTURE DEBT CHECKPOINT READY — BOUNDED RETIREMENT TASKS IDENTIFIED

Date: 2026-09-07

Scope: Issue #210, architecture audit and bounded retirement planning only.

This result does not refactor production code, move durable authority, close
technical debt, activate W6-08, or claim W6-07 completion.

## 1. Exact source and authorization

The audit was performed in a fresh linked worktree:

- worktree: F:\Coding\Zen-Canvas-w6-07-architecture-debt-checkpoint
- branch: docs/w6-07-architecture-debt-checkpoint
- baseline: master@b3a3381906105bc4342c833f3a1b54d3920f6acf
- baseline tree: fb97590646b8589140ffa903de0aa264213ee5fd
- audited HEAD before this result: b3a3381906105bc4342c833f3a1b54d3920f6acf
- audited tree before this result: fb97590646b8589140ffa903de0aa264213ee5fd
- result HEAD: 32a6dd2d4a68dd075161f39371abb7b1d1c17d52
- result tree: 633f9b372d5f9968bbf5d08a155c1f1402c3e735
- working tree before authoring: clean

Issue #210 activation amendment authorizes audit/planning after Phase 1B
PR #211 merged. PR #211 is merged to the exact baseline above; its final
production head was 75d01d23ab1511e4a894901ce5ee7f052a8b2c20 with tree
fb97590646b8589140ffa903de0aa264213ee5fd.

Current project truth remains:

- W6-07 Core Experience Reconstruction is ACTIVE.
- W6-08, W6-09 and W6-10 remain inactive.
- public v0.1.40 publication remains DEFERRED / DO NOT PUBLISH.
- W6-05 FAIL, DEGRADED and UNVERIFIED evidence remains unchanged.

## 2. Method and evidence boundary

The inventory used the exact baseline checkout and repository-wide searches,
not the historical caller list in TECH_DEBT.md as a substitute for current
evidence.

Production TypeScript inventory:

- source root: src/
- file set: TypeScript and TSX production files
- tests and documentation were not counted as production callers
- direct imports, getState calls, dynamic imports and constants-only imports
  were distinguished

Vault-family inventory:

- all 13 TypeScript/TSX files under src/views/vault were listed;
- external imports into vault components, controllers, models and the
  VaultView export surface were enumerated;
- useLibraryContentCompatibility was traced from definition to its Library
  Mode caller;
- Query V2, LibrarySelectionV1, BrowseService/WorkspaceSession, Preview Core,
  Content and operation authorities were checked as replacement owners.

Token inventory:

- the 26 aliases defined in src/styles.css were enumerated;
- var(--alias) consumers were counted separately from alias definitions;
- the two focus aliases in src/styles/tokens.css were counted separately;
- undefined semantic-token references were not misclassified as legacy aliases.

Rust inventory:

- src-tauri/src contains 198 Rust files, of which 173 are non-test files
  under the selection rule;
- non-test modules were ranked by line count;
- the top 10 were reviewed as candidates, not split targets;
- signal columns are LOC, bytes, pub functions, pub struct/enum/trait/type
  items, pub modules and inline test attributes;
- test files and test modules were excluded from candidate selection, while
  inline test attributes remain visible as test-ownership evidence.

The following claims are intentionally not made by this docs-only checkpoint:

- no browser acceptance;
- no native Windows or macOS acceptance;
- no visual equivalence;
- no performance acceptance;
- no debt closure;
- no production behavior change.

## 3. Executive inventory

| Debt | Current finding | Exact inventory | Verdict |
| --- | --- | --- | --- |
| TD-001 | useFileLibraryStore is a compatibility umbrella for scope, stats, scan, AI and legacy list state while Query V2 and other durable authorities already exist | 17 external production caller files; 1 dynamic import; 1 constants-only import; 1 unused direct import; no external production use found for several store actions/exports | Open; staged migration is required |
| TD-015 | the canonical route is FileLibraryWorkspace, but Library Mode still consumes Vault compatibility leaves and the VaultView export remains | 10 external production files import Vault-family code; useLibraryContentCompatibility has 2 production files in its call chain; VaultView has an export surface but no direct runtime caller found | Open; only pure-helper migration is proven now |
| TD-002 | AppRuntimeProviders coordinates unrelated lifecycle and mutation adapters | 17 responsibility groups identified; several already have stable hooks, while ordering and duplicate-listener risks remain | Open; extract only with lifecycle-equivalence tests |
| TD-007 | legacy aliases remain on unmigrated surfaces | 26 root aliases; active root consumers include 66 var(--muted) uses in 14 files; focus aliases have 34 and 8 consumer uses respectively | Open; caller-by-caller migration required |
| TD-008 | large Rust modules mix orchestration with stable subdomains | 10 review candidates selected from 173 non-test Rust files; largest is content.rs at 6,472 LOC | Open; no extraction authorized by this checkpoint |
| Track F | TD-005, TD-006, TD-009 and TD-010 remain visible later work | No implementation performed | Deferred to their own authority/equivalence reviews |

No debt item is marked closed. No entry in docs/project/TECH_DEBT.md was
changed.

## 4. TD-001 result: useFileLibraryStore caller and owner map

### Exact caller count

The store itself is one source file. The exact external production inventory
is 17 files:

1. src/components/AppRuntimeProviders.tsx
2. src/components/AppShell.tsx
3. src/store/operationQueue/cleanupRestoreController.ts
4. src/store/operationQueue/operationExecutionController.ts
5. src/store/operationQueue/operationRestoreController.ts
6. src/store/useBackgroundIndexerStore.ts
7. src/store/useOperationQueueStore.ts
8. src/store/useScanManagerStore.ts
9. src/views/fileLibrary/library/librarySourceOwner.ts
10. src/views/rules/RuleProposalWorkspace.tsx
11. src/views/rules/RulesView.tsx
12. src/views/scanner/ScannerView.tsx
13. src/views/settings/SettingsView.tsx
14. src/views/timeline/TimelineView.tsx
15. src/views/vault/components/FileClassificationDetails.tsx
16. src/views/vault/components/FileLibraryList.tsx
17. src/views/vault/VaultView.tsx

The cleanup restore controller is the one dynamic-import caller. The
FileLibraryList import is constants-only and currently consumes only
LIBRARY_PAGE_SIZE. useOperationQueueStore contains a direct import but no
identifier use beyond that import; it is a proven cleanup candidate, not
evidence that the store still owns operation state.

### Caller-by-caller classification

| Caller | Consumed fact/action | Current role | Durable owner or safe replacement |
| --- | --- | --- | --- |
| AppRuntimeProviders | refresh; selectedFileId read/write | watcher/bootstrap refresh and search-window handoff | Query V2 refresh coordinator; LibrarySelectionV1 for selection; retain app/window handshake owner |
| AppShell | stats; scope; setSelectedFileId | shell description and Command Modal compatibility | backend stats/dashboard projection; Query V2 scope projection; LibrarySelectionV1 |
| cleanupRestoreController | dynamic refresh | refresh after cleanup restore | cleanup/restore ledger outcome plus Query V2/stat projection refresh |
| operationExecutionController | scope; refresh | operation preview context and post-execution invalidation | Operation Preview/journal for operation context; Query V2 and backend stats projection for refresh |
| operationRestoreController | refresh | refresh after restore | restore/operation ledgers plus Query V2/stat projection refresh |
| useBackgroundIndexerStore | refresh | invalidation after managed background indexing | watcher/reconciliation truth and Query V2 refresh |
| useOperationQueueStore | unused import | stale dependency only | remove import after focused typecheck; no authority movement |
| useScanManagerStore | scope; setCurrentScanScope; refresh | current scan session lookup and scan/dedupe completion handoff | durable scan roots/sessions/runs and watcher reconciliation; explicit V2 scope adapter |
| librarySourceOwner | scope; stats; setScope | compatibility fields beside Query V2 query/result/selection/detail | Query V2 scope/query/result; backend stats projection; no second source owner |
| RuleProposalWorkspace | scope | scope supplied to Rule Proposal preview after V2 resolution | Rule Proposal ledger plus Query V2 resolveLegacyLibraryScope adapter |
| RulesView | scope; stats.needsConfirmation; loadStats; refresh | rule execution context and review count | Rule Repository V2/catalog revision; backend stats projection; Query V2 refresh |
| ScannerView | scope; stats; isClassifyingWithAI; aiClassificationProgress | scan overview and AI progress presentation | scan/root/run projections; managed AI queue/provider policy; content/classification projections |
| SettingsView | selectedFileId; libraryPage.files | selected-file compatibility context | LibrarySelectionV1 and Query V2 detail/result projection |
| TimelineView | scope | operation preview scope label/context | Operation Preview/Organization Plan scope projection; no legacy store |
| FileClassificationDetails | refresh | post-correction invalidation | content/classification authority and Query V2 refresh |
| FileLibraryList | LIBRARY_PAGE_SIZE only | load-more copy in legacy leaf | FILE_LIBRARY_V2_PAGE_SIZE or a shared presentation constant |
| VaultView | scope; stats; setScope | legacy fields alongside Query V2 result, selection and inspector | Query V2 scope/result/selection; backend stats projection |

### Store-internal facts with no external production caller

The following exports or actions were not found as external production
callers: getSelectedFile, readPersistedLibraryScope, emptyStats, emptyPage,
readableAIClassificationError, ORGANIZE_QUEUE_PAGE_SIZE,
ORGANIZE_QUEUE_MAX_FILES, setLibraryFilter, setLibraryPage, loadFirstPage,
loadOrganizeQueue, classifyCurrentScopeWithAI, classifySelectedFileWithAI,
applyAIClassificationProgress, cancelAIClassification and
clearAIClassificationStatus. Some are used by tests or remain transitively
available from the store contract; absence of an external caller is not by
itself permission to delete them until the remaining store consumers are
migrated and tests are updated.

### TD-001 migration conclusion

The store is not a safe candidate for a mechanical split into smaller
compatibility stores. The facts divide into at least five ownership paths:

1. Query V2 and LibrarySelectionV1;
2. backend stats/dashboard projection;
3. durable scan roots, sessions and watcher reconciliation;
4. managed AI queue/provider/content classification projection;
5. operation, restore and search-window refresh/selection adapters.

The first implementation task is therefore not store extraction. It is a
caller-owned invalidation and scope migration contract, preceded by removal
of the unused operation-queue import and a replacement for the
constants-only page-size dependency. The full deletion condition remains
zero production imports/references, including dynamic imports, plus mounted
flow parity and relevant Query/scan/AI/operation/restore regressions.

## 5. TD-015 result: Vault compatibility inventory

### Current route truth

The active Files route is FileLibraryWorkspace and Library Mode. Query V2,
LibrarySelectionV1, the Preview Experience provider, Content policy/run/
artifact APIs and operation preview paths already participate in the route.
The remaining Vault family is a compatibility surface, not a second declared
durable authority; it must not be deleted until each leaf has a proven
replacement.

The Vault family contains 13 TypeScript/TSX files plus vaultView.css:

- VaultView.tsx and AssetCard.tsx;
- components/ContentUnderstandingSheet.tsx;
- components/DuplicateGroupsPanel.tsx;
- components/FileClassificationDetails.tsx;
- components/FileLibraryFilterPopover.tsx;
- components/FileLibraryInspector.tsx;
- components/FileLibraryList.tsx;
- components/LibraryMetadataManagerDialog.tsx;
- controllers/useVaultQueryController.ts;
- fileLibraryModel.ts.

There is no direct runtime <VaultView> caller found outside its own
definition. src/views/index.ts still exports it, so the export surface is a
production compatibility caller and remains in the count.

### Exact external caller count

There are 10 external production files importing Vault-family code:

| External file | Imported compatibility surface | Replacement/owner classification |
| --- | --- | --- |
| src/components/FileTypeIcon.tsx | filePreviewKind from fileLibraryModel | pure presentation classification; proven shared-helper migration |
| src/views/index.ts | VaultView export | legacy export surface; remove only after export/import search is zero |
| src/views/organize/OrganizeSuggestionInspector.tsx | typeLabel, purposeLabel, lifecycleLabel, riskLabel | pure localized labels; proven shared-helper migration |
| src/views/timeline/PreviewFileRow.tsx | riskLabel | pure localized label; proven shared-helper migration |
| src/views/fileLibrary/context/contextPanelProjection.ts | FileLibraryInspectorProps type | presentation contract currently typed by Vault Inspector |
| src/views/fileLibrary/context/ContextPanel.tsx | FileLibraryInspector | Inspector presentation leaf; replace after selection/detail equivalence |
| src/views/fileLibrary/library/LibraryContextMenu.tsx | libraryRevealLabel | localized action label; migrate with shared context-menu presentation |
| src/views/fileLibrary/library/LibraryMode.tsx | filter, content-understanding and metadata-manager leaves; useLibraryContentCompatibility | Query V2/Content/metadata-owned presentation, staged replacement |
| src/views/fileLibrary/library/librarySourceOwner.ts | useVaultQueryController | Query V2 controller compatibility wrapper; replace after query interaction equivalence |
| src/views/fileLibrary/library/useLibraryContentCompatibility.ts | ContentRefreshResult type and Vault content leaf bridge | Content policy/run/artifact authority; retain until direct bridge is proven |

useLibraryContentCompatibility is present in two production files: its
definition and the LibraryMode caller. It uses the V2 Inspector store/detail
epoch and direct content policy/detail refresh calls. That is a compatibility
bridge, not permission to create a second content authority.

### TD-015 migration conclusion

Only the pure presentation-helper slice is proven sufficiently for immediate
bounded implementation. The Inspector, content, metadata, query-controller
and VaultView export slices require behavior/equivalence evidence and remain
gated. A preview button rendered by FileLibraryInspector may already call
Preview Core through the current Library Mode projection; that does not make
the Vault component safe to delete without proving keyboard, stale-selection,
focus restoration and real-browser behavior.

TD-015 remains open until every remaining compatibility caller is migrated,
production caller search is empty and the same change proves replacement
behavior. Partial pure-helper or Preview-only retirement must not close it.

## 6. TD-002 result: AppRuntimeProviders responsibility map

Seventeen responsibility groups were identified:

1. runtime capability load;
2. document language effect;
3. persisted settings lifecycle;
4. chrome/theme composition;
5. Rule Repository V2 persistence/synchronization;
6. filesystem watcher refresh callback;
7. default scan-root synchronization;
8. background-index startup enqueue;
9. Search Window navigation listener and duplicate-delivery guard;
10. Main Window ready request, acknowledgement and pending navigation state;
11. global-hotkey registration-failure listener;
12. settings mutation adapters for close behavior, folder naming, scan roots,
    retention, launch-at-login, background indexing, search hotkey, search
    scope, custom search roots and organize root settings;
13. global-hotkey register/rollback atomicity;
14. window close behavior integration;
15. Rule CRUD actions with catalog-revision ordering;
16. StoreRuntimeBootstrapper scan-listener, operation-queue and legacy refresh
    startup;
17. composition-root/provider nesting and cross-surface legacy refresh/
    selection dependencies.

Existing stable owners include useAppSettings, useAppChrome,
useRulePersistence, useWindowBehavior, useFsWatcher,
useScanManagerStore, useBackgroundIndexerStore, useRulesStore and
useOperationQueueStore. The remaining work is a bounded coordinator/lifecycle
contract, not a new authority.

Primary risks before extraction are duplicate listeners, duplicate startup
background scans, search navigation applied twice, hotkey rollback races,
Rule catalog revision races and bootstrap re-entry. The safe order is:

1. add lifecycle/effect-count and navigation/rollback contract coverage;
2. extract capability/document/window-handshake effects that do not own
   durable state;
3. extract settings mutation adapters while useAppSettings remains the
   persistence owner;
4. isolate scan-root, watcher and background-index startup ordering;
5. migrate TD-001 refresh/selection dependencies;
6. extract Rule action coordination only after catalog-revision tests pass;
7. retain one composition root and remove only proven duplicate paths.

No TD-002 implementation issue is created by this checkpoint because the
consumer seams and lifecycle-equivalence exit conditions are not yet proven.

## 7. TD-007 result: token alias audit

src/styles.css defines 26 root aliases:

| Legacy alias | Canonical mapping | Current var consumer evidence |
| --- | --- | --- |
| --bg | --zc-canvas | 1 occurrence in styles.css |
| --surface | --zc-surface | 0 |
| --surface-soft | --zc-surface-subtle | 1 in Vault AssetCard |
| --surface-strong | --zc-surface-floating | 0 |
| --ink | --zc-text-primary | 3 in styles.css, shared/ui and Vault AssetCard |
| --muted | --zc-text-secondary | 66 in 14 production files |
| --quiet | --zc-text-tertiary | 2 in Timeline PreviewFileRow and Vault AssetCard |
| --line | --zc-border | 2 in Timeline and Vault AssetCard |
| --line-dark | --zc-divider | 0 |
| --primary | --zc-primary | 0 |
| --accent | --zc-brand-green | 0 |
| --success | --zc-success | 0 |
| --warning | --zc-warning | 0 |
| --danger | --zc-danger | 0 |
| --purple | --zc-purple | 0 |
| --shadow | --zc-shadow-raised | 0 |
| --shadow-strong | --zc-shadow-floating | 0 |
| --shadow-cmd | --zc-shadow-spotlight | 0 |
| --inset | contextual light/dark inset | 0 var consumers; two definitions remain |
| --radius-lg | --zc-radius-window | 0 |
| --radius-md | --zc-radius-panel | 0 |
| --radius-sm | --zc-radius-control | 0 |
| --ease-spring | --zc-ease-standard | 0 |
| --color-text-secondary | --zc-text-secondary through --muted | definition only |
| --color-background-danger | --zc-danger-soft | 0 |
| --color-text-danger | --zc-danger | 0 |

Focus aliases are separate from the root legacy set:

- --zc-focus-ring has 34 var consumers in 20 files and two theme
  definitions, for 36 alias mentions across 21 files;
- --zc-focus-ring-soft has 8 var consumers in 7 files and two theme
  definitions, for 10 alias mentions across 8 files.

The four references to undefined semantic names are separate findings, not
legacy aliases: --zc-danger-bg and --zc-panel in RuleProposalWorkspace,
--zc-shadow-soft in OrganizeSuggestionsView, and --zc-text-muted in
DuplicateGroupsPanel. They require token-definition triage and must not be
silently fixed by alias deletion.

The two proven immediate tasks are caller-bounded token migrations with
Light/Dark, Forced Colors, reduced-motion and supported-density verification.
Alias deletion remains gated on repository-wide caller/reference zero and
visual/state regression evidence.

## 8. TD-008 result: Rust module-boundary audit

The top 10 non-test Rust candidates are recorded in the companion matrix.
The highest signal is src-tauri/src/content.rs at 6,472 LOC and 258,844
bytes. Size is only a review signal; no Rust file is authorized for splitting
merely because it is large.

The candidate review found that most large modules already have meaningful
internal boundaries. The safe planning rule is to extract pure or stable
subdomain implementation behind the existing facade while preserving the
same durable authority, API registration, read gate, operation journal,
provider policy and test contracts.

Immediate extraction is not authorized for:

- storage_analyzer.rs, file_ops.rs or read_gate.rs, because mutation,
  recovery, identity or read-security boundaries require stronger review;
- preview.rs or rule_proposals/mod.rs, because Preview Core and Rule Proposal/
  Rule Repository coupling are authority-sensitive;
- any candidate where a proposed split would change Tauri command ownership,
  persistence, provider ownership or supported-platform truth.

Behavior-preserving extraction is a possible later task for pure seams in
content.rs, organization/mod.rs, scan.rs, ai/classification.rs and
library/mod.rs, but only after candidate-specific tests and owner review.

## 9. Track F visibility

The following items remain visible and intentionally unimplemented:

| Debt | Current checkpoint disposition |
| --- | --- |
| TD-005 Organize edited-name compatibility bridge | no implementation; requires authoritative operation-intent/preview equivalence |
| TD-006 managed-AI legacy queue adapter | no implementation; requires final queue caller/migration/repair proof |
| TD-009 Windows filesystem/platform packaging boundary | no implementation; requires platform-boundary review and Windows mutation/recovery proof |
| TD-010 Tauri registration/allowlist/capability/security-matrix duplication | no implementation; requires generation/validation design preserving main/search permissions |

## 10. Ordered follow-up task proposal

The proposed order separates proven no-authority-movement work from gated
retirement. Two small tasks have proven ownership and testable exit
conditions and are suitable for separate implementation issues:

1. [TD-015-P1, Issue #212](https://github.com/ArdenZC/Zen-Canvas/issues/212):
   move pure File Library presentation helpers out of the Vault
   compatibility tree. Migrate filePreviewKind, typeLabel, purposeLabel,
   lifecycleLabel and riskLabel to a shared File Library presentation module;
   update FileTypeIcon, OrganizeSuggestionInspector, Timeline PreviewFileRow
   and remaining Vault leaf callers; add parity tests. Exit: no production
   import of those pure symbols from views/vault, with Query/selection/
   preview behavior unchanged. This does not close TD-015.
2. [TD-007-P1, Issue #213](https://github.com/ArdenZC/Zen-Canvas/issues/213):
   migrate the bounded Files/Timeline/Preview legacy-token callers to
   canonical semantic tokens. Exit: caller-zero for the named files and
   state/visual checks at Light/Dark, Forced Colors, reduced motion and
   supported density; do not delete aliases in this task.
3. TD-001-P1: remove the unused operation-queue import and constants-only
   dependency, then add the store caller/owner contract for scope, stats and
   refresh. Do not delete the store. This step can start after owner review
   of the exact result and the two proven helper/token tasks.
4. TD-015-P2: replace the Vault Inspector/query compatibility leaves with
   Query V2 and LibrarySelectionV1-owned presentation, preserving
   virtualization, stale snapshots, selection/focus and Preview Core host
   behavior.
5. TD-001-P2: move scan-session handoff, refresh invalidation and dashboard
   projections to scan/root, watcher, Query V2 and backend stats owners;
   separately migrate managed-AI progress to its queue/provider projection.
6. TD-002-P1: extract runtime controllers only after Search/Files/Preview
   consumer seams are stable, with effect-count, ordering, rollback and
   duplicate-listener tests.
7. TD-007-P2: migrate remaining aliases and delete only after exact
   repository/reference caller-zero plus visual/state evidence.
8. TD-008 candidate tasks: create one ADR-gated or behavior-preserving PR
   per accepted Rust boundary; never bundle module extraction with a
   feature PR.

Tasks 4 through 8 are planning gates, not implementation authorization from
this result.

## 11. Validation and closeout boundary

Validation run for this docs-only result:

- repository baseline and branch/tree preflight: PASS;
- Issue #210 and merged PR #211 live status read: PASS;
- exact source inventory and Rust/token counts: PASS;
- docs/governance check at result HEAD 32a6dd2d4a68dd075161f39371abb7b1d1c17d52: PASS;
- browser/native verification: not run — docs/audit-only checkpoint;
- production code changed: No.

The docs/governance check passed after authoring with
DOCS_DIFF_BASE=b3a3381906105bc4342c833f3a1b54d3920f6acf and
DOCS_DIFF_HEAD=32a6dd2d4a68dd075161f39371abb7b1d1c17d52. The final PR will be
one bounded Draft PR against master and will remain unmerged for owner review.

The required matrix is beside this result at
docs/project/tasks/W6-07-DEBT-RETIREMENT-MATRIX.md because the exact baseline
has no docs/project/architecture directory or established directory
convention. No new directory was introduced.

## 12. Acceptance checklist

- [x] exact baseline and tree recorded;
- [x] current production caller inventory performed from the exact baseline;
- [x] TD-001 facts/actions mapped to owners;
- [x] TD-015 external Vault callers and compatibility bridge mapped;
- [x] TD-002 lifecycle responsibilities separated;
- [x] TD-007 aliases and consumer-zero rule recorded;
- [x] TD-008 Rust candidates, ownership and boundaries recorded;
- [x] TD-005/006/009/010 remain visible without implementation;
- [x] no production code changed;
- [x] no debt marked closed;
- [ ] browser/native acceptance — not applicable to docs-only checkpoint;
- [ ] owner review and PR merge — intentionally pending.
