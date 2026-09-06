# Unified Zen UI Grammar — Owner Refinement

**UNIFIED UI GRAMMAR REVISION COMPLETE — OWNER RE-REVIEW REQUIRED**

This revision incorporates the binding owner review of the previous candidate. It keeps the accepted system architecture — one value authority, one component authority, one spatial rhythm, one overlay family, and independent action/selection/focus states — while correcting places where visual consistency had become mechanical sameness.

W6-06 remains ACTIVE. W6-07 remains inactive. This document authorizes no production implementation.

## Core principle

> Same semantic family means shared metrics, tone, rhythm and state hierarchy. Different interaction semantics may use different anatomy.

Zen should feel like one product because its surfaces share geometry, density, color relationships, typography, focus intent, state hierarchy and placement logic. Navigation, file selection, tabs, switches and menu checks do **not** need the same visible marker.

## Product signature

Zen's desktop signature is:

- quiet graphite content;
- restrained action blue reserved for genuine primary action;
- soft tonal selection rather than CTA-blue selection;
- persistent fields with clear affordance boundaries;
- routine toolbar commands that rest quietly and reveal stronger chrome on interaction;
- one spatial origin per host;
- flat working surfaces with dividers for adjacency and shadows only for true overlap;
- failure states that preserve cause, consequence and next step without inventing success.

Leading vertical selection/focus rails, full-perimeter focus glow and decorative card stacks remain prohibited.

## Selection families

| Semantic role | Selected treatment | Marker | Rationale |
| --- | --- | --- | --- |
| Multi-select object (FileRow, GridTile) | tonal selected surface; selected-hover/pressed remain tonal | small semantic check in reserved slot | confirms membership in a selection set |
| Current navigation destination | tonal current surface + restrained label emphasis | none | communicates location, not a checked object |
| Segment / tab / mode choice | tonal selected child + label emphasis | none by default | communicates active choice, not checklist membership |
| Switch / toggle | component's own checked anatomy | none from row-selection grammar | boolean control already owns state anatomy |
| Menu checked item | menu-specific check slot only when the command is actually checkable | optional | follows menu semantics, not global selection decoration |

Selection never substitutes for keyboard focus. Selection never uses the primary-action fill.

## Focus families

Focus remains subtle, visible and geometry-preserving, but now follows object type.

| Family | Applies to | Geometry |
| --- | --- | --- |
| Object/Text focus | FileRow name, GridTile title, Navigation label | local 2px name/label underline |
| Control focus | Button, IconButton, segment option, switch/toggle | short 2px bottom focus bar aligned inside the control footprint |
| Field focus | Input, SearchField, Select | 24px x 2px bottom accent inside the field boundary |

Invalid fields retain their danger border while also showing field focus. No focus treatment changes control size or layout.

## Command chrome hierarchy

A mature desktop toolbar must not look like a row of form controls.

- Persistent input affordances — Input, Search, Select — keep an explicit boundary.
- Routine secondary toolbar commands default to **quiet** chrome: transparent at rest, tonal hover/pressed, no permanent 1px box unless discoverability or grouping requires it.
- Primary action uses the restrained action-blue family and appears at most once per active task state.
- Explicit confirmation/cancel areas and high-consequence secondary actions may use stronger boundaries.
- Destructive filled styling is reserved for the final authorized confirmation, never routine navigation or selection.

## Typography roles

The refined system separates dense interface copy from explanatory prose:

- Page title: 24/32/600
- Pane / section title: 16/24/600
- Control label / filename: 13/20/500
- **Compact UI copy: 14/20/400** — Inspector support, short preference help, short Notices, toolbar-adjacent explanations
- Explanatory body: 14/24/400 — multiline consequences, onboarding prose, longer StateBlock/Notice explanations
- Metadata/support: 12/16/400
- Technical/code: 12/20/400 monospace

This deliberately avoids introducing a second ambiguous 14/22 role.

## Switch rule

Ordinary boolean preferences render as `label/help + switch`. The switch's position and accessible checked state communicate the boolean value. A persistent visible “On/Off / 开启/关闭” word is **not** the default.

Explicit state copy is allowed only where the consequence is ambiguous or high impact, such as cloud/provider consent, security state, policy-controlled capability or non-boolean external status.

## Structural selection marker

File-row selection markers are part of the row grid, not an absolute overlay. The row reserves a stable marker column in selected and unselected states so selection cannot collide with status, size or long filenames and never shifts layout.

GridTile may visually anchor its marker in a corner, but the marker remains a named component slot with reserved safe area, not a page-local positioning patch.

## Spatial and component ownership

Values belong in `src/styles/tokens.css` when implementation is authorized. Anatomy and interaction belong in `src/components/ui/`. Composition belongs in `src/components/ui/surfaces.ts`. Feature views own domain content and authoritative state, not generic visual metrics.

The current implementation remains untouched. Library Query V2, LibrarySelectionV1, Global Index, Preview Core/hosts/read gates, SQLite, Organization Plan, journals, Safe Trash, Restore and AI consent boundaries are unchanged.

## Owner acceptance path

This refinement is still a design-system candidate. The next owner decision is based on the revised specimen and evidence. If accepted, the next W6-06 design task is **File Library Flagship Target Design**, not production implementation.

The grammar is not considered production-frozen until:

1. owner accepts this refined system specimen;
2. a complete flagship File Library composition proves the grammar remains coherent under real product complexity;
3. later production migration preserves authoritative behavior and passes the appropriate browser/native gates.
