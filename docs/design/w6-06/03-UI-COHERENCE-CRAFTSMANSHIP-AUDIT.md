# W6-06 UI Coherence + Craftsmanship Audit

**COHERENCE AUDIT COMPLETE — READY FOR UNIFIED SYSTEM DESIGN**

This completes the bounded evidence/source audit, not W6-06. No new page, theme choice, production reconstruction or W6-07 activation is included.

## Evidence and provenance

- Latest fetched master at audit start: `3910dc9e6e5caca922a91482c8a3ae954cde4104` (benchmark/quality-bar merge #203). The merged amendment #202 is included. The older “exactly three themes” wording in STATUS/ROADMAP/initiative/activation is superseded for this task by the explicit merged amendment and current user instruction.
- Existing common checkout was clean on older master `9895079a4ebb1e810b8c42d6a74b24ba147c6645`; it was preserved. Result worktree: `F:/Coding/Zen-Canvas-w6-06-coherence-audit`, branch `docs/w6-06-ui-coherence-craftsmanship-audit-result`, based directly on fetched master.
- Retained native production head: `ee1163fbf32f23cc95150adca4e1cb5a53081654`, tree `57dc0ac45810477c8477542512c3c65a60605fb9`. `git diff` to audit base is empty for `src/` and `src-tauri/`. These screenshots therefore describe the same production source, not a newly executed acceptance run.
- W6-05 contains62 valid JPEGs. All62 are indexed with hash and raster dimensions;32 representative originals were visually inspected in this task. Others remain retained W6-05 evidence, not separately reviewed here. No whole-product native audit was rerun.
- W6-05 matrix remains `PASS45 / FAIL6 / DEGRADED7 / UNVERIFIED22`, total80. The source scan covers216 TS/TSX/CSS files, with81 candidate-bearing files. The47-role matrix includes all46 mandatory roles plus Badge.

The [atlas](03-comparison-atlas.html) groups repeated concepts across screens, rather than assigning a separate product score to each page. It references original image bytes in the repository and permits native-size viewing. [Screenshot manifest](03-screenshot-atlas.json) records inspection coverage, provenance and hashes. [Source matrix](03-ui-coherence-matrix.json), [visual authority map](03-VISUAL-AUTHORITY-MAP.md), [metric inventory](03-METRIC-INVENTORY.md), [interaction states](03-INTERACTION-STATES.md), [benchmark](04-MATURE-PRODUCT-BENCHMARK.md) and [canonical proposal](05-CANONICAL-UI-GRAMMAR-PROPOSAL.md) form the supporting evidence set.

Evidence grades: **V** = visible in an inspected retained screenshot; **S** = authored source evidence; **R** = risk requiring future computed/rendered/interaction verification. These are not PASS/FAIL upgrades. Unknown Windows scaling, JPEG compression and capture pointer halo prevent reliable1px/color/optical measurements. Raster locations below are approximate navigation aids, never CSS/DPI proof.

## Why the product feels assembled from different systems

Zen already has semantic colors, surface tokens, shared controls, modal infrastructure and a consistent app sidebar. The fragmentation occurs **after** those foundations: shared recipes can be independently overwritten; Library CSS establishes a second metric scale; Preview chrome uses a third fractional-rem scale; Settings recreates fields, switches, segments and state blocks. Outer composition then exposes these differences: Library is edge-to-edge and toolbar-first, ordinary pages are padded and heading-first, Settings adds a second navigation column, and Preview uses an independently spaced modal. Different workflows are valid; different definitions of the same visual role are not necessary for those workflows.

The most powerful correction is shared semantic anatomy and enforced consumption. Merely replacing the color palette would preserve the20px inset split,34/36/40px field/action mismatch, three selected-toggle appearances, and incompatible state layouts.

## Cross-surface screenshot atlas observations

### Page headers and common content origin

All ordinary top-level pages use `AppShell → PageHeader → surfaces.pageTitle`; they are not independently incorrect. Authored title24/600/tracking-.01em, subtitle14/24 with mt4, top inset20 below the48px titlebar, bottom gap16. Shared actions align top/trailing, wrap with gap8; body toolbar is separate. Source: AppShell workspace classes and `surfaces.ts:24–47`; actual fonts remain subject to the cascade caveat in the inventory.

| Surface | Title / subtitle | Top/left / bottom rhythm | Action / toolbar relationship | Evidence |
| --- | --- | --- | --- | --- |
| Overview | Shared24/600; scan-status subtitle |20 top,20 left (12 narrow); gap16 | Primary action in priority card; Getting Started floating at bottom | `Overview-medium-1299x884`, `Overview-narrow-969x675` V/S |
| File Library | Compact12/600 target; no ordinary PageHeader strip |0 outer inset; command bottom10, workspace gap12 | Navigation/mode/search/filter/view commands wrap; saved-view management in second panel | `FileLibrary-all-indexed-21`, `FileLibrary-narrow-969x675` V/S |
| Browse | Same compact Library shell; target/source changes |Same edge-origin exception | Location reload/open states follow command bar; navigation uses Sheet | `Browse-navigation-open` V/S |
| Quick Preview | Kicker.72rem/650; filename1.05rem/700; subtitle.78rem |Header1rem top /1.1rem horizontal /.9rem bottom; separate footer | Pin/close at top; previous/next and second close at bottom | `QuickPreview-Welcome-Markdown` V/S |
| Organize | Shared24/600 plus scope/safety subtitle |20/20; gap16 | Plan toolbar below; empty-state creation card centered | `Organize-initial`, `OrganizationPlan-missing-info` V/S |
| Cleanup | Shared24/600 plus safety subtitle |20/20; gap16 | Scope actions and duplicated empty-state scan action | `Cleanup-scan-fixture-result` V/S |
| History | Shared24/600 plus recovery subtitle |20/20; gap16 | Repeated18px body heading, metrics and search/list shell | `History-initial` V/S |
| Automation/Rules | Shared24/600 plus advisory subtitle |20/20; gap16 |18px Rule Library heading/action, metrics, nested empty panes | `Automation-rules-initial-english-dark` V/S |
| Settings ordinary sections | Shared page header; section18/600; group14/600 |Outer20; body starts after toast; section pb28, row y16 | Local nav then360/480px control column; not a toolbar | General, Appearance, Files, Automation, AI, Privacy, About inspected V/S |
| Global Index | Shared Settings shell; disclosure16/600 |Shares Settings section grid | Status, Start indexing, dashed no-source state stack vertically | `Settings-global-index-unavailable` V/S |
| Platform Diagnostics | Shared Settings shell; disclosure16/600 and property rows |Shares Settings grid | Technical capability values in right column; exact scroll position changes header y | Both diagnostics captures V/S |

At comparable medium captures, ordinary content begins about rasterx249 (sidebar boundaryx229), while Library begins aboutx230. This corroborates the explicit20 CSS px shell difference; do not subtract different-sized screenshot coordinates to infer font metrics. Settings's inner content begins aboutx491 because its local navigation consumes a column: the extra column is intentional; its controls' independent style ownership is the defect. Preview is an overlay, so its absolute left edge need not equal a page edge; its internal inset/controls still should belong to the same grammar.

### Toolbar, panel, row and overlay comparisons

| Repeated concept | Cross-surface comparison | Finding |
| --- | --- | --- |
| Toolbar/control height | Library tiny12px command labels beside full-size filter/select controls; History search and filter actions; Preview pin36 versus footer ordinary close40 | S exact declarations; V visible mixed density. Not all controls in one command group share anatomy. |
| Group spacing/divider | Library gap2/6/8 and bottom10; shared Toolbar gap12; Preview header action.45rem | Independent layout grammars, not missing tokens alone. |
| Panel hierarchy | Overview priority card16; History rounded raised shell24 containing dashed empty block8; Rules nested split panes; Settings mostly flat section dividers | Different workflows justify pane versus card, not arbitrary nested borders and elevation. |
| Rows/list/table | Library44 fixed virtual rows with aligned column template; Settings large content-driven form rows; History no-result list | Preserve distinct density roles and Library column alignment; consolidate states and role metrics rather than force identical heights. |
| Selection/focus | Many selected Library rows with one independent focus outline; selected Settings underline; filled Plan tab; app sidebar left rail | File-list model is a strength. Shared selected-row halo and primary-filled segment are the divergence. |
| Search/select | Library compact field34, History wrapper40, shell launcher32; native select and disclosure buttons coexist | Launcher is distinct semantic role; local search fields need common density. Native select arrows are platform-rendered, not custom-icon parity evidence. |
| Preview/Inspector | Markdown preview succeeds; ContextPanel-Welcome says unsupported; PDF fallback exposes `boundary_readable` | Host/read capability differences are real; normal copy should explain host-specific availability, not imply a single contradictory file capability. |
| Dialog/popover | Navigation Sheet full-height480; Rule dialog padded large shell; Preview short upper-centered card; plan menu anchored to actions | Preserve modal semantics, unify header/body/footer/control rhythm. Open filter popup geometry is not in retained screenshot set. |
| Settings sections | General/Appearance controls wrap differently from AI three-option block; horizontal scrollbar visible in Appearance/AI/About/technical captures | V horizontal overflow is real. S breakpoint1180 and fixed control column widths are candidate causes; no causal resize trace was recorded. |

### Craft checklist coverage and limits

Alignment: title/content edges and repeated baseline hierarchy were compared; list columns align using the same grid. Optical icon-center and exact1px baseline deviations remain R. Spacing:20/0 page inset and14/16/17.6 authored pane insets confirmed S; V nested padding/loose blocks observed. Borders/radius: nested empty panels and rounded groups inspected; JPEG pixels do not establish contrast ratios. Typography: inherited control fonts, Preview650/fractional metrics and English/CJK expansion reviewed S/V; actual font availability unverified.

Controls:30/32/36/40 hit-target candidates reviewed S; small clear target is a sizing risk, not falsely labeled unclickable. Dialogs/popovers: native-size static frames inspected, not newly operated; anchoring/escape/restore behavior remains prior-evidence scoped. Scroll: Settings horizontal bar, Library thin vertical scrollbar, Inspector near-edge content and short Preview backdrop visible. Responsive: Overview and Library narrow samples reviewed; no narrow Preview or Settings flow was captured. Locale/theme: Chinese light and English dark Appearance frames both reviewed; geometry changes and contrast hierarchy visible, but these are not a matched, controlled language-only A/B. No pixel score, long-session study or92/100 target acceptance is fabricated.

### Evidence gaps that must travel with the handoff

`Settings-search-english-dark.jpg` actually shows an open command palette. The ordinary Search section can be audited from source but not treated as an unobscured screenshot. `FileLibrary-filter-image.jpg` is the applied filter result; no claim of open Filter popup craftsmanship follows. Tooltip, physically pressed controls, isolated hover, full loading transitions, error focus return, high contrast, Narrator, macOS and exact display scaling lack relevant current evidence. W6-05 Preview previous/next, pinned and loading remain UNVERIFIED. These gaps limit specific acceptance claims; they do not prevent source-backed consolidation proposals.

## Severity model

C0 = system-breaking incoherence (surfaces feel like different products); C1 = major component divergence; C2 = repeated craft/detail degradation; C3 = polish opportunity. These are design-system severity labels requested by the product owner. They replace the audit brief's design-debt P labels for this deliverable and never reclassify W6-05 safety/product findings.

## Top coherence failures

| Rank / ID | Level | Root cause and evidence | Highest-leverage response |
| --- | --- | --- | --- |
|1 / COH-01|C0|Same content origin has20/0 (narrow12/0) shell implementations; O/L/S atlas, UI-03|One Layout/PageHeader inset authority with explicit workspace variant|
|2 / COH-02|C0|Control metric authority split across tw, Button overrides, Library CSS, Settings and Preview; UI-05/06/07|Primitive metrics plus cascade/override contract|
|3 / COH-03|C0|Three selected-toggle appearances plus shared row borrowing focus glow; F/OP/A, UI-10/23|Separate selected/focus/primary-action grammar|
|4 / COH-04|C0|Preview's fractional-rem chrome,650 weights and independent state layouts; P/E/PDF, UI-31|Shared overlay chrome, controls and StateBlock; retain content renderer|
|5 / COH-05|C0|Empty/recovery blocks range from centered form card to dashed nested pane to plain unavailable dialog; O/H/R/E, UI-16|One state anatomy with contextual size variants|
|6 / COH-06|C1|Settings duplicates switch/field/segment/empty/message despite shared exports; S/A/AI, UI-11–13/32|SettingsRow composition over canonical controls|
|7 / COH-07|C1|Library command bar, management panel and local controls jointly consume excessive narrow height; L/N, UI-05/14|Named Toolbar groups and controlled overflow|
|8 / COH-08|C1|Content/raised/app panels and feature nesting assign different depth to equivalent grouping; H/R/O, UI-17–19|Panel/Row semantic hierarchy and retirement of decorative wrappers|
|9 / COH-09|C1|Global error toast and local Notice repeat one problem and carry it into unrelated pages; C/S/H, UI-15/30|Specify display ownership and common recovery grammar; lifecycle change later|
|10 / COH-10|C1|Inspector/property rows, settings scroll and overlay padding compose different pane systems; I/AI/PD/P, UI-25/39|Shared Inspector/PropertyRow/ScrollArea contracts|

## Top craftsmanship failures

V/S findings are confirmed only to the scope stated. R entries are prioritized inspection risks, explicitly not invented native failures.

| ID | Level / evidence | Concrete detail | Proposed correction |
| --- | --- | --- | --- |
|CRA-01|C2 V/S O vs L|Content edge jumps20 CSS px by source when changing primary workspace|Same inset role across shell variants|
|CRA-02|C2 V/S L|34px search declaration,30px mode command and40px filters coexist in one wrapped bar|One density per group; explicit compact variants|
|CRA-03|C2 S P|Preview horizontal17.6 vs context14 vs shared16/20px inset|Use named pane/overlay inset tokens|
|CRA-04|C2 V/S D/S|Generic fields radius12 but Settings10; adjacent control nesting differs|Shared field/control shape role|
|CRA-05|C2 S P|Preview action gaps7.2 and6.4px, navigation4.8px equivalents|Named icon/group gap ladder|
|CRA-06|C2 V/S H/R|Rounded raised parent plus dashed empty child plus section border accumulate enclosure|Remove redundant boundary per semantic level|
|CRA-07|C2 V/S OP|Filled Plan tab competes with execution/action styling|Tonal selected choice independent from CTA|
|CRA-08|C2 S shared rows|Selected row adds3px focus-soft halo before keyboard focus|Reserve focus tokens for focus|
|CRA-09|C2 V/S L/H|Search icon16 versus15; file icons17 and warnings13|Canonical icon roles, optical review later|
|CRA-10|C2 V/S G|Folder fallback32/1.6 stroke versus file30/1.5; thumbnail framing compounds shape|One fallback optical family with justified size role|
|CRA-11|C2 V/S G|Grid metadata is a combined truncated line; filename suffix disappears early|Prioritize filename/extension and hide low-value metadata first|
|CRA-12|C2 V AI/SL/About|Horizontal scrollbar is visible across Settings body|Review width/overflow composition; retain one pane scroll owner|
|CRA-13|C2 V N|At969×675 command/status/management chrome leaves only roughly three file rows visible|Move management actions to controlled overflow before shrinking content|
|CRA-14|C2 V P/E/PDF|Preview backdrop visibly stops around mid-window while lower Library stays bright|Specify viewport-covering modal dimming; determine actual layout cause in later implementation|
|CRA-15|C2 V P|Close icon, Close Preview button and Space hint consume three chrome positions|One primary dismissal position plus secondary keyboard hint; retain accessible close|
|CRA-16|C2 V C/S/H|Same long raw English Cleanup error repeats inside Chinese primary UI and unrelated pages|Localized consequence with expandable technical detail; retain raw diagnostic record|
|CRA-17|C2 V C|Scan selected scope action appears in scope card and empty state after an error|One primary action for current state; no false empty-state recovery|
|CRA-18|C2 V I/PDF/PD|Context/metadata exposes Unknown/Keep/Inbox/backend text; PDF exposes boundary_readable|Human-facing state labels while preserving technical disclosure|
|CRA-19|C2 V/S AI/P, R contrast|Disabled provider/save/preview controls appear very faint; opacity42/50/55/60/70 differs|One disabled token policy; measure actual contrasts later|
|CRA-20|C2 S/R search/overlays|Spinner15 replaces clear32; external focus needs4px clearance inside tight overflow wrappers|Reserve trailing geometry and test ring clearance; no loading-jump/clipping PASS or FAIL claimed now|

Additional C3 opportunities: tooltip clarity and exact icon optical centering need missing hover/native-scale evidence. They should not displace the systemic fixes above.

## Canonical system proposal

Adopt the [candidate authority and metric specification](05-CANONICAL-UI-GRAMMAR-PROPOSAL.md): tokens own values, `components/ui` owns semantic anatomy, `surfaces.ts` forwards/composes, `tw.ts` and `views/shared/ui.ts` become bounded compatibility exports, and features select variants rather than invent controls. The most valuable first work is Button/IconButton/SearchField/Input/Select/SegmentedControl, then PageHeader/Toolbar, then Panel/Row/StateBlock/Notice and Inspector/overlay chrome. Exact deletion conditions and retained variants appear in every matrix row. This proposes a unique owner; it does not implement or freeze one.

## Four-screen reconstruction brief

These are constraints for later unified-system design, not new page layouts.

| Surface | Must share | Domain difference to retain |
| --- | --- | --- |
| Overview | Common page edge, section typography, Button, Notice, StateBlock and metric rhythm | Priority task and coverage are projections; do not fabricate readiness from Library data |
| File Library | Same edge, compact PageHeader/Toolbar variant, fields/icons, independent selected/focus, pane chrome | Library/Browse separation, query/selection authority, fixed-height virtual rows and deliberate column hiding |
| Quick Preview | Shared overlay header/footer/control metrics, metadata rows and unavailable/loading anatomy | Existing Preview Core, sourceVersion, host capability, cancellation, read-only content typography |
| Settings | Same page edge/title and canonical form controls/selection/focus; shared Notice and property rows | Preference grouping, disclosure, persisted settings and provider consent; denser diagnostics remain advanced |

## Things not to solve with styling

W6-05-F-001 Cleanup extended-path rejection; F-002 unavailable image/CSV/JSON/folder Preview and PDF metadata fallback; F-003 Global Index no source; F-004 Organization Plan suggestion/safe-preview failure; F-005 Browse/first-scan recovery friction remain as recorded. A nicer Notice does not make them work. Safe Trash/Restore, plan execution, native accessibility, exact DPI and missing Preview transitions remain unverified where W6-05 says so. No production fix, release qualification, version/tag change or W6-07 activation is authorized by this audit.
