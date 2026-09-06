# State and interaction grammar

Candidate specification. The specimen renders authored examples; W6-05 remains `PASS45 / FAIL6 / DEGRADED7 / UNVERIFIED22`. Design examples cannot upgrade any native evidence.

## Independent state channels

Resolve the interactive background first: **default → hover → pressed**. If selected/checked, use selected → selected-hover → selected-pressed instead. Always retain the selected marker. Primary action uses its own action fill family and cannot be selected like a file.

Then compose orthogonal channels in this order:

1. Domain status supplies icon + text + associated description, not a replacement selection plane.
2. Disabled suppresses activation/hover/press, uses explicit disabled foreground/background, but preserves checked/selected marker and visible reason outside the disabled control. A file with unavailable Preview stays selectable; only Preview action is unavailable.
3. Loading reserves icon and label geometry, sets busy, prevents duplicate work and retains focused element. Existing useful content may remain with a truthful stale/loading Notice. Never announce “Ready” until authoritative completion.
4. Keyboard focus paints a2px local underline independently in every eligible selected/unselected/error state. Text commands and row names use an underline; icon buttons use a12x2 bottom line and fields a24x2 bottom line. No perimeter frame. No glow and no layout movement. Focus is not erased by pressed or selected styles.

Examples: selected+focus = tonal plane + marker + focus underline; selected+hover = stronger tonal plane + marker; invalid+focus = danger field border + separate local focus underline + associated error; busy+focus = spinner in reserved slot + unchanged local underline; disabled+checked = muted readable label + checked marker, no hover response. Mouse hover does not produce keyboard focus decoration unless the browser's focus-visible heuristic says so. Static focus/press representations in the specimen are explicitly labeled.

## One anatomy, nine meanings

Full StateBlock: icon → title → consequence/body → action → expandable technical detail. Inline variant moves icon to the first text baseline and retains that order. Notice uses the inline anatomy while useful content remains. Title is a short outcome, body explains effect and next step, detail preserves raw diagnostic facts. Tone never substitutes for copy.

| State | Icon / tone | Chinese / English title and consequence example | Action policy | Owner and lifecycle |
| --- | --- | --- | --- | --- |
| Ready | check / success, usually no full block | 已准备好 / Ready. 文件可供浏览。 / Files are available to browse. |0; optional quiet next action | Authoritative readiness; usually content itself, badge only if useful |
| Loading | spinner / neutral | 正在读取文件 / Reading files. 可继续浏览已有结果。 / Existing results remain available. |0–1 quiet Cancel only if supported | Request/session; don't invent percentage or fabricate completion |
| Empty | folder / neutral | 此范围没有匹配文件 / No matching files in this scope. 调整筛选条件后重试。 / Try changing the filters. |1 primary Clear filters if active; otherwise context-specific add/scope action | Successful authoritative query with empty result; never no-source or failed query |
| Limited | warning / warning | 部分位置尚未就绪 / Some locations are not ready. 当前结果不代表完整范围。 / Results do not cover the full scope. |1 secondary Review locations | Coverage/reconciliation authority; preserve partial, reconciliation-required and retry-exhausted distinctions in body/detail |
| Unavailable | file-question / neutral | 此文件暂时无法预览 / Preview is unavailable for this file. 文件信息仍可查看。 / File details are still available. |0–1 secondary permitted fallback; don't offer Retry for unsupported capability | Capability/source/read authority; don't infer universal unsupported-format from one failed host |
| Recoverable Error | circle-alert / danger | 未能读取此位置 / Could not read this location. 当前结果未更新。 / Results have not been refreshed. |1 primary Retry if safe; optional quiet detail | Failed operation owns local persistence until retry resolves/cause changes, not timer |
| Safety Blocked | shield-alert / warning | 安全预览尚未就绪 / Safety preview is not ready. 验证完成前不能执行此操作。 / This action cannot run until validation completes. |1 secondary Review requirement; Execute disabled with reason | Existing authoritative preview/revalidation/ledger. Never “Continue anyway” |
| Permission Required | lock / warning | 需要访问权限 / Access permission required. 授权后才能读取此位置。 / Access is needed to read this location. |1 primary Request access only through existing platform flow | Permission/read boundary; no fabricated success after clicking |
| Disabled | minus-circle / neutral | 此操作当前不可用 / This action is not available now. 先选择一个文件。 / Select a file first. |0 in disabled target; reason remains outside | Derived permitted-action availability; not a substitute for error/permission/unavailable state |

Technical detail is a localized “Technical details / 技术详情” disclosure with selectable12/20 code, wrap-safe path and raw cause. Disclosure cannot hide the consequence, danger, incomplete coverage or required consent. Exact IDs/cursors remain in diagnostics, not headline text. The specimen uses honest synthetic explanations, not invented live backend results.

## Preserve concrete W6-05 failures

| Retained failure | Designed surface | What remains true |
| --- | --- | --- |
| Windows extended-path Cleanup rejection | Local error: “Cleanup could not inspect this location”; path/cause in detail; review location or supported retry | No candidates, preview, cleanup execution or path normalization is invented |
| Image/CSV/JSON/folder Preview unavailable | Same Preview shell, filename/source, metadata and unavailable StateBlock | No fake content renderer or universal format promise; pin/nav/loading native evidence remains UNVERIFIED |
| Global Index source unavailable | Local “Search source is unavailable” with source setup/review action if supported | Distinct from empty search and from Library/Browse search |
| Organization Plan safe-preview/suggestion failure | Warning/blocked Notice adjacent to plan; execute disabled; safe retry only for failed request | Suggestions don't become mutation truth; keep preview → confirmation → backend revalidation |
| Browse/first-scan recovery friction | Explicit reading/permission/partial/reconciliation/retry-exhausted labels from domain | No always-green readiness story; roots and current-folder scope remain distinct |

## Notice, StateBlock and Toast display ownership

Use StateBlock when the task body has no usable content. Use Notice when useful content remains but the consequence matters. Both are projections of the same domain cause; do not mount both with identical text inside one surface.

Toast is for a transient acknowledgment (“Specimen preference changed”) or an offscreen task completion with a link to its owning surface. No toast repeats an already visible local failure. On navigation, durable errors remain attached to their domain, not floating over unrelated Settings. A shell-level issue without a local owner may have one persistent shell Notice. Presentation deduplication may use the existing domain/task/cause identity; it must not create a new durable error authority. Accessibility live announcements fire once per meaningful transition, not per rerender.

Errors use `role=alert` only for a new actionable failure; persistent revisits don't repeatedly interrupt. Loading/ready acknowledgments use polite status. Don't announce decorative spinners. Do not clear a problem because its message was dismissed. Toast dismissal acknowledges presentation only.

## Keyboard and overlays

- Use existing bindings. Tab moves between control groups; arrow navigation applies only to menu/radio/tab/list widgets whose semantics implement it. Menu supports arrows/Home/End/typeahead; selected object and keyboard active object are independent.
- Global Search preserves literal `.gitignore`, `.env`, `C++`, `report!`, `[name]`, `file*`, `what?`; IME composition suppresses query/activation/navigation until commit. Standalone Search Window retains ID-only activation and restricted permissions.
- Opening modal Dialog/Sheet/Preview makes background inert. Initial focus goes to safe cancel for destructive confirmation, query for search, heading for information when appropriate. Tab/Shift+Tab stay inside. On close, restore invoking control or stable selected row by ID; if gone, nearest valid owning heading. Do not return to unmounted descendants.
- Escape closes the topmost dismissible menu/popover first, then the owning modal; it never triggers a destructive action or silently cancels an irreversible operation. Busy dismissal follows existing operation safety contract. Nonmodal popover closes on outside interaction while keeping app usable; focus returns to anchor on Escape, not unconditionally after an outside click.
- Preview source context and dismissal remain before provider completion. Existing host owns navigation availability and pin persistence; styling does not create those capabilities.
- Reduced Motion: no transitions, static progress mark. Forced colors: preserve selected marker and2px focus using system colors. Screen-reader, native IME, Narrator/VoiceOver and native DPI checks remain later requirements; HTML testing is not certification.
