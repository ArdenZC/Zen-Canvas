# Task 07 Implementation Closeout — Natural-Language Rule Proposal and Approval

## 1. Delivery state

- Baseline HEAD: `42dce2ea2dbdfdf9b0c5616364f090a9a5d89761`.
- Task 06 merge ancestor: `29e85c099c5ee921ad7d4237c780dc47126e0fa3`.
- Implementation branch: `remediation/07-rule-proposal`.
- Final HEAD: recorded after the atomic commits and push in the Draft PR.
- Draft PR title: `feat: add natural-language rule proposals and approval`.
- Schema: `32 → 33`.
- Task 08: not started.
- Delivery stops at human code-level review; no merge is authorized.

## 2. Task 06 accepted handoff closure

| Accepted item | Implementation and evidence |
|---|---|
| Dry-run/execution equivalence | Organization refresh, dry-run and execution rebuild the same live authoritative target facts and dispatch the exact canonical preview. |
| Managed root health | Scope/root health, watcher recovery and watcher revision are checked at refresh, dry-run and execution; stale or unhealthy state fails closed. |
| `needs_review` approval | Backend review-state projection exposes an explicit reviewed path; blocked, unsupported and deleted states cannot be upgraded. |
| Crash projection | Finalization and restart recovery share terminal projection; journal-success rows become `completed`, with fault-injection tests. |
| Retention union | Age UNION count overflow, child-first ordering, deduplication and maximum 20 deletions per pass are tested. |
| Plan summary | Summary totals are backend authoritative aggregates, not a first-page inference. |
| Package evidence | Local package, remote workflow jobs and skipped jobs are recorded separately; skipped is never called success. Real Windows NSIS and macOS unsigned-DMG success evidence is required from CI. |

## 3. Frozen references and license boundary

Coworker / `accomplish-ai/coworker`:

- SHA `2cf74d08f22078b8b1fd3f97bff3ec4612262613`.
- License: MIT (`LICENSE`).
- Read at the frozen SHA: `LICENSE`, `README.md`, `packages/agent-core/src/opencode/config-generator.ts`, `packages/agent-core/src/opencode/system-prompt-behaviors.ts`, and `docs/qa-suites/permissions-filesystem-tests.md`.

OpenCode / `anomalyco/opencode`:

- SHA `7565e03536d19e850f9996c407f9bf5e932b5f7a`.
- License: MIT (`LICENSE`).
- Read at the frozen SHA: `LICENSE`, `packages/opencode/src/permission/index.ts`, `packages/web/src/content/docs/permissions.mdx`, `packages/schema/src/permission.ts`, and `packages/opencode/src/tool/task.ts`.

Borrowed only as principles: visible proposal/review before action, explicit user scope, allow/ask/deny classification, one-time approval, refusal stopping the action, correction followed by a new proposal, and permission evaluation separated from execution. Explicitly rejected: source/DTO/UI/event-bus copying, Coworker daemon, OpenCode SDK/runtime/serve, shell/MCP/tools/skills/subagents/browser automation, wildcard execution permissions, auto-approve, generic Agent task runtime and generic permission database.

## 4. Schema 33 and rollback

Migration is additive and runs inside the existing `BEGIN IMMEDIATE` migration transaction. It adds `rules.ast_version`, `rules.revision`, `rules.origin_proposal_id`, singleton `rule_catalog_state`, and `rule_proposals` with its two required indexes. `user_version` is written last; conflict and future-schema tests prove rollback and rejection. Existing rules backfill AST/revision defaults. No `files` ALTER, `files.id` migration, operation/cleanup journal change, Managed AI schema change, Analysis/Finding change, Plan change or Global Index rewrite was made.

Real schema-32 fixtures, idempotence, conflict rollback, future guard, WAL reader and 100k/1M no-rewrite fixtures are covered.

## 5. Rule Proposal ledger and lifecycle

`rule_proposals` is a durable review/provenance ledger with bounded prompt, candidate, clarification, warning, provider/model provenance, validation, target/base revision, proposal revision and terminal timestamps. The state machine is `draft → generating → ready`, with clarification/invalid/failed outcomes, revision-owned regeneration, `ready → applying → applied`, and explicit cancellation. Applied/cancelled proposals cannot regress. Startup recovery marks an interrupted owner as failed with a stable code; pruning retains active states, unions age/count terminal candidates, deduplicates and deletes at most 20.

Generation is an existing-provider adapter, in-memory bounded to two requests with one owner per proposal and an atomic cancellation flag. There is no second durable queue and no raw provider response persistence. Late owners are rejected by durable revision/CAS.

## 6. AST V1, grounding and permissions

The only candidate target is existing Rule AST V1. Strict model JSON allows only the frozen envelope and candidate fields. Rust canonicalization normalizes enum/operator/extension/numeric/date/action values, creates deterministic IDs and fingerprint, enforces capacity limits and rejects unknown fields. Every free-text/path/extension/template/number/day literal must be in the prompt or a deterministic normalization; ungrounded values require clarification. Delete/trash, shell/script/tool/command, content/OCR, protected-system-target, arbitrary mutation, auto-enable and auto-run intents are denied. Ordinary metadata-only candidates are `allow`; path/risk/conflict/update and other human-confirmation cases are `ask`. `allow` never means automatic Apply.

Provider input is fixed system policy plus the user-entered prompt and, for update only, the selected canonical target AST. No file content, file list, path sample, credentials, secrets, SQL, script, shell or tool context is sent. Diagnostics are bounded and redacted.

## 7. Impact preview and Human Apply

Impact compilation reads only File Library metadata in a durable managed scope and a single SQLite read snapshot. Scope health, watcher recovery/revision, library revision, candidate fingerprint, target revision, catalog revision and policy version are bound. Exact results return truthful counts; large expensive predicates return a real bounded sample (maximum 20), `matchedCount = null` and an opaque resolver token. The resolver recomputes exact impact; no estimate or durable count job exists. The preview fingerprint includes the full proposal/rule/catalog/library/scope/permission/policy binding.

Apply accepts only IDs, expected revisions, exact preview fingerprint and `confirmed=true`. It re-canonicalizes, revalidates target/scope/library/catalog state, recomputes exact impact and then atomically writes proposal + user rule under CAS. Backend generates ID/source/timestamps; created or updated user rules are `enabled=false`; `origin_proposal_id` is preserved. Apply does not run rules, change `files`, create an Organization Plan, call a journal, or move/rename/delete/trash any file. Enable and Run remain separate controls.

## 8. Rule Repository V2 and execution authority

`list_user_rules_v2`, `create_user_rule_v2`, `update_user_rule_v2`, `set_user_rule_enabled_v2`, `delete_user_rule_v2` and `get_rule_catalog_state` use per-rule plus catalog revision CAS. System/learned rules are protected. Legacy whole-object write commands remain internal/test compatibility only and are not capability write authority.

`execute_rules_for_scope_v2` accepts only durable scope IDs, mode, expected catalog revision and confirmation. The backend loads enabled persisted user/allowed learned/system rules from SQLite, validates them, computes the classification version and invokes the existing metadata classification engine. Manual Rules UI, scanner and watcher adapters use this authority; no renderer Rule vector is accepted. Rule execution changes classification/suggestion metadata only.

## 9. UI, store, API, permissions and mock

Rules UI includes Describe/Manual entry, provider/model disclosure, the exact privacy statement “只发送你输入的文字，不发送文件内容。”, examples, generation/cancel, proposal history/Continue Later, clarification and validation display, AST inspector, exact/deferred impact, bounded samples/conflicts, Edit Candidate, Regenerate, Apply as Disabled Rule, and separate Enable/Run actions. Apply confirmation states “Rule saved, currently disabled.” Accessibility uses keyboard-first controls, stable labels, focus-safe dialogs and live generation/validation/impact messaging; narrow/CJK/RTL/reduced-motion/high-contrast styles inherit existing system primitives.

`useRuleProposalStore` and the Rule catalog are backend-hydrated, keep proposal/rule/catalog revisions separate, preserve stale views, enforce latest-request-wins and do not use localStorage as truth. Remounting reloads persisted proposals. `tauriApi`, `build.rs`, `main.rs`, `lib.rs`, default capability and the security matrix are synchronized; every new command is main-window-only and denied to Search. Browser mock behavior is deterministic and explicitly marked mock; it never claims real AI, native persistence, Rule execution or filesystem mutation.

## 10. Tests and performance

- Frontend typecheck and focused Rules/API/store/permission tests passed; new Task 07 contract and remount/latest-wins tests cover the UI state boundary.
- Rust focused proposal/repository/lifecycle/retention/grounding/compiler tests passed.
- Schema 32→33 success, rollback, idempotence and future guard passed.
- Backend execution regression proves disabled separation, enable CAS, SQLite loading and stale catalog rejection.
- Exact impact compiler behavior covers every AST field/operator family and metadata-only no-mutation Apply.
- Release Task 07 Proposal benchmark passed: canonical p95 0.005ms; proposal create/finalize p95 0.387ms; 1k rule list p95 4.108ms; 1k proposal first page p95 1.115ms; 100k simple exact 47.809ms; Apply p95 50.653ms; CRUD p95 ≤0.066ms; 1M deferred 118.541ms; 1M exact 501.485ms. Query plan used `idx_library_files_modified`; WAL reader remained readable during a proposal writer.
- Release schema migration benchmarks passed: 100k rows 16.759ms and 1M rows 18.021ms; both size delta 0 and WAL reader row counts preserved.
- Full remediation/performance scripts, build, security audit, local package and CI Windows/macOS evidence are recorded in the final PR/CI section below.

## 11. Platform, package and dependency evidence

Windows Rust and NSIS are run locally where available. macOS Rust and unsigned DMG are not represented by local Windows output; the final evidence must cite the remote GitHub job/run and artifact separately. `package.json`, `package-lock.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` remain unchanged. No dependency or lockfile was added or modified.

## 12. Known risks and stop condition

- Provider availability and model quality remain user-configured; invalid, ungrounded or unavailable generation fails closed.
- Filesystem races remain outside Rule execution because rules only update metadata; any later mutation remains behind Organization Plan, authoritative preview, identity, journal, Safe Trash and Restore.
- Large expensive impact requires explicit exact resolution before Apply.
- This branch deliberately does not include Content Artifact, OCR, body extraction, Agent runtime, shell/MCP/tools, second AI queue or Task 08.

## 13. Final delivery evidence

Final HEAD, commit list, local package/checksums, remote Windows/macOS Rust/package job IDs, artifact names, final GitHub CI run, Draft PR URL and clean-worktree status are filled after push. The PR remains Draft and is not merged.
