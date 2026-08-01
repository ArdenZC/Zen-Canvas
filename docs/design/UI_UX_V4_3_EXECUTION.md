# Zen Canvas UI/UX V4.3 Execution Plan

> Product Integration & Clarity
> Baseline snapshot: `master@9ea69d29143b994c8632747ab647f59637dfe324`

---

## 1. Program objective

Migrate Zen Canvas from feature-complete but fragmented workspaces to a coherent product interface without weakening any accepted architecture or safety boundary.

This plan supersedes V4.2 execution instructions.

The program is divided into logical PR stages. Each stage must be independently reviewable, testable and revertible.

---

## 2. Baseline facts

The accepted baseline includes:

- Schema 34;
- Global Index and native providers;
- Managed File Library Query V2;
- durable scan/watcher reconciliation;
- durable Dedupe;
- durable Analysis Run/Finding;
- Global Search native window and command surface;
- cross-page selection, tags and Saved Views;
- durable Organization Plan and Dry Run;
- Rule Repository V2 and Rule Proposal;
- Content Scope Policy, Content Run and Content Artifact;
- Operation Journal, Safe Trash and Restore;
- Provider Registry, model discovery and Request Trace;
- accepted Post-V1 verification fix `98ca8185979feb5b0f450a076362c089675416b5`;
- stable Global Search result ordering;
- literal punctuation search;
- mounted IME behavior;
- distinct `no_source`;
- watcher message separation;
- Rule Repository V2-only mutation;
- current CI fast/full validation governance.

V4.3 must integrate these capabilities. It must not rebuild them.

---

## 3. Branch and commit strategy

Recommended integration branch:

```text
codex/ui-v4-3-product-integration
```

Stages:

1. PR 0 — Authority and Legacy UI Map
2. PR 1 — Design Foundation V4.3
3. PR 2 — Shell, Navigation and Search Semantics
4. PR 3 — File Library V3
5. PR 4 — Organization Plan Group Projection
6. PR 5 — Organize Files V2
7. PR 6 — Storage Cleanup Durable UX
8. PR 7 — Preview, History and Restore
9. PR 8 — Automation and Rule Proposal UX
10. PR 9 — Content Understanding Surface
11. PR 10 — Settings and Overview Integration
12. PR 11 — Global QA and Release Gate

Recommended commits:

```text
ui-v4.3(pr0): map UI authorities and legacy paths
ui-v4.3(pr1): finalize product integration primitives
ui-v4.3(pr2): align shell navigation and search semantics
ui-v4.3(pr3): rebuild managed file library workspace
ui-v4.3(pr4): add authoritative organization group projection
ui-v4.3(pr5): implement group-first organize files workflow
ui-v4.3(pr6): migrate cleanup to durable analysis UX
ui-v4.3(pr7): simplify preview history and restore
ui-v4.3(pr8): separate rule library and proposal flow
ui-v4.3(pr9): move content understanding to dedicated surface
ui-v4.3(pr10): integrate settings and overview system state
ui-v4.3(pr11): complete global visual and release QA
```

Do not squash all stages into one local commit before review.

---

## 4. Global stop conditions

Stop only when:

- the baseline is missing accepted remediation capabilities;
- unrelated working-tree changes cannot be safely separated;
- the requested stage requires Schema 35;
- a backend public contract or persistence change is unavoidable and not authorized by the stage;
- a filesystem safety boundary would need to change;
- current production code contradicts the accepted remediation contract;
- a platform-specific behavior cannot be safely approximated and blocks correctness.

Do not stop merely because the task is large.

---

# PR 0 — Authority and Legacy UI Map

## Goal

Create a precise migration map before changing product behavior.

## Scope

Audit:

- `src/components/AppShell.tsx`
- `src/components/CommandModal.tsx`
- `src/views/scanner/ScannerView.tsx`
- `src/views/vault/VaultView.tsx`
- `src/views/organize/OrganizeSuggestionsView.tsx`
- `src/views/cleanup/StorageCleanupView.tsx`
- `src/views/timeline/TimelineView.tsx`
- `src/views/restore/RestoreView.tsx`
- `src/views/rules/RulesView.tsx`
- `src/views/rules/RuleProposalWorkspace.tsx`
- `src/views/settings/SettingsView.tsx`
- `src/views/vault/components/FileLibraryInspector.tsx`
- associated stores, types, APIs and tests.

## V4.3.1 mandatory baseline audit

PR 0 must record and protect:

- backend-authoritative Global Search file order;
- literal punctuation query semantics;
- mounted IME behavior;
- `no_source` versus ordinary empty;
- watcher permission/reconciliation/partial/retry distinctions;
- absence of legacy Rule command wrappers;
- Search Window Rule permission restrictions;
- current CI fast/full path contract.

Add non-invasive guards or contract tests where the repository does not already protect these facts.

---

## Deliverable

Create:

```text
docs/design/UI_UX_V4_3_AUTHORITY_MAP.md
```

For every workspace record:

- authoritative backend domain;
- current visible state source;
- legacy source;
- current duplicate state paths;
- user-facing raw/internal fields;
- hardcoded strings;
- duplicate page titles;
- responsive risks;
- accessibility risks;
- target V4.3 owner;
- removal or adapter plan.

## Production code

No production behavior changes unless needed to add non-invasive tests or observability.

## Tests

Add architecture guards that prevent:

- a new parallel Organize authority;
- File Library Search using Global Search APIs;
- Global Search joining Content;
- renderer-authoritative rule execution;
- component-local content copy dictionaries in new code.

## Acceptance

- every core workspace has one documented target authority;
- all legacy stores are classified as retained, adapter-only or retired;
- no Schema change;
- no visual redesign yet.

---

# PR 1 — Design Foundation V4.3

## Goal

Create the shared primitives required for later migrations.

## Scope

- semantic tokens;
- density;
- row radius;
- control sizes;
- Metric Strip;
- Durable Task Status;
- Side Sheet;
- Inspector layout;
- compact Notices;
- shared Search Field;
- shared Button sizes;
- responsive pane primitives;
- focus and Reduced Motion behavior.

## Files

Likely:

- `src/styles/tokens.css`
- `src/styles.css`
- `src/utils/tw.ts`
- `src/views/shared/ui.ts`
- settings primitives
- modal/sheet infrastructure
- primitive tests.

## Rules

- preserve existing Spotlight behavior;
- no page-specific redesign;
- migrate legacy aliases only where touched;
- no arbitrary colors/radii/heights;
- audit all primitive usages.

## Required tests

- Button variants/sizes;
- Side Sheet trap and focus restore;
- State Block announcements;
- compact/default density;
- High Contrast selected state;
- Reduced Motion;
- 980×680 sheet behavior.

## Acceptance

- later stages can use shared primitives without duplicating components;
- no major page has been partially restyled into inconsistency;
- all primitive tests pass.

---

# PR 2 — Shell, Navigation and Search Semantics

## Goal

Correct global information architecture.

## Required changes

### Navigation

Primary:

- Overview;
- File Library;
- Organize Files;
- Storage Cleanup;
- History.

Advanced:

- Automation;
- Settings.

### Naming

- user-facing “Organize Suggestions” becomes “Organize Files”;
- preserve internal symbols until safely renamed.

### Shell heading

- remove duplicate workspace titles;
- App Shell owns standard heading;
- workspace-specific internal section headings remain allowed.

### Global Search

- preserve current query controller, native lifecycle and backend ranking;
- preserve backend file-result order;
- visually distinguish managed/unmanaged result;
- add concise partial-source footer;
- add a distinct `no_source` state and Settings action;
- preserve literal punctuation queries;
- preserve mounted IME behavior;
- add Storage Cleanup commands;
- ensure command labels use i18n.

### Responsive

- remove fixed assumptions that cause horizontal overflow;
- verify sidebar and titlebar at 980×680.

## Tests

- navigation order;
- Cleanup visible;
- active label;
- no duplicate page title;
- Global Search/File Library placeholders differ;
- command opens Cleanup;
- focus return;
- standalone Search unaffected;
- mounted `CommandModal` IME test passes;
- `no_source` and empty are distinct;
- literal punctuation cases pass;
- backend result order remains stable;
- renderer does not re-sort file results.

## Acceptance

- Storage Cleanup is always discoverable;
- Search semantic distinction is explicit;
- no regression to IME, session/revision or ID-only actions.

---

# PR 3 — File Library V3

## Goal

Integrate Query V2, tags, Saved Views, duplicate status, cross-page selection and Content entry without overloading the main list.

## Required changes

### Toolbar

- one primary toolbar row;
- active filters form optional second row;
- Saved Views integrated into scope/query control;
- Search Field explicitly managed-library only;
- sort and density compact.

### Selection

- authoritative summary;
- explicit versus all-matching;
- deferred count state;
- invalidated all-matching state;
- sticky selection bar.

### Inspector

- concise metadata;
- common summary for multi-selection;
- Content Understanding entry only;
- duplicate entry only;
- Create Organization Plan action.

### Separate surfaces

- Tag/Saved View manager remains dedicated Dialog/Sheet;
- Duplicate group detail opens contextual review;
- Content controls removed from the narrow Inspector.

### i18n

Remove hardcoded labels such as:

- Created;
- Relevance;
- current component-local content copy.

## Authority

Query V2 remains the only query authority.

Legacy `useFileLibraryStore` may provide stats or compatibility during migration, but must not independently determine the rendered query result.

## Tests

- query call count;
- filter/sort;
- snapshot expired;
- all-matching invalidation;
- deferred count;
- selection summary;
- Inspector focus;
- open/close content entry;
- 100k selection contract unchanged;
- virtual ARIA mounted-only.

## Acceptance

- the normal list is not visually displaced by duplicate/content submodules;
- all counts remain truthful;
- no Global Search API is used.

---

# PR 4 — Organization Plan Group Projection

## Goal

Add the minimum backend projection required for truthful group-first Organize UI.

## Why separate

The current durable Plan may contain up to 10,000 items while the renderer loads pages. Complete grouping cannot be performed from loaded items.

## Preferred implementation

Add query-only backend projections over existing Plan tables.

Possible commands:

```text
query_organization_plan_groups
query_organization_plan_group_items
update_organization_plan_group_decision
```

Exact naming follows repository conventions.

## Contract requirements

Group summary includes:

- stable opaque group ID;
- Plan ID and expected Plan revision;
- group label;
- target;
- proposal kind;
- readiness class;
- item count;
- total bytes;
- accepted/excluded/stale/conflict counts;
- confidence/risk summary;
- bounded samples;
- cursor for group items.

Group mutation:

- accepts group ID, expected Plan revision and intended decision;
- resolves members server-side;
- enforces existing caps;
- reuses existing safe-batch and item revision validation;
- increments Plan revision authoritatively;
- returns updated Plan/group summary;
- fails closed on stale group membership.

## No schema rule

Prefer derived queries and opaque deterministic group keys.

Do not add Schema 35 without separate approval.

## Safety

- group include does not execute files;
- group include does not bypass per-item Dry Run;
- unsafe/blocked items are excluded from safe group approval;
- no target path becomes renderer authority.

## Tests

- complete group totals across more than one item page;
- deterministic grouping;
- group cursor;
- stale Plan revision;
- membership change;
- mixed-extension rename;
- unsafe extension;
- blocked exclusion;
- 10,000-item performance;
- no schema migration.

## Acceptance

- frontend can render a complete plan summary without loading all items;
- backend remains the authority;
- current Plan/Dry Run/Journal boundaries stay intact.

---

# PR 5 — Organize Files V2

## Goal

Replace the current raw per-file control surface with group-first, exception-first review.

## Layout

- compact Plan selector/status;
- segmented:
  - Plan;
  - Needs My Decision;
  - Cannot Be Processed Yet;
- group list;
- contextual Inspector or Sheet;
- sticky Review Execution action.

## Remove from default UI

- raw revision;
- materialized terminology;
- raw proposal kind;
- raw review enum;
- raw decision enum;
- permanent rows of Analyze/Refresh/Cancel/Dry Run buttons.

These actions become contextual.

## Decisions

Derive user-facing reason/action projections from existing Plan facts.

Do not create a new durable decision store.

## Partial and stale

- retain valid groups;
- surface changed groups;
- refresh only affected facts where supported;
- do not clear successful AI analysis.

## Tests

- Plan is default;
- complete group totals;
- user decision tab excludes blocked-only items;
- every decision item has meaningful actions;
- extension protection;
- group include/exclude;
- group destination change;
- item exception edit;
- continue later;
- Dry Run handoff;
- keyboard navigation;
- i18n.

## Acceptance

- user understands the plan without opening every file;
- primary task is reviewing exceptions;
- execution still requires authoritative Dry Run.

---

# PR 6 — Storage Cleanup Durable UX

## Goal

Use one visible durable Analysis Run/Finding lifecycle.

## Migration

Audit and retire the visible dual path between:

- legacy `StorageAnalysis`/candidate;
- durable Analysis Run/Finding.

A compatibility adapter may translate old command responses into the durable store during migration, but the page renders one state model.

## Flow

1. choose scope;
2. analyze;
3. review findings;
4. confirm Safe Trash;
5. result.

## Review

- Safe to Clean;
- Needs Confirmation;
- Caution.

One contextual AI action:

- Recheck items that need confirmation.

Advanced targeted modes may remain in a disclosure if required.

## Tests

- hydration after remount;
- restart recovery;
- partial detector failure;
- retry;
- cancellation confirmation;
- Caution not selected;
- Safe default selection;
- durable finding decisions;
- Safe Trash result;
- no second visible lifecycle.

## Acceptance

- reloading the page does not lose the active durable run;
- no contradictory scan/run status;
- user never sees two AI-analysis control groups.

---

# PR 7 — Preview, History and Restore

## Goal

Reduce safety-detail overload while preserving every backend check.

## Preview

- source-aware return;
- compact Metric Strip;
- safety disclosure;
- grouped operations;
- progress replaces action;
- partial result preserved.

## History

- default filters: All, Restorable, Needs Attention;
- compact rows;
- source workspace;
- technical details disclosed.

## Restore

- conflict projection;
- explicit confirmation;
- partial outcome;
- predictable focus.

## Tests

- Organize return;
- Cleanup return;
- compact summary;
- safety detail;
- blocked/unselected distinction;
- operation cancellation;
- restore conflict;
- result announcements.

## Acceptance

- normal user sees decision-relevant facts first;
- no safety fact is deleted, only progressively disclosed.

---

# PR 8 — Automation and Rule Proposal UX

## Goal

Make Rule Library the default and Rule Proposal a dedicated creation/review flow.

## Required changes

### Rule Library

- remove permanent Rule Proposal panel;
- remove four-card SaaS dashboard;
- compact status summary;
- list + Inspector;
- one Create Rule action.

### Create Rule

- choose natural language or manual;
- dedicated Proposal surface;
- return to Rule Library after Apply.

### Copy

Move component-local bilingual copy into shared i18n.

### Safety

Keep:

- Apply as disabled;
- Enable separate;
- Run separate;
- exact/deferred impact;
- catalog revision authority;
- backend execution;
- Rule Repository V2 is the only mutation surface;
- `save_user_rule`, `delete_user_rule` and `get_user_rules` remain absent;
- Search Window receives no Rule mutation permission.

## Tests

- default Rule Library;
- creation choice;
- proposal history;
- clarification;
- impact;
- Apply disabled;
- no auto-enable;
- no auto-run;
- manual edit provenance;
- focus return;
- i18n.

## Acceptance

- Automation no longer feels like two products stacked vertically;
- proposal remains fully reviewable.

---

# PR 9 — Content Understanding Surface

## Goal

Move the full Content workflow out of the narrow File Library Inspector.

## Surface

Create a dedicated Side Sheet or internal task pane.

Sections:

- status;
- folder policy;
- preview;
- run progress;
- result/artifact;
- recent runs;
- data management.

## Inspector

Retains only:

- concise content status;
- Open action.

## Copy

All text moves to shared i18n.

## Safety

Preserve:

- preview fingerprint;
- root/policy/library revisions;
- confirmed start;
- local/provider separation;
- no raw path/filename provider payload;
- delete content data only;
- unsupported OCR truth.

## Tests

- focus trap/restore;
- policy revision conflict;
- preview then confirm;
- local run;
- provider disclosure;
- cancel;
- remount refresh;
- rebuild;
- delete artifact;
- source file unchanged;
- unsupported format;
- narrow-window full-pane mode.

## Acceptance

- File Library Inspector is concise;
- Content workflow remains complete and safer to understand.

---

# PR 10 — Settings and Overview Integration

## Goal

Make system status understandable across the product.

## Settings

Split `SettingsView.tsx` into focused section components.

Suggested structure:

```text
src/views/settings/sections/
  GeneralSettingsSection.tsx
  AppearanceSettingsSection.tsx
  FileSourcesSettingsSection.tsx
  GlobalSearchSettingsSection.tsx
  ManagedLibrarySettingsSection.tsx
  AutomationSettingsSection.tsx
  AISettingsSection.tsx
  PrivacyContentSettingsSection.tsx
  DeveloperDiagnosticsSection.tsx
  AboutSettingsSection.tsx
```

Keep shared orchestration/store hooks where appropriate.

## Overview

Replace hardcoded or legacy-only health with actual projections from:

- Global Index;
- managed root/watcher;
- active Organization Plan;
- Analysis Run;
- Content Run;
- operation/restore.

## Priority

Implement deterministic priority selection and tests.

## Tests

- Settings section routing;
- Global Search command target;
- sticky Save;
- advanced/developer disclosure;
- Overview Global Index partial;
- Overview / Settings Global Index no source;
- watcher permission message;
- watcher reconciliation message;
- watcher partial message;
- watcher retry-exhausted message;
- permission task;
- active Plan;
- Cleanup finding;
- Content failure;
- no-action state;
- no duplicate page title.

## Acceptance

- Settings is maintainable and progressive;
- Overview reflects real product state.

---

# PR 11 — Global QA and Release Gate

## Goal

Validate the integrated product and fix only discovered V4.3 defects.

## No new design direction

PR 11 does not introduce a new workflow.

## Full repository gates

Run all applicable:

```bash
npm run typecheck
npm test
npm run test:remediation
npm run test:performance
npm run build
npm run verify:rust
npm run verify:security
git diff --check
```

Use the current CI contract accurately.

For production-code changes, expect:

- frontend/format;
- Windows Rust quality;
- macOS Rust quality;
- Clippy;
- Windows release compile;
- macOS release compile.

Full validation additionally includes configured packaging and full-scale performance checks, including NSIS, unsigned DMG and 1M-scale checks.

High-risk paths, missing diff bases, push/schedule/manual full validation and the `full-validation` label may select the full path.

Do not add PR-number exceptions, weaken thresholds or classify production changes as docs-only.

## Required V4.3.1 regression tests

Preserve and run the relevant existing tests for:

- mounted `CommandModal` IME behavior;
- Global Search literal punctuation;
- stable durable result ordering;
- `no_source` versus empty;
- watcher message separation;
- legacy Rule command and permission absence;
- CI fast/full path contract.

Do not replace behavior tests with snapshot-only assertions.

---

## Visual matrix

Pages:

- Overview;
- Global Search;
- File Library;
- Organize Files;
- Storage Cleanup;
- Preview;
- History;
- Automation;
- Content Understanding;
- Settings;
- Onboarding.

States:

- empty;
- loading;
- normal;
- partial;
- stale;
- permission;
- error;
- canceled;
- success;
- long content;
- large selection;
- narrow window.

Themes/languages:

- Light Chinese;
- Dark Chinese;
- Light English;
- Dark English.

Viewports:

- 1440×900;
- 1280×800;
- 1180×720;
- 1024×700;
- 980×680.

Platforms when available:

- Windows DPI 100/125/150/200;
- Windows High Contrast;
- Narrator;
- macOS Retina;
- VoiceOver;
- native Search window;
- window controls;
- drag regions.

## Required artifact

Create:

```text
docs/qa/UI_UX_V4_3_FINAL_QA.md
```

Include:

- stage completion;
- authority migrations;
- visual screenshots or references;
- command results;
- CI evidence;
- fast/full path classification;
- Windows/macOS release-compile evidence for production stages;
- full-validation evidence when high-risk paths are touched;
- known limitations;
- unverified native checks;
- release gate.

## Final hard gate

All items in `UI_UX_V4_3_SPEC.md` section 24 must be evaluated explicitly.

---

## 5. Stage update format

At the end of every stage update `UI_UX_V4_3_EXECUTION.md` or a stage closeout record with:

### Current baseline

### Authority migrated

### Legacy path retired

### Product changes

### Files changed

### Focused tests

### Full gates

### Visual verification

### Acceptance criteria

### Deferred or unverified

### Risks requiring human review

## 5A. PR0 closeout — authority and legacy map

### Current baseline

The implementation branch is `codex/ui-v4-3-product-integration` at baseline `9ea69d29143b994c8632747ab647f59637dfe324`. The accepted verification fix `98ca8185979feb5b0f450a076362c089675416b5` is present in history, and the baseline ancestor check passed.

The task-package documents supplied for V4.3.1 were found as untracked documentation only. They were classified as in-scope program documents; no unrelated source or test edits were found.

### Authority migrated

No production authority was migrated in PR0. `docs/design/UI_UX_V4_3_AUTHORITY_MAP.md` records the accepted final authorities and the current renderer/compatibility paths for Overview, Global Search/Search Window, File Library, Organize Files, Storage Cleanup, Preview, History/Restore, Automation/Rule Proposal, Content Understanding, Settings, and Onboarding.

### Legacy path retired

No runtime path was retired in PR0. The map explicitly marks the paths to retire in PR1–PR10, including paged-data grouping, the cleanup `StorageAnalysis` visible authority, the embedded Content Understanding workflow, the Rule Proposal dashboard/copy dictionary, and the monolithic Settings surface.

### Product changes

- Added the authority/legacy map required by the V4.3.1 brief.
- Preserved the supplied V4.3.1 task-package instructions and design authorities as in-scope documentation.
- Recorded the non-negotiable Global Search, watcher health, Rule Repository V2, safety, Schema 34, and CI protections.
- Added a stage ownership table so each later PR has one explicit migration target.

### Files changed

- `AGENTS.md`
- `CODEX_UI_UX_V4_3_1_START.md`
- `README_V4_3_1_PACKAGE.md`
- `docs/design/UI_UX_V4_3_SPEC.md`
- `docs/design/UI_UX_V4_3_PRODUCT_FLOW.md`
- `docs/design/UI_UX_V4_3_EXECUTION.md`
- `docs/design/UI_UX_V4_3_AUTHORITY_MAP.md`

### Focused tests

The existing baseline contract coverage was inspected before implementation. It already covers the accepted remediation and V4.3.1 protection areas in `tests/remediationContract.test.ts`, `tests/appArchitecture.test.ts`, `tests/ciFastPathContract.test.ts`, `tests/commandModalIme.test.tsx`, and `tests/watcherMessages.test.ts`. PR0 adds no production code and therefore adds no new runtime contract.

### Full gates

Not run in PR0 yet. The documentation-only PR0 gate is `npm run test:docs`; production stages must use the applicable frontend, Rust, security, performance, build, and platform CI gates defined above.

### Visual verification

Not applicable to the PR0 documentation-only change. The required V4.3.1 rendered-state matrix begins with the first production UI stage and is completed in PR11.

### Acceptance criteria

- Baseline and branch are recorded.
- All V4.3 workspace authorities and legacy paths are mapped.
- Duplicate state, hardcoded copy, duplicate-heading, engineering-term, responsive, and accessibility risks are recorded per page.
- Mandatory V4.3.1 protections are explicitly preserved.
- No production UI redesign or backend/schema change was made.

### Deferred or unverified

All rendered visual states, native Search Window behavior, Windows DPI, macOS Retina, screen-reader behavior, platform release compiles, and final CI evidence remain deferred to the relevant stage and PR11.

### Risks requiring human review

The first implementation stages must validate that compatibility adapters do not become permanent second authorities. In particular, File Library, Organize Files, and Storage Cleanup require backend projection/restart tests before their legacy paths can be removed.

## 5B. PR1 closeout — design foundation

### Current baseline

PR1 starts from committed PR0 `24ce93f` on `codex/ui-v4-3-product-integration`. No backend or persistence contract changed.

### Authority migrated

No workspace authority changed. The App Shell now exposes a shared UI density preference (`default` or `compact`) through the existing UI preference store; it does not represent file, plan, cleanup, or content truth.

### Legacy path retired

No page-specific legacy surface was removed. Shared class exports remain compatibility aliases where existing pages still depend on them, while the touched shared typography/row/state classes now use semantic `--zc-*` tokens.

### Product changes

- Added semantic row, density, pane, inspector, sheet, touch-target, and content-width tokens.
- Added shared `Button`, `SearchField`, `MetricStrip`, `DurableTaskStatus`, `Progress`, `SideSheet`, `InspectorLayout`, and `ResponsivePane` primitives.
- Added compact/default density projection and global data attributes.
- Extended Notice and State Block semantics with density metadata and live-region behavior.
- Preserved the existing modal stack for Side Sheet focus trapping, Escape handling, and focus restoration.

### Files changed

- `src/styles/tokens.css`
- `src/styles.css`
- `src/types/ui.ts`
- `src/store/useAppStore.ts`
- `src/components/AppShell.tsx`
- `src/utils/tw.ts`
- `src/views/shared/ui.ts`
- `tests/uiV43Foundation.test.tsx`
- `docs/design/UI_UX_V4_3_EXECUTION.md`

### Focused tests

- `npm run typecheck`
- `npm test -- tests/uiV43Foundation.test.tsx tests/uiPrimitives.test.tsx tests/designSystemV4.test.ts tests/modalInfrastructure.test.tsx`

### Full gates

Not run for PR1. Full frontend, Rust, security, performance, and platform release checks remain required for production-code stages and PR11.

### Visual verification

Static primitive markup and existing modal infrastructure tests passed. Rendered light/dark Chinese/English states, narrow 980x680 layout, high contrast, and native platform behavior are deferred to the affected workspace stages and PR11.

### Acceptance criteria

- Later stages can use shared controls without duplicating Button, Search Field, State Block, Metric Strip, Durable Task, Inspector, or Sheet components.
- All new foundation dimensions and surfaces use semantic `--zc-*` variables.
- Reduced-motion and modal focus infrastructure remain enabled.
- No page-specific redesign or backend authority change was introduced.

### Deferred or unverified

The new primitives are not yet adopted across every workspace. Visual verification of actual composed pages, screen readers, Windows DPI, macOS Retina, and native Search Window remains open.

### Risks requiring human review

The compact density preference is available but not yet exposed in Settings. Later stages must ensure it does not shrink critical hit targets or create a second page-local density setting.

## 5C. PR2 closeout — shell navigation and search semantics

### Current baseline

PR2 starts from committed PR1 `9aba8c6` on `codex/ui-v4-3-product-integration`. No backend, persistence, Tauri capability, or Search Window permission contract changed.

### Authority migrated

The shell now presents the accepted V4.3 primary navigation: Overview, File Library, Organize Files, Storage Cleanup, and History. Global Search continues to consume the Global Index response and command registry; backend file order remains the renderer display order.

### Legacy path retired

- The user-facing `organizeSuggestions` label is no longer used by the shell or idle Spotlight entry; the old translation key remains only as compatibility copy for older surfaces.
- Folder/file regrouping was removed from Spotlight display grouping so the renderer cannot reorder backend file results.
- During IME composition, live command matching and result activation are suppressed; the committed query remains the only query authority.

### Product changes

- Added Storage Cleanup to the main sidebar in the product-flow order.
- Added shared i18n keys for “Organize Files”, its command description, and window-control labels.
- Preserved literal punctuation by keeping command matching to case-folding and whitespace trimming only.
- Preserved `no_source` versus ordinary empty state copy, ID-only Search Window activation, and the existing permission boundary.
- Kept commands separate from the single ordered Files result group.

### Files changed

- `src/components/AppShell.tsx`
- `src/components/CommandModal.tsx`
- `src/components/spotlight/commandRegistry.ts`
- `src/components/spotlight/spotlightModel.ts`
- `src/i18n.ts`
- `tests/appArchitecture.test.ts`
- `tests/appShellV4.test.ts`
- `tests/appShellBehavior.test.ts`
- `tests/searchSpotlight.test.ts`
- `docs/design/UI_UX_V4_3_EXECUTION.md`

### Focused tests

- `npm run typecheck`
- `npm test -- tests/appArchitecture.test.ts tests/appShellV4.test.ts tests/appShellBehavior.test.ts tests/searchSpotlight.test.ts tests/commandModalIme.test.tsx tests/designSystemV4.test.ts`
- Result: 6 files passed, 69 tests passed.

### Full gates

Not run for PR2. The existing `tests/tauriCommandPermissions.test.ts` and remediation contracts remain unchanged and are included in the later full frontend/CI gates.

### Visual verification

The mounted IME test and static shell/search contracts passed. Light/dark Chinese/English rendered navigation, the native Search Window, narrow 980x680 layout, and platform DPI/Retina behavior remain unverified until visual QA.

### Acceptance criteria

- Storage Cleanup is reachable from the main sidebar and existing Overview/Search command paths.
- Organize is user-facing “Organize Files”.
- Commands and Files are visibly distinct while Global Search file order is preserved.
- Punctuation, IME, `no_source`, ID-only activation, and Search Window permissions remain protected.
- No rule mutation authority or backend contract was added.

### Deferred or unverified

App Shell still has workspace-specific title duplication that later page migrations must remove. Native focus restoration, platform window lifecycle, visual language/theme matrix, and screen-reader announcements remain open.

### Risks requiring human review

The command catalog retains the internal `suggestions` identifier for compatibility. Later stages must not expose that identifier in normal copy or create a second navigation route for Organize Files.

## 5D. PR3 closeout — managed File Library V3 workspace

### Current baseline

PR3 starts from committed PR2 `40a6a54` on `codex/ui-v4-3-product-integration`. The implementation keeps Schema 34 and the accepted File Library Query V2 backend/public contracts.

### Authority migrated

Visible File Library query text, filters, sort, exact/deferred count, loaded rows, cross-page selection, saved views, tags, and Inspector layout now use the Query V2 store family and `LibrarySelectionV1`. The legacy library store remains only for scope/statistics compatibility and is not used as the rendered query list or count authority.

### Legacy path retired

- File Library no longer reads the shared App Store search field; its Search Field owns a local draft and commits into Query V2.
- The old manual search markup and page-derived result-count text were replaced by shared Search Field and Metric Strip primitives.
- Folder/file-specific Spotlight grouping is not reused in File Library; the page never calls Global Search APIs.
- `loadStats` is no longer part of the Query V2 request cycle; legacy statistics remain a compatibility signal for the initial no-index state until Overview is migrated.

### Product changes

- Added a concise Query V2 toolbar with local File Library Search, filters, sort, saved views, tags, and truthful loaded/exact/deferred count language.
- Added backend scope-health task language without exposing raw health enum values.
- Reused shared `InspectorLayout`, keeping the narrow layout transition available without compressing the Inspector into the list.
- Preserved keyboard list navigation, range/additive selection, explicit all-matching selection, snapshot expiry behavior, Inspector detail/selection summary hydration, and content workflow entry points.
- Moved newly touched File Library copy into shared i18n for Chinese and English.

### Files changed

- `src/views/vault/VaultView.tsx`
- `src/i18n.ts`
- `tests/fileLibraryV4.test.tsx`
- `tests/fileLibraryTask06Handoff.test.tsx`
- `docs/design/UI_UX_V4_3_EXECUTION.md`

### Focused tests

- `npm run typecheck`
- `npm test -- tests/fileLibraryV2.test.ts tests/fileLibraryTask06Handoff.test.tsx tests/fileLibraryV4.test.tsx tests/uiPrimitives.test.tsx`
- Result: 4 files passed, 22 tests passed.

### Full gates

Not run for PR3. Query V2 store and accepted Task 05/06 backend contract tests remain required in the later full frontend and CI matrix.

### Visual verification

Static architecture and mounted Query V2 handoff tests passed. Actual rendered File Library states in light/dark Chinese/English, deferred count, scope-health, Inspector narrow pane, 980x680, high contrast, and screen-reader announcements remain unverified until workspace visual QA.

### Acceptance criteria

- File Library Search is visibly and semantically distinct from Global Search.
- Query V2 is the visible query/count/selection authority; no result total is derived from the loaded page.
- Cross-page selection remains backend-resolvable through `LibrarySelectionV1`.
- Saved Views, tags, Inspector and snapshot-expiry recovery remain available.
- No mutation, schema, or filesystem safety boundary changed.

### Deferred or unverified

The Inspector still contains the full Content Understanding workflow; PR9 must extract that workflow into a dedicated surface. Legacy scope/statistics adapters remain until Overview/Settings integration proves their replacement.

### Risks requiring human review

The current no-index gate still reads the legacy `lastScannedAt` compatibility statistic. It is not used for Query V2 results or totals, but PR10 must replace the dashboard-level interpretation with actual index/root health before final release.

## 5E. PR4 closeout — Organization Plan group projection

### Current baseline

PR4 starts from committed PR3 `d7680f2` on `codex/ui-v4-3-product-integration`. The implementation keeps Schema 34 and the existing durable Organization Plan, item revision, Operation Preview, Dry Run, and operation journal contracts.

### Authority migrated

Organization Plan groups are now a backend-derived projection over the complete `organization_plan_items` ledger. The renderer receives complete group totals, stable opaque group IDs, bounded samples, group-item cursors, and the authoritative Plan revision. No group table, renderer decision ledger, or page-local grouping authority was added.

### Legacy path retired

- The future group-first Organize surface no longer needs to group the bounded `items` page; the store hydrates the backend group projection separately from item paging.
- Group decisions resolve members server-side by opaque group ID and expected Plan revision. The renderer cannot submit target paths or a renderer-owned member list.
- Existing item-level decisions remain available for exceptions; no existing execution or recovery path was replaced.

### Product changes

- Added complete group summary, group-member keyset paging, and group decision commands without a schema migration.
- Group keys are deterministic projections of target directory, proposal kind, readiness class, and risk level; group IDs are opaque and plan-bound.
- Group summaries include item count, bytes, accepted/excluded/stale/conflict counts, confidence band, risk, and at most three samples.
- Group acceptance only selects members that pass the existing safe-batch checks; unsafe or blocked members remain available for exception review.
- Group decisions increment Plan revision and return the updated Plan plus the current group summary; stale revisions fail closed.
- Added matching main-window Tauri permissions and browser-mock behavior for the projection contract.

### Files changed

- `src-tauri/src/db/queries/organization.rs`
- `src-tauri/src/db/commands.rs`
- `src-tauri/src/main.rs`
- `src-tauri/build.rs`
- `src-tauri/capabilities/default.json`
- `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md`
- `src/types/domain.ts`
- `src/api/tauriApi.ts`
- `src/api/browserMockApi.ts`
- `src/store/useOrganizationPlanStore.ts`
- `tests/organizationPlanTask06.test.ts`
- `docs/design/UI_UX_V4_3_EXECUTION.md`

### Focused tests

- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml organization --lib` — 14 passed, 1 existing benchmark ignored.
- `cargo test --manifest-path src-tauri/Cargo.toml performance_task06_plan_100_1k_10k_repository --lib -- --ignored --test-threads=1` — 1 benchmark passed (100/1k/10k, including group projection).
- `npm run typecheck`
- `npm test -- tests/organizationPlanTask06.test.ts tests/tauriCommandPermissions.test.ts` — 2 files passed, 12 tests passed.
- `git diff --check`

### Full gates

Not run for PR4. Full frontend, Rust quality, security, performance, packaging, and platform release checks remain required for PR11. The existing 10k benchmark is extended to exercise group projection but remains intentionally ignored in normal focused runs.

### Visual verification

No rendered Organize Files group-first surface was claimed in PR4; PR5 owns that UI migration. Backend projection, stale revision, bounded sample, cursor, and browser-mock contracts are covered by focused tests. Light/dark Chinese/English, narrow 980x680, high contrast, screen reader behavior, Windows DPI, macOS Retina, and native window behavior remain unverified.

### Acceptance criteria

- Complete group totals are available without loading every item page in the renderer.
- Group ordering and group IDs are deterministic, and group members have a bounded keyset cursor.
- Group decisions are revision-bound, server-resolved, capped by the existing Plan ledger, and safe-batch revalidated.
- Group acceptance does not execute files or bypass item-level Dry Run, Preview, journals, or recovery.
- No Schema 35, second ledger, target-path authority, or filesystem mutation path was introduced.

### Deferred or unverified

PR5 must replace the current raw per-file Organize UI with the group-first, exception-first workspace and connect its controls to these projections. The current renderer still exposes item-page controls for compatibility until that migration.

### Risks requiring human review

Projection assembly currently reads the complete Plan item ledger into a bounded in-memory query projection (maximum 10,000 items) rather than persisting group state. The ignored 10k benchmark should be run on representative release hardware before accepting final performance evidence. Group labels still expose backend proposal-kind tokens for PR5 to translate through shared i18n.

## 5F. PR5 closeout — group-first, exception-first Organize Files workspace

### Current baseline

PR5 starts from committed PR4 `271e7ab` on `codex/ui-v4-3-product-integration`. The implementation keeps Schema 34, the durable Organization Plan, group projection cursors, Plan revision checks, item-level decisions, Operation Preview, Dry Run, execution journal, and History/Restore contracts.

### Authority migrated

The default Organize Files surface now renders the backend-derived `OrganizationPlanGroupSummary` projection through the Organization Plan store. Plan, Needs My Decision, and Cannot Be Processed Yet are projections of backend readiness classes; group totals and pagination are not reconstructed from the loaded item page. Group inspection loads members through the plan-bound group-item query, and item exceptions continue through the existing revision-bound Plan mutation authority.

### Legacy path retired

- The default raw per-file virtual list, batch checkbox workflow, renderer-side grouping, and permanent engineering controls were removed from `OrganizeSuggestionsView`.
- The UI no longer imports the legacy Organize decision store or operation queue/preview store.
- The Organization Plan store still retains its bounded item-page compatibility adapter for existing item-level mutation plumbing; the migrated UI does not render it or use it as group/query authority.
- Empty tabs do not claim that a tab is empty while backend group pages remain; the view continues loading group pages before showing the final empty state.

### Product changes

- Added a compact plan selector/status area, truthful plan metrics, and a Plan / Needs My Decision / Cannot Be Processed Yet segmented review model.
- Added virtualized group rows with destination, operation kind, readiness, confidence, risk, item count, bytes, accepted/excluded counts, issue counts, reason copy, and Include/Keep/Review actions.
- Added a contextual Side Sheet for group members, source/target facts, item-level Accept/Keep/Clear actions, and an extension-protected filename exception editor.
- Preserved Continue Later through plan selection, History navigation, server-authoritative Dry Run, Preview/final confirmation, and execution-result recovery entry points.
- Destination editing is intentionally not exposed because the current backend has no destination-mutation authority. Filename exceptions remain validated by `validateOrganizeFileNameForOriginal`; group decisions never move files directly.
- Added all new Chinese and English task-language copy to shared i18n; no component-local copy dictionary was introduced.

### Files changed

- `src/views/organize/OrganizeSuggestionsView.tsx`
- `src/i18n.ts`
- `tests/organizeV43.test.ts`
- `tests/fileLibraryV2.test.ts`
- `tests/organizeV41.test.ts`
- `tests/organizeV42.test.ts`
- `tests/organizeV421Interaction.test.tsx`
- `tests/uiEmptyStates.test.ts`
- `docs/design/UI_UX_V4_3_EXECUTION.md`

### Focused tests

- `npm run typecheck` — passed.
- `npm test -- tests/organizeV43.test.ts tests/fileLibraryV2.test.ts tests/organizeV41.test.ts tests/organizeV42.test.ts tests/organizeV421Interaction.test.tsx tests/organizationPlanTask06.test.ts tests/appArchitecture.test.ts tests/hubBuckets.test.ts tests/uiEmptyStates.test.ts` — 9 files passed, 82 tests passed.
- `git diff --check` — passed.

### Full gates

Not run for PR5. Full frontend, Rust quality, remediation, security, performance, packaging, and Windows/macOS release checks remain required for PR11.

### Visual verification

The local Vite/browser-mock preview rendered the Organize Files empty-plan state in Chinese at the default browser viewport and at 980×680. Page identity was `Zen Canvas`, the DOM contained the shell and Organize Files content, no framework overlay or console warning/error was observed, the no-plan File Library recovery action navigated successfully, and the 980×680 check reported no horizontal overflow. The default and narrow screenshots were inspected during the run.

The browser-mock dataset starts with no Organization Plan, so the normal group list, Needs My Decision, Cannot Be Processed Yet, group Side Sheet, item exception editor, Dry Run, dark theme, English copy, 1440/1280/1180/1024 viewports, high contrast, screen reader announcements, Windows DPI, macOS Retina, and native Tauri behavior remain unverified. A File Library row-click attempt closed the temporary browser tab after a CDP timeout; no code or user data was changed by that attempt.

### Acceptance criteria

- Organize defaults to durable Plan group summaries, not a raw per-file review list.
- Needs My Decision is readiness-based and excludes blocked-only groups; Cannot Be Processed Yet remains recovery-oriented.
- Group Include/Keep actions resolve server-side under Plan revision and do not execute filesystem operations.
- Item exceptions remain available in the contextual inspector, including extension-preserving filename validation.
- Review Execution remains the single primary execution path through Dry Run, Preview, explicit confirmation, journals, and History/Restore.
- No second Organize ledger, target-directory authority, schema migration, delete/trash path, or legacy Rule mutation capability was introduced.
- New user-facing copy uses shared Chinese/English i18n keys.

### Deferred or unverified

PR6 must migrate Overview to truthful Plan/cleanup/watch health task language and verify entry-point parity. PR11 must complete the full visual matrix, native/platform checks, screen-reader and high-contrast verification, full CI evidence, and release gates. The browser-mock normal-plan render needs seeded durable-plan data or a stable test fixture before group-level visual acceptance can be claimed.

### Risks requiring human review

The renderer still carries a compatibility item-page adapter in the Organization Plan store, even though the V4.3 Organize surface uses group and group-item queries. Reviewers should confirm that no later caller reintroduces item-page grouping or treats the adapter as a second UI authority. The browser-mock group action path was covered by static contract tests but not by a completed rendered interaction because the temporary preview tab closed during row selection; validate that path against a seeded plan before release.

## 5G. PR6 closeout — durable Storage Cleanup UX

### Current baseline

PR6 starts from committed PR5 `d62de7d` on `codex/ui-v4-3-product-integration`. The implementation preserves Schema 34, Analysis Run/Finding/Evidence/Decision contracts, server-authoritative Operation Preview, Safe Trash, cleanup journals, and History/Restore recovery.

### Authority migrated

The Storage Cleanup workspace now renders the durable Analysis Run and Finding authorities. Scope, run status, detector progress, partial/retry state, backend aggregate counts, cursor-based finding pages, evidence, review decisions, Preview, Safe Trash, and History navigation are all connected to that durable flow. The renderer keeps only transient selection, disclosure, preview, and confirmation state; it does not derive authoritative totals from loaded findings.

### Legacy path retired

- The visible Cleanup page no longer imports or renders `useStorageCleanupStore`, `StorageAnalysis`, `StorageCandidate`, legacy scan/candidate commands, or multiple legacy AI analysis controls.
- Caution findings are never selectable; Safe findings follow the backend-safe default policy; Review findings require an acknowledgement with the current decision revision before selection.
- The compatibility cleanup store and legacy scanner APIs remain only for existing non-migrated callers and browser/mock compatibility; they are not a second Cleanup rendering authority.
- Cleanup execution remains Safe Trash only. No permanent-delete path, direct filesystem mutation, or second queue was introduced.

### Product changes

- Added a required scope-first flow with quick scope choices, a single primary Scan action, durable run progress, partial/error recovery, and backend-derived metrics.
- Added Safe / Review / Caution finding tabs, virtualized rows, reason/risk/confidence copy, evidence disclosure, reveal, stale recheck, and review acknowledgement.
- Kept one contextual AI action for Review recheck. It is advisory and refreshes durable findings; it does not move files or create a second analysis queue.
- Added server Preview, explicit Safe Trash confirmation, execution result, and History/Restore recovery entry points.
- Added all new Chinese and English task-language copy to shared i18n; no component-local copy dictionary was introduced.

### Files changed

- `src/views/cleanup/StorageCleanupView.tsx`
- `src/i18n.ts`
- `tests/storageCleanupView.test.tsx`
- `tests/cleanupReviewConfirm.test.tsx`
- `tests/dedupeContract.test.ts`
- `docs/design/UI_UX_V4_3_EXECUTION.md`

### Focused tests

- `npm run typecheck` — passed.
- `npm test -- tests/storageCleanupView.test.tsx tests/cleanupReviewConfirm.test.tsx tests/dedupeContract.test.ts tests/phase8ReleaseAudit.test.ts` — 4 files passed, 16 tests passed.
- `git diff --check` — passed.

### Full gates

Not run for PR6. Full frontend, Rust quality, remediation, security, performance, packaging, and Windows/macOS release checks remain required for PR11.

### Visual verification

The local Vite/browser-mock preview rendered the Storage Cleanup empty state in Chinese with the Zen Canvas shell at the default 1280×720 viewport and again at 980×680. The narrow run reported `innerWidth=980`, `innerHeight=680`, `scrollWidth=980`, `clientWidth=980`, and no console warning/error entries. The empty state correctly required a scope and did not expose findings, metrics, AI controls, or execution actions before a run.

The browser-mock quick-scope action cannot start a run in this non-Tauri preview because the external Tauri path helper has no browser bridge (`Cannot read properties of undefined (reading 'invoke')`). The mounted durable review/Preview/Safe Trash interaction test covers the populated finding flow, but a normal populated browser screenshot, dark theme, English copy, 1440/1280/1180/1024 viewports, high contrast, screen-reader announcements, Windows DPI, macOS Retina, and native Tauri behavior remain unverified.

### Acceptance criteria

- Storage Cleanup has one visible durable Analysis Run/Finding authority and no legacy store rendering path.
- Totals and tabs use backend run aggregates and cursor-based finding queries; no complete result is inferred from the current page.
- Partial, failed, canceled, stale, Safe, Review, and Caution states have distinct user outcomes and next actions.
- Review decisions are revision-bound; Caution is never preselected; Safe Trash is the only cleanup execution path.
- Preview and explicit confirmation remain mandatory before Safe Trash; execution reports recovery through History/Restore.
- AI remains advisory and contextual; no second queue or mutation authority was introduced.
- New user-facing copy uses shared Chinese/English i18n keys.

### Deferred or unverified

PR7 must align Preview, History, and Restore surfaces with the durable execution/recovery contracts. PR10 must migrate Overview from legacy cleanup projections. PR11 must complete the full visual matrix, native/platform checks, screen-reader and high-contrast verification, full CI evidence, and release gates. Seeded browser data is still needed for rendered populated finding and preview acceptance.

### Risks requiring human review

The cleanup page's native quick-scope and folder-picker controls depend on Tauri path/dialog APIs and were not exercised in the browser-mock preview. Reviewers should validate those controls in the native desktop shell and verify that the compatibility cleanup store is not reintroduced as a visible authority while later Overview and recovery migrations land.

## 5H. PR7 closeout — Preview, History, and Restore clarity

### Current baseline

PR7 starts from committed PR6 `65165ca` on `codex/ui-v4-3-product-integration`. The implementation preserves the existing server-authoritative Operation Preview, per-file eligibility checks, execution journal, operation-log restore intent, cleanup ledger, Safe Trash restore preview, and fail-closed revalidation.

### Authority migrated

Preview remains a projection of the Operation Preview and execution-intent authorities exposed by the operation queue adapter. History remains a projection of operation logs and the cleanup ledger; restore confirmation still goes through the store's revision-bound operation/cleanup restore intent and backend re-preview. No renderer-only execution or restore authority was added.

### Legacy path retired

- The Preview summary no longer presents a seven-value dashboard. It shows four decision-level values and keeps blocked, confirmation, parent-folder, low-confidence, and truncation details in a disclosure.
- History no longer presents every filter as a permanent toolbar. All, Restorable, and Needs attention remain primary; additional operation/restore and Cleanup Trash filters live in a keyboard-dismissible Popover.
- Technical IDs were removed from the normal History search placeholder; operation source, restore destination, and recovery limitations use task-language copy.
- Existing operation-queue and restore stores remain compatibility/adaptor layers over backend Operation Preview, Journal, and restore APIs. No second executor, queue, journal, or restore ledger was introduced.

### Product changes

- Preview keeps source-aware return paths, explicit confirmation, progress replacement, cancellation, and result/recovery entry points while making the primary summary compact.
- Preview safety details are a native disclosure and clearly state when the visible preview is truncated; the renderer does not claim that loaded detail counts are complete totals.
- History event rows now show operation source alongside outcome and restore state. The inspector labels the original location as the restore destination and explains that Zen Canvas will not invent a new destination when the original location is unavailable.
- Restore remains fail-closed: the user can review conflicts, missing sources, failed/manual-review states, and partial results; only the authoritative executable intersection is submitted.
- Added all new Chinese and English task-language copy to shared i18n; no component-local copy dictionary was introduced.

### Files changed

- `src/views/timeline/TimelineView.tsx`
- `src/views/history/HistoryBatchList.tsx`
- `src/views/history/HistoryInspector.tsx`
- `src/views/restore/RestoreView.tsx`
- `src/i18n.ts`
- `tests/timelinePreview.test.ts`
- `tests/historyUi.test.ts`
- `docs/design/UI_UX_V4_3_EXECUTION.md`

### Focused tests

- `npm run typecheck` — passed.
- `npm test -- tests/timelinePreview.test.ts tests/historyUi.test.ts tests/historyRestoreModel.test.ts tests/restoreTrash.test.ts tests/cleanupRestoreIntent.test.ts tests/restoreStoreBehavior.test.ts tests/operationLogs.test.ts` — 7 files passed, 23 tests passed.
- `git diff --check` — pending until the stage is staged and committed.

### Full gates

Not run for PR7. Full frontend, Rust quality, remediation, security, performance, packaging, and Windows/macOS release checks remain required for PR11.

### Visual verification

The local Vite/browser-mock preview rendered seeded Chinese History at 1280×720, including operation batches, source/state text, restore destination/current path details, and the additional-filter Popover. Preview was entered through the shell command shortcut and rendered the four-value summary plus safety disclosure at 1280×720. At 980×680, Preview, History list/detail navigation, Cleanup Trash filtering, and the narrow History layout were inspected; every measured state reported `scrollWidth=clientWidth` and no console warning/error entries. Escape returned the narrow History detail to its list.

The browser mock does not exercise native filesystem execution, cancellation races, restore filesystem identity checks, or actual conflict resolution. Dark theme, English copy, 1440/1180/1024 viewports, high contrast, screen-reader announcements, Windows DPI, macOS Retina, and native Tauri behavior remain unverified.

### Acceptance criteria

- Preview's dominant summary has at most four values: selected, executable, needs attention, and impact items.
- Safety and pagination details are disclosed, while execution remains per-file validated and server-authoritative.
- History defaults to All, Restorable, and Needs attention; additional filters are available without permanently dominating the toolbar.
- History rows show user outcome, time, item count, operation source, and restore availability/state.
- Restore explains the target location and does not invent a new destination or bypass conflict/manual-review boundaries.
- Progress replaces the primary execution action, cancellation and result states remain visible, and History/Restore recovery entry points remain reachable.
- New user-facing copy uses shared Chinese/English i18n keys.

### Deferred or unverified

PR8 must simplify Automation and Rule Proposal flows. PR9 must extract the Content Understanding workspace. PR10 must integrate Settings and Overview system health. PR11 must complete the full visual matrix, native/platform checks, screen-reader and high-contrast verification, full CI evidence, and release gates.

### Risks requiring human review

The browser preview confirms projection and interaction structure but cannot prove native Operation Preview/Journal or restore identity behavior. Reviewers should validate the native execution and recovery paths with representative conflict, missing-source, partial, canceled, and Safe Trash cases before release.

## 5I. PR8 closeout — Automation and Rule Proposal clarity

### Current baseline

PR8 starts from committed PR7 `8e09b4f` on `codex/ui-v4-3-product-integration`. The implementation preserves Rule Repository V2 as the only Rule mutation authority, durable Rule Proposal persistence, the existing managed provider policy, advisory-only classification, and the separate Enable/Run actions.

### Authority migrated

Automation now projects the Rule Repository V2 catalog into a default Rule Library with a compact backend-backed status summary. Natural-language creation remains a Rule Proposal review flow; Apply calls the existing proposal authority and returns to the Rule Library only after the proposal has been applied as a disabled rule. No renderer-owned Rule vector, legacy mutation command, second queue, or filesystem execution path was added.

### Legacy path retired

- The permanent Rule Proposal panel was removed from the default Automation workspace. It mounts only inside the dedicated Create Rule proposal side sheet.
- The four-card Automation dashboard and always-visible needs-review hint were replaced by the shared compact `MetricStrip` for total, enabled, and paused rules.
- Idle run feedback no longer occupies the workspace; last-run feedback appears only for running, stale, failed, or completed states.
- The component-local Rule Proposal copy dictionary was removed. New proposal and creation-choice copy lives in shared Chinese/English i18n.

### Product changes

- Automation opens on Rule Library with one primary Create Rule action.
- Create Rule presents two review-safe choices: Describe with natural language or Build manually.
- Describe with natural language opens a dedicated side sheet containing prompt, bounded generation, validation, metadata-impact preview, exact-count resolution, and Apply review.
- Apply remains disabled-only and closes the proposal surface through an explicit completion callback; enabling, running, and file changes remain separate human actions.
- The manual builder remains an existing repository-backed dialog, and focus restoration preserves the originating Create Rule trigger through the intermediate choice sheet.

### Files changed

- `src/views/rules/RulesView.tsx`
- `src/views/rules/RuleProposalWorkspace.tsx`
- `src/views/rules/AutomationRunFeedback.tsx`
- `src/i18n.ts`
- `tests/rulesViewBehavior.test.tsx`
- `tests/rulesViewUi.test.ts`
- `tests/ruleProposalTask07.test.ts`
- `docs/design/UI_UX_V4_3_EXECUTION.md`

### Focused tests

- `npm.cmd run typecheck` — passed.
- `npm.cmd test -- tests/ruleProposalTask07.test.ts tests/rulesViewUi.test.ts tests/rulesViewBehavior.test.tsx` — 3 files passed, 28 tests passed.
- `git diff --check` — passed before staging.

### Full gates

Not run for PR8. Full frontend, Rust quality, remediation, security, performance, packaging, Windows/macOS release, CI path, and release-gate checks remain required for PR11.

### Visual verification

The local Vite/browser-mock preview rendered the Chinese Automation Rule Library at 1280×720 with a seeded paused rule, compact three-value summary, no permanent Rule Proposal surface, and no four-card dashboard. The Create Rule side sheet showed both creation choices; the natural-language choice opened the dedicated Rule Proposal side sheet; the manual choice opened the existing manual Rule Builder dialog. At 980×680, the proposal side sheet reported `innerWidth=980`, `innerHeight=680`, `scrollWidth=980`, `clientWidth=980`, `scrollHeight=680`, and no horizontal overflow. Browser logs contained no warning/error entries; only the standard React DevTools informational message was present.

The browser mock does not exercise real AI generation, native Tauri persistence, native focus/window behavior, or a populated Apply completion with a native Rule Repository. Dark theme, English copy, 1440/1180/1024 viewports, high contrast, screen-reader announcements, Windows DPI, macOS Retina, and native Tauri behavior remain unverified.

### Acceptance criteria

- Automation defaults to a Rule Library; the Rule Proposal flow does not permanently dominate the workspace.
- Create Rule presents natural-language and manual creation choices through a keyboard-dismissible shared SideSheet.
- Natural-language generation, validation, metadata preview, exact-count resolution, and disabled-only Apply remain available in one dedicated review flow.
- Apply returns to Rule Library after the authoritative proposal mutation; Enable and Run remain separate actions.
- Automation shows a compact enabled/paused summary and only relevant last-run feedback.
- All new user-facing creation and proposal copy uses shared Chinese/English i18n; no local copy dictionary remains.
- Browser-mock narrow verification has no horizontal overflow and no browser warning/error entries.

### Deferred or unverified

PR9 must extract the Content Understanding workspace. PR10 must integrate Settings and Overview system health. PR11 must complete the full visual matrix, native/platform checks, screen-reader and high-contrast verification, full CI evidence, and release gates.

### Risks requiring human review

Reviewers should validate the native Rule Proposal Apply path with a real provider-disabled and provider-enabled configuration, confirm that the resulting rule is persisted disabled in Rule Repository V2, and verify that the proposal surface closes only after a successful authoritative mutation. They should also confirm that the intermediate choice-sheet focus restoration remains correct in the native Tauri shell.

## 5J. PR9 closeout — dedicated Content Understanding surface

### Current baseline

PR9 starts from committed PR8 `ba9845e` on `codex/ui-v4-3-product-integration`. The implementation preserves managed-only Content Scope Policy, durable Content Run and Content Artifact authority, explicit local/provider consent, source immutability, bounded extraction, and the existing content APIs. No schema, queue, provider payload, or filesystem mutation authority was added.

### Authority migrated

Content Understanding now has a dedicated `ContentUnderstandingSheet` opened from the File Library Inspector or file context menu. The sheet projects policy, preview, run, artifact, recent-run, and bounded search state from the existing Content Scope Policy, Content Run, and Content Artifact APIs. The Inspector keeps only concise status/policy projection and an Open action; it is no longer a second content workflow authority.

### Legacy path retired

- The monolithic content policy/preview/run/artifact workflow was removed from the narrow File Library Inspector.
- The Inspector and context menu now enter the dedicated Content Understanding surface while preserving the selected file and restoring focus to the originating trigger.
- Component-local content copy was removed; all new Content Understanding copy uses shared Chinese/English i18n.
- The browser preview explicitly identifies its mock boundary and does not claim real extraction, provider understanding, or native persistence.

### Product changes

- The dedicated surface separates status, permission/policy, preview, run progress, artifact summary, recent runs, and content search without exposing raw paths or provider payloads.
- Policy edits are saved before preview/run actions; local extraction and provider understanding remain distinct actions, with provider confirmation gated by the existing policy and artifact boundaries.
- Preview start retains the expected library/policy revisions, preview fingerprint, and explicit confirmation. Rebuild, cancel, delete-data, and purge actions use confirmation and keep source files unchanged.
- Unsupported formats, OCR/unsupported boundaries, budgets, retention, and blocked reasons are translated into task language. Recent runs and remount refresh use the existing durable APIs.
- Selection projection in `VaultView` is memoized so the selection-detail hydration effect does not repeatedly reload the Inspector after a file is selected.

### Files changed

- `src/views/vault/components/ContentUnderstandingSheet.tsx`
- `src/views/vault/components/FileLibraryInspector.tsx`
- `src/views/vault/VaultView.tsx`
- `src/i18n.ts`
- `tests/contentUnderstandingUi.test.ts`
- `docs/design/UI_UX_V4_3_EXECUTION.md`

### Focused tests

- `npm.cmd run typecheck` — passed.
- `npm.cmd test -- tests/contentUnderstandingUi.test.ts tests/fileLibraryV4.test.tsx tests/contentMockTruthfulness.test.ts tests/fileLibraryTask06Handoff.test.tsx` — 4 files passed, 16 tests passed.
- `git diff --check` — passed before staging.

### Full gates

Not run for PR9. Full frontend, Rust quality, remediation, security, performance, packaging, Windows/macOS release, CI path, and release-gate checks remain required for PR11.

### Visual verification

The local Vite/browser-mock preview rendered the seeded Chinese File Library at 1280×720. Selecting `project-report.pdf` kept the target page mounted and showed the concise Inspector content status, root policy, and Open action. The Content Understanding Side Sheet rendered as a 480px right-side surface with status, policy, preview/run, artifact, recent-run, and search sections; the explicit browser-mock boundary was visible. The measured viewport reported `innerWidth=1280`, `innerHeight=720`, `scrollWidth=1280`, and no horizontal overflow. Closing the sheet restored focus to `打开内容理解`. Browser diagnostics contained no warning/error entries, and the policy loading copy appeared once after the duplicate-copy fix.

The browser mock does not exercise native Tauri policy revisions, real extraction, provider confirmation, durable run restart, actual artifact deletion, screen-reader announcements, or native focus/window behavior. A direct PR9 980×680 browser viewport resize was unavailable in the current in-app browser surface; the PR8 narrow evidence remains separate. Dark theme, English copy, 1440/1180/1024 viewports, high contrast, Windows DPI, macOS Retina, and native Tauri behavior remain unverified for PR9.

### Acceptance criteria

- File Library Inspector contains only concise Content Understanding status/policy projection and an Open action.
- Inspector and context-menu entry points open one dedicated SideSheet while preserving selection and focus restoration.
- Policy, preview, local run, provider disclosure/confirmation, rebuild, cancel, delete-data, recent runs, and bounded search remain available through existing durable authorities.
- Preview and execution retain revision, fingerprint, confirmation, consent, source-unchanged, and unsupported-format safety boundaries.
- No raw path/filename provider payload, second content queue/store, or component-local copy dictionary was introduced.
- Browser-mock narrow verification at 1280×720 has no horizontal overflow and no warning/error entries.

### Deferred or unverified

PR10 must integrate Settings and Overview system health. PR11 must complete the full visual matrix, native/platform checks, screen-reader and high-contrast verification, full CI evidence, and release gates. The 980×680 PR9 viewport resize and real content/provider flows remain unverified.

### Risks requiring human review

Reviewers should validate policy revision conflicts, preview fingerprint invalidation, provider consent and payload redaction, run cancellation/restart, artifact deletion without source changes, and unsupported/OCR truth with native Tauri fixtures. They should also verify the dedicated sheet focus trap and return behavior at Windows 100–200% scaling and in the macOS shell.

---

## 6. Codex continuous-execution rule

Codex may continue automatically from one V4.3 stage to the next only when:

- the previous stage is committed;
- its focused tests pass;
- its acceptance criteria pass;
- the worktree is clean;
- no stop condition is present.

Codex must not:

- silently skip visual verification;
- invent a platform pass;
- use a later stage to hide unfinished earlier-stage work;
- compress all stages into one commit;
- auto-merge to `master`.

---

## 7. Final delivery

The final delivery must contain:

- all stage commits;
- updated V4.3 documents;
- `UI_UX_V4_3_AUTHORITY_MAP.md`;
- `UI_UX_V4_3_FINAL_QA.md`;
- clean worktree;
- one Draft PR if explicitly authorized;
- no automatic merge.

Final report:

### Completed stages

### Authority migrations

### Important product decisions

### Commit history

### Files changed

### Tests and commands run

### Visual verification

### Release Gate

### Deferred or unverified

### Risks requiring human review
