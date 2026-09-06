# W6-06 — Unified Zen UI Grammar Freeze Result

**UNIFIED UI GRAMMAR DRAFT COMPLETE — OWNER REVIEW REQUIRED**

This completes the bounded draft delivery only. W6-06 remains **ACTIVE — design/specification only**; W6-07 is **not activated**. Owner review is outstanding. No full File Library, Overview or Settings redesign is included.

## Completed

One candidate visual authority, metric ladder,32 canonical primitive specifications, orthogonal interaction states, nine cross-product states, four spatial hosts and one high-fidelity interactive system specimen. All ten audited C0/C1 root causes have explicit specification-level answers. The [grammar index](../../design/w6-06/06-UNIFIED-ZEN-UI-GRAMMAR.md) traces each to the specimen and future consolidation seam.

Fetched master and prebuilt remote result branch were both `f3d136e6e979708713daf65b6835a1d0c9a34820`. Common checkout was clean at older master `9895079a4ebb1e810b8c42d6a74b24ba147c6645` and was preserved. Work proceeds in the purpose-owned linked worktree `F:/Coding/Zen-Canvas-w6-06-grammar`, branch `docs/w6-06-unified-ui-grammar-freeze-result`, created from that fetched prebuilt remote branch. Final commit/tree and ordinary push verification are returned in the final response, avoiding recursive self-reference.

## Authority and compatibility paths

`tokens.css` is the intended sole value owner; `components/ui` owns anatomy/state; `surfaces.ts` composes layouts; `tw.ts` and `views/shared/ui.ts` are bounded visual adapters with caller-parity/zero-caller exit conditions. Features supply domain facts and semantic variants. Existing SettingsRow/query/Preview/virtualizer lifecycle adapters remain where they have real domain responsibility.

No durable authority moves: Query V2, LibrarySelectionV1, Library/Browse/Global Index separation, Preview Core/host/read gates, SQLite, Organization Plan, operation/cleanup journals, Safe Trash, Restore and AI/provider consent are preserved. No ADR-level production change is implemented.

## Important product/architecture decisions

- Spacing2/4/8/12/16/24/32; workspace edge24 wide,16 medium/narrow; pane16.
- Controls32 compact/36 default; no third prominent-action size; FileRow44 in both densities; PropertyRow min32/36.
- Type24/32 page,16/24 section/pane,14/24 prose,13/20 command/filename,12/16 metadata,12/20 code; weights400/500/600, tracking0.
- Radius4/8/12; icons12/16/20/32;1px boundary and independent2px focus.
- Selected uses a tonal plane and2px marker; primary action fill never substitutes for selection. Hover/press, focus, disabled, loading and status compose independently.
- States: Ready, Loading, Empty, Limited, Unavailable, Recoverable Error, Safety Blocked, Permission Required and Disabled. Local durable Notice/StateBlock does not duplicate a global toast.
- Standard, Dense, Settings and Floating Preview share one inset system. Narrow priority: optional metadata → secondary actions → Inspector → secondary groups. Toolbars do not accidentally wrap.
- Self-review92/100 is provisional; it cannot freeze the design or activate implementation.

## Files changed / artifacts

| Artifact | Purpose |
| --- | --- |
| [Unified grammar](../../design/w6-06/06-UNIFIED-ZEN-UI-GRAMMAR.md) | Decisions, sole owners, ten-root traceability and compatibility retirement |
| [Token specification](../../design/w6-06/06-DESIGN-TOKENS-SPEC.md) | Exact metrics, semantic Light/Dark pairs, shape, elevation and motion |
| [Component anatomy](../../design/w6-06/06-COMPONENT-ANATOMY-SPEC.md) |32 canonical primitives with inherited state/locale/density contracts and explicit exceptions |
| [State/interaction grammar](../../design/w6-06/06-STATE-INTERACTION-GRAMMAR.md) | State combination, failure copy, action ownership and keyboard rules |
| [Spatial/responsive grammar](../../design/w6-06/06-SPATIAL-RESPONSIVE-GRAMMAR.md) | Window/pane relationships, thresholds, row-space budget and scroll owners |
| [Craftsmanship review](../../design/w6-06/06-CRAFTSMANSHIP-REVIEW.md) | Category scores,8-point deductions, corrections, actual evidence and gaps |
| [System specimen](../../design/w6-06/06-system-specimen.html) | Self-contained HTML; Light/Dark, 中文/English, compact/default, wide/narrow controls |
| [Browser matrix](../../design/w6-06/06-evidence/browser-matrix.json) / [interactions](../../design/w6-06/06-evidence/interaction-checks.json) / [artifact checks](../../design/w6-06/06-evidence/artifact-checks.json) | Measured design-only evidence; screenshots linked from review |
| [Single-artifact preview helper](../../design/w6-06/06-serve-specimen.py) / [validator](../../design/w6-06/06-validate-specimen.py) | Standard-library, no dependency changes, no production writes |

Only the result, `docs/design/w6-06/06-*` deliverables/evidence and a bounded W6-06 draft link in `STATUS.md`/`ROADMAP.md` change. No `src/`, `src-tauri/`, dependency, schema, workflow, version, tag or release change.

## Tests and commands run

- Preflight: `git fetch origin master`, fetch prebuilt result branch, status/branch/HEAD/worktree topology, remote branch identity.
- `python docs/design/w6-06/06-validate-specimen.py`: PASS;165 bilingual attributes,30 mandatory primitive rows,52 contrast pairs, no structural issues. NavigationItem/TableHeader are two additional specified primitives.
- Inline JavaScript: `node --check --input-type=commonjs` from standard input: PASS.
- Browser:24 final measured configurations at1920×1032 /1282×862 /980×680; command heights32/36; FileRow44; no tested horizontal overflow. Interaction checks and visual inspection described below.
- Final `git diff --check` and `npm run test:docs` use `DOCS_DIFF_BASE=f3d136e6e979708713daf65b6835a1d0c9a34820` and `DOCS_DIFF_HEAD` equal to the committed result head. Exact command outcome/head is reported after execution in the final response.

No production test/build, native audit, hosted CI rerun, PR/review/merge, release publication or later activation is claimed or performed in this bounded task.

## Visual/native verification

Real in-app browser screenshots were inspected in both languages/themes. Verified field/button parity, selected+focus, disabled/loading representation, long labels, overflow, Preview chrome and320px Inspector. Actual dialog Tab/Shift+Tab and Escape restore, menu arrows/Escape, menu→Inspector restore, segmented keyboard selection and example search/clear were exercised. Browser evidence is not native acceptance.

Direct `file://` navigation was blocked by browser policy. The materially narrower preview helper exposes only this HTML over loopback; it cannot list directories or serve arbitrary repository files. No remote publishing or external asset request is needed. It is stopped after review. The HTML can be opened locally by the owner, or the owner can run the helper with `python docs/design/w6-06/06-serve-specimen.py` for a loopback preview.

## Acceptance checklist

- [x] One system; no A/B/C themes or full target-page redesign.
- [x] Ten C0/C1 roots resolved at specification level, not misreported as production fixes.
- [x] Required eight core artifacts, canonical primitives, exact metric/state/spatial rules.
- [x] Interactive four-way specimen switches and difficult states.
- [x] Actual browser checks and honest score/deductions; owner review remains required.
- [x] Production code changed: **No**.
- [x] W6-06 ACTIVE: **Yes**; W6-07 activated: **No**.
- [ ] Owner acceptance / final freeze: pending.
- [ ] W6-06 representative target work and full Track completion: later authorized scope.

## Deferred or unverified

Native Windows/macOS, scaled desktop/DPI/Retina, Narrator/VoiceOver, native IME, high-contrast/Reduced Motion runtime, real provider progress/cancellation, full virtualized file work and sustained comfort remain unverified. W6-05 stays `PASS45 / FAIL6 / DEGRADED7 / UNVERIFIED22`. Its five P2 findings are preserved, including Cleanup extended-path rejection and unavailable Preview formats.

## Risks requiring human review

The owner must judge the specimen's actual quality, density, CJK/Latin rhythm, border strength, disabled readability and selected/focus relationship.92/100 self-score does not override that decision. Later reconstruction must preserve the proposed single-authority model and explicit adapter exits instead of accumulating another styling layer.

## Worktree and artifact disposition

This unmerged result branch/worktree is intentionally retained for owner review and its next explicit decision. No unrelated worktree/branch is removed. Screenshots/JSON/HTML are retained design deliverables, not disposable fixtures. Validation creates no task test/staging/cache directories or dependency installation. The loopback process is stopped and final worktree cleanliness is verified at task closeout; the exact final status and ordinary push result are reported in the task response.

## Owner selection correction

No leading vertical accent/selection bars and no full-perimeter selection/focus highlight frames or glows. The final candidate uses quieter selected surfaces, trailing12px checks and local keyboard-focus underlines (icon12x2, field24x2). Mouse and keyboard behavior were rechecked; interactive row status labels now follow changed selection. Historical audit/proposal artifacts remain unchanged.
