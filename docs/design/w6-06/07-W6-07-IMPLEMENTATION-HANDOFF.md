# W6-07 Core Experience Reconstruction — Implementation Handoff

**Status: HANDOFF READY — W6-07 NOT YET ACTIVATED**

## Objective

Reconstruct the Zen Canvas presentation layer toward the frozen V26 target while preserving durable backend, filesystem, Query, Preview, provider, restore and safety authorities.

Working rule:

> **Preserve the engine; rebuild the cockpit.**

## Materialize the frozen V26 target first

A fresh checkout must rebuild and verify the owner-approved target before implementation review:

```bash
python docs/design/w6-06/07-v26/rebuild-v26.py --verify-only
python docs/design/w6-06/07-v26/rebuild-v26.py --out outputs/w6-06-v26-rebuilt
```

The first command must report four `PASS` lines matching `07-V26-FREEZE-MANIFEST.md`. The second materializes the exact Main, Windows, macOS and Desktop Quick Search HTML targets for side-by-side implementation review.

Do not substitute an older specimen, screenshot, local-only copy or newly improvised design for these checksum-bound V26 targets.

## Phase 1 — Tokens, primitives, native shell

Implement the shared presentation foundation first:

- production color/type/spacing/radius/elevation/motion roles;
- Button / IconButton / Search / Zen Select / Switch;
- Menu / Context Menu / Dialog / overlay foundations;
- FileRow / GridTile state primitives;
- Windows native titlebar/caption integration;
- macOS native titlebar/toolbar integration;
- focus-state and reduced-motion foundations.

Do not begin by rewriting every page.

**First gate:** code/browser evidence that the primitives reproduce the frozen V26 metrics/states without changing feature authority.

## Phase 2 — Files flagship workspace

Implement the first complete production target:

- one global **Files** entry;
- **Library / Browse folders** as internal workspace modes;
- Back / Forward;
- scope-aware Search, Filter, Sort and Saved View;
- List / Grid;
- selection and multi-selection;
- Inspector;
- Context Menu;
- Show Location;
- Organize selection;
- Space → Quick Preview;
- preserve Query/virtualization/stale-snapshot behavior.

**Gate:** side-by-side review against the checksum-verified rebuilt V26 target plus focused regression of existing Query/selection authority.

## Phase 3 — Search / Palette / Inspector

- centered Search + Commands anchor;
- application Command Palette;
- desktop Quick Search integration boundary;
- selection → Inspector continuity;
- keyboard/focus return contracts.

## Phase 4 — Settings

- Zen Select / Switch / Settings Search;
- section keyboard navigation;
- System / Light / Dark;
- Default / Compact;
- AI consent/provider truth;
- Global Index and diagnostics truth states;
- wide/narrow presentation.

## Phase 5 — Organize + Cleanup

Preserve Zen's safety signature:

- suggestion → safe preview → Dry Run → confirm;
- scan → review → Safe Trash → restore;
- explicit partial/degraded/unavailable states;
- no styling that implies success before authoritative state exists.

## Phase 6 — Overview + History + Automation

Migrate remaining major surfaces to the same primitive/state system. Remove legacy duplicate styling only after replacement behavior is proven.

## Phase 7 — Cross-surface consolidation

- remove temporary compatibility exports;
- verify canonical metrics/states across all surfaces;
- produce W6-08 Quick Preview implementation inputs;
- prepare W6-09 whole-product native-regression readiness.

## Non-negotiable contracts

- No second Preview architecture.
- No weakening Dry Run / Safe Trash / Restore / AI-consent boundaries.
- No promotion of W6-05 `FAIL` / `DEGRADED` / `UNVERIFIED` to PASS without new evidence.
- No top-level Library/Browse duplication.
- No underline / bottom-bar / glow focus grammar.
- Space remains Quick Preview.
- Windows/macOS may differ where platform-native behavior requires it.
- No release/version/tag/publication state change in W6-07.

## First production slice recommendation

The first reviewable W6-07 implementation should be **Phase 1 plus a bounded Files shell slice**, proving:

1. real native shell integration;
2. canonical production tokens/primitives;
3. exactly one Files destination with Library/Browse internal modes;
4. real Search/selection/focus/Inspector behavior;
5. no regression to durable Query/selection/backend authority.
