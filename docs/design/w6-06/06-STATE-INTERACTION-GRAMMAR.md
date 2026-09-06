# Zen State and Interaction Grammar — Owner Refinement

W6-05 functional truth is unchanged: design examples do not upgrade native evidence or repair production behavior.

## Independent state channels

Interactive state is composed, not replaced:

1. base interaction: default → hover → pressed;
2. selected/checked semantic state when applicable;
3. domain status and consequence;
4. disabled/loading restrictions;
5. keyboard focus, independently visible.

Primary actions use the action family and are never “selected.”

## Selection is semantic, not decorative

- File/object multi-selection: tonal selected plane + semantic check in reserved slot.
- Navigation current destination: tonal current plane + restrained label emphasis; **no check**.
- Segment/tab active choice: tonal child + label emphasis; **no check** unless the control is genuinely checklist-like.
- Switch: track/thumb state only; no row-selection marker.
- Menu: check only for an actually checkable menu item.

Same family means related tone and rhythm, not identical ornament.

## Focus families

### Object/Text focus

File names, tile titles and navigation labels may use a local 2px underline with 3px offset. It underlines the identity text, not the entire row.

### Control focus

Buttons, IconButtons, segmented choices and switches use a short 2px bottom bar inside the hit target. The bar is centered or aligned to the control content and never traces the control perimeter.

### Field focus

Input/Search/Select use a 24×2px bottom accent inside the existing field boundary. Invalid focus = danger border + focus accent; neither erases the other.

Focus never moves layout and selected+focus remains simultaneously legible.

## Loading and disabled

Disabled suppresses activation/hover/press without fading an entire parent subtree. Checked/selected semantics remain readable. Loading reserves its icon/progress slot, prevents duplicate activation and does not steal focus.

A file can remain selectable even when Preview is unavailable; disable the unavailable action, not the object itself.

## One state anatomy

Full StateBlock: icon → title → consequence → recovery action → technical detail.

Notice uses the same outcome/consequence ordering while useful content remains. Toast is for transient acknowledgment or offscreen completion, not a duplicate of a visible durable failure.

The W6-05 retained failures remain explicitly represented:

- Windows extended-path Cleanup rejection;
- Image/CSV/JSON/folder Preview unavailable;
- Global Index source unavailable;
- Organization Plan safe-preview/suggestion failure;
- Browse/first-scan recovery friction.

No design state invents successful candidates, provider readiness, execution or restore behavior.

## Switch state text

Ordinary boolean switches do not display a persistent `On/Off` word. The label, switch position and `aria-checked` carry the state.

Visible state copy is an explicit semantic variant for ambiguous/high-impact settings, consent/security/provider status or non-boolean external state. It is not a default visual accessory.

## Keyboard and overlays

- Existing product bindings remain authoritative.
- Menu: Arrow keys/Home/End/typeahead, Escape restores anchor.
- Dialog/Sheet/Preview: modal containment, safe initial focus, Tab/Shift+Tab containment, Escape closes the topmost dismissible layer, focus returns to stable invoker/selection.
- Search respects IME composition and literal punctuation.
- Reduced Motion removes transition/animation; Forced Colors preserves selected identity plus focus using system colors.

## Interaction rejection criteria

Reject a future implementation if any of the following appears:

- navigation gets a generic selection check because FileRow has one;
- segment selected state uses CTA-blue fill or checklist check by default;
- keyboard focus becomes a full rectangle/glow;
- routine toolbar buttons become permanently boxed without a documented reason;
- Switch repeats On/Off text on every ordinary preference;
- selection marker overlaps optional columns or moves content when toggled;
- error/selected/focus states visually erase one another.
