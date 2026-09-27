# AI-only PM-01 — Owner Deep-Audit Amendment

Status: **DESIGN HOLD — production implementation must not begin until this amendment is incorporated into the PM-01 contract**

Audit baseline: `master@d76bc1f54892bb3e48ac095ea590dcb170f3aa4e`  
Activation PR at audit start: #274, docs-only head `90dcde3892d22024000a0039ddef0fe656d32615`.

## Purpose

This amendment records a cross-stage owner audit of the merged Zero-Burden, performance and AI Semantic Authority work before PM-01 changes the product from optional AI enrichment to AI-required Organize/Cleanup semantics.

The audit does **not** roll back PR #272. The merged SemanticAssessmentV1 / Managed AI / Organization Plan safety boundaries remain accepted. The hold exists because making AI a required product gate changes what must count as a valid, current and consented AI assessment.

## Accepted foundations

The following boundaries were re-read in current production source and remain accepted:

- Managed AI persists semantic assessments only after scope/provider/fingerprint/user-correction revalidation.
- SemanticAssessmentV1 rejects unsupported versions/enums, absolute/traversal targets and provider-supplied mutation authority.
- Organization target paths remain deterministic Zen output; Operation Preview remains executable mutation authority.
- Cleanup still resolves durable Analysis Findings by run, active status, expected finding revision, existing path and physical identity before preview/execution.
- Cleanup AI merge is conservative: provider output cannot lower detector risk into new trash authority.
- Tauri command registration / AppManifest / capability sets and main-window mutation guards are covered by fail-closed contract tests.
- AI API keys are stored in the Windows/macOS system credential store, not persisted in SQLite plaintext; replacement/readback/rollback is transaction-tested.
- SQLite schema/migration and major durable ledgers continue to use transactional/future-schema-fail-closed patterns.
- AI request tracing defaults off, is bounded, and redacts credentials/local paths.

## Merge-blocking PM-01 design findings

### A. Cleanup AI has a stale-publication race

Current `analyze_cleanup_candidates_with_ai` captures each finding revision and resolves identity **before** the provider request.

After the provider returns, it re-reads the finding but calls `append_analysis_ai_assessment` without an expected finding revision. The append updates any still-active finding and increments its revision.

Therefore a provider result produced from revision N can be published after another operation has changed the finding to revision N+1. Existing conservative merge prevents this from escalating filesystem authority, so this is not a demonstrated data-loss path today. It is nevertheless invalid as a future **required-AI execution prerequisite**.

Required correction:

- provider input must carry the exact expected finding revision used for the request;
- publication must use a backend CAS against that expected revision and active status;
- immediately before publication, current path/identity must still match the finding;
- stale publication fails closed and writes no successful assessment evidence.

### B. Existing Cleanup “AI success” does not prove provider coverage

The current parser accepts an `analyses` array but does not require an exact one-to-one result set for the requested candidate IDs.

Current behavior:

- unknown output IDs are ignored;
- duplicate IDs collapse through last-write-wins map insertion;
- a requested candidate omitted by the provider falls back to the original deterministic candidate;
- the caller then still appends `ai_assessment` evidence for every returned candidate object in its merged result set.

Therefore “an `ai_assessment` evidence row exists” cannot be used as the PM-01 execution gate.

Required correction:

- every provider batch must return **exactly one** valid result for every requested candidate;
- unknown, missing or duplicate candidate IDs fail the whole batch;
- failed/incomplete batches do not publish successful assessment evidence;
- a required-AI gate must distinguish successful provider assessment from deterministic fallback.

### C. Cleanup assessment currentness is not durably encoded

Existing `ai_assessment` evidence stores generic result JSON and timestamp, but does not explicitly bind:

- schema version;
- finding ID / run ID;
- input finding revision;
- resulting finding revision;
- provider kind/preset/model;
- deterministic input identity/fingerprint;
- successful/terminal assessment state.

That was acceptable while AI was optional enrichment. It is insufficient once execution depends on proving a successful current assessment.

Required PM-01 contract:

Prefer the existing `analysis_finding_evidence.value_json` / evidence summary unless implementation proves that a schema migration is unavoidable.

A versioned envelope must include at least:

- `schemaVersion`;
- `findingId`;
- `runId`;
- `inputFindingRevision`;
- `resultFindingRevision`;
- provider kind/preset/model audit identity;
- `assessedAt`;
- a deterministic input fingerprint or equivalent binding over the current finding/identity inputs;
- the conservative result payload.

The successful append increments finding revision exactly once. Because user triage decisions use the separate `analysis_finding_decisions.revision`, normal acknowledge/dismiss/snooze changes do not invalidate a current AI assessment.

Any later finding mutation/revalidation/new assessment changes finding revision and makes the previous assessment non-current.

### D. Cleanup cloud consent is a distinct authority

Cleanup AI does not use Managed Scope `allowLocalAi/allowCloudAi`.

Its request always includes the candidate **name** and deterministic finding metadata. Depending on AI settings it additionally includes:

- parent directory name when `sendParentPath=true` — currently the default;
- full path when `sendFullPath=true`.

When AI review was an explicit optional action, that action supplied an additional user-intent signal. PM-01 intends to make AI assessment mandatory for new Cleanup execution, so approved cleanup scan paths must not be treated as implicit cloud-sharing consent.

Required correction:

- Organize Managed Scope consent and Cleanup AI data-sharing consent remain separate;
- cloud Cleanup readiness requires an explicit Cleanup cloud-consent/policy predicate;
- local Cleanup AI may use a separate local policy path;
- UI copy must disclose that candidate names/metadata are sent, plus parent/full path according to the selected privacy settings;
- backend Cleanup commands enforce the policy; frontend gating alone is insufficient.

No existing Managed Scope permission may be silently broadened into Cleanup permission.

### E. “AI ready” cannot be one global boolean

`useAIProcessingModeStore` currently projects only `enabled + provider`. It cannot prove:

- credential/config validity;
- feature enablement;
- Managed Scope eligibility/provider policy;
- Cleanup-specific consent.

PM-01 must split readiness into:

1. **provider readiness** — loading / disabled / configuration invalid / configured; network reachability remains unknown until an explicit provider request/test;
2. **Organize feature readiness** — provider readiness + eligible Managed Scope + current local/cloud policy;
3. **Cleanup feature readiness** — provider readiness + Cleanup AI enabled + Cleanup local/cloud data-sharing policy.

The UI may share one Connect AI component. The backend feature gates must remain distinct.

### F. Current product copy overstates Preference Memory

Settings currently says learning history is, by default, an AI classification reference. The current durable Managed AI SemanticAssessmentV1 worker does **not** load learned preference memory into its request.

This is not a hidden second authority; that is good for safety. It is a product-truth mismatch.

PM-01 must not present Preference Memory as already active in the new semantic path. Either make the copy explicitly future/legacy-only, or defer the capability to PM-02/PM-03. Do not opportunistically implement a new preference-memory authority inside PM-01.

## Product-truth / explainability correction

The owner audit initially suspected the old `OrganizeSuggestionInspector` was presenting legacy `files.matched_rules` as current AI evidence. A caller audit corrected that suspicion: `OrganizeSuggestionInspector`, `OrganizeSuggestionList` and `OrganizeTargetDialog` have no current production caller in the V4.3 durable Organization Plan page. They are compatibility/debt surfaces, not the active PM-01 UI.

The **active** Organization Plan page has a different gap: `OrganizationPlanItemDto` persists/projects target, confidence, risk, review reasons and preview identity, but no semantic reason/evidence. The internal `Proposal` type also drops SemanticAssessmentV1 reason/context before Plan projection. Therefore the active UI can only fall back to generic copy such as “Generated from local rules or classification analysis,” which is both vague and wrong for the new AI-only product model.

PM-01 must:

- remove Rules-first fallback copy from the active Organize and Operation Preview surfaces;
- expose a read-only explanation projection that is bound to the **current semantic proposal/fingerprint** (for example reason plus a semantic-source/version marker), rather than reading legacy `files.matched_rules` or legacy classification reason;
- avoid creating a second durable semantic ledger merely for display;
- ensure explanation changes participate in the same current-proposal/stale semantics as the proposal they describe;
- keep dead compatibility components out of scope unless a caller-zero retirement is separately proven and reviewable.

A schema migration is not required by default. Prefer a live/current projection from the already-validated SemanticAssessmentV1 binding unless implementation proves durable snapshotting is necessary for historical review truth.

### Active copy inventory that PM-01 must correct

The following strings have current production callers and contradict or blur the AI-only product direction:

- AppShell account summary always renders `Local first · AI is off` independently of the actual Local/Cloud status card.
- `modeAIDisabledDesc`: “Indexing and organization rules run only on this device.”
- `organizeReasonFromAnalysis`: “Generated from local rules or classification analysis…”
- Operation Preview empty state instructs the user to run/adjust Rules to obtain executable organization suggestions.
- Rules/Automation empty, enabled and Run-now copy describes enabled rules as the source of new organization suggestions.
- Automation Settings describes Rules as the suggestion generator.
- Learning-history copy claims current AI-reference behavior that the durable SemanticAssessmentV1 worker does not implement.

PM-01 may relabel current Rules/Automation as Advanced / Policies / Compatibility and remove semantic-primary CTAs/copy. It must **not** implement PM-02 Automation architecture in order to fix product truth.

## Required diagnostic correction

Cleanup provider requests currently pass `trace_context: None`. The trace default operation is `FileClassification`, so Cleanup diagnostics are mislabeled and lose Cleanup job/batch/target context.

PM-01 must pass an explicit `AITraceContext` with `CleanupAnalysis` and bounded job/batch/target metadata. No request body/path/name should be added to trace metadata merely to fix this label.

## Non-blocking hardening / governance findings

These findings do not independently block #272 or require widening PM-01, but must remain recorded:

- Ollama uses the default reqwest redirect policy. It does not send an API key, but a configured redirect could forward metadata prompts. Aligning it with the no-redirect OpenAI-compatible client is recommended privacy hardening.
- `RISK_REGISTER.md` lagged recent Zero-Burden/performance/AI-stage truth and did not record #270 or the new AI-required migration risks.
- `MASTER_DEVELOPMENT_PLAN.md` still names an old W1 initiative under its “current canonical supporting documents” section.
- `PRODUCT_MAP.md` still describes Automation primarily as Rule Repository V2; this is current implementation truth but must be revised when PM-02 changes product ownership.
- Core files touched by PM-01 are already large. New readiness/consent/currentness logic should be extracted into focused backend/domain/controller helpers rather than extending monolithic UI/backend modules.
- Frontend architectural tests often use source-string assertions. PM-01 AI gates require mounted behavior tests in addition to static contract guards.

## Required Cleanup protocol before implementation

For each Cleanup AI batch:

```text
load active finding + expected revision
→ verify run / scope / path / physical identity
→ construct bounded provider input
→ provider call
→ parse strict schema
→ prove exact candidate-ID bijection
→ conservative merge
→ revalidate finding active + revision + identity
→ CAS publish versioned assessment envelope
→ only then mark assessment current
```

Preview/execution eligibility for a newly created/current Cleanup run must require a current successful assessment envelope for every selected executable finding.

This is an **evidence gate**, not a live-provider execution gate. Once an assessment envelope is current, later Preview/confirmation/Safe Trash uses that durable evidence plus existing deterministic safety authorities and does not require the provider to remain reachable or enabled. Provider readiness/consent is required again only when Zen must generate or refresh semantic assessment.

A provider failure, timeout, cancellation, partial result, duplicate result, stale revision or policy failure leaves the affected deterministic finding inspectable but **not executable** until a successful current assessment exists. It must not invalidate unrelated already-current assessments.

Historical Safe Trash batches, journals and Restore remain independent of live provider availability.

## Required tests added to PM-01

Backend behavior tests must cover at least:

- stale finding revision during provider call → zero AI publication;
- path/identity change during provider call → zero AI publication;
- missing provider candidate → batch fails, zero successful assessment for that batch;
- duplicate provider candidate → batch fails;
- unknown provider candidate → batch fails;
- exact complete provider result → one current envelope per finding;
- second assessment invalidates the prior envelope through finding revision;
- user decision revision does not invalidate the current assessment;
- Cleanup Preview and Safe Trash execution reject missing/stale/failed assessment;
- cloud Cleanup without explicit Cleanup consent fails closed even if the same path is a cloud-enabled Managed Scope;
- local/cloud feature-readiness predicates are distinct;
- AI still cannot elevate deterministic Cleanup executability;
- trace operation is `CleanupAnalysis`, not `FileClassification`.

Frontend mounted tests must cover provider-vs-feature readiness, Organize scope consent, Cleanup consent, disabled/config-error states, assessment failure and retry, and onboarding skip/configure paths.

Browser evidence remains required for the primary states in the PM-01 taskbook.

## Hold release condition

Production implementation on #274 may resume only after:

1. the PM-01 taskbook incorporates this amendment;
2. STATUS/ROADMAP truth says the Track is in design hold rather than active implementation while the hold exists;
3. project-level AI currentness/consent risks are recorded;
4. the owner explicitly lifts the hold.

Until then #274 remains Draft and docs-only.
