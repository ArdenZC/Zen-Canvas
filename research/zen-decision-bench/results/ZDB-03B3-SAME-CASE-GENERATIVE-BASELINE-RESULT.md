# ZDB-03B3 — Same-Case Canonical Generative Baseline

Status: **ZDB-03B3 SAME-CASE GENERATIVE BASELINE COMPLETE — READY FOR OWNER REVIEW**.

Issue [#283](https://github.com/ArdenZC/Zen-Canvas/issues/283); frozen corpus [PR #306](https://github.com/ArdenZC/Zen-Canvas/pull/306); B3 [Draft PR #309](https://github.com/ArdenZC/Zen-Canvas/pull/309). This is research-only, one immutable 120-case synthetic pilot baseline. Owner review and merge remain pending. No Preference Arm, B4, >=300 comparative corpus, ZDB-04+ or PM-02 is active.

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

The live/evaluation commands above completed once after candidate CI. Credentials were supplied only to the process environment under the latest explicit Owner authorization. Presence/nonempty was checked; no fresh/unexposed credential claim is made. No value was stored in evidence or documentation.

Resume preflight: validator syntax and saved-corpus validation passed at exact master `849e1f2deb2defb1f011751158962de7201960f8`; five frozen source identities, corpus identity and 55/65 counts passed. The B3 focused suite passed 5/5. The broader structural suite (`npm test -- research/zen-decision-bench --exclude '**/preference-hypothesis.test.mjs'`) reported 49 passed tests, 5 passed files and 3 failed files. One failure is a confirmed committed syntax defect: `tests/preference-signal-b2c.test.mjs:113` still has literal `\n` tokens in the Owner-freeze assertions; standalone `node --check` fails and `git show HEAD:...` confirms it is in the accepted source. The other two failures occur on Windows CRLF imports of older shebang scripts, a previously documented local tooling issue; no workaround or source repair was applied in this resume.

That resume stopped without repairing B2C tests, creating a candidate commit/CI/PR, or issuing provider calls. [PR #308](https://github.com/ArdenZC/Zen-Canvas/pull/308) subsequently repaired only the two accidental literal newline tokens in that test. Its merge master is `3fd3e9afcdc9835dc7171d1f57d1c7542d79191b`; merge-after CI [36681266215](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36681266215) passed. Both defects originated in PR #306 freeze-closeout wording edits. Neither changed corpus, five frozen inputs, adapter, prompt, resolver, thresholds or adjudication. Both blocked attempts made zero provider requests.

Existing B3 work was preserved through named stash `zdb-03b3-preserve-before-hotfix-308`, fast-forward to the exact new master, and stash apply. All eight restored task-file byte hashes matched the saved inventory before further B3 edits. The preservation snapshot and stash remain task-owned recovery evidence. Both syntax gates, saved-corpus validation, five frozen identities and regenerated request projection passed. B3 focused tests passed 5/5; broader research structural tests passed 75/75 in 8 files, excluding the prohibited Preference-hypothesis suite. Four existing shebang scripts received temporary Windows CRLF-to-LF import handling and were restored byte-for-byte afterward; this creates no committed source change. No B2C hotfix appears in the B3 diff.

The unchanged evaluator owns scoring and calibration. B3 derived groups are descriptive global/per-task/cold/non-cold/control baseline summaries, with no resolver or Preference transitions. Exact accuracy excludes correct abstentions; adjusted accuracy includes accepted alternates and correct abstentions. No provider/hybrid superiority, production qualification, or safety acceptance is inferred from this synthetic screen.

## Candidate and live execution

Candidate runner commit: `9b98d48964cd1172dbd9cdd27590eaf2bf28b8d2`; tree `7db55a847cfe6a45508c1f8596f4cc2cb3e2993e`. Candidate exact-head hosted CI [36696028168](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36696028168): **SUCCESS before provider spend**. The full worktree was clean at admission. Environment: Node `v24.15.0`, `win32`, `x64`. Hosted CI used existing routing; local research contract/structural tests above supply research execution evidence. No CI-routing change was made.

Live run: `2026-09-30T09:29:08.254Z` to `2026-09-30T09:32:20.809Z` (17:29–17:32 Asia/Shanghai). Attempted **120**, succeeded **116**, failed **4**. All four failures are `managed_ai_missing_field`; variable field details and raw responses were discarded. Frozen order, one attempt per case, no sampling, retries or selective reruns. The credential was removed from the process environment after execution. The runner/configuration/prompt/parser/corpus/projection remained unchanged from the first request through completion.

Configured model `deepseek-v4-flash`; actual returned model ID **`deepseek-flash`** on the 116 successfully parsed responses. Parser failures do not expose adapter telemetry, so response IDs/token usage for those four cases are unavailable. Provider-measured usage: prompt **40,357**, completion **18,944**, total **59,301**; prompt cache hit **14,848**, miss **25,509**. These are measured totals for 116 cases, not invented estimates for all 120. Monetary cost: **UNAVAILABLE_NO_FROZEN_PRICE_SOURCE**.

## Baseline results

Global exact **17/120 (14.17%)**, adjusted **23/120 (19.17%)**. Counts: 17 correct, 3 acceptable alternate, 3 correct abstain, 68 unnecessary abstain, 1 unsafe overclaim, 24 incorrect, 0 invalid output, 4 provider failures. Abstention **71/120 (59.17%)**; unsafe overclaim **1/120 (0.83%)**; provider failure **4/120 (3.33%)**.

Latency across all 120 attempts: mean **1601.701 ms**, P50 **1616.313 ms**, P95 **1825.758 ms**. Existing evaluator calibration over 116 confidence-bearing rows: ECE **0.4626724137931032**, Brier **0.38848706896551727**; bucket details are preserved in [summary](evidence/zdb-03b3-same-case-generative/summary.json).

| Task | N | Exact count / rate | Adjusted count / rate | Abstain count / rate | Unsafe count / rate | Provider failures |
| --- | ---: | --- | --- | --- | --- | ---: |
| existing_folder_choice | 72 | 0 / 0.00% | 3 / 4.17% | 71 / 98.61% | 0 / 0.00% | 1 |
| suggested_action | 36 | 12 / 33.33% | 14 / 38.89% | 0 / 0.00% | 0 / 0.00% | 3 |
| purpose | 6 | 3 / 50.00% | 4 / 66.67% | 0 / 0.00% | 1 / 16.67% | 0 |
| lifecycle | 6 | 2 / 33.33% | 2 / 33.33% | 0 / 0.00% | 0 / 0.00% | 0 |

| Descriptive segment | N | Exact count / rate | Adjusted count / rate | Abstain | Unsafe | Failures |
| --- | ---: | --- | --- | ---: | ---: | ---: |
| Cold-start | 55 | 8 / 14.55% | 11 / 20.00% | 38 | 1 | 1 |
| Non-cold | 65 | 9 / 13.85% | 12 / 18.46% | 33 | 0 | 3 |
| Explicit User Truth control | 6 | 1 / 16.67% | 1 / 16.67% | 3 | 0 | 0 |
| Safety control | 6 | 2 / 33.33% | 2 / 33.33% | 0 | 0 | 0 |
| Purpose/lifecycle non-intervention | 12 | 5 / 41.67% | 6 / 50.00% | 0 | 1 | 0 |

All group rates, failure counts, latency and calibration are preserved in [baseline segments](evidence/zdb-03b3-same-case-generative/baseline-segments.json). Cold/non-cold is a descriptive corpus partition; provider requests contained neither Preference Context nor the partition label. Truth and safety were not applied as overrides. No difference here is a Preference effect.

Folder mapping diagnostic: **0 mapped finite-folder decisions**, **71 abstentions**, **1 provider failure**; 0 exact, 0 acceptable alternate, 3 correct abstain, 68 unnecessary abstain, 0 wrong mapped-folder decisions. The unchanged parser uses relative `targetTemplate` against frozen choice labels only after the response. Raw templates were not retained; this evidence cannot distinguish unmatched templates from other parser abstention paths. No examples, synonyms, hints, choice-order changes or parser tuning were introduced.

## Frozen evidence and lineage

| Source | Canonical SHA-256 |
| --- | --- |
| Profile | `371519fe7c9f28d3c686e0299c223d64a57b00571777cab498668667498137b1` |
| Target | `96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4` |
| Assignment | `4833443e85bf2a69c74b175b8e618a98eebab6444f1da05418fbf926582d6a0b` |
| History | `c2be8a2949c0daef12fe821010b72ca84ef999deb941a6f8bd0505dc8a7e2f44` |
| Owner adjudication | `498a511c4cfba87daaed7db5197c35aed96de34862feede43c500d9eb5d3ad50` |

All five canonical/file hashes, Owner-frozen manifest status and corpus Git blob are bound in [run evidence](evidence/zdb-03b3-same-case-generative/run.json). They were revalidated before spend and after execution and remained unchanged. The unchanged evaluator verifies corpus/selected hash, pilot selection, prediction hash and runner commit. Evidence integrity checks recompute scores, group summaries, order, sanitized schema, failure taxonomy and checksums without provider calls.

| Artifact | File SHA-256 |
| --- | --- |
| request-projection.v1.jsonl | `5a1d48f4e13fbbf7f4e4537e2c32a86139be2876105f5ae74f9cb0b3d436d7f0` |
| request-projection.v1.manifest.json | `ce29cb8d3777594005f00dc5605151df0187e752b791ba974604e14efbbcee7a` |
| predictions.jsonl | `de5c1b87b5ac255d45f17500f0e560ccc2eaeca0f60ebf3defc0437694e2e617` |
| run.json | `bb30f28718d32f4c3243f281c49b8334f0bf4dbcbbad2b24d847dc8881cf6b43` |
| summary.json | `54ad22c8e07a8a4f6e1c2a128ee39a13bbeae74c647d480f3a8b69b619bebc55` |
| baseline-segments.json | `a270e606fd958dc8505ee0eaaa9dbb2bdb3c07299e49fa3bed7cbcd5a96501c7` |
| SHA256SUMS.txt | `14e6502409ef37f35a88e4877a8d4ecb2482ba35abeb8525f8e7b98437e6af61` |
| Scoped .gitattributes | `46262f3dc2c2c18905cc9802f30eababf7523fa26b9b5e1712828e735d7fb6c4` |

[SHA256SUMS](evidence/zdb-03b3-same-case-generative/SHA256SUMS.txt) freezes those six artifacts. Scoped evidence attributes preserve LF checkout bytes for hash reproducibility. The final evidence commit and review-head CI are recorded in the closeout below and PR handoff; pre-provider candidate CI is a distinct gate.

Credential/privacy review: saved predictions contain only the six declared fields; no raw body, completion, reason or headers are retained. Changed evidence was scanned for credential tokens and credential-bearing material. Request isolation passed for all 120; no request contained Preference or benchmark-answer metadata. **No credential or raw provider response leaked into changed files, evidence or PR text.**

**ZDB-03B3 remains OWNER REVIEW PENDING.**

**ZDB-03B4 remains NOT ACTIVE.**

**>=300 comparative corpus remains NOT ACTIVE.**

**ZDB-04+ remain NOT ACTIVE.**

**PM-02 remains NOT ACTIVE.**

This is one synthetic baseline, with a weak folder-choice result, four parser failures and one scored unsafe overclaim. It establishes neither Preference benefit nor production/native/safety qualification. Owner review remains the acceptance gate. No production authority, schema, runtime, adapter, parser or evaluator changed; no merge was performed.

## Closeout identity and verification

Final immutable evidence HEAD: `dc54001280e1bccc46fc7b64bef45ac69527dcc1`; tree `42abe867fa221140993fb6be31dd9de25f2e08ba`. This commit freezes predictions/run/summary/segments/checksums after the single live run; a subsequent documentation commit records these identities without changing the evidence or runner. Final review HEAD and its exact-head CI run/conclusion are recorded in the [Draft PR #309 handoff](https://github.com/ArdenZC/Zen-Canvas/pull/309), separate from pre-provider CI 36696028168.

Passed: both repaired syntax gates, saved-corpus validator, five frozen source canonical/file hashes, corpus blob, request projection regeneration and mutation isolation, B3 5/5 tests, broader structural suite 75/75, unchanged evaluator, full evidence integrity checker, changed-document/governance checks and `git diff --check`. Frozen sources and accepted adapter/parser/evaluator have no B3 diff. No visual/native/product acceptance applies to this research-only execution.

The worktree and shared dependency junction are intentionally retained for Draft/Owner review. The named preservation stash plus exact status/diff/hash snapshot are retained as requested recovery evidence. The ignored durable live-attempt marker is retained to forbid an accidental second run. Only task-owned disposable evaluator/integrity output and temporary PR-body files are removed at handoff; no shared caches or unrelated work are removed. Remaining gate: Owner review and merge decision. B3 evidence is complete; no downstream track is activated.
