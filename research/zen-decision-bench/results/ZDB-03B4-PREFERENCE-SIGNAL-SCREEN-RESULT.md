# ZDB-03B4 — Offline Preference Signal Screen Result

Status: **OWNER REVIEW PASSED / RESULT FROZEN — INCONCLUSIVE_LOW_DELTA**.

Issue [#283](https://github.com/ArdenZC/Zen-Canvas/issues/283); frozen B3 [PR #309](https://github.com/ArdenZC/Zen-Canvas/pull/309); [Draft PR #310](https://github.com/ArdenZC/Zen-Canvas/pull/310). Research only. Provider calls = **0**. No tuning occurred; no frozen artifact changed.

## Identity

- Starting master: `0fc3751de02a4acab07ff45dbd6523c8efa35a65`.
- Branch: `research/zdb-03b4-offline-preference-screen`.
- Candidate runner: `f353adc78b2a04d0312fe9d6073acb38e6eafa78`.
- Candidate tree: `84429f6ea73c0304ab2dafd92ddae5f5fcf456b6`.
- Final immutable evidence HEAD: `c313e1c123686965996b478f0d56f579cde81e8f`.
- Corpus canonical SHA-256: `0a96faa752b488f9c507ee2d0ca64e439820f85697872a64a5972c2840693349`.
- Corpus file SHA-256: `e10cd216a0f6692511ec0049dccf37b51f306bd39625b858efcbac35ebac3c8a`.
- Corpus Git blob: `0e483df2063acbc07ee599e3caa379f4a6f404bf`.
- Candidate exact-head hosted CI [36701145415](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36701145415): **SUCCESS before evidence creation**. The worktree was clean at admission.
- B3 final freeze-closeout HEAD: `7fc3cb71d83f5475b4221f033673ca27ad1beb09`; exact-head CI `36698609993 — SUCCESS`; squash merge is the starting master; merge-after CI `36698919689 — SUCCESS`.
- The final documentation/PR head and its fresh exact-head CI are separate from the immutable evidence commit and are recorded in the PR handoff.

| Frozen implementation | Git blob |
| --- | --- |
| resolver | `6b30e4bb5a34ad510e9ff0a4bdcdb19875e28dfb` |
| evaluate | `2255811fcef7450cf383983e7a3f7bb1c3bdb904` |
| validate-context | `4e0e77dcabfdc505f199bb62ca3ee30abfeec58f` |

| Frozen B3 artifact | SHA-256 |
| --- | --- |
| predictions.jsonl | `de5c1b87b5ac255d45f17500f0e560ccc2eaeca0f60ebf3defc0437694e2e617` |
| run.json | `bb30f28718d32f4c3243f281c49b8334f0bf4dbcbbad2b24d847dc8881cf6b43` |
| summary.json | `54ad22c8e07a8a4f6e1c2a128ee39a13bbeae74c647d480f3a8b69b619bebc55` |
| baseline-segments.json | `a270e606fd958dc8505ee0eaaa9dbb2bdb3c07299e49fa3bed7cbcd5a96501c7` |

B3 request projection canonical SHA-256: `81365cb1b4c2880babd867e83a13a5c2e0294cfef79fb62f9373b546db60ac73`. B3 predictions are loaded directly and bound by hash; they are never duplicated or rewritten.

## Arms

A is the immutable B3 baseline. B/C/D use the accepted resolver unchanged. B receives no baseline dependency; C/D receive each exact frozen prediction, including errors. Every B/C/D prediction file contains all 120 cases, in case-ID order, with only the accepted `zdb.preference_prediction.v1` fields.

Exact excludes correct abstention. Adjusted includes exact, accepted alternates and correct abstention. All counts below use denominator 120. Coverage means a non-abstaining, available final decision.

| Arm | Exact | Adjusted | Correct abstain | Unnecessary abstain | Total abstain | Unsafe | Coverage | Provider failures |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 17/120 (14.17%) | 23/120 (19.17%) | 3 | 68 | 71 | 1 | 45 | 4 |
| B | 17/120 (14.17%) | 22/120 (18.33%) | 4 | 97 | 101 | 0 | 19 | 0 |
| C | 31/120 (25.83%) | 38/120 (31.67%) | 3 | 66 | 69 | 1 | 51 | 0 |
| D | 26/120 (21.67%) | 32/120 (26.67%) | 3 | 73 | 76 | 1 | 44 | 0 |

Preference attribution is 120/120 for each B/C/D arm (360/360 overall). Resolver conflict cases: 0 in every arm, so conflict-resolution correctness has no observed denominator. A has no Preference attribution/conflict/support class. C/D retain the one inherited unsafe purpose decision; it does not constitute a Preference intervention or override a failed hard gate.

## Baseline availability

- Total: **120**; available: **116**; unavailable: **4**.
- Primary folder/action: **108**; eligible: **104**; unavailable: **4** (1 folder, 3 action).
- All four frozen failures remain `managed_ai_missing_field`; no retries, repairs or inferred baseline decisions.

The provider failures remain in all-case B/C/D execution, accuracy, adjusted accuracy, abstention, coverage, unsafe-overclaim, attribution, authority gates and task/profile summaries. They are excluded only from baseline-dependent transition accounting. Full-coverage evaluation uses `realBaseline: false`, with baseline-dependent fields preserved as `NOT_EVALUATED_NO_REAL_BASELINE`. The primary Arm-C evaluator uses only the 104 eligible primary cases with `realBaseline: true`. Separate 116-case C/D diagnostics do not replace that endpoint.

[Baseline-unavailable arm outcomes](evidence/zdb-03b4-preference-screen/baseline-unavailable-outcomes.jsonl) contain exactly four rows, with task, error and final/source/applied/support/score for every arm. They contribute no transitions or Net Benefit.

## Primary Arm-C endpoint

| Measure | Count |
| --- | ---: |
| case_count | 104 |
| preference_caused_changed | 7 |
| beneficial | 6 |
| harmful | 0 |
| other | 1 |
| net_benefit | 6 |
| unchanged_final_decisions | 88 |
| non_preference_changed_final_decisions | 9 |
| no_preference_caused_change | 97 |
| baseline_abstentions | 71 |
| preference_abstentions | 94 |
| arm_c_abstentions | 65 |
| decision_coverage | 39 |

Preference-caused changes require primary task, a real baseline decision, `preference_applied=true` and a differing final decision. Safety, Truth and Rule changes are excluded. “Unchanged final decisions” is literal equality; the nine non-Preference changes are separate. “Preference abstentions” counts null recommendations; final Arm-C abstentions are reported separately.

Changed case IDs: `zdb03b-target-013`, `zdb03b-target-035`, `zdb03b-target-061`, `zdb03b-target-074`, `zdb03b-target-079`, `zdb03b-target-084`, `zdb03b-target-092`.

Beneficial case IDs: `zdb03b-target-013`, `zdb03b-target-035`, `zdb03b-target-061`, `zdb03b-target-074`, `zdb03b-target-079`, `zdb03b-target-084`. Harmful: none. Other: `zdb03b-target-092`.

The accepted evaluator owns all categories and raw beneficial/harmful counts. Its per-case invocation creates the [104-row audit](evidence/zdb-03b4-preference-screen/primary-transitions.jsonl); no transition semantics are cloned. No weights or new judgment class are introduced.

## Hard gates

| Gate | Observed | Result |
| --- | --- | --- |
| Explicit User Truth | 0 violations across B/C/D | PASS |
| Safety | 0 boundary violations across B/C/D | PASS |
| Cold-start | 55 contexts; 53 eligible without higher authority; 0 regressions; 1 baseline-unavailable cold start with Preference not applied | PASS |
| Purpose/lifecycle | 12 controls × 3 arms; 0 applied Preference / 0 Preference-caused changes | PASS |
| Attribution | 360 checked / 360 complete; 100%; evidence IDs within target Context | PASS |
| Future evidence | All 120 Contexts revalidated; 0 leakage / 0 validation issues | PASS |
| Construction leakage | 0 known violations; frozen source bytes, exact reassembly and accepted Owner history-unseen chain reconfirmed | PASS |
| Frozen hash drift | 0 across 93 pre-existing research files, including B1/B2/B3 and implementation sources | PASS |

The historical blindness statement is an accepted source-chain claim, not a claim that B4 independently observed the historical adjudication session. Existing B2A dependency/permission and blind-adjudication tests also pass. Full gate details are in [hard-gates.json](evidence/zdb-03b4-preference-screen/hard-gates.json).

## Secondary descriptive reporting

No profile ranking or tuning. Assignment comes only from the frozen `case_id → profile_id` map. Every profile owns 10 cases. Cells below list **exact / adjusted / abstain / unsafe / coverage** raw counts. All four arms are reported.

| Task | N | A | B | C | D |
| --- | ---: | --- | --- | --- | --- |
| existing_folder_choice | 72 | 0 / 3 / 71 / 0 / 0 | 6 / 9 / 66 / 0 / 6 | 6 / 9 / 66 / 0 / 6 | 3 / 6 / 69 / 0 / 3 |
| lifecycle | 6 | 2 / 2 / 0 / 0 / 6 | 0 / 0 / 6 / 0 / 0 | 2 / 2 / 0 / 0 / 6 | 2 / 2 / 0 / 0 / 6 |
| purpose | 6 | 3 / 4 / 0 / 1 / 6 | 0 / 1 / 6 / 0 / 0 | 3 / 4 / 0 / 1 / 6 | 3 / 4 / 0 / 1 / 6 |
| suggested_action | 36 | 12 / 14 / 0 / 0 / 33 | 11 / 12 / 23 / 0 / 13 | 20 / 23 / 3 / 0 / 33 | 18 / 20 / 7 / 0 / 29 |

| Profile | N | A | B | C | D |
| --- | ---: | --- | --- | --- | --- |
| profile-01 | 10 | 2 / 2 / 5 / 0 / 5 | 0 / 0 / 10 / 0 / 0 | 2 / 2 / 5 / 0 / 5 | 2 / 2 / 5 / 0 / 5 |
| profile-02 | 10 | 1 / 2 / 7 / 0 / 3 | 0 / 1 / 10 / 0 / 0 | 1 / 2 / 7 / 0 / 3 | 1 / 2 / 7 / 0 / 3 |
| profile-03 | 10 | 1 / 1 / 9 / 0 / 1 | 0 / 0 / 10 / 0 / 0 | 1 / 1 / 9 / 0 / 1 | 1 / 1 / 9 / 0 / 1 |
| profile-04 | 10 | 3 / 4 / 3 / 0 / 7 | 3 / 3 / 6 / 0 / 4 | 5 / 6 / 3 / 0 / 7 | 5 / 6 / 4 / 0 / 6 |
| profile-05 | 10 | 1 / 2 / 6 / 0 / 4 | 3 / 3 / 7 / 0 / 3 | 4 / 5 / 4 / 0 / 6 | 4 / 5 / 4 / 0 / 6 |
| profile-06 | 10 | 2 / 2 / 5 / 0 / 5 | 1 / 2 / 8 / 0 / 2 | 3 / 4 / 5 / 0 / 5 | 3 / 3 / 6 / 0 / 4 |
| profile-07 | 10 | 1 / 1 / 6 / 0 / 4 | 3 / 3 / 7 / 0 / 3 | 3 / 3 / 5 / 0 / 5 | 2 / 2 / 6 / 0 / 4 |
| profile-08 | 10 | 0 / 0 / 7 / 0 / 2 | 1 / 1 / 9 / 0 / 1 | 1 / 1 / 8 / 0 / 2 | 0 / 0 / 9 / 0 / 1 |
| profile-09 | 10 | 0 / 1 / 8 / 0 / 2 | 3 / 3 / 7 / 0 / 3 | 3 / 4 / 6 / 0 / 4 | 1 / 2 / 8 / 0 / 2 |
| profile-10 | 10 | 1 / 1 / 5 / 0 / 3 | 0 / 0 / 10 / 0 / 0 | 1 / 1 / 7 / 0 / 3 | 1 / 1 / 7 / 0 / 3 |
| profile-11 | 10 | 4 / 6 / 3 / 1 / 6 | 2 / 5 / 8 / 0 / 2 | 5 / 7 / 4 / 1 / 6 | 5 / 7 / 4 / 1 / 6 |
| profile-12 | 10 | 1 / 1 / 7 / 0 / 3 | 1 / 1 / 9 / 0 / 1 | 2 / 2 / 6 / 0 / 4 | 1 / 1 / 7 / 0 / 3 |

Support counts are identical across B/C/D: **none 55, weak 55, supported 6, correction_backed 4**. Conflict grouping: **conflicting 0, superseded 4, normal/no-conflict 116** per arm. The four `superseded` cases are the correction-backed contexts retained by the frozen resolver; weak support does not by itself imply a resolver conflict.

Agreement matrix (per B/C/D): no recommendation **106**, baseline equals recommendation **0**, differs **10**, baseline unavailable **4**. Of the ten differing recommendations, higher authority prevents three from becoming Preference-caused changes; the remaining seven form the endpoint.

Detailed per-task/per-profile/support/conflict metrics, failure taxonomy, all eligible diagnostics and agreement matrices are retained in [comparison-summary.json](evidence/zdb-03b4-preference-screen/comparison-summary.json).

## Disposition

**INCONCLUSIVE_LOW_DELTA**.

All hard gates pass, but **7 < 10** Preference-caused changes. This pre-registered classification takes precedence over the observed +6 Net Benefit. The screen does not establish Preference superiority or real-user benefit.

## Evidence hashes

| Artifact | SHA-256 |
| --- | --- |
| [arm-b.jsonl](evidence/zdb-03b4-preference-screen/arm-b.jsonl) | `97c1949046ba055d688a1177cf2b241a9827abe312f838e62d87b4fb3071c0ed` |
| [arm-c.jsonl](evidence/zdb-03b4-preference-screen/arm-c.jsonl) | `ed16ecafd418b2d22429728e79b9353d00f0d3874ce6f8d49a7f4d37d2caaee9` |
| [arm-d.jsonl](evidence/zdb-03b4-preference-screen/arm-d.jsonl) | `321047c94e916c11e7341c99dc9c991c6d0232d544bcb69740d2da1f403426f5` |
| [comparison-summary.json](evidence/zdb-03b4-preference-screen/comparison-summary.json) | `f17de28fcf634ac85e81f229eca63b143f296cd713e7e08db650dacdae8921b2` |
| [hard-gates.json](evidence/zdb-03b4-preference-screen/hard-gates.json) | `d90de1c6f9efc86aabcc8ca21ea8fd0def30e2f0db35dd7ae23540fb46fd7580` |
| [primary-transitions.jsonl](evidence/zdb-03b4-preference-screen/primary-transitions.jsonl) | `af950aafecdf46d20176b21296820783b6ace1f444f72ac1802c6555b0195406` |
| [baseline-unavailable-outcomes.jsonl](evidence/zdb-03b4-preference-screen/baseline-unavailable-outcomes.jsonl) | `bb869c4e0b0b941c5260a66da07b7621980fb2c99fb6c0072941175ae5502607` |
| [SHA256SUMS.txt](evidence/zdb-03b4-preference-screen/SHA256SUMS.txt) | `08b818516cb73bfb58261808ad0208e2915aa466dea299b948f8de7167d9de9a` |

The generator executed twice independently in memory before exclusive evidence creation; both prediction bytes and all serialized artifact bytes matched. The committed files were then checked against a fresh deterministic recomputation. No randomness or current time enters prediction content. Exclusive directory reservation prevents repeat freezing or overwrite. The admitted candidate sources remain byte-identical after evidence observation.

## Validation

Environment: Linux x64, Node `v24.19.0`. Candidate research suite: **108/108 tests in 10 files**, including **9 B4 tests** and the unchanged ZDB-03A hypothesis suite. The 60-case ZDB-03A fixture remains **CONFORMANCE ONLY** and contributes no B4 signal evidence. The 120-case B2C corpus is the sole screen population.

Passed: B2C corpus validator; B3 evidence integrity checker without provider execution; all research regression/B4 tests; B4 evidence validator (8 artifacts); docs/governance; `git diff --check`. The unchanged hosted CI routing supplies source/merge-tree/governance and quality evidence; local research tests supply the research execution checks. No CI routing was changed. Final exact-head hosted CI is recorded in the PR handoff after the documentation head is committed.

```text
node research/zen-decision-bench/preference/signal/validate-signal-corpus.mjs
node research/zen-decision-bench/preference/signal/check-generative-evidence.mjs
npm test -- research/zen-decision-bench/tests
node research/zen-decision-bench/preference/signal/run-preference-screen.mjs
DOCS_DIFF_BASE=0fc3751de02a4acab07ff45dbd6523c8efa35a65 npm run test:docs
git diff --check
```

B4 dependencies exclude the DeepSeek adapter, B3 provider runner and HTTP helpers. The source/dependency test rejects credential access, network calls and provider imports. No provider credential was read, and no provider call occurred. The separate pre-existing B3 offline integrity checker uses its accepted contract path without executing a provider.

## Limitations and governance

- Synthetic **120-case screen**, including **55 cold-start** cases.
- Extremely weak frozen folder baseline: 0 exact / 72, 71 abstentions, 1 provider failure; no parser or baseline tuning.
- Four frozen provider failures limit available transition comparisons.
- No ≥300 superiority evidence, production qualification or real-user validation.
- No native/product/visual acceptance or production authority follows from these research results.

**ZDB-03B3 — COMPLETE / FROZEN.**

**ZDB-03B4 OWNER REVIEW PASSED — RESULT FROZEN / INCONCLUSIVE_LOW_DELTA.**

**>=300 comparative corpus remains NOT ACTIVE pending a separate Owner activation decision.**

**ZDB-04+ remain NOT ACTIVE.**

**PM-02 remains NOT ACTIVE.**

Owner review has passed. PR #310 remains unmerged pending freeze-closeout exact-head CI and merge qualification. The task worktree/branch remain retained until merge. Task-owned temporary validation outputs were removed at handoff; shared dependency caches are preserved.

**ZDB-03B4 OFFLINE PREFERENCE SIGNAL SCREEN — OWNER REVIEW PASSED / RESULT FROZEN**


## Owner freeze disposition

Owner independently reproduced the committed Arm A/B/C/D headline counts, the 116/4 baseline availability split, the 104-case primary transition population, all seven Preference-caused changed cases, and the frozen Arm-C endpoint: **6 beneficial / 0 harmful / 1 other / net +6**.

The pre-registered screen disposition remains **INCONCLUSIVE_LOW_DELTA** because only 7 Preference-caused changed decisions were observed, below the required minimum of 10. The positive raw net count is retained descriptively and is not promoted into a directional-signal or superiority claim.

Owner also rechecked the hard-gate evidence: Explicit User Truth 0 violations, safety 0 violations, cold-start 0 regressions, purpose/lifecycle Preference interventions 0, attribution 360/360, future-evidence leakage 0, construction leakage 0 known violations, and frozen research-file hash drift 0.

A reporting-only discrepancy was corrected before freeze: committed Arm evidence and `comparison-summary.json` contain **conflicting 0 / superseded 4 / normal-no-conflict 116** per B/C/D arm. No evidence, resolver/evaluator behavior, endpoint, hard gate or disposition changed.

Research-gate disposition for broader comparative work:
- Gate A / signal: **INCONCLUSIVE** under the pre-registered minimum-delta rule;
- Gate B / harm: no observed harmful Preference transition or cold/control regression;
- Gate C / authority safety: **PASS**;
- Gate D / ambiguity: no conflicting Preference cases were present in this signal corpus, so this screen does not establish conflict-resolution evidence;
- Gate E / attribution: **PASS**.

Accordingly, merge of PR #310 closes ZDB-03B4 only. It does **not** activate the Stage-B >=300 comparative corpus. Any broader comparative work requires a separate Owner activation decision.
