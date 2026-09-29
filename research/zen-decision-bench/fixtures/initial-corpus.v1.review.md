# ZDB Initial Corpus V1 — First-Pass Semantic Review

Status: **OWNER ADJUDICATED — CORPUS FROZEN FOR ZDB-02 BASELINE**

This document records the accepted review of the original 120-case draft plus a first-pass review of the 60-case pilot expansion.
The 30-case test split is locked and the full 180-case corpus is now owner-adjudicated and frozen for ZDB-02 baseline measurement.

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

- 180 total cases.
- Six task families × 30 total cases each.
- 120 pilot / 30 dev / 30 test.
- 20 pilot cases per required task family.
- Synthetic provenance only.
- No non-gold abstention permission.
- Production canonical Purpose/Lifecycle/Risk/SuggestedAction choice coverage.
- Original 120 labels owner-accepted; the added 60 pilot labels were accepted after a second-pass cross-corpus consistency review.

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

## Original 120 disposition

The original 120-case labels were accepted by the owner on 2026-09-29. The original 30-case test split from that accepted corpus is now separately hash-locked. This acceptance does not extend to the later 60-case pilot expansion, which remains pending owner adjudication.


## Pilot minimum reconciliation

The Phase 1 activation requires the **pilot corpus itself** to contain at least 120 adjudicated finite-choice cases and at least 20 cases per required task family.

The original corpus had 120 total cases but only 60 pilot cases. The pilot was therefore expanded by 60 synthetic cases:

- 120 pilot / 30 dev / 30 test;
- 20 pilot cases per each of the six required task families;
- 180 total cases;
- zero exact duplicate or cross-split leakage under the ZDB content fingerprint.

First-pass expansion corrections:

- `domain-30 disk-image.iso`: `ArchivePackage` is an acceptable alternate to `Other`;
- `folder-29 voice-recording.m4a`: changed Personal/Audio -> `abstain` because Work/Meetings vs Personal/Audio is not justified by metadata alone;
- `folder-28` and `folder-30` remain gold-abstain material-ambiguity cases.

## Test split lock

The owner-accepted 30-case test split was not modified by the pilot expansion.

- test case count: **30**
- locked test split hash: `4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12`
- lock source: `master@c80bdc7ba0c67a541abde79505dc5af0d3dc1e98`

The test split must not be used for prompt tuning, threshold fitting, mapping changes, calibration fitting, preference construction, or case-specific repair.

## Second-pass owner adjudication

The 60-case pilot expansion was re-reviewed against the original 120-case decision standard before freeze.

Cross-corpus consistency checks confirmed:

- personal media remains `Normal` unless metadata places it in a clearly private/sensitive context;
- unknown executable/driver/firmware-like artifacts remain conservative (`Caution` or `Unknown`) rather than being promoted to safe;
- Downloads items with clear semantics remain `Move`, while materially unknown items remain `Review`;
- ambiguous existing-folder choices remain `abstain` rather than forcing a preference;
- no new case was allowed to use abstention unless `gold=abstain`.

No further gold-label changes were required after the first-pass pilot-expansion corrections.

Owner disposition on 2026-09-29: **ACCEPTED**.

## Freeze disposition

The finite-choice corpus is frozen for ZDB-02 baseline work:

- total cases: **180**
- pilot/dev/test: **120 / 30 / 30**
- pilot cases per required task family: **20**
- frozen dataset hash: `d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68`
- locked test split hash: `4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12`
- exact duplicate / cross-split leakage: **0**

Any future change to case facts, choices, labels, acceptable alternates, ambiguity, abstention permission, or split membership requires an explicit dataset version/change and a new hash. It must not silently mutate this frozen evidence.

Next gate:

1. execute the real current-Generative baseline on **pilot only**;
2. persist predictions and reproducibility metadata;
3. review accuracy, acceptable accuracy, abstention, unsafe-overclaim, provider failures, latency, calibration, and available cost/accounting;
4. keep the locked test split untouched by prompt/mapping/threshold/calibration/preference tuning;
5. owner-review ZDB-01/ZDB-02 evidence before ZDB-03 activation.
