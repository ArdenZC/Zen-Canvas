# ZDB-03B1 — Synthetic Profile and Target Pack Construction

Status: **CANDIDATE — OWNER REVIEW REQUIRED**. These are research instruments for issue #283, not an assembled signal corpus or effectiveness result. Neither pack is frozen or Owner-accepted.

## Identity and scope

- Starting clean master: `f4cd11d03ff95cf33590b712913018d71396b424` (PR #301 squash merge; tree `a0ae8fc9838b00ae4971d177eb4ea105ba2c3f82`).
- Branch: `research/zdb-03b1-profile-target-construction`.
- Changed files: `docs/project/STATUS.md`; `research/zen-decision-bench/preference/README.md`; `research/zen-decision-bench/preference/signal/{.gitattributes,vocabulary.mjs,build-profiles.mjs,build-targets.mjs,validate-packs.mjs,profiles.v1.jsonl,profiles.v1.manifest.json,targets.v1.jsonl,targets.v1.manifest.json}`; `research/zen-decision-bench/schema/{preference-signal-profile.v1.schema.json,preference-signal-target.v1.schema.json}`; `research/zen-decision-bench/tests/preference-signal-b1.test.mjs`; this result.
- No production code, schema, runtime, UI, dependency, resolver, or support-threshold change.

## Candidate pack identities

| Pack | File | Schema | Records | Canonical SHA-256 | File SHA-256 |
| --- | --- | --- | ---: | --- | --- |
| Profile | `preference/signal/profiles.v1.jsonl` | `zdb.preference_signal_profile.v1` | 12 | `e5fa7efa3aecf870c2cad899bf333141b4c651866483281b0a0eab7e79a96103` | `37d67d8f5ba0bbcd7315a7b456cc8f9577af188933ee669e351348de1034ad48` |
| Target | `preference/signal/targets.v1.jsonl` | `zdb.preference_signal_target.v1` | 120 | `9cefaa0ca0841caef41966bae86ebf3da1e4f89b7d99a5d45c87400e2203b278` | `23067f3d1a350af790fc2ca7bc8658fbe2515005bfc2d3a80128cfe224ca0fed` |

The Profile Pack has IDs `profile-01`–`profile-12`, 12 distinct primary workspace IDs, and 12 distinct tendency sets. Every profile has four folder-choice tendencies, three suggested-action tendencies, and at least one explicit exception. Total tendencies: 48 folder + 36 action = 84. They are qualified soft habits with no numeric weights, probabilities, confidence, case references, or deterministic Rule authority.

The B1-local `.gitattributes` keeps the two JSONL packs at LF on Windows and macOS/Linux checkouts, so their recorded file hashes identify the same bytes across platforms. It does not touch the frozen legacy corpora.

The Target Pack has contiguous IDs `zdb03b-target-001`–`zdb03b-target-120`. The exact task distribution is 72 `existing_folder_choice`, 36 `suggested_action`, 6 `purpose`, 6 `lifecycle`, 0 `domain_type`, and 0 `risk_level`. The 108 folder/action cases comprise 84 ordinary preference-signal candidates, 12 mutually exclusive cold-start candidates, 6 current Explicit User Truth controls, and 6 deterministic safety controls. The 12 purpose/lifecycle cases are `non_intervention_control`.

Cold-start candidates use symbolic `assigned_profile_novel`; the other cases use `assigned_profile_primary`. Those modes contain no concrete workspace assignment. Current Explicit User Truth and deterministic safety Rule fixtures are structurally separate from Preference and are not benchmark adjudication. Safety controls choose the valid conservative `review` action.

## Folder coverage

All eight transferable semantic folder IDs use the Owner-frozen labels. Frequency counts how often an ID appears among the 72 folder target candidate sets:

| Folder ID | Frequency |
| --- | ---: |
| `archive` | 34 |
| `finance` | 17 |
| `media` | 16 |
| `personal` | 24 |
| `reference` | 46 |
| `study` | 29 |
| `teaching` | 22 |
| `work` | 40 |

Each folder target has three or four candidates stored in lexicographic ID order. The full choice-set frequency table is:

| Choice IDs (lexicographic) | Cases |
| --- | ---: |
| archive, finance, work | 4 |
| archive, study, teaching | 4 |
| reference, teaching, work | 4 |
| archive, finance, personal | 3 |
| archive, media, work | 3 |
| archive, reference, study | 3 |
| archive, reference, work | 3 |
| finance, reference, work | 3 |
| media, reference, work | 3 |
| reference, study, work | 3 |
| study, teaching, work | 3 |
| archive, personal, reference, work | 2 |
| archive, personal, work | 2 |
| archive, reference, study, teaching | 2 |
| finance, personal, reference | 2 |
| media, personal, reference | 2 |
| media, reference, teaching | 2 |
| personal, reference, study | 2 |
| personal, reference, work | 2 |
| reference, study, teaching | 2 |
| reference, study, teaching, work | 2 |
| archive, finance, personal, reference | 1 |
| archive, finance, personal, work | 1 |
| archive, finance, reference, work | 1 |
| archive, media, personal | 1 |
| archive, media, reference | 1 |
| archive, personal, study | 1 |
| archive, reference, study, work | 1 |
| archive, reference, teaching | 1 |
| finance, personal, work | 1 |
| finance, reference, study | 1 |
| media, personal, reference, work | 1 |
| media, personal, study | 1 |
| media, reference, study | 1 |
| media, study, teaching | 1 |
| personal, reference, study, work | 1 |
| personal, study, teaching | 1 |

Maximum repeated choice-set frequency: **4/72**, below the **12/72** ceiling. The action targets retain the accepted canonical ZDB action choice set and order, including `review` and conservative options.

## Independence and evidence boundary

`build-profiles.mjs` constructs only latent profiles and does not read the Target Pack or any target ID. `build-targets.mjs` constructs only current situations and does not read the Profile Pack or any profile ID. Both are deterministic, use only a shared frozen vocabulary and research hash helper, and make no network request. Source-level dependency tests and functional artifact/hash tests pass. Current input metadata uses neutral synthetic Inbox/Downloads parents; no file contents or personal filesystem history is used. Target content fingerprints are unique and distinct from the frozen ZDB-03A cases.

No profile-to-target assignment, assignment seed/map, History Pool, target Preference Evidence or `preference_context`, target gold/acceptable/abstention truth, Owner Adjudication, assembled signal corpus, same-case Generative baseline, provider request, or Preference Arm result exists in B1. No provider call occurred. The Target Pack has no adjudicated answer field; the schema rejects extra fields.

## Validation and frozen sources

- Candidate pack validator: **PASS**, 12 profiles and 120 targets; manifest canonical/file hashes, exact task/control counts, folder frequencies, symbolic scopes, control fixtures, duplicate fingerprints, and candidate state verified.
- Local ZDB Vitest suite: **66/66 PASS across 5 files**, including 10 B1 tests.
- Frozen ZDB-01 dataset canonical SHA-256: `d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68` — unchanged.
- Frozen ZDB-01 locked test canonical SHA-256: `4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12` — unchanged.
- ZDB-03A conformance fixture canonical SHA-256: `76abcb22ac4b2aa2f0bc032839fe643a296d25f2f19b266ace16b3f76df1112a` — unchanged. Git blob `e4bbc0418a788dfa81a59b521142c73ba4d0a879` retains file SHA-256 `1f047dd3f1afacd8821103cb8091965bb27f68fe429589de42fea9241d83d0f3`. The 60-case validator passed on an exact temporary Git-blob copy, then that copy was removed. With `core.autocrlf=true`, the Windows worktree's CRLF copy has different raw bytes; the committed Git blob is the frozen authority.
- Documentation/governance gate: **PASS** for all three changed Markdown files against the staged candidate tree; project governance validation passed.
- B1 source-head hosted CI: [36591770466](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36591770466) — **SUCCESS** at `22567d12350416a790674a93712a7b5583f90cad` (the head containing both candidate packs and the B1-local LF rule). This CI-record update is documentation-only; its final successor head requires its own exact-head CI, reported in PR #302 and the handoff.

## Next gate

**Owner review of both candidate packs is required before freezing their hashes or beginning B2.** ZDB-03B remains authorized only through B1 pending Owner review. ZDB-03B2/B3/B4, the >=300-case comparative corpus, ZDB-04+, and PM-02 remain **NOT ACTIVE**.
