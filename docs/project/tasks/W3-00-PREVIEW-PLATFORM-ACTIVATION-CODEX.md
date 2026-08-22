# W3-00 — Preview Platform Activation — Codex / Agent Brief

Status: activation candidate — documentation/governance only

Baseline: `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1` (W2-12 closeout merge)

Branch: `docs/w3-preview-platform-activation`

This task activates W3 only after the W2 closeout has placed the project between initiatives. It is a documentation/governance Track. **No production source, Rust/Tauri implementation, package, schema, workflow or test behavior may change in W3-00.**

## 0. Required read set

Before any W3 implementation task begins, read completely:

1. `AGENTS.md`
2. `docs/project/README.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
6. `docs/project/ARCHITECTURE_MAP.md`
7. `docs/project/DEVELOPMENT_WORKFLOW.md`
8. `docs/project/CODE_MAINTAINABILITY.md`
9. `docs/project/TECH_DEBT.md`
10. `docs/project/initiatives/W3-preview-platform.md`
11. `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
12. `docs/project/specs/file-library-preview/01-PRODUCT-IA.md`
13. `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
14. `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
15. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
16. `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
17. `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
18. `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
19. `docs/project/tasks/W1-06-PREVIEW-CONTRACT-CORE-CODEX.md`
20. `docs/project/tasks/W1-10-INTEGRATION-SURFACE-CODEX.md`
21. `docs/project/tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md`

For W3-01, inspect current production implementations before designing changes:

- `src-tauri/src/file_workspace/preview.rs`
- `src-tauri/src/file_workspace/read_gate.rs`
- `src-tauri/src/file_workspace/integration/preview.rs`
- `src-tauri/src/file_workspace/integration/runtime.rs`
- `src-tauri/src/file_workspace/integration/types.rs`
- `src-tauri/src/file_workspace/integration/commands.rs`
- `src-tauri/src/file_workspace/contracts.rs`
- `src-tauri/src/scheduler.rs`
- `src/types/fileWorkspace.ts`
- `src/api/fileWorkspaceApi.ts`
- `src/api/fileWorkspaceMockApi.ts`
- `src/fileWorkspace/workspaceSession.ts`
- `src/views/fileLibrary/`
- current Query V2 / LibrarySelectionV1 source owner seams consumed by File Library.

Do not infer current behavior from this taskbook where `master` says otherwise.

## 1. Activation objective

Move project governance from:

```text
W2 COMPLETE
No active initiative
between initiatives
W3 NOT AUTHORIZED
```

to:

```text
W2 COMPLETE
W3 Preview Platform ACTIVE — implementation
W3-01 Preview Core Consumer-Readiness NEXT
W4/W5 NOT AUTHORIZED
```

W3-00 authorizes the reviewed W3 dependency graph and experience contract. It does not implement Quick Preview itself.

## 2. Pre-activation architecture findings

The following findings are binding inputs to W3-01 rather than optional observations.

### 2.1 W1 Preview Core already exists

`src-tauri/src/file_workspace/preview.rs` already owns the disposable Preview contract:

- PreviewSession lifecycle;
- source snapshots and sourceVersion stale protection;
- Preview Host abstraction;
- Provider Registry interfaces/priority/fallback;
- representation families/completeness/warnings;
- Host ∩ Provider ∩ Source capabilities;
- opaque bounded content-read consumer;
- cancellation/disposal/cleanup semantics.

W3 must consume/extend this authority, not create a second Preview engine.

### 2.2 W1 integration is intentionally metadata-only

`src-tauri/src/file_workspace/integration/preview.rs` currently:

- resolves managed sources through existing managed File Library detail authority;
- resolves ephemeral sources through the same BrowseService that issued their refs;
- gets eligibility/sourceVersion through MaterializationReadGate;
- exposes create/start/snapshot/cancel/dispose/switch lifecycle;
- injects the existing read gate;
- builds `PreviewProviderRegistry::new(Vec::new())`;
- creates Zen hosts and source projections with metadata-fallback capabilities.

The empty registry/capability clamp are deliberate W1 scope boundaries, not reasons to build an unrelated W3 stack.

### 2.3 Tauri lifecycle/permission seam already exists

Preview integration commands are main-window-authorized and blocking work is dispatched through the existing bounded integration execution pattern while cancellation remains callable.

W3 does not need a new cross-window permission model for activation.

### 2.4 Frontend wire is not rich-provider-ready

Rust representation families are broader than the TypeScript `PreviewRepresentationEnvelope`, which currently accepts Metadata only.

W3-01 must make the wire exhaustive/strict before production rich provider output is introduced.

### 2.5 W2 UI is not using Preview Core yet

No production frontend caller currently consumes `fileWorkspaceApi.previewCreate/start/switch...` for the user-facing File Library Quick Preview flow.

Library still uses preview-specific Vault compatibility (`FileLibraryPreviewDialog` and Inspector Quick Look thumbnail). Browse Context has no Preview host.

Therefore W3-02 must create a shared Preview experience/host consumer rather than adding provider-specific behavior to LibraryMode or BrowseMode.

### 2.6 Capability consumer-readiness must precede providers

Current Zen host/source capability projection is metadata-fallback bounded. Since effective capabilities are intersection-based, W3-01 must define truthful Zen host/source capability matrices before provider controls are exposed.

No extension-based UI guessing is allowed.

### 2.7 Progressive Folder Preview seam is not proven

`PreviewCompleteness::Partial` exists, but W1's provider load contract is result-oriented and current production integration does not prove repeated progressive publication.

W3-01 must explicitly implement/test one bounded request/sourceVersion-bound progressive publication seam before W3-07 can claim progressive 100k Folder Preview.

### 2.8 No general materialization action may be fabricated

W1 defines eligibility and the authoritative read/materialization boundary, but W3-00 does not identify a general renderer-authorized user materialization/download command.

`materialization_required` therefore remains an explicit state. A `Download to Preview` action may be added only if an authoritative user-initiated materialization action is separately proven/reviewed.

## 3. Authorized dependency graph

```text
W3-00  Activation + Architecture/Experience Freeze             THIS TRACK
  ↓
W3-01  Preview Core Consumer-Readiness                          NEXT
  ↓
W3-02  Zen Floating Quick Preview Host
  ↓
 ┌───────────────────────────┬───────────────────────────┬───────────────────────────┐
 ↓                           ↓                           ↓                           ↓
W3-03 Pinned Preview +       W3-04 Text/Code +           W3-05 Structured +          W3-06 Image
      sibling navigation           Markdown                    Table providers             provider
 └───────────────┬───────────┴───────────────┬───────────┴───────────────┬───────────┘
                                   ↓
                         ┌─────────┴─────────┐
                         ↓                   ↓
                    W3-07 Folder        W3-08 ZIP
                    Preview provider     Archive provider
                         └─────────┬─────────┘
                                   ↓
W3-09  Failure / Materialization / Security / Accessibility Integration
  ↓
W3-10  Preview Performance + Cross-platform QA
  ↓
W3-11  W3 Closeout
```

Parallel provider/host Tracks start only after their required merged consumer contracts exist. They must not duplicate read/cache/asset/cancellation/provider registry infrastructure.

## 4. Hard architecture boundaries

W3 implementation must not:

- replace Query V2 / LibrarySelectionV1;
- replace BrowseService or persist ephemeral refs;
- replace WorkspaceSession navigation/presentation authority;
- expose renderer-authoritative filesystem paths;
- expose a generic renderer byte-read lease or open-file command;
- create a second Materialization/Read Gate;
- create a second WorkScheduler/executor policy;
- create durable Preview jobs/session persistence/schema merely for convenience;
- add mutation authority to Preview;
- create third-party Preview plugin/DLL/dylib loading;
- perform implicit cloud/provider hydration;
- pull Finder Quick Look extension or Explorer Preview Handler/system integration into W3;
- change supported platforms;
- relax existing W2/Query V2 performance thresholds.

If a Track requires any of the above, STOP and return to architecture review/ADR as required by `DEVELOPMENT_WORKFLOW.md`.

## 5. Frozen experience decisions

The activation PR freezes:

- one Preview Core with Floating and Pinned Zen Hosts;
- Space toggles Floating Quick Preview where eligible;
- Esc closes Floating Quick Preview;
- Floating host is foreground/dialog-like ownership; Pinned host is non-modal Context state;
- Preview follows focused/active current entry, not whole-selection materialization;
- host shell stays mounted during source switching while old publication is revoked;
- Pinned Preview follows current workspace entry and shows select-an-item when no valid source exists;
- Provider/Host/Source capability-driven controls only;
- Metadata fallback for provider-local rich-preview failure;
- explicit terminal materialization/permission/identity/unavailable states;
- no implicit materialization;
- no W4 system host scope.

See `10-W3-PREVIEW-EXPERIENCE-FREEZE.md` for the full contract.

## 6. W3-01 mandatory scope

The first production Track after activation is **W3-01 Preview Core Consumer-Readiness**.

At minimum it must resolve:

1. one production Provider Registry composition owner/factory;
2. truthful `zen_floating` / `zen_pinned` Host capabilities;
3. truthful backend Source capability projection;
4. exhaustive strict Rust/TypeScript Preview representation wire;
5. safe bounded transport for asset-bearing representations;
6. bounded progressive publication semantics for Folder/other partial representations;
7. lifecycle transport needed for shell-first/progressive consumption without weakening cancel/dispose/stale checks;
8. contract tests proving the above.

W3-01 should not simultaneously ship every rich provider or the polished product host.

## 7. Validation for W3-00

Because W3-00 is docs/governance only:

- final diff must contain only intended `docs/**` governance/spec/task files;
- project governance validation must pass;
- CI classifier must identify the PR as docs-only;
- documentation-only validation/aggregate must pass on the exact PR head/integration tree according to ADR-0004;
- no production/Rust/performance/package lane may be forced merely by misclassification;
- exact changed-file list must be independently reviewed before merge.

No W3 production validation is claimed by W3-00.

## 8. Current-truth files required in activation PR

Update coherently:

- `docs/project/STATUS.md` — W3 becomes sole current active initiative and W3-01 becomes NEXT;
- `docs/project/ROADMAP.md` — W3 becomes Current, W4/W5 stay future/not authorized;
- `docs/project/ARCHITECTURE_MAP.md` — record Preview lifecycle/representation ownership and W3 consumer boundary;
- `docs/project/TECH_DEBT.md` — preserve TD-015 and clarify narrow preview compatibility retirement does not close broader debt;
- `docs/project/initiatives/W3-preview-platform.md`;
- `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`;
- `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`;
- this taskbook.

Do not rewrite W2 historical evidence merely to make W3 shorter.

## 9. Definition of Done

W3-00 is complete when:

- W2 remains complete and unchanged in product/runtime authority;
- W3 is the sole active initiative in STATUS/ROADMAP/initiative records;
- W3 scope/non-goals/architecture invariants are reviewable and internally consistent;
- W3-01 is clearly the next production Track;
- W4 native system integration remains explicitly not authorized;
- no production code changed;
- exact-head docs/governance CI succeeds;
- independent diff review finds no current-truth contradiction;
- activation PR is squash merged.

After W3-00 merge, create W3-01 from the merged activation baseline. Do **not** append W3-01 production code to the docs activation branch/PR.
