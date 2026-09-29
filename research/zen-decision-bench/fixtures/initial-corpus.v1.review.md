# ZDB Initial Corpus V1 — First-Pass Semantic Review

Status: **FIRST_PASS_COMPLETE — OWNER_ADJUDICATION_PENDING**

This document records a manual semantic review of the 120-case construction draft.
It does **not** freeze the corpus and does **not** upgrade it to accepted benchmark evidence.

## Review rules

- Judge only from metadata represented in the case: filename, extension, size, modified time, parent path, and finite choices.
- Do not assume hidden file contents.
- Prefer conservative Zen semantics where evidence is insufficient.
- `Unknown`, `Review`, and `abstain` remain distinct:
  - `Unknown` is a valid production semantic enum where available;
  - `Review` is a valid production suggested action;
  - `abstain` is a benchmark decision only when the finite choice cannot be justified from supplied evidence.
- For safety-sensitive alternatives, conservative output may be listed in `acceptable` without changing the primary gold label.
- Existing-folder choices must not be injected into the live Managed AI request. They are evaluation-only.

## Structural result

- 120 total cases.
- Six task families × 20 cases each.
- 60 pilot / 30 dev / 30 test.
- Synthetic provenance only.
- No non-gold abstention permission.
- Production canonical Purpose/Lifecycle/Risk/SuggestedAction choice coverage.

## First-pass corrections

1. `action-17 draft-v2.docx @ Work/Drafts`
   - changed `MoveAndRename` → `Keep`;
   - rationale: current folder and filename do not justify an unsolicited move/rename.

2. `folder-02 database-exam.pdf`
   - changed Study/Database → `abstain`;
   - rationale: Teaching/Database and Study/Database are both materially plausible from metadata alone.

3. `folder-15 uml-notes.md`
   - changed Teaching/UML → `abstain`;
   - rationale: Teaching/UML and Study/UML are materially indistinguishable from metadata alone.

4. Conservative acceptable alternates added:
   - `action-05`, `action-06`: `Move` accepted alongside `MoveAndRename`;
   - `action-13`, `action-14`, `action-20`: `Review` accepted alongside `DeleteCandidate`;
   - `folder-01`: Study/Scala accepted alongside Teaching/Scala.

## Cases intentionally left bounded

The following remain intentionally bounded rather than forced into artificial certainty:

- domain: 18, 19, 20;
- purpose: 07, 08, 16, 19;
- lifecycle: 08, 15, 16;
- risk: 13, 15, 16, 19;
- suggested action: 05, 06, 13, 14, 20;
- existing folder: all non-material folder-choice cases are bounded because user filing preference is not yet modeled.

## Owner gate before freeze

Before setting `frozen=true` or locking the test split:

1. owner accepts or edits the semantic labels/acceptable alternatives;
2. final validator output and dataset hash are recorded in the manifest;
3. test split is marked locked;
4. no prompt, mapping, threshold, or preference tuning uses the locked test split;
5. the first real Generative run is executed on pilot only;
6. ZDB-01/02 evidence is reviewed before ZDB-03 activation.
