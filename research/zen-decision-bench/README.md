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

## Initial corpus and pilot expansion

`fixtures/initial-corpus.v1.jsonl` currently contains 180 synthetic cases:

- 30 cases for each of the six required task families;
- pilot minimum satisfied structurally: 20 pilot cases per task family;
- split counts: 120 pilot / 30 dev / 30 test;
- production canonical Purpose/Lifecycle/Risk/SuggestedAction choices;
- abstention allowed only on cases whose gold label is `abstain`.

The full 180-case corpus is **OWNER_ADJUDICATED AND FROZEN** for ZDB-02 baseline work. Frozen dataset hash: `d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68`. The 30-case test split is independently locked at `4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12` and must not be used for tuning. See `fixtures/initial-corpus.v1.manifest.json` and `fixtures/initial-corpus.v1.review.md`.

The live Generative adapter `adapters/managed-ai-deepseek.mjs` mirrors the current production
Managed AI metadata-only SemanticAssessmentV1 request contract:

- DeepSeek OpenAI-compatible default;
- `deepseek-v4-flash`;
- temperature 0;
- max output 4096 for the Managed worker request;
- JSON object response format;
- thinking disabled;
- default parent-path sharing with protected system paths omitted;
- no benchmark choices, gold labels, or candidate-folder list are sent to the model.

For `existing_folder_choice`, the provider still receives only production metadata. The evaluator
maps the returned `targetTemplate` to an existing-folder choice after the model call; unmatched
targets abstain.

Exploratory pilot-only live run:

```bash
DEEPSEEK_API_KEY=... node research/zen-decision-bench/cli/run-baseline.mjs \
  research/zen-decision-bench/fixtures/initial-corpus.v1.jsonl \
  research/zen-decision-bench/adapters/managed-ai-deepseek.mjs \
  .tmp-zdb/managed-ai-pilot.jsonl \
  --split pilot

node research/zen-decision-bench/cli/evaluate-predictions.mjs \
  research/zen-decision-bench/fixtures/initial-corpus.v1.jsonl \
  .tmp-zdb/managed-ai-pilot.jsonl \
  --split pilot
```

Do not use the locked test split for prompt, threshold, mapping, calibration, preference, or case-specific tuning. Provider runs must remain separately attributable and pilot-only until the ZDB-02 baseline review explicitly advances the research.

## Evidence threshold

Do not publish comparative claims from the smoke fixture.

Before a provider/hybrid superiority claim, follow the frozen Phase 1 contract:

- pilot >= 120 adjudicated finite-choice cases;
- >= 20 cases for each required task family;
- comparative corpus >= 300 adjudicated cases;
- frozen test split not used for prompt/threshold/preference tuning.

## Isolation

This harness must not be imported by product frontend/Tauri runtime/database/provider/index/mutation/release code.
