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

When documents disagree, use this order unless a narrower security contract explicitly requires a stricter rule:

1. Production code, executable tests and the actual database schema.
2. Security/platform contracts under `docs/security/` and durable safety invariants already accepted into production.
3. `docs/project/STATUS.md` for current project state, active initiative, current baseline and release state.
4. The explicitly active initiative specification and accepted decision records.
5. `docs/project/ARCHITECTURE_MAP.md` and `docs/project/PRODUCT_MAP.md`.
6. Historical `docs/remediation/`, `docs/design/`, QA closeouts, archived prompts and old PR records.

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
