# W2-R1 — CI Evidence / Governance Hardening

Status: future gated remediation taskbook — not started by R0.

R1 is a prerequisite for W2-02 production. It owns the difference between
metadata that names a pull-request head and the source tree actually validated.
It must be executed in its own reviewed change after this R0 documentation
commit.

## Problem established by R0

The pull-request jobs in .github/workflows/ci.yml and ci-full.yml use
actions/checkout with no explicit ref. The normal pull-request checkout is
therefore the event merge ref. The change-scope job passes PR_BASE and PR_HEAD
to scripts/classifyCiChanges.mjs, which calculates diff_base and diff_head from
those values. The W2-01 browser gate receives W201_SOURCE_HEAD from
pull_request.head.sha or github.sha and records it in artifacts, but that
environment value does not change the checked-out source.

Existing CI tests cover routing, pinned actions, the W2-01 gate label and
performance sharding. They do not prove that every relevant consumer validates
the exact PR head or that the reported diff/evidence head matches the checked
out tree.

## Scope

- define one explicit PR, push and scheduled Full-validation checkout policy;
- make diff_base, diff_head, checked-out source and artifact source identity
  agree, or document a reviewed reason for a deliberate two-tree operation;
- preserve the current docs-only, frontend, Rust, macOS, package, release,
  performance and Full-validation routing;
- keep W201_SOURCE_HEAD useful as evidence while preventing it from being
  mistaken for checkout proof;
- add focused workflow/script contract tests for PR head, merge-base/base,
  push and missing-base behavior;
- bind final CI evidence to the exact commit being reviewed.

## Prohibitions

Do not weaken routing, turn production changes into docs-only work, remove
1M/100k gates, add PR-number exceptions, suppress failed jobs, force-push,
rewrite history or claim native evidence from a non-native runner. Do not
change W2-02 or W1 runtime contracts in R1.

## Required review questions

1. Which tree does each job execute?
2. Which SHA does each diff compare?
3. Which SHA is written into artifacts and summaries?
4. Does a failed or missing PR base fail closed?
5. Does the policy work for PRs from forks and for direct pushes to master?
6. Is the final status tied to the exact production/docs commit, not merely a
   stale label or predecessor run?

## Exit gate

R1 is complete only with:

- passing focused CI routing/evidence contract tests;
- an inspectable job-level checkout and diff policy;
- a real PR validation proving the intended head semantics;
- exact-head workflow evidence for the R1 commit;
- docs/governance validation and git diff --check;
- no reduced performance, security, package, platform or browser coverage.

Classify results as HARD PASS, OBSERVED, UNVERIFIED, DEFERRED or BLOCKED.
R1 does not authorize W2-02 production until R2, R3 and the final consumer
verification also pass.
