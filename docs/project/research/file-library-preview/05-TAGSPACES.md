# TagSpaces — Research Notes

Official source: https://github.com/tagspaces/tagspaces

Audit snapshot: see [`SOURCE_SNAPSHOTS.md`](SOURCE_SNAPSHOTS.md).

> **Provenance:** this note is a 2026-08-17 reconstruction of the Zen research conclusion. Current TagSpaces product/scale/license facts were re-verified at the pinned snapshot; Zen's perspective/Thumbnail decisions remain Zen design inferences.

## Why we studied it

TagSpaces was a useful reference for the **local-first file-organizer** side of Zen: tags, multiple perspectives/views, viewers and thumbnail generation over ordinary local files.

The research question was:

> How can Zen offer richer ways to organize and inspect local files without turning the main file surface into a feature-heavy document-management suite?

## Re-verified official-source facts

TagSpaces describes itself as an offline/open-source document manager and file organizer. Its README documents local file/folder management, tagging/search, multiple viewers/editors, and a local service involved in search-index and thumbnail generation.

The README also explicitly warns that the application is not optimized for locations containing more than 100,000 files.

Its current licensing is dual: the open-source application is AGPL-3.0 with a commercial licensing path, while Pro functionality includes proprietary components. The exact audit snapshot is recorded separately.

Source: https://github.com/tagspaces/tagspaces

## Main observations

### 1. Multiple perspectives can share the same underlying files

One set of files can be presented as:

- list;
- gallery/grid;
- tag-oriented view;
- other specialized perspectives.

Zen adopted the principle that **Library/Browse source mode and List/Grid presentation are orthogonal dimensions**.

### 2. Viewer modularity is useful

Different file types benefit from different viewers/providers. This reinforced the Preview Provider model and the decision not to hard-code rendering behavior into File Library rows/cards.

### 3. Thumbnail generation is shared infrastructure

Thumbnails are useful in multiple surfaces, not only a gallery:

- List/Grid;
- Inspector;
- Preview placeholder;
- Folder Preview.

This directly supported the W1-08 shared ThumbnailService decision.

### 4. Offline-first/local-file workflows align with Zen's product values

TagSpaces validates that powerful file organization can work without requiring users to upload their files to a proprietary cloud.

Zen keeps local-first behavior as the default and treats network/provider/cloud locations as explicit capabilities rather than the normal storage assumption.

### 5. Feature breadth can overwhelm the core browsing job

TagSpaces includes editors, note-taking and many specialized views. Those capabilities are useful for its product, but the research reinforced a Zen guardrail:

> Do not expose every possible file capability in the main File Library surface.

Zen's default experience should remain calm and progressive-disclosure oriented.

### 6. 100k scale needs an explicit architecture gate

The upstream >100k warning was especially relevant because Zen already has 100k/1M managed-library performance targets.

We therefore rejected an architecture where all rich perspectives, thumbnails or folder analytics assume that the entire result set is already materialized in memory/UI.

## Adopted by Zen

- List/Grid/perspective as presentation over a source, not a new authority;
- viewer/provider modularity;
- shared thumbnail infrastructure;
- local-first design;
- tags/semantic organization as useful managed-Library concepts;
- explicit performance gates for large collections.

## Adapted, not copied

Zen does not inherit TagSpaces' metadata storage or editor model.

TagSpaces supports filename/sidecar metadata approaches; Zen keeps its own existing managed-library/database authorities and does not create a new sidecar system merely to imitate another organizer.

## Explicitly rejected

- turning Zen into a general document editor/note-taking suite;
- exposing every perspective/control at once;
- assuming rich views are safe to render for 100k+ items without virtualization/windowing;
- adopting TagSpaces metadata persistence as a new Zen authority;
- allowing thumbnail workers to bypass Zen's Scheduler/Read Gate.

## Downstream influence

- W0-B Library/Browse + presentation separation;
- W0-E shared Thumbnail infrastructure;
- W0-F 100k UI/thumbnail gates;
- W1-08 Thumbnail Infrastructure;
- W2 List/Grid/Inspector design;
- W3 modular built-in Preview providers.

## Design statement preserved from the reconstructed research

> Rich perspectives are valuable when they are projections over stable file truth. Zen should borrow the modular-view lesson while keeping the default workspace simpler and more scalable than a do-everything document manager.