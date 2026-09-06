# Craftsmanship review — unified grammar specimen

**UNIFIED UI GRAMMAR DRAFT COMPLETE — OWNER REVIEW REQUIRED**

Self-review: **92/100** at the specimen/design-specification level. This is not product-owner approval, a production freeze, full representative-page acceptance or W6-06 completion. The [accepted rubric](../../project/tasks/W6-06-DESIGN-CRAFTSMANSHIP-QUALITY-BAR.md) remains unchanged. Each category minimum is met in this provisional self-assessment; actual owner judgment may reject the draft regardless of score.

## Scoring and deductions

| Category | Score / maximum | Minimum | Subscores in rubric order | Deduction / unresolved evidence |
| --- | --- | --- | --- | --- |
| A Cross-product coherence |19/20|18|4 + 5 + 4 + 4 + 2|−1: shared specimen compositions align, but complete Overview/Library/Settings target comparisons are deliberately outside this task |
| B Component craftsmanship |14/15|14|3 + 2 + 3 + 3 + 3|−1: icon boxes and line metrics inspected; exact native glyph raster/optical centering across installed Windows/macOS fonts remains unverified |
| C Information hierarchy |11/12|11|3 + 3 + 2 + 1 + 2|−1: the editorial specimen needs explanatory labels and sample-state annotations; content/chrome comfort must be judged again in real task compositions |
| D Interaction states |11/12|11|3 + 2 + 2 + 1 + 3|−1: reserved loading geometry demonstrated and specified; real asynchronous provider/cancellation transitions are not exercised |
| E Desktop/platform credibility |9/10|9|2 + 2 + 2 + 3|−1: browser keyboard/menu/pane behavior checked, but integration with actual Windows window chrome/input is not newly verified |
| F Density and long-session comfort |7/8|7|2 + 2 + 2 + 1|−1:32/36 commands and44px rows measured; sustained use with a large real library has not been studied |
| G Failure and safety craftsmanship |8/8|7|2 + 2 + 2 + 2|No design-level deduction: unavailable/error/blocked/permission/partial remain explicit; no hidden or repaired W6-05 failure is claimed |
| H Responsive/i18n/theme resilience |7/8|7|2 + 2 + 2 + 1|−1: three browser client sizes and both locales/themes checked; scaled native desktop/DPI/Retina condition remains unverified |
| I Brand restraint and distinctiveness |4/4|3|2 + 2|No design-level deduction: graphite content, restrained action blue, tonal selection/marker and plain pane structure; no copied reference chrome/assets |
| J Motion and micro-interaction |2/3|2|1 + 1 + 0|−1: restrained token timings specified; complete live loading/transition continuity is not evaluated by static examples |
| **Total** |**92/100**|**92**| |**8 points withheld; owner review mandatory**|

The platform/comfort/coherence scores evaluate the proposed design, not empirical native or user-study performance. This distinction is essential: no amount of self-scoring supplies missing platform, full-page or owner evidence.

## Actual browser verification

Used the Codex in-app browser at100% page zoom, reported devicePixelRatio1. Browser samples were inspected at1920×1032,1282×862 and980×680. The width switch also constrains the editorial board. [Browser matrix](06-evidence/browser-matrix.json) retains **24 final combinations**: three client sizes × two themes × two languages × two densities. Measurements are DOM border boxes, not native physical pixels.

Observed:

- All visible Toolbar command peers measured32px compact /36px default in each final case.
- Toolbar measured48/52px at wide and medium,96/104px in the two-row narrow recipe.
- FileRow measured44px in all24 cases; selected+focus remains independent.
- Inspector measured320 wide,280 medium, collapsed narrow; modal Inspector measured320 with no horizontal body overflow.
- Document overflow checks and checks of Toolbar, preference rows, Preview, PropertyRow, review controls and section headings found no horizontal overflow in the final matrix. Filename ellipsis remains an intentional local behavior, not a blanket no-truncation claim.
- [Interaction checks](06-evidence/interaction-checks.json): safe initial dialog focus; Tab/Shift+Tab containment and wrap; Escape focus return; menu opening/arrows/Escape; menu→Inspector→menu-trigger return; segment arrow selection and one tab stop; example search1 match and clear returning4 examples/focus.
- The four viewer switches were clicked through the final matrix; local selection and Switch/Pin are specimen state only. No product files, privacy settings, providers or filesystem operations are invoked.
- Browser warning/error log query returned an empty list during final inspection. JavaScript syntax and artifact structure checks also passed.

Early navigation/resize measurements briefly captured the browser's previous viewport. Those samples were excluded; the final matrix changes controls in a stable viewport and explicitly asserts the measured client width. No transient size is relabeled as a passing intended-size run.

## Visual inspection and retained examples

Screenshots were inspected as browser renderings, not just generated. Review covered Chinese Light, Chinese Dark, English Light and English Dark. The retained selections are a compact review record; the interactive HTML is the primary artifact.

| Image | Deliberate review focus |
| --- | --- |
| [Chinese Light selection/focus](06-evidence/light-zh-selection-focus.jpg) | Mouse selection without a frame; actual keyboard focus as filename underline |
| [Chinese Light controls](06-evidence/light-zh-medium-controls.jpg) | label/help separation, field/button height, CJK baseline, disabled text, warning anatomy |
| [Chinese Dark states](06-evidence/dark-zh-medium-states.jpg) | consequence hierarchy, error/warning distinction, non-inverted Dark surfaces, same Preview family |
| [English Light Preview](06-evidence/light-en-medium-preview.jpg) | overlay/header/footer16px inset, menu alignment, radius family, quiet disabled navigation |
| [English Dark narrow Preview](06-evidence/dark-en-narrow-preview.jpg) | long title fit, icon target parity, restrained borders/shadows, narrow actions |
| [English Dark wide](06-evidence/dark-en-wide.jpg) | row/title/toolbar relationship and wide working density |

1px detail review: one-pixel dividers terminate at shared boundaries; command border-box height includes the divider cost; focus underlines have separate clearance; segment inner4/outer8 radius relationship is deliberate. Text and icon boxes align on defined20/24px lines; no feature optical nudges. File object icons center on the two-line44px object row; Notice icons align to the first text line. Exact OS glyph optical equivalence remains a deduction, not a claimed pixel-perfect native pass.

The light/dark floating shadow and surface luminance were reviewed together. Static panels/rows have no decorative shadow. The specimen's neutral overlay-stage background is a documentation presentation surface, not a second product modal or nested-border recipe.

## Corrections made during review

1. A hidden size column was re-exposed by a higher-specificity `.file-row .meta` rule, producing stray text beneath a44px row. Corrected hiding specificity and rechecked all sizes.
2. Preference help text initially shared the label line. Made help a separate block and associated the accessible field label independently.
3. Toolbar initially measured53px because of its divider. Accounted for the border inside the intended52px default /48px compact box; narrow is104/96.
4. Light disabled/subtle contrast initially measured4.385:1 against the voluntary4.5 target. Darkened only the disabled-text semantic token; threshold unchanged.
5. Disabled destructive menu item retained danger tone and could receive hover. Suppressed disabled hover and used the same readable disabled token.
6. Menu-triggered dialogs initially attempted to restore a hidden menu item. Restore now targets the visible overflow trigger.
7. Native HTML dialog alone allowed Tab to reach the browser boundary. Added explicit specimen first/last focus wrap and successfully repeated both Tab directions and Escape.
9. Owner rejected leading vertical selection bars and full-perimeter highlighted frames. Removed both throughout the candidate. Selection now uses quieter tonal surfaces and trailing checks; keyboard focus uses local underlines or short bottom lines. Re-rendered evidence after this revision. Score remains provisional and does not imply owner acceptance.
8. Removed smooth document-anchor scrolling to avoid unnecessary specimen navigation motion and transient capture ambiguity.

## Artifact and contrast checks

[Artifact report](06-evidence/artifact-checks.json) binds the HTML SHA-256 and checks165 bilingual attributes, unique IDs/local anchors, required controls and30 mandatory primitive rows (plus NavigationItem/TableHeader are specified). **52 semantic contrast pairs pass** the defined target: text4.5:1; meaningful focus/selection-check/control boundaries3:1. Calculations use the declared sRGB colors, not screenshot sampling. Divider/background pairs are deliberately noninteractive and are not falsely certified as3:1 controls. This check is not WCAG certification.

Reproduce with `python docs/design/w6-06/06-validate-specimen.py`. The validator updates its task-owned report only. The inline script was syntax-checked with `node --check --input-type=commonjs` via standard input; no dependency installation or temporary JavaScript file was needed. Final documentation/governance checks are recorded in the [result](../../project/tasks/W6-06-UNIFIED-ZEN-UI-GRAMMAR-FREEZE-RESULT.md) and final task response.

## Rejection scan and remaining work

No automatic rejection condition was observed in the inspected specimen: shared control geometry, content origins, Preview family, selection/focus separation, unified state anatomy, one token palette, named icon sizes, shared overlays, deliberate narrow overflow and bilingual/theme behavior are present. Full representative-page comparisons are not produced or approved here; their corresponding rejection checks remain pending for that later W6-06 scope.

Unverified: actual Windows/macOS font rasterization, scaled desktop/DPI/Retina, OS titlebar conventions, Narrator/VoiceOver, high-contrast runtime, Reduced Motion runtime, native IME behavior, full virtualized library, real provider loading/cancellation, native Preview pin/navigation, long-session comfort and owner aesthetic judgment. Reduced Motion/forced-colors/IME rules exist in the design but are not promoted into a runtime pass.

All retained W6-05 functional failures and22 UNVERIFIED states remain unchanged. No release or W6-07 authorization follows. The owner must inspect `06-system-specimen.html` before any later page reconstruction decision.
