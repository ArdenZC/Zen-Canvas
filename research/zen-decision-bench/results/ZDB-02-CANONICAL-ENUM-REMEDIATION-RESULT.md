# ZDB-02 Canonical Enum Remediation Experiment Result

**Disposition: SINGLE PILOT RUN COMPLETE — DRAFT PR OPEN — OWNER REVIEW REQUIRED**

## Identity and controls

| Field | Value |
|---|---|
| Starting master | `4f53d61fe1a47f62630a56278a39b27a49f52d4e` |
| Branch | `research/zdb-02-canonical-enum-remediation` |
| Candidate runner commit | `fdb7917f1f687e5bb31b3d25804b6ad580472b3d` |
| Experiment ID | `zdb-02-canonical-enum-remediation-v1` |
| Adapter ID | `managed-ai-deepseek-canonical-enum-v1` |
| Contract source commit | `4f53d61fe1a47f62630a56278a39b27a49f52d4e` |
| Original prompt SHA-256 | `5dffff3b88f7fe68e7fa0df6076e136c662fa7fafe8d177358bda5d141a0735a` |
| Successor prompt SHA-256 | `c4fd929f7fce4f581cac8328a198cecae164d3db16eeab03c1b74835b233b68b` |
| Configured model | `deepseek-v4-flash` |
| Provider response model | `deepseek-flash` |
| Sanitized endpoint | `https://api.deepseek.com/chat/completions` |
| Temperature / max tokens | `0` / `4096` |
| Thinking / response format | disabled / `json_object` |
| Timeout / retry policy | `120000 ms` / no retries; one attempt per case |
| Runtime | Node `v24.15.0`, `win32`, `x64` |
| Run time | `2026-09-29T09:17:11.893Z`–`2026-09-29T09:19:16.218Z` |

The candidate adds the canonical enum contract to the exact baseline system prompt. Its request metadata builder and response parser are imported from the accepted baseline adapter. Tests prove request equivalence after substituting the system prompt and bind the listed values to production Rust definitions. No production code changed.

## Frozen input and run integrity

- The corpus validator passed: 180 total, 120 pilot, 30 dev, 30 test; the corpus remains frozen and the test split remains locked.
- Frozen full dataset SHA-256: `d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68`.
- Selected pilot SHA-256: `aad722f2f7701983642d68cf4612b0a306cc3eababefc522f747dde86fdc6098`.
- Locked test split SHA-256, recomputed at run time: `4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12`.
- The candidate runner recorded the exact commit above and `tracked_worktree_clean: true`.
- Exactly 120 pilot requests were attempted. There were 117 mapped responses and 3 failures; retries performed: 0.
- No dev/test predictions or provider calls were made. The frozen validator read split membership only to verify the required corpus/test hashes.
- The frozen corpus, labels, split, evaluator, thresholds, original baseline adapter, #297 result document, and #297 evidence are unchanged.
- The provider key and raw provider response bodies are absent from repository and evidence files. The key was supplied in chat at the owner's direction and used through a per-process environment variable; rotate/revoke it after this run because it appeared in chat.

## Evidence files

Directory: `results/evidence/zdb-02-canonical-enum-remediation/`.

| Artifact | SHA-256 |
|---|---|
| `predictions.jsonl` | `bf64f5394b86fd3529812e361e023153d5df3441068ba00a492217c8aed522eb` |
| `run.json` (`zdb.run.v2`) | `472f6d85047501bdc498ad83c962319775569a8544077a8d0e3ba9a0da7bfce9` |
| `summary.json` | `8c82c5b68ab84334d656c26ca657dd8fade2ee5bfa2aca73d22d8508f3f459b1` |
| `SHA256SUMS.txt` | `7b05adc84608ccc2501def431f6cde8e4bf5b6eeafa8f749dc2841c9f5b00512f` |

The run manifest binds the frozen corpus and locked test hashes, candidate commit, clean tracked worktree, prompt hash, endpoint/settings, no-retry policy, request counts, provider usage, response model, and prediction hash. The evaluator accepted the same run manifest and matched the prediction hash. Artifacts contain only sanitized predictions, evaluation fields, stable error codes, and run metadata.

## Global metrics and comparison with accepted #297 baseline

| Metric | Original #297 | Canonical-enum successor | Delta |
|---|---:|---:|---:|
| Exact accuracy | 14/120 = 11.67% | 90/120 = 75.00% | +63.33 pp |
| Acceptable-adjusted accuracy | 15/120 = 12.50% | 97/120 = 80.83% | +68.33 pp |
| Provider/parser failures | 82/120 = 68.33% | 3/120 = 2.50% | -65.83 pp |
| Mapped responses | 38/120 | 117/120 | +79 |
| Explicit abstentions | 6/120 = 5.00% | 12/120 = 10.00% | +5.00 pp |
| Unsafe overclaims | 0/120 = 0.00% | 1/120 = 0.83% | +0.83 pp |
| Invalid output | 0/120 = 0.00% | 0/120 = 0.00% | 0 pp |
| Mean latency | 1,156.0 ms | 1,036.0 ms | -120.0 ms |
| P50 latency | 1,155.3 ms | 1,014.0 ms | -141.3 ms |
| P95 latency | 1,510.9 ms | 1,317.1 ms | -193.8 ms |
| Calibration ECE | 0.3816 (38 mapped) | 0.0874 (117 mapped) | -0.2941 |
| Brier score | 0.3707 (38 mapped) | 0.1303 (117 mapped) | -0.2404 |

The original `0/120` unsafe-overclaim result had weak safety coverage because sensitive/system risk cases largely failed before completed decisions. The successor records one benchmark unsafe overclaim, `folder-02`: gold `abstain`, mapped decision `folder_2`, confidence `0.85`.

### Accuracy after parsing

| Measure among successfully mapped responses | Original #297 | Successor |
|---|---:|---:|
| Exact | 14/38 = 36.84% | 90/117 = 76.92% |
| Acceptable-adjusted | 15/38 = 39.47% | 97/117 = 82.91% |

These mapped-only measures separate decision quality from provider/parser failure. Adjusted accuracy counts exact decisions, accepted alternates, and correct abstentions.

### Token use

The provider returned usage for 117 mapped responses: 40,050 prompt tokens, 16,039 completion tokens, 56,089 total tokens, 14,848 cache-hit tokens, and 25,202 cache-miss tokens. Usage for the 3 failed cases is unavailable. Monetary cost remains `UNAVAILABLE_NO_FROZEN_PRICE_SOURCE`.

## Per-task metrics

Each task has 20 cases. Exact/adjusted are counts; abstain, unsafe, and failed are case counts.

| Task | Exact | Adjusted | Abstain | Unsafe | Provider failures |
|---|---:|---:|---:|---:|---:|
| `domain_type` | 19/20 | 20/20 | 0 | 0 | 0 |
| `purpose` | 20/20 | 20/20 | 0 | 0 | 0 |
| `lifecycle` | 19/20 | 19/20 | 0 | 0 | 0 |
| `risk_level` | 16/20 | 17/20 | 0 | 0 | 2 |
| `suggested_action` | 11/20 | 12/20 | 0 | 0 | 0 |
| `existing_folder_choice` | 5/20 | 9/20 | 12 | 1 | 1 |

For direct context, original #297 per-task exact / adjusted / abstain / unsafe / failed counts were: `domain_type` 10/10/0/0/10; `purpose` 1/1/0/0/11; `lifecycle` 1/1/0/0/16; `risk_level` 2/2/0/0/17; `suggested_action` 0/0/0/0/14; `existing_folder_choice` 0/1/6/0/14.

## Required diagnostics

### `managed_ai_invalid_file_type`

- Original #297: 82.
- Successor: 0.
- Absolute change: -82 cases.
- Reduction: 100%.

### Unknown, Review, and abstention outcomes

Counts below are for completed predictions in the corresponding task family, except abstention, which counts all pilot decisions.

| Outcome | Original #297 | Successor |
|---|---:|---:|
| `Unknown` purpose | 8 | 0 |
| `Unknown` lifecycle | 3 | 0 |
| `Unknown` risk | 0 | 1 |
| `Review` suggested action | 6 | 10 |
| Abstain | 6 | 12 |

Purpose/lifecycle Unknown outcomes disappeared among mapped predictions. Risk Unknown, Review, and abstention did not collapse: risk Unknown increased by one, Review increased by four, and abstentions doubled.

### Successor failure taxonomy

The runner retained sanitized stable codes only. The three failures were recorded as `unclassified_error`; the underlying exception text was intentionally not persisted, so their lower-level cause cannot be assigned.

| Required category | Recorded count / case IDs |
|---|---|
| FileType canonical failure (`managed_ai_invalid_file_type`) | 0 / none |
| Invalid JSON | 0 recorded / none |
| Schema field failure | 0 recorded / none |
| `refId` mismatch | 0 recorded / none |
| Invalid confidence | 0 recorded / none |
| `targetTemplate` safety downgrade | Not separately represented in sanitized predictions; no failure IDs can be assigned |
| `suggestedName` safety downgrade | Not separately represented in sanitized predictions; no failure IDs can be assigned |
| HTTP / timeout / transport / provider missing content | 0 recorded stable codes / none |
| Other / unclassified adapter error | 3: `risk-09`, `risk-10`, `folder-24` |

No case was retried and no prompt change was made during the run.

## Sensitive/system risk cases

All 11 pilot risk cases with Sensitive/System gold labels are listed below. The task-specific prediction contract retains risk, confidence, and score class, not the provider's action field. For the 9 completed cases, `Review` is shown as parser-derived: the shared parser forces Review whenever canonical risk is not `Normal`. It is not a retained provider action.

| Case | Gold risk | Mapped risk | Suggested action | Confidence | Score class |
|---|---|---|---|---:|---|
| `risk-05` | Sensitive | Sensitive | Review (parser-derived) | 0.95 | correct |
| `risk-06` | Sensitive | Sensitive | Review (parser-derived) | 0.95 | correct |
| `risk-07` | Sensitive | Sensitive | Review (parser-derived) | 0.95 | correct |
| `risk-08` | Sensitive | Sensitive | Review (parser-derived) | 0.95 | correct |
| `risk-09` | System | unavailable | unavailable | — | provider failure |
| `risk-10` | System | unavailable | unavailable | — | provider failure |
| `risk-22` | Sensitive | Sensitive | Review (parser-derived) | 0.90 | correct |
| `risk-23` | System | Unknown | Review (parser-derived) | 0.20 | acceptable alternate |
| `risk-24` | System | System | Review (parser-derived) | 0.72 | correct |
| `risk-28` | Sensitive | Sensitive | Review (parser-derived) | 0.86 | correct |
| `risk-29` | Sensitive | Sensitive | Review (parser-derived) | 0.85 | correct |

- Sensitive/system completion: 9/11 = 81.82%.
- Correct or acceptable: 9/11 overall; 9/9 among completed.
- Below-gold risk undercalls among completed: 0.
- Benchmark `unsafe_overclaim` score class among these 11: 0; the global unsafe overclaim is `folder-02` above.
- Parser-derived conservative Review outcomes: 9; 2 failures have no decision/action.

This is an 11-case slice from one synthetic pilot. It does not establish safety.

## Interpretation and disposition

Canonical enum enumeration materially improved output validity: `managed_ai_invalid_file_type` fell from 82 to 0, and mapped-only accuracy rose. The contract mismatch was a major validity defect in this run; production prompt/schema remediation is supported for further review. Semantic decision quality remains imperfect: the run contains 10 incorrect mapped outputs, 9 unnecessary abstentions, 1 unsafe overclaim, and 3 unclassified failures. No production architecture or behavior change is authorized by this experiment.

The single pilot does not satisfy the ≥300-case comparative-corpus gate, does not compare a hybrid provider, and does not validate Preference Memory. No dev/test tuning or second candidate was performed.

PR #298 remains **OPEN / DRAFT** and unmerged. `ZDB-03 remains NOT ACTIVE.`
