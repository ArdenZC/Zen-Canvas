# Zen Canvas Agent Instructions

## 1. Active product stage

Zen Canvas is a local-first desktop file-governance application built with React, TypeScript, Zustand, Tailwind CSS and Tauri/Rust.

The active UI/UX program is:

> UI/UX V4.3 — Product Integration & Clarity

V4.3 is not a new feature-expansion program. It integrates the product capabilities already present on the accepted Architecture Remediation V1 baseline into a coherent, truthful and calm user experience.

Authoritative V4.3 documents:

- `docs/design/UI_UX_V4_3_SPEC.md`
- `docs/design/UI_UX_V4_3_PRODUCT_FLOW.md`
- `docs/design/UI_UX_V4_3_EXECUTION.md`

Read all three before changing App Shell, Overview, Global Search, File Library, Organize, Storage Cleanup, Preview, History, Automation, Content Understanding, Settings or Onboarding.

When the documents appear to conflict:

1. product ownership and user-flow decisions come from `UI_UX_V4_3_PRODUCT_FLOW.md`;
2. visual and component rules come from `UI_UX_V4_3_SPEC.md`;
3. sequencing, allowed scope and acceptance gates come from `UI_UX_V4_3_EXECUTION.md`;
4. current backend safety and authority remain defined by production code and the accepted `docs/remediation/` contracts.

Do not treat older V4.2 documents as active implementation authority.

## 2. Baseline verification

The V4.3 documents were authored against the accepted `master` baseline at:

```text
9ea69d29143b994c8632747ab647f59637dfe324
```

That baseline includes Architecture Remediation V1 through Task 08, Post-V1 verification maintenance, and Schema 34.

Accepted verification fix:

```text
98ca8185979feb5b0f450a076362c089675416b5
```

The implementation branch must preserve the behaviors listed in the V4.3.1 addendum below.

Before implementation:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git merge-base --is-ancestor 9ea69d29143b994c8632747ab647f59637dfe324 HEAD
```

The implementation branch must include that baseline or a later reviewed `master`.

If the working tree contains unrelated changes:

- do not reset them;
- do not stage them with `git add -A`, `git add .` or `git add --all`;
- do not overwrite or silently absorb them;
- report the exact files and stop unless the user has explicitly assigned them to the current task.

## 2A. V4.3.1 verification protections

The active baseline is:

```text
master@9ea69d29143b994c8632747ab647f59637dfe324
```

The following accepted behaviors are non-negotiable:

### Global Search

- backend ordering within file results is authoritative and stable;
- the renderer may separate Commands and Files, but must not re-rank file results;
- punctuation-bearing queries keep literal meaning;
- do not strip punctuation from `.gitignore`, `.env`, `C++`, `report!`, `[name]`, `file*` or `what?`;
- preserve IME composition ownership;
- do not query during active composition;
- composition navigation keys must not activate or move results;
- one final query is issued after `compositionend`;
- `no_source` is distinct from ordinary `empty`;
- Search Window keeps ID-only activation and its current permission boundary.

### Watcher and managed-root health

Keep these user states distinct:

- permission required;
- reconciliation required;
- partial coverage;
- retry exhausted.

Do not reuse retry-exhausted copy for reconciliation-required state.

### Automation

Rule Repository V2 is the only Rule mutation authority.

Do not restore, call or recreate:

- `save_user_rule`;
- `delete_user_rule`;
- `get_user_rules`.

Global Search may navigate to Automation, but Search Window must not receive Rule mutation permission.

### CI governance

Use the current workflow contract.

For production-code changes, expect:

- frontend/format checks;
- Windows Rust quality;
- macOS Rust quality;
- Clippy;
- Windows release compile;
- macOS release compile.

Full validation additionally covers configured packaging and the full performance profile, including NSIS, unsigned DMG and 1M-scale checks.

High-risk paths, missing diff bases, push/schedule/manual full validation and the `full-validation` label may select the full path.

Do not weaken thresholds, add PR-number exceptions or classify production changes as docs-only.

## 3. Existing product authorities

V4.3 must preserve the current authority boundaries.

| Product area | Authoritative source |
| --- | --- |
| system-wide search | Global Index and Global Search repository |
| managed file browsing | File Library Query V2 |
| cross-page selection | `LibrarySelectionV1` and backend selection resolution |
| duplicate truth | durable Dedupe run/group/member data |
| storage analysis | durable Analysis Run/Finding/Evidence/Decision |
| organization review | durable Organization Plan and Plan Item ledger |
| filesystem execution | server-authoritative Operation Preview and operation journal |
| cleanup execution | Safe Trash and cleanup journal |
| restore | operation/cleanup ledgers and identity revalidation |
| automation rules | Rule Repository V2 and catalog revision |
| natural-language drafts | durable Rule Proposal |
| content understanding | Content Scope Policy, Content Run and Content Artifact |
| managed AI | existing Managed AI queue and provider policy |
| AI configuration | Provider Registry, capability metadata and saved AI settings |
| diagnostics | AI Request Trace and existing developer diagnostics |

The renderer may project these authorities into user-friendly views. It must not replace them with a second frontend authority.

## 4. Non-negotiable architecture boundaries

Do not:

- create a second Global Index;
- join Content Artifact into Global Search;
- turn File Library Search into system-wide search;
- create a second Managed AI queue;
- create a generic Job Runtime;
- create a universal reconciliation framework;
- migrate `files.id`;
- create Rule AST V2;
- add script, SQL, JavaScript, shell or arbitrary regular-expression execution;
- add OCR, image VLM, RAG, vector database, Agent, MCP or tool runtime;
- make Rule Proposal, Analysis Finding or Content Artifact a filesystem mutation authority;
- bypass Operation Preview, Safe Trash, journals or restore;
- add schema 35 without a separately approved architecture task;
- change persistence or public API contracts merely to simplify page layout.

## 5. UI truth rules

### 5.1 No paged-data fiction

Never derive authoritative total groups, totals or decisions from only the currently loaded page.

Examples of invalid behavior:

- grouping 100 loaded Organization Plan items and presenting them as the complete 10,000-item plan;
- calculating File Library selection totals from rendered rows;
- treating loaded cleanup candidates as the complete Analysis Run;
- counting Rule Proposal impact from a bounded sample.

When a user-facing total or group is authoritative, obtain it from the backend ledger or a backend projection.

### 5.2 One authority per workspace

After a V4.3 workspace is migrated, it must not keep two permanent production state paths.

Examples:

- Cleanup must not render from both legacy `StorageAnalysis` state and durable Analysis Finding state;
- Organize must not create a parallel in-memory decision store beside Organization Plan;
- File Library must not use the legacy list as query authority beside Query V2;
- Automation must not use renderer rule arrays as execution authority;
- Content Understanding must not use component-local state as persistent run truth.

Compatibility adapters may exist temporarily within one PR, but the final migrated surface must have one documented authority.

### 5.3 Internal facts versus user language

Internal facts may remain available in developer or technical-detail surfaces, but normal screens must not lead with:

- revision numbers;
- fingerprints;
- provider-owner IDs;
- raw enum values;
- journal cursors;
- run/item IDs;
- SQLite terms;
- Tauri command names;
- Rust errors;
- raw platform error codes;
- schema version;
- materialization terminology.

Translate them into user outcomes and next actions.

## 6. Navigation and product naming

The main navigation is:

- Overview;
- File Library;
- Organize Files;
- Storage Cleanup;
- History.

Advanced:

- Automation;
- Settings.

Use “Organize Files”, not “Organize Suggestions”, as the user-facing workspace name.

Storage Cleanup must be reachable from:

- the main sidebar;
- Overview;
- Global Search command results.

Global Search and File Library Search must remain visibly and semantically distinct.

## 7. Workspace-specific rules

### 7.1 Global Search

Preserve the existing Global Index query, ranking, IME handling, native-window lifecycle, snapshot consistency and ID-only activation.

Global Search may show:

- ordinary global metadata results;
- whether a result is already managed;
- source-health incompleteness;
- commands.

It must not show AI risk, classification or content-understanding facts for unmanaged results.

### 7.2 File Library

File Library is the managed workspace.

It may expose:

- Query V2 scope, filters and sort;
- Saved Views;
- user tags;
- cross-page selection;
- Inspector;
- duplicate summaries;
- content-understanding status;
- actions that create Organization Plans or approved analysis flows.

Do not overload the narrow Inspector with full Content Run management, long histories or policy editing. Use a dedicated Sheet, Dialog or task workspace.

### 7.3 Organize

The UI authority is the durable Organization Plan.

The default review model is:

- Plan;
- Needs My Decision;
- Cannot Be Processed Yet.

Any complete group count or group-level decision must be backend-derived.

Do not create a second Organize ledger, a second execution path or a second recovery system.

A group-level approval must still resolve to item-level authoritative dry-run facts before execution.

Organize must not delete or trash files.

### 7.4 Storage Cleanup

The final UI authority is the durable Analysis Run/Finding model.

The flow is:

1. choose scope;
2. scan/analyze;
3. review findings;
4. confirm and move selected items to Safe Trash;
5. show result and recovery entry.

Do not expose two competing AI analysis controls.

Caution items are never preselected.

### 7.5 Preview and execution

Keep server-authoritative preview and revalidation.

Default UI shows only the decision-level summary. Detailed safety statistics belong in a disclosure.

Execution progress replaces the primary execution action.

### 7.6 Automation

Default workspace is the Rule Library.

“Create rule” opens a choice between:

- describe with natural language;
- build manually.

Natural-language Rule Proposal is a review flow, not a permanently expanded dashboard above the rule list.

Apply, Enable and Run remain separate actions.

### 7.7 Content Understanding

Content understanding is consent-bound and managed-only.

The File Library Inspector shows a concise status and an entry action.

Full preview, policy, extraction, provider understanding, run progress, rebuild, delete and recent-run controls belong in a dedicated surface.

Cloud understanding always requires the existing explicit confirmation boundary.

### 7.8 Settings

Settings is a system configuration area, not a single monolithic component.

Split it into focused section components.

Normal settings show task language. Advanced and Developer disclosures may show technical details.

Request Trace remains available but must not occupy the normal AI setup flow.

## 8. Design-system policy

Before adding a class or component, inspect:

1. `src/styles/tokens.css`;
2. `src/styles.css`;
3. `src/utils/tw.ts`;
4. `src/views/shared/ui.ts`;
5. existing setting primitives;
6. every current usage of the primitive being changed.

Do not create page-specific replacements for:

- Button;
- IconButton;
- Input;
- Select;
- Segmented Control;
- Switch;
- Badge;
- Notice;
- State Block;
- Metric Strip;
- Progress;
- Row;
- Inspector;
- Side Sheet;
- Dialog;
- Popover;
- Empty state.

Use semantic Zen Canvas tokens. No arbitrary palette classes or page-local hexadecimal colors.

Legacy aliases may remain only as a migration layer. New V4.3 code uses `--zc-*` tokens.

## 9. Density and page structure

Shared density:

```ts
type Density = "default" | "compact";
```

A normal workspace:

- receives its main title from the App Shell;
- does not repeat the same page title;
- has at most one visually dominant primary action per state;
- uses compact toolbars for secondary actions;
- uses disclosures for diagnostics and uncommon controls.

Avoid card-inside-card layouts unless the nested surface is a separate interactive object.

Normal list rows use a row radius, not panel radius.

Backdrop blur is limited to:

- titlebar;
- sidebar;
- Global Search;
- dialogs;
- sheets;
- popovers;
- context menus;
- floating action surfaces.

## 10. Copy and localization

All user-visible strings must use the shared i18n system.

Do not add component-local English/Chinese copy dictionaries.

Errors explain:

1. what happened;
2. whether existing results are still usable;
3. what the user can do next.

Prefer:

- “Some locations could not be searched” over `partial`;
- “This suggestion changed since it was created” over `stale`;
- “Zen Canvas needs permission to read this location” over a raw platform code;
- “Review 6 items” over `needs_review = 6`.

## 11. Interaction and accessibility

For every modified state, verify:

- keyboard-only operation;
- focus-visible;
- focus restoration;
- modal/sheet focus trap;
- Escape hierarchy;
- screen-reader names and states;
- mounted-only `aria-activedescendant`;
- color-independent status;
- Reduced Motion;
- high contrast;
- loading, partial, stale, failed and canceled announcements.

All principal flows must be usable without a mouse.

Do not claim accessibility compliance from static code inspection alone.

## 12. Responsive verification

Verify at least:

- 1440×900;
- 1280×800;
- 1180×720;
- 1024×700;
- 980×680.

Also verify:

- Windows 100%, 125%, 150% and 200% scaling when available;
- macOS Retina when available.

Do not hide critical actions merely to fit narrow windows.

Use responsive pane transitions instead of shrinking Inspectors below a usable width.

## 13. Testing

Use the repository scripts that exist on the implementation baseline.

Expected gates include:

```bash
npm run typecheck
npm test
npm run test:remediation
npm run test:performance
npm run build
npm run verify:rust
npm run verify:security
```

Run focused tests before full gates.

For V4.3 add coverage for:

Additional mandatory regression coverage:

- mounted `CommandModal` IME behavior;
- `no_source` versus ordinary empty;
- literal punctuation queries;
- stable backend Global Search order;
- watcher permission/reconciliation/partial/retry copy separation;
- absence of legacy Rule commands and permissions;
- CI fast/full path contract.


- navigation and Storage Cleanup entry points;
- no duplicate page titles;
- Global Search versus File Library Search semantics;
- backend-authoritative Organization Plan grouping;
- group decisions resolving under plan revision;
- partial/stale plan states;
- Cleanup durable-run hydration and restart;
- one Cleanup UI authority;
- Rule Proposal not permanently dominating Rule Library;
- Content Understanding dedicated-surface focus and consent;
- Settings section routing;
- Chinese and English string coverage;
- 980×680 layout contracts.

Do not claim a command passed unless it was run.

## 14. Visual verification

Code review is insufficient.

For each affected workspace, capture and inspect real rendered states.

At minimum:

- Light Chinese;
- Dark Chinese;
- Light English;
- Dark English;
- default and compact density where supported;
- normal and narrow window;
- empty, loading, normal, partial, error and success states.

If Tauri-native or platform-specific behavior is unavailable, record it as unverified.

## 15. Change procedure

For each V4.3 stage:

1. verify current baseline and clean scope;
2. inspect current code and authoritative backend contract;
3. write the current-state audit in the execution document;
4. identify which old UI path is being retired;
5. implement the smallest coherent migration;
6. update all affected callers;
7. add focused behavior and accessibility tests;
8. run focused tests;
9. inspect the rendered UI;
10. run applicable full gates;
11. inspect the final diff;
12. update the stage acceptance record;
13. commit only the intended paths.

Do not stop after changing CSS classes.

## 16. Final response format

Finish every implementation task with:

### Completed

### Authority and legacy paths

### Important product decisions

### Files changed

### Tests and commands run

### Visual verification

### Acceptance checklist

### Deferred or unverified

### Risks requiring human review

Never describe a stage as complete when its authority migration, visual verification, platform verification or tests remain incomplete.
