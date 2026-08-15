# Zen Canvas Technical Debt Register

Technical debt is tracked by exit condition, not by age, aesthetics or filename. A debt item may remain intentionally if removing it would increase product risk.

Statuses: `open`, `planned`, `blocked`, `retiring`, `closed`.

| ID | Area | Status | Debt / reason | Exit condition |
| --- | --- | --- | --- | --- |
| TD-001 | File Library | open | `useFileLibraryStore` has become a broad compatibility umbrella for scope/stats/scan/AI/legacy list concerns while Query V2 owns managed-library querying | No production imports depend on its legacy facts; affected flows use owning durable projections; focused mounted regressions and full relevant gates pass |
| TD-002 | Runtime | open | `AppRuntimeProviders` coordinates too many unrelated lifecycle effects | Ownership split into focused runtime controllers/providers with one composition root and no duplicate lifecycle authority |
| TD-003 | Watcher | open | renderer legacy watcher retry/upsert adapter remains as capability fallback | Supported product builds prove backend reconciliation is always available or an explicit compatibility support window ends; fallback regressions replaced with backend reconciliation coverage |
| TD-004 | Operations | planned | `useOperationQueueStore.syncPreviews(files)` has no known production caller | Repository-wide production search remains empty; tests are migrated to authoritative preview APIs; focused operation/preview regressions pass |
| TD-005 | Organize/Operations | open | `useOrganizeDecisionStore` remains an edited-name compatibility bridge | Edited-name propagation lives in authoritative operation intent/preview projection; no production caller remains; replacement regression proves continuity |
| TD-006 | Managed AI | open | `global_index/legacy_queue.rs` remains an adapter into the durable managed-AI queue | Production classification/cancel paths use final queue API directly and old durable rows retain tested migration/repair coverage |
| TD-007 | Design system | open | legacy token aliases remain in production callers | Production/reference search shows no alias usage except migration notes; supported visual states pass |
| TD-008 | Rust modules | open | several domain modules are very large and mix orchestration with submodules | Module boundaries are documented and extracted around stable responsibilities without changing durable authority or measurable behavior |
| TD-009 | Windows platform | planned | Windows filesystem safety is mature but less explicitly packaged behind a platform module than macOS | A reviewed platform-boundary refactor preserves existing handle-bound safety and all Windows mutation/recovery tests |
| TD-010 | Tauri contracts | open | command registration/allowlist/capability/security-matrix truth is synchronized across multiple files | A reviewed generation/validation mechanism removes duplication without weakening main/search window permission separation |
| TD-011 | Branch governance | closed | historical/squash-integrated remote branches can appear ahead after logical work is already on master | Known candidates received ancestor/content-equivalence review and were deleted under the workflow closeout rule; future candidates follow the same rule |
| TD-012 | Build assets | blocked | legacy/one-off brand or installer assets may be obsolete but deletion could affect real packaging | Exact supported-platform packaging proves replacements and repository search shows no required consumer before deletion |
| TD-013 | Evidence ownership | closed | completion evidence was duplicated across V4.3 execution, macOS QA and historical closeouts | G1B established the current evidence index and marked historical records as evidence-only without deleting them |
| TD-014 | macOS Safe Trash | open | schema-34 cleanup rows have no separate source-volume column, so new macOS source/claim physical identity is encoded in the existing file-id compatibility field and legacy untagged rows must fail closed | A separately authorized cleanup-ledger migration adds/backfills a dedicated source-volume field, validates legacy rows and rollback/future-version behavior, then the tagged adapter and its tests are removed |

## Existing detailed retirement ledger

`docs/remediation/LEGACY_RETIREMENT_PLAN.md` remains the detailed source for legacy paths that already have caller, authority, migration and deletion-condition analysis. This register indexes those items at project level; it does not weaken their existing exit conditions.

## Debt acceptance rule

A debt item is not a bug merely because it exists. Removal is approved only when:

1. the current authority is understood;
2. current callers are enumerated;
3. the replacement path exists;
4. deletion conditions are testable;
5. regression and platform gates match the risk.

Do not bundle unrelated debt retirements into a feature PR for cosmetic cleanliness.
