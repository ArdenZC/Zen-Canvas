# PM-02A — Automation Intent Foundation Result

Status: **IMPLEMENTED FOR REVIEW — OWNER REVIEW PENDING — DRAFT / DO NOT MERGE**.

Issue [#273](https://github.com/ArdenZC/Zen-Canvas/issues/273), activated by merged [PR #312](https://github.com/ArdenZC/Zen-Canvas/pull/312). Exact implementation start is `master@b698228e94a1857e0610cccb2364e1027f6b1b0d`; isolated branch is `product/pm-02a-automation-intent-foundation`. PM-02B and PM-03 remain **NOT ACTIVE**. ZDB-03 and all frozen research artifacts remain unchanged. No merge, release or provider credential was requested or used.

## Resulting product behavior

Automation opens from the existing Settings/Spotlight entry with **Intents** as its primary surface. A user saves a title, reusable Library query/root scope and enabled/paused state. Fixed facts remain Manual / Review required / No automatic execution. Generate plan runs once against current backend index truth, records a durable receipt and exposes Open plan. That action opens the existing Organization Plan store and Organize route. Pending/blocked analysis is explicit; the user refreshes in Organize after analysis. Existing Rule Library, Rule Proposal, enable/run/recompute and watcher Rule behavior remain under **Advanced Rules** without semantic changes.

## Durable and IPC contracts

[Schema 36](../SCHEMA_36_AUTOMATION_INTENTS.md) adds exactly `automation_intents` and `automation_runs`, three explicit indexes, PK/unique indexes and fixed contract constraints. Package version remains 0.1.40. The existing migration transaction preserves Schema 35 data, reopening 36 is idempotent and 37+ is rejected.

`AutomationIntentV1` binds id/revision/title/workflow, canonical Query V2 scope/fingerprint, trigger, policy, enabled and creation/update/archive timestamps. Trigger is `{version:1,kind:"manual"}`. Policy is `{version:1,review:"required",autoExecute:false}`. The editor has no policy/schedule/automatic-execution controls. Create/update reject unknown envelopes and ephemeral scope extensions; update, enable/pause and archive use expected revision CAS. Archive retains the Intent and Run history; there is no hard-delete command.

`AutomationRunV1` binds id/requestKey/intentId/exact intentRevision/manual trigger, canonical scope fingerprint, fresh library snapshot revision, terminal orchestration status, optional Plan ID, queued analysis count, refresh requirement, sanitized blocker/error codes and timestamps. A completed Run means orchestration returned, never that a Plan was reviewed/executed or that queued AI finished. A Plan ID remains historical if the existing Organize owner later deletes that Plan.

| Commands | Window / permission boundary |
| --- | --- |
| `list_automation_intents`, `get_automation_intent`, `list_automation_runs` | Main only; read-only |
| `create_automation_intent`, `update_automation_intent`, `set_automation_intent_enabled`, `archive_automation_intent` | Main only; state mutation |
| `run_automation_intent_manual` | Main only; state mutation; no filesystem-mutation permission |

All eight commands have explicit registration, capability and permission-matrix coverage. Search capability receives none. Lists are bounded to 200 active Intents / 100 recent Runs; the UI displays a receipt only when present in that recent projection. History for an archived Intent remains readable through its ID. Equal-second Run timestamps use insertion order for the latest receipt.

## Scope, idempotence and owner graph

Only durable `all_enabled_roots` and nonempty selected root IDs are accepted. Existing Query V2 canonicalization owns text/filter/sort/fingerprint semantics. `current_scan`, Browse scope/path, renderer snapshot revisions, renderer file membership and precomputed counts are rejected. Current enabled/healthy root admission is revalidated on every new Run; a disabled/removed selected root produces a blocked receipt with no Plan and never expands the scope. All-enabled semantics intentionally resolve the current enabled-root set.

```text
Manual IPC + fixed contract / CAS admission
  → globally unique requestKey bound to Intent ID/revision
  → healthy reusable Query V2 + fresh backend snapshot
  → existing Organize AllMatching materializer (current Managed AI semantics)
  → atomic Plan + Run receipt publication
  → missing/stale items only: existing readiness / provider / credentials / scope consent
  → existing analyze_organization_plan_items, bounded batches ≤100
  → receipt + Open plan → STOP
```

The existing materializer is extracted into a dedicated module without changing SQL, proposal generation, target projection or safety/execution semantics. Its request identity is the Run ID. The transaction durably binds the returned Plan ID to that Run, making request-key races/retries unable to create a second Plan. A key reused for another Intent/revision fails; stale expected revisions fail before orchestration. The renderer suppresses duplicate in-flight clicks and reuses the same request key following an uncertain response.

Already-current assessments bypass fresh provider readiness. Missing/stale assessments use the existing queue only when current readiness permits it; readiness blockers preserve the reviewable Plan and truthful needs-analysis/blocked items. Stale/unavailable semantic projections are consumed without converting them into fabricated proposals. Enqueue failure retains the admitted partial count. The existing most-specific enabled managed-scope ordering governs admission. No provider client is created here, and no provider request schema changes.

A crash after atomic publication leaves `automation_analysis_admission_unconfirmed` and the durable Plan; the stored count reflects only confirmed admission, and existing queued work may continue. Retries return the receipt rather than resuming work. Explicit Organize analysis/refresh is the recovery path. No new retry loop, timer, watcher, scheduler, thread, governor or AI queue exists. No decision acceptance, Dry Run, filesystem execution, deletion, shell or Cleanup execution call is reachable from this manual owner.

## Validation and evidence

Local checks at the implementation tree:

| Check | Result |
| --- | --- |
| TypeScript typecheck | PASS |
| `npm test -- --exclude 'research/**'` | PASS — 160 production suites / 1,664 tests |
| New frontend + architecture + mock tests | PASS — 10 tests; main command permission suite also passes |
| `npm run test:remediation` | PASS — 14 tests |
| `npm run test:performance:architecture` | PASS |
| `npm run build:frontend` | PASS — existing PDF dynamic/static-import warning retained |
| Rust `db::automation` | PASS — 15 tests |
| Rust migration integration suite | PASS — 8 tests / 2 ignored performance fixtures |
| Corrected integration regressions | PASS — 76 tests; 8 ignored performance fixtures |
| Reusable fixture builder | PASS — 100,000-file base plus three working copies validate Schema 36 |
| Full Linux Rust library suite before four extra fixtures | 940 PASS / 25 unsupported native/Browse failures / 23 ignored; all schema assertions now pass |
| Local Rust clippy `--lib --tests` | PASS with only existing Linux unsupported-platform/dead-code warnings; no new-module warning |
| Browser harness | PASS — three scenarios, zero page errors, no overflow, focus/handoff/Rules checks |
| Rust formatting and diff whitespace | PASS |

Local Rust checks used a temporary Linux-only `keyring` test dependency and task-owned native library sysroot because Linux is not a product target. The temporary Cargo edit is restored and is absent from the PR; supported Windows/macOS policy, dependencies and lockfile are unchanged. Existing native failures were not skipped or relaxed. Supported-platform hosted CI is authoritative for native compilation and mutation tests. Exact-head run/result is recorded in the Draft PR handoff; no full hosted PASS is claimed. Initial implementation-head CI [36725310781](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36725310781) confirms all 1,763 frontend tests passed, with only the frozen-research suite failing at import. Windows library tests (1,094) and macOS library tests (1,039), including all 15 Automation fixtures, passed. Both release compiles, Windows service qualification and native macOS performance passed. That run exposed remaining Schema 35 expectations in integration tests and the Rust performance fixture identity; those expectations are updated to 36 without changing other assertions. The next run passed fixture preparation and Windows Rust quality, then exposed the performance consumer’s last hard-coded Schema 35 expectation. The consumer now uses the shared fixture schema constant (36); a new exact-head CI run is required.

The new backend fixtures cover empty/fresh/populated 35→36, exact indexes and constraints, CRUD/CAS/archive, invalid/ephemeral scope, disabled/removed roots, canonical fingerprints, fresh snapshot resolution, globally conflicting/concurrent retries, current assessments without fresh credentials, stale/missing analysis, current readiness blockers and ready admission through the existing Managed AI queue. Runtime assertions retain undecided items and zero operation batches. Frontend tests cover creation/scope, invalid scan reuse, pause/enable, stale edit, pending/blocked receipts, duplicate-click and request-key reuse, existing Plan-store handoff, Advanced Rules, bilingual copy and keyboard focus restoration. Architecture tests inspect TypeScript call expressions/imports and bound Rust Database calls; direct filesystem/execution and recurring idle owners are rejected.

Browser evidence is generated by `node scripts/runPm02aBrowserEvidence.mjs`. Three scenarios cover 1440×960 English blocked analysis, 760×900 English analysis requested and 1440×960 Chinese current assessments. Each creates/configures an Intent, generates a Plan, verifies focus restoration and no horizontal overflow, opens it in Organize and reaches existing Advanced Rules. Browser mocks are presentation fixtures, never backend/provider acceptance evidence. Images and measurement JSON are committed in [PM-02A evidence](evidence/PM-02A/README.md).

**Native boundary:** this execution host is Linux. No supported local Windows or Apple Silicon GUI host is available; safe Windows native screenshots, restart durability through the real application and exact-head native user-flow acceptance remain **NOT CAPTURED / OWNER VERIFICATION REQUIRED**. SQLite reopen coverage proves backend persistence only. No real cloud credential or provider request is needed for this task.

**Baseline regression boundary:** unfiltered `npm test` reaches the existing frozen ZDB-03B4 verifier and fails `STOP:b4:frozen_blob:research/zen-decision-bench/preference/README.md`. That verifier requires the earlier B4 start tree, while later merged Owner research disposition changed the README. The PM-02A diff does not modify that README, verifier or any frozen research file. Repairing that baseline guard is outside PM-02A and was not attempted. Full Linux Rust tests also encounter existing unsupported-platform Browse/native execution cases; the supported Windows/macOS CI lanes remain the qualification source.

## Protected authority / next gate

Rule Repository V2, Rule Proposal, watcher Rule executor, provider schema/parser, Managed AI current-assessment semantics, WorkScheduler/governor, Operation Preview, decision acceptance, execution/journal, Safe Trash, History/Restore, System One/Laya/Jev, Preference Memory/RAG/vector stores and all frozen ZDB inputs/results are unchanged. Existing tests only update current schema numbers and assert the intentional wrapper route plus retained Advanced Rules owner. No unrelated assertion is relaxed.

Owner reviews the Draft PR, exact-head CI failures/results, browser boundary and missing native evidence. PM-02A remains **OWNER REVIEW PENDING**. PM-02B and PM-03 remain **NOT ACTIVE**. Do not merge or publish.
