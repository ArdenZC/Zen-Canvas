# W5-01 — Release Baseline & Gap Audit — Codex / Agent Brief

Status: **AUTHORIZED / NEXT after W5-00 merge — evidence/governance first**

Baseline: the exact W5-00 activation merge on `master`; resolve the SHA at execution start and do not work from an earlier baseline.

Suggested branch: `docs/w5-01-release-baseline-gap-audit`

W5-01 is the first W5 execution Track. Its purpose is to determine the real release-hardening queue from current production and evidence truth. It is not a release publication task and it must not start by modifying product code.

## 0. Required read set

Read the W5-00 required set first, then inspect current owners for:

- package/version/config state (`package.json`, Tauri config, Cargo metadata and platform package files);
- GitHub Actions release/package/quality/performance routing;
- current Windows NSIS and Preview Handler installation/registration ownership;
- current macOS DMG/hardened-runtime/signing/notarization configuration;
- update mechanism and any current updater/channel configuration;
- current supported-platform runtime capability truth;
- W1-W4 performance/resource/manual/native evidence records;
- current accessibility/keyboard/display evidence;
- current provider/external/network-volume fixture evidence;
- current technical-debt and risk registers;
- current GitHub release/tag state.

Use current repository/config/tool evidence. Do not infer release readiness from planning prose alone.

## 1. Objective

Produce one answer-first release baseline that says, for every material W5 requirement:

1. what exists now;
2. what evidence actually passed;
3. what is merely packaged versus actually released;
4. what is `UNVERIFIED`, `DEFERRED`, `BLOCKED` or `TARGET MISSED`;
5. whether the gap is a release blocker, high-priority hardening item, optional polish item or accepted defer;
6. which bounded downstream W5 Track should own it.

The output must make the next implementation work obvious without inventing evidence or turning W5 into a general cleanup program.

## 2. Required release-state vocabulary

Every audited row must use the narrowest truthful state:

- **Implemented** — production code/config exists;
- **Validated** — required automated/manual evidence passed for the stated matrix;
- **Packaged** — the intended package artifact was produced and inspected;
- **Released** — a real publication/tag/release action occurred;
- **UNVERIFIED** — evidence is required but unavailable/not executed;
- **DEFERRED** — intentionally postponed with owner/reason;
- **BLOCKED** — external or dependency blocker prevents completion;
- **TARGET MISSED** — measurement ran and missed the accepted target.

Do not collapse these states into generic PASS/FAIL.

## 3. Mandatory audit dimensions

### 3.1 Release and publication truth

Record:

- current package/app version;
- current schema version;
- current GitHub releases/tags;
- release workflow availability and trigger semantics;
- artifact naming/versioning/provenance;
- whether any publication step is manual, credential-gated or absent;
- whether rollback/reproducibility expectations are documented and testable.

### 3.2 Windows matrix

At minimum audit:

- supported Windows architecture/build assumptions already encoded by the project;
- NSIS production package path;
- Preview Handler artifact inclusion;
- registration/install/repair/uninstall behavior;
- Explorer lifecycle/isolation evidence;
- package upgrade/downgrade behavior actually tested;
- signing state and credential requirements;
- DPI/display/keyboard/accessibility evidence;
- long-session/resource/handle behavior relevant to release.

Do not reopen the accepted ADR-0006 source-lifetime model without a new contradictory finding.

### 3.3 macOS matrix

At minimum audit:

- macOS 13+ Apple Silicon target truth;
- DMG production/engineering package behavior;
- hardened-runtime configuration;
- signing and notarization state/credential requirements;
- same-version install/repair evidence;
- cross-version upgrade evidence and the missing real older-release fixture;
- native Quick Look-backed lifecycle/resource evidence;
- VoiceOver/keyboard/display/Retina evidence;
- provider/iCloud/external APFS/exFAT/SMB/network-volume fixture coverage.

Intel/Universal/Rosetta/Linux remain out of scope.

### 3.4 Performance and long-session stability

Audit existing evidence and missing release-facing measurements for:

- Query V2 100k/1M behavior;
- Global Search scale;
- Browse/File Workspace scale;
- Preview rapid-switch/steady-state/resource cleanup;
- scheduler contention/background pressure;
- native handle/temp-file/resource steady state;
- long-session memory/FD/handle growth where applicable.

Preserve the W1 Scheduler 2x-idle pressure `TARGET MISSED` classification unless new exact evidence changes it.

### 3.5 Safety/security/provider hardening

Audit release confidence for:

- filesystem identity and mutation/recovery boundaries;
- Safe Trash/Restore and schema-35 cleanup identity;
- provider/materialization no-implicit-hydration rules;
- permission/unavailable/offline failure states;
- native shell/source isolation;
- content preview sanitization/read-only behavior;
- AI/provider consent and authority boundaries;
- package/install privilege boundaries.

The audit should identify missing evidence, not redesign accepted authorities.

### 3.6 Accessibility/keyboard/visual release quality

Separate automated assertions from real manual/native evidence. At minimum classify:

- keyboard-only operation for major product surfaces;
- focus and Escape/close behavior;
- screen-reader/native accessibility evidence;
- supported display/DPI/scale behavior;
- light/dark/high-contrast/reduced-motion states where supported;
- release-facing visual defects that materially affect usability.

Do not mark a manual/native check PASS because a source-level test exists.

### 3.7 Technical debt

Re-evaluate each open/planned/blocked debt only for release relevance.

For each item classify:

- must fix before release;
- should harden during W5;
- safe to leave open for first release;
- blocked on W5 evidence;
- cheap retirement candidate whose exit condition is already nearly satisfied.

Current starting hypothesis, to verify rather than assume:

- TD-004: likely cheap retirement candidate, not a W5 entry blocker;
- TD-005: bounded compatibility bridge, behavior-sensitive;
- TD-012: blocked on packaging evidence and therefore directly W5-relevant;
- TD-001/002/003/006/007/008/009/010/015: do not preempt release merely because they remain open.

No debt is closed by the audit itself unless its existing exit condition is fully proven within the same reviewed change.

## 4. Required deliverable

Create a durable W5-01 current-truth/result record containing a matrix with at least:

| Area | Requirement | Current state | Evidence | Gap | Release impact | Owner / next Track |
| --- | --- | --- | --- | --- | --- | --- |

The matrix must cover all mandatory dimensions above and link to exact existing evidence rather than duplicating large historical logs.

Also include:

- ranked P0/P1/P2-style W5 execution priorities, using release impact rather than debt severity labels;
- an explicit list of external/manual blockers;
- an explicit list of evidence that can be obtained immediately in hosted CI;
- an explicit list of evidence that requires a real device/account/credential/older release fixture;
- proposed downstream W5 Track boundaries, each small enough for independent review;
- stop/escalate conditions for any proposed architecture or supported-platform change.

## 5. Initial prioritization rule

Rank gaps in this order unless evidence justifies a change:

1. release safety/data-loss/recovery/security blockers;
2. package/install/update/sign/notarization correctness;
3. cross-platform correctness and missing real-fixture evidence;
4. long-session/resource/performance regressions that could make a release unstable;
5. accessibility/keyboard/display blockers;
6. release-facing usability polish;
7. debt retirement whose exit condition is already proven and whose removal reduces release risk;
8. structural refactors with no release impact — normally defer.

## 6. Non-goals

W5-01 must not:

- modify production behavior merely because the audit finds a gap;
- publish a release or tag;
- change package version solely to signal W5 activity;
- add new supported platforms;
- close debt based only on search results without the required regression/equivalence evidence;
- convert unavailable manual/platform evidence into PASS;
- rewrite accepted architecture for stylistic consistency;
- create one giant W5 implementation PR.

## 7. Validation

If W5-01 remains documentation/evidence only:

- exact changed-file list must be docs/governance/evidence only;
- project governance validation must pass;
- W5 must remain the single active initiative;
- documentation validation must pass;
- exact evidence links/SHAs/runs must resolve;
- no product lane should be forced by accidental file scope.

If the audit requires a small diagnostic-only harness change to obtain missing evidence, stop and split that into a separately reviewed bounded W5 Track rather than smuggling it into the audit PR.

## 8. Stop / escalate conditions

STOP and escalate instead of quietly widening W5 if the audit concludes that release readiness requires:

- a durable-authority move;
- schema redesign;
- a new privileged background service;
- a supported-platform change;
- replacement of the installation model;
- a new major user-facing feature;
- weakening an existing safety/performance gate;
- reclassifying a historical failed/unverified result without new evidence.

## 9. Completion condition

W5-01 closes when reviewers can answer, from one current record:

- What exactly prevents a truthful first release today?
- Which gaps are evidence-only versus implementation defects?
- Which gaps require external credentials/devices/fixtures?
- Which work should happen next, in what order, and why?
- Which open technical debts are safe to leave open?

Until that record is accepted, broad W5 implementation remains unprioritized.
