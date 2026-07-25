# Zen Canvas Agent Instructions

## 1. Active project stage

Zen Canvas is a local-first desktop file organization application built with React, TypeScript, Tailwind CSS, Zustand, and Tauri.

The active design stage is:

> UI/UX V4.2 Precision & Clarity

The authoritative documents are:

- `docs/design/UI_UX_V4_2_SPEC.md`
- `docs/design/UI_UX_V4_2_PRODUCT_FLOW.md`
- `docs/design/UI_UX_V4_2_EXECUTION.md`

Read all three before changing UI, navigation, Organize, Cleanup, Preview, History, Automation, Settings, or Onboarding.

When documents conflict:

1. product-flow decisions come from `UI_UX_V4_2_PRODUCT_FLOW.md`;
2. visual and component rules come from `UI_UX_V4_2_SPEC.md`;
3. PR scope and order come from `UI_UX_V4_2_EXECUTION.md`.

## 2. Latest master compatibility

All V4.2 work must start from the latest `master`.

The current baseline includes:

- AI provider registry;
- provider capability metadata;
- AI model discovery;
- test connection;
- AI request traces and diagnostics;
- trace export and clearing;
- partial AI classification result handling;
- preservation of valid results after partial failure;
- file-name normalization;
- indexed file-extension preservation;
- extension mismatch protection in Organize and Preview.

Do not remove, overwrite, bypass, or silently regress these capabilities.

When changing Settings:

- preserve provider registry, model discovery, test connection, and request trace APIs;
- keep request diagnostics in Developer Mode or an advanced disclosure;
- do not expose diagnostic complexity in the normal AI setup flow.

When changing Organize or Preview:

- preserve every file's indexed extension;
- reuse the current file-name normalization utilities;
- do not implement a second extension parser in React;
- do not permit unsafe extension changes in normal organization;
- keep final per-file Operation Preview validation;
- preserve valid items when AI classification is partial.

## 3. Scope rules

Only modify files required by the active PR.

Do not:

- perform unrelated refactoring;
- add unrelated product features;
- change Rust file-operation safety merely to simplify UI;
- change storage formats or API contracts without explicit approval;
- copy shared components into page-specific replacements;
- maintain two permanent implementations of the same workspace;
- hide or delete functionality to solve a layout problem.

## 4. Product-flow rules

### Navigation

The main navigation exposes:

- Overview;
- File Library;
- Organize Files;
- Storage Cleanup;
- History.

Automation and Settings belong in the advanced area.

Storage Cleanup must also be reachable from Overview and Spotlight.

### Organize

The default Organize workspace is group-first and exception-first.

The three primary views are:

- Plan;
- Needs My Decision;
- Cannot Be Processed Yet.

System readiness and user decision must remain separate.

`needs-review` must not remain a user-decision value.

A `requires-decision` item must expose at least two meaningful outcomes.

An item without a valid Preview must not show “Accept suggestion”.

Blocked items must not be mixed into the decision queue.

Group approval must still expand into per-file Preview before execution.

Organize must not directly delete duplicate files.

### Cleanup

Storage Cleanup is a fixed core workspace and follows:

1. select scope;
2. scan;
3. review;
4. confirm and execute;
5. result.

Do not show result controls, filters, AI controls, or disabled action groups before scanning.

Do not duplicate AI analysis controls.

## 5. Design rules

The product experience must remain:

- quiet;
- orderly;
- local-first;
- safe;
- precise;
- desktop-native;
- progressively disclosed.

Every page state must have no more than one visually dominant primary action.

Use semantic Zen Canvas tokens only.

Do not add arbitrary Tailwind palette classes, hexadecimal colors, radii, shadows, or control heights.

Use shared density variants:

```ts
type Density = "default" | "compact";
```

Normal list rows use the row radius, not panel radius.

Glass and backdrop blur are limited to:

- titlebar;
- sidebar;
- Spotlight;
- dialogs;
- popovers;
- context menus;
- floating action surfaces.

Do not create card-inside-card layouts unless the nested surface is a genuinely separate interactive object.

## 6. Shared-component policy

Before adding a component or class, inspect:

1. `src/styles/tokens.css`;
2. `src/index.css`;
3. `src/utils/tw.ts`;
4. `src/views/shared/ui.ts`;
5. the relevant primitive;
6. all current usages.

Do not create page-specific replacements for buttons, inputs, selects, segmented controls, switches, badges, notices, state blocks, dialogs, popovers, rows, metrics, or surfaces.

When changing a shared primitive, audit all usages and tests.

## 7. Page structure

The App Shell owns standard page titles and descriptions.

A standard workspace must not render a duplicate page title.

A Page Header may contain one primary action. Other actions belong in compact toolbars, overflow menus, disclosures, or inspectors.

## 8. Interaction and accessibility

For every modified component or page, consider:

- default;
- hover;
- pressed;
- selected;
- focused;
- disabled;
- loading;
- empty;
- error;
- success;
- partial success;
- canceled;
- narrow window;
- Light;
- Dark;
- Chinese;
- English.

Preserve:

- keyboard navigation;
- focus-visible rings;
- focus restoration;
- modal focus traps;
- semantic roles;
- ARIA names and states;
- screen-reader announcements;
- Reduced Motion.

All principal workflows must be operable without a mouse.

Color must not be the only status signal.

## 9. Responsive requirements

Verify at least:

- 1440×900;
- 1280×800;
- 1180×720;
- 1024×700;
- 980×680.

Do not hide critical actions to solve responsive problems.

Prevent horizontal overflow, clipped text, inaccessible controls, unreadably narrow inspectors, and action bars covering feedback.

## 10. Copy and i18n

All user-facing strings must use i18n.

Do not hard-code Chinese or English in React components.

Prefer user outcomes over internal terminology.

Errors must explain:

1. what happened;
2. what the user can do next.

Do not expose Rust, Tauri, JSON, internal IDs, raw enums, or request traces outside advanced/developer surfaces.

## 11. File-name and extension safety

Normal Organize may edit the base name but must not silently change the indexed extension.

Valid:

```text
Report.pdf → Report_2026.pdf
```

Unsafe:

```text
Shortcut.lnk → Shortcut.exe
```

Unsafe extension proposals:

- must not be Ready;
- must not be selected by default;
- must not enter final Preview;
- must explain the problem;
- must provide meaningful safe actions.

Group-level rename must normalize every file independently and preserve each indexed extension.

## 12. Partial AI classification

The UI must support partial classification:

- preserve valid plan items;
- show incomplete counts;
- retry only incomplete files;
- avoid clearing successful results;
- prevent incomplete items from entering Ready without enough information.

## 13. Testing

Run all relevant checks:

- formatting;
- linting;
- TypeScript;
- unit tests;
- component tests;
- production frontend build.

For Organize changes, include tests for:

- missing Preview;
- unsafe extension change;
- base-name edit with extension preservation;
- mixed-extension group rename;
- partial AI classification;
- successful results retained after partial failure;
- blocked versus requires-decision;
- meaningful available actions;
- final Preview selection.

Do not claim a test passed unless it was run.

## 14. Visual verification

Code inspection alone is insufficient.

When possible, launch the frontend or Tauri app and verify:

- Light / Dark;
- Chinese / English;
- standard and minimum window sizes;
- keyboard focus;
- Reduced Motion;
- affected empty, loading, partial, error, and success states.

If native Tauri or a platform is unavailable, mark it unverified.

## 15. Change procedure

For each PR:

1. inspect the latest implementation and documents;
2. summarize the current behavior;
3. identify specification gaps;
4. write an implementation plan;
5. implement the smallest coherent change;
6. audit affected usages;
7. run tests;
8. inspect the final diff;
9. verify acceptance criteria;
10. update `UI_UX_V4_2_EXECUTION.md`;
11. report completed, deferred, and unverified items separately.

Do not stop after changing CSS classes.

## 16. Final response format

Finish every task with:

### Completed

### Important design decisions

### Files changed

### Tests and commands run

### Visual verification

### Acceptance checklist

### Deferred or unverified

### Risks requiring human review

Never describe a task as fully complete when visual, native-platform, accessibility, or test verification remains incomplete.
