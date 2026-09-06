# Unified Zen UI Grammar

**UNIFIED UI GRAMMAR DRAFT COMPLETE — OWNER REVIEW REQUIRED**

One candidate system, authored against `f3d136e6e979708713daf65b6835a1d0c9a34820`. These are proposed normative presentation rules for owner review, not an accepted production freeze. W6-06 remains ACTIVE. W6-07 is not activated. See the [specimen](06-system-specimen.html), [tokens](06-DESIGN-TOKENS-SPEC.md), [anatomy](06-COMPONENT-ANATOMY-SPEC.md), [states](06-STATE-INTERACTION-GRAMMAR.md), [space](06-SPATIAL-RESPONSIVE-GRAMMAR.md) and [review](06-CRAFTSMANSHIP-REVIEW.md).

## Design decision

Zen's signature is a stable working edge, quiet graphite text, a restrained blue action, and a desaturated blue selected surface with a small trailing check. Files and consequences carry the hierarchy. Geometry communicates role before color: commands align on a single baseline; related choices share a rail; panes meet at a divider; only transient surfaces float.

This is a desktop file-work grammar. A 32px command allows frequent operations without consuming the file region. A 36px ordinary field allows comfortable CJK and Latin reading. A two-line file row remains 44px because filename plus source/context is useful information, not oversized chrome. A setting may grow vertically to explain a preference, but its control is the same Input, Select or Switch used elsewhere.

The [accepted benchmark synthesis](04-MATURE-PRODUCT-BENCHMARK.md) informs these design judgments: Finder/Quick Look contributes continuity of selection and source; Fluent contributes command grouping and deliberate overflow; Raycast contributes a stable contextual action grammar; Things contributes recession of repeated orientation; Linear contributes common action placement and removal of decorative boundaries; Figma contributes contextual pane ownership. These are design inferences from the retained research, not fresh measurements or native tests of reference products. No reference brand, assets, platform window controls or distinctive full-page layout is copied.

## One owner for each decision

| Role | Sole intended owner | Allowed variants | Forbidden local overrides | Compatibility path / later retirement condition |
| --- | --- | --- | --- | --- |
| Values | `src/styles/tokens.css` | Semantic Light/Dark maps; compact/default density; named spatial thresholds | Feature px/rem, color, radius, shadow, height, typography, pane inset or focus values | Existing aliases forward to one semantic token; remove alias when no callers remain and computed-style parity is proved |
| Reset and font environment | `src/styles.css` | Platform font stack, reduced motion, forced colors, reset | Unlayered `font: inherit` defeating primitive roles; new generic component recipes | Move reset into an explicit lower cascade layer; demonstrate field/button computed styles, then remove competing legacy rules |
| Anatomy and interaction states | `src/components/ui/` | Documented component variants only | Class/style escape hatches affecting owned metrics/states | Migrate callers role by role; no parallel Settings or Preview control implementations |
| Composition | `src/components/ui/surfaces.ts` | Standard, Dense, Settings, Floating recipes; slot placement | New colors, dimensional literals, duplicate headings or selection states | Compose canonical components and token references; delete duplicated recipe bodies after parity |
| Compatibility | `src/utils/tw.ts`, `src/views/shared/ui.ts` | Forwarding visual exports; `cn` remains a string utility; domain composition may remain | Overriding canonical anatomy by appended classes; treating `cn` as conflict resolution | Inventory each caller; convert imports/props; remove visual exports when caller count is zero and focused interaction/rendered tests pass |
| Features | Domain views/adapters | Content, capability, authoritative state, semantic variant | Generic field/switch/segment/state/pane styling | Keep SettingsRow, History query adapter, Preview renderer, virtualizer and domain lifecycle; replace only their visual forks |

This changes no durable authority and proposes no new runtime or architecture. Library Query V2, LibrarySelectionV1, Global Index, Preview Core/hosts/read gates, SQLite, Plan, journals, Safe Trash, Restore and provider/AI consent retain their authority. A future migration must record surviving compatibility exports and their exit conditions in `TECH_DEBT.md`; this draft does not silently mark current debt retired.

## Audit closure at specification level

“Resolved” below means an implementable design answer, not a repaired production defect.

| Audit root | Binding candidate answer | Proof in specimen | Future implementation seam |
| --- | --- | --- | --- |
| COH-01 / UI-03,43: 20/0 origins | All four workspace variants use workspace inset 24 wide, 16 medium/narrow; rows may paint to pane edge but text keeps the shared origin | Aligned headings, toolbar and row labels; metric ruler | AppShell removes Library identity-based inset exception |
| COH-02 / UI-05–12,42: control/cascade split | Toolbar resolves one density for all peers; 32/36 border-box including border, explicit font roles | Search/Select/Button parity strip | tokens + primitives; no 30/34/40 toolbar overrides |
| COH-03 / UI-23,24: selection dialects | Tonal selection + 12px check; focus independent local 2px underline; primary fill only action | Selected, selected-hover and selected-focus adjacent | Segments, navigation and rows share state roles, retain different ARIA semantics |
| COH-04 / UI-31: Preview dialect | OverlayHeader/Footer use pane inset16, control32/36, typography16/24 and14/20 | Unavailable Preview with source/context and shared close | Existing ZenFloatingQuickPreview host; no new engine |
| COH-05 / UI-16,33–38: state anatomy | Icon → title → consequence → recovery → detail, shared inline/full slots | Empty, error, blocked, permission and unavailable | Notice/StateBlock replace independent shells |
| COH-06 / UI-11–13,32 | SettingsRow composes canonical fields, Switch and choices | Long preference labels beside shared controls | SettingsPrimitives visual forks retire after caller parity |
| COH-07 / UI-05,14 | Metadata → secondary commands → Inspector → secondary groups collapse; no toolbar wrap | Width switch and operable overflow | Preserve search scope, management reachability and row space |
| COH-08 / UI-17–19,40,45 | Flat section by default; divider for adjacent panes; floating shadow for overlap only | Flat pane/body, raised menu, bounded Preview | Remove nested decorative panels, not meaningful grouping |
| COH-09 / UI-15,30 | One local durable failure owner; toast only transient acknowledgment or offscreen completion link | Persistent local error; separate specimen acknowledgment | Event/task presentation deduplication, without changing task truth |
| COH-10 / UI-25,39 | Every pane has one scroll body; header/footer siblings; same16px inner edge and bottom breathing room | Constrained Inspector/Preview bodies | Keep geometry/focus controller; eliminate nested scrolling wrappers |

## Command placement

| Role | Treatment | Location and prohibition |
| --- | --- | --- |
| Primary | Solid action blue, 500 label; optional leading icon | One per active task state. PageHeader or state recovery, never duplicated in both. Modal takes active priority while open |
| Secondary | Surface + 1px control border | Toolbar, Inspector, dialog cancel; same control metrics as primary |
| Quiet | Transparent resting background | Row reveal, auxiliary header/Preview controls; hover/press becomes neutral surface |
| Destructive | Danger text + consequence; filled danger only final authorized confirmation | Separate bottom menu group or dialog footer. Never adjacent to routine primary without separation; no direct mutation from specimen |
| Mode toggle | Shared tonal selected choice + marker | Toolbar or preference field; never action-blue fill |
| Overflow | Quiet IconButton, accessible “More actions / 更多操作” | Trailing Toolbar/row. Hides low-priority actions without changing their labels, availability or order |
| Context action | Menu row with icon/label/shortcut | Same action identity as toolbar; selection-scoped capabilities; no path-based execution invention |
| Navigation | Quiet row; current destination selected | Sidebar/local navigation; changes location, never looks like execute |

PageHeader allows primary + one secondary + overflow. Toolbar allows query/context, task group and view group; at most one primary shared with the page state. Rows show at most two quiet actions on hover/focus; primary stays with the selected task context. Inspector groups facts first and context actions last. Dialog footer puts cancel before explicit confirmation in logical reading order, with platform adapter ordering permitted only centrally. Preview has one top-trailing Close; pin and previous/next are quiet, availability-driven actions, never extra primary CTAs. Shortcut labels reflect actual existing platform bindings; the grammar does not assign global shortcuts.

## Later implementation acceptance, not authorization

1. Resolve tokens/reset cascade and computed roles before moving feature styles.
2. Migrate Button, IconButton, fields, Switch, segment and selection/focus as one coherent foundation.
3. Apply shared origin/header/toolbar recipes and bounded overflow; prove virtualizer metric agreement before row changes.
4. Consolidate Notice/StateBlock and display ownership, preserving all W6-05 causes and backend revalidation.
5. Consolidate Inspector/Settings/Preview chrome over existing lifecycle and modal infrastructure.
6. Delete visual adapters only after zero remaining callers, focused keyboard/state/browser parity and current routing gates. A forwarding alias alone is not duplication.

Owner review of this specimen is the next decision. Representative Overview/File Library/Settings designs, production reconstruction, functional remediation, native audit, release work and W6-07 activation are outside this bounded delivery.

## Owner visual constraint

Leading vertical accent/selection bars and full-perimeter highlight frames or glows are prohibited throughout this candidate system. Selection uses a quiet tonal surface plus a small trailing check. Keyboard focus uses a local underline or short bottom line; it must not reintroduce a surrounding frame. Neutral structural dividers and ordinary control boundaries are unchanged. This replaces the earlier candidate selection/focus treatment and requires owner review.
