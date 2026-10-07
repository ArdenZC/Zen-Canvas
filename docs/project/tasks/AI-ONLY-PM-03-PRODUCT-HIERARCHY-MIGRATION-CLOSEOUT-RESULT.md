# PM-03 — Product Hierarchy / Migration Closeout Result

**Disposition:** **PM-03 COMPLETE / MERGED / OWNER REVIEW PASSED / MERGE-AFTER MASTER CI SUCCESS**. **HISTORICAL NATIVE FAIL → REMEDIATED → OWNER REQUALIFICATION PASS**. Accepted production candidate `843693ea7e3612a662a5331daaedef557d40fee1` / tree `72b1c263650951be118a5f23e820d5dca8e4e621`; Windows Owner requalification PASS with native product behavior PASS + deterministic ordering evidence accepted. No native ACK trace was captured. PR #322 squash-merged as `master@4848e51dc9cfd1b87b6f4281aac7717452840cd8` / tree `e5a225a0e2c35d2a509c3e540b29862840c023aa`; merge-after master CI [37561509211](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37561509211) is **SUCCESS**. #273 is **CLOSED / completed**; #323 remains independently open.

## Historical implementation / remediation checkpoints

Earlier dispositions below remain historical; the final Owner closeout section supersedes their pending/Draft conclusions. Failed gates, candidates and superseded package hashes are preserved.

### Candidate identity

- Repository: `ArdenZC/Zen-Canvas`.
- Authorized implementation branch: `product/pm-03-product-hierarchy-migration-closeout`.
- Exact starting baseline: `master@c72bbce173d53660a68d797b3e0ac2a32cfeb7c5`, tree `8fc2b93b9c64abbc8e0fd892d44fe363a0468f5f`.
- Activation: PR #320 merged at `c059d911eb053753d7ce7693aa30e39e3965f88c`; activation merge-after CI 37270388844 succeeded. Reconciliation PR #321 merged and established the implementation baseline above; merge-after CI 37270657097 succeeded.
- First implementation commit: `9495deea` (route migration, focused tests, and browser evidence runner).
- Owner-reviewed pre-remediation candidate: `47ef02922d58329e035eaf8391feaaa4d9523cbf`, tree `5e3e52796454556504e2ae7016d8be0325d202d7`; Owner disposition **CHANGES REQUESTED** before Windows native qualification.
- Owner finding: the frontend canonical route `automation` crossed the existing Tauri `SearchView` boundary, where Rust recognized only `Rules`/`rules`; main-window session restore also emitted `?view=rules`. The browser mock did not exercise Rust serde.
- Owner-authorized remediation: make native `SearchView::Automation` serialize as `automation`, retain `rules` only as an inbound serde alias, and make Main restoration produce `?view=automation`. That earlier route-only authorization is superseded by the separate Owner-authorized standalone handoff remediation below. No schema, semantic/runtime authority or filesystem behavior expansion is authorized.
- Superseded pre-remediation installer SHA-256: `E7A342E95356222BF9BC266CB1B6741060E7297C3E23EDAF06B4D85C1D5BF9F3`. It must not be used for Owner qualification. Neither the old candidate nor its installer received Windows Owner qualification.
- Implementation PR: [#322](https://github.com/ArdenZC/Zen-Canvas/pull/322), **MERGED** as `master@4848e51dc9cfd1b87b6f4281aac7717452840cd8` / tree `e5a225a0e2c35d2a509c3e540b29862840c023aa`. Merge-after master CI 37561509211 is **SUCCESS**.
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
- Native changes are confined to route transport and the existing transient Search/Main lifecycle handshake, with one Main-only fixed navigation ACK command synchronized across registration, build input, capability, API and permission matrix. Search write permissions are unchanged. No new filesystem mutation authority was introduced. Operation Preview, confirmation, identity revalidation, journal, Safe Trash and Restore remain unchanged.
- Schema remains **37** and package remains **0.1.40**. Rust also repairs the transient handoff orchestration below; no database migration, durable authority change or Cargo version change is part of the candidate.
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

## Historical route-only local validation (superseded candidate)

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

## Earlier Windows native qualification handoff (historical)

**Status: OWNER QUALIFICATION PENDING — no native PASS is claimed.** The browser mock does not exercise Tauri native behavior or the user's durable data. The pre-remediation candidate and installer are superseded. A fresh Windows candidate build is required from the exact final remediation head, with its new package identity/path recorded in the handoff.

Owner must use that exact candidate in an isolated profile and verify normal startup; Spotlight and Settings entering canonical Automation → Intents; explicit Advanced Policies entry and return; legacy `?view=rules` if safely exercisable; existing Intent and Rule readability; normal Intents default after restart; no Rule/Intent mutation from navigation; and no filesystem mutation. The Owner record must state the automatic filesystem mutation count explicitly. No destructive Rule action is needed for this qualification.

## Hosted CI and final status

PR #322 must have fresh green required checks bound to its exact final head before handoff. Hosted CI is correctness evidence only; it does not replace Windows Owner qualification, authorize merge, or close issue #273. The PR remains Draft and unmerged at the requested stop point:

**NATIVE ROUTE TRANSPORT REMEDIATION IN VALIDATION — OWNER RE-REVIEW PENDING**

## Standalone Search handoff remediation (2026-10-06)

Owner disposition: **HISTORICAL NATIVE FAIL → REMEDIATED → OWNER REQUALIFICATION REQUIRED**. Failed candidate `10f638cf8f100f5aad182c670ee451749d898055` / tree `e120f83d252c93b205272208a62b2492c3b401a5`: **FAIL — Spotlight Automation command closed Search but did not navigate Main.** Failed installer SHA-256 `332DF1543C4286B72DAF61D596ACBD74749095B3E590505E65E47DBF35FFBD71` is superseded. Earlier native observations remain historical; they are not promoted to the repaired candidate.

The defect was a false success across readiness and navigation: Main could reject a stale selection snapshot after Rust emitted navigation, while Rust still destroyed Search. Pure commands now retain generation/nonce/Search session/revision/current-view continuity but ignore unrelated File Library projection churn when `fileId == null`. Non-null file activations retain strict selected ID/selection identity/focused ID continuity and existing ID-only selection/detail projection. Fixed Settings targets and canonical Automation / legacy inbound rules / resident `?view=automation` remain intact.

Search command activations suppress automatic blur-hide while the handshake is in flight and invalidate pre-handoff blur timers, so Main taking focus cannot silently close a rejected/timed-out Search. Explicit user close retains its existing CAS. Both Main listeners install before readiness is published. Main returns the fixed `acknowledge_search_navigation` DTO only for the armed binding, with positive outcome after `applySearchNavigation` succeeds and synchronous stores/React commit complete; rejection returns a negative outcome. Rust's production orchestration revalidates original Search session/revision/visible phase after readiness ACK before emission, waits at most three seconds for matching commit ACK, revalidates again, and hides using the original session/revision under the Search operation lock. Reject/timeout/stale generation/reopened Search returns an error and leaves the active Search recoverable. IPC waits run on a blocking worker rather than blocking renderer ACK delivery. Diagnostics record only stage, fixed route and transient IDs; no query or file paths are added.

Validation and final delivery identity will be bound to the final exact HEAD in the PR #322 handoff. Required evidence includes shared production Rust orchestration tests, mounted production Main bridge/Automation Intents handoff with linked Search close, Settings/file continuity, permission contracts, full frontend/Windows/macOS Rust and resident lifecycle checks, browser presentation gate and a fresh Windows x64 NSIS package. Pending or skipped checks are not PASS. This result does not approve merge, close #273/#323, or perform Owner native requalification. Global Index coordinator/service/USN/MFT/source-state/schema and all Automation persistence/execution authorities remain outside this repair.

### Handoff remediation source validation

| Gate | Fresh local result |
| --- | --- |
| Shared native handoff/lifecycle/route tests | PASS — 37/37 `app_control::tests`; includes no premature hide, negative/absent ACK, post-ready phase/revision validation, reopened Search, generation/nonce/session/revision mismatch, emit failure and final scoped-hide race. |
| Mounted standalone Search/Main relationship | PASS — 12 tests within the full application suite; real Search API, Main hook, stores and mounted AutomationWorkspace; ACK observed only after Automation → Intents commit, then linked Search close; fixed Settings and strict ID-only file continuity/rejection. |
| TypeScript and full application suite | PASS — typecheck; `npm run test -- --dir tests`, 164 files / 1,689 tests. Default unrestricted `npm test` also scanned unrelated research runners and temporary reparse-point/system test files; its failed discovery attempt is retained, not claimed PASS. A Git-free source export was unsuitable for three provenance tests; the repository-root rerun passed. |
| Rust format / Clippy | PASS — `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`; desktop-runtime `--all-targets -- -D warnings`. |
| Windows full Rust suite on this host | NOT PASS — 1,128 passed / 4 failed / 24 ignored before the final two focused tests were added. Three unchanged Automation readiness assertions saw Ready/completed where fixtures expected unavailable/blocked; the unchanged PDF CMap preflight timed out. No credentials, AI readiness, Automation or Content code/tests were altered to bypass these failures. Fresh exact-head hosted Windows/macOS suites remain required for delivery. |
| Frontend production build | PASS — clean source export avoids scanning the pre-existing untracked Cargo/cache/temp trees; existing PDF dynamic-import warning remains. |
| PM-03 browser gate | PASS — seven English/Chinese desktop/narrow/canonical/legacy-route scenarios, zero browser errors and zero file/Rule mutation commands. The runner uses a clean source export; this is browser presentation evidence only. Final exact-head hosted/package evidence is recorded separately. |
| Permission/architecture contracts | PASS in the full application suite: Main-only fixed ACK, synchronized manifest/registration/capability/matrix/API; Search write boundary unchanged. |
| Hosted platform suites / native resident regression / fresh NSIS identity | Required at the final exact HEAD; run conclusions, skipped boundaries and package path/size/SHA-256 belong to the final PR #322 handoff. Pending/skipped jobs do not count as PASS. |

Existing native failure evidence, superseded installers and separate Global Index #323 disposition remain preserved. The repaired binary requires fresh Windows Owner requalification; no such PASS has been performed by this remediation task.

## Final Owner closeout — 2026-10-07

**PM-03 WINDOWS NATIVE OWNER REQUALIFICATION PASS** — **HISTORICAL NATIVE FAIL → REMEDIATED → OWNER REQUALIFICATION PASS**.

Accepted production candidate: `843693ea7e3612a662a5331daaedef557d40fee1` / tree `72b1c263650951be118a5f23e820d5dca8e4e621`; historical exact-candidate CI [37424135807](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37424135807) SUCCESS. Exact fresh Windows installer: 9,811,183 bytes, SHA-256 `02C9ECE0B6799947D8828E7BB0D0B9F52F95166DF3030FC2C503F1688EAD21F9`. Schema 37 / package 0.1.40 remain unchanged. The documentation successor does not rebuild or alter that production candidate.

Final implementation truth: `automation` is the canonical product View; `rules` is compatibility input only. Ordinary Settings/Spotlight/restore entries open Intents; Advanced Policies is explicit. Native `SearchView::Automation` transports canonical `automation` and accepts inbound legacy `rules`. Standalone Search → Main requires navigation commit acknowledgement before original-session scoped Search close. Rule Repository V2 / Rule Proposal remain preserved. PM-02 Automation, Rule, semantic and filesystem execution authorities are unchanged.

Fresh Sandbox naturally passed ownership absence before copied installer launch; exact guest hash was independently verified. Native install completed and the app/service launched. Spotlight changed Overview → Automation → Intents; fixed Settings target, explicit Advanced Policies/return, background residency, real tray reopen with same PID 2252, post-tray Spotlight, genuine Quit and restart with PID 5472 passed. See [final Windows native record](evidence/PM-03/windows-native-qualification.md) for rows, screenshot names, hashes and limitations.

**ACCEPTED DETERMINISTIC ORDERING EVIDENCE** — **native product behavior PASS + deterministic ordering evidence accepted**. The real fresh-Sandbox Spotlight route changed Main Overview → Automation → Intents and the historical Search-close/Main-stays-Overview false success did not reproduce. Exact native transient ordering was not directly recorded; no native ACK trace was captured, and **NATIVE TRACE PASS is not claimed**. Owner accepted this distinction for final closeout; no additional native retry is required solely to capture the transient sequence.

Production Main `src/hooks/useSearchNavigationHandoff.ts` sends positive navigation ACK only after `applySearchNavigation(...)` succeeds inside `flushSync`, committing mounted Main state. Shared Rust production orchestration in `src-tauri/src/app_control.rs` waits for the matching positive navigation ACK, revalidates the original Search session/revision, then executes original-session scoped Search hide (CAS repeated under the operation lock). The mounted regression `tests/standaloneSearchHandoff.test.tsx` proves Automation → Intents is committed while Search is still visible and Search closes only after the backend commit gate releases. The candidate's existing deterministic/hosted evidence is accepted for ordering; it is not relabelled native trace evidence.

Safety: automation_intents, automation_runs, rules, organization_plans, organization_plan_items, operation_batches, operation_logs, cleanup_trash_batches and cleanup_trash_items each remain 0 → 0. `pm03-sentinel.txt` (48 bytes) remains unchanged at SHA-256 `BD56661516663E43D199822225725F5AC4AF39BD8BDFAD50FC75B169C2B65ED4`. **Zen Canvas automatic qualification-fixture filesystem mutations observed = 0**. Internal Global Index SQLite growth is separately recorded; this is not a claim of zero filesystem activity.

**PRE-EXISTING GLOBAL INDEX RECOVERY DEFECT — ISSUE #323** remains independently reproduced and open, without repair. Command-registry Spotlight and PM-03 route qualification remained functional. PM-03 does not absorb File Library/Vault compatibility retirement, legacy managed-AI queue cleanup, design-token debt, generic technical debt, Cleanup automation, autonomous filesystem mutation, Preference Memory, System One/Laya/Jev, release publication or Global Index #323.

Post-merge state: **PM-03 COMPLETE / MERGED / OWNER REVIEW PASSED / MERGE-AFTER MASTER CI SUCCESS**. PR #322 squash-merged as `master@4848e51dc9cfd1b87b6f4281aac7717452840cd8` / tree `e5a225a0e2c35d2a509c3e540b29862840c023aa`; final pre-merge documentation HEAD `b6aa48378fb827054e2df862adc44e0760a6a981` / tree `e5a225a0e2c35d2a509c3e540b29862840c023aa` passed exact-head CI 37560256010, and merge-after master CI 37561509211 is **SUCCESS**. Skipped jobs remain skipped. Post-merge reconciliation PR #324 merged as `master@cfdde76db2e339f1572e889fa586170361e2d796`; merge-after docs CI 37563539120 is **SUCCESS**. #273 is **CLOSED / completed**; #323 remains open. No post-PM activation is authorized.


## Initiative closure

AI-only Product Migration issue #273 is **CLOSED / completed** after PM-03 merge and the post-merge governance reconciliation. No post-PM initiative is active. Global Index issue #323 remains independent and OPEN.
