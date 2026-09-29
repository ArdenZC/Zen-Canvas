# ZDB-02 Generative Pilot Baseline Result

**Disposition: BASELINE RUN VALID — RESULT REVIEW REQUIRED**

## Identity

| Field | Evidence |
|---|---|
| Starting master | b60b4bfa95c105e2654ec73050196453680eebc7 |
| Execution branch | research/zdb-02-deepseek-pilot-baseline |
| Runner commit | b60b4bfa95c105e2654ec73050196453680eebc7 |
| Frozen full dataset SHA-256 | d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68 |
| Selected pilot SHA-256 | aad722f2f7701983642d68cf4612b0a306cc3eababefc522f747dde86fdc6098 |
| Locked test split SHA-256 | 4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12 |
| Run timestamp | 2026-09-29 08:00:23.273–08:02:42.002 UTC |
| Configured model | deepseek-v4-flash |
| Response model identifier | deepseek-flash |
| Sanitized endpoint | https://api.deepseek.com/chat/completions |
| Prompt template | managed-ai-semantic-assessment-v1 |
| Prompt template SHA-256 | 5dffff3b88f7fe68e7fa0df6076e136c662fa7fafe8d177358bda5d141a0735a |
| Runtime | Node v24.15.0; win32; x64 |

## Scope

**Pilot only — no dev/test execution**

The frozen corpus validator passed before provider execution: valid=true, 180 total cases, 120 pilot, 30 dev, and 30 test. The manifest was frozen, test-locked, pilot-first, required zdb.run.v2, prohibited test tuning, and specified retry_policy=none. Both frozen corpus hashes matched. The validator read the frozen split metadata to verify the locked test hash; no dev/test predictions or provider calls were made.

## Run integrity

- Tracked worktree was clean at run start.
- Corpus and freeze manifest were unchanged.
- The runner recorded commit b60b4bfa95c105e2654ec73050196453680eebc7.
- Exactly 120 pilot cases were attempted. Each case had one attempt; retries performed: 0.
- All 120 prediction IDs were known pilot IDs, with no duplicates, unknown IDs, or dev/test IDs.
- The evaluator accepted the same zdb.run.v2 manifest and matched the prediction hash.
- No credential-bearing endpoint or provider response body is stored in these artifacts.

| Artifact | Path | SHA-256 |
|---|---|---|
| Predictions | results/evidence/zdb-02-deepseek-pilot-baseline/predictions.jsonl | 9286634cde89eaa07c3ac7aa90e27c756007be0e36c8ff59841d3ab444f85540 |
| Run manifest, zdb.run.v2 | results/evidence/zdb-02-deepseek-pilot-baseline/run.json | c0daab433dc75a5e260212fd578ad00e6d10803ad21b8a65fc2db18e8b78a0fc |
| Evaluation summary | results/evidence/zdb-02-deepseek-pilot-baseline/summary.json | 6f7f4f03304c2fc50ef914dd7c75597dd5d7c7534f46b7490920050dee4d71b5 |

SHA256SUMS manifest: results/evidence/zdb-02-deepseek-pilot-baseline/SHA256SUMS.txt. It binds the generated result files; frozen inputs are bound by the canonical hashes above.

## Global metrics

The existing evaluator is authoritative for scored metrics.

| Metric | Result |
|---|---:|
| Pilot cases | 120 |
| Exact accuracy | 14/120 = 11.67% |
| Acceptable-adjusted accuracy | 15/120 = 12.50% |
| Explicit abstentions | 6/120 = 5.00% (1 correct, 5 unnecessary) |
| Unsafe-overclaim rate | 0/120 = 0.00% |
| Provider/adapter failure rate | 82/120 = 68.33% |
| Invalid output rate | 0/120 |
| Mean latency | 1,156.0 ms |
| P50 latency | 1,155.3 ms |
| P95 latency | 1,510.9 ms |

Calibration was available for 38 predictions with confidence values: ECE=0.3816 and Brier score=0.3707. The harness reports no confidence for provider failures.

## Per-task metrics

| Task family | Cases | Exact accuracy | Acceptable-adjusted | Abstentions | Unsafe overclaims | Provider failures |
|---|---:|---:|---:|---:|---:|---:|
| domain_type | 20 | 10/20 (50%) | 10/20 (50%) | 0/20 (0%) | 0/20 (0%) | 10 |
| purpose | 20 | 1/20 (5%) | 1/20 (5%) | 0/20 (0%) | 0/20 (0%) | 11 |
| lifecycle | 20 | 1/20 (5%) | 1/20 (5%) | 0/20 (0%) | 0/20 (0%) | 16 |
| risk_level | 20 | 2/20 (10%) | 2/20 (10%) | 0/20 (0%) | 0/20 (0%) | 17 |
| suggested_action | 20 | 0/20 (0%) | 0/20 (0%) | 0/20 (0%) | 0/20 (0%) | 14 |
| existing_folder_choice | 20 | 0/20 (0%) | 1/20 (5%) | 6/20 (30%) | 0/20 (0%) | 14 |

## Provider evidence

- Requests attempted: 120.
- Adapter-mapped successes: 38.
- Adapter failures: 82, all classified as managed_ai_invalid_file_type.
- No HTTP-status, timeout, transport, or invalid-JSON error codes were recorded.
- Actual response model identifier: deepseek-flash.
- Measured usage covers 38 returned prediction results: 7,192 prompt tokens; 4,821 completion tokens; 12,013 total tokens; 0 cache-hit tokens; 7,192 cache-miss tokens.
- The adapter does not return usage telemetry when canonicalization throws, so usage for the 82 failed cases is unavailable in this run manifest.
- Monetary cost: UNAVAILABLE_NO_FROZEN_PRICE_SOURCE.

## Bounded error analysis

### Provider file-type canonicalization failure — 82 cases

The adapter raised managed_ai_invalid_file_type when it could not resolve the returned fileType to a canonical value. These rows have no prediction decision. The sanitized artifacts retain the stable error code, not the provider response body, so the exact returned value cannot be diagnosed.

- domain_type (10): domain-01, domain-07, domain-08, domain-09, domain-10, domain-21, domain-22, domain-25, domain-26, domain-30
- purpose (11): purpose-03, purpose-04, purpose-07, purpose-08, purpose-09, purpose-10, purpose-21, purpose-22, purpose-27, purpose-28, purpose-30
- lifecycle (16): lifecycle-01, lifecycle-03, lifecycle-04, lifecycle-05, lifecycle-06, lifecycle-07, lifecycle-08, lifecycle-09, lifecycle-21, lifecycle-22, lifecycle-23, lifecycle-24, lifecycle-25, lifecycle-26, lifecycle-27, lifecycle-29
- risk_level (17): risk-01, risk-03, risk-05, risk-06, risk-07, risk-08, risk-09, risk-10, risk-21, risk-22, risk-23, risk-24, risk-25, risk-26, risk-28, risk-29, risk-30
- suggested_action (14): action-01, action-02, action-03, action-07, action-08, action-09, action-10, action-21, action-22, action-24, action-25, action-26, action-28, action-30
- existing_folder_choice (14): folder-01, folder-02, folder-04, folder-05, folder-06, folder-09, folder-10, folder-21, folder-22, folder-23, folder-24, folder-25, folder-28, folder-30

### Completed semantic mismatches — 18 cases

These are completed mapped decisions that differ from the frozen gold label. The observed result pairs are:

- purpose (8): purpose-01 unknown→teaching; purpose-05 unknown→work; purpose-06 unknown→work; purpose-23 unknown→study; purpose-24 unknown→work; purpose-25 unknown→personal; purpose-26 unknown→career; purpose-29 unknown→media.
- lifecycle (3): lifecycle-10 unknown→disposable; lifecycle-28 unknown→active; lifecycle-30 unknown→disposable.
- risk_level (1): risk-04 caution→normal.
- suggested_action (6): action-04 review→move; action-05 review→move_and_rename; action-06 review→move_and_rename; action-23 review→move_and_rename; action-27 review→keep; action-29 review→move_and_rename.

Gold appears after the arrow. No tuning or case changes were made.

### Conservative-coded outcomes — 22 cases

The final mapped decision was review, unknown, or abstain while differing from gold: purpose-01, purpose-05, purpose-06, lifecycle-10, action-04, action-05, action-06, folder-03, folder-07, folder-08, purpose-23, purpose-24, purpose-25, purpose-26, purpose-29, lifecycle-28, lifecycle-30, action-23, action-27, action-29, folder-26, folder-27.

This outcome-level group overlaps the semantic mismatches and unnecessary abstentions above. It does not establish whether the model selected the value or the adapter's safety canonicalization produced it; intermediate provider fields were not persisted.

### Existing-folder abstentions and target mapping — 6 cases

The completed folder-choice outputs abstained on folder-03, folder-07, folder-08, folder-26, folder-27, and folder-29. folder-29 was the correct abstention; the other five were unnecessary abstentions. The other 14 folder-choice cases failed with managed_ai_invalid_file_type. No completed folder target was selected. The retained prediction schema does not distinguish an absent targetTemplate from an unmatched targetTemplate, so a targetTemplate mismatch cause cannot be assigned.

### Material ambiguity and sensitive/system risk

All seven pilot cases marked material ambiguity failed with managed_ai_invalid_file_type: action-09, action-10, folder-02, risk-30, action-25, folder-28, folder-30. They provide no completed model decisions for ambiguity analysis.

Eleven pilot risk cases have sensitive or system gold labels: risk-05, risk-06, risk-07, risk-08, risk-09, risk-10, risk-22, risk-23, risk-24, risk-28, risk-29. All eleven failed with managed_ai_invalid_file_type. No completed sensitive/system prediction is available to assess safety behavior. The only completed risk mismatch was risk-04 (caution predicted; normal gold).

### Other requested categories

- HTTP, timeout, and transport failures: 0 recorded; no case IDs.
- Invalid JSON syntax: 0 recorded; no case IDs. The 82 failures occurred later, at fileType canonicalization.
- Filename/extension safety downgrades: not separately observable in the retained prediction contract; no cases can be attributed to this cause from the evidence.
- Unsafe overclaims: 0 cases.
- Error analysis is observational. No prompts, labels, thresholds, mappings, model settings, or split assignments were changed, and no failed case was rerun.

## Limitations

- This is one provider run.
- The corpus remains synthetic.
- The 120 pilot cases are not the required comparative corpus of at least 300 cases.
- No comparative DeepSeek-versus-hybrid result exists.
- This run alone authorizes no production architecture decision.
- This result alone does not authorize ZDB-03 Preference Memory activation.

## Disposition

**BASELINE RUN VALID — RESULT REVIEW REQUIRED**

**ZDB-03 remains NOT ACTIVE.**
