# W6-06 — Zen Visual System & UX Redesign Activation

Date: 2026-09-06

Status: **ACTIVE — design/specification only; production implementation not authorized**

## Baseline and authority

Activation baseline:

- `master@507253589c2bbc9924f643ddd38456e2716138dd`
- W6-05 accepted result/evidence: PR #199
- final W6-05 evidence ZIP SHA-256: `0659F2BAEF45666D9380C623B179B9513D5643281B21B0B0411824D2EC0EFDA3`

Primary evidence input:

- [W6-05 Whole-Product Native Experience Audit Result](W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md)
- [W6-05 Closeout Result](W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CLOSEOUT-RESULT.md)
- `outputs/w6-05-native-audit/`

Initiative authority:

- [W6 — Product Maturity Audit](../initiatives/W6-product-maturity-audit.md)

## Purpose

W6-06 turns the W6-05 native product evidence into one coherent Zen Canvas visual and interaction system **before** broad production reconstruction.

The Track must answer:

> What should Zen Canvas look, feel and behave like as one calm, coherent, trustworthy desktop product while preserving the mature engineering authorities already built?

W6-06 is not a bug-fix sprint and not a Tailwind cleanup pass. It is a design decision stage.

## Governing rule

> **Preserve the engine; design the cockpit before rebuilding it.**

The design may substantially rethink presentation, information hierarchy, layout, visual language, interaction affordances and workflow clarity. It must not silently replace durable backend authorities or invent parallel product architectures to make mockups easier.

## Evidence inputs that must shape the redesign

W6-06 must use, not merely cite, the W6-05 findings and retained screenshots.

Priority product problems include:

- first-value / scan / retry / recovery states are not expressed as one clear readiness story;
- Library, Browse and Global Index are technically distinct but the user-facing ownership model is not consistently understandable;
- Quick Preview quality varies materially by format and generic unavailable states create dead ends;
- Organization Plan hierarchy and safe-preview readiness are not sufficiently legible;
- Cleanup cannot currently reach its candidate journey for the audited valid Windows extended path, but redesign must preserve its safety gates rather than hide them;
- several Settings/diagnostics surfaces expose implementation vocabulary at ordinary decision points;
- loading, empty, error, disabled and recovery states need a coherent cross-product language;
- responsive behavior is serviceable but lacks a deliberately defined system across wide/medium/narrow windows.

W6-05 `UNVERIFIED` states remain `UNVERIFIED`. W6-06 may design target behavior for them, but must not relabel them as native PASS.

## Strengths that must be preserved

The redesign must preserve the user value and architecture represented by:

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot behavior;
- Preview Core cancellation/fallback/materialization boundaries;
- Organization Plan review → safe preview → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority and History ledger boundaries;
- Global Search ordering/no-source/IME semantics;
- local-first/no-upload privacy posture;
- AI local/cloud/provider consent and credential boundaries;
- exact-SHA release/CI authority and performance gates.

A visual simplification must not weaken those boundaries.

## Design work authorized

W6-06 may produce design/specification artifacts such as:

- visual principles and product personality;
- color, typography, spacing, radius, elevation and iconography tokens;
- shell/navigation hierarchy;
- density and layout rules;
- command/toolbar hierarchy;
- cards, tables, lists, dialogs, popovers, menus and form patterns;
- selected, focused, disabled, loading, empty, error, retry and recovery states;
- light/dark and Chinese/English behavior;
- wide/medium/narrow desktop responsive rules;
- keyboard/focus interaction specifications;
- representative static or interactive mockups/prototypes;
- annotated screenshots or design-system references;
- design decisions and implementation handoff documentation for W6-07/W6-08.

Design artifacts may be retained under `docs/`, `outputs/w6-06-design/`, Figma or other explicitly linked design surfaces. Generated/reference visual assets are design evidence only unless later separately authorized for production use.

## Production work not authorized

W6-06 must **not**:

- edit `src/` or `src-tauri/` to implement the redesign;
- perform broad Tailwind/React/Tauri reconstruction;
- introduce a new durable authority or database/schema migration;
- create a second Preview engine or replace Preview Core;
- weaken filesystem mutation confirmation/revalidation boundaries;
- weaken AI consent, provider or credential boundaries;
- change package version, release metadata, tag or GitHub Release;
- publish `v0.1.40`;
- silently start W6-07, W6-08 or W6-09.

If implementation is needed to evaluate a concept, use a disposable prototype or non-production design artifact. Do not smuggle production implementation into the design Track.

## Required design process

### 1. Evidence synthesis

Build a concise design brief from W6-05 evidence covering:

- user-journey friction;
- visual/UX inconsistency inventory;
- direct native strengths;
- architecture strengths to preserve;
- important `UNVERIFIED` states;
- W6-08 Preview-specific inputs.

### 2. Define the Zen visual language

Specify a coherent system for at least:

- product personality and design principles;
- information hierarchy;
- typography;
- color roles and semantic colors;
- spacing/density;
- shape/radius/elevation;
- iconography;
- navigation and shell;
- controls and command hierarchy;
- focus/selection/disabled states;
- loading/empty/error/recovery language;
- responsive desktop behavior.

The result should feel deliberately native-desktop and calm rather than like a collection of generic dashboard cards.

### 3. Explore multiple coherent directions

Before selecting a target, evaluate **exactly three** coherent visual directions using representative screens rather than isolated components.

Each direction must include enough of the same surfaces to compare the system fairly.

Selection must be explicit. Do not merge favorite pieces from all three directions without documenting the resulting unified system.

### 4. Produce representative target experiences

The selected direction must define at minimum:

- Overview / first value / recovery;
- File Library, including navigation, search/filter/sort, selection and Context Panel relationship;
- first-party Quick Preview, including success/fallback/unavailable/error/loading/navigation chrome target states;
- Settings, including the relationship between ordinary settings and advanced diagnostics/technical controls.

Also define the shared shell and navigation connecting those surfaces.

Where W6-05 identified major journey friction, include the relevant target state rather than only the happy path.

### 5. Define cross-product state grammar

Create one shared target language for:

- empty;
- loading;
- success/ready;
- degraded/limited;
- unavailable;
- recoverable error;
- blocked/safety gate;
- disabled;
- selected;
- keyboard focus.

This state grammar must distinguish a user action problem from a platform capability problem and from an authoritative safety block.

### 6. Implementation handoff

Produce a W6-07-ready handoff identifying:

- tokens/primitives to introduce or consolidate;
- shared shell/component changes;
- page/workflow reconstruction order;
- which existing presentation patterns should be deleted/replaced;
- backend/durable seams that must remain untouched;
- browser/code evidence expectations during W6-07;
- native checkpoints that remain deferred to W6-09 unless a specific native/rendering dependency requires focused validation.

Produce a separate W6-08 Preview handoff for Preview-specific experience work.

## Required outputs

W6-06 is complete only when the repository/current-truth record links to durable design outputs containing:

1. W6-05 evidence synthesis / design brief.
2. Zen visual principles.
3. Design-token specification.
4. Shared shell/navigation specification.
5. Three comparable visual directions.
6. Explicit selected direction and rationale.
7. Representative target designs for Overview, File Library, Quick Preview and Settings.
8. Cross-product state grammar.
9. Responsive wide/medium/narrow rules.
10. Chinese/English and Light/Dark guidance.
11. Accessibility/focus/keyboard design guidance without claiming certification.
12. W6-07 implementation handoff.
13. W6-08 Preview handoff.
14. Final decision: `W6-06 COMPLETE — PROCEED TO W6-07 RECONSTRUCTION`, or a documented blocker requiring separate authorization.

## Acceptance standard

W6-06 succeeds when a reviewer can answer, from the design artifacts alone:

- what makes Zen Canvas visually distinctive;
- how the major surfaces belong to the same product;
- what users should understand at first value and during recovery;
- how ordinary and advanced controls are separated;
- how Preview behaves across success/fallback/error states;
- how safety and authority boundaries remain visible but not overwhelming;
- how the system adapts across native desktop window sizes;
- what W6-07 should implement first and what it must not change.

A collection of disconnected screenshots, a color palette alone, or cosmetic edits to the current UI does not satisfy this Track.

## Validation policy

W6-06 is a design/specification Track.

- Do not require whole-product native regression here.
- Browser/rendered prototype evidence may be used for design comparison.
- Real native product evidence from W6-05 remains the baseline input.
- W6-09 owns coherent whole-product native regression after implementation.
- If a design claim depends on a native platform behavior that cannot be represented truthfully in a prototype, mark that behavior as a later native validation requirement rather than inventing evidence.

## Review policy

The existing W6 rule remains in force:

> **W6 work must not use Codex Review.**

Merge decisions use direct diff inspection, project-governance checks and CI evidence unless the product owner explicitly changes the rule.

## Publication boundary

Public `v0.1.40` publication remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT PUBLISH**

W6-06 does not authorize a version bump, tag, release, signing/notarization work or publication.