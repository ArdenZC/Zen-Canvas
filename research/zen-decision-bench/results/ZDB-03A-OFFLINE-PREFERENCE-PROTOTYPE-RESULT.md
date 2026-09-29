# ZDB-03A — Offline Preference Resolver and Conformance Fixture Result

Status: **CONFORMANCE-ONLY — OWNER RE-REVIEW PENDING**. The 60-case fixture is **NOT ELIGIBLE FOR ZDB-03B SIGNAL/EFFECTIVENESS EVIDENCE**. This is a synthetic conformance result, not an effectiveness or superiority result. It implements the frozen ZDB-03 hypothesis v1 from PR #299 for research only.

## Identity and boundaries

| Item | Value |
| --- | --- |
| Starting clean remote master | `dc3b3ff5e3df92608d9795f91bca144bb7fd2e8d` |
| Starting tree | `86651d291e03177f768bf72b6aa7ed0920c60fa0` |
| Branch | `research/zdb-03a-offline-preference-prototype` |
| Corpus-first commit | `f0bf0e774d342798f1736b71d84272fff9b8fe32` |
| Prototype identity | `zdb.preference_prediction.v1` / frozen ordinal hypothesis v1 |
| Candidate corpus canonical dataset SHA-256 | `76abcb22ac4b2aa2f0bc032839fe643a296d25f2f19b266ace16b3f76df1112a` |
| Candidate corpus file SHA-256 | `1f047dd3f1afacd8821103cb8091965bb27f68fe429589de42fea9241d83d0f3` |
| Frozen 180-case dataset canonical SHA-256 | `d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68` — unchanged |
| Locked test split canonical SHA-256 | `4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12` — unchanged |

The 60 cases are synthetic and non-sensitive. Counts: 36 `existing_folder_choice`, 18 `suggested_action`, 3 `purpose`, 3 `lifecycle`; 40 pilot, 20 dev, 0 test. Each of `cold_start`, `consistent_preference`, `single_correction`, `repeated_correction`, `scope_conflict`, `recency_conflict`, `equal_conflict`, `sparse_evidence`, `safety_conflict`, and `explicit_truth_conflict` has 6 cases (4 pilot, 2 dev). No frozen ZDB case or accepted #298 prediction was repurposed.

The corpus was built and structurally validated before the first full resolver execution. Its canonical and file hashes remained unchanged after that execution and through Owner Review remediation. No case, gold label, split, or support threshold was changed in response to a result. Owner Review identified family-coded gold-position structure: the builder shares a positional `preferred` choice between history and expected-output construction. The resolver's gold-isolation boundary passed; the fixture's construction limits its use to conformance.

After the first full run, a focused unit test exposed an attribution-only defect: a valid correction superseding a contradictory rejection left `conflict_state=none` instead of `superseded`. The derived conflict-state label was repaired and the full candidate run repeated. The correction did not change scope, sufficiency, final decisions, corpus labels, or thresholds.

Owner Review of PR #300 then found that equal counts of constrained scope dimensions do not prove refinement. The resolver now requires the correction scope to preserve every constraint in the referenced scope. Dedicated tests cover global-to-workspace, workspace-to-workspace-plus-purpose, equal scopes, both incomparable one-dimension directions, broader corrections, and evidence-order invariance. This repair changes only the authorized offline resolver and its tests; the 60-case JSONL remains byte-for-byte unchanged.

## Implemented hypothesis

The resolver receives a projection containing only case ID, task, choice IDs, target scope, and Preference Context, plus optional external baseline prediction. Benchmark gold, acceptable labels, split, score class, ambiguity, and expected decision are absent. No case ID selects behavior.

Scope applicability uses exact semantic equality for every constrained dimension. A global-user record is broad. Among applicable evidence, only the greatest count of matched non-global dimensions participates; weak narrower evidence does not fall back to broader evidence. Historical Preference Evidence must be strictly earlier than the target. Explicit truth and deterministic rules may be asserted at the target time.

At that winning scope specificity, a choice is sufficiently supported by one valid unsuperseded direct correction, two consistent explicit selections, or three consistent passive acceptances. These are ordinal research conditions, not calibrated confidence. A linked correction may supersede earlier evidence only when its scope equals or genuinely refines the prior scope: every constraining dimension in the prior must remain present with the same value. `global_user=true` is the broad root. Equal dimension counts with different constraints are incomparable and do not permit supersession. The referenced evidence remains in attribution. Rejection only blocks its own choice and never infers an alternative. Unlinked comparable contradiction causes Preference abstention; no decay or staleness cutoff was introduced. `stale_preference` remains a reserved, unused taxonomy class in v1.

The offline authority order is safety/system, current explicit user truth, deterministic user rule, sufficient scoped Preference, external canonical baseline, then abstain/review. Contradictory equal-authority safety or user rules fail closed as research errors. Arm B has no generative fallback. Arm C can use sufficient Preference before the external baseline. Arm D abstains on Preference versus baseline disagreement, agrees when they match, and may use supported Preference when the baseline is unavailable with explicit attribution. Arm D is not System One.

Each prediction includes decision source, categorical support and basis, considered/used/superseded evidence IDs, matched scope dimensions and specificity, latest correction, derived conflict state, and an abstention or failure reason. Preference confidence is not numeric.

## Local conformance evidence

Environment: Windows, Node.js `v24.15.0`, Vitest `v4.1.9`. Research tests: **56/56 PASS across 4 files** (24 ZDB-03A tests). The existing ZDB tests remain in the suite. Conformance fixture validation: **60/60 structurally valid**. Documentation and project governance validation use `DOCS_DIFF_BASE=dc3b3ff5e3df92608d9795f91bca144bb7fd2e8d`. Exact-head hosted CI is reported separately on PR #300.

| Offline mode, no external baseline | Fixture expected-choice matches | Expected abstentions | Decision coverage | Conflict Preference abstentions | Explicit truth violations | Safety violations | Attribution complete |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B | 43 | 17 | 43/60 | 6/6 | 0 | 0 | 60/60 |
| C | 43 | 17 | 43/60 | 6/6 | 0 | 0 | 60/60 |
| D | 43 | 17 | 43/60 | 6/6 | 0 | 0 | 60/60 |

These counts establish fixture/conformance behavior only. The labels are mechanically related to the generated history and cannot serve as independent signal truth. Cold start did not create Preference in tests; B abstained absent other authority, while C/D preserved a valid external baseline in isolated tests. Scope mismatch, weak narrow evidence, linked correction, equal conflict, rejection, safety priority, explicit-truth priority, and evidence-order invariance passed. Gate C is **0 explicit-truth and 0 safety violations** in each full fixture run; injected-violation tests confirm the evaluator reports hard-gate failure.

No real matching generative baseline exists for the new 60 case IDs. Baseline-dependent transition matrix, preference-induced correction/regression, cold-start regression versus a real baseline, and Preference Net Benefit are `NOT_EVALUATED_NO_REAL_BASELINE`. Synthetic unit tests exercise transition accounting, but are not effectiveness evidence. No provider was called. No real Generative-vs-Preference effectiveness comparison was performed. The offline runner makes no network request and needs no API key.

## Accepted use and limits

The 60 cases may test schema validity, chronology, cold start, scope resolution, correction and rejection semantics, authority precedence, conflict handling, attribution, evaluator accounting, and gold isolation. Owner re-review may accept them as a **conformance fixture only**.

They may **not** support claims that Preference improves accuracy or DeepSeek, Preference Net Benefit, Generative + Preference superiority, System One value, or production readiness. They must **not** become the ZDB-03B signal corpus. ZDB-03B remains a separate Owner-defined experiment requiring independently authored target metadata and historical preference evidence plus a legitimate same-case Generative baseline. No ZDB-03B corpus or baseline was created here. Numeric confidence/calibration and staleness modeling remain outside hypothesis v1. Product runtime, production database/schema, persistence, UI, and SemanticAssessmentV1 were not changed.

This PR does not prove Preference Memory improves the product, authorize production Preference Memory, or authorize ZDB-04. **ZDB-03 remains ACTIVE FOR RESEARCH ONLY. ZDB-04+ remain NOT ACTIVE. PM-02 remains NOT ACTIVE.**
