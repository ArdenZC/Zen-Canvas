# ZDB Preference Memory Research

Status: **ZDB-03A DETERMINISTIC OFFLINE RESOLVER + CONFORMANCE FIXTURE — OWNER RE-REVIEW PENDING**

This directory contains a deterministic offline prototype of the Owner-frozen ZDB-03 hypothesis. It is not product code or an effectiveness experiment. The 60-case fixture is **CONFORMANCE-ONLY — NOT ELIGIBLE FOR ZDB-03B SIGNAL/EFFECTIVENESS EVIDENCE**.

Core invariant:

\`Explicit User Truth != Preference != Rule\`

Preference Evidence and Preference Context are separate schemas. A Context keeps Explicit User Truth, deterministic Rules, and Preference Evidence in separate fields; derived conflict/recommendation state is not supplied as input.

Preference evidence is:

- synthetic/non-sensitive in Phase 1;
- scoped;
- chronological;
- revisable;
- conflict-aware;
- allowed to abstain.

Preference evidence is not production authority.

## First target

The first implementation slice should focus on:

1. \`existing_folder_choice\`;
2. \`suggested_action\`.

Objective/safety-dominant decisions are controls, not targets for preference override.

## Forbidden

Do not add here:

- production persistence;
- real user history;
- product telemetry;
- connected-account data;
- hidden personalization;
- product runtime imports;
- frozen-test-derived preference rules.

See \`docs/project/tasks/ZDB-03-PREFERENCE-MEMORY-OFFLINE-HYPOTHESIS-ACTIVATION.md\` for the authoritative contract.

## Stage-A conformance

The synthetic 60-case conformance fixture is in `../fixtures/preference-stage-a.v1.jsonl`; its manifest and SHA-256 are next to it. The source generator is `build-stage-a.mjs`. The JSONL was committed and hashed before its first full resolver run and remained byte-for-byte unchanged through Owner Review remediation. Do not regenerate, shuffle, or relabel it. See `../results/ZDB-03A-OFFLINE-PREFERENCE-PROTOTYPE-RESULT.md` for the bounded result.

The fixture may check schema, chronology, cold start, scope, correction, rejection, authority, conflict, attribution, evaluator accounting, and gold isolation. Its history and expected-choice construction share a positional template, so it cannot establish Preference accuracy, DeepSeek improvement, Net Benefit, Generative + Preference superiority, System One value, or production readiness. It must not become the ZDB-03B signal corpus. Owner re-review may accept it for conformance only; ZDB-03B remains a separate Owner-defined experiment.

Validate the candidate and run an offline arm from the repository root:

```text
node research/zen-decision-bench/cli/validate-preference-stage-a.mjs research/zen-decision-bench/fixtures/preference-stage-a.v1.jsonl research/zen-decision-bench/fixtures/preference-stage-a.v1.manifest.json
node research/zen-decision-bench/cli/run-preference-hypothesis.mjs research/zen-decision-bench/fixtures/preference-stage-a.v1.jsonl --arm B --out .tmp-zdb/predictions.jsonl --summary .tmp-zdb/summary.json
```

Arms C and D accept `--baseline` with a complete, same-case `zdb.prediction.v1` JSONL file. A matching hash-bound `--baseline-run` is required before baseline-dependent metrics are treated as external run evidence. Without one, those metrics remain `NOT_EVALUATED_NO_REAL_BASELINE`. No provider call or API key is part of this runner.
