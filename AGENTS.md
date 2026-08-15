# Zen Canvas Agent Instructions

This file is the stable repository constitution for agents and contributors. It intentionally does **not** own the changing active project stage, baseline, release state or next initiative.

## 1. Read current truth first

Before non-trivial work, read:

1. `docs/project/README.md`;
2. `docs/project/STATUS.md`;
3. `docs/project/PRODUCT_MAP.md` when product ownership matters;
4. `docs/project/ARCHITECTURE_MAP.md` when state, persistence, authority or platform ownership matters;
5. the active record under `docs/project/initiatives/`;
6. `docs/project/DEVELOPMENT_WORKFLOW.md`;
7. domain-specific security/remediation/design/QA contracts named by the active initiative.

Do not treat an old branch name, baseline SHA, “current task”, “active stage” or open/draft wording in historical `docs/remediation/`, `docs/design/`, archived prompts or PR closeouts as the current project state. `docs/project/STATUS.md` owns that fact.

When sources conflict, follow the precedence defined in `docs/project/README.md`. Safety/platform contracts may impose stricter domain rules.

## 2. Baseline and worktree safety

Read the baseline from `docs/project/STATUS.md`, then verify the actual repository state before editing:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

If the task requires a particular ancestor, verify it against the actual branch rather than resetting to a SHA copied from an old document.

If unrelated changes exist:

- do not reset them;
- do not overwrite or absorb them;
- do not use `git add -A`, `git add .` or `git add --all`;
- stage only explicitly intended paths;
- report scope conflicts instead of silently solving them by deletion/reset.

Do not commit directly to `master` for non-trivial work.

## 3. One durable authority per domain

The current authority map lives in `docs/project/ARCHITECTURE_MAP.md`. Preserve these core boundaries:

| Product area | Durable authority |
| --- | --- |
| system-wide metadata search | Global Index / Global Search repository |
| managed file browsing | File Library Query V2 |
| cross-page managed selection | `LibrarySelectionV1` plus backend resolution |
| scan | durable scan roots/sessions/runs |
| watcher health | backend watcher reconciliation and root revisions |
| duplicate truth | durable Dedupe runs/groups/members |
| storage analysis | durable Analysis Run/Finding/Evidence/Decision |
| organization review | durable Organization Plan / Plan Item ledger |
| filesystem execution | authoritative Operation Preview and operation journal |
| cleanup mutation | Safe Trash and cleanup journal |
| restore | operation/cleanup ledgers plus identity revalidation |
| automation rules | Rule Repository V2 and catalog revision |
| natural-language rule drafts | durable Rule Proposal |
| content understanding | Content Scope Policy, Content Run and Content Artifact |
| managed AI | existing Managed AI queue and provider policy |
| settings | persisted versioned settings/provider contracts |

Frontend stores/components are projections and interaction state unless an accepted architecture decision explicitly says otherwise.

Compatibility adapters may translate into one authority temporarily. They must not become permanent second authorities and must have a deletion condition in `docs/project/TECH_DEBT.md` or the detailed legacy ledger.

## 4. Non-negotiable architecture boundaries

Do not create or restore a second:

- Global Index;
- managed File Library query authority;
- durable AI queue;
- Organization Plan ledger;
- Rule repository/execution authority;
- operation journal;
- cleanup journal/Safe Trash;
- restore/recovery ledger.

Do not:

- make renderer paths, rendered rows, paged samples, local counts or local lifecycle state authoritative;
- join Content Artifact into Global Search;
- turn File Library Search into system-wide search;
- accept renderer-supplied filesystem paths as execution truth;
- bypass authoritative preview, backend revalidation, journals, Safe Trash or restore;
- make Rule Proposal, Analysis Finding or Content Artifact a filesystem mutation authority;
- add schema changes merely to simplify page code;
- introduce Agent/shell/MCP/tool execution, RAG/vector database, Rule AST V2, OCR/image VLM or another long-lived runtime without a separately approved initiative/ADR.

A change that moves durable authority, persistence ownership, platform support, window permissions, filesystem mutation/recovery strategy or another long-lived architecture boundary requires an ADR under `docs/project/DECISIONS/`.

## 5. Data truth rules

### No paged-data fiction

Never present a loaded page/sample as an authoritative total, complete group or complete decision set.

Examples of invalid behavior:

- deriving complete Organization Plan group counts from loaded plan rows;
- deriving File Library total/selection truth from rendered rows;
- treating loaded cleanup findings as the whole Analysis Run;
- treating a Rule Proposal sample as exact impact.

Use backend aggregates, exact/deferred count contracts or durable ledger projections.

### Global Search, File Library and Content Search remain distinct

- Global Search uses Global Index metadata and backend ordering.
- File Library uses managed File Library Query V2.
- Content Search uses managed Content Artifacts only.

Do not merge them into a new frontend index or ranking authority.

### AI remains advisory and consent-bound

AI/provider output must not silently:

- mutate user files;
- accept Organization Plan decisions;
- enable or run a rule;
- authorize cleanup;
- send managed content to cloud;
- bypass preview/confirmation.

Use the existing provider/content/rule policies and explicit confirmation boundaries.

## 6. Platform and filesystem safety

Product targets are defined in `docs/security/SUPPORTED_PLATFORMS.md` and summarized in `docs/project/STATUS.md`.

Current product targets are Windows and macOS 13+ Apple Silicon. Intel Mac, Rosetta, Universal binaries and Linux are not product targets unless a later accepted decision changes that.

Filesystem strategy is backend-owned. The renderer must not infer safe mutation strategy from a path or OS check.

All user-file mutation must preserve the established chain:

```text
intent
→ authoritative preview
→ explicit confirmation where required
→ backend revalidation / identity checks
→ durable journal or Safe Trash record
→ filesystem mutation
→ durable outcome
→ History / Restore
```

Platform-specific implementation may differ, but it may not bypass this product authority chain.

Do not claim native macOS evidence from Windows cross-compilation. Bind platform verification to the exact native runner/commit.

## 7. Tauri, persistence and runtime contracts

### Tauri command permissions

The project currently synchronizes command/permission truth across multiple files. When adding, removing or renaming a command, inspect and update all applicable authorities, including:

- Rust handler registration;
- `src-tauri/build.rs` command allowlist/generation input;
- `src-tauri/capabilities/*.json`;
- `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md`;
- frontend API facade and browser mock where applicable;
- contract tests.

Main/search window separation is a security boundary. Do not broaden Search Window mutation permission for convenience.

### SQLite

SQLite is the durable persistence authority for persisted product state. Schema/version and migrations live in the Rust database layer. A schema change requires a separately reviewed migration, rollback/future-version handling and the applicable performance/safety gates.

Do not migrate `files.id` or create schema changes outside an authorized initiative.

### Events

Use the centralized frontend API/event layer rather than creating ad hoc component-level Tauri listeners when an existing domain API owns the event.

### Browser mock

Browser mock behavior must remain deterministic and honest. It may support UI development but must not pretend that native filesystem, provider, persistence or security behavior was verified.

## 8. UI, design system and language

Before adding a new primitive or visual pattern, inspect existing tokens and shared components, especially:

- `src/styles/tokens.css`;
- `src/styles.css`;
- `src/utils/tw.ts`;
- `src/views/shared/ui.ts`;
- current usages of the primitive being changed.

Prefer semantic `--zc-*` tokens and shared primitives. Do not add arbitrary page-local palettes/hex colors when a semantic token exists.

User-visible strings use the shared i18n system. Do not create component-local English/Chinese dictionaries.

Normal user surfaces should lead with outcomes and next actions, not revision numbers, fingerprints, run IDs, journal cursors, raw enums, SQLite terms, Tauri command names, Rust errors or platform codes.

A normal workspace should have one page-level title and at most one visually dominant primary action per state.

Historical V4.3 design documents remain useful design evidence, but they do not own the current project stage.

## 9. Interaction, accessibility and responsive behavior

For modified user-facing states, verify as applicable:

- keyboard-only operation;
- focus-visible and focus restoration;
- modal/sheet focus ownership and Escape hierarchy;
- screen-reader names/states and mounted-only active descendants;
- color-independent status;
- Reduced Motion and high-contrast behavior;
- loading, partial, stale, failed and canceled announcements.

Do not claim accessibility compliance from static code inspection alone.

When UI changes affect primary workspaces, preserve usability at the existing verification sizes, including narrow 980×680 behavior. Platform/DPI/Retina claims require actual available evidence.

## 10. Testing and evidence

Use scripts that exist on the current baseline; `package.json` is the command source of truth.

Run focused checks before broad gates. Typical checks include:

```bash
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:check
npm run verify:rust
npm run verify:security
```

Use current CI risk routing for Windows/macOS, performance and package validation. Do not weaken thresholds, add PR-number exceptions or classify production changes as docs-only.

Never say a test, visual state, platform check or package passed unless it actually ran. Record exact commit SHA for validation evidence.

A later production-code commit invalidates “exact-head” claims from an earlier code commit. A docs-only successor may reference the preceding validated production head only when it states the distinction.

## 11. Development and closeout procedure

Follow `docs/project/DEVELOPMENT_WORKFLOW.md`.

For each initiative/change:

1. verify baseline and clean scope;
2. inspect current callers and durable authority;
3. identify compatibility/debt paths touched;
4. implement the smallest coherent change;
5. add focused regression/contract coverage;
6. run focused then applicable full gates;
7. perform real rendered/native verification when the claim requires it;
8. inspect final diff;
9. update `docs/project/STATUS.md` and other current-truth files affected by the change;
10. review/merge under the project merge policy;
11. close the initiative and delete absorbed branches after ancestor/content-equivalence proof.

Default merge strategy is squash merge unless a reviewed exception requires preserved topology.

## 12. Completion report

For implementation work, report at least:

### Completed

### Authority and compatibility paths

### Important product/architecture decisions

### Files changed

### Tests and commands run

### Visual/native verification

### Acceptance checklist

### Deferred or unverified

### Risks requiring human review

Do not describe an initiative as complete while required authority migration, tests, current-truth update, platform evidence or closeout remains unfinished.
