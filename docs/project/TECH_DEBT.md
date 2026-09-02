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
| TD-014 | macOS Safe Trash | closed | Schema-34 cleanup identity encoding required a compatibility field for macOS source/Claim physical identity | Schema 35 adds the dedicated source-volume field, normalizes only provable historical source/Trash/Claim components, preserves ambiguous rows for manual review, retires the runtime tagged adapter, and passes migration, rollback, recovery and applicable native hardening coverage |
| TD-015 | File Library compatibility retirement | open | The W2 application route now uses `FileLibraryWorkspace`, but post-W2 Library Mode still intentionally consumes legacy Vault compatibility modules/components (`views/vault/components`, `useLibraryContentCompatibility`) and `VaultView` remains in the production tree/export surface. W2-12 therefore cannot prove the W2-01 compatibility surface has zero production consumers. | A separately reviewed post-W2 retirement task enumerates every remaining compatibility caller, moves each behavior to its durable owning module without changing Query V2/LibrarySelectionV1 authority, proves behavior/real-browser equivalence, confirms no production caller remains, and only then removes the legacy compatibility surface. |

## W2-12 debt audit

W2-12 explicitly reviewed TD-015 against its exit condition and **keeps it open**. This is not a W2 release blocker: the canonical application File Library route mounts `FileLibraryWorkspace`, and W2-03 through W2-11 proved the replacement experience and authorities. The debt concerns safe deletion of remaining compatibility modules, not whether File Library 2.0 is the active product route.

No unrelated debt item is closed merely because W2 closes. `RECENT_AUTHORITY_MISSING` remains a reviewer-authorized product defer rather than a technical-debt entry because no concrete legacy implementation is being carried solely to support it.

## W3 activation debt rule

W3 Preview Platform starts while TD-015 remains **open**.

The current Library Preview path is one concrete part of that compatibility surface: Library Mode still reaches the Vault `FileLibraryPreviewDialog`/Inspector compatibility path, and the Inspector may use the existing macOS Quick Look thumbnail compatibility flow. W3 is authorized to replace these **preview-specific callers** with the shared W1/W3 Preview Core + Zen Host path when the owning W3 Track proves focused behavioral/real-browser equivalence.

That narrow retirement does **not** close TD-015 by itself. TD-015 closes only when its broader exit condition is satisfied for every remaining File Library/Vault compatibility caller.

W3 must also keep the following distinctions clear:

- `useOperationQueueStore.syncPreviews(files)` / Operation Preview debt is not the W3 content Quick Preview platform merely because both use the word “preview”;
- existing macOS Quick Look thumbnail compatibility may remain where it still truthfully serves Thumbnail/Inspector behavior until the owning replacement proves equivalence;
- W3 feature PRs must not bundle unrelated Vault/debt cleanup for cosmetic reasons;
- W3 activation creates no new debt item merely for the intentionally empty W1 Provider Registry, Metadata-only TypeScript representation wire or capability clamp: those are explicit first-class W3-01 implementation scope, not abandoned compatibility debt.

If W3 implementation intentionally introduces a temporary compatibility bridge beyond the approved W3-01/host migration seams, it must receive its own exit condition here before merge.

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
