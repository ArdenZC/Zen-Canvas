# Zen Canvas Agent Instructions

This file is the stable repository constitution. `docs/project/STATUS.md` owns
changing project stage, baseline, active task, release state and next phase.
Do not copy those changing facts into this file or infer them from historical
documents.

## Default task start

For an ordinary bounded task, use this context sequence:

```text
AGENTS.md
→ docs/project/STATUS.md
→ the current task brief linked from STATUS
→ inspect relevant production owners / callers / tests
```

Read only the documents triggered by the task's domain or by an unresolved
ambiguity. Do not recursively preload linked documentation. The routing index
is `docs/project/README.md`.

| Trigger | Read when triggered |
| --- | --- |
| product ownership or navigation | `docs/project/PRODUCT_MAP.md` |
| state, persistence or durable authority | relevant `ARCHITECTURE_MAP` section; an ADR when ambiguous |
| filesystem mutation, Restore or Safe Trash | relevant security, identity and recovery contracts |
| Tauri command or capability permissions | `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md` and affected permission authorities |
| macOS mutation | the macOS mutation threat model |
| new initiative, cross-wave scope or product direction | Master Development Plan plus `ROADMAP.md` |
| large responsibility expansion | `CODE_MAINTAINABILITY.md` |
| release or publication | release contracts and `DEVELOPMENT_WORKFLOW.md` |
| governance/process change | `DEVELOPMENT_WORKFLOW.md` |
| another named domain contract | that security, remediation, design or QA contract |

## Current truth and scope

- `STATUS.md` is the project-level source for changing baseline, initiative,
  track, task, phase, validation, schema, platform and release facts.
- `README.md` defines source precedence and conditional routing. Historical
  taskbooks, audits, prompts and PR closeouts are evidence unless current truth
  explicitly links them for the task.
- Honor the task brief's scope and non-goals. A documentation task does not
  authorize production, schema, runtime, security-authority or CI-routing work.
- Keep one durable authority per domain. Do not create a second current-status
  file, ledger, queue, index, mutation journal or recovery authority.

## Git, baseline and worktree safety

- Verify `git status --short`, branch, `HEAD` and `HEAD^{tree}` before editing;
  verify the requested base against the actual remote/local object.
- Use an isolated branch/worktree for non-trivial work. Never commit directly
  to `master`.
- Preserve unrelated dirty, staged, conflicted, untracked and ignored content.
  Do not reset, clean, rebase, merge, force-push or overwrite unexplained local
  state. Stage only explicitly intended paths.
- A branch ref preserves committed work only. Before retiring a worktree, prove
  topology, local-state disposition and evidence ownership; prefer Git-aware
  removal and never use force cleanup merely for convenience.
- Keep validation and delivery claims bound to the exact commit and tree that
  were tested. Do not promote old evidence to a later production head.

## Durable authority and truth boundaries

| Product area | Durable authority |
| --- | --- |
| system-wide metadata search | Global Index / Global Search repository |
| managed file browsing | File Library Query V2 |
| cross-page managed selection | `LibrarySelectionV1` plus backend resolution |
| scan and watcher health | durable scan sessions/runs and backend reconciliation |
| duplicate truth | durable Dedupe runs/groups/members |
| storage analysis | Analysis Run/Finding/Evidence/Decision |
| organization review | Organization Plan / Plan Item ledger |
| filesystem execution | authoritative Operation Preview and operation journal |
| cleanup and restore | Safe Trash/cleanup journal plus operation and recovery ledgers |
| automation rules | Rule Repository V2 and catalog revision |
| content understanding | Content Scope Policy, Content Run and Content Artifact |
| managed AI | existing Managed AI queue and provider policy |
| settings | persisted versioned settings/provider contracts |

Renderer stores, rows, page samples, local counts and lifecycle state are
projections unless an accepted architecture decision says otherwise. Do not
make renderer paths execution truth, merge Global Search with File Library or
Content Search, or accept a local sample as a complete total/group/decision.
Compatibility adapters may translate into one authority temporarily; they must
not become permanent second authorities without an explicit deletion condition.

AI/provider output remains advisory and consent-bound. It must not silently
mutate files, accept organization decisions, enable/run rules, authorize
cleanup, send managed content to cloud or bypass preview/confirmation.

## Preserved product invariants

- Global Search keeps backend file ordering authoritative; punctuation remains
  literal; IME composition owns query/navigation until commit; `no_source` is
  distinct from an ordinary empty result; Search Window activation stays
  ID-only within its restricted permission boundary.
- Watcher/root health keeps permission required, reconciliation required,
  partial coverage and retry exhausted distinct.
- Rule Repository V2 remains the automation mutation authority. Do not restore
  the removed whole-object commands `save_user_rule`, `delete_user_rule` or
  `get_user_rules`.
- A loaded page, rendered row, local count or proposal sample is never a
  complete authoritative total, group or impact set; use backend aggregates,
  exact/deferred counts or durable ledger projections.

Moving durable authority, persistence ownership, platform support, window
permissions or filesystem mutation/recovery strategy requires an accepted ADR
under `docs/project/DECISIONS/` before implementation.

## Filesystem, platform and permission safety

All user-file mutation preserves this chain:

```text
intent → authoritative preview → explicit confirmation where required
→ backend revalidation / identity checks → durable journal or Safe Trash
→ filesystem mutation → durable outcome → History / Restore
```

Filesystem strategy is backend-owned; the renderer must not infer safety from a
path or OS check. Product targets are Windows and macOS 13+ Apple Silicon.
Do not claim native macOS evidence from Windows cross-compilation or promote
browser/mock evidence into native acceptance.

When a Tauri command changes, keep Rust registration, build generation input,
capabilities, permission matrix, frontend facade/browser mock and contract
tests synchronized. Do not broaden the Search Window mutation boundary.
SQLite remains the persistence authority; schema/migrations require authorized
migration and rollback/future-version gates. Use the centralized frontend
API/event layer. Do not migrate `files.id` outside an authorized initiative.
Browser mocks must stay deterministic and honest.

## Validation and evidence

- Use scripts defined by `package.json`. Run focused checks first, then the
  applicable broad gates on a stable candidate.
- Do not weaken thresholds, silently downgrade a required gate, or classify
  production work as docs-only. A red, missing or incomplete required gate is
  blocking under its owning contract.
- Never claim a test, visual state, platform check, package or release passed
  unless it actually ran. Record exact SHA, environment and skipped/unverified
  boundaries.
- Local fixtures and caches belong in worktree-local ignored roots; clean only
  verified task-owned temporary artifacts at closeout. Preserve shared caches.
- For large source files, default to symbol-first investigation:
  `rg target symbol → inspect callers → focused ranges → neighboring tests`.

For user-facing UI changes, use shared tokens/primitives/i18n and verify the
applicable keyboard, focus, modal, screen-reader, reduced-motion, contrast,
loading/failure and narrow-layout behavior. Static inspection alone is not
accessibility or native acceptance.

## Closeout

Before handoff, inspect the explicit diff and final status, update applicable
current-truth files, run claim-scoped validation, remove owned temporary
artifacts and report changed files, authority/compatibility impact, commands,
visual/native evidence, acceptance, deferred items and human-review risks.
Review and merge remain owner decisions; green CI does not authorize merge.
