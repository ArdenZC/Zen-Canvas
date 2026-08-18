# ADR-0004: CI Source and Merge-Integration Evidence

Status: accepted

Date: 2026-08-19

## Context

Zen Canvas requires validation evidence to describe the source tree that actually executed. A pull-request workflow can otherwise check out GitHub's merge ref while separate metadata records `pull_request.head.sha`, creating an incorrect impression that the exact PR head was validated.

W2-01 exposed this distinction directly: browser evidence named a source-head SHA while the workflow had executed a merge-ref tree. That specific run could be closed only by separately proving tree equivalence. R1 therefore establishes an explicit CI evidence model before later W2 production continues.

The project needs two different answers:

1. Does the exact source proposed by the contributor pass its applicable validation?
2. Does that source integrate cleanly with the current target branch and pass the applicable integration validation?

Those questions may execute identical content when the branch is synchronized with its base, but they remain different contracts.

## Decision

### 1. Two evidence lanes

Pull-request validation has two explicitly named semantic lanes.

#### Head Validation

Head Validation executes the exact pull-request source head. For a pull request, source identity is the head repository plus the immutable head SHA.

Head Validation evidence records at least:

- semantic lane: `head_validation`;
- source repository identity where relevant;
- expected PR head SHA;
- actual checked-out commit SHA from the runner;
- actual checked-out tree SHA;
- the diff base/head used by change classification;
- the validation/run identity.

A metadata variable such as `W201_SOURCE_HEAD`, an artifact filename, branch label or PR label cannot substitute for actual checkout proof.

#### Merge Integration

Merge Integration executes the candidate integration of the reviewed head with the current pull-request base. GitHub's pull-request merge ref is acceptable when its meaning is explicit and its identity is recorded.

Merge Integration evidence records at least:

- semantic lane: `merge_integration`;
- base SHA used for the candidate;
- PR head SHA used for the candidate;
- actual checked-out/integration commit SHA;
- actual integration tree SHA;
- the validation/run identity.

Merge Integration evidence must never be labelled exact PR-head evidence merely because it also contains the PR head SHA.

### 2. Tree equivalence is evidence, not lane collapse

Head Validation and Merge Integration compare their independently observed tree SHAs.

If the tree SHAs are equal, `tree_equivalent=true` may be recorded. The applicable substantive validation may then execute once on that content tree and be cited for both content-validation questions, while the two lanes retain separate commit/ref identities.

If the tree SHAs differ, the exact PR head and the merge-integration tree must both receive the applicable routed validation before a required aggregate may pass. Merge-only success cannot satisfy a non-equivalent Head Validation obligation.

Tree equality, not commit equality, controls this optimization.

### 3. Diff semantics are explicit

For pull requests, change classification uses the reviewed base/head relationship rather than whichever synthetic commit a job happens to execute. `diff_base` and `diff_head` must be deterministic, tested and reported.

A job may deliberately use one tree for execution and another pair of refs for classification only when both contracts are explicit. Hidden two-tree behavior is prohibited.

### 4. Push and Full Validation events

For a direct push to `master`, the pushed commit is the source being validated. Evidence records the actual checked-out commit and tree; there is no fictional PR-head/merge-ref distinction.

For scheduled or manually dispatched Full Validation, the workflow records the immutable selected commit and actual checked-out commit/tree. A moving branch label alone is not durable evidence.

### 5. Fork safety

Head Validation of an untrusted fork runs with least privilege. CI must not use `pull_request_target` to execute untrusted PR code with privileged base-repository secrets.

If a fork restriction prevents a normal gate from running safely, the limitation is surfaced as `UNVERIFIED` or `BLOCKED`; it is not bypassed with a privileged exception.

### 6. Repository enforcement is separate from workflow existence

A workflow file existing or a CI run being green does not prove GitHub will block an unsafe merge.

R1 audits both classic branch protection and Repository Rulesets. The accepted closeout identifies the mechanism that actually owns required checks.

For production-changing pull requests, stable aggregate required contexts are permitted, but those aggregates must fail when an applicable Head Validation or Merge Integration obligation is missing or fails. Docs-only routing may remain lightweight under the existing risk policy, but its evidence must still truthfully identify the executed tree.

### 7. Existing risk coverage is preserved

R1 changes evidence semantics and checkout policy, not product risk tolerance. It must not reduce or bypass existing frontend/type/build, Rust/security, supported-platform/native, package/release, browser, 100k/1M, performance or Full-validation coverage.

A production diff cannot be reclassified as docs-only merely to make the new evidence model cheaper.

### 8. Evidence belongs to the executed commit

Later Track reports must distinguish:

- the commit whose code was reviewed;
- the commit/tree each CI lane executed;
- the integration candidate where applicable;
- docs-only follow-up evidence versus the preceding implementation head.

A later implementation commit invalidates earlier exact-source evidence for the new implementation head.

## Consequences

Positive consequences:

- exact-head claims become verifiable source properties rather than artifact labels;
- integration failures against a moving `master` cannot be hidden by head-only validation;
- head failures cannot be hidden by a green synthetic merge-ref run;
- equal trees avoid unnecessary duplicate expensive validation;
- unequal trees receive both required applicable validation lanes;
- fork and same-repository PRs share one explicit evidence model;
- repository enforcement is audited separately from workflow configuration.

Costs:

- non-equivalent PRs may execute an additional applicable validation lane;
- workflow/script contracts and evidence artifacts are more explicit;
- lane-aware performance caches/artifacts require additional identity fields;
- unavailable fork/platform resources may remain explicit evidence gaps instead of being bypassed.

## Rejected alternatives

### Treat the default PR merge-ref checkout as exact-head validation

Rejected because the merge ref is a different commit/ref contract even when it happens to produce the same tree.

### Pin every pull-request job to the PR head and remove merge integration

Rejected because source correctness does not replace integration validation against the current base.

### Keep merge-ref execution but write `pull_request.head.sha` into artifacts

Rejected because metadata does not change the executed tree.

### Infer integration safety from a manual synchronized-branch convention

Rejected because tree equivalence is evidence for a specific run, not a durable contributor convention.

### Rely on green workflows without auditing required-check enforcement

Rejected because successful workflows may exist without being merge-required.

## Acceptance record

R1 was independently reviewed on Draft PR #94 before this ADR was accepted.

Reviewed implementation evidence:

- implementation head: `cc37e7077af67039c131f219d4bd36b640d0ff76`;
- base: `master@6aeb3cff84b1fcced31ecdfa4137ec527880c96e`;
- reviewed CI run: `32175677532` / CI #736, conclusion `success`;
- exact-head checkout tree: `be43fb7e1b1de6b8e04061d3da15b874a1428da3`;
- merge-integration commit: `719a2eeeae9d3c7140276ff5ec32cf1b905da548`;
- merge-integration tree: `be43fb7e1b1de6b8e04061d3da15b874a1428da3`;
- observed `tree_equivalent=true`, so substantive validation executed once on the integration lane while Head Validation retained separate checkout/evidence identity.

Deterministic contract coverage exercises non-equivalent trees. In that case the validation plan requires both `head_validation` and `merge_integration`, and the existing required aggregate contexts fail closed if the applicable matrix group is missing or unsuccessful. Predecessor run `32173907771` additionally demonstrated that the aggregate contexts fail when they cannot validate their own plan even when substantive child jobs succeeded.

Authenticated repository audit recorded no classic branch protection on `master`. Active Ruleset `Protect master` (ID `20886887`) owns enforcement. The required contexts remain:

- `Change scope / routing contract`;
- `Documentation-only validation`;
- `Quality (windows-latest)`;
- `Quality (macos-latest)`.

R1 does not mutate repository settings. Head/integration obligations are enforced transitively through these stable required aggregate contexts.

Known non-blocking evidence gaps at acceptance:

- no separately triggered schedule/workflow-dispatch Full Validation run was produced during R1; deterministic workflow/helper coverage exists, so this remains `UNVERIFIED` rather than a blocker;
- local Cargo advisory audit could not complete because the RustSec advisory database fetch stalled; no successful Cargo audit is claimed from that attempt;
- no fabricated unequal-tree remote run is claimed; unequal-tree behavior is covered by deterministic contract tests and reviewed workflow matrix/aggregate wiring.

The independent review found no remaining R1 governance or coverage blocker. R1 acceptance does not authorize W2-02; R2, R3 and R4 remain mandatory prerequisites.
