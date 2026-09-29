# ZenDecisionBench Phase 1 — Research Activation

Last verified: 2026-09-29

Status: **RESEARCH ACTIVATION — SPECIFICATION ONLY**

Issue: [#283 — ZenDecisionBench Phase 1 — Offline Baseline + Preference Memory Research](https://github.com/ArdenZC/Zen-Canvas/issues/283)

Activation baseline: `master@68268edaec6a3c94c5e5098eec7c848a11338598`

This taskbook activates the research-only lane authorized by the Post-Pre-PM Sequencing Review. It is not a product initiative, does not activate PM-02, and grants no production semantic, persistence, provider, mutation, or release authority.

## 1. Research objective

Phase 1 answers one bounded question:

> Can a reproducible finite-choice benchmark show that preference-aware or System-One-style inference materially improves Zen's typed semantic decisions over the current generative baseline without weakening calibration, safety, cost, latency, or zero-burden behavior?

Phase 1 does **not** decide production architecture.

## 2. Authorized sequence

Phase 1 is executed in this order:

1. **ZDB-01 — Dataset / Task Contract**
2. **ZDB-02 — Generative Baseline**
3. **ZDB-03 — Preference Memory Offline Hypothesis**
4. **ZDB-04 — Provider Comparison**
5. **ZDB-05 — Calibration / Robustness**
6. **ZDB-06 — Zen-specific Laya experiment only if justified**
7. **ZDB-07 — Final Hybrid Comparison**

The original activation authorized ZDB-01 and ZDB-02 first. That historical gate is now satisfied: ZDB-01 is COMPLETE/FROZEN and ZDB-02 baseline plus canonical-enum remediation evidence is COMPLETE/ACCEPTED after Owner Review.

ZDB-03 is now separately activated for **OFFLINE RESEARCH ONLY** by [ZDB-03 Preference Memory Offline Hypothesis Activation](ZDB-03-PREFERENCE-MEMORY-OFFLINE-HYPOTHESIS-ACTIVATION.md).

ZDB-04+ remain planned / NOT ACTIVE.

## 3. Allowed repository surfaces

Research work may live under:

- `research/zen-decision-bench/`
- `benchmarks/zen-decision-bench/`
- `experiments/zen-decision-bench/`
- bounded offline scripts/tools used only by the benchmark
- `docs/project/research/zen-decision-bench/`

The implementation must not introduce imports from those surfaces into production frontend, Tauri runtime, database, provider, indexing, mutation, installer, or release paths.

## 4. Production boundaries

This research may not modify or supersede:

- `SemanticAssessmentV1` production authority
- Managed Scope / provider / Cleanup consent
- Organization Plan
- Operation Preview
- Cleanup Finding / current-assessment predicate
- Safe Trash
- journal
- Restore
- Global Index Service responsibility
- production database schema
- product onboarding/readiness behavior
- release/package authority

No runtime dependency, feature flag, database table, background worker, model service, provider SDK, or user-facing setting may be added to production by #283.

## 5. ZDB-01 acceptance gate

ZDB-01 must deliver a versioned, machine-readable decision-case contract and a deterministic validator/evaluator.

The finite-choice benchmark must cover at least:

- domain / file type
- purpose
- lifecycle
- risk level
- suggested action
- existing-folder choice

Each case must distinguish:

- objective fixture facts
- optional contextual facts
- finite candidate choices
- gold/acceptable labels
- ambiguity
- whether abstention is acceptable
- confidence target where defined
- preference context, if any
- provenance and split metadata

Open-ended tasks such as novel naming, novel folder creation, prose explanation, and free-form reasoning remain outside finite-choice System-One scoring. They may be tracked as separate generative tasks.

### Dataset minimums

Before any comparative claim:

- pilot corpus: at least 120 adjudicated finite-choice cases;
- at least 20 cases per required task family;
- comparative corpus: at least 300 adjudicated cases before a provider/hybrid superiority claim;
- test cases must not be used for prompt tuning, threshold fitting, or preference-rule construction.

A smaller smoke fixture is allowed for CI/reproducibility, but must never be presented as benchmark evidence.

## 6. Dataset provenance and privacy

Phase 1 fixtures must be:

- synthetic;
- generated from non-sensitive repository test fixtures; or
- manually authored without importing private user filesystem data.

Do not ingest user home-directory listings, filenames from personal files, credentials, content excerpts, connected account data, or existing product telemetry.

Every benchmark case must record provenance category.

## 7. Label contract

A case may specify:

- one canonical gold label;
- a bounded set of acceptable labels where the task is inherently ambiguous;
- `abstain_allowed=true` where insufficient evidence is the safe answer.

Evaluator behavior:

- canonical gold -> correct;
- acceptable alternate -> acceptable/correct-for-scoring, separately counted;
- unsafe overclaim where abstention was expected -> safety miss;
- answer outside candidate set -> invalid output;
- missing output -> abstention only if explicitly represented.

The benchmark must not force false certainty.

## 8. Split and leakage rules

At minimum maintain:

- `pilot`
- `dev`
- `test`

Provider prompt changes, threshold fitting, confidence calibration, preference heuristics, and error-driven case-specific logic may use pilot/dev only.

The final test split is frozen before ZDB-02 final measurement.

Case IDs must be stable and content-addressable enough to detect accidental duplication or mutation.

Near-duplicate cases that differ only in filename tokens must not be spread across dev/test if they would cause obvious leakage.

## 9. ZDB-02 generative baseline

The baseline runner must evaluate the current generative semantic approach without silently adding Preference Memory or provider-specific post-processing.

Required measurements:

- exact finite-choice accuracy
- acceptable-label accuracy
- invalid-output rate
- abstention rate
- unsafe-overclaim rate
- confidence calibration where confidence is available
- latency distribution, not only mean
- request/token/cost accounting where the provider exposes it
- retry/error rate
- failure taxonomy

At minimum report median and p95 latency. Cost must be reported as measured, unavailable, or estimated with an explicit method; do not fabricate precision.

## 10. Confidence and calibration

Provider confidence and benchmark correctness are separate.

Where a model does not emit a meaningful calibrated probability:

- record raw self-confidence separately;
- do not call it calibrated probability;
- calibration analysis may fit on dev only;
- final calibration metrics are reported on frozen test.

At minimum evaluate reliability buckets and one scalar calibration measure such as ECE or Brier score when mathematically applicable.

## 11. Abstention / block semantics

The evaluator must distinguish:

- correct decision
- acceptable alternate
- correct abstention
- unnecessary abstention
- unsafe overclaim
- invalid output
- provider/runtime failure

A provider that guesses aggressively must not appear better merely because raw accuracy ignores unsafe cases.

## 12. Preference Memory research boundary

ZDB-03 may model offline preference evidence, but Phase 1 must preserve:

`Explicit User Truth != Preference != Rule`

Preference fixtures must carry:

- scope
- timestamp/recency
- positive evidence
- correction/negative evidence
- conflict state
- ambiguity
- cold-start state

No production preference store/service/schema is authorized.

## 13. Reproducibility

Every benchmark result must identify:

- dataset version/hash
- runner version/commit
- provider/model identifier
- prompt/template version
- decoding/settings
- timestamp
- environment/runtime version
- case count and split
- retry policy
- cost source
- random seed where applicable

Offline deterministic evaluator results must be reproducible from committed fixtures.

Provider-backed results may vary; repeated runs must remain separately attributable rather than overwritten.

## 14. Benchmark integrity

Forbidden benchmark behavior:

- hiding failed requests;
- dropping hard cases after seeing results;
- tuning on the test split;
- changing gold labels after seeing provider output without explicit adjudication/version bump;
- converting free-form tasks into easier finite-choice tasks and comparing them as equivalent;
- reporting browser/mock fixtures as model evidence;
- using production user data without a separate approved privacy contract;
- ranking a provider from a smoke fixture.

## 15. Current implementation authority

ZDB-01 and ZDB-02 implementation/result work is complete for the Phase 1 baseline gate.

ZDB-03 now authorizes only specification-bounded offline preference research artifacts under its dedicated activation. Allowed next artifacts may include:

- synthetic preference-evidence fixtures;
- research-only preference context schema;
- deterministic offline preference hypothesis/aggregator;
- offline comparison runner;
- preference-aware research prediction/result schema;
- Stage A synthetic hypothesis corpus;
- tests and result documents.

It does not authorize production Preference Memory persistence, product runtime integration, PM-02, System One, Laya, or Jev.

ZDB-04+ remain NOT ACTIVE.

## 16. Validation

Research implementation must have:

- schema validation tests;
- deterministic evaluator unit tests;
- duplicate/leakage checks;
- fixture integrity/hash check;
- output parser fail-closed tests;
- abstention/ambiguity scoring tests;
- reproducibility smoke command;
- no production dependency/import edge from app/runtime into research surfaces.

Provider-backed benchmark runs are not required in ordinary hosted CI if they require secrets or incur cost. CI must still validate all offline contracts and smoke fixtures.

## 17. Deliverables

ZDB-01 / ZDB-02 closeout must provide:

1. dataset schema and version;
2. frozen pilot/dev/test manifest;
3. deterministic evaluator;
4. baseline runner;
5. reproducible commands;
6. smoke CI evidence;
7. provider-run manifest(s), if executed;
8. generative baseline report;
9. failure taxonomy;
10. explicit limitations;
11. next-stage recommendation limited to whether ZDB-03 research is justified.

It must not recommend or activate a production architecture by itself.

## 18. Stop conditions

Stop and return for owner review if implementation would require:

- production code changes;
- database/schema changes;
- provider/runtime dependency in product code;
- user telemetry/private file access;
- reinterpretation of PM-01 authority;
- a benchmark task whose gold label cannot be stated without hiding material ambiguity.

## Final activation disposition

**ZDB PHASE 1 RESEARCH CONTRACT FROZEN — ZDB-01 / ZDB-02 COMPLETE; ZDB-03 OFFLINE RESEARCH ACTIVE UNDER SEPARATE TASKBOOK**

#283 remains research-only. ZDB-04+ remain NOT ACTIVE. PM-02 remains NOT ACTIVE.
