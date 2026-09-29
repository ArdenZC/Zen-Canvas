# ZDB-03B — Preference Signal Screen Activation

Last verified: 2026-09-29

Status: **OWNER REVIEW PASSED — MERGE ACTIVATES ZDB-03B1 PROFILE + TARGET CONSTRUCTION ONLY**

Issue: [#283 — ZenDecisionBench Phase 1 — Offline Baseline + Preference Memory Research](https://github.com/ArdenZC/Zen-Canvas/issues/283)

Activation baseline: `master@b92fe40a18b38b60febe5618caf72ba3e988bcdb`

ZDB-03A is complete and merged through PR #300 as a deterministic resolver + conformance fixture only. Its 60-case fixture is permanently ineligible for signal/effectiveness evidence.

This document defines the next bounded research slice:

**ZDB-03B — 120-case synthetic Preference signal screen**

ZDB-03B is not the >=300-case comparative corpus required for a provider/hybrid superiority claim. It is a lower-cost, pre-registered screen used only to decide whether broader ZDB-03 comparative work is worth doing.

No production Preference Memory, PM-02, ZDB-04, System One, Laya, Jev, UI, database, telemetry, or product-runtime authority is activated here.

## 1. Research question

ZDB-03B asks:

> On the same independently authored target decisions, does historical, scoped Preference evidence produce a positive directional net benefit relative to the accepted canonical Generative baseline, while preserving Explicit User Truth, deterministic safety, cold-start invariance, control behavior, and evidence attribution?

It does not ask whether Preference Memory is production ready.

It does not authorize a superiority claim.

## 2. Frozen authority

Core invariant:

`Explicit User Truth != Preference != Rule`

Offline authority remains:

1. deterministic safety/system constraint;
2. explicit current user truth;
3. explicit deterministic user rule;
4. scoped sufficiently-supported Preference;
5. canonical Generative semantic inference;
6. abstain/review under material ambiguity.

The ZDB-03A ordinal Preference hypothesis remains frozen for this screen:

- one valid unsuperseded `explicit_correction`; or
- two consistent unsuperseded `explicit_selection` observations; or
- three consistent unsuperseded `passive_acceptance` observations.

No threshold, scope rule, correction rule, rejection rule, recency rule, or conflict rule may be tuned on ZDB-03B outcomes.

## 3. What ZDB-03A proved — and did not prove

Accepted from PR #300:

- resolver projection excludes benchmark answer metadata;
- exact scope applicability;
- genuine scope refinement/equality for correction supersession;
- chronology and correction linkage;
- rejection does not infer an alternative;
- cold-start conservatism;
- safety / explicit truth / user rule precedence;
- Arms B/C/D behavior;
- attribution and transition accounting.

The 60-case ZDB-03A fixture is conformance-only because its history and expected choices share a positional construction template.

ZDB-03B must not reuse, relabel, expand, or tune from that fixture.

## 4. Screen size and task distribution

ZDB-03B contains exactly **120 target cases**.

Required task distribution:

- `existing_folder_choice`: 72
- `suggested_action`: 36
- `purpose`: 6
- `lifecycle`: 6
- `domain_type`: 0
- `risk_level`: 0

Preference-sensitive primary targets therefore comprise 108/120 cases.

The 12 purpose/lifecycle cases are non-intervention controls for this screen. Preference must not be used to manufacture gains on them.

All 120 cases are research pilot cases. ZDB-03B creates no new locked test split.

The frozen ZDB-01 test split remains untouched.

## 5. Synthetic-user profile count

Define exactly **12 synthetic user profiles**.

Each profile owns exactly 10 target cases after deterministic assignment.

Profiles are synthetic, non-sensitive research instruments. They are not product personas and not production memory records.

Each profile must define:

- stable profile ID;
- one synthetic primary workspace ID;
- a short natural-language preference brief;
- bounded folder-choice tendencies;
- bounded suggested-action tendencies;
- known exceptions/ambiguities;
- no target case IDs;
- no benchmark gold;
- no target-specific final decisions.

A profile brief expresses revisable tendencies, not deterministic Rules.

## 6. Stable Preference identities

ZDB-03B must not repeat the ZDB-03A artifact where a historical decision only has meaning because it reuses a target-local `folder_1` identifier.

For `existing_folder_choice`, use stable semantic folder identities that can persist across historical episodes and target episodes.

The v1 folder identity vocabulary is frozen to:

- `teaching` — label `Teaching`
- `study` — label `Study`
- `work` — label `Work`
- `reference` — label `Reference`
- `archive` — label `Archive`
- `personal` — label `Personal`
- `finance` — label `Finance`
- `media` — label `Media`

A folder target presents 3 or 4 choices drawn from this vocabulary.

Historical folder evidence uses the same stable semantic IDs.

For `suggested_action`, use the existing canonical action IDs.

Do not invent profile-specific case-local IDs.

## 7. Four-artifact anti-leakage model

ZDB-03B separates four logically independent artifacts.

### A. Profile Pack

Contains only the 12 latent synthetic user preference briefs.

It contains no target cases, target IDs, target gold, provider predictions, or target-specific decisions.

If a generator is used, its inputs and source must not read/import the Target Pack.

### B. Target Pack

Contains exactly 120 current target situations with:

- case ID;
- task;
- provider-visible input metadata;
- target scope;
- finite choices;
- ambiguity metadata;
- any current Explicit User Truth fixture;
- any deterministic user/safety Rule fixture.

It contains no Preference Evidence and no gold/acceptable answer.

Target construction is independent of synthetic profiles: no target record may contain a profile ID, and any target generator must not read/import the Profile Pack. Profile assignment occurs only after both packs are frozen.

### C. History Pool

Contains historical Preference Evidence episodes for each profile.

It is authored from the Profile Pack, not from target gold and not from provider output.

It must not import/read the target adjudication artifact.

### D. Owner Adjudication

Contains gold / acceptable / abstention truth for the 120 targets.

Adjudication may inspect:

- Profile Pack;
- Target Pack;
- current Explicit User Truth / deterministic Rule fixtures.

Adjudication must **not** inspect:

- History Pool;
- Generative baseline predictions;
- Preference resolver predictions.

Thus history and gold may share the same latent synthetic profile, but history itself is not used to manufacture target gold.

## 8. Construction order

The required order is:

1. freeze ZDB-03B definition;
2. create Profile Pack candidate;
3. create Target Pack candidate;
4. freeze Profile Pack + Target Pack hashes;
5. derive profile assignment deterministically;
6. create History Pool from Profile Pack only;
7. freeze History Pool hash;
8. Owner adjudicates Profile × Target without viewing History Pool or provider output;
9. freeze adjudication hash;
10. assemble the final 120-case signal corpus mechanically;
11. Owner reviews and freezes the assembled corpus;
12. only then may a live same-case Generative baseline run occur;
13. only after the immutable baseline is captured may Arms B/C/D be executed and evaluated.

No later stage may modify an earlier frozen artifact in place.

A repair requires a new artifact version and explicit Owner disposition.

## 9. Deterministic profile assignment

Target-to-profile assignment must not be manually chosen case by case.

After Profile Pack and Target Pack hashes are frozen, compute:

`assignment_seed = SHA256("zdb-03b-assignment-v1|" + profile_pack_hash + "|" + target_pack_hash)`

For every target case:

`rank_key = SHA256(assignment_seed + "|" + case_id)`

Sort all 120 target cases lexicographically by `rank_key`.

Assign profiles `profile-01` through `profile-12` round-robin over that ordered list.

This yields exactly 10 target cases per profile.

Assignment generation must not read gold, history, or provider output.

## 10. Target-choice ordering

Choice ordering must not encode expected answers and must not create a hash cycle.

Inside the frozen Target Pack, every finite choice set is stored in canonical lexicographic `choice_id` order. The resulting immutable Target Pack hash is then available as an input to later assembly.

For folder targets, the **assembled signal corpus** reorders the already-frozen candidate set by:

`SHA256("zdb-03b-choice-order-v1|" + target_pack_hash + "|" + case_id + "|" + choice_id)`

ascending lexicographically.

Thus the Target Pack hash is computed before derived evaluation/display ordering and never depends on that derived order.

Suggested-action canonical choice order may remain the existing benchmark order.

No choice may be added, removed, renamed, or moved because of adjudication or model output.

## 11. History Pool requirements

Each synthetic profile must have at least **24 historical episodes** before target time.

At least 288 historical episodes therefore exist across 12 profiles.

History must include realistic variation rather than perfect repetition.

Across the complete pool include:

- passive acceptances;
- explicit selections;
- explicit corrections;
- explicit rejections;
- broader/global tendencies;
- workspace-scoped tendencies;
- purpose/lifecycle-scoped tendencies;
- noise / occasional contradictory history;
- at least one valid correction chain per profile.

Every historical episode:

- precedes all target decisions it can affect;
- uses stable semantic decision identity;
- has synthetic provenance;
- contains no target case ID;
- contains no target gold;
- contains no provider result.

A history generator, if used, may read only the Profile Pack plus generic pre-registered history templates/seeds. It must not read/import the Target Pack, profile assignment map, Owner Adjudication, assembled corpus, or provider evidence.

## 12. Mechanical target context assembly

A target Preference Context is assembled mechanically from:

- assigned profile;
- frozen History Pool;
- target task;
- target time;
- target scope;
- target finite choice set.

Evidence inclusion may depend only on chronology, task, scope applicability, and whether the historical decision is representable in the target finite choices.

It must not depend on:

- target gold;
- acceptable choices;
- baseline prediction;
- resolver prediction;
- case-specific expected outcome.

The assembly code must be tested for answer invariance.

## 13. Owner adjudication

Every one of the 120 target cases requires Owner adjudication before a live provider request.

Adjudication status is not inferred from the resolver.

For each case record:

- gold;
- optional acceptable alternatives;
- abstain permission;
- concise adjudication rationale;
- profile tendency IDs consulted;
- deterministic Rule/Explicit Truth authority where applicable.

The adjudicator must not see the History Pool or baseline predictions.

For folder-choice targets, adjudication must use the already-derived hash-based choice ordering from section 10 (or refer to choices only by stable ID); it must not use ordinal position as evidence.

No script may mechanically compute target gold from a `preferred` variable.

No history decision may be copied into gold by construction.

## 14. Current-authority controls

The 120 targets must include at least:

- 12 cold-start/no-applicable-preference controls;
- 6 Explicit User Truth conflict controls;
- 6 deterministic safety conflict controls;
- 12 purpose/lifecycle non-intervention controls.

These categories may overlap only when explicitly documented; the manifest must report unique case IDs per control class.

Hard expectations:

- cold-start C/D preserve baseline when no higher authority exists;
- Explicit User Truth wins over Preference and baseline;
- safety wins over all lower authority;
- Preference does not alter the 12 purpose/lifecycle control cases in this screen.

## 15. Preference-history condition coverage

Across the 108 primary preference-sensitive targets, include meaningful coverage of:

- sufficient consistent evidence;
- correction-backed evidence;
- narrower scoped evidence against broad history;
- weak/sparse evidence;
- unresolved conflict;
- negative rejection evidence;
- scope mismatch;
- no applicable evidence.

Do not force an equal count if doing so makes cases unnatural.

The manifest must report counts.

## 16. Baseline identity

The ZDB-03B canonical Generative baseline is the accepted canonical-enum Managed AI contract from ZDB-02 remediation.

Use the same:

- canonical-enum system prompt contract;
- production metadata builder;
- production parser behavior;
- DeepSeek OpenAI-compatible provider path;
- model/config settings unless an environment-independent provider compatibility repair is separately Owner-approved;
- temperature 0;
- thinking disabled;
- no retry.

No Preference data, profile brief, history, assignment, gold, or adjudication rationale may enter the provider request.

The provider sees only the same current-file metadata contract used by the canonical ZDB baseline.

## 17. Baseline request-projection proof

Before any live provider call, tests must prove that for the same target:

changing only:

- gold;
- acceptable;
- Profile Pack;
- History Pool;
- preference_context;
- adjudication rationale;
- profile assignment metadata

does not change the exact provider request payload.

The request projection hash must be separately recordable.

This is a hard pre-run gate.

## 18. Live baseline timing

The live same-case baseline may run only after all of these are frozen and Owner-reviewed:

- Profile Pack hash;
- Target Pack hash;
- Assignment map hash;
- History Pool hash;
- Owner Adjudication hash;
- assembled 120-case corpus hash;
- signal manifest.

The credential must remain external.

The credential previously exposed during ZDB-02 must not be reused.

Use a rotated/fresh `DEEPSEEK_API_KEY`.

Never commit or print the credential.

## 19. Baseline evidence chain

The live baseline evidence must bind at minimum:

- assembled corpus hash;
- Target Pack hash;
- Profile Pack hash;
- History Pool hash;
- Owner Adjudication hash;
- assignment hash;
- exact runner commit;
- clean tracked worktree;
- provider/model;
- exact sanitized endpoint;
- prompt-template ID/hash;
- settings;
- request-projection hash/version;
- no-retry policy;
- attempt count;
- stable failure taxonomy;
- measured provider token usage when available;
- monetary-cost status without invented pricing;
- prediction file SHA-256;
- run sidecar SHA binding;
- evaluation summary binding.

No provider raw response body is committed.

## 20. Offline arms

After baseline evidence is immutable, run the frozen offline arms on the same 120 cases.

### Arm A

Canonical Generative baseline.

### Arm B

Safety → Explicit User Truth → deterministic user Rule → Preference → abstain.

### Arm C

Safety → Explicit User Truth → deterministic user Rule → Preference → Generative baseline → abstain.

### Arm D

Safety → Explicit User Truth → deterministic user Rule, then conservative Generative/Preference disagreement handling from ZDB-03A.

No algorithm tuning after baseline capture.

## 21. Primary signal population

Primary directional-signal accounting is restricted to:

- `existing_folder_choice`;
- `suggested_action`.

Purpose/lifecycle controls are excluded from positive signal credit.

They remain eligible to expose regressions.

## 22. Primary endpoint

Primary descriptive endpoint for Arm C:

`Preference Net Benefit = beneficial Preference-caused transitions - harmful Preference-caused transitions`

A **Preference-caused changed decision** exists only when all are true:

- `preference_applied=true`;
- a real matching baseline decision is available;
- the final Arm-C decision differs from the baseline decision.

Changes caused solely by safety, Explicit User Truth, deterministic user Rule, provider failure handling, or evaluator repair do not count as Preference-caused transitions.

Raw transition counts are authoritative.

Beneficial transitions include the already-frozen classes:

- baseline wrong → Preference correct;
- baseline wrong → Preference acceptable;
- baseline abstain → justified Preference decision.

Harmful transitions include:

- baseline correct → Preference wrong;
- baseline acceptable → Preference wrong;
- baseline abstain → unsafe Preference guess.

Do not invent weights.

## 23. Signal-screen disposition

ZDB-03B is a screen, not a superiority test.

Classify the Arm-C screen as:

### SCREEN_BLOCKED

Any hard research gate fails.

### NO_DIRECTIONAL_SIGNAL

Hard gates pass, at least 10 Preference-caused changed decisions are observed, and beneficial transitions are less than or equal to harmful transitions.

### INCONCLUSIVE_LOW_DELTA

Hard gates pass but fewer than 10 Preference-caused changed decisions are observed.

This may happen if Generative and Preference usually agree.

### DIRECTIONAL_SIGNAL_PRESENT

Hard gates pass, at least 10 Preference-caused changed decisions are observed, and beneficial transitions are greater than harmful transitions.

This label means only that the pre-registered 120-case synthetic screen has a positive observed direction.

It is **not** a provider/hybrid superiority claim.

It does not satisfy the >=300-case gate.

Report the exact beneficial, harmful, unchanged, abstention, and coverage counts regardless of label.

## 24. Hard research gates

All are mandatory:

- explicit-truth violations = 0;
- safety-boundary violations = 0;
- cold-start regressions = 0;
- purpose/lifecycle control Preference changes = 0;
- attribution completeness = 100%;
- future-evidence leakage = 0;
- target-gold/history construction leakage = 0 known violations;
- frozen artifact hash drift = 0.

Any failure yields `SCREEN_BLOCKED`.

Aggregate accuracy cannot override these gates.

## 25. Secondary reporting

Report separately for Arms A/B/C/D:

- exact accuracy;
- acceptable-adjusted accuracy;
- correct abstention;
- unnecessary abstention;
- unsafe overclaim;
- decision coverage;
- provider failure where applicable;
- preference-induced correction;
- preference-induced regression;
- transition matrix;
- conflict-resolution correctness;
- attribution completeness;
- per-task breakdown;
- per-profile breakdown;
- evidence support class breakdown;
- baseline/Preference agreement matrix.

Do not use per-profile results to tune profile-specific logic.

## 26. No significance or superiority claim

ZDB-03B may report descriptive proportions and raw counts.

Do not publish:

- statistical superiority;
- provider superiority;
- architecture superiority;
- production-readiness claims.

The existing >=300 adjudicated comparative-corpus gate remains mandatory before such claims.

## 27. No post-result tuning

After the assembled corpus is frozen and the first live baseline request is sent:

forbidden:

- changing profile briefs;
- changing target cases;
- changing assignment;
- changing history;
- changing gold/acceptable;
- changing Preference thresholds;
- changing scope semantics;
- changing conflict behavior;
- changing mapping to improve results;
- deleting difficult cases;
- moving cases between categories;
- retrying failed provider cases.

A defect repair requires a new experiment identity and must preserve the prior result.

## 28. Privacy and production boundary

ZDB-03B remains synthetic/offline research.

Forbidden:

- real personal filesystem history;
- telemetry;
- connected accounts;
- production Preference persistence;
- user-profile database;
- product runtime imports;
- Organize/Cleanup behavior changes;
- UI settings;
- PM-02;
- ZDB-04 activation;
- Laya/Jev/System-One implementation.

## 29. Implementation sequence

After this definition is Owner-reviewed and merged, execution must proceed in bounded slices:

### ZDB-03B1 — Profile + Target construction

Create Profile Pack and Target Pack only.

No History Pool.

No gold.

No provider call.

Return for Owner review.

### ZDB-03B2 — Assignment + History + Owner adjudication

Freeze Profile/Target hashes, derive deterministic assignment, create History Pool, then perform separate Owner adjudication without History/provider visibility.

Assemble candidate corpus.

No provider call.

Return for Owner corpus review/freeze.

### ZDB-03B3 — Same-case Generative baseline

Only after corpus freeze.

One live no-retry baseline run.

Return immutable evidence for Owner review.

### ZDB-03B4 — Offline Preference comparison

Run B/C/D against the accepted same-case baseline.

Produce final signal-screen result.

No algorithm tuning.

This staged sequence is intentional to reduce context pressure and prevent accidental evidence coupling.

## 30. Stop conditions

Stop and return for Owner review if work would require:

- changing ZDB-03A resolver semantics;
- production changes;
- real user data;
- provider prompt tuning;
- using the frozen ZDB test split;
- automated gold generation from history;
- history generation from target gold;
- profile assignment chosen manually per target;
- a provider call before corpus freeze;
- retrying provider failures;
- changing any frozen pre-run artifact;
- ZDB-04;
- PM-02;
- Laya/Jev/System One.

Do not work around these conditions.

## 31. Current authoritative state after activation

On merge of this Owner-reviewed definition:

- ZDB-01 — COMPLETE / FROZEN
- ZDB-02 original baseline — COMPLETE / ACCEPTED
- ZDB-02 canonical-enum remediation — COMPLETE / ACCEPTED
- ZDB-03A — COMPLETE / MERGED / OWNER REVIEW PASSED / CONFORMANCE ONLY
- ZDB-03B — ACTIVE FOR ZDB-03B1 PROFILE + TARGET CONSTRUCTION ONLY
- ZDB-03 Stage-B >=300 comparative corpus — NOT ACTIVE
- ZDB-04+ — NOT ACTIVE
- PM-02 — NOT ACTIVE

No production authority follows from this activation.

## Final activation disposition

**ZDB-03B PREFERENCE SIGNAL SCREEN — OWNER REVIEW PASSED**

Merge of this definition authorizes only **ZDB-03B1 — Profile + Target construction**.

It does not authorize:

- History Pool construction;
- Owner Adjudication;
- assembled signal-corpus freeze;
- provider execution;
- Preference comparison;
- the >=300 comparative corpus;
- ZDB-04;
- PM-02.

Each later ZDB-03B slice requires its preceding Owner gate.
