# Zen Canvas UI/UX V4.3.1 Authority and Legacy Map

Status: PR0 audit baseline

Branch: `codex/ui-v4-3-product-integration`

Baseline: `9ea69d29143b994c8632747ab647f59637dfe324` (includes accepted verification fix `98ca8185979feb5b0f450a076362c089675416b5`)

This document records the current renderer paths, the accepted backend authorities, and the legacy paths that later V4.3 stages must retire or reduce to compatibility adapters. It is an audit artifact, not a second runtime authority. The observations below are based on the current source at the baseline above.

## 1. Authority decisions

| Product surface | Current renderer entry | Current visible state source | Final V4.3 authority | Legacy/compatibility path to retire |
| --- | --- | --- | --- | --- |
| Overview | `src/views/scanner/ScannerView.tsx` | `useFileLibraryStore`, scan/background-index stores, operation queue, and `useStorageCleanupStore.analysis` | Global Index health, managed-root/watcher health, durable Organization Plan summaries, durable Analysis Run/Finding summaries, Content Run status, and operation/restore ledgers | Legacy library statistics as the complete dashboard source; page-local `indexNeedsUpdate: false`; cleanup projection from `StorageAnalysis` |
| Global Search | `src/components/CommandModal.tsx`, `src/components/commandRegistry.ts` | Global Index query response plus command catalog | Global Index repository and backend ordering; commands remain a separate catalog | Any renderer re-ranking, punctuation normalization that changes literal meaning, path-based activation, or Search Window mutation permission |
| Search Window | standalone `CommandModal` | Search Window snapshot and Global Index response | Search Window session/snapshot plus ID-only result activation | Main-window state mutation, direct filesystem paths, Rule mutation commands |
| File Library | `src/views/vault/VaultView.tsx` | Query V2 result/selection/inspector/tag/saved-view stores, with legacy scope/stats compatibility reads | File Library Query V2 and `LibrarySelectionV1` | Legacy `useFileLibraryStore` page/list as query authority; deriving totals from rendered rows |
| Organize Files | `src/views/organize/OrganizeSuggestionsView.tsx` via `HubView` | Durable Organization Plan store, but only the currently loaded item page is projected | Organization Plan ledger, backend group projections, revision-checked item decisions, Operation Preview/Journal | Loaded-page grouping and decision derivation; legacy `useOrganizeDecisionStore`; any renderer execution path |
| Storage Cleanup | `src/views/cleanup/StorageCleanupView.tsx` | `useStorageCleanupStore` mixes durable Analysis Run hydration with `StorageAnalysis`/candidate state | Durable Analysis Run/Finding/Evidence/Decision lifecycle and Safe Trash/cleanup journal | Old storage scan/candidate projection as the permanent visible authority; multiple AI entry points; page-derived totals |
| Preview and Execute | `src/views/timeline/TimelineView.tsx` | `useOperationQueueStore` preview and execution projections | Server-authoritative Operation Preview, revalidation, operation journal, and execution progress | Renderer-created preview facts; technical metrics as the primary decision surface |
| History and Restore | `src/views/restore/RestoreView.tsx` | Operation queue logs plus cleanup batch/preview API state | Operation and cleanup ledgers, identity revalidation, Safe Trash and Restore contracts | Separate uncoordinated history/cleanup projections; exact paths and IDs in the normal summary surface |
| Automation | `src/views/rules/RulesView.tsx` | Rule Repository V2 projection plus local proposal projection | Rule Repository V2 and catalog revision | Renderer rule arrays as mutation authority; old save/delete/get Rule commands; proposal dashboard permanently above the Rule Library |
| Rule Proposal | `src/views/rules/RuleProposalWorkspace.tsx` | Durable Rule Proposal store | Rule Proposal ledger; Apply is a review action and does not enable or run a rule | Local bilingual copy dictionary; proposal state treated as a live Rule Library dashboard; file-content or filesystem mutation authority |
| Content Understanding | `src/views/vault/FileLibraryInspector.tsx` | Component-local policy/run/artifact state and direct API calls inside the Inspector | Content Scope Policy, Content Run, Content Artifact, Managed AI/provider policy | Full policy, run, preview, rebuild, delete, purge, and provider workflow inside the narrow Inspector; local state as persistent truth |
| Settings | `src/views/settings/SettingsView.tsx` | One monolithic component with local state, existing settings/watcher/provider stores, and direct API calls | Existing saved Settings, Provider Registry, watcher/managed-root health, and diagnostics contracts, projected through focused sections | Monolithic section switcher; normal settings led by IDs/raw enums; Request Trace in the normal AI setup flow |
| Onboarding | `src/components/OnboardingDialog.tsx` | Settings context, default scan folders, AI settings/provider presets, local completion marker | Existing settings and explicit AI/provider consent boundaries | Local completion marker as product state; cloud choice treated as implicit authorization; modal not usable at narrow sizes |

The final surface has one authority per workspace. A compatibility adapter may remain while a stage migrates a page, but it must be explicitly marked as transitional and must not become a second durable source.

## 2. Page-by-page audit

### 2.1 Overview

- Current page: `ScannerView` mounted for the `scanner` view; it is the user-facing Overview entry even though the internal component name is Scanner.
- User task: understand what needs attention, inspect managed coverage, start or resume safe work, and reach Cleanup/Organize/History without hunting through technical panels.
- Current state source: `useFileLibraryStore` stats and scope; `useScanManagerStore`; `useBackgroundIndexerStore`; `useOperationQueueStore`; `useStorageCleanupStore.analysis`; `overviewModel` priority selection.
- Final authority: backend-derived Global Index/source health, watcher/managed-root health, Organization Plan summaries, Analysis Run/Finding summaries, Content Run status, operation/restore ledgers, and existing scan state.
- Legacy store or compatibility layer: `useFileLibraryStore` statistics and scan scope can remain as compatibility reads until the Overview projection is connected to the authoritative backend summaries. `indexNeedsUpdate: false` is a placeholder, not an authority.
- Old path to exit: remove cleanup counts derived from the loaded `StorageAnalysis`, the hardcoded index health, and any “complete” total derived from a paged or local list.
- Duplicate state: cleanup analysis is present in both the durable hydration path and legacy `analysis`; activity/task panels can also repeat operation state.
- Hardcoded copy: `overviewModel` and `ScannerView` contain state labels/descriptions that must remain behind shared i18n; the page currently mixes task language with technical scan terms.
- Duplicate titles: `ScannerView` owns its own `PageHeader` while AppShell intentionally omits the shell heading for `scanner`; this is a special case to normalize in PR10 without creating a second title.
- Engineering terms leak: scan/index/update terminology and raw task details are exposed where the user needs an outcome and next action.
- Responsive and accessibility risks: summary cards/task panels compete at 980x680; priority/task regions need predictable keyboard order and announcements for partial/failed scans.
- Future PR: PR10, with integration gates in PR11.

### 2.2 Global Search and Search Window

- Current page: command/search modal in `CommandModal`; native/standalone search mode uses the same query surface and command registry.
- User task: find a command or managed/global metadata result, understand source-health limitations, and activate a result safely.
- Current state source: `tauriApi.searchGlobalEntries`, the Global Index response, command catalog, committed/display query state, IME composition state, and Search Window snapshot state.
- Final authority: Global Index backend ordering and source-health result; command registry for commands; Search Window session/snapshot for standalone activation.
- Legacy store or compatibility layer: none should become a second search index. Main-window navigation callbacks remain a shell compatibility boundary.
- Old path to exit: any client-side sorting/filtering that changes backend file order, query preprocessing that strips punctuation, and activation that passes renderer paths or grants Search Window Rule/file mutation permissions.
- Duplicate state: `query`/`committedQuery`/display state are interaction state, not result authorities; commands and files are separate result groups and must not be merged into a new ranking.
- Hardcoded copy: command labels and status messages have existing i18n keys, but `commandRegistry` and `AppShell` still use legacy `organizeSuggestions` naming that must be translated to “Organize Files” at the user boundary.
- Duplicate titles: the global search overlay has its own search label while the shell titlebar remains visible; this is intentional overlay chrome, not a page title.
- Engineering terms leak: `no_source`, source revisions, IDs, and result states must be translated into user outcomes outside technical detail.
- Responsive and accessibility risks: mounted-only `aria-activedescendant`, focus restoration, Escape hierarchy, IME navigation blocking, and native Search Window lifecycle must remain intact at narrow widths.
- Future PR: PR2, with mandatory regression tests retained in PR11.

### 2.3 File Library

- Current page: `VaultView` with `FileLibraryInspector`.
- User task: browse managed files, search within the managed library, filter/sort, select across pages, inspect metadata, and start an approved Organize or Content Understanding flow.
- Current state source: Query V2 stores already drive rendered result rows and selection/inspector state; legacy `useFileLibraryStore` still supplies persisted scope and stats compatibility values.
- Final authority: File Library Query V2, exact/deferred backend counts, `LibrarySelectionV1`, saved views/tags, duplicate summaries, and Content Policy/Run/Artifact status.
- Legacy store or compatibility layer: `useFileLibraryStore` is limited to scope/statistics compatibility during migration; its legacy list, first-page data, and `organizeQueue` must not be query or selection authority.
- Old path to exit: `loadFirstPage`/legacy list as the rendered query source, file-row totals presented as complete totals, and full Content Understanding management in the Inspector.
- Duplicate state: `appStore.searchQuery` and Query V2 query state coexist; selection can be represented in Query V2 and older library fields; Content status has component-local state.
- Hardcoded copy: Inspector contains bilingual conditional strings and technical metadata labels; new copy belongs in shared i18n.
- Duplicate titles: AppShell supplies the File Library page title; `VaultView` has internal toolbar/section labels that must not repeat the page title.
- Engineering terms leak: fingerprints, lifecycle/risk values, IDs, and query/snapshot terms need disclosure or task language.
- Responsive and accessibility risks: Inspector width versus list width, all-matching selection announcements, snapshot expiry recovery, keyboard row navigation, and 980x680 pane transitions.
- Future PR: PR3, with Content Understanding extraction in PR9.

### 2.4 Organize Files

- Current page: `OrganizeSuggestionsView` through `HubView`.
- User task: review organization groups, decide what is safe to apply, understand blocked items, preview the exact operation, and execute only after confirmation.
- Current state source: `useOrganizationPlanStore` is the intended durable source, but the view currently renders and derives decisions from the loaded `items` page.
- Final authority: Organization Plan ledger, backend group summaries, plan/item revision checks, item-level dry-run facts, Operation Preview, and Operation Journal.
- Legacy store or compatibility layer: `useOrganizeDecisionStore` remains in older operation wiring and must be retired from the visible flow; no second decision ledger may be introduced.
- Old path to exit: `selectedItems`/`safeItems` calculations over loaded rows, local group counts, direct item actions as the primary review model, and renderer execution paths.
- Duplicate state: loaded plan items, local virtual-list selection, and legacy decision store can represent overlapping decisions; backend plan revision is the only decision freshness authority.
- Hardcoded copy: the view includes raw English labels and technical terms such as `Dry Run`, `Revision`, `materialized`, `proposalKind`, and `reviewState`.
- Duplicate titles: AppShell owns a shell heading while the view renders an `AI Organization Preview` heading; PR5 must leave one user-facing “Organize Files” title.
- Engineering terms leak: plan IDs, revisions, status enum values, batch limits, and materialization vocabulary appear in normal review UI.
- Responsive and accessibility risks: the current item-first layout is dense, group/section keyboard navigation is missing, and the decision summary must stay usable at 980x680.
- Future PR: PR4 adds backend group projections; PR5 migrates the workspace.

### 2.5 Storage Cleanup

- Current page: `StorageCleanupView` with `useStorageCleanupStore` and `DurableAnalysisPanel`.
- User task: choose a scope, analyze storage findings, review risk, move only explicitly selected safe findings to Safe Trash, and recover through History.
- Current state source: the store hydrates durable Analysis Runs but continues projecting `StorageAnalysis`/candidate pages, legacy scan status, selected IDs, and multiple AI controls into the same visible surface.
- Final authority: Analysis Run/Finding/Evidence/Decision ledger, backend totals, finding revisions, Safe Trash and cleanup journal, and restore identity revalidation.
- Legacy store or compatibility layer: legacy scan/candidate API may remain as a bounded adapter during PR6, but `StorageAnalysis` must not be the permanent page authority.
- Old path to exit: multiple AI buttons, page-loaded candidate totals, duplicated analysis panels, and direct cleanup state separate from durable run state.
- Duplicate state: `analysis` and durable `AnalysisRun` coexist; selected candidate IDs and finding decisions coexist; AI status is separate from the durable run lifecycle.
- Hardcoded copy: footer and selection warnings contain hardcoded Chinese strings; all visible cleanup copy must use shared i18n and distinguish safe/review/caution/denied outcomes.
- Duplicate titles: AppShell adds the workspace heading; internal panels also present analysis titles, which should become a single lifecycle surface with one primary action per state.
- Engineering terms leak: `jobId`, finding IDs/revisions, enum names, and raw candidate/risk states need task language or technical disclosure.
- Responsive and accessibility risks: long filter/list/panel layout, Safe Trash confirmation focus, caution non-preselection, progress announcements, and 980x680 review usability.
- Future PR: PR6, with execution/restore return paths completed in PR7.

### 2.6 Preview and Execute

- Current page: `TimelineView`, mounted for the preview view.
- User task: understand the proposed operation, inspect important safety exceptions, confirm, observe progress, and recover from a stale/revalidated plan.
- Current state source: `useOperationQueueStore` preview projections, execution intent, selection, progress, logs, and backend preview APIs.
- Final authority: server-authoritative Operation Preview, revalidation, operation journal, and execution progress.
- Legacy store or compatibility layer: operation queue is the renderer projection of the existing backend contract; it must not be replaced with a page-local preview computation.
- Old path to exit: displaying technical safety statistics as the dominant action surface and reconstructing previews from library rows.
- Duplicate state: preview totals, selected counts, and operation logs are projected in multiple components; they should converge on one compact summary plus disclosure.
- Hardcoded copy: source-specific headings and technical outcome labels need i18n/task language.
- Duplicate titles: AppShell supplies the preview title while `TimelineView` includes a “Suggested Plan” heading; the latter should be a section heading, not a second page title.
- Engineering terms leak: operation IDs, journal cursors, raw platform errors, and revalidation details belong in a disclosure.
- Responsive and accessibility risks: long lists, progress replacement of the primary action, focus after revalidation, and keyboard access to detail disclosure.
- Future PR: PR7.

### 2.7 History and Restore

- Current page: `RestoreView`, mounted as History.
- User task: understand what changed, restore a recoverable item, inspect attention/manual-review cases, and reach Cleanup results.
- Current state source: operation logs from `useOperationQueueStore`, cleanup batches/preview records, local filter state, and direct cleanup APIs.
- Final authority: operation/cleanup ledgers, Safe Trash entries, restore identity revalidation, and manual-review status.
- Legacy store or compatibility layer: the queue store and cleanup API projections may remain as adapters, but History needs one ledger-oriented view model.
- Old path to exit: mixing separate operation and cleanup histories without a common user outcome, and exposing raw paths/IDs in the default summary.
- Duplicate state: operation log and cleanup batch state both carry lifecycle/outcome information; filter selection is local and should not become persistence authority.
- Hardcoded copy: history/restore labels and error fallbacks need shared i18n; raw status values should not lead normal copy.
- Duplicate titles: AppShell provides History while `RestoreView` renders a `historyWorkspaceTitle` heading and description.
- Engineering terms leak: journal IDs, cursor/state values, source paths, and identity flags need progressive disclosure.
- Responsive and accessibility risks: inspector/list split, focus after restore, manual-review status announcements, and high-contrast status visibility.
- Future PR: PR7.

### 2.8 Automation and Rule Proposal

- Current page: `RulesView` plus `RuleProposalWorkspace`.
- User task: browse rules, create a rule manually or from a natural-language proposal, review the proposal, then separately Apply, Enable, or Run it under the existing confirmation boundary.
- Current state source: Rule Repository V2 projection, `useRulesStore`, and durable `useRuleProposalStore`.
- Final authority: Rule Repository V2/catalog revision for rules; Rule Proposal ledger for proposals.
- Legacy store or compatibility layer: existing rule persistence/context adapters can remain only as projections; old mutation commands are forbidden.
- Old path to exit: proposal workspace and four-metric dashboard permanently dominating the Rule Library, local bilingual copy dictionary, and any mutation path outside Repository V2.
- Duplicate state: rules and proposals are separate durable concepts but the current layout presents both as one dashboard; proposal Apply, Enable, and Run must remain separate actions.
- Hardcoded copy: `RuleProposalWorkspace` defines a component-local `copy` dictionary; this must be moved to `src/i18n.ts`.
- Duplicate titles: AppShell title plus the `Automation` heading in RulesView; PR8 should retain one page title and use section headings for the library/proposal sheet.
- Engineering terms leak: proposal kinds, schema/status values, catalog revisions, and technical validation details need disclosures.
- Responsive and accessibility risks: proposal review focus, disabled Apply explanation, keyboard rule actions, and narrow library/proposal layout.
- Future PR: PR8.

### 2.9 Content Understanding

- Current page: currently embedded in `FileLibraryInspector.tsx`; the target is a dedicated sheet/dialog/task surface entered from the Inspector.
- User task: understand whether a managed scope is eligible, consent to local or cloud processing, preview bounded extraction, inspect runs/artifacts, and delete/purge derived artifacts without changing source files.
- Current state source: local component state, direct `tauriApi` calls, Content Policy/Run/Artifact API projections, and provider settings.
- Final authority: Content Scope Policy, Content Run, Content Artifact, Managed AI queue/provider policy, and content deletion/purge contracts.
- Legacy store or compatibility layer: Inspector status projection can remain concise; full workflow state must move to the dedicated surface.
- Old path to exit: policy editing, full preview, run/rebuild/delete/purge, content search, and provider controls inside the narrow Inspector; local state used as persistent truth.
- Duplicate state: Inspector-local policy/run/artifact state can diverge from durable content records; provider settings and content task state are also mixed.
- Hardcoded copy: many `language === "zh" ? ... : ...` branches exist in the Inspector; shared i18n is required.
- Duplicate titles: Inspector status and full content panel compete within a narrow surface; the dedicated sheet should own its task title while the Inspector keeps one concise entry action.
- Engineering terms leak: provider IDs, run IDs, artifact lifecycle, extraction limits, and raw errors need task language/disclosure.
- Responsive and accessibility risks: nested workflows in a narrow Inspector, consent/focus trap, cloud confirmation, streaming/loading announcements, and reduced motion.
- Future PR: PR9.

### 2.10 Settings

- Current page: `SettingsView`, a monolithic section switcher.
- User task: configure appearance, scan/index scope, automation, AI/provider behavior, privacy, and diagnostics without needing backend vocabulary.
- Current state source: local section state; settings context; direct AI/provider APIs; watcher roots/status; localStorage developer mode; diagnostic/request trace data.
- Final authority: saved Settings CAS contract, Provider Registry and AI settings, managed-root/watcher state, and existing developer diagnostics.
- Legacy store or compatibility layer: existing settings context and provider stores are valid adapters; section-local state should be limited to form interaction rather than a second persistence layer.
- Old path to exit: one large component, technical details in normal settings, and Request Trace presented as part of the normal AI setup.
- Duplicate state: watcher roots/status are represented by both settings local state and watcher stores; AI provider/model settings and debug traces are co-located with user-facing setup.
- Hardcoded copy: helper labels and fallback errors must go through shared i18n; the section split must not introduce local dictionaries.
- Duplicate titles: AppShell supplies Settings while the component renders section headings; section headings are acceptable only when they do not repeat the page title.
- Engineering terms leak: provider IDs, request trace fields, revisions, raw watcher enums, and filesystem paths need Advanced/Developer disclosures.
- Responsive and accessibility risks: long section navigation, form focus/validation, high-contrast switches, 980x680 section layout, and keyboard navigation between settings sections.
- Future PR: PR10.

### 2.11 Onboarding

- Current page: `OnboardingDialog`, a three-step modal: privacy/local-first, managed scope, and AI mode.
- User task: understand local-first safety, select a managed folder, and explicitly choose disabled/local/cloud understanding before entering Overview.
- Current state source: settings context, default scan-folder settings, AI settings/provider presets, and a local completion marker.
- Final authority: saved settings and explicit AI/provider consent; the local completion marker only controls whether the introductory dialog is shown.
- Legacy store or compatibility layer: `localStorage` completion is a UI convenience, not a replacement for settings or consent records.
- Old path to exit: treating “cloud” as a simple mode toggle without the existing explicit confirmation boundary; no raw error text should be presented as the main recovery action.
- Duplicate state: selected AI mode is local draft state until save; scan count is derived from settings and must not be presented as an index completeness total.
- Hardcoded copy: the component uses shared i18n for normal copy; error strings from a failed folder picker must be normalized before user display.
- Duplicate titles: the modal has its own dialog title as required; it must not add another workspace title beneath it.
- Engineering terms leak: provider kind and preset IDs stay internal; the UI should describe local/cloud outcomes.
- Responsive and accessibility risks: modal scroll/focus trap, Escape dismissal, step announcements, disabled finish state, and narrow-height overflow.
- Future PR: PR10 integration; PR11 visual/accessibility verification.

## 3. Mandatory V4.3.1 protections to preserve

### Global Search

- Backend file-result order is authoritative and stable; the renderer may separate Commands and Files but must not re-rank file results.
- Punctuation remains literal for `.gitignore`, `.env`, `C++`, `report!`, `[name]`, `file*`, and `what?`.
- IME composition owns query input; no query or navigation/activation happens during composition; one final query is issued after `compositionend`.
- `no_source` remains distinct from ordinary empty.
- Search Window activation remains ID-only and keeps its permission boundary.

### Watcher and managed-root health

Permission required, reconciliation required, partial coverage, and retry exhausted remain separate user states. Retry-exhausted copy must not be reused for reconciliation-required state.

### Automation

Rule Repository V2 is the only Rule mutation authority. `save_user_rule`, `delete_user_rule`, and `get_user_rules` must not be restored. Search Window must not receive Rule mutation permission.

### Safety and persistence

Keep Schema 34 as the accepted baseline. Do not add Schema 35. Preserve Preview, Operation Journal, Safe Trash, History, Restore, content consent, and the advisory-only AI boundary. Organize never deletes or trashes files.

### CI governance

The existing workflow contract remains authoritative: frontend/format checks, Windows and macOS Rust quality, Clippy, Windows and macOS release compile, and full-validation selection for high-risk paths, missing diff bases, explicit labels, schedules, or manual runs. Do not weaken thresholds or classify production changes as docs-only.

## 4. Stage ownership map

| Stage | Primary migration | Required evidence |
| --- | --- | --- |
| PR0 | This audit and authority map | Map, baseline proof, existing contract-test inventory, no production UI redesign |
| PR1 | Tokens, density, shared primitives, page/frame rules | Token/primitives tests, no ad hoc replacement of shared controls |
| PR2 | Shell, navigation, Global Search semantics | Navigation/search/IME/order/no-source/permission tests |
| PR3 | File Library Query V2 workspace | Query/selection/inspector/saved-view tests, no paged-data fiction |
| PR4 | Backend-derived Organization Plan group projections | Projection contract tests, revision conflict tests, no schema 35 |
| PR5 | Group-first Organize Files review | Group/decision/stale/blocked/preview tests and keyboard flow |
| PR6 | Durable Storage Cleanup lifecycle | Restart/hydration/decision/Safe Trash tests and one AI action |
| PR7 | Preview, History, Restore clarity | Preview revalidation, ledger projection, restore identity tests |
| PR8 | Rule Library and Rule Proposal flow | Repository/proposal/Apply-Enable-Run/permission tests |
| PR9 | Dedicated Content Understanding surface | Consent, local/cloud, bounded artifact, source-preservation tests |
| PR10 | Overview, Settings, onboarding integration | Section routing, watcher copy, navigation, responsive contract tests |
| PR11 | Global QA and release gate | Visual matrix, full gates, CI evidence, final QA artifact |

## 5. PR0 conclusion

No production-code authority was changed by this audit. The next stage may implement shared foundations only after this map is committed and the worktree is clean. Every later stage must update this map or its linked closeout when an authority/legacy decision changes.
