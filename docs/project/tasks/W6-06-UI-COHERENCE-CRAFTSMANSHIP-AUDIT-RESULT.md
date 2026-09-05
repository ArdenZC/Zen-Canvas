# W6-06 UI Coherence + Craftsmanship Audit Result

**COHERENCE AUDIT COMPLETE — READY FOR UNIFIED SYSTEM DESIGN**

This is completion of the bounded audit only. **W6-06 remains ACTIVE; W6-07 remains inactive.** No visual theme was selected, no new page was designed, and no production code was changed.

## Completed

- Reused the accepted W6-05 Windows/Tauri evidence; catalogued62 JPEG originals and visually inspected32 representative captures.
- Built a cross-concept comparison atlas spanning Overview, File Library, Browse, Preview, Organize, Cleanup, History, Rules, Settings major sections, Global Index and Platform Diagnostics. The ordinary Search settings screenshot is obscured by the command palette and is explicitly source-only for that section.
- Swept216 source files for visual metrics and class duplication candidates; human-reviewed47 semantic roles with source anchors, dimensions, spacing, typography, shape, states, C0–C3 severity and retirement proposals.
- Produced top10 coherence failures, top20 craft findings/risks, six first-party mature-product benchmarks and a candidate canonical UI grammar.

## Result branch and identity

- Branch: `docs/w6-06-ui-coherence-craftsmanship-audit-result`.
- Worktree: `F:/Coding/Zen-Canvas-w6-06-coherence-audit`.
- Fetched master / audit base: `3910dc9e6e5caca922a91482c8a3ae954cde4104`.
- Retained native production: `ee1163fbf32f23cc95150adca4e1cb5a53081654`; tree `57dc0ac45810477c8477542512c3c65a60605fb9`.
- Production directories are content-equivalent between retained native head and audit base. Historical screenshots are not new native acceptance.
- Exact final result commit/tree and local validation outcome are returned in the task completion response. This document does not self-reference its own future commit SHA.
- Common checkout remains preserved on its existing clean older master. This result worktree/branch is intentionally retained for review and later unified-system design; no branch/worktree cleanup of unrelated tasks is attempted.

## Artifacts

| Artifact | Purpose |
| --- | --- |
| [Audit synthesis](../../design/w6-06/03-UI-COHERENCE-CRAFTSMANSHIP-AUDIT.md) | Cross-surface header comparison, top10/top20, evidence limits |
| [Comparison atlas](../../design/w6-06/03-comparison-atlas.html) | Read-only side-by-side original screenshots, native-size expansion |
| [Screenshot manifest](../../design/w6-06/03-screenshot-atlas.json) |62 hashes/dimensions and explicit32-image visual-review coverage |
| [Coherence matrix](../../design/w6-06/03-ui-coherence-matrix.json) |47 required semantic records with source excerpts |
| [Visual authority map](../../design/w6-06/03-VISUAL-AUTHORITY-MAP.md) | Duplicate implementations and candidate sole owners |
| [Metric analysis](../../design/w6-06/03-METRIC-INVENTORY.md) | Intentional hierarchy versus drift; declaration/cascade caveats |
| [Full metric inventory](../../design/w6-06/03-metric-inventory.json) | All lexical candidates with file/line evidence |
| [Repeated class groups](../../design/w6-06/03-duplicate-class-groups.json) | Discovery candidates, not automatic defect counts |
| [Interaction-state audit](../../design/w6-06/03-INTERACTION-STATES.md) | Default/hover/press/selection/focus/disabled/loading/status distinctions |
| [Benchmark synthesis](../../design/w6-06/04-MATURE-PRODUCT-BENCHMARK.md) | Six reference products,32 dimensions,16 principles and copying exclusions |
| [Canonical proposal](../../design/w6-06/05-CANONICAL-UI-GRAMMAR-PROPOSAL.md) | Ownership, primitive anatomy, candidate metric ladders and retirement conditions |
| [Inventory reproduction](../../design/w6-06/build_audit_inventory.py) / [matrix serialization](../../design/w6-06/build_coherence_matrix.py) | Standard-library docs tooling; no production writes |

## Top findings

Coherence: ordinary page inset20 versus Library0; multiple control metric/cascade owners; selected choice expressed as primary-fill/underline/inset-border; Preview fractional-rem chrome; independent empty/error layouts; Settings primitive forks.

Craftsmanship: mixed toolbar heights; nested borders/shadows; Settings horizontal overflow in retained frames; cramped narrow Library content; inconsistent icon sizes and field radii; duplicated error/scan actions; raw technical/English values in Chinese primary surfaces; Preview's dimmed backdrop visibly ends partway down the retained window. Pixel-exact optical alignment, hover and clipped-ring claims remain limited by evidence.

## Authority and compatibility paths

Propose `tokens.css` as sole value authority and `components/ui` as canonical anatomy/state owner; `surfaces.ts` composes/forwards; `tw.ts` and `views/shared/ui.ts` carry bounded compatibility exports. Features select variants. Existing re-exports are not mislabeled as duplicate implementations. Keep SettingsRow, Preview content renderers and domain adapters where they express real semantics. Retire duplicated styling only after caller and behavior parity is proven under later authorization.

## Important product/architecture decisions

- Preserve Query V2, LibrarySelectionV1, Library/Browse/Global Index separation, Preview Core/host/read boundaries, AI consent, authoritative operation preview, journals, Safe Trash and Restore.
- Selection and keyboard focus remain independent; the current shared file list already demonstrates this correctly.
- C0–C3 are design-system severity, not W6-05 product/safety severity.
- Candidate metric ladders are proposals, not a freeze or target-page acceptance.

## Files changed

Only this result document, `docs/design/w6-06/` audit artifacts and the bounded W6-06 entries in `docs/project/STATUS.md` / `ROADMAP.md`. The current-truth edits link the audit and reconcile the already-merged amendment's replacement of mandatory themes; they preserve active Track and release boundaries.

## Tests and commands run

Preflight: `git fetch origin master`, status/branch/HEAD/worktree topology; source comparison against the W6-05 production head. Generation uses the two standard-library Python scripts linked above. Artifact checks verify47-role schema coverage, source anchors, screenshot identities, original ZIP hash, local links, JSON parsing and reproducibility. Final checks use `git diff --check` and `npm run test:docs` with `DOCS_DIFF_BASE` set to the audit base and `DOCS_DIFF_HEAD` to the candidate result commit. Exact final results are reported after execution in the task response.

No production tests/build/native regression, dependency installation, CI rerun, release/tag/version change or remote publication is part of this local docs-result task. Hosted CI/review/merge acceptance is not claimed.

## Visual/native verification

32 retained originals were opened and inspected. The generated atlas was opened in the Codex in-app browser and its side-by-side image rendering was visually checked. This browser check verifies the documentation viewer only, not the running Zen app. No reference app was operated; benchmark claims cite first-party documentation.

## Acceptance checklist

- [x] Latest master includes formal amendment and benchmark/quality-bar authority.
- [x] Cross-surface atlas and source-level semantic inventory delivered.
- [x]47 semantic roles, full metric candidates and actual duplication distinguished from aliases.
- [x] Selected/focus distinction, states, C-severity, top10/top20 and canonical proposal documented.
- [x] Native evidence limitations and functional failures preserved.
- [x] Production code changed: **No**.
- [x] No new page designs or theme trio; no W6-06 closeout or W6-07 activation.
- [ ] Unified-system design freeze and representative page targets: outside this bounded task.
- [ ]92/100 craftsmanship acceptance and product-owner target review: not performed.

## Deferred or unverified

W6-05 remains `PASS45 / FAIL6 / DEGRADED7 / UNVERIFIED22`. Tooltip/hover/pressed details, computed font cascade, exact1px optical alignment, Preview loading/pin/navigation, narrow Preview/Settings, Narrator, DPI and macOS are not newly accepted. Candidate pixel dimensions are authored CSS units, not inferred native physical pixels.

## Risks requiring human review

The next design decision is whether the proposed role hierarchy and density variants produce one system, not which theme to choose. Functional Cleanup path rejection, format-preview failures, Global Index source availability, plan safe-preview failure and Browse/scan recovery need later scoped functional work. Do not camouflage them with styling or remove safety gates. Review remaining gaps before any representative target can pass the existing quality bar.

Temporary viewer process is task-owned and is stopped at closeout; no test fixtures/build caches were generated. Reproducible JSON/HTML files are deliverables intentionally retained, not disposable test output.
