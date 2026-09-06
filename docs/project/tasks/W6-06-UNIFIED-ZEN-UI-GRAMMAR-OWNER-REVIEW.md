# W6-06 Unified Zen UI Grammar — Owner Review

Status: **CHANGES REQUIRED — DO NOT FREEZE YET**

Reviewed candidate: `240d5168db42593fbe4a184fa85b0884cbfed66f`.

The candidate materially improves coherence: one metric ladder, one presentation authority hierarchy, one state anatomy, one spatial model, one overlay family, and explicit separation of selected/focus/primary action. It is suitable as a strong design-system foundation, but it is not yet accepted as the frozen Zen UI grammar.

## Binding follow-up owner decision — 2026-09-06

The owner explicitly rejected underline-based focus after reviewing the refinement specimen:

> 下划线很丑啊，不准采用这个设计

This supersedes the earlier allowance for local label/name underlines. The final Zen grammar must **not** use text underlines, short focus bottom-bars, focus rails, or extra decorative focus lines as keyboard-focus styling.

Focus should use the component's existing visual anatomy instead:

- object/navigation focus: quiet focus tonal surface + restrained identity foreground emphasis; selected+focus uses a distinct selected-focus tone;
- button/icon-button/segment focus: quiet focus surface/foreground treatment, with primary action remaining in its primary family;
- Input/Search/Select: change the existing 1px affordance boundary to the focus role; do not add an inner accent line or outer ring;
- Switch: strengthen the existing track boundary/tone; no external focus ornament;
- Forced Colors may use the operating system's native outline because accessibility takes precedence over the Zen visual restriction.

The soft surface is not the sole focus indicator for borderless objects: identity foreground emphasis remains visible and must retain sufficient contrast.

## Required changes before owner acceptance

### 1. Do not force one visible selection marker across different semantics

Use a shared **selection principle**, not an identical decoration:

- multi-select file/object rows and grid items may use a small check when selection needs explicit confirmation;
- current navigation destination uses tonal selection and label emphasis, without a trailing check;
- segmented controls/tabs use a tonal selected child and type/weight contrast, without a check unless literally checklist/multi-choice;
- toggle controls keep their own checked anatomy and do not inherit row markers.

The shared rule is quiet tonal selected surface, no CTA-blue selection, and focus remains independent. The marker is semantic, not universal.

### 2. Keyboard focus must not introduce decorative lines

The previous owner-review draft proposed label/name underlines, short control bottom-bars, and a field inner accent. That proposal is now **superseded and prohibited**.

No focus treatment may move layout. Selected+focused must remain simultaneously legible. Do not add a surrounding glow/frame merely to replace the removed underline.

### 3. Reduce control-border heaviness as a product-level principle

- persistent fields/search/select retain a visible affordance boundary;
- routine secondary toolbar buttons default to quiet/tonal chrome and gain boundary only where discoverability or grouping requires it;
- dialog confirmation/cancel and high-consequence controls may retain stronger explicit boundaries.

The goal is not borderless UI; it is avoiding a form-control texture across the entire desktop chrome.

### 4. Do not use a visible On/Off word next to every switch by default

Default: label + switch state conveyed by switch position, accessible checked state, and optional status copy only when consequence is not obvious. Use explicit text state only for ambiguous/high-impact settings or when a policy requires it.

### 5. Tighten body/help leading for desktop density

Keep a compact-body/support role at 14/20 for short UI copy, while preserving 14/24 for multiline explanatory prose/state descriptions.

### 6. Make selection-check placement structural, not absolute overlay

The final grammar reserves a semantic marker slot so a selection check cannot collide with size/status columns, long filenames, or narrow layouts.

### 7. Consistency does not mean identical visual treatment

> same semantic family = shared metrics, tone, rhythm and state hierarchy; different interaction semantics may use different anatomy.

Navigation, file selection, tabs, switches and menu checks must feel related without becoming visually identical.

## Acceptance path

After the binding focus correction, regenerate the system specimen and re-run the browser/interaction checks. Do not raise the craftsmanship score merely because the owner feedback was addressed.

If the revised system remains coherent, the next step is **File Library Flagship Target Design**, not production implementation. The grammar is only frozen after the owner accepts the revised specimen plus the flagship composition.

W6-06 remains ACTIVE. W6-07 remains inactive. Production remains unchanged.
