# Start Zen Canvas UI/UX V4.3.1 remediation

You are authorized to begin the Zen Canvas UI/UX V4.3 Product Integration & Clarity program using the updated V4.3.1 verification baseline.

## Read first

- `AGENTS.md`
- `docs/design/UI_UX_V4_3_SPEC.md`
- `docs/design/UI_UX_V4_3_PRODUCT_FLOW.md`
- `docs/design/UI_UX_V4_3_EXECUTION.md`
- relevant accepted contracts under `docs/remediation/`

Do not use V4.2 documents as implementation authority.

## Verify baseline

The branch must contain:

```text
master@9ea69d29143b994c8632747ab647f59637dfe324
```

including:

```text
98ca8185979feb5b0f450a076362c089675416b5
```

Run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git merge-base --is-ancestor 9ea69d29143b994c8632747ab647f59637dfe324 HEAD
```

If unrelated working-tree changes exist, do not reset, stash, stage or absorb them. Report the exact files and stop.

If clean, create:

```bash
git switch -c codex/ui-v4-3-product-integration
```

## Execute in order

1. PR 0 — Authority and Legacy UI Map
2. PR 1 — Design Foundation V4.3
3. PR 2 — Shell, Navigation and Search Semantics
4. PR 3 — File Library V3
5. PR 4 — Organization Plan Group Projection
6. PR 5 — Organize Files V2
7. PR 6 — Storage Cleanup Durable UX
8. PR 7 — Preview, History and Restore
9. PR 8 — Automation and Rule Proposal UX
10. PR 9 — Content Understanding Surface
11. PR 10 — Settings and Overview Integration
12. PR 11 — Global QA and Release Gate

Each stage must have:

- an audit;
- a bounded implementation plan;
- implementation;
- focused tests;
- relevant full gates;
- diff self-review;
- execution-document update;
- an independent commit.

Do not compress all stages into one commit.

## Mandatory protections

Preserve:

- Schema 34;
- all authority boundaries;
- backend Global Search order;
- literal punctuation search;
- mounted IME behavior;
- distinct `no_source` and empty states;
- distinct watcher health messages;
- Rule Repository V2-only mutation;
- Search Window Rule permission restrictions;
- current CI fast/full contract;
- Operation Preview, Safe Trash, journals and restore;
- Provider Registry, Model Discovery and Request Trace.

Do not:

- create a second frontend authority;
- derive complete groups from loaded pages;
- re-sort Global Search file results in the renderer;
- strip punctuation from committed queries;
- merge `no_source` into empty;
- restore legacy Rule commands;
- use retry-exhausted copy for reconciliation;
- introduce Schema 35 without explicit authorization;
- weaken CI or performance thresholds.

## Begin with PR 0

Create:

```text
docs/design/UI_UX_V4_3_AUTHORITY_MAP.md
```

PR 0 maps every workspace authority, visible state source, legacy path, raw user-facing fields, hardcoded strings, duplicate headings, responsive risks, accessibility risks and retirement plan.

PR 0 may add non-invasive guards/tests, but must not perform the visual redesign.

Commit:

```text
ui-v4.3(pr0): map UI authorities and legacy paths
```

Then continue in order when acceptance and tests pass.

## Final delivery

Create:

```text
docs/qa/UI_UX_V4_3_FINAL_QA.md
```

Do not merge to `master` automatically.

Final report:

### Completed stages
### Authority migrations
### Important product decisions
### Commit history
### Files changed
### Tests and commands run
### Visual verification
### CI evidence
### Release gate
### Deferred or unverified
### Risks requiring human review
