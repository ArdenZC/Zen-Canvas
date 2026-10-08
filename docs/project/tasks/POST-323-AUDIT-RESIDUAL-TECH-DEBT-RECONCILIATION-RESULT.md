# Post-#323 Historical Audit Residual & Technical Debt Reconciliation — Owner Matrix

Last verified: 2026-10-08

Owner issue: [#330](https://github.com/ArdenZC/Zen-Canvas/issues/330)

Baseline:

- `master@1619e335468c432da5a5b3a6e246e1ea1c7db32c`
- tree `70c1e97eb68a01506a796140277af640a5e0fe60`
- merge-after master CI [37722150775](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37722150775) — **SUCCESS**
- PR #327 — **SQUASH MERGED**
- issue #323 — **CLOSED / completed**
- Schema 37 / package 0.1.40 / IPC v3
- public release remains **DEFERRED**

Status: **OWNER RECONCILIATION MATRIX ESTABLISHED — NO PRODUCT IMPLEMENTATION AUTHORIZED BY THIS DOCUMENT.**

This matrix is a sequencing and ownership decision ledger. It does not reopen historically accepted work, does not silently convert evidence limitations into PASS, and does not authorize omnibus technical-debt cleanup.

## Decision vocabulary

- **FIX BEFORE REBASELINE** — a current correctness/first-value defect that must receive a bounded implementation and Owner closeout before the Post-AI-only Product/Architecture Rebaseline is activated.
- **ADR BEFORE RELATED IMPLEMENTATION** — the existing compatibility/authority surface may remain temporarily, but a reviewed authority/caller/exit contract must precede any adjacent new implementation.
- **OWNED NEXT PHASE** — not a current rebaseline blocker; the owning future phase must carry explicit tests/evidence.
- **ACCEPT DEFER** — retain the current debt/evidence limitation under its existing exit condition; do not bundle cleanup into unrelated work.
- **RELEASE-ONLY** — does not block architecture/product development while publication remains deferred.
- **CLOSE WITH EVIDENCE** — already closed/fixed or eligible for closure only with the stated evidence; do not reopen without a new reproduction.

## A. Current product defects and open issues

| ID | Source | Current truth | Decision | Owner / exit requirement |
| --- | --- | --- | --- | --- |
| BUG-328 | [#328](https://github.com/ArdenZC/Zen-Canvas/issues/328) | Clean Windows native qualification observed transient Global Index `unavailable / sqlite error: database is locked`; it recovered automatically, but root cause and recurrence are unverified. This is distinct from closed #323. | **FIX BEFORE REBASELINE** | Bounded Global Index/SQLite contention investigation and fix in Codex Cloud. Preserve truthful health states, one coordinator/service, Schema 37 unless separately approved. Windows local only for frozen-candidate native acceptance if required. |
| BUG-329 | [#329](https://github.com/ArdenZC/Zen-Canvas/issues/329) | Clean-install Onboarding failed to save the selected scan scope with `onboarding_scan_scope_save_failed`. Escape dismissal did not prove persistence. | **FIX BEFORE REBASELINE** | Bounded first-run/scan-scope persistence fix in Codex Cloud. Reuse existing settings/managed-scope authority; no second onboarding/settings store. Windows local clean-install acceptance required. |
| MAC-270 | [#270](https://github.com/ArdenZC/Zen-Canvas/issues/270) | macOS resident/background startup abort during tray setup remains unresolved. It blocks supported macOS resident/release claims, not the current Windows product path. | **ACCEPT DEFER** | Must be resolved or explicitly superseded before supported macOS resident/release acceptance. Hosted macOS compile/tests are not native GUI acceptance. |
| ZDB-283 | [#283](https://github.com/ArdenZC/Zen-Canvas/issues/283) | Preference/System-One research is frozen at `INCONCLUSIVE_LOW_DELTA`; >=300 follow-up and production Preference/Laya/Jev are not active. | **ACCEPT DEFER** | Research-only. Any new study requires separate pre-registration/Owner activation; no production runtime dependency from this issue. |

## B. Retained W6 product residuals

| ID | Residual | Existing disposition | Decision now | Requirement |
| --- | --- | --- | --- | --- |
| W6R-01 | Cleanup extended-path rejection | CLOSED / FIXED | **CLOSE WITH EVIDENCE** | Preserve regression coverage; reopen only on a new exact-head reproduction. |
| W6R-02 | Typed/folder Quick Preview | Windows/native path materially accepted; macOS native coverage remains incomplete | **ACCEPT DEFER** | Carry missing supported-macOS native evidence to the owning platform/release gate. Do not claim cross-platform native PASS. |
| W6R-03 | Global Index unavailable / zero-source state | ACCEPTED DEFER; #323 repaired a different Paused/rebuild-required transport/recovery defect | **OWNED NEXT PHASE** | First compare against #328 findings. If current exact-head reproduction proves a distinct zero-source defect, create one bounded issue; otherwise close the historical residual with evidence. |
| W6R-04 | Organization Plan authoritative safe-preview degradation | ENVIRONMENT-SPECIFIC | **OWNED NEXT PHASE** | Organize/Operation owner must reproduce on a supported fixture before changing behavior; preserve fail-closed Preview/Revalidation/Journal authority. |
| W6R-05 | Browse first-scan / restart recovery friction | ACCEPTED DEFER | **OWNED NEXT PHASE** | File Workspace Foundation must re-evaluate current exact-head first-launch/restart behavior and explicitly check overlap with #329 before opening another defect. |

## C. Technical-debt ledger

The current register remains authoritative for open/planned/closed status. This matrix assigns sequencing; it does not falsely close debt.

| Debt | Current status | Current source/caller truth | Decision | Sequencing requirement |
| --- | --- | --- | --- | --- |
| TD-001 — `useFileLibraryStore` compatibility umbrella | open | Production imports still exist across AppShell/runtime, Scanner, Rules, search handoff, scan/background indexing, operation restore/execution and File Library source ownership. Query V2 is not the only caller surface yet. | **ADR BEFORE RELATED IMPLEMENTATION** | Before new Tabs/Split/Shelf/Notes/File Workspace expansion, freeze one Files authority/caller-retirement ADR and current caller inventory. New features must not add fresh dependencies on the umbrella. Retirement may then proceed as bounded Codex Cloud work with mounted/full gates. |
| TD-002 — `AppRuntimeProviders` breadth | open | Composition root still coordinates multiple lifecycle owners. No new duplicate lifecycle authority is proved by this audit. | **ACCEPT DEFER** | Split only with an explicit lifecycle-owner map and no behavioral change; do not bundle into Files/AI features. |
| TD-003 — renderer watcher fallback | open | Legacy retry/upsert compatibility remains intentionally present. | **ACCEPT DEFER** | Retire only when supported product builds prove backend reconciliation coverage or the compatibility window ends. Preserve watcher regressions. |
| TD-004 — unused Operation Preview sync helper | planned | Register states no known production caller; current audit does not authorize deletion. | **ACCEPT DEFER** | Close/remove only after repository-wide caller proof and authoritative preview regressions; not a feature blocker. |
| TD-005 — Organize edited-name bridge | open | `useOrganizeDecisionStore` remains a narrow compatibility bridge to older preview callbacks. | **ADR BEFORE RELATED IMPLEMENTATION** | Before changing Organize/Operation intent/preview flow, define edited-name ownership and replacement regression; never make the bridge semantic authority. |
| TD-006 — Managed AI legacy queue adapter | open | `global_index/legacy_queue.rs` remains an adapter into the existing durable `ai_jobs` queue, not a second queue. | **ADR BEFORE RELATED IMPLEMENTATION** | Mandatory before AI Eligibility/Admission implementation. Preserve one durable queue/worker/scheduler and old-row repair coverage; no second AI queue. |
| TD-007 — legacy design-token aliases | open | Production callers still use aliases. | **OWNED NEXT PHASE** | Migrate surface-by-surface with visual/high-contrast/reduced-motion evidence. Do not bundle alias removal into unrelated functional work. |
| TD-008 — large Rust modules | open | Module-size debt, not a proved correctness defect. | **ACCEPT DEFER** | Extract only around stable responsibilities with behavior/evidence parity. |
| TD-009 — Windows platform boundary packaging | planned | Mature Windows safety exists but is less explicitly packaged than macOS. | **ACCEPT DEFER** | Refactor only with handle-bound safety/mutation/recovery parity; not a rebaseline blocker. |
| TD-010 — Tauri command/allowlist/capability/security duplication | open | Permission truth remains synchronized across multiple files; Main/Search separation is security-sensitive. | **ADR BEFORE RELATED IMPLEMENTATION** | Before adding new window/native commands or permission surfaces, define generation/validation ownership. No weakening of Search/Main separation. |
| TD-012 — legacy/one-off build assets | open | Packaging no longer blocks evaluation, but safe consumer-free deletion is not proved for each asset. | **ACCEPT DEFER** | Delete only after exact consumer/equivalence proof and supported packaging gates. |
| TD-015 — File Library/Vault compatibility retirement | open | Production Library Mode still consumes `useLibraryContentCompatibility`; `VaultView` and Vault compatibility components remain in the production tree/export surface. | **ADR BEFORE RELATED IMPLEMENTATION** | Treat together with TD-001 before new File Workspace architecture. Inventory every remaining compatibility caller and freeze replacement ownership; do not build new workspace features on the legacy Vault compatibility surface. |

Closed TD-011, TD-013 and TD-014 remain closed. Reopen only on new evidence. No debt item is removed merely for cosmetic cleanliness.

## D. Native/lifecycle/release evidence debt

| ID | Evidence gap | Decision | Requirement |
| --- | --- | --- | --- |
| EV-01 | PM-02B pending-at-exit recovery and real suspend/resume remain accepted UNVERIFIED limitations | **ACCEPT DEFER** | Carry to lifecycle owner when that path is next touched; do not rewrite historical acceptance. |
| EV-02 | Windows DPI/scaling, Forced Colors, native Reduced Motion, Narrator residuals | **OWNED NEXT PHASE** | Presentation/accessibility owner; require real Windows evidence when the relevant UI is changed or before release. |
| EV-03 | macOS GUI/Retina/Quick Look lifecycle, VoiceOver, File Provider/external/network fixtures | **ACCEPT DEFER** | Require a real supported Mac for native claims. #270 must be resolved/superseded before resident/release PASS. |
| EV-04 | W6-10B SmartScreen / Unknown Publisher/UAC evidence | **RELEASE-ONLY** | Publication remains deferred; no host/security weakening and no RC2 implied. |
| EV-05 | W6-10C real-host macOS release qualification | **RELEASE-ONLY** | Remains DEFERRED / UNVERIFIED until a supported real Mac is available. |
| EV-06 | #323 historical native report remains INCOMPLETE | **CLOSE WITH EVIDENCE** | #323 is closed with scoped Owner acceptance and explicit evidence exceptions. Do not rerun merely to convert the historical report to PASS. |

## E. Immediate project-truth drift

The following are current documentation/governance defects and are fixed in the reconciliation PR that introduces this matrix:

1. `STATUS.md` / `ROADMAP.md` / Windows Global Index initiative still described #323/#327 as active/open after merge and closure.
2. `RISK_REGISTER.md` still described #323 remediation as active.
3. root README / README_en still described built-in/user Rules as the primary current classification product model after AI-only migration.
4. `PRODUCT_MAP.md` still described PM-02B Automation as under Owner review.

Historical task/evidence records remain historical and are not rewritten simply because current GitHub state changed.

## F. New research inputs

The Owner research direction — Full File Workspace + Layered Intelligence and the AI Eligibility / Admission supplement — is accepted as **architecture input, not implementation truth**.

Decision: **ADR BEFORE RELATED IMPLEMENTATION**.

Before any AI Eligibility production task:

- audit exact current Managed Scope initial backfill, Global Index incremental enqueue, manual Organize, Automation Plan, Cleanup and Content paths at the implementation baseline;
- preserve `Index != Managed != AI Eligible != AI Analyzed != Mutation Eligible`;
- preserve independent cloud-content disclosure/consent;
- reuse the single existing `ai_jobs` durable queue, Managed AI worker, WorkScheduler and mutation authorities;
- classify by directory/project/file eligibility without turning exclusion into Cleanup/delete authority;
- prefer current assessment reuse and generative-last escalation;
- do not activate System One/Laya/Jev/Preference Memory without separate evidence and Owner approval.

## G. Minimum pre-Rebaseline sequence

1. Merge this truth/matrix reconciliation only after exact-head CI and Owner review.
2. **#329 first** — clean-install Onboarding scan-scope persistence, because first-run Managed Scope truth is a direct prerequisite for the next product/AI-scope architecture.
3. **#328 second** — transient SQLite lock/unavailable, because Global Index health is foundational to Files/Search and future candidate admission.
4. Reconcile W6R-03 against the #328 root cause/evidence; create a separate issue only if a distinct current zero-source defect is proved.
5. Freeze the **Files Authority / Compatibility Retirement ADR** covering TD-001 + TD-015 before File Workspace feature implementation.
6. Freeze the **Managed AI Eligibility / Queue Authority ADR** covering TD-006 and the new eligibility proposal before AI Eligibility implementation.
7. Then activate the Post-AI-only Product / Architecture Rebaseline.
8. Only after that may File Workspace Foundation implementation begin.

No new product feature implementation is authorized by this matrix.

## Workflow ownership

- **Owner / ChatGPT:** scope, architecture decisions, independent review, GitHub issue/PR governance, Ready/merge/master-CI/issue closure.
- **Codex Cloud:** the only development environment for source/doc implementation tasks, tests, builds/packages and implementation evidence.
- **Windows local:** frozen-candidate native GUI/service/NTFS/user-flow acceptance only. No local coding/build/repository modification.
- **macOS:** hosted CI is not a substitute for supported real-macOS GUI/native acceptance.

Final state for this governance task:

**POST-#323 HISTORICAL AUDIT / TECHNICAL DEBT RECONCILIATION — OWNER MATRIX READY FOR REVIEW.**
