# W6-06 — Unified Zen UI Grammar Freeze — Codex Task

Date: 2026-09-06

Status: **AUTHORIZED — design/specification only; production implementation not authorized**

## Purpose

Turn the accepted W6-06 coherence/craftsmanship audit into **one authoritative Zen Canvas UI grammar** before any representative page reconstruction or W6-07 production work.

This task is not a theme exercise and not a page redesign sprint.

The product-owner direction is explicit:

> Zen Canvas must be treated as flagship desktop software. The major problem is not that an individual screen uses an unattractive palette; it is that the application lacks one coherent visual language and the micro-detail craftsmanship is below the intended quality bar.

The task must therefore answer, at system level:

> What is the single visual, spatial, component, interaction and state grammar that every Zen Canvas surface will obey?

## Baseline and evidence authority

Start from the latest fetched `master` containing PR #204, the accepted UI Coherence + Craftsmanship Audit.

Read in full before designing:

- `AGENTS.md`
- `docs/project/STATUS.md`
- `docs/project/ROADMAP.md`
- `docs/project/initiatives/W6-product-maturity-audit.md`
- `docs/project/tasks/W6-06-ZEN-VISUAL-SYSTEM-UX-REDESIGN-ACTIVATION.md`
- `docs/project/tasks/W6-06-COHERENCE-CRAFTSMANSHIP-AMENDMENT.md`
- `docs/project/tasks/W6-06-MATURE-PRODUCT-BENCHMARK-CODEX.md` if present
- `docs/project/tasks/W6-06-CRAFTSMANSHIP-QUALITY-BAR.md` if present
- `docs/project/tasks/W6-06-UI-COHERENCE-CRAFTSMANSHIP-AUDIT-RESULT.md`
- `docs/design/w6-06/03-UI-COHERENCE-CRAFTSMANSHIP-AUDIT.md`
- `docs/design/w6-06/03-VISUAL-AUTHORITY-MAP.md`
- `docs/design/w6-06/03-METRIC-INVENTORY.md`
- `docs/design/w6-06/03-INTERACTION-STATES.md`
- `docs/design/w6-06/04-MATURE-PRODUCT-BENCHMARK.md`
- `docs/design/w6-06/05-CANONICAL-UI-GRAMMAR-PROPOSAL.md`
- `docs/design/w6-06/03-comparison-atlas.html`

Retained W6-05 native screenshots are evidence of the current product, not target designs.

## Mandatory audit findings to resolve in the grammar

The grammar must directly resolve the systemic issues already established by evidence, including:

1. ordinary-page versus Library content-origin split (`20px` versus `0px` current authority);
2. control metric ownership split across shared primitives, feature CSS, Settings and Preview;
3. selected-choice grammar split between primary fill, underline, tonal/border and row halo;
4. Preview chrome acting like a separate visual system;
5. empty/error/recovery states using unrelated anatomy;
6. Settings recreating controls and message/state patterns outside shared primitives;
7. narrow Library command/management chrome consuming excessive vertical space;
8. decorative/nested panel borders and elevation creating false hierarchy;
9. global/local error presentation ownership conflicts;
10. inspector/property/settings/overlay panes using unrelated spacing/scroll grammars.

Do not solve genuine domain differences by forcing every surface into one shape. The goal is **same semantic role = same grammar**, while preserving legitimate role variants.

## Mature-product benchmark stance

Use the existing benchmark synthesis as quality reference, not as a cloning target.

The design should absorb principles from mature products where they are strongest:

- Finder / Quick Look — file hierarchy, restrained chrome, selection, Preview relationship;
- Windows File Explorer / Fluent — Windows-native density, focus and interaction credibility;
- Raycast — command/search/action grammar and keyboard clarity;
- Things — calm hierarchy and long-session rhythm;
- Linear — high-density consistency and micro-detail refinement;
- Figma/professional tools — pane, inspector, property and complex-workspace hierarchy.

Do not copy proprietary assets, distinctive layouts, or another product's brand identity.

## Governing design principles

The final system must be:

- coherent before decorative;
- precise before expressive;
- calm without becoming empty;
- dense enough for file work without becoming cramped;
- native-desktop credible on Windows and adaptable to macOS;
- restrained in chrome and explicit in state;
- equally intentional in Light/Dark and Chinese/English;
- keyboard-aware without looking like a command-line product;
- local-first and trustworthy when degraded, unavailable or safety-blocked.

### Hard rule

**No feature/page may invent a new metric, radius, state treatment, field anatomy, toolbar grammar, pane inset or overlay chrome merely because it is convenient.**

If a new variant is genuinely necessary, the variant must be named semantically and documented at system level.

## Part 1 — Freeze the authority hierarchy

Define the intended final presentation authority model.

At minimum:

1. `tokens.css` — sole primitive/semantic value authority;
2. `components/ui` — sole canonical component anatomy and interaction-state authority;
3. `surfaces.ts` — composition/layout recipes only, not a second value system;
4. `tw.ts` and `views/shared/ui.ts` — bounded compatibility exports with explicit retirement path;
5. feature views — choose semantic variants and provide domain data; they do not invent generic styling.

Produce an authority table containing:

- role;
- sole owner;
- allowed variants;
- forbidden local overrides;
- compatibility path;
- later W6-07 retirement condition.

## Part 2 — Freeze the metric ladders

The audit candidate values are proposals, not automatically accepted values.

Choose and justify one final metric system for the target design.

### Required ladders

#### Spacing

Define named spacing roles, not just numbers:

- micro/icon gap;
- control internal gap;
- inline control-group gap;
- row internal inset;
- panel inset;
- page/workspace inset;
- section gap;
- major pane gap.

Use a small coherent ladder. Avoid arbitrary `17.6px`, `7.2px`, etc. unless a platform/native reason is documented.

#### Control heights

Define explicit semantic roles such as:

- compact command;
- standard desktop control;
- prominent action if truly necessary;
- icon-button sizes;
- file-row/list density.

Do not let one toolbar contain accidental `30/34/36/40px` peers.

#### Typography

Freeze semantic roles for at least:

- window/surface title;
- page title;
- section heading;
- body;
- control label;
- metadata;
- quiet/supporting text;
- table/header label;
- filename/content title;
- code/technical detail.

Specify size, weight, line height, tracking and CJK/Latin behavior.

Avoid fractional/nonstandard font weights such as `650` for shared chrome unless explicitly justified by actual font support.

#### Radius

Freeze a small semantic ladder, e.g.:

- control;
- row/tile;
- panel;
- floating/overlay;
- window-only if needed.

Adjacent components must look related.

#### Icon ladder

Define semantic sizes and optical rules:

- micro/status;
- inline/control;
- navigation/file;
- empty-state/illustrative if needed.

Define stroke-weight expectations, baseline/optical alignment, text gap and hit-target relationship.

#### Elevation and borders

Define when to use:

- no boundary;
- divider;
- subtle border;
- raised surface;
- floating/overlay shadow.

A component must not use border + nested border + shadow simply to create separation.

## Part 3 — Freeze canonical component anatomy

Produce detailed anatomy/state specifications for at least:

- Button;
- IconButton;
- SearchField;
- Input;
- Select;
- SegmentedControl;
- Toolbar and ToolbarGroup;
- PageHeader / CompactWorkspaceHeader;
- SectionHeader;
- Panel;
- Row / InteractiveRow;
- FileRow / GridTile role relationship;
- Badge/status indicator;
- Notice;
- StateBlock;
- Popover/Menu;
- Dialog/Sheet;
- Inspector;
- PropertyRow;
- ScrollArea;
- Tooltip;
- Toast;
- Modal/Preview overlay chrome.

For every canonical component specify:

- semantic purpose;
- anatomy;
- dimensions;
- typography;
- icon role;
- padding/gap;
- radius/border/elevation;
- default;
- hover;
- pressed;
- selected/checked where applicable;
- focus-visible;
- disabled;
- loading;
- error/warning/status interaction where applicable;
- compact/default variants;
- Light/Dark behavior;
- Chinese/English expansion rules;
- narrow-width behavior;
- anti-patterns / forbidden local overrides.

## Part 4 — Freeze the interaction-state grammar

Selection, focus and action must remain independent.

### Mandatory precedence

Define precise combination rules for:

`default → hover → pressed`

plus orthogonal:

- selected/checked;
- keyboard focus;
- disabled;
- loading;
- error/warning/success;
- unavailable;
- safety blocked.

Rules must ensure:

- selected does not look like a primary CTA;
- keyboard focus is visible on selected and unselected controls;
- disabled suppresses hover/press appearance;
- loading reserves geometry and does not jump when a clear/action icon changes to spinner;
- semantic status does not replace focus or selection;
- raw diagnostic states do not dominate ordinary user-facing surfaces.

## Part 5 — Freeze the spatial composition grammar

Define one coherent desktop spatial system covering:

### Window shell

- titlebar relationship;
- sidebar width/behavior;
- workspace origin;
- command/search relationship;
- pane boundaries;
- global Spotlight versus local Search.

### Page/workspace variants

Allow explicit variants only when meaningful, such as:

- standard page;
- dense workspace (File Library/Browse);
- settings/preferences workspace;
- floating Preview/overlay.

All variants must derive from the same base inset/grid system; no unexplained `20px` versus `0px` split.

### Pane system

Define:

- main content;
- inspector/context panel;
- settings local navigation;
- sheet/dialog;
- Preview overlay;
- property rows;
- scroll ownership.

There must be one rule for which element owns scrolling and breathing room at edges.

## Part 6 — Freeze command hierarchy

Define a shared action grammar:

- primary task action;
- secondary action;
- quiet/ghost action;
- destructive action;
- mode/choice toggle;
- overflow action;
- context action;
- navigation action.

Specify where actions live in:

- PageHeader;
- Toolbar;
- row/tile;
- Inspector;
- dialog footer;
- Preview chrome.

Avoid duplicated primary actions in multiple visual locations for the same current state.

## Part 7 — Freeze cross-product state anatomy

Define one shared anatomy for:

- Ready;
- Loading;
- Empty;
- Limited/Degraded;
- Unavailable;
- Recoverable Error;
- Safety Blocked;
- Permission Required;
- Disabled.

For each state specify:

- icon/tone;
- title/body hierarchy;
- technical detail disclosure;
- action count and priority;
- inline versus full-surface variant;
- persistence/lifecycle ownership;
- when a global toast is appropriate versus local Notice/StateBlock.

Do not cosmetically hide the known W6-05 functional failures.

## Part 8 — Light, Dark, Chinese, English

The system must not be authored for one screenshot configuration and patched later.

Define:

- semantic color roles for both themes;
- elevation and border differences by theme;
- minimum hierarchy in dark surfaces without excessive glow;
- disabled treatment policy;
- long Chinese/English label expansion;
- control minimum/maximum width policy;
- wrapping versus truncation rules;
- typography fallback assumptions.

## Part 9 — Responsive desktop rules

Define **wide / medium / narrow practical native window** behavior.

For each breakpoint/behavioral threshold specify what happens first:

1. low-priority metadata hides;
2. secondary actions move to overflow;
3. inspector collapses or becomes overlay;
4. toolbar groups wrap only if specifically authorized;
5. content density remains usable;
6. primary task/action never becomes ambiguous.

Do not reproduce the audited narrow Library state where command/management chrome leaves only a few usable file rows.

## Part 10 — Build one high-fidelity system specimen

Create a disposable, non-production HTML/CSS/JS specimen under `docs/design/w6-06/`.

This is **not** a full page redesign yet.

It must render the unified system side by side, including:

- type scale;
- spacing scale;
- Buttons/IconButtons;
- Search/Input/Select;
- segmented choices;
- toolbar groups;
- rows and file-row selection/focus combinations;
- panels and inspector/property rows;
- state blocks/notices;
- popover/menu;
- dialog/overlay chrome;
- Preview header/footer chrome specimen;
- Light/Dark toggle;
- English/Chinese content toggle;
- compact/default density toggle;
- wide/narrow specimen widths.

The specimen must deliberately include difficult combinations:

- selected + focused;
- selected + hovered;
- disabled;
- loading;
- long Chinese label;
- long English label;
- degraded/unavailable/error;
- narrow toolbar overflow;
- Inspector at constrained width.

Do not create three visual themes. One system only.

## Part 11 — Craftsmanship self-review

Use the accepted W6-06 craftsmanship rubric.

Review the specimen at native browser zoom in both themes and both languages.

Explicitly inspect:

- 1px alignment and edge consistency;
- text/icon baseline;
- optical icon alignment;
- field/button height parity;
- focus-ring clearance;
- hover/selected hierarchy;
- disabled legibility;
- border/shadow redundancy;
- radius family consistency;
- popover/dialog anchoring rhythm;
- scroll breathing room;
- narrow overflow;
- CJK/Latin balance.

Record a rubric score with category scores and unresolved deductions.

**Do not claim the system is frozen solely from self-score. Product-owner review remains required.**

## Required outputs

Create a result branch from the exact latest master after this taskbook is merged.

At minimum deliver:

- `docs/project/tasks/W6-06-UNIFIED-ZEN-UI-GRAMMAR-FREEZE-RESULT.md`
- `docs/design/w6-06/06-UNIFIED-ZEN-UI-GRAMMAR.md`
- `docs/design/w6-06/06-DESIGN-TOKENS-SPEC.md`
- `docs/design/w6-06/06-COMPONENT-ANATOMY-SPEC.md`
- `docs/design/w6-06/06-STATE-INTERACTION-GRAMMAR.md`
- `docs/design/w6-06/06-SPATIAL-RESPONSIVE-GRAMMAR.md`
- `docs/design/w6-06/06-CRAFTSMANSHIP-REVIEW.md`
- `docs/design/w6-06/06-system-specimen.html`

Optional machine-readable token/component manifests are encouraged if they improve W6-07 handoff precision.

## Final conclusion for this bounded task

The only allowed final conclusions are:

- `UNIFIED UI GRAMMAR DRAFT COMPLETE — OWNER REVIEW REQUIRED`
- `UNIFIED UI GRAMMAR BLOCKED`

Do **not** claim `W6-06 COMPLETE`.
Do **not** activate W6-07.
Do **not** implement production code.

## Production and release boundaries

Forbidden in this task:

- editing `src/`;
- editing `src-tauri/`;
- changing dependencies;
- changing schemas/databases;
- changing CI/release workflows;
- version bump/tag/release;
- publishing `v0.1.40`;
- starting W6-07 implementation;
- silently fixing W6-05 functional failures.

W6-06 remains a design/specification Track.

## Return payload

At completion return:

- result branch;
- HEAD/tree;
- artifact list;
- frozen/candidate metric ladders;
- canonical primitive list;
- state grammar summary;
- spatial/responsive summary;
- craftsmanship score and deductions;
- specimen path;
- production code changed: `No`;
- W6-06 remains ACTIVE: `Yes`;
- W6-07 activated: `No`.
