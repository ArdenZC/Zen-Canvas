# Pre-PM AI Readiness + Consent Contract — Activation

Status: **ACTIVE — implementation authorized only for the bounded Pre-PM foundation**

Issue: #278

Activation baseline: `master@6529d6023454cf50afc385b3ac9b503ca4a3a4cd`

Branch: `foundation/ai-readiness-consent`

## 1. Objective

Implement one backend-owned readiness/consent contract that composes existing AI settings/credentials, Managed Scope policy and Content Scope Policy without merging those authorities into a new store.

The output is a foundation for later PM-01 consumption. PM-01 remains **NOT ACTIVE**.

## 2. Required architecture inventory

Read before production changes:

- `src-tauri/src/ai/settings.rs`
- `src-tauri/src/ai/schema.rs`
- `src-tauri/src/global_index/managed_scope.rs`
- `src-tauri/src/global_index/models.rs`
- `src-tauri/src/global_index/managed_worker_hardened.rs`
- `src-tauri/src/db/queries/organization/semantic.rs`
- `src-tauri/src/ai/cleanup/**`
- `src-tauri/src/content.rs`
- `src-tauri/src/content/policy.rs`
- `src-tauri/src/content/preview.rs`
- `src-tauri/src/rule_proposals.rs`
- relevant provider/settings/content/global-index tests and command-permission contracts.

## 3. Provider readiness contract

Build a single production helper/domain module.

It must use current persisted settings plus credential-store truth and expose stable reasons, not parse UI state.

Minimum facts:

- enabled;
- provider kind and local/cloud mode;
- model/config validity;
- credential required/configured;
- settings fingerprint/revision;
- readiness state/reason.

Do not claim provider connectivity from config alone.

## 4. Managed metadata readiness

Input must be backend-owned Managed Scope identity, never an arbitrary path supplied by renderer.

Evaluate:

- exact scope exists;
- scope enabled;
- current provider mode;
- corresponding `allow_local_ai` or `allow_cloud_ai`;
- provider readiness;
- scope revision/currentness token using existing state.

Disclosure projection must truthfully state filename metadata and path settings. No file-content consent is inferred.

## 5. Content readiness

Input must use backend-owned File Library root IDs / existing scope resolution.

Evaluate current Content Scope Policy:

- policy exists/current;
- enabled;
- provider mode is permitted by `local_allowed` / `cloud_allowed`;
- provider readiness;
- policy revision/currentness.

Preserve Content's separate explicit confirmation. Readiness must never imply that a cloud Content Run has already been confirmed.

Disclosure projection must keep path/filename/secrets false for Content provider payload and bounded extracted content true only for the authorized provider path.

## 6. Staleness contract

A readiness projection may contain settings/scope/policy revision tokens for UI/product use, but action code must re-evaluate current backend state.

Do not persist `ready=true` as new authority.

## 7. Expected states

At minimum support deterministic differentiation of:

`ready`, `disabled`, `needs_provider`, `needs_credential`, `needs_consent`, `scope_disabled`, `policy_blocked`, `temporarily_unavailable` (only with real runtime evidence), `error`.

If implementation evidence supports a smaller/cleaner enum, preserve the semantic distinctions rather than mechanically matching names.

## 8. Tests

Required focused tests include:

- disabled;
- invalid provider/model;
- cloud missing credential;
- Ollama local ready;
- Managed Scope missing/disabled;
- Managed cloud permission absent;
- Managed local permission absent;
- Managed ready local/cloud;
- filename/parent/full-path disclosure truth;
- Content default policy disabled;
- Content local/cloud permissions;
- Content provider disclosure excludes path/filename;
- current revision vs stale settings/scope/policy snapshots;
- no renderer path authority.

## 9. Hard boundaries

No:

- PM-01 activation;
- #274 implementation;
- Organize/Cleanup product gating;
- onboarding/Settings UI redesign;
- schema migration by default;
- second queue;
- new agent/tool/shell authority;
- mutation/Preview/journal/Restore authority change;
- #270;
- release work.

## 10. Result

Create `docs/project/tasks/PRE-PM-AI-READINESS-CONSENT-CONTRACT-RESULT.md` during implementation closeout.

Final implementation disposition may reach only:

`READY FOR OWNER REVIEW`

until direct owner review passes.
