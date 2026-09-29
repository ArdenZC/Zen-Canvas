# ZDB-03 — Preference Memory Offline Hypothesis Activation

Last verified: 2026-09-29

Status: **ACTIVE FOR OFFLINE RESEARCH ONLY — SPECIFICATION FROZEN AFTER OWNER REVIEW**

Issue: [#283 — ZenDecisionBench Phase 1 — Offline Baseline + Preference Memory Research](https://github.com/ArdenZC/Zen-Canvas/issues/283)

Activation baseline: \`master@8696cbe54fb55368c0fc88d49c216e4e803d1fbb\`

This task activates ZDB-03 as an offline research hypothesis only. It grants no production persistence, runtime, UI, database, provider, semantic, mutation, telemetry, privacy, or release authority.

## 1. Why ZDB-03 exists

ZDB-02 established two facts:

1. the original Managed AI prompt/parser contract was materially underspecified; explicit canonical enum binding improved the controlled pilot from 11.67% exact / 12.50% adjusted to 75.00% exact / 80.83% adjusted;
2. after output-validity repair, the largest remaining weaknesses were user-dependent decisions:
   - \`suggested_action\`: 11/20 exact, 12/20 adjusted;
   - \`existing_folder_choice\`: 5/20 exact, 9/20 adjusted, 12 abstentions and one unsafe overclaim.

ZDB-03 therefore asks a bounded question:

> Can previously observed, properly scoped user preference evidence improve preference-sensitive finite-choice decisions without overriding explicit truth, deterministic rules, safety, chronology, or justified abstention?

ZDB-03 does **not** ask whether Zen should build a production memory system.

## 2. Core authority distinction

The research contract preserves:

\`Explicit User Truth != Preference != Rule\`

### Explicit User Truth

A current direct user instruction or direct correction.

Examples:

- "Client A files belong in Work/Client-A."
- "Do not put screenshots in Personal/Photos."
- "Archive completed teaching material after the semester."

Properties:

- explicit rather than inferred;
- current unless superseded by another explicit statement;
- scoped exactly as stated;
- higher authority than inferred preference.

Explicit User Truth must never be silently converted into a probabilistic preference.

### Preference

A revisable hypothesis inferred from prior user choices or corrections.

Examples:

- the user often places teaching slides under Teaching rather than Study;
- the user usually archives completed courses;
- the user tends to keep active client work grouped by client.

Properties:

- evidence-backed;
- probabilistic;
- scope-bounded;
- chronological;
- conflict-aware;
- revisable;
- permitted to abstain.

Preference is not an instruction and is not deterministic authority.

### Rule

A deterministic condition explicitly created by the user or already owned by a deterministic safety/system contract.

Examples:

- a user-created fixed routing condition;
- a protected system-path restriction;
- a deterministic safety boundary.

Rules must not be synthesized automatically from weak Preference evidence.

## 3. Research-only boundary

ZDB-03 may add only offline research artifacts under authorized research/docs/test surfaces.

It may not add or change:

- production database tables or migrations;
- production Preference Memory persistence;
- a user-profile store;
- a background learning worker;
- implicit-learning runtime behavior;
- product telemetry;
- filesystem-history ingestion;
- connected-account ingestion;
- production Organize/Cleanup decisions;
- SemanticAssessmentV1 production authority;
- UI settings or user-facing memory controls;
- provider/runtime dependencies in product code;
- PM-02;
- Laya/Jev/System-One production runtime.

No production import may depend on ZDB preference research code.

## 4. Preference Evidence v1 logical model

The machine-readable research schema is:

\`research/zen-decision-bench/schema/preference-evidence.v1.schema.json\`

A preference evidence record represents one historical observation available **before** a target decision.

Required concepts:

- stable evidence ID;
- evidence kind;
- task family;
- decision/value observed;
- scope;
- observed timestamp;
- provenance;
- polarity/strength semantics;
- correction linkage where relevant.

### Evidence kinds

ZDB-03 distinguishes at least:

- \`passive_acceptance\`
- \`explicit_selection\`
- \`explicit_correction\`
- \`explicit_rejection\`

A direct correction/rejection is semantically stronger evidence than passive acceptance, but this activation deliberately does **not** freeze a numeric multiplier.

Numeric weighting is a later pilot/dev experiment, not a specification fact.

## 5. Scope model

Preference evidence must be scoped. No observation becomes global merely because it exists.

ZDB-03 recognizes the following scope dimensions:

- global user scope;
- workspace/project;
- managed folder;
- parent-folder family;
- task family;
- domain/file type;
- purpose;
- lifecycle.

A record may specify more than one dimension.

Scope matching is a hypothesis input, not production authority.

Research must explicitly track:

- exact scope match;
- broader scope match;
- narrower/more-specific scope;
- scope mismatch.

A project-specific preference must not leak into unrelated projects.

## 6. Chronology and recency

For a target decision at time \`T\`:

> Only evidence observed before \`T\` may influence the decision.

Future corrections must never leak backward.

Each evidence record must contain \`observed_at\`.

Preference-state fixtures may also derive:

- first observed time;
- last observed time;
- age relative to target decision;
- correction recency.

This activation does not freeze a decay function or half-life.

Any future recency weighting must be fit on pilot/dev only and must remain separately attributable.

## 7. Positive, negative and correction evidence

ZDB-03 must preserve evidence direction.

### Positive evidence

Examples:

- user explicitly chooses a folder;
- user accepts a suggestion;
- user repeatedly chooses the same action.

### Negative evidence

Examples:

- user rejects a suggestion;
- user moves the item elsewhere;
- user explicitly says not to use a candidate.

### Correction evidence

An explicit correction identifies a prior decision as wrong for its stated scope/context.

Research hypothesis:

> A direct correction should dominate passive historical acceptance when scope is comparable, unless a later explicit statement supersedes it.

The hypothesis must be tested rather than encoded as an unexplained magic coefficient.

Required later scenarios include:

- five passive acceptances followed by one explicit correction;
- an old preference followed by a recent correction;
- conflicting corrections at comparable scope.

## 8. Preference confidence

Preference confidence is distinct from provider self-confidence.

It may eventually depend on:

- evidence count;
- evidence kind;
- consistency;
- scope match;
- recency;
- correction history;
- conflict.

It must not be copied from LLM confidence.

This activation does not claim calibration and does not freeze a numeric confidence formula.

ZDB-05 remains the calibration/robustness phase.

## 9. Conflict state

Conflict is a **derived aggregate state over a Preference Context**, not a field authored independently on each historical evidence record. This prevents the input observation from carrying the answer to the conflict-resolution problem.

The later offline hypothesis must derive disagreement rather than averaging it away.

Allowed derived research conflict states:

- \`none\`
- \`weak\`
- \`conflicting\`
- \`superseded\`
- \`unresolved\`

Material unresolved conflict should normally reduce decision coverage or cause abstention, not create false certainty.

## 10. Cold start

No evidence means no inferred preference.

Invariant:

> In cold start, a preference-aware candidate must not invent a personal tendency.

The default comparison expectation is that no-evidence behavior should reduce to the canonical generative baseline, or be observationally equivalent except for explicit attribution metadata.

Cold-start regressions are first-class failures.

## 11. Candidate offline authority hypothesis

The following ordering is authorized only as an **offline hypothesis** to evaluate:

1. deterministic safety/system constraints;
2. explicit current user truth;
3. explicit deterministic user rule;
4. scoped, sufficiently supported Preference evidence;
5. canonical generative semantic inference;
6. abstain/review when material ambiguity remains.

This is **NOT PRODUCTION AUTHORITY**.

ZDB-03 exists to test whether this ordering improves outcomes without creating harmful overrides.

## 12. Objective vs preference-sensitive task families

Preference must not rewrite objective facts merely to imitate history.

| Task family | Research classification | Preference role |
| --- | --- | --- |
| \`domain_type\` | objective-dominant | normally none; preference must not override file type |
| \`risk_level\` | objective/safety-dominant | none for lowering risk; safety wins |
| \`lifecycle\` | mostly objective/mixed | limited contextual support only where lifecycle is genuinely user-defined |
| \`purpose\` | mixed | bounded contextual support when metadata is ambiguous |
| \`suggested_action\` | preference-sensitive / safety-bounded | primary secondary target |
| \`existing_folder_choice\` | preference-sensitive | primary ZDB-03 target |

The initial prototype must prioritize \`existing_folder_choice\`, then \`suggested_action\`.

It must not use Preference Memory to improve benchmark scores on objective-dominant tasks by overriding the semantic truth contract.

## 13. Preference Context fixture

A future ZDB-03 case may supply a research-only `preference_context` matching `zdb.preference_context.v1`.

A preference context must be synthetic and chronological.

It contains structurally separate inputs:

- target decision timestamp;
- zero or more prior Preference Evidence records;
- cold-start flag;
- zero or more Explicit User Truth fixtures;
- zero or more deterministic user/safety Rule fixtures.

It must **not** contain a precomputed preference recommendation, final decision, or derived conflict answer that the candidate is meant to infer.

Conflict is derived from the evidence available before the target time; it is never supplied as an oracle input.

No real personal filesystem history is authorized.

Allowed provenance remains:

- synthetic;
- non-sensitive repository fixture;
- manual non-sensitive.

## 14. Required scenario families

The later offline prototype must cover at least:

### Cold start

No preference evidence.

Expected: no invented preference.

### Consistent preference

Repeated comparable evidence favors one finite choice.

### Single correction

A direct correction contradicts an older tendency.

### Repeated correction

Multiple corrections challenge passive history.

### Scope conflict

Global tendency conflicts with project/workspace-specific evidence.

### Recency conflict

Old repeated evidence conflicts with a recent correction.

### Equal conflict

Comparable contradictory evidence.

Expected behavior may be abstention.

### Sparse evidence

One weak passive observation must not justify high certainty.

### Safety conflict

Preference would lower or bypass a deterministic safety boundary.

Expected: safety wins.

### Explicit-truth conflict

Current explicit truth conflicts with inferred Preference.

Expected: explicit truth wins.

## 15. Offline comparison arms

ZDB-03 freezes the following research arms:

### Arm A — Canonical Generative

The accepted canonical-enum ZDB-02 behavior without preference evidence.

### Arm B — Preference-only finite-choice hypothesis

Decision uses only bounded preference evidence.

It must abstain when evidence is insufficient.

Purpose: determine whether preference evidence itself contains useful signal.

### Arm C — Generative + Preference

Generative decision plus bounded preference evidence.

Preference may influence only preference-sensitive/mixed decisions and may not override explicit truth or safety.

### Arm D — Conservative disagreement hybrid

Generative and Preference recommendations are compared.

Where disagreement is materially unresolved, the candidate may abstain/review rather than force a choice.

Arm D is an offline research arm, not a System-One production architecture.

## 16. Attribution contract

Every preference-aware prediction must remain explainable by structured evidence.

Later prediction artifacts must be able to identify:

- generative recommendation;
- preference recommendation;
- final recommendation;
- whether preference changed the final result;
- evidence IDs used;
- matched scope;
- evidence count;
- latest correction timestamp where present;
- conflict state;
- decision source;
- reason for abstention where applicable.

No opaque "memory improved this" field is sufficient.

## 17. Evaluation metrics

ZDB-03 must report baseline metrics plus preference-specific effects.

Required:

- exact accuracy;
- acceptable-adjusted accuracy;
- correct abstention;
- unnecessary abstention;
- unsafe overclaim;
- decision coverage;
- preference-induced correction;
- preference-induced regression;
- explicit-truth violation count;
- safety-boundary violation count;
- cold-start regression count;
- conflict-resolution correctness;
- attribution completeness.

### Preference Net Benefit

Report raw counts for:

- beneficial preference changes;
- harmful preference changes.

Conceptually:

\`Preference Net Benefit = beneficial changes - harmful changes\`

Do not freeze arbitrary weights in this activation.

Raw counts remain authoritative.

## 18. Mandatory preference transition matrix

Every experiment must separately count:

- baseline correct -> preference wrong;
- baseline acceptable -> preference wrong;
- baseline abstain -> unsafe preference guess;
- baseline wrong -> preference correct;
- baseline abstain -> justified preference decision;
- baseline wrong -> preference acceptable;
- unchanged correct;
- unchanged wrong;
- unchanged abstain.

This prevents raw accuracy from hiding preference-caused regressions.

## 19. Hard research safety gates

For any later production consideration, ZDB-03 evidence must show:

- \`0\` explicit-truth violations;
- \`0\` safety-boundary violations.

Any such violation is a hard research blocker, even if aggregate accuracy improves.

These gates do not themselves authorize production.

## 20. Preference failure taxonomy

The offline research taxonomy includes:

- \`no_preference_evidence\`
- \`weak_preference_evidence\`
- \`conflicting_preference_evidence\`
- \`stale_preference\`
- \`scope_mismatch\`
- \`preference_overrode_explicit_truth\`
- \`preference_overrode_safety\`
- \`preference_induced_wrong_decision\`
- \`unjustified_preference_guess\`
- \`correct_preference_correction\`
- \`correct_preference_abstention\`
- \`generative_preference_disagreement\`
- \`unclassified_research_error\`

Known stable failures must not be collapsed into \`unclassified_research_error\`.

## 21. Stage A — bounded hypothesis corpus

ZDB-03 implementation should first build a small synthetic preference-specific research corpus.

Planning target:

- at least 60 target cases;
- strong emphasis on \`existing_folder_choice\` and \`suggested_action\`;
- include every scenario family in section 14;
- include objective/safety control cases;
- include cold-start controls;
- chronological evidence only.

This is not a superiority corpus.

Pilot/dev may be used to iterate on preference hypotheses.

The existing locked ZDB test split must not be used to create or tune preference rules, conflict resolution, recency weighting, or confidence.

## 22. Stage B — comparative corpus

Before any claim that one provider/hybrid/preference architecture is superior:

- comparative corpus >= 300 adjudicated cases;
- broader task distribution;
- preference-sensitive cases;
- objective/safety control cases;
- frozen evaluation split;
- no tuning on frozen test.

The >=300 gate remains intact.

It is not required to begin Stage A.

## 23. Anti-leakage and anti-gaming rules

Forbidden:

- deriving preference evidence from the target gold label;
- choosing evidence by case ID;
- constructing a history that exists only to make one target correct;
- using future corrections for earlier decisions;
- tuning on locked test;
- removing difficult conflicts;
- converting real ambiguity into deterministic preference;
- letting Preference override objective/safety truth;
- reporting a preference score without showing harmful changes.

Preference evidence must represent plausible historical observations available before the target decision.

## 24. Privacy boundary

ZDB-03 authorizes no production privacy architecture.

Synthetic research fixtures only.

Any future production Preference Memory would require a separate privacy/security contract covering:

- data collected;
- local/cloud boundary;
- retention;
- deletion;
- export;
- user visibility;
- correction;
- opt-out;
- connected sources;
- sensitive filenames/context;
- encryption/access control.

None of those product mechanisms may be implemented under this activation.

## 25. Potential future product seams — not authorized

Research may document possible future interaction points only:

- existing-folder recommendation;
- suggested action;
- ambiguous purpose support;
- user correction feedback;
- SemanticAssessmentV1 contextual support.

Each is:

**POTENTIAL FUTURE SEAM — NOT AUTHORIZED**

No production integration follows from this document.

## 26. Relationship to System One / Laya / Jev

Preference Memory is one possible evidence source for a future System-One-style layer.

ZDB-03 does not prove or activate:

- Laya;
- Jev;
- local model requirement;
- separate inference service;
- rules-engine replacement;
- production memory schema;
- production hybrid authority.

Those require later evidence and architecture review.

## 27. Implementation authorization after this activation

After this activation is owner-reviewed and merged, the next ZDB-03 implementation slice may create only research/offline artifacts such as:

- preference-evidence fixtures;
- preference-context fixture schema;
- deterministic offline preference aggregator/hypothesis;
- offline comparison runner;
- preference-aware prediction/result schema;
- Stage A synthetic corpus;
- tests;
- result documents.

It may not create production code or persistence.

## 28. Validation requirements for the later prototype

Before a ZDB-03 result is accepted:

- schema validation;
- chronology checks;
- no-future-evidence checks;
- scope-match tests;
- correction/conflict tests;
- cold-start invariance tests;
- explicit-truth precedence tests;
- safety-precedence tests;
- attribution completeness tests;
- transition-matrix accounting;
- no production dependency/import edge;
- frozen ZDB corpus/test hashes unchanged.

## 29. Stop conditions

Stop and return for owner review if ZDB-03 would require:

- production database/schema changes;
- production runtime/API/service;
- product UI;
- real user data;
- filesystem-history ingestion;
- connected apps/accounts;
- telemetry;
- hidden persistence;
- changing SemanticAssessmentV1 production authority;
- changing the frozen ZDB corpus;
- using locked test for preference construction/tuning;
- PM-02 activation;
- Laya/Jev implementation.

Do not work around these conditions.

## 30. Research gates

Owner review of a future ZDB-03 prototype asks:

### Gate A — Signal

Does Preference improve preference-sensitive decisions?

### Gate B — Harm

Does it create regressions, especially in cold-start/objective controls?

### Gate C — Authority safety

Required:

- zero explicit-truth violations;
- zero safety-boundary violations.

### Gate D — Ambiguity

Does unresolved conflict produce justified abstention rather than false certainty?

### Gate E — Attribution

Can every Preference-caused decision be traced to bounded prior evidence?

Only after these gates are satisfied should the project consider broader comparative work.

## Final activation disposition

**ZDB-03 PREFERENCE MEMORY OFFLINE HYPOTHESIS — ACTIVE FOR RESEARCH ONLY**

This activation authorizes specification-bounded offline prototype work after owner review/merge.

It does not authorize production Preference Memory, PM-02, System One, Laya, Jev, or any product architecture change.

ZDB-04+ remain **NOT ACTIVE**.
