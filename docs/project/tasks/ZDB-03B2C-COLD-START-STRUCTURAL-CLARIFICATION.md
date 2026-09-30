# ZDB-03B2C — Cold-Start Structural Clarification

Last verified: 2026-09-30

Status: **OWNER-ACCEPTED PRE-PROVIDER EXECUTION CLARIFICATION**

Issue: #283

Starting master: `399ed11773dcfabfcd869c114f145d1f31cf6049`

This clarification records a STOP encountered before any ZDB-03B provider execution or Preference-arm execution.

It does **not** modify any frozen experimental input.

## 1. Trigger

The first ZDB-03B2C mechanical assembly attempt correctly stopped before writing a corpus because the execution instruction asserted:

- expected cold-start contexts = 24;
- expected non-cold contexts = 96.

Mechanical assembly from the five frozen inputs instead produced:

- cold-start contexts = **55**;
- non-cold contexts = **65**;
- missing correction references = **0**.

No corpus, manifest, commit, PR, provider request, resolver run, or Preference-arm run was produced by the stopped attempt.

## 2. Frozen inputs remain unchanged

The STOP was reproduced from these already-frozen identities:

- Profile canonical SHA-256:
  `371519fe7c9f28d3c686e0299c223d64a57b00571777cab498668667498137b1`
- Target canonical SHA-256:
  `96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4`
- Assignment canonical SHA-256:
  `4833443e85bf2a69c74b175b8e618a98eebab6444f1da05418fbf926582d6a0b`
- History canonical SHA-256:
  `c2be8a2949c0daef12fe821010b72ca84ef999deb941a6f8bd0505dc8a7e2f44`
- Owner blind adjudication canonical SHA-256:
  `498a511c4cfba87daaed7db5197c35aed96de34862feede43c500d9eb5d3ad50`

None may be changed to alter the observed coverage.

## 3. Root cause

Independent Owner reproduction of the frozen assembly filter yields exactly:

### 12 designated novel-workspace cold starts

These are the pre-registered `cold_start_candidate` primary targets.

Their materialized target workspace is intentionally different from the assigned profile's primary workspace, so no frozen History evidence is scope-applicable.

### 12 purpose/lifecycle non-intervention cold starts

The History Pool intentionally contains only:

- `existing_folder_choice`;
- `suggested_action`.

Therefore all:

- 6 `purpose`;
- 6 `lifecycle`

non-intervention controls have no Preference Evidence.

### 31 incidental finite-choice cold starts

These are primary `existing_folder_choice` targets using an assigned profile's primary workspace.

For each of these 31 cases:

- at least one frozen History record matches chronology, task and target scope;
- there is no scope-matching defect;
- but every scope-matching historical folder decision is absent from that target's frozen finite choice IDs;
- the merged experiment definition requires historical decisions to be representable in the current finite choices before inclusion;
- therefore all matching History evidence is correctly filtered out.

This yields:

`12 + 12 + 31 = 55`

cold-start contexts.

There are **0** additional cold starts caused by an unexplained scope mismatch.

There are **0** missing correction references.

## 4. Why 24/96 was incorrect

The merged ZDB-03B definition did **not** freeze a total cold-start count of 24.

It froze:

- at least 12 cold-start/no-applicable-preference controls;
- 12 purpose/lifecycle non-intervention controls;
- mechanical evidence inclusion based on chronology, task, scope applicability, and current finite-choice representability;
- meaningful coverage that explicitly includes `no applicable evidence`.

The later B2C execution contract incorrectly promoted the two designed control classes into an assertion that **only** those 24 cases could be cold-start.

That assertion ignored a legitimate consequence of the already-frozen finite-choice filter.

This document corrects that execution assertion without changing the experiment's frozen source data, resolver, thresholds, adjudication, or baseline contract.

## 5. Accepted B2C structural constants

For the current frozen ZDB-03B screen, B2C must require exactly:

- total cases: **120**
- cold-start contexts: **55**
- non-cold contexts: **65**
- designated novel-workspace cold starts: **12**
- purpose/lifecycle no-history cold starts: **12**
- incidental finite-choice cold starts: **31**
- unexplained scope-mismatch cold starts: **0**
- missing correction references: **0**
- Explicit User Truth controls: **6**
- deterministic Safety controls: **6**

The 55/65 values are not tunable targets. They are deterministic outputs of the frozen inputs and frozen assembly rule.

If a future assembly produces a different count from these exact frozen inputs, it is a structural failure and must STOP.

## 6. Incidental cold-start semantics

The 31 incidental finite-choice cases remain in the 120-case corpus.

Do not:

- add a missing historical choice to the target;
- add new History;
- substitute a different historical decision;
- widen finite choices;
- bypass representability validation;
- relax scope;
- relabel the assigned profile;
- manually reassign a target.

Their correct Preference Context has:

`preference_evidence = []`

and:

`cold_start = true`.

These cases are legitimate no-applicable-preference observations created by the frozen random assignment and frozen finite-choice sets.

## 7. Cold-start regression gate

The existing hard gate remains:

`cold-start regressions = 0`.

It applies to **all assembled cases with `cold_start=true`** when no higher current authority controls the decision.

It is not limited to cases originally tagged `cold_start_candidate`.

Explicit User Truth and deterministic Safety remain higher authority as already defined.

## 8. Signal interpretation

The additional cold-start cases reduce Preference exposure.

That reduction must remain visible.

Do not repair it.

Consequences:

- the screen may produce fewer than 10 Preference-caused changed decisions;
- if so, the existing disposition remains `INCONCLUSIVE_LOW_DELTA`;
- low Preference exposure is not grounds for changing Profile, Target, Assignment, History, adjudication, thresholds, or finite choices.

This is a feature of the screen result, not a data defect to optimize away.

## 9. B2C continuation rule

B2C may resume mechanical corpus assembly using the already-frozen five inputs.

The assembler must still filter Preference Evidence only when all are true:

1. assigned profile matches;
2. task matches;
3. evidence precedes target time;
4. frozen `scopeMatches` returns true;
5. evidence decision is present in current finite choices.

Then:

`cold_start = (preference_evidence.length === 0)`.

B2C must validate the exact 55/65 structural constants above.

No resolver or Preference arm may be executed in B2C.

No provider call is authorized in B2C.

## 10. Authorization

After merge of this clarification:

- ZDB-03B2C mechanical signal-corpus assembly — **ACTIVE**
- ZDB-03B3 same-case provider baseline — **NOT ACTIVE until B2C Owner freeze**
- ZDB-03B4 Preference comparison — **NOT ACTIVE**
- >=300 comparative corpus — **NOT ACTIVE**
- ZDB-04+ — **NOT ACTIVE**
- PM-02 — **NOT ACTIVE**

## Final disposition

**B2C STOP ACCEPTED — 55/65 IS THE FROZEN MECHANICAL COVERAGE TRUTH**

No frozen research artifact is to be changed.
