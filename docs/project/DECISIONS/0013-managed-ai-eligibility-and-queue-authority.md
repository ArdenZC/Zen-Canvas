# ADR-0013 — Managed AI Eligibility and Queue Authority Boundary

Status: **Proposed — Owner freeze candidate under #333; no AI Eligibility implementation authorized by this ADR draft.**

Parent governance gate: [#330](https://github.com/ArdenZC/Zen-Canvas/issues/330)  
Tracking issue: [#333](https://github.com/ArdenZC/Zen-Canvas/issues/333)

Baseline:

- `master@7a2e1b31bb4ac49aa8e8d2378fc9adb6bb64034f`
- tree `79bb2dad6d13a0b579b70b78972ab0d5f7736b47`
- Schema 37 / package 0.1.40 / IPC v3

## Context

Zen Canvas already has a durable Managed AI pipeline:

- Global Index discovers broad filesystem metadata;
- Managed Scope defines which file roots are enrolled and the current local/cloud AI policy;
- `ai_jobs` is the single durable Managed AI job queue;
- `ManagedAiWorker` claims durable work, revalidates scope/source/fingerprint/currentness and uses the existing `WorkScheduler`;
- canonical per-file semantic output is `SemanticAssessmentV1` stored in the existing analysis-state authority;
- `global_index/legacy_queue.rs` is TD-006: a compatibility adapter into that same durable queue, not a second queue.

Current production logic can enqueue work from Global Index/Managed Scope and related existing semantic consumers. Managed-scope backfill also uses an initial bounded job limit. This protects quantity, but quantity alone is not a sufficient product prioritization or AI-cost contract.

The next architecture needs an explicit distinction between discovering files and deciding which files deserve AI work.

## Exact reviewed Managed AI queue surfaces at baseline

Current repository search shows the durable queue authority in `ai_jobs` and these production surfaces that must be included in any future eligibility implementation audit:

- `src-tauri/src/global_index/repository.rs` — canonical Global Index queue helpers / enqueue logic;
- `src-tauri/src/global_index/managed_scope.rs` — Managed Scope membership/backfill and initial bounded enqueue;
- `src-tauri/src/global_index/legacy_queue.rs` — TD-006 compatibility adapter into the same durable queue;
- `src-tauri/src/db/queries/organization/mod.rs` — Organization semantic readiness/job production paths;
- `src-tauri/src/db/queries/rule_proposals/mod.rs` — Rule Proposal semantic job path;
- `src-tauri/src/global_index/managed_worker_hardened.rs` — claim/reconcile/execute/currentness lifecycle; it is the worker/consumer, not a second producer authority.

The worker already joins jobs to Managed Scope, managed entry, Global Index entry/volume and current analysis state, revalidates policy/currentness and is admitted through the existing WorkScheduler.

This inventory is the minimum audited set. A later implementation activation must rerun repository-wide producer search at its exact baseline and add any newly introduced producer before code changes.

## Decision

### 1. Five different states must never be collapsed

The following implications are forbidden:

`Indexed => Managed`

`Managed => AI Eligible`

`AI Eligible => AI Analyzed now`

`AI Analyzed => Mutation Eligible`

The required conceptual pipeline is:

`Discover / Index`
→ `Managed Scope`
→ `AI Eligibility Decision`
→ `Queue Admission / Current Assessment Reuse`
→ `Semantic Assessment`
→ downstream proposal consumers
→ separately authorized Preview/Operation/Cleanup/Restore authorities.

AI Eligibility is an **admission decision**, not a mutation authority.

### 2. One durable Managed AI queue remains authoritative

There is exactly one durable Managed AI job queue:

`ai_jobs`

New AI Eligibility work must reuse:

- existing durable queue;
- existing ManagedAiWorker;
- existing WorkScheduler / RuntimeResourceGovernor admission;
- existing provider settings/credential/readiness;
- existing Managed Scope identity/policy;
- existing SemanticAssessmentV1 currentness/fingerprint authority.

No second AI queue, shadow worker, polling loop, scheduler, provider loop or “eligibility queue” may be introduced.

TD-006 `legacy_queue.rs` may remain temporarily only as a compatibility adapter into `ai_jobs`. New production eligibility producers must target the canonical queue API rather than add new dependencies on the legacy adapter.

### 3. Eligibility is separate from consent

Managed Scope answers whether Zen is allowed to manage a root and whether local/cloud metadata AI is permitted under the existing policy.

Eligibility answers whether a specific candidate should consume AI work now.

Eligibility cannot grant permission that Managed Scope or another feature-specific consent domain denied.

Existing consent domains remain distinct:

- Managed metadata AI policy;
- Content Understanding policy and per-run content authorization;
- Cleanup local/cloud data-sharing policy.

A cloud metadata permission cannot silently authorize sending file content.

Any future content-bearing eligibility path must use the owning Content/feature-specific disclosure and consent contract.

### 4. Eligibility is generative-last

Candidate handling should prefer this order:

1. deterministic source/metadata checks;
2. managed-scope and provider-policy checks;
3. current SemanticAssessmentV1 reuse;
4. low-cost local/project/context evidence where already available;
5. workload/budget/admission decision;
6. generative provider only when necessary.

“AI-only” product semantics mean semantic decisions are AI-driven where required; they do not mean every browse/index event becomes an LLM call.

### 5. Current assessment reuse is a first-class outcome

Before creating/reactivating provider work, the system must check whether a current assessment already exists for the exact authoritative source/input/provider binding.

A valid current `SemanticAssessmentV1` may satisfy downstream semantic consumers without a new provider call.

A stale assessment may be retained historically but cannot be treated as current.

User-corrected semantic state remains authoritative according to existing policy and must not be overwritten by eligibility admission.

### 6. Eligibility decision outcomes are conceptual, not automatically new schema

The architecture recognizes at least these decision outcomes:

- `reuse_current_assessment`
- `eligible_now`
- `deferred_budget_or_resource`
- `excluded_policy_or_consent`
- `excluded_low_value_default`
- `excluded_technical_or_unsupported`

These names are architecture semantics, not a mandate for a new database enum/table.

Implementation should prefer existing durable queue/status/assessment authorities and recomputable decision evidence. Any proposed new persistent eligibility table/status model requires a separate schema/ADR review.

### 7. Default low-value exclusions are admission policy, not deletion policy

Examples such as:

- dependency/vendor trees;
- build outputs;
- caches;
- virtual environments;
- package-manager stores;
- binary/system dependency trees;

may be poor default candidates for per-file AI analysis.

Excluding them from AI admission does **not** mean:

- hide them from Files/Search;
- remove them from Global Index;
- mark them Cleanup-safe;
- delete them;
- infer they have no user value.

User explicit request, future project context or a changed policy may cause re-evaluation.

### 8. Project/directory understanding should reduce per-file model calls

A directory/project may be recognized through deterministic/project-manifest/context signals so the system can prioritize representative files such as:

- README/documentation;
- project manifests;
- user-selected source files;
- high-value recently active files.

This does not create a second project index authority. Project grouping is an eligibility/context input over existing file identities.

Do not enqueue every dependency/source artifact merely because the project root is Managed.

### 9. Eligibility must be evaluated at every material admission boundary

At implementation time the current exact production producers must be audited. Eligibility cannot be applied only to one initial backfill path while other producers bypass it.

At minimum audit:

- Managed Scope initial backfill;
- Global Index incremental enqueue;
- explicit/manual Organize semantic readiness;
- Automation plan semantic readiness;
- existing Rule Proposal semantic assistance where it touches the durable queue;
- any other current producer that inserts/reactivates `ai_jobs`.

The final implementation must route every Managed AI producer through one canonical eligibility/admission contract or prove why a producer is intentionally outside it.

### 10. Eligibility is re-evaluated on authoritative triggers, not idle polling

Re-evaluation may be triggered by:

- Managed Scope enabled/policy change;
- provider/settings/credential change;
- source/input fingerprint change;
- explicit user action;
- current assessment becoming stale;
- budget/resource availability change when deferred work is already durable/pending;
- project/context evidence change where an owning event exists.

Do not add a recurring “scan everything for eligibility” polling loop.

Existing event/wake/scheduler architecture remains authoritative.

### 11. Budget/resource deferral must preserve durable intent without creating hot loops

If a candidate is otherwise eligible but cannot run due to resource/budget policy:

- do not lose the intent silently;
- do not busy-loop;
- use existing durable queue and scheduler/wake semantics where possible;
- preserve truthful blocked/deferred state;
- resume only on an existing authoritative wake/trigger.

The implementation must distinguish policy/consent exclusion from temporary resource deferral.

### 12. Queue claim remains fail-closed and revalidated

ManagedAiWorker must continue to revalidate at claim and around provider execution:

- scope enabled;
- managed entry enabled;
- source not stale;
- provider permitted;
- user-correction state;
- input fingerprint/currentness;
- resource admission.

Eligibility computed earlier is not a permanent authorization token.

### 13. No mutation authority is added

AI Eligibility can decide whether semantic analysis work is warranted.

It cannot:

- create Operation execution authority;
- execute Organization Plan;
- execute Cleanup;
- bypass Operation Preview;
- bypass confirmation/revalidation/journal;
- grant Safe Trash/Restore rights;
- convert Notes or Preference evidence directly into mutation.

Existing mutation/recovery chain remains independent.

### 14. Explicit user context, Preference evidence and Rules remain separate

Future Notes / Explicit User Context may influence eligibility and semantic interpretation.

But:

`User Note != Preference Evidence != Rule/Policy != AI Guess`

A Note such as “final version” or “do not delete” may become strong evidence for a downstream decision, but it does not silently become an executable Rule.

Preference Memory/System One/Laya/Jev remain research or separately activated capabilities. This ADR does not put them in the production runtime.

### 15. TD-006 retirement contract

After this ADR is accepted:

- no new producer should depend on `global_index/legacy_queue.rs`;
- current legacy adapter callers must be inventoried;
- canonical queue API must preserve old durable-row repair/migration behavior;
- TD-006 closes only when production classification/cancel/admission paths use the final queue API directly and old-row repair coverage remains tested.

Removing the adapter is a bounded later task, not part of the ADR PR.

## Rejected alternatives

### Queue every managed file and rely only on a numeric cap
Rejected: a cap bounds volume but does not prioritize user-value or prevent repeated low-value generative work.

### Create an “AI Eligibility Queue” beside ai_jobs
Rejected: it would introduce a second durable work authority and duplicate worker/scheduler semantics.

### Use filename/path exclusion as Cleanup truth
Rejected: AI admission value and filesystem mutation safety are different domains.

### Treat local embeddings/System One as automatically authorized production
Rejected: local intelligence layers still require evidence, lifecycle/resource ownership and explicit activation.

### Let the renderer decide eligibility
Rejected: renderer state is replaceable projection. Durable source/scope/provider/currentness truth is backend-owned.

## Implementation gate

This ADR draft authorizes no code.

After Owner acceptance, a separate AI Eligibility implementation activation must:

1. audit every current Managed AI producer at the exact baseline;
2. define one canonical eligibility/admission function/API;
3. preserve one `ai_jobs` queue/ManagedAiWorker/WorkScheduler;
4. define evidence/metrics for provider-call reduction, latency and queue quality;
5. prove no consent/mutation boundary is weakened;
6. specify hosted tests and later native/product acceptance appropriate to any UI/settings changes.

## Measurement contract for the later implementation

The implementation should measure at least:

- discovered/indexed candidate count;
- managed candidate count;
- eligibility decisions by outcome;
- current-assessment reuse count;
- jobs actually enqueued/reactivated;
- provider calls;
- local vs cloud calls;
- deferred candidates;
- policy/consent exclusions;
- duplicate/superseded jobs avoided;
- estimated token/cost and latency where measurable.

Metrics are diagnostic/product-economics evidence. They do not become another durable decision authority.

## Exit / review evidence

Before this ADR can be marked Accepted, Owner review must verify:

- exact current producer/consumer inventory;
- no hidden second queue/worker/admission owner;
- consent domains remain separate;
- current-assessment reuse/currentness matches existing SemanticAssessmentV1 contract;
- conceptual eligibility outcomes do not accidentally require an unapproved schema;
- TD-006 no-growth/retirement rule is implementable.

This ADR changes architecture constraints only; it changes no product behavior, Schema, IPC, package, provider settings, queue rows or filesystem mutation authority.
