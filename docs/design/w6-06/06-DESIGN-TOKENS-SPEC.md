# Zen Design Tokens — Owner Refinement

Candidate values for owner re-review. CSS dimensions are logical px at 100% zoom. This is a design artifact; production remains unchanged.

## Spacing

Canonical ladder: **2 / 4 / 8 / 12 / 16 / 24 / 32**.

| Token | Value | Use |
| --- | ---: | --- |
| micro | 2 | optical allowance |
| tight | 4 | label/help, segment rail inset |
| control-gap | 8 | icon/text, related controls |
| group-gap / row-inset | 12 | command groups, row horizontal rhythm |
| pane-inset | 16 | Inspector, Settings, Preview, dialog body |
| workspace-inset | 24 wide / 16 medium+narrow | shared workspace origin |
| section-gap | 24 | sections in one pane |
| major-gap | 32 | independent major groups |

44 remains FileRow height; 20 remains a text/file-icon measure, not a new spacing token.

## Control dimensions

| Role | Compact | Default |
| --- | ---: | ---: |
| Button / Input / Select / Search / command | 32 | 36 |
| IconButton | 32×32 | 36×36 |
| FileRow | 44 | 44 |
| TableHeader | 32 | 32 |
| Preference row | min 64 | min 68 |
| Switch target | 32 | 36 |
| Switch track | 40×24 | 40×24 |

Routine toolbar buttons may be visually quiet at rest, but keep the same hit target and label geometry as bordered/primary variants.

## Typography

| Role | Size / line / weight | Use |
| --- | --- | --- |
| Page title | 24/32/600 | one page title |
| Pane/section title | 16/24/600 | pane, Preview and section headings |
| Group title | 14/20/600 | compact subgroup heading |
| **Compact UI copy** | **14/20/400** | short Inspector copy, preference help, compact Notice body |
| Explanatory body | 14/24/400 | longer consequence/prose |
| Control label / filename | 13/20/500 | commands and objects |
| Metadata/support | 12/16/400 | secondary context |
| Technical/code | 12/20/400 | diagnostics |

Font stack remains platform-local: `Segoe UI`, system UI, PingFang SC, Microsoft YaHei UI/YaHei. No remote font dependency. No arbitrary 650 weights or CJK tracking hacks.

## Radius and icon ladders

Radius: **4 / 8 / 12**.

- 4: segment child, tiny disclosure
- 8: fields, buttons, rows when inset, tiles
- 12: true floating/contained outer surfaces

Icons: **12 / 16 / 20 / 32**.

- 12 status/selection mark
- 16 controls
- 20 file/navigation objects
- 32 full state illustration

No feature-local 15/17/19px icon exceptions.

## Focus state tokens

Focus does not introduce a new line geometry. The system uses semantic surface/boundary roles and the component's existing anatomy.

| Token | Role |
| --- | --- |
| focus | foreground / existing-boundary emphasis |
| focus-soft | keyboard-focus surface for unselected objects and quiet controls |
| selected-focus | selected + keyboard-focus surface |
| primary-focus | keyboard-focus tone for primary action controls |

Prohibited as default Zen focus grammar: text underline, short bottom bar, leading/trailing rail, extra inner accent line, decorative full-perimeter ring or glow. Forced Colors may substitute the OS-native outline.

## Theme roles

The owner follow-up adds focus-soft and selected-focus roles; all declared semantic contrast pairs are revalidated after this change.

| Role | Light | Dark |
| --- | --- | --- |
| canvas | #f5f6f8 | #17191d |
| surface | #ffffff | #202328 |
| surface-subtle | #eef0f3 | #292d34 |
| surface-floating | #ffffff | #2b2f36 |
| text | #202733 | #edf0f5 |
| text-secondary | #596474 | #bac3d0 |
| text-disabled | #626c7a | #a1aab8 |
| divider | #dce1e7 | #3c424c |
| control-border | #8993a1 | #7e899a |
| hover | #e9edf2 | #343a44 |
| pressed | #dce2ea | #414a57 |
| selected | #e8edf4 | #2c3542 |
| selected-hover | #dfe6ef | #354151 |
| selected-pressed | #d3ddea | #404e60 |
| selection-mark | #426899 | #a3c5fa |
| primary | #295fc7 | #91b7ff |
| primary-hover | #2354b4 | #a3c3ff |
| primary-pressed | #1c4598 | #7da8f5 |
| on-primary | #ffffff | #132544 |
| focus | #215fd1 | #a8cbff |
| focus-soft | #edf3fb | #273548 |
| selected-focus | #dbe6f3 | #34455c |
| primary-focus | #1f55b5 | #a3c3ff |
| danger | #a32c3b | #ffacb6 |
| danger-soft | #fff0f1 | #412830 |
| warning | #845414 | #f3ce89 |
| warning-soft | #fff5df | #3c3324 |
| success | #286443 | #a2d7b6 |
| success-soft | #eaf5ee | #243b30 |

## Boundary hierarchy

- Flat: no boundary.
- Adjacent pane: 1px divider.
- Persistent field: explicit control-border.
- Routine toolbar command: no permanent border by default; tonal hover/pressed.
- Bordered secondary: explicit variant only where discoverability/grouping/decision hierarchy benefits.
- Raised: small transient surface only.
- Floating: menu/popover/dialog/Preview only.

This rule is specifically intended to prevent a “form controls everywhere” desktop texture.

## Motion

120ms color/border and 180ms overlay opacity, cubic-bezier(.2,0,0,1). No press/selection scale or translate. Reduced Motion disables transitions/animation. Spinner remains 800ms linear where motion is allowed.
