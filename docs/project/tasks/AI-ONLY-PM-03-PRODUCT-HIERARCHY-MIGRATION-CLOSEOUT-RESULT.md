# PM-03 — Product Hierarchy / Migration Closeout Result

**Disposition:** The earlier frontend/product-hierarchy candidate was returned **CHANGES REQUESTED** by Owner review before Windows qualification. Owner authorized the narrow native route transport remediation recorded below; this result must not be read as native acceptance. Draft PR #322 remains unmerged; issue #273 remains open.

## Candidate identity

- Repository: `ArdenZC/Zen-Canvas`.
- Authorized implementation branch: `product/pm-03-product-hierarchy-migration-closeout`.
- Exact starting baseline: `master@c72bbce173d53660a68d797b3e0ac2a32cfeb7c5`, tree `8fc2b93b9c64abbc8e0fd892d44fe363a0468f5f`.
- Activation: PR #320 merged at `c059d911eb053753d7ce7693aa30e39e3965f88c`; activation merge-after CI 37270388844 succeeded. Reconciliation PR #321 merged and established the implementation baseline above; merge-after CI 37270657097 succeeded.
- First implementation commit: `9495deea` (route migration, focused tests, and browser evidence runner).
- Owner-reviewed pre-remediation candidate: `47ef02922d58329e035eaf8391feaaa4d9523cbf`, tree `5e3e52796454556504e2ae7016d8be0325d202d7`; Owner disposition **CHANGES REQUESTED** before Windows native qualification.
- Owner finding: the frontend canonical route `automation` crossed the existing Tauri `SearchView` boundary, where Rust recognized only `Rules`/`rules`; main-window session restore also emitted `?view=rules`. The browser mock did not exercise Rust serde.
- Owner-authorized remediation: make native `SearchView::Automation` serialize as `automation`, retain `rules` only as an inbound serde alias, and make Main restoration produce `?view=automation`. No new command, permission, schema migration, semantic/runtime authority or filesystem behavior is authorized.
- Superseded pre-remediation installer SHA-256: `E7A342E95356222BF9BC266CB1B6741060E7297C3E23EDAF06B4D85C1D5BF9F3`. It must not be used for Owner qualification. Neither the old candidate nor its installer received Windows Owner qualification.
- Implementation PR: [#322](https://github.com/ArdenZC/Zen-Canvas/pull/322), **OPEN / DRAFT**, base `master`. It does not close #273 and has no auto-merge.
- Final remediation candidate SHA/tree, exact-head CI and fresh installer identity are recorded in the final PR #322 Owner handoff. All final validation and hosted checks must bind to that exact head.

## Product hierarchy and route contract

The candidate changes the canonical frontend `View` identity from `rules` to `automation`. `src/utils/viewRoutes.ts` is the shared normalization boundary:

| Input | Result |
| --- | --- |
| `automation` | canonical `automation` |
| historical `rules` | `automation` |
| unknown initial URL value | safe `scanner` startup fallback |
| unknown setter input | safe `scanner` fallback |

The same frontend normalizer handles startup query input and cross-window navigation. Current cross-window payloads emit canonical views; inbound `rules` remains accepted only as a compatibility input and still passes the existing nonce, session, revision, selection and Settings-target checks. Application state contains no `rules` view. On the native side, `SearchView::Automation` serializes as `automation`, while serde accepts legacy `rules` as an alias to that same variant. Main-window session restoration serializes the canonical query value `view=automation`.

AppShell renders `AutomationWorkspace` from `automation`; the heading, description and topbar describe plan preparation and review. Spotlight targets `automation` while retaining English `rules` and Chinese `规则` discovery keywords. Settings → Automation and the ordinary Timeline destination also target `automation`.

Every ordinary Automation entry resets the transient, non-persisted surface to **Intents**. `?view=rules` therefore opens Automation → Intents. **Advanced Policies** appears only after an explicit action inside Automation and continues to render the existing Rule Repository V2 / Rule Proposal UI. Its bilingual copy identifies deterministic compatibility policy behavior and says it is not the current Managed AI Organize semantic authority.

The active onboarding copy was audited and contained no Rule-centric product claim, so onboarding code is unchanged. Current Rule-specific UI/API and terminology remain in their Rule domain; historical documents and evidence were not rewritten.

## Preserved authority and excluded scope

- Rule Repository V2, Rule Proposal, Rule persistence, AST, create/edit/enable/pause/delete controls, evaluation and watcher behavior are unchanged. Navigation alone does not mutate an Intent, Rule, Proposal or Plan.
- PM-01 Managed AI Organize semantics remain authoritative. PM-02 Intent, Run, trigger, scheduler and review behavior remain unchanged.
- The only native change is the route transport enum/serde/query mapping; Tauri command registration, command permissions and native lifecycle behavior are unchanged. No new filesystem mutation authority was introduced. Operation Preview, confirmation, identity revalidation, journal, Safe Trash and Restore remain unchanged.
- Schema remains **37** and package remains **0.1.40**. The only Rust change is the route wire contract above; no database migration, backend behavior/authority change or Cargo version change is part of the candidate.
- TD-001, TD-003 through TD-010, TD-012, TD-015 and the broad legacy retirement plan remain outside this implementation.

## Browser integration evidence

Runner: `node scripts/runPm03BrowserEvidence.mjs`. It launches the local Vite app with the repository's browser mock, instruments the mock command boundary, and records screenshots plus `measurements.json` under `docs/project/tasks/evidence/PM-03/`.

| Scenarios | Result |
| --- | --- |
| English and Chinese, 1440×960 and 760×900 | Spotlight → Automation → Intents; explicit Advanced Policies; keyboard return to Intents with focus retained; Settings → Automation → Intents; no horizontal overflow |
| English `?view=automation` | Automation → Intents |
| English and Chinese `?view=rules` | Canonical Automation → Intents; Advanced Policies not opened |
| Browser errors | 0 page errors; 0 console errors |
| Browser-mock commands | 168 observed across seven scenarios; 0 file, Rule or Intent mutation commands during navigation |

The 23 screenshots are supplementary presentation evidence, not native acceptance. Browser mocks do not execute Rust serde, which is why this evidence did not detect the Owner-reported native wire mismatch. Example captures: [English Spotlight entry](evidence/PM-03/en-desktop-spotlight-intents.png), [Chinese narrow Advanced Policies](evidence/PM-03/zh-narrow-advanced-policies.png), and [Chinese Settings entry](evidence/PM-03/zh-desktop-settings-intents.png). Full measurements and all screenshots are in [PM-03 evidence](evidence/PM-03/).

## Local validation

No test was weakened to accommodate the migration.

| Gate | Result |
| --- | --- |
| Focused native route transport (`cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime app_control::tests::`) | PASS — 30 tests, including canonical and legacy serde routes, navigation payload and Main restore URL. |
| Rust formatting and lint (`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`; desktop-runtime Clippy with `-D warnings`) | PASS. |
| Full Rust suite (`npm run verify:rust`) | BLOCKED BY FOUR TEST FAILURES — 1,123 passed / 4 failed / 24 ignored. Three unchanged Automation readiness/trigger semantic tests also failed when run individually; an unchanged File Workspace preview test failed in the full suite but passed alone. No files in those modules were changed. The focused route tests pass. |
| TypeScript typecheck (`npm run typecheck`) | PASS. |
| Full application test directory (`npm exec vitest -- run --dir tests`) | PASS — 163 files, 1,676 tests, after updating the static lifecycle assertion to follow the extracted Main restore URL helper. |
| Architecture/performance routing (`npm run test:performance:architecture`) | PASS — architecture guard and 3 files / 30 tests. |
| Frontend production build (`npm run build:frontend`) | PASS — Vite transformed 2,186 modules and produced the frontend bundle. Build warnings: CSS `var(...)` parse warning and `INEFFECTIVE_DYNAMIC_IMPORT` for the PDF renderer. |
| PM-03 browser evidence (`node scripts/runPm03BrowserEvidence.mjs`) | LOCAL UNVERIFIED — the runner did not complete the seven scenarios. The completed attempt remained on the DatabaseBootstrapper loading screen and timed out locating the Search button; other attempts were stopped after Vite/Tailwind consumed several GB while scanning this checkout. No fresh measurements or screenshots were written. Existing captures belong to the prior frontend candidate. |
| Governance and documentation validation | PASS on the current content — `npm run test:docs` with `DOCS_DIFF_BASE=c72bbce173d53660a68d797b3e0ac2a32cfeb7c5`; five changed Markdown files validated. |
| `git diff --check` | PASS on the current tracked candidate against the authorized baseline. |
| Hosted CI browser gate and Windows installer | Must be fresh and bound to the exact remediation head; final run conclusion and package identity are recorded in the PR #322 Owner handoff. |

The Rust full-suite failures were `current_assessment_needs_no_credential_or_new_enqueue`, `stale_assessment_checks_fresh_readiness_and_keeps_plan`, `automatic_current_and_stale_semantics_reuse_shared_admission_without_mutation`, and `change_monitor_and_preview_reuse_ephemeral_browse_refs`. The first three reproduced individually in unchanged Automation modules; the last passed when rerun alone in the unchanged File Workspace module.

## Windows native qualification

**Status: OWNER QUALIFICATION PENDING — no native PASS is claimed.** The browser mock does not exercise Tauri native behavior or the user's durable data. The pre-remediation candidate and installer are superseded. A fresh Windows candidate build is required from the exact final remediation head, with its new package identity/path recorded in the handoff.

Owner must use that exact candidate in an isolated profile and verify normal startup; Spotlight and Settings entering canonical Automation → Intents; explicit Advanced Policies entry and return; legacy `?view=rules` if safely exercisable; existing Intent and Rule readability; normal Intents default after restart; no Rule/Intent mutation from navigation; and no filesystem mutation. The Owner record must state the automatic filesystem mutation count explicitly. No destructive Rule action is needed for this qualification.

## Hosted CI and final status

PR #322 must have fresh green required checks bound to its exact final head before handoff. Hosted CI is correctness evidence only; it does not replace Windows Owner qualification, authorize merge, or close issue #273. The PR remains Draft and unmerged at the requested stop point:

**NATIVE ROUTE TRANSPORT REMEDIATION IN VALIDATION — OWNER RE-REVIEW PENDING**
