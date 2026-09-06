# Zen Spatial and Responsive Grammar — Owner Refinement

One grid/inset system, four semantic hosts. Sizes are logical CSS px and client-area measurements; native titlebar controls remain platform-owned.

## Hosts

| Host | Shared origin | Internal edge | Scroll owner |
| --- | --- | --- | --- |
| Standard Page | 24 wide /16 medium+narrow | section rhythm 24/32 | one page body |
| Dense Workspace | same origin | header + toolbar + list grid | file region body |
| Settings Workspace | same origin | local nav + form body, pane inset16 | form body once |
| Floating Preview | 16 header/body/footer | shared overlay geometry | body only |

Pane insets are paid once. Docked Inspector uses a divider, not floating shadow. Only true overlap receives floating elevation.

## File list structural grid

FileRow reserves a semantic selection-marker slot rather than overlaying the marker on arbitrary content.

Wide candidate template:

`20 file icon | minmax(0, 1fr) name/source | 112 status | 72 optional metadata | 20 selection marker`

Medium removes optional metadata before reducing object identity:

`20 | minmax(0, 1fr) | 112 | 20`

Narrow keeps object identity and marker while lower-value columns disappear or move into Inspector:

`20 | minmax(0, 1fr) | 20`

The marker slot exists for selected and unselected rows so toggling selection never shifts filename/status geometry. TableHeader reserves the same structural columns even where its marker heading is visually empty.

GridTile reserves a named marker safe zone in its top-trailing anatomy. The marker can visually sit in that zone but must not collide with filename/status content.

## Width pressure relief

Order remains:

1. optional metadata;
2. secondary action overflow;
3. docked Inspector collapse;
4. secondary toolbar group overflow.

Search/query identity stays available. Essential commands never shrink fonts/icons to fit. Two toolbar rows are the narrow maximum: query row + essential command row.

## Toolbar texture

Input/Search/Select keep explicit boundaries. Routine toolbar commands are quiet by default and become tonal on hover/press. This reduces visual noise without changing hit targets or group geometry.

Groups do not wrap accidentally. Overflow preserves action identity/order.

## Settings and Inspector density

Preference rows use compact UI copy 14/20 for short help. Multiline explanatory prose and state consequences retain 14/24. This keeps Settings and Inspector aligned with 32/36 controls without making longer explanations cramped.

When a preference label/control pair no longer fits, the control stacks below with 8px gap. Long paths wrap/select without causing horizontal page scroll.

## Overlay geometry

Popover/Menu anchor gap8, viewport clearance16, flip before clamp. Dialog 480/640, Preview 800, Sheet 360/480 (Inspector 320), max viewport−32. Header/body/footer use 16px inset and body owns scrolling.

Preview uses the same 12px floating radius, 16px inset, control metrics, divider and shadow family as other overlays without copying native OS chrome.

## Acceptance boundary

This specification is validated in the revised HTML specimen and browser matrix. Native DPI, Windows/macOS font rasterization, titlebar conventions, Narrator/VoiceOver and long-session comfort remain later gates. W6-07 is not activated.
