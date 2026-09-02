# ADR-0007: Proportional Validation and Failure Handling

Status: accepted

Date: 2026-09-02

This ADR is accepted together with PR #173 if that PR merges.

## Context

Zen Canvas already has focused-before-broad validation guidance, a machine-owned hosted CI change classifier/router, exact-head and merge-integration evidence semantics in ADR-0004, and stricter domain safety and platform contracts.

ES-00/ES-01 found a governance gap: local development and taskbooks did not clearly state when previously successful evidence remains useful, what changes invalidate a proof, when expensive validation should be repeated, or how uncertainty should be contained without automatically broadening failure.

This is a preventive, proportional governance decision. The available ES-00 evidence was insufficient to claim systemic validation overuse; this ADR does not make that claim.

## Decision

### 1. Claim-scoped local validation

During implementation, run focused validation first. Expensive broad applicable checks are normally run on a stable candidate rather than after every small edit.

A rerun is justified when a claim-relevant source, test or gate input changed; the required environment or toolchain materially changed; an explicit freshness requirement applies; prior evidence failed or was incomplete; or the current integration or artifact stage requires fresh evidence. Unrelated repository activity alone is not sufficient reason.

### 2. Semantic evidence reuse is not exact-head reuse

Previous successful evidence may remain useful for development reasoning if its relevant inputs remain unchanged. It does not become fresh exact-head evidence for a later production commit. Current project and CI exact-head requirements remain authoritative.

ADR-0007 does not alter ADR-0004's:

- Head Validation;
- Merge Integration;
- tree-equivalence semantics;
- required aggregate enforcement;
- exact-source ownership.

ADR-0004 remains the authority for the source and integration evidence contracts.

### 3. Hosted CI routing remains owned by current CI contracts

The current workflow and change classifier own hosted minimum routing. Local and taskbook reasoning may use narrower focused validation during iteration, but it may not maintain a competing path-routing table, silently waive hosted lanes, or classify production changes as docs-only or lower-risk for convenience.

Changing hosted routing requires a separately reviewed and tested change to the routing owner.

### 4. Required gates remain required

If a currently required gate is red, missing or incomplete, it remains blocking according to its owning contract. Proportional failure handling does not authorize an agent to reinterpret an existing required gate as optional.

Removing or weakening an existing required gate requires a separately reviewed change to its owning contract or routing authority.

### 5. Artifact/native evidence remains identity-bound

Artifact and native acceptance applies only to the exact source, artifact identity and relevant environment actually exercised. Historical acceptance may remain historically informative, but it must not be presented as acceptance of a newly issued artifact.

### 6. Proportional failure containment

Fail closed at the narrowest boundary that fully contains credible irreversible harm, authority violation, unsafe persistence or incorrect release.

When uncertainty cannot create such harm, prefer truthful partial or reconciliation state, degradation or reporting instead of unnecessarily blocking a broader product or engineering workflow.

These are natural-language decision principles. They do not define permanent enum or taxonomy names such as BLOCK, RECONCILE, DEGRADE or REPORT.

### 7. Domain contracts retain precedence

ADR-0007 does not weaken stricter accepted filesystem safety, physical identity, Safe Trash / Restore, persistence or future-schema, permission, provider consent, recovery, platform or native, or artifact provenance contracts.

If a specific domain contract appears too strict, change that contract separately through its normal review path.

## Consequences

Positive consequences:

- faster local feedback;
- fewer repeated expensive proofs with unchanged claims;
- clearer distinction between development evidence and exact-head integration evidence;
- prevention of ad-hoc CI or gate bypass;
- failure containment proportional to credible harm;
- reduced validation-policy ratchet without weakening existing safety.

Costs and tradeoffs:

- agents and reviewers must reason about which claim changed;
- some exact-head or hosted gates still run when earlier semantic evidence exists;
- conservative CI routing may remain broader than local development checks;
- relaxing an obsolete gate still requires an explicit owner-contract change rather than ad-hoc skipping.

## Rejected alternatives

### Run all validations after every change

Rejected because repository activity does not invalidate every proof and this creates cost without necessarily adding evidence.

### Let agents decide hosted CI lanes ad hoc

Rejected because this would create a competing routing authority and weaken deterministic enforcement.

### Reuse previous production evidence as fresh exact-head evidence

Rejected because it contradicts ADR-0004 and can misrepresent the source or tree actually validated.

### Make all uncertainty fail globally

Rejected because many uncertainties can be safely contained through truthful partial, reconciliation or degraded state; global failure should be reserved for the boundary needed to contain credible harm.

### Let implementation tasks retire obsolete gates directly

Rejected because a required gate's owner contract, not an individual task, owns its removal.

## Relationship to ADR-0004

ADR-0007 is additive. It does not replace or relax ADR-0004.

ADR-0004 continues to own:

- exact PR source evidence;
- merge-integration evidence;
- tree-equivalence rules;
- required aggregate semantics;
- evidence belonging to the executed commit or tree.

ADR-0007 only governs:

- development-time proportionality;
- evidence applicability and reuse semantics before required integration proof;
- failure containment;
- required-gate anti-ratchet.

## Scope and non-goals

ADR-0007 creates no Safety Tiers, Gate Registry, Proof Registry, Evidence Database, Validation Router V2, Failure Policy enum or ES-specific permanent process hierarchy. Current owners remain current owners. This decision does not create a second ES policy document or move any existing authority.

## Acceptance

Acceptance: reviewed and merged through PR #173 if that PR merges.
