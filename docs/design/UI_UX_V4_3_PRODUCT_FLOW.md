# Zen Canvas UI/UX V4.3 Product Flow

> Product Integration & Clarity
> This document defines the user mental model, workspace ownership and end-to-end flows.

---

## 0.1 V4.3.1 baseline

This flow is based on:

```text
master@9ea69d29143b994c8632747ab647f59637dfe324
```

It includes the accepted verification fix at:

```text
98ca8185979feb5b0f450a076362c089675416b5
```

The fix establishes stable Global Search order, literal punctuation search, mounted IME behavior, a distinct `no_source` state, separate watcher reconciliation language, Rule Repository V2-only mutation and the current CI governance.

---

## 1. Product mental model

Zen Canvas has three concentric levels.

### Level 1 — Searchable

The Global Index lets the user find files across the computer.

A searchable file is not automatically managed, classified or readable by AI.

### Level 2 — Managed

The File Library contains files from locations the user has admitted to Zen Canvas management.

Managed files may have:

- classification;
- user tags;
- Saved View membership;
- duplicate findings;
- organization suggestions;
- storage findings;
- automation rules.

### Level 3 — Content-enabled

Content Understanding is enabled only for managed roots with explicit consent.

It may produce bounded local artifacts and, only with an explicit confirmation, use the configured provider.

The UI must never collapse these three levels into one.

---

## 2. Authority map

```text
Global Search
  └── Global Index

File Library
  └── File Query V2
      ├── Tags
      ├── Saved Views
      ├── Selection
      ├── Duplicate summary
      └── Content status

Organize Files
  └── Organization Plan
      └── Dry Run
          └── Operation Preview
              └── Operation Journal

Storage Cleanup
  └── Analysis Run / Finding
      └── Safe Trash
          └── Cleanup Journal

Automation
  ├── Rule Repository
  └── Rule Proposal

Content Understanding
  ├── Content Scope Policy
  ├── Content Run
  └── Content Artifact
```

---

## 3. Main navigation flow

```text
Overview
File Library
Organize Files
Storage Cleanup
History
────────────
Automation
Settings
```

### 3.1 Why Storage Cleanup is primary

Storage Cleanup is a core user job, not a hidden utility.

Users must be able to discover it without:

- first running a scan;
- understanding an old Hub page;
- finding a disabled button;
- opening Settings.

### 3.2 Internal flows

Preview & Execute, Content Understanding and Rule Proposal are entered from their owner workspace and return to that owner.

---

## 4. First-run flow

### Step 1 — Welcome

Message:

> Zen Canvas helps you find, understand and organize files safely.

Actions:

- Continue;
- Not now.

### Step 2 — Search coverage

Explain:

- system-wide search uses local filesystem metadata;
- search coverage differs by Windows/macOS permissions;
- search does not grant content or cloud access.

Action:

- Enable global search;
- Configure later.

### Step 3 — Managed locations

The user chooses folders for the File Library.

Explain:

- these folders may be scanned and classified;
- file changes still require review;
- roots can be changed later.

### Step 4 — AI and content privacy

Choices:

- AI off;
- local AI;
- online AI.

Content reading remains a separate control.

Finish opens Overview.

---

## 5. Overview flow

### 5.1 Entry question

> What needs my attention?

### 5.2 Priority ordering

1. permission or source failure preventing search;
2. active/failed filesystem operation;
3. Organization Plan decisions;
4. Cleanup findings;
5. failed/stale Content Run;
6. stale managed root;
7. no urgent work.

### 5.3 User actions

Examples:

- Review search sources;
- Continue organizing;
- Review cleanup;
- Restore changes;
- Choose managed folders.

### 5.4 No-action state

Show a calm “Everything is up to date” state with small secondary navigation, not a dashboard full of zeroes.

---

## 6. Global Search flow

### 6.1 Open

- click titlebar search;
- press global shortcut;
- use standalone native window.

### 6.2 Empty query

Show a few commands:

- Open File Library;
- Organize Files;
- Storage Cleanup;
- Settings;
- rebuild or review search sources only when relevant.

### 6.3 Query

The renderer commits the query only after IME composition finishes.

During active composition:

- intermediate pinyin does not call the backend;
- Enter and navigation keys do not activate or move results;
- one final query is issued after `compositionend`.

Punctuation is preserved. The renderer does not strip or broaden:

```text
.gitignore
.env
C++
report!
[name]
file*
what?
```

Backend returns:

- ranked results;
- source snapshot;
- completeness;
- revision.

### 6.4 Result states

#### Complete

All enabled sources are current.

#### Partial

Useful results exist, but one or more sources are incomplete.

The user can still open results.

#### Pending

Indexing or source state is changing.

Show available results without claiming completeness.

#### Empty

Enabled sources are available, but no item matches.

Message:

> No matching files were found. Try another name or keyword.

#### No source

No Global Index source is enabled.

Message:

> No searchable locations are configured.

Action:

- Set up search locations.

This is not an ordinary empty result.

#### Failed

No authoritative result set can be provided.

### 6.5 Managed indicator

A result may show:

- Managed;
- not managed.

“Not managed” is neutral, not an error.

### 6.6 Actions

- Open;
- Reveal;
- Manage this location, when supported;
- Review search sources.

No AI/content action is offered directly for unmanaged files.

---

## 7. File Library flow

### 7.1 Entry

The File Library opens the last valid query or a safe default managed scope.

### 7.2 No managed locations

Show:

> Choose folders for Zen Canvas to manage.

Action:

- Choose folders.

Do not show an empty advanced toolbar.

### 7.3 Query

The user may:

- search;
- choose scope;
- open a Saved View;
- apply filters;
- sort;
- switch density.

Query execution remains backend-authoritative.

### 7.4 Snapshot expired

Keep current rows visible.

Show a nonblocking banner:

> The library changed. Refresh to update this view.

All-matching selection becomes invalid; explicit selection may remain if still valid.

### 7.5 Select files

#### Explicit selection

Selected loaded or directly identified files.

#### All matching

The backend query result is selected, with exclusions.

The UI shows:

- exact or deferred total;
- exclusions;
- size summary;
- common properties.

### 7.6 Actions

Selection actions:

- Create Organization Plan;
- add/remove tags;
- open duplicate review;
- start approved content flow;
- clear selection.

File mutation is not performed directly from a generic selection toolbar.

### 7.7 Single-file Inspector

The user can:

- preview metadata;
- reveal;
- edit user tags;
- see current classification;
- see duplicate/content status;
- add to an Organization Plan.

### 7.8 Content Understanding entry

The user selects “Open Content Understanding”.

The Side Sheet preserves File Library context.

---

## 8. Content Understanding flow

### 8.1 No root policy

Show:

> Content reading is off for this folder.

Explain:

- source files do not change;
- local extraction is separate from online AI;
- retained text is off by default.

Action:

- Review permission.

### 8.2 Enable policy

The user chooses:

- allow local extraction;
- allow provider understanding;
- retain extracted text, optional.

Save uses the existing root/policy revision contract.

### 8.3 Preview

Before reading:

- selected file count;
- supported/unsupported;
- estimated budgets;
- local/provider mode;
- retention;
- exact/deferred state.

### 8.4 Start local run

Explicit confirmation starts Content Run.

Progress shows:

- preparing;
- extracting;
- completed;
- unsupported;
- failed;
- canceled.

### 8.5 Provider understanding

A separate preview and confirmation explains exactly what bounded content may be sent.

Sensitive/System/blocked items remain excluded.

### 8.6 Result

Show:

- summary;
- keywords;
- language;
- truncation;
- provenance;
- current/stale.

### 8.7 Data management

- Rebuild;
- Delete content data;
- view recent runs.

Deleting content data does not delete the source file.

---

## 9. Organization Plan flow

### 9.1 Create plan

Entry from File Library selection.

The user may name the plan.

Backend materializes the authoritative selection.

### 9.2 Building state

Show:

> Creating the plan…

If count is deferred or scope health changes, show the truthful result and next action.

### 9.3 Plan overview

The default Plan tab shows complete backend-derived groups.

Examples:

```text
Teaching / Database
86 files · 2.4 GB
Move and rename · High confidence

Screenshots / 2026-07
142 files · 1.8 GB
Move only · High confidence
```

### 9.4 Group decision

The user may:

- include;
- exclude;
- change destination;
- expand;
- edit an exception.

Backend resolves the group against the current Plan revision.

If facts changed, fail with a user-facing refresh requirement.

### 9.5 Needs My Decision

The tab only contains items or groups with a meaningful user choice.

#### Low confidence

Actions:

- use suggestion;
- choose destination;
- keep in place;
- analyze missing.

#### Possible duplicate

Actions:

- open duplicate review;
- keep;
- exclude.

No direct delete.

#### Sensitive

Actions:

- keep;
- move to a chosen safe destination;
- exclude.

#### Name conflict

Actions:

- safe auto-name;
- edit base name;
- move without rename;
- keep.

#### Unsafe extension change

Actions:

- preserve original extension;
- move without rename;
- edit safe base name;
- keep.

#### Changed facts

Actions:

- refresh suggestion;
- keep;
- remove from plan.

### 9.6 Cannot Be Processed Yet

Examples:

- missing permission;
- source unavailable;
- unsupported action;
- invalid preview;
- ambiguous execution recovery.

Actions are recovery-oriented, not false decisions.

### 9.7 Review execution

The user selects “Review execution”.

Backend produces Dry Run.

If some approved items are no longer valid:

- keep valid facts;
- show excluded/changed count;
- return the user to specific exceptions.

### 9.8 Confirm execution

The confirmation explains:

- number of operations;
- move/rename breakdown;
- conflict handling;
- restore availability.

### 9.9 Result

Show:

- completed;
- skipped;
- failed;
- restorable.

The Plan remains durable and shows remaining work.

---

## 10. Storage Cleanup flow

### 10.1 Entry

Main navigation, Overview or Global Search command.

### 10.2 Choose scope

Options:

- Downloads;
- Desktop;
- Documents;
- Temporary files;
- Choose folder.

One primary action:

- Scan this location.

### 10.3 Active analysis

Show Analysis Run status and detector progress.

Cancel requests do not pretend to be instant; show “Canceling…” until confirmed.

### 10.4 Partial run

If some detectors fail:

- preserve published findings;
- label the result partial;
- show failed detector count in detail;
- allow retry.

### 10.5 Review

#### Safe to Clean

- precise evidence;
- executable;
- may be preselected.

#### Needs Confirmation

- ambiguous or user-sensitive;
- not automatically selected unless previously explicitly approved.

#### Caution

- potentially risky;
- never preselected;
- may be non-executable.

### 10.6 Recheck with AI

One contextual action for the Needs Confirmation set.

The result may only downgrade safety or add context; it cannot silently authorize a risky deletion.

### 10.7 Confirm Safe Trash

Show selected count and size.

Use “Move to Safe Trash”, not “Delete”.

### 10.8 Result and restore

Provide History/Restore entry.

---

## 11. Preview & Execute flow

### 11.1 Owner context

The surface knows its source:

- Organize;
- Cleanup.

### 11.2 Review

Show:

- concise summary;
- grouped operations;
- changed/blocked rows;
- optional safety detail.

### 11.3 Execute

The primary button becomes progress.

### 11.4 Partial completion

Keep:

- successful journal facts;
- failed/skipped rows;
- retry or return actions.

Never clear successful facts because some items failed.

---

## 12. History flow

### 12.1 Browse

Default list is chronological and user-oriented.

Filters:

- All;
- Restorable;
- Needs Attention.

### 12.2 Detail

Show:

- source workspace;
- operation summary;
- item results;
- restore state;
- technical detail disclosure.

### 12.3 Restore

The user reviews conflicts and confirms.

After restore:

- show completed/partial;
- preserve operation history.

---

## 13. Automation flow

### 13.1 Rule Library entry

The page defaults to existing rules.

The user can:

- inspect;
- enable/disable;
- edit;
- delete;
- run enabled rules with confirmation;
- create rule.

### 13.2 Create rule

Choose:

- Describe with natural language;
- Build manually.

### 13.3 Describe rule

The user enters a prompt.

The UI explains:

- only the prompt is sent;
- file contents are not sent for Rule Proposal;
- AI can only propose.

### 13.4 Review proposal

Show:

- matched scope;
- before/after classification;
- conflicts;
- risk;
- broad match;
- exact/deferred count.

If clarification is required, ask for clarification within the proposal flow.

### 13.5 Apply

“Apply as disabled rule”.

After Apply:

- return to Rule Library;
- highlight new/updated disabled rule;
- offer Review and Enable;
- do not auto-run.

### 13.6 Run rules

Run uses backend catalog authority.

The result can become stale if rules or scope change.

---

### 13.7 Rule API boundary

All rule mutation uses Rule Repository V2.

Global Search may open Automation or the Create Rule flow, but cannot create, apply, enable, run or delete a rule directly.

Legacy whole-object Rule commands are not valid user-flow paths.

## 14. Settings flow

### 14.1 Navigation

Settings has a stable left section list or equivalent desktop navigation.

### 14.2 General and Appearance

- language;
- theme;
- density;
- close behavior;
- startup.

### 14.3 File Sources

- managed roots;
- scan health;
- watcher status;
- background scanning.

### 14.4 Global Search

- hotkey;
- source status;
- pause/resume;
- rebuild;
- platform permission help.

### 14.5 Managed Library

- managed scopes;
- local/cloud policy;
- root health.

### 14.6 AI

Normal setup first.

Advanced and Developer remain disclosed.

### 14.7 Privacy & Content

Root-specific content policies and deletion controls.

### 14.8 Save behavior

Settings with unsaved changes show a sticky Save bar.

Immediate settings must be clearly distinguished from staged settings.

---

## 15. Cross-workspace status language

### 15.1 Partial

Meaning:

> Some useful facts are available, but the result is incomplete.

The UI preserves usable results.

### 15.2 Stale

Meaning:

> The source changed after this result was created.

The UI requires refresh or revalidation.

### 15.3 Blocked

Meaning:

> Zen Canvas cannot safely continue without a system or data condition changing.

Do not place blocked items in a decision list unless the user can actually change the condition.

### 15.4 Needs decision

Meaning:

> Zen Canvas has enough information to offer two or more meaningful outcomes.

### 15.5 Canceled

Meaning:

> The cancellation request was confirmed.

“Canceling” remains separate until backend confirmation.

---

## 15A. Managed-root health recovery

### Permission required

Zen Canvas cannot access the location.

Action:

- Grant access;
- disable or remove the location when appropriate.

### Reconciliation required

Watched changes and durable managed-library facts must be synchronized.

Existing valid data remains usable.

Action:

- Sync now;
- review the affected location.

Do not describe this as retry exhaustion.

### Partial

Some managed data remains usable, but coverage is incomplete.

Action:

- Review affected locations.

### Retry exhausted

Automatic retry did not recover the root.

Action:

- Retry;
- inspect technical details;
- review permissions when relevant.

---

## 16. Error recovery

Errors must specify:

- which results remain usable;
- which action failed;
- whether retry is safe;
- whether the user should review permissions or refresh facts.

Examples:

### Global Search no source

> No searchable locations are configured. Add a search location to use system-wide search.

### Global Search partial source

> Results from other locations are still available. One location needs permission.

### Organization Plan stale

> 12 suggestions changed since this plan was created. Refresh them before execution.

### Cleanup detector failure

> 238 findings are available. One detector failed and can be retried.

### Content provider failure

> Local content data is still available. Online understanding did not complete.

---

## 17. Return paths

Every internal surface has an explicit return path.

| Internal surface | Returns to |
| --- | --- |
| Preview & Execute | initiating Organize or Cleanup state |
| Content Understanding | File Library with selection preserved |
| Rule Proposal | Rule Library |
| Tag/Saved View management | File Library query preserved |
| technical diagnostics | originating Settings section |
| Restore detail | History list |

---

## 18. Flow acceptance tests

### Global Search

- IME sends only committed query;
- partial sources preserve results;
- unmanaged result never shows managed AI facts;
- open/reveal uses ID-only backend action.

### File Library

- query and selection survive normal navigation;
- snapshot expiration keeps rows;
- all-matching invalidates correctly;
- deferred counts are not guessed;
- Inspector opens Content Sheet without losing selection.

### Organize

- groups represent complete plan ledger;
- group mutation revalidates plan revision;
- blocked does not appear as a false choice;
- group approval still produces item-level Dry Run;
- restart restores active plan.

### Cleanup

- one visible lifecycle authority;
- durable run restores after remount/restart;
- partial results stay usable;
- Caution is never preselected;
- Safe Trash confirmation is explicit.

### Automation

- Rule Library is default;
- proposal is a dedicated flow;
- Apply does not Enable or Run;
- stale run results are rejected.

### Content

- no read before preview and confirmation;
- local/provider modes are distinct;
- deleting content data leaves source unchanged;
- unsupported formats are truthful.

### Settings

- section routing works from Global Search;
- technical diagnostics remain disclosed;
- unsaved staged settings are not lost silently.
