# Canonical UI grammar proposal

**Candidate system only — not an accepted design freeze, page design or W6-07 activation.** Derived from the [audit](03-UI-COHERENCE-CRAFTSMANSHIP-AUDIT.md), [metric inventory](03-METRIC-INVENTORY.md), [states](03-INTERACTION-STATES.md) and [benchmark](04-MATURE-PRODUCT-BENCHMARK.md). No theme is selected.

## One owner per presentation decision

| Layer | Candidate authority | Responsibility / exit condition |
| --- | --- | --- |
| Foundations | `src/styles/tokens.css` | Single semantic color, spacing, typography, shape, elevation, motion and density ladders. Light/Dark are mappings of the same roles. No feature-owned redefinition of shared control metrics. |
| Semantic component tokens | Scoped groups in the same token authority | Control height/inset, row density, field radius, toolbar gap, pane/header inset, focus width/clearance. Alias foundations; avoid a parallel feature token system. |
| Global CSS | `src/styles.css` | Reset, font-family, accessibility/Reduced Motion/high-contrast baseline. It must not silently override primitive typography; explicit layer order is part of future implementation acceptance. Legacy aliases remain temporary until callers migrate. |
| Primitive implementation | `src/components/ui/` | Canonical anatomy, states and metrics for controls, headers, surfaces and overlays. CSS/recipes may be internal modules; no second public recipe owner. |
| Composition exports | `src/components/ui/surfaces.ts` | Thin public surface/layout exports or internal recipes of canonical primitives. Not competing definitions of the same headings/rows. |
| Compatibility | `src/utils/tw.ts`, `src/views/shared/ui.ts` | `cn` remains utility. Legacy visual exports become forwarding adapters, then disappear once all callers and relevant source/rendered checks migrate. Shared domain-specific compositions can remain; do not move unrelated data/lifecycle logic. |
| Feature views | Overview, Library, Settings, etc. | Content, domain state, grouping and allowed variant choice. No independent radius/font/shadow/control-height grammar. Specialized content renderers retain code/text/image sizing. |

These are visual ownership proposals. SQLite, Query V2, LibrarySelectionV1, Global Index, Organization Plan, Safe Trash, journals, Preview Core/hosts and provider consent keep their current durable authority. No ADR-level authority migration is proposed here.

## Canonical primitives and anatomy

| Primitive | Anatomy / allowed variants | Existing duplication to retire later |
| --- | --- | --- |
| Button | Leading icon, label, reserved progress slot; primary/secondary/ghost/danger/warning; compact/default | tw exported implementation recipes and caller sizing overrides after migrating to canonical Button |
| IconButton | Square hit target, centered icon, accessible name, visible focus; quiet/outlined/danger | Context close, Preview close and ad hoc clear styling |
| SearchField | Scope label, search icon, input, reserved clear/loading slot; compact/default | HistorySearchField visual fork; Library search-height override; keep adapter callbacks |
| Input | Label/control/help/error associations; standard/compact, secret/numeric behavior retained | SettingsControl visual fork |
| Select | Same field border/height/type as Input; native select semantics retained | Feature field radius and chevron spacing |
| SegmentedControl | Group, options, selected marker, independent focus; radio/tab modes explicit | segmentButton, SettingsSegmentedControl visual recipe, Library toggle metrics; preserve ARIA behavior differences |
| Switch | One track/thumb/hit-target/focus specification, labeled checked state | Shared toggleSwitch vs SettingsSwitchControl duplicate visuals; do not regress native input semantics |
| Toolbar | Named groups, leading context, primary commands, trailing view/actions; overflow policy | Raw flex wrappers that independently pick heights/gaps and wrap |
| PageHeader | Title/location, optional subtitle/status, actions at trailing edge; document/workspace variants | AppShell Library inset exception; independent title/action rhythms |
| SectionHeader | Title, optional description, secondary action; section/group/pane variants | `sectionTitle` duplicate strings, Settings local title metrics, Preview host headings |
| Panel / Card | Content surface; inset group; raised/floating only when layer semantics require | AppPanel-as-default nesting, feature shadows and row-as-card recipes |
| Row / List / TableHeader / GridItem | Leading object/status, main label, secondary facts, trailing actions; shared selection/focus; virtualized adapters | Independent interactiveRow styles; preserve fixed-height estimate contracts and authoritative counts |
| StateBlock | Title, consequence, optional explanation, recovery/action slots; empty/loading/unavailable/error/blocked with compact/pane/workspace sizes | legacy emptyState, SettingsEmptyState, host-local unavailable compositions |
| Notice / Badge / Toast | Notice durable consequence+action; Badge compact status; Toast transient acknowledgment | SettingsInlineMessage, sourceBadge visual fork and duplicate global/local error display after lifecycle analysis |
| Popover / Dialog / Sheet | Header, scroll body, action footer, dismissal/focus return; modal distinction explicit | Feature visual shells; retain ModalPortal and repaired filter geometry controller |
| Inspector / PropertyRow | Persistent source context, facts, actions; narrow sheet presentation | Context local pane chrome, independent property-row metrics; retain domain adapters |
| Tooltip | Accessible names do not depend on hover; supporting explanation only | Tooltip-only reasons on disabled controls; native title can remain where sufficient |

Deletion condition: a duplicate is removed only after every caller has a canonical role/variant, equivalent content and keyboard semantics, and focused rendered regression proves parity. Record unresolved adapters and their explicit exit conditions in the later implementation's debt ledger. W6-06 changes none of them.

## Candidate metric ladder

| Domain | Candidate values | Why more than one value remains |
| --- | --- | --- |
| Spacing |2,4,8,12,16,24,32,48 CSS px |2 optical/separator;4 intra-control;8 icon/action;12 group;16 pane inset;24 page/section;32 major section;48 exceptional onboarding breathing room. Existing20/28 need explicit migration comparison, not blanket substitution. |
| Page inset |24 wide;16 medium/narrow; all primary surfaces use same content origin | Shell/nav width is independent. Workspace compact header keeps the same edge while spending less vertical space. |
| Control |32 dense toolbar;36 ordinary desktop;40 multiline/form/action; min hit target32 internally | Same toolbar group uses one height. Height is minimum if labels wrap; oversized state actions do not get arbitrary heights. OS controls retain platform-specific44×48 geometry. |
| Row |32 one-line compact;44 two-line file;52 rich summary | Preserve existing44 virtual row. The render/virtualizer share one resolved metric; no unexplained42/44 divergence for identical anatomy. |
| Icon |12 micro-status;16 control;20 navigation/status;24 state illustration;32 thumbnail fallback | No14/15/17/19 chrome exceptions without documented optical need. Keep Lucide; default2 stroke at16–24, review32 optical weight rather than invent a new family. Optical offsets max1px require evidence and belong in Icon, not callers. |
| Radius |6 micro/inner segment;8 control/row;12 panel;16 floating;full pill only for switch/launcher/badge | Parent/child radii follow inset; adjacent field/button share8. This is a candidate simplification, not a mandatory geometric replacement of all existing radii. |
| Typography |Page24/32/600; section18/24/600; pane16/24/600; body14/20/400; control14/20/500; compact13/20/500; metadata12/16/400 | Filename can use13/20/600. CJK prose may use14/24; code/text content owns readable16/24 or mono13/20. Weight650 and unexplained fractional chrome sizes disappear. |
| Tracking |Body/control0; page optional-.01em Latin; label optional+.04em uppercase Latin | Never apply uppercase/tracking to Chinese blindly. Locale fit is reviewed with real strings. |
| Border/focus |Divider/control1; focus2; external offset2 or inset2 for clipped list/OS controls | Focus can coexist with selected fill. Ring+offset needs4px clearance; do not stack an unrelated selected glow. |
| Elevation |0 content/rows;1 raised transient contextual surface;2 floating dialog/menu; spotlight uses modal scrim | Retain theme-aware existing shadow roles as candidates. Do not add row/switch hover glow. Visual tests decide exact light/dark alpha, not this audit. |
| Motion |120ms hover;180ms state/expand;280ms large surface entry maximum; reduce→none | No layout movement for selection/focus. Existing Reduced Motion handling remains. Future runtime tests prove transitions. |

## State and composition rules

- Selected is tonal background plus an optional persistent marker; primary fill is reserved for the state's primary action. Keyboard focus is an independent2px contour, never encoded by selected styling.
- Disabled suppresses interactive changes and duplicate execution; its explanation stays legible outside the disabled element. “Unavailable”, “unknown”, “permission needed” and “safety blocked” are not equivalent to disabled.
- Search reserves a32px trailing slot for clear/spinner; action labels do not shift during work. Avoid replacing a filled list with an unrelated large loading card when useful prior content can stay truthful.
- Toolbar groups stay together. Wide retains labels; medium moves management/rare actions into overflow; narrow keeps location/mode, query and primary action reachable, collapses inspector into Sheet, and hides optional metadata columns before reducing file-name space. This is a proposal, not a new breakpoint implementation.
- Review at1920×1032, approximately1282×862 and980×680. W6-05's969×675 is a nearby historical sample, not exact980×680 acceptance. Pane visibility is based on available workspace width; do not reuse unrelated viewport1180/1100 thresholds without a common layout contract.
- One independent scroll owner per pane; fixed header/footer consume explicit space; reserve scrollbar width and16px bottom content padding. Dialog content scrolls inside safe edges while title and dismissal remain visible.
- Chinese/English labels may grow. Use meaningful truncation for paths with filename/extension retained and a discoverable full value. Ordinary action labels do not truncate; switch to overflow/stacked form rows. No mixed raw enum/English error string in otherwise Chinese primary instructions.
- Light and Dark share geometry and hierarchy. Evaluate surfaces, divider strength, disabled readability, focus and overlay separation independently; retain semantic color slots. No contrast-ratio or a11y certification is claimed until measured.

## Highest-leverage consolidation order (future authorization required)

1. Fix token consumption/cascade and primitive size APIs; eliminate competing class overrides.
2. Canonicalize fields, buttons, IconButton and mutually exclusive selection grammar across Library/Settings/Preview.
3. Establish one shell content origin and Toolbar/PageHeader variants.
4. Consolidate StateBlock/Notice and overlay/Inspector chrome, preserving domain cause/action mapping.
5. Rationalize row/grid/header metrics, separators and scroll ownership with virtualizer parity.
6. Only then reconstruct the four representative surfaces and score against the existing92/100 quality bar. This task produces neither those pages nor a score.
