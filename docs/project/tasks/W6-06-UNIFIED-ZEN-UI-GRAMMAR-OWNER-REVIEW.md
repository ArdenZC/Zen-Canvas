# W6-06 Unified Zen UI Grammar — Owner Review

Status: **CHANGES REQUIRED — DO NOT FREEZE YET**

Reviewed candidate: `240d5168db42593fbe4a184fa85b0884cbfed66f`.

The candidate materially improves coherence: one metric ladder, one presentation authority hierarchy, one state anatomy, one spatial model, one overlay family, and explicit separation of selected/focus/primary action. It is suitable as a strong design-system foundation, but it is not yet accepted as the frozen Zen UI grammar.

## Required changes before owner acceptance

### 1. Do not force one visible selection marker across different semantics

The candidate applies a trailing check to file selection, navigation current state, segmented choice, and other selected objects. This over-unifies distinct interaction semantics.

Use a shared **selection principle**, not an identical decoration:

- multi-select file/object rows and grid items may use a small check when selection needs explicit confirmation;
- current navigation destination should use tonal selection and label emphasis, without a trailing check;
- segmented controls/tabs should use a tonal selected child and type/weight contrast, without a check unless the control is literally a checklist/multi-choice surface;
- toggle controls already have their own checked anatomy and must not inherit row markers.

The shared rule is: quiet tonal selected surface, no CTA-blue selection, focus remains independent. The marker is semantic, not universal.

### 2. Rework keyboard-focus grammar for controls

A universal text underline is too literal and risks making buttons, switches, fields, rows and navigation feel mechanically different despite a common token. Focus must remain subtle, but the geometry must match the object type.

Keep the prohibition on full-perimeter glow/frame and leading vertical rails, but define three focus geometries:

- text/object rows: local label/name underline is allowed;
- button/icon-button/segmented/toggle: short bottom focus bar aligned to the control, not text-decoration on arbitrary descendants;
- input/search/select: local bottom focus accent inside the field boundary, preserving invalid/error border independently.

No focus treatment may move layout. Selected+focused must remain simultaneously legible.

### 3. Reduce control-border heaviness as a product-level principle

`control-border` is intentionally stronger than dividers, but the candidate risks making every secondary button/field read as a bordered form UI. Freeze a hierarchy:

- persistent fields/search/select retain a visible affordance boundary;
- routine secondary toolbar buttons should default to quiet/tonal chrome and gain boundary only where discoverability or grouping requires it;
- dialog confirmation/cancel and high-consequence controls may retain stronger explicit boundaries.

The goal is not borderless UI; it is avoiding a form-control texture across the entire desktop chrome.

### 4. Do not use a visible On/Off word next to every switch by default

The switch's semantic label already names the setting. A persistent On/Off word on every preference row adds visual noise and makes Settings denser than mature desktop preferences.

Default: label + switch state conveyed by switch position, accessible checked state, and optional status copy only when the consequence is not obvious. Use explicit text state only for ambiguous/high-impact settings or when a policy requires it.

### 5. Tighten body/help leading for desktop density

`14/24` body is appropriate for explanatory prose and state consequences, but should not become the universal body leading for dense desktop chrome. Define a separate compact-body/support role around 14/20 or 14/22 for short UI copy, while keeping 14/24 for multiline explanatory prose/state descriptions. This avoids Settings and Inspector feeling vertically loose next to 32/36 controls.

### 6. Make selection-check placement structural, not absolute overlay

The specimen places file-row selection checks at the far trailing edge with absolute positioning. The final grammar must reserve a semantic slot when a check is present so it cannot collide with size/status columns, long filenames, or narrow layouts. The table/list/grid column model must explicitly account for the marker.

### 7. Clarify that consistency does not mean identical visual treatment

The final grammar should state explicitly:

> same semantic family = shared metrics, tone, rhythm and state hierarchy; different interaction semantics may use different anatomy.

Navigation, file selection, tabs, switches and menu checks must feel related without becoming visually identical.

## Acceptance path

After these changes, regenerate the system specimen and craftsmanship review. Do not raise the score merely because documents changed; re-run the same 24 browser combinations and interaction checks.

If the revised system remains coherent, the next step is **File Library Flagship Target Design**, not production implementation. The grammar is only frozen after the owner accepts the revised specimen plus the flagship composition.

W6-06 remains ACTIVE. W6-07 remains inactive. Production remains unchanged.
