# Canonical Component Anatomy — Owner Refinement

Every primitive inherits canonical tokens and named state families. Feature views may supply domain content/state but may not redefine generic metrics, focus, selection, radius, colors or typography.

## Shared contracts

- compact/default interactive height: 32/36;
- control label and filename: 13/20/500;
- short UI copy: 14/20/400;
- explanatory prose: 14/24/400;
- metadata: 12/16/400;
- control icon: 16; file/navigation icon:20; selection/status mark:12;
- selected, focused, invalid, disabled and loading channels remain composable;
- no full-perimeter focus ring/glow in the Zen visual grammar;
- no arbitrary feature `className/style` escape hatch for owned metrics/states.

## Actions and fields

### Button

`[optional icon16][label]`, h32/36, x12, gap8, r8.

Variants:

- primary: action fill;
- quiet: transparent rest → tonal hover/pressed; default for routine toolbar command;
- bordered-secondary: explicit boundary only where grouping/discoverability/decision hierarchy benefits;
- destructive: danger text/soft surface; filled danger only final authorized confirmation.

Focus: short bottom control bar, not text underline.

### IconButton

Square32/36, icon16 centered. Quiet by default in chrome. Focus uses 12×2 bottom bar. Toggle variants use their own checked state.

### SearchField / Input / Select

Persistent 1px affordance boundary, r8. Focus uses 24×2 inner bottom accent. Invalid boundary remains danger while focus remains separately visible. Search trailing clear/loading occupies a full 32/36 target so it never shifts layout.

### SegmentedControl

Outer rail h32/36, inset4, gap4, r8; child r4. Active child uses tonal selected surface + restrained label emphasis. **No generic trailing check.** Focus uses short bottom control bar on the active/focused child.

### Switch

Track40×24, thumb16, target32/36. Ordinary preference variant has no persistent visible On/Off word. High-impact variant may add explicit status copy beside or below the control when consequence is ambiguous. Focus uses a short control bar aligned to the switch target.

## Object and navigation components

### FileRow

Fixed h44. Structural columns:

- file icon20;
- name13/20 + source12/16;
- optional status;
- optional metadata;
- **selection marker slot20**.

The marker slot is always reserved. Selected multi-select rows show check12 in that slot; unselected rows leave it empty. No absolute marker overlay. Object focus underlines the filename only.

### GridTile

Minimum180×204 with preview well144 and caption. Multi-select tile uses tonal selected surface + check12 in a named top-trailing marker safe zone. Filename focus uses local underline.

### NavigationItem

h32/36, icon20, label13/20. Current destination uses tonal surface + restrained label emphasis. **No trailing selection check.** Keyboard focus may underline the label only.

### TableHeader

h32 and the same structural columns as FileRow. Marker slot remains structurally reserved but carries no visible heading.

## Composition components

### Toolbar

Flat host, one density for peers. Persistent Search/Select boundaries may coexist with quiet routine commands. Group gap8/12. Exactly one primary action maximum. No accidental wrap.

### PageHeader / CompactWorkspaceHeader

Shared workspace origin. Page title24/32; compact workspace title16/24. No decorative card around ordinary page identity.

### Inspector

Docked width320 wide /280 medium, divider only. Header/body/footer siblings; body is sole scroll owner. Compact UI copy 14/20 for short explanatory facts; longer consequence copy may use 14/24.

### SettingsRow

Explanatory label/help + canonical field/switch/choice. Short help uses 14/20 when appropriate. Ordinary Switch does not add a redundant On/Off word.

## States and overlays

### Notice

Icon16 + title13/20/600 + compact body14/20 for short consequence; explanatory14/24 when multiline reasoning is necessary. Action follows normal button hierarchy.

### StateBlock

Icon32 → title16/24 → explanatory body14/24 → actions → technical details. No decorative dashed card.

### Menu / Popover / Dialog / Sheet / Preview

All share r12 floating family, divider, 16px inner edge and canonical controls. Menus use menu-specific check slots only for truly checkable items. Preview header/body/footer use one family; no extra independent visual dialect.

## “Related, not identical” acceptance sample

A required specimen comparison places these together:

- current Navigation: tonal, no check;
- selected File: tonal, check in reserved slot;
- selected Segment: tonal child, no check;
- checked Switch: track/thumb state, no row-style marker.

They must read as one family through tone, metrics and rhythm while retaining semantically correct anatomy.
