# TD-014 — Cleanup Ledger Physical Identity Normalization

Status: COMPLETE / CLOSED

Owner: Zen Canvas

Start baseline: `master@896a4a4e3773c0f6038f21e4330ccf3caafc1589`

Activation baseline: `master@612409f8a67ee54da42ded2b296c3391eb40cb48`

Accepted implementation baseline: `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`

This record is the final bounded authority and closeout for the TD-014 cleanup-ledger remediation. PR #177 activated the initiative; PR #176 delivered and was accepted as the implementation. Current project state remains owned by `STATUS.md` and sequencing by `ROADMAP.md`.

## Problem and research

The schema-34 cleanup ledger had no dedicated source-volume column, so macOS cleanup physical identity used the compatibility encoding `macos-dev-ino:<volume>:<file>` in file-ID fields. The bounded remediation moved cleanup persistence to schema 35 with explicit source volume plus raw source/Trash/Claim file IDs while preserving existing Safe Trash, Restore, SourceClaim and recovery authority.

The frozen Cleanup Claim same-volume invariant remained valid: Safe Trash stays under the source parent, macOS Claim ownership remains in the private source-side namespace, and Restore Claim is explicitly rebound to the verified Trash identity. No separate Claim-volume authority was required.

## Scope and accepted result

- Schema 35 adds exactly one cleanup-ledger column: `source_platform_volume_id`.
- Coherent schema-34 tagged source/Trash/Claim identity is normalized transactionally to explicit components.
- Mixed, conflicting or wholly untagged historical macOS evidence is not promoted to trusted identity; automatic recovery remains fail closed without explicit source-volume provenance.
- Runtime code no longer generates or parses the historical `macos-dev-ino:` encoding; the parser remains migration-input-only.
- New macOS cleanup rows persist explicit source volume and raw file IDs. Non-macOS rows retain their prior optional physical-ID behavior.
- Restore Claim explicitly binds its file identity and full hash to the verified Trash state.
- Proven same-volume Restore continues to require physical identity where applicable; cross-volume or unknown-volume Restore retains the accepted complete content-identity path.

## Non-goals preserved

TD-014 did not activate ES-04 or W5, add a Claim-volume column, redesign File Operations or Safe Trash authority, change supported platforms or permissions, change package version, or create release/tag state.

## Authority and architecture

Existing filesystem physical identity, Safe Trash and cleanup journal, SourceClaim, Restore/recovery ledgers and SQLite migration rules remain authoritative. The remediation changed one bounded persistence representation; it did not create a new mutation or recovery authority and did not require a new ADR.

## Validation and evidence

- Implementation PR: #176, final reviewed head `35a856d279c6199db079169177b94214e06bec38`.
- Hosted CI: run `33834541344`, successful on the final exact-head merge-integration candidate.
- macOS Rust tests, Clippy, 10,000-iteration race/adversarial validation and Apple Silicon native lifecycle all passed.
- The macOS regression `macos_legacy_untagged_cleanup_identity_cannot_be_promoted_by_recovery` ran on the hosted Apple Silicon runner and passed.
- Migration coverage passed for coherent normalization, mixed/conflicting fail-closed behavior, wholly untagged preservation, transactional rollback, idempotent schema-35 reopen and future-schema rejection.
- The existing `safe_trash_restore_identity_allows_cross_volume_content_identity` regression passed unchanged in meaning.
- Windows Rust/native filesystem hardening, frontend/build, applicable performance domains and Windows/macOS release compile all passed in the same hosted run.
- Release packaging, tag and publication workflows were not part of this maintenance initiative and were not run.
- The existing real external APFS cross-volume fixture remained unavailable in hosted CI and is therefore **UNVERIFIED**; its absence did not substitute for or invalidate the TD-014-specific hosted regression evidence.

## Closeout

- Activation PR: #177; activation merge `master@612409f8a67ee54da42ded2b296c3391eb40cb48`.
- Implementation PR: #176; squash merge `master@d7c96c1481caf5105ce82702ca95c2998d83b6cf`; tree `130a388d361b43b56c3d67c8b967e271c623081b`.
- TD-014 exit conditions are satisfied and the debt is closed in `TECH_DEBT.md` by the final current-truth closeout.
- W5 remains **ELIGIBLE / INACTIVE** and requires separate reviewed activation.
- Branch/worktree retirement follows the existing ADR-0008 lifecycle and is not a condition for this initiative's product/governance closeout.
