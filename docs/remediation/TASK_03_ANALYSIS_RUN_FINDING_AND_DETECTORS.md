# Task 03 — Analysis Run, Finding and Detector Architecture

## 1. Status and execution authority

This document is the complete production implementation contract for Task 03 of Zen Canvas Architecture Remediation V1.

Task 03 is **one complete task**. It must not be split into Task 03A/03B/03C, multiple implementation branches, or multiple production PRs. Codex is responsible only for implementation, migration, tests, commits, one Draft PR and Closeout. It must not redesign this contract or begin Task 04.

Task 03 may start only after this document and the updated remediation index have been merged into `master`.

Approved baseline:

- Task 02 merge commit: `ac0ffd78244d61833d13c8ff7878be0a0e2bceaf`;
- database schema: 29;
- Task 02 production implementation is present;
- Task 04 and all later tasks remain forbidden.

Target database schema: **30**.

Recommended implementation branch:

```text
remediation/03-analysis-run-findings
```

Recommended Draft PR title:

```text
feat: add durable analysis runs and findings
```

---

## 2. Objective

Task 03 must do two things in the same implementation PR:

1. close the six accepted Task 02 correctness debts before building on duplicate-group authority;
2. replace the in-memory storage-cleanup result model with durable, auditable Analysis Run, Detector and Finding domain objects.

The resulting product model is:

```text
approved analysis scope
→ durable analysis run
→ fixed detector registry
→ staged typed findings and evidence
→ source-snapshot validation
→ atomic publication
→ durable finding decisions
→ read/review/reveal
→ existing authoritative preview + Safe Trash only for strictly eligible findings
```

Task 03 is not a general job framework, not Organization Plan, not Query V2, not a deletion engine and not an autonomous cleanup agent.

---

## 3. Mandatory first block: close all accepted Task 02 debts

These six items are production blockers for the analysis architecture and must be the first implementation block in the same Task 03 branch and PR.

### 3.1 Global duplicate-group authority

`duplicate_groups` and `duplicate_group_members` are global authority for all enabled File Library managed roots. A run scoped to one scan session or a subset of roots must never replace, stale or fragment a cross-root group.

Required contract:

- authoritative group publication always covers **all enabled `file_library` scan roots**;
- scan-session dedupe remains a trigger/provenance link, but its authoritative run scope is canonical all-enabled-managed-roots;
- the parent scan session ID may be retained for dispatch history but must not narrow group authority;
- manual UI dedupe remains all-enabled-managed-roots;
- compatibility requests containing explicit roots may update valid fingerprints in diagnostic mode, but must not publish, stale or replace active global groups;
- repository code, not renderer input, decides whether a run is authoritative;
- a global authority revision must advance in the same short transaction as active group publication or invalidation;
- root disable, file/fingerprint invalidation and authoritative publication must update the same authority watermark;
- an authoritative run cannot publish when any enabled root is missing, permission-blocked, unreconciled or has watcher rule recovery pending;
- no partial run may set global duplicate authority healthy.

Schema 30 should add a singleton domain record equivalent to:

```sql
CREATE TABLE dedupe_authority_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    status TEXT NOT NULL CHECK (status IN (
        'healthy', 'rebuild_required', 'degraded'
    )),
    last_authoritative_run_id TEXT,
    scope_hash TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (last_authoritative_run_id) REFERENCES dedupe_runs(id)
);
```

An equivalent singleton schema is allowed, but the authority revision and health fact must be durable and transactional.

If needed, add a schema-30 `publication_mode` field to `dedupe_runs` with a constrained `authoritative|diagnostic` domain. Existing rows must migrate without fabricating successful authority.

Required regression:

```text
Root A/X + Root B/Y are content duplicates
→ authoritative global run publishes X+Y
→ only Root A scan session completes
→ scan-triggered dedupe runs
→ X+Y remains one correct active global group
```

### 3.2 Prehash identity safety

A prehash is reusable only when lightweight physical identity is equal before and after the read.

Required sequence:

```text
capture live identity before
→ read sample
→ capture live identity after
→ compare size + modified_ns + physical_key/platform identity
→ persist only when unchanged
```

If the file changes, record `file_changed_during_prehash`, do not save the sample and do not allow the subject to be pruned from full-hash consideration by that invalid sample.

### 3.3 Cancellation must preserve completed fingerprints

Cancellation stops scheduling new work and prevents group publication, but it must not discard already completed valid IO.

Required behavior:

- stop enqueuing new hash subjects after cancel;
- allow in-flight workers to return;
- drain completed results;
- persist each result that still passes identity and DB CAS;
- do not construct or publish partial active groups;
- finalize the run as `cancelled` only after valid completed results are flushed;
- no terminal event may be emitted before durable terminal state.

### 3.4 Real byte progress

`processed_bytes` must represent bytes actually read for prehash/full hash, not candidate file sizes counted during metadata capture.

Required budget:

- cache hit: zero IO bytes and zero new IO budget;
- small collision subject: one full-hash budget equal to file size;
- large subject prehash: actual head/tail bytes only;
- after large prehash survivors are known, add their full-hash sizes to `total_bytes` before full hashing;
- every read loop reports actual bytes consumed;
- `processed_bytes <= total_bytes` at every durable checkpoint;
- UI may see total increase between phases but must never show 100% before all scheduled IO is complete;
- cancellation and errors preserve monotonic processed bytes.

### 3.5 Small files are read once

Files below `PREHASH_MIN_SIZE` that collide by size must go directly to full BLAKE3. They must not be fully read once as “prehash” and then fully read again.

### 3.6 Rename cache compatibility mirror

When a verified physical rename reuses a complete cached fingerprint, the same transaction must synchronize the compatibility mirror:

```text
files.content_hash = file_fingerprints.full_hash
```

The mirror must be cleared again on later invalidation. The mirror is not duplicate authority.

---

## 4. Domain boundaries

### 4.1 Analysis Run is domain-specific

Create a dedicated analysis domain. Do not reuse or generalize:

- Managed AI `ai_jobs`;
- scan runs;
- dedupe runs;
- operation journal;
- cleanup journal;
- a new cross-domain Job Runtime.

Only in-memory worker handles and cancel flags may remain process-local. Status, phase, detector progress, finding publication and decisions are durable SQLite facts.

### 4.2 Findings are evidence, not execution authorization

A Finding describes a detected condition and evidence. It must not directly authorize a filesystem mutation.

A finding may expose an action suggestion such as:

```text
reveal
review_duplicate_group
uninstall_advice
app_internal_cleanup
safe_trash_candidate
none
```

Execution, where already supported, must still pass through the existing backend-authoritative preview, identity validation, cleanup journal, Safe Trash and restore system.

Task 03 must not create permanent delete, automatic deletion, automatic keeper selection, duplicate cleanup, batch move or Organization Plan execution.

### 4.3 Managed and approved-path scopes stay distinct

Supported analysis scope kinds:

1. `all_managed_file_library`;
2. `explicit_enabled_scan_roots` resolved from `scan_roots` IDs;
3. `approved_cleanup_paths` selected through the existing directory picker and validated by the backend.

Rules:

- arbitrary renderer paths are never accepted as managed root IDs;
- approved cleanup paths are canonical absolute roots with existing exclusion/system-path safety rules;
- approved-path traversal is analysis-only and must not write managed `files`, scan generations or Global Index;
- duplicate-group detector is authoritative only for `all_managed_file_library` with healthy dedupe authority;
- unsupported detector/scope combinations are durably marked `skipped`, not silently omitted.

---

## 5. Schema 29 → 30

Migration must run inside the existing immediate transaction and fully roll back to schema 29 on any failure.

### 5.1 `analysis_runs`

Required logical schema:

```sql
CREATE TABLE analysis_runs (
    id TEXT PRIMARY KEY,
    request_key TEXT NOT NULL,
    request_attempt INTEGER NOT NULL DEFAULT 1 CHECK (request_attempt > 0),
    scope_json TEXT NOT NULL,
    scope_hash TEXT NOT NULL,
    source_snapshot_json TEXT NOT NULL,
    source_snapshot_hash TEXT NOT NULL,
    detector_set_json TEXT NOT NULL,
    detector_set_hash TEXT NOT NULL,

    status TEXT NOT NULL CHECK (status IN (
        'queued', 'running', 'cancelling',
        'completed', 'completed_with_warnings',
        'cancelled', 'failed', 'interrupted'
    )),
    phase TEXT NOT NULL CHECK (phase IN (
        'preparing', 'running_detectors', 'finalizing', 'completed'
    )),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
    rerun_required INTEGER NOT NULL DEFAULT 0 CHECK (rerun_required IN (0, 1)),

    detectors_total INTEGER NOT NULL DEFAULT 0,
    detectors_completed INTEGER NOT NULL DEFAULT 0,
    detectors_failed INTEGER NOT NULL DEFAULT 0,
    findings_staged INTEGER NOT NULL DEFAULT 0,
    findings_published INTEGER NOT NULL DEFAULT 0,
    safe_count INTEGER NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    caution_count INTEGER NOT NULL DEFAULT 0,
    exact_reclaimable_bytes INTEGER NOT NULL DEFAULT 0,
    potential_reclaimable_bytes INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,

    started_at INTEGER,
    finished_at INTEGER,
    last_checkpoint_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    error_code TEXT,
    error_message TEXT,

    UNIQUE(request_key, request_attempt)
);

CREATE UNIQUE INDEX idx_analysis_runs_one_active_scope
ON analysis_runs(scope_hash, detector_set_hash)
WHERE status IN ('queued', 'running', 'cancelling');

CREATE INDEX idx_analysis_runs_created
ON analysis_runs(created_at DESC, id);
```

### 5.2 `analysis_run_detectors`

```sql
CREATE TABLE analysis_run_detectors (
    run_id TEXT NOT NULL,
    detector_id TEXT NOT NULL,
    detector_version INTEGER NOT NULL CHECK (detector_version > 0),
    status TEXT NOT NULL CHECK (status IN (
        'queued', 'running', 'completed', 'completed_with_warnings',
        'skipped', 'cancelled', 'failed', 'interrupted'
    )),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    scanned_subjects INTEGER NOT NULL DEFAULT 0,
    findings_staged INTEGER NOT NULL DEFAULT 0,
    exact_reclaimable_bytes INTEGER NOT NULL DEFAULT 0,
    potential_reclaimable_bytes INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER,
    finished_at INTEGER,
    error_code TEXT,
    error_message TEXT,
    PRIMARY KEY (run_id, detector_id),
    FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
);
```

### 5.3 `analysis_findings`

Required semantics:

```sql
CREATE TABLE analysis_findings (
    id TEXT PRIMARY KEY,
    finding_key TEXT NOT NULL,
    run_id TEXT NOT NULL,
    detector_id TEXT NOT NULL,
    detector_version INTEGER NOT NULL,
    scope_hash TEXT NOT NULL,

    status TEXT NOT NULL CHECK (status IN (
        'staged', 'active', 'stale', 'superseded', 'discarded'
    )),
    tier TEXT NOT NULL CHECK (tier IN ('safe', 'review', 'caution')),
    category TEXT NOT NULL,
    action_kind TEXT NOT NULL CHECK (action_kind IN (
        'reveal', 'review_duplicate_group', 'uninstall_advice',
        'app_internal_cleanup', 'safe_trash_candidate', 'none'
    )),
    title TEXT NOT NULL,
    reason TEXT NOT NULL,
    risk_note TEXT,
    confidence TEXT NOT NULL CHECK (confidence IN (
        'exact', 'estimated', 'unknown'
    )),

    size_bytes INTEGER NOT NULL DEFAULT 0,
    exact_reclaimable_bytes INTEGER,
    potential_reclaimable_bytes INTEGER NOT NULL DEFAULT 0,
    requires_confirmation INTEGER NOT NULL DEFAULT 1 CHECK (requires_confirmation IN (0, 1)),
    executable INTEGER NOT NULL DEFAULT 0 CHECK (executable IN (0, 1)),

    primary_subject_kind TEXT NOT NULL,
    primary_subject_id TEXT NOT NULL,
    path_snapshot TEXT,
    identity_snapshot_json TEXT NOT NULL DEFAULT '{}',
    evidence_summary_json TEXT NOT NULL DEFAULT '{}',

    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER,
    stale_at INTEGER,

    UNIQUE(run_id, finding_key),
    FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_analysis_findings_active_page
ON analysis_findings(status, tier, potential_reclaimable_bytes DESC, updated_at DESC, id);

CREATE INDEX idx_analysis_findings_key
ON analysis_findings(finding_key, status, updated_at DESC);

CREATE INDEX idx_analysis_findings_subject
ON analysis_findings(primary_subject_kind, primary_subject_id, status);
```

`finding_key` must be deterministic and identity-sensitive:

- duplicate group: detector/version + deterministic duplicate group ID;
- managed file: detector/version + file ID + live physical/fingerprint identity version;
- approved-path file: detector/version + normalized path + size + modified_ns + physical key when available;
- directory: detector/version + normalized path + analysis snapshot identity.

A changed file must produce a new finding key so an old dismissal cannot silently apply to new content.

### 5.4 `analysis_finding_evidence`

```sql
CREATE TABLE analysis_finding_evidence (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    evidence_kind TEXT NOT NULL,
    subject_kind TEXT NOT NULL,
    subject_id TEXT,
    path_snapshot TEXT,
    value_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (finding_id) REFERENCES analysis_findings(id) ON DELETE CASCADE
);

CREATE INDEX idx_analysis_finding_evidence_finding
ON analysis_finding_evidence(finding_id, created_at, id);

CREATE INDEX idx_analysis_finding_evidence_subject
ON analysis_finding_evidence(subject_kind, subject_id, finding_id);
```

Evidence is typed JSON produced by fixed Rust detectors. It is not arbitrary renderer content, SQL, shell text or model output.

### 5.5 `analysis_finding_decisions`

```sql
CREATE TABLE analysis_finding_decisions (
    finding_key TEXT PRIMARY KEY,
    decision TEXT NOT NULL CHECK (decision IN (
        'open', 'acknowledged', 'dismissed', 'snoozed'
    )),
    snoozed_until INTEGER,
    note TEXT,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

Decisions are triage facts only. They are not mutation approval.

### 5.6 Migration requirements

- empty database → 30;
- real schema 29 fixture → 30;
- preserve all scan/watcher/dedupe/fingerprint/group/AI/Global/journal/rules data;
- create no fabricated runs/findings/decisions;
- migrate no in-memory cleanup jobs because they are not durable truth;
- retain cleanup trash batches/items and recovery fields unchanged;
- schema 30 reopen is idempotent and preserves data;
- schema 31+ is rejected;
- a deliberate conflict after the first schema-30 change must roll back all schema-30 tables/columns and leave `user_version=29`.

---

## 6. Source snapshot and publication safety

At run admission capture a canonical source snapshot.

For managed scopes it must include:

- each root ID;
- enabled state;
- `last_successful_generation`;
- watcher revision and applied revision;
- reconciliation and watcher-rule-recovery state;
- dedupe authority revision/status/last authoritative run ID;
- detector registry version.

For approved cleanup paths it must include:

- canonical roots;
- exclusion policy version;
- detector registry version;
- start timestamp and root accessibility facts.

Before publication, recompute all relevant durable watermarks.

Rules:

- unchanged snapshot: successful detector findings may publish;
- changed managed snapshot: keep diagnostic/staged rows, mark run `completed_with_warnings`, set `rerun_required=1`, publish nothing from the changed source;
- cancelled/failed/interrupted run: publish no staged findings;
- a detector failure must not remove previous active findings from that detector;
- a successful detector may replace only previous active findings for the same canonical scope and detector ID/version;
- publication is one short transaction: promote new staged findings, supersede prior active set, write detector/run terminal revisions;
- readers must never see an empty-window caused by deleting all findings before insertion;
- stale source or CAS failure is warning/fatal according to whether publication safety can still be guaranteed.

---

## 7. Detector architecture

### 7.1 Fixed registry

Implement a fixed Rust registry equivalent to:

```rust
trait AnalysisDetector {
    fn descriptor(&self) -> DetectorDescriptor;
    fn supports(&self, scope: &AnalysisScope) -> bool;
    fn run(&self, context: &AnalysisContext, sink: &mut FindingSink)
        -> Result<DetectorSummary, DetectorError>;
}
```

Requirements:

- detector IDs and versions are compile-time allowlisted;
- no dynamic plugins, scripts, shell, SQL from renderer or arbitrary model tools;
- detector output is validated by a central Finding repository before persistence;
- every detector has cancellation checkpoints and bounded memory;
- detectors do not mutate user files;
- detector failure is isolated and durably recorded;
- each detector owns its category/action/tier constraints;
- all evidence must be sufficient for a reviewer to understand why the finding exists.

### 7.2 Required built-in detectors

#### `duplicate_reclaimable_v1`

Source: active global duplicate groups and members.

- only runs when dedupe authority is healthy and scope is all managed File Library;
- one finding per active duplicate group;
- tier=`review`;
- action=`review_duplicate_group`;
- exact/potential bytes copied from group authority;
- hardlink aliases and physical-copy count included as evidence;
- never executable in Task 03;
- no automatic keeper or delete suggestion.

#### `large_file_v1`

Source: active managed files or approved-path traversal.

- preserve current large-file threshold unless tests show an existing configured threshold;
- tier=`review` by default;
- action=`reveal`;
- file identity and size evidence required;
- not selected for cleanup by default.

#### `large_directory_v1`

Source: approved-path traversal directory aggregation.

- tier=`review`;
- action=`reveal`;
- directory totals are potential/diagnostic, not exact safely reclaimable bytes unless every child subject is enumerated without overlap;
- avoid double counting nested directory findings in run totals.

#### `cleanup_heuristics_v1`

Port the existing deterministic `classify_candidate` rules into a versioned detector without broadening them.

- preserve existing protected/excluded path policy;
- only explicit allowlisted app-owned/temp/cache artifacts may be `safe`;
- downloads, installers, archives, logs, unknown cache roots and user-created content are at least `review`;
- system, package-manager, application data, permission-limited or ambiguous subjects are `caution` or non-executable;
- action may be `safe_trash_candidate`, `uninstall_advice`, `app_internal_cleanup`, `reveal` or `none` according to the existing safe model;
- Safe does not mean automatic execution;
- every Safe finding must have verified identity, approved scope, exact path policy and a revalidation contract.

### 7.3 Optional AI review

Existing cleanup AI may be retained only as a compatibility/enrichment adapter.

- do not change Managed AI schema, queue, provider policy or correction semantics;
- AI output may append an `ai_assessment` evidence item and raise risk from Safe→Review/Caution;
- AI may not upgrade Review/Caution to Safe;
- AI may not make a finding executable;
- AI may not replace deterministic evidence, finding identity, user decision or backend safety rules;
- AI failure does not invalidate deterministic findings.

---

## 8. Risk tiers and reclaimable semantics

### 8.1 Tier contract

`safe`:

- deterministic allowlisted cleanup subject;
- exact approved scope;
- verified current identity;
- action explicitly supported by existing Safe Trash path;
- still requires preview and user confirmation.

`review`:

- useful evidence but user intent or keeper choice is required;
- duplicate groups, large files, old downloads and uncertain caches normally belong here.

`caution`:

- system/app data, uninstall advice, permissions, unsupported identity or high-impact ambiguity;
- never executable by the cleanup adapter.

### 8.2 Reclaimable bytes

- `exact_reclaimable_bytes` is non-null only when evidence supports an exact physical-space claim;
- `potential_reclaimable_bytes` is an upper bound and must be labelled as such;
- duplicate-group values come from Task 02 physical-copy semantics;
- path-only or unknown identity cannot contribute to exact totals;
- large directory and overlapping detector findings must not be naively summed;
- run-level exact totals count only unique exact reclaimable subjects;
- UI must show exact and potential separately;
- UI must never describe potential bytes as safely reclaimable.

---

## 9. Durable run lifecycle

Legal path:

```text
queued/preparing
→ running/preparing
→ running/running_detectors
→ running/finalizing
→ completed|completed_with_warnings / completed
```

Cancellation:

```text
queued|running → cancelling → cancelled
```

Failure:

```text
queued|running|cancelling → failed
```

Startup recovery:

```text
queued|running|cancelling → interrupted
```

Requirements:

- all run and detector transitions use revision CAS with affected row=1;
- one active run per canonical `(scope_hash, detector_set_hash)`;
- same request key and payload is idempotent;
- a new same-scope request during an active run sets `rerun_required=1` rather than starting a second worker;
- retry creates `request_attempt+1`;
- startup marks active runs and detectors interrupted before new workers start;
- interrupted runs retain staged diagnostics but publish none;
- no automatic infinite retry; at most one coalesced automatic rerun for source change, then user attention;
- run history remains visible after restart;
- process-local cancel handles are not durable truth.

---

## 10. Finding lifecycle and invalidation

### 10.1 Stable identity

A finding is the combination of detector/version, subject and evidence identity. A changed subject must not inherit the previous finding decision.

### 10.2 Immediate invalidation

Add only short SQLite invalidation work to existing owners:

- scanner/watcher metadata change or stale/missing: related active file findings become stale;
- duplicate group invalidation/publication: related duplicate findings become stale or superseded in the same authority transaction;
- disabled root: findings whose subjects belong to that root become stale;
- no scanner/watcher file IO, detector execution or long transaction;
- no change to scan generation, watcher revision ownership or stale safety.

Approved-path findings without durable watcher coverage must be revalidated on detail load and before preview/execution. A mismatch marks the finding stale.

### 10.3 Decisions

- `dismissed` hides the same identity-sensitive finding key by default;
- `acknowledged` records review without authorizing mutation;
- `snoozed` requires a timestamp and returns to open after expiry;
- new evidence identity creates a new finding key and defaults open;
- detector rerun must not overwrite a user decision;
- decisions use CAS revision.

### 10.4 Retention

- active findings persist until superseded/stale;
- staged/discarded and stale/superseded findings retain 30 days;
- analysis runs retain 90 days;
- evidence cascades with findings;
- decisions with no related finding retain 180 days before bounded prune;
- each prune deletes at most 1000 rows;
- no prune during active publication;
- WAL readers must remain responsive.

---

## 11. Existing cleanup compatibility and mutation safety

The current in-memory `StorageCleanupState` must cease to be result authority.

Migration target:

- process-local state only stores worker/cancel handles;
- durable `analysis_runs`, detector rows and findings are the source of UI/history/candidate truth;
- legacy `start_storage_cleanup_scan`, status, page and events adapt to one analysis run and finding page;
- legacy candidate IDs become finding IDs;
- old events are compatibility projections from durable run revisions;
- renderer restart hydrates from SQLite rather than reconstructing results from events.

Existing Safe Trash behavior may remain only through a strict adapter:

1. resolve run ID and finding IDs in SQLite;
2. finding status must be active;
3. detector/action/tier must be allowlisted;
4. `safe` findings may proceed to preview; `review` requires the existing explicit per-item review confirmation; `caution` is blocked;
5. duplicate-group findings are never executable in Task 03;
6. backend revalidates scope, normalized path, symlink/reparse, current physical/operation identity and finding revision;
7. preview remains server-authoritative;
8. execution remains existing cleanup journal + Safe Trash + restore;
9. successful execution marks the finding stale/resolved by source invalidation, not by trusting renderer state;
10. no new permanent-delete path or direct filesystem command.

Do not change cleanup journal schema or restore semantics.

---

## 12. API, events and pagination

Add domain APIs equivalent to:

```text
start_analysis_run
cancel_analysis_run
retry_analysis_run
get_analysis_run
get_active_analysis_run
list_analysis_runs
list_analysis_run_detectors
list_analysis_findings
get_analysis_finding
list_analysis_finding_evidence
set_analysis_finding_decision
revalidate_analysis_finding
```

The module-specific finding page uses a strict versioned keyset cursor, without starting Task 04 Query V2.

Recommended order:

```text
tier ASC (safe, review, caution)
potential_reclaimable_bytes DESC
updated_at DESC
id ASC
```

Supported filters:

- run ID / latest active publication;
- detector;
- tier;
- category;
- decision;
- active/stale status;
- executable only.

Events:

```text
analysis-run-updated
analysis-detector-updated
analysis-findings-published
```

Events carry durable revision and are projections only. Gap detection triggers refetch.

Update Tauri capability/permission, browser mock, TypeScript DTO/API and contract tests.

---

## 13. Frontend product surface

Refactor the existing Storage Cleanup surface into durable Analysis/Findings projection while preserving the established visual system.

Required UI:

- active and recent run history;
- phase, detector progress and cancellation;
- restart-visible interrupted/completed runs;
- summary counts by Safe/Review/Caution;
- exact vs potential bytes shown separately;
- detector/category/tier/decision filters;
- keyset “load more”;
- finding detail with reason, evidence, identity state and source age;
- reveal/open action;
- acknowledge, dismiss and snooze;
- explicit stale badge and revalidate action;
- duplicate-group finding links to read-only Duplicate Groups detail;
- optional AI review evidence clearly labelled as AI assessment;
- existing cleanup confirmation flow only for eligible findings.

Renderer rules:

- hydrate before subscribing;
- apply events only when revision is newer;
- refetch on revision gap;
- do not infer terminal state;
- do not keep authoritative candidates only in Zustand;
- cancelling and cancelled remain distinct;
- no default selection for Review/Caution;
- no delete action for duplicate findings;
- no automatic cleanup or keeper selection.

---

## 14. Allowed modification scope

Allowed:

```text
src-tauri/src/storage_analyzer.rs or a split storage_analysis/ module
src-tauri/src/dedupe.rs
src-tauri/src/db/schema.rs
src-tauri/src/db/queries/dedupe.rs
new db analysis/finding repository files
src-tauri/src/db/queries/scan.rs and files.rs only for short invalidation
src-tauri/src/scanner.rs / watcher.rs only for short invalidation integration
src-tauri/src/ai/cleanup.rs only for finding enrichment compatibility
src-tauri/src/main.rs / lib.rs / build.rs
src-tauri/capabilities and permissions
src/api/tauriApi.ts
src/api/browserMockApi.ts
analysis/cleanup stores and views
related domain types/i18n/tests/performance scripts
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
docs/remediation/REMEDIATION_RISK_REGISTER.md
docs/remediation/TASK_03_IMPLEMENTATION_CLOSEOUT.md
```

Forbidden:

```text
src-tauri/src/global_index/ production provider/schema/service
Managed AI schema/worker/provider policy
files.id migration
operation journal schema
cleanup journal schema
Safe Trash or restore safety weakening
Organization Plan domain
File Query V2 general cursor/snapshot/selection
Content Artifact or extractor
Natural-language rules
Spotlight provider/command manifest
new third-party dependencies or lockfile changes
installer version/tag/release changes
Task 04 or later work
```

Global Index tests may update schema-version assertions only.

---

## 15. Required tests

### 15.1 Task 02 debt regression

- cross-root group survives a single-root scan-triggered dedupe;
- diagnostic explicit scope cannot stale/publish global groups;
- global authority revision advances on publication and invalidation;
- unhealthy/reconciling root blocks authoritative publication;
- prehash before/after identity mismatch saves no sample;
- cancelled run drains and saves completed valid hashes but publishes no groups;
- byte progress reflects actual reads and never reaches 100% before scheduled IO completes;
- small file collision performs one full read, not prehash+full read;
- rename cache reuse synchronizes `files.content_hash`;
- invalidation clears both fingerprint validity and compatibility mirror.

### 15.2 Migration

- empty DB → 30;
- real schema 29 fixture → 30;
- no fabricated analysis history;
- preserve scan/watcher/dedupe/fingerprint/group/AI/Global/journals/rules;
- deliberate mid-migration conflict rolls back to 29;
- schema 30 reopen preserves run/detector/finding/evidence/decision rows;
- schema 31 rejection;
- 100k files + existing dedupe groups migration benchmark and WAL reader.

### 15.3 Run lifecycle

- request idempotency;
- one active scope/detector set;
- rerun coalescing;
- run and detector revision CAS;
- queued/running cancellation;
- startup interruption;
- retry attempt increment;
- source snapshot change prevents publication;
- cancelled/failed/interrupted staged findings never publish;
- one detector failure produces completed_with_warnings while successful detectors publish;
- failed detector retains previous active findings;
- no infinite automatic rerun.

### 15.4 Detector and finding

- fixed registry rejects unknown detector IDs;
- duplicate finding exact/potential/hardlink evidence;
- duplicate finding never executable;
- large file and directory tier/action rules;
- existing cleanup heuristic parity fixtures;
- Safe allowlist negative tests for documents/downloads/system/app data;
- stable finding key for unchanged identity;
- changed identity creates a new key;
- staged→active atomic publication;
- prior active→superseded only for successful detector/scope;
- file/group/root invalidation marks related findings stale;
- decision survives rerun of same finding key;
- decision does not transfer to changed identity;
- snooze expiry;
- evidence pagination/detail;
- keyset cursor strict parsing and no duplicates/skips.

### 15.5 Cleanup compatibility and security

- legacy cleanup start/status/page hydrate from durable run/findings;
- renderer restart retains results;
- old event compatibility uses durable revisions;
- Safe finding preview revalidates identity/scope;
- stale/replaced/symlink/reparse finding is blocked;
- Review requires explicit confirmation;
- Caution blocked;
- duplicate finding blocked;
- candidate ID from another run rejected;
- finding revision mismatch rejected;
- execution still writes existing cleanup journal and remains restorable;
- AI assessment cannot upgrade to Safe/executable or overwrite user decision.

### 15.6 Frontend

- active/recent hydrate;
- event revision gap refetch;
- cancelling vs cancelled;
- detector progress;
- exact/potential labels;
- filters and keyset load more;
- evidence detail;
- decision actions;
- stale/revalidate state;
- duplicate group read-only link;
- Review/Caution not default selected;
- no duplicate delete/keeper action;
- legacy cleanup compatibility.

### 15.7 Performance

Record cold and warm results for:

- 100k managed files deterministic detectors;
- 10k active findings page and filter;
- 10k finding publication transaction;
- duplicate authority snapshot lookup;
- approved-path traversal progress/cancel;
- WAL File Library reader during detector staging/publication;
- decision lookup and finding detail;
- prune 1000 rows;
- Windows and macOS packaging/CI.

No detector may hold a SQLite write transaction while performing filesystem traversal, hashing, AI or long computation.

---

## 16. Suggested atomic commits

One implementation branch and one Draft PR, with reviewable commits such as:

1. `dedupe: close authority prehash cancel and progress debts`
2. `db: add schema 30 analysis and finding ledger`
3. `analysis: add durable run coordinator and detector registry`
4. `analysis: add built-in detectors and atomic finding publication`
5. `analysis: add invalidation decisions and retention`
6. `cleanup: adapt legacy cleanup flow to durable findings`
7. `api: expose analysis runs findings and evidence`
8. `ui: project durable analysis and finding review`
9. `test: cover migration partial publication and safety`
10. `docs: close Task 03 implementation`

These are commits, not separately authorized tasks. Do not stop after an intermediate commit unless a stop condition is triggered.

---

## 17. Validation commands

Before implementation, record baseline:

```bash
npm run typecheck
npm test
npm run test:remediation
npm run test:performance
npm run build
npm run verify:rust
npm run security:audit
npm run security:audit:rust
```

After implementation, run at least:

```bash
npm run verify:frontend
npm run verify:rust
npm run verify:security
npm run test:remediation
npm run test:performance
npm run build
git diff --check
git status --short
```

Also run all Task 03 migration, detector, finding, cleanup-safety, 100k and WAL benchmarks.

Platform-only tests not available locally must be reported honestly and left to GitHub Windows/macOS CI. Do not weaken production code or tests to hide an environment failure.

---

## 18. Closeout

Create:

```text
docs/remediation/TASK_03_IMPLEMENTATION_CLOSEOUT.md
```

Update:

```text
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
docs/remediation/REMEDIATION_RISK_REGISTER.md
```

Closeout must record:

- actual baseline and final HEAD;
- schema 30 and rollback evidence;
- all six Task 02 debt fixes;
- global dedupe authority contract;
- analysis run/detector/finding schemas and state machines;
- source snapshot/publication behavior;
- built-in detectors;
- finding identity, evidence, stale and decisions;
- exact/potential semantics;
- legacy cleanup and AI compatibility;
- mutation safety evidence;
- API/UI migration;
- complete tests, performance and CI;
- known risks;
- explicit statement that Task 04 did not start.

---

## 19. Stop conditions

Stop immediately and report evidence if implementation requires any of the following:

- migration of `files.id`;
- modification of Global Index production schema/provider/service;
- generalization of `ai_jobs` or creation of a general Job Runtime;
- weakening or replacement of operation/cleanup journal, Safe Trash or restore;
- direct deletion or movement from a detector/finding;
- automatic duplicate keeper selection or cleanup;
- Organization Plan or Query V2;
- Content Artifact, natural-language rules or Spotlight redesign;
- a new third-party dependency or lockfile change;
- arbitrary renderer-defined detector, SQL, script or filesystem action;
- inability to keep global duplicate groups correct across root scopes;
- inability to prevent partial/cancelled findings from becoming active;
- inability to maintain identity-sensitive finding decisions;
- inability to migrate real schema 29 atomically.

Do not change the architecture or expand scope after a stop condition.

---

## 20. Completion report

The final report must include:

1. actual baseline HEAD;
2. final HEAD;
3. changed files and purpose;
4. schema 30 migration;
5. each of the six Task 02 debt fixes;
6. dedupe authority revision and global scope behavior;
7. analysis run and detector lifecycle;
8. finding/evidence/decision lifecycle;
9. built-in detectors and risk rules;
10. cleanup/AI compatibility and safety;
11. API/UI changes;
12. all new tests;
13. complete validation and performance results;
14. commit list and Draft PR;
15. known risks;
16. explicit declaration:

```text
Task 03 has been completed as one full task and stopped.
No Task 03A/03B/03C or multiple production PRs were created.
No detector or finding directly mutated a user file.
Task 04 and all later tasks were not started.
Waiting for human code-level acceptance.
```
