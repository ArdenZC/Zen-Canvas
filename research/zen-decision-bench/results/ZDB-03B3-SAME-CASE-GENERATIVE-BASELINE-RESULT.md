# ZDB-03B3 — Same-Case Canonical Generative Baseline

Status: **ACTIVE / CANDIDATE PREPARATION — TWO PREFLIGHT BLOCKERS REMEDIATED**.

Issue [#283](https://github.com/ArdenZC/Zen-Canvas/issues/283); frozen corpus [PR #306](https://github.com/ArdenZC/Zen-Canvas/pull/306). This is research-only, one immutable 120-case synthetic pilot baseline. Owner review and merge remain pending. No Preference Arm, B4, >=300 comparative corpus, ZDB-04+ or PM-02 is active.

The initial B3 attempt stopped before provider execution because the merged B2C validator contained an accidental literal `\n` syntax defect from freeze-closeout. [PR #307](https://github.com/ArdenZC/Zen-Canvas/pull/307) repaired only that syntax defect. No corpus or experimental input changed, and the blocked attempt made zero provider requests, zero Arm executions, zero task modifications, zero commits and zero PRs. The hotfix merge master is `849e1f2deb2defb1f011751158962de7201960f8`; merge-after CI [36678724353](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36678724353) passed. The hotfix is not a B3 experimental change.

Starting master for the resumed candidate: `3fd3e9afcdc9835dc7171d1f57d1c7542d79191b`. Branch: `research/zdb-03b3-same-case-generative-baseline`.

The dedicated runner leaves the accepted adapter, old runner, evaluator and frozen source artifacts unchanged. Before any provider request it validates the saved corpus and all five source hashes, corpus Git blob, prompt/configuration, frozen request projection, clean candidate HEAD and successful exact-head hosted CI. Exclusive output creation and a task-owned durable attempt marker prohibit a repeated run, including after interruption. Predictions are flushed per case; failures receive sanitized stable codes and are not retried. No raw provider body or reason is saved.

Corpus canonical SHA: `0a96faa752b488f9c507ee2d0ca64e439820f85697872a64a5972c2840693349`; file SHA: `e10cd216a0f6692511ec0049dccf37b51f306bd39625b858efcbac35ebac3c8a`; blob: `0e483df2063acbc07ee599e3caa379f4a6f404bf`. All 120 pilot cases pass the frozen validator, with 55 cold-start and 65 non-cold.

Adapter: `managed-ai-deepseek-canonical-enum-v1`. B3 experiment: `zdb-03b3-same-case-generative-v1`. Prompt SHA: `c4fd929f7fce4f581cac8328a198cecae164d3db16eeab03c1b74835b233b68b`. Configuration: `deepseek-v4-flash`, `https://api.deepseek.com/chat/completions`, temperature 0, max tokens 4096, thinking disabled, JSON object, timeout 120000 ms, no retries.

The [request projection](evidence/zdb-03b3-same-case-generative/request-projection.v1.manifest.json) has 120 rows; canonical SHA `81365cb1b4c2880babd867e83a13a5c2e0294cfef79fb62f9373b546db60ac73`, file SHA `5a1d48f4e13fbbf7f4e4537e2c32a86139be2876105f5ae74f9cb0b3d436d7f0`. For all cases, serialized request equality to case-ID/current-file-only projection passes. Forbidden metadata and finite-choice mutation invariance passes, and current-file mutation sensitivity passes. Frozen choices are used only by the unchanged post-response parser. No Preference/gold/Profile/History/Rule/Truth data enters the request.

Validation and execution commands:

```text
node --check research/zen-decision-bench/preference/signal/validate-signal-corpus.mjs
node research/zen-decision-bench/preference/signal/validate-signal-corpus.mjs
node research/zen-decision-bench/preference/signal/generative-contract.mjs
npm test -- research/zen-decision-bench/tests/preference-signal-b3.test.mjs
node research/zen-decision-bench/preference/signal/run-generative-baseline.mjs --live-once
node research/zen-decision-bench/cli/evaluate-predictions.mjs research/zen-decision-bench/preference/signal/signal-corpus.v1.jsonl research/zen-decision-bench/results/evidence/zdb-03b3-same-case-generative/predictions.jsonl --split pilot --run-manifest research/zen-decision-bench/results/evidence/zdb-03b3-same-case-generative/run.json --out research/zen-decision-bench/results/evidence/zdb-03b3-same-case-generative/summary.json
node research/zen-decision-bench/preference/signal/check-generative-evidence.mjs --freeze
node research/zen-decision-bench/preference/signal/check-generative-evidence.mjs
npm run test:docs
git diff --check
```

Live/evaluation commands above are pending candidate CI. Credentials are supplied only to the process environment under the latest explicit Owner authorization. Presence/nonempty is checked; no fresh/unexposed credential claim is made. No value is stored in evidence or documentation.

Resume preflight: validator syntax and saved-corpus validation passed at exact master `849e1f2deb2defb1f011751158962de7201960f8`; five frozen source identities, corpus identity and 55/65 counts passed. The B3 focused suite passed 5/5. The broader structural suite (`npm test -- research/zen-decision-bench --exclude '**/preference-hypothesis.test.mjs'`) reported 49 passed tests, 5 passed files and 3 failed files. One failure is a confirmed committed syntax defect: `tests/preference-signal-b2c.test.mjs:113` still has literal `\n` tokens in the Owner-freeze assertions; standalone `node --check` fails and `git show HEAD:...` confirms it is in the accepted source. The other two failures occur on Windows CRLF imports of older shebang scripts, a previously documented local tooling issue; no workaround or source repair was applied in this resume.

That resume stopped without repairing B2C tests, creating a candidate commit/CI/PR, or issuing provider calls. [PR #308](https://github.com/ArdenZC/Zen-Canvas/pull/308) subsequently repaired only the two accidental literal newline tokens in that test. Its merge master is `3fd3e9afcdc9835dc7171d1f57d1c7542d79191b`; merge-after CI [36681266215](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36681266215) passed. Both defects originated in PR #306 freeze-closeout wording edits. Neither changed corpus, five frozen inputs, adapter, prompt, resolver, thresholds or adjudication. Both blocked attempts made zero provider requests.

Existing B3 work was preserved through named stash `zdb-03b3-preserve-before-hotfix-308`, fast-forward to the exact new master, and stash apply. All eight restored task-file byte hashes matched the saved inventory before further B3 edits. The preservation snapshot and stash remain task-owned recovery evidence. Both syntax gates, saved-corpus validation, five frozen identities and regenerated request projection passed. B3 focused tests passed 5/5; broader research structural tests passed 75/75 in 8 files, excluding the prohibited Preference-hypothesis suite. Four existing shebang scripts received temporary Windows CRLF-to-LF import handling and were restored byte-for-byte afterward; this creates no committed source change. No B2C hotfix appears in the B3 diff. Provider execution is pending clean candidate commit and exact-head hosted CI.

The unchanged evaluator owns scoring and calibration. B3 derived groups are descriptive global/per-task/cold/non-cold/control baseline summaries, with no resolver or Preference transitions. Exact accuracy excludes correct abstentions; adjusted accuracy includes accepted alternates and correct abstentions. No provider/hybrid superiority, production qualification, or safety acceptance is inferred from this synthetic screen.
