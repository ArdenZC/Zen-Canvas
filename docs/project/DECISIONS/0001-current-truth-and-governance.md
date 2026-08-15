# ADR-0001: Project Current Truth and Governance Layer

Status: accepted

Date: 2026-08-15

## Context

Zen Canvas accumulated strong implementation and safety contracts through Architecture Remediation V1, UI/UX V4.3 and later macOS work. The same success created a governance problem: active-stage language, baselines and completion evidence became distributed across `AGENTS.md`, design execution documents, remediation taskbooks, QA records and PR closeouts.

Several of those documents remain technically valuable, but their metadata can become stale while production code advances. An agent or contributor can therefore read a historically authoritative document and mistake it for the current project state.

## Decision

Install `docs/project/` as the project operating layer.

1. `STATUS.md` is the unique source for current baseline, active initiative, schema/package/release state and exact-head validation summary.
2. `AGENTS.md` is a stable repository constitution and entry point; it does not own a changing active stage or baseline.
3. `ARCHITECTURE_MAP.md` records current durable authorities and compatibility bridges.
4. `PRODUCT_MAP.md` records current product/workspace ownership.
5. Historical remediation/design/QA documents remain evidence and domain contracts, but no longer own project-level current status.
6. Architecture/governance changes that move durable authority, platform support, recovery strategy or engineering policy receive an ADR.
7. Every merged initiative updates current truth before closeout.

## Consequences

Positive:

- current project state has one obvious entry point;
- historical evidence can remain intact without impersonating current status;
- agent instructions can stay stable across initiatives;
- branch/validation/release closeout becomes explicit;
- future File Library 2.0 work can start from a known authority map instead of reconstructing history.

Costs:

- maintainers must update `STATUS.md` as part of every meaningful initiative closeout;
- existing public README, V4.3 completion records and macOS QA evidence still need a later convergence pass;
- old documents may continue to contain stale “current” wording until they are marked historical or indexed by G1B.

## Rejected alternatives

### Keep using `AGENTS.md` as current status

Rejected because the file becomes large, stage-specific and stale. Agent safety rules should be stable even when the project moves to a new initiative.

### Delete historical taskbooks and execution records

Rejected because they contain valuable security, migration, performance, review and provenance evidence.

### Create a new status file for every initiative

Rejected because it recreates the same ambiguity. Initiative records are scoped; `STATUS.md` remains the one project-level current-state authority.
