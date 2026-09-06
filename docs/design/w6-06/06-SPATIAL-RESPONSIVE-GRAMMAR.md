# Spatial and responsive grammar

Candidate design specification. One grid/inset system, four semantic hosts. Sizes are logical CSS px and usable **client width**, excluding native frame thickness. Native adapters own titlebar safe areas, traffic lights and Windows caption buttons; never paint copied OS controls into generic chrome.

## Window composition

Titlebar sits above app navigation and workspace; target internal Windows titlebar row48 high, native caption target sizes remain platform-owned. Sidebar is a docked navigation pane, not a raised card. Workspace has one origin. Command layer stays with the workspace. Inspector is a contextual sibling. Overlay is in the existing top-level modal portal with viewport-covering scrim, not inside a scrolled or transformed workspace.

| Host | Header | Inner edge | Content / boundary | Scroll owner |
| --- | --- | --- | --- | --- |
| Standard Page | PageHeader24/32, subtitle optional, gap16 | workspace24 wide /16 otherwise | Sections gap24; independent major section gap32; flat default | One page body; shell/titlebar stationary |
| Dense Workspace | CompactWorkspaceHeader16/24, source12/16, gap8; Toolbar | Same workspace24/16; no Library0 exception | Rows paint to pane bounds if desired; row content starts at common column edge. Divider separates docked panes | File region, with virtualized rows; command/header remain siblings |
| Settings Workspace | Same PageHeader; local nav and form body | Same workspace24/16; pane inner16 | local nav176 wide,148 medium; field controls remain32/36; sections gap24 | Form body once; local nav may independently scroll if long |
| Floating Preview | Shared overlay header16 inset; source + filename + close |16 on header/body/footer | Overlay r12; no nested raised state card | Body only, header/footer siblings |

The workspace inset is paid **once** by the host recipe. Panel/Inspector inner16 applies to a genuinely separate pane, not another wrapper around the same workspace. Header title, toolbar query and section body align at that host edge. Row icon begins on the column edge; text starts20+8 after it. Table header reserves the same leading icon slot so filename baselines align. A flush painted row uses negative visual background inset only inside the primitive; the feature cannot move its text edge.

## Width thresholds and ordered pressure relief

Usable content width after sidebar, insets and Inspector matters more than viewport labels. Thresholds below define default composition; measure actual localized command width and apply the same ordered relief early if it does not fit. Never wait for clipped labels to trigger overflow.

| Client width | Sidebar / inset | Default Inspector | Command treatment |
| --- | --- | --- | --- |
| Wide ≥1440 |224 /24 |320 docked if main region remains≥560 | One row; optional date/size columns visible; secondary actions labeled |
| Medium 1180–1439 |192 /16 |280 docked only while main≥560 | Hide low-value date column, move secondary management actions into overflow as needed |
| Narrow 980–1179 |176 /16 |Collapsed; reopen as320 Sheet | Hide optional metadata; overflow secondary actions; collect secondary groups; exactly two command rows maximum (query row + essential command row) |
| Below980 exploratory |Navigation moves to Sheet |Modal Sheet | Not a supported-size acceptance claim; no horizontal page overflow, preserve query, overflow and task identity |

Pressure relief order: **(1) optional metadata → (2) secondary action overflow → (3) docked Inspector collapse → (4) secondary toolbar group overflow**. Forced window thresholds may request an earlier step, but never hide a higher-priority affordance while keeping low-value columns. When Inspector collapses, focus moves to its explicit reopen trigger only if focus was inside; do not steal workspace focus on resize. Reopening uses Sheet, restores selection context, and does not automatically force the Inspector docked again during the session.

Toolbar group order remains context/query, task commands, mode/view, overflow. Management commands are menu content at narrow width, not a permanent second management panel. A long primary action remains visible; other actions overflow first. No `flex-wrap` on command groups. If essential controls plus query do not fit one line, use named two-row narrow recipe; total toolbar budget104 default /96 compact. Titles/help outside command bar can wrap, but status details expand in a pane instead of consuming unbounded command height.

At980×680: titlebar48 + Dense header44 + header gap8 + two-row Toolbar104 + table heading32 + footer32 + top/bottom insets32 =400px; remaining280px holds **six full44px rows**. This is a candidate budget, not a new native measurement. Persistent multi-line safety consequences may reduce rows and must remain visible; open technical detail uses overlay/body, never silent omission. At1920×1032 and1282×862, compare same content rather than claiming correctness from one generous desktop frame.

## Pane and scroll rules

Each pane is a column with `min-height:0; min-width:0`. Header/footer are non-scrolling siblings. Exactly one body has `overflow:auto`, stable native scrollbar gutter,16px bottom breathing room and4px focus scroll padding. No shell scroll plus nested body scroll for the same content. Independent file and Inspector scroll is intentional. Horizontal scrolling is allowed inside labeled technical/code content, not across ordinary Settings or the whole window.

PropertyRow uses label80–40% / gap12 / value remainder; below280 pane width, stack label and value with gap4. Settings preference rows use explanatory text and a control column min160/max480; when their combined min-content widths do not fit, stack control below with gap8. Long labels and reasons wrap without shrinking13px control labels. Dropdowns/menus cap at viewport−32 and can reflow labels; no clipped safety consequence.

## Overlay geometry

Popover and Menu anchor gap8; viewport clearance16; flip to available side before clamping; body scrolls while header/actions remain reachable. Reuse the existing repaired W6-04 placement/focus controller. No hard-coded top coordinate from a screenshot.

Dialog width480 or form640, Preview800, Sheet360/480 (Inspector320), all max viewport−32. Max overlay height viewport−32, with header/body/footer. Modal scrim is fixed inset0 in root portal and covers full client area even when file body scrolls. A Preview may be floating by design but uses the same12px radius,16px inset, icon16, control32/36, divider and shadow as other overlays. Nonmodal pinned Preview receives no modal scrim and no fake focus trap; existing host mode controls semantics.

## Implementation and evidence boundary

The specimen is an editorial system board with representative component compositions, not a reconstructed File Library or Settings page. Its width switch constrains the board to980px for narrow host testing; actual browser viewport tests additionally exercise980×680,1282×862 and1920×1032. Section navigation belongs to the specimen viewer, not a proposed product sidebar. Static Preview and state samples are labeled as design examples. Native window resizing, OS DPI, macOS typography, Narrator/VoiceOver and long-session comfort remain unverified until later authorized gates.
