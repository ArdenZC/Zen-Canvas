# Pre-PM Cleanup AI Data-Sharing Consent Gate

Status: **ACTIVE — implementation — READY FOR OWNER REVIEW; Production HEAD `1ec24f49bf2e2c777bcc8206e9a286d9b396685a`; exact-head CI `36332783985` SUCCESS**

Owner: Zen Canvas

Baseline: `master@2aaeb7599a6f4e8520c92dd8b3726138b0395d9a`

Branch: `hardening/cleanup-ai-consent`

Issue: [#284 — Pre-PM Cleanup AI Data-Sharing Consent Gate](https://github.com/ArdenZC/Zen-Canvas/issues/284)

This initiative is intentionally narrow. `STATUS.md` remains the unique current-state source.

## Why this Track exists

The PM-01 owner deep-audit required distinct Cleanup AI local/cloud data-sharing consent before Cleanup AI could become a required semantic prerequisite.

The merged Pre-PM Readiness + Consent foundation (#279) established provider readiness, Managed Scope metadata-AI policy and Content Scope Policy. It did **not** create a Cleanup-specific policy.

Current Cleanup AI payload truth:

- candidate name is always included;
- deterministic candidate metadata is included;
- parent directory name is included when `send_parent_path=true`;
- full path is included when `send_full_path=true`;
- file content is not sent by the Cleanup AI path.

Current backend checks global AI enablement and `cleanup_ai_enabled`, but no distinct Cleanup local/cloud sharing permission exists.

Managed Scope `allow_local_ai/allow_cloud_ai` and Content Scope Policy are separate authorities and must not be reused.

## Scope

In scope:

- explicit Cleanup local/cloud sharing policy in existing versioned AI settings;
- fail-closed backward compatibility for saved settings lacking the new fields;
- production backend Cleanup readiness projection and binding fingerprint/currentness;
- backend enforcement before provider work;
- truthful provider-payload disclosure;
- existing AI Settings UX for explicit Cleanup local/cloud permission;
- tests proving authority separation.

Preferred fields:

- `cleanup_local_ai_allowed`
- `cleanup_cloud_ai_allowed`

Equivalent names are acceptable if semantics remain explicit.

## Readiness semantics

For Cleanup:

```text
settings/provider available
→ global AI enabled/configured
→ cleanup_ai_enabled
→ provider mode
→ matching Cleanup local/cloud consent
→ READY
```

Provider/network reachability is not inferred while idle.

Cleanup readiness is distinct from:

- Managed metadata AI readiness;
- Content Understanding readiness.

## Disclosure contract

An authorized Cleanup provider payload may include:

- candidate name: yes;
- deterministic candidate metadata: yes;
- parent name: according to `send_parent_path`;
- full path: according to `send_full_path`;
- file content: no.

The readiness query itself sends nothing.

## Persistence / migration

Use existing versioned AI settings persistence.

Default: **NO DATABASE SCHEMA MIGRATION**.

Missing legacy consent fields must fail closed.

The settings/currentness fingerprint must include Cleanup consent and disclosure settings.

## Backend enforcement

Backend Cleanup provider entrypoints must fail before provider work if consent is absent.

No renderer-provided readiness/consent boolean is authoritative.

Managed Scope or Content permission may not satisfy Cleanup permission.

## UX

Use the existing AI Settings surface.

Expose explicit local/cloud Cleanup permission and disclosure copy. Do not build a second provider-settings subsystem.

## Authority preservation

Unchanged:

- Cleanup detectors / Analysis Finding;
- current AI assessment publication/currentness from #276;
- Operation Preview;
- confirmation;
- Safe Trash;
- journal;
- Restore.

This Track does not make Cleanup AI mandatory for all new execution. PM-01 owns that product behavior.

## Non-goals

- PM-01 activation;
- Organize changes;
- System One/Laya/Jev/Preference Memory production work;
- schema migration by default;
- new queue/provider runtime;
- #270;
- release publication.

## Implemented result

Production HEAD: `1ec24f49bf2e2c777bcc8206e9a286d9b396685a`.

Exact-head CI: `36332783985` — **SUCCESS**.

Implemented:

- fail-closed `cleanup_local_ai_allowed` / `cleanup_cloud_ai_allowed` in existing AI settings;
- legacy missing fields -> false through the existing versioned serde/default path;
- Cleanup-specific derived readiness/binding/disclosure in `crate::ai::readiness`;
- configured-provider backend enforcement before provider construction/work;
- explicit local/cloud Cleanup permission controls and truthful disclosure copy in existing AI Settings;
- current path-disclosure settings participate in Cleanup binding;
- no database schema migration;
- no Managed Scope or Content consent reuse;
- no change to Cleanup Finding/current-assessment/Preview/Safe Trash/journal/Restore authority.

See [result](../tasks/PRE-PM-CLEANUP-AI-CONSENT-GATE-RESULT.md).

## Acceptance

**READY FOR OWNER REVIEW.** Owner review and merge are still required before PM-01 hold release.
