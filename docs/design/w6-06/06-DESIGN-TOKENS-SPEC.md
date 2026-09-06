# Zen metric and token specification

Candidate freeze for owner review. All dimensions are CSS px at 100% browser zoom, not inferred physical native pixels. Values belong in `tokens.css` when later implementation is authorized. The self-contained specimen mirrors this document; its stylesheet is a design artifact, never a second production value authority.

## Spacing

| Token suffix (`--zc-`) | Value | Semantic use |
| --- | --- | --- |
| `space-micro` | 2 | Focus underline thickness, small optical allowance; not layout padding |
| `space-tight` | 4 | Adjacent label/help; inner segmented rail inset; focus clearance |
| `gap-icon` / `gap-control` | 8 | Icon–text; control internal content; related controls |
| `gap-group` / `inset-row` | 12 | Between command groups; horizontal row content inside a group |
| `inset-pane` | 16 | Panel, Inspector, Settings section and Preview header/body/footer |
| `inset-workspace` | 24 wide / 16 medium and narrow | Shared content origin including Dense Workspace |
| `gap-section` | 24 | Sections in one pane; density does not compress explanations |
| `gap-major` | 32 | Independent sections/panes separated by open space; adjacent docked panes instead use divider and their own16px inset |

Ladder: **2, 4, 8, 12, 16, 24, 32**. Drop candidate48 from ordinary chrome; empty-state vertical positioning uses available-space alignment, not a magic48px margin. 20px remains a text line-height and file icon size, not an unowned inset. 44px remains file-row height, not a control-size exception.

## Density and dimensions

| Role | Compact | Default | Width / rationale |
| --- | --- | --- | --- |
| Command, Button, Input, Select, Search | 32 | 36 | Border-box; label never wraps inside command. Shared parent density. 36 provides16px free vertical space around20px line;32 provides12px |
| IconButton | 32×32 | 36×36 | Internal minimum target32; icon16. Clear/search trailing target occupies full control height |
| Prominent action | 36 | 36 | No third control height. Emphasis comes from semantic fill and placement, not inflated40px height |
| One-line Row / InteractiveRow | 32 | 36 | Stretch width;20px line,12px horizontal inset |
| FileRow two-line | 44 | 44 | Name20 + metadata16 + 8 total vertical inset; preserve virtualizer parity. Compact hides optional columns, not source identity |
| Dense PropertyRow | min32 | min36 | Content-driven if value wraps; label/value gap12 |
| Preference row | min68 | min72 | Control plus16px vertical inset each side; help wraps at24px line height |
| Table heading | 32 | 32 | 12/16/500; shares column template with rows |
| GridTile | min180×204 | min180×204 | 144px preview well + filename20 + metadata16 + gaps/insets; resolved virtualizer204 must include all slots |
| Switch | target32 high; track40×24; thumb16 | target36 high; same track/thumb | 4px thumb inset,16px travel; checkmark and explicit state label. No glow |

Height calculations include 1px borders. Use `box-sizing:border-box`, not min-height plus uncontrolled padding. Prefer fixed command height + logical horizontal padding12; fields width min160, ideal240, max480; local Search min160, ideal280, max480. If available width is below minimum, use a full query row; do not shrink text or clip labels. Native OS titlebar buttons are platform-owned exceptions and not sized by internal IconButton.

## Typography

| Role | Size / line / weight | Tracking | Behavior |
| --- | --- | --- | --- |
| Page title | 24 / 32 / 600 | 0 | One page title; wrap at word boundaries if needed |
| Window / pane / Preview title | 16 / 24 / 600 | 0 | Filename may truncate middle while retaining extension; full name via accessible detail |
| Section title | 16 / 24 / 600 | 0 | Same as pane title: hierarchy comes from position, not another18px size |
| Group title | 14 / 20 / 600 | 0 | Ordinary sentence case |
| Body | 14 / 24 / 400 | 0 | Both CJK and Latin prose use24px leading |
| Control label | 13 / 20 / 500 | 0 | Both densities. Single-line, no uppercase conversion |
| Filename | 13 / 20 / 500 | 0 | Preserve punctuation and extension; do not synthesize weight650 |
| Metadata | 12 / 16 / 400 | 0 | Optional metadata can hide before filename width drops |
| Quiet/support | 12 / 16 / 400 | 0 | Contrast stays readable; never necessary consequence text |
| Table heading | 12 / 16 / 500 | 0 | Sentence case; tabular numerals for numeric columns |
| Technical/code | 12 / 20 / 400 | 0 | Monospace, selectable, wrap or own horizontal scroll in disclosed detail |

Font stack: `"Segoe UI", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`; macOS platform adapter puts `-apple-system` first. Code: `"Cascadia Code", "SFMono-Regular", Consolas, monospace`. No remote font dependency. Choose available400/500/600; fallback may map500 to regular, which must be inspected on each native platform. No local650, no CJK tracking adjustment and no automatic Latin uppercase. Both locales keep the same line boxes; different glyph metrics are a native verification item. No manual top offset on labels to “fix” one locale.

## Shape, icons and focus

Radius ladder: **4 / 8 / 12**. `radius-inner=4` for segment child and code disclosure; `radius-control=8` for fields/buttons/rows/tiles; `radius-floating=12` for panels with true outer containment, menus, dialogs and Preview. A flat pane has radius0. Switch and tiny status dot may use a full radius for their semantic anatomy. Do not nest an8px control in an8px frame; rail outer8 + inset4 + child4. An inset field in a12px panel has16px space; it does not require a new radius.

Icon ladder: **12 status / 16 control / 20 file-navigation / 32 full state**. Inline Notice icon16; StateBlock icon32. Same Lucide outline family, normalized24-unit viewbox, stroke2 with round joins/caps; empty-state32 also uses2, without framed decorative blob. SVG boxes are flex-none and center on the20/24px text line, not the full wrapped paragraph. File thumbnail art can differ; chrome icons cannot. Optical adjustment is allowed only in the central Icon mapping, at most1px with before/after evidence for both locales. Initial candidate uses zero offsets. No feature `translateY` or arbitrary15/17/19 sizes. Full hit target remains32/36 regardless of glyph size.

Selection: soft tonal fill plus a reserved trailing 12px check, with no surrounding circle, leading vertical stripe, selection border or glow. Focus: keyboard-only 2px label/name underline, offset3–4px; icon-only controls use a centered 12×2px bottom line and fields a 24×2px local bottom line. It never traces the perimeter. Invalid field borders remain semantic status boundaries. Selection and keyboard focus remain independent.

## Theme roles

Every color below is a candidate semantic role. Dark layers are intentionally stepped; no inversion filter, glass blur or glow. `muted` is still readable text, not opacity on a subtree.

| Suffix | Light | Dark | Use |
| --- | --- | --- | --- |
| canvas | #f5f6f8 | #17191d | Outer workspace |
| surface | #ffffff | #202328 | Working pane/control |
| surface-subtle | #eef0f3 | #292d34 | Recessed well, disabled background |
| surface-floating | #ffffff | #2b2f36 | Overlay/menu elevated by luminance in Dark |
| text | #202733 | #edf0f5 | Main text |
| text-secondary | #596474 | #bac3d0 | Metadata and secondary copy |
| text-disabled | #626c7a | #a1aab8 | Legible disabled label, no group opacity |
| divider | #dce1e7 | #3c424c | Noninteractive separation |
| control-border | #8993a1 | #7e899a | Field affordance; stronger than dividers |
| hover | #e9edf2 | #343a44 | Neutral hover |
| pressed | #dce2ea | #414a57 | Neutral press |
| selected | #e8edf4 | #2c3542 | Selected tonal plane |
| selected-hover | #dfe6ef | #354151 | Persistent selection + hover |
| selected-pressed | #d3ddea | #404e60 | Persistent selection + press |
| selection-mark | #426899 | #a3c5fa | 12px check, independent from focus |
| primary | #295fc7 | #91b7ff | Action fill |
| primary-hover | #2354b4 | #a3c3ff | Primary hover |
| primary-pressed | #1c4598 | #7da8f5 | Primary press |
| on-primary | #ffffff | #132544 | Primary label |
| focus | #215fd1 | #a8cbff | Local keyboard-focus underline |
| danger / danger-soft | #a32c3b / #fff0f1 | #ffacb6 / #412830 | Error text/icon and background |
| warning / warning-soft | #845414 / #fff5df | #f3ce89 / #3c3324 | Warning/limited/blocked |
| success / success-soft | #286443 / #eaf5ee | #a2d7b6 / #243b30 | Ready acknowledgment |
| overlay | rgba(20,28,40,.28) | rgba(0,0,0,.52) | Full viewport modal scrim, no blur |

Contrast targets: ordinary text ≥4.5:1, meaningful nontext boundaries/focus ≥3:1 against adjacent surface; selected fill is not sufficient by itself, so marker and semantic state remain. Disabled labels voluntarily target4.5:1 although inactive controls have a different accessibility requirement. Measured candidate pairs and limits belong in the review; native/accessibility certification is not implied.

## Boundary and elevation

| Level | Boundary | Light shadow | Dark shadow | Permitted use |
| --- | --- | --- | --- | --- |
| Flat | None | none | none | Page, rows, sections, status body |
| Adjacent | 1px divider | none | none | Docked panes, table header, section boundary |
| Contained | 1px divider or control-border by role | none | none | Field, inset group, independently bounded object |
| Raised | 1px divider | 0 2px 8px rgba(20,28,40,.08) | 0 2px 8px rgba(0,0,0,.18) | Tooltip, toast, small transient contextual surface |
| Floating | 1px divider | 0 12px 32px rgba(20,28,40,.16) | 0 12px 32px rgba(0,0,0,.32) | Menu, popover, dialog, Preview |

A static nested section may not combine border + bordered child + shadow merely for decoration. A field inside a floating dialog is a legitimate interactive boundary. Docked Inspector has divider, not floating shadow; modal Inspector Sheet uses floating treatment because it overlaps content.

Motion:120ms color/border;180ms overlay opacity; standard `cubic-bezier(.2,0,0,1)`. No translate/scale on press or selection. Spinner cycle800ms linear, replaced by static progress glyph under Reduced Motion. Reduced Motion sets all transitions/animations to none. Forced colors uses system Canvas/CanvasText/ButtonText/Highlight; preserve local underlines, checks and labels, not color alone.
