# PM-03 — Product Hierarchy / Migration Closeout Result

**Disposition:** PM-03 implementation candidate complete — ready for Owner review / Windows native qualification. **Draft PR #322 remains unmerged; issue #273 remains open. Windows Owner native qualification has not been performed.**

## Candidate identity

- Repository: `ArdenZC/Zen-Canvas`.
- Authorized implementation branch: `product/pm-03-product-hierarchy-migration-closeout`.
- Exact starting baseline: `master@c72bbce173d53660a68d797b3e0ac2a32cfeb7c5`, tree `8fc2b93b9c64abbc8e0fd892d44fe363a0468f5f`.
- Activation: PR #320 merged at `c059d911eb053753d7ce7693aa30e39e3965f88c`; activation merge-after CI 37270388844 succeeded. Reconciliation PR #321 merged and established the implementation baseline above; merge-after CI 37270657097 succeeded.
- First implementation commit: `9495deea` (route migration, focused tests, and browser evidence runner).
- Implementation PR: [#322](https://github.com/ArdenZC/Zen-Canvas/pull/322), **OPEN / DRAFT**, base `master`. It does not close #273 and has no auto-merge.
- Final documentation/evidence candidate SHA and tree are the final PR #322 head recorded in the Owner handoff; all final validation and hosted checks must bind to that exact head.

## Product hierarchy and route contract

The candidate changes the canonical frontend `View` identity from `rules` to `automation`. `src/utils/viewRoutes.ts` is the shared normalization boundary:

| Input | Result |
| --- | --- |
| `automation` | canonical `automation` |
| historical `rules` | `automation` |
| unknown initial URL value | safe `scanner` startup fallback |
| unknown setter input | safe `scanner` fallback |

The same normalizer handles startup query input and cross-window navigation. Current cross-window payloads emit canonical views; inbound `rules` remains accepted only as a compatibility input and still passes the existing nonce, session, revision, selection and Settings-target checks. Application state contains no `rules` view.

AppShell renders `AutomationWorkspace` from `automation`; the heading, description and topbar describe plan preparation and review. Spotlight targets `automation` while retaining English `rules` and Chinese `规则` discovery keywords. Settings → Automation and the ordinary Timeline destination also target `automation`.

Every ordinary Automation entry resets the transient, non-persisted surface to **Intents**. `?view=rules` therefore opens Automation → Intents. **Advanced Policies** appears only after an explicit action inside Automation and continues to render the existing Rule Repository V2 / Rule Proposal UI. Its bilingual copy identifies deterministic compatibility policy behavior and says it is not the current Managed AI Organize semantic authority.

The active onboarding copy was audited and contained no Rule-centric product claim, so onboarding code is unchanged. Current Rule-specific UI/API and terminology remain in their Rule domain; historical documents and evidence were not rewritten.

## Preserved authority and excluded scope

- Rule Repository V2, Rule Proposal, Rule persistence, AST, create/edit/enable/pause/delete controls, evaluation and watcher behavior are unchanged. Navigation alone does not mutate an Intent, Rule, Proposal or Plan.
- PM-01 Managed AI Organize semantics remain authoritative. PM-02 Intent, Run, trigger, scheduler and review behavior remain unchanged.
- No new filesystem mutation authority was introduced. Operation Preview, confirmation, identity revalidation, journal, Safe Trash and Restore remain unchanged.
- Schema remains **37**. Package remains **0.1.40**. No migration, Rust/backend change or Cargo version change is part of the candidate.
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

The 23 screenshots are supplementary presentation evidence, not native acceptance. Example captures: [English Spotlight entry](evidence/PM-03/en-desktop-spotlight-intents.png), [Chinese narrow Advanced Policies](evidence/PM-03/zh-narrow-advanced-policies.png), and [Chinese Settings entry](evidence/PM-03/zh-desktop-settings-intents.png). Full measurements and all screenshots are in [PM-03 evidence](evidence/PM-03/).

## Local validation

No test was weakened to accommodate the migration.

| Gate | Result |
| --- | --- |
| TypeScript typecheck (`npm run typecheck`, also reached through `verify:frontend`) | PASS |
| Focused route, AppShell, Spotlight, Settings, Automation mounted and Rule regression tests | PASS — 14 files, 115 tests |
| Full application test directory (`npm exec vitest -- run --dir tests`) | PASS — 163 files, 1,676 tests |
| Full repository `npm test` | PARTIAL LOCAL ENVIRONMENT FAILURE — 170 files / 1,761 tests passed; 4 unchanged ZDB research test suites under `research/zen-decision-bench/tests/` failed during collection with `SyntaxError: Invalid or unexpected token`. No application test failed and no research files were changed. The exact-head hosted Frontend CI on the implementation commit passed its frontend test, architecture and browser gates. |
| Remediation tests (`npm run test:remediation`) | PASS — 1 file, 14 tests |
| Architecture/performance routing (`npm run test:performance:architecture`) | PASS — architecture guard and 3 files / 30 tests |
| Frontend production build (`npm run build:frontend`) | PASS. Vite emitted CSS `var(...)` parse warnings and an `INEFFECTIVE_DYNAMIC_IMPORT` warning for the PDF renderer; no changed file owns those warnings. |
| Governance (`npm run test:governance`) | PASS |
| Documentation validation | PASS — `npm run test:docs` with `DOCS_DIFF_BASE=c72bbce173d53660a68d797b3e0ac2a32cfeb7c5`; 5 changed Markdown files validated. |
| `git diff --check` | PASS on the current documentation/evidence candidate against the authorized baseline. |
| Hosted CI | PASS on current PR #322 head `a1f8ab1a36ae1331c588e304ec181dc76f83c2ea` — required frontend, format, browser, performance routing/profile and change-scope checks succeeded. A fresh run will bind the final docs-only closeout commit to CI. |
| Windows candidate package build | Pending fresh build from the final exact PR head. |

## Windows native qualification

**Status: OWNER QUALIFICATION PENDING — no native PASS is claimed.** The browser mock does not exercise Tauri native behavior or the user's durable data. A fresh Windows candidate build is prepared separately for the exact final PR head; its package identity/path is included in the handoff.

Owner must use that exact candidate in an isolated profile and verify normal startup; Spotlight and Settings entering canonical Automation → Intents; explicit Advanced Policies entry and return; legacy `?view=rules` if safely exercisable; existing Intent and Rule readability; normal Intents default after restart; no Rule/Intent mutation from navigation; and no filesystem mutation. The Owner record must state the automatic filesystem mutation count explicitly. No destructive Rule action is needed for this qualification.

## Hosted CI and final status

PR #322 must have fresh green required checks bound to its exact final head before handoff. Hosted CI is correctness evidence only; it does not replace Windows Owner qualification, authorize merge, or close issue #273. The PR remains Draft and unmerged at the requested stop point:

**PM-03 IMPLEMENTATION CANDIDATE COMPLETE — READY FOR OWNER REVIEW / WINDOWS NATIVE QUALIFICATION**
