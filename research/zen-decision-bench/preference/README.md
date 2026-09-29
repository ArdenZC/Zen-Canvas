# ZDB Preference Memory Research

Status: **ZDB-03A DETERMINISTIC OFFLINE RESOLVER + CONFORMANCE FIXTURE — OWNER REVIEW PASSED — ACCEPTED FOR CONFORMANCE ONLY**

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

Owner Review passed at `6d83ecceb31a655a1c8fb3482f07f1eaa215a2c3` and accepted the fixture for conformance only. It may check schema, chronology, cold start, scope, correction, rejection, authority, conflict, attribution, evaluator accounting, and gold isolation. Its history and expected-choice construction share a positional template, so it cannot establish Preference accuracy, DeepSeek improvement, Net Benefit, Generative + Preference superiority, System One value, or production readiness. It must never become the ZDB-03B signal corpus; ZDB-03B remains a separate Owner-defined experiment.

Validate the candidate and run an offline arm from the repository root:

```text
node research/zen-decision-bench/cli/validate-preference-stage-a.mjs research/zen-decision-bench/fixtures/preference-stage-a.v1.jsonl research/zen-decision-bench/fixtures/preference-stage-a.v1.manifest.json
node research/zen-decision-bench/cli/run-preference-hypothesis.mjs research/zen-decision-bench/fixtures/preference-stage-a.v1.jsonl --arm B --out .tmp-zdb/predictions.jsonl --summary .tmp-zdb/summary.json
```

Arms C and D accept `--baseline` with a complete, same-case `zdb.prediction.v1` JSONL file. A matching hash-bound `--baseline-run` is required before baseline-dependent metrics are treated as external run evidence. Without one, those metrics remain `NOT_EVALUATED_NO_REAL_BASELINE`. No provider call or API key is part of this runner.


## ZDB-03B signal screen

**Owner Review passed for the definition. On merge, only ZDB-03B1 Profile + Target construction is active.**

The Owner-defined research slice is documented in:

`docs/project/tasks/ZDB-03B-PREFERENCE-SIGNAL-SCREEN-ACTIVATION.md`

ZDB-03B is deliberately separate from the Stage-A conformance fixture. Its anti-leakage design separates:

1. synthetic Profile Pack;
2. current Target Pack;
3. historical Preference Evidence pool;
4. Owner Adjudication.

A deterministic hash-based assignment joins profiles to targets. Historical evidence is assembled mechanically without target gold or provider output. A live same-case canonical Generative baseline is permitted only after all pre-run artifacts are frozen and Owner-reviewed.

The initial ZDB-03B screen contains 120 synthetic targets and is descriptive only. It does not satisfy the >=300 adjudicated comparative-corpus gate required before provider/hybrid superiority claims.

ZDB-03B1 may create only the Profile Pack and Target Pack. History, gold/adjudication, assembled signal corpus, and provider execution remain gated behind later Owner review.

### ZDB-03B1 candidate packs

Status: **CANDIDATE — OWNER REVIEW REQUIRED**. The [B1 result](../results/ZDB-03B1-PROFILE-TARGET-CONSTRUCTION-RESULT.md) records the two independent synthetic packs and their hashes. `signal/profiles.v1.jsonl` contains 12 soft tendency profiles; `signal/targets.v1.jsonl` contains 120 current-file situations without adjudicated answers. Their schemas and separate manifests are under `schema/` and `signal/`.

The profile and target builders are independent. Both use a shared, bounded `parent_family` vocabulary for exact resolver-compatible scope identity: each Profile tendency carries `scope_parent_family`, and each Target carries its authored scenario family in `scope_template.parent_family`. Human `context_tags` do not authorize matching. Purpose/lifecycle controls use dedicated non-matching families. Target file times are independently authored as ages relative to each target decision time. The Target Pack uses symbolic workspace modes; there is no profile-to-target assignment. Neither pack contains a History Pool or target Preference Context. The target controls carry current Explicit User Truth or deterministic safety Rules as separate authorities, not benchmark gold. Owner re-review and freeze of both candidate packs are required before B2 can start.

From the repository root, validate the committed candidate packs with:

```text
node research/zen-decision-bench/preference/signal/validate-packs.mjs
npm test -- research/zen-decision-bench/tests
```
