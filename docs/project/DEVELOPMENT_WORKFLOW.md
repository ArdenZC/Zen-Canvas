# Zen Canvas Development Workflow

This workflow is the default engineering operating model for new work after G1. A narrower security/task contract may add stricter gates; it may not weaken these rules silently.

## Initiative lifecycle

```text
research / problem definition
→ initiative scope
→ architecture/product decisions
→ feature branch
→ implementation
→ focused verification
→ applicable full verification
→ evidence + current-truth update
→ review
→ merge
→ closeout
→ branch cleanup
```

Do not begin production implementation from an informal idea when the change moves architecture authority, schema, platform safety, user-file mutation or product ownership. Write the initiative/spec first.

## One coherent branch per initiative

Default branch naming:

- `feat/<initiative>` — product capability.
- `fix/<scope>` — bounded defect/remediation.
- `chore/<scope>` — governance, tooling or maintenance without product behavior change.
- `docs/<scope>` — documentation-only work.

Avoid permanent integration branches. If an initiative requires parallel sub-work, integrate through explicitly bounded branches/PRs and close them when their content is absorbed.

Never commit directly to `master` for non-trivial work.

## Scope hygiene

Before changing files:

1. record current branch and `HEAD`;
2. confirm the intended base;
3. inspect existing callers and authority contracts;
4. identify unrelated changes and leave them untouched;
5. stage only intended paths.

Do not use broad staging to absorb unrelated work.

## Atomic commits

Each commit should have one reviewable purpose. Prefer messages such as:

- `docs: install project current-truth layer`
- `fix(watcher): preserve reconciliation revision ownership`
- `refactor(runtime): split search lifecycle controller`

Avoid messages such as `update`, `fix stuff` or `refactor all`.

A large initiative may have multiple atomic commits; a small focused change may have one.

## Merge strategy

Default project strategy: **squash merge** for ordinary feature, fix, governance and integration PRs.

Use a merge commit only when preserving a meaningful multi-parent topology is itself useful and explicitly reviewed. Rebase merge is not the default project strategy.

After squash merge, the source branch's commits will not be ancestors of `master`. Branch closeout therefore uses content equivalence when ancestor checks are insufficient.

## Validation by risk

Run focused checks first, then the applicable repository gates.

Typical production checks include:

```bash
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:check
npm run verify:rust
npm run verify:security
```

Use the current CI workflow contract for Windows/macOS, performance and package coverage. High-risk filesystem/platform/schema/performance work requires the matching full validation.

Docs-only work may use the docs fast path only when the diff is genuinely documentation-only. Do not classify production changes as docs-only to reduce CI cost.

Never claim a gate passed unless it ran successfully on the stated commit/environment.

## Exact-head evidence

Validation evidence must record the exact commit SHA. If a follow-up commit changes production code, earlier exact-head results are evidence for the earlier commit only.

A docs-only follow-up may reference the immediately preceding validated production head, but must state that distinction explicitly.

## Pull request policy

- Prefer one PR for one coherent initiative or review fix.
- Broad initiatives start as Draft unless the scope explicitly says otherwise.
- PR descriptions state scope, authority changes, risk, verification and known unverified areas.
- Review fixes stay on the same initiative when possible instead of creating permanent chains of integration branches.
- Never merge merely because CI is green; authority, review and closeout gates still apply.

## Current-truth update before merge

Before final merge of an initiative, update as applicable:

- `docs/project/STATUS.md` — baseline, initiative state, validation, schema/version/release state.
- `docs/project/ARCHITECTURE_MAP.md` — authority/ownership changes.
- `docs/project/PRODUCT_MAP.md` — user/workspace ownership changes.
- `docs/project/TECH_DEBT.md` — debt opened, changed or closed.
- `docs/project/RISK_REGISTER.md` — project-level risk changed.
- `docs/project/ROADMAP.md` — sequencing/authorization changed.
- `docs/project/DECISIONS/` — accepted cross-cutting decisions.

Do not duplicate current state into a new closeout file.

## Closeout and branch cleanup

An initiative is closed only when:

1. intended changes are merged;
2. final merge SHA is known;
3. required exact-head validation is recorded;
4. `STATUS.md` reflects the merged state;
5. deferred/unverified items are explicit;
6. source/integration branches are deleted after ancestor or content-equivalence verification.

For squash-integrated branches, compare the branch diff/content against the merge result before deletion. An `ahead` count alone is not proof that work is missing.

## Release state

Keep these states separate:

```text
Implemented → Validated → Packaged → Released
```

A successful NSIS/DMG build is `Packaged`, not `Released`. A GitHub release/tag or other explicitly published distribution is required for `Released`.

## Architecture decision trigger

Create an ADR when a change:

- moves durable authority or persistence ownership;
- changes supported platforms;
- changes filesystem mutation/recovery strategy;
- changes cross-window permissions;
- introduces a new long-lived subsystem or queue;
- changes merge/CI/release governance materially.

Small local refactors that preserve these facts do not need an ADR.
