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

**Owner Review passed for the definition. ZDB-03B1 Profile + Target packs are now Owner-frozen; merge of PR #302 activates only ZDB-03B2 assignment + History + separate Owner Adjudication construction.**

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

### ZDB-03B1 frozen packs

Status: **OWNER REVIEW PASSED — FROZEN FOR ZDB-03B2 INPUT**. The [B1 result](../results/ZDB-03B1-PROFILE-TARGET-CONSTRUCTION-RESULT.md) records the two independent synthetic packs and their hashes. `signal/profiles.v1.jsonl` contains 12 soft tendency profiles; `signal/targets.v1.jsonl` contains 120 current-file situations without adjudicated answers. Their schemas and separate manifests are under `schema/` and `signal/`.

The profile and target builders are independent. Both use a shared, bounded `parent_family` vocabulary for exact resolver-compatible scope identity: each Profile tendency carries `scope_parent_family`, and each Target carries its authored scenario family in `scope_template.parent_family`. Human `context_tags` do not authorize matching. Purpose/lifecycle controls use dedicated non-matching families. Target file times are independently authored as ages relative to each target decision time. The Target Pack uses symbolic workspace modes; there is no profile-to-target assignment. Neither pack contains a History Pool or target Preference Context. The target controls carry current Explicit User Truth or deterministic safety Rules as separate authorities, not benchmark gold. Owner re-review passed at `020b2270464a2c6b7cf98c886d3f5293e2e41b65`. Both pack hashes are frozen; merge of PR #302 activates B2 assignment + History + separate Owner Adjudication construction only. Provider execution remains gated.

From the repository root, validate the committed candidate packs with:

```text
node research/zen-decision-bench/preference/signal/validate-packs.mjs
npm test -- research/zen-decision-bench/tests
```

### ZDB-03B2A pre-adjudication freeze

Status: **B2A COMPLETE — HISTORY HASH FROZEN / OWNER ADJUDICATION PENDING**; B2 overall remains **ACTIVE**. See the [Owner-safe structural result](../results/ZDB-03B2A-ASSIGNMENT-HISTORY-FREEZE-RESULT.md). Deterministic assignment contains exactly 120 cases / 10 per profile. The independent Profile-only History envelope contains exactly 288 episodes / 24 per profile. Separate manifests bind canonical and file SHA-256 values; structural validation passed. B1 JSONL inputs remain immutable.

**OWNER MUST COMPLETE BLIND ADJUDICATION BEFORE INSPECTING HISTORY CONTENT OR HISTORY GENERATOR SEMANTICS**, including History-related tests/validators. **HASH FROZEN — OWNER HAS NOT INSPECTED HISTORY CONTENT** is the recorded state; no History Owner-review PASS is claimed.

Run structural validation only:

```text
node research/zen-decision-bench/preference/signal/validate-b2a.mjs assignment
node research/zen-decision-bench/preference/signal/validate-b2a.mjs history
npm test -- research/zen-decision-bench/tests
```

The builders refuse to overwrite existing artifacts. No adjudication/gold, target Preference Context, target scope materialization, assembled signal corpus, resolver simulation, applicability analysis or provider call is part of B2A. ZDB-03B3/B4, >=300 comparative work, ZDB-04+ and PM-02 remain **NOT ACTIVE**.


## ZDB-03B2C cold-start clarification

Before any provider execution, mechanical assembly exposed an execution-assumption error: the frozen screen produces **55 cold-start and 65 non-cold contexts**, not 24/96. The additional 31 cold starts are primary folder targets where History matches task/scope but its frozen decision is not representable in the target's finite choices. No source artifact is changed to eliminate these cases.

The authoritative clarification is:

`docs/project/tasks/ZDB-03B2C-COLD-START-STRUCTURAL-CLARIFICATION.md`

B2C must reproduce the frozen 55/65 coverage exactly. Low Preference exposure may legitimately lead to `INCONCLUSIVE_LOW_DELTA`; it must not be tuned away.

### ZDB-03B2C frozen mechanical corpus

B1 is **COMPLETE / FROZEN**; B2A is **COMPLETE / MERGED through PR #303 / ASSIGNMENT + HISTORY FROZEN**; B2B is **COMPLETE / MERGED through PR #304 / OWNER BLIND ADJUDICATION FROZEN**. The earlier pre-adjudication state above is historical; the Owner froze adjudication while History was unseen before assembly resumed.

[Mechanical assembly result](../results/ZDB-03B2C-SIGNAL-CORPUS-ASSEMBLY-RESULT.md): **OWNER CORPUS FREEZE PASSED — FROZEN FOR ZDB-03B3 INPUT**. `signal/signal-corpus.v1.jsonl` and its separate manifest join all five immutable inputs under the existing case/Preference Context contracts. PR #305 corrected only the earlier 24/96 execution expectation. **55/65 coverage is the Owner-frozen mechanical truth and must not be tuned.** Taxonomy is 12/12/31/0; missing correction references are 0.

Validate only:

```text
node research/zen-decision-bench/preference/signal/validate-signal-corpus.mjs
npm test -- research/zen-decision-bench/tests --exclude **/preference-hypothesis.test.mjs
```

The assembler refuses to overwrite existing output. No provider, B2C resolver/Arm execution or effectiveness result exists. This structural projection check does not substitute for B3's provider-request proof. Corpus content head `f1aa255d17f7b6f4749631096332549a5b7fd58b`, canonical SHA-256 `0a96faa752b488f9c507ee2d0ca64e439820f85697872a64a5972c2840693349`, file SHA-256 `e10cd216a0f6692511ec0049dccf37b51f306bd39625b858efcbac35ebac3c8a`, and Git blob `0e483df2063acbc07ee599e3caa379f4a6f404bf` are frozen. Merge of PR #306 plus merge-after CI activates only B3 same-case canonical Generative baseline. B4, >=300 comparative work, ZDB-04+ and PM-02 remain **NOT ACTIVE**.


## ZDB-03B3 frozen same-case Generative baseline

PR #309 records one immutable 120-case same-case canonical Generative baseline over the Owner-frozen ZDB-03B corpus.

Status: **OWNER REVIEW PASSED — BASELINE FROZEN**.

- candidate runner: `9b98d48964cd1172dbd9cdd27590eaf2bf28b8d2`
- pre-provider CI: `36696028168 — SUCCESS`
- immutable evidence commit: `dc54001280e1bccc46fc7b64bef45ac69527dcc1`
- reviewed evidence head: `876ec6f93d88a1a8d9a768b82acba181309c98f4`
- final reviewed exact-head CI: `36697609492 — SUCCESS`
- attempted/succeeded/failed: `120 / 116 / 4`
- exact/adjusted: `17 / 23`
- retries: `0`
- Preference Arm executions: `0`

The accepted canonical-enum adapter, parser, evaluator, frozen signal corpus and all five source artifacts remain unchanged. Provider requests were independently verified to exclude Preference Context, History, Truth/Rules, Profile/Assignment, gold/acceptable/abstain and finite benchmark choices.

The weak folder-choice baseline is frozen as observed and must not be tuned post hoc.

Merge of PR #309 plus successful merge-after CI activates only **ZDB-03B4 offline Preference comparison**. The >=300 comparative corpus, ZDB-04+ and PM-02 remain **NOT ACTIVE**.
