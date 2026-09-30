# ZDB-03B2A — Assignment and Pre-Adjudication Blind History Freeze

Status: **B2A COMPLETE — HISTORY HASH FROZEN / OWNER ADJUDICATION PENDING**

**OWNER MUST COMPLETE BLIND ADJUDICATION BEFORE INSPECTING HISTORY CONTENT OR HISTORY GENERATOR SEMANTICS.** This includes History-related test and validator implementation. Structural summaries and manifests are safe to inspect. History is hash-frozen, not Owner-content-reviewed.

Issue: [#283](https://github.com/ArdenZC/Zen-Canvas/issues/283). Starting clean master: `167ef8eee7706bddd6694e021ea0d1c947eba517`; tree: `f51ba8dd8c853efefbd81801ac71bb102812f281` (PR #302 squash merge). Branch: `research/zdb-03b2a-assignment-history`. A new clean worktree on F: was used; the B1 worktree was not reused.

## Assignment freeze

Paths relative to `research/zen-decision-bench/`:

- Schema: `schema/preference-signal-assignment.v1.schema.json`.
- Artifact: `preference/signal/assignment.v1.jsonl`.
- Manifest: `preference/signal/assignment.v1.manifest.json`.
- Builder: `preference/signal/build-assignment.mjs`.

Algorithm: `zdb-03b-assignment-v1`. Hash inputs are the frozen canonical B1 hashes. Seed: `27418e52bb5e483ef523d2cdc1045dfb17a1ec45238b8f0cf67d431f0163bfaf`.

The committed artifact uses zero-based `rank_index`, sorted ascending. There are exactly 120 unique frozen target IDs and exactly 10 assignments per profile. Rank derivation, complete coverage, ordering, fixed profile identity order and both input-order invariance checks pass. No assignment was manually altered, balanced or swapped. Ranking consumes only case IDs and the frozen seed; no semantic fields enter ranking.

- Canonical SHA-256: `4833443e85bf2a69c74b175b8e618a98eebab6444f1da05418fbf926582d6a0b`.
- File SHA-256: `f05291e3bf421538b66ed2caf8ae599f2fcea4ff3e263f9d9088764091d684ef`.

## Blind History freeze — structural facts only

- Schema: `schema/preference-signal-history-episode.v1.schema.json`.
- Artifact: `preference/signal/history.v1.jsonl`.
- Manifest: `preference/signal/history.v1.manifest.json`.
- Builder: `preference/signal/build-history.mjs` — do not inspect semantics before adjudication.
- Count: **288 episodes / exactly 24 per profile**.
- Canonical SHA-256: `c2be8a2949c0daef12fe821010b72ca84ef999deb941a6f8bd0505dc8a7e2f44`.
- File SHA-256: `a463442fcc837bbbfa542a9423b1370cef655c12ffa14e2e3cd3a67d57c6b6af`.
- Nested frozen Preference Evidence shape: **PASS**; its existing contract is unchanged.
- Unique evidence IDs, synthetic provenance, allowed Profile values, exact resolver scope dimensions, chronology and correction-link integrity: **PASS**.
- Builder dependency isolation: **PASS**. History reads only the frozen Profile Pack and shared vocabulary, with fixed research constants; no Target, assignment, adjudication or provider evidence is read.
- Source dependency closure and runtime filesystem allowlist checks: **PASS**. No network access or environment credential is used by either builder.
- State: **FROZEN PRE-ADJUDICATION — OWNER CONTENT BLIND**; **HASH FROZEN — OWNER HAS NOT INSPECTED HISTORY CONTENT**.

No History decisions, support outcomes, resolver simulation or target applicability analysis are reported here. The Owner-content-blind state is preserved by withholding instantiated History from the handoff; it is not an attestation of independent human browsing activity.

## Frozen input verification

| Input | Canonical SHA-256 | Result |
| --- | --- | --- |
| ZDB-01 dataset | `d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68` | PASS |
| ZDB-01 locked test | `4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12` | PASS |
| ZDB-03A conformance | `76abcb22ac4b2aa2f0bc032839fe643a296d25f2f19b266ace16b3f76df1112a` | PASS |
| B1 Profile | `371519fe7c9f28d3c686e0299c223d64a57b00571777cab498668667498137b1` | PASS |
| B1 Target | `96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4` | PASS |

B1 file SHA-256 values remain `211a879964dfa6bccbadd78e4ad739f4d8324a71dbd974f9fc7a81d0f27ed5fe` and `b414f7510345c95e0629f34780dce1125b0f71c12a84cdf5c555d01d1c5217aa`; Git blobs remain `3301adba632a30f6089aa980a560fb90bbfd77ea` and `697c66a4f22990cd101e9064e0eb82fd3d017a39`. Neither JSONL was modified, regenerated or reordered.

## Validation and delivery boundary

Windows / Node 24.15.0 local commands:

```text
node research/zen-decision-bench/preference/signal/validate-packs.mjs
node research/zen-decision-bench/preference/signal/validate-b2a.mjs assignment
node research/zen-decision-bench/preference/signal/validate-b2a.mjs history
npm test -- research/zen-decision-bench/tests
$env:DOCS_DIFF_BASE="167ef8eee7706bddd6694e021ea0d1c947eba517"; npm run test:docs
```

The local ZDB suite passes **81/81 across 6 files**, including 12 B2A tests. An initial Windows CRLF/shebang transform failure in existing B1 scripts was resolved by local LF normalization without changing their committed blobs. Builders refuse to overwrite existing frozen output; pure functions support reproducibility checks. Manifest structural PASS records a completed separate validation, not Owner review. Exact final commit/tree and hosted CI are bound in the Draft PR handoff; local working-tree results do not substitute for hosted exact-head CI.

No production code, dependency, resolver, schema authority, runtime, UI, permission or provider contract changes. No provider credentials or calls. No Owner Adjudication, gold, target Preference Context, final target scopes, novel target workspace materialization, assembled signal corpus, same-case baseline, Arms B/C/D or signal-screen result was created or executed.

B1 is **COMPLETE / FROZEN**. B2A is **ASSIGNMENT + HISTORY HASH FROZEN / OWNER ADJUDICATION PENDING**. **ZDB-03B2 remains ACTIVE for blind Owner adjudication. ZDB-03B3/B4 remain NOT ACTIVE. ZDB-03 Stage-B >=300 comparative corpus, ZDB-04+ and PM-02 remain NOT ACTIVE.**

The branch/worktree is retained for the open Draft PR and later Owner disposition. No merge is authorized.

**ZDB-03B2A ASSIGNMENT + BLIND HISTORY FREEZE COMPLETE — READY FOR OWNER BLIND ADJUDICATION**
