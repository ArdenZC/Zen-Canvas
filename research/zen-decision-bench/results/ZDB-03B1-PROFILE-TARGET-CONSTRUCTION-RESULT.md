# ZDB-03B1 — Synthetic Profile and Target Pack Construction

Status: **OWNER REVIEW PASSED — PROFILE + TARGET PACKS FROZEN FOR ZDB-03B2 INPUT**. Owner re-review passed at `020b2270464a2c6b7cf98c886d3f5293e2e41b65` after closing the exact resolver-compatible scope bridge and target-relative file-time blockers. These are frozen research inputs for issue #283, not an assembled signal corpus or effectiveness result.

## Identity and scope

- Starting clean master: `f4cd11d03ff95cf33590b712913018d71396b424` (PR #301 squash merge; tree `a0ae8fc9838b00ae4971d177eb4ea105ba2c3f82`).
- Branch: `research/zdb-03b1-profile-target-construction`.
- Changed files: `docs/project/STATUS.md`; `research/zen-decision-bench/preference/README.md`; `research/zen-decision-bench/preference/signal/{.gitattributes,vocabulary.mjs,build-profiles.mjs,build-targets.mjs,validate-packs.mjs,profiles.v1.jsonl,profiles.v1.manifest.json,targets.v1.jsonl,targets.v1.manifest.json}`; `research/zen-decision-bench/schema/{preference-signal-profile.v1.schema.json,preference-signal-target.v1.schema.json}`; `research/zen-decision-bench/tests/preference-signal-b1.test.mjs`; this result.
- No production code, schema, runtime, UI, dependency, resolver, or support-threshold change.

## Candidate pack identities

| Pack | File | Schema | Records | Canonical SHA-256 | File SHA-256 |
| --- | --- | --- | ---: | --- | --- |
| Profile | `preference/signal/profiles.v1.jsonl` | `zdb.preference_signal_profile.v1` | 12 | `371519fe7c9f28d3c686e0299c223d64a57b00571777cab498668667498137b1` | `211a879964dfa6bccbadd78e4ad739f4d8324a71dbd974f9fc7a81d0f27ed5fe` |
| Target | `preference/signal/targets.v1.jsonl` | `zdb.preference_signal_target.v1` | 120 | `96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4` | `b414f7510345c95e0629f34780dce1125b0f71c12a84cdf5c555d01d1c5217aa` |

The Profile Pack has IDs `profile-01`–`profile-12`, 12 distinct primary workspace IDs, and 12 distinct tendency sets. Every profile has four folder-choice tendencies, three suggested-action tendencies, and at least one explicit exception. Total tendencies: 48 folder + 36 action = 84. They are qualified soft habits with no numeric weights, probabilities, confidence, case references, or deterministic Rule authority.

The B1-local `.gitattributes` keeps the two JSONL packs at LF on Windows and macOS/Linux checkouts, so their recorded file hashes identify the same bytes across platforms. It does not touch the frozen legacy corpora.

The Target Pack has contiguous IDs `zdb03b-target-001`–`zdb03b-target-120`. The exact task distribution is 72 `existing_folder_choice`, 36 `suggested_action`, 6 `purpose`, 6 `lifecycle`, 0 `domain_type`, and 0 `risk_level`. The 108 folder/action cases comprise 84 ordinary preference-signal candidates, 12 mutually exclusive cold-start candidates, 6 current Explicit User Truth controls, and 6 deterministic safety controls. The 12 purpose/lifecycle cases are `non_intervention_control`.

Cold-start candidates use symbolic `assigned_profile_novel`; the other cases use `assigned_profile_primary`. Those modes contain no concrete workspace assignment. Current Explicit User Truth and deterministic safety Rule fixtures are structurally separate from Preference and are not benchmark adjudication. Safety controls choose the valid conservative `review` action.

## Owner blocker remediation: exact scope and current-file times

The shared, bounded signal `parent_family` vocabulary is `authored_learning`, `received_learning`, `active_work`, `completed_work`, `reusable_reference`, `personal_admin`, `financial_documents`, `media_assets`, `ambiguous_inbox`, `project_reference`, `teaching_study_crossover`, `stale_material`. Purpose and lifecycle controls use dedicated `purpose_control` and `lifecycle_control` identities that no Profile tendency can carry. Every Profile tendency now has a required `scope_parent_family`; its `context_tags` remain human explanation only. Every folder/action Target's `scope_template.parent_family` is its independently authored scenario family. B2 can place that exact value into the existing resolver `parent_family` scope without changing resolver semantics or inventing fuzzy/tag matching. B1 does not construct that evidence or an assignment.

| Signal family | Profile tendencies | Folder/action targets |
| --- | ---: | ---: |
| `authored_learning` | 8 | 9 |
| `received_learning` | 2 | 9 |
| `active_work` | 11 | 9 |
| `completed_work` | 11 | 9 |
| `reusable_reference` | 12 | 9 |
| `personal_admin` | 6 | 9 |
| `financial_documents` | 5 | 9 |
| `media_assets` | 6 | 9 |
| `ambiguous_inbox` | 11 | 9 |
| `project_reference` | 1 | 9 |
| `teaching_study_crossover` | 3 | 9 |
| `stale_material` | 8 | 9 |

The Profile column totals 84 (48 folder and 36 action tendencies). Within every profile, its four folder families are distinct and its three action families are distinct, so no task+family scope has conflicting preferred values. Target controls add 6 `purpose_control` and 6 `lifecycle_control` cases; they cannot match Profile family scope. The full 120-case task/control distributions are unchanged.

Each Target inventory item now carries its own authored age relative to `2026-09-25T12:00:00Z`; `modified_at_fs` is computed from that age. All 120 mtimes precede their target decision time. Age distribution: **48 recent (0–30 days), 51 intermediate (31–180 days), 21 old (>180 days)**; minimum **1**, median **50**, maximum **510** days. For example, `new-reading-packet.pdf` is 1 day old and `working-brief.docx` is 4 days old, while `superseded-budget.xlsx` is 275 days old and `old-onboarding-guide.pdf` is 400 days old. The ages describe current-item situations; they are not answer fields or derived from a Profile, gold, adjudication, provider, or resolver output.

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

- Candidate pack validator: **PASS**, 12 profiles and 120 targets; manifest canonical/file hashes, exact task/control counts, exact scope-family coverage, target-relative ages, folder frequencies, symbolic scopes, control fixtures, duplicate fingerprints, and candidate state verified.
- Local ZDB Vitest suite: **69/69 PASS across 5 files**, including 13 B1 tests.
- Frozen ZDB-01 dataset canonical SHA-256: `d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68` — unchanged.
- Frozen ZDB-01 locked test canonical SHA-256: `4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12` — unchanged.
- ZDB-03A conformance fixture canonical SHA-256: `76abcb22ac4b2aa2f0bc032839fe643a296d25f2f19b266ace16b3f76df1112a` — unchanged. Git blob `e4bbc0418a788dfa81a59b521142c73ba4d0a879` retains file SHA-256 `1f047dd3f1afacd8821103cb8091965bb27f68fe429589de42fea9241d83d0f3`. The 60-case validator passed on an exact temporary Git-blob copy, then that copy was removed. With `core.autocrlf=true`, the Windows worktree's CRLF copy has different raw bytes; the committed Git blob is the frozen authority.
- Documentation/governance gate: **PASS** for the 3 changed Markdown files against the staged candidate tree; project governance validation passed.
- Reviewed previous-head hosted CI: [36610747567](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36610747567) — **SUCCESS** at `8fca3508a63400c3169255ab42299ac55678c282`. This does not validate the remediated head; its fresh exact-head CI is recorded in PR #302 and the handoff.

## Next gate

**Owner re-review passed and both B1 pack hashes are frozen.** Merge of PR #302 activates **ZDB-03B2 — deterministic profile assignment + History Pool + separate Owner Adjudication construction** only. ZDB-03B3 live same-case provider baseline, ZDB-03B4 Preference comparison, the >=300-case comparative corpus, ZDB-04+, and PM-02 remain **NOT ACTIVE**. B2 must not mutate either frozen JSONL pack.
