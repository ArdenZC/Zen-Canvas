# SpacePeek and Lightweight Quick-Preview Utilities — Research Notes

Primary verified source:

- SpacePeek App Store: https://apps.apple.com/us/app/spacepeek/id6777129953?mt=12

Audit snapshot: see [`SOURCE_SNAPSHOTS.md`](SOURCE_SNAPSHOTS.md).

> **Provenance:** this note is a 2026-08-17 reconstruction of the Zen research conclusion. SpacePeek's current App Store behavior was re-verified during the audit (version 1.4 visible at audit time). The exact original product/source behind the earlier conversation label **“Super Quick Look”** was not preserved and remains deliberately unattributed.

## Why we studied this category

The earlier research started from macOS Quick Look limitations and utilities that extend the “select something, press Space, understand it immediately” workflow.

SpacePeek was especially useful because it demonstrates that **folders themselves can be useful Preview subjects**, not merely containers that must first be opened in Finder.

The research question was:

> How much folder/project understanding can Zen provide on demand without turning Preview into a background indexer or a disk-analysis product?

## Re-verified SpacePeek facts

At the 2026-08-17 audit, SpacePeek's App Store description says it adds folder previews to Finder Quick Look and can show, on demand:

- total folder size;
- largest files/subfolders;
- file/folder counts;
- storage breakdown;
- a browsable/sortable contents/tree view;
- Finder labels;
- deeper folder drill-in in the paid tier;
- previews of multiple content types;
- developer-project hints such as Git repositories, branches and build output.

The listing also describes the scan as local/read-only, limited to the folder being previewed, with no background index/uploads/analytics/tracking.

These are current product facts at the audit date. Zen's progressive `FolderSummary`, scheduling and authority boundaries below are design conclusions drawn from the product pattern, not claims about SpacePeek's internal implementation.

## Main observations

### 1. Folder Preview can be genuinely useful

A folder preview does not need to be a blank icon or merely a list of children.

Useful immediate context includes:

- top-level entries;
- known metadata;
- file/folder counts when cheap;
- approximate/progressive size information;
- largest items;
- file-type distribution;
- project/repository hints.

This became Zen's `FolderSummary` direction.

### 2. On-demand analysis does not require durable indexing

SpacePeek validates the product value of scanning **only the folder being previewed**.

Zen therefore separated:

```text
Managed Library indexing
```

from:

```text
Ephemeral / Preview-time bounded folder enrichment
```

Folder Preview must not silently create a managed scan root or database truth just because the user pressed Space.

### 3. Exact analytics must not block the Preview shell

Recursive folder size and project analysis can be expensive.

Zen's design response was progressive:

```text
Preview shell
-> immediate known metadata / top-level content
-> progressive analytics
-> exact/deeper results only when available and still wanted
```

At 100k entries, shell/content publication must not wait for exact recursive statistics.

### 4. Git/project detection is enrichment, not identity

Detecting a Git repository or build output can make Folder Preview much more useful, but it should not become a prerequisite for opening Preview.

The reconstructed design direction was:

- bounded/cancellable Git enrichment;
- background/interactive resource budgeting;
- no recursive unlimited branch/repository analysis;
- closing/switching Preview revokes publication rights.

### 5. “Super quick preview” is about preserving flow

The broader lightweight-preview pattern reinforces the same interaction principle:

- do not launch a heavy application just to inspect a file;
- Space should reveal useful content immediately;
- longer text/code can benefit from a purpose-built scrollable representation when the native Quick Look rendering is weak;
- close/switch should be cheap and non-destructive.

This is a product lesson, not authorization to make Zen a document editor.

## Adopted by Zen

- Folder as a first-class Preview subject;
- `FolderSummary` representation;
- on-demand local analysis without required durable indexing;
- immediate shell + progressive analytics;
- largest-item/type-distribution/project hints as enrichment;
- bounded Git/project detection;
- read-only local-first folder preview.

## Adapted, not copied

Zen's Folder Preview must integrate with:

- W1 WorkScheduler;
- Ephemeral Browse identities/generation;
- Preview cancellation/publication rules;
- managed Library authority where the folder is already managed.

A standalone Quick Look utility can own its whole scanning loop; Zen cannot let Folder Preview create a parallel indexing/search truth.

## Explicitly rejected

- running exact recursive analytics before showing Preview;
- turning every previewed folder into a managed Library location;
- using folder Preview as a second disk-indexing engine;
- unbounded Git/branch/build-output discovery;
- persisting ephemeral Preview snapshots merely to make repeat previews fast;
- expanding W3 Preview into a general file editor.

## Original “Super Quick Look” attribution — unresolved

The original discussion used the label **“Super Quick Look”** for a Quick-Look-enhancement utility/category. The canonical upstream URL/product identity was not preserved.

This audit deliberately does **not** substitute a contemporary product and claim it was the original reference. Until a reliable original source is recovered, the durable evidence is only the low-friction preview interaction pattern, not a named upstream implementation.

## Downstream influence

- W0-D `FolderSummary` representation;
- W0-E progressive enrichment and scheduler boundaries;
- W0-F 1k/10k/100k Folder Preview QA;
- W3 Folder provider;
- W3 rapid-switch/cancellation behavior;
- W4 system-host integration where appropriate.

## Design statement preserved from the reconstructed research

> Folder preview should answer “what is this folder?” quickly, progressively and read-only. It should not answer that question by secretly building another index.