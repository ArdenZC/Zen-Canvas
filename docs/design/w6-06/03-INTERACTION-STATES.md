# Interaction-state consistency audit

Source and screenshot scopes are separate. [Role matrix](03-ui-coherence-matrix.json) contains exact anchors; [atlas](03-comparison-atlas.html) contains unchanged screenshots. Native evidence remains W6-05, not a new test run.

| Pattern | Default / hover / pressed | Selected | Focus-visible | Disabled / loading | Error / warning / success |
| --- | --- | --- | --- | --- | --- |
| Shared Button / tw recipes | Neutral default; enabled:hover guards; primary has enabled:active; secondary/ghost no distinct authored pressed treatment | N/A for ordinary action | Shared focus recipe plus global fallback | Disabled neutralizes hover and shadow, opacity70; spinner layout caller-owned | Warning/danger variants; do not use success fill as ordinary selection |
| Shared segmentButton | Unconditional hover; active parameter means selected value, not physical press | Primary CTA fill and contrast text | Global button outline remains | Disabled prop exists at component; recipe does not neutralize hover independently | Not a notice |
| Library mode/view toggle | Hover border/background; no dedicated pressed metric change | Tonal, border-strong and inset1 | Explicit outline2 offset2 | Command :disabled opacity42; mode hover selector is unconditional but disabled runtime use not established | Capability unavailable remains separate |
| Settings segment | Hover tonal; explicit disabled:hover rules | Tonal + bottom2px primary line | Explicit focusVisible; radio roving tab stop | Disabled wrapper opacity60; per-button disabled | Separate SettingsInlineMessage |
| File list | Hover tonal; no custom press layer | `.is-selected` background | `.is-focused` outline2 inset2; independent state | Unloaded row pointer-events none; native loading transitions not retained | Missing-name and warning slots separate |
| Grid | Grid-specific selection/hover rules | Reuses selected color; tile shape differs | Grid implementation must preserve focus independently | Spinner22 and placeholder; transition continuity unverified | Warning overlay13/14 versus list status slot |
| Shared interactiveRow | Hover border+inset highlight | Border-primary plus3px `focus-ring-soft` shadow | No row-wide global fallback if host is non-button; inspect real element and tab semantics per caller | pointer-events-none opacity55 prevents pointer, not proof of keyboard disabling | Caller tone/notice |
| Sidebar | Tonal hover; selection marker rail | Tonal+left rail | Explicit2px external outline; medium Overview frame shows independent focus on selected nav | Ordinary nav remains available | AI status card remains domain-owned |
| Generic input vs Settings field | Hover border; Settings neutralizes disabled hover | Text selection is separate from row selection | Field border+soft shadow+global outline may stack | Generic input recipe lacks comprehensive disabled appearance; Settings adds it | Field error linking not evidenced in retained frames |
| SearchField vs HistorySearchField | Wrapper focus-within; inner input outline-none utility | Query text selection separate | Search wrapper halo; History wrapper halo+outline; global input outline may also apply depending cascade | Search loading15 replaces clear32; no fixed trailing slot | Do not merge Library and Global Index readiness |
| Switch shared vs Settings | Shared checked glow; Settings flat track; both48×28 | Checked value, not focused state | Shared button vs peer-focus-visible track | Shared opacity55; Settings60 with disabled track overrides | Not a capability status badge |
| Preview action vs navigation | Header action hover unguarded; footer hover guarded:not(:disabled) | Pin value must not become execution CTA | Global button outline exists despite no local outline declaration | Header opacity55; footer50; native disabled states visible, hover untested | Host unavailable/error body is separate CSS composition |
| Notice / SettingsInlineMessage / Toast | Not interactive except action/dismiss | N/A | Action controls need normal focus | Content-driven height; no blanket stability guarantee | Notice alert for danger/error; SettingsInlineMessage role supplied by caller; Toast alert/status by type |

## Requested risk checks and evidence verdict

1. **Selected = primary CTA:** confirmed source in `segmentButton`; visible filled Plan tab in `OrganizationPlan-missing-info`. This is a design conflict, not permission to change plan behavior.
2. **Selected vs focus conflation:** confirmed shared-row use of `--zc-focus-ring-soft` for selection. Counterexample: file-list multi-selection shows many tonal rows and one outlined focus row. Preserve it.
3. **Hover stronger than selection:** source selectors for Settings hover/selected coexist; CSS generation/cascade and current input state determine winner. No isolated hover/selected comparison is retained. Risk, not verified runtime defect. Cursor blue glow is excluded.
4. **Disabled still has hover:** source risk in generic segmentButton and Preview header action. Shared Button guards and Preview footer guards are present. Do not claim all disabled controls hover.
5. **Focus ring clipping:** file list uses inset outline specifically; generic external outline2+offset2 needs4px clearance. Overflow-hidden panels, grouped controls with2px padding, and edge-aligned buttons are candidates. No retained frame proves an actually clipped ring at each candidate. Future detail acceptance must test it.
6. **Icon buttons without visible focus:** blanket claim rejected. `styles.css` supplies global button focus. Verify actual computed cascade, clipping and host semantics later; local selector absence is not sufficient.
7. **Different row/button grammar:** confirmed; selected rows may glow, segments may fill primary, Library toggles use border and Settings toggles underline. Distinct ARIA semantics are valid; unrelated visual selection language is not.
8. **Loading continuity:** source risk from clear32/spinner15 substitution and content-sized state bodies. Preview loading and pinned/previous-next behavior remain W6-05 UNVERIFIED. Still images cannot prove layout jumps.

## Candidate state precedence

Default → hover → pressed changes the interactive surface only. Selected/checked persists independently. Focus is an additional geometric indicator, visible on selected and unselected items. Disabled suppresses hover/press and execution while preserving reason text outside a disabled control. Loading reserves label/icon geometry and prevents duplicate submission where applicable. Error/warning/success belongs to a Notice or field status and cannot replace selection/focus. Unavailable, permission required, partial, retry exhausted and safety blocked remain distinct domain facts.

Modal policy proposal: retain `ModalPortal`, focus containment and existing Escape hierarchy; return to invoking control or stable owning row after close. Popover geometry must reuse the W6-04 repaired placement/scroll/focus controller. No keyboard, Narrator, accessibility certification, high contrast, macOS or DPI pass is newly claimed.
