# ZenDecisionBench Phase 1 Contract

Status: **ZDB-01 / ZDB-02 COMPLETE — ZDB-03 OFFLINE RESEARCH ACTIVE**

Baseline: `master@68268edaec6a3c94c5e5098eec7c848a11338598`

Issue: [#283](https://github.com/ArdenZC/Zen-Canvas/issues/283)

This document is the concise benchmark contract. The activation taskbook owns sequencing and governance.

## Task families

| Task | Output shape | Example meaning |
| --- | --- | --- |
| `domain_type` | finite enum | document / code / media / archive / app-data / other |
| `purpose` | finite enum | work / study / personal / reference / temporary / unknown |
| `lifecycle` | finite enum | active / reference / stale-candidate / archive-candidate / unknown |
| `risk_level` | finite enum | normal / caution / high / unknown |
| `suggested_action` | finite enum | keep / rename / move / archive / review / cleanup-review / abstain |
| `existing_folder_choice` | one candidate ID or abstain | select among existing candidate folders only |

Novel naming, novel folder creation, prose explanation, and free-form reasoning are separate generative tasks and are not scored as System-One finite-choice decisions.

## Decision-case logical record

A v1 case contains:

- stable `case_id`
- `schema_version`
- `task`
- objective `input` facts
- optional `context`
- finite `choices`
- `gold`
- optional `acceptable`
- `abstain_allowed`
- optional `preference_context`
- `ambiguity`
- `provenance`
- `split`
- `tags`

The concrete machine-readable schema is a ZDB-01 deliverable.

## Required splits

- pilot
- dev
- test

Test is frozen before final ZDB-02 measurement and may not be used for prompt tuning or threshold fitting.

## Scoring classes

Every case result must resolve to exactly one primary class:

- correct
- acceptable_alternate
- correct_abstain
- unnecessary_abstain
- unsafe_overclaim
- incorrect
- invalid_output
- provider_failure

Aggregate reports may derive metrics from these classes but must retain the raw per-case classification.

## Baseline metrics

Required:

- exact accuracy
- acceptable-adjusted accuracy
- invalid-output rate
- abstention rate
- unsafe-overclaim rate
- provider-failure rate
- median latency
- p95 latency

When available/applicable:

- token/request usage
- cost
- confidence bucket accuracy
- ECE or Brier score

## Research isolation

No benchmark result is production authority.

No Phase 1 artifact may:

- mutate Zen files;
- write product databases;
- alter SemanticAssessmentV1;
- add a product runtime provider;
- create Preference Memory production persistence;
- activate PM-02.

## ZDB-03 Preference research authority

ZDB-03 is active for **offline research only** under [ZDB-03 Preference Memory Offline Hypothesis Activation](../../tasks/ZDB-03-PREFERENCE-MEMORY-OFFLINE-HYPOTHESIS-ACTIVATION.md).

Core invariant:

`Explicit User Truth != Preference != Rule`

Preference may not lower deterministic safety, override current Explicit User Truth, silently become a Rule, or rewrite objective file-type/risk truth.

Preference research inputs must be synthetic/non-sensitive, scoped, chronological, correction-aware, conflict-aware, and allowed to abstain.

The locked ZDB test split may not be used to construct or tune preference rules, recency weighting, conflict resolution, or confidence.

ZDB-04+ remain NOT ACTIVE.

## Evidence standard

Every published result must bind:

`dataset hash + runner commit + provider/model + prompt version + settings + timestamp + split + case count`

A result missing those bindings is exploratory output, not benchmark evidence.
