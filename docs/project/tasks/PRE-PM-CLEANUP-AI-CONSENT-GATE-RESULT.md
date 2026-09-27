# Pre-PM Cleanup AI Data-Sharing Consent Gate — Result

Status: **READY FOR OWNER REVIEW**

Issue: [#284](https://github.com/ArdenZC/Zen-Canvas/issues/284)

Draft PR: [#285](https://github.com/ArdenZC/Zen-Canvas/pull/285)

Baseline: `master@2aaeb7599a6f4e8520c92dd8b3726138b0395d9a`

Accepted Production HEAD candidate: `1ec24f49bf2e2c777bcc8206e9a286d9b396685a`

Exact-head CI: [36332783985](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36332783985) — **SUCCESS**

## Owner-audit finding closed

The PM-01 deep audit required a distinct Cleanup AI local/cloud data-sharing authority before Cleanup AI could become mandatory for new executable findings.

Before this Track:

- Cleanup AI always sent candidate name and deterministic candidate metadata;
- parent directory name was sent when `send_parent_path=true`;
- full path was sent when `send_full_path=true`;
- backend checked global AI and `cleanup_ai_enabled`;
- no Cleanup-specific local/cloud sharing permission existed;
- Managed Scope and Content Understanding consent were separate authorities and could not truthfully fill that gap.

## Implemented authority

Existing versioned `AISettings` now owns:

- `cleanup_local_ai_allowed`;
- `cleanup_cloud_ai_allowed`.

Both default to **false**.

Because `AISettings` already uses struct-level serde defaults, legacy saved settings that do not contain these fields deserialize with the new false defaults. No database schema migration is introduced.

## Derived Cleanup readiness

`crate::ai::readiness` now derives a Cleanup-specific projection from current backend truth:

```text
provider/settings available
→ global AI enabled/configured
→ cloud credential when required
→ cleanup_ai_enabled
→ provider mode
→ matching Cleanup local/cloud permission
→ READY
```

The Cleanup binding also incorporates:

- provider readiness binding;
- Cleanup feature enablement;
- local/cloud consent;
- parent-path disclosure;
- full-path disclosure;
- final readiness state/reason.

Changing consent or path-disclosure settings therefore changes the Cleanup binding.

No idle readiness check claims live provider/network reachability.

## Backend enforcement

The main-window `analyze_cleanup_candidates_with_ai` command continues to load current AI settings and credential truth from the backend. The configured-provider path derives Cleanup readiness from that backend-owned state and fails closed before provider construction/work when readiness is not `Ready`.

The renderer cannot supply a readiness or consent override.

Managed Scope `allow_local_ai/allow_cloud_ai` and Content Scope Policy do not satisfy Cleanup permission.

## Disclosure truth

Cleanup AI provider payload may include:

- candidate name: **yes**;
- deterministic candidate metadata: **yes**;
- parent name: according to `send_parent_path`;
- full path: according to `send_full_path`;
- file content: **no**.

Existing Settings now exposes separate local/cloud Cleanup permissions with copy that makes those boundaries explicit.

## Preserved authorities

Unchanged:

- Cleanup detectors and Analysis Finding;
- exact candidate coverage and publication CAS from #276;
- backend-only `has_current_ai_assessment` currentness predicate;
- Operation Preview;
- explicit confirmation;
- Safe Trash;
- operation/cleanup journal;
- Restore.

This Track does **not** make Cleanup AI mandatory for execution. PM-01 owns that product behavior.

## Validation

Exact-head run `36332783985` passed:

- source checkout/evidence contract;
- project governance/routing;
- frontend tests and architecture checks;
- frontend production build;
- W2-01 browser regression;
- W2-10 interaction/accessibility/responsive browser gate;
- W2-11 integrated experience/performance browser gate;
- Windows Rust fmt/tests/Clippy;
- Windows native filesystem hardening smoke;
- macOS Rust fmt/tests/Clippy;
- macOS native lifecycle blocking lifetime;
- macOS race validation;
- Apple Silicon native Quick Look lifecycle;
- Windows release compile;
- macOS release compile;
- Windows/macOS quality aggregation.

Two pre-existing static source-string tests were reconciled with already-merged architecture seams while diagnosing CI:
- Cleanup AI publication assertion now checks the current `publish_analysis_ai_assessments_cas` seam introduced by #276 rather than the removed historical `append_analysis_ai_assessment` name.
- Rule Proposal mutation-boundary assertion now checks production code before `#[cfg(test)]`, so a test-only SQL authority-count query mentioning `operation_logs` does not create a false production violation.

Those test repairs change no product authority.

## Database / release / research disposition

- database schema remains **35**;
- no new table or migration;
- no new provider queue/runtime;
- #270 unchanged;
- public release remains deferred;
- #283 research lane remains isolated and is not a merge gate;
- no Laya/Jev/System One/Preference Memory production code was added.

## PM-01 hold disposition

The Cleanup data-sharing consent prerequisite is **implemented and exact-head validated**.

The hold is not formally released until owner review passes and PR #285 merges.

Pre-owner disposition:

**READY FOR OWNER REVIEW**
