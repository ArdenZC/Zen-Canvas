# W2-R1 — CI Evidence / Governance Hardening

Status: future gated remediation taskbook — not started by R0.

R1 is the next authorized remediation after R0 closes. It changes CI evidence and merge-validation governance, so it is production/tooling work and requires its own Draft PR, exact-head review, and an ADR before the governance change is considered accepted.

## 0. Required reading and preflight

Before editing anything, read and treat as binding:

1. `AGENTS.md`;
2. `docs/project/README.md`;
3. `docs/project/STATUS.md`;
4. `docs/project/ROADMAP.md`;
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`;
6. `docs/project/DEVELOPMENT_WORKFLOW.md`;
7. `docs/project/CODE_MAINTAINABILITY.md`;
8. `docs/project/ARCHITECTURE_MAP.md`;
9. `docs/project/initiatives/W2-file-library-experience.md`;
10. `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`;
11. `.github/workflows/ci.yml` and `.github/workflows/ci-full.yml`;
12. `scripts/classifyCiChanges.mjs` and the focused CI/governance contract tests that exercise it;
13. the current R0 review findings on PR #92.

Record before editing:

- worktree path;
- branch and HEAD;
- `origin/master`;
- merge-base and `origin/master...HEAD` counts;
- changed paths;
- current PR metadata if a PR already exists;
- current classic branch-protection result **and** repository-ruleset/rules evidence where accessible.

Use an isolated branch/worktree. Do not reuse or rewrite the W2-01 worktree. Stop if unrelated production changes are present.

## 1. Problem established by R0

Current pull-request jobs use `actions/checkout` without an explicit ref. On pull-request events this normally validates the event merge ref, while change classification separately receives PR base/head SHAs and W2-01 evidence records a `W201_SOURCE_HEAD` value. Naming the PR head in metadata does not prove that the executed tree is that head.

The required correction is **not** “make every job checkout the PR head.” Zen needs two deliberately different evidence questions:

1. **Head Validation** — does the exact PR head pass the applicable checks?
2. **Merge Integration** — does the candidate merge with the current target branch pass the integration checks?

These trees must never be mislabeled as one another.

R0 also observed that the classic branch-protection endpoint did not show enforced required checks at the reviewed baseline. R1 must not assume that means enforcement is absent: repository Rulesets may own enforcement. Audit both mechanisms and record the actual source of enforcement.

## 2. Required architecture decision

Create or update an ADR under `docs/project/DECISIONS/` because R1 materially changes CI/merge governance.

The ADR must define:

- the canonical meaning of Head Validation;
- the canonical meaning of Merge Integration;
- which event/ref each class checks out;
- what `diff_base` and `diff_head` mean;
- how push and scheduled/full-validation events map to the model;
- how artifacts/summaries identify the executed tree;
- which checks are intended to be merge-required and how enforcement is provided (classic protection, Ruleset, or another explicit repository mechanism);
- fork-PR behavior and permissions constraints;
- failure behavior when base/head information is absent or cannot be trusted.

Do not merge R1 with an undocumented implicit policy.

## 3. Scope

R1 may modify only the CI/governance surface needed to make evidence truthful and enforceable, including:

- `.github/workflows/**`;
- focused CI classification/evidence scripts;
- focused workflow/script contract tests;
- the ADR and current governance docs required by repository workflow.

Required outcomes:

### A. Exact PR-head lane

Provide an inspectable lane that explicitly checks out and validates the exact PR head SHA for the applicable scope. Its artifacts and summaries must report the SHA of the tree actually executed.

### B. Merge-integration lane

Preserve or establish a lane that validates the candidate integration tree against the current base branch. If GitHub's PR merge ref is used, say so explicitly and label evidence as merge-integration evidence, not exact-head evidence.

### C. Diff contract

`diff_base`/`diff_head` must be derived from a documented source and must not silently describe a different tree from the job's purpose. A deliberate two-tree operation is permitted only when the ADR names both trees and tests the distinction.

### D. Repository enforcement audit

Determine whether merge enforcement is provided by:

- classic branch protection;
- Repository Rulesets;
- both;
- neither.

Record the exact repository truth available to the task. If enforcement cannot be changed through the available authenticated surface, classify that part `BLOCKED`/`UNVERIFIED`; do not pretend CI workflow changes alone make a check merge-required.

### E. Existing coverage preservation

Preserve all current routing and high-cost gates, including docs-only routing, frontend, Rust, security, native/platform, package/release, browser, 100k/1M and Full-validation coverage. R1 may reorganize evidence semantics but may not lower a threshold or skip an existing risk class to make the task pass.

## 4. Required tests

Add focused deterministic coverage for at least:

- pull request from same repository;
- fork PR where token/ref semantics differ;
- direct push to `master`;
- scheduled/manual Full validation;
- missing/invalid base information fails closed;
- Head Validation records the exact checked-out head;
- Merge Integration records the integration tree and does not claim it is the PR head;
- change-scope routing remains unchanged for representative docs/frontend/Rust/native/package/performance diffs;
- W2-01 browser evidence can no longer use a metadata SHA to imply checkout proof;
- workflow actions remain pinned according to existing repository policy.

A text-only unit test that never exercises the relevant workflow/script contract is not sufficient by itself.

## 5. Maintainability gate

Before materially expanding any workflow helper or classification script, inspect its current responsibilities using `CODE_MAINTAINABILITY.md`.

Do not create one script that simultaneously owns event parsing, checkout policy, diff calculation, artifact identity, required-check policy and unrelated routing. Extract a small cohesive helper when needed, but do not create meaningless micro-files.

Any new long-lived CI helper must have a clear owner and focused tests.

## 6. Prohibitions

Do not:

- force-push or rewrite history;
- weaken routing or thresholds;
- classify production changes as docs-only;
- add PR-number or branch-name exceptions that bypass normal policy;
- suppress failed jobs;
- claim native evidence from non-native runners;
- change W1 runtime contracts or W2-02 presentation contracts;
- start R2/R3/R4;
- Ready or merge the PR before independent review;
- treat `github.event.pull_request.head.sha`, `W201_SOURCE_HEAD`, a label, or an artifact filename as checkout proof unless the job also proves the executed tree.

## 7. Stop conditions

STOP and report instead of improvising if:

- exact-head validation would require reducing merge-integration coverage;
- fork PR permissions make the proposed policy unsafe;
- required-check enforcement cannot be determined but the task would otherwise claim enforcement;
- a proposed solution requires unrelated product/runtime changes;
- current repository rules contradict the planned ADR;
- existing workflows contain unrelated uncommitted or concurrent changes in the worktree.

## 8. Validation

Run focused checks first, then all applicable repository gates for workflow/script changes. At minimum include:

- focused CI routing/evidence contract tests;
- `npm run test:governance`;
- `npm run test:docs`;
- applicable script/unit tests;
- `git diff --check`;
- real GitHub Actions evidence on the exact R1 PR head;
- separate evidence for any merge-integration lane that is part of the policy.

Do not claim a gate that did not run.

## 9. Exit gate

R1 is complete only when a reviewer can answer, for every merge-relevant lane:

- what tree executed;
- why that tree is the right tree for the lane;
- what base/head the diff used;
- what SHA artifacts report;
- how merge-required enforcement is actually configured;
- what remains unverified.

The ADR, focused tests, real PR evidence, docs/governance checks and exact commit must all agree.

Classify each result as `HARD PASS`, `OBSERVED`, `UNVERIFIED`, `DEFERRED`, or `BLOCKED`.

R1 completion does **not** authorize W2-02. R2, R3 and R4 remain mandatory.

## 10. Final report

Return:

1. branch/worktree and exact production head;
2. base/master and merge-base;
3. changed files grouped by workflow/script/test/docs;
4. ADR path and accepted policy summary;
5. exact Head Validation checkout semantics;
6. exact Merge Integration semantics;
7. diff-base/head semantics;
8. branch-protection findings;
9. Ruleset findings;
10. required-check enforcement conclusion;
11. fork-PR conclusion;
12. focused tests and results;
13. full CI runs and run IDs;
14. exact-head vs merge-integration evidence table;
15. maintainability review;
16. task-owned artifact cleanup;
17. `git diff --check` result;
18. remaining `UNVERIFIED`/`BLOCKED` items;
19. PR state and head SHA;
20. explicit statement that R2/R3/R4/W2-02 were not started.

STOP after the R1 PR is pushed and remains Draft.