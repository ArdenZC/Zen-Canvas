# Schema 37 — Event and Schedule Triggers

Status: PM-02B implementation / Owner review pending. Authority: merged activation PR #316, exact base `91589a89974324e821b4963b062c3070949252a8`. Schema 36 remains the merged production baseline until this implementation merges. Package version stays 0.1.40.

The existing migration transaction upgrades exactly 36 → 37. It copies every Intent field, revision and timestamp, converting only version-1/manual trigger JSON to version-2/manual. Every Run ID, request key, Plan reference and historical field survives; manual trigger context is appended. Existing Plan, provider, semantic, Rules, execution, Cleanup and journal contracts remain unchanged. Opening 37 is idempotent; 38+ is rejected. Historical downgrade fixtures remove future columns/tables before testing earlier migrations.

| Addition | Authority / bounds |
| --- | --- |
| Intent `trigger_json` | V2 `manual`, `managed_scope_change`, or `schedule` with explicit IANA `timeZone`, minute `localTime` HH:MM and normalized ISO `weekdays` 1–7. Unknown/per-kind extra fields are rejected. Existing policy stays review-required / autoExecute false. |
| Run `trigger_kind`, `trigger_context_json` | Actual source, independently of configured trigger. Context is versioned and sanitized: schedule logical occurrence/zone/instant, or root IDs with from/to revisions. No paths, content, file IDs or credentials. Existing globally unique request key remains authority. |
| `scan_roots.library_change_revision` | Nonnegative root-scoped monotonic clock, default 0; changes at most once in a scanner/watcher publication transaction when persisted filesystem truth changes. Separate from global Library revision and watcher event/checkpoint revisions. |
| `files.filesystem_observation_key` | Nullable 64-character digest of the last filesystem publication tuple and existing read-only physical identity, only in the scanner/watcher publication owner. It detects changes even if an existing user operation has already updated current File Library fields. Detects replacement with equal size/mtime. Legacy NULL is baselined without inventing a replacement event. Not a new mutation identity, fingerprint cache, trigger membership authority or DTO field. |
| `automation_trigger_state` | One row per automatic Intent: intent_id PK/FK, exact revision, next_due_at, pending_event_due_at_ms, pending/consumed root-revision JSON maps, last_trigger_key/time/error, updated_at, nullable claimed_cause_json. Root maps cap at 128, following bounded scope admission. No per-file rows, paths or payload. |

Event settle deadlines are stored in epoch milliseconds; observations round upward before adding exactly 5000 ms. Runtime waits use those millisecond deadlines. `triggerState.pendingEventDueAt` projects fractional Unix seconds, while schedule/receipt timestamps keep existing seconds semantics.

The three existing Intent/Run indexes are preserved. Exactly two partial due indexes are added: `idx_automation_trigger_schedule_due` and `idx_automation_trigger_event_due`. PK/unique indexes remain SQLite-owned.

A claimed cause freezes the deterministic backend-only `auto:<kind>:<digest>` identity before scheduler admission. It contains only the same bounded root/occurrence context and cursor successor; it is not a second job queue. A crash after Plan + Run commit but before cursor advancement retries that same claim even if time/root clocks advance. Receipt existence is checked before advancing the cursor. Newer event revisions remain pending. Intent create/edit/toggle/archive resets state atomically with CAS; manual Intents have no runtime row. Pausing/re-enabling or editing discards debt and computes future schedule due / current root baseline.

Jiff 0.2.37 is the single new direct dependency, with bundled IANA rules pinned by Cargo.lock. The earlier DST-fold instant is chosen once; a gap uses Jiff's actual transition instant (including second precision), restricted to that local date. Catch-up scans at most 15 dates for the newest due occurrence, then schedules strictly after recovery time; no replay of all missed days.

Owner/runtime/module boundaries: [ADR-0011](DECISIONS/0011-automation-trigger-boundary.md). Validation and platform limitations: [PM-02B result](tasks/AI-ONLY-PM-02B-EVENT-SCHEDULE-TRIGGER-RESULT.md).
