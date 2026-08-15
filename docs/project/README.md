# Zen Canvas Project Operating System

`docs/project/` is the current-truth layer for Zen Canvas. It answers what the product is, which architecture is authoritative, what is active now, what is planned next, and how work is allowed to move from idea to production.

This directory does not replace production code, security contracts, historical taskbooks, or closeout evidence. It provides the stable index that tells contributors which of those sources are current and how they relate.

## Read order

For any non-trivial change, read in this order:

1. `docs/project/STATUS.md` — current baseline, current initiative, validation and release state.
2. `docs/project/PRODUCT_MAP.md` — user-facing product domains and their boundaries.
3. `docs/project/ARCHITECTURE_MAP.md` — durable authorities, projections, platform boundaries and compatibility bridges.
4. The active initiative record under `docs/project/initiatives/`; start new records from [`initiatives/TEMPLATE.md`](initiatives/TEMPLATE.md).
5. `docs/project/DEVELOPMENT_WORKFLOW.md` — branch, review, CI and closeout rules.
6. Domain-specific security, remediation, design and QA contracts named by the active initiative.

`AGENTS.md` is the stable repository entry point. It must point here instead of embedding a changing project stage or baseline.

## Source-of-truth precedence

Separate normative safety authority from descriptive implementation truth. Normative authority defines what the product is allowed to do; implementation truth describes what the repository currently does.

### Normative authority — what is allowed

The following define the permitted safety and privacy boundary:

- security and privacy contracts;
- filesystem mutation safety, recovery and restore contracts;
- command and window permission boundaries;
- supported-platform safety contracts;
- accepted durable safety invariants.

These contracts remain authoritative even if current code violates them. A safety bug in production code must not be used to weaken a normative constraint.

### Descriptive implementation truth — what exists now

The following describe the current implementation and must be read as evidence of behavior, not permission to violate normative authority:

- current production code;
- executable tests;
- the actual database schema.

If normative safety authority and descriptive implementation truth disagree, treat the mismatch as an implementation defect or governance conflict. Do not use the current code to override the safety constraint; stop, report the conflict and fix or explicitly resolve it before proceeding.

### Project and historical context

After the two authority categories above, use this order for project context:

1. `docs/project/STATUS.md` for current project state, active initiative, current implementation baseline and release state.
2. The explicitly active initiative specification, accepted ADRs and narrower domain contracts.
3. `docs/project/ARCHITECTURE_MAP.md` and `docs/project/PRODUCT_MAP.md`.
4. Historical `docs/remediation/`, `docs/design/`, QA closeouts, archived prompts and old PR records.

Historical documents remain evidence. They do not become current execution authority merely because they contain a newer-looking date, branch name or implementation checklist.

## Project-state vocabulary

Use these terms precisely:

- **Implemented** — code or documentation exists on the stated commit.
- **Validated** — the stated checks passed on the exact stated commit.
- **Packaged** — an installer/package build succeeded on the stated commit.
- **Released** — a user-facing release/tag was actually published.

Do not describe validated or packaged work as released.

## Document ownership

- `STATUS.md` changes whenever the active initiative, baseline, validation state, schema, package version or release state changes.
- `PRODUCT_MAP.md` changes when product ownership or workspace boundaries change.
- `ARCHITECTURE_MAP.md` changes when durable authority, runtime ownership, persistence, platform ownership or compatibility boundaries change.
- `ROADMAP.md` changes when sequencing or authorization changes.
- `TECH_DEBT.md` tracks debt with explicit exit conditions rather than vague cleanup intentions.
- `RISK_REGISTER.md` tracks currently open project-level risks; historical remediation risk registers remain domain evidence.
- `DEVELOPMENT_WORKFLOW.md` changes only when the engineering process itself changes.
- `DECISIONS/` stores accepted cross-cutting architecture/governance decisions.
- `initiatives/` stores bounded current and planned initiatives. Completed initiatives remain as concise records, not as the current status source.

## Rule against duplicate current truth

Do not create another file whose purpose is “current project status”, “active phase”, “current baseline” or “what to do next”. Update `STATUS.md` or `ROADMAP.md` instead.

Domain documents may describe their own state, but must not silently override the project-level state recorded here.
