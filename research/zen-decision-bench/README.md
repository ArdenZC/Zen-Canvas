# ZenDecisionBench

Research-only benchmark harness for issue #283.

**No file in this directory is production semantic authority.**

## Current scope

Only ZDB-01 / ZDB-02 are active:

- versioned finite-choice case/prediction contracts;
- deterministic validation/evaluation;
- smoke fixture and reproducibility runner;
- later generative baseline evidence.

ZDB-03 Preference Memory modeling and provider comparison are not active yet.

## Smoke commands

```bash
node research/zen-decision-bench/cli/validate-dataset.mjs research/zen-decision-bench/fixtures/smoke.v1.jsonl

node research/zen-decision-bench/cli/run-baseline.mjs \
  research/zen-decision-bench/fixtures/smoke.v1.jsonl \
  research/zen-decision-bench/adapters/smoke-fixture.mjs \
  .tmp-zdb/smoke-predictions.jsonl

node research/zen-decision-bench/cli/evaluate-predictions.mjs \
  research/zen-decision-bench/fixtures/smoke.v1.jsonl \
  .tmp-zdb/smoke-predictions.jsonl

npx vitest run research/zen-decision-bench/tests
```

The smoke adapter is case-ID keyed and exists only to prove the harness. Its score is **not benchmark evidence**.

## Evidence threshold

Do not publish comparative claims from the smoke fixture.

Before a provider/hybrid superiority claim, follow the frozen Phase 1 contract:

- pilot >= 120 adjudicated finite-choice cases;
- >= 20 cases for each required task family;
- comparative corpus >= 300 adjudicated cases;
- frozen test split not used for prompt/threshold/preference tuning.

## Isolation

This harness must not be imported by product frontend/Tauri runtime/database/provider/index/mutation/release code.
