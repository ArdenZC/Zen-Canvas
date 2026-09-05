# W6-06 — Evidence-backed Design Brief

Status: **DESIGN EXPLORATION — production implementation not authorized**

Baseline: `master@9ef6d0f5485e74de907611afdb9482880f530895`

Authority: [`../../project/tasks/W6-06-ZEN-VISUAL-SYSTEM-UX-REDESIGN-ACTIVATION.md`](../../project/tasks/W6-06-ZEN-VISUAL-SYSTEM-UX-REDESIGN-ACTIVATION.md)

Primary evidence: [`../../project/tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md`](../../project/tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md)

## 1. Product design problem

Zen Canvas has stronger engineering maturity than experienced product maturity. W6-05 proved that many backend boundaries, authority contracts and safety mechanisms are durable, but a real user can still encounter unclear readiness, inconsistent hierarchy, unavailable Preview states and surfaces that expose implementation vocabulary too early.

W6-06 therefore does **not** ask how to make the current UI prettier one component at a time. It asks:

> What should Zen Canvas look, feel and behave like as one calm, coherent, trustworthy native desktop product while preserving the engine already built?

Working rule:

> **Preserve the engine; design the cockpit before rebuilding it.**

## 2. Evidence that must shape the redesign

The accepted W6-05 audit is `DEGRADED`, with 80 capability/state rows:

- PASS 45;
- FAIL 6;
- DEGRADED 7;
- UNVERIFIED 22.

Five consolidated P2 findings are design inputs rather than reasons to weaken safety boundaries:

1. Cleanup rejects a valid Windows extended-path fixture before candidate review.
2. Image / CSV / JSON / folder Quick Preview end in generic unavailable states.
3. Global Index has no usable source in the isolated audit run.
4. Organization Plan suggestion / authoritative safe-preview loading is degraded.
5. Browse root status and first-scan recovery are not sufficiently self-explanatory.

Additional UX evidence:

- first-value / scan / retry / recovery do not read as one coherent readiness story;
- Overview can conflict with File Library reality after recovery;
- Library, Browse and Global Index are technically correct but difficult to distinguish in ordinary language;
- Settings and diagnostics expose implementation vocabulary too prominently;
- empty/loading/degraded/unavailable/error surfaces lack one shared grammar;
- responsive behavior is serviceable but not deliberately systematized;
- Preview success, metadata fallback and generic failure have materially different quality.

## 3. Existing design strengths to preserve

Historical V4.0/V4.3 and W2 design work remains useful design evidence even though it is not current project authority.

The following principles survive W6-06:

- **quiet capability** — content outranks chrome;
- **one dominant action** per state;
- **progressive disclosure** — outcome → explanation → detail → diagnostics;
- **desktop-native restraint** — compact toolbars, stable panes, limited animation;
- **truth before convenience** — no paged-data fiction and no false completeness;
- **local-first confidence** — show what is local, managed, uploaded, mutated and restorable;
- **exception-first review** — surface decisions and problems, not every safe item;
- **few materials** — canvas, content, raised, floating;
- **few cards** — avoid dashboard-card grids and card-inside-card composition;
- **semantic tokens** — preserve and rationalize `--zc-*` rather than page-local styling;
- **Library/Browse authority separation**;
- **Preview Core** rather than a second Preview architecture;
- mutation chains, Safe Trash, Restore and AI consent/provider boundaries remain untouched.

## 4. W6-06 visual goal

Zen Canvas should feel:

- calm, not empty;
- precise, not sterile;
- native, not a browser dashboard;
- recognizably Zen Canvas, not an Explorer/Finder clone;
- soft enough for long sessions but crisp enough for file work;
- trustworthy when degraded or blocked;
- equally intentional in Chinese and English;
- equally intentional in Light and Dark;
- usable from the minimum native window through wide desktop layouts.

## 5. What must visibly change from the current product

### Shell

- reduce the sense of stacked chrome and independent cards;
- make the current task and location visually obvious;
- keep global Spotlight distinct from local search;
- group advanced surfaces without making the sidebar a capability catalog.

### Overview

Answer one question first:

> **What needs my attention now?**

Readiness/recovery should become a single narrative rather than multiple competing status blocks.

### File Library

- file content is the dominant surface;
- Library/Browse remains obvious but visually subordinate to the current target;
- search/filter/sort/view controls form one calm command layer;
- selection and Context Panel are strong enough for real work without turning the page into a dashboard;
- List/Grid are presentation choices, not CTA-like controls.

### Quick Preview

The experience must be coherent across:

- content success;
- metadata-only fallback;
- temporarily loading;
- unsupported/unavailable capability;
- recoverable error;
- previous/next navigation;
- close/return;
- pinned/context mode.

Do not let `Unavailable` become a dead-end gray box.

### Settings

- ordinary preferences first;
- technical diagnostics second;
- capability truth remains accessible but should not dominate normal choices;
- Global Index, Managed Scopes, AI and Platform Diagnostics need plain-language summaries before implementation detail.

## 6. Cross-product state grammar target

Every major surface should map to one of these presentation states:

| State | User question | Visual behavior | Primary action |
| --- | --- | --- | --- |
| Ready | Can I work? | quiet success, no banner unless useful | task action |
| Loading | Is something happening? | localized progress, stable layout | cancel only if real |
| Empty | Is there anything here? | explanation + one next step | create/add/start |
| Limited | Can I continue partially? | usable content + compact limitation notice | review limitation |
| Unavailable | Is this capability missing right now? | explain owner/source, avoid dead-end | configure/retry/learn |
| Recoverable error | What failed and what can I do? | concise consequence + retry path | retry |
| Safety blocked | Why can’t this run? | strong boundary, exact consequence | review/fix prerequisite |
| Disabled | Why is control inactive? | quiet inactive state + accessible explanation | none |
| Selected | What am I acting on? | neutral tonal emphasis | contextual action |
| Keyboard focus | Where am I? | independent visible focus ring | Enter/Space according to control |

## 7. Design evaluation criteria

The three directions are evaluated on the same criteria:

1. **Calmness** — avoids visual noise during long file-work sessions.
2. **Hierarchy** — primary task and next action are immediately legible.
3. **Native desktop credibility** — feels like a serious Windows/macOS desktop product.
4. **Brand identity** — recognizably Zen Canvas without excessive glass/gradient.
5. **Information density** — supports real file work without oversized mobile UI.
6. **Failure honesty** — degraded/unavailable/safety states remain understandable.
7. **Preview quality potential** — can support a strong cross-format preview experience.
8. **Responsive resilience** — shell and panes can collapse predictably.
9. **Implementation tractability** — can map onto current React/Tauri + semantic-token architecture.
10. **Cross-platform neutrality** — can adapt platform chrome without pretending Windows is macOS.

## 8. Comparable representative states

Every direction uses the same representative product states so visual judgment is fair:

- **Overview** — recovered library with one scan/recovery attention item;
- **File Library** — 21-item managed fixture, list mode, multi-selection, Context Panel available;
- **Quick Preview** — successful Markdown/text content plus an explicit image-unavailable variant;
- **Settings** — ordinary settings with Global Index unavailable and diagnostics progressively disclosed.

The designs are not claims that W6-05 `UNVERIFIED` states passed. They are target specifications only.

## 9. Decision boundary

This exploration intentionally does **not** select a final direction yet.

The product owner should compare all three rendered directions first. After selection, W6-06 will consolidate the chosen direction into final tokens, shell/state specs and W6-07/W6-08 implementation handoffs.
