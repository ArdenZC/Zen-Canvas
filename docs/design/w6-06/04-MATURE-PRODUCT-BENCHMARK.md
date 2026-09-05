# Mature-product benchmark synthesis

Research date: 2026-09-06. First-party documentation/product descriptions were read live. These are documented patterns, not hands-on testing of the reference apps. No reference assets were copied into production. Exact typography, contrast ratios, pixels and motion quality of reference apps are **not measured** here. Recommendations below are Zen-specific design inferences. The six products are specialist references rather than interchangeable themes.

## Finder / Quick Look

**Exceptional pattern:** Finder keeps locations in navigation and permits list/icon/column/gallery views of the same files. Quick Look starts from selection, opens with Space, supports resize and closes with Space without requiring a separate editing workflow. This makes inspection a continuation of browsing rather than a new destination. [Finder documentation](https://support.apple.com/en-mide/guide/mac-help/mchlp2605/mac), [Quick Look documentation](https://support.apple.com/en-euro/guide/mac-help/mh14119/mac).

**Learn:** retain source/selection context through preview and keep navigation subordinate to the inspected content. **Do not copy:** macOS traffic lights, Markup/rotation/editing, automatic media behavior or an assumed universal format promise. Zen Preview is read-only and cannot hydrate cloud content implicitly. **Concrete implication:** UI-25/31 share Inspector/Preview header anatomy, show the filename before provider details, and preserve source and useful metadata when a renderer is unavailable. **Caveat/confidence:** strong documentation evidence for commands; no current macOS observation or exact chrome measurements. Windows internal grammar must adapt to Windows window/input conventions.

## Windows File Explorer / Fluent

**Exceptional pattern:** Explorer separates frequent context commands from additional options. Fluent's toolbar guidance specifies logical grouping, overflow instead of accidental wrapping, labeled icon actions, and separation of destructive controls. Microsoft documents keyboard focus as a visible action-location indicator, distinct from Narrator focus. [Explorer](https://support.microsoft.com/en-US/Windows/Experience/FileExplorer/file-explorer-in-windows), [Fluent toolbar](https://fluent2.microsoft.design/components/web/react/core/toolbar/usage), [keyboard interactions](https://learn.microsoft.com/en-us/windows/apps/design/input/keyboard-interactions).

**Learn:** keep a predictable command strip and move secondary commands into labeled overflow before compressing the work region. **Do not copy:** every Explorer operation, shell extension model or native widget styling literally into Tauri. **Concrete implication:** UI-05/14 Library management actions should not force an uncontrolled third/fourth chrome row at narrow width; selected data and focused control must retain separate indicators. Existing filtering and keyboard contracts remain authoritative. **Caveat/confidence:** strong first-party behavioral guidance; this is not proof of current Explorer's exact dimensions or Zen native compliance.

## Raycast

**Exceptional pattern:** a selected item has contextual actions, a primary Enter action and a discoverable action panel; shortcuts are shown alongside actions, with Escape unwinding the panel/submenu. This teaches users one action grammar across item types. [Action Panel](https://manual.raycast.com/action-panel), [keyboard reference](https://manual.raycast.com/keyboard-shortcuts).

**Learn:** one placement for “what can I do with this item?” and consistent shortcut hints. **Do not copy:** command-first navigation for all persistent file work, arbitrary extension execution or global shortcuts that conflict with Zen. **Concrete implication:** UI-06/28/31 use one action-label/icon/shortcut row; Preview unavailable keeps a discoverable return/reselect path. Preserve Global Search ordering, literal punctuation, IME ownership and restricted Search Window permissions. **Caveat/confidence:** first-party documented behavior, no app session tested; platform modifier keys differ. The two manual pages describe secondary Enter combinations differently in context, so no unqualified shortcut remap is proposed.

## Things

**Exceptional pattern:** Slim Mode can hide the sidebar while Quick Find still navigates to lists and projects; keyboard navigation provides an alternate route when chrome recedes. [Sidebar/Slim Mode](https://culturedcode.com/things/support/articles/3238254/), [Quick Find](https://culturedcode.com/things/support/articles/2803584/).

**Learn:** calmness can come from removing repeated orientation after arrival while retaining a clear return path. Long-session comfort is the intended inference, not a measured user-study finding here. **Do not copy:** sparse to-do spacing into dense file tables or hiding recovery/safety facts for visual quiet. **Concrete implication:** Overview's task, coverage and recovery information should use restrained shared sections; suppress repeated decoration, not authoritative warning content. Local navigation may collapse predictably while staying reachable. **Caveat/confidence:** high for documented navigation, medium for comfort inference; Apple-platform typography/spacing is not a Windows specification.

## Linear

**Exceptional pattern:** its March 2026 first-party refresh identifies drifting action placement as feature growth debt, deliberately reduces sidebar prominence and unnecessary icon treatments, and softens proliferating separators. This is a direct parallel to Zen's accumulated local exceptions. [2026 refresh](https://linear.app/now/behind-the-latest-design-refresh). Its 2024 redesign account additionally documents cross-environment and hierarchy stress-testing before implementation. [2024 process](https://linear.app/now/how-we-redesigned-the-linear-ui).

**Learn:** define common header/action placement and compare states across the system while features evolve. **Do not copy:** Linear's palette, issue-tracker density in an empty file workspace, or agent workflows. **Concrete implication:** consolidate UI-03/05/17/40 before page reconstruction; replace decorative nested border/shadow combinations with a small layer grammar. **Caveat/confidence:** high for stated design decisions, medium for transferable efficacy; no quantitative usability or runtime measurement in this audit.

## Figma / professional pane systems

**Exceptional pattern:** Figma documents separate left navigation, main canvas, contextual right properties and a toolbar; properties depend on selection and access rights. A properties row is meaningful because it is tied to an object and permitted operation. [Properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-Prototype-and-view-Code-in-the-Properties-Panel), [file navigation](https://help.figma.com/hc/en-us/articles/30925881896727-FD4B-Navigate-Figma-Design-files).

**Learn:** pane position, selection context and permission state must remain legible together. **Do not copy:** editor tool density, bottom floating toolbar, canvas manipulation or Figma property controls into ordinary Preferences. **Concrete implication:** UI-25/32 use one PropertyRow/Inspector grammar with persistent filename/source context; Settings composes the same controls but retains its preference semantics and lower density. **Caveat/confidence:** high for documented anatomy; no live Figma layout/resize or exact scroll behavior observed. Zen is a file-governance workspace, not an editor.

## Comparison dimensions and transfer limits

This table maps every requested dimension to a studied pattern or an explicit evidence gap. It is not a fabricated six-product scorecard. “Proposal” indicates design inference rather than observed reference behavior.

| Dimension | Reference evidence | Zen implication / limit |
| --- | --- | --- |
| 1 Window chrome | Finder/Explorer platform documentation | Keep OS adapters; no copied platform chrome |
| 2 Sidebar | Things hide/reveal; Linear recession | Navigation recedes without removing return route |
| 3 Page/view header | Linear action-placement refresh | Stable location/title/action slots |
| 4 Toolbar | Fluent grouping/overflow | Common overflow order; no accidental wrap |
| 5 Search | Raycast action/search model; Things Quick Find | Shared field anatomy, separate search authorities |
| 6 Navigation/location | Finder locations; Figma selection context | Explicit Library/Browse source context |
| 7 List/table density | Finder view modes; Linear hierarchy | Dense file rows remain; exact heights are Zen candidates |
| 8 Grid density | Finder icon view | Grid is a view of same items; no inferred item size |
| 9 Selection | Quick Look selected-item context | Selection persists on preview/return |
| 10 Keyboard focus | Microsoft focus guidance | Independent focus geometry; no Narrator certification |
| 11 Hover/pressed | No isolated reference state captures | Use shared Zen state proposal; verify later |
| 12 Context menus | Explorer frequent/additional options; Raycast actions | Common row anatomy, no capability expansion |
| 13 Popovers | Raycast contextual panel | Stable action location; exact anchor/padding unmeasured |
| 14 Dialog/sheet | Quick Look return flow; Microsoft initial-focus guidance | Host-specific roles, common chrome; geometry proposal |
| 15 Inspector | Figma properties | Selection and source remain visible |
| 16 Settings/preferences | Raycast configuration discovery | Ordinary preferences separate from diagnostics |
| 17 Empty | No representative reference empty-state inspection | Zen StateBlock proposal; no competitor pixel claim |
| 18 Loading/progress | No observed transition sequence | Reserved geometry proposal; no copied timing |
| 19 Recoverable error | No direct reference error flow | Consequence and recovery action from Zen authority |
| 20 Unavailable | Quick Look capability-dependent preview concept | Honest fallback; do not inherit broad format promise |
| 21 Destructive confirmation | Fluent destructive grouping; Microsoft safe initial focus | Separate from navigation, preserve authoritative preview |
| 22 Preview viewer | Quick Look selection/resize/return | Quiet chrome and useful fallback |
| 23 Shortcuts | Raycast consistent contextual hints | One shortcut presentation; preserve existing bindings |
| 24 Motion | No timing measurement | Token timing proposal only |
| 25 Scroll/overflow | Fluent overflow; Things sidebar hide | Deliberate overflow rather than feature-specific wrapping |
| 26 Narrow adaptation | Fluent overflow; Things slim mode | Command priority before content compression |
| 27 Light/Dark | Linear discusses both themes | Review contrast/hierarchy together; no ratio claim |
| 28 Iconography | Linear reduces redundant treatments | One role size and framing policy |
| 29 Typography | Linear hierarchy account | Role ladder; no extracted competitor fonts |
| 30 Spacing | Linear alignment/stress tests | Shared edge rhythm; Zen candidate values |
| 31 Border/radius/elevation | Linear separator reduction | Layer meaning rather than ornamental borders |
| 32 Advanced disclosure | Explorer additional options; Figma access-specific properties | Progressive technical detail without hiding blocked facts |

## Principles Zen Canvas should inherit

1. Same-role page actions occupy the same slot across surfaces.
2. A workspace can have compact headings without inventing different content insets.
3. Secondary toolbar commands overflow before the file region collapses.
4. Source/location remains visible through search, inspector and preview.
5. File-name readability outranks decorative metadata and icon containers.
6. Selected/checked and keyboard focus remain separate visual channels.
7. Primary fill communicates a primary action, not every selected tab.
8. Navigation recedes after arrival while retaining a discoverable return route.
9. Context actions share label/icon/shortcut alignment across hosts.
10. Preview failure preserves useful metadata and a truthful next action.
11. Inspector rows are driven by selected-source facts, not independent local state.
12. Settings uses canonical controls at preference density, not editor density.
13. Boundaries explain hierarchy; do not draw every nesting level.
14. Loading preserves action geometry and leaves cancellation visible where supported.
15. Ordinary status leads with consequence; technical details stay available behind disclosure.
16. Review narrow, language and theme variants together before freezing metrics.

Avoid literal platform chrome, unconditional commands, universal-preview promises, copied proprietary assets, aesthetic density without content, or any reference-driven change to Query/selection/Preview/AI/mutation authority. Reference research supports the proposal; it cannot turn a W6-05 FAIL/UNVERIFIED into PASS.
