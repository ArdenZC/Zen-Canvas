# Pre-PM AI Readiness + Consent Contract

Status: **COMPLETE / MERGED — owner review passed; PR #279 squash-merged; merge-after CI SUCCESS; issue #278 closed**

Owner: Zen Canvas

Start baseline: `master@6529d6023454cf50afc385b3ac9b503ca4a3a4cd`

Branch: `foundation/ai-readiness-consent`

Issue: [#278 — Pre-PM AI Readiness + Consent Contract](https://github.com/ArdenZC/Zen-Canvas/issues/278)

This record is the bounded initiative authority. `STATUS.md` remains the unique current project-state source.

## Problem and research

The project already has the correct underlying authorities, but no single product-facing backend readiness truth composes them.

Inspected production owners:

- `src-tauri/src/ai/settings.rs`: `ai_settings_v1`, keyring-backed credentials, provider/model validation and settings fingerprint.
- `src-tauri/src/global_index/managed_scope.rs`: Managed Scope `enabled`, `allow_local_ai`, `allow_cloud_ai`.
- `src-tauri/src/content.rs` and `content/policy.rs`: consent-bound Content Scope Policy with `enabled`, `local_allowed`, `cloud_allowed`, policy revisions and Content Run confirmation.
- Managed AI / Organization semantic and Cleanup consumers already revalidate scope/provider state independently.

There is also real configuration-semantics drift: persisted Settings require an enabled OpenAI-compatible provider to have a configured credential, while some legacy consumers still contain their own `provider_is_configured` checks. This Track establishes the canonical readiness contract without silently widening provider or consent authority.

## Scope

- In scope:
  - one production backend readiness module/helper authority;
  - global provider/configuration readiness from current settings + credential store;
  - exact Managed Scope metadata-AI readiness from backend scope identity;
  - exact Content Understanding readiness from backend File Library root IDs + Content Scope Policy;
  - stable status/reason and disclosure projection;
  - settings/scope/policy revision binding sufficient for later consumers to reject stale snapshots;
  - deterministic tests.
- Deliverables:
  - provider readiness;
  - managed metadata readiness;
  - content readiness;
  - explicit disclosure facts;
  - result/current-truth/architecture documentation.
- Acceptance criteria:
  - no renderer path or UI boolean becomes authority;
  - no second consent store and no persisted `ai_ready` flag;
  - future PM code can consume one backend contract while keeping consent domains separate.

## Frozen readiness semantics

Canonical states may include:

- `ready`
- `disabled`
- `needs_provider`
- `needs_credential`
- `needs_consent`
- `scope_disabled`
- `policy_blocked`
- `temporarily_unavailable` only when real runtime evidence exists
- `error`

Configuration alone must never fabricate live-connectivity availability.

Provider mode is derived from the current provider kind:

- Ollama -> local
- OpenAI-compatible -> cloud

For the new readiness authority, enabled cloud provider readiness follows the durable Settings contract: required cloud credential must exist. Legacy consumer behavior is not silently treated as the new authority.

## Consent and disclosure freeze

### Managed metadata AI

Managed Scope is the consent/policy owner.

The backend projection must state:

- filename/name metadata is sent to the AI provider;
- parent path disclosure follows current `send_parent_path` / full-path settings;
- full path disclosure follows current `send_full_path`;
- file content is not part of this metadata-AI contract.

Cloud Managed AI without current `allow_cloud_ai` must not be reported ready. Local Managed AI without `allow_local_ai` must not be reported ready.

### Content Understanding

Content Scope Policy remains a separate consent authority.

The readiness contract must preserve:

- policy `enabled` and relevant local/cloud permission;
- policy revisions;
- bounded extracted content may be sent only through the existing provider path;
- path/filename/secrets are not provider payload;
- Content Run confirmation remains required;
- readiness does not equal confirmation and cannot bypass it.

## Non-goals

- PM-01 activation or #274 modification;
- Organize fallback removal;
- Cleanup required-AI execution behavior;
- onboarding/Settings redesign;
- Rules/Automation migration;
- new connectivity monitor;
- schema migration unless owner review proves unavoidable;
- second AI queue;
- agent/tool/shell/MCP authority;
- RAG/vector DB/embeddings;
- filesystem mutation/recovery authority changes;
- #270;
- release publication.

## Authority and architecture freeze

- Current durable authorities: AI settings/keyring, Managed Scope, Content Scope Policy/Content Run, SemanticAssessmentV1, Analysis Finding, Operation Preview, Safe Trash/journal/Restore.
- Frontend/projection boundaries: any future UI readiness snapshot is presentation only; action paths must re-evaluate backend authority at execution time.
- Authority, persistence, platform, permission or recovery changes: no new authority; default **NO SCHEMA MIGRATION**.
- ADR or narrower security contract: existing AI/content/provider contracts remain binding.

## Validation

- Focused checks:
  - provider disabled/config invalid/credential missing/local ready/cloud ready;
  - Managed Scope missing/disabled/local-cloud policy states;
  - Content policy absent/disabled/local-cloud consent states;
  - disclosure truth;
  - revision/staleness;
  - arbitrary renderer path rejection.
- Applicable full checks: Rust fmt/clippy/focused tests, governance, exact-head Hosted CI.
- Exact-head evidence: Production HEAD `dc144b6efaa6ae101f7c624ad32228cb85b91d65`; CI [36324852969](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36324852969) — **SUCCESS**. Docs-only Final HEAD `a8bc3284bdf98fa697ad49c318eeeab59f224a99`; CI [36327475054](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36327475054) — **SUCCESS**. Focused readiness tests: **11 passed**. Windows/macOS Rust quality and release compile passed; fmt, Clippy with `--all-targets -- -D warnings`, and diff-check passed. Owner review passed in PR comment `5857028109`.
- Visual/native/platform checks: no UI change planned; native visual acceptance not applicable unless scope changes.
- Known unverified areas: live provider network reachability is intentionally not inferred by configuration readiness.

## Wave/Track and PR

- Wave/Track breakdown:
  1. architecture/contract freeze;
  2. backend readiness implementation;
  3. focused security/contract tests;
  4. docs/result and owner review.
- PR URL/number: [#279 — merged](https://github.com/ArdenZC/Zen-Canvas/pull/279).
- Review owner: direct owner/ChatGPT diff and evidence review; Codex Review is not merge authority.

## Closeout

- Merge SHA: `a62c30f037956c3838244e113da881d9c77b7be1`.
- Production HEAD: `dc144b6efaa6ae101f7c624ad32228cb85b91d65`; owner Production HEAD review accepted documentation closeout in PR comment `5856883781`; final owner review passed in PR comment `5857028109`.
- Current-truth files updated: Result/Architecture/STATUS/ROADMAP/RISK reconciled through the merge and this docs-only closeout.
- Deferred/unverified items recorded: live provider connectivity is not inferred by configuration readiness; PM-01 hold and #270 remain separate.
- Local task hygiene: **PENDING — NOT A PRODUCT OR MERGE BLOCKER**. `F:\.codex-temp\ai-readiness-consent` retains 10 task-owned SQLite fixtures after the automatic safety reviewer rejected the bounded cleanup action before execution. No bypass was used.
- Merge-after CI: [36329213184](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36329213184) — **SUCCESS**. Issue #278 is **CLOSED / completed**. Branch retirement remains optional repository hygiene after closeout.
