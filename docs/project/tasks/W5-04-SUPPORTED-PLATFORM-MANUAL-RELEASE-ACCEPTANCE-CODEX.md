# W5-04 — Supported-Platform Manual Release Acceptance — Codex / QA Brief

Status: **AUTHORIZED WHEN THIS ACTIVATION MERGES — MANUAL / REAL-PLATFORM EVIDENCE TRACK**

Baseline: `master@567e7a35c46f3b5e8f965198fa7675412a519324`; tree `26273a82b74ff257912354722c3061354fb5e640`.

Suggested branch: `docs/w5-04-supported-platform-manual-release-acceptance`.

## Objective

Collect truthful real-platform evidence for the **manual first-release lifecycle selected by W5-03** without manufacturing PASS claims for unavailable fixtures.

W5-04 is primarily a QA/evidence Track. It does not authorize a new feature wave, updater implementation, production signing/notarization, schema change, package-version bump, Git tag or GitHub Release.

The Track answers one release question:

> If Zen Canvas is distributed manually as the currently intended unsigned Windows NSIS and Apple-Silicon macOS DMG, what does a real user actually experience when downloading, installing/copying, first-launching and using the release candidate on the supported platforms?

## Required read set

Before producing or interpreting evidence, read:

1. `AGENTS.md`
2. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/initiatives/W5-release-hardening.md`
6. `docs/project/DEVELOPMENT_WORKFLOW.md`
7. `docs/project/tasks/W5-02-RELEASE-QUALIFICATION-PUBLICATION-SAFETY-RESULT.md`
8. `docs/project/tasks/W5-03-DISTRIBUTION-UPDATE-STRATEGY-RESULT.md`
9. `docs/project/tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md`
10. `docs/project/tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md`
11. `.github/workflows/ci-full.yml`
12. `.github/workflows/release-build.yml`
13. `src-tauri/tauri.conf.json`
14. current official Windows/macOS documentation when interpreting SmartScreen, Unknown Publisher, Gatekeeper or quarantine behavior.

## Frozen release-policy facts

- Supported Windows artifact: x64 NSIS.
- Supported macOS artifact: Apple-Silicon DMG, macOS 13+.
- First-release update/distribution model: manual download/install through GitHub Releases after a later W5-06 publication decision.
- Windows Authenticode is intentionally not provided in the current horizon.
- Apple Developer ID / notarization / stapling are intentionally not provided in the current horizon.
- No in-app updater exists.
- No release/tag exists yet.
- Package success does not imply SmartScreen/Gatekeeper/reputation acceptance.
- Same-version macOS replacement evidence from W4 does not imply a real cross-version upgrade PASS.

## Evidence tiers

W5-04 must keep these three tiers distinct.

### Tier A — first-release manual-path evidence — required before W5-04 may close

#### Windows supported host

Use a real supported x64 Windows host and an actual W5-04 release-candidate NSIS artifact.

Record:

1. exact source commit/tree used to produce the artifact;
2. workflow/build provenance or exact local build provenance;
3. installer filename, byte size and SHA-256;
4. acquisition path — especially whether the artifact was browser-downloaded / carries Internet Zone information;
5. whether SmartScreen appears; exact visible outcome if it does;
6. whether Windows identifies the publisher as unknown/unverified for the intentionally unsigned installer;
7. whether installation can proceed through the truthful user-visible warning path without disabling Windows security globally;
8. installed app launches successfully;
9. basic primary-window interaction works after install;
10. uninstall/cleanup does not introduce a new defect relative to the already accepted W4 lifecycle.

Do not claim `SmartScreen PASS` merely because SmartScreen does not appear on a locally built/non-Internet-zone artifact. Record `NOT OBSERVED / acquisition did not exercise reputation path` when that is the truth.

#### macOS supported host

Use a real Apple-Silicon macOS 13+ host and an actual W5-04 release-candidate DMG artifact.

Record:

1. exact source commit/tree used to produce the artifact;
2. workflow/build provenance or exact local build provenance;
3. DMG filename, byte size and SHA-256;
4. macOS version, Apple-Silicon architecture and acquisition path;
5. quarantine metadata where observable (`xattr` evidence is allowed as supporting evidence);
6. DMG mount and app copy to an isolated or intended Applications location;
7. first GUI launch attempt and exact Gatekeeper/user-visible result;
8. if the normal user override/open path is used, record the exact path rather than calling the first launch a PASS;
9. app launches successfully after the accepted user-visible warning/override path;
10. basic primary-window interaction works;
11. copied app removal and DMG detach remain sane.

Do not claim Developer ID, notarization, stapling or Gatekeeper reputation acceptance. An ad-hoc/linker signature is not production signing evidence.

### Tier B — selected genuine native/manual smoke — required where a real supported host is available

The goal is not broad accessibility certification. Exercise a small release-facing smoke that W4 could not honestly claim:

#### Windows

- genuine keyboard traversal/focus sanity in the main Zen window;
- genuine Explorer Preview Handler focus/keyboard sanity for an accepted text/source type;
- Narrator smoke for the primary application shell and one Preview state if Narrator is available;
- one real DPI/display-scale scenario; multi-display only when a second display is genuinely available.

#### macOS

- genuine keyboard/focus sanity in the main Zen window;
- VoiceOver smoke for the primary application shell and one Preview state if VoiceOver is available;
- one real Retina/display-scale scenario; multi-display only when a second display is genuinely available.

Record observations narrowly. `screen reader can identify primary controls in the exercised state` is acceptable evidence; `accessibility compliant` is not.

### Tier C — fixture-conditional evidence — do not fabricate

These remain evidence obligations only when genuine fixtures exist:

- real iCloud / generic File Provider source;
- external APFS volume;
- external exFAT volume;
- SMB/network volume;
- additional provider/network-volume native Preview behavior;
- genuine multi-display behavior when no second display is available;
- real older-release → newer-release cross-version update/upgrade.

If a genuine fixture is unavailable, record `UNVERIFIED — fixture unavailable` with the missing fixture. Do not create synthetic path names or local folders and relabel them as iCloud/SMB/external-volume evidence.

Cross-version upgrade remains `DEFERRED / NO REAL OLDER PUBLIC RELEASE FIXTURE` until an actual prior release exists.

## Release-candidate artifact preparation

Preferred evidence path:

1. choose one exact W5-04 candidate commit and freeze it for the manual run;
2. obtain successful exact-SHA `CI Full Validation` for that commit;
3. run `Build Release Installers` via `workflow_dispatch` on the same commit/ref — this does **not** publish a GitHub Release because the publish job only runs on a `v*` tag;
4. download the uploaded Windows/macOS workflow artifacts through the normal browser/UI path;
5. record workflow run ID, artifact IDs, installer filenames, sizes and hashes before manual testing.

If the GitHub workflow cannot be dispatched from the available environment, a target-native exact-SHA local build may be used for installation/function smoke, but any reputation/quarantine result that depends on Internet acquisition must be classified accordingly. A local build is not silently equivalent to a browser-downloaded public artifact.

Do not create a tag or GitHub Release just to obtain manual evidence.

## Manual evidence record format

Create the W5-04 result only from actually observed facts. For each observation use one of:

- `PASS` — the stated bounded behavior was actually exercised successfully;
- `FAIL` — exercised and failed;
- `OBSERVED` — descriptive warning/reputation/UI result that is not meaningfully pass/fail;
- `NOT OBSERVED` — the expected conditional surface did not appear under the stated acquisition/environment;
- `UNVERIFIED` — not executed or required fixture unavailable;
- `DEFERRED` — intentionally postponed with reason/owner.

Every platform record should include:

```text
source SHA / tree:
artifact workflow/build:
artifact ID if hosted:
filename:
bytes:
SHA-256:
host OS/build:
architecture:
acquisition path:
install/copy result:
first-launch result:
warning/reputation observation:
launch result:
basic interaction result:
accessibility/focus smoke:
display smoke:
cleanup/uninstall result:
fixtures unavailable:
new defects:
evidence attachments/notes:
```

Screenshots are useful supporting evidence for user-visible warnings, but text must still state exactly what was observed. Do not treat screenshots alone as proof of unrelated lifecycle behavior.

## Failure handling

A real defect discovered by Tier A is release-blocking until contained/reviewed if it prevents normal supported-host install/copy/launch/uninstall or creates an unsafe/misleading distribution flow.

Do not automatically turn every Tier B/C unverified item into a release blocker. Classify by materiality:

- demonstrated product defect → fix/review;
- required first-release manual-path evidence missing → W5-04 remains open;
- optional real-fixture evidence unavailable → remain `UNVERIFIED` and carry forward truthfully;
- non-material polish observation → record separately; do not widen W5-04 into a feature wave.

## Non-goals

W5-04 MUST NOT:

- add production signing/notarization infrastructure;
- add an updater/update channel;
- weaken OS security settings globally to manufacture a PASS;
- create a tag/GitHub Release merely for testing;
- bump the version solely to manufacture a cross-version test;
- require fake iCloud/SMB/external-volume fixtures;
- claim full accessibility certification;
- redesign the Windows Preview Handler or macOS native Preview architecture absent a demonstrated defect;
- bundle unrelated technical-debt cleanup.

## Stop conditions

Stop and report evidence instead of broadening scope if:

- the unsigned Windows installer cannot be installed/launched through a normal user-visible warning path on the supported host;
- the unsigned macOS app cannot be launched through the documented user-visible Gatekeeper path on the supported host;
- a real manual test reveals data loss, unsafe filesystem mutation, broken uninstall/repair ownership or another P0/P1 defect;
- package identity cannot be bound to one exact source candidate;
- acquiring an artifact for reputation testing would require publishing a real release/tag prematurely.

## Acceptance / expected closeout

W5-04 may close when:

- Tier A Windows evidence is recorded truthfully;
- Tier A macOS evidence is recorded truthfully;
- selected Tier B smoke has been attempted on the available supported hosts and gaps are explicitly classified;
- Tier C unavailable fixtures remain explicit rather than fabricated;
- no unresolved release-blocking defect remains;
- release/tag still equal none;
- W5-05 is either activated only if evidence makes additional long-session/performance work material, or explicitly skipped/not required before W5-06 when existing evidence remains sufficient.

W5-04 does not itself authorize W5-06 publication.
