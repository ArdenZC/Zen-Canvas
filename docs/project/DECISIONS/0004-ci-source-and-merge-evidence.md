# ADR-0004: CI Source and Merge-Integration Evidence

Status: proposed — accept only after R1 implementation, repository-enforcement audit and exact evidence are independently reviewed

Date: 2026-08-19

## Context

Zen Canvas requires validation evidence to describe the source tree that actually executed. The existing pull-request workflows do not currently make that distinction strong enough.

For a GitHub `pull_request` event, an `actions/checkout` step without an explicit source normally validates the event merge ref. Separate workflow metadata may still record `pull_request.head.sha` for diff classification or artifact labels. A label naming the PR head is not proof that the job executed that head.

W2-01 exposed the practical consequence: browser evidence could record a source-head SHA while the workflow itself had checked out a merge-ref tree. That run could be closed only by separately proving tree equivalence. R0 therefore blocks later W2 production until R1 establishes an explicit CI evidence model.

The project needs two different answers, not one overloaded “exact-head” concept:

1. Does the exact source proposed by the contributor pass its applicable validation?
2. Does that source integrate cleanly with the current target branch and pass the applicable integration validation?

Those questions may happen to execute identical trees when a branch is already synchronized with its base, but they remain different contracts.

## Decision

### 1. Two evidence lanes

Pull-request validation has two explicitly named semantic lanes.

#### Head Validation

Head Validation executes the exact pull-request source head.

For a pull request, the source identity is the head repository plus the immutable head SHA. The checkout must be explicit enough to work safely for same-repository and fork pull requests without interpreting a display branch name as authority.

Head Validation evidence records at least:

- semantic lane: `head_validation`;
- source repository identity where relevant;
- expected PR head SHA;
- actual checked-out commit SHA from the runner;
- actual checked-out tree SHA when tree identity is useful for equivalence review;
- the diff base/head used by change classification;
- the validation/run identity.

A metadata variable such as `W201_SOURCE_HEAD`, an artifact filename or a PR label cannot substitute for the actual checked-out SHA.

#### Merge Integration

Merge Integration executes the candidate integration of the reviewed head with the current pull-request base.

GitHub's pull-request merge ref is an acceptable implementation when it truthfully represents that integration candidate. An explicit locally constructed merge candidate is also acceptable if its source/base inputs and resulting tree are recorded.

Merge Integration evidence records at least:

- semantic lane: `merge_integration`;
- base branch/base SHA used for the candidate;
- PR head SHA used for the candidate;
- actual checked-out/integration commit SHA;
- actual integration tree SHA;
- the validation/run identity.

Merge Integration evidence must never be labelled exact PR-head evidence merely because the artifact also contains the PR head SHA.

### 2. Tree equivalence is evidence, not lane collapse

When Head Validation and Merge Integration resolve to the same tree, tree-SHA equality may be recorded as useful equivalence evidence. It does not erase the distinction between the two lanes and does not make future unequal trees interchangeable.

### 3. Diff semantics are explicit

Change classification must name the source of both sides of the comparison.

For pull requests, the intended product-change diff is based on the reviewed base/head relationship rather than on whichever synthetic commit happens to be checked out by a job. The implementation may use a merge base or another reviewed Git-equivalent calculation, but the chosen `diff_base` and `diff_head` semantics must be deterministic, tested and reported.

A job may deliberately use one tree for execution and another pair of refs for classification only when both contracts are explicit. Hidden two-tree behavior is prohibited.

### 4. Push and scheduled/full-validation events

For a direct push to `master`, the pushed commit is the source being validated. Evidence records the actual checked-out `github.sha`/commit and its tree. There is no fictional PR-head/merge-ref distinction for that event.

For scheduled or manually dispatched Full Validation, the workflow must record the explicit commit/ref it selected and the actual checked-out commit/tree. A moving branch label by itself is not durable evidence.

### 5. Fork safety

Head Validation of an untrusted fork must run with the least privilege needed to read and validate that source. The workflow must not use `pull_request_target` to execute untrusted PR code with privileged base-repository secrets.

If a fork-specific restriction prevents a normal gate from running safely, that limitation must be surfaced as `UNVERIFIED`/`BLOCKED` according to project policy rather than bypassed with a privileged exception.

### 6. Repository enforcement is separate from workflow existence

A workflow file existing or a CI run being green does not prove that GitHub will block an unsafe merge.

R1 must audit both:

- classic branch protection / required status checks; and
- Repository Rulesets or any other active repository rule that can require checks.

The accepted R1 closeout must state which repository mechanism actually enforces merge requirements. If the authenticated tooling cannot inspect or update that mechanism, the repository-enforcement result remains `UNVERIFIED` or `BLOCKED`; it may not be inferred from workflow configuration.

For production-changing pull requests, project policy requires the merge decision to retain both source correctness and integration correctness. The implementation may expose stable aggregate required checks rather than requiring every internal matrix job individually, but the aggregate must fail when a required Head Validation or Merge Integration contract fails.

Docs-only routing may remain lightweight where the current risk-based CI policy permits it, but its evidence must still truthfully name the tree that executed.

### 7. Existing risk coverage is preserved

R1 changes evidence semantics and checkout policy, not product risk tolerance.

It must not reduce or bypass existing:

- frontend/type/build checks;
- Rust/security checks;
- supported-platform/native checks;
- package/release checks;
- browser regressions;
- 100k/1M and other performance gates;
- Full-validation routing.

A production diff cannot be made “docs-only” to satisfy the new policy cheaply.

### 8. Evidence belongs to the executed commit

Every final R1 report and later Track report must distinguish:

- the commit whose code was reviewed;
- the commit/tree each CI lane executed;
- the integration candidate where applicable;
- docs-only follow-up evidence versus the preceding production head.

A later production commit invalidates earlier exact-source evidence for the new head.

## Consequences

Positive:

- “exact head” becomes a verifiable source property rather than an artifact label;
- integration failures against a moving `master` cannot be hidden by head-only validation;
- head correctness cannot be hidden by a green synthetic merge-ref run;
- fork and same-repository PRs share one explicit evidence model;
- future W2/W3/W4 reviews can cite source and integration evidence without manually reconstructing what GitHub checked out;
- repository enforcement is audited as a separate control rather than assumed from CI configuration.

Costs:

- some pull requests may execute an additional validation lane or aggregate gate;
- workflow/script tests become more explicit about Git event/ref semantics;
- evidence artifacts/summaries need additional source fields;
- fork PRs may require narrower execution paths where privileged resources are unavailable;
- repository Ruleset/branch-protection configuration may require a separate authenticated change if current tooling cannot enforce the intended checks.

## Rejected alternatives

### Treat the default PR merge-ref checkout as exact-head validation

Rejected because the merge ref is a different commit/tree contract even when it occasionally has identical content.

### Pin every pull-request job to the PR head and remove merge-ref validation

Rejected because it answers source correctness but loses explicit evidence that the candidate integrates with the current base.

### Keep merge-ref execution but write `pull_request.head.sha` into artifacts

Rejected because metadata does not change the executed tree and can create false exact-head claims.

### Require contributors to keep branches synchronized and infer integration safety from tree equality

Rejected as a manual convention. Tree equality may close a specific review, but it is not a durable CI governance model and becomes stale when the base advances.

### Rely on green workflows without auditing required-check enforcement

Rejected because GitHub can report successful checks without actually requiring them before merge.

## Acceptance condition

Change this ADR from `proposed` to `accepted` only after R1 proves all of the following on the reviewed implementation:

- explicit Head Validation checkout/evidence semantics;
- explicit Merge Integration checkout/evidence semantics;
- deterministic tested diff-base/head behavior;
- safe fork behavior;
- preserved existing routing/risk coverage;
- actual repository enforcement is identified, or the inability to enforce is explicitly classified rather than hidden;
- real GitHub Actions evidence is tied to the R1 reviewed head/integration candidate;
- independent review finds no governance/coverage blocker.
