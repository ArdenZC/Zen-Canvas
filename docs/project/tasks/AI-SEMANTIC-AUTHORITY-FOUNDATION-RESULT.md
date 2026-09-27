# AI Semantic Authority Foundation — Result

Status: **OWNER REVIEW PASSED — MERGED through PR #272**

## Baselines and heads

- Baseline: `master@cc8870f63bd83033f3c7b79afa96bf3ce11821f7`.
- Activation HEAD: `f6d0103e9006fccc759379a47c62df6813181a37`.
- Production HEAD: `c0454b280e15eae4f727840e21849cbe6dd7b08f`.
- Final implementation HEAD: `c0454b280e15eae4f727840e21849cbe6dd7b08f`. Pre-owner-closeout Final HEAD `c9d873319d9a192f78a3f45695d019fbdeb67f18` is docs-only and passed hosted CI `36294160138`; the owner-truth closeout commit remains docs-only.
- Merge commit: `d76bc1f54892bb3e48ac095ea590dcb170f3aa4e`.

## Architecture disposition

| Component | Disposition | Result |
|---|---|---|
| Managed AI durable queue | KEEP | Existing `ai_jobs`, `ai_job_items`, and recovery/retry/cancellation flow retained. |
| Managed Scope consent/provider policy | KEEP | Current enabled scope and provider eligibility are rechecked by the Plan resolver. |
| `ai_analysis_state` | KEEP / REWORK payload | Existing `classification_json` now stores canonical V1; explicit V0 decoding remains. |
| `global_index/legacy_queue.rs` | KEEP this Track | Compatibility adapter remains; retirement remains under TD-006. |
| Direct legacy AI classification | KEEP for compatibility/tests | Not used as the new Managed AI semantic authority. |
| Organization Plan ledger/dry-run/execution | KEEP | Existing Plan, preview, CAS, dry-run, journal and execution boundaries remain. |
| Plan semantic consumption | REWORK | Backend resolver supplies proposal inputs from current Managed AI semantics. |
| Operation Preview | KEEP | Existing backend preview remains authoritative for mutation intent. |
| Cleanup Analysis Finding lifecycle | KEEP | Cleanup is not routed through `ai_jobs`. |
| Cleanup semantic vocabulary | MERGE where safe | Reuses the shared file-type vocabulary; conservative Cleanup merge remains authoritative. |
| Rule Proposal workflow | KEEP | Still creates or updates disabled rules through deterministic preview/validation/confirmation. |
| Rules as semantic default | DO NOT EXPAND | Future product rework only; Rules were not removed. |
| Automation rule-centric UX | FUTURE REWORK | No code change in this Track. |
| Rules navigation | FUTURE PRODUCT MIGRATION | No code change in this Track. |
| Onboarding | FUTURE PRODUCT MIGRATION | No code change in this Track. |

## SemanticAssessmentV1

The strict, versioned Rust contract is `SemanticAssessmentV1`:

```text
version: 1
sourceBinding: { globalEntryId, managedScopeId, inputFingerprint, provider }
refId, fileType, purpose, lifecycle, context, riskLevel, suggestedAction
targetTemplate?, suggestedName?, confidence, reason, keywords, requiresConfirmation
```

Provider JSON cannot supply the backend source binding or authority-bearing fields. Unknown fields fail closed. Inputs have a 64 KiB JSON bound, bounded text/keyword fields, supported domain enums, and finite confidence in `[0, 1]`. `targetTemplate` accepts only safe relative segments; drive, absolute, UNC, traversal, empty segments and invalid Windows names are rejected and downgraded to Review. Risk outside Normal, unknown semantics, low confidence, unsupported actions, unsafe names and extension changes require review/confirmation. Move/Archive without a usable relative target is non-executable Review.

### Canonical persistence and compatibility

- Managed AI parses, validates and sanitizes provider JSON, adds the worker-owned binding, serializes canonical V1, and only then completes `ai_analysis_state.classification_json` and its running job item in the existing transaction.
- Existing persisted V0 Managed AI classification payloads without a version are decoded through an explicit adapter and normalized into V1 in memory; V0 requires confirmation. Malformed, misbound or unsupported versions fail closed.
- **Schema migration: NO.** No new table or schema migration was added; `ai_analysis_state.classification_json` safely carries the versioned envelope.

## Organization Plan consumption

`organization::semantic` resolves a current assessment only when one normalized path identifies exactly one non-stale Global Index entry and the File Library identity still matches its path, name, extension, size, mtime and directory status. It rechecks volume health, active Managed Scope/provider policy, current AI provider/model settings, metadata fingerprint, user-correction state, completed job and completed item, V1/V0 schema and source binding.

The resolver converts only semantic proposal inputs. Zen derives the target with the existing `build_target_path`, `AppSettings`/`OrganizeRootConfig`, filename normalization and extension-preservation policy, then builds the existing authoritative Operation Preview. Semantic content is part of the proposal fingerprint, so refreshing an accepted item after a semantic change clears its decision and returns it to `needs_review` until the user accepts again.

The end-to-end test `organization_plan_consumes_only_a_live_managed_v1_assessment` follows `needs_analysis → analyze/enqueue → real loopback provider response → canonical V1 persistence → Plan refresh → deterministic target → authoritative preview → explicit user decision → dry-run`. It does not write a classification or target into `files.suggested_target_path`.

## Safety boundaries and negative coverage

- Provider-schema tests reject operation/batch/journal IDs, source-binding/fingerprint overrides, absolute targets, permission claims, shell/script/tool fields, malformed versions and invalid stored JSON; traversal, drive and UNC target templates become Review.
- The end-to-end Plan test verifies no execution for malformed JSON, traversal/absolute target fields, `invoice.pdf` → `invoice.exe`, user correction, stale fingerprint, disabled scope and changed Global Index size/identity. It also verifies semantic changes after acceptance reset the decision to `undecided`/`needs_review`.
- Cleanup remains in Analysis Run/Finding/Evidence/Decision and Safe Trash/Restore. A test proves Semantic `DeleteCandidate` cannot grant Cleanup trash authority; existing conservative merge tests still pass.
- Rule Proposal remains policy-authoring assistance. Its boundary test verifies apply leaves `files` classification unchanged, creates a disabled rule, and does not add AI jobs/state, Organization Plans, operation logs or batches.

## Validation

The original focused suites were run on `34830c765c41824e81d10dd6549349863caa527b`; only the managed-worker end-to-end test fixture and its extension-change negative assertion changed afterward. The managed-worker suite was rerun on Production HEAD `c0454b280e15eae4f727840e21849cbe6dd7b08f`.

| Check | Result |
|---|---|
| Semantic schema / V0 tests | 5 passed |
| Managed worker tests, including provider-to-Plan end-to-end and `invoice.pdf` → `invoice.exe` negative case | 7 passed on Production HEAD |
| Organization Plan tests | 25 passed, 1 ignored |
| Cleanup safety tests | 20 passed |
| Legacy classification compatibility tests | 61 passed |
| Rule Proposal boundary test | 1 passed |
| Global Index tests | 17 passed, 2 ignored |
| `cargo check --locked --lib` | Passed at `34830c765c41824e81d10dd6549349863caa527b`; source implementation is unchanged by the test-only follow-up |
| `cargo clippy --locked --lib --tests` | Passed on Production HEAD; only existing `app_control.rs` dead-code warnings |
| `cargo fmt --all -- --check` / `git diff --check` | Passed |
| Local temporary artifacts | Task-owned F: test/build root cleaned after both runs; 5.5 GiB and 4.5 GiB were removed in separate passes; root is absent |

Full Hosted CI on Production HEAD `c0454b280e15eae4f727840e21849cbe6dd7b08f`: [run 36293630071](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36293630071), attempt 1 completed successfully (14 jobs passed, 13 routing-skipped, no failures). This includes the exact-head Windows/macOS Rust quality and release lanes, Global Index qualification, and applicable performance lanes. On the preceding Production HEAD `34830c765c41824e81d10dd6549349863caa527b`, [run 36291989804](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36291989804) first had a process-level macOS Rust test `SIGBUS` without a failing assertion; its failed-job-only attempt 2 passed all required jobs, including macOS race and Quick Look validation.

## Changed files

- `docs/project/ARCHITECTURE_MAP.md`
- `src-tauri/src/ai/classification.rs`
- `src-tauri/src/ai/cleanup.rs`
- `src-tauri/src/ai/mod.rs`
- `src-tauri/src/ai/semantic.rs`
- `src-tauri/src/db/queries/organization/mod.rs`
- `src-tauri/src/db/queries/organization/projection.rs`
- `src-tauri/src/db/queries/organization/queries.rs`
- `src-tauri/src/db/queries/organization/semantic.rs`
- `src-tauri/src/db/queries/rule_proposals/mod.rs`
- `src-tauri/src/global_index/managed_worker_hardened.rs`
- `src-tauri/src/global_index/repository.rs`
- `docs/project/tasks/AI-SEMANTIC-AUTHORITY-FOUNDATION-RESULT.md`

## Residuals and next gate

- #270 remains a separate macOS resident/release qualification issue and is not changed or reclassified here.
- No UI changed; native visual acceptance is not required for this backend Track and was not claimed.
- Owner review is complete and PR #272 is merged. AI-only PM-01 remains **NOT ACTIVE** on the owner design hold associated with issue #273 / Draft PR #274. Pre-PM Cleanup correctness work is tracked separately in issue #275 / Draft PR #276.

Final disposition: **OWNER REVIEW PASSED — MERGED through PR #272 at `d76bc1f54892bb3e48ac095ea590dcb170f3aa4e`**


## Owner review decision

Owner review found no remaining production blocker. Semantic authority, persistence, Organization Plan consumption, Cleanup isolation, Rule Proposal separation and negative-security coverage are accepted. Production HEAD CI `36293630071` and pre-closeout Final HEAD CI `36294160138` are successful. #270 remains separate and is not reclassified.
