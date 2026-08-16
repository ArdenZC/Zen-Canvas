# Files — Research Notes

Official source: https://github.com/files-community/Files

## Why we studied it

Files was the strongest Windows UX reference in the first two research rounds because Zen must treat Windows users as first-class rather than exposing a macOS-inspired shell with Windows file APIs underneath.

The research question was:

> Which parts of Explorer familiarity should Zen preserve, and which parts should remain Zen-specific?

## Official-source facts that mattered

Files describes itself as a modern Windows file manager built around Windows-native integrations and a Windows-focused UX. Its value as a reference is therefore not that Zen should clone it, but that it provides a mature example of how Windows users expect navigation, breadcrumbs, view modes and file operations to feel.

## Main observations

### 1. Familiar filesystem navigation is a product asset

Users often already have years of muscle memory around:

- Back / Forward;
- breadcrumb/path navigation;
- List/Grid style switches;
- per-folder presentation expectations;
- selection/focus behavior;
- open/reveal/context actions.

Zen should not require users to abandon that model merely because Library Mode offers a higher-level semantic organization system.

This directly reinforced the decision to make **Browse Mode first-class**.

### 2. Library and Browse should share navigation semantics without sharing authority

The second research round concluded that Zen should use a common `NavigationTarget` concept so Library views and Browse paths can participate in one Back/Forward history.

That does **not** mean Library and Browse use one backend truth source. It means the shell can navigate across both without creating two disconnected products.

### 3. Presentation preferences belong to targets/history, not one global app toggle

List/Grid, sort and similar presentation choices should be remembered per meaningful target when possible.

A user may prefer:

- Grid for Pictures;
- List for Downloads;
- a different presentation for a saved Library view.

This became the W1/W2 per-target presentation-state direction.

### 4. Breadcrumbs must degrade gracefully in narrow windows

The research favored a responsive breadcrumb that collapses older ancestors first while keeping the current location and nearest parents readable.

The goal is not to display every path component at all costs. The goal is to preserve orientation and make the current context actionable.

### 5. Windows visual/interaction conventions should remain Windows conventions

Zen may share the same product concepts across platforms, but Windows should not receive Finder-specific chrome or macOS-only interaction assumptions.

## Adopted by Zen

- first-class Browse Mode for users who prefer a traditional filesystem mental model;
- shared `NavigationTarget` / Back/Forward history across Library and Browse;
- per-target List/Grid/presentation preferences;
- responsive breadcrumb ancestor collapse;
- Windows-specific platform adaptation rather than macOS emulation;
- familiar selection/focus/open/reveal behavior as a baseline for W2.

## Adapted, not copied

Zen is not trying to be a full Explorer replacement.

The product adds:

- semantic managed Library views;
- file-governance workflows;
- safe Preview/Thumbnail infrastructure;
- analysis/dedupe/recovery capabilities;

around the user's filesystem.

Therefore the Windows shell should feel familiar without reproducing every Explorer feature, command or layout.

## Explicitly rejected

- building W2 as an Explorer clone;
- forcing Windows users into a Finder-shaped UI;
- using UI convenience as an excuse to merge Query V2 and Ephemeral Browse authority;
- implementing unmanaged recursive/global search merely because a file manager may expose broad search;
- making presentation state one global setting shared by every folder/view.

## Downstream influence

- W0-B Product / IA;
- W1-02 Workspace Navigation;
- W2 workspace shell and navigation;
- W2 List/Grid and per-target preferences;
- Windows-specific QA and interaction rules.

## Design statement preserved from the research

> Zen should feel like it respects the user's existing Explorer habits while offering a higher-level Library when the user wants it. Familiarity is a bridge into Zen, not a legacy behavior to remove.