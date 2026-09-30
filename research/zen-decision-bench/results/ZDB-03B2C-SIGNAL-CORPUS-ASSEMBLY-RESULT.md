# ZDB-03B2C — Mechanical Signal Corpus Assembly

Status: **SIGNAL CORPUS CANDIDATE — OWNER FREEZE PENDING**.

**55/65 coverage is the Owner-frozen mechanical truth and must not be tuned.** Issue [#283](https://github.com/ArdenZC/Zen-Canvas/issues/283); clarification [PR #305](https://github.com/ArdenZC/Zen-Canvas/pull/305).

Starting exact clean master after clarification: `0c9a7b36510f2399176f8d79e29c0761f7f50d9c`. Branch: `research/zdb-03b2c-signal-corpus-assembly`. The existing clean worktree `F:\Coding\Zen-Canvas-zdb-03b2c` had no task commits and was fast-forwarded from `399ed11773dcfabfcd869c114f145d1f31cf6049`. No experiment restart occurred.

## Changed files

Paths relative to the repository root:

- `docs/project/STATUS.md`
- `research/zen-decision-bench/preference/README.md`
- `research/zen-decision-bench/preference/signal/assemble-signal-corpus.mjs`
- `research/zen-decision-bench/preference/signal/validate-signal-corpus.mjs`
- `research/zen-decision-bench/preference/signal/signal-corpus.v1.jsonl`
- `research/zen-decision-bench/preference/signal/signal-corpus.v1.manifest.json`
- `research/zen-decision-bench/tests/preference-signal-b2c.test.mjs`
- this result: `research/zen-decision-bench/results/ZDB-03B2C-SIGNAL-CORPUS-ASSEMBLY-RESULT.md`

## Frozen inputs and candidate identity

| Frozen input | Canonical SHA-256 |
| --- | --- |
| Profile | `371519fe7c9f28d3c686e0299c223d64a57b00571777cab498668667498137b1` |
| Target | `96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4` |
| Assignment | `4833443e85bf2a69c74b175b8e618a98eebab6444f1da05418fbf926582d6a0b` |
| History | `c2be8a2949c0daef12fe821010b72ca84ef999deb941a6f8bd0505dc8a7e2f44` |
| Owner blind adjudication | `498a511c4cfba87daaed7db5197c35aed96de34862feede43c500d9eb5d3ad50` |

All five canonical and file hashes passed before assembly and are rechecked by the saved-corpus validator. The manifest records both sets of frozen source identities. The adjudication blob remains `1946fc65c4b2efa2086cfd5d0916eaaea7f5e949`.

- Assembly identity: `zdb-03b2c-mechanical-assembly-v1`.
- Choice-order identity: `zdb-03b-choice-order-v1`.
- Existing case identity: `zdb.case.v1` plus the unchanged Preference Context contract.
- Corpus canonical SHA-256: `0a96faa752b488f9c507ee2d0ca64e439820f85697872a64a5972c2840693349`.
- Corpus file SHA-256: `e10cd216a0f6692511ec0049dccf37b51f306bd39625b858efcbac35ebac3c8a`.
- Manifest status: **CANDIDATE — OWNER CORPUS FREEZE REQUIRED BEFORE B3**. No acceptance or corpus freeze is claimed.

## Cold-start structural clarification

The initial B2C execution **STOPPED before corpus creation** because the execution instruction incorrectly expected 24/96. Owner disposition was merged through **PR #305 before assembly resumed**. The final frozen mechanical expectation is **55/65**.

| Structural category | Count |
| --- | ---: |
| Total cases | 120 |
| Cold-start | 55 |
| Non-cold | 65 |
| Designated novel workspace | 12 |
| Purpose/lifecycle no-history task | 12 |
| Incidental finite-choice filtered | 31 |
| Unexplained scope or other | 0 |
| Missing correction references | 0 |

For every incidental case, structural validation proves a valid primary assigned workspace and at least one profile/task/time/scope-matching episode before finite-choice filtering, with zero representable episodes after filtering. These 31 cases are valid observations, not defects. Cold-start is derived only from the final evidence-list length.

No change was made after the STOP to Profile, Target, Assignment, History, Owner adjudication, Preference thresholds, resolver semantics or finite choices. Only the execution expectation was corrected.

## Aggregate structure

| Task | Total | Cold-start | Non-cold |
| --- | ---: | ---: | ---: |
| existing_folder_choice | 72 | 39 | 33 |
| suggested_action | 36 | 4 | 32 |
| purpose | 6 | 6 | 0 |
| lifecycle | 6 | 6 | 0 |

There are exactly 6 Explicit User Truth contexts and 6 deterministic Safety Rule contexts; no user Rule was added. External control distribution remains 84 ordinary, 12 designated cold-start, 6 explicit-truth, 6 safety and 12 non-intervention cases, reconstructable from the frozen Target mapping.

Attached evidence records across cases: **189**. Per-case count minimum/median/maximum: **0 / 2 / 5**. Contexts with specific-scoped evidence: **30**; non-empty broad-only contexts: **35**. These are structural counts only, not support or recommendation outcomes.

## Validation

- All 120 records pass the accepted `validatePreferenceCase`: **PASS**.
- Exact join, metadata preservation, workspace materialization, finite-choice representability, scope matching, chronology, evidence ordering and correction integrity: **PASS**.
- Independently derived folder choice ordering, unchanged other-task order, no candidate-set mutation: **PASS**.
- Input-order invariance, no source mutation, Profile/adjudication-provenance exclusion: **PASS**.
- Answer/context isolation mutation test: **PASS**. Changing answer metadata and adjudication rationale/authority/tendency fields cannot change input, scope, choices, evidence, current authorities, cold-start or Context.
- History/provider-facing structural isolation: **PASS** for the test-only `task + input + choices` projection. This is not B3's authoritative provider-request proof.
- Closed research dependency graph; no provider, credential, network or resolver import in the assembly/validation path: **PASS**.
- Local structural ZDB suite: **70/70 across 7 files**, including **12 B2C tests**. The existing `preference-hypothesis.test.mjs` resolver/Arm suite was excluded from local B2C execution to preserve assembly-only scope. Hosted CI follows its unchanged repository routing and may run pre-existing conformance tests; that does not execute the B2C corpus through a research arm.
- Existing B2A and blind-adjudication validators: **PASS**.
- Windows Node `24.15.0`; existing shebang scripts needed local LF normalization for Vitest, with original checkout line endings restored and committed blobs unchanged.
- Documentation/governance and `git diff --check`: **PASS**.
- Artifact implementation exact-head hosted CI [36673064442](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36673064442): **SUCCESS** at `bacceb6d2f3e2c58e708b1a24763ce76a9964464`, tree `ce62a77c2f8a5b2f14a56133a32873b825f8af2d`. This result records that validated artifact head; the final documentation-only successor receives fresh exact-head CI separately in Draft PR #306 and the handoff. Local structural tests are bound to the artifact implementation tree.

Commands:

```text
node research/zen-decision-bench/preference/signal/assemble-signal-corpus.mjs
node research/zen-decision-bench/preference/signal/validate-signal-corpus.mjs
node research/zen-decision-bench/preference/signal/validate-b2a.mjs
node research/zen-decision-bench/preference/signal/validate-adjudication.mjs
npm test -- research/zen-decision-bench/tests --exclude **/preference-hypothesis.test.mjs
```

The assembler refuses to overwrite existing output; pure assembly reproduces the committed candidate for validation.

## Scope and next gate

**NO PROVIDER CALL OCCURRED. NO PREFERENCE ARM WAS EXECUTED ON THE B2C CORPUS. NO PREFERENCE EFFECTIVENESS RESULT EXISTS.** No baseline predictions, recommendation simulation, support-level outcomes, accuracy, transitions or Net Benefit were computed. No production code, resolver, thresholds, schema authority, permissions, runtime or dependency change occurred.

B1 is COMPLETE / FROZEN; B2A is COMPLETE / MERGED / ASSIGNMENT + HISTORY FROZEN; B2B is COMPLETE / MERGED / OWNER BLIND ADJUDICATION FROZEN. **ZDB-03B2C remains CANDIDATE pending Owner corpus freeze. ZDB-03B3 remains NOT ACTIVE. ZDB-03B4 remains NOT ACTIVE. ZDB-04+ remain NOT ACTIVE. PM-02 remains NOT ACTIVE.** The >=300 comparative corpus remains NOT ACTIVE.

The branch/worktree and borrowed dependency junction are retained for the open Draft PR's review; shared dependency caches are preserved. Review and merge remain Owner decisions.

**ZDB-03B2C SIGNAL CORPUS CANDIDATE COMPLETE — READY FOR OWNER FREEZE REVIEW**
