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

Owner review rejects underline-based focus and line ornaments. Focus is expressed by **existing component surfaces and boundaries**, not by adding a new decorative line.

### Object focus

File rows, grid tiles and navigation items use a quiet focus tonal surface. An already-selected object moves to a distinct selected-focus tone so `selected` and `keyboard focus` remain simultaneously legible. Identity text/icon receives restrained focus-foreground emphasis; identity text is never underlined merely because the object has keyboard focus.

### Control focus

Buttons, IconButtons and segmented choices use a restrained focus surface/foreground treatment. No bottom bar, underline, rail or extra perimeter ring is added. Primary controls remain within the primary-action family rather than switching to the generic focus wash.

### Field focus

Input/Search/Select change the color of their **existing 1px affordance boundary**. No inner bottom accent and no extra outer ring is added. Invalid+focus must remain distinguishable without stacking two decorative frames.

### Switch focus

Switches strengthen the existing track boundary/tone. The target receives no external focus bar or ring.

Focus never moves layout. The soft focus surface is not the sole indicator for borderless objects; identity foreground emphasis carries sufficient contrast. Forced Colors may use the OS-native outline because accessibility takes precedence over the Zen visual restriction.

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
- keyboard focus becomes a text underline, bottom bar, rail, decorative perimeter rectangle or glow;
- routine toolbar buttons become permanently boxed without a documented reason;
- Switch repeats On/Off text on every ordinary preference;
- selection marker overlaps optional columns or moves content when toggled;
- error/selected/focus states visually erase one another.
