# W5 — Release / Hardening

Status: **ACTIVE — implementation; W5-01 Release Baseline & Gap Audit next**

Owner: Zen Canvas

Activation entry baseline: `master@377ec3b5d91597ddab82fdff821b5ac6bb3b570a`; tree `70bec2d7640a63b6420493c8d80a1eae34573bd7`.

Activation task: [`../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md`](../tasks/W5-00-RELEASE-HARDENING-ACTIVATION-CODEX.md).

First execution Track: [`../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-CODEX.md`](../tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-CODEX.md).

## Goal

Stabilize, verify and prepare the complete supported Zen Canvas product for a truthful release decision without adding another feature wave or weakening the authorities established by W1-W4 and TD-014.

W5 owns release hardening. It does **not** mean Zen is already released, signed, notarized or publication-ready. `Implemented`, `Validated`, `Packaged` and `Released` remain distinct states throughout the initiative.

## Entry conditions

W5 activation is allowed because:

- W4 — Native Integration is independently **COMPLETE / CLOSED**;
- TD-014 — Cleanup Ledger Physical Identity Normalization is independently **COMPLETE / CLOSED**;
- current master was truthfully **BETWEEN INITIATIVES** before activation;
- no open P0 implementation blocker is recorded in the project risk register;
- the Master Development Plan already defines W5 as the next Release / Hardening gate.

The activation does not reinterpret earlier `UNVERIFIED`, `DEFERRED`, `TARGET MISSED` or external-fixture gaps as PASS.

## Post-TD-014 debt reprioritization

The remaining technical-debt register was reviewed before W5 activation.

Conclusion: no remaining debt item must preempt W5 as a separate maintenance initiative.

- TD-004 is a narrow retirement candidate: current repository search finds no production call to `useOperationQueueStore.syncPreviews(files)`; current hits are the store definition, tests and governance/reference text. It may be retired later only with the required authoritative-preview regression.
- TD-005 remains a narrow edited-name compatibility bridge through `useOperationQueueStore`; removal is behavior-sensitive and should occur only when the authoritative operation preview/journal path proves continuity.
- TD-003, TD-006, TD-001 and TD-015 still have real compatibility callers or support-window/evidence dependencies and must not be deleted merely to reduce debt count.
- TD-012 is explicitly blocked on exact supported-platform packaging evidence and therefore belongs naturally inside W5 evidence sequencing.
- TD-002, TD-008, TD-009 and TD-010 are maintainability/architecture improvements, not automatic pre-release refactor mandates.

W5 may retire technical debt only where replacement/equivalence is already provable and the deletion reduces actual release risk. Debt age, file size or aesthetic preference is not sufficient justification.

## In scope

W5 may authorize bounded work in these areas after W5-01 ranks the gaps:

- supported-platform release matrix and release-state truth;
- performance and resource steady state, including long-session behavior;
- cancellation, leak, native-handle, temporary-resource and lifecycle audits;
- accessibility, keyboard behavior, display/DPI/scale and release-facing interaction polish;
- security, materialization, provider, permission and filesystem-fixture hardening;
- Windows and macOS packaging/install/repair/uninstall verification required for release confidence;
- signing/notarization readiness and execution when credentials/policy permit;
- update-channel/update-lifecycle readiness;
- publication/release/tag readiness and explicit release action only in a later separately reviewed Track;
- targeted technical-debt deletion where its exit condition is fully satisfied and release risk is reduced.

## Explicit pre-W5 evidence obligations

The following remain real W5 inputs rather than already-passed facts:

- production signing and notarization are not claimed;
- native manual display/accessibility evidence remains `UNVERIFIED` where W4 did not execute it;
- real iCloud/File Provider/external APFS/exFAT/SMB/network and other unavailable fixture claims remain `UNVERIFIED` where the existing evidence says so;
- cross-version macOS upgrade remains `DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE` until a real older release fixture exists or the external blocker is recorded truthfully;
- the W1 Scheduler 2x-idle pressure comparison remains an explicit `TARGET MISSED` observation until W5 evidence changes that fact;
- no published GitHub release or Git tag exists at activation.

## Non-goals

W5 activation does not authorize:

- a new major user-facing feature wave;
- a Finder/Explorer replacement or new shell product surface;
- new supported platforms, Intel macOS, Universal binaries, Rosetta or Linux support;
- a second Preview engine, provider registry, read/materialization authority, mutation authority, identity authority or recovery authority;
- broad schema redesign merely for cleanup;
- speculative architecture refactors whose only benefit is structural neatness;
- deleting compatibility code before its recorded exit condition is met;
- silently hydrating provider/cloud content;
- weakening performance, safety, identity, permission, packaging or governance gates;
- publishing a release/tag as part of W5-00 activation or W5-01 audit.

## Durable authority boundaries

All existing durable authorities remain binding, including:

- File Library Query V2 and `LibrarySelectionV1`;
- Global Index and managed scan-root/watcher/reconciliation truth;
- PreviewSession, Provider Registry, Read/Materialization Gate and WorkScheduler;
- filesystem physical-identity validation;
- Operation Preview, journals, Safe Trash, cleanup and Restore;
- Rule, Analysis, Content and Managed AI authorities;
- ADR-0005 native Host/Adapter ownership and ADR-0006 Windows capture-before-defer.

A W5 Track adapts, validates or hardens these authorities. If a Track needs to move durable authority, add a broad privileged service, change persistence ownership or redefine supported-platform truth, it must stop for architecture/governance review rather than treating the change as ordinary hardening.

## Execution model

```text
W5-00  Activation / governance                              THIS TRACK
  ↓
W5-01  Release Baseline & Gap Audit                         NEXT
  ↓
Evidence-ranked downstream W5 Tracks                        NOT YET FIXED
  ↓
Release-candidate / publication decision                    LATER REVIEW
  ↓
W5 final closeout
```

W5-01 intentionally decides the downstream Track set. The activation does not invent a long fixed queue before current release evidence is audited.

## Acceptance model

Every W5 claim must be classified using evidence-appropriate language. At minimum distinguish:

- **Implemented** — code/config exists;
- **Validated** — required automated/manual evidence passed for the stated matrix;
- **Packaged** — a package artifact was actually produced and inspected for the stated matrix;
- **Released** — a release/tag/publication action actually occurred;
- **UNVERIFIED** — required evidence is unavailable or not executed;
- **DEFERRED / BLOCKED** — intentionally postponed or externally prevented with the blocker named.

No successful CI build alone promotes a fact to `Released`.

## Closeout requirements

W5 may close only when:

- the final supported-platform release matrix is explicit and current;
- open release blockers have been resolved or explicitly accepted/deferred by product decision;
- required exact-head automated and manual evidence is recorded without fabricated PASS claims;
- package/sign/update/publication state is truthful;
- any debt closed during W5 satisfies its existing exit condition;
- current truth, roadmap, risk/debt state and release/tag facts agree;
- no unresolved reviewer blocker remains on the final closeout candidate.
