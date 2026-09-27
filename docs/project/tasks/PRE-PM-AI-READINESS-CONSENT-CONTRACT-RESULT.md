# Pre-PM AI Readiness + Consent Contract — Result

Status: **IMPLEMENTATION COMPLETE — OWNER REVIEW PASSED — READY TO MERGE — LOCAL TASK HYGIENE PENDING**

Issue: [#278](https://github.com/ArdenZC/Zen-Canvas/issues/278)

Branch: `foundation/ai-readiness-consent`

Draft PR: [#279](https://github.com/ArdenZC/Zen-Canvas/pull/279)

Activation baseline: `master@6529d6023454cf50afc385b3ac9b503ca4a3a4cd`

Production HEAD: `dc144b6efaa6ae101f7c624ad32228cb85b91d65`

Owner Production HEAD review: PR comment `5856883781` — **Production HEAD ACCEPTED — READY FOR DOCUMENTATION CLOSEOUT — LOCAL TASK HYGIENE PENDING**.

Final owner review: PR comment `5857028109` — **OWNER REVIEW PASSED — PRE-PM AI READINESS + CONSENT CONTRACT ACCEPTED**.

## 1. Outcome

The bounded Pre-PM foundation is implemented without activating PM-01.

Zen now has one production backend readiness authority that composes existing provider/settings/credential truth with the existing Managed Scope and Content Scope Policy authorities. It does not introduce a second consent store, a persisted `ai_ready` flag, a second AI queue, a renderer-owned readiness authority or any filesystem mutation authority.

The new production module is `src-tauri/src/ai/readiness.rs`. `src-tauri/src/ai/mod.rs` exports the module, and the existing settings loader with revision is made crate-internal so the readiness authority can bind to current settings/keyring truth.

No schema migration was introduced. No UI or Tauri renderer command was added.

## 2. Provider readiness

The backend distinguishes:

- `ready`;
- `disabled`;
- `needs_provider`;
- `needs_credential`;
- scope/policy states used by context readiness;
- `temporarily_unavailable` only as a semantic state when real runtime evidence exists;
- `error`.

Configuration readiness does not claim provider network connectivity.

Provider mode is derived from provider kind:

- Ollama -> local;
- OpenAI-compatible -> cloud.

Cloud readiness requires the durable credential-store truth. The provider binding includes settings revision/fingerprint inputs plus credential presence so deleting a key invalidates a previously captured readiness binding even when the settings JSON itself did not change.

## 3. Readiness precedence

For an existing context, the frozen order is:

```text
context exists
→ context enabled
→ provider/configuration/credential readiness
→ context-specific local/cloud consent or policy
→ ready
```

Therefore provider disabled, invalid configuration or missing credential cannot be masked as a consent-only problem.

## 4. Managed metadata AI

Managed AI readiness takes a backend-owned Managed Scope ID. Arbitrary renderer path text is not a scope authority.

It composes:

- current provider readiness;
- exact Managed Scope identity;
- scope enabled state;
- `allow_local_ai`;
- `allow_cloud_ai`;
- scope-policy/currentness fingerprint.

Managed metadata disclosure is explicit:

- provider payload includes filename/name metadata;
- parent-path inclusion follows current path-disclosure settings;
- full-path inclusion follows current full-path setting;
- file content is not part of this metadata-AI contract.

Local policy denial remains distinct from cloud consent requirement.

## 5. Content Understanding

Content readiness takes backend-owned File Library root IDs and composes:

- current provider readiness;
- live File Library root identity/revision;
- Content Scope Policy revision;
- `enabled`;
- `local_allowed`;
- `cloud_allowed`.

Content consent remains separate from Managed metadata consent.

Readiness does not replace Content Run confirmation. `requires_run_confirmation` remains true.

The Content provider disclosure contract remains:

- bounded extracted content may be included when the existing policy/run flow authorizes it;
- filename is not provider payload;
- parent/full path is not provider payload;
- secrets are not introduced by this readiness layer.

## 6. Staleness/currentness

Readiness is a derived snapshot, not durable truth.

The backend exposes binding fingerprints and current-binding helpers. Settings/credential changes, Managed Scope policy changes and Content policy/root revision changes alter the corresponding binding. Future PM consumers must re-evaluate backend readiness/currentness rather than treating a renderer snapshot as durable authority.

No action path is authorized to bypass its existing execution-time revalidation.

## 7. Tests and exact-head validation

Focused readiness suite on the accepted Production HEAD:

- **11 passed**
- **0 failed**

The focused contracts cover provider disabled/configuration/credential/local-ready states, provider-blocker precedence, exact Managed Scope lookup and local/cloud policy, path-disclosure truth, credential-loss invalidation, Content root/policy consent, independent credential-versus-consent gates, policy-revision invalidation and disabled Content roots.

Quality results:

- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` — **PASS**
- focused readiness tests — **11 passed**
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features "desktop-runtime native-qa" --all-targets -- -D warnings` — **PASS**
- `git diff --check` — **PASS**
- exact-head Hosted CI [36324852969](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36324852969) on `dc144b6efaa6ae101f7c624ad32228cb85b91d65` — **SUCCESS**
- docs-only Final HEAD `a8bc3284bdf98fa697ad49c318eeeab59f224a99`; exact-head CI [36327475054](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36327475054) — **SUCCESS**
- Windows Rust quality — **SUCCESS**
- macOS Rust quality — **SUCCESS**
- Windows release compile — **SUCCESS**
- macOS release compile — **SUCCESS**
- Windows native filesystem hardening smoke — **SUCCESS**
- macOS lifecycle blocking-lifetime / race / Apple Silicon Quick Look lifecycle checks — **SUCCESS**

The final commit from previous HEAD `d70253d716249a051d5f4d2dcce04302c3dd1c93` to Production HEAD `dc144b6efaa6ae101f7c624ad32228cb85b91d65` is test-only: three `AISettings` test constructors were converted from default-plus-field-reassignment to struct initializers to satisfy Clippy. Production readiness logic did not change in that final repair.

## 8. Authority preservation

Unchanged authorities include:

- AI settings and credential store;
- Managed Scope policy;
- Content Scope Policy and Content Run confirmation;
- managed-AI queue;
- SemanticAssessmentV1;
- Cleanup Analysis Finding and current-assessment authority;
- Organization Plan;
- Operation Preview;
- confirmation;
- Safe Trash / journal;
- Restore.

Readiness is a projection of those authorities, not a replacement.

## 9. Privacy / consent truth

The Track intentionally does not collapse consent into one global boolean.

Managed metadata AI and Content Understanding remain separate consent domains because they disclose different data and have different execution contracts.

The readiness DTO describes what an authorized provider payload would include; querying readiness itself does not send file data.

## 10. Local task hygiene

Task-owned SQLite fixtures remain under:

`F:\.codex-temp\ai-readiness-consent`

Read-only closeout reported **10 files**.

The automatic safety reviewer rejected the bounded cleanup action before execution. No deletion-policy bypass, force workaround or unrelated/shared-state cleanup was attempted.

Disposition:

**LOCAL TASK HYGIENE PENDING — HOST POLICY BLOCKED CLEANUP — NOT A PRODUCT OR MERGE BLOCKER.**

This follows existing repository precedent for policy-blocked task-local cleanup. The residue must remain reported until an authorized owner/local cleanup removes it.

## 11. Deferred / not claimed

- PM-01 remains **NOT ACTIVE** on owner design hold in #273 / Draft PR #274.
- #274 was not modified.
- #270 remains separate.
- No UI/readiness presentation was implemented.
- No Tauri renderer readiness command was added.
- No live provider connectivity monitor was added.
- Provider configuration readiness is not a network-health claim.
- No schema migration occurred.
- No release/publication work occurred.

## 12. Changed production files

Production implementation is bounded to:

- `src-tauri/src/ai/readiness.rs`
- `src-tauri/src/ai/mod.rs`
- `src-tauri/src/ai/settings.rs`

The rest of this closeout is documentation/current-truth evidence.

## 13. Owner-review gate

Current pre-merge disposition:

**OWNER REVIEW PASSED — READY TO MERGE — LOCAL TASK HYGIENE PENDING.**

The local hygiene residue is not a product or merge blocker, but it remains truthfully unresolved.

Do not mark this Track `COMPLETE` or `MERGED` until merge closeout occurs.
