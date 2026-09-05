# W6-06 — Mature Product Benchmark — Codex Brief

Status: **DESIGN RESEARCH ONLY — production implementation not authorized**

Authority:

- `docs/project/tasks/W6-06-ZEN-VISUAL-SYSTEM-UX-REDESIGN-ACTIVATION.md`
- `docs/project/tasks/W6-06-COHERENCE-CRAFTSMANSHIP-AMENDMENT.md`

## Goal

Study mature, highly crafted desktop products to extract reusable design principles for Zen Canvas without cloning any one product.

The benchmark must answer:

> What design decisions make mature desktop software feel coherent, trustworthy and meticulously finished across many screens and states?

Do not produce a mood board of screenshots alone. Decompose the products into transferable rules.

## Reference set

Use current official product documentation, official product pages, first-party screenshots and direct product observation where safely available.

Reference categories:

### Platform-native file experience

- macOS Finder
- macOS Quick Look
- Windows 11 File Explorer / Fluent 2

Study:

- window/titlebar integration;
- sidebar hierarchy;
- toolbar composition;
- file-row density;
- selection/focus differences;
- path/location communication;
- context menu grammar;
- preview behavior;
- resize/overflow handling;
- platform-specific chrome.

### Keyboard-first productivity

- Raycast

Study:

- one dominant search/action surface;
- keyboard navigation consistency;
- action panel conventions;
- shortcut presentation;
- settings discoverability;
- dense information without visual clutter;
- state/focus feedback;
- command hierarchy.

### Calm personal productivity

- Things

Study:

- long-session visual comfort;
- restrained color usage;
- typography rhythm;
- quiet secondary information;
- sidebar/content balance;
- search/navigation integration;
- empty-state restraint;
- how details disappear until needed.

### High-density professional workflow

- Linear

Study:

- predictable header/action placement;
- sidebar recession vs content emphasis;
- density without chaos;
- unified component anatomy;
- small-detail iteration;
- motion restraint;
- selection/focus hierarchy;
- progressive disclosure;
- consistency after feature growth.

### Professional pane / inspector systems

- Figma desktop/web app
- optionally another mature desktop knowledge/content tool where directly relevant

Study:

- left navigation vs central work canvas vs right inspector;
- pane boundaries;
- inspector grouping;
- property-row anatomy;
- selection context;
- scroll ownership;
- toolbar/panel interaction;
- advanced-control density.

## Research method

Create:

`docs/design/w6-06/04-MATURE-PRODUCT-BENCHMARK.md`

For each reference product, record only patterns relevant to Zen Canvas.

Each finding must contain:

- product/reference;
- observed pattern;
- why it works;
- exact Zen Canvas problem it can inform;
- what should be adopted as a principle;
- what must NOT be copied literally;
- platform caveat;
- confidence/source quality.

## Required comparison dimensions

At minimum compare:

1. Window chrome
2. Sidebar
3. Page/view header
4. Toolbar / command bar
5. Search
6. Navigation/location
7. List/table density
8. Grid density
9. Selection
10. Keyboard focus
11. Hover/pressed states
12. Context menus
13. Popovers
14. Dialogs/sheets
15. Inspector/context panel
16. Settings/preferences
17. Empty states
18. Loading/progress
19. Recoverable error
20. Unavailable/unsupported capability
21. Safety/destructive confirmation
22. Preview/content viewer
23. Keyboard shortcut grammar
24. Motion/transition
25. Scroll/overflow
26. Narrow-window adaptation
27. Light/Dark treatment
28. Iconography
29. Typography
30. Spacing rhythm
31. Border/radius/elevation
32. Advanced/technical information disclosure

## Benchmark principles, not screenshots

End the document with a synthesized section:

### Principles Zen Canvas should inherit

Produce 12–20 concise system principles.

Examples of the level of specificity expected:

- navigation chrome must visually recede after the user arrives at content;
- same-role commands keep the same placement across major surfaces;
- secondary actions move to menus/overflow before primary content compresses;
- file rows prioritize names and location context before metadata decoration;
- keyboard focus must be independent from selection;
- unsupported preview must still preserve navigation/context and explain the next useful action;
- Settings should be searchable and ordinary preferences should not compete with diagnostics;
- platform-specific window chrome may differ while internal content metrics remain system-consistent.

Do not write vague principles such as “keep it clean” or “use whitespace.”

### Patterns Zen Canvas should explicitly avoid

List mature-product patterns that are unsuitable for Zen Canvas, for example:

- copying macOS chrome onto Windows;
- turning every advanced action into permanent toolbar chrome;
- copying Linear density into low-information states;
- copying Raycast command-first interaction into workflows where persistent file context matters;
- copying Figma inspector density into ordinary preferences;
- using a branded visual effect where content should dominate.

## Source quality

Prefer first-party/official sources and direct observation.

If a third-party screenshot or commentary is used, mark it as secondary evidence.

Record URLs/references in the design document but do not copy protected visual assets into production.

## Relationship to coherence audit

The benchmark does not replace:

`W6-06-UI-COHERENCE-CRAFTSMANSHIP-AUDIT-CODEX.md`

The two outputs must be combined:

- coherence audit = what is inconsistent in Zen Canvas now;
- mature-product benchmark = what proven design systems teach us;
- W6-06 canonical grammar = the Zen Canvas-specific synthesis.

## Boundaries

Do not:

- edit production UI;
- clone a reference product;
- copy proprietary icons/assets;
- replace Zen Canvas product architecture to imitate another product;
- claim product behavior was tested because a reference app behaves that way;
- activate W6-07;
- change version/release/tag state.