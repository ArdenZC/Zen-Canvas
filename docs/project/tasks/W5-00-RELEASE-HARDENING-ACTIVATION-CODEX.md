# W5-00 — Release / Hardening Activation — Codex / Agent Brief

Status: **activation candidate — documentation/governance only**

Baseline: `master@377ec3b5d91597ddab82fdff821b5ac6bb3b570a` (TD-014 final closeout / PR #178)

Branch: `docs/w5-release-hardening-activation`

This task activates W5 only after W4 and TD-014 have independently closed and the project has returned to canonical `BETWEEN INITIATIVES` state. W5-00 is documentation/governance only. **No production source, Rust/Tauri implementation, package/config, installer, schema, workflow, version, release or tag behavior may change in W5-00.**

## 0. Required read set

Before any W5 production Track begins, read completely:

1. `AGENTS.md`
2. `docs/project/README.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
6. `docs/project/ARCHITECTURE_MAP.md`
7. `docs/project/PRODUCT_MAP.md`
8. `docs/project/DEVELOPMENT_WORKFLOW.md`
9. `docs/project/CODE_MAINTAINABILITY.md`
10. `docs/project/TECH_DEBT.md`
11. `docs/project/RISK_REGISTER.md`
12. `docs/project/initiatives/W4-native-integration.md`
13. `docs/project/tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md`
14. `docs/project/initiatives/TD-014-cleanup-ledger-physical-identity.md`
15. `docs/project/DECISIONS/0005-native-preview-host-boundary.md`
16. `docs/project/DECISIONS/0006-windows-preview-handler-bounded-capture.md`
17. `docs/remediation/LEGACY_RETIREMENT_PLAN.md`
18. `docs/project/initiatives/W5-release-hardening.md`
19. `docs/project/tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-CODEX.md`

W5 implementation Tracks that depend on current Apple, Microsoft, Tauri, signing, notarization, installer or update behavior must re-check the applicable official platform documentation at execution time. Historical project evidence is not a permanent substitute for current platform rules.

## 1. Activation objective

Move governance from:

```text
W4 COMPLETE / CLOSED
TD-014 COMPLETE / CLOSED
No active initiative
BETWEEN INITIATIVES
W5 ELIGIBLE / INACTIVE
release none / tag none
```

to:

```text
W4 COMPLETE / CLOSED
TD-014 COMPLETE / CLOSED
W5 Release / Hardening ACTIVE
W5-00 activation
W5-01 Release Baseline & Gap Audit NEXT
release none / tag none
```

W5-00 authorizes the W5 scope and the first audit Track only. It does not claim release readiness or authorize a release publication.

## 2. Entry gate is satisfied

Accepted entry facts:

- W4 final closeout is merged and W4 is `COMPLETE / CLOSED`;
- TD-014 implementation and governance closeout are merged and TD-014 is `COMPLETE / CLOSED`;
- `master@377ec3b5d91597ddab82fdff821b5ac6bb3b570a` is truthfully between initiatives before activation;
- package version remains `0.1.40`;
- database schema remains `35`;
- no published GitHub release exists;
- no published Git tag exists;
- current supported platforms remain Windows and macOS 13+ Apple Silicon;
- no open P0 implementation blocker is recorded in the project risk register.

No earlier `UNVERIFIED`, `DEFERRED`, `TARGET MISSED` or external-fixture classification is changed by activation.

## 3. Remaining-problem reprioritization

W5-00 follows an explicit post-TD-014 review rather than automatically activating the next technical-debt item.

The review found:

- TD-004 is currently a narrow low-cost retirement candidate because repository search finds no production call to `syncPreviews(files)`, but deleting it is not a prerequisite for W5;
- TD-005 is narrow but behavior-sensitive because edited-name continuity still crosses the compatibility bridge;
- TD-003 and TD-006 still own compatibility behavior with real runtime/durable implications;
- TD-001 and TD-015 remain broad multi-caller compatibility retirements and are poor pre-release refactor targets without a bounded replacement plan;
- TD-012 is blocked specifically on packaging evidence, making W5 the correct place to resolve or classify it;
- TD-002, TD-008, TD-009 and TD-010 are maintainability improvements, not automatic release blockers.

Conclusion: **no separate maintenance initiative preempts W5**. W5 may close a debt item only when its recorded exit condition is met and doing so reduces real release risk.

## 4. W5 scope

The Master Development Plan defines W5 as stabilization and polish rather than feature expansion. W5 may cover:

- performance and resource steady state;
- long-session stability;
- cancellation/leak/handle/temp-resource audits;
- supported-platform behavior and real fixtures;
- accessibility and keyboard behavior;
- security/materialization/provider hardening;
- packaging/signing/notarization/update behavior;
- visual and interaction polish required for release quality;
- technical-debt deletion only where replacement/equivalence is proven.

W5 must preserve the product's local-first, safety-oriented filesystem model and all accepted authority boundaries.

## 5. Known W5 inputs

The activation carries forward these explicit evidence obligations:

1. production signing and notarization are not claimed;
2. packaged build is not the same as published release;
3. cross-version macOS upgrade evidence is `DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE`;
4. native manual display/accessibility evidence remains `UNVERIFIED` where not executed;
5. unavailable real provider/filesystem fixtures remain `UNVERIFIED` where not executed;
6. W1 Scheduler 2x-idle pressure remains a recorded `TARGET MISSED` observation;
7. `R-PLAT-001` and `R-REL-001` remain active project risks;
8. no release/tag currently exists.

W5-01 must decide which of these are release blockers, required validation gaps, accepted external blockers or non-blocking defers. W5-00 does not make that decision by implication.

## 6. First authorized Track

The only execution Track activated after W5-00 is:

**W5-01 — Release Baseline & Gap Audit**

W5-01 is evidence/governance-first. It must inspect current production/config/package/CI truth and produce a ranked release-gap matrix before broad implementation changes begin.

W5-01 must not publish a release/tag, change product platform support or start unrelated technical-debt cleanup.

## 7. Hard boundaries

W5 MUST NOT:

- add a new major product feature merely because implementation capacity exists;
- replace Query V2, `LibrarySelectionV1`, Global Index, PreviewSession, Provider Registry, Read Gate, WorkScheduler, operation/recovery ledgers or physical-identity authorities;
- create a second mutation, query, queue, preview, read, identity or recovery authority;
- silently hydrate provider/cloud content;
- weaken current performance/safety/governance gates to obtain a green release matrix;
- delete compatibility code before its recorded exit condition is proven;
- add Intel macOS/Linux/Universal/Rosetta support by implication;
- treat unsigned/unnotarized engineering packages as production-signed artifacts;
- treat CI package output as a GitHub release;
- publish a release/tag from W5-00 or W5-01;
- invent PASS evidence for unavailable manual/platform fixtures.

If a downstream W5 Track needs a durable-authority move, schema redesign, broad privileged service, supported-platform change or installation-model replacement, STOP for architecture/governance review.

## 8. Activation PR required files

The W5-00 activation PR should remain documentation/governance only and update/add only the minimum current-truth artifacts:

- `docs/project/STATUS.md`;
- `docs/project/ROADMAP.md`;
- `docs/project/initiatives/W5-release-hardening.md`;
- `docs/project/tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md`;
- `docs/project/tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-CODEX.md`.

`TECH_DEBT.md`, `RISK_REGISTER.md`, `ARCHITECTURE_MAP.md`, package/config files or production source should not change merely for activation symmetry. Update them later only when a W5 Track changes the fact they own.

## 9. W5-00 validation

Because W5-00 is docs/governance only:

- exact diff must remain documentation-only;
- project governance validation must pass;
- source/current-truth parser must recognize exactly one active initiative (`W5 — Release / Hardening`);
- STATUS and ROADMAP current initiative names/status must agree;
- documentation validation must pass;
- CI classifier must route the change to docs-only validation;
- no Rust/native/package/performance lane should run due to accidental file scope;
- changed-file list must be audited;
- review must have no unresolved blocker before merge.

No runtime, packaging, signing or release PASS is claimed by W5-00.

## 10. Stop conditions

STOP W5-00 rather than merging contradictory governance if:

- W4 or TD-014 is no longer closed on current master;
- another initiative is active concurrently;
- W5 activation requires production/config/schema/workflow changes;
- activation text claims Zen is already signed, notarized, released or publication-ready;
- activation silently converts any deferred/unverified evidence to PASS;
- a technical-debt retirement is bundled into W5-00;
- W5-01 is not clearly first and evidence-first;
- current-truth/governance validation fails.

## 11. Expected current truth after merge

```text
W4     COMPLETE / CLOSED
TD-014 COMPLETE / CLOSED
W5     ACTIVE
W5-00  activation complete
W5-01  NEXT — Release Baseline & Gap Audit
Package 0.1.40
Schema  35
Release none
Tag     none
```
