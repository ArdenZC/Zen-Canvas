# Metric inventory and drift interpretation

Source snapshot: `3910dc9e6e5caca922a91482c8a3ae954cde4104`. [Full inventory](03-metric-inventory.json), [duplicate candidates](03-duplicate-class-groups.json), [reproduction script](build_audit_inventory.py).

## Measurement contract

The complete lexical sweep includes all 216 `src/**/*.ts`, `tsx`, and `css` files; 81 contain candidates. It is a discovery inventory, not a CSS AST, computed-style dump, mounted-instance count or defect count. It also includes compatibility and non-UI TS. Every candidate has exact file/line locations; source-file SHA-256 values bind the sweep. Whole-line/block comments are suppressed. Dynamic compositions, inline comments, string data and unreachable components require manual classification. `text-[var(...)]` may be a color, not a font size; `size: 1024` may be file data, not an icon. Do not add those to typography/icon ladders.

Counts: typography candidates 1,547 mentions / 65 distinct spellings; dimensions 475 / 152; spacing 1,299 / 173; shape 671 / 98; elevation 122 / 38; motion 70 / 16; icon/size candidates 386 / 45. There are 262 repeated four-token groups across distinct files. A frequent `flex items-center` group is not itself a semantic duplicate; the human [authority map](03-VISUAL-AUTHORITY-MAP.md) classifies actual duplication.

CSS px below means authored CSS units. Rem conversions assume a 16px root solely to compare declarations; the captured runtime's root font and DPI were not retained. Tailwind scalar conversions assume its standard 4px spacing unit. They are not measured native dimensions. `min-height` is a floor, not a fixed final border-box height; text line height, padding and border can increase it.

An important cascade seam: `src/styles.css:89–95` sets unlayered `font: inherit` on all buttons/fields and `letter-spacing: 0`, while Tailwind is imported as v4 layers. This can supersede utility font declarations. Feature unlayered CSS explicitly sets typography later. The screenshot's apparent font differences therefore cannot safely be equated with `text-sm` versus `text-xs` alone. Future design must specify computed roles and remove competing cascade ownership; this run did not execute a runtime computed-style probe.

## Authored metric families

| Metric | Current source values / examples | Interpretation |
| --- | --- | --- |
| Font size | Shared page24, section18, body14, quiet12, metric30; Library name13/meta12/header11; navigation10/11/12/13; Preview .72/.75/.76/.78/.82/.83/.86/1.05rem; root body inherited | Page/section/body/metadata/content are legitimate hierarchy. Preview chrome's 11.52/12.48/16.8px equivalents and nearby 12/13/14 values have no shared role authority. Content renderer typography may legitimately differ. |
| Font weight | 400/500/600/700 utilities; Preview650/700; grid/list name600; table11px/700 | Body400, labels500 and headings600 are useful. 650 chrome and local700 roles should be explicitly justified or consolidated. Font fallback/synthesis can change actual available weight. |
| Line height | `leading-5`20; `leading-6`24; Settings title inherited; Library navigation1.5; Preview1.5/1.55/1.6 | Multiline prose needs more leading than single-row labels. A component cannot leave geometry dependent on unrelated inherited line height. |
| Letter spacing | Page-.01em; metrics-.02em; metric label+.12em; Preview kicker+.08em; navigation group+.04em; controls reset0 | Brand/kicker versus body is legitimate. Uppercase Latin tracking should not be imposed on Chinese labels; consolidate label and heading roles. |
| Button | tw base min40 + x16/y8; Button compact min36 + x12/y6; default token40; shared segment min32; Library command min30 | Density ladder is useful, but appended class conflicts and feature-owned30 need replacement by explicit size variants. |
| Input/select/search | Generic min40/r12; Settings min40/r10; shared SearchField min40; Library search CSS min34; launcher fixed32/pill | Launcher differs semantically. Local versus history search should use one field with density. Field and button same-role radius should not vary by page. |
| Icon buttons | Generic36; shared search clear attempts32; context close30; Preview36; OS window44×48 | OS hit targets are a legitimate platform exception. Internal close/clear needs one hit-target ladder; class concatenation is not override resolution. |
| Segmented controls | Shared min32 with p4/gap4 group; Settings min32 with p4/gap4, multiline responsive choices; Library min30 within p2/gap2 group | Radio/tab/pressed semantics may differ; mutually exclusive selected appearance should share one visual grammar. |
| Switch | Shared and Settings track48×28, thumb20, travel20; Settings target min40 | Useful existing metric equivalence. Duplicate rendering/state ownership remains even where pixels look similar. |
| Page inset | AppShell ordinary x20/y20; narrow x12/y20; Library0. Shell sidebar228, narrow176; titlebar48 | Sidebar/responsive hierarchy is intentional. Content-edge mismatch is 20px desktop, 12px narrow by source; workspace identity should not own inset. |
| Header | pageHeader mb16 gap16; subtitle mt4/leading24; Library command gap8 bottom10; Preview header16/17.6/14.4 at root16 | Compact workspace heading allowed; a shared origin and group spacing are still needed. |
| Section spacing | Generic gap12/16/20; Settings section pb28, group pt20, row y16; context gap16 | Section/row separation is meaningful. 28 is not inherently defective: assign it a role or move to declared section32 after visual evaluation. |
| Panel padding | formSection16; panelSurface20; navigation/context14; Sheet20×16; Confirm20; CloseChoice24; Preview17.6 horizontal | Compact inspector can use smaller inset; 14 versus16 and17.6 versus16 are undocumented local decisions. |
| Toolbar spacing | Shared flex gap12; Library group2, command gap6, bar gap8; Preview action gap7.2, child gap6.4; shared button8 | Nested action versus group gaps need hierarchy. Fractional/rem chrome decisions are drift candidates. |
| Row height | Tokens42 compact /52 default; file virtualizer fixed44; grid virtualizer204 | 44px two-line virtual rows are plausible. Keep actual render and virtualizer estimate bound to the same metric before any future change. Never blindly replace with42/52. |
| Radius | Row8; control10; field12; panel16; floating20; window24; full-pill; grid warning999px | Hierarchy is present. Same field10/12 and group/child both10 need semantic nesting rules. Pill is valid, not raw-radius abuse. |
| Border/divider | Mostly1px; focus2; selected inset1 and shared selected halo3; dashed empty boundaries | Borders signal grouping and focus signals location; a3px selected glow should not consume focus tokens. |
| Icon family/size | JSX `size={12,13,14,15,16,17,18,19,20,22,24,28,30,32}`; createElement also10/11; Lucide mostly default stroke, grid1.5/1.6 and some2.2/2.5 | Content thumbnail icons can be32, large status24. Search15 versus16 and list17 versus action16 are drift candidates; optical QA still required. |
| Icon/text gap | Shared8; sidebar12; file name9; Library action6; Preview6.4/4.8 | Sidebar icon-text gap can be larger;9/6.4/4.8 need role justification. |
| Elevation | raised, floating, spotlight tokens; Tailwind shadow-sm/inner; inset border/brand highlights; checked-switch glow | Three true layers useful; uncontrolled row/track glows and shared raised static shells weaken the layer hierarchy. |
| Overlay | Shared `--zc-overlay`; command blur-sm; sheet blur-xl; Preview color-mix72%; floating shadow separate | Host modalities may vary, but Preview dimming geometry and intensity should not be a separate accidental visual system. |
| Motion |120/180/280ms tokens; raw0.16s motion transition; generic transition classes; Preview actions have no shared transition recipe | Global Reduced Motion rule is a strength. Timing declarations alone do not prove input continuity or layout stability. |

## Token bypass and leakage disposition

- Raw color sweep found 133 literal mentions, 131 in `tokens.css`, two legacy `--inset` rgba definitions in `styles.css:32,46`. This does **not** support a claim of widespread feature-local raw hex colors. Core color token adoption is a strength.
- The main bypass is metrics and anatomy: `fileLibraryWorkspace.css` owns 30/32/34/42 controls,14px pane insets and10–13px text; Preview CSS owns its rem scale; Settings owns duplicated inputs/switches/segments. Tokenized colors do not make these one system.
- `utils/tw.ts → components/ui/surfaces.ts → views/shared/ui.ts` contains real alias/re-export chains. `contentPanel`, Button and Notice re-exports are not three implementations. However `sectionTitle` is independently spelled in tw.ts and surfaces.ts, and Settings control/state implementations are real forks.
- `cn` only filters and joins strings. It does not merge competing Tailwind groups. Button size and Search clear overrides must be audited against generated CSS order; putting a class last is not evidence it wins.
- Bare `shadow-sm`, arbitrary inset shadows, feature CSS radii and arbitrary pixel gaps are inventoried even when their visible output looks similar. They are ownership candidates, not automatic defects.

## Proposed disposition rule

Retain a value when it names a user-visible hierarchy (OS controls, dense file row, content typography, compact inspector, destructive confirmation). Consolidate when equivalent roles differ only by page or historical host. Mark unresolved when actual CSS cascade, optical centering, locale or input-state evidence is missing. Phase B freezes the candidate ladder only after comparing the four representative surfaces; this inventory does not freeze it.
