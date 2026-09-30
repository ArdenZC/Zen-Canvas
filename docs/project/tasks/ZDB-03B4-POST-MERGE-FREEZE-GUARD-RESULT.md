# ZDB-03B4 post-merge frozen-tree guard repair

Status: **IMPLEMENTED FOR OWNER REVIEW — SEPARATE DRAFT / DO NOT MERGE AUTOMATICALLY**.

This bounded maintenance branch starts at current `master@b698228e94a1857e0610cccb2364e1027f6b1b0d`. It repairs the pre-existing B4 verifier defect independently of [PM-02A PR #313](https://github.com/ArdenZC/Zen-Canvas/pull/313). PM-02A code/architecture review is **SUBSTANTIALLY PASSED — CLOSEOUT GATES BLOCK MERGE**; #313 stays Draft at `2175fdfedc52cd57d02cb9cd25dd3bc302d26e58`.

## Exact freeze contract

B4 `START` remains `0fc3751de02a4acab07ff45dbd6523c8efa35a65`, tree `756049a02ef047afd8dfc95d7bfc7e1cb6471f62`. All 93 original research files are still checked, with no generic exclusions. The one explicit accepted post-closeout override binds `research/zen-decision-bench/preference/README.md` to Git blob `6545ea8d46b4214865c0674a2627485aabafb45c`, accepted in [PR #310](https://github.com/ArdenZC/Zen-Canvas/pull/310), merge `867b67bed9476b788d2a0d2ee04e5c5b73070aa7`.

Git comparison confirms that README was the only pre-existing research file modified by the accepted B4 merge. Every other original START-tree research file retains its original expected blob. Resolver/evaluator/validator blob checks remain intact. The optional file root supports isolated mutation fixtures; production callers continue to verify the actual repository by default.

No corpus, evidence, hash inventory or result is regenerated. No threshold, metric, resolver/evaluator, B3/B4 evidence, Preference semantics, product authority, schema or package version changes. The repair adds only the verifier override, its regression test and this maintenance record.

## Validation and review gate

- Direct verifier: PASS, 93 checked files, zero unaccepted drift, original START tree retained.
- New regression suite: accepted repository state passes; README mutation fails; another pre-B4 frozen file mutation fails. Mutations occur only in task-owned temporary copies, restored between cases and removed afterward.
- New guard plus existing B4 screen suite: PASS, 12 tests across two suites.
- Full frontend tests, documentation/governance, typecheck and whitespace results are recorded with the exact delivered SHA in the Draft PR handoff. No test exclusion or unhandled-error suppression is introduced.

Stop for Owner review of the separate baseline repair. Only after Owner review and merge may #313 be updated onto the new master and qualified by fresh exact-head hosted CI with **ALL REQUIRED CI GREEN**. Run `36730131739` is historical and is not final qualification. Reobserve its virtualizer teardown signal after the repair merges; if reproduced, stop PM-02A closeout and use another bounded maintenance PR.

This execution environment is Linux and exposes no supported Windows native host. PM-02A native Tauri and restart acceptance remains **NOT CAPTURED / OWNER VERIFICATION REQUIRED**; hosted unit tests and browser mocks cannot substitute. No user files or Organization filesystem execution are involved in this repair.

PM-02A remains **OWNER REVIEW PENDING**. PM-02B and PM-03 remain **NOT ACTIVE**. Neither this repair nor #313 is authorized for automatic merge.
