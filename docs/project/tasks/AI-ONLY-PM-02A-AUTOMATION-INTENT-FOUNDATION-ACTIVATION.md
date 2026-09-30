# AI-only PM-02A — Automation Intent Foundation Activation

Last verified: 2026-09-30

Status: **OWNER REVIEW PASSED — MERGE ACTIVATES PM-02A IMPLEMENTATION ONLY**

Initiative: AI-only Product Migration / issue #273

Activation baseline: `master@1cb02bb419b032d7c83a4f54776c563010bb1e61`

## 1. Purpose

PM-02A is the first bounded implementation slice of PM-02.

Its purpose is to move Zen Canvas Automation away from “the Rules page is the product” toward a durable **Automation Intent / Trigger / Policy / Run** architecture while preserving every existing safety and authority boundary.

PM-02A is deliberately narrow:

> A user creates a durable **Organize Plan automation intent**, explicitly triggers it, and Zen materializes a fresh current Organization Plan for review.

PM-02A does **not** schedule itself, watch the filesystem as an Automation Intent trigger, execute an Organization Plan, move/rename/delete files, or introduce a general agent/tool runtime.

This slice establishes the contract that later PM-02 work may safely build on.

---

## 2. Starting product truth

The current Automation surface is rule-centric.

Current authorities include:

- Rule Repository V2 + catalog revision;
- durable Rule Proposal;
- backend-authoritative rule execution through `execute_rules_for_scope_v2`;
- watcher-path canonical rule execution through `execute_authoritative_rules_for_paths`;
- renderer Automation run state that is ephemeral UI state only.

Current rule execution changes classification/suggestion metadata. It is **not** a filesystem executor.

There is currently no durable production authority for:

- Automation Intent;
- Automation Trigger configuration;
- Automation Policy configuration;
- Automation Run history;
- scheduled plan generation.

The existing i18n vocabulary may mention scheduled/persisted automation concepts, but vocabulary is not implementation authority.

PM-02A must not pretend unsupported schedule/history behavior already exists.

---

## 3. Product direction

The long-horizon product direction remains:

```text
deterministic facts / signals
        +
current AI semantic authority
        +
Automation Intent / Trigger / Policy
        ↓
reviewable plan
        ↓
existing Preview / confirmation / journal / Safe Trash / Restore
```

PM-02A implements only the first reviewable plan-generation path.

The normal user model becomes:

```text
Automation
→ what should Zen prepare?
→ for which managed files?
→ when should Zen prepare it?
→ what review/safety policy applies?
→ generate a plan
→ user reviews in Organize
```

For PM-02A:

```text
what = Organize Plan
when = Manual only
review = Required
automatic filesystem execution = Never
```

---

## 4. Non-negotiable authority boundaries

### 4.1 Organization authority

Automation must not create a second planning engine.

The existing durable Organization Plan / Plan Item ledger remains the only Organize plan authority.

Automation may materialize or reference a plan through the existing Organization APIs and semantics.

### 4.2 Semantic authority

Automation must not restore legacy Rules/classification as current Organize semantic authority.

Fresh/new Organize proposal semantics continue to come from the accepted current Managed AI assessment resolver established before PM-01.

### 4.3 Rule authority

Rule Repository V2 remains the only Rule mutation authority.

PM-02A must not:

- create a second rule repository;
- reinterpret existing user rules as Automation Intents;
- silently migrate enabled rules into broader permissions;
- restore legacy whole-object Rule commands.

Rules remain a deterministic Policy/Signal compatibility input and advanced capability.

### 4.4 Filesystem mutation authority

An Automation Run in PM-02A may **never** call:

- `execute_organization_plan`;
- operation execution commands;
- cleanup execution;
- permanent delete;
- Safe Trash mutation;
- shell/process execution.

Automation produces a reviewable plan reference only.

Any later filesystem change must still flow through the existing Organization review, Dry Run / Operation Preview, explicit confirmation, identity revalidation, Operation Journal, Safe Trash and Restore authorities.

### 4.5 Runtime authority

PM-02A must not create a second scheduler, queue or resource governor.

Expensive work continues to use existing durable owners and, where applicable:

- Managed AI queue;
- WorkScheduler;
- RuntimeResourceGovernor.

No periodic timer is authorized in PM-02A.

---

## 5. PM-02 decomposition

### PM-02A — ACTIVE ONLY AFTER THIS ACTIVATION MERGES

**Automation Intent Foundation**

- durable intent;
- manual trigger;
- fixed review-required policy;
- durable manual-run receipt/history;
- current Query V2 scope resolution;
- current AI readiness gate;
- Organization Plan materialization;
- enqueue existing missing Managed AI analysis;
- handoff to Organize for review.

### PM-02B — NOT ACTIVE

Future event/schedule trigger work, requiring separate Owner activation:

- managed watcher trigger;
- scheduled trigger;
- startup/recovery semantics;
- missed-run/coalescing semantics;
- WorkScheduler/ResourceGovernor admission;
- battery/power/QoS behavior;
- trigger concurrency/deduplication.

### PM-02C or later — NOT ACTIVE

Any broader workflow kinds such as Cleanup preparation, cross-workflow orchestration, richer intent interpretation or additional policy types require separate activation.

PM-03 remains later migration closeout.

---

## 6. Durable contract

PM-02A may introduce exactly one new durable Automation authority with two logical records:

1. `AutomationIntentV1`
2. `AutomationRunV1`

A schema migration from accepted Schema 35 to **Schema 36** is authorized only for these PM-02A records and their necessary indexes/migration metadata.

Do not add unrelated schema work.

### 6.1 AutomationIntentV1

Minimum semantic fields:

```text
id
revision
title
workflow = organize_plan
scope_query = canonical FileQuerySpecV2
scope_fingerprint
trigger = { version: 1, kind: manual }
policy = {
  version: 1,
  review: required,
  auto_execute: false
}
enabled
created_at
updated_at
archived_at?
```

Rules:

- backend creates the durable ID;
- revision is monotonic CAS authority;
- title is presentation metadata, not semantic authority;
- `workflow` is exactly `organize_plan` in PM-02A;
- trigger is exactly `manual`;
- review is always required;
- `auto_execute` must be false and cannot be user-enabled;
- unknown trigger/policy/workflow fields fail closed.

PM-02A does not add free-form natural-language agent semantics.

### 6.2 Durable scope semantics

Intent scope stores a **canonical reusable FileQuerySpecV2**, not a frozen list of file IDs.

This is essential: an Automation Intent describes future/current matching files, while each Automation Run binds to a fresh current library snapshot.

Allowed durable scope kinds:

- `all_enabled_roots`;
- `roots { scanRootIds }`.

Forbidden in a durable intent:

- `current_scan`;
- Browse-session paths;
- arbitrary renderer paths;
- current page IDs as long-term scope authority.

The backend must use the existing Query V2 canonicalizer/fingerprint authority.

Creation/update must validate referenced roots and canonicalize the query.

A later run must revalidate them again.

Disabled, removed, permission-invalid or otherwise unusable roots must fail closed rather than silently widening to all managed files.

### 6.3 AutomationRunV1

A run is a durable receipt of one explicit trigger attempt.

Minimum semantic fields:

```text
id
request_key
intent_id
intent_revision
trigger_kind = manual
scope_fingerprint
library_snapshot_revision?
status
result_plan_id?
queued_analysis_count
requires_plan_refresh
analysis_blocker_code?
error_code?
created_at
completed_at
```

Do not persist:

- provider credential;
- raw AI response;
- content bytes;
- full file-ID lists duplicated from Organization Plan;
- raw filesystem paths merely for convenience;
- hidden Preference Memory context.

The Organization Plan remains the durable item-level result authority.

### 6.4 Run status

PM-02A is synchronous orchestration, not a new background job system.

A run may be recorded as:

- `completed`;
- `blocked`;
- `failed`.

The result may indicate:

- plan materialized and ready to inspect;
- plan materialized with Managed AI analysis queued / refresh required;
- plan materialized but fresh analysis blocked by current readiness/consent, with the plan retained for truthful review.

Do not invent a persistent long-running Automation worker.

---

## 7. Manual-run contract

Add one backend-owned manual-run path.

Conceptual request:

```text
RunAutomationIntentV1 {
  version: 1,
  intentId,
  expectedIntentRevision,
  requestKey
}
```

The backend, not the renderer, owns the orchestration.

Required order:

1. load the exact durable intent;
2. CAS-check expected intent revision;
3. require not archived and enabled;
4. require `workflow=organize_plan`;
5. require `trigger=manual`;
6. revalidate the canonical managed Query V2 scope;
7. resolve a fresh current File Library query snapshot;
8. construct a current `LibrarySelectionV1::AllMatching` using the backend canonical query/fingerprint/snapshot;
9. materialize an Organization Plan through the existing Organization Plan authority, consuming any already-current Managed AI assessments exactly as normal Organize does;
10. inspect the plan's existing `needs_analysis` / currentness state;
11. only for items that require fresh Managed AI work, evaluate current backend AI readiness / provider / managed-scope consent and invoke the existing bounded `analyze_organization_plan_items` path when eligible;
12. if fresh analysis is required but unavailable, keep the materialized plan truthfully blocked/pending and record a sanitized analysis-blocker outcome rather than deleting the plan or falling back to Rules;
13. persist an Automation Run receipt binding the intent revision, scope/snapshot identity, plan ID and analysis enqueue/blocker result;
14. return a projection that lets the UI open the Organization Plan.

The Automation command must stop there.

It must not:

- accept/modify plan decisions;
- request a Dry Run;
- execute the plan;
- wait/poll until every AI job finishes;
- retry provider failures independently;
- bypass Managed AI queue ownership.

If analysis is pending, the existing Organize workflow owns refresh/review.

---

## 8. Idempotence and duplicate-run safety

Manual run must be idempotent by caller-supplied opaque `requestKey`.

Requirements:

- one request key cannot create two logical Automation Runs;
- retrying the same request must return the existing durable result or safe terminal state;
- the associated Organization Plan request identity must be deterministically bound to the Automation Run/request key;
- a renderer double-click or IPC retry must not create duplicate plans;
- conflicting use of the same request key for a different intent/revision fails closed.

Do not use current time as the only deduplication mechanism.

---

## 9. AI readiness and consent

PM-02A reuses current backend readiness composition.

It must not invent a new readiness store or connectivity monitor.

Automation must preserve the existing distinction between **consuming current semantic evidence** and **requesting new semantic work**.

Plan materialization may consume already-current Managed AI assessments even when the provider is not presently reachable/configured for new work.

When the materialized plan contains items requiring fresh analysis, the backend must evaluate current:

- AI enabled/provider/model configuration;
- credential readiness where applicable;
- Managed Scope eligibility;
- local/cloud Managed AI consent/policy.

If fresh analysis is required but readiness/consent does not permit it:

- keep the Organization Plan;
- keep those items truthfully in their existing needs-analysis/blocked state;
- do not fabricate proposals;
- do not fall back to legacy Rules/classification semantics;
- return and persist a stable sanitized `analysis_blocker_code` in the Automation Run outcome.

Do not persist or display raw provider/network secrets.

Already-existing valid reviewed Organization Plans remain governed by their existing authority and recovery rules.

---

## 10. Commands / API surface

Exact names may follow repository conventions, but PM-02A needs a narrow equivalent of:

### Read

- list Automation Intents;
- get one Automation Intent;
- list recent Automation Runs for an intent or globally.

### Intent mutation

- create Automation Intent;
- update Automation Intent under revision CAS;
- enable/disable under revision CAS;
- archive under revision CAS.

Do not hard-delete an intent if durable run history references it.

### Run

- manually run one intent under expected revision + request key.

Every new command must be added to the command-permission matrix.

Mutation commands remain main-window only.

Search Window receives no Automation mutation permission.

No filesystem-mutation permission class is authorized for an Automation Run command.

---

## 11. Schema 36 migration

If implementation adopts the expected two-table representation, Schema 36 must:

- create durable intent/run records transactionally;
- preserve all Schema 35 data byte/semantics;
- add required foreign-key/index support;
- keep run history after intent archive;
- reject invalid trigger/policy/workflow values;
- support idempotent request-key lookup;
- preserve rollback fixture coverage according to repository migration rules.

Required migration evidence:

- fresh 35 → 36;
- representative populated 35 → 36;
- idempotent open at 36;
- downgrade/rollback fixture contract where repository policy requires it;
- existing Rule Repository/Organization/cleanup/operation data unaffected.

Update performance fixture schema identity consistently.

Do not add Schema 37 in this slice.

---

## 12. UI / product surface

PM-02A should materially change Automation from a Rules-first page into an Intent-first product surface without doing PM-03's full compatibility retirement.

Required normal surface:

### Automation intent list

Show:

- title;
- workflow (“Prepare an Organize plan”);
- scope summary;
- trigger (“Manual”);
- state (enabled/paused);
- most recent run outcome when available.

Primary action:

**Generate plan** / equivalent task-language copy.

Do not label this action “execute files”.

### Intent editor

The user configures:

- title;
- managed File Library scope/query;
- enabled/paused state.

Display as fixed policy facts:

- Manual trigger;
- Review required;
- Zen will never apply file changes automatically in PM-02A.

Do not show unavailable schedule controls.

### Run outcome

After success:

- show the generated Organization Plan reference;
- provide an action to open/review it in Organize;
- if AI analysis is still pending, say so truthfully;
- do not claim the plan is complete if refresh is required.

### Existing Rules

Existing Rule Repository V2 + Rule Proposal must remain reachable as an **Advanced Rules / Policies** compatibility surface.

PM-02A may demote its prominence, but must not delete or rewrite Rule authority.

PM-03 owns broader hierarchy/compatibility retirement.

---

## 13. Trigger truthfulness

PM-02A supports exactly:

- Manual trigger for Automation Intents.

It does not support:

- scheduled Automation Intent execution;
- filesystem watcher Automation Intent execution;
- startup trigger;
- idle trigger;
- battery/power trigger.

Existing watcher-driven **Rule** classification behavior remains existing Rule behavior and must not be relabeled as an Automation Intent trigger.

Any copy implying scheduled intent execution or durable intent history before implementation must be removed, hidden, or explicitly marked unavailable.

---

## 14. Safety invariant

For PM-02A:

```text
Automation Intent Run
≠
filesystem mutation
```

The strongest acceptance test is:

> invoking the PM-02A manual Automation Run command cannot produce a file move, rename, delete, trash or permanent-delete operation without a later separate user review/confirmation flow through existing authorities.

No convenience shortcut may weaken this invariant.

---

## 15. Rules migration boundary

Rules currently provide deterministic metadata classification/suggestion behavior.

PM-02A must preserve that behavior for compatibility.

Do not:

- convert existing rules to intents;
- convert rule enablement into Automation enablement;
- make Rule weights/conditions drive current AI Organize semantics;
- remove Rule Repository V2;
- expand Rule AST;
- add content fields to Rule AST;
- use Rules as an AI-unavailable semantic fallback.

The product may begin describing Rules as advanced Policy/Signal behavior, but authority semantics stay unchanged.

---

## 16. Performance / zero-burden requirements

PM-02A adds no recurring work.

At idle:

- no new interval;
- no new poller;
- no schedule loop;
- no watcher fan-out;
- no hidden WebView work;
- no AI request merely because an intent exists.

Manual run may enqueue existing Managed AI work through existing owners.

Large query scopes must remain bounded by existing File Library / Organization Plan scale contracts. The renderer must not enumerate all matching files.

No new in-memory full-library array is allowed.

---

## 17. Privacy and security

PM-02A must preserve:

- three-level Searchable / Managed / AI-readable separation;
- Managed AI local/cloud consent;
- credential-store boundary;
- main-window command permissions;
- no Search Window mutation permissions;
- no raw content persistence in Automation tables;
- no provider raw response persistence;
- no hidden upload consent.

The Automation Run receipt may reference durable IDs and sanitized status only.

---

## 18. Tests — mandatory

### Schema / repository

- Schema 35 → 36 migration;
- populated migration;
- intent CRUD/CAS;
- enable/disable CAS;
- archive retains run history;
- invalid workflow/trigger/policy rejected;
- request-key idempotence;
- request-key collision across different intent/revision rejected.

### Scope

- `all_enabled_roots` accepted;
- explicit durable root IDs accepted;
- `current_scan` rejected for durable intent;
- removed/disabled root fails closed at run;
- query canonicalization/fingerprint stable;
- renderer cannot supply snapshot revision as authority;
- run resolves fresh current snapshot.

### AI/readiness

- current assessments can materialize a reviewable plan without requiring a new provider call;
- when fresh analysis is required, AI disabled records a truthful analysis blocker;
- invalid provider/model blocks only the needed fresh-analysis enqueue path;
- missing credential blocks only the needed cloud-analysis enqueue path;
- missing Managed Scope consent blocks only the needed analysis path;
- blocked analysis leaves the durable plan and needs-analysis truth intact;
- no legacy Rules fallback;
- current eligible local/provider path enqueues through the existing Managed AI authority.

### Organization integration

- exactly one Organization Plan per idempotent run;
- plan source is current backend-resolved `LibrarySelectionV1`;
- missing semantic work is enqueued through existing `analyze_organization_plan_items`;
- plan ID is recorded in Automation Run;
- analysis-pending outcome remains truthful;
- Automation Run never calls `execute_organization_plan`.

### Safety

Static/runtime guard proving PM-02A production path cannot call:

- filesystem execution;
- permanent delete;
- cleanup execute;
- shell/tool execution.

### Existing authority regressions

- Rule Repository V2 tests remain green;
- Rule Proposal tests remain green;
- watcher Rule execution remains unchanged;
- Organization Plan review/Dry Run/execution tests remain green;
- PM-01 AI-only Organize/Cleanup gates remain green.

### UI

- empty state;
- create intent;
- scope validation;
- enabled/paused;
- Generate plan confirmation/copy;
- blocked readiness state;
- success opens/links Organize plan;
- analysis-pending state;
- recent run projection;
- Advanced Rules/Policies remains reachable;
- no schedule control;
- narrow layout;
- keyboard/focus restoration;
- accessible live status.

---

## 19. Browser/mock boundary

Browser mocks may support deterministic PM-02A UI flows but are not backend acceptance evidence.

Mocks must preserve:

- backend-issued IDs;
- revision conflicts;
- request-key idempotence;
- blocked readiness states;
- plan-reference outcomes.

Do not let browser mock success substitute for Rust/database integration tests.

---

## 20. Native evidence

PM-02A changes a user-facing Automation workflow.

Before Owner closeout, collect at least:

- Windows native main-window create-intent flow;
- manual Generate plan trigger;
- blocked or no-provider truthful state if live AI cannot be safely exercised;
- successful plan handoff where a safe configured local/test provider fixture is available;
- narrow/responsive browser evidence;
- keyboard/focus check.

Do not claim macOS native PASS without a real supported host.

Native evidence must not require real destructive file operations.

---

## 21. Documentation updates required by implementation

Implementation PR must reconcile:

- `STATUS.md`;
- `ROADMAP.md`;
- AI-only Product Migration initiative;
- `PRODUCT_MAP.md`;
- `ARCHITECTURE_MAP.md`;
- command permission matrix;
- schema/migration documentation;
- Automation/Rules compatibility wording;
- result document for PM-02A.

README/product copy should be changed only where current user-facing claims become materially outdated.

---

## 22. Explicit non-goals

PM-02A does **not** authorize:

- scheduled Automation Intent execution;
- watcher-triggered Automation Intent execution;
- autonomous background plan generation;
- autonomous file mutation;
- automatic Organization Plan execution;
- Cleanup automation;
- general natural-language agent/tool planner;
- shell/process tools;
- MCP/plugin/tool registry;
- RAG/vector database;
- Preference Memory production;
- System One;
- Laya/Jev production integration;
- hidden personalization;
- telemetry-based learning;
- new provider contract solely for Automation;
- a second Managed AI queue;
- a second scheduler/resource governor;
- PM-03 migration closeout;
- release/publication work.

---

## 23. Stop conditions

STOP and return to Owner review if implementation requires:

- changing Organization Plan authority;
- changing PM-01 current semantic authority;
- introducing a new provider request schema;
- adding a general AI planner;
- adding schedule/watch background execution;
- adding autonomous file mutation;
- adding another queue/scheduler;
- broad Rule AST redesign;
- widening Search Window permissions;
- Schema 37+;
- weakening Preview/confirmation/journal/Restore;
- interpreting ZDB-03 Preference results as production authority.

Do not work around a STOP.

---

## 24. Implementation sequencing

Recommended implementation order:

1. Schema 36 + Rust durable Intent/Run repository;
2. backend commands + permission contract;
3. manual-run orchestration using current Query V2 + Organization + Managed AI;
4. TS domain/API/browser mocks;
5. Automation Intent-first UI;
6. Advanced Rules/Policies compatibility placement;
7. integration/security/performance tests;
8. native/browser evidence;
9. result/governance closeout;
10. Owner review.

Do not begin PM-02B in the PM-02A implementation PR.

---

## 25. Implementation PR rules

After this activation merges, implementation uses one dedicated Draft PR.

Suggested branch:

`product/pm-02a-automation-intent-foundation`

Suggested title:

`product: add PM-02A Automation Intent foundation`

The implementation PR remains Draft until:

- local required tests pass;
- exact-head hosted CI passes;
- migration identity is frozen;
- native/browser evidence is recorded;
- result document is complete;
- Owner review is performed.

Do not merge automatically.

---

## 26. Required final handoff

Return:

- starting master SHA;
- branch;
- final PR head;
- schema before/after;
- exact durable tables/indexes added;
- command surface;
- permission classes;
- intent/query canonicalization behavior;
- request-key idempotence behavior;
- readiness/consent behavior for already-current versus fresh-analysis-needed items;
- Organization Plan integration proof;
- proof of zero filesystem mutation from Automation Run;
- proof no second queue/scheduler exists;
- Rule compatibility proof;
- frontend/browser tests;
- Rust/migration tests;
- performance/architecture checks;
- native evidence boundary;
- final exact-head CI;
- changed-file inventory;
- remaining PM-02B/PM-03 gates.

Stop at:

**PM-02A AUTOMATION INTENT FOUNDATION COMPLETE — READY FOR OWNER REVIEW**

Do not start PM-02B.

---

## Activation disposition

Owner activation review: **PASS** at reviewed head `705532057fb202500ffcb8257d10bc8d949843d4` with exact-head CI `36709502159 — SUCCESS`.

Merge of this taskbook activates only:

**PM-02A — Automation Intent Foundation implementation**

It does not activate PM-02B, PM-03, Preference Memory production, System One, Laya/Jev, or autonomous mutation.
