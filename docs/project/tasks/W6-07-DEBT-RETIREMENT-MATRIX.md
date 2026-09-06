# W6-07 Debt Retirement Matrix

This matrix is the companion planning artifact for Issue #210. It is
audited at baseline b3a3381906105bc4342c833f3a1b54d3920f6acf, tree
fb97590646b8589140ffa903de0aa264213ee5fd.

The repository has no docs/project/architecture directory or established
directory convention. The matrix therefore remains beside the checkpoint
result under docs/project/tasks. This is a planning artifact; it does not
close any debt item or authorize production refactoring by itself.

## 1. Decision vocabulary

- Ready now: ownership and a narrow, testable exit condition are proven for a
  separate bounded task.
- Gated: ownership is understood, but equivalence, lifecycle, platform or
  authority proof is still required.
- ADR conditional: a behavior-preserving internal extraction may not need an
  ADR; moving durable authority, persistence, platform support, permissions,
  provider ownership, mutation safety or recovery does.
- Caller zero: no production import, reference or dynamic import remains;
  tests and documentation may retain an explicit migration record.

## 2. TD-001 — useFileLibraryStore

| Candidate/module | Current production callers | Current durable authority | Compatibility reason | Safe replacement path | Bounded PR proposal | Required evidence | Deletion/closure condition | ADR | Order |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| src/store/useFileLibraryStore.ts: scope persistence and scope reads | AppRuntimeProviders, AppShell, VaultView, librarySourceOwner, ScannerView, RulesView, RuleProposalWorkspace, TimelineView, useScanManagerStore, operationExecutionController | Query V2 scope plus durable scan roots/sessions and watcher reconciliation | old LibraryScope path/root shape is still used to bridge older surfaces | introduce one explicit adapter at the caller boundary; do not create another scope store | P1 scope-owner contract; P2 migrate scan/session and page callers; P3 delete legacy scope | mounted Files/Scanner/Rules/Timeline/operation tests; current-scan, roots and all scopes; stale/reconciliation states | zero production scope imports and no page treats legacy scope as authority | conditional; yes if scope authority/persistence changes | after TD-015-P1; before store deletion |
| src/store/useFileLibraryStore.ts: stats | AppShell, VaultView, librarySourceOwner, ScannerView, RulesView | backend get_stats_summary projection over indexed/file authority; query/analysis/operation ledgers remain owners of their facts | older pages expect a shared DashboardStats object from a UI store | backend stats adapter or owner-specific projection; preserve exact/deferred Query counts | P1 map each stat to its owning projection; P2 migrate pages; P3 remove stats field | exact aggregate tests; no paged-data totals; loading/error/empty states | no production consumer reads store.stats; owning projections pass relevant mounted regressions | conditional; yes if a new durable stats authority is proposed | after owner map |
| src/store/useFileLibraryStore.ts: refresh/invalidation | AppRuntimeProviders, background indexer, scan manager, operation execution/restore, cleanup restore, FileClassificationDetails, RulesView | Query V2 refresh plus watcher/reconciliation, scan, operation/restore, content and managed-AI outcomes | old refresh bundled stats and first-page requests into one action | explicit owner-aware invalidation coordinator or existing Query V2 refresh calls; no duplicate global queue | P1 contract and effect ordering; P2 migrate each outcome source; P3 delete refresh action | event/order tests; stale request rejection; operation/restore and scan completion; no duplicate refresh | zero production refresh calls through this store and parity for each outcome source | conditional; yes if a new long-lived coordinator becomes an authority | after scope/stats owner mapping |
| src/store/useFileLibraryStore.ts: selectedFileId | AppRuntimeProviders, AppShell, SettingsView and search navigation; CommandModal receives setter through AppShell | LibrarySelectionV1 plus backend resolution; focus is interaction state | Search Window and older settings/context surfaces still use an ID-only bridge | route search navigation to LibrarySelectionV1 while preserving ID-only Search Window boundary | P1 selection bridge; P2 settings/search-window mounted equivalence; P3 remove selectedFileId | IME/search navigation, main-ready handshake, selection/focus/inspector continuity | no production reads/writes of store.selectedFileId; no duplicate search/selection authority | conditional; yes if cross-window permission boundary changes | before TD-002 extraction |
| src/store/useFileLibraryStore.ts: libraryPage and page-size exports | SettingsView reads libraryPage.files; FileLibraryList imports LIBRARY_PAGE_SIZE only; no other external page action callers | Query V2 result store and exact/deferred count contract | older compatibility leaves still expose FileQueryResult/page-size vocabulary | use V2 result/detail projection; use FILE_LIBRARY_V2_PAGE_SIZE or shared presentation constant | P1 remove unused import and constants-only dependency; P2 remove settings compatibility read | typecheck, Settings selected-file regression, Query V2 count/snapshot tests | no production references to libraryPage, emptyPage or legacy page-size exports | no for pure cleanup | first |
| src/store/useFileLibraryStore.ts: organize queue | no external production caller found; only store-internal AI methods reference it | Organization Plan/Plan Item ledger and Query V2 selection | legacy store retained a bounded whole-file queue for older Organize/AI flows | migrate any newly discovered caller to Organization Plan/query selection; do not clone queue | no implementation until a caller is proven | repository-wide search, Organize Plan pagination/selection tests | no production symbol or test contract requires legacy queue | conditional if a durable queue is proposed | gated |
| src/store/useFileLibraryStore.ts: AI classification actions/progress | ScannerView reads isClassifyingWithAI and aiClassificationProgress; no external action caller found in current source | managed AI queue, provider policy and content/classification projections | older UI store bundled provider calls and progress lifecycle | queue/provider projection with explicit consent and cancellation; preserve no-upload/local/cloud gates | P1 map progress events; P2 migrate Scanner; P3 remove legacy AI actions | queue/cancel/provider/consent tests; stale job IDs; no implicit mutation | no production imports of legacy AI fields/actions; final queue and repair coverage pass | yes if provider/queue ownership changes; no for a projection-only adapter | after scope/refresh |
| src/store/useFileLibraryStore.ts: dead exports and unused import | useOperationQueueStore has unused import; several helpers/actions have no external production caller | none; callers must be mapped before removal | historical compatibility surface remains in one broad file | remove only individually proven dead symbols | P1 remove unused import/constants-only dependency with focused typecheck | exact caller-zero search and typecheck | symbol-specific caller zero; not whole-store closure | no | first |

TD-001 overall closure remains open until all rows reach caller zero, affected
flows use their owning projections, and mounted/full relevant gates pass.

## 3. TD-015 — Vault/File Library compatibility

| Candidate/module | Current production callers | Current durable authority | Compatibility reason | Safe replacement path | Bounded PR proposal | Required evidence | Deletion/closure condition | ADR | Order |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pure labels in vault/components/FileLibraryList.tsx | OrganizeSuggestionInspector, Timeline PreviewFileRow, FileLibraryList itself | presentation/i18n only | old leaf owns reusable localized labels | move typeLabel, purposeLabel, lifecycleLabel and riskLabel to shared File Library presentation helper | TD-015-P1; migrate callers and retain a thin compatibility export only if needed during one review | helper parity tests; English/Chinese; no semantic output change | no production import of pure labels from Vault components | no | Ready now / first |
| filePreviewKind in vault/fileLibraryModel.ts | components/FileTypeIcon.tsx and Vault internals | presentation classification from supplied file metadata | model file is a broad legacy home for pure rendering classification | move classifier to shared presentation module; keep input type and result unchanged | TD-015-P1 with pure labels or a separately reviewed helper commit | classifier table tests; icons/preview kind parity | no production import from vault/fileLibraryModel for this symbol | no | Ready now |
| libraryRevealLabel in vault/components/FileLibraryInspector.tsx | LibraryContextMenu, Vault Inspector | localized presentation label; reveal command remains backend-owned | Inspector leaf exposes a reusable label | move label helper to shared context-menu/presentation module; keep reveal action authority unchanged | TD-015-P1b only if helper scope stays pure | i18n and context-menu action tests | no external import of label helper from Vault Inspector | no | after P1 |
| FileLibraryFilterPopover | LibraryMode and VaultView | Query V2 filter spec | compatibility component still renders current filter UI | replace with Query V2-owned filter presentation after interaction parity | TD-015-P2 | filter, focus restoration, keyboard, narrow-width browser evidence | no current Library Mode caller; VaultView also deleted or proven unreachable | conditional if filter state ownership changes | after pure helpers |
| useVaultQueryController | librarySourceOwner; VaultView | Query V2 query/spec/result/selection | wrapper translates legacyScope into V2 and handles search/filter effects | move behavior into File Library source owner/controller with explicit V2 scope adapter | TD-015-P2 | search debounce, saved-view, filter/sort, selection-boundary and snapshot-expiry tests | no production import/use of controller; V2 behavior equivalent | no if only controller relocation; yes if query authority changes | after pure helpers |
| FileLibraryInspector and FileLibraryInspectorProps | ContextPanel, contextPanelProjection, LibraryMode through projection, VaultView | LibrarySelectionV1/detail store; Preview Core/Zen Host; operation/content authorities | old Inspector component remains the visual leaf for current Files context panel | implement V2-owned Inspector presentation while preserving selected versus focused state, detail epoch and action callbacks | TD-015-P3 | mounted List/Grid/Library/Browse inspector tests; focus restoration; stale detail; Preview Core path; action safety | no production import/reference to Inspector or props from Vault family | conditional; yes for Preview/read/authority movement | after P2 |
| ContentUnderstandingSheet and useLibraryContentCompatibility | LibraryMode plus compatibility hook definition; VaultView | Content Scope Policy/Run/Artifact and content search revision | old sheet is still the UI bridge for content policy/detail | direct Content-owned presentation bridge, preserving policy consent, expected revisions and no implicit hydration | TD-015-P4 | policy revision, stale content revision, local/cloud consent, content search and cancellation | no production use/import of sheet or hook; content authority unchanged | yes if content/provider ownership moves; no for presentation-only | after P3 |
| LibraryMetadataManagerDialog | LibraryMode, VaultView | V2 tag and Saved View stores/API | older metadata dialog remains mounted in current Library Mode | keep stores/API; move dialog to File Library presentation directory | TD-015-P5 | tag/saved-view CRUD, selection counts, revision/conflict and focus tests | no production import from Vault components | no if presentation-only | after P2 |
| VaultView and src/views/index.ts export | no direct runtime caller found; src/views/index.ts exports it | replacement FileLibraryWorkspace, Query V2 and current Files route | historical standalone route/export remains in production tree | remove export and file only after full Vault caller-zero and route/equivalence proof | TD-015-P6 | repository import search, route smoke, browser List/Grid/Library/Browse and state matrix | no production caller/export; replacement behavior proven in same reviewed change | conditional if public package API/export changes | last |

TD-015 closure requires all rows, not just the Preview or pure-helper rows.

## 4. TD-002 — AppRuntimeProviders

| Responsibility | Existing owner or dependency | Why it remains in composition root | Safe boundary | Evidence before extraction | ADR |
| --- | --- | --- | --- | --- | --- |
| capability load | tauriApi.getRuntimeCapabilities and RuntimeCapabilitiesProvider | capability context is app-wide | focused capability loader hook/controller | loading/error/fail-closed behavior | no unless capability authority changes |
| document language | AppStore language and makeTranslator | document side effect follows app language | small document-language effect | language switch and SSR/browser guard | no |
| settings lifecycle | useAppSettings | persisted versioned settings owner | retain hook, expose context | load/save/rollback and settings readiness | no |
| chrome/theme | useAppChrome and ChromeProvider | app-wide chrome state | retain one chrome provider | theme/language/hotkey and search-mode tests | no |
| Rule persistence | useRulePersistence and useRulesStore | Rule Repository V2 projection/persistence | focused sync controller | catalog revision and initial hydration | no |
| watcher refresh | useFsWatcher plus legacy refresh callback | watcher is hint; reconciliation is truth | owner-aware refresh callback | event ordering and stale refresh | conditional if new coordinator persists state |
| scan-root synchronization | useScanManagerStore and persisted settings | settings-to-scan handoff is order-sensitive | scan-root sync effect/controller | enabled-root signature, mode and settings readiness | no if adapter-only |
| background indexing | useBackgroundIndexerStore | startup enqueue must be bounded/deduplicated | background startup controller | duplicate enqueue and cancellation | no |
| Search Window navigation | tauriApi listener, searchNavigation utilities, LibrarySelectionV1 | restricted window boundary and ID-only activation | focused navigation listener | duplicate delivery, IME, selected/focused continuity | yes if permission expands |
| Main Window ready | ready listener, acknowledgement and mark/unmark commands | cross-window startup handshake | focused ready-handshake controller | nonce/ack, pending navigation and mode transitions | yes if window boundary changes |
| hotkey failure | tauriApi event and AppStore error | user-visible registration failure | focused event adapter | failure and cleanup listeners | no |
| settings mutation adapters | useAppSettings updateSettings | public SettingsProvider callback contract | settings action adapter; persistence stays in useAppSettings | every setter returns persisted value and reports failure | no |
| hotkey rollback | registerGlobalSearchHotkey plus updateSettings | external registration and persisted setting must be atomic enough | dedicated hotkey transaction adapter | registration failure, persisted mismatch and rollback | conditional |
| window behavior | useWindowBehavior | platform close behavior and UI choice | retain hook/provider | Escape/close/choice and platform smoke | yes only for platform ownership move |
| Rule CRUD | UserRuleV2 commands and useRulesStore | revision/catalog ordering | Rule action adapter | create/update/toggle/delete revision races | yes if Rule authority changes |
| StoreRuntimeBootstrapper | scan listeners, operation queue and legacy refresh | startup ordering | explicit bootstrap sequence with one owner per initializer | re-entry, unmount and Search Window exclusion | no if composition only |
| provider composition | Chrome/Runtime/Settings/Rules providers | one composition root is required | do not create nested competing roots | provider identity and one-listener checks | no |

TD-002 remains open until ownership split is implemented with one composition
root and no duplicate lifecycle authority.

## 5. TD-007 — token alias retirement

| Alias group | Current owner | Active caller evidence | Safe replacement | PR/evidence | Deletion condition | ADR |
| --- | --- | --- | --- | --- | --- | --- |
| 26 aliases in src/styles.css | V26 semantic values in src/styles/tokens.css and shared primitives | active consumers: --muted 66/14 files; --ink 3/3; --quiet 2/2; --line 2/2; --bg 1/1; --surface-soft 1/1; remaining aliases have no var consumers | migrate caller-by-caller to semantic --zc roles; do not change state grammar incidentally | TD-007-P1 named Files/Timeline/Preview batch; Light/Dark/Forced Colors/reduced motion/density checks | no production/reference alias use except explicit migration note | no for value-preserving migration; conditional if token ownership changes |
| --zc-focus-ring | tokens.css owns mapping to --zc-focus in both themes | 34 var consumers / 20 files plus 2 definitions | migrate only where focus semantics are equivalent; preserve selected-focus distinctions | focused keyboard/focus-visible and high-contrast checks | caller/reference zero except migration note | no |
| --zc-focus-ring-soft | tokens.css owns mapping to --zc-focus-soft in both themes | 8 var consumers / 7 files plus 2 definitions | migrate to --zc-focus-soft or --zc-selected-focus only after state review | selected versus keyboard focus and reduced-motion checks | caller/reference zero except migration note | no |
| undefined semantic references | tokens.css currently does not define --zc-danger-bg, --zc-panel, --zc-shadow-soft or --zc-text-muted | RuleProposalWorkspace, OrganizeSuggestionsView and DuplicateGroupsPanel | separate definition/triage task; do not treat as alias retirement | token-definition and rendered state checks | each reference resolved or intentionally documented | conditional |

TD-007 overall closure requires exact caller/reference zero and supported
visual/state evidence. Alias definitions must not be removed merely because
V26 tokens exist.

## 6. TD-008 — Rust module-boundary inventory

Signal method: non-test Rust files under src-tauri/src were counted with
PowerShell Get-Content for LOC, file length for bytes, and anchored textual
matches for public functions, public struct/enum/trait/type items, public
modules and inline test attributes. These numbers identify review candidates;
they do not define a split.

| Exact module | LOC | Bytes | Pub fns | Pub type items | Pub mods | Inline tests | Durable authority | Orchestration responsibilities | Stable subdomain responsibilities | Platform coupling | Candidate boundary | ADR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |
| src-tauri/src/content.rs | 6,472 | 258,844 | 19 | 23 | 0 | 30 | Content Scope Policy, Content Run, Content Artifact | Tauri commands, revision checks, DB workflow, bounded provider/byte work | existing commands, eligibility, extractors, policy, preview, repository and types modules | Tauri Runtime/State; non-macOS fs path; archive/XML/PDF/Office readers | extract pure extraction/repository seams behind existing facade; retain content authority | conditional; no for internal behavior-preserving extraction, yes for authority move |
| src-tauri/src/storage_analyzer.rs | 6,256 | 237,341 | 57 | 24 | 0 | 18 | Analysis Run/Finding/Evidence/Decision, Safe Trash and cleanup restore | scan, candidate authorization, preview, mutation, journal/recovery and restore orchestration | cleanup candidate validation, progress/events, Safe Trash, restore and reconciliation seams | filesystem/path, Tauri runtime/window auth, atomic move/recovery | do not split mutation/recovery until boundary review; pure validation only later | yes before any authority or recovery split |
| src-tauri/src/db/queries/organization/mod.rs | 5,974 | 247,461 | 13 | 29 | 0 | 26 | Organization Plan and Plan Item ledger | plan create/query/update/analyze/execute and revision checks | cursor, projection, queries and validation submodules already exist | DB and Operation Preview coupling | extract only stable projection/query/validation internals; keep plan facade | no for behavior-preserving extraction; yes for authority move |
| src-tauri/src/db/queries/scan.rs | 4,954 | 191,943 | 29 | 18 | 0 | 26 | scan roots/sessions/runs and watcher reconciliation | scan admission, enumerate/finalize, watcher refresh and invalidation of dependent ledgers | DTOs, watcher admission/reconciliation, finalization and query helpers | fs; Windows metadata; dedupe/analysis invalidation | isolate watcher/finalization helpers only after event/reconciliation equivalence | conditional |
| src-tauri/src/file_workspace/preview.rs | 3,965 | 147,424 | 65 | 59 | 0 | 22 | PreviewSession lifecycle, provider registry, typed representation and fallback | request/session run, cancellation, publication and provider execution contract | source resolution contract, content-read interfaces, provider/host types, registry | mostly generic; native opaque/host contract coupling | no split now; W6-08/W4 may propose narrow internal extraction | yes if Preview ownership/host boundary changes |
| src-tauri/src/ai/classification.rs | 3,844 | 140,921 | 16 | 9 | 0 | 61 | managed AI queue/provider policy and classification application | target collection, provider calls, parse/sanitize/apply and progress/cancel | target collection, prompt/parser, provider adapter, safety application and progress | Tauri Runtime/State, provider policy, DB | pure parser/sanitize/target helpers only; retain queue/provider ownership | no for pure extraction; yes for provider/queue move |
| src-tauri/src/file_ops.rs | 3,834 | 157,208 | 15 | 2 | 0 | 76 | Operation Preview, journal, filesystem execution, identity, recovery and restore | command entry, preview/execution/cancel/reveal orchestration | authority, execution, identity, journal, preview, progress, recovery, restore, reveal, types, validation modules already exist | Windows process/native paths and macOS restore/test paths | no split now; existing submodules are already the safe boundary | yes before ownership/recovery changes |
| src-tauri/src/file_workspace/read_gate.rs | 3,596 | 138,738 | 17 | 13 | 0 | 29 | MaterializationReadGate and process-local bounded read lease | resolve source, eligibility, lease/open/read/copy and revocation | source resolver, bounded copy, adapter and lease registry seams | fs identity; Windows OpenOptions; platform open behavior | no split now; security/read boundary must remain one authority | yes before access semantics change |
| src-tauri/src/db/queries/library/mod.rs | 3,393 | 127,239 | 19 | 34 | 0 | 11 | File Library Query V2, LibrarySelectionV1, tags and Saved Views | canonicalization, cursor/revision query, exact count and selection SQL | saved_views/tags submodules plus query normalization/selection helpers | DB and revision-bound Query V2 contract | extract pure normalization/selection helpers while retaining V2 facade; never create Query V3 | no for behavior-preserving extraction; yes for authority move |
| src-tauri/src/db/queries/rule_proposals/mod.rs | 3,120 | 123,381 | 15 | 19 | 0 | 11 | durable Rule Proposal ledger with Rule Repository V2 coupling | proposal generation, validation, impact, apply and revision handling | predicate module, canonical AST/validation and ledger DTO seams | DB and AI/provider policy coupling | no split now; preserve proposal/repository transaction boundaries | yes before authority or provider move |

The selected Rust candidate count is exactly 10. The top candidate by LOC is
content.rs, but the first safe implementation candidate is not necessarily
the largest file. Any accepted Rust task must specify the stable boundary,
test ownership and no-authority-movement proof in its own issue/PR.

## 7. Track F rows

| Debt | Exact current owner | Why not bundled | Required future proof |
| --- | --- | --- | --- |
| TD-005 | Operation Preview/intent and Organization Plan | edited-name bridge touches operation safety and cannot be cosmetic cleanup | authoritative intent/preview edited-name continuity and caller zero |
| TD-006 | durable managed-AI queue and provider policy | legacy durable rows and cancellation/repair are persistence-sensitive | final queue caller migration plus old-row migration/repair coverage |
| TD-009 | Windows filesystem identity/handle-bound mutation path | supported-platform safety and packaging boundary | reviewed platform module preserving mutation/recovery behavior |
| TD-010 | Rust command registration, build allowlist, capabilities and security matrix | main/search window permissions are a security boundary | generated/validated synchronization without permission broadening |

## 8. Ordered implementation issue decision

Create separate issues only for the two Ready now rows:

1. [TD-015-P1, Issue #212](https://github.com/ArdenZC/Zen-Canvas/issues/212)
   pure File Library presentation helper migration.
2. [TD-007-P1, Issue #213](https://github.com/ArdenZC/Zen-Canvas/issues/213)
   bounded canonical token caller migration.

Do not create implementation issues yet for TD-001, TD-002 or TD-008. Their
replacement owner and equivalence/deletion conditions are documented, but the
consumer/lifecycle boundaries still require owner review or additional proof.

No implementation branch is created by this matrix. Each issue must remain
bounded, preserve the durable authority table and include the exact caller
zero/deletion condition for its symbols.
