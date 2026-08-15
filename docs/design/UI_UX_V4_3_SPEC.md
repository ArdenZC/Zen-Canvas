# Zen Canvas UI/UX V4.3 Specification

> Product Integration & Clarity
> Historical evidence — UI/UX V4.3
> This document is not the current project-status or execution authority.
> Current project truth: `docs/project/STATUS.md`
> Current architecture: `docs/project/ARCHITECTURE_MAP.md`
> Program status: completed
> Historical baseline: `master@9ea69d29143b994c8632747ab647f59637dfe324`
> Architecture baseline: Remediation V1 and Post-V1 verification maintenance complete, Schema 34
> Historical verification fix: `98ca8185979feb5b0f450a076362c089675416b5`

---

## 1. Purpose

V4.3 integrates Zen Canvas’s completed product capabilities into one coherent desktop experience.

The work is not a cosmetic reskin and not a new architecture program. It solves the gap between:

- a mature, safety-oriented backend;
- and workspaces that still expose old page structures, raw lifecycle facts or multiple overlapping feature surfaces.

The desired product is:

- calm;
- local-first;
- safe;
- truthful;
- task-oriented;
- keyboard-friendly;
- progressive in detail;
- consistent across Windows and macOS.

---

## 2. Product position

Zen Canvas is an intelligent file-governance workspace.

It is not:

- a full replacement for Explorer or Finder;
- a cloud drive;
- a document editor;
- a media suite;
- an OCR or format-conversion toolbox;
- a universal automation agent;
- a RAG or vector-search application.

Its core promise is:

> Find files across the computer, choose what Zen Canvas manages, understand and organize those files safely, recover every supported change, and keep the user in control.

---

## 3. Current product authorities

| User capability | Authority |
| --- | --- |
| search the computer | Global Index |
| browse managed files | File Library Query V2 |
| select across pages | backend-resolved `LibrarySelectionV1` |
| review duplicates | durable Dedupe |
| analyze storage | Analysis Run/Finding |
| organize files | Organization Plan |
| approve execution | authoritative Dry Run / Operation Preview |
| execute file changes | operation journal |
| clean safely | Safe Trash / cleanup journal |
| restore changes | operation and cleanup ledgers |
| manage rules | Rule Repository V2 |
| describe rules | Rule Proposal |
| understand content | Content Policy / Run / Artifact |
| configure AI | Provider Registry / AI Settings |
| inspect diagnostics | Request Trace |

V4.3 interfaces may simplify these facts but may not replace them.

---

## 3A. V4.3.1 search, health and governance addendum

This section overrides any less-specific earlier wording.

### Global Search query integrity

- commit the query only after IME composition finishes;
- preserve literal punctuation;
- do not strip or broaden `.gitignore`, `.env`, `C++`, `report!`, `[name]`, `file*` or `what?`;
- preserve backend file-result order;
- the renderer may visually separate Commands and Files, but must not re-rank Files;
- preserve latest-request ownership, Search Window session/revision checks and ID-only activation.

### Global Search result states

The supported user states are:

```ts
type GlobalSearchResultState =
  | "idle"
  | "pending"
  | "complete"
  | "partial"
  | "empty"
  | "no_source"
  | "failed";
```

`empty` means enabled sources exist but no file matches.

`no_source` means no Global Index source is enabled.

These states must have different copy and actions.

Recommended `no_source` state:

> No searchable locations are configured. Add a local disk or folder to use system-wide search.

Primary action:

- Set up search locations.

The action opens the Global Search source section in Settings.

### Managed-root and watcher language

| State | Meaning | Primary action |
| --- | --- | --- |
| permission required | Zen Canvas cannot access the location | Grant access |
| reconciliation required | watched changes and durable facts must be synchronized | Sync now |
| partial | some usable data remains but coverage is incomplete | Review affected locations |
| retry exhausted | automatic retry did not recover the root | Retry or view details |

Do not collapse these into a generic “index problem”.

### Rule command boundary

Automation uses Rule Repository V2 only.

Do not restore or invoke:

- `save_user_rule`;
- `delete_user_rule`;
- `get_user_rules`.

Search Window can navigate to Automation but cannot mutate rules.

### CI acceptance

Production-code stages are expected to run frontend, Windows/macOS Rust quality, Clippy and Windows/macOS release compilation.

Full validation additionally runs configured packaging and full-scale performance checks.

V4.3 work must not weaken the workflow contract or product thresholds.

---

## 4. Design principles

### 4.1 Capability without cognitive overload

A feature existing in the backend does not require it to be permanently visible.

Use progressive disclosure:

1. outcome;
2. explanation;
3. detail;
4. technical diagnostics.

### 4.2 Truth before convenience

The interface must never imply that bounded or paged data is complete.

Examples:

- deferred counts remain explicitly unresolved;
- partial Global Index sources remain partial;
- a loaded page is not a complete Organization Plan group;
- a bounded rule sample is not the exact impact;
- stale data remains visibly stale until refreshed.

### 4.3 Exception-first review

The user should not inspect every safe file.

Default workspaces summarize the plan and surface only:

- low confidence;
- conflicts;
- changed facts;
- missing permissions;
- unsupported operations;
- explicit-risk decisions.

### 4.4 One dominant action

Each state has one visually dominant primary action.

Examples:

- choose locations;
- start scan;
- review 6 items;
- create dry run;
- confirm execution;
- create rule;
- save settings.

Other actions are secondary, compact, contextual or disclosed.

### 4.5 Local-first confidence

The UI should continuously answer:

- what is local;
- what is managed;
- what may be sent to an AI provider;
- what will change on disk;
- whether the action can be restored.

Do not turn privacy into a wall of warnings. Use clear, contextual statements.

### 4.6 Desktop-native restraint

Use:

- compact toolbars;
- stable split panes;
- contextual Inspector or Side Sheet;
- platform-aware reveal/open language;
- keyboard navigation;
- quiet surfaces;
- limited animation.

Avoid:

- marketing dashboards;
- floating cards everywhere;
- oversized mobile-style controls;
- excessive glass;
- permanent explanatory banners.

---

## 5. Global information architecture

### 5.1 Main navigation

Primary:

1. Overview
2. File Library
3. Organize Files
4. Storage Cleanup
5. History

Advanced:

6. Automation
7. Settings

### 5.2 Internal task surfaces

The following are not permanent main-navigation items:

- Preview & Execute;
- Rule Proposal review;
- Content Understanding;
- Tag management;
- Saved View management;
- Duplicate group review;
- technical diagnostics.

They open contextually as:

- a route owned by the initiating workspace;
- a Side Sheet;
- a Dialog;
- or an internal sub-workspace.

### 5.3 Search distinction

**Global Search**

- system-wide;
- Global Index;
- files may be unmanaged;
- command actions;
- open/reveal;
- source completeness.

**File Library Search**

- managed files only;
- current Library Query scope;
- filters, tags, classification and content metadata;
- selection and downstream workflows.

The labels, placeholder copy and empty states must make this difference explicit.

---

## 6. Shell

### 6.1 Titlebar

Contains:

- native window controls;
- central Global Search trigger;
- optional compact system-health affordance only when attention is needed.

Do not place a permanent multi-status dashboard in the titlebar.

### 6.2 Sidebar

- fixed navigation;
- active indicator;
- concise pending badges;
- advanced section;
- optional compact AI mode status at the bottom.

Pending badge rules:

- Organize shows only actionable decision count;
- Cleanup may show a completed review count only when a run requires attention;
- errors use an icon or accessible label, not color alone.

### 6.3 Page heading

The App Shell owns the standard page title and short description.

A workspace must not render the same title again.

A page-level header may add:

- one primary action;
- a compact secondary toolbar;
- a status disclosure.

### 6.4 Workspace frame

Desktop default:

```text
Titlebar
└── Sidebar | Workspace
             ├── Shell page heading
             ├── optional compact status/banner
             └── workspace body
```

Workspaces with Inspectors:

```text
Main list/content | Inspector
```

At narrow widths, the Inspector becomes a separate pane or Side Sheet. It must not compress the main list into an unusable column.

---

## 7. Design tokens and density

### 7.1 Existing tokens

Continue using `--zc-*` tokens.

V4.3 may add semantic tokens through `src/styles/tokens.css`, including:

```css
--zc-radius-row
--zc-control-height-compact
--zc-control-height-default
--zc-row-height-compact
--zc-row-height-default
--zc-inspector-width
--zc-sheet-width
--zc-content-max-width
```

Do not use page-local literal values when a shared semantic token applies.

### 7.2 Density

```ts
type Density = "default" | "compact";
```

Default:

- primary controls approximately 40px;
- standard file rows approximately 52px;
- comfortable settings spacing.

Compact:

- controls approximately 32–36px;
- rows approximately 40–44px;
- reduced vertical gaps;
- no reduction in hit target below accessibility requirements.

Density does not change information hierarchy.

### 7.3 Radius hierarchy

Use the smallest suitable radius:

- row;
- control;
- field;
- panel;
- floating surface;
- window.

Normal rows must not look like independent large cards.

### 7.4 Shadows

- ordinary panels: none or subtle border;
- raised task surface: restrained raised shadow;
- floating Dialog/Sheet/Popover: floating shadow;
- Global Search: spotlight shadow.

Do not use raised shadows on every nested section.

---

## 8. Typography

### 8.1 Hierarchy

- App Shell page title: 22–24px, semibold;
- workspace section title: 16–18px, semibold;
- row title: 13–14px, medium/semibold;
- body: 13–14px;
- metadata: 12px;
- technical detail: 11–12px, disclosed.

### 8.2 Writing style

Use plain action language.

Prefer:

- “Review 6 items”
- “Search is still updating”
- “This file changed since the plan was created”
- “Allow content reading for this folder”

Avoid:

- “needs_review”
- “revision 14”
- “materialized 10,000”
- “provider owner”
- “scope hash”
- “exact resolver token”

---

## 9. Shared primitives

V4.3 must consolidate the following primitives.

### 9.1 Button

Variants:

```ts
type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "subtle"
  | "warning"
  | "danger";
```

Sizes:

```ts
type ButtonSize = "compact" | "default";
```

Rules:

- one primary per state;
- destructive actions are not primary until a destructive confirmation step;
- icon-only buttons require accessible names and tooltips when meaning is not obvious.

### 9.2 Input and Search Field

Search Field includes:

- search icon;
- clear action;
- loading state;
- optional scope label;
- composition-safe behavior where relevant.

File Library Search never invokes Global Search.

### 9.3 Segmented Control

Use only for small mutually exclusive mode sets.

Examples:

- Plan / Needs My Decision / Cannot Be Processed;
- Rule creation method;
- local / provider content mode when already consented.

Do not use Segmented Control for long navigation.

### 9.4 Notice

Notice variants:

- info;
- success;
- warning;
- danger.

Notice is for exceptional information, not permanent page decoration.

If three notices are simultaneously visible, consolidate them into:

- one summary;
- a detail disclosure;
- contextual row-level states.

### 9.5 State Block

Supports:

- empty;
- loading;
- permission;
- partial;
- error;
- canceled;
- success.

Each state specifies:

- title;
- concise consequence;
- one next action;
- optional secondary action.

### 9.6 Metric Strip

A compact horizontal summary, not a grid of SaaS cards.

Use 2–4 decision-relevant values.

Example:

```text
285 selected  |  279 ready  |  6 need attention
```

### 9.7 Durable Task Status

Shared projection for:

- Scan Run;
- Analysis Run;
- Dedupe Run;
- Content Run;
- Organization Plan execution.

Visual states:

```ts
type DurableTaskVisualState =
  | "idle"
  | "preparing"
  | "running"
  | "partial"
  | "paused"
  | "needs-attention"
  | "completed"
  | "canceled"
  | "failed"
  | "stale";
```

The component accepts user-facing labels and actions. It does not expose raw domain enums directly.

### 9.8 Inspector

Inspector is for concise contextual facts and lightweight actions.

Maximum content categories:

- identity;
- summary;
- status;
- tags;
- a small set of contextual actions.

Long workflows open a dedicated surface.

### 9.9 Side Sheet

Use for complex context-preserving tasks:

- Content Understanding;
- detailed file metadata;
- Saved View management;
- technical run details.

Sheet requirements:

- focus trap;
- focus restoration;
- keyboard navigation;
- responsive full-pane mode;
- no nested modal unless necessary.

---

## 10. Overview

### 10.1 Goal

Answer:

> What needs my attention now?

### 10.2 Structure

1. Priority Task
2. System Coverage
3. Managed Library Summary
4. Recent Activity
5. Background Tasks

Hide sections with no meaningful content.

### 10.3 Priority model

Possible priority tasks:

- choose first managed locations;
- fix Global Search permission;
- resume or retry indexing;
- review Organization Plan exceptions;
- review Cleanup findings;
- restore a failed/partial operation;
- review a failed Content Run;
- nothing urgent.

Do not hardcode Global Index health.

### 10.4 System coverage

Compactly distinguish:

- searchable across computer;
- managed by Zen Canvas;
- content understanding enabled.

Do not imply that all searchable files are managed.

---

## 11. Global Search

### 11.1 Idle state

Show a restrained set of:

- recent or useful commands;
- navigation commands;
- system index status only when incomplete.

### 11.2 Results

Group:

- Files and folders;
- Commands.

File result shows:

- name;
- compact path;
- type;
- managed indicator when applicable.

Do not show AI risk or content metadata for unmanaged files.

### 11.3 Partial state

Results remain usable when some sources are partial.

Show a compact footer:

> Results may be incomplete because 1 location needs permission.

Action:

- Review search sources.

### 11.4 Result actions

- Enter: open;
- Ctrl/Cmd+Enter: reveal;
- context action: manage this location, when supported;
- no arbitrary path mutation.

---

## 12. File Library V3

### 12.1 Main layout

```text
Scope / Saved View | Search | Filters | Sort | View options
Selection bar when active
File list
Inspector
```

### 12.2 Toolbar

First row:

- scope or active Saved View;
- File Library Search;
- filter;
- sort;
- optional density/view control.

Second row appears only when needed:

- active filter chips;
- invalid Saved View reference;
- snapshot-expired notice;
- selection scope.

### 12.3 Saved Views

Saved Views are query presets.

Default placement:

- scope menu or a compact side menu;
- not a permanent large dashboard.

Management opens a dedicated Dialog or Sheet.

### 12.4 Tags

Tags remain user metadata.

Tag creation, rename, color, deletion and assignment use shared management surfaces.

Do not mix user tags with AI Purpose/Lifecycle/Risk.

### 12.5 Selection

Clearly distinguish:

- loaded rows selected;
- all matching selected;
- exclusions;
- exact count pending.

Selection bar shows truthful backend summary.

### 12.6 Duplicate groups

Duplicate group review is a cleanup-oriented task.

File Library may show duplicate status and open the relevant review surface.

It should not permanently insert a second large list above or below the normal file list.

### 12.7 Inspector

Single file:

- name and path;
- type, size and dates;
- managed status;
- classification summary;
- tags;
- duplicate/content status;
- Preview, Reveal, Organize actions.

Multi-selection:

- authoritative count and size;
- common directory;
- common tags;
- type summary;
- Create Organization Plan;
- assign/remove tags.

### 12.8 Content entry

Inspector shows:

```text
Content Understanding
Not enabled / Ready / Updating / Stale / Needs attention
[Open]
```

The full workflow opens a Side Sheet.

---

## 13. Organize Files V2

### 13.1 Source

Organization Plans are created from authoritative File Library selections.

The Plan is durable and can be continued later.

### 13.2 Default workspace

Top:

- active plan selector;
- plan title;
- concise status;
- Refresh when stale;
- Plan actions in overflow.

Primary segmented view:

1. Plan
2. Needs My Decision
3. Cannot Be Processed Yet

### 13.3 Backend-derived grouping

Plan groups are derived by backend query from the entire plan ledger.

A group key may include:

- target directory;
- proposal kind;
- classification reason;
- risk class;
- readiness class.

The renderer must receive:

```ts
interface OrganizationPlanGroupSummary {
  groupId: string;
  planId: string;
  label: string;
  targetDirectory: string | null;
  proposalKind: string;
  readiness: "ready" | "requires-decision" | "blocked";
  itemCount: number;
  totalBytes: number;
  acceptedCount: number;
  excludedCount: number;
  staleCount: number;
  conflictCount: number;
  confidenceBand: string;
  sampleItems: OrganizationPlanGroupSample[];
  revision: number;
}
```

The exact contract may differ, but totals and mutations must remain backend-authoritative.

### 13.4 Plan view

Ready groups show:

- destination;
- file count;
- total size;
- source summary;
- why grouped;
- confidence/risk;
- sample files;
- included/excluded state.

Actions:

- include/exclude group;
- change destination;
- expand files;
- edit one file;
- open dry-run preview.

High-confidence safe groups may be included by default only if the backend safe-batch rules approve them.

### 13.5 Needs My Decision

User-facing reasons include:

- low confidence;
- possible duplicate;
- sensitive file;
- name conflict;
- unsafe extension change;
- missing destination;
- mixed group;
- changed since plan creation.

Each reason provides at least two meaningful outcomes where the backend supports them.

Examples:

- accept safe suggestion;
- keep in place;
- change destination;
- rename while preserving extension;
- exclude from plan;
- refresh current facts;
- analyze missing metadata.

Blocked items are not placed here unless a user decision can actually unblock them.

### 13.6 Cannot Be Processed Yet

Includes:

- source unavailable;
- permission missing;
- unsupported operation;
- invalid or missing preview;
- root health degraded;
- ambiguous recovery state.

Actions:

- retry;
- refresh;
- reveal source;
- remove from plan;
- view technical detail.

### 13.7 Dry run

The primary action is:

> Review execution

Dry Run shows authoritative item-level From/To facts.

A group approval never bypasses item-level validation.

### 13.8 Execution result

Show:

- completed;
- skipped;
- failed;
- restorable.

Provide:

- History;
- Restore when available;
- return to remaining plan items.

---

## 14. Storage Cleanup V2

### 14.1 Authority

Final UI uses durable Analysis Run/Finding as truth.

Legacy scan/candidate structures may be adapted internally but must not independently drive visible lifecycle after migration.

### 14.2 Flow

#### Step 1 — Choose scope

Show:

- quick locations;
- chosen path;
- Start Scan.

Do not show results, filters or AI controls before scanning.

#### Step 2 — Analyze

Show:

- current phase;
- progress;
- current scope;
- Cancel;
- which results remain available if the run is partial.

#### Step 3 — Review findings

Tabs or filters:

- Safe to Clean;
- Needs Confirmation;
- Caution.

Safe findings may be preselected when backend policy allows.

Caution is never preselected.

Each finding shows:

- what it is;
- why it was found;
- size;
- confidence;
- evidence summary;
- whether it is executable;
- reveal action.

#### Step 4 — Confirm

Sticky action bar:

```text
12 selected · 4.6 GB
[Move to Safe Trash]
```

Confirmation explains:

- files move to Safe Trash;
- restore is available;
- any non-restorable exceptions.

#### Step 5 — Result

Show:

- moved;
- skipped;
- failed;
- reclaimed estimate;
- History/Restore.

### 14.3 AI assistance

AI is optional contextual review.

One action:

> Recheck items that need confirmation

Do not expose overlapping “analyze all / risk / selected” controls in the default surface.

Advanced detail may retain bounded targeted modes if required for expert workflows.

---

## 15. Preview & Execute

### 15.1 Header

Source-aware back action:

- Back to Organize Plan;
- Back to Storage Cleanup.

### 15.2 Default summary

At most four values:

- selected;
- executable;
- needs attention;
- estimated impact.

### 15.3 Safety detail

One disclosure contains:

- blocked;
- confirmation required;
- parent folders created;
- low confidence;
- sensitive/system;
- duplicate;
- cross-volume;
- truncation/pagination.

### 15.4 Rows

Group by meaningful user destination or action.

Row states:

- selected;
- unselected;
- blocked;
- changed;
- unavailable.

### 15.5 Execution

Primary action is replaced by progress.

Cancellation and result states remain visible and announced.

---

## 16. History and Restore

### 16.1 Default filters

- All;
- Restorable;
- Needs Attention.

Additional filters use a Popover.

### 16.2 Event row

Show:

- user outcome;
- date/time;
- item count;
- operation source;
- restore availability.

Technical IDs and journal phases remain disclosed.

### 16.3 Restore

Restore flow explains:

- what can be restored;
- conflicts;
- new destination when original location is unavailable;
- partial results.

---

## 17. Automation V2

### 17.1 Default workspace

Header:

- Automation;
- Create Rule.

Body:

- compact enabled/paused summary;
- Rule Library;
- active rule Inspector;
- last run feedback only when relevant.

Remove the permanent four-card dashboard.

### 17.2 Create Rule

Choice dialog or start page:

- Describe with natural language;
- Build manually.

### 17.3 Natural-language proposal

Steps:

1. describe rule;
2. generation;
3. review candidate;
4. preview impact;
5. resolve exact count if required;
6. apply as disabled;
7. return to Rule Library.

Review shows user-facing:

- what matches;
- classification before/after;
- risk;
- broad match warning;
- scope health;
- conflicts.

Technical validator facts remain in detail.

### 17.4 Rule lifecycle

Apply, Enable and Run remain separate.

The UI never implies that applying a proposal has changed files.

---

## 18. Content Understanding V2

### 18.1 Entry

Opened from File Library Inspector or context menu.

### 18.2 Side Sheet structure

1. status summary;
2. permission and policy;
3. preview;
4. run progress/result;
5. artifact summary;
6. recent runs;
7. data management.

### 18.3 Consent language

Always distinguish:

- local extraction;
- provider understanding;
- retained extracted text;
- source file unchanged.

### 18.4 Actions

Depending on state:

- Enable for this folder;
- Preview local extraction;
- Start local run;
- Review provider disclosure;
- Confirm provider understanding;
- Rebuild;
- Delete content data;
- View recent runs.

### 18.5 Limits

Unsupported formats and OCR-only files receive a clear explanation.

Do not suggest unavailable OCR/RAG features.

---

## 19. Settings V2

### 19.1 Structure

Split into section components:

- General;
- Appearance;
- File Sources;
- Global Search;
- Managed Library;
- Automation;
- AI;
- Privacy & Content;
- Developer Diagnostics;
- About.

### 19.2 Global Search

Show:

- global hotkey;
- source list;
- source status;
- pause/resume;
- rebuild;
- permission guidance.

Platform-specific details use disclosure.

### 19.3 Managed Library

Show:

- scan roots;
- watcher health;
- background scanning;
- managed scopes;
- root-specific health.

### 19.4 AI

Normal:

- Off / Local / Cloud;
- Provider;
- Model;
- Credential;
- Test Connection;
- Save.

Advanced:

- endpoint;
- request path;
- timeout;
- tokens;
- concurrency;
- JSON;
- thinking.

Developer:

- Request Trace;
- export;
- clear;
- debug classification.

### 19.5 Privacy & Content

Show:

- which roots allow content reading;
- local extraction;
- cloud understanding permission;
- retained text;
- deletion/purge controls.

---

## 20. Onboarding

Three core steps:

1. Find files across the computer
2. Choose folders Zen Canvas manages
3. Choose AI and content privacy

Allow:

- skip advanced setup;
- open settings later;
- reopen onboarding.

Explain that system-wide search does not automatically grant AI/content access.

---

## 21. Accessibility

### 21.1 Keyboard

Global Search:

- arrows;
- Enter;
- Ctrl/Cmd+Enter;
- Escape.

File Library:

- arrows;
- Home/End/Page;
- Ctrl/Cmd+A;
- Shift range;
- Space/Enter preview;
- context menu;
- Escape hierarchy.

Organize and Cleanup:

- tab/segmented navigation;
- row navigation;
- selection;
- contextual actions;
- confirm/cancel.

### 21.2 Focus

- opening a Sheet focuses its heading or primary field;
- closing returns to the trigger;
- narrow pane transitions preserve selected context;
- async refresh does not steal focus;
- removed rows move focus predictably.

### 21.3 Announcements

Announce:

- result counts;
- deferred counts resolved;
- partial data;
- stale invalidation;
- background completion;
- execution results.

---

## 22. Responsive states

### 22.1 1180px and above

- split panes;
- full sidebar;
- standard toolbars.

### 22.2 980–1179px

- reduced sidebar width;
- Inspector may become toggleable pane;
- toolbars wrap intelligently;
- page titles and primary actions remain visible.

### 22.3 980×680 minimum

- no horizontal document overflow;
- critical actions reachable;
- sticky action bars do not cover rows;
- dialogs fit within viewport;
- Settings navigation remains usable;
- Side Sheets may become full workspace panes.

---

## 23. Motion

Use motion only for:

- Global Search expand/collapse;
- Sheet/Dialog transitions;
- compact state changes;
- progress.

No scale animation on dense list rows.

Respect Reduced Motion globally.

---

## 24. Hard release gates

V4.3 cannot be marked complete unless:

- Storage Cleanup is in main navigation;
- Organize is user-facing “Organize Files”;
- Global Search and File Library Search are clearly distinct;
- `no_source` is distinct from ordinary Global Search empty;
- punctuation-bearing queries retain literal meaning;
- mounted IME behavior remains correct;
- renderer-side UI preserves backend file-result order;
- Overview reads actual Global Index health;
- each migrated workspace has one authority;
- no authoritative plan grouping is calculated from a loaded page;
- Organize defaults to group-first and exception-first;
- blocked items are separated from user decisions;
- Cleanup defaults to durable Analysis Run/Finding;
- Preview default summary is compact;
- Automation defaults to Rule Library;
- legacy Rule command wrappers remain absent;
- Rule Proposal is a dedicated creation/review flow;
- Content Understanding is moved out of the narrow Inspector;
- Settings is split into section components;
- watcher permission, reconciliation, partial and retry-exhausted states remain distinct;
- duplicate page titles are removed;
- user-visible hardcoded English/Chinese is removed;
- Provider Registry, Model Discovery and Request Trace remain available;
- no filesystem safety boundary is weakened;
- no Schema 35 or forbidden architecture is introduced;
- keyboard flows work;
- Light/Dark and Chinese/English are verified;
- 980×680 is usable;
- repository test, performance, Rust, security and build gates pass;
- current CI fast/full validation governance remains valid;
- unavailable native checks are recorded honestly.
