# Schema 36 — Automation Intent and Run

PM-02A proposes exactly one migration from 35 to 36. The version bump adds two tables and three explicit indexes, in the existing migration transaction. No existing table, AI provider schema, semantic assessment, Rule AST or operation ledger changes. Application version remains 0.1.40.

| Table | Durable fields and constraints |
| --- | --- |
| `automation_intents` | `id` PK; positive `revision`; trimmed `title` 1–120 characters; `workflow_kind='organize_plan'`; JSON `scope_query_json`; canonical `scope_fingerprint`; fixed version-1/manual `trigger_json`; fixed version-1/review-required/false-autoExecute `policy_json`; Boolean `enabled`; `created_at`, `updated_at`, nullable `archived_at` |
| `automation_runs` | `id` PK; globally unique `request_key`; `intent_id` FK with DELETE RESTRICT; exact positive `intent_revision`; `trigger_kind='manual'`; `scope_fingerprint`; nullable fresh `library_snapshot_revision`; terminal `status` completed/blocked/failed; nullable `result_plan_id`; nonnegative `queued_analysis_count`; Boolean `requires_plan_refresh`; sanitized nullable `analysis_blocker_code` and `error_code`; `created_at`, `completed_at` |

Indexes are `idx_automation_intents_active(archived_at,updated_at DESC,id)`, `idx_automation_runs_recent(created_at DESC,id)` and `idx_automation_runs_intent(intent_id,created_at DESC,id)`. SQLite also creates PK/unique indexes. Run reads use descending insertion order to resolve equal-second timestamps truthfully.

Run history survives archive. There is no hard-delete Intent command. The Plan reference intentionally has no DELETE-cascading foreign key: existing Organize deletion remains authoritative and a Run retains its historical Plan ID. Opening a Plan already deleted by its owner shows a recoverable error.

A reusable scope is canonical `FileQuerySpecV2`, restricted to `all_enabled_roots` or nonempty `roots.scanRootIds`. Filter/text/sort semantics persist; snapshot revisions and renderer memberships do not. Create/edit and each new Run validate the existing Query V2 scope health. Selected roots never widen silently when removed or disabled.

All Intent mutations use expected revision CAS. Run admission checks version, intent revision, enabled/archive and fixed policy before orchestration. Its global request key binds exactly one Intent ID/revision. One immediate transaction publishes the existing Organization Plan and receipt; conflicting keys fail and concurrent retries cannot create a second Plan. Existing analysis admission follows publication. An interrupted admission leaves `automation_analysis_not_requested`; retries return history rather than starting another worker. Existing Organize analysis/refresh provides recovery.

Opening Schema 36 is idempotent; Schema 37+ is rejected. Fresh/empty-35/populated-35, constraint, exact-index, archive, conflict and concurrency coverage lives in `src-tauri/src/db/automation/tests.rs`; historical migration assertions and performance fixture identity now expect 36.
