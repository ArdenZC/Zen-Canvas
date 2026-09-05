# W6-06 — UI Coherence + Craftsmanship Audit — Codex Brief

Status: **DESIGN/SOURCE AUDIT ONLY — production implementation not authorized**

Prerequisite: the W6-06 Coherence + Craftsmanship Amendment must be merged/current before execution.

## Goal

Determine precisely why current Zen Canvas screens fail to feel like one polished product, even when individual pages are functional.

This is not a bug-fix task and not a visual-theme exercise.

Do not change production code.

## Inputs

Read:

- `AGENTS.md`
- `docs/project/STATUS.md`
- `docs/project/tasks/W6-06-ZEN-VISUAL-SYSTEM-UX-REDESIGN-ACTIVATION.md`
- `docs/project/tasks/W6-06-COHERENCE-CRAFTSMANSHIP-AMENDMENT.md`
- `docs/project/tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md`
- `outputs/w6-05-native-audit/manifests/audit-results.json`
- `outputs/w6-05-native-audit/notes/`
- retained W6-05 screenshots
- historical V4.0/V4.3/W2 design references where useful

Inspect current presentation sources including at minimum:

- `src/styles/tokens.css`
- `src/styles.css`
- `src/utils/tw.ts`
- `src/components/ui/`
- `src/components/ShellChrome.tsx`
- `src/views/shared/ui.ts`
- representative feature views for Overview, File Library, Preview, Settings, Organize, Cleanup, History and Automation.

## Audit output

Create:

`docs/design/w6-06/03-UI-COHERENCE-CRAFTSMANSHIP-AUDIT.md`

and machine-readable:

`docs/design/w6-06/03-ui-coherence-matrix.json`

Do not create a visual-theme prototype in this task.

## Required matrix fields

For every audited semantic primitive/pattern record:

- `semantic_role`
- `current_implementations`
- `source_locations`
- `representative_screens`
- `current_dimensions`
- `current_spacing`
- `current_typography`
- `current_radius_border_elevation`
- `states_supported`
- `inconsistency_type`
- `craftsmanship_issue`
- `severity` (`P1/P2/P3` for design debt only; do not reuse product safety severity without explanation)
- `canonical_target_anatomy`
- `allowed_variants`
- `patterns_to_retire`
- `w6_07_action`

## Mandatory semantic roles

Audit at least:

1. App/window titlebar
2. Sidebar item
3. Page header
4. Section header
5. Workspace command bar
6. Search field
7. Primary button
8. Secondary button
9. Ghost/icon button
10. Segmented/chrome toggle
11. Input
12. Select
13. Switch
14. Toolbar
15. Notice/status strip
16. State block
17. Content panel
18. Raised panel
19. Card
20. List row
21. Grid item
22. Table header
23. Selection
24. Keyboard focus
25. Inspector
26. Side Sheet
27. Dialog
28. Popover/menu
29. Tooltip
30. Toast
31. Preview chrome
32. Settings section/row
33. Empty state
34. Loading state
35. Degraded/limited state
36. Unavailable state
37. Recoverable error state
38. Safety-blocked state
39. Scrollbar/overflow treatment
40. Divider/separator treatment
41. Icon size/alignment rules
42. Typography roles
43. Spacing/inset rhythm
44. Radius ladder
45. Elevation/shadow ladder
46. Motion/transition grammar

## Cross-screen alignment audit

Compare Overview, File Library, Quick Preview and Settings side by side.

Explicitly answer:

- Are content left edges aligned to one shell grid?
- Are page titles placed at the same vertical rhythm?
- Do toolbars begin/end at consistent coordinates?
- Do same-role controls share height/radius/padding?
- Are section gaps drawn from one spacing scale?
- Are icons the same size and stroke weight for the same role?
- Are border colors/weights consistent?
- Are panel corner radii consistent with nesting depth?
- Does Settings use a different visual dialect than File Library?
- Does Preview look like a separate mini-app?
- Are empty/error states using unrelated compositions?
- Are selected/focus/hover states consistent across list, grid, nav and settings?

## Craftsmanship checklist

For each representative screen inspect:

- 1px edge alignment;
- icon optical centering;
- icon/text baselines;
- row vertical centering;
- control height consistency;
- internal padding symmetry;
- text truncation;
- line-height rhythm;
- separator endpoints;
- scroll-area edge treatment;
- rounded-corner nesting;
- focus-ring clearance;
- hover/pressed transition consistency;
- disabled-state contrast;
- empty/loading layout stability;
- popover/dialog edge clearance;
- scrollbar intrusion;
- narrow-window compression order;
- Chinese/English expansion risk;
- Light/Dark parity risk.

Do not use vague findings like "spacing feels off" when a measurable mismatch can be recorded.

## Duplication / authority audit

Identify cases where the same visual semantic role is implemented in several places.

Pay special attention to overlaps among:

- token variables;
- `utils/tw.ts` class recipes;
- `components/ui/*`;
- `views/shared/ui.ts`;
- feature-local classes.

For each duplicate semantic role, recommend one canonical W6-07 ownership location and a retirement path for the others.

Do not modify those files in W6-06.

## Final synthesis

The Markdown audit must end with:

### Top coherence failures

The 10–20 highest-impact reasons Zen Canvas currently feels assembled rather than designed as one product.

### Top craftsmanship failures

The 10–20 repeated small-detail problems that most damage perceived quality.

### Canonical system proposal

A concise proposal for what becomes visually authoritative in W6-07.

### Four-screen reconstruction brief

For Overview, File Library, Quick Preview and Settings, state exactly what must change so all four visibly share the same system.

### Things not to solve with styling

List failures that require later product/functional work rather than visual camouflage, including relevant W6-05 FAIL/UNVERIFIED states.

## Boundaries

Do not:

- edit production source;
- change tokens/components in production;
- create another theme trio;
- relabel W6-05 FAIL/UNVERIFIED as PASS;
- change release/version/tag state;
- activate W6-07;
- run whole-product native regression.

This task produces evidence and a design-system consolidation plan only.