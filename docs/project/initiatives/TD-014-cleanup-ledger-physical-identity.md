# TD-014 — Cleanup Ledger Physical Identity Normalization

Status: ACTIVE — implementation

Owner: Zen Canvas

Start baseline: `master@896a4a4e3773c0f6038f21e4330ccf3caafc1589`

Branch: `docs/td-014-cleanup-ledger-activation`

This record preserves the bounded Phase-A authorization for the TD-014 cleanup-ledger remediation. PR #177 activated that authorization at `master@612409f8a67ee54da42ded2b296c3391eb40cb48`; bounded Phase-B implementation and reviewer remediation now proceed in PR #176. This is not a second project-status source; current stage and release facts remain in `STATUS.md` and sequencing remains in `ROADMAP.md`.

## Problem and research

The schema-34 cleanup ledger has no dedicated source-volume column, so the candidate implementation in PR #176 replaces a macOS runtime compatibility encoding with explicit physical-identity components. The candidate already exists, but it is not authorized to merge merely because it exists. This activation authorizes review and remediation toward a mergeable Schema-35 candidate, and requires all current reviewer blockers to be resolved before merge.

The existing filesystem identity, Safe Trash, SourceClaim, recovery and migration contracts remain authoritative. The frozen Cleanup Claim same-volume invariant was reviewed: Safe Trash remains under the source parent, the macOS Source Claim remains in the private source-side namespace, and Restore Claim rebinds to the coordinated current source parent. No new Claim-volume authority is authorized by this initiative.

## Scope

- In scope:
  - one new cleanup-ledger column: `source_platform_volume_id`;
  - schema 34→35 historical tagged identity normalization;
  - runtime tagged-adapter retirement;
  - raw source, Trash and Claim file IDs;
  - Restore Claim binding to the verified Trash identity;
  - fail-closed handling for legacy ambiguous and untagged macOS rows.
- Deliverables:
  - a reviewed, bounded implementation candidate in PR #176;
  - migration, recovery and applicable native evidence sufficient for the final merge decision;
  - truthful current-truth and technical-debt updates after the candidate is accepted.
- Acceptance criteria:
  - the candidate preserves the existing Safe Trash, Restore, SourceClaim and recovery authorities;
  - legacy identity cannot be promoted without explicit proof;
  - all reviewer blockers are resolved and required exact-head hosted lanes are green before merge.

## Non-goals

- Explicitly not changing:
  - ES-04 or W5 activation;
  - File Operations schema redesign or a Claim-volume column;
  - Safe Trash, filesystem mutation, permission, supported-platform or recovery authority;
  - unrelated technical debt, package version, release or tag state.
- Deferred work:
  - macOS native acceptance and other hosted exact-head evidence until the implementation candidate is reviewed;
  - any follow-on cleanup outside TD-014.

## Authority and architecture freeze

- Current durable authorities: existing filesystem physical identity, Safe Trash and cleanup journal, SourceClaim, Restore/recovery ledgers, and SQLite schema/migrations.
- Frontend/projection boundaries: no frontend or renderer authority changes are authorized.
- Authority, persistence, platform, permission or recovery changes: one bounded cleanup-ledger persistence column and its migration; no authority redesign.
- ADR or narrower security contract: none. The frozen same-volume Claim invariant remains valid; a new ADR is required only if implementation proves that invariant false.

## Validation

- Focused checks: Phase-A documentation and governance validation completed on the activation branch; Phase-B migration, runtime, recovery and compatibility regressions are owned by PR #176.
- Applicable full checks: implementation, Rust, frontend, performance and native gates remain owned by PR #176 and the current CI router.
- Exact-head evidence: the activation merge is `master@612409f8a67ee54da42ded2b296c3391eb40cb48`; the PR #176 remediation candidate must report its own exact head and hosted evidence.
- Visual/native/platform checks: macOS native acceptance remains pending hosted exact-head evidence.
- Known unverified areas: PR #176 must resolve the legacy trust-promotion and cross-volume restore-target blockers before merge.

## Wave/Track and PR

- Wave/Track breakdown: bounded maintenance initiative between W4 and the eligible-but-inactive W5; Phase A activated the initiative, and Phase B is the bounded PR #176 remediation.
- PR URL/number: Phase-A activation is PR #177; the implementation candidate and review remediation remain in PR #176.
- Review owners or required reviewers: repository maintainer / TD-014 reviewer owner.

## Closeout

- Merge SHA: pending reviewer merge.
- Current-truth files updated: `STATUS.md`, `ROADMAP.md` and this initiative record for Phase-A authorization.
- Deferred/unverified items recorded: PR #176 reviewer blockers and hosted macOS exact-head acceptance remain explicit.
- Source and integration branches deleted after ancestor/content-equivalence verification: pending.
